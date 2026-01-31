// Discord-specific schema extensions
import { pgTable, text, boolean, jsonb, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Discord bot configurations per organization
export const discordConfigs = pgTable('discord_configs', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Discord Bot Configuration
  botToken: text('bot_token').notNull(), // Encrypted bot token
  applicationId: text('application_id').notNull(),
  publicKey: text('public_key').notNull(), // For webhook verification

  // Guild (Server) Settings
  guildId: text('guild_id').notNull(), // Discord server ID
  primaryChannelId: text('primary_channel_id'), // Main channel for notifications
  alertChannelId: text('alert_channel_id'), // Channel for alerts
  commandPrefix: text('command_prefix').default('!kiisha'),

  // Feature Toggles
  enableSlashCommands: boolean('enable_slash_commands').default(true),
  enableDirectMessages: boolean('enable_direct_messages').default(false),
  enableThreads: boolean('enable_threads').default(true),
  enableReactions: boolean('enable_reactions').default(true),

  // Permissions & Roles
  allowedRoles: jsonb('allowed_roles').$type<string[]>().default([]), // Discord role IDs
  adminRoles: jsonb('admin_roles').$type<string[]>().default([]),

  // Rate Limiting
  rateLimits: jsonb('rate_limits').$type<{
    messagesPerMinute: number;
    commandsPerHour: number;
    embedsPerMessage: number;
  }>().default({
    messagesPerMinute: 10,
    commandsPerHour: 100,
    embedsPerMessage: 3
  }),

  // Webhook Configuration
  webhookUrl: text('webhook_url'), // For outbound messages
  webhookSecret: text('webhook_secret'),

  // Status
  enabled: boolean('enabled').default(false),
  connectionStatus: text('connection_status').default('disconnected'), // connected, disconnected, error
  lastHeartbeat: timestamp('last_heartbeat'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
}, (table) => ({
  orgGuildUnique: uniqueIndex('org_guild_unique').on(table.organizationId, table.guildId),
}));

// Discord user mappings
export const discordUserMappings = pgTable('discord_user_mappings', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  discordUserId: text('discord_user_id').notNull(), // Discord snowflake ID
  discordUsername: text('discord_username').notNull(),
  discordDiscriminator: text('discord_discriminator'), // Legacy discriminator (if exists)
  discordGlobalName: text('discord_global_name'), // New global username

  // Guild-specific information
  guildId: text('guild_id').notNull(),
  guildNickname: text('guild_nickname'),
  guildRoles: jsonb('guild_roles').$type<string[]>().default([]),

  // Verification
  verified: boolean('verified').default(false),
  verificationCode: text('verification_code'),
  verificationExpiresAt: timestamp('verification_expires_at'),

  // Permissions cache
  permissions: jsonb('permissions').$type<{
    canUseCommands: boolean;
    canReceiveDMs: boolean;
    canManageWorkflows: boolean;
    isAdmin: boolean;
  }>().default({
    canUseCommands: true,
    canReceiveDMs: false,
    canManageWorkflows: false,
    isAdmin: false
  }),

  // Status
  active: boolean('active').default(true),
  lastInteraction: timestamp('last_interaction'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  discordUserUnique: uniqueIndex('discord_user_unique').on(table.discordUserId, table.guildId),
}));

