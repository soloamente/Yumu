import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  TextChannel,
  Message,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { gameStatsSchema } from '../../database/schema.js';
import { awardXp } from '../../services/level-service.js';

// Sample sentences for typing practice
const sentences = [
  // JLPT N5 Level
  { japanese: 'わたしはがくせいです', romaji: 'watashi wa gakusei desu', meaning: 'Sono uno studente', level: 'N5' },
  { japanese: 'これはほんです', romaji: 'kore wa hon desu', meaning: 'Questo è un libro', level: 'N5' },
  { japanese: 'いまなんじですか', romaji: 'ima nan ji desu ka', meaning: 'Che ore sono adesso?', level: 'N5' },
  { japanese: 'おなまえはなんですか', romaji: 'o namae wa nan desu ka', meaning: 'Come ti chiami?', level: 'N5' },
  { japanese: 'げんきですか', romaji: 'genki desu ka', meaning: 'Come stai?', level: 'N5' },
  { japanese: 'にほんごをべんきょうします', romaji: 'nihongo wo benkyou shimasu', meaning: 'Studio giapponese', level: 'N5' },
  { japanese: 'あしたがっこうにいきます', romaji: 'ashita gakkou ni ikimasu', meaning: 'Domani vado a scuola', level: 'N5' },
  { japanese: 'ごはんをたべました', romaji: 'gohan wo tabemashita', meaning: 'Ho mangiato', level: 'N5' },
  { japanese: 'おちゃをのみますか', romaji: 'ocha wo nomimasu ka', meaning: 'Vuoi bere del tè?', level: 'N5' },
  { japanese: 'ともだちとあそびます', romaji: 'tomodachi to asobimasu', meaning: 'Gioco con gli amici', level: 'N5' },
  
  // JLPT N4 Level
  { japanese: 'きょうはてんきがいいです', romaji: 'kyou wa tenki ga ii desu', meaning: 'Oggi il tempo è bello', level: 'N4' },
  { japanese: 'にほんにいきたいです', romaji: 'nihon ni ikitai desu', meaning: 'Voglio andare in Giappone', level: 'N4' },
  { japanese: 'このえいがはおもしろいです', romaji: 'kono eiga wa omoshiroi desu', meaning: 'Questo film è interessante', level: 'N4' },
  { japanese: 'かんじをおぼえるのはむずかしい', romaji: 'kanji wo oboeru no wa muzukashii', meaning: 'Memorizzare i kanji è difficile', level: 'N4' },
  { japanese: 'でんしゃでかいしゃにいきます', romaji: 'densha de kaisha ni ikimasu', meaning: 'Vado al lavoro in treno', level: 'N4' },
  
  // Fun phrases
  { japanese: 'にほんごはたのしい', romaji: 'nihongo wa tanoshii', meaning: 'Il giapponese è divertente', level: 'N5' },
  { japanese: 'がんばってください', romaji: 'ganbatte kudasai', meaning: 'In bocca al lupo!', level: 'N5' },
  { japanese: 'いただきます', romaji: 'itadakimasu', meaning: 'Buon appetito! (prima di mangiare)', level: 'N5' },
  { japanese: 'ごちそうさまでした', romaji: 'gochisousama deshita', meaning: 'Grazie per il pasto!', level: 'N5' },
  { japanese: 'おやすみなさい', romaji: 'oyasumi nasai', meaning: 'Buonanotte', level: 'N5' },
];

