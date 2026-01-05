import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import type { Command, GameType } from '../../types/index.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { guildConfigSchema } from '../../database/schema.js';
import {
  setGameChannels,
  removeGameChannel,
  getAllGameChannels,
  getGameChannels,
} from '../../utils/game-channels.js';

const gameTypeChoices = [
  { name: 'Shiritori', value: 'shiritori' },
  { name: 'Kanji Quiz', value: 'kanji_quiz' },
  { name: 'Vocab Quiz', value: 'vocab_quiz' },
  { name: 'Number Game', value: 'number_game' },
  { name: 'Word Bomb', value: 'word_bomb' },
  { name: 'Typing Game', value: 'typing_game' },
  { name: 'Story Game', value: 'story_game' },
  { name: 'Tutti i Giochi', value: 'general' },
] as const;

const botConfig: Command = {
  data: new SlashCommandBuilder()
    .setName('botconfig')
    .setDescription('Configurazioni avanzate del bot')
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Mostra informazioni sul bot')
    )
    .addSubcommand(sub =>
      sub
        .setName('reset')
        .setDescription('Resetta la configurazione del server')
    )
    .addSubcommand(sub =>
      sub
        .setName('help')
        .setDescription('Mostra tutti i comandi disponibili')
    )
    .addSubcommand(sub =>
      sub
        .setName('setgamechannel')
        .setDescription('Imposta un canale per un gioco specifico')
        .addStringOption(opt =>
          opt
            .setName('gioco')
            .setDescription('Tipo di gioco')
            .setRequired(true)
            .addChoices(...gameTypeChoices)
        )
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale dove il gioco può essere giocato')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('removegamechannel')
        .setDescription('Rimuove un canale da un gioco specifico')
        .addStringOption(opt =>
          opt
            .setName('gioco')
            .setDescription('Tipo di gioco')
            .setRequired(true)
            .addChoices(...gameTypeChoices)
        )
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale da rimuovere')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('listgamechannels')
        .setDescription('Mostra tutti i canali configurati per i giochi')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'info':
        await showInfo(interaction);
        break;
      case 'reset':
        await resetConfig(interaction);
        break;
      case 'help':
        await showHelp(interaction);
        break;
      case 'setgamechannel':
        await setGameChannel(interaction);
        break;
      case 'removegamechannel':
        await removeGameChannelCommand(interaction);
        break;
      case 'listgamechannels':
        await listGameChannels(interaction);
        break;
    }
  },
};

