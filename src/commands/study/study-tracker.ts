import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { successEmbed } from '../../utils/embed-builder.js';
import { userSchema, studySessionSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';
import { registerButtonHandler, registerModalHandler } from '../../utils/component-handler.js';

const studyTracker: Command = {
  data: new SlashCommandBuilder()
    .setName('study')
    .setDescription('Traccia le tue sessioni di studio')
    .addSubcommand(sub =>
      sub
        .setName('log')
        .setDescription('Registra una sessione di studio')
        .addIntegerOption(opt =>
          opt
            .setName('minuti')
            .setDescription('Durata dello studio in minuti')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(480) // Max 8 hours
        )
        .addStringOption(opt =>
          opt
            .setName('note')
            .setDescription('Cosa hai studiato?')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('Visualizza le tue statistiche di studio')
    )
    .addSubcommand(sub =>
      sub
        .setName('streak')
        .setDescription('Visualizza il tuo streak di studio')
    )
    .addSubcommand(sub =>
      sub
        .setName('history')
        .setDescription('Visualizza le ultime sessioni di studio')
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'log':
        await logStudy(interaction);
        break;
      case 'stats':
        await showStats(interaction);
        break;
      case 'streak':
        await showStreak(interaction);
        break;
      case 'history':
        await showHistory(interaction);
        break;
    }
  },
};

async function logStudy(interaction: ChatInputCommandInteraction): Promise<void> {
  const minutes = interaction.options.getInteger('minuti');
  const notes = interaction.options.getString('note');

  // If minutes provided, log directly
  if (minutes) {
    await logStudySession(interaction, minutes, notes);
    return;
  }

  // Otherwise, show button to open modal
  await interaction.deferReply({ ephemeral: true });

  const button = new ButtonBuilder()
    .setCustomId(`study_log_modal_${interaction.user.id}`)
    .setLabel('📝 Registra Sessione')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  await interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle('📚 Registra Sessione di Studio')
      .setDescription(
        'Puoi registrare la sessione in due modi:\n\n' +
        '1. **Usa il bottone qui sotto** per aprire un modulo interattivo\n' +
        '2. **Oppure usa i parametri del comando** direttamente\n\n' +
        '**Esempio:** `/study log minuti:30 note:Kanji N5`'
      )
    ],
    components: [row],
  });

  // Register handler for the button
  registerButtonHandler(`study_log_modal_${interaction.user.id}`, async (buttonInteraction) => {
    if (buttonInteraction.user.id !== interaction.user.id) {
      await buttonInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può registrare la sessione.',
        ephemeral: true,
      });
      return;
    }

    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`study_modal_${interaction.user.id}`)
      .setTitle('Registra Sessione di Studio');

    const minutesInput = new TextInputBuilder()
      .setCustomId('minutes')
      .setLabel('Durata (minuti)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Es: 30')
      .setRequired(true)
      .setMaxLength(3);

    const notesInput = new TextInputBuilder()
      .setCustomId('notes')
      .setLabel('Cosa hai studiato? (opzionale)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Es: Kanji N5, Vocabolario, Grammatica...')
      .setRequired(false)
      .setMaxLength(500);

    const minutesRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minutesInput);
    const notesRow = new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput);

    modal.addComponents(minutesRow, notesRow);

    if (buttonInteraction.isButton()) {
      await buttonInteraction.showModal(modal);
    }
  });

  // Register modal handler
  registerModalHandler(`study_modal_${interaction.user.id}`, async (modalInteraction) => {
    if (!modalInteraction.isModalSubmit()) {
      return;
    }

    if (modalInteraction.user.id !== interaction.user.id) {
      await modalInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può registrare la sessione.',
        ephemeral: true,
      });
      return;
    }

    const minutesStr = modalInteraction.fields.getTextInputValue('minutes');
    const minutes = parseInt(minutesStr, 10);
    const notes = modalInteraction.fields.getTextInputValue('notes') || undefined;

    if (isNaN(minutes) || minutes < 1 || minutes > 480) {
      await modalInteraction.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.error)
          .setTitle('❌ Errore')
          .setDescription('La durata deve essere un numero tra 1 e 480 minuti.')
        ],
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });
    await logStudySession(modalInteraction as unknown as ChatInputCommandInteraction, minutes, notes);
  });
}

/**
 * Helper function to log a study session
 */
