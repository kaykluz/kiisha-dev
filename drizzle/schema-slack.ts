// Slack-specific schema extensions for KIISHA
import { pgTable, text, boolean, jsonb, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core';

// Slack workspace configurations per organization
export const slackConfigs = pgTable('slack_configs', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),

  // Slack App Configuration
  appId: text('app_id').notNull(),
  clientId: text('client_id').notNull(),
  clientSecret: text('client_secret').notNull(), // Encrypted
  signingSecret: text('signing_secret').notNull(), // Encrypted
  verificationToken: text('verification_token').notNull(), // Encrypted

  // OAuth Tokens
  botToken: text('bot_token').notNull(), // Encrypted xoxb-
  botUserId: text('bot_user_id').notNull(),
  userToken: text('user_token'), // Encrypted xoxp- (optional)

  // Workspace Information
  teamId: text('team_id').notNull(), // Slack workspace ID
  teamName: text('team_name').notNull(),
  teamDomain: text('team_domain').notNull(),

  // Channel Configuration
  defaultChannelId: text('default_channel_id'),
  alertChannelId: text('alert_channel_id'),
  announcementChannelId: text('announcement_channel_id'),

  // Feature Settings
  enableSlashCommands: boolean('enable_slash_commands').default(true),
  enableInteractiveComponents: boolean('enable_interactive_components').default(true),
  enableEventApi: boolean('enable_event_api').default(true),
  enableHomeTab: boolean('enable_home_tab').default(true),
  enableThreads: boolean('enable_threads').default(true),
  enableFiles: boolean('enable_files').default(true),
  enableReactions: boolean('enable_reactions').default(true),
  enableUnfurls: boolean('enable_unfurls').default(true),

  // Permissions & Scopes
  scopes: jsonb('scopes').$type<string[]>().default([
    'channels:history',
    'channels:read',
    'channels:write',
    'chat:write',
    'commands',
    'files:read',
    'files:write',
    'groups:history',
    'groups:read',
    'groups:write',
    'im:history',
    'im:read',
    'im:write',
    'mpim:history',
    'mpim:read',
    'mpim:write',
    'reactions:read',
    'reactions:write',
    'team:read',
    'users:read',
    'users:read.email',
  ]),

  // Rate Limiting
  rateLimits: jsonb('rate_limits').$type<{
    messagesPerMinute: number;
    eventsPerMinute: number;
    apiCallsPerMinute: number;
  }>().default({
    messagesPerMinute: 20,
    eventsPerMinute: 30,
    apiCallsPerMinute: 50,
  }),

  // Webhook URLs
  incomingWebhookUrl: text('incoming_webhook_url'),
  incomingWebhookChannel: text('incoming_webhook_channel'),
  incomingWebhookConfigUrl: text('incoming_webhook_config_url'),

  // Status
  enabled: boolean('enabled').default(false),
  connectionStatus: text('connection_status').default('disconnected'), // connected, disconnected, error
  lastActivityAt: timestamp('last_activity_at'),
  installedAt: timestamp('installed_at'),
  installedBy: integer('installed_by').references(() => users.id),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgTeamUnique: uniqueIndex('org_team_unique').on(table.organizationId, table.teamId),
}));

// Slack user mappings
export const slackUserMappings = pgTable('slack_user_mappings', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slackUserId: text('slack_user_id').notNull(), // Slack user ID (U...)
  slackTeamId: text('slack_team_id').notNull(), // Slack workspace ID (T...)

  // User information
  slackUsername: text('slack_username').notNull(),
  slackRealName: text('slack_real_name'),
  slackDisplayName: text('slack_display_name'),
  slackEmail: text('slack_email'),
  slackTimezone: text('slack_timezone'),
  slackTitle: text('slack_title'),
  slackPhone: text('slack_phone'),
  slackAvatar: text('slack_avatar'), // URL to avatar

  // Status
  isAdmin: boolean('is_admin').default(false),
  isOwner: boolean('is_owner').default(false),
  isBot: boolean('is_bot').default(false),
  isRestricted: boolean('is_restricted').default(false),
  isUltraRestricted: boolean('is_ultra_restricted').default(false),

  // Permissions
  permissions: jsonb('permissions').$type<{
    canUseCommands: boolean;
    canReceiveDMs: boolean;
    canManageWorkflows: boolean;
    canAccessReports: boolean;
    isWorkspaceAdmin: boolean;
  }>().default({
    canUseCommands: true,
    canReceiveDMs: true,
    canManageWorkflows: false,
    canAccessReports: true,
    isWorkspaceAdmin: false,
  }),

  // Verification
  verified: boolean('verified').default(false),
  verificationCode: text('verification_code'),
  verificationExpiresAt: timestamp('verification_expires_at'),

  // Activity
  active: boolean('active').default(true),
  lastInteraction: timestamp('last_interaction'),
  interactionCount: integer('interaction_count').default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  slackUserUnique: uniqueIndex('slack_user_unique').on(table.slackUserId, table.slackTeamId),
  userTeamUnique: uniqueIndex('user_team_unique').on(table.userId, table.slackTeamId),
}));

