import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { errorEmbed, successEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { createEvent, getUpcomingEvents, deleteEvent } from '../../services/event-service.js';

const event: Command = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Gestisci eventi nel server')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Crea un nuovo evento')
        .addStringOption(opt =>
          opt
            .setName('titolo')
            .setDescription('Titolo dell\'evento')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('descrizione')
            .setDescription('Descrizione dell\'evento')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('data')
            .setDescription('Data e ora (formato: YYYY-MM-DD HH:MM)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Mostra gli eventi in programma')
    )
    .addSubcommand(sub =>
      sub
        .setName('cancel')
        .setDescription('Cancella un evento')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('ID dell\'evento da cancellare')
            .setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Check permissions for create and cancel
    if (subcommand !== 'list') {
      const hasPermission = await checkAdminPermission(interaction);
      if (!hasPermission) return;
    }

    switch (subcommand) {
      case 'create':
        await createEventCommand(interaction);
        break;
      case 'list':
        await listEvents(interaction);
        break;
      case 'cancel':
        await cancelEvent(interaction);
        break;
    }
  },
};

async function createEventCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const title = interaction.options.getString('titolo', true);
  const description = interaction.options.getString('descrizione', true);
  const dateStr = interaction.options.getString('data', true);

  // Parse date
  const date = parseDate(dateStr);
  if (!date) {
    await interaction.reply({
      embeds: [errorEmbed('Data non valida', 
        'Usa il formato: `YYYY-MM-DD HH:MM`\n' +
        'Esempio: `2024-12-25 14:00`'
      )],
      ephemeral: true,
    });
    return;
  }

  // Check if date is in the future
  if (date <= new Date()) {
    await interaction.reply({
      embeds: [errorEmbed('Data non valida', 'La data deve essere nel futuro.')],
      ephemeral: true,
    });
    return;
  }

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const eventId = createEvent(
    interaction.guild.id,
    title,
    description,
    interaction.channelId,
    date,
    interaction.user.id
  );

  const timestamp = Math.floor(date.getTime() / 1000);

  const embed = successEmbed('Evento creato!',
    `**${title}**\n\n` +
    `${description}\n\n` +
    `📅 **Data:** <t:${timestamp}:F>\n` +
    `⏰ **Tra:** <t:${timestamp}:R>\n` +
    `🆔 **ID:** #${eventId}`
  );

  await interaction.reply({ embeds: [embed] });

    // Also send a public announcement
    if (interaction.channel && 'send' in interaction.channel) {
      const announcementEmbed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`📅 Nuovo Evento: ${title}`)
      .setDescription(description)
      .addFields(
        {
          name: '🕐 Data e ora',
          value: `<t:${timestamp}:F>`,
          inline: true,
        },
        {
          name: '⏰ Tra',
          value: `<t:${timestamp}:R>`,
          inline: true,
        },
        {
          name: '👤 Organizzato da',
          value: `${interaction.user}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Riceverai un reminder 1 ora prima!' })
      .setTimestamp();

    await interaction.channel.send({ embeds: [announcementEmbed] });
  }
}

function parseDate(dateStr: string): Date | null {
  // Try parsing YYYY-MM-DD HH:MM format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1, // Months are 0-indexed
    parseInt(day),
    parseInt(hour),
    parseInt(minute)
  );

  // Check if the date is valid
  if (isNaN(date.getTime())) return null;

  return date;
}

async function listEvents(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const events = getUpcomingEvents(interaction.guild.id);

  if (events.length === 0) {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📅 Eventi in programma')
        .setDescription('Non ci sono eventi in programma al momento.')
      ],
      ephemeral: true,
    });
    return;
  }

  const eventList = events.slice(0, 10).map(e => {
    const timestamp = Math.floor(new Date(e.starts_at).getTime() / 1000);
    return `**#${e.id}** - ${e.title}\n` +
      `├ 📝 ${e.description.slice(0, 50)}${e.description.length > 50 ? '...' : ''}\n` +
      `├ 🕐 <t:${timestamp}:F>\n` +
      `└ ⏰ <t:${timestamp}:R>`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📅 Eventi in programma')
    .setDescription(eventList)
    .setFooter({ text: `${events.length} eventi in programma` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function cancelEvent(interaction: ChatInputCommandInteraction): Promise<void> {
  const eventId = interaction.options.getInteger('id', true);

  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return;
  }

  const events = getUpcomingEvents(interaction.guild.id);
  const eventToCancel = events.find(e => e.id === eventId);

  if (!eventToCancel) {
    await interaction.reply({
      embeds: [errorEmbed('Non trovato', `Evento #${eventId} non trovato.`)],
      ephemeral: true,
    });
    return;
  }

  deleteEvent(eventId);

  await interaction.reply({
    embeds: [successEmbed('Evento cancellato', `L'evento "${eventToCancel.title}" è stato cancellato.`)],
  });
}

export default event;