const typingGame: Command = {
  data: new SlashCommandBuilder()
    .setName('typing')
    .setDescription('Pratica la scrittura giapponese!')
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Inizia una sessione di typing')
        .addStringOption(opt =>
          opt
            .setName('livello')
            .setDescription('Livello di difficoltà')
            .setRequired(false)
            .addChoices(
              { name: 'JLPT N5 (Principiante)', value: 'N5' },
              { name: 'JLPT N4 (Elementare)', value: 'N4' },
              { name: 'Tutti', value: 'all' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('frasi')
            .setDescription('Numero di frasi (1-10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await startTypingGame(interaction);
  },
};

async function startTypingGame(interaction: ChatInputCommandInteraction): Promise<void> {
  const level = interaction.options.getString('livello') || 'all';
  const sentenceCount = interaction.options.getInteger('frasi') || 5;

  let availableSentences = sentences;
  if (level !== 'all') {
    availableSentences = sentences.filter(s => s.level === level);
  }

  if (availableSentences.length === 0) {
    await interaction.reply({
      content: '❌ Non ci sono frasi disponibili per questo livello.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  let correctCount = 0;
  let totalTime = 0;

  const shuffled = [...availableSentences].sort(() => Math.random() - 0.5);
  const selectedSentences = shuffled.slice(0, Math.min(sentenceCount, shuffled.length));

  for (let i = 0; i < selectedSentences.length; i++) {
    const sentence = selectedSentences[i];

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`⌨️ Typing Game - Frase ${i + 1}/${selectedSentences.length}`)
      .setDescription(
        `Scrivi questa frase in hiragana:\n\n` +
        `## ${sentence.japanese}\n\n` +
        `📝 Romaji: \`${sentence.romaji}\`\n` +
        `📖 Significato: ${sentence.meaning}`
      )
      .addFields({
        name: '🏷️ Livello',
        value: sentence.level,
        inline: true,
      })
      .setFooter({ text: 'Hai 30 secondi per scrivere la frase!' });

    const startButton = new ButtonBuilder()
      .setCustomId('typing_start')
      .setLabel('▶️ Inizia')
      .setStyle(ButtonStyle.Primary);

    const skipButton = new ButtonBuilder()
      .setCustomId('typing_skip')
      .setLabel('⏭️ Salta')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(startButton, skipButton);

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    try {
      const buttonResponse = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (btn) => btn.user.id === interaction.user.id,
        time: 60000,
      });

      if (buttonResponse.customId === 'typing_skip') {
        await buttonResponse.update({
          embeds: [EmbedBuilder.from(embed).setColor(config.colors.warning).setDescription('⏭️ Frase saltata')],
          components: [],
        });
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }

      // Start timing
      const startTime = Date.now();

      await buttonResponse.update({
        embeds: [EmbedBuilder.from(embed).setDescription(
          `**Scrivi adesso!**\n\n## ${sentence.japanese}\n\n⏱️ Il tempo parte ora!`
        )],
        components: [],
      });

      // Wait for user's typed response
      const channel = interaction.channel as TextChannel | null;
      if (!channel || !('awaitMessages' in channel)) continue;

      const collected = await channel.awaitMessages({
        filter: (m: Message) => m.author.id === interaction.user.id,
        max: 1,
        time: 30000,
      });

      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000;

      if (collected.size === 0) {
        await interaction.editReply({
          embeds: [EmbedBuilder.from(embed).setColor(config.colors.error).setDescription(
            `⏰ **Tempo scaduto!**\n\nLa frase era:\n${sentence.japanese}`
          )],
          components: [],
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const userInput = collected.first()!.content.trim();
      
      // Check if correct (normalize spaces and compare)
      const normalizedInput = userInput.replace(/\s+/g, '');
      const normalizedTarget = sentence.japanese.replace(/\s+/g, '');
      const isCorrect = normalizedInput === normalizedTarget;

      if (isCorrect) {
        correctCount++;
        totalTime += timeTaken;
        awardXp(interaction.user.id, interaction.user.username, 15);

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Corretto!')
            .setDescription(
              `**Frase:** ${sentence.japanese}\n\n` +
              `⏱️ **Tempo:** ${timeTaken.toFixed(2)} secondi\n` +
              `📊 **WPM:** ${calculateWPM(sentence.japanese.length, timeTaken)}`
            )
          ],
          components: [],
        });
      } else {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle('❌ Sbagliato')
            .setDescription(
              `**La tua risposta:** ${userInput}\n` +
              `**Risposta corretta:** ${sentence.japanese}\n\n` +
              `Prova a prestare più attenzione ai caratteri!`
            )
          ],
          components: [],
        });
      }

      // Delete user's message to keep chat clean
      try {
        await collected.first()!.delete();
      } catch {
        // Ignore if can't delete
      }

      await new Promise(resolve => setTimeout(resolve, 2500));

    } catch {
      // Timeout on button or message
      await interaction.editReply({
        embeds: [EmbedBuilder.from(embed).setColor(config.colors.warning).setDescription('⏰ Tempo scaduto!')],
        components: [],
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  // Final results
  const accuracy = Math.round((correctCount / selectedSentences.length) * 100);
  const avgTime = correctCount > 0 ? totalTime / correctCount : 0;

  gameStatsSchema.update(
    interaction.user.id,
    'typing_game',
    accuracy >= 70,
    correctCount
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(accuracy >= 70 ? config.colors.success : config.colors.warning)
    .setTitle('⌨️ Sessione Completata!')
    .setDescription(
      `**Frasi corrette:** ${correctCount}/${selectedSentences.length} (${accuracy}%)\n` +
      (correctCount > 0 ? `**Tempo medio:** ${avgTime.toFixed(2)} secondi` : '')
    )
    .addFields({
      name: '📊 XP Guadagnati',
      value: `+${correctCount * 15} XP`,
      inline: true,
    })
    .setFooter({ text: '練習は完璧を作る! (La pratica rende perfetti!)' })
    .setTimestamp();

  await interaction.editReply({
    embeds: [finalEmbed],
    components: [],
  });
}

function calculateWPM(charCount: number, seconds: number): number {
  // Japanese characters are roughly equivalent to 2 English characters
  const wordEquivalent = charCount / 2.5;
  const minutes = seconds / 60;
  return Math.round(wordEquivalent / minutes);
}

export default typingGame;
