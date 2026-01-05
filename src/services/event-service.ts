import { TextBasedChannel, EmbedBuilder, TextChannel } from 'discord.js';
import { config } from '../config.js';
import { eventSchema } from '../database/schema.js';
import type { BotEvent } from '../types/index.js';

/**
 * Create a new event
 */
export function createEvent(
  guildId: string,
  title: string,
  description: string,
  channelId: string,
  startsAt: Date,
  createdBy: string
): number {
  const eventId = eventSchema.create(
    guildId,
    title,
    description,
    channelId,
    startsAt.toISOString(),
    createdBy
  );

  console.log(`[Events] Created event #${eventId}: ${title}`);
  return eventId;
}

/**
 * Send event reminder to channel
 */
export async function sendEventReminder(channel: TextBasedChannel, event: BotEvent): Promise<void> {
  const startsTimestamp = Math.floor(new Date(event.starts_at).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle('⏰ Promemoria Evento!')
    .setDescription(`**${event.title}** inizia tra poco!`)
    .addFields(
      {
        name: '📝 Descrizione',
        value: event.description || 'Nessuna descrizione',
      },
      {
        name: '🕐 Ora di inizio',
        value: `<t:${startsTimestamp}:R>\n<t:${startsTimestamp}:F>`,
        inline: true,
      },
      {
        name: '👤 Creato da',
        value: `<@${event.created_by}>`,
        inline: true,
      }
    )
    .setFooter({
      text: 'Non perdere questo evento!',
    })
    .setTimestamp();

  if ('send' in channel) {
    await (channel as TextChannel).send({
      content: '@here',
      embeds: [embed],
    });
  }

  console.log(`[Events] Sent reminder for event #${event.id}: ${event.title}`);
}

/**
 * Get upcoming events for a guild
 */
export function getUpcomingEvents(guildId: string): BotEvent[] {
  return eventSchema.getUpcoming(guildId);
}

/**
 * Delete an event
 */
export function deleteEvent(eventId: number): void {
  eventSchema.delete(eventId);
  console.log(`[Events] Deleted event #${eventId}`);
}

/**
 * Create event embed for display
 */
export function createEventEmbed(event: BotEvent): EmbedBuilder {
  const startsTimestamp = Math.floor(new Date(event.starts_at).getTime() / 1000);

  return new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`📅 ${event.title}`)
    .setDescription(event.description || 'Nessuna descrizione')
    .addFields(
      {
        name: '🕐 Data e ora',
        value: `<t:${startsTimestamp}:F>`,
        inline: true,
      },
      {
        name: '⏰ Tra',
        value: `<t:${startsTimestamp}:R>`,
        inline: true,
      },
      {
        name: '👤 Creato da',
        value: `<@${event.created_by}>`,
        inline: true,
      }
    )
    .setTimestamp();
}