// Discord messages
export const discordMessages = pgTable('discord_messages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  configId: integer('config_id').notNull().references(() => discordConfigs.id),

  // Discord message identifiers
  messageId: text('message_id').notNull().unique(), // Discord snowflake
  channelId: text('channel_id').notNull(),
  guildId: text('guild_id').notNull(),
  threadId: text('thread_id'), // If in a thread

  // Author information
  authorId: text('author_id').notNull(), // Discord user ID
  authorUsername: text('author_username').notNull(),
  userId: integer('user_id').references(() => users.id), // Mapped KIISHA user

  // Message content
  content: text('content'),
  embeds: jsonb('embeds').$type<any[]>().default([]),
  attachments: jsonb('attachments').$type<{
    id: string;
    filename: string;
    size: number;
    url: string;
    contentType: string;
  }[]>().default([]),

  // Message type and context
  type: text('type').notNull(), // text, command, embed, reply, thread_starter
  isCommand: boolean('is_command').default(false),
  commandName: text('command_name'),
  commandArgs: jsonb('command_args').$type<Record<string, any>>(),

  // Reply context
  replyToMessageId: text('reply_to_message_id'),
  replyToUserId: text('reply_to_user_id'),

  // Processing
  direction: text('direction').notNull(), // inbound, outbound
  processingStatus: text('processing_status').default('pending'), // pending, processing, completed, failed
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),

  // Reactions
  reactions: jsonb('reactions').$type<{
    emoji: string;
    count: number;
    users: string[];
  }[]>().default([]),

  // Metadata
  webhookId: text('webhook_id'), // If sent via webhook
  applicationId: text('application_id'), // If from bot/app
  interactionId: text('interaction_id'), // If from interaction

  createdAt: timestamp('created_at').notNull().defaultNow(),
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
});

// Discord slash commands registry
export const discordCommands = pgTable('discord_commands', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),

  // Command definition
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // asset, project, document, rfi, workflow

  // Command structure
  options: jsonb('options').$type<{
    name: string;
    description: string;
    type: number; // Discord ApplicationCommandOptionType
    required?: boolean;
    choices?: { name: string; value: string }[];
    options?: any[]; // Nested options for subcommands
  }[]>().default([]),

  // Permissions
  requiredRole: text('required_role'), // KIISHA role: viewer, member, admin
  requiredPermissions: jsonb('required_permissions').$type<string[]>().default([]),
  guildIds: jsonb('guild_ids').$type<string[]>().default([]), // Specific guilds

  // Handler
  handlerFunction: text('handler_function').notNull(), // Function name in handler
  confirmationRequired: boolean('confirmation_required').default(false),

  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  lastUsedBy: text('last_used_by'), // Discord user ID

  // Status
  enabled: boolean('enabled').default(true),
  global: boolean('global').default(false), // Global or guild command

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgCommandUnique: uniqueIndex('org_command_unique').on(table.organizationId, table.name),
}));

// Discord interaction sessions (for multi-step interactions)
export const discordInteractionSessions = pgTable('discord_interaction_sessions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  interactionId: text('interaction_id').notNull().unique(),

  // Session context
  userId: integer('user_id').references(() => users.id),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  discordUserId: text('discord_user_id').notNull(),
  channelId: text('channel_id').notNull(),
  guildId: text('guild_id').notNull(),

  // Interaction type
  type: text('type').notNull(), // command, button, select_menu, modal
  commandName: text('command_name'),
  customId: text('custom_id'), // For components

  // Session state
  state: jsonb('state').$type<{
    step: number;
    data: Record<string, any>;
    pendingConfirmation?: boolean;
    confirmationId?: string;
  }>().default({ step: 0, data: {} }),

  // Response tracking
  responses: jsonb('responses').$type<{
    timestamp: string;
    content: string;
    ephemeral: boolean;
  }[]>().default([]),

  // Expiration
  expiresAt: timestamp('expires_at').notNull(),
  completed: boolean('completed').default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Discord scheduled messages
export const discordScheduledMessages = pgTable('discord_scheduled_messages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),

  // Target
  channelId: text('channel_id').notNull(),
  guildId: text('guild_id').notNull(),
  threadId: text('thread_id'),

  // Message content
  content: text('content'),
  embeds: jsonb('embeds').$type<any[]>().default([]),
  components: jsonb('components').$type<any[]>().default([]), // Buttons, selects

  // Schedule
  scheduledFor: timestamp('scheduled_for').notNull(),
  cronExpression: text('cron_expression'), // For recurring
  timezone: text('timezone').default('UTC'),

  // Metadata
  createdBy: integer('created_by').notNull().references(() => users.id),
  tags: jsonb('tags').$type<string[]>().default([]),

  // Status
  status: text('status').default('pending'), // pending, sent, failed, cancelled
  sentAt: timestamp('sent_at'),
  messageId: text('message_id'), // After sending
  error: text('error'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});