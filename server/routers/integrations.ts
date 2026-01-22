/**
 * Integrations Router
 * 
 * API endpoints for managing organization integrations.
 */

import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { 
  getOrgIntegrations, 
  upsertIntegration, 
  testIntegration, 
  disconnectIntegration,
  getActiveIntegration,
} from '../providers/factory';
import { CAPABILITY_REGISTRY, PROVIDER_OPTIONS } from '../../shared/providers/types';
import type { IntegrationType, ProviderIdentifier } from '../../shared/providers/types';
import { maskSecret } from '../providers/secrets';
import { getDb } from '../db';
import { organizationMembers } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// Helper to check if user is org admin
async function checkOrgAdmin(userId: number, orgId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const membership = await db.select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, orgId)
      )
    )
    .limit(1);
  
  return membership.length > 0 && membership[0].role === 'admin';
}

export const integrationsRouter = router({
  // Get capability registry
  getCapabilities: protectedProcedure
    .query(() => {
      return CAPABILITY_REGISTRY;
    }),
  
  // Get provider options for a capability
  getProviderOptions: protectedProcedure
    .input(z.object({
      integrationType: z.enum(['storage', 'llm', 'email_ingest', 'whatsapp', 'notify', 'observability', 'maps']),
    }))
    .query(({ input }) => {
      return PROVIDER_OPTIONS[input.integrationType] || [];
    }),
  
  // Get all integrations for an organization
  list: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this org
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable' });
      
      const membership = await db.select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, ctx.user.id),
            eq(organizationMembers.organizationId, input.organizationId)
          )
        )
        .limit(1);
      
      if (membership.length === 0) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this organization' });
      }
      
      const integrations = await getOrgIntegrations(input.organizationId);
      
      // Build status map for all integration types
      const statusMap: Record<string, {
        configured: boolean;
        provider?: string;
        status?: string;
        lastTestAt?: Date | null;
        lastTestSuccess?: boolean | null;
      }> = {};
      
      for (const type of Object.keys(CAPABILITY_REGISTRY) as IntegrationType[]) {
        const integration = integrations.find(i => i.integrationType === type);
        statusMap[type] = {
          configured: !!integration && integration.status === 'connected',
          provider: integration?.provider,
          status: integration?.status,
          lastTestAt: integration?.lastTestAt,
          lastTestSuccess: integration?.lastTestSuccess,
        };
      }
      
      return {
        integrations,
        statusMap,
      };
    }),
  
  // Get integration details
  get: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      integrationType: z.enum(['storage', 'llm', 'email_ingest', 'whatsapp', 'notify', 'observability', 'maps']),
    }))
    .query(async ({ ctx, input }) => {
      const isAdmin = await checkOrgAdmin(ctx.user.id, input.organizationId);
      if (!isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only org admins can view integration details' });
      }
      
      const integration = await getActiveIntegration(input.organizationId, input.integrationType);
      
      if (!integration) {
        return null;
      }
      
      // Don't expose actual secrets, just indicate they exist
      return {
        ...integration,
        hasSecrets: !!integration.secretRef,
        webhookSecret: integration.webhookSecret ? maskSecret(integration.webhookSecret) : undefined,
        verifyToken: integration.verifyToken ? maskSecret(integration.verifyToken) : undefined,
      };
    }),
  
  // Configure an integration
  configure: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      integrationType: z.enum(['storage', 'llm', 'email_ingest', 'whatsapp', 'notify', 'observability', 'maps']),
      provider: z.string(),
      config: z.record(z.string(), z.unknown()),
      secrets: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await checkOrgAdmin(ctx.user.id, input.organizationId);
      if (!isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only org admins can configure integrations' });
      }
      
      // Validate provider is valid for this integration type
      const providerOptions = PROVIDER_OPTIONS[input.integrationType];
      const validProvider = providerOptions?.some(p => p.id === input.provider);
      
      if (!validProvider) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Invalid provider '${input.provider}' for ${input.integrationType}` 
        });
      }
      
      const result = await upsertIntegration(
        input.organizationId,
        input.integrationType,
        input.provider as ProviderIdentifier,
        input.config as Record<string, unknown>,
        input.secrets,
        ctx.user.id
      );
      
      return {
        integration: result.integration,
        webhookConfig: result.webhookConfig,
      };
    }),
  
  // Test an integration connection
  test: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      integrationType: z.enum(['storage', 'llm', 'email_ingest', 'whatsapp', 'notify', 'observability', 'maps']),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await checkOrgAdmin(ctx.user.id, input.organizationId);
      if (!isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only org admins can test integrations' });
      }
      
      const result = await testIntegration(input.organizationId, input.integrationType);
      
      return result;
    }),
  
  // Disconnect an integration
  disconnect: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      integrationType: z.enum(['storage', 'llm', 'email_ingest', 'whatsapp', 'notify', 'observability', 'maps']),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await checkOrgAdmin(ctx.user.id, input.organizationId);
      if (!isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only org admins can disconnect integrations' });
      }
      
      await disconnectIntegration(input.organizationId, input.integrationType, ctx.user.id);
      
      return { success: true };
    }),
  
  // Get webhook info for an integration
  getWebhookInfo: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      integrationType: z.enum(['email_ingest', 'whatsapp']),
    }))
    .query(async ({ ctx, input }) => {
      const isAdmin = await checkOrgAdmin(ctx.user.id, input.organizationId);
      if (!isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only org admins can view webhook info' });
      }
      
      const integration = await getActiveIntegration(input.organizationId, input.integrationType);
      
      if (!integration) {
        return null;
      }
      
      return {
        webhookUrl: integration.webhookUrl,
        verifyToken: integration.verifyToken, // Full token for setup
        // Don't expose webhook secret - it's for signature verification only
      };
    }),
});
