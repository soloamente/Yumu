import { TextBasedChannel, EmbedBuilder, TextChannel } from 'discord.js';
import { config } from '../config.js';
import { getRandomWord, formatJlptLevel, formatMeanings } from './jisho-service.js';
import { db } from '../database/index.js';

/**
 * Send daily word to a channel
 */
export async function sendDailyWord(channel: TextBasedChannel): Promise<void> {
  try {
    const word = await getRandomWord();
    
    if (!word) {
      console.error('[DailyWord] Could not fetch random word');
      return;
    }

    // Get primary reading
    const primary = word.japanese[0];
    const kanji = primary.word || primary.reading;
    const reading = primary.reading;

    // Check if we already sent this word recently
    const guildId = 'guild_id' in channel ? (channel as any).guildId : 'dm';
    const recentWords = db.query<{ word: string }>(
      `SELECT word FROM daily_words WHERE guild_id = ? ORDER BY sent_at DESC LIMIT 30`,
      [guildId]
    );
    
    if (recentWords.some(w => w.word === kanji)) {
      // Try again with a different word
      await sendDailyWord(channel);
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('📖 今日の言葉 - Parola del Giorno')
      .setDescription(`# ${kanji}`)
      .addFields(
        {
          name: '📝 Lettura',
          value: reading || kanji,
          inline: true,
        },
        {
          name: '🏷️ JLPT',
          value: formatJlptLevel(word.jlpt),
          inline: true,
        },
        {
          name: word.is_common ? '⭐ Parola comune' : '📚 Parola',
          value: '\u200b',
          inline: true,
        },
        {
          name: '📖 Significati',
          value: formatMeanings(word, 3) || 'Nessun significato trovato',
        }
      )
      .setFooter({
        text: '頑張って! (Ganbatte!) - Buono studio!',
      })
      .setTimestamp();

    // Add example sentence if available
    const firstSense = word.senses[0];
    if (firstSense?.info && firstSense.info.length > 0) {
      embed.addFields({
        name: '💡 Note',
        value: firstSense.info.join('\n'),
      });
    }

    await (channel as TextChannel).send({ embeds: [embed] });

    // Record that we sent this word
    db.run(
      'INSERT INTO daily_words (guild_id, word) VALUES (?, ?)',
      [guildId, kanji]
    );

    console.log(`[DailyWord] Sent word: ${kanji} to channel ${channel.id}`);
  } catch (error) {
    console.error('[DailyWord] Error sending daily word:', error);
  }
}

export default sendDailyWord;
