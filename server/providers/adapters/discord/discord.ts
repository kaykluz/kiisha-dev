// Discord adapter for KIISHA integration
import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  REST,
  Routes,
  Guild,
  TextChannel,
  ThreadChannel,
  DMChannel,
  User,
  GuildMember,
  Interaction,
  CommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  MessageComponentInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActivityType,
  Collection,
  Events,
  MessageType,
  ComponentType,
} from 'discord.js';
import { eq, and, or, gte, lte, isNull } from 'drizzle-orm';
import { db } from '~/server/db';
import {
  discordConfigs,
  discordMessages,
  discordUserMappings,
  discordCommands,
  discordInteractionSessions,
  discordScheduledMessages,
} from '~/drizzle/schema-discord';
import { TenantIsolationService } from '~/server/services/tenantIsolation';
import { ConversationalAgentService } from '~/server/services/conversationalAgent';
import { createCaller } from '~/server/routers';
import crypto from 'crypto';
import { z } from 'zod';

// Types
export interface DiscordAdapterConfig {
  botToken: string;
  applicationId: string;
  publicKey: string;
  guildId: string;
  organizationId: number;
  commandPrefix?: string;
}

export interface DiscordMessage {
  messageId: string;
  channelId: string;
  guildId: string;
  authorId: string;
  content: string;
  attachments?: any[];
  embeds?: any[];
  replyTo?: string;
}

