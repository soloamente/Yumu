import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

/**
 * Database wrapper class for SQLite operations using sql.js
 */
class Database {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor() {
    this.dbPath = path.resolve(config.database.path);
  }

  /**
   * Initialize the database connection
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Initialize sql.js
      const SQL = await initSqlJs();

      // Load existing database or create new one
      if (fs.existsSync(this.dbPath)) {
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(buffer);
        console.log('[Database] Loaded existing database from:', this.dbPath);
      } else {
        this.db = new SQL.Database();
        console.log('[Database] Created new database');
      }

      // Run migrations
      await this.runMigrations();
      
      // Save database to ensure file exists
      this.save();
      
      this.initialized = true;
      console.log('[Database] Initialization complete');
    } catch (error) {
      console.error('[Database] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Run database migrations to create tables
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Users table - stores user profiles and XP
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        study_streak INTEGER DEFAULT 0,
        last_study_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Game statistics per user
    this.db.run(`
      CREATE TABLE IF NOT EXISTS game_stats (
        user_id TEXT,
        game_type TEXT,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, game_type)
      )
    `);

    // Giveaways
    this.db.run(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT,
        message_id TEXT,
        prize TEXT,
        winners_count INTEGER DEFAULT 1,
        ends_at TEXT,
        ended INTEGER DEFAULT 0,
        host_id TEXT
      )
    `);

    // Giveaway entries
    this.db.run(`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER,
        user_id TEXT,
        PRIMARY KEY (giveaway_id, user_id)
      )
    `);

    // Events
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        title TEXT,
        description TEXT,
        channel_id TEXT,
        starts_at TEXT,
        reminder_sent INTEGER DEFAULT 0,
        created_by TEXT
      )
    `);

    // Study sessions
    this.db.run(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        duration_minutes INTEGER,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Guild configuration
    this.db.run(`
      CREATE TABLE IF NOT EXISTS guild_config (
        guild_id TEXT PRIMARY KEY,
        welcome_channel_id TEXT,
        welcome_message TEXT,
        daily_word_channel_id TEXT,
        game_channels TEXT,
        admin_role_id TEXT
      )
    `);

    // Daily words sent (to avoid duplicates)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS daily_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        word TEXT,
        sent_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // XP cooldowns (to track when users last earned XP)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS xp_cooldowns (
        user_id TEXT PRIMARY KEY,
        last_xp_at TEXT
      )
    `);

    console.log('[Database] Migrations completed');
  }

  /**
   * Save database to file
   */
  save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * Execute a SQL query and return all results
   */
  query<T>(sql: string, params: (string | number | null | Uint8Array)[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
      stmt.free();
      
      return results;
    } catch (error) {
      console.error('[Database] Query error:', sql, params, error);
      throw error;
    }
  }

  /**
   * Execute a SQL query and return the first result
   */
  queryOne<T>(sql: string, params: (string | number | null | Uint8Array)[] = []): T | undefined {
    const results = this.query<T>(sql, params);
    return results[0];
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params: (string | number | null | Uint8Array)[] = []): void {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      this.db.run(sql, params);
      this.save(); // Auto-save after modifications
    } catch (error) {
      console.error('[Database] Run error:', sql, params, error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
export const db = new Database();
export default db;