async function logStudySession(
  interaction: ChatInputCommandInteraction | { editReply: (options: unknown) => Promise<unknown> },
  minutes: number,
  notes?: string | null
): Promise<void> {
  const userId = 'user' in interaction ? interaction.user.id : (interaction as ChatInputCommandInteraction).user.id;
  const username = 'user' in interaction ? interaction.user.username : (interaction as ChatInputCommandInteraction).user.username;

  // Log the session
  studySessionSchema.create(userId, minutes, notes || null);

  // Update streak
  userSchema.updateStreak(userId);

  // Award XP (1 XP per minute of study)
  const xpEarned = Math.min(minutes, 120); // Cap at 120 XP per session
  awardXp(userId, username, xpEarned);

  // Get updated stats
  const user = userSchema.getOrCreate(userId, username);
  const totalTime = studySessionSchema.getTotalTime(userId);
  const weeklyTime = studySessionSchema.getWeeklyTime(userId);

  const embed = successEmbed('Sessione di studio registrata! 📚',
    `**Durata:** ${minutes} minuti\n` +
    (notes ? `**Note:** ${notes}\n` : '') +
    `\n` +
    `**XP guadagnati:** +${xpEarned} XP\n` +
    `**Streak attuale:** ${user.study_streak} giorni 🔥\n` +
    `\n` +
    `📊 **Statistiche:**\n` +
    `• Questa settimana: ${weeklyTime} minuti\n` +
    `• Totale: ${totalTime} minuti`
  );

  // Add motivational message based on streak
  if (user.study_streak >= 7) {
    embed.setFooter({ text: '🌟 Una settimana di studio! 素晴らしい!' });
  } else if (user.study_streak >= 3) {
    embed.setFooter({ text: '🔥 Continua così! 頑張って!' });
  } else {
    embed.setFooter({ text: '📖 Ogni giorno conta! ファイト!' });
  }

  await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
}

async function showStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const totalTime = studySessionSchema.getTotalTime(interaction.user.id);
  const weeklyTime = studySessionSchema.getWeeklyTime(interaction.user.id);
  const sessions = studySessionSchema.getForUser(interaction.user.id, 30);
  const user = userSchema.getOrCreate(interaction.user.id, interaction.user.username);

  // Calculate averages
  const avgSessionTime = sessions.length > 0 
    ? Math.round(sessions.reduce((sum, s) => sum + s.duration_minutes, 0) / sessions.length)
    : 0;

  const hours = Math.floor(totalTime / 60);
  const mins = totalTime % 60;

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📊 Statistiche di Studio - ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      {
        name: '⏱️ Tempo Totale',
        value: `${hours}h ${mins}m`,
        inline: true,
      },
      {
        name: '📅 Questa Settimana',
        value: `${weeklyTime} minuti`,
        inline: true,
      },
      {
        name: '🔥 Streak',
        value: `${user.study_streak} giorni`,
        inline: true,
      },
      {
        name: '📚 Sessioni Totali',
        value: `${sessions.length}`,
        inline: true,
      },
      {
        name: '📈 Media per Sessione',
        value: `${avgSessionTime} minuti`,
        inline: true,
      },
      {
        name: '🏆 Livello',
        value: `${user.level}`,
        inline: true,
      }
    )
    .setFooter({ text: '継続は力なり - La continuità è forza!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function showStreak(interaction: ChatInputCommandInteraction): Promise<void> {
  const user = userSchema.getOrCreate(interaction.user.id, interaction.user.username);
  const streak = user.study_streak;

  // Create streak visualization
  const maxDisplay = 7;
  const streakDays = Array(maxDisplay).fill('⬜').map((_, i) => 
    i < streak ? '🟩' : '⬜'
  ).join('');

  let message = '';
  let emoji = '';

  if (streak === 0) {
    message = 'Inizia a studiare oggi per costruire il tuo streak!';
    emoji = '📚';
  } else if (streak < 3) {
    message = 'Buon inizio! Continua così!';
    emoji = '🌱';
  } else if (streak < 7) {
    message = 'Stai andando alla grande!';
    emoji = '🔥';
  } else if (streak < 14) {
    message = 'Una settimana di studio! Incredibile!';
    emoji = '⭐';
  } else if (streak < 30) {
    message = 'Sei una macchina da studio!';
    emoji = '💪';
  } else {
    message = 'Sei leggendario! 伝説!';
    emoji = '🏆';
  }

  const embed = new EmbedBuilder()
    .setColor(streak > 0 ? config.colors.success : config.colors.warning)
    .setTitle(`${emoji} Streak di Studio`)
    .setDescription(
      `## ${streak} giorni\n\n` +
      `${streakDays}\n\n` +
      `*${message}*`
    )
    .setFooter({ text: 'Studia ogni giorno per mantenere il tuo streak!' });

  if (streak > 0 && user.last_study_date) {
    embed.addFields({
      name: '📅 Ultimo studio',
      value: new Date(user.last_study_date).toLocaleDateString('it-IT'),
      inline: true,
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function showHistory(interaction: ChatInputCommandInteraction): Promise<void> {
  const sessions = studySessionSchema.getForUser(interaction.user.id, 10);

  if (sessions.length === 0) {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('📚 Storico Studio')
        .setDescription('Non hai ancora registrato nessuna sessione di studio.\n\nUsa `/study log [minuti]` per iniziare!')
      ],
      ephemeral: true,
    });
    return;
  }

  const historyList = sessions.map(s => {
    const date = new Date(s.created_at);
    const dateStr = date.toLocaleDateString('it-IT');
    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `**${dateStr}** ${timeStr} - ${s.duration_minutes} min${s.notes ? `\n└ *${s.notes}*` : ''}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📚 Ultime Sessioni di Studio')
    .setDescription(historyList)
    .setFooter({ text: `Mostrando le ultime ${sessions.length} sessioni` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export default studyTracker;
