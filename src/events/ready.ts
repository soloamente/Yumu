import { Client, ActivityType } from 'discord.js';
import type { Event } from '../types/index.js';
import { startScheduledTasks } from '../services/scheduler.js';

/**
 * Ready event - fired when the bot successfully connects to Discord
 */
const ready: Event = {
  name: 'ready',
  once: true,
  async execute(client: Client) {
    if (!client.user) return;

    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║       NihongoHub Bot - Ready!              ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║  Logged in as: ${client.user.tag.padEnd(26)}║`);
    console.log(`║  Guilds: ${String(client.guilds.cache.size).padEnd(33)}║`);
    console.log(`║  Users: ${String(client.users.cache.size).padEnd(34)}║`);
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    // Set bot activity/status
    client.user.setActivity('日本語を学ぼう! | /help', {
      type: ActivityType.Playing,
    });

    // Start scheduled tasks (daily word, giveaway checker, etc.)
    startScheduledTasks(client);

    console.log('[Ready] Bot is fully operational!');
  },
};

export default ready;
