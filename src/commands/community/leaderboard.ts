import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from 'discord.js';
import type { Command, User } from '../../types/index.js';
import { config } from '../../config.js';
import { userSchema, gameStatsSchema } from '../../database/schema.js';
import { 
  getLeaderboard, 
  getUserRank, 
  getLevelProgress, 
  generateProgressBar,
  xpToNextLevel 
} from '../../services/level-service.js';
import { registerSelectMenuHandler } from '../../utils/component-handler.js';

const leaderboard: Command = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Visualizza classifiche e statistiche')
    .addSubcommand(sub =>
      sub
        .setName('xp')
        .setDescription('Classifica per XP totali')
    )
    .addSubcommand(sub =>
      sub
        .setName('games')
        .setDescription('Classifica per partite vinte')
        .addStringOption(opt =>
          opt
            .setName('gioco')
            .setDescription('Tipo di gioco')
            .setRequired(false)
            .addChoices(
              { name: 'Shiritori', value: 'shiritori' },
              { name: 'Kanji Quiz', value: 'kanji_quiz' },
              { name: 'Vocab Quiz', value: 'vocab_quiz' },
              { name: 'Number Game', value: 'number_game' },
              { name: 'Word Bomb', value: 'word_bomb' },
              { name: 'Typing Game', value: 'typing_game' },
              { name: 'Story Game', value: 'story_game' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('profile')
        .setDescription('Visualizza il tuo profilo o quello di un utente')
        .addUserOption(opt =>
          opt
            .setName('utente')
            .setDescription('Utente da visualizzare')
            .setRequired(false)
        )
    ),
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'xp':
        await showXpLeaderboard(interaction);
        break;
      case 'games':
        await showGamesLeaderboard(interaction);
        break;
      case 'profile':
        await showProfile(interaction);
        break;
    }
  },
};

async function showXpLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const topUsers = getLeaderboard(10);

  if (topUsers.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🏆 Classifica XP')
        .setDescription('Nessun utente in classifica ancora.')
      ],
    });
    return;
  }

  const leaderboardEntries = await Promise.all(
    topUsers.map(async (user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      
      // Try to fetch user from Discord
      let displayName = user.username;
      try {
        const discordUser = await interaction.client.users.fetch(user.id);
        displayName = discordUser.username;
      } catch {
        // Use stored username
      }

      return `${medal} **${displayName}**\n` +
        `└ Livello ${user.level} • ${user.xp.toLocaleString()} XP`;
    })
  );

  // Get requesting user's rank
  const userRank = getUserRank(interaction.user.id);
  const userData = userSchema.getOrCreate(interaction.user.id, interaction.user.username);

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle('🏆 Classifica XP - Top 10')
    .setDescription(leaderboardEntries.join('\n\n'))
    .setFooter({ 
      text: `La tua posizione: #${userRank} • Livello ${userData.level} • ${userData.xp.toLocaleString()} XP` 
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function showGamesLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  const gameType = interaction.options.getString('gioco') || 'all';
  
  await interaction.deferReply();

  // Get all game stats and aggregate by user
  const gameNames: Record<string, string> = {
    all: 'Tutti i Giochi',
    shiritori: 'Shiritori',
    kanji_quiz: 'Kanji Quiz',
    vocab_quiz: 'Vocab Quiz',
    number_game: 'Number Game',
    word_bomb: 'Word Bomb',
    typing_game: 'Typing Game',
    story_game: 'Story Game',
  };

  // Get all users with game stats
  const allUsers = userSchema.getAll();
  const usersWithStats = allUsers
    .map((user: User) => {
      const stats = gameStatsSchema.getAllForUser(user.id);
      const relevantStats = gameType === 'all'
        ? stats
        : stats.filter(s => s.game_type === gameType);

      const totalWins = relevantStats.reduce((sum, s) => sum + s.games_won, 0);
      const totalPlayed = relevantStats.reduce((sum, s) => sum + s.games_played, 0);

      return {
        ...user,
        totalWins,
        totalPlayed,
      };
    })
    .filter((u: { totalPlayed: number }) => u.totalPlayed > 0)
    .sort((a: { totalWins: number }, b: { totalWins: number }) => b.totalWins - a.totalWins)
    .slice(0, 10);

  if (usersWithStats.length === 0) {
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.info)
        .setTitle('🎮 Classifica Giochi')
        .setDescription('Nessuna partita giocata ancora.')
      ],
    });
    return;
  }

  const title = `🎮 Classifica - ${gameNames[gameType] || gameType}`;

  const leaderboardEntries = await Promise.all(
    usersWithStats.map(async (user: User & { totalWins: number; totalPlayed: number }, index: number) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      
      let displayName = user.username;
      try {
        const discordUser = await interaction.client.users.fetch(user.id);
        displayName = discordUser.username;
      } catch {
        // Use stored username
      }

      const winRate = user.totalPlayed > 0 
        ? Math.round((user.totalWins / user.totalPlayed) * 100) 
        : 0;

      return `${medal} **${displayName}**\n` +
        `└ ${user.totalWins} vittorie / ${user.totalPlayed} partite (${winRate}%)`;
    })
  );

  // Create select menu for game type selection
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`leaderboard_game_${interaction.user.id}`)
    .setPlaceholder('Seleziona un gioco...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Tutti i Giochi')
        .setValue('all')
        .setEmoji('🎮')
        .setDefault(gameType === 'all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Shiritori')
        .setValue('shiritori')
        .setEmoji('🎌')
        .setDefault(gameType === 'shiritori'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Kanji Quiz')
        .setValue('kanji_quiz')
        .setEmoji('📝')
        .setDefault(gameType === 'kanji_quiz'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Vocab Quiz')
        .setValue('vocab_quiz')
        .setEmoji('📚')
        .setDefault(gameType === 'vocab_quiz'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Number Game')
        .setValue('number_game')
        .setEmoji('🔢')
        .setDefault(gameType === 'number_game'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Word Bomb')
        .setValue('word_bomb')
        .setEmoji('💣')
        .setDefault(gameType === 'word_bomb'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Typing Game')
        .setValue('typing_game')
        .setEmoji('⌨️')
        .setDefault(gameType === 'typing_game'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Story Game')
        .setValue('story_game')
        .setEmoji('📖')
        .setDefault(gameType === 'story_game')
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(title)
    .setDescription(leaderboardEntries.join('\n\n'))
    .setFooter({ text: 'Usa il menu per filtrare per gioco' })
    .setTimestamp();

  const message = await interaction.editReply({ 
    embeds: [embed],
    components: [row],
  });

  // Register handler for this specific interaction
  const handlerId = `leaderboard_game_${interaction.user.id}`;
  registerSelectMenuHandler(handlerId, async (selectInteraction) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può cambiare il filtro.',
        ephemeral: true,
      });
      return;
    }

    if (!selectInteraction.isStringSelectMenu()) {
      return;
    }
    const selectedGame = selectInteraction.values[0];
    await showGamesLeaderboardWithType(selectInteraction, selectedGame, message.id);
  });

  // Set up collector to clean up handler after timeout
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000, // 5 minutes
  });

  collector.on('end', () => {
    // Handler will remain but won't be called after timeout
  });
}

