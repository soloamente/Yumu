import { 
  Client, 
  TextChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ButtonInteraction
} from 'discord.js';
import { config } from '../config.js';
import { giveawaySchema } from '../database/schema.js';

/**
 * Map to store active giveaway timers
 * Key: giveawayId, Value: NodeJS.Timeout
 */
const giveawayTimers = new Map<number, NodeJS.Timeout>();

/**
 * Create a new giveaway
 * @param client Discord client instance (needed for timer to end giveaway)
 */
export async function createGiveaway(
  channel: TextChannel,
  prize: string,
  duration: number, // in milliseconds
  winnersCount: number,
  hostId: string,
  client: Client
): Promise<number> {
  const endsAt = new Date(Date.now() + duration).toISOString();

  // Create embed
  const embed = createGiveawayEmbed(prize, winnersCount, endsAt, hostId, 0);

  // Create button
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel('🎉 Partecipa!')
      .setStyle(ButtonStyle.Primary)
  );

  // Send message
  const message = await channel.send({
    embeds: [embed],
    components: [row],
  });

  // Save to database
  const giveawayId = giveawaySchema.create(
    channel.id,
    message.id,
    prize,
    winnersCount,
    endsAt,
    hostId
  );

  // Calculate the exact time remaining based on endsAt (more accurate than using duration)
  // This accounts for any delays during message sending and database operations
  const endsAtDate = new Date(endsAt);
  const now = new Date();
  const timeUntilEnd = endsAtDate.getTime() - now.getTime();

  // If the giveaway should have already ended, end it immediately
  if (timeUntilEnd <= 0) {
    endGiveaway(client, giveawayId).catch(error => {
      console.error(`[Giveaway] Error ending giveaway #${giveawayId} immediately:`, error);
    });
    return giveawayId;
  }

  // Set up timer to end giveaway when it expires
  // For precision, check every second in the last 20 seconds
  const checkSecondsBeforeEnd = 20;
  
  if (timeUntilEnd <= checkSecondsBeforeEnd * 1000) {
    // Ending soon - check every second for precision
    const checkInterval = setInterval(async () => {
      const checkNow = new Date();
      const checkEndsAt = new Date(endsAt);
      const checkRemaining = checkEndsAt.getTime() - checkNow.getTime();
      
      if (checkRemaining <= 0) {
        clearInterval(checkInterval);
        const existingTimer = giveawayTimers.get(giveawayId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        giveawayTimers.delete(giveawayId);
        await endGiveaway(client, giveawayId);
      }
    }, 1000);
    
    // Store interval ID (we'll store it as the timer)
    giveawayTimers.set(giveawayId, checkInterval as unknown as NodeJS.Timeout);
    
    // Clear the interval after the giveaway ends
    setTimeout(() => clearInterval(checkInterval), timeUntilEnd + 2000);
  } else {
    // Ending later - use a main timer that switches to second-by-second checking in the last 20 seconds
    const mainTimer = setTimeout(async () => {
      // Start second-by-second checking for precision
      const preciseCheck = setInterval(async () => {
        const checkNow = new Date();
        const checkEndsAt = new Date(endsAt);
        const checkRemaining = checkEndsAt.getTime() - checkNow.getTime();
        
        if (checkRemaining <= 0) {
          clearInterval(preciseCheck);
          giveawayTimers.delete(giveawayId);
          await endGiveaway(client, giveawayId);
        }
      }, 1000);
      
      // Replace main timer with precise check
      giveawayTimers.set(giveawayId, preciseCheck as unknown as NodeJS.Timeout);
      
      // Clear after it ends
      setTimeout(() => clearInterval(preciseCheck), checkSecondsBeforeEnd * 1000 + 2000);
    }, Math.max(0, timeUntilEnd - checkSecondsBeforeEnd * 1000));
    
    giveawayTimers.set(giveawayId, mainTimer);
  }

  console.log(`[Giveaway] Created giveaway #${giveawayId}: ${prize} (ends in ${Math.round(timeUntilEnd / 1000)}s)`);
  return giveawayId;
}

