import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { errorEmbed, successEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { createGiveaway, endGiveaway, rerollGiveaway } from '../../services/giveaway-service.js';
import { giveawaySchema } from '../../database/schema.js';
import { registerButtonHandler, registerModalHandler } from '../../utils/component-handler.js';

const giveaway: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Gestisci giveaway nel server')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Inizia un nuovo giveaway')
        .addStringOption(opt =>
          opt
            .setName('premio')
            .setDescription('Cosa si può vincere')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt
            .setName('durata')
            .setDescription('Durata (es: 1h, 30m, 1d, 1w)')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('vincitori')
            .setDescription('Numero di vincitori')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale dove creare il giveaway')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('Termina un giveaway anticipatamente')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('ID del giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reroll')
        .setDescription('Ripesca i vincitori di un giveaway')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('ID del giveaway')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Mostra i giveaway attivi')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // Check permissions
    if (subcommand !== 'list') {
      const hasPermission = await checkAdminPermission(interaction);
      if (!hasPermission) return;
    }

    switch (subcommand) {
      case 'start':
        await startGiveaway(interaction);
        break;
      case 'end':
        await endGiveawayCommand(interaction);
        break;
      case 'reroll':
        await rerollGiveawayCommand(interaction);
        break;
      case 'list':
        await listGiveaways(interaction);
        break;
    }
  },
};

function parseDuration(duration: string): number | null {
  const match = duration.match(/^(\d+)([mhdw])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    m: 60 * 1000, // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000, // days
    w: 7 * 24 * 60 * 60 * 1000, // weeks
  };

  return value * multipliers[unit];
}

async function startGiveaway(interaction: ChatInputCommandInteraction): Promise<void> {
  const prize = interaction.options.getString('premio');
  const durationStr = interaction.options.getString('durata');
  const winnersCount = interaction.options.getInteger('vincitori') || 1;
  const targetChannel = interaction.options.getChannel('canale') || interaction.channel;

  // If all required fields are provided via command, proceed directly
  if (prize && durationStr) {
    await createGiveawayDirectly(interaction, prize, durationStr, winnersCount, targetChannel);
    return;
  }

  // Otherwise, show a modal or button to create via form
  await interaction.deferReply({ ephemeral: true });

  // Create a button to open the modal
  const button = new ButtonBuilder()
    .setCustomId(`giveaway_create_modal_${interaction.user.id}`)
    .setLabel('📝 Crea con Modulo')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('🎉 Crea Giveaway')
      .setDescription(
        'Puoi creare il giveaway in due modi:\n\n' +
        '1. **Usa il bottone qui sotto** per aprire un modulo interattivo\n' +
        '2. **Oppure usa i parametri del comando** direttamente\n\n' +
        '**Esempio:** `/giveaway start premio:Nitendo Switch durata:1d vincitori:1`'
      )
    ],
    components: [row],
  });

  // Register handler for the button
  registerButtonHandler(`giveaway_create_modal_${interaction.user.id}`, async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può creare il giveaway.',
        ephemeral: true,
      });
      return;
    }

    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`giveaway_modal_${interaction.user.id}`)
      .setTitle('Crea Giveaway');

    const prizeInput = new TextInputBuilder()
      .setCustomId('prize')
      .setLabel('Premio')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Es: Nitendo Switch, 1000 XP, etc.')
      .setRequired(true)
      .setMaxLength(100);

    const durationInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel('Durata (30m, 1h, 1d, 1w)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Es: 1d per 1 giorno')
      .setRequired(true)
      .setMaxLength(10);

    const winnersInput = new TextInputBuilder()
      .setCustomId('winners')
      .setLabel('Numero di Vincitori (1-10)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1')
      .setRequired(false)
      .setMaxLength(2);

    const prizeRow = new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput);
    const durationRow = new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput);
    const winnersRow = new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput);

    modal.addComponents(prizeRow, durationRow, winnersRow);

    if (buttonInteraction.isButton()) {
      await buttonInteraction.showModal(modal);
    }
  });

  // Register modal handler
  registerModalHandler(`giveaway_modal_${interaction.user.id}`, async (modalInteraction) => {
    if (!modalInteraction.isModalSubmit()) {
      return;
    }

    if (modalInteraction.user.id !== interaction.user.id) {
      await modalInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può creare il giveaway.',
        ephemeral: true,
      });
      return;
    }

    const prize = modalInteraction.fields.getTextInputValue('prize');
    const durationStr = modalInteraction.fields.getTextInputValue('duration');
    const winnersStr = modalInteraction.fields.getTextInputValue('winners');
    const winnersCount = winnersStr ? parseInt(winnersStr, 10) || 1 : 1;

    if (winnersCount < 1 || winnersCount > 10) {
      await modalInteraction.reply({
        embeds: [errorEmbed('Errore', 'Il numero di vincitori deve essere tra 1 e 10.')],
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });

    await createGiveawayDirectly(
      modalInteraction as unknown as ChatInputCommandInteraction,
      prize,
      durationStr,
      winnersCount,
      targetChannel
    );
  });
}

/**
 * Helper function to create giveaway directly
 */
async function createGiveawayDirectly(
  interaction: ChatInputCommandInteraction | { user: { id: string }; editReply: (options: unknown) => Promise<unknown> },
  prize: string,
  durationStr: string,
  winnersCount: number,
  targetChannel: unknown
): Promise<void> {
  // Parse duration
  const duration = parseDuration(durationStr);
  if (!duration) {
    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [errorEmbed('Durata non valida', 'Usa un formato come: 30m, 1h, 1d, 1w')],
    });
    return;
  }

  // Validate channel
  if (!targetChannel || !(targetChannel instanceof TextChannel)) {
    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [errorEmbed('Canale non valido', 'Seleziona un canale di testo valido.')],
    });
    return;
  }

  try {
    const userId = 'user' in interaction ? interaction.user.id : (interaction as { user: { id: string } }).user.id;
    const giveawayId = await createGiveaway(
      targetChannel as TextChannel,
      prize,
      duration,
      winnersCount,
      userId,
      interaction.client
    );

    const endsAt = new Date(Date.now() + duration);
    const timestamp = Math.floor(endsAt.getTime() / 1000);

    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [successEmbed('Giveaway creato!',
        `**Premio:** ${prize}\n` +
        `**Vincitori:** ${winnersCount}\n` +
        `**Termina:** <t:${timestamp}:R>\n` +
        `**Canale:** ${targetChannel}\n` +
        `**ID:** #${giveawayId}`
      )],
    });
  } catch (error) {
    console.error('[Giveaway] Error creating:', error);
    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [errorEmbed('Errore', 'Non è stato possibile creare il giveaway.')],
    });
  }
}

async function endGiveawayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const giveawayId = interaction.options.getInteger('id', true);

  const giveaway = giveawaySchema.getById(giveawayId);
  if (!giveaway) {
    await interaction.reply({
      embeds: [errorEmbed('Non trovato', `Giveaway #${giveawayId} non trovato.`)],
      ephemeral: true,
    });
    return;
  }

  if (giveaway.ended) {
    await interaction.reply({
      embeds: [errorEmbed('Già terminato', 'Questo giveaway è già stato terminato.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const winners = await endGiveaway(interaction.client, giveawayId);

    await interaction.editReply({
      embeds: [successEmbed('Giveaway terminato!',
        `**Premio:** ${giveaway.prize}\n` +
        `**Vincitori:** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'Nessuno'}`
      )],
    });
  } catch (error) {
    console.error('[Giveaway] Error ending:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Errore', 'Non è stato possibile terminare il giveaway.')],
    });
  }
}

async function rerollGiveawayCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const giveawayId = interaction.options.getInteger('id', true);

  const giveaway = giveawaySchema.getById(giveawayId);
  if (!giveaway) {
    await interaction.reply({
      embeds: [errorEmbed('Non trovato', `Giveaway #${giveawayId} non trovato.`)],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const winners = await rerollGiveaway(interaction.client, giveawayId);

    await interaction.editReply({
      embeds: [successEmbed('Vincitori ripescati!',
        `**Premio:** ${giveaway.prize}\n` +
        `**Nuovi vincitori:** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'Nessuno'}`
      )],
    });
  } catch (error) {
    console.error('[Giveaway] Error rerolling:', error);
    await interaction.editReply({
      embeds: [errorEmbed('Errore', 'Non è stato possibile ripescare i vincitori.')],
    });
  }
}

async function listGiveaways(interaction: ChatInputCommandInteraction): Promise<void> {
  const activeGiveaways = giveawaySchema.getActive();

  if (activeGiveaways.length === 0) {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎉 Giveaway Attivi')
        .setDescription('Non ci sono giveaway attivi al momento.')
      ],
      ephemeral: true,
    });
    return;
  }

  const giveawayList = activeGiveaways.map(g => {
    const timestamp = Math.floor(new Date(g.ends_at).getTime() / 1000);
    const entries = giveawaySchema.getEntries(g.id);
    return `**#${g.id}** - ${g.prize}\n` +
      `├ Vincitori: ${g.winners_count}\n` +
      `├ Partecipanti: ${entries.length}\n` +
      `└ Termina: <t:${timestamp}:R>`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle('🎉 Giveaway Attivi')
    .setDescription(giveawayList)
    .setFooter({ text: `${activeGiveaways.length} giveaway attivi` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default giveaway;
