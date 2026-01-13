import { Collection, REST, Routes } from 'discord.js';
import type { Command } from '../types/index.js';
import { config } from '../config.js';

// Import all commands
// Games
import shiritori from './games/shiritori.js';
import kanjiQuiz from './games/kanji-quiz.js';
import vocabQuiz from './games/vocab-quiz.js';
import numberGame from './games/number-game.js';
import wordBomb from './games/word-bomb.js';
import typingGame from './games/typing-game.js';
import storyGame from './games/story-game.js';

// Community
import giveaway from './community/giveaway.js';
import event from './community/event.js';
import leaderboard from './community/leaderboard.js';

// Study
import jisho from './study/jisho.js';
import dailyWord from './study/daily-word.js';
import studyTracker from './study/study-tracker.js';

// Admin
import setup from './admin/setup.js';
import botConfig from './admin/config.js';
import xpManage from './admin/xpmanage.js';

/**
 * All available commands
 */
export const commands: Command[] = [
  // Games
  shiritori,
  kanjiQuiz,
  vocabQuiz,
  numberGame,
  wordBomb,
  typingGame,
  storyGame,
  // Community
  giveaway,
  event,
  leaderboard,
  // Study
  jisho,
  dailyWord,
  studyTracker,
  // Admin
  setup,
  botConfig,
  xpManage,
];

/**
 * Load commands into a collection
 */
export function loadCommands(): Collection<string, Command> {
  const collection = new Collection<string, Command>();

  for (const command of commands) {
    collection.set(command.data.name, command);
    console.log(`[Commands] Loaded: /${command.data.name}`);
  }

  console.log(`[Commands] Total loaded: ${collection.size}`);
  return collection;
}

/**
 * Deploy slash commands to Discord
 */
export async function deployCommands(): Promise<void> {
  const rest = new REST().setToken(config.discord.token);

  try {
    console.log('[Commands] Started refreshing application (/) commands...');

    const commandData = commands.map(cmd => cmd.data.toJSON());

    if (config.discord.guildId) {
      // Deploy to specific guild (faster for development)
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commandData }
      );
      console.log(`[Commands] Successfully deployed ${commandData.length} commands to guild ${config.discord.guildId}`);
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commandData }
      );
      console.log(`[Commands] Successfully deployed ${commandData.length} commands globally`);
    }
  } catch (error) {
    console.error('[Commands] Error deploying commands:', error);
    throw error;
  }
}

export default commands;