/**
 * Create giveaway embed
 */
function createGiveawayEmbed(
  prize: string,
  winnersCount: number,
  endsAt: string,
  hostId: string,
  entriesCount: number,
  ended: boolean = false
): EmbedBuilder {
  const endTimestamp = Math.floor(new Date(endsAt).getTime() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(ended ? '🎊 Giveaway Terminato!' : '🎉 GIVEAWAY!')
    .setDescription(`**${prize}**`)
    .setColor(ended ? config.colors.secondary : config.colors.gold)
    .addFields(
      {
        name: '🏆 Vincitori',
        value: String(winnersCount),
        inline: true,
      },
      {
        name: '👥 Partecipanti',
        value: String(entriesCount),
        inline: true,
      },
      {
        name: ended ? '⏰ Terminato' : '⏰ Termina',
        value: ended ? `<t:${endTimestamp}:R>` : `<t:${endTimestamp}:R>\n<t:${endTimestamp}:F>`,
        inline: true,
      },
      {
        name: '👤 Host',
        value: `<@${hostId}>`,
        inline: true,
      }
    )
    .setFooter({
      text: ended ? 'Grazie per aver partecipato!' : 'Clicca il bottone per partecipare!',
    })
    .setTimestamp();

  return embed;
}

/**
 * Handle giveaway entry button click
 */
export async function handleGiveawayEntry(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== 'giveaway_enter') return;

  const message = interaction.message;
  
  // Find giveaway by message ID
  const giveaways = giveawaySchema.getActive();
  const giveaway = giveaways.find(g => g.message_id === message.id);

  if (!giveaway) {
    await interaction.reply({
      content: '❌ Questo giveaway non è più attivo!',
      ephemeral: true,
    });
    return;
  }

  // Add entry
  const success = giveawaySchema.addEntry(giveaway.id, interaction.user.id);

  if (success) {
    await interaction.reply({
      content: '✅ Sei stato aggiunto al giveaway! Buona fortuna! 🍀',
      ephemeral: true,
    });

    // Update embed with new entry count
    const entries = giveawaySchema.getEntries(giveaway.id);
    const embed = createGiveawayEmbed(
      giveaway.prize,
      giveaway.winners_count,
      giveaway.ends_at,
      giveaway.host_id,
      entries.length
    );

    await message.edit({ embeds: [embed] });
  } else {
    await interaction.reply({
      content: '⚠️ Sei già iscritto a questo giveaway!',
      ephemeral: true,
    });
  }
}

/**
 * End a giveaway and pick winners
 * This also clears the timer if it exists
 */