/**
 * Helper function to show games leaderboard with a specific game type
 */
async function showGamesLeaderboardWithType(
  interaction: StringSelectMenuInteraction,
  gameType: string,
  _originalMessageId: string
): Promise<void> {
  const gameNames: Record<string, string> = {
    all: 'Tutti i Giochi',
    shiritori: 'Shiritori',
    kanji_quiz: 'Kanji Quiz',
    vocab_quiz: 'Vocab Quiz',
    number_game: 'Number Game',
    word_bomb: 'Word Bomb',
    typing_game: 'Typing Game',
    story_game: 'Story Game',
  };

  // Get all users with game stats
  const allUsers = userSchema.getAll();
  const usersWithStats = allUsers
    .map((user: User) => {
      const stats = gameStatsSchema.getAllForUser(user.id);
      const relevantStats = gameType === 'all'
        ? stats
        : stats.filter(s => s.game_type === gameType);

      const totalWins = relevantStats.reduce((sum, s) => sum + s.games_won, 0);
      const totalPlayed = relevantStats.reduce((sum, s) => sum + s.games_played, 0);

      return {
        ...user,
        totalWins,
        totalPlayed,
      };
    })
    .filter((u: { totalPlayed: number }) => u.totalPlayed > 0)
    .sort((a: { totalWins: number }, b: { totalWins: number }) => b.totalWins - a.totalWins)
    .slice(0, 10);

  const title = `🎮 Classifica - ${gameNames[gameType] || gameType}`;

  const leaderboardEntries = await Promise.all(
    usersWithStats.map(async (user: User & { totalWins: number; totalPlayed: number }, index: number) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**${index + 1}.**`;
      
      let displayName = user.username;
      try {
        const discordUser = await interaction.client.users.fetch(user.id);
        displayName = discordUser.username;
      } catch {
        // Use stored username
      }

      const winRate = user.totalPlayed > 0 
        ? Math.round((user.totalWins / user.totalPlayed) * 100) 
        : 0;

      return `${medal} **${displayName}**\n` +
        `└ ${user.totalWins} vittorie / ${user.totalPlayed} partite (${winRate}%)`;
    })
  );

  // Create select menu for game type selection
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`leaderboard_game_${interaction.user.id}`)
    .setPlaceholder('Seleziona un gioco...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Tutti i Giochi')
        .setValue('all')
        .setEmoji('🎮')
        .setDefault(gameType === 'all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Shiritori')
        .setValue('shiritori')
        .setEmoji('🎌')
        .setDefault(gameType === 'shiritori'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Kanji Quiz')
        .setValue('kanji_quiz')
        .setEmoji('📝')
        .setDefault(gameType === 'kanji_quiz'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Vocab Quiz')
        .setValue('vocab_quiz')
        .setEmoji('📚')
        .setDefault(gameType === 'vocab_quiz'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Number Game')
        .setValue('number_game')
        .setEmoji('🔢')
        .setDefault(gameType === 'number_game'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Word Bomb')
        .setValue('word_bomb')
        .setEmoji('💣')
        .setDefault(gameType === 'word_bomb'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Typing Game')
        .setValue('typing_game')
        .setEmoji('⌨️')
        .setDefault(gameType === 'typing_game'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Story Game')
        .setValue('story_game')
        .setEmoji('📖')
        .setDefault(gameType === 'story_game')
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(title)
    .setDescription(leaderboardEntries.length > 0 
      ? leaderboardEntries.join('\n\n')
      : 'Nessuna partita giocata per questo gioco.'
    )
    .setFooter({ text: 'Usa il menu per filtrare per gioco' })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [row] });
}

async function showProfile(interaction: ChatInputCommandInteraction): Promise<void> {
  const targetUser = interaction.options.getUser('utente') || interaction.user;

  await interaction.deferReply();

  const userData = userSchema.getOrCreate(targetUser.id, targetUser.username);
  const gameStats = gameStatsSchema.getAllForUser(targetUser.id);
  const rank = getUserRank(targetUser.id);

  // Calculate stats
  const totalGamesPlayed = gameStats.reduce((sum, s) => sum + s.games_played, 0);
  const totalWins = gameStats.reduce((sum, s) => sum + s.games_won, 0);
  const totalCorrect = gameStats.reduce((sum, s) => sum + s.correct_answers, 0);
  const winRate = totalGamesPlayed > 0 ? Math.round((totalWins / totalGamesPlayed) * 100) : 0;

  // Level progress
  const progress = getLevelProgress(userData.xp);
  const progressBar = generateProgressBar(progress, 10);
  const xpNeeded = xpToNextLevel(userData.xp);

  // Game breakdown
  const gameBreakdown = gameStats
    .filter(s => s.games_played > 0)
    .map(s => {
      const gameNames: Record<string, string> = {
        shiritori: '🎌 Shiritori',
        kanji_quiz: '📝 Kanji Quiz',
        vocab_quiz: '📚 Vocab Quiz',
        number_game: '🔢 Numeri',
        word_bomb: '💣 Word Bomb',
        typing_game: '⌨️ Typing',
        story_game: '📖 Story',
      };
      const name = gameNames[s.game_type] || s.game_type;
      return `${name}: ${s.games_won}/${s.games_played} vittorie`;
    })
    .join('\n') || 'Nessuna partita giocata';

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📊 Profilo di ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: '🏅 Livello',
        value: `**${userData.level}**`,
        inline: true,
      },
      {
        name: '⭐ XP Totali',
        value: `**${userData.xp.toLocaleString()}**`,
        inline: true,
      },
      {
        name: '🏆 Classifica',
        value: `**#${rank}**`,
        inline: true,
      },
      {
        name: '📈 Progresso Livello',
        value: `${progressBar}\n${Math.round(progress)}% • ${xpNeeded.toLocaleString()} XP al prossimo livello`,
      },
      {
        name: '🎮 Statistiche Giochi',
        value: 
          `Partite: **${totalGamesPlayed}**\n` +
          `Vittorie: **${totalWins}** (${winRate}%)\n` +
          `Risposte corrette: **${totalCorrect}**`,
        inline: true,
      },
      {
        name: '🔥 Streak Studio',
        value: `**${userData.study_streak}** giorni`,
        inline: true,
      },
      {
        name: '🎯 Dettaglio Giochi',
        value: gameBreakdown,
      }
    )
    .setFooter({ 
      text: `Membro da ${new Date(userData.created_at).toLocaleDateString('it-IT')}` 
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export default leaderboard;
