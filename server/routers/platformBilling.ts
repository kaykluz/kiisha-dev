/**
 * Platform Billing Router
 * 
 * Handles KIISHA platform billing operations:
 * - Organization subscriptions to KIISHA
 * - Payment methods management
 * - Platform invoice viewing
 * - Usage tracking
 * - Superuser billing oversight
 * 
 * NO MANUS DEPENDENCIES
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { 
  platformPlans, 
  platformSubscriptions, 
  platformInvoices,
  platformInvoiceLineItems,
  platformPayments,
  platformUsage,
  paymentMethods,
  billingAuditLog,
  organizations,
  organizationMembers,
  assets,
  customers,
} from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Helper to log billing actions (VATR compliant)
async function logBillingAction(params: {
  organizationId?: number;
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  previousState?: unknown;
  newState?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(billingAuditLog).values({
    organizationId: params.organizationId ?? null,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    previousState: params.previousState ?? null,
    newState: params.newState ?? null,
    metadata: params.metadata ?? null,
  });
}

// Check if user is superuser
async function checkIsSuperuser(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.execute(sql`SELECT isSuperuser FROM users WHERE id = ${userId}`);
  const rows = result as unknown as Array<{ isSuperuser: number | boolean }>;
  return rows?.[0]?.isSuperuser === 1 || rows?.[0]?.isSuperuser === true;
}

export const platformBillingRouter = router({
  // ============================================================================
  // PLANS
  // ============================================================================
  
  /**
   * Get all available platform plans
   */
  getPlans: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const plans = await db
      .select()
      .from(platformPlans)
      .where(and(eq(platformPlans.isActive, true), eq(platformPlans.isPublic, true)))
      .orderBy(platformPlans.sortOrder);
    
    return plans;
  }),
  
  /**
   * Get a specific plan by ID
   */
  getPlan: protectedProcedure
    .input(z.object({ planId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [plan] = await db
        .select()
        .from(platformPlans)
        .where(eq(platformPlans.id, input.planId));
      
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      
      return plan;
    }),
  
  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  
  /**
   * Get current organization's subscription
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const orgId = ctx.user.activeOrgId;
    if (!orgId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
    }
    
    const [subscription] = await db
      .select({
        id: platformSubscriptions.id,
        organizationId: platformSubscriptions.organizationId,
        planId: platformSubscriptions.planId,
        status: platformSubscriptions.status,
        billingCycle: platformSubscriptions.billingCycle,
        pricePerPeriod: platformSubscriptions.pricePerPeriod,
        currency: platformSubscriptions.currency,
        trialEndsAt: platformSubscriptions.trialEndsAt,
        currentPeriodStart: platformSubscriptions.currentPeriodStart,
        currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
        canceledAt: platformSubscriptions.canceledAt,
        cancelAtPeriodEnd: platformSubscriptions.cancelAtPeriodEnd,
        planName: platformPlans.name,
        planCode: platformPlans.code,
        planFeatures: platformPlans.features,
      })
      .from(platformSubscriptions)
      .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
      .where(eq(platformSubscriptions.organizationId, orgId));
    
    return subscription || null;
  }),
  
  /**
   * Get subscription usage vs limits
   */
  getUsageSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const orgId = ctx.user.activeOrgId;
    if (!orgId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
    }
    
    // Get subscription with plan limits
    const [subscription] = await db
      .select({
        planId: platformSubscriptions.planId,
        maxUsers: platformPlans.maxUsers,
        maxAssets: platformPlans.maxAssets,
        maxStorage: platformPlans.maxStorage,
        maxCustomers: platformPlans.maxCustomers,
      })
      .from(platformSubscriptions)
      .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
      .where(eq(platformSubscriptions.organizationId, orgId));
    
    // Get current usage
    const [userCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));
    
    const [assetCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assets)
      .where(eq(assets.organizationId, orgId));
    
    const [customerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(eq(customers.organizationId, orgId));
    
    return {
      users: {
        current: Number(userCount?.count || 0),
        limit: subscription?.maxUsers || 5,
      },
      assets: {
        current: Number(assetCount?.count || 0),
        limit: subscription?.maxAssets || 100,
      },
      customers: {
        current: Number(customerCount?.count || 0),
        limit: subscription?.maxCustomers || 50,
      },
      storage: {
        current: 0, // Would need to calculate actual storage
        limit: Number(subscription?.maxStorage || 5368709120), // 5GB default
      },
    };
  }),
  
  // ============================================================================
  // INVOICES
  // ============================================================================
  
  /**
   * Get organization's platform invoices
   */
  getInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;
      
      const invoices = await db
        .select()
        .from(platformInvoices)
        .where(eq(platformInvoices.organizationId, orgId))
        .orderBy(desc(platformInvoices.invoiceDate))
        .limit(limit)
        .offset(offset);
      
      return invoices;
    }),
  
  /**
   * Get a specific invoice with line items
   */
  getInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      const [invoice] = await db
        .select()
        .from(platformInvoices)
        .where(and(
          eq(platformInvoices.id, input.invoiceId),
          eq(platformInvoices.organizationId, orgId)
        ));
      
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      
      const lineItems = await db
        .select()
        .from(platformInvoiceLineItems)
        .where(eq(platformInvoiceLineItems.invoiceId, input.invoiceId));
      
      return { ...invoice, lineItems };
    }),
  
  // ============================================================================
  // PAYMENTS
  // ============================================================================
  
  /**
   * Get organization's payment history
   */
  getPayments: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      const limit = input?.limit || 20;
      const offset = input?.offset || 0;
      
      const payments = await db
        .select()
        .from(platformPayments)
        .where(eq(platformPayments.organizationId, orgId))
        .orderBy(desc(platformPayments.createdAt))
        .limit(limit)
        .offset(offset);
      
      return payments;
    }),
  
  // ============================================================================
  // PAYMENT METHODS
  // ============================================================================
  
  /**
   * Get organization's payment methods
   */
  getPaymentMethods: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const orgId = ctx.user.activeOrgId;
    if (!orgId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
    }
    
    const methods = await db
      .select()
      .from(paymentMethods)
      .where(and(
        eq(paymentMethods.organizationId, orgId),
        eq(paymentMethods.status, "active")
      ))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));
    
    return methods;
  }),
  
  /**
   * Set default payment method
   */
  setDefaultPaymentMethod: protectedProcedure
    .input(z.object({ paymentMethodId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      // Verify payment method belongs to org
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(and(
          eq(paymentMethods.id, input.paymentMethodId),
          eq(paymentMethods.organizationId, orgId)
        ));
      
      if (!method) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment method not found" });
      }
      
      // Unset all defaults for this org
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.organizationId, orgId));
      
      // Set new default
      await db
        .update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, input.paymentMethodId));
      
      await logBillingAction({
        organizationId: orgId,
        userId: ctx.user.id,
        action: "payment_method_default_changed",
        entityType: "payment_method",
        entityId: input.paymentMethodId,
      });
      
      return { success: true };
    }),
  
  /**
   * Remove payment method
   */
  removePaymentMethod: protectedProcedure
    .input(z.object({ paymentMethodId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      // Verify payment method belongs to org
      const [method] = await db
        .select()
        .from(paymentMethods)
        .where(and(
          eq(paymentMethods.id, input.paymentMethodId),
          eq(paymentMethods.organizationId, orgId)
        ));
      
      if (!method) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payment method not found" });
      }
      
      // Soft delete by setting status to removed
      await db
        .update(paymentMethods)
        .set({ status: "removed" })
        .where(eq(paymentMethods.id, input.paymentMethodId));
      
      await logBillingAction({
        organizationId: orgId,
        userId: ctx.user.id,
        action: "payment_method_removed",
        entityType: "payment_method",
        entityId: input.paymentMethodId,
        previousState: method,
      });
      
      return { success: true };
    }),
  
  // ============================================================================
  // SUPERUSER ENDPOINTS
  // ============================================================================
  
  /**
   * Get platform-wide billing stats (superuser only)
   */
  getPlatformStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    if (!await checkIsSuperuser(ctx.user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
    }
    
    // Get counts
    const [activeSubsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.status, "active"));
    
    const [totalOrgsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations);
    
    const [pastDueResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.status, "past_due"));
    
    // Get monthly revenue (sum of active subscriptions)
    const [revenueResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(pricePerPeriod), 0)` })
      .from(platformSubscriptions)
      .where(eq(platformSubscriptions.status, "active"));
    
    return {
      monthlyRevenue: parseFloat(revenueResult?.total || "0"),
      activeSubscriptions: Number(activeSubsResult?.count || 0),
      totalOrganizations: Number(totalOrgsResult?.count || 0),
      pastDueCount: Number(pastDueResult?.count || 0),
      pastDueAmount: 0, // Would calculate from past_due invoices
      revenueChange: 0, // Would compare to last month
      newSubscriptions: 0, // Would count new this month
    };
  }),
  
  /**
   * Get all subscriptions with org info (superuser only)
   */
  getAllSubscriptions: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (!await checkIsSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      // Get all organizations with their subscriptions
      const orgs = await db
        .select({
          organizationId: organizations.id,
          organizationName: organizations.name,
          organizationCode: organizations.code,
          subscriptionId: platformSubscriptions.id,
          planId: platformSubscriptions.planId,
          status: platformSubscriptions.status,
          billingCycle: platformSubscriptions.billingCycle,
          pricePerPeriod: platformSubscriptions.pricePerPeriod,
          currentPeriodEnd: platformSubscriptions.currentPeriodEnd,
          planName: platformPlans.name,
        })
        .from(organizations)
        .leftJoin(platformSubscriptions, eq(organizations.id, platformSubscriptions.organizationId))
        .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id));
      
      // Get user counts per org
      const userCounts = await db
        .select({
          organizationId: organizationMembers.organizationId,
          count: sql<number>`count(*)`,
        })
        .from(organizationMembers)
        .groupBy(organizationMembers.organizationId);
      
      const userCountMap = new Map(userCounts.map(uc => [uc.organizationId, Number(uc.count)]));
      
      let results = orgs.map(org => ({
        ...org,
        userCount: userCountMap.get(org.organizationId) || 0,
      }));
      
      // Apply filters
      if (input?.search) {
        const search = input.search.toLowerCase();
        results = results.filter(r => 
          r.organizationName?.toLowerCase().includes(search) ||
          r.organizationCode?.toLowerCase().includes(search)
        );
      }
      
      if (input?.status && input.status !== "all") {
        results = results.filter(r => r.status === input.status);
      }
      
      return results;
    }),
  
  /**
   * Get all platform invoices (superuser only)
   */
  getAllPlatformInvoices: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (!await checkIsSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      const invoices = await db
        .select({
          id: platformInvoices.id,
          invoiceNumber: platformInvoices.invoiceNumber,
          organizationId: platformInvoices.organizationId,
          organizationName: organizations.name,
          status: platformInvoices.status,
          total: platformInvoices.total,
          invoiceDate: platformInvoices.invoiceDate,
          dueDate: platformInvoices.dueDate,
          paidAt: platformInvoices.paidAt,
        })
        .from(platformInvoices)
        .leftJoin(organizations, eq(platformInvoices.organizationId, organizations.id))
        .orderBy(desc(platformInvoices.invoiceDate))
        .limit(input?.limit || 50);
      
      return invoices;
    }),
  
  /**
   * Update organization subscription (superuser only)
   */
  updateOrgSubscription: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      planId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (!await checkIsSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      // Get the plan
      const [plan] = await db
        .select()
        .from(platformPlans)
        .where(eq(platformPlans.id, input.planId));
      
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      
      // Check if subscription exists
      const [existingSub] = await db
        .select()
        .from(platformSubscriptions)
        .where(eq(platformSubscriptions.organizationId, input.organizationId));
      
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      
      if (existingSub) {
        // Update existing subscription
        await db
          .update(platformSubscriptions)
          .set({
            planId: input.planId,
            pricePerPeriod: plan.monthlyPrice || "0",
            status: "active",
          })
          .where(eq(platformSubscriptions.id, existingSub.id));
        
        await logBillingAction({
          organizationId: input.organizationId,
          userId: ctx.user.id,
          action: "subscription_plan_changed",
          entityType: "subscription",
          entityId: existingSub.id,
          previousState: { planId: existingSub.planId },
          newState: { planId: input.planId },
        });
      } else {
        // Create new subscription
        const [newSub] = await db
          .insert(platformSubscriptions)
          .values({
            organizationId: input.organizationId,
            planId: input.planId,
            status: "active",
            billingCycle: "monthly",
            pricePerPeriod: plan.monthlyPrice || "0",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          });
        
        await logBillingAction({
          organizationId: input.organizationId,
          userId: ctx.user.id,
          action: "subscription_created",
          entityType: "subscription",
          entityId: newSub.insertId,
          newState: { planId: input.planId },
        });
      }
      
      return { success: true };
    }),
});