export async function endGiveaway(client: Client, giveawayId: number): Promise<string[]> {
  // Clear the timer if it exists (in case giveaway is ended manually)
  // The timer could be a setTimeout or setInterval
  const timer = giveawayTimers.get(giveawayId);
  if (timer) {
    clearTimeout(timer);
    clearInterval(timer as unknown as NodeJS.Timeout);
    giveawayTimers.delete(giveawayId);
  }

  const giveaway = giveawaySchema.getById(giveawayId);
  if (!giveaway || giveaway.ended) {
    return [];
  }

  const entries = giveawaySchema.getEntries(giveawayId);
  
  // Pick random winners
  const winners: string[] = [];
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(giveaway.winners_count, shuffled.length); i++) {
    winners.push(shuffled[i].user_id);
  }

  // Mark as ended
  giveawaySchema.end(giveawayId);

  // Fetch channel once for both updating message and announcing
  let channel: TextChannel | null = null;
  try {
    const fetchedChannel = await client.channels.fetch(giveaway.channel_id);
    if (fetchedChannel && fetchedChannel.isTextBased()) {
      channel = fetchedChannel as TextChannel;
    }
  } catch (error) {
    console.error(`[Giveaway] Error fetching channel for giveaway #${giveawayId}:`, error);
  }

  // Update message
  if (channel) {
    try {
      const message = await channel.messages.fetch(giveaway.message_id);
      
      // Update embed
      const embed = createGiveawayEmbed(
        giveaway.prize,
        giveaway.winners_count,
        giveaway.ends_at,
        giveaway.host_id,
        entries.length,
        true
      );

      // Add winners to embed
      if (winners.length > 0) {
        embed.addFields({
          name: '🎊 Vincitori',
          value: winners.map(id => `<@${id}>`).join('\n'),
        });
      } else {
        embed.addFields({
          name: '😢 Nessun vincitore',
          value: 'Non ci sono stati partecipanti.',
        });
      }

      // Disable button
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_ended')
          .setLabel('Giveaway Terminato')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await message.edit({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(`[Giveaway] Error updating message for giveaway #${giveawayId}:`, error);
    }
  }

  // Announce winners (separate try-catch to ensure it always runs, even if message update failed)
  if (channel) {
    try {
      // Always announce, whether there are winners or not
      if (winners.length > 0) {
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        await channel.send({
          content: `🎊 Congratulazioni ${winnerMentions}! Avete vinto **${giveaway.prize}**! 🎉`,
        });
      } else {
        // Announce when there are no participants
        await channel.send({
          content: `🎉 Il giveaway per **${giveaway.prize}** è terminato, ma non ci sono stati partecipanti. 😢`,
        });
      }
    } catch (error) {
      console.error(`[Giveaway] Error announcing winners for giveaway #${giveawayId}:`, error);
    }
  }

  console.log(`[Giveaway] Ended giveaway #${giveawayId}, winners: ${winners.join(', ') || 'none'}`);
  return winners;
}

/**
 * Reroll giveaway winners
 */
export async function rerollGiveaway(client: Client, giveawayId: number): Promise<string[]> {
  const giveaway = giveawaySchema.getById(giveawayId);
  if (!giveaway) {
    throw new Error('Giveaway not found');
  }

  const entries = giveawaySchema.getEntries(giveawayId);
  
  // Pick new random winners
  const winners: string[] = [];
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(giveaway.winners_count, shuffled.length); i++) {
    winners.push(shuffled[i].user_id);
  }

  // Announce new winners
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    if (channel && channel.isTextBased() && winners.length > 0) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      await (channel as TextChannel).send({
        content: `🔄 Nuovi vincitori: ${winnerMentions}! Congratulazioni per **${giveaway.prize}**! 🎉`,
      });
    }
  } catch (error) {
    console.error(`[Giveaway] Error rerolling giveaway #${giveawayId}:`, error);
  }

  return winners;
}

/**
 * Schedule timers for all active giveaways
 * Call this on bot startup to restore timers for giveaways that were active before restart
 */
export function scheduleActiveGiveaways(client: Client): void {
  const activeGiveaways = giveawaySchema.getActive();
  const now = new Date();

  for (const giveaway of activeGiveaways) {
    // Skip if already has a timer
    if (giveawayTimers.has(giveaway.id)) continue;

    const endsAt = new Date(giveaway.ends_at);
    const timeUntilEnd = endsAt.getTime() - now.getTime();

    // Only schedule if the giveaway hasn't already ended
    if (timeUntilEnd > 0) {
      const timer = setTimeout(async () => {
        giveawayTimers.delete(giveaway.id);
        await endGiveaway(client, giveaway.id);
      }, timeUntilEnd);

      giveawayTimers.set(giveaway.id, timer);
      console.log(`[Giveaway] Scheduled timer for giveaway #${giveaway.id} (ends in ${Math.round(timeUntilEnd / 1000)}s)`);
    } else {
      // Giveaway should have ended but didn't - end it immediately
      console.log(`[Giveaway] Giveaway #${giveaway.id} should have ended, ending now...`);
      endGiveaway(client, giveaway.id).catch(error => {
        console.error(`[Giveaway] Error ending overdue giveaway #${giveaway.id}:`, error);
      });
    }
  }
}
