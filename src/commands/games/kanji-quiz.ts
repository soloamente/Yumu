import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { errorEmbed } from '../../utils/embed-builder.js';
import { gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';
import { validateGameChannel } from '../../utils/game-channel-validator.js';

// Sample kanji data for the quiz
const kanjiData = [
  { kanji: '日', readings: ['にち', 'ひ', 'び'], meanings: ['giorno', 'sole'], jlpt: 5 },
  { kanji: '月', readings: ['げつ', 'つき'], meanings: ['luna', 'mese'], jlpt: 5 },
  { kanji: '火', readings: ['か', 'ひ'], meanings: ['fuoco'], jlpt: 5 },
  { kanji: '水', readings: ['すい', 'みず'], meanings: ['acqua'], jlpt: 5 },
  { kanji: '木', readings: ['もく', 'き'], meanings: ['albero', 'legno'], jlpt: 5 },
  { kanji: '金', readings: ['きん', 'かね'], meanings: ['oro', 'denaro'], jlpt: 5 },
  { kanji: '土', readings: ['ど', 'つち'], meanings: ['terra', 'suolo'], jlpt: 5 },
  { kanji: '山', readings: ['さん', 'やま'], meanings: ['montagna'], jlpt: 5 },
  { kanji: '川', readings: ['せん', 'かわ'], meanings: ['fiume'], jlpt: 5 },
  { kanji: '田', readings: ['でん', 'た'], meanings: ['risaia', 'campo'], jlpt: 5 },
  { kanji: '人', readings: ['じん', 'にん', 'ひと'], meanings: ['persona'], jlpt: 5 },
  { kanji: '口', readings: ['こう', 'くち'], meanings: ['bocca'], jlpt: 5 },
  { kanji: '目', readings: ['もく', 'め'], meanings: ['occhio'], jlpt: 5 },
  { kanji: '耳', readings: ['じ', 'みみ'], meanings: ['orecchio'], jlpt: 5 },
  { kanji: '手', readings: ['しゅ', 'て'], meanings: ['mano'], jlpt: 5 },
  { kanji: '足', readings: ['そく', 'あし'], meanings: ['piede', 'gamba'], jlpt: 5 },
  { kanji: '大', readings: ['だい', 'たい', 'おお'], meanings: ['grande'], jlpt: 5 },
  { kanji: '小', readings: ['しょう', 'ちい', 'こ'], meanings: ['piccolo'], jlpt: 5 },
  { kanji: '上', readings: ['じょう', 'うえ', 'あ'], meanings: ['sopra'], jlpt: 5 },
  { kanji: '下', readings: ['か', 'した', 'さ'], meanings: ['sotto'], jlpt: 5 },
  { kanji: '中', readings: ['ちゅう', 'なか'], meanings: ['centro', 'dentro'], jlpt: 5 },
  { kanji: '右', readings: ['う', 'みぎ'], meanings: ['destra'], jlpt: 5 },
  { kanji: '左', readings: ['さ', 'ひだり'], meanings: ['sinistra'], jlpt: 5 },
  { kanji: '男', readings: ['だん', 'なん', 'おとこ'], meanings: ['uomo'], jlpt: 5 },
  { kanji: '女', readings: ['じょ', 'にょ', 'おんな'], meanings: ['donna'], jlpt: 5 },
  { kanji: '子', readings: ['し', 'こ'], meanings: ['bambino', 'figlio'], jlpt: 5 },
  { kanji: '学', readings: ['がく', 'まな'], meanings: ['studio', 'imparare'], jlpt: 5 },
  { kanji: '校', readings: ['こう'], meanings: ['scuola'], jlpt: 5 },
  { kanji: '先', readings: ['せん', 'さき'], meanings: ['prima', 'davanti'], jlpt: 5 },
  { kanji: '生', readings: ['せい', 'しょう', 'い', 'う'], meanings: ['vita', 'nascere'], jlpt: 5 },
  { kanji: '食', readings: ['しょく', 'た'], meanings: ['mangiare', 'cibo'], jlpt: 5 },
  { kanji: '飲', readings: ['いん', 'の'], meanings: ['bere'], jlpt: 5 },
  { kanji: '見', readings: ['けん', 'み'], meanings: ['vedere'], jlpt: 5 },
  { kanji: '聞', readings: ['ぶん', 'き'], meanings: ['sentire', 'ascoltare'], jlpt: 5 },
  { kanji: '読', readings: ['どく', 'よ'], meanings: ['leggere'], jlpt: 5 },
  { kanji: '書', readings: ['しょ', 'か'], meanings: ['scrivere'], jlpt: 5 },
  { kanji: '話', readings: ['わ', 'はな', 'はなし'], meanings: ['parlare', 'storia'], jlpt: 5 },
  { kanji: '言', readings: ['げん', 'ごん', 'い'], meanings: ['dire', 'parola'], jlpt: 5 },
  { kanji: '行', readings: ['こう', 'ぎょう', 'い', 'ゆ'], meanings: ['andare'], jlpt: 5 },
  { kanji: '来', readings: ['らい', 'く', 'き'], meanings: ['venire'], jlpt: 5 },
  // JLPT N4
  { kanji: '会', readings: ['かい', 'あ'], meanings: ['incontrare', 'riunione'], jlpt: 4 },
  { kanji: '社', readings: ['しゃ'], meanings: ['società', 'azienda'], jlpt: 4 },
  { kanji: '家', readings: ['か', 'け', 'いえ', 'や'], meanings: ['casa', 'famiglia'], jlpt: 4 },
  { kanji: '電', readings: ['でん'], meanings: ['elettricità'], jlpt: 4 },
  { kanji: '車', readings: ['しゃ', 'くるま'], meanings: ['auto', 'veicolo'], jlpt: 4 },
  { kanji: '駅', readings: ['えき'], meanings: ['stazione'], jlpt: 4 },
  { kanji: '道', readings: ['どう', 'みち'], meanings: ['strada', 'via'], jlpt: 4 },
  { kanji: '店', readings: ['てん', 'みせ'], meanings: ['negozio'], jlpt: 4 },
  { kanji: '病', readings: ['びょう', 'へい', 'や'], meanings: ['malattia'], jlpt: 4 },
  { kanji: '院', readings: ['いん'], meanings: ['istituto', 'ospedale'], jlpt: 4 },
];

const kanjiQuiz: Command = {
  data: new SlashCommandBuilder()
    .setName('kanji')
    .setDescription('Quiz sui kanji giapponesi!')
    .addSubcommand(sub =>
      sub
        .setName('quiz')
        .setDescription('Inizia un quiz sui kanji')
        .addStringOption(opt =>
          opt
            .setName('tipo')
            .setDescription('Tipo di quiz')
            .setRequired(false)
            .addChoices(
              { name: 'Lettura (意味 → 読み)', value: 'reading' },
              { name: 'Significato (漢字 → 意味)', value: 'meaning' },
              { name: 'Misto', value: 'mixed' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('livello')
            .setDescription('Livello JLPT (5 = più facile)')
            .setRequired(false)
            .addChoices(
              { name: 'JLPT N5 (Principiante)', value: 5 },
              { name: 'JLPT N4 (Elementare)', value: 4 },
              { name: 'Tutti i livelli', value: 0 }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('domande')
            .setDescription('Numero di domande (1-20)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Informazioni su un kanji specifico')
        .addStringOption(opt =>
          opt
            .setName('kanji')
            .setDescription('Il kanji da cercare')
            .setRequired(true)
        )
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'quiz':
        await startQuiz(interaction);
        break;
      case 'info':
        await showKanjiInfo(interaction);
        break;
    }
  },
};

async function startQuiz(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check channel permissions
  if (!(await validateGameChannel(interaction, 'kanji_quiz'))) {
    return;
  }

  const quizType = interaction.options.getString('tipo') || 'mixed';
  const jlptLevel = interaction.options.getInteger('livello') || 0;
  const questionCount = interaction.options.getInteger('domande') || 5;

  // Filter kanji by JLPT level
  let availableKanji = kanjiData;
  if (jlptLevel > 0) {
    availableKanji = kanjiData.filter(k => k.jlpt === jlptLevel);
  }

  if (availableKanji.length < 4) {
    await interaction.reply({
      embeds: [errorEmbed('Errore', 'Non ci sono abbastanza kanji per questo livello.')],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  let correctAnswers = 0;
  const totalQuestions = Math.min(questionCount, availableKanji.length);

  // Shuffle and pick kanji for quiz
  const shuffled = [...availableKanji].sort(() => Math.random() - 0.5);
  const quizKanji = shuffled.slice(0, totalQuestions);

  for (let i = 0; i < quizKanji.length; i++) {
    const currentKanji = quizKanji[i];
    const isReadingQuestion = quizType === 'reading' || (quizType === 'mixed' && Math.random() > 0.5);

    // Generate question
    const question = isReadingQuestion
      ? `Come si legge **${currentKanji.kanji}**?`
      : `Cosa significa **${currentKanji.kanji}**?`;

    const correctAnswer = isReadingQuestion
      ? currentKanji.readings[0]
      : currentKanji.meanings[0];

    // Generate wrong answers
    const wrongAnswers = generateWrongAnswers(
      availableKanji,
      currentKanji,
      isReadingQuestion,
      3
    );

    // Shuffle options
    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);
    const correctIndex = allOptions.indexOf(correctAnswer);

    // Create buttons
    const buttons = allOptions.map((opt, idx) =>
      new ButtonBuilder()
        .setCustomId(`kanji_${idx}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📝 Kanji Quiz - Domanda ${i + 1}/${totalQuestions}`)
      .setDescription(`## ${currentKanji.kanji}\n\n${question}`)
      .addFields({
        name: '🏷️ Livello',
        value: `JLPT N${currentKanji.jlpt}`,
        inline: true,
      })
      .setFooter({ text: `Hai 15 secondi per rispondere! • Punteggio: ${correctAnswers}/${i}` });

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Wait for answer
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
          `## ${currentKanji.kanji}\n\n` +
          (isCorrect ? '✅ **Corretto!**' : `❌ **Sbagliato!** La risposta era: ${correctAnswer}`) +
          `\n\n📖 Letture: ${currentKanji.readings.join(', ')}\n` +
          `📝 Significati: ${currentKanji.meanings.join(', ')}`
        );

      await response.update({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      // Wait a bit before next question
      if (i < quizKanji.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      // Timeout
      const timeoutEmbed = EmbedBuilder.from(embed)
        .setColor(config.colors.warning)
        .setDescription(
          `## ${currentKanji.kanji}\n\n` +
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

      if (i < quizKanji.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Show final results
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  let grade = '';
  let emoji = '';

  if (percentage >= 90) { grade = 'Eccellente!'; emoji = '🏆'; }
  else if (percentage >= 70) { grade = 'Ottimo!'; emoji = '🌟'; }
  else if (percentage >= 50) { grade = 'Buono!'; emoji = '👍'; }
  else if (percentage >= 30) { grade = 'Da migliorare'; emoji = '📚'; }
  else { grade = 'Continua a studiare!'; emoji = '💪'; }

  // Update stats
  gameStatsSchema.update(
    interaction.user.id,
    'kanji_quiz',
    percentage >= 70,
    correctAnswers
  );

  const { addCelebrationGif } = await import('../../utils/embed-builder.js');
  
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
    .setFooter({ text: '頑張りました! (Hai lavorato duro!)' })
    .setTimestamp();

  // Add celebration GIF for good scores
  if (percentage >= 70) {
    await addCelebrationGif(finalEmbed);
  }

  await interaction.editReply({
    embeds: [finalEmbed],
    components: [],
  });
}

function generateWrongAnswers(
  kanjiList: typeof kanjiData,
  correctKanji: typeof kanjiData[0],
  isReading: boolean,
  count: number
): string[] {
  const wrong: string[] = [];
  const used = new Set<string>();
  
  // Add correct answer to used set
  if (isReading) {
    correctKanji.readings.forEach(r => used.add(r));
  } else {
    correctKanji.meanings.forEach(m => used.add(m));
  }

  // Get wrong answers from other kanji
  const shuffled = [...kanjiList].sort(() => Math.random() - 0.5);
  
  for (const kanji of shuffled) {
    if (kanji === correctKanji) continue;
    
    const answer = isReading ? kanji.readings[0] : kanji.meanings[0];
    
    if (!used.has(answer)) {
      wrong.push(answer);
      used.add(answer);
      
      if (wrong.length >= count) break;
    }
  }

  return wrong;
}

async function showKanjiInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const kanjiChar = interaction.options.getString('kanji', true);

  const kanji = kanjiData.find(k => k.kanji === kanjiChar);

  if (!kanji) {
    await interaction.reply({
      embeds: [errorEmbed('Non trovato', `Il kanji "${kanjiChar}" non è nel database. Prova con un altro kanji.`)],
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle(`📖 ${kanji.kanji}`)
    .addFields(
      {
        name: '📝 Letture',
        value: kanji.readings.join(', '),
        inline: true,
      },
      {
        name: '📚 Significati',
        value: kanji.meanings.join(', '),
        inline: true,
      },
      {
        name: '🏷️ Livello JLPT',
        value: `N${kanji.jlpt}`,
        inline: true,
      }
    )
    .setFooter({ text: 'Usa /kanji quiz per metterti alla prova!' });

  await interaction.reply({ embeds: [embed] });
}

export default kanjiQuiz;
