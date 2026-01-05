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

// Fill-in-the-blank sentences
const storyQuestions = [
  {
    sentence: '私は毎日___を食べます。',
    blank: 'ごはん',
    meaning: 'Ogni giorno mangio ___.',
    hint: 'Cibo tipico giapponese, riso',
    options: ['ごはん', 'みず', 'ほん', 'いぬ'],
    level: 'N5',
  },
  {
    sentence: '___は赤いです。',
    blank: 'りんご',
    meaning: 'La ___ è rossa.',
    hint: 'Un frutto',
    options: ['りんご', 'バナナ', 'ぶどう', 'みかん'],
    level: 'N5',
  },
  {
    sentence: '朝、___を飲みます。',
    blank: 'コーヒー',
    meaning: 'La mattina bevo ___.',
    hint: 'Bevanda calda',
    options: ['コーヒー', 'ジュース', 'ビール', 'みず'],
    level: 'N5',
  },
  {
    sentence: '私の___は先生です。',
    blank: 'ちち',
    meaning: 'Mio ___ è un insegnante.',
    hint: 'Membro della famiglia maschile',
    options: ['ちち', 'はは', 'あに', 'いもうと'],
    level: 'N5',
  },
  {
    sentence: '___に本を読みます。',
    blank: 'よる',
    meaning: 'Di ___ leggo libri.',
    hint: 'Momento della giornata dopo il tramonto',
    options: ['よる', 'あさ', 'ひる', 'ゆうがた'],
    level: 'N5',
  },
  {
    sentence: '電車で___に行きます。',
    blank: 'かいしゃ',
    meaning: 'Vado al ___ in treno.',
    hint: 'Dove si lavora',
    options: ['かいしゃ', 'がっこう', 'えき', 'びょういん'],
    level: 'N4',
  },
  {
    sentence: '日本語は___です。',
    blank: 'むずかしい',
    meaning: 'Il giapponese è ___.',
    hint: 'Non facile',
    options: ['むずかしい', 'かんたん', 'たのしい', 'つまらない'],
    level: 'N5',
  },
  {
    sentence: '___がきれいです。',
    blank: 'さくら',
    meaning: 'I ___ sono belli.',
    hint: 'Fiori giapponesi famosi',
    options: ['さくら', 'ばら', 'ゆき', 'はな'],
    level: 'N5',
  },
  {
    sentence: '友達と___で遊びます。',
    blank: 'こうえん',
    meaning: 'Gioco con gli amici al ___.',
    hint: 'Luogo all\'aperto con alberi',
    options: ['こうえん', 'うち', 'がっこう', 'えいがかん'],
    level: 'N5',
  },
  {
    sentence: '___を聞くのが好きです。',
    blank: 'おんがく',
    meaning: 'Mi piace ascoltare la ___.',
    hint: 'Arte dei suoni',
    options: ['おんがく', 'えいが', 'テレビ', 'ラジオ'],
    level: 'N5',
  },
  {
    sentence: '週末に___を見ます。',
    blank: 'えいが',
    meaning: 'Nel weekend guardo ___.',
    hint: 'Al cinema',
    options: ['えいが', 'テレビ', 'ほん', 'しんぶん'],
    level: 'N5',
  },
  {
    sentence: '___でお金を払います。',
    blank: 'レジ',
    meaning: 'Pago alla ___.',
    hint: 'Dove si paga nei negozi',
    options: ['レジ', 'まど', 'ドア', 'でぐち'],
    level: 'N4',
  },
  {
    sentence: '新しい___を買いました。',
    blank: 'くつ',
    meaning: 'Ho comprato ___ nuove.',
    hint: 'Si indossano ai piedi',
    options: ['くつ', 'シャツ', 'ズボン', 'ぼうし'],
    level: 'N5',
  },
  {
    sentence: '今日は___が暑いです。',
    blank: 'てんき',
    meaning: 'Oggi il ___ è caldo.',
    hint: 'Condizioni atmosferiche',
    options: ['てんき', 'きおん', 'かぜ', 'あめ'],
    level: 'N5',
  },
  {
    sentence: '___に住んでいます。',
    blank: 'とうきょう',
    meaning: 'Vivo a ___.',
    hint: 'Capitale del Giappone',
    options: ['とうきょう', 'おおさか', 'きょうと', 'ふくおか'],
    level: 'N5',
  },
];

const storyGame: Command = {
  data: new SlashCommandBuilder()
    .setName('story')
    .setDescription('Completa le frasi - Riempi gli spazi vuoti!')
    .addSubcommand(sub =>
      sub
        .setName('play')
        .setDescription('Gioca a completare le frasi')
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
        .setName('info')
        .setDescription('Informazioni sul gioco')
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'play':
        await playStoryGame(interaction);
        break;
      case 'info':
        await showInfo(interaction);
        break;
    }
  },
};

