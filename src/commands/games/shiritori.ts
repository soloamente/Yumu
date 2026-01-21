import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Message,
  MessageCollector,
  TextChannel,
} from 'discord.js';
import type { Command, GameSession } from '../../types/index.js';
import { config } from '../../config.js';
import { gameEmbed, successEmbed, errorEmbed, warningEmbed } from '../../utils/embed-builder.js';
import { 
  isJapanese, 
  getLastMora, 
  getFirstMora, 
  endsWithN,
  toHiragana,
  hasKanji
} from '../../utils/japanese.js';
import { validateJapaneseWord, getWordReading } from '../../services/jisho-service.js';
import { userSchema, gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';
import { validateGameChannel } from '../../utils/game-channel-validator.js';

interface ShiritoriData {
  currentWord: string;
  usedWords: Set<string>;
  lastPlayerId: string;
  turnTimeout: NodeJS.Timeout | null;
  collector: MessageCollector | null;
}

const shiritori: Command = {
  data: new SlashCommandBuilder()
    .setName('shiritori')
    .setDescription('Gioca a Shiritori - il gioco della catena di parole giapponesi!')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Inizia una nuova partita di Shiritori')
        .addStringOption(opt =>
          opt
            .setName('parola')
            .setDescription('Parola iniziale (opzionale)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Ferma la partita di Shiritori in corso')
    )
    .addSubcommand(sub =>
      sub
        .setName('rules')
        .setDescription('Mostra le regole dello Shiritori')
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'start':
        await startGame(interaction);
        break;
      case 'stop':
        await stopGame(interaction);
        break;
      case 'rules':
        await showRules(interaction);
        break;
    }
  },
};

async function startGame(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;

  // Check channel permissions
  if (!(await validateGameChannel(interaction, 'shiritori'))) {
    return;
  }

  // Check if game already running
  if (interaction.client.activeGames.has(channelId)) {
    await interaction.reply({
      embeds: [errorEmbed('Partita in corso', 'C\'è già una partita di Shiritori in questo canale! Usa `/shiritori stop` per fermarla.')],
      ephemeral: true,
    });
    return;
  }

  // Get starting word
  let startWord = interaction.options.getString('parola') || 'さくら';
  
  // Validate starting word
  if (!isJapanese(startWord)) {
    await interaction.reply({
      embeds: [errorEmbed('Parola non valida', 'La parola deve essere in giapponese!')],
      ephemeral: true,
    });
    return;
  }

  if (endsWithN(startWord)) {
    await interaction.reply({
      embeds: [errorEmbed('Parola non valida', 'La parola non può terminare con ん!')],
      ephemeral: true,
    });
    return;
  }

  // Create game session
  const gameData: ShiritoriData = {
    currentWord: startWord,
    usedWords: new Set([toHiragana(startWord)]),
    lastPlayerId: interaction.user.id,
    turnTimeout: null,
    collector: null,
  };

  const session: GameSession = {
    channelId,
    gameType: 'shiritori',
    players: new Map(),
    startedAt: new Date(),
    data: gameData as unknown as Record<string, unknown>,
  };

  interaction.client.activeGames.set(channelId, session);

  // Get reading for starting word if it contains kanji
  let startWordReading: string | null = null;
  if (hasKanji(startWord)) {
    startWordReading = await getWordReading(startWord);
  }
  const lastMora = getLastMora(startWord, startWordReading);

  const embed = gameEmbed('Shiritori - しりとり', 
    `La partita è iniziata! 🎮\n\n` +
    `**Parola corrente:** ${startWord}${startWordReading ? ` (${startWordReading})` : ''}\n` +
    `**Prossima parola deve iniziare con:** \`${lastMora}\`\n\n` +
    `Scrivi una parola giapponese che inizia con \`${lastMora}\`!`
  )
    .setFooter({ text: `Iniziato da ${interaction.user.username} • Usa /shiritori stop per fermare` })
    .setColor(config.colors.primary);

  await interaction.reply({ embeds: [embed] });

  // Start listening for words
  startWordCollector(interaction, session);
}

