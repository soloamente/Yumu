import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { errorEmbed, successEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { guildConfigSchema } from '../../database/schema.js';
import { sendDailyWord } from '../../services/daily-word-service.js';

const dailyWord: Command = {
  data: new SlashCommandBuilder()
    .setName('dailyword')
    .setDescription('Gestisci la parola del giorno')
    .addSubcommand(sub =>
      sub
        .setName('now')
        .setDescription('Invia subito la parola del giorno')
    )
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Configura il canale per la parola del giorno')
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale dove inviare la parola del giorno')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disattiva la parola del giorno')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Mostra lo stato della parola del giorno')
    ),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'now':
        await sendNow(interaction);
        break;
      case 'setup':
        await setupDailyWord(interaction);
        break;
      case 'disable':
        await disableDailyWord(interaction);
        break;
      case 'status':
        await showStatus(interaction);
        break;
    }
  },
};

async function sendNow(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.channel || !interaction.channel.isTextBased()) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando deve essere usato in un canale di testo.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    await sendDailyWord(interaction.channel);
    await interaction.deleteReply();
  } catch (error) {
    console.error('[DailyWord] Error sending:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Errore', 'Non è stato possibile inviare la parola del giorno.')],
    });
  }
}

async function setupDailyWord(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const channel = interaction.options.getChannel('canale', true);

  if (!('send' in channel)) {
    await interaction.reply({
      embeds: [errorEmbed('Canale non valido', 'Seleziona un canale di testo.')],
      ephemeral: true,
    });
    return;
  }

  guildConfigSchema.update(interaction.guild.id, {
    daily_word_channel_id: channel.id,
  });

  await interaction.reply({
    embeds: [successEmbed('Parola del giorno configurata!',
      `La parola del giorno verrà inviata in ${channel} ogni giorno alle **${config.dailyWord.hour}:${String(config.dailyWord.minute).padStart(2, '0')}**.\n\n` +
      `Usa \`/dailyword now\` per inviare subito una parola!`
    )],
  });
}

async function disableDailyWord(interaction: ChatInputCommandInteraction): Promise<void> {
  const hasPermission = await checkAdminPermission(interaction);
  if (!hasPermission) return;

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  guildConfigSchema.update(interaction.guild.id, {
    daily_word_channel_id: null,
  });

  await interaction.reply({
    embeds: [successEmbed('Parola del giorno disattivata', 
      'La parola del giorno non verrà più inviata automaticamente.'
    )],
  });
}

async function showStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const guildConfig = guildConfigSchema.getOrCreate(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📖 Stato Parola del Giorno')
    .addFields(
      {
        name: '📊 Stato',
        value: guildConfig.daily_word_channel_id ? '✅ Attivo' : '❌ Disattivato',
        inline: true,
      },
      {
        name: '📺 Canale',
        value: guildConfig.daily_word_channel_id 
          ? `<#${guildConfig.daily_word_channel_id}>` 
          : 'Non configurato',
        inline: true,
      },
      {
        name: '⏰ Orario',
        value: `${config.dailyWord.hour}:${String(config.dailyWord.minute).padStart(2, '0')}`,
        inline: true,
      }
    )
    .setFooter({ text: 'Usa /dailyword setup per configurare' });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default dailyWord;
