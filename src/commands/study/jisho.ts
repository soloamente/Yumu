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
import { searchJisho, formatJlptLevel, formatMeanings, isCommonWord } from '../../services/jisho-service.js';

const jisho: Command = {
  data: new SlashCommandBuilder()
    .setName('jisho')
    .setDescription('Cerca una parola nel dizionario Jisho.org')
    .addStringOption(opt =>
      opt
        .setName('parola')
        .setDescription('Parola da cercare (giapponese o inglese)')
        .setRequired(true)
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const query = interaction.options.getString('parola', true);

    await interaction.deferReply();

    try {
      const results = await searchJisho(query);

      if (results.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('Nessun risultato', 
            `Non ho trovato risultati per "${query}".\n` +
            `Prova con una parola diversa o controlla l'ortografia.`
          )],
        });
        return;
      }

      let currentIndex = 0;

      const createEmbed = (index: number): EmbedBuilder => {
        const word = results[index];
        const primary = word.japanese[0];

        const embed = new EmbedBuilder()
          .setColor(isCommonWord(word) ? config.colors.success : config.colors.info)
          .setTitle(`📖 ${primary.word || primary.reading}`)
          .setURL(`https://jisho.org/search/${encodeURIComponent(query)}`);

        // Reading
        if (primary.word && primary.reading) {
          embed.setDescription(`**Lettura:** ${primary.reading}`);
        }

        // All readings
        if (word.japanese.length > 1) {
          const otherReadings = word.japanese
            .slice(1, 5)
            .map(jp => jp.word ? `${jp.word} (${jp.reading})` : jp.reading)
            .join(', ');
          embed.addFields({
            name: '📝 Altre letture',
            value: otherReadings,
          });
        }

        // Meanings
        embed.addFields({
          name: '📚 Significati',
          value: formatMeanings(word, 5) || 'Nessun significato trovato',
        });

        // JLPT Level
        if (word.jlpt && word.jlpt.length > 0) {
          embed.addFields({
            name: '🏷️ JLPT',
            value: formatJlptLevel(word.jlpt),
            inline: true,
          });
        }

        // Common word badge
        if (isCommonWord(word)) {
          embed.addFields({
            name: '⭐ Stato',
            value: 'Parola comune',
            inline: true,
          });
        }

        // Tags
        if (word.tags && word.tags.length > 0) {
          embed.addFields({
            name: '🏷️ Tags',
            value: word.tags.join(', '),
            inline: true,
          });
        }

        embed.setFooter({
          text: `Risultato ${index + 1} di ${Math.min(results.length, 10)} • Dati da Jisho.org`,
        });

        return embed;
      };

      const createButtons = (index: number, total: number): ActionRowBuilder<ButtonBuilder> => {
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
          new ButtonBuilder()
            .setCustomId('jisho_prev')
            .setLabel('◀️ Precedente')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId('jisho_next')
            .setLabel('Successivo ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index >= total - 1),
          new ButtonBuilder()
            .setLabel('🔗 Apri su Jisho')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://jisho.org/search/${encodeURIComponent(query)}`)
        );

        return row;
      };

      const maxResults = Math.min(results.length, 10);

      const message = await interaction.editReply({
        embeds: [createEmbed(currentIndex)],
        components: maxResults > 1 ? [createButtons(currentIndex, maxResults)] : [],
      });

      if (maxResults <= 1) return;

      // Handle pagination
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000, // 2 minutes
      });

      collector.on('collect', async (buttonInteraction) => {
        if (buttonInteraction.user.id !== interaction.user.id) {
          await buttonInteraction.reply({
            content: 'Solo chi ha fatto la ricerca può navigare i risultati.',
            ephemeral: true,
          });
          return;
        }

        if (buttonInteraction.customId === 'jisho_prev') {
          currentIndex = Math.max(0, currentIndex - 1);
        } else if (buttonInteraction.customId === 'jisho_next') {
          currentIndex = Math.min(maxResults - 1, currentIndex + 1);
        }

        await buttonInteraction.update({
          embeds: [createEmbed(currentIndex)],
          components: [createButtons(currentIndex, maxResults)],
        });
      });

      collector.on('end', async () => {
        try {
          await message.edit({
            components: [],
          });
        } catch {
          // Message might have been deleted
        }
      });

    } catch (error) {
      console.error('[Jisho] Search error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Errore', 
          'Si è verificato un errore durante la ricerca.\n' +
          'Riprova più tardi.'
        )],
      });
    }
  },
};

export default jisho;
