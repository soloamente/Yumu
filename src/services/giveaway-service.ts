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
 * Create a new giveaway
 */
export async function createGiveaway(
  channel: TextChannel,
  prize: string,
  duration: number, // in milliseconds
  winnersCount: number,
  hostId: string
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

  console.log(`[Giveaway] Created giveaway #${giveawayId}: ${prize}`);
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
 */
export async function endGiveaway(client: Client, giveawayId: number): Promise<string[]> {
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

  // Update message
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    if (channel && channel.isTextBased()) {
      const message = await (channel as TextChannel).messages.fetch(giveaway.message_id);
      
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

      // Announce winners
      if (winners.length > 0) {
        const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
        await (channel as TextChannel).send({
          content: `🎊 Congratulazioni ${winnerMentions}! Avete vinto **${giveaway.prize}**! 🎉`,
        });
      }
    }
  } catch (error) {
    console.error(`[Giveaway] Error ending giveaway #${giveawayId}:`, error);
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