async function playStoryGame(interaction: ChatInputCommandInteraction): Promise<void> {
  // Check channel permissions
  if (!(await validateGameChannel(interaction, 'story_game'))) {
    return;
  }

  const questionCount = interaction.options.getInteger('domande') || 5;

  await interaction.deferReply();

  let correctAnswers = 0;
  const totalQuestions = Math.min(questionCount, storyQuestions.length);

  const shuffled = [...storyQuestions].sort(() => Math.random() - 0.5);
  const selectedQuestions = shuffled.slice(0, totalQuestions);

  for (let i = 0; i < selectedQuestions.length; i++) {
    const question = selectedQuestions[i];

    // Shuffle options
    const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(question.blank);

    const buttons = shuffledOptions.map((opt, idx) =>
      new ButtonBuilder()
        .setCustomId(`story_${idx}`)
        .setLabel(opt)
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📝 Completa la frase - ${i + 1}/${totalQuestions}`)
      .setDescription(
        `**Completa la frase:**\n\n` +
        `## ${question.sentence}\n\n` +
        `📖 ${question.meaning}`
      )
      .addFields(
        {
          name: '💡 Suggerimento',
          value: question.hint,
          inline: true,
        },
        {
          name: '🏷️ Livello',
          value: question.level,
          inline: true,
        }
      )
      .setFooter({ text: `Hai 20 secondi! • Punteggio: ${correctAnswers}/${i}` });

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    try {
      const response = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (btn) => btn.user.id === interaction.user.id,
        time: 20000,
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

      const completeSentence = question.sentence.replace('___', `**${question.blank}**`);

      const resultEmbed = EmbedBuilder.from(embed)
        .setColor(isCorrect ? config.colors.success : config.colors.error)
        .setDescription(
          (isCorrect ? '✅ **Corretto!**' : `❌ **Sbagliato!**`) +
          `\n\n**Frase completa:**\n${completeSentence}\n\n` +
          `📖 ${question.meaning.replace('___', question.blank)}`
        );

      await response.update({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      if (i < selectedQuestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    } catch {
      // Timeout
      const completeSentence = question.sentence.replace('___', `**${question.blank}**`);

      const timeoutEmbed = EmbedBuilder.from(embed)
        .setColor(config.colors.warning)
        .setDescription(
          `⏰ **Tempo scaduto!**\n\n` +
          `**Frase completa:**\n${completeSentence}`
        );

      const disabledButtons = buttons.map(btn =>
        ButtonBuilder.from(btn).setDisabled(true).setStyle(ButtonStyle.Secondary)
      );
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButtons);

      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [disabledRow],
      });

      if (i < selectedQuestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Final results
  const percentage = Math.round((correctAnswers / totalQuestions) * 100);
  let grade = '';
  let emoji = '';

  if (percentage >= 90) { grade = '素晴らしい! (Meraviglioso!)'; emoji = '🏆'; }
  else if (percentage >= 70) { grade = '上手! (Bravo!)'; emoji = '🌟'; }
  else if (percentage >= 50) { grade = 'いいね! (Bene!)'; emoji = '👍'; }
  else { grade = 'がんばれ! (Forza!)'; emoji = '💪'; }

  gameStatsSchema.update(
    interaction.user.id,
    'story_game',
    percentage >= 70,
    correctAnswers
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(percentage >= 50 ? config.colors.success : config.colors.warning)
    .setTitle(`${emoji} Gioco Completato!`)
    .setDescription(
      `**${grade}**\n\n` +
      `Hai completato correttamente **${correctAnswers}/${totalQuestions}** frasi (${percentage}%)`
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

async function showInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('📖 Completa le Frasi')
    .setDescription(
      'In questo gioco dovrai completare frasi giapponesi scegliendo la parola corretta!\n\n' +
      'Questo gioco ti aiuta a:\n' +
      '• Imparare il vocabolario nel contesto\n' +
      '• Capire la struttura delle frasi giapponesi\n' +
      '• Migliorare la comprensione della grammatica'
    )
    .addFields(
      {
        name: '🎮 Come giocare',
        value:
          '1. Leggi la frase con lo spazio vuoto\n' +
          '2. Scegli la parola corretta tra le opzioni\n' +
          '3. Hai 20 secondi per rispondere',
      },
      {
        name: '💡 Suggerimenti',
        value:
          '• Leggi attentamente il significato in italiano\n' +
          '• Usa il suggerimento se sei in difficoltà\n' +
          '• Impara dai tuoi errori!',
      }
    )
    .setFooter({ text: 'Usa /story play per iniziare!' });

  await interaction.reply({ embeds: [embed] });
}

export default storyGame;
