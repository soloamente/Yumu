import cron from 'node-cron';
import { Client } from 'discord.js';
import { config } from '../config.js';
import { giveawaySchema, eventSchema, guildConfigSchema } from '../database/schema.js';
import { sendDailyWord } from './daily-word-service.js';
import { endGiveaway } from './giveaway-service.js';
import { sendEventReminder } from './event-service.js';

/**
 * Start all scheduled tasks
 */
export function startScheduledTasks(client: Client): void {
  // Daily word - runs at configured time every day
  const dailyWordCron = `${config.dailyWord.minute} ${config.dailyWord.hour} * * *`;
  cron.schedule(dailyWordCron, async () => {
    console.log('[Scheduler] Running daily word task...');
    await runDailyWordTask(client);
  });
  console.log(`[Scheduler] Daily word scheduled at ${config.dailyWord.hour}:${String(config.dailyWord.minute).padStart(2, '0')}`);

  // Giveaway checker - runs every minute
  cron.schedule('* * * * *', async () => {
    await runGiveawayChecker(client);
  });
  console.log('[Scheduler] Giveaway checker scheduled (every minute)');

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
 */
async function runGiveawayChecker(client: Client): Promise<void> {
  try {
    const endingGiveaways = giveawaySchema.getEndingSoon();

    for (const giveaway of endingGiveaways) {
      await endGiveaway(client, giveaway.id);
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
