import { guildConfigSchema } from '../database/schema.js';
import type { GameType } from '../types/index.js';

/**
 * Check if a channel is allowed for a specific game type
 * @param guildId - The guild ID
 * @param channelId - The channel ID to check
 * @param gameType - The game type to check
 * @returns true if the channel is allowed (or no restrictions are set), false otherwise
 */
export function isGameChannelAllowed(
  guildId: string,
  channelId: string,
  gameType: GameType
): boolean {
  const config = guildConfigSchema.getOrCreate(guildId);
  
  // Parse game channels configuration
  // Format: { "general": ["id1", "id2"], "shiritori": ["id3"], ... }
  let gameChannelsMap: Record<string, string[]> = {};
  
  if (config.game_channels) {
    try {
      gameChannelsMap = JSON.parse(config.game_channels);
    } catch {
      // If parsing fails, try to parse as array (backward compatibility)
      try {
        const oldArray = JSON.parse(config.game_channels);
        if (Array.isArray(oldArray)) {
          gameChannelsMap = { general: oldArray };
        }
      } catch {
        // Invalid format, treat as no restrictions
        return true;
      }
    }
  }
  
  // Check if specific game type has channels configured
  if (gameChannelsMap[gameType] && gameChannelsMap[gameType].length > 0) {
    return gameChannelsMap[gameType].includes(channelId);
  }
  
  // Check if general channels are configured
  if (gameChannelsMap.general && gameChannelsMap.general.length > 0) {
    return gameChannelsMap.general.includes(channelId);
  }
  
  // No restrictions set, allow all channels
  return true;
}

/**
 * Get all allowed channels for a specific game type
 * @param guildId - The guild ID
 * @param gameType - The game type
 * @returns Array of channel IDs allowed for this game type
 */
export function getGameChannels(guildId: string, gameType: GameType): string[] {
  const config = guildConfigSchema.getOrCreate(guildId);
  
  let gameChannelsMap: Record<string, string[]> = {};
  
  if (config.game_channels) {
    try {
      gameChannelsMap = JSON.parse(config.game_channels);
    } catch {
      try {
        const oldArray = JSON.parse(config.game_channels);
        if (Array.isArray(oldArray)) {
          gameChannelsMap = { general: oldArray };
        }
      } catch {
        return [];
      }
    }
  }
  
  // Return specific game channels, or general channels, or empty array
  return gameChannelsMap[gameType] || gameChannelsMap.general || [];
}

/**
 * Set channels for a specific game type
 * @param guildId - The guild ID
 * @param gameType - The game type
 * @param channelIds - Array of channel IDs to set
 */
export function setGameChannels(
  guildId: string,
  gameType: GameType | 'general',
  channelIds: string[]
): void {
  const config = guildConfigSchema.getOrCreate(guildId);
  
  let gameChannelsMap: Record<string, string[]> = {};
  
  if (config.game_channels) {
    try {
      gameChannelsMap = JSON.parse(config.game_channels);
    } catch {
      try {
        const oldArray = JSON.parse(config.game_channels);
        if (Array.isArray(oldArray)) {
          gameChannelsMap = { general: oldArray };
        }
      } catch {
        // Start fresh
        gameChannelsMap = {};
      }
    }
  }
  
  // Set channels for the game type
  gameChannelsMap[gameType] = channelIds;
  
  // Update database
  guildConfigSchema.update(guildId, {
    game_channels: JSON.stringify(gameChannelsMap),
  });
}

/**
 * Remove a channel from a specific game type
 * @param guildId - The guild ID
 * @param gameType - The game type
 * @param channelId - The channel ID to remove
 * @returns true if the channel was removed, false if it wasn't in the list
 */
export function removeGameChannel(
  guildId: string,
  gameType: GameType | 'general',
  channelId: string
): boolean {
  const config = guildConfigSchema.getOrCreate(guildId);
  
  let gameChannelsMap: Record<string, string[]> = {};
  
  if (config.game_channels) {
    try {
      gameChannelsMap = JSON.parse(config.game_channels);
    } catch {
      try {
        const oldArray = JSON.parse(config.game_channels);
        if (Array.isArray(oldArray)) {
          gameChannelsMap = { general: oldArray };
        }
      } catch {
        return false;
      }
    }
  }
  
  const channels = gameChannelsMap[gameType] || [];
  const index = channels.indexOf(channelId);
  
  if (index === -1) {
    return false;
  }
  
  channels.splice(index, 1);
  gameChannelsMap[gameType] = channels;
  
  // Update database
  guildConfigSchema.update(guildId, {
    game_channels: JSON.stringify(gameChannelsMap),
  });
  
  return true;
}

/**
 * Get all game channel configurations
 * @param guildId - The guild ID
 * @returns Object mapping game types to channel IDs
 */
export function getAllGameChannels(guildId: string): Record<string, string[]> {
  const config = guildConfigSchema.getOrCreate(guildId);
  
  let gameChannelsMap: Record<string, string[]> = {};
  
  if (config.game_channels) {
    try {
      gameChannelsMap = JSON.parse(config.game_channels);
    } catch {
      try {
        const oldArray = JSON.parse(config.game_channels);
        if (Array.isArray(oldArray)) {
          gameChannelsMap = { general: oldArray };
        }
      } catch {
        return {};
      }
    }
  }
  
  return gameChannelsMap;
}
