import { createClient } from './client.js';
import { config, validateConfig } from './config.js';
import { db } from './database/index.js';
import { loadCommands } from './commands/index.js';
import { registerEvents } from './events/index.js';
import { initializeComponentHandlers } from './utils/component-handler.js';

/**
 * Main entry point for NihongoHub Discord Bot
 */
async function main(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       NihongoHub Bot - Starting...         ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // Validate configuration
  validateConfig();
  console.log('[Config] Configuration validated');

  // Initialize database
  await db.init();
  console.log('[Database] Database initialized');

  // Create Discord client
  const client = createClient();
  console.log('[Client] Discord client created');

  // Load commands
  client.commands = loadCommands();

  // Initialize component handlers
  initializeComponentHandlers();
  console.log('[Components] Component handlers initialized');

  // Register events
  registerEvents(client);

  // Handle graceful shutdown
  process.on('SIGINT', () => shutdown(client));
  process.on('SIGTERM', () => shutdown(client));

  // Login to Discord
  try {
    await client.login(config.discord.token);
  } catch (error) {
    console.error('[Login] Failed to login to Discord:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
function shutdown(client: ReturnType<typeof createClient>): void {
  console.log('\n[Shutdown] Shutting down gracefully...');
  
  // Save and close database
  db.close();
  console.log('[Shutdown] Database closed');
  
  // Destroy Discord client
  client.destroy();
  console.log('[Shutdown] Discord client destroyed');
  
  console.log('[Shutdown] Goodbye! またね!');
  process.exit(0);
}

// Run the bot
main().catch(error => {
  console.error('[Fatal] Unhandled error:', error);
  process.exit(1);
});
