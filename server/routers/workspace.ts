/**
 * Phase 33: Multi-Org Workspace Switching Router
 * 
 * Implements:
 * - workspace.listMemberships - returns all org memberships for current user
 * - workspace.getActive - returns currently active org context
 * - workspace.setActive - validates membership, sets session activeOrgId
 * - workspace.setDefaults - persists channel defaults
 * - workspace.resolveForChannel - server-only helper for inbound adapters
 * - workspace.generateBindingCode - creates secure workspace binding code
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { randomBytes } from "crypto";

// Resolution result type
export type WorkspaceResolution = 
  | { status: "resolved"; organizationId: number; organizationSlug: string; role: string; method: string }
  | { status: "ambiguous"; memberships: Array<{ organizationId: number; organizationName: string; role: string }> }
  | { status: "none"; reason: string };

// Generate a 6-digit numeric code
function generateBindingCode(): string {
  const num = parseInt(randomBytes(3).toString("hex"), 16) % 1000000;
  return num.toString().padStart(6, "0");
}

export const workspaceRouter = router({
  /**
   * List all org memberships for current user
   * Returns: orgId, orgName, orgSlug, role, status
   */
  listMemberships: protectedProcedure
    .query(async ({ ctx }) => {
      const memberships = await db.getActiveOrgMembershipsForUser(ctx.user.id);
      
      return memberships.map(m => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        organizationSlug: m.organizationSlug,
        role: m.role,
        status: m.status,
        isActive: ctx.user.activeOrgId === m.organizationId,
      }));
    }),

  /**
   * Get currently active org context for session
   * Returns: activeOrgId, activeOrgSlug, role, or null if none
   */
  getActive: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user.activeOrgId) {
        return null;
      }
      
      const org = await db.getOrganizationById(ctx.user.activeOrgId);
      if (!org) {
        return null;
      }
      
      const role = await db.getUserOrgRole(ctx.user.id, ctx.user.activeOrgId);
      if (!role) {
        return null;
      }
      
      return {
        activeOrgId: ctx.user.activeOrgId,
        activeOrgSlug: org.slug,
        activeOrgName: org.name,
        role,
      };
    }),

  /**
   * Set active workspace
   * Validates user is a member of org (status active)
   * Sets session activeOrgId
   */
  setActive: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      switchMethod: z.enum([
        "login_auto",
        "login_selection",
        "switcher",
        "binding_code",
        "channel_default",
        "session_restore"
      ]).default("switcher"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate membership
      const isMember = await db.isUserMemberOfOrg(ctx.user.id, input.organizationId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        });
      }
      
      // Get org details
      const org = await db.getOrganizationById(input.organizationId);
      if (!org || org.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization is not active",
        });
      }
      
      // Check 2FA requirement
      if (org.require2FA && !ctx.user.totpEnabled) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This organization requires 2FA. Please enable 2FA first.",
        });
      }
      
      const previousOrgId = ctx.user.activeOrgId;
      
      // Update user's active org
      await db.updateUserActiveOrg(ctx.user.id, input.organizationId);
      
      // Update workspace preferences (webLastActiveOrgId)
      await db.upsertUserWorkspacePreferences(ctx.user.id, {
        webLastActiveOrgId: input.organizationId,
      });
      
      // Log the switch
      await db.logWorkspaceSwitch({
        userId: ctx.user.id,
        fromOrganizationId: previousOrgId,
        toOrganizationId: input.organizationId,
        channel: "web",
        switchMethod: input.switchMethod,
      });
      
      const role = await db.getUserOrgRole(ctx.user.id, input.organizationId);
      
      return {
        success: true,
        activeOrgId: input.organizationId,
        activeOrgSlug: org.slug,
        activeOrgName: org.name,
        role,
      };
    }),

  /**
   * Set workspace defaults (channel-specific)
   * Validates membership for any orgId set
   */
  setDefaults: protectedProcedure
    .input(z.object({
      defaultOrgId: z.number().optional(),
      primaryOrgId: z.number().optional(),
      whatsappDefaultOrgId: z.number().optional(),
      emailDefaultOrgId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate all org IDs
      const orgIds = [
        input.defaultOrgId,
        input.primaryOrgId,
        input.whatsappDefaultOrgId,
        input.emailDefaultOrgId,
      ].filter((id): id is number => id !== undefined);
      
      for (const orgId of orgIds) {
        const isMember = await db.isUserMemberOfOrg(ctx.user.id, orgId);
        if (!isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Not a member of organization ${orgId}`,
          });
        }
      }
      
      // Update preferences
      await db.upsertUserWorkspacePreferences(ctx.user.id, input);
      
      return { success: true };
    }),

  /**
   * Get workspace defaults
   */
  getDefaults: protectedProcedure
    .query(async ({ ctx }) => {
      const prefs = await db.getUserWorkspacePreferences(ctx.user.id);
      return prefs || {
        defaultOrgId: null,
        primaryOrgId: null,
        whatsappDefaultOrgId: null,
        emailDefaultOrgId: null,
      };
    }),

  /**
   * Generate a secure workspace binding code
   * Used for WhatsApp/Email to bind chat to a specific workspace
   * without revealing org names
   */
  generateBindingCode: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      channel: z.enum(["whatsapp", "email"]).optional(),
      expiresInMinutes: z.number().min(5).max(60).default(15),
    }))
    .mutation(async ({ ctx, input }) => {
      // Validate membership
      const isMember = await db.isUserMemberOfOrg(ctx.user.id, input.organizationId);
      if (!isMember) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not a member of this organization",
        });
      }
      
      // Generate unique code
      let code: string;
      let attempts = 0;
      do {
        code = generateBindingCode();
        const existing = await db.getWorkspaceBindingCodeByCode(code);
        if (!existing) break;
        attempts++;
      } while (attempts < 10);
      
      if (attempts >= 10) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate unique code",
        });
      }
      
      // Create binding code
      const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);
      await db.createWorkspaceBindingCode({
        code,
        userId: ctx.user.id,
        organizationId: input.organizationId,
        channel: input.channel,
        expiresAt,
      });
      
      return {
        code,
        expiresAt,
        expiresInMinutes: input.expiresInMinutes,
        instructions: `Reply with "bind code ${code}" to bind this chat to your workspace`,
      };
    }),

  /**
   * List active binding codes for current user
   */
  listBindingCodes: protectedProcedure
    .query(async ({ ctx }) => {
      const codes = await db.getActiveBindingCodesForUser(ctx.user.id);
      return codes.map(c => ({
        code: c.code,
        organizationId: c.organizationId,
        channel: c.channel,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      }));
    }),

  /**
   * Get workspace switch history
   */
  getSwitchHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return db.getWorkspaceSwitchHistory(ctx.user.id, input.limit);
    }),
});

/**
 * Server-only helper: Resolve workspace for inbound channel message
 * Used by WhatsApp/Email adapters
 * 
 * Resolution rules (in order):
 * 1. If identifier is scoped to a specific org → that org
 * 2. Else if per-channel default exists → that org
 * 3. Else if thread already has org in conversationSessions → that org
 * 4. Else if user has exactly 1 org membership → that org
 * 5. Else → AMBIGUOUS (must ask user to choose)
 */
export async function resolveWorkspaceForChannel(
  userId: number,
  channel: "whatsapp" | "email",
  channelThreadId?: string,
  identifierOrgId?: number | null
): Promise<WorkspaceResolution> {
  // Rule 1: Identifier scoped to specific org
  if (identifierOrgId) {
    const org = await db.getOrganizationById(identifierOrgId);
    if (org && org.status === "active") {
      const role = await db.getUserOrgRole(userId, identifierOrgId);
      if (role) {
        return {
          status: "resolved",
          organizationId: identifierOrgId,
          organizationSlug: org.slug || "",
          role,
          method: "identifier_scoped",
        };
      }
    }
  }
  
  // Rule 2: Per-channel default
  const prefs = await db.getUserWorkspacePreferences(userId);
  if (prefs) {
    const defaultOrgId = channel === "whatsapp" 
      ? prefs.whatsappDefaultOrgId 
      : prefs.emailDefaultOrgId;
    
    if (defaultOrgId) {
      const org = await db.getOrganizationById(defaultOrgId);
      if (org && org.status === "active") {
        const role = await db.getUserOrgRole(userId, defaultOrgId);
        if (role) {
          return {
            status: "resolved",
            organizationId: defaultOrgId,
            organizationSlug: org.slug || "",
            role,
            method: "channel_default",
          };
        }
      }
    }
  }
  
  // Rule 3: Thread already has org in conversationSessions
  if (channelThreadId) {
    const session = await db.getConversationSessionByThread(
      userId,
      channel === "whatsapp" ? "whatsapp" : "email",
      channelThreadId
    );
    if (session?.organizationId) {
      const org = await db.getOrganizationById(session.organizationId);
      if (org && org.status === "active") {
        const role = await db.getUserOrgRole(userId, session.organizationId);
        if (role) {
          return {
            status: "resolved",
            organizationId: session.organizationId,
            organizationSlug: org.slug || "",
            role,
            method: "thread_binding",
          };
        }
      }
    }
  }
  
  // Rule 4: User has exactly 1 org membership
  const memberships = await db.getActiveOrgMembershipsForUser(userId);
  
  if (memberships.length === 0) {
    return {
      status: "none",
      reason: "User has no active organization memberships",
    };
  }
  
  if (memberships.length === 1) {
    const m = memberships[0];
    return {
      status: "resolved",
      organizationId: m.organizationId,
      organizationSlug: m.organizationSlug || "",
      role: m.role,
      method: "single_org",
    };
  }
  
  // Rule 5: AMBIGUOUS
  return {
    status: "ambiguous",
    memberships: memberships.map(m => ({
      organizationId: m.organizationId,
      organizationName: m.organizationName || "",
      role: m.role,
    })),
  };
}

/**
 * Server-only helper: Validate and use a binding code
 * Returns the resolved workspace or null if invalid
 */
export async function useBindingCode(
  code: string,
  userId: number,
  channel: "whatsapp" | "email",
  identifier: string
): Promise<{ organizationId: number; organizationSlug: string; role: string } | null> {
  const binding = await db.getWorkspaceBindingCodeByCode(code);
  
  if (!binding) {
    return null;
  }
  
  // Check if already used
  if (binding.usedAt) {
    return null;
  }
  
  // Check if expired
  if (new Date() > binding.expiresAt) {
    return null;
  }
  
  // Check if user matches
  if (binding.userId !== userId) {
    return null;
  }
  
  // Check if channel matches (if specified)
  if (binding.channel && binding.channel !== channel) {
    return null;
  }
  
  // Mark as used
  await db.markWorkspaceBindingCodeUsed(code, channel, identifier);
  
  // Get org details
  const org = await db.getOrganizationById(binding.organizationId);
  if (!org) {
    return null;
  }
  
  const role = await db.getUserOrgRole(userId, binding.organizationId);
  if (!role) {
    return null;
  }
  
  return {
    organizationId: binding.organizationId,
    organizationSlug: org.slug || "",
    role,
  };
}

export type WorkspaceRouter = typeof workspaceRouter;
