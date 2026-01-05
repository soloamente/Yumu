import { ChatInputCommandInteraction } from 'discord.js';
import type { GameType } from '../types/index.js';
import { errorEmbed } from './embed-builder.js';
import { isGameChannelAllowed, getGameChannels } from './game-channels.js';

/**
 * Validates if a channel is allowed for a specific game type
 * @param interaction - The interaction to check
 * @param gameType - The game type to validate
 * @returns true if the channel is allowed, false otherwise
 */
export async function validateGameChannel(
  interaction: ChatInputCommandInteraction,
  gameType: GameType
): Promise<boolean> {
  if (!interaction.guild) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
      ephemeral: true,
    });
    return false;
  }

  const channelId = interaction.channelId;

  if (!isGameChannelAllowed(interaction.guild.id, channelId, gameType)) {
    const allowedChannels = getGameChannels(interaction.guild.id, gameType);
    
    const gameNames: Record<GameType, string> = {
      shiritori: 'Shiritori',
      kanji_quiz: 'Kanji Quiz',
      vocab_quiz: 'Vocab Quiz',
      number_game: 'Number Game',
      word_bomb: 'Word Bomb',
      typing_game: 'Typing Game',
      story_game: 'Story Game',
    };

    const gameName = gameNames[gameType] || gameType;

    await interaction.reply({
      embeds: [errorEmbed(
        'Canale non permesso',
        `${gameName} può essere giocato solo nei canali configurati per questo gioco.\n\n` +
        (allowedChannels.length > 0
          ? `**Canali permessi:** ${allowedChannels.map(id => `<#${id}>`).join(', ')}\n\n` +
            'Usa `/botconfig setgamechannel` per configurare i canali.'
          : 'Usa `/botconfig setgamechannel` per configurare i canali.')
      )],
      ephemeral: true,
    });
    return false;
  }

  return true;
}
