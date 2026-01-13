import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { userSchema } from '../../database/schema.js';
import { updateLevelRoles } from '../../services/level-service.js';

const xpManage: Command = {
  data: new SlashCommandBuilder()
    .setName('xpmanage')
    .setDescription('Gestisci XP e livelli degli utenti (Admin)')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Aggiungi o rimuovi XP a un utente')
        .addUserOption(opt =>
          opt
            .setName('utente')
            .setDescription('Utente a cui modificare l\'XP')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('xp')
            .setDescription('Quantità di XP da aggiungere (può essere negativo per rimuovere)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('set-level')
        .setDescription('Imposta un livello specifico per un utente')
        .addUserOption(opt =>
          opt
            .setName('utente')
            .setDescription('Utente a cui impostare il livello')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('livello')
            .setDescription('Livello da impostare (minimo 1)')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('set-xp')
        .setDescription('Imposta XP direttamente per un utente')
        .addUserOption(opt =>
          opt
            .setName('utente')
            .setDescription('Utente a cui impostare l\'XP')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('xp')
            .setDescription('Quantità di XP da impostare (minimo 0)')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hasPermission = await checkAdminPermission(interaction);
    if (!hasPermission) return;

    if (!interaction.guild) {
      await interaction.reply({
        embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await addXp(interaction);
        break;
      case 'set-level':
        await setLevel(interaction);
        break;
      case 'set-xp':
        await setXp(interaction);
        break;
    }
  },
};

/**
 * Add XP to a user
 */
async function addXp(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('utente', true);
  const xpToAdd = interaction.options.getInteger('xp', true);

  try {
    // Get current user data
    const currentUser = userSchema.getOrCreate(targetUser.id, targetUser.username);
    const oldXp = currentUser.xp;
    const oldLevel = currentUser.level;

    // Add XP using updateXp method
    const updatedUser = userSchema.updateXp(targetUser.id, xpToAdd);

    // Update level roles if user is in the guild
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await updateLevelRoles(member, updatedUser.level);
      } catch (error) {
        // User might not be in the guild, ignore error
        console.log(`[XPManage] Could not update roles for user ${targetUser.id}:`, error);
      }
    }

    // Create success embed
    const embed = successEmbed(
      'XP modificato!',
      `**Utente:** ${targetUser} (${targetUser.username})\n\n` +
        `**Prima:**\n` +
        `• XP: ${oldXp.toLocaleString()}\n` +
        `• Livello: ${oldLevel}\n\n` +
        `**Dopo:**\n` +
        `• XP: ${updatedUser.xp.toLocaleString()} ${xpToAdd >= 0 ? `(+${xpToAdd.toLocaleString()})` : `(${xpToAdd.toLocaleString()})`}\n` +
        `• Livello: ${updatedUser.level} ${updatedUser.level > oldLevel ? '⬆️' : updatedUser.level < oldLevel ? '⬇️' : ''}`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('[XPManage] Error adding XP:', error);
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Si è verificato un errore durante la modifica dell\'XP.')],
      ephemeral: true,
    });
  }
}

/**
 * Set a specific level for a user
 */
async function setLevel(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('utente', true);
  const targetLevel = interaction.options.getInteger('livello', true);

  try {
    // Get current user data
    const currentUser = userSchema.getOrCreate(targetUser.id, targetUser.username);
    const oldXp = currentUser.xp;
    const oldLevel = currentUser.level;

    // Set level using setLevel method
    const updatedUser = userSchema.setLevel(targetUser.id, targetLevel);

    // Update level roles if user is in the guild
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await updateLevelRoles(member, updatedUser.level);
      } catch (error) {
        // User might not be in the guild, ignore error
        console.log(`[XPManage] Could not update roles for user ${targetUser.id}:`, error);
      }
    }

    // Create success embed
    const embed = successEmbed(
      'Livello impostato!',
      `**Utente:** ${targetUser} (${targetUser.username})\n\n` +
        `**Prima:**\n` +
        `• XP: ${oldXp.toLocaleString()}\n` +
        `• Livello: ${oldLevel}\n\n` +
        `**Dopo:**\n` +
        `• XP: ${updatedUser.xp.toLocaleString()} (calcolato per livello ${targetLevel})\n` +
        `• Livello: ${updatedUser.level} ${updatedUser.level > oldLevel ? '⬆️' : updatedUser.level < oldLevel ? '⬇️' : ''}`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('[XPManage] Error setting level:', error);
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Si è verificato un errore durante l\'impostazione del livello.')],
      ephemeral: true,
    });
  }
}

/**
 * Set XP directly for a user
 */
async function setXp(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('utente', true);
  const targetXp = interaction.options.getInteger('xp', true);

  try {
    // Get current user data
    const currentUser = userSchema.getOrCreate(targetUser.id, targetUser.username);
    const oldXp = currentUser.xp;
    const oldLevel = currentUser.level;

    // Set XP using setXp method
    const updatedUser = userSchema.setXp(targetUser.id, targetXp);

    // Update level roles if user is in the guild
    if (interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(targetUser.id);
        await updateLevelRoles(member, updatedUser.level);
      } catch (error) {
        // User might not be in the guild, ignore error
        console.log(`[XPManage] Could not update roles for user ${targetUser.id}:`, error);
      }
    }

    // Create success embed
    const embed = successEmbed(
      'XP impostato!',
      `**Utente:** ${targetUser} (${targetUser.username})\n\n` +
        `**Prima:**\n` +
        `• XP: ${oldXp.toLocaleString()}\n` +
        `• Livello: ${oldLevel}\n\n` +
        `**Dopo:**\n` +
        `• XP: ${updatedUser.xp.toLocaleString()}\n` +
        `• Livello: ${updatedUser.level} ${updatedUser.level > oldLevel ? '⬆️' : updatedUser.level < oldLevel ? '⬇️' : ''}`
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('[XPManage] Error setting XP:', error);
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Si è verificato un errore durante l\'impostazione dell\'XP.')],
      ephemeral: true,
    });
  }
}

export default xpManage;
