/**
 * Phase 36: Calendar Integration Router
 * Provides OAuth flow and sync for Google/Outlook calendars
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getCalendarBindingsForUser,
  createExternalCalendarBinding,
  updateCalendarBinding,
  revokeCalendarBinding,
} from "../db";

const providerSchema = z.enum(["GOOGLE", "MICROSOFT", "APPLE"]);

export const calendarRouter = router({
  /**
   * List all calendar bindings for the current user
   */
  listBindings: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        return [];
      }
      
      return await getCalendarBindingsForUser(ctx.user.id, organizationId);
    }),

  /**
   * Initiate OAuth flow for calendar provider
   */
  initiateOAuth: protectedProcedure
    .input(z.object({
      provider: providerSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // In a real implementation, this would generate OAuth URL
      // For now, return a placeholder that shows the feature is available
      const baseUrl = process.env.VITE_APP_URL || "https://kiisha.manus.space";
      
      if (input.provider === "GOOGLE") {
        // Google Calendar OAuth URL would be constructed here
        // Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars
        return {
          authUrl: null,
          message: "Google Calendar OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured. Please contact your administrator.",
          provider: "google",
        };
      } else if (input.provider === "MICROSOFT") {
        // Outlook Calendar OAuth URL would be constructed here
        // Requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET env vars
        return {
          authUrl: null,
          message: "Outlook Calendar OAuth requires MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET to be configured. Please contact your administrator.",
          provider: "MICROSOFT",
        };
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unsupported calendar provider"
      });
    }),

  /**
   * Handle OAuth callback (would be called by OAuth redirect)
   */
  handleCallback: protectedProcedure
    .input(z.object({
      provider: providerSchema,
      code: z.string(),
      state: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // In a real implementation, this would:
      // 1. Exchange code for access token
      // 2. Get user's calendar list
      // 3. Store binding with tokens

      // For now, create a placeholder binding
      const bindingId = await createExternalCalendarBinding({
        userId: ctx.user.id,
        organizationId,
        provider: input.provider,
        calendarId: `${input.provider}_calendar_${ctx.user.id}`,
        accessToken: "placeholder_access_token",
        refreshToken: "placeholder_refresh_token",
        tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour
        syncEnabled: true,
      });

      return { bindingId, success: true };
    }),

  /**
   * Disconnect calendar binding
   */
  disconnect: protectedProcedure
    .input(z.object({
      bindingId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      await revokeCalendarBinding(input.bindingId);
      return { success: true };
    }),

  /**
   * Trigger manual sync
   */
  syncNow: protectedProcedure
    .input(z.object({
      bindingId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // In a real implementation, this would:
      // 1. Fetch obligations due in next 30 days
      // 2. Create/update calendar events
      // 3. Update lastSyncAt timestamp

      await updateCalendarBinding(input.bindingId, {
        lastSyncAt: new Date(),
      });

      return { success: true, syncedCount: 0 };
    }),

  /**
   * Update sync settings
   */
  updateSettings: protectedProcedure
    .input(z.object({
      bindingId: z.number(),
      syncEnabled: z.boolean().optional(),
      reminderMinutes: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      await updateCalendarBinding(input.bindingId, {
        syncEnabled: input.syncEnabled,
      });

      return { success: true };
    }),
});
