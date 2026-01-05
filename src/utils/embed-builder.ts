import { EmbedBuilder, User } from 'discord.js';
import { config } from '../config.js';

/**
 * Create a success embed
 */
export function successEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(`✅ ${title}`);
  
  if (description) {
    embed.setDescription(description);
  }
  
  return embed;
}

/**
 * Add a celebration GIF to an embed (async)
 */
export async function addCelebrationGif(embed: EmbedBuilder): Promise<EmbedBuilder> {
  const { getCelebrationGif } = await import('../services/nekos-service.js');
  const gifUrl = await getCelebrationGif();
  if (gifUrl) {
    embed.setImage(gifUrl);
  }
  return embed;
}

/**
 * Add a success GIF to an embed (async)
 */
export async function addSuccessGif(embed: EmbedBuilder): Promise<EmbedBuilder> {
  const { getSuccessGif } = await import('../services/nekos-service.js');
  const gifUrl = await getSuccessGif();
  if (gifUrl) {
    embed.setImage(gifUrl);
  }
  return embed;
}

/**
 * Create an error embed
 */
export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`❌ ${title}`);
  
  if (description) {
    embed.setDescription(description);
  }
  
  return embed;
}

/**
 * Create a warning embed
 */
export function warningEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(`⚠️ ${title}`);
  
  if (description) {
    embed.setDescription(description);
  }
  
  return embed;
}

/**
 * Create an info embed
 */
export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`ℹ️ ${title}`);
  
  if (description) {
    embed.setDescription(description);
  }
  
  return embed;
}

/**
 * Create a game embed
 */
export function gameEmbed(title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`🎮 ${title}`);
  
  if (description) {
    embed.setDescription(description);
  }
  
  return embed;
}

/**
 * Create a quiz question embed
 */
export function quizEmbed(
  question: string,
  options: string[],
  timeLimit: number,
  questionNumber?: number,
  totalQuestions?: number
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle('📝 Quiz!')
    .setDescription(`**${question}**`)
    .addFields({
      name: '📋 Opzioni',
      value: options.map((opt, i) => `${getOptionEmoji(i)} ${opt}`).join('\n'),
    })
    .setFooter({
      text: `⏱️ Hai ${timeLimit} secondi per rispondere!`,
    });

  if (questionNumber !== undefined && totalQuestions !== undefined) {
    embed.setAuthor({
      name: `Domanda ${questionNumber}/${totalQuestions}`,
    });
  }

  return embed;
}

/**
 * Get emoji for quiz option index
 */
export function getOptionEmoji(index: number): string {
  const emojis = ['🅰️', '🅱️', '🅲', '🅳'];
  return emojis[index] || `${index + 1}.`;
}

/**
 * Create a leaderboard embed
 */
export function leaderboardEmbed(
  title: string,
  entries: { rank: number; name: string; value: string }[],
  user?: User
): EmbedBuilder {
  const medals = ['🥇', '🥈', '🥉'];
  
  const description = entries
    .map(entry => {
      const medal = entry.rank <= 3 ? medals[entry.rank - 1] : `**${entry.rank}.**`;
      return `${medal} ${entry.name} - ${entry.value}`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`🏆 ${title}`)
    .setDescription(description || 'Nessun dato disponibile')
    .setTimestamp();

  if (user) {
    embed.setFooter({
      text: `Richiesto da ${user.username}`,
      iconURL: user.displayAvatarURL(),
    });
  }

  return embed;
}

/**
 * Create a profile/stats embed
 */
export function profileEmbed(
  username: string,
  avatarUrl: string,
  stats: { name: string; value: string; inline?: boolean }[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📊 Profilo di ${username}`)
    .setThumbnail(avatarUrl);

  for (const stat of stats) {
    embed.addFields({
      name: stat.name,
      value: stat.value,
      inline: stat.inline ?? true,
    });
  }

  return embed;
}

/**
 * Create a help embed for a command
 */
export function helpEmbed(
  commandName: string,
  description: string,
  usage: string,
  examples?: string[]
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`📖 /${commandName}`)
    .setDescription(description)
    .addFields({
      name: '📝 Utilizzo',
      value: `\`${usage}\``,
    });

  if (examples && examples.length > 0) {
    embed.addFields({
      name: '💡 Esempi',
      value: examples.map(ex => `\`${ex}\``).join('\n'),
    });
  }

  return embed;
}
