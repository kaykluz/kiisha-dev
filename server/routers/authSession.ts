/**
 * Phase 35: Auth Session Router
 * 
 * Single source of truth for authentication state.
 * All auth-related endpoints for the frontend boot sequence.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as sessionManager from "../services/sessionManager";
import { COOKIE_NAME } from "@shared/const";
import type { Response } from "express";

// Session state response type
export interface SessionState {
  authenticated: boolean;
  mfaRequired: boolean;
  mfaSatisfied: boolean;
  workspaceRequired: boolean;
  user: {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    role: string;
  } | null;
  activeOrganizationId: number | null;
  activeOrganization: {
    id: number;
    name: string;
    slug: string | null;
    logoUrl: string | null;
  } | null;
  workspaceCount: number;
  sessionId: string | null;
}

// Cookie options for session cookie
const getSessionCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export const authSessionRouter = router({
  /**
   * Get current session state - THE SINGLE SOURCE OF TRUTH
   * 
   * This is the first call the frontend makes on boot.
   * Returns complete auth state including:
   * - Whether user is authenticated
   * - Whether MFA is required and satisfied
   * - Whether workspace selection is required
   * - User info (if authenticated)
   * - Active organization (if selected)
   * - Number of workspaces user has access to
   */
  getSession: publicProcedure.query(async ({ ctx }): Promise<SessionState> => {
    // Default unauthenticated state
    const unauthenticated: SessionState = {
      authenticated: false,
      mfaRequired: false,
      mfaSatisfied: false,
      workspaceRequired: false,
      user: null,
      activeOrganizationId: null,
      activeOrganization: null,
      workspaceCount: 0,
      sessionId: null,
    };

    // Get session cookie
    const sessionId = ctx.req?.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return unauthenticated;
    }

    // Validate session
    const validation = await sessionManager.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      return unauthenticated;
    }

    const session = validation.session;

    // Get user
    const user = await db.getUserById(session.userId);
    if (!user) {
      return unauthenticated;
    }

    // Check MFA requirements
    const mfaRequired = await sessionManager.sessionRequiresMfa(session);
    const mfaSatisfied = !!session.mfaSatisfiedAt;

    // Get workspace count
    const memberships = await db.getUserOrganizationMemberships(user.id);
    const activeMembers = memberships.filter(m => m.status === "active");
    const workspaceCount = activeMembers.length;

    // Determine if workspace selection is required
    const workspaceRequired = !session.activeOrganizationId && workspaceCount > 1;

    // Get active organization if set
    let activeOrganization = null;
    if (session.activeOrganizationId) {
      const org = await db.getOrganizationById(session.activeOrganizationId);
      if (org) {
        activeOrganization = {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
        };
      }
    }

    return {
      authenticated: true,
      mfaRequired,
      mfaSatisfied: mfaRequired ? mfaSatisfied : true,
      workspaceRequired,
      user: {
        id: user.id,
        openId: user.openId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      activeOrganizationId: session.activeOrganizationId,
      activeOrganization,
      workspaceCount,
      sessionId,
    };
  }),

  /**
   * List available workspaces for the current user
   * Only returns minimal info - no sensitive org data until selected
   */
  listWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.getUserOrganizationMemberships(ctx.user.id);
    const activeMembers = memberships.filter(m => m.status === "active");

    const workspaces = await Promise.all(
      activeMembers.map(async (member) => {
        const org = await db.getOrganizationById(member.organizationId);
        return org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          role: member.role,
        } : null;
      })
    );

    return workspaces.filter(Boolean);
  }),

  /**
   * Select a workspace (set active organization)
   */
  selectWorkspace: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has membership in this org
      const memberships = await db.getOrganizationMemberships(ctx.user.id);
      const membership = memberships.find(m => m.organizationId === input.organizationId);
      if (!membership || membership.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this workspace",
        });
      }

      // Get session ID from cookie
      const sessionId = ctx.req?.cookies?.[COOKIE_NAME];
      if (!sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session",
        });
      }

      // Update session with active org
      await sessionManager.setActiveOrganization(sessionId, ctx.user.id, input.organizationId);

      // Get org info for response
      const org = await db.getOrganizationById(input.organizationId);

      return {
        success: true,
        activeOrganization: org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
        } : null,
      };
    }),

  /**
   * Logout - revoke current session
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionId = ctx.req?.cookies?.[COOKIE_NAME];
    if (sessionId) {
      await sessionManager.revokeSessionById(sessionId, ctx.user.id, "logout");
    }

    // Clear cookie
    if (ctx.res) {
      (ctx.res as Response).clearCookie(COOKIE_NAME, { path: "/" });
    }

    return { success: true };
  }),

  /**
   * Logout from all devices
   */
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    const currentSessionId = ctx.req?.cookies?.[COOKIE_NAME];
    
    // Revoke all sessions except current (optional - could revoke all)
    const count = await sessionManager.revokeAllSessions(
      ctx.user.id,
      "logout_all",
      currentSessionId // Keep current session
    );

    return { 
      success: true, 
      revokedCount: count,
    };
  }),

  /**
   * Get active sessions for current user (session management UI)
   */
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await sessionManager.getUserSessions(ctx.user.id);
    const currentSessionId = ctx.req?.cookies?.[COOKIE_NAME];

    return sessions.map(s => ({
      id: s.id,
      isCurrent: s.id === currentSessionId,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      deviceType: s.deviceType,
      browserName: s.browserName,
      osName: s.osName,
      activeOrganizationId: s.activeOrganizationId,
    }));
  }),

  /**
   * Revoke a specific session
   */
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the session belongs to this user
      const session = await db.getSessionById(input.sessionId);
      if (!session || session.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      await sessionManager.revokeSessionById(input.sessionId, ctx.user.id, "user_revoked");

      return { success: true };
    }),

  /**
   * Get auth audit log for current user
   */
  getAuthHistory: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const events = await sessionManager.getUserAuthEvents(ctx.user.id, input?.limit ?? 50);
      
      return events.map(e => ({
        id: e.id,
        eventType: e.eventType,
        success: e.success,
        failureReason: e.failureReason,
        createdAt: e.createdAt,
        // Don't expose IP/UA hashes to user
      }));
    }),
});

export type AuthSessionRouter = typeof authSessionRouter;
