import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import type { Command } from '../../types/index.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embed-builder.js';
import { checkAdminPermission } from '../../utils/permissions.js';
import { guildConfigSchema } from '../../database/schema.js';

const setup: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configura il bot per il server')
    .addSubcommand(sub =>
      sub
        .setName('welcome')
        .setDescription('Configura i messaggi di benvenuto')
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale per i messaggi di benvenuto')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(opt =>
          opt
            .setName('messaggio')
            .setDescription('Messaggio di benvenuto (usa {user}, {server}, {memberCount})')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('games')
        .setDescription('Configura i canali per i giochi')
        .addChannelOption(opt =>
          opt
            .setName('canale')
            .setDescription('Canale dedicato ai giochi')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('adminrole')
        .setDescription('Imposta il ruolo admin del bot')
        .addRoleOption(opt =>
          opt
            .setName('ruolo')
            .setDescription('Ruolo che può gestire il bot')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Mostra la configurazione attuale del server')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hasPermission = await checkAdminPermission(interaction);
    if (!hasPermission) return;

    if (!interaction.guild) {
      await interaction.reply({
        embeds: [errorEmbed('Errore', 'Questo comando può essere usato solo in un server.')],
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'welcome':
        await setupWelcome(interaction);
        break;
      case 'games':
        await setupGames(interaction);
        break;
      case 'adminrole':
        await setupAdminRole(interaction);
        break;
      case 'status':
        await showStatus(interaction);
        break;
    }
  },
};

async function setupWelcome(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel('canale', true);
  const message = interaction.options.getString('messaggio');

  guildConfigSchema.update(interaction.guild!.id, {
    welcome_channel_id: channel.id,
    welcome_message: message || null,
  });

  const embed = successEmbed('Benvenuto configurato!',
    `**Canale:** ${channel}\n` +
    (message 
      ? `**Messaggio personalizzato:** ${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`
      : '**Messaggio:** Default')
  );

  embed.addFields({
    name: '💡 Variabili disponibili',
    value: 
      '`{user}` - Nome utente\n' +
      '`{mention}` - Menzione utente\n' +
      '`{server}` - Nome server\n' +
      '`{memberCount}` - Numero membri',
  });

  await interaction.reply({ embeds: [embed] });
}

async function setupGames(interaction: ChatInputCommandInteraction): Promise<void> {
  const channel = interaction.options.getChannel('canale', true);

  // Get current game channels and add the new one
  const currentConfig = guildConfigSchema.getOrCreate(interaction.guild!.id);
  let gameChannels: string[] = [];
  
  try {
    gameChannels = currentConfig.game_channels 
      ? JSON.parse(currentConfig.game_channels) 
      : [];
  } catch {
    gameChannels = [];
  }

  if (!gameChannels.includes(channel.id)) {
    gameChannels.push(channel.id);
  }

  guildConfigSchema.update(interaction.guild!.id, {
    game_channels: JSON.stringify(gameChannels),
  });

  await interaction.reply({
    embeds: [successEmbed('Canale giochi aggiunto!',
      `${channel} è stato configurato come canale per i giochi.\n\n` +
      `**Canali giochi attivi:** ${gameChannels.length}`
    )],
  });
}

async function setupAdminRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('ruolo', true);

  guildConfigSchema.update(interaction.guild!.id, {
    admin_role_id: role.id,
  });

  await interaction.reply({
    embeds: [successEmbed('Ruolo admin configurato!',
      `Il ruolo ${role} può ora gestire il bot.\n\n` +
      `Gli utenti con questo ruolo possono:\n` +
      `• Creare/gestire giveaway\n` +
      `• Creare/gestire eventi\n` +
      `• Configurare il bot`
    )],
  });
}

async function showStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildConfig = guildConfigSchema.getOrCreate(interaction.guild!.id);

  let gameChannels: string[] = [];
  try {
    gameChannels = guildConfig.game_channels 
      ? JSON.parse(guildConfig.game_channels) 
      : [];
  } catch {
    gameChannels = [];
  }

  const embed = new EmbedBuilder()
    .setColor(config.colors.info)
    .setTitle('⚙️ Configurazione Server')
    .setDescription(`Configurazione per **${interaction.guild!.name}**`)
    .addFields(
      {
        name: '👋 Canale Benvenuto',
        value: guildConfig.welcome_channel_id 
          ? `<#${guildConfig.welcome_channel_id}>` 
          : '❌ Non configurato',
        inline: true,
      },
      {
        name: '📖 Parola del Giorno',
        value: guildConfig.daily_word_channel_id 
          ? `<#${guildConfig.daily_word_channel_id}>` 
          : '❌ Non configurato',
        inline: true,
      },
      {
        name: '🛡️ Ruolo Admin',
        value: guildConfig.admin_role_id 
          ? `<@&${guildConfig.admin_role_id}>` 
          : '❌ Non configurato',
        inline: true,
      },
      {
        name: '🎮 Canali Giochi',
        value: gameChannels.length > 0 
          ? gameChannels.map(id => `<#${id}>`).join(', ') 
          : '❌ Non configurati',
      }
    )
    .setFooter({ text: 'Usa /setup per configurare' })
    .setTimestamp();

  if (guildConfig.welcome_message) {
    embed.addFields({
      name: '💬 Messaggio Benvenuto',
      value: guildConfig.welcome_message.slice(0, 200) + 
        (guildConfig.welcome_message.length > 200 ? '...' : ''),
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default setup;