// Slack channels tracking
export const slackChannels = pgTable('slack_channels', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  configId: integer('config_id').notNull().references(() => slackConfigs.id),

  // Channel information
  channelId: text('channel_id').notNull().unique(), // Slack channel ID (C...)
  channelName: text('channel_name').notNull(),
  channelType: text('channel_type').notNull(), // public, private, im, mpim
  teamId: text('team_id').notNull(),

  // Channel settings
  purpose: text('purpose'),
  topic: text('topic'),
  isArchived: boolean('is_archived').default(false),
  isGeneral: boolean('is_general').default(false),
  isPrivate: boolean('is_private').default(false),
  isShared: boolean('is_shared').default(false),
  isExtShared: boolean('is_ext_shared').default(false),
  isOrgShared: boolean('is_org_shared').default(false),
  isMember: boolean('is_member').default(false),

  // Integration settings
  enabled: boolean('enabled').default(true),
  autoJoin: boolean('auto_join').default(false),
  postAsBot: boolean('post_as_bot').default(true),

  // Notification settings
  notificationTypes: jsonb('notification_types').$type<string[]>().default([]),

  // Members
  memberCount: integer('member_count').default(0),
  members: jsonb('members').$type<string[]>().default([]), // Slack user IDs

  // Stats
  messageCount: integer('message_count').default(0),
  lastMessageAt: timestamp('last_message_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  teamChannelUnique: uniqueIndex('team_channel_unique').on(table.teamId, table.channelId),
}));

// Slack messages
export const slackMessages = pgTable('slack_messages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  configId: integer('config_id').notNull().references(() => slackConfigs.id),

  // Message identifiers
  messageTs: text('message_ts').notNull(), // Slack timestamp ID
  channelId: text('channel_id').notNull(),
  teamId: text('team_id').notNull(),
  threadTs: text('thread_ts'), // Thread parent timestamp

  // User information
  slackUserId: text('slack_user_id').notNull(),
  slackUsername: text('slack_username').notNull(),
  userId: integer('user_id').references(() => users.id), // Mapped KIISHA user

  // Message content
  text: text('text'),
  blocks: jsonb('blocks').$type<any[]>().default([]), // Slack Block Kit
  attachments: jsonb('attachments').$type<any[]>().default([]),
  files: jsonb('files').$type<{
    id: string;
    name: string;
    title: string;
    mimetype: string;
    size: number;
    url: string;
    permalink: string;
  }[]>().default([]),

  // Message type
  type: text('type').notNull(), // message, app_mention, slash_command, interactive, event
  subtype: text('subtype'), // bot_message, file_share, thread_broadcast, etc.

  // Command/interaction data
  isCommand: boolean('is_command').default(false),
  command: text('command'),
  commandArgs: text('command_args'),
  responseUrl: text('response_url'),
  triggerId: text('trigger_id'),

  // Processing
  direction: text('direction').notNull(), // inbound, outbound
  processingStatus: text('processing_status').default('pending'), // pending, processing, completed, failed
  processedAt: timestamp('processed_at'),
  errorMessage: text('error_message'),

  // Reactions
  reactions: jsonb('reactions').$type<{
    name: string;
    users: string[];
    count: number;
  }[]>().default([]),

  // Metadata
  eventId: text('event_id'),
  eventTime: timestamp('event_time'),
  clientMsgId: text('client_msg_id'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
});

// Slack slash commands
export const slackCommands = pgTable('slack_commands', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),

  // Command definition
  command: text('command').notNull(), // e.g., /kiisha-assets
  description: text('description').notNull(),
  usageHint: text('usage_hint'), // e.g., [search query] or <asset_id>

  // Handler configuration
  handlerType: text('handler_type').notNull(), // function, webhook, workflow
  handlerFunction: text('handler_function'), // Function name if type is function
  handlerUrl: text('handler_url'), // Webhook URL if type is webhook
  handlerWorkflowId: text('handler_workflow_id'), // Workflow ID if type is workflow

  // Response configuration
  responseType: text('response_type').default('ephemeral'), // ephemeral, in_channel
  acknowledgementMessage: text('acknowledgement_message').default('Processing your request...'),

  // Permissions
  requiredRole: text('required_role'), // KIISHA role required
  allowedChannels: jsonb('allowed_channels').$type<string[]>().default([]), // Empty = all channels
  allowedUsers: jsonb('allowed_users').$type<string[]>().default([]), // Empty = all users

  // Options
  enableInDMs: boolean('enable_in_dms').default(true),
  enableInChannels: boolean('enable_in_channels').default(true),
  enableInThreads: boolean('enable_in_threads').default(true),
  requireConfirmation: boolean('require_confirmation').default(false),

  // Usage tracking
  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  lastUsedBy: text('last_used_by'),

  // Status
  enabled: boolean('enabled').default(true),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  orgCommandUnique: uniqueIndex('org_command_unique').on(table.organizationId, table.command),
}));

