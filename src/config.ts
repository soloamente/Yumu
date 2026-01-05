import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Bot configuration loaded from environment variables
 */
export const config = {
  // Discord Configuration
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
  },

  // Database Configuration
  database: {
    path: process.env.DATABASE_PATH || './data/nihongo.db',
  },

  // XP and Leveling Configuration
  xp: {
    perMessage: parseInt(process.env.XP_PER_MESSAGE || '10', 10),
    perGameWin: parseInt(process.env.XP_PER_GAME_WIN || '50', 10),
    perQuizCorrect: parseInt(process.env.XP_PER_QUIZ_CORRECT || '25', 10),
    cooldownSeconds: parseInt(process.env.XP_COOLDOWN_SECONDS || '60', 10),
  },

  // Daily Word Configuration
  dailyWord: {
    hour: parseInt(process.env.DAILY_WORD_HOUR || '9', 10),
    minute: parseInt(process.env.DAILY_WORD_MINUTE || '0', 10),
  },

  // API Configuration
  api: {
    jishoUrl: process.env.JISHO_API_URL || 'https://jisho.org/api/v1/search/words',
  },

  // Bot Colors (Japanese theme - red and white)
  colors: {
    primary: 0xBC002D,    // Japanese red (Hinomaru)
    secondary: 0xFFFFFF,  // White
    success: 0x00C853,    // Green for correct answers
    error: 0xFF1744,      // Red for errors
    warning: 0xFFAB00,    // Amber for warnings
    info: 0x2979FF,       // Blue for info
    gold: 0xFFD700,       // Gold for winners/achievements
  },

  // Level thresholds (XP required for each level)
  levels: {
    // XP formula: level^2 * 100
    getXpForLevel: (level: number): number => Math.pow(level, 2) * 100,
    getLevelFromXp: (xp: number): number => Math.floor(Math.sqrt(xp / 100)),
  },

  // Game settings
  games: {
    shiritori: {
      timeLimit: 30, // seconds per turn
      minWordLength: 2,
    },
    quiz: {
      timeLimit: 20, // seconds per question
      questionsPerRound: 10,
    },
    wordBomb: {
      timeLimit: 10, // seconds to find a word
      lives: 3,
    },
    typing: {
      maxSentenceLength: 50,
    },
  },
} as const;

/**
 * Validate that required configuration is present
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.discord.token) {
    errors.push('DISCORD_TOKEN is required');
  }
  if (!config.discord.clientId) {
    errors.push('CLIENT_ID is required');
  }

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
}

export default config;