async function showInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = interaction.client;

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('🤖 NihongoHub Bot')
    .setDescription('Bot per l\'apprendimento del giapponese')
    .setThumbnail(client.user?.displayAvatarURL() || '')
    .addFields(
      {
        name: '📊 Statistiche',
        value: 
          `**Server:** ${client.guilds.cache.size}\n` +
          `**Utenti:** ${client.users.cache.size}\n` +
          `**Comandi:** ${client.commands.size}`,
        inline: true,
      },
      {
        name: '⏱️ Uptime',
        value: `${hours}h ${minutes}m ${seconds}s`,
        inline: true,
      },
      {
        name: '🔧 Versione',
        value: '1.0.0',
        inline: true,
      },
      {
        name: '🎮 Giochi Disponibili',
        value: 
          '• Shiritori\n' +
          '• Kanji Quiz\n' +
          '• Vocab Quiz\n' +
          '• Number Game\n' +
          '• Word Bomb\n' +
          '• Typing Game\n' +
          '• Story Game',
        inline: true,
      },
      {
        name: '📚 Funzionalità',
        value:
          '• Sistema Livelli/XP\n' +
          '• Ricerca Dizionario\n' +
          '• Parola del Giorno\n' +
          '• Giveaway\n' +
          '• Eventi\n' +
          '• Study Tracker',
        inline: true,
      },
      {
        name: '🔗 Links',
        value: '[Jisho.org](https://jisho.org)',
        inline: true,
      }
    )
    .setFooter({ text: '日本語を楽しく学ぼう! (Impariamo il giapponese divertendoci!)' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function resetConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  // Reset all config to defaults
  guildConfigSchema.update(interaction.guild.id, {
    welcome_channel_id: null,
    welcome_message: null,
    daily_word_channel_id: null,
    game_channels: null,
    admin_role_id: null,
  });

  await interaction.reply({
    embeds: [successEmbed('Configurazione resettata',
      'Tutte le impostazioni del server sono state riportate ai valori predefiniti.\n\n' +
      'Usa `/setup` per riconfigurare il bot.'
    )],
    ephemeral: true,
  });
}

async function showHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📖 Comandi NihongoHub')
    .setDescription('Ecco tutti i comandi disponibili:')
    .addFields(
      {
        name: '🎮 Giochi',
        value:
          '`/shiritori` - Gioco della catena di parole\n' +
          '`/kanji quiz` - Quiz sui kanji\n' +
          '`/vocab quiz` - Quiz sul vocabolario\n' +
          '`/numbers quiz` - Quiz sui numeri\n' +
          '`/wordbomb start` - Word Bomb\n' +
          '`/typing start` - Pratica di battitura\n' +
          '`/story play` - Completa le frasi',
      },
      {
        name: '📚 Studio',
        value:
          '`/jisho [parola]` - Cerca nel dizionario\n' +
          '`/dailyword now` - Parola del giorno\n' +
          '`/study log [minuti]` - Registra studio\n' +
          '`/study stats` - Statistiche studio\n' +
          '`/study streak` - Streak di studio',
      },
      {
        name: '🏆 Community',
        value:
          '`/leaderboard xp` - Classifica XP\n' +
          '`/leaderboard games` - Classifica giochi\n' +
          '`/leaderboard profile` - Il tuo profilo',
      },
      {
        name: '🎉 Eventi (Admin)',
        value:
          '`/giveaway start` - Crea giveaway\n' +
          '`/event create` - Crea evento\n' +
          '`/event list` - Lista eventi',
      },
      {
        name: '⚙️ Configurazione (Admin)',
        value:
          '`/setup welcome` - Messaggi benvenuto\n' +
          '`/setup games` - Canali giochi\n' +
          '`/dailyword setup` - Parola del giorno\n' +
          '`/botconfig info` - Info bot\n' +
          '`/botconfig setgamechannel` - Imposta canale per gioco\n' +
          '`/botconfig listgamechannels` - Lista canali giochi',
      }
    )
    .setFooter({ text: '頑張って! (Ganbatte!) - Buono studio!' });

  await interaction.reply({ embeds: [embed] });
}

async function setGameChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const gameType = interaction.options.getString('gioco', true) as GameType | 'general';
  const channel = interaction.options.getChannel('canale', true);

  // Get current channels for this game type
  const currentChannels = getGameChannels(interaction.guild.id, gameType as GameType);
  
  // Add the channel if not already present
  const isNewChannel = !currentChannels.includes(channel.id);
  if (isNewChannel) {
    const newChannels = [...currentChannels, channel.id];
    setGameChannels(interaction.guild.id, gameType, newChannels);
  }

  const gameNames: Record<string, string> = {
    shiritori: 'Shiritori',
    kanji_quiz: 'Kanji Quiz',
    vocab_quiz: 'Vocab Quiz',
    number_game: 'Number Game',
    word_bomb: 'Word Bomb',
    typing_game: 'Typing Game',
    story_game: 'Story Game',
    general: 'Tutti i Giochi',
  };

  const gameName = gameNames[gameType] || gameType;
  const updatedChannels = getGameChannels(interaction.guild.id, gameType as GameType);

  // Send and pin embed in the channel if it's a new channel
  if (isNewChannel) {
    try {
      // Fetch the channel from the guild to ensure we have a TextChannel
      const textChannel = await interaction.guild.channels.fetch(channel.id);
      if (textChannel && textChannel instanceof TextChannel) {
        const infoEmbed = createGameChannelInfoEmbed(gameType, gameName);
        const message = await textChannel.send({ embeds: [infoEmbed] });
        await message.pin();
      }
    } catch (error) {
      console.error(`[BotConfig] Error sending/pinning message in channel ${channel.id}:`, error);
      // Continue anyway - don't fail the command if we can't send/pin
    }
  }

  await interaction.reply({
    embeds: [successEmbed(
      'Canale configurato!',
      `${channel} è stato aggiunto come canale per **${gameName}**.\n\n` +
      `**Canali configurati per ${gameName}:** ${updatedChannels.length}\n` +
      updatedChannels.map(id => `<#${id}>`).join(', ')
    )],
    ephemeral: true,
  });
}