// Slack interactive sessions (for multi-step interactions)
export const slackInteractionSessions = pgTable('slack_interaction_sessions', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),

  // Session identifiers
  sessionId: text('session_id').notNull().unique(), // Generated session ID
  triggerId: text('trigger_id'), // Slack trigger ID (expires in 3 seconds)
  responseUrl: text('response_url'), // Response URL (expires in 30 minutes)

  // Context
  userId: integer('user_id').references(() => users.id),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  slackUserId: text('slack_user_id').notNull(),
  channelId: text('channel_id').notNull(),
  teamId: text('team_id').notNull(),

  // Interaction type
  type: text('type').notNull(), // slash_command, button, select, modal, shortcut
  command: text('command'),
  actionId: text('action_id'),
  callbackId: text('callback_id'),

  // Session state
  state: jsonb('state').$type<{
    step: number;
    data: Record<string, any>;
    pendingConfirmation?: boolean;
    confirmationId?: string;
    viewStack?: any[];
  }>().default({ step: 0, data: {} }),

  // Modal/view tracking
  viewId: text('view_id'),
  viewHash: text('view_hash'),

  // Expiration
  expiresAt: timestamp('expires_at').notNull(),
  completed: boolean('completed').default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Slack scheduled messages
export const slackScheduledMessages = pgTable('slack_scheduled_messages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),

  // Target
  channelId: text('channel_id').notNull(),
  teamId: text('team_id').notNull(),
  threadTs: text('thread_ts'), // For thread replies

  // Message content
  text: text('text'),
  blocks: jsonb('blocks').$type<any[]>().default([]),
  attachments: jsonb('attachments').$type<any[]>().default([]),

  // Schedule
  scheduledFor: timestamp('scheduled_for').notNull(),
  postAt: integer('post_at'), // Unix timestamp for Slack API
  cronExpression: text('cron_expression'), // For recurring messages
  timezone: text('timezone').default('UTC'),

  // Metadata
  createdBy: integer('created_by').notNull().references(() => users.id),
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),

  // Slack scheduling
  slackScheduledMessageId: text('slack_scheduled_message_id'), // ID from Slack API

  // Status
  status: text('status').default('pending'), // pending, scheduled, sent, failed, cancelled
  sentAt: timestamp('sent_at'),
  messageTs: text('message_ts'), // Timestamp after sending
  error: text('error'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Slack workflows (for Slack Workflow Builder integration)
export const slackWorkflows = pgTable('slack_workflows', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),

  // Workflow information
  workflowId: text('workflow_id').notNull().unique(),
  workflowName: text('workflow_name').notNull(),
  description: text('description'),

  // Trigger configuration
  triggerType: text('trigger_type').notNull(), // webhook, event, schedule, manual
  triggerConfig: jsonb('trigger_config').$type<{
    webhookUrl?: string;
    eventTypes?: string[];
    schedule?: string;
    channels?: string[];
  }>().default({}),

  // Steps
  steps: jsonb('steps').$type<{
    id: string;
    type: string;
    config: Record<string, any>;
    nextStep?: string;
  }[]>().default([]),

  // Variables
  variables: jsonb('variables').$type<{
    name: string;
    type: string;
    defaultValue?: any;
  }[]>().default([]),

  // Permissions
  requiredRole: text('required_role'),
  allowedUsers: jsonb('allowed_users').$type<string[]>().default([]),

  // Stats
  executionCount: integer('execution_count').default(0),
  lastExecutedAt: timestamp('last_executed_at'),
  lastExecutedBy: text('last_executed_by'),

  // Status
  enabled: boolean('enabled').default(true),
  published: boolean('published').default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});

// Slack app home tabs
export const slackAppHome = pgTable('slack_app_home', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  slackUserId: text('slack_user_id').notNull(),
  teamId: text('team_id').notNull(),

  // View configuration
  view: jsonb('view').$type<any>().notNull(), // Slack Block Kit view

  // User preferences
  preferences: jsonb('preferences').$type<{
    defaultProject?: number;
    defaultView?: string;
    notifications?: boolean;
    theme?: string;
  }>().default({}),

  // Stats
  lastViewedAt: timestamp('last_viewed_at'),
  viewCount: integer('view_count').default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userHomeUnique: uniqueIndex('user_home_unique').on(table.slackUserId, table.teamId),
}));