// Discord Provider Adapter
export class DiscordProviderAdapter {
  private client: Client;
  private rest: REST;
  private config: DiscordAdapterConfig;
  private commands: Collection<string, any>;
  private tenantIsolation: TenantIsolationService;
  private conversationalAgent: ConversationalAgentService;
  private organizationId: number;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: DiscordAdapterConfig) {
    this.config = config;
    this.organizationId = config.organizationId;
    this.commands = new Collection();

    // Initialize Discord client with intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.ThreadMember,
      ],
    });

    // Initialize REST API
    this.rest = new REST({ version: '10' }).setToken(config.botToken);

    // Initialize services
    this.tenantIsolation = new TenantIsolationService();
    this.conversationalAgent = new ConversationalAgentService();

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    try {
      // Login to Discord
      await this.client.login(this.config.botToken);

      // Wait for ready event
      await new Promise<void>((resolve) => {
        this.client.once(Events.ClientReady, () => {
          console.log(`Discord bot connected as ${this.client.user?.tag}`);
          resolve();
        });
      });

      // Register slash commands
      await this.registerSlashCommands();

      // Start heartbeat
      this.startHeartbeat();

      // Update connection status
      await this.updateConnectionStatus('connected');
    } catch (error) {
      console.error('Failed to connect Discord bot:', error);
      await this.updateConnectionStatus('error');
      throw error;
    }
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    try {
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Destroy client
      this.client.destroy();

      // Update connection status
      await this.updateConnectionStatus('disconnected');
    } catch (error) {
      console.error('Error disconnecting Discord bot:', error);
    }
  }

  /**
   * Setup Discord event handlers
   */
  private setupEventHandlers(): void {
    // Ready event
    this.client.on(Events.ClientReady, () => {
      console.log(`Ready! Logged in as ${this.client.user?.tag}`);
      this.setPresence();
    });

    // Message create event
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });

    // Interaction create event (slash commands, buttons, modals)
    this.client.on(Events.InteractionCreate, async (interaction) => {
      await this.handleInteraction(interaction);
    });

    // Message update event
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      await this.handleMessageUpdate(oldMessage, newMessage);
    });

    // Message delete event
    this.client.on(Events.MessageDelete, async (message) => {
      await this.handleMessageDelete(message);
    });

    // Reaction add event
    this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
      await this.handleReactionAdd(reaction, user);
    });

    // Thread create event
    this.client.on(Events.ThreadCreate, async (thread) => {
      await this.handleThreadCreate(thread);
    });

    // Guild member add event (new user joins)
    this.client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleMemberJoin(member);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
    });

    // Warning handling
    this.client.on(Events.Warn, (warning) => {
      console.warn('Discord client warning:', warning);
    });

    // Disconnect event
    this.client.on(Events.ShardDisconnect, () => {
      console.log('Discord bot disconnected');
      this.updateConnectionStatus('disconnected');
    });

    // Reconnecting event
    this.client.on(Events.ShardReconnecting, () => {
      console.log('Discord bot reconnecting...');
    });

    // Resume event
    this.client.on(Events.ShardResume, () => {
      console.log('Discord bot resumed');
      this.updateConnectionStatus('connected');
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check if message is from configured guild or DM
    if (message.guild && message.guild.id !== this.config.guildId) return;

    try {
      // Check user mapping and permissions
      const userMapping = await this.getUserMapping(message.author.id, message.guild?.id);
      if (!userMapping && message.guild) {
        // Send verification prompt
        await this.promptVerification(message);
        return;
      }

      // Store message in database
      const storedMessage = await this.storeMessage(message, 'inbound');

      // Check if it's a command
      if (this.config.commandPrefix && message.content.startsWith(this.config.commandPrefix)) {
        await this.handleCommand(message, userMapping);
        return;
      }

      // Process conversational message
      if (userMapping?.verified) {
        await this.processConversationalMessage(message, userMapping);
      }
    } catch (error) {
      console.error('Error handling Discord message:', error);
      await message.reply('❌ An error occurred while processing your message.');
    }
  }

  /**
   * Handle interactions (slash commands, buttons, modals)
   */
  private async handleInteraction(interaction: Interaction): Promise<void> {
    try {
      // Slash command interaction
      if (interaction.isChatInputCommand()) {
        await this.handleSlashCommand(interaction);
      }
      // Button interaction
      else if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
      // Select menu interaction
      else if (interaction.isSelectMenu()) {
        await this.handleSelectMenuInteraction(interaction);
      }
      // Modal submit interaction
      else if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      }
      // Autocomplete interaction
      else if (interaction.isAutocomplete()) {
        await this.handleAutocomplete(interaction);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true,
        });
      }
    }
  }

  /**
   * Handle slash commands
   */
  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check user permissions
    const userMapping = await this.getUserMapping(
      interaction.user.id,
      interaction.guild?.id || this.config.guildId
    );

    if (!userMapping?.verified) {
      await interaction.reply({
        content: '🔒 Please verify your account first. Use `!kiisha verify` to start.',
        ephemeral: true,
      });
      return;
    }

    // Get command from registry
    const command = await this.getCommand(interaction.commandName);
    if (!command) {
      await interaction.reply({
        content: '❌ Unknown command.',
        ephemeral: true,
      });
      return;
    }

    // Check permissions
    if (!await this.checkCommandPermissions(command, userMapping)) {
      await interaction.reply({
        content: '🚫 You do not have permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    // Create interaction session
    const session = await this.createInteractionSession(interaction, userMapping);

    // Defer reply for long operations
    await interaction.deferReply({ ephemeral: command.ephemeral ?? false });

    // Execute command handler
    await this.executeCommand(command, interaction, session, userMapping);
  }

  /**
   * Register slash commands with Discord
   */
  private async registerSlashCommands(): Promise<void> {
    // Load commands from database
    const commands = await db.select()
      .from(discordCommands)
      .where(
        and(
          eq(discordCommands.organizationId, this.organizationId),
          eq(discordCommands.enabled, true)
        )
      );

    // Build Discord command structures
    const discordCommands = commands.map(cmd => {
      const builder = new SlashCommandBuilder()
        .setName(cmd.name)
        .setDescription(cmd.description);

      // Add options
      if (cmd.options && Array.isArray(cmd.options)) {
        for (const option of cmd.options) {
          this.addCommandOption(builder, option);
        }
      }

      // Set permissions
      if (cmd.requiredPermissions?.length > 0) {
        builder.setDefaultMemberPermissions(
          this.mapPermissions(cmd.requiredPermissions)
        );
      }

      return builder.toJSON();
    });

    // Register commands with Discord
    try {
      if (this.config.guildId) {
        // Guild-specific commands (instant update)
        await this.rest.put(
          Routes.applicationGuildCommands(this.config.applicationId, this.config.guildId),
          { body: discordCommands }
        );
      } else {
        // Global commands (may take up to 1 hour)
        await this.rest.put(
          Routes.applicationCommands(this.config.applicationId),
          { body: discordCommands }
        );
      }

      console.log(`Registered ${discordCommands.length} Discord slash commands`);
    } catch (error) {
      console.error('Failed to register Discord commands:', error);
    }
  }

  /**
   * Process conversational message through AI
   */
  private async processConversationalMessage(
    message: Message,
    userMapping: any
  ): Promise<void> {
    // Show typing indicator
    await message.channel.sendTyping();

    // Get conversation session
    const session = await this.conversationalAgent.getOrCreateSession({
      userId: userMapping.userId,
      organizationId: this.organizationId,
      channel: 'discord',
      channelIdentifier: message.author.id,
      channelThreadId: message.channel.id,
    });

    // Process through conversational agent
    const response = await this.conversationalAgent.processMessage({
      message: message.content,
      attachments: message.attachments.map(a => ({
        url: a.url,
        name: a.name,
        size: a.size,
        contentType: a.contentType,
      })),
      session,
      context: {
        guildId: message.guild?.id,
        channelId: message.channel.id,
        messageId: message.id,
      },
    });

    // Format response
    const embed = this.formatResponse(response);

    // Send reply
    const reply = await message.reply({ embeds: [embed] });

    // Store outbound message
    await this.storeMessage(reply, 'outbound');
  }

  /**
   * Format AI response as Discord embed
   */
  private formatResponse(response: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setColor(0x2196F3) // KIISHA blue
      .setTimestamp()
      .setFooter({ text: 'KIISHA AI Assistant' });

    // Main response
    if (response.text) {
      embed.setDescription(response.text);
    }

    // Add title if available
    if (response.title) {
      embed.setTitle(response.title);
    }

    // Add fields for structured data
    if (response.data && typeof response.data === 'object') {
      for (const [key, value] of Object.entries(response.data)) {
        embed.addFields({
          name: this.formatFieldName(key),
          value: this.formatFieldValue(value),
          inline: true,
        });
      }
    }

    // Add image if available
    if (response.image) {
      embed.setImage(response.image);
    }

    // Add thumbnail if available
    if (response.thumbnail) {
      embed.setThumbnail(response.thumbnail);
    }

    // Add action buttons if available
    if (response.actions && response.actions.length > 0) {
      // Note: Buttons would be added as components, not in embed
      embed.addFields({
        name: 'Available Actions',
        value: response.actions.map((a: any) => `• ${a.label}`).join('\n'),
        inline: false,
      });
    }

    return embed;
  }

  /**
   * Send message to Discord channel
   */
  async sendMessage(
    channelId: string,
    content: string | { embeds?: any[]; components?: any[]; content?: string }
  ): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} not found or not text-based`);
      }

      let messageOptions: any = {};
      if (typeof content === 'string') {
        messageOptions.content = content;
      } else {
        messageOptions = content;
      }

      const message = await (channel as TextChannel).send(messageOptions);
      await this.storeMessage(message, 'outbound');
    } catch (error) {
      console.error('Failed to send Discord message:', error);
      throw error;
    }
  }

  /**
   * Send notification as embed
   */
  async sendNotification(notification: {
    channelId?: string;
    userId?: string;
    title: string;
    description: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    thumbnail?: string;
    image?: string;
    url?: string;
    footer?: string;
    buttons?: { label: string; style: ButtonStyle; customId: string }[];
  }): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(notification.title)
      .setDescription(notification.description)
      .setColor(notification.color || 0x2196F3)
      .setTimestamp();

    if (notification.fields) {
      embed.addFields(notification.fields);
    }
    if (notification.thumbnail) {
      embed.setThumbnail(notification.thumbnail);
    }
    if (notification.image) {
      embed.setImage(notification.image);
    }
    if (notification.url) {
      embed.setURL(notification.url);
    }
    if (notification.footer) {
      embed.setFooter({ text: notification.footer });
    }

    let components: any[] = [];
    if (notification.buttons && notification.buttons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const button of notification.buttons) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(button.customId)
            .setLabel(button.label)
            .setStyle(button.style)
        );
      }
      components.push(row);
    }

    const messageOptions = { embeds: [embed] };
    if (components.length > 0) {
      (messageOptions as any).components = components;
    }

    if (notification.channelId) {
      await this.sendMessage(notification.channelId, messageOptions);
    } else if (notification.userId) {
      await this.sendDirectMessage(notification.userId, messageOptions);
    }
  }

  /**
   * Send direct message to user
   */
  async sendDirectMessage(userId: string, content: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      const dmChannel = await user.createDM();
      const message = await dmChannel.send(content);
      await this.storeMessage(message, 'outbound');
    } catch (error) {
      console.error('Failed to send Discord DM:', error);
      throw error;
    }
  }

  /**
   * Create thread for long conversations
   */
  async createThread(
    channelId: string,
    name: string,
    message?: string
  ): Promise<string> {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      const thread = await channel.threads.create({
        name,
        autoArchiveDuration: 1440, // 24 hours
        reason: 'KIISHA conversation thread',
      });

      if (message) {
        await thread.send(message);
      }

      return thread.id;
    } catch (error) {
      console.error('Failed to create Discord thread:', error);
      throw error;
    }
  }

  /**
   * Handle button interactions
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    // Parse custom ID (format: action:data)
    const [action, ...dataParts] = customId.split(':');
    const data = dataParts.join(':');

    switch (action) {
      case 'verify':
        await this.handleVerificationButton(interaction, data);
        break;
      case 'confirm':
        await this.handleConfirmationButton(interaction, data);
        break;
      case 'cancel':
        await this.handleCancelButton(interaction, data);
        break;
      case 'next':
        await this.handlePaginationButton(interaction, 'next', data);
        break;
      case 'prev':
        await this.handlePaginationButton(interaction, 'prev', data);
        break;
      default:
        // Custom action handler
        await this.handleCustomButton(interaction, action, data);
    }
  }

  /**
   * Handle verification button
   */
  private async handleVerificationButton(
    interaction: ButtonInteraction,
    code: string
  ): Promise<void> {
    // Show modal for verification code input
    const modal = new ModalBuilder()
      .setCustomId(`verify_modal:${code}`)
      .setTitle('Account Verification');

    const codeInput = new TextInputBuilder()
      .setCustomId('verification_code')
      .setLabel('Enter your 6-digit verification code')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(6)
      .setPlaceholder('123456')
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  /**
   * Handle modal submit
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    const customId = interaction.customId;
    const [action, data] = customId.split(':');

    switch (action) {
      case 'verify_modal':
        await this.handleVerificationModal(interaction);
        break;
      case 'workflow_config':
        await this.handleWorkflowConfigModal(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown modal action.',
          ephemeral: true,
        });
    }
  }

  /**
   * Handle verification modal
   */
  private async handleVerificationModal(interaction: ModalSubmitInteraction): Promise<void> {
    const code = interaction.fields.getTextInputValue('verification_code');

    try {
      // Verify the code
      const mapping = await db.select()
        .from(discordUserMappings)
        .where(
          and(
            eq(discordUserMappings.discordUserId, interaction.user.id),
            eq(discordUserMappings.verificationCode, code),
            eq(discordUserMappings.verified, false),
            gte(discordUserMappings.verificationExpiresAt, new Date())
          )
        )
        .limit(1);

      if (mapping.length === 0) {
        await interaction.reply({
          content: '❌ Invalid or expired verification code.',
          ephemeral: true,
        });
        return;
      }

      // Update mapping as verified
      await db.update(discordUserMappings)
        .set({
          verified: true,
          verificationCode: null,
          verificationExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(discordUserMappings.id, mapping[0].id));

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Account Verified')
        .setDescription('Your Discord account has been successfully linked to KIISHA.')
        .setColor(0x10B981)
        .addFields(
          { name: 'User', value: interaction.user.tag, inline: true },
          { name: 'Organization', value: 'Your Organization', inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

      // Send welcome message
      await this.sendWelcomeMessage(interaction.user.id);
    } catch (error) {
      console.error('Verification error:', error);
      await interaction.reply({
        content: '❌ An error occurred during verification.',
        ephemeral: true,
      });
    }
  }

  /**
   * Store message in database
   */
  private async storeMessage(
    message: Message | any,
    direction: 'inbound' | 'outbound'
  ): Promise<any> {
    const messageData = {
      organizationId: this.organizationId,
      configId: await this.getConfigId(),
      messageId: message.id,
      channelId: message.channel.id,
      guildId: message.guild?.id || this.config.guildId,
      threadId: message.channel.isThread() ? message.channel.id : null,
      authorId: message.author.id,
      authorUsername: message.author.username,
      content: message.content,
      embeds: message.embeds.map((e: any) => e.toJSON()),
      attachments: message.attachments.map((a: any) => ({
        id: a.id,
        filename: a.name,
        size: a.size,
        url: a.url,
        contentType: a.contentType,
      })),
      type: this.getMessageType(message),
      direction,
      createdAt: message.createdAt || new Date(),
    };

    const [stored] = await db.insert(discordMessages)
      .values(messageData)
      .returning();

    return stored;
  }

  /**
   * Get message type
   */
  private getMessageType(message: Message): string {
    if (message.type === MessageType.Reply) return 'reply';
    if (message.type === MessageType.ThreadStarterMessage) return 'thread_starter';
    if (message.embeds.length > 0) return 'embed';
    if (message.content.startsWith(this.config.commandPrefix || '!')) return 'command';
    return 'text';
  }

  /**
   * Get user mapping
   */
  private async getUserMapping(
    discordUserId: string,
    guildId?: string
  ): Promise<any> {
    const mapping = await db.select()
      .from(discordUserMappings)
      .where(
        and(
          eq(discordUserMappings.discordUserId, discordUserId),
          eq(discordUserMappings.guildId, guildId || this.config.guildId)
        )
      )
      .limit(1);

    return mapping[0] || null;
  }

  /**
   * Prompt user verification
   */
  private async promptVerification(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🔐 Account Verification Required')
      .setDescription(
        'To use KIISHA features in Discord, please link your Discord account.\n\n' +
        '1. Go to KIISHA web app\n' +
        '2. Navigate to Settings > Integrations > Discord\n' +
        '3. Click "Link Discord Account"\n' +
        '4. Follow the instructions to get your verification code\n' +
        '5. Click the button below to verify'
      )
      .setColor(0xF59E0B)
      .setFooter({ text: 'This verification is required for security' });

    const button = new ButtonBuilder()
      .setCustomId('verify:start')
      .setLabel('Verify Account')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔐');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await message.reply({ embeds: [embed], components: [row] });
  }

  /**
   * Send welcome message
   */
  private async sendWelcomeMessage(userId: string): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('Welcome to KIISHA on Discord! 👋')
      .setDescription(
        'Your account is now linked. Here\'s what you can do:\n\n' +
        '**Commands:**\n' +
        '• `/assets` - View and manage assets\n' +
        '• `/projects` - Access project information\n' +
        '• `/documents` - Search and retrieve documents\n' +
        '• `/rfi` - Manage RFIs\n' +
        '• `/help` - Get help and see all commands\n\n' +
        '**Natural Language:**\n' +
        'Just type normally and I\'ll help with your requests!\n\n' +
        'Try: "Show me the status of Lagos Solar project"'
      )
      .setColor(0x2196F3)
      .addFields(
        { name: 'Need Help?', value: 'Type `/help` or ask me anything!', inline: true },
        { name: 'Support', value: 'Contact your admin for assistance', inline: true }
      )
      .setFooter({ text: 'KIISHA AI Assistant • Powered by OpenClaw' })
      .setTimestamp();

    await this.sendDirectMessage(userId, { embeds: [embed] });
  }

  /**
   * Update connection status
   */
  private async updateConnectionStatus(status: string): Promise<void> {
    await db.update(discordConfigs)
      .set({
        connectionStatus: status,
        lastHeartbeat: status === 'connected' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(discordConfigs.organizationId, this.organizationId));
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.updateConnectionStatus('connected');
    }, 30000); // Every 30 seconds
  }

  /**
   * Set bot presence
   */
  private setPresence(): void {
    this.client.user?.setPresence({
      activities: [{
        name: 'KIISHA Commands',
        type: ActivityType.Listening,
      }],
      status: 'online',
    });
  }

  /**
   * Helper functions
   */
  private formatFieldName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  }

  private async getConfigId(): Promise<number> {
    const config = await db.select()
      .from(discordConfigs)
      .where(eq(discordConfigs.organizationId, this.organizationId))
      .limit(1);

    return config[0]?.id || 0;
  }

  private async getCommand(name: string): Promise<any> {
    const command = await db.select()
      .from(discordCommands)
      .where(
        and(
          eq(discordCommands.organizationId, this.organizationId),
          eq(discordCommands.name, name),
          eq(discordCommands.enabled, true)
        )
      )
      .limit(1);

    return command[0] || null;
  }

  private addCommandOption(builder: SlashCommandBuilder, option: any): void {
    switch (option.type) {
      case ApplicationCommandOptionType.String:
        builder.addStringOption(opt =>
          opt.setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required || false)
        );
        break;
      case ApplicationCommandOptionType.Integer:
        builder.addIntegerOption(opt =>
          opt.setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required || false)
        );
        break;
      case ApplicationCommandOptionType.Boolean:
        builder.addBooleanOption(opt =>
          opt.setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required || false)
        );
        break;
      // Add more option types as needed
    }
  }

  private mapPermissions(permissions: string[]): bigint {
    let permissionBits = BigInt(0);
    const permissionMap: Record<string, bigint> = {
      'admin': PermissionFlagsBits.Administrator,
      'manage_guild': PermissionFlagsBits.ManageGuild,
      'manage_channels': PermissionFlagsBits.ManageChannels,
      'manage_messages': PermissionFlagsBits.ManageMessages,
      'send_messages': PermissionFlagsBits.SendMessages,
      'embed_links': PermissionFlagsBits.EmbedLinks,
      'attach_files': PermissionFlagsBits.AttachFiles,
      'read_message_history': PermissionFlagsBits.ReadMessageHistory,
      'use_application_commands': PermissionFlagsBits.UseApplicationCommands,
    };

    for (const perm of permissions) {
      if (permissionMap[perm]) {
        permissionBits |= permissionMap[perm];
      }
    }

    return permissionBits;
  }

  // Stub implementations for remaining handlers
  private async handleCommand(message: Message, userMapping: any): Promise<void> {
    // Command handling implementation
  }

  private async handleMessageUpdate(oldMessage: any, newMessage: any): Promise<void> {
    // Message update handling
  }

  private async handleMessageDelete(message: any): Promise<void> {
    // Message delete handling
  }

  private async handleReactionAdd(reaction: any, user: any): Promise<void> {
    // Reaction handling
  }

  private async handleThreadCreate(thread: any): Promise<void> {
    // Thread creation handling
  }

  private async handleMemberJoin(member: GuildMember): Promise<void> {
    // New member handling
  }

  private async handleSelectMenuInteraction(interaction: any): Promise<void> {
    // Select menu handling
  }

  private async handleAutocomplete(interaction: any): Promise<void> {
    // Autocomplete handling
  }

  private async checkCommandPermissions(command: any, userMapping: any): Promise<boolean> {
    // Permission checking
    return true;
  }

  private async createInteractionSession(interaction: any, userMapping: any): Promise<any> {
    // Session creation
    return {};
  }

  private async executeCommand(
    command: any,
    interaction: any,
    session: any,
    userMapping: any
  ): Promise<void> {
    // Command execution
  }

  private async handleConfirmationButton(interaction: any, data: string): Promise<void> {
    // Confirmation handling
  }

  private async handleCancelButton(interaction: any, data: string): Promise<void> {
    // Cancel handling
  }

  private async handlePaginationButton(
    interaction: any,
    direction: string,
    data: string
  ): Promise<void> {
    // Pagination handling
  }

  private async handleCustomButton(
    interaction: any,
    action: string,
    data: string
  ): Promise<void> {
    // Custom button handling
  }

  private async handleWorkflowConfigModal(interaction: any): Promise<void> {
    // Workflow config handling
  }
}

// Export factory function
export function createDiscordAdapter(config: DiscordAdapterConfig): DiscordProviderAdapter {
  return new DiscordProviderAdapter(config);
}