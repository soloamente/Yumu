import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { handleGiveawayEntry } from '../services/giveaway-service.js';

/**
 * Component handler registry
 * Maps custom IDs to their handlers
 */
type ComponentHandler = (
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
) => Promise<void>;

const buttonHandlers = new Map<string, ComponentHandler>();
const selectMenuHandlers = new Map<string, ComponentHandler>();
const modalHandlers = new Map<string, ComponentHandler>();

/**
 * Register a button handler
 */
export function registerButtonHandler(customId: string | RegExp, handler: ComponentHandler): void {
  if (typeof customId === 'string') {
    buttonHandlers.set(customId, handler);
  } else {
    // For regex patterns, store with a special prefix
    buttonHandlers.set(`regex:${customId.toString()}`, handler);
  }
}

/**
 * Register a select menu handler
 */
export function registerSelectMenuHandler(customId: string | RegExp, handler: ComponentHandler): void {
  if (typeof customId === 'string') {
    selectMenuHandlers.set(customId, handler);
  } else {
    selectMenuHandlers.set(`regex:${customId.toString()}`, handler);
  }
}

/**
 * Register a modal handler
 */
export function registerModalHandler(customId: string | RegExp, handler: ComponentHandler): void {
  if (typeof customId === 'string') {
    modalHandlers.set(customId, handler);
  } else {
    modalHandlers.set(`regex:${customId.toString()}`, handler);
  }
}

/**
 * Handle button interaction
 */
export async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;

  // Check exact matches first
  const exactHandler = buttonHandlers.get(customId);
  if (exactHandler) {
    await exactHandler(interaction);
    return;
  }

  // Check regex patterns
  for (const [key, handler] of buttonHandlers.entries()) {
    if (key.startsWith('regex:')) {
      const pattern = new RegExp(key.slice(6));
      if (pattern.test(customId)) {
        await handler(interaction);
        return;
      }
    }
  }

  // Check for common patterns
  if (customId.startsWith('giveaway_')) {
    await handleGiveawayButton(interaction);
    return;
  }

  // Check for game buttons - these are handled by awaitMessageComponent()
  // The collector will handle the interaction, so we don't need to respond here
  // This prevents the "component no longer valid" message from showing
  const gameButtonPrefixes = ['kanji_', 'vocab_', 'num_', 'typing_', 'story_'];
  if (gameButtonPrefixes.some(prefix => customId.startsWith(prefix))) {
    // This interaction is being handled by awaitMessageComponent() in the game
    // The collector will process it, so we just return without responding
    // This prevents the error message from appearing
    return;
  }

  // Default: acknowledge but do nothing
  await interaction.reply({
    content: '⚠️ Questo componente non è più valido.',
    ephemeral: true,
  });
}

/**
 * Handle select menu interaction
 */
export async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;

  // Check exact matches first
  const exactHandler = selectMenuHandlers.get(customId);
  if (exactHandler) {
    await exactHandler(interaction);
    return;
  }

  // Check regex patterns
  for (const [key, handler] of selectMenuHandlers.entries()) {
    if (key.startsWith('regex:')) {
      const pattern = new RegExp(key.slice(6));
      if (pattern.test(customId)) {
        await handler(interaction);
        return;
      }
    }
  }

  // Default: acknowledge but do nothing
  await interaction.reply({
    content: '⚠️ Questo componente non è più valido.',
    ephemeral: true,
  });
}

/**
 * Handle modal interaction
 */
export async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
  const customId = interaction.customId;

  // Check exact matches first
  const exactHandler = modalHandlers.get(customId);
  if (exactHandler) {
    await exactHandler(interaction);
    return;
  }

  // Check regex patterns
  for (const [key, handler] of modalHandlers.entries()) {
    if (key.startsWith('regex:')) {
      const pattern = new RegExp(key.slice(6));
      if (pattern.test(customId)) {
        await handler(interaction);
        return;
      }
    }
  }

  // Default: acknowledge but do nothing
  await interaction.reply({
    content: '⚠️ Questo modulo non è più valido.',
    ephemeral: true,
  });
}

/**
 * Handle giveaway button interactions
 */
async function handleGiveawayButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId === 'giveaway_enter') {
    await handleGiveawayEntry(interaction);
  } else if (interaction.customId === 'giveaway_ended') {
    await interaction.reply({
      content: '❌ Questo giveaway è già terminato!',
      ephemeral: true,
    });
  }
}

/**
 * Initialize default component handlers
 */
export function initializeComponentHandlers(): void {
  // Giveaway handlers are already handled in the service
  // Add more default handlers here as needed
}
