import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";

// Note: This assumes a customerNotifications table exists or will be created
// For now, we'll use a simple in-memory store for demonstration

interface CustomerNotification {
  id: number;
  customerId: number;
  customerUserId?: number;
  type: "invoice_created" | "payment_received" | "payment_reminder" | "project_update" | "system";
  title: string;
  message: string;
  data?: Record<string, any>;
  readAt?: Date;
  createdAt: Date;
}

// In-memory notification store (replace with database in production)
const notificationStore: CustomerNotification[] = [];
let notificationIdCounter = 1;

/**
 * Customer Notifications Router
 * Handles real-time notifications for customer portal users
 */
export const customerNotificationsRouter = router({
  // Get notifications for a customer user
  getNotifications: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      customerUserId: z.number().optional(),
      unreadOnly: z.boolean().default(false),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      let filtered = notificationStore.filter(n => n.customerId === input.customerId);
      
      if (input.customerUserId) {
        filtered = filtered.filter(n => !n.customerUserId || n.customerUserId === input.customerUserId);
      }
      
      if (input.unreadOnly) {
        filtered = filtered.filter(n => !n.readAt);
      }
      
      // Sort by createdAt desc
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      const total = filtered.length;
      const unreadCount = filtered.filter(n => !n.readAt).length;
      const notifications = filtered.slice(input.offset, input.offset + input.limit);
      
      return {
        notifications,
        total,
        unreadCount,
      };
    }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({
      notificationId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const notification = notificationStore.find(n => n.id === input.notificationId);
      if (notification) {
        notification.readAt = new Date();
      }
      return { success: true };
    }),

  // Mark all notifications as read
  markAllAsRead: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      customerUserId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      notificationStore.forEach(n => {
        if (n.customerId === input.customerId) {
          if (!input.customerUserId || !n.customerUserId || n.customerUserId === input.customerUserId) {
            n.readAt = new Date();
          }
        }
      });
      return { success: true };
    }),

  // Create notification (internal use)
  createNotification: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      customerUserId: z.number().optional(),
      type: z.enum(["invoice_created", "payment_received", "payment_reminder", "project_update", "system"]),
      title: z.string(),
      message: z.string(),
      data: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const notification: CustomerNotification = {
        id: notificationIdCounter++,
        customerId: input.customerId,
        customerUserId: input.customerUserId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data,
        createdAt: new Date(),
      };
      
      notificationStore.push(notification);
      
      // In production, also send email/push notification based on user preferences
      
      return { id: notification.id, success: true };
    }),

  // Get notification preferences
  getPreferences: protectedProcedure
    .input(z.object({
      customerUserId: z.number(),
    }))
    .query(async ({ input }) => {
      // Default preferences - in production, fetch from database
      return {
        emailInvoices: true,
        emailPayments: true,
        emailReminders: true,
        emailProjectUpdates: false,
        pushEnabled: false,
      };
    }),

  // Update notification preferences
  updatePreferences: protectedProcedure
    .input(z.object({
      customerUserId: z.number(),
      emailInvoices: z.boolean().optional(),
      emailPayments: z.boolean().optional(),
      emailReminders: z.boolean().optional(),
      emailProjectUpdates: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      // In production, save to database
      return { success: true };
    }),
});

// Helper function to create notifications from other parts of the system
export async function notifyCustomer(params: {
  customerId: number;
  customerUserId?: number;
  type: CustomerNotification["type"];
  title: string;
  message: string;
  data?: Record<string, any>;
}) {
  const notification: CustomerNotification = {
    id: notificationIdCounter++,
    ...params,
    createdAt: new Date(),
  };
  notificationStore.push(notification);
  return notification;
}

// Notify on new invoice
export async function notifyNewInvoice(customerId: number, invoiceNumber: string, amount: number, currency: string) {
  return notifyCustomer({
    customerId,
    type: "invoice_created",
    title: "New Invoice",
    message: `Invoice ${invoiceNumber} for ${currency} ${amount.toLocaleString()} has been created.`,
    data: { invoiceNumber, amount, currency },
  });
}

// Notify on payment received
export async function notifyPaymentReceived(customerId: number, invoiceNumber: string, amount: number, currency: string) {
  return notifyCustomer({
    customerId,
    type: "payment_received",
    title: "Payment Received",
    message: `Payment of ${currency} ${amount.toLocaleString()} received for invoice ${invoiceNumber}. Thank you!`,
    data: { invoiceNumber, amount, currency },
  });
}
