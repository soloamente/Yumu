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
import { gameEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embed-builder.js';
import { isJapanese, getRandomHiragana, toHiragana, hasKanji } from '../../utils/japanese.js';
import { validateJapaneseWord, getWordReading } from '../../services/jisho-service.js';
import { gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';

interface WordBombData {
  targetChar: string;
  usedWords: Set<string>;
  lives: Map<string, number>;
  currentPlayer: string | null;
  turnTimeout: NodeJS.Timeout | null;
  collector: MessageCollector | null;
  roundNumber: number;
}

const wordBomb: Command = {
  data: new SlashCommandBuilder()
    .setName('wordbomb')
    .setDescription('Word Bomb - Trova parole con il carattere dato!')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Inizia una partita di Word Bomb')
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Ferma la partita di Word Bomb')
    )
    .addSubcommand(sub =>
      sub
        .setName('rules')
        .setDescription('Mostra le regole di Word Bomb')
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

  if (interaction.client.activeGames.has(channelId)) {
    await interaction.reply({
      embeds: [errorEmbed('Partita in corso', 'C\'è già un gioco in questo canale!')],
      ephemeral: true,
    });
    return;
  }

  const targetChar = getRandomHiragana();

  const gameData: WordBombData = {
    targetChar,
    usedWords: new Set(),
    lives: new Map(),
    currentPlayer: null,
    turnTimeout: null,
    collector: null,
    roundNumber: 1,
  };

  const session: GameSession = {
    channelId,
    gameType: 'word_bomb',
    players: new Map(),
    startedAt: new Date(),
    data: gameData as unknown as Record<string, unknown>,
  };

  interaction.client.activeGames.set(channelId, session);

  const embed = gameEmbed('💣 Word Bomb - ワードボム',
    `La partita è iniziata!\n\n` +
    `**Trova una parola che contiene:** \`${targetChar}\`\n\n` +
    `Scrivi una parola giapponese che contiene \`${targetChar}\`!\n` +
    `Hai **${config.games.wordBomb.timeLimit} secondi** per rispondere!`
  )
    .setColor(config.colors.primary)
    .setFooter({ text: `Iniziato da ${interaction.user.username} • Vite: ${config.games.wordBomb.lives}` });

  await interaction.reply({ embeds: [embed] });

  startWordCollector(interaction, session);
}

function startWordCollector(interaction: ChatInputCommandInteraction, session: GameSession): void {
  const channel = interaction.channel;
  if (!channel || !('createMessageCollector' in channel)) return;

  const data = session.data as unknown as WordBombData;

  const collector = (channel as TextChannel).createMessageCollector({
    filter: (m: Message) => !m.author.bot && isJapanese(m.content),
    time: 3 * 60 * 1000, // 3 minutes max
  });

  data.collector = collector;

  // Start round timer
  startRoundTimer(interaction, session);

  collector.on('collect', async (message: Message) => {
    const currentData = session.data as unknown as WordBombData;
    const word = message.content.trim();
    const userId = message.author.id;

    // Initialize player if new
    if (!currentData.lives.has(userId)) {
      currentData.lives.set(userId, config.games.wordBomb.lives);
    }

    // Get the reading of the word if it contains kanji
    // This is crucial - we need to check the pronunciation, not the kanji character
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
    
    // Use reading if available, otherwise use the word itself converted to hiragana
    const wordForCheck = wordReading || toHiragana(word);
    const hiraganaWord = toHiragana(wordForCheck);

    // Check if word contains target character (in reading if kanji)
    if (!hiraganaWord.includes(currentData.targetChar)) {
      await message.reply({
        embeds: [errorEmbed(
          'Carattere mancante',
          `La parola deve contenere \`${currentData.targetChar}\`!\n\n` +
          `**La tua parola:** ${word}${wordReading ? ` (${wordReading})` : ''}\n` +
          `**Contiene:** ${hiraganaWord.split('').join(', ')}`
        )],
      });
      return;
    }

    // Check if word already used (use hiragana version for comparison)
    if (currentData.usedWords.has(hiraganaWord)) {
      await message.reply({
        embeds: [errorEmbed(
          'Parola già usata',
          `**${word}**${wordReading ? ` (${wordReading})` : ''} è già stata usata in questa partita!`
        )],
      });
      return;
    }

    // Validate word (optional)
    const isValid = await validateJapaneseWord(word);
    if (!isValid) {
      await message.reply({
        embeds: [warningEmbed(
          'Parola non trovata',
          `Non riesco a trovare **${word}** nel dizionario, ma accettata comunque!`
        )],
      });
    }

    // Valid word!
    currentData.usedWords.add(hiraganaWord);
    
    // Award points
    const currentScore = session.players.get(userId) || 0;
    session.players.set(userId, currentScore + 1);
    awardXp(userId, message.author.username, 10);

    // Clear timer and start new round
    if (currentData.turnTimeout) {
      clearTimeout(currentData.turnTimeout);
    }

    // New character for next round
    currentData.targetChar = getRandomHiragana();
    currentData.roundNumber++;

    const embed = successEmbed(
      'Parola corretta!',
      `**${word}**${wordReading ? ` (${wordReading})` : ''} è corretta! +1 punto`
    )
      .addFields({
        name: '🎯 Prossimo Round',
        value: `**Round ${currentData.roundNumber}:** Trova una parola con \`${currentData.targetChar}\`!`,
      })
      .setFooter({ text: `Punteggio: ${currentScore + 1} punti` });

    await message.reply({ embeds: [embed] });

    startRoundTimer(interaction, session);
  });

  collector.on('end', () => {
    if (interaction.client.activeGames.has(session.channelId)) {
      endGame(interaction, session);
    }
  });
}

function startRoundTimer(interaction: ChatInputCommandInteraction, session: GameSession): void {
  const data = session.data as unknown as WordBombData;
  const channel = interaction.channel as TextChannel | null;

  if (data.turnTimeout) {
    clearTimeout(data.turnTimeout);
  }

  data.turnTimeout = setTimeout(async () => {
    // Time's up - bomb exploded!
    if (!channel || !('send' in channel)) return;

    const boomEmbed = gameEmbed(
      '💥 BOOM!',
      `Tempo scaduto!\n\nNessuno ha trovato una parola con \`${data.targetChar}\` in tempo!`
    )
      .setColor(config.colors.error);

    await channel.send({ embeds: [boomEmbed] });

    // New character
    data.targetChar = getRandomHiragana();
    data.roundNumber++;

    const nextRoundEmbed = gameEmbed(
      `🎯 Round ${data.roundNumber}`,
      `Trova una parola con \`${data.targetChar}\`!`
    )
      .setColor(config.colors.primary);

    await (channel as TextChannel).send({ embeds: [nextRoundEmbed] });

    startRoundTimer(interaction, session);
  }, config.games.wordBomb.timeLimit * 1000);
}

async function endGame(interaction: ChatInputCommandInteraction, session: GameSession): Promise<void> {
  const data = session.data as unknown as WordBombData;

  if (data.collector) {
    data.collector.stop();
  }
  if (data.turnTimeout) {
    clearTimeout(data.turnTimeout);
  }

  interaction.client.activeGames.delete(session.channelId);

  // Build final scores
  const scores = Array.from(session.players.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, score], i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} <@${id}> - ${score} parole`;
    })
    .join('\n') || 'Nessun punteggio';

  // Update stats
  const winner = Array.from(session.players.entries()).sort((a, b) => b[1] - a[1])[0];
  for (const [playerId, score] of session.players) {
    const won = winner && playerId === winner[0];
    gameStatsSchema.update(playerId, 'word_bomb', won, score);
    if (won) {
      awardXp(playerId, 'Unknown', config.xp.perGameWin);
    }
  }

  const channel = interaction.channel as TextChannel | null;
  if (channel && 'send' in channel) {
    const embed = successEmbed('💣 Partita Terminata!',
      `**Round completati:** ${data.roundNumber}\n` +
      `**Parole trovate:** ${data.usedWords.size}\n\n` +
      `**🏆 Classifica:**\n${scores}`
    );

    await channel.send({ embeds: [embed] });
  }
}

async function stopGame(interaction: ChatInputCommandInteraction): Promise<void> {
  const session = interaction.client.activeGames.get(interaction.channelId);

  if (!session || session.gameType !== 'word_bomb') {
    await interaction.reply({
      embeds: [errorEmbed('Nessuna partita', 'Non c\'è nessuna partita di Word Bomb in corso.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ 
    embeds: [infoEmbed('Fermando la partita...', 'La partita di Word Bomb verrà terminata a breve.')] 
  });
  await endGame(interaction, session);
}

async function showRules(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📖 Regole di Word Bomb')
    .setDescription('Trova parole che contengono il carattere mostrato prima che scada il tempo!')
    .addFields(
      {
        name: '🎯 Obiettivo',
        value: 'Scrivi parole giapponesi che contengono il carattere hiragana mostrato.',
      },
      {
        name: '⏱️ Tempo',
        value: `Hai ${config.games.wordBomb.timeLimit} secondi per trovare una parola.`,
      },
      {
        name: '📊 Punteggio',
        value: 'Guadagni 1 punto per ogni parola valida.',
      },
      {
        name: '❌ Regole',
        value: 
          '• Non puoi ripetere parole già usate\n' +
          '• La parola deve essere in giapponese\n' +
          '• La parola deve contenere il carattere richiesto',
      }
    )
    .setFooter({ text: 'Usa /wordbomb start per iniziare!' });

  await interaction.reply({ embeds: [embed] });
}

export default wordBomb;
