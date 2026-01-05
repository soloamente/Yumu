import * as wanakana from 'wanakana';

/**
 * Check if a string contains Japanese characters
 */
export function isJapanese(text: string): boolean {
  return wanakana.isJapanese(text);
}

/**
 * Check if a string is only hiragana
 */
export function isHiragana(text: string): boolean {
  return wanakana.isHiragana(text);
}

/**
 * Check if a string is only katakana
 */
export function isKatakana(text: string): boolean {
  return wanakana.isKatakana(text);
}

/**
 * Check if a string contains kanji
 */
export function hasKanji(text: string): boolean {
  return wanakana.isKanji(text) || /[\u4E00-\u9FFF]/.test(text);
}

/**
 * Convert romaji to hiragana
 */
export function toHiragana(text: string): string {
  return wanakana.toHiragana(text);
}

/**
 * Convert romaji to katakana
 */
export function toKatakana(text: string): string {
  return wanakana.toKatakana(text);
}

/**
 * Convert kana to romaji
 */
export function toRomaji(text: string): string {
  return wanakana.toRomaji(text);
}

/**
 * Get the last character/mora of a Japanese word (for Shiritori)
 * If reading is provided, uses that instead of converting the word directly
 * This is important for kanji words where we need the actual pronunciation
 */
export function getLastMora(word: string, reading?: string | null): string {
  // Use reading if provided (for kanji words)
  const textToUse = reading || word;
  
  // Convert to hiragana for consistency
  const hiragana = wanakana.toHiragana(textToUse);
  
  // Handle small kana (ゃ, ゅ, ょ, etc.)
  const smallKana = ['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'っ'];
  
  if (hiragana.length >= 2 && smallKana.includes(hiragana[hiragana.length - 1])) {
    return hiragana.slice(-2);
  }
  
  return hiragana.slice(-1);
}

/**
 * Get the first character/mora of a Japanese word (for Shiritori)
 * If reading is provided, uses that instead of converting the word directly
 * This is important for kanji words where we need the actual pronunciation
 */
export function getFirstMora(word: string, reading?: string | null): string {
  // Use reading if provided (for kanji words)
  const textToUse = reading || word;
  
  // Convert to hiragana for consistency
  const hiragana = wanakana.toHiragana(textToUse);
  
  // Handle small kana
  const smallKana = ['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ'];
  
  if (hiragana.length >= 2 && smallKana.includes(hiragana[1])) {
    return hiragana.slice(0, 2);
  }
  
  return hiragana.slice(0, 1);
}

/**
 * Check if a word ends with 'ん' (invalid in Shiritori)
 * If reading is provided, uses that instead of converting the word directly
 */
export function endsWithN(word: string, reading?: string | null): boolean {
  const textToUse = reading || word;
  const hiragana = wanakana.toHiragana(textToUse);
  return hiragana.endsWith('ん');
}

/**
 * Check if word2 starts with the last mora of word1 (valid Shiritori move)
 */
export function isValidShiritoriMove(previousWord: string, newWord: string): boolean {
  const lastMora = getLastMora(previousWord);
  const firstMora = getFirstMora(newWord);
  
  // Handle long vowels (ー converts to the previous vowel)
  // For simplicity, we just compare directly
  return lastMora === firstMora;
}

/**
 * Convert Japanese number to arabic numeral
 */
export function japaneseToNumber(japanese: string): number | null {
  const numbers: Record<string, number> = {
    '零': 0, '〇': 0,
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '百': 100, '千': 1000, '万': 10000,
    '億': 100000000, '兆': 1000000000000,
  };

  // Simple single digit conversion
  if (japanese.length === 1 && numbers[japanese] !== undefined) {
    return numbers[japanese];
  }

  // More complex number parsing would go here
  // For now, return null for complex numbers
  return null;
}

/**
 * Convert arabic numeral to Japanese number (simple)
 */
export function numberToJapanese(num: number): string {
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  
  if (num >= 0 && num <= 9) {
    return digits[num];
  }

  if (num === 10) return '十';
  if (num === 100) return '百';
  if (num === 1000) return '千';
  if (num === 10000) return '万';

  // For complex numbers, break down
  let result = '';
  
  if (num >= 10000) {
    const man = Math.floor(num / 10000);
    if (man > 1) result += numberToJapanese(man);
    result += '万';
    num %= 10000;
  }
  
  if (num >= 1000) {
    const sen = Math.floor(num / 1000);
    if (sen > 1) result += digits[sen];
    result += '千';
    num %= 1000;
  }
  
  if (num >= 100) {
    const hyaku = Math.floor(num / 100);
    if (hyaku > 1) result += digits[hyaku];
    result += '百';
    num %= 100;
  }
  
  if (num >= 10) {
    const juu = Math.floor(num / 10);
    if (juu > 1) result += digits[juu];
    result += '十';
    num %= 10;
  }
  
  if (num > 0) {
    result += digits[num];
  }

  return result || '零';
}

/**
 * Generate furigana display (kanji with reading above)
 * Returns format: kanji(reading)
 */
export function formatWithReading(kanji: string, reading: string): string {
  if (!kanji || kanji === reading) return reading;
  return `${kanji}(${reading})`;
}

/**
 * Random hiragana character for games
 */
export function getRandomHiragana(): string {
  const hiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
  return hiragana[Math.floor(Math.random() * hiragana.length)];
}

/**
 * Random katakana character for games
 */
export function getRandomKatakana(): string {
  const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  return katakana[Math.floor(Math.random() * katakana.length)];
}
