import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { errorEmbed } from '../../utils/embed-builder.js';
import { gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';
import { registerSelectMenuHandler } from '../../utils/component-handler.js';

// Sample vocabulary data
const vocabData = [
  // Greetings
  { word: 'おはよう', reading: 'ohayou', meaning: 'buongiorno (informale)', category: 'saluti', jlpt: 5 },
  { word: 'こんにちは', reading: 'konnichiwa', meaning: 'buongiorno/ciao', category: 'saluti', jlpt: 5 },
  { word: 'こんばんは', reading: 'konbanwa', meaning: 'buonasera', category: 'saluti', jlpt: 5 },
  { word: 'さようなら', reading: 'sayounara', meaning: 'arrivederci', category: 'saluti', jlpt: 5 },
  { word: 'ありがとう', reading: 'arigatou', meaning: 'grazie', category: 'saluti', jlpt: 5 },
  { word: 'すみません', reading: 'sumimasen', meaning: 'mi scusi/scusa', category: 'saluti', jlpt: 5 },
  { word: 'ごめんなさい', reading: 'gomen nasai', meaning: 'mi dispiace', category: 'saluti', jlpt: 5 },
  
  // Numbers
  { word: '一', reading: 'ichi', meaning: 'uno', category: 'numeri', jlpt: 5 },
  { word: '二', reading: 'ni', meaning: 'due', category: 'numeri', jlpt: 5 },
  { word: '三', reading: 'san', meaning: 'tre', category: 'numeri', jlpt: 5 },
  { word: '四', reading: 'yon/shi', meaning: 'quattro', category: 'numeri', jlpt: 5 },
  { word: '五', reading: 'go', meaning: 'cinque', category: 'numeri', jlpt: 5 },
  { word: '十', reading: 'juu', meaning: 'dieci', category: 'numeri', jlpt: 5 },
  { word: '百', reading: 'hyaku', meaning: 'cento', category: 'numeri', jlpt: 5 },
  { word: '千', reading: 'sen', meaning: 'mille', category: 'numeri', jlpt: 5 },

  // Family
  { word: '家族', reading: 'kazoku', meaning: 'famiglia', category: 'famiglia', jlpt: 5 },
  { word: '父', reading: 'chichi', meaning: 'padre (proprio)', category: 'famiglia', jlpt: 5 },
  { word: '母', reading: 'haha', meaning: 'madre (propria)', category: 'famiglia', jlpt: 5 },
  { word: '兄', reading: 'ani', meaning: 'fratello maggiore', category: 'famiglia', jlpt: 5 },
  { word: '姉', reading: 'ane', meaning: 'sorella maggiore', category: 'famiglia', jlpt: 5 },
  { word: '弟', reading: 'otouto', meaning: 'fratello minore', category: 'famiglia', jlpt: 5 },
  { word: '妹', reading: 'imouto', meaning: 'sorella minore', category: 'famiglia', jlpt: 5 },

  // Food
  { word: 'ご飯', reading: 'gohan', meaning: 'riso/pasto', category: 'cibo', jlpt: 5 },
  { word: '水', reading: 'mizu', meaning: 'acqua', category: 'cibo', jlpt: 5 },
  { word: 'お茶', reading: 'ocha', meaning: 'tè', category: 'cibo', jlpt: 5 },
  { word: '肉', reading: 'niku', meaning: 'carne', category: 'cibo', jlpt: 5 },
  { word: '魚', reading: 'sakana', meaning: 'pesce', category: 'cibo', jlpt: 5 },
  { word: '野菜', reading: 'yasai', meaning: 'verdura', category: 'cibo', jlpt: 5 },
  { word: '果物', reading: 'kudamono', meaning: 'frutta', category: 'cibo', jlpt: 5 },

  // Verbs
  { word: '食べる', reading: 'taberu', meaning: 'mangiare', category: 'verbi', jlpt: 5 },
  { word: '飲む', reading: 'nomu', meaning: 'bere', category: 'verbi', jlpt: 5 },
  { word: '見る', reading: 'miru', meaning: 'vedere', category: 'verbi', jlpt: 5 },
  { word: '聞く', reading: 'kiku', meaning: 'ascoltare', category: 'verbi', jlpt: 5 },
  { word: '話す', reading: 'hanasu', meaning: 'parlare', category: 'verbi', jlpt: 5 },
  { word: '読む', reading: 'yomu', meaning: 'leggere', category: 'verbi', jlpt: 5 },
  { word: '書く', reading: 'kaku', meaning: 'scrivere', category: 'verbi', jlpt: 5 },
  { word: '行く', reading: 'iku', meaning: 'andare', category: 'verbi', jlpt: 5 },
  { word: '来る', reading: 'kuru', meaning: 'venire', category: 'verbi', jlpt: 5 },
  { word: 'する', reading: 'suru', meaning: 'fare', category: 'verbi', jlpt: 5 },

  // Adjectives
  { word: '大きい', reading: 'ookii', meaning: 'grande', category: 'aggettivi', jlpt: 5 },
  { word: '小さい', reading: 'chiisai', meaning: 'piccolo', category: 'aggettivi', jlpt: 5 },
  { word: '新しい', reading: 'atarashii', meaning: 'nuovo', category: 'aggettivi', jlpt: 5 },
  { word: '古い', reading: 'furui', meaning: 'vecchio', category: 'aggettivi', jlpt: 5 },
  { word: '高い', reading: 'takai', meaning: 'alto/costoso', category: 'aggettivi', jlpt: 5 },
  { word: '安い', reading: 'yasui', meaning: 'economico', category: 'aggettivi', jlpt: 5 },
  { word: '楽しい', reading: 'tanoshii', meaning: 'divertente', category: 'aggettivi', jlpt: 5 },
  { word: '難しい', reading: 'muzukashii', meaning: 'difficile', category: 'aggettivi', jlpt: 5 },
  { word: '簡単', reading: 'kantan', meaning: 'facile', category: 'aggettivi', jlpt: 5 },
  { word: '美味しい', reading: 'oishii', meaning: 'delizioso', category: 'aggettivi', jlpt: 5 },

  // Places
  { word: '学校', reading: 'gakkou', meaning: 'scuola', category: 'luoghi', jlpt: 5 },
  { word: '駅', reading: 'eki', meaning: 'stazione', category: 'luoghi', jlpt: 5 },
  { word: '病院', reading: 'byouin', meaning: 'ospedale', category: 'luoghi', jlpt: 5 },
  { word: '銀行', reading: 'ginkou', meaning: 'banca', category: 'luoghi', jlpt: 5 },
  { word: '郵便局', reading: 'yuubinkyoku', meaning: 'ufficio postale', category: 'luoghi', jlpt: 5 },
  { word: 'コンビニ', reading: 'konbini', meaning: 'minimarket', category: 'luoghi', jlpt: 5 },
  { word: 'レストラン', reading: 'resutoran', meaning: 'ristorante', category: 'luoghi', jlpt: 5 },
];

const vocabQuiz: Command = {
  data: new SlashCommandBuilder()
    .setName('vocab')
    .setDescription('Quiz sul vocabolario giapponese!')
    .addSubcommand(sub =>
      sub
        .setName('quiz')
        .setDescription('Inizia un quiz sul vocabolario')
        .addStringOption(opt =>
          opt
            .setName('direzione')
            .setDescription('Direzione della traduzione')
            .setRequired(false)
            .addChoices(
              { name: 'Giapponese → Italiano', value: 'jp_to_it' },
              { name: 'Italiano → Giapponese', value: 'it_to_jp' },
              { name: 'Misto', value: 'mixed' }
            )
        )
        .addStringOption(opt =>
          opt
            .setName('categoria')
            .setDescription('Categoria di vocaboli')
            .setRequired(false)
            .addChoices(
              { name: 'Saluti', value: 'saluti' },
              { name: 'Numeri', value: 'numeri' },
              { name: 'Famiglia', value: 'famiglia' },
              { name: 'Cibo', value: 'cibo' },
              { name: 'Verbi', value: 'verbi' },
              { name: 'Aggettivi', value: 'aggettivi' },
              { name: 'Luoghi', value: 'luoghi' },
              { name: 'Tutte', value: 'all' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('domande')
            .setDescription('Numero di domande (1-15)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(15)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Mostra vocaboli di una categoria')
        .addStringOption(opt =>
          opt
            .setName('categoria')
            .setDescription('Categoria da visualizzare')
            .setRequired(true)
            .addChoices(
              { name: 'Saluti', value: 'saluti' },
              { name: 'Numeri', value: 'numeri' },
              { name: 'Famiglia', value: 'famiglia' },
              { name: 'Cibo', value: 'cibo' },
              { name: 'Verbi', value: 'verbi' },
              { name: 'Aggettivi', value: 'aggettivi' },
              { name: 'Luoghi', value: 'luoghi' }
            )
        )
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'quiz':
        await startVocabQuiz(interaction);
        break;
      case 'list':
        await showVocabList(interaction);
        break;
    }
  },
};

async function startVocabQuiz(interaction: ChatInputCommandInteraction): Promise<void> {
  const direction = interaction.options.getString('direzione') || 'mixed';
  const category = interaction.options.getString('categoria') || 'all';
  const questionCount = interaction.options.getInteger('domande') || 5;

  // Filter vocab by category
  let availableVocab = vocabData;
  if (category !== 'all') {
    availableVocab = vocabData.filter(v => v.category === category);
  }

  if (availableVocab.length < 4) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Non ci sono abbastanza vocaboli per questa categoria.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  let correctAnswers = 0;
  const totalQuestions = Math.min(questionCount, availableVocab.length);

  // Shuffle and pick vocab for quiz
  const shuffled = [...availableVocab].sort(() => Math.random() - 0.5);
  const quizVocab = shuffled.slice(0, totalQuestions);

  for (let i = 0; i < quizVocab.length; i++) {
    const currentVocab = quizVocab[i];
    const isJpToIt = direction === 'jp_to_it' || (direction === 'mixed' && Math.random() > 0.5);

    // Generate question
    const question = isJpToIt
      ? `Cosa significa **${currentVocab.word}** (${currentVocab.reading})?`
      : `Come si dice "${currentVocab.meaning}" in giapponese?`;

    const correctAnswer = isJpToIt ? currentVocab.meaning : currentVocab.word;

    // Generate wrong answers
    const wrongAnswers = generateWrongVocabAnswers(availableVocab, currentVocab, isJpToIt, 3);

    // Shuffle options
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    const correctIndex = allOptions.indexOf(correctAnswer);

    // Create buttons
    const buttons = allOptions.map((opt, idx) =>
      new ButtonBuilder()
        .setCustomId(`vocab_${idx}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📝 Vocabolario Quiz - Domanda ${i + 1}/${totalQuestions}`)
      .setDescription(question)
      .addFields({
        name: '📁 Categoria',
        value: getCategoryName(currentVocab.category),
        inline: true,
      })
      .setFooter({ text: `Hai 15 secondi! • Punteggio: ${correctAnswers}/${i}` });

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    try {
      const response = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (btn) => btn.user.id === interaction.user.id,
        time: 15000,
      });

      const selectedIndex = parseInt(response.customId.split('_')[1]);
      const isCorrect = selectedIndex === correctIndex;

      if (isCorrect) {
        correctAnswers++;
        awardXp(interaction.user.id, interaction.user.username, config.xp.perQuizCorrect);
      }

      // Show result
      const resultButtons = buttons.map((btn, idx) => {
        const newBtn = ButtonBuilder.from(btn).setDisabled(true);
        if (idx === correctIndex) {
          newBtn.setStyle(ButtonStyle.Success);
        } else if (idx === selectedIndex && !isCorrect) {
          newBtn.setStyle(ButtonStyle.Danger);
        } else {
          newBtn.setStyle(ButtonStyle.Secondary);
        }
        return newBtn;
      });

      const resultRow = new ActionRowBuilder<ButtonBuilder>().addComponents(resultButtons);

      const resultEmbed = EmbedBuilder.from(embed)
        .setColor(isCorrect ? config.colors.success : config.colors.error)
        .setDescription(
          question + '\n\n' +
          (isCorrect ? '✅ **Corretto!**' : `❌ **Sbagliato!** La risposta era: ${correctAnswer}`) +
          `\n\n📖 ${currentVocab.word} (${currentVocab.reading}) = ${currentVocab.meaning}`
        );

      await response.update({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      if (i < quizVocab.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      const timeoutEmbed = EmbedBuilder.from(embed)
        .setColor(config.colors.warning)
        .setDescription(
          question + '\n\n' +
          `⏰ **Tempo scaduto!** La risposta era: ${correctAnswer}`
        );

      const disabledButtons = buttons.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true).setStyle(ButtonStyle.Secondary)
      );
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [disabledRow],
      });

      if (i < quizVocab.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Final results
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  let grade = '';
  let emoji = '';

  if (percentage >= 90) { grade = 'Eccellente!'; emoji = '🏆'; }
  else if (percentage >= 70) { grade = 'Ottimo!'; emoji = '🌟'; }
  else if (percentage >= 50) { grade = 'Buono!'; emoji = '👍'; }
  else if (percentage >= 30) { grade = 'Da migliorare'; emoji = '📚'; }
  else { grade = 'Continua a studiare!'; emoji = '💪'; }

  gameStatsSchema.update(
    interaction.user.id,
    'vocab_quiz',
    percentage >= 70,
    correctAnswers
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(percentage >= 50 ? config.colors.success : config.colors.warning)
    .setTitle(`${emoji} Quiz Completato!`)
    .setDescription(
      `**${grade}**\n\n` +
      `Hai risposto correttamente a **${correctAnswers}/${totalQuestions}** domande (${percentage}%)`
    )
    .addFields({
      name: '📊 XP Guadagnati',
      value: `+${correctAnswers * config.xp.perQuizCorrect} XP`,
      inline: true,
    })
    .setFooter({ text: 'よく頑張りました! (Hai fatto un buon lavoro!)' })
    .setTimestamp();

  await interaction.editReply({
    embeds: [finalEmbed],
    components: [],
  });
}

function generateWrongVocabAnswers(
  vocabList: typeof vocabData,
  correctVocab: typeof vocabData[0],
  isJpToIt: boolean,
  count: number
): string[] {
  const wrong: string[] = [];
  const used = new Set<string>();
  
  used.add(isJpToIt ? correctVocab.meaning : correctVocab.word);

  const shuffled = [...vocabList].sort(() => Math.random() - 0.5);
  
  for (const vocab of shuffled) {
    if (vocab === correctVocab) continue;
    
    const answer = isJpToIt ? vocab.meaning : vocab.word;
    
    if (!used.has(answer)) {
      wrong.push(answer);
      used.add(answer);
      
      if (wrong.length >= count) break;
    }
  }

  return wrong;
}

function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    saluti: '👋 Saluti',
    numeri: '🔢 Numeri',
    famiglia: '👨‍👩‍👧‍👦 Famiglia',
    cibo: '🍱 Cibo',
    verbi: '🏃 Verbi',
    aggettivi: '📝 Aggettivi',
    luoghi: '🏢 Luoghi',
  };
  return names[category] || category;
}

async function showVocabList(interaction: ChatInputCommandInteraction): Promise<void> {
  const category = interaction.options.getString('categoria', true);
  
  await interaction.deferReply();

  const vocabInCategory = vocabData.filter(v => v.category === category);

  const vocabList = vocabInCategory
    .map(v => `**${v.word}** (${v.reading}) - ${v.meaning}`)
    .join('\n');

  // Create select menu for category selection
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`vocab_category_${interaction.user.id}`)
    .setPlaceholder('Seleziona una categoria...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Saluti')
        .setValue('saluti')
        .setEmoji('👋')
        .setDefault(category === 'saluti'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Numeri')
        .setValue('numeri')
        .setEmoji('🔢')
        .setDefault(category === 'numeri'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Famiglia')
        .setValue('famiglia')
        .setEmoji('👨‍👩‍👧‍👦')
        .setDefault(category === 'famiglia'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Cibo')
        .setValue('cibo')
        .setEmoji('🍱')
        .setDefault(category === 'cibo'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Verbi')
        .setValue('verbi')
        .setEmoji('🏃')
        .setDefault(category === 'verbi'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Aggettivi')
        .setValue('aggettivi')
        .setEmoji('📝')
        .setDefault(category === 'aggettivi'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Luoghi')
        .setValue('luoghi')
        .setEmoji('🏢')
        .setDefault(category === 'luoghi')
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`📚 Vocabolario: ${getCategoryName(category)}`)
    .setDescription(vocabList || 'Nessun vocabolo trovato')
    .setFooter({ text: `${vocabInCategory.length} vocaboli • Usa il menu per cambiare categoria` });

  const message = await interaction.editReply({ 
    embeds: [embed],
    components: [row],
  });

  // Register handler for category selection
  const handlerId = `vocab_category_${interaction.user.id}`;
  registerSelectMenuHandler(handlerId, async (selectInteraction) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: '⚠️ Solo chi ha eseguito il comando può cambiare la categoria.',
        ephemeral: true,
      });
      return;
    }

    const selectedCategory = selectInteraction.values[0];
    const vocabInSelectedCategory = vocabData.filter(v => v.category === selectedCategory);

    const vocabListUpdated = vocabInSelectedCategory
      .map(v => `**${v.word}** (${v.reading}) - ${v.meaning}`)
      .join('\n');

    // Update select menu
    const updatedSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`vocab_category_${interaction.user.id}`)
      .setPlaceholder('Seleziona una categoria...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Saluti')
          .setValue('saluti')
          .setEmoji('👋')
          .setDefault(selectedCategory === 'saluti'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Numeri')
          .setValue('numeri')
          .setEmoji('🔢')
          .setDefault(selectedCategory === 'numeri'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Famiglia')
          .setValue('famiglia')
          .setEmoji('👨‍👩‍👧‍👦')
          .setDefault(selectedCategory === 'famiglia'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Cibo')
          .setValue('cibo')
          .setEmoji('🍱')
          .setDefault(selectedCategory === 'cibo'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Verbi')
          .setValue('verbi')
          .setEmoji('🏃')
          .setDefault(selectedCategory === 'verbi'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Aggettivi')
          .setValue('aggettivi')
          .setEmoji('📝')
          .setDefault(selectedCategory === 'aggettivi'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Luoghi')
          .setValue('luoghi')
          .setEmoji('🏢')
          .setDefault(selectedCategory === 'luoghi')
      );

    const updatedRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(updatedSelectMenu);

    const updatedEmbed = new EmbedBuilder()
      .setColor(config.colors.info)
      .setTitle(`📚 Vocabolario: ${getCategoryName(selectedCategory)}`)
      .setDescription(vocabListUpdated || 'Nessun vocabolo trovato')
      .setFooter({ text: `${vocabInSelectedCategory.length} vocaboli • Usa il menu per cambiare categoria` });

    await selectInteraction.update({ 
      embeds: [updatedEmbed],
      components: [updatedRow],
    });
  });

  // Set up collector to clean up after timeout
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 300000, // 5 minutes
  });

  collector.on('end', () => {
    // Handler will remain but won't be called after timeout
  });
}

export default vocabQuiz;
