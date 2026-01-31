// Discord integration router for KIISHA
import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import {
  discordConfigs,
  discordUserMappings,
  discordMessages,
  discordCommands,
  discordScheduledMessages,
} from '~/drizzle/schema-discord';
import { createDiscordAdapter } from '../providers/adapters/discord/discord';
import crypto from 'crypto';

// Active Discord adapters
const activeAdapters = new Map<number, any>();

export const discordRouter = router({
  // Get Discord configuration for organization
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await db.select()
        .from(discordConfigs)
        .where(eq(discordConfigs.organizationId, ctx.session.organizationId))
        .limit(1);

      return config[0] || null;
    }),

  // Configure Discord integration
  configure: adminProcedure
    .input(z.object({
      botToken: z.string().min(1),
      applicationId: z.string().min(1),
      publicKey: z.string().min(1),
      guildId: z.string().min(1),
      primaryChannelId: z.string().optional(),
      alertChannelId: z.string().optional(),
      commandPrefix: z.string().default('!kiisha'),
      enableSlashCommands: z.boolean().default(true),
      enableDirectMessages: z.boolean().default(false),
      enableThreads: z.boolean().default(true),
      allowedRoles: z.array(z.string()).default([]),
      adminRoles: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.organizationId;

      // Check if config exists
      const existing = await db.select()
        .from(discordConfigs)
        .where(eq(discordConfigs.organizationId, organizationId))
        .limit(1);

      // Encrypt bot token
      const encryptedToken = encryptData(input.botToken);

      const configData = {
        organizationId,
        botToken: encryptedToken,
        applicationId: input.applicationId,
        publicKey: input.publicKey,
        guildId: input.guildId,
        primaryChannelId: input.primaryChannelId,
        alertChannelId: input.alertChannelId,
        commandPrefix: input.commandPrefix,
        enableSlashCommands: input.enableSlashCommands,
        enableDirectMessages: input.enableDirectMessages,
        enableThreads: input.enableThreads,
        allowedRoles: input.allowedRoles,
        adminRoles: input.adminRoles,
        enabled: true,
        createdBy: ctx.session.user.id,
        updatedAt: new Date(),
      };

      let config;
      if (existing.length > 0) {
        // Update existing
        [config] = await db.update(discordConfigs)
          .set(configData)
          .where(eq(discordConfigs.id, existing[0].id))
          .returning();
      } else {
        // Insert new
        [config] = await db.insert(discordConfigs)
          .values({
            ...configData,
            createdAt: new Date(),
          })
          .returning();
      }

      // Initialize Discord adapter
      await initializeDiscordAdapter(config);

      return config;
    }),

  // Connect Discord bot
  connect: adminProcedure
    .mutation(async ({ ctx }) => {
      const organizationId = ctx.session.organizationId;

      // Get config
      const [config] = await db.select()
        .from(discordConfigs)
        .where(eq(discordConfigs.organizationId, organizationId))
        .limit(1);

      if (!config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Discord configuration not found',
        });
      }

      // Initialize and connect adapter
      const adapter = await initializeDiscordAdapter(config);
      await adapter.connect();

      // Update status
      await db.update(discordConfigs)
        .set({
          connectionStatus: 'connected',
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(discordConfigs.id, config.id));

      return { success: true, message: 'Discord bot connected successfully' };
    }),

  // Disconnect Discord bot
  disconnect: adminProcedure
    .mutation(async ({ ctx }) => {
      const organizationId = ctx.session.organizationId;

      // Get adapter
      const adapter = activeAdapters.get(organizationId);
      if (adapter) {
        await adapter.disconnect();
        activeAdapters.delete(organizationId);
      }

      // Update status
      await db.update(discordConfigs)
        .set({
          connectionStatus: 'disconnected',
          updatedAt: new Date(),
        })
        .where(eq(discordConfigs.organizationId, organizationId));

      return { success: true, message: 'Discord bot disconnected' };
    }),

  // Get connection status
  getStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const config = await db.select()
        .from(discordConfigs)
        .where(eq(discordConfigs.organizationId, ctx.session.organizationId))
        .limit(1);

      if (!config[0]) {
        return { configured: false, connected: false };
      }

      return {
        configured: true,
        connected: config[0].connectionStatus === 'connected',
        lastHeartbeat: config[0].lastHeartbeat,
        guildId: config[0].guildId,
        commandPrefix: config[0].commandPrefix,
      };
    }),

  // Initiate user verification
  initiateVerification: protectedProcedure
    .input(z.object({
      discordUserId: z.string().min(1),
      discordUsername: z.string().min(1),
      guildId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Check if mapping exists
      const existing = await db.select()
        .from(discordUserMappings)
        .where(
          and(
            eq(discordUserMappings.userId, ctx.session.user.id),
            eq(discordUserMappings.discordUserId, input.discordUserId),
            eq(discordUserMappings.guildId, input.guildId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db.update(discordUserMappings)
          .set({
            verificationCode,
            verificationExpiresAt: expiresAt,
            verified: false,
            updatedAt: new Date(),
          })
          .where(eq(discordUserMappings.id, existing[0].id));
      } else {
        // Create new
        await db.insert(discordUserMappings)
          .values({
            userId: ctx.session.user.id,
            discordUserId: input.discordUserId,
            discordUsername: input.discordUsername,
            guildId: input.guildId,
            verified: false,
            verificationCode,
            verificationExpiresAt: expiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
      }

      return { verificationCode, expiresAt };
    }),

  // Get user mappings
  getUserMappings: protectedProcedure
    .query(async ({ ctx }) => {
      const mappings = await db.select()
        .from(discordUserMappings)
        .where(eq(discordUserMappings.userId, ctx.session.user.id));

      return mappings;
    }),

  // Revoke Discord access
  revokeAccess: protectedProcedure
    .input(z.object({
      mappingId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(discordUserMappings)
        .where(
          and(
            eq(discordUserMappings.id, input.mappingId),
            eq(discordUserMappings.userId, ctx.session.user.id)
          )
        );

      return { success: true };
    }),

  // Get recent messages
  getRecentMessages: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      channelId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await db.select()
        .from(discordMessages)
        .where(
          and(
            eq(discordMessages.organizationId, ctx.session.organizationId),
            input.channelId ? eq(discordMessages.channelId, input.channelId) : undefined
          )
        )
        .orderBy(desc(discordMessages.createdAt))
        .limit(input.limit);

      return messages;
    }),

  // Send message
  sendMessage: protectedProcedure
    .input(z.object({
      channelId: z.string().min(1),
      content: z.string().optional(),
      embeds: z.array(z.any()).optional(),
      components: z.array(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.organizationId;
      const adapter = activeAdapters.get(organizationId);

      if (!adapter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Discord bot not connected',
        });
      }

      await adapter.sendMessage(input.channelId, {
        content: input.content,
        embeds: input.embeds,
        components: input.components,
      });

      return { success: true };
    }),

  // Send notification
  sendNotification: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string(),
      color: z.number().optional(),
      fields: z.array(z.object({
        name: z.string(),
        value: z.string(),
        inline: z.boolean().optional(),
      })).optional(),
      channelId: z.string().optional(),
      userId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.organizationId;
      const adapter = activeAdapters.get(organizationId);

      if (!adapter) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Discord bot not connected',
        });
      }

      await adapter.sendNotification(input);

      return { success: true };
    }),

  // Manage commands
  commands: router({
    // List commands
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const commands = await db.select()
          .from(discordCommands)
          .where(eq(discordCommands.organizationId, ctx.session.organizationId));

        return commands;
      }),

    // Create command
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(32),
        description: z.string().min(1).max(100),
        category: z.string(),
        options: z.array(z.any()).optional(),
        requiredRole: z.string().optional(),
        requiredPermissions: z.array(z.string()).optional(),
        handlerFunction: z.string(),
        confirmationRequired: z.boolean().default(false),
        global: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const [command] = await db.insert(discordCommands)
          .values({
            organizationId: ctx.session.organizationId,
            ...input,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // Re-register commands with Discord
        await registerCommands(ctx.session.organizationId);

        return command;
      }),

    // Update command
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [command] = await db.update(discordCommands)
          .set({
            ...input,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(discordCommands.id, input.id),
              eq(discordCommands.organizationId, ctx.session.organizationId)
            )
          )
          .returning();

        // Re-register commands with Discord
        await registerCommands(ctx.session.organizationId);

        return command;
      }),

    // Delete command
    delete: adminProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.delete(discordCommands)
          .where(
            and(
              eq(discordCommands.id, input.id),
              eq(discordCommands.organizationId, ctx.session.organizationId)
            )
          );

        // Re-register commands with Discord
        await registerCommands(ctx.session.organizationId);

        return { success: true };
      }),
  }),

  // Schedule message
  scheduleMessage: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      content: z.string().optional(),
      embeds: z.array(z.any()).optional(),
      scheduledFor: z.date(),
      cronExpression: z.string().optional(),
      timezone: z.string().default('UTC'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [scheduled] = await db.insert(discordScheduledMessages)
        .values({
          organizationId: ctx.session.organizationId,
          guildId: await getGuildId(ctx.session.organizationId),
          channelId: input.channelId,
          content: input.content,
          embeds: input.embeds || [],
          scheduledFor: input.scheduledFor,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          createdBy: ctx.session.user.id,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return scheduled;
    }),

  // Get scheduled messages
  getScheduledMessages: protectedProcedure
    .query(async ({ ctx }) => {
      const scheduled = await db.select()
        .from(discordScheduledMessages)
        .where(
          and(
            eq(discordScheduledMessages.organizationId, ctx.session.organizationId),
            eq(discordScheduledMessages.status, 'pending')
          )
        )
        .orderBy(discordScheduledMessages.scheduledFor);

      return scheduled;
    }),

  // Cancel scheduled message
  cancelScheduledMessage: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.update(discordScheduledMessages)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(discordScheduledMessages.id, input.id),
            eq(discordScheduledMessages.organizationId, ctx.session.organizationId)
          )
        );

      return { success: true };
    }),
});

// Helper functions
async function initializeDiscordAdapter(config: any) {
  const decryptedToken = decryptData(config.botToken);

  const adapter = createDiscordAdapter({
    botToken: decryptedToken,
    applicationId: config.applicationId,
    publicKey: config.publicKey,
    guildId: config.guildId,
    organizationId: config.organizationId,
    commandPrefix: config.commandPrefix,
  });

  activeAdapters.set(config.organizationId, adapter);

  return adapter;
}

async function registerCommands(organizationId: number) {
  const adapter = activeAdapters.get(organizationId);
  if (adapter) {
    await adapter.registerSlashCommands();
  }
}

async function getGuildId(organizationId: number): Promise<string> {
  const [config] = await db.select()
    .from(discordConfigs)
    .where(eq(discordConfigs.organizationId, organizationId))
    .limit(1);

  return config?.guildId || '';
}

// Encryption helpers (use your existing encryption service)
function encryptData(data: string): string {
  // Placeholder - use your actual encryption
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-byte-key-here...........', 'utf8');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptData(encrypted: string): string {
  // Placeholder - use your actual decryption
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || 'your-32-byte-key-here...........', 'utf8');

  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}