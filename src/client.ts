import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import type { Command, GameSession } from './types/index.js';

/**
 * Create and configure the Discord client with necessary intents
 */
export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
    ],
  });

  // Initialize collections for commands and cooldowns
  client.commands = new Collection<string, Command>();
  client.cooldowns = new Collection<string, Collection<string, number>>();
  client.activeGames = new Map<string, GameSession>();

  return client;
}

export default createClient;
