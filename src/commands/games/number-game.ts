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
import { gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';
import { validateGameChannel } from '../../utils/game-channel-validator.js';

const numberGame: Command = {
  data: new SlashCommandBuilder()
    .setName('numbers')
    .setDescription('Gioca per imparare i numeri giapponesi!')
    .addSubcommand(sub =>
      sub
        .setName('quiz')
        .setDescription('Quiz sui numeri giapponesi')
        .addStringOption(opt =>
          opt
            .setName('difficolta')
            .setDescription('Livello di difficoltà')
            .setRequired(false)
            .addChoices(
              { name: 'Facile (1-10)', value: 'easy' },
              { name: 'Medio (1-100)', value: 'medium' },
              { name: 'Difficile (1-1000)', value: 'hard' },
              { name: 'Esperto (1-10000)', value: 'expert' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('domande')
            .setDescription('Numero di domande (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reference')
        .setDescription('Mostra la tabella dei numeri giapponesi')
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'quiz':
        await startNumberQuiz(interaction);
        break;
      case 'reference':
        await showReference(interaction);
        break;
    }
  },
};

function numberToJapanese(num: number): string {
  if (num === 0) return 'ゼロ';
  if (num <= 10) return getSimpleReading(num);
  
  let result = '';
  
  // Ten thousands (万)
  if (num >= 10000) {
    const man = Math.floor(num / 10000);
    if (man === 1) {
      result += 'いちまん';
    } else {
      result += getSimpleReading(man) + 'まん';
    }
    num %= 10000;
  }
  
  // Thousands (千)
  if (num >= 1000) {
    const sen = Math.floor(num / 1000);
    if (sen === 1) {
      result += 'せん';
    } else if (sen === 3) {
      result += 'さんぜん';
    } else if (sen === 8) {
      result += 'はっせん';
    } else {
      result += getSimpleReading(sen) + 'せん';
    }
    num %= 1000;
  }
  
  // Hundreds (百)
  if (num >= 100) {
    const hyaku = Math.floor(num / 100);
    if (hyaku === 1) {
      result += 'ひゃく';
    } else if (hyaku === 3) {
      result += 'さんびゃく';
    } else if (hyaku === 6) {
      result += 'ろっぴゃく';
    } else if (hyaku === 8) {
      result += 'はっぴゃく';
    } else {
      result += getSimpleReading(hyaku) + 'ひゃく';
    }
    num %= 100;
  }
  
  // Tens (十)
  if (num >= 10) {
    const juu = Math.floor(num / 10);
    if (juu === 1) {
      result += 'じゅう';
    } else {
      result += getSimpleReading(juu) + 'じゅう';
    }
    num %= 10;
  }
  
  // Ones
  if (num > 0) {
    result += getSimpleReading(num);
  }
  
  return result;
}

function getSimpleReading(num: number): string {
  const readings: Record<number, string> = {
    1: 'いち',
    2: 'に',
    3: 'さん',
    4: 'よん',
    5: 'ご',
    6: 'ろく',
    7: 'なな',
    8: 'はち',
    9: 'きゅう',
    10: 'じゅう',
  };
  return readings[num] || '';
}

function getRandomNumber(difficulty: string): number {
  switch (difficulty) {
    case 'easy':
      return Math.floor(Math.random() * 10) + 1;
    case 'medium':
      return Math.floor(Math.random() * 100) + 1;
    case 'hard':
      return Math.floor(Math.random() * 1000) + 1;
    case 'expert':
      return Math.floor(Math.random() * 10000) + 1;
    default:
      return Math.floor(Math.random() * 10) + 1;
  }
}

function generateWrongNumbers(correct: number, difficulty: string, count: number): number[] {
  const wrong: number[] = [];
  const max = difficulty === 'expert' ? 10000 : 
              difficulty === 'hard' ? 1000 : 
              difficulty === 'medium' ? 100 : 10;
  
  while (wrong.length < count) {
    const num = Math.floor(Math.random() * max) + 1;
    if (num !== correct && !wrong.includes(num)) {
      wrong.push(num);
    }
  }
  
  return wrong;
}

async function startNumberQuiz(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check channel permissions
  if (!(await validateGameChannel(interaction, 'number_game'))) {
    return;
  }

  const difficulty = interaction.options.getString('difficolta') || 'easy';
  const questionCount = interaction.options.getInteger('domande') || 5;

  await interaction.deferReply();

  let correctAnswers = 0;

  for (let i = 0; i < questionCount; i++) {
    const correctNumber = getRandomNumber(difficulty);
    const japaneseReading = numberToJapanese(correctNumber);
    
    // Randomly choose question type
    const isJpToNum = Math.random() > 0.5;
    
    let question: string;
    let correctAnswer: string;
    let options: string[];

    if (isJpToNum) {
      // Japanese to number
      question = `Che numero è **${japaneseReading}**?`;
      correctAnswer = String(correctNumber);
      const wrongNumbers = generateWrongNumbers(correctNumber, difficulty, 3);
      options = [correctAnswer, ...wrongNumbers.map(String)].sort(() => Math.random() - 0.5);
    } else {
      // Number to Japanese
      question = `Come si dice **${correctNumber}** in giapponese?`;
      correctAnswer = japaneseReading;
      const wrongNumbers = generateWrongNumbers(correctNumber, difficulty, 3);
      options = [correctAnswer, ...wrongNumbers.map(n => numberToJapanese(n))].sort(() => Math.random() - 0.5);
    }

    const correctIndex = options.indexOf(correctAnswer);

    const buttons = options.map((opt, idx) =>
      new ButtonBuilder()
        .setCustomId(`num_${idx}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const difficultyNames: Record<string, string> = {
      easy: '🟢 Facile',
      medium: '🟡 Medio',
      hard: '🟠 Difficile',
      expert: '🔴 Esperto',
    };

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`🔢 Numeri Quiz - Domanda ${i + 1}/${questionCount}`)
      .setDescription(question)
      .addFields({
        name: 'Difficoltà',
        value: difficultyNames[difficulty],
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
          (isCorrect ? '✅ **Corretto!**' : `❌ **Sbagliato!**`) +
          `\n\n📖 ${correctNumber} = ${japaneseReading}`
        );

      await response.update({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      if (i < questionCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      const timeoutEmbed = EmbedBuilder.from(embed)
        .setColor(config.colors.warning)
        .setDescription(
          question + '\n\n' +
          `⏰ **Tempo scaduto!**\n\n📖 ${correctNumber} = ${japaneseReading}`
        );

      const disabledButtons = buttons.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true).setStyle(ButtonStyle.Secondary)
      );
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [disabledRow],
      });

      if (i < questionCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Final results
  const percentage = Math.round((correctAnswers / questionCount) * 100);
  
  gameStatsSchema.update(
    interaction.user.id,
    'number_game',
    percentage >= 70,
    correctAnswers
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(percentage >= 50 ? config.colors.success : config.colors.warning)
    .setTitle('🔢 Quiz Completato!')
    .setDescription(
      `Hai risposto correttamente a **${correctAnswers}/${questionCount}** domande (${percentage}%)`
    )
    .addFields({
      name: '📊 XP Guadagnati',
      value: `+${correctAnswers * config.xp.perQuizCorrect} XP`,
      inline: true,
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [finalEmbed],
    components: [],
  });
}

async function showReference(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📊 Numeri Giapponesi - Riferimento')
    .addFields(
      {
        name: '🔢 Base (1-10)',
        value: 
          '1 = いち (ichi)\n' +
          '2 = に (ni)\n' +
          '3 = さん (san)\n' +
          '4 = よん/し (yon/shi)\n' +
          '5 = ご (go)\n' +
          '6 = ろく (roku)\n' +
          '7 = なな/しち (nana/shichi)\n' +
          '8 = はち (hachi)\n' +
          '9 = きゅう/く (kyuu/ku)\n' +
          '10 = じゅう (juu)',
        inline: true,
      },
      {
        name: '📈 Decine e oltre',
        value:
          '20 = にじゅう\n' +
          '30 = さんじゅう\n' +
          '100 = ひゃく\n' +
          '300 = さんびゃく\n' +
          '1000 = せん\n' +
          '3000 = さんぜん\n' +
          '10000 = いちまん',
        inline: true,
      },
      {
        name: '💡 Esempi',
        value:
          '11 = じゅういち\n' +
          '25 = にじゅうご\n' +
          '147 = ひゃくよんじゅうなな\n' +
          '1984 = せんきゅうひゃくはちじゅうよん',
      }
    )
    .setFooter({ text: 'Usa /numbers quiz per metterti alla prova!' });

  await interaction.reply({ embeds: [embed] });
}

export default numberGame;
