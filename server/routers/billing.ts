/**
 * Billing Router
 * 
 * Admin endpoints for managing billing configuration:
 * - Recurring invoice schedules
 * - Payment reminder settings
 * - Invoice generation
 * 
 * WHO USES THIS:
 * - Admin/Operator: Configures billing settings, creates recurring schedules
 * - System: Automatically generates invoices and sends reminders
 * - Located at: Admin Dashboard → Settings → Billing
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { processRecurringInvoices, createRecurringSchedule, listSchedules, pauseSchedule, resumeSchedule, cancelSchedule, getScheduleDetails } from "../services/recurringInvoices";
import { processPaymentReminders, getReminderConfig, updateReminderConfig, sendManualReminder, getReminderHistory } from "../services/paymentReminders";

export const billingRouter = router({
  // ============================================
  // RECURRING INVOICES
  // ============================================

  // List all recurring invoice schedules
  listRecurringSchedules: protectedProcedure
    .input(z.object({
      customerId: z.number().optional(),
      status: z.enum(['active', 'paused', 'cancelled', 'completed']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return listSchedules(input);
    }),

  // Create a new recurring invoice schedule
  createRecurringSchedule: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      organizationId: z.number().optional(),
      name: z.string(),
      description: z.string().optional(),
      frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual']),
      dayOfMonth: z.number().min(1).max(28).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      startDate: z.date(),
      endDate: z.date().optional(),
      currency: z.string().optional(),
      taxRate: z.number().optional(),
      paymentTermsDays: z.number().min(0).max(90).default(30),
      notes: z.string().optional(),
      lineItems: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        taxRate: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      return createRecurringSchedule({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Pause a recurring invoice schedule
  pauseRecurringSchedule: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await pauseSchedule(input.scheduleId);
      return { success: true };
    }),

  // Resume a recurring invoice schedule
  resumeRecurringSchedule: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await resumeSchedule(input.scheduleId);
      return { success: true };
    }),

  // Cancel a recurring invoice schedule
  cancelRecurringSchedule: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
    }))
    .mutation(async ({ input }) => {
      await cancelSchedule(input.scheduleId);
      return { success: true };
    }),

  // Get schedule details
  getRecurringScheduleDetails: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
    }))
    .query(async ({ input }) => {
      return getScheduleDetails(input.scheduleId);
    }),

  // Manually trigger recurring invoice generation (for testing)
  triggerRecurringInvoices: protectedProcedure
    .mutation(async () => {
      return processRecurringInvoices();
    }),

  // ============================================
  // PAYMENT REMINDERS
  // ============================================

  // Get payment reminder configuration
  getReminderConfig: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const config = await getReminderConfig(input.organizationId);
      if (!config) {
        // Return defaults
        return {
          reminderDays: [7, 14, 30],
          escalationDays: 60,
          escalationAction: 'notify_admin' as const,
          isActive: false,
        };
      }
      return {
        reminderDays: config.reminderDays.split(',').map(d => parseInt(d.trim())),
        escalationDays: config.escalationDays,
        escalationAction: config.escalationAction,
        isActive: config.isActive,
      };
    }),

  // Update payment reminder configuration
  updateReminderConfig: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      reminderDays: z.array(z.number().min(1).max(365)),
      escalationDays: z.number().min(1).max(365),
      escalationAction: z.enum(['none', 'notify_admin', 'suspend_service', 'collections']),
      isActive: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await updateReminderConfig(input);
      return { success: true };
    }),

  // Manually trigger payment reminders (for testing)
  triggerPaymentReminders: protectedProcedure
    .mutation(async () => {
      return processPaymentReminders();
    }),

  // Send manual reminder for a specific invoice
  sendManualReminder: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .mutation(async ({ input }) => {
      return sendManualReminder(input.invoiceId);
    }),

  // Get reminder history for an invoice
  getReminderHistory: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
    }))
    .query(async ({ input }) => {
      return getReminderHistory(input.invoiceId);
    }),

  // ============================================
  // BILLING DASHBOARD STATS
  // ============================================

  // Get billing overview stats
  getBillingStats: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get invoice stats
      const [invoiceStats] = await db.execute(sql`
        SELECT 
          COUNT(*) as totalInvoices,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paidInvoices,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingInvoices,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdueInvoices,
          SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as totalPaid,
          SUM(CASE WHEN status IN ('pending', 'overdue') THEN total ELSE 0 END) as totalOutstanding
        FROM invoices
        WHERE 1=1
      `);

      // Get recurring schedule stats
      const [recurringStats] = await db.execute(sql`
        SELECT 
          COUNT(*) as totalSchedules,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeSchedules,
          SUM(CASE WHEN status = 'active' THEN amount ELSE 0 END) as monthlyRecurringRevenue
        FROM recurring_invoice_schedules
      `);

      // Get reminder stats
      const [reminderStats] = await db.execute(sql`
        SELECT 
          COUNT(*) as totalReminders,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sentReminders,
          SUM(CASE WHEN reminderType = 'escalation' THEN 1 ELSE 0 END) as escalations
        FROM payment_reminder_log
        WHERE sentAt > DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      const invoice = (invoiceStats as any[])[0] || {};
      const recurring = (recurringStats as any[])[0] || {};
      const reminder = (reminderStats as any[])[0] || {};

      return {
        invoices: {
          total: invoice.totalInvoices || 0,
          paid: invoice.paidInvoices || 0,
          pending: invoice.pendingInvoices || 0,
          overdue: invoice.overdueInvoices || 0,
          totalPaid: invoice.totalPaid || 0,
          totalOutstanding: invoice.totalOutstanding || 0,
        },
        recurring: {
          totalSchedules: recurring.totalSchedules || 0,
          activeSchedules: recurring.activeSchedules || 0,
          monthlyRecurringRevenue: recurring.monthlyRecurringRevenue || 0,
        },
        reminders: {
          totalSent: reminder.totalReminders || 0,
          sentLast30Days: reminder.sentReminders || 0,
          escalationsLast30Days: reminder.escalations || 0,
        },
      };
    }),

  // Get overdue invoices list
  getOverdueInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [invoices] = await db.execute(sql`
        SELECT 
          i.*,
          c.companyName,
          c.name as customerName,
          DATEDIFF(CURDATE(), i.dueDate) as daysPastDue
        FROM invoices i
        JOIN customers c ON i.customerId = c.id
        WHERE i.status IN ('pending', 'overdue')
        AND i.dueDate < CURDATE()
        ORDER BY i.dueDate ASC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `);

      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM invoices
        WHERE status IN ('pending', 'overdue')
        AND dueDate < CURDATE()
      `);

      return {
        invoices: invoices as any[],
        total: (countResult as any[])[0]?.count || 0,
      };
    }),
});
