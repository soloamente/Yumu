import cron from 'node-cron';
import { Client } from 'discord.js';
import { config } from '../config.js';
import { giveawaySchema, eventSchema, guildConfigSchema } from '../database/schema.js';
import { db } from '../database/index.js';
import { sendDailyWord } from './daily-word-service.js';
import { endGiveaway, scheduleActiveGiveaways } from './giveaway-service.js';
import { sendEventReminder } from './event-service.js';

/**
 * Start all scheduled tasks
 */
export function startScheduledTasks(client: Client): void {
  // Schedule timers for all active giveaways (in case of bot restart)
  // Each giveaway will have its own timer that ends it exactly when it expires
  scheduleActiveGiveaways(client);
  console.log('[Scheduler] Active giveaway timers scheduled');

  // Daily word - runs at configured time every day
  const dailyWordCron = `${config.dailyWord.minute} ${config.dailyWord.hour} * * *`;
  cron.schedule(dailyWordCron, async () => {
    console.log('[Scheduler] Running daily word task...');
    await runDailyWordTask(client);
  });
  console.log(`[Scheduler] Daily word scheduled at ${config.dailyWord.hour}:${String(config.dailyWord.minute).padStart(2, '0')}`);

  // Giveaway checker - runs every minute as a fallback
  // This is mainly for giveaways that should have ended but didn't (e.g., if bot was down)
  // Individual timers handle normal case, this is just a safety net
  cron.schedule('* * * * *', async () => {
    await runGiveawayChecker(client);
  });
  console.log('[Scheduler] Giveaway fallback checker scheduled (every minute)');

  // Event reminder checker - runs every minute
  cron.schedule('* * * * *', async () => {
    await runEventReminderChecker(client);
  });
  console.log('[Scheduler] Event reminder checker scheduled (every minute)');

  console.log('[Scheduler] All scheduled tasks started');
}

/**
 * Run daily word task
 */
async function runDailyWordTask(client: Client): Promise<void> {
  try {
    const guildsWithDailyWord = guildConfigSchema.getGuildsWithDailyWord();

    for (const guildConfig of guildsWithDailyWord) {
      if (!guildConfig.daily_word_channel_id) continue;

      const channel = await client.channels.fetch(guildConfig.daily_word_channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      await sendDailyWord(channel);
    }
  } catch (error) {
    console.error('[Scheduler] Error in daily word task:', error);
  }
}

/**
 * Run giveaway checker
 * Uses JavaScript date comparison for precise timing (more reliable than SQLite date parsing)
 * Checks all non-ended giveaways to ensure we catch any that should end
 */
async function runGiveawayChecker(client: Client): Promise<void> {
  try {
    // Get all non-ended giveaways directly from database
    // We'll do the date comparison in JavaScript for better precision
    const allNonEndedGiveaways = db.query<{ id: number; ends_at: string; ended: number }>(
      'SELECT id, ends_at, ended FROM giveaways WHERE ended = 0'
    );

    const now = new Date();
    const endingGiveaways: number[] = [];

    // Check each giveaway using JavaScript Date objects for precise comparison
    for (const giveaway of allNonEndedGiveaways) {
      try {
        const endsAt = new Date(giveaway.ends_at);
        // Check if the giveaway should end (ends_at is in the past or now)
        if (endsAt <= now) {
          endingGiveaways.push(giveaway.id);
        }
      } catch (error) {
        console.error(`[Scheduler] Error parsing end date for giveaway #${giveaway.id}:`, error);
      }
    }

    // Process all ending giveaways
    for (const giveawayId of endingGiveaways) {
      await endGiveaway(client, giveawayId);
    }
  } catch (error) {
    console.error('[Scheduler] Error in giveaway checker:', error);
  }
}

/**
 * Run event reminder checker
 */
async function runEventReminderChecker(client: Client): Promise<void> {
  try {
    const eventsNeedingReminder = eventSchema.getNeedingReminder();

    for (const event of eventsNeedingReminder) {
      const channel = await client.channels.fetch(event.channel_id).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      await sendEventReminder(channel, event);
      eventSchema.markReminderSent(event.id);
    }
  } catch (error) {
    console.error('[Scheduler] Error in event reminder checker:', error);
  }
}

export default startScheduledTasks;
