import { Message } from 'discord.js';
import type { Event } from '../types/index.js';
import { config } from '../config.js';
import { userSchema, xpCooldownSchema } from '../database/schema.js';
import { EmbedBuilder } from 'discord.js';
import { getCelebrationGif } from '../services/nekos-service.js';

/**
 * MessageCreate event - handles XP gain from messages
 */
const messageCreate: Event = {
  name: 'messageCreate',
  async execute(message: Message) {
    // Ignore bots and DMs
    if (message.author.bot || !message.guild) return;

    // XP system disabled - no longer awarding XP for messages
    // await awardMessageXp(message);

    // Check if message is part of an active game
    await handleGameMessage(message);
  },
};

/**
 * Award XP for sending messages
 */
// Exported so TypeScript doesn't treat it as "unused" while XP is disabled.
// If you re-enable XP in the future, uncomment the call in the event handler above.
export async function awardMessageXp(message: Message): Promise<void> {
  const userId = message.author.id;

  // Check cooldown
  if (!xpCooldownSchema.canEarnXp(userId, config.xp.cooldownSeconds)) {
    return;
  }

  // Get or create user
  const user = userSchema.getOrCreate(userId, message.author.username);
  const oldLevel = user.level;

  // Award XP
  const updatedUser = userSchema.updateXp(userId, config.xp.perMessage);
  
  // Update cooldown
  xpCooldownSchema.updateLastXp(userId);

  // Check for level up
  if (updatedUser.level > oldLevel) {
    // Send level up notification (non-intrusive) with embed and GIF
    try {
      const gifUrl = await getCelebrationGif();
      
      const embed = new EmbedBuilder()
        .setColor(config.colors.gold)
        .setTitle('🎉 Level Up!')
        .setDescription(`Congratulazioni ${message.author}! Sei salito al livello **${updatedUser.level}**!`)
        .setFooter({ text: `Continua così! 🚀` })
        .setTimestamp();
      
      if (gifUrl) {
        embed.setImage(gifUrl);
      }
      
      await message.reply({
        embeds: [embed],
        allowedMentions: { repliedUser: false },
      });
    } catch (error) {
      // Ignore if we can't send the message
      console.log('[XP] Could not send level up message:', error);
    }
  }
}

/**
 * Handle messages that might be part of an active game
 */
async function handleGameMessage(message: Message): Promise<void> {
  const activeGame = message.client.activeGames.get(message.channel.id);
  
  if (!activeGame) return;

  // Game-specific message handling will be implemented in game modules
  // This is a placeholder for the game engine to process player responses
}

export default messageCreate;
