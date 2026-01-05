import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
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
  if (!currentChannels.includes(channel.id)) {
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
