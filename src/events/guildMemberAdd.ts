import { GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import type { Event } from '../types/index.js';
import { config } from '../config.js';
import { guildConfigSchema, userSchema } from '../database/schema.js';

/**
 * GuildMemberAdd event - handles new member welcome messages
 */
const guildMemberAdd: Event = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    // Create user in database
    userSchema.getOrCreate(member.id, member.user.username);

    // Get guild configuration
    const guildConfig = guildConfigSchema.getOrCreate(member.guild.id);

    // Check if welcome channel is configured
    if (!guildConfig.welcome_channel_id) {
      return;
    }

    // Get welcome channel
    const welcomeChannel = member.guild.channels.cache.get(guildConfig.welcome_channel_id);
    
    if (!welcomeChannel || !(welcomeChannel instanceof TextChannel)) {
      console.warn(`[Welcome] Welcome channel not found for guild ${member.guild.name}`);
      return;
    }

    // Build welcome message
    const welcomeMessage = guildConfig.welcome_message || getDefaultWelcomeMessage();
    const parsedMessage = parseWelcomeMessage(welcomeMessage, member);

    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🎌 ようこそ! Benvenuto!')
      .setDescription(parsedMessage)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '📚 Come iniziare',
          value: 'Usa `/jisho` per cercare parole giapponesi\nUsa `/shiritori` per giocare e imparare!',
          inline: true,
        },
        {
          name: '🏆 Livelli',
          value: 'Guadagna XP partecipando e giocando!\nSali di livello e sblocca ricompense!',
          inline: true,
        }
      )
      .setFooter({
        text: `Membro #${member.guild.memberCount}`,
        iconURL: member.guild.iconURL() || undefined,
      })
      .setTimestamp();

    try {
      await welcomeChannel.send({
        content: `Benvenuto ${member}!`,
        embeds: [welcomeEmbed],
      });
      
      console.log(`[Welcome] Welcomed new member: ${member.user.tag} in ${member.guild.name}`);
    } catch (error) {
      console.error(`[Welcome] Failed to send welcome message:`, error);
    }
  },
};

/**
 * Get default welcome message
 */
function getDefaultWelcomeMessage(): string {
  return `Ciao **{user}**! Benvenuto in **{server}**!

Siamo una community di appassionati che studiano il giapponese insieme. Qui troverai:

🎮 **Giochi educativi** per imparare divertendoti
📖 **Risorse** per lo studio
👥 **Una community** pronta ad aiutarti

頑張って! (Ganbatte! - Buona fortuna!)`;
}

/**
 * Parse welcome message placeholders
 */
function parseWelcomeMessage(message: string, member: GuildMember): string {
  return message
    .replace(/{user}/g, member.user.username)
    .replace(/{mention}/g, `<@${member.id}>`)
    .replace(/{server}/g, member.guild.name)
    .replace(/{memberCount}/g, String(member.guild.memberCount));
}

export default guildMemberAdd;
