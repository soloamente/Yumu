import {
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  Collection,
  AutocompleteInteraction,
} from 'discord.js';

/**
 * Command structure for slash commands
 */
export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  cooldown?: number; // Cooldown in seconds
}

/**
 * Event structure for Discord events
 */
export interface Event {
  name: string;
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<void> | void;
}

/**
 * User data stored in database
 */
export interface User {
  id: string;
  username: string;
  xp: number;
  level: number;
  study_streak: number;
  last_study_date: string | null;
  created_at: string;
}

/**
 * Game statistics for a user
 */
export interface GameStats {
  user_id: string;
  game_type: GameType;
  games_played: number;
  games_won: number;
  correct_answers: number;
}

/**
 * Available game types
 */
export type GameType =
  | 'shiritori'
  | 'kanji_quiz'
  | 'vocab_quiz'
  | 'number_game'
  | 'word_bomb'
  | 'typing_game'
  | 'story_game';

/**
 * Giveaway data
 */
export interface Giveaway {
  id: number;
  channel_id: string;
  message_id: string;
  prize: string;
  winners_count: number;
  ends_at: string;
  ended: boolean;
  host_id: string;
}

/**
 * Giveaway entry
 */
export interface GiveawayEntry {
  giveaway_id: number;
  user_id: string;
}

/**
 * Event data
 */
export interface BotEvent {
  id: number;
  title: string;
  description: string;
  channel_id: string;
  starts_at: string;
  reminder_sent: boolean;
  created_by: string;
}

/**
 * Study session data
 */
export interface StudySession {
  id: number;
  user_id: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

/**
 * Guild configuration
 */
export interface GuildConfig {
  guild_id: string;
  welcome_channel_id: string | null;
  welcome_message: string | null;
  daily_word_channel_id: string | null;
  game_channels: string | null; // JSON array of channel IDs
  admin_role_id: string | null;
}

/**
 * Jisho API response types
 */
export interface JishoWord {
  slug: string;
  is_common: boolean;
  tags: string[];
  jlpt: string[];
  japanese: JishoJapanese[];
  senses: JishoSense[];
}

export interface JishoJapanese {
  word?: string;
  reading: string;
}

export interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  tags: string[];
  info: string[];
}

export interface JishoApiResponse {
  meta: { status: number };
  data: JishoWord[];
}

/**
 * Quiz question structure
 */
export interface QuizQuestion {
  question: string;
  correctAnswer: string;
  options: string[];
  explanation?: string;
}

/**
 * Kanji data structure
 */
export interface KanjiData {
  kanji: string;
  readings: {
    onyomi: string[];
    kunyomi: string[];
  };
  meanings: string[];
  jlpt: number | null;
  grade: number | null;
  strokes: number;
  examples: {
    word: string;
    reading: string;
    meaning: string;
  }[];
}

/**
 * Vocabulary data structure
 */
export interface VocabData {
  word: string;
  reading: string;
  meaning: string;
  jlpt: number | null;
  partOfSpeech: string;
  examples?: {
    japanese: string;
    english: string;
  }[];
}

/**
 * Active game session (in memory)
 */
export interface GameSession {
  channelId: string;
  gameType: GameType;
  players: Map<string, number>; // userId -> score
  currentTurn?: string; // userId
  startedAt: Date;
  data: Record<string, unknown>; // Game-specific data
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  value: number;
  rank: number;
}

/**
 * Extend Discord.js Client to include commands collection
 */
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
    activeGames: Map<string, GameSession>;
  }
}
