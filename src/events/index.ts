import type { Client } from 'discord.js';
import type { Event } from '../types/index.js';

// Import all events
import ready from './ready.js';
import interactionCreate from './interactionCreate.js';
import messageCreate from './messageCreate.js';
import guildMemberAdd from './guildMemberAdd.js';

/**
 * All available events
 */
export const events: Event[] = [
  ready,
  interactionCreate,
  messageCreate,
  guildMemberAdd,
];

/**
 * Register all events on the client
 */
export function registerEvents(client: Client): void {
  for (const event of events) {
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[Events] Registered: ${event.name}${event.once ? ' (once)' : ''}`);
  }

  console.log(`[Events] Total registered: ${events.length}`);
}

export default events;