function startWordCollector(interaction: ChatInputCommandInteraction, session: GameSession): void {
  const channel = interaction.channel;
  if (!channel || !('createMessageCollector' in channel)) return;

  const data = session.data as unknown as ShiritoriData;

  // Create message collector
  const collector = (channel as TextChannel).createMessageCollector({
    filter: (m: Message) => !m.author.bot && isJapanese(m.content),
    time: 5 * 60 * 1000, // 5 minutes max game time
  });

  data.collector = collector;

  collector.on('collect', async (message: Message) => {
    const word = message.content.trim();
    const currentData = session.data as unknown as ShiritoriData;
    
    // Get the reading of the word if it contains kanji
    // This is crucial for shiritori - we need the pronunciation, not the kanji character
    let wordReading: string | null = null;
    if (hasKanji(word)) {
      wordReading = await getWordReading(word);
      if (!wordReading) {
        await message.reply({
          embeds: [warningEmbed(
            'Lettura non trovata',
            `Non riesco a trovare la lettura di **${word}**. Potrebbe non essere una parola valida.`
          )],
        });
        return;
      }
    }
    
    // Use reading if available, otherwise use the word itself
    const wordForMora = wordReading || word;
    const hiraganaWord = toHiragana(wordForMora);
    
    // Get required starting mora from previous word
    // Also check if previous word had kanji and get its reading
    let previousWordReading: string | null = null;
    if (hasKanji(currentData.currentWord)) {
      previousWordReading = await getWordReading(currentData.currentWord);
    }
    const requiredMora = getLastMora(currentData.currentWord, previousWordReading);
    const wordFirstMora = getFirstMora(word, wordReading);

    // Check if word starts with correct mora
    if (requiredMora !== wordFirstMora) {
      const readingInfo = wordReading ? `\n**Lettura:** ${wordReading}` : '';
      await message.reply({
        embeds: [errorEmbed(
          'Mora errata',
          `La parola deve iniziare con \`${requiredMora}\`!\n\n` +
          `**La tua parola:** ${word}\n` +
          `**Inizia con:** \`${wordFirstMora}\`${readingInfo}`
        )],
      });
      return;
    }

    // Check if word was already used (use hiragana version for comparison)
    if (currentData.usedWords.has(hiraganaWord)) {
      await message.reply({
        embeds: [errorEmbed(
          'Parola già usata',
          `**${word}**${wordReading ? ` (${wordReading})` : ''} è già stata usata in questa partita!`
        )],
      });
      return;
    }

    // Check if word ends with ん (use reading if available)
    if (endsWithN(word, wordReading)) {
      const embed = gameEmbed(
        '💀 GAME OVER!',
        `**${word}**${wordReading ? ` (${wordReading})` : ''} termina con ん!\n\n` +
        `${message.author} ha perso la partita!`
      )
        .setColor(config.colors.error)
        .setFooter({ text: `Parole giocate: ${currentData.usedWords.size}` });
      
      await message.reply({ embeds: [embed] });
      endGame(interaction.client, session, message.author.id, true);
      return;
    }

    // Validate word exists (optional - can be slow)
    const isValid = await validateJapaneseWord(word);
    if (!isValid) {
      await message.reply({
        embeds: [warningEmbed(
          'Parola non trovata',
          `Non riesco a trovare **${word}** nel dizionario. Potrebbe non essere valida, ma continuo comunque.`
        )],
      });
      // Continue anyway - don't be too strict
    }

    // Valid word! Update game state
    currentData.usedWords.add(hiraganaWord);
    currentData.currentWord = word;
    currentData.lastPlayerId = message.author.id;

    // Update player score
    const currentScore = session.players.get(message.author.id) || 0;
    session.players.set(message.author.id, currentScore + 1);

    // XP system disabled - no longer awarding XP
    // awardXp(message.author.id, message.author.username, 5);

    // Get next mora using reading if available
    const nextMora = getLastMora(word, wordReading);

    const embed = successEmbed(
      'Parola corretta!',
      `**${word}**${wordReading ? ` (${wordReading})` : ''} è corretta!`
    )
      .addFields(
        {
          name: '🎯 Prossima mora',
          value: `\`${nextMora}\``,
          inline: true,
        },
        {
          name: '📊 Parole giocate',
          value: `${currentData.usedWords.size}`,
          inline: true,
        }
      )
      .setFooter({ text: `Prossima parola deve iniziare con: ${nextMora}` });

    await message.reply({ embeds: [embed] });
  });

  collector.on('end', () => {
    if (interaction.client.activeGames.has(session.channelId)) {
      endGame(interaction.client, session, null, false);
    }
  });
}

function endGame(
  client: ReturnType<typeof import('../../client.js').createClient>,
  session: GameSession,
  loserId: string | null,
  wasLoss: boolean
): void {
  const data = session.data as unknown as ShiritoriData;
  
  // Stop collector
  if (data.collector) {
    data.collector.stop();
  }

  // Clear timeout
  if (data.turnTimeout) {
    clearTimeout(data.turnTimeout);
  }

  // Remove from active games
  client.activeGames.delete(session.channelId);

  // Update stats for all players
  for (const [playerId, score] of session.players) {
    const won = wasLoss ? playerId !== loserId : false;
    gameStatsSchema.update(playerId, 'shiritori', won, score);
    
    // XP system disabled - no longer awarding XP for winners
    // if (won) {
    //   userSchema.updateXp(playerId, config.xp.perGameWin);
    // }
  }

  console.log(`[Shiritori] Game ended in channel ${session.channelId}, words played: ${data.usedWords.size}`);
}

async function stopGame(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const session = interaction.client.activeGames.get(channelId);

  if (!session || session.gameType !== 'shiritori') {
    await interaction.reply({
      embeds: [errorEmbed('Nessuna partita', 'Non c\'è nessuna partita di Shiritori in corso in questo canale.')],
      ephemeral: true,
    });
    return;
  }

  const data = session.data as unknown as ShiritoriData;

  // Build final scores
  const scores = Array.from(session.players.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score], i) => `${i + 1}. <@${id}> - ${score} parole`)
    .join('\n') || 'Nessun punteggio';

  endGame(interaction.client, session, null, false);

  const embed = successEmbed('Partita terminata!',
    `La partita di Shiritori è stata fermata.\n\n` +
    `**Parole giocate:** ${data.usedWords.size}\n\n` +
    `**Classifica:**\n${scores}`
  );

  await interaction.reply({ embeds: [embed] });
}

async function showRules(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📖 Regole dello Shiritori (しりとり)')
    .setDescription(
      `Lo Shiritori è un gioco di parole giapponese dove devi dire una parola che inizia con l'ultima sillaba della parola precedente.`
    )
    .addFields(
      {
        name: '🎯 Come giocare',
        value: 
          '1. Un giocatore dice una parola in giapponese\n' +
          '2. Il prossimo giocatore deve dire una parola che inizia con l\'ultima sillaba\n' +
          '3. Esempio: さくら → らーめん → んで PERDI!',
      },
      {
        name: '❌ Regole di perdita',
        value:
          '• Se dici una parola che finisce con **ん** (n), perdi!\n' +
          '• Non puoi ripetere parole già usate\n' +
          '• La parola deve essere giapponese valida',
      },
      {
        name: '💡 Suggerimenti',
        value:
          '• Evita parole che finiscono con ん\n' +
          '• Ricorda le parole già usate\n' +
          '• Usa parole comuni per non bloccarti',
      },
      {
        name: '🎮 Comandi',
        value:
          '`/shiritori start` - Inizia una partita\n' +
          '`/shiritori start [parola]` - Inizia con una parola specifica\n' +
          '`/shiritori stop` - Ferma la partita',
      }
    )
    .setFooter({ text: '頑張って! (Ganbatte!) - Buona fortuna!' });

  await interaction.reply({ embeds: [embed] });
}

export default shiritori;
