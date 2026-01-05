import { 
  Interaction, 
  ChatInputCommandInteraction, 
  Collection,
  EmbedBuilder 
} from 'discord.js';
import type { Event, Command } from '../types/index.js';
import { config } from '../config.js';
import { handleButton, handleSelectMenu, handleModal } from '../utils/component-handler.js';

/**
 * InteractionCreate event - handles slash command interactions
 */
const interactionCreate: Event = {
  name: 'interactionCreate',
  async execute(interaction: Interaction) {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName) as Command | undefined;
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(`[Autocomplete] Error in /${interaction.commandName}:`, error);
        }
      }
      return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        console.error('[Components] Error handling button interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Si è verificato un errore durante l\'elaborazione del componente.',
            ephemeral: true,
          }).catch(() => {
            // Ignore errors if interaction already expired
          });
        }
      }
      return;
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      try {
        await handleSelectMenu(interaction);
      } catch (error) {
        console.error('[Components] Error handling select menu interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Si è verificato un errore durante l\'elaborazione del menu.',
            ephemeral: true,
          }).catch(() => {
            // Ignore errors if interaction already expired
          });
        }
      }
      return;
    }

    // Handle modal interactions
    if (interaction.isModalSubmit()) {
      try {
        await handleModal(interaction);
      } catch (error) {
        console.error('[Components] Error handling modal interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Si è verificato un errore durante l\'elaborazione del modulo.',
            ephemeral: true,
          }).catch(() => {
            // Ignore errors if interaction already expired
          });
        }
      }
      return;
    }
  },
};

/**
 * Handle slash command execution
 */
async function handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = interaction.client.commands.get(interaction.commandName) as Command | undefined;

  if (!command) {
    console.warn(`[Commands] Unknown command: /${interaction.commandName}`);
    await interaction.reply({
      content: 'Questo comando non esiste!',
      ephemeral: true,
    });
    return;
  }

  // Check cooldowns
  const cooldownAmount = (command.cooldown || 3) * 1000; // Default 3 seconds
  const now = Date.now();
  const cooldowns = interaction.client.cooldowns;

  if (!cooldowns.has(command.data.name)) {
    cooldowns.set(command.data.name, new Collection());
  }

  const timestamps = cooldowns.get(command.data.name)!;
  const userId = interaction.user.id;

  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId)! + cooldownAmount;

    if (now < expirationTime) {
      const expiredTimestamp = Math.round(expirationTime / 1000);
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.warning)
            .setDescription(`⏳ Aspetta un momento! Puoi usare \`/${command.data.name}\` di nuovo <t:${expiredTimestamp}:R>`)
        ],
        ephemeral: true,
      });
      return;
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);

  // Execute command
  try {
    console.log(`[Commands] ${interaction.user.tag} used /${interaction.commandName} in ${interaction.guild?.name || 'DM'}`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Commands] Error executing /${interaction.commandName}:`, error);

    const errorEmbed = new EmbedBuilder()
      .setColor(config.colors.error)
      .setTitle('❌ Errore')
      .setDescription('Si è verificato un errore durante l\'esecuzione del comando.')
      .setTimestamp();

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

export default interactionCreate;
