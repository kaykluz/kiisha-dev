/**
 * Phase 38: Request Reminders Router
 * 
 * Provides automated reminder scheduling and management for requests.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

// Reminder type enum
const reminderTypeSchema = z.enum(["3_days", "1_day", "overdue", "custom"]);

export const requestRemindersRouter = router({
  /**
   * Get reminder settings for the organization
   */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.user.activeOrgId;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active organization selected"
      });
    }

    const settings = await db.getReminderSettings(organizationId);
    
    // Return defaults if no settings exist
    if (!settings) {
      return {
        remindersEnabled: true,
        firstReminderDays: 3,
        secondReminderDays: 1,
        overdueReminderEnabled: true,
        customReminderDays: null,
      };
    }

    return settings;
  }),

  /**
   * Update reminder settings for the organization
   */
  updateSettings: protectedProcedure
    .input(z.object({
      remindersEnabled: z.boolean().optional(),
      firstReminderDays: z.number().min(1).max(30).optional(),
      secondReminderDays: z.number().min(1).max(30).optional(),
      overdueReminderEnabled: z.boolean().optional(),
      customReminderDays: z.array(z.number().min(1).max(90)).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      await db.upsertReminderSettings({
        organizationId,
        ...input,
        updatedBy: ctx.user.id,
      });

      return { success: true };
    }),

  /**
   * Get reminders for a specific request
   */
  getForRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await db.getRemindersForRequest(input.requestId);
    }),

  /**
   * Schedule reminders for a request based on due date
   */
  scheduleForRequest: protectedProcedure
    .input(z.object({
      requestId: z.number(),
      recipientUserId: z.number(),
      dueDate: z.date(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Get reminder settings
      const settings = await db.getReminderSettings(organizationId);
      const firstDays = settings?.firstReminderDays ?? 3;
      const secondDays = settings?.secondReminderDays ?? 1;
      const overdueEnabled = settings?.overdueReminderEnabled ?? true;

      const reminders: Array<{ type: "3_days" | "1_day" | "overdue" | "custom"; scheduledFor: Date }> = [];

      // Calculate reminder dates
      const dueDate = new Date(input.dueDate);
      const now = new Date();

      // First reminder (e.g., 3 days before)
      const firstReminderDate = new Date(dueDate);
      firstReminderDate.setDate(firstReminderDate.getDate() - firstDays);
      if (firstReminderDate > now) {
        reminders.push({ type: "3_days", scheduledFor: firstReminderDate });
      }

      // Second reminder (e.g., 1 day before)
      const secondReminderDate = new Date(dueDate);
      secondReminderDate.setDate(secondReminderDate.getDate() - secondDays);
      if (secondReminderDate > now) {
        reminders.push({ type: "1_day", scheduledFor: secondReminderDate });
      }

      // Overdue reminder (1 day after due)
      if (overdueEnabled) {
        const overdueDate = new Date(dueDate);
        overdueDate.setDate(overdueDate.getDate() + 1);
        reminders.push({ type: "overdue", scheduledFor: overdueDate });
      }

      // Custom reminders
      if (settings?.customReminderDays) {
        for (const days of settings.customReminderDays) {
          const customDate = new Date(dueDate);
          customDate.setDate(customDate.getDate() - days);
          if (customDate > now) {
            reminders.push({ type: "custom", scheduledFor: customDate });
          }
        }
      }

      // Create reminder records
      const createdIds: number[] = [];
      for (const reminder of reminders) {
        const id = await db.createRequestReminder({
          organizationId,
          requestId: input.requestId,
          recipientUserId: input.recipientUserId,
          reminderType: reminder.type,
          scheduledFor: reminder.scheduledFor,
          status: "pending",
        });
        if (id) createdIds.push(id);
      }

      return { scheduledCount: createdIds.length, reminderIds: createdIds };
    }),

  /**
   * Cancel pending reminders for a request
   */
  cancelForRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      await db.cancelPendingReminders(input.requestId);
      return { success: true };
    }),

  /**
   * Get pending reminders that are due (for background job)
   */
  getPendingDue: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.user.activeOrgId;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active organization selected"
      });
    }

    // Get reminders that are due now or in the past
    return await db.getPendingReminders(new Date());
  }),

  /**
   * Mark a reminder as sent
   */
  markSent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateReminderStatus(input.id, "sent");
      return { success: true };
    }),

  /**
   * Mark a reminder as failed
   */
  markFailed: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateReminderStatus(input.id, "failed", input.reason);
      return { success: true };
    }),
});
