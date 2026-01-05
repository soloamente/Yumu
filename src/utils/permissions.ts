import { GuildMember, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { guildConfigSchema } from '../database/schema.js';

/**
 * Check if a member is a server administrator
 */
export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Check if a member has manage guild permission
 */
export function canManageGuild(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Check if a member has manage messages permission
 */
export function canManageMessages(member: GuildMember | null): boolean {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

/**
 * Check if a member has the bot admin role
 */
export function hasBotAdminRole(member: GuildMember | null): boolean {
  if (!member) return false;
  
  const guildConfig = guildConfigSchema.getOrCreate(member.guild.id);
  if (!guildConfig.admin_role_id) return false;
  
  return member.roles.cache.has(guildConfig.admin_role_id);
}

/**
 * Check if a member can use admin bot commands
 */
export function canUseBotAdmin(member: GuildMember | null): boolean {
  if (!member) return false;
  return isAdmin(member) || canManageGuild(member) || hasBotAdminRole(member);
}

/**
 * Check permissions for interaction and reply with error if not allowed
 */
export async function checkAdminPermission(interaction: ChatInputCommandInteraction): Promise<boolean> {
  const member = interaction.member as GuildMember | null;
  
  if (!canUseBotAdmin(member)) {
    await interaction.reply({
      content: '❌ Non hai i permessi per usare questo comando!',
      ephemeral: true,
    });
    return false;
  }
  
  return true;
}

/**
 * Check if the bot has required permissions in a channel
 */
export function botHasPermissions(
  interaction: ChatInputCommandInteraction,
  permissions: bigint[]
): boolean {
  const botMember = interaction.guild?.members.me;
  if (!botMember) return false;
  
  return permissions.every(perm => botMember.permissions.has(perm));
}
