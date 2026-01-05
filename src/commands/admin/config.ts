import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { guildConfigSchema } from '../../database/schema.js';

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
          '`/botconfig info` - Info bot',
      }
    )
    .setFooter({ text: '頑張って! (Ganbatte!) - Buono studio!' });

  await interaction.reply({ embeds: [embed] });
}

export default botConfig;
