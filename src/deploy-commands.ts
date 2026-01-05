import { deployCommands } from './commands/index.js';
import { validateConfig } from './config.js';

/**
 * Deploy slash commands to Discord
 * Run this script with: npm run deploy
 */
async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║    NihongoHub - Deploy Commands            ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  // Validate configuration
  validateConfig();

  // Deploy commands
  await deployCommands();

  console.log('');
  console.log('Commands deployed successfully!');
  process.exit(0);
}

main().catch(error => {
  console.error('Failed to deploy commands:', error);
  process.exit(1);
});
