import { config } from '../config.js';
import type { JishoApiResponse, JishoWord } from '../types/index.js';

// Cache for word readings to avoid duplicate API calls
const readingCache = new Map<string, string | null>();

/**
 * Search Jisho.org for a word
 */
export async function searchJisho(query: string): Promise<JishoWord[]> {
  try {
    const url = `${config.api.jishoUrl}?keyword=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jisho API error: ${response.status}`);
    }

    const data = await response.json() as JishoApiResponse;
    return data.data;
  } catch (error) {
    console.error('[Jisho] Search error:', error);
    throw error;
  }
}

/**
 * Format JLPT level for display
 */
export function formatJlptLevel(jlpt: string[]): string {
  if (!jlpt || jlpt.length === 0) return 'N/A';
  
  // Extract and sort JLPT levels
  const levels = jlpt
    .map(level => level.replace('jlpt-', '').toUpperCase())
    .sort();
  
  return levels.join(', ');
}

/**
 * Format word readings for display
 */
export function formatReadings(word: JishoWord): string {
  return word.japanese
    .map(jp => {
      if (jp.word && jp.reading) {
        return `${jp.word} (${jp.reading})`;
      }
      return jp.word || jp.reading;
    })
    .join(', ');
}

/**
 * Format meanings for display
 */
export function formatMeanings(word: JishoWord, maxMeanings: number = 5): string {
  const meanings: string[] = [];
  
  for (const sense of word.senses.slice(0, maxMeanings)) {
    const pos = sense.parts_of_speech.length > 0 
      ? `[${sense.parts_of_speech[0]}] ` 
      : '';
    meanings.push(`${pos}${sense.english_definitions.join(', ')}`);
  }
  
  return meanings.map((m, i) => `${i + 1}. ${m}`).join('\n');
}

/**
 * Check if a word is common
 */
export function isCommonWord(word: JishoWord): boolean {
  return word.is_common || word.tags.includes('common');
}

/**
 * Get a random word from a predefined list for daily word
 */
export async function getRandomWord(_jlptLevel?: number): Promise<JishoWord | null> {
  // Common beginner-friendly words for daily word
  const commonWords = [
    '猫', '犬', '水', '火', '山', '川', '花', '空', '海', '森',
    '食べる', '飲む', '見る', '聞く', '話す', '読む', '書く', '歩く', '走る', '眠る',
    '大きい', '小さい', '新しい', '古い', '高い', '安い', '美しい', '楽しい', '難しい', '簡単',
    '友達', '家族', '学校', '仕事', '時間', '場所', '名前', '言葉', '心', '夢',
    'ありがとう', 'すみません', 'おはよう', 'こんにちは', 'さようなら',
    '天気', '季節', '春', '夏', '秋', '冬', '朝', '昼', '夜',
    '電車', '車', '自転車', '飛行機', '船', '駅', '道',
    '音楽', '映画', '本', '漫画', 'ゲーム', '料理', '旅行'
  ];

  // Pick a random word
  const randomWord = commonWords[Math.floor(Math.random() * commonWords.length)];
  
  try {
    const results = await searchJisho(randomWord);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('[Jisho] Error getting random word:', error);
    return null;
  }
}

/**
 * Validate if a Japanese word exists
 */
export async function validateJapaneseWord(word: string): Promise<boolean> {
  try {
    const results = await searchJisho(word);
    return results.some(result => 
      result.japanese.some(jp => jp.word === word || jp.reading === word)
    );
  } catch {
    return false;
  }
}

/**
 * Get the reading (pronunciation) of a Japanese word
 * Returns the reading if found, or null if not found
 * Uses a cache to avoid duplicate API calls
 */
export async function getWordReading(word: string): Promise<string | null> {
  // Check cache first
  if (readingCache.has(word)) {
    return readingCache.get(word) ?? null;
  }
  
  try {
    const results = await searchJisho(word);
    
    // Find the exact match for the word
    for (const result of results) {
      for (const jp of result.japanese) {
        // If the word matches exactly, return its reading
        if (jp.word === word && jp.reading) {
          readingCache.set(word, jp.reading);
          return jp.reading;
        }
      }
    }
    
    // If no exact match, try to find a reading that matches the word structure
    for (const result of results) {
      for (const jp of result.japanese) {
        if (jp.reading && jp.reading.includes(word)) {
          readingCache.set(word, jp.reading);
          return jp.reading;
        }
      }
    }
    
    // Cache null result to avoid repeated failed lookups
    readingCache.set(word, null);
    return null;
  } catch {
    readingCache.set(word, null);
    return null;
  }
}