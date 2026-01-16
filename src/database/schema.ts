import { db } from './index.js';
import type { 
  User, 
  GameStats, 
  Giveaway, 
  GiveawayEntry, 
  BotEvent, 
  StudySession, 
  GuildConfig 
} from '../types/index.js';

/**
 * User-related database operations
 */
export const userSchema = {
  /**
   * Get or create a user
   */
  getOrCreate(id: string, username: string): User {
    let user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    
    if (!user) {
      db.run(
        'INSERT INTO users (id, username, xp, level, study_streak) VALUES (?, ?, 0, 1, 0)',
        [id, username]
      );
      user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    }
    
    return user!;
  },

  /**
   * Update user XP and level
   */
  updateXp(id: string, xpToAdd: number): User {
    const user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new Error('User not found');

    const newXp = user.xp + xpToAdd;
    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

    db.run(
      'UPDATE users SET xp = ?, level = ? WHERE id = ?',
      [newXp, newLevel, id]
    );

    return { ...user, xp: newXp, level: newLevel };
  },

  /**
   * Set user XP directly (recalculates level)
   */
  setXp(id: string, xp: number): User {
    const user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new Error('User not found');

    // Ensure XP is not negative
    const newXp = Math.max(0, xp);
    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

    db.run(
      'UPDATE users SET xp = ?, level = ? WHERE id = ?',
      [newXp, newLevel, id]
    );

    return { ...user, xp: newXp, level: newLevel };
  },

  /**
   * Set user level directly (calculates required XP)
   */
  setLevel(id: string, level: number): User {
    const user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new Error('User not found');

    // Ensure level is at least 1
    const newLevel = Math.max(1, level);
    // Calculate XP needed for this level: xp = (level - 1)^2 * 100
    const newXp = Math.pow(newLevel - 1, 2) * 100;

    db.run(
      'UPDATE users SET xp = ?, level = ? WHERE id = ?',
      [newXp, newLevel, id]
    );

    return { ...user, xp: newXp, level: newLevel };
  },

  /**
   * Update study streak
   */
  updateStreak(id: string): void {
    const user = db.queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const lastStudy = user.last_study_date?.split('T')[0];

    let newStreak = user.study_streak;
    
    if (lastStudy !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastStudy === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }

      db.run(
        'UPDATE users SET study_streak = ?, last_study_date = ? WHERE id = ?',
        [newStreak, today, id]
      );
    }
  },

  /**
   * Get leaderboard by XP
   */
  getLeaderboard(limit: number = 10): User[] {
    return db.query<User>(
      'SELECT * FROM users ORDER BY xp DESC LIMIT ?',
      [limit]
    );
  },

  /**
   * Get user rank
   */
  getRank(id: string): number {
    const result = db.queryOne<{ rank: number }>(
      `SELECT COUNT(*) + 1 as rank FROM users WHERE xp > (SELECT xp FROM users WHERE id = ?)`,
      [id]
    );
    return result?.rank || 0;
  },

  /**
   * Get all users
   */
  getAll(): User[] {
    return db.query<User>('SELECT * FROM users');
  }
};

/**
 * Game stats database operations
 */
export const gameStatsSchema = {
  /**
   * Get or create game stats for a user
   */
  getOrCreate(userId: string, gameType: string): GameStats {
    let stats = db.queryOne<GameStats>(
      'SELECT * FROM game_stats WHERE user_id = ? AND game_type = ?',
      [userId, gameType]
    );

    if (!stats) {
      db.run(
        'INSERT INTO game_stats (user_id, game_type, games_played, games_won, correct_answers) VALUES (?, ?, 0, 0, 0)',
        [userId, gameType]
      );
      stats = db.queryOne<GameStats>(
        'SELECT * FROM game_stats WHERE user_id = ? AND game_type = ?',
        [userId, gameType]
      );
    }

    return stats!;
  },

  /**
   * Update game stats
   */
  update(userId: string, gameType: string, won: boolean, correctAnswers: number = 0): void {
    this.getOrCreate(userId, gameType);
    
    db.run(
      `UPDATE game_stats 
       SET games_played = games_played + 1, 
           games_won = games_won + ?, 
           correct_answers = correct_answers + ?
       WHERE user_id = ? AND game_type = ?`,
      [won ? 1 : 0, correctAnswers, userId, gameType]
    );
  },

  /**
   * Get all stats for a user
   */
  getAllForUser(userId: string): GameStats[] {
    return db.query<GameStats>(
      'SELECT * FROM game_stats WHERE user_id = ?',
      [userId]
    );
  }
};

/**
 * Giveaway database operations
 */
export const giveawaySchema = {
  /**
   * Create a new giveaway
   */
  create(channelId: string, messageId: string, prize: string, winnersCount: number, endsAt: string, hostId: string): number {
    db.run(
      `INSERT INTO giveaways (channel_id, message_id, prize, winners_count, ends_at, host_id, ended) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [channelId, messageId, prize, winnersCount, endsAt, hostId]
    );
    
    const result = db.queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    return result?.id || 0;
  },

  /**
   * Get active giveaways
   * Note: ends_at is stored as ISO string, so we use Unix timestamp for reliable comparison
   */
  getActive(): Giveaway[] {
    return db.query<Giveaway>(
      `SELECT * FROM giveaways 
       WHERE ended = 0 
       AND strftime('%s', REPLACE(REPLACE(ends_at, 'T', ' '), '.000Z', '')) > strftime('%s', 'now')`
    );
  },

  /**
   * Get giveaway by ID
   */
  getById(id: number): Giveaway | undefined {
    return db.queryOne<Giveaway>('SELECT * FROM giveaways WHERE id = ?', [id]);
  },

  /**
   * Get giveaways that should end
   * Note: ends_at is stored as ISO string (e.g., "2024-01-01T12:00:00.000Z")
   * We use strftime('%s', ...) to convert to Unix timestamp for reliable comparison
   */
  getEndingSoon(): Giveaway[] {
    // Convert ISO string to SQLite datetime format, then to Unix timestamp
    // SQLite can parse ISO 8601 format if we remove milliseconds and timezone info
    return db.query<Giveaway>(
      `SELECT * FROM giveaways 
       WHERE ended = 0 
       AND strftime('%s', REPLACE(REPLACE(ends_at, 'T', ' '), '.000Z', '')) <= strftime('%s', 'now')`
    );
  },

  /**
   * Mark giveaway as ended
   */
  end(id: number): void {
    db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [id]);
  },

  /**
   * Add entry
   */
  addEntry(giveawayId: number, userId: string): boolean {
    try {
      db.run(
        'INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)',
        [giveawayId, userId]
      );
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get entries for a giveaway
   */
  getEntries(giveawayId: number): GiveawayEntry[] {
    return db.query<GiveawayEntry>(
      'SELECT * FROM giveaway_entries WHERE giveaway_id = ?',
      [giveawayId]
    );
  }
};

/**
 * Event database operations
 */
export const eventSchema = {
  /**
   * Create a new event
   */
  create(guildId: string, title: string, description: string, channelId: string, startsAt: string, createdBy: string): number {
    db.run(
      `INSERT INTO events (guild_id, title, description, channel_id, starts_at, created_by, reminder_sent) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [guildId, title, description, channelId, startsAt, createdBy]
    );
    
    const result = db.queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
    return result?.id || 0;
  },

  /**
   * Get upcoming events for a guild
   */
  getUpcoming(guildId: string): BotEvent[] {
    return db.query<BotEvent>(
      'SELECT * FROM events WHERE guild_id = ? AND starts_at > datetime("now") ORDER BY starts_at ASC',
      [guildId]
    );
  },

  /**
   * Get events needing reminder
   */
  getNeedingReminder(): BotEvent[] {
    return db.query<BotEvent>(
      `SELECT * FROM events 
       WHERE reminder_sent = 0 
       AND starts_at <= datetime("now", "+1 hour") 
       AND starts_at > datetime("now")`
    );
  },

  /**
   * Mark reminder as sent
   */
  markReminderSent(id: number): void {
    db.run('UPDATE events SET reminder_sent = 1 WHERE id = ?', [id]);
  },

  /**
   * Delete event
   */
  delete(id: number): void {
    db.run('DELETE FROM events WHERE id = ?', [id]);
  }
};

/**
 * Study session database operations
 */
export const studySessionSchema = {
  /**
   * Log a study session
   */
  create(userId: string, durationMinutes: number, notes: string | null): void {
    db.run(
      'INSERT INTO study_sessions (user_id, duration_minutes, notes) VALUES (?, ?, ?)',
      [userId, durationMinutes, notes]
    );
  },

  /**
   * Get study sessions for a user
   */
  getForUser(userId: string, limit: number = 30): StudySession[] {
    return db.query<StudySession>(
      'SELECT * FROM study_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  },

  /**
   * Get total study time for a user
   */
  getTotalTime(userId: string): number {
    const result = db.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(duration_minutes), 0) as total FROM study_sessions WHERE user_id = ?',
      [userId]
    );
    return result?.total || 0;
  },

  /**
   * Get study time this week
   */
  getWeeklyTime(userId: string): number {
    const result = db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total 
       FROM study_sessions 
       WHERE user_id = ? AND created_at >= datetime("now", "-7 days")`,
      [userId]
    );
    return result?.total || 0;
  }
};

/**
 * Guild configuration database operations
 */
export const guildConfigSchema = {
  /**
   * Get or create guild config
   */
  getOrCreate(guildId: string): GuildConfig {
    let config = db.queryOne<GuildConfig>(
      'SELECT * FROM guild_config WHERE guild_id = ?',
      [guildId]
    );

    if (!config) {
      db.run(
        'INSERT INTO guild_config (guild_id) VALUES (?)',
        [guildId]
      );
      config = db.queryOne<GuildConfig>(
        'SELECT * FROM guild_config WHERE guild_id = ?',
        [guildId]
      );
    }

    return config!;
  },

  /**
   * Update guild config
   */
  update(guildId: string, updates: Partial<GuildConfig>): void {
    this.getOrCreate(guildId);

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (updates.welcome_channel_id !== undefined) {
      fields.push('welcome_channel_id = ?');
      values.push(updates.welcome_channel_id);
    }
    if (updates.welcome_message !== undefined) {
      fields.push('welcome_message = ?');
      values.push(updates.welcome_message);
    }
    if (updates.daily_word_channel_id !== undefined) {
      fields.push('daily_word_channel_id = ?');
      values.push(updates.daily_word_channel_id);
    }
    if (updates.game_channels !== undefined) {
      fields.push('game_channels = ?');
      values.push(updates.game_channels);
    }
    if (updates.admin_role_id !== undefined) {
      fields.push('admin_role_id = ?');
      values.push(updates.admin_role_id);
    }

    if (fields.length > 0) {
      values.push(guildId);
      db.run(
        `UPDATE guild_config SET ${fields.join(', ')} WHERE guild_id = ?`,
        values
      );
    }
  },

  /**
   * Get all guilds with daily word channel configured
   */
  getGuildsWithDailyWord(): GuildConfig[] {
    return db.query<GuildConfig>(
      'SELECT * FROM guild_config WHERE daily_word_channel_id IS NOT NULL'
    );
  }
};

/**
 * XP cooldown database operations
 */
export const xpCooldownSchema = {
  /**
   * Check if user can earn XP
   */
  canEarnXp(userId: string, cooldownSeconds: number): boolean {
    const record = db.queryOne<{ last_xp_at: string }>(
      'SELECT last_xp_at FROM xp_cooldowns WHERE user_id = ?',
      [userId]
    );

    if (!record) return true;

    const lastXp = new Date(record.last_xp_at).getTime();
    const now = Date.now();
    return (now - lastXp) >= cooldownSeconds * 1000;
  },

  /**
   * Update last XP time
   */
  updateLastXp(userId: string): void {
    db.run(
      `INSERT OR REPLACE INTO xp_cooldowns (user_id, last_xp_at) VALUES (?, datetime("now"))`,
      [userId]
    );
  }
};