/**
 * Create an embed with game information for the channel
 */
function createGameChannelInfoEmbed(
  gameType: GameType | 'general',
  gameName: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🎮 Canale ${gameName}`)
    .setDescription(
      `Questo canale è stato configurato per giocare a **${gameName}**!\n\n` +
      `Usa i comandi qui sotto per iniziare a giocare.`
    )
    .setTimestamp();

  const gameInfo: Record<string, { command: string; description: string }> = {
    shiritori: {
      command: '/shiritori start',
      description: 'Inizia una partita di Shiritori - il gioco della catena di parole giapponesi!\n\n' +
        '**Regole:**\n' +
        '• Dì una parola che inizia con l\'ultima sillaba della parola precedente\n' +
        '• Non puoi dire parole che finiscono con ん\n' +
        '• Non puoi ripetere parole già usate\n\n' +
        'Usa `/shiritori rules` per vedere le regole complete.',
    },
    kanji_quiz: {
      command: '/kanji quiz',
      description: 'Quiz sui kanji - impara i caratteri giapponesi!\n\n' +
        'Scegli tra diversi tipi di quiz:\n' +
        '• Significato → Kanji\n' +
        '• Kanji → Significato\n' +
        '• Lettura → Kanji\n' +
        '• Misto\n\n' +
        'Puoi selezionare il livello JLPT e il numero di domande.',
    },
    vocab_quiz: {
      command: '/vocab quiz',
      description: 'Quiz sul vocabolario giapponese!\n\n' +
        'Impara nuove parole con quiz interattivi:\n' +
        '• Giapponese → Italiano\n' +
        '• Italiano → Giapponese\n' +
        '• Misto\n\n' +
        'Scegli tra diverse categorie: saluti, numeri, famiglia, cibo, verbi, aggettivi, luoghi.',
    },
    number_game: {
      command: '/numbers quiz',
      description: 'Quiz sui numeri giapponesi!\n\n' +
        'Impara a dire i numeri in giapponese:\n' +
        '• Facile: 1-10\n' +
        '• Medio: 1-100\n' +
        '• Difficile: 1-1000\n' +
        '• Esperto: 1-10000\n\n' +
        'Usa `/numbers reference` per vedere la tabella dei numeri.',
    },
    word_bomb: {
      command: '/wordbomb start',
      description: 'Word Bomb - Trova parole con il carattere dato!\n\n' +
        '**Come giocare:**\n' +
        '• Ti verrà mostrato un carattere hiragana\n' +
        '• Trova una parola giapponese che contiene quel carattere\n' +
        '• Hai poco tempo per rispondere!\n\n' +
        'Usa `/wordbomb rules` per vedere le regole complete.',
    },
    typing_game: {
      command: '/typing start',
      description: 'Pratica la scrittura giapponese!\n\n' +
        'Migliora la tua velocità di scrittura:\n' +
        '• Frasi in giapponese da scrivere\n' +
        '• Livelli JLPT N5, N4\n' +
        '• Traccia il tempo e gli errori\n\n' +
        'Perfetto per praticare hiragana, katakana e kanji!',
    },
    story_game: {
      command: '/story play',
      description: 'Completa le frasi - Riempi gli spazi vuoti!\n\n' +
        '**Come giocare:**\n' +
        '• Ti verrà mostrata una frase con uno spazio vuoto\n' +
        '• Scegli la parola corretta tra le opzioni\n' +
        '• Impara la grammatica e il vocabolario\n\n' +
        'Perfetto per imparare il contesto delle parole!',
    },
    general: {
      command: 'Vedi i comandi qui sotto',
      description: 'Questo canale è configurato per tutti i giochi!\n\n' +
        '**Giochi disponibili:**\n' +
        '• `/shiritori start` - Shiritori\n' +
        '• `/kanji quiz` - Kanji Quiz\n' +
        '• `/vocab quiz` - Vocab Quiz\n' +
        '• `/numbers quiz` - Number Game\n' +
        '• `/wordbomb start` - Word Bomb\n' +
        '• `/typing start` - Typing Game\n' +
        '• `/story play` - Story Game\n\n' +
        'Usa `/botconfig listgamechannels` per vedere tutti i canali configurati.',
    },
  };

  const info = gameInfo[gameType] || gameInfo.general;

  embed.addFields({
    name: '🎯 Come iniziare',
    value: info.command,
    inline: false,
  });

  embed.addFields({
    name: '📖 Descrizione',
    value: info.description,
    inline: false,
  });

  if (gameType !== 'general') {
    embed.setFooter({ text: '頑張って! (Ganbatte!) - Buon divertimento!' });
  } else {
    embed.setFooter({ text: 'Usa /botconfig setgamechannel per configurare canali specifici per ogni gioco' });
  }

  return embed;
}

async function removeGameChannelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const gameType = interaction.options.getString('gioco', true) as GameType | 'general';
  const channel = interaction.options.getChannel('canale', true);

  const removed = removeGameChannel(interaction.guild.id, gameType, channel.id);

  if (!removed) {
    await interaction.reply({
      embeds: [errorEmbed(
        'Errore',
        `${channel} non è configurato come canale per questo gioco.`
      )],
      ephemeral: true,
    });
    return;
  }

  const gameNames: Record<string, string> = {
    shiritori: 'Shiritori',
    kanji_quiz: 'Kanji Quiz',
    vocab_quiz: 'Vocab Quiz',
    number_game: 'Number Game',
    word_bomb: 'Word Bomb',
    typing_game: 'Typing Game',
    story_game: 'Story Game',
    general: 'Tutti i Giochi',
  };

  const gameName = gameNames[gameType] || gameType;
  const remainingChannels = getGameChannels(interaction.guild.id, gameType as GameType);

  await interaction.reply({
    embeds: [successEmbed(
      'Canale rimosso!',
      `${channel} è stato rimosso dai canali per **${gameName}**.\n\n` +
      (remainingChannels.length > 0
        ? `**Canali rimanenti:** ${remainingChannels.map(id => `<#${id}>`).join(', ')}`
        : '**Nessun canale configurato** - il gioco può essere giocato in tutti i canali.')
    )],
    ephemeral: true,
  });
}

async function listGameChannels(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const allGameChannels = getAllGameChannels(interaction.guild.id);

  const gameNames: Record<string, string> = {
    shiritori: 'Shiritori',
    kanji_quiz: 'Kanji Quiz',
    vocab_quiz: 'Vocab Quiz',
    number_game: 'Number Game',
    word_bomb: 'Word Bomb',
    typing_game: 'Typing Game',
    story_game: 'Story Game',
    general: 'Tutti i Giochi',
  };

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('🎮 Canali Configurati per i Giochi')
    .setDescription(`Configurazione per **${interaction.guild.name}**`);

  // Add field for each game type
  const gameTypes: Array<GameType | 'general'> = [
    'general',
    'shiritori',
    'kanji_quiz',
    'vocab_quiz',
    'number_game',
    'word_bomb',
    'typing_game',
    'story_game',
  ];

  for (const gameType of gameTypes) {
    const channels = allGameChannels[gameType] || [];
    const gameName = gameNames[gameType] || gameType;

    embed.addFields({
      name: `${gameName}`,
      value: channels.length > 0
        ? channels.map(id => `<#${id}>`).join(', ')
        : '❌ Nessun canale configurato (disponibile ovunque)',
      inline: false,
    });
  }

  embed.setFooter({ text: 'Usa /botconfig setgamechannel per configurare i canali' });
  embed.setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default botConfig;
