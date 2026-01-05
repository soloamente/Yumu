import { GuildMember } from 'discord.js';
import { userSchema } from '../database/schema.js';
import type { User } from '../types/index.js';

/**
 * Level role configuration
 * Maps level thresholds to role names
 */
export const levelRoles: { level: number; name: string; color: number }[] = [
  { level: 5, name: '初心者 (Beginner)', color: 0x90CAF9 },
  { level: 10, name: '学生 (Student)', color: 0x4CAF50 },
  { level: 20, name: '中級者 (Intermediate)', color: 0xFFEB3B },
  { level: 35, name: '上級者 (Advanced)', color: 0xFF9800 },
  { level: 50, name: '先輩 (Senpai)', color: 0xE91E63 },
  { level: 75, name: '師匠 (Master)', color: 0x9C27B0 },
  { level: 100, name: '達人 (Expert)', color: 0xFFD700 },
];

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * Calculate XP required for a specific level
 */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 100;
}

/**
 * Calculate XP needed for next level
 */
export function xpToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return nextLevelXp - currentXp;
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const progress = (xp - currentLevelXp) / (nextLevelXp - currentLevelXp);
  return Math.min(Math.max(progress * 100, 0), 100);
}

/**
 * Generate a visual progress bar
 */
export function generateProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Award XP to a user
 */
export function awardXp(userId: string, username: string, amount: number): { user: User; leveledUp: boolean; oldLevel: number } {
  const user = userSchema.getOrCreate(userId, username);
  const oldLevel = user.level;
  
  const updatedUser = userSchema.updateXp(userId, amount);
  const leveledUp = updatedUser.level > oldLevel;

  return { user: updatedUser, leveledUp, oldLevel };
}

/**
 * Get the appropriate level role for a level
 */
export function getLevelRole(level: number): typeof levelRoles[0] | null {
  // Find the highest role the user qualifies for
  const qualifiedRoles = levelRoles.filter(r => level >= r.level);
  return qualifiedRoles.length > 0 ? qualifiedRoles[qualifiedRoles.length - 1] : null;
}

/**
 * Update member's level roles
 */
export async function updateLevelRoles(member: GuildMember, level: number): Promise<void> {
  const guild = member.guild;
  const targetRole = getLevelRole(level);

  // Remove all level roles first
  for (const levelRole of levelRoles) {
    const role = guild.roles.cache.find(r => r.name === levelRole.name);
    if (role && member.roles.cache.has(role.id)) {
      try {
        await member.roles.remove(role);
      } catch (error) {
        console.error(`[Levels] Could not remove role ${levelRole.name}:`, error);
      }
    }
  }

  // Add the appropriate role
  if (targetRole) {
    let role = guild.roles.cache.find(r => r.name === targetRole.name);
    
    // Create role if it doesn't exist
    if (!role) {
      try {
        role = await guild.roles.create({
          name: targetRole.name,
          color: targetRole.color,
          reason: 'NihongoHub level role',
        });
        console.log(`[Levels] Created role: ${targetRole.name}`);
      } catch (error) {
        console.error(`[Levels] Could not create role ${targetRole.name}:`, error);
        return;
      }
    }

    // Add role to member
    try {
      await member.roles.add(role);
      console.log(`[Levels] Added role ${targetRole.name} to ${member.user.tag}`);
    } catch (error) {
      console.error(`[Levels] Could not add role ${targetRole.name}:`, error);
    }
  }
}

/**
 * Get leaderboard data
 */
export function getLeaderboard(limit: number = 10): User[] {
  return userSchema.getLeaderboard(limit);
}

/**
 * Get user rank
 */
export function getUserRank(userId: string): number {
  return userSchema.getRank(userId);
}
