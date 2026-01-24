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
import { eq, and, desc, sql, gte, lte, count, sum, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

// Helper to log billing actions (VATR compliant)
async function logBillingAction(params: {
  organizationId?: number;
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  previousState?: any;
  newState?: any;
  metadata?: any;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(billingAuditLog).values({
    organizationId: params.organizationId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    previousState: params.previousState,
    newState: params.newState,
    metadata: params.metadata,
  });
}

// Check if user is superuser
async function isSuperuser(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [user] = await db.execute(sql`SELECT isSuperuser FROM users WHERE id = ${userId}`);
  return (user as any[])?.[0]?.isSuperuser === 1;
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
      
      return plan || null;
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
      return null;
    }
    
    const [subscription] = await db
      .select({
        subscription: platformSubscriptions,
        plan: platformPlans,
      })
      .from(platformSubscriptions)
      .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
      .where(eq(platformSubscriptions.organizationId, orgId))
      .orderBy(desc(platformSubscriptions.createdAt))
      .limit(1);
    
    return subscription || null;
  }),
  
  /**
   * Get subscription usage summary
   */
  getUsageSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const orgId = ctx.user.activeOrgId;
    if (!orgId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
    }
    
    // Get current subscription with plan limits
    const [subscription] = await db
      .select({
        subscription: platformSubscriptions,
        plan: platformPlans,
      })
      .from(platformSubscriptions)
      .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
      .where(eq(platformSubscriptions.organizationId, orgId))
      .orderBy(desc(platformSubscriptions.createdAt))
      .limit(1);
    
    // Get current usage
    const [userCount] = await db
      .select({ count: count() })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.status, "active")
      ));
    
    const [assetCount] = await db
      .select({ count: count() })
      .from(assets)
      .where(eq(assets.organizationId, orgId));
    
    const [customerCount] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.organizationId, orgId));
    
    const plan = subscription?.plan;
    
    return {
      users: {
        current: userCount?.count || 0,
        limit: plan?.maxUsers || 5,
        percentage: plan?.maxUsers ? Math.round(((userCount?.count || 0) / plan.maxUsers) * 100) : 0,
      },
      assets: {
        current: assetCount?.count || 0,
        limit: plan?.maxAssets || 100,
        percentage: plan?.maxAssets ? Math.round(((assetCount?.count || 0) / plan.maxAssets) * 100) : 0,
      },
      customers: {
        current: customerCount?.count || 0,
        limit: plan?.maxCustomers || 50,
        percentage: plan?.maxCustomers ? Math.round(((customerCount?.count || 0) / plan.maxCustomers) * 100) : 0,
      },
      storage: {
        current: 0, // TODO: Calculate actual storage usage
        limit: plan?.maxStorage || 5368709120,
        percentage: 0,
      },
      subscription: subscription?.subscription || null,
      plan: plan || null,
    };
  }),
  
  // ============================================================================
  // PLATFORM INVOICES (Invoices from KIISHA to organizations)
  // ============================================================================
  
  /**
   * Get organization's platform invoices
   */
  getPlatformInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
      status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      const conditions = [eq(platformInvoices.organizationId, orgId)];
      if (input.status) {
        conditions.push(eq(platformInvoices.status, input.status));
      }
      
      const invoicesList = await db
        .select()
        .from(platformInvoices)
        .where(and(...conditions))
        .orderBy(desc(platformInvoices.invoiceDate))
        .limit(input.limit)
        .offset(input.offset);
      
      return invoicesList;
    }),
  
  /**
   * Get platform invoice details with line items
   */
  getPlatformInvoiceDetail: protectedProcedure
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
  // PLATFORM PAYMENTS
  // ============================================================================
  
  /**
   * Get organization's payment history
   */
  getPlatformPayments: protectedProcedure
    .input(z.object({
      limit: z.number().default(20),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      const paymentsList = await db
        .select()
        .from(platformPayments)
        .where(eq(platformPayments.organizationId, orgId))
        .orderBy(desc(platformPayments.paymentDate))
        .limit(input.limit)
        .offset(input.offset);
      
      return paymentsList;
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
   * Add payment method (manual entry - for non-Stripe setups)
   */
  addPaymentMethod: protectedProcedure
    .input(z.object({
      type: z.enum(["card", "bank_account"]),
      // Card details
      last4: z.string().length(4).optional(),
      brand: z.string().optional(),
      expiryMonth: z.number().min(1).max(12).optional(),
      expiryYear: z.number().min(2024).optional(),
      // Bank details
      bankName: z.string().optional(),
      accountLast4: z.string().length(4).optional(),
      // Billing address
      billingName: z.string().optional(),
      billingEmail: z.string().email().optional(),
      billingAddress: z.string().optional(),
      billingCity: z.string().optional(),
      billingState: z.string().optional(),
      billingPostalCode: z.string().optional(),
      billingCountry: z.string().optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const orgId = ctx.user.activeOrgId;
      if (!orgId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
      }
      
      // If setting as default, remove default from others
      if (input.isDefault) {
        await db
          .update(paymentMethods)
          .set({ isDefault: false })
          .where(eq(paymentMethods.organizationId, orgId));
      }
      
      const [result] = await db
        .insert(paymentMethods)
        .values({
          organizationId: orgId,
          type: input.type,
          last4: input.last4,
          brand: input.brand,
          expiryMonth: input.expiryMonth,
          expiryYear: input.expiryYear,
          bankName: input.bankName,
          accountLast4: input.accountLast4,
          billingName: input.billingName,
          billingEmail: input.billingEmail,
          billingAddress: input.billingAddress,
          billingCity: input.billingCity,
          billingState: input.billingState,
          billingPostalCode: input.billingPostalCode,
          billingCountry: input.billingCountry,
          isDefault: input.isDefault,
          status: "active",
        });
      
      await logBillingAction({
        organizationId: orgId,
        userId: ctx.user.id,
        action: "payment_method_added",
        entityType: "payment_method",
        entityId: result.insertId,
        newState: { ...input, last4: input.last4 },
      });
      
      return { id: result.insertId };
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
      
      // Remove default from all other methods
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.organizationId, orgId));
      
      // Set this one as default
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
      
      // Soft delete
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
  // BILLING SETTINGS
  // ============================================================================
  
  /**
   * Get billing settings for organization
   */
  getBillingSettings: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    const orgId = ctx.user.activeOrgId;
    if (!orgId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No active organization" });
    }
    
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId));
    
    // Get default payment method
    const [defaultMethod] = await db
      .select()
      .from(paymentMethods)
      .where(and(
        eq(paymentMethods.organizationId, orgId),
        eq(paymentMethods.isDefault, true),
        eq(paymentMethods.status, "active")
      ));
    
    return {
      organization: org,
      defaultPaymentMethod: defaultMethod || null,
    };
  }),
  
  // ============================================================================
  // SUPERUSER: PLATFORM BILLING MANAGEMENT
  // ============================================================================
  
  /**
   * Get all organizations with their subscription status (superuser only)
   */
  getAllOrganizationBilling: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.enum(["trialing", "active", "past_due", "canceled", "paused"]).optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      const orgs = await db
        .select({
          organization: organizations,
          subscription: platformSubscriptions,
          plan: platformPlans,
        })
        .from(organizations)
        .leftJoin(platformSubscriptions, eq(organizations.id, platformSubscriptions.organizationId))
        .leftJoin(platformPlans, eq(platformSubscriptions.planId, platformPlans.id))
        .orderBy(desc(organizations.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      return orgs;
    }),
  
  /**
   * Get platform revenue summary (superuser only)
   */
  getPlatformRevenueSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    // Check superuser
    if (!await isSuperuser(ctx.user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
    }
    
    // Get total revenue
    const [totalRevenue] = await db
      .select({ total: sum(platformPayments.amount) })
      .from(platformPayments)
      .where(eq(platformPayments.status, "succeeded"));
    
    // Get this month's revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const [monthlyRevenue] = await db
      .select({ total: sum(platformPayments.amount) })
      .from(platformPayments)
      .where(and(
        eq(platformPayments.status, "succeeded"),
        gte(platformPayments.paymentDate, startOfMonth)
      ));
    
    // Get subscription counts by status
    const subscriptionCounts = await db
      .select({
        status: platformSubscriptions.status,
        count: count(),
      })
      .from(platformSubscriptions)
      .groupBy(platformSubscriptions.status);
    
    // Get total organizations
    const [orgCount] = await db
      .select({ count: count() })
      .from(organizations);
    
    // Get outstanding invoices
    const [outstandingAmount] = await db
      .select({ total: sum(platformInvoices.amountDue) })
      .from(platformInvoices)
      .where(eq(platformInvoices.status, "open"));
    
    return {
      totalRevenue: totalRevenue?.total || "0",
      monthlyRevenue: monthlyRevenue?.total || "0",
      totalOrganizations: orgCount?.count || 0,
      outstandingAmount: outstandingAmount?.total || "0",
      subscriptionsByStatus: subscriptionCounts,
    };
  }),
  
  /**
   * Get all platform invoices (superuser only)
   */
  getAllPlatformInvoices: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
      status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      const conditions = [];
      if (input.status) {
        conditions.push(eq(platformInvoices.status, input.status));
      }
      
      const invoicesList = await db
        .select({
          invoice: platformInvoices,
          organization: organizations,
        })
        .from(platformInvoices)
        .leftJoin(organizations, eq(platformInvoices.organizationId, organizations.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(platformInvoices.invoiceDate))
        .limit(input.limit)
        .offset(input.offset);
      
      return invoicesList;
    }),
  
  /**
   * Manage all plans (superuser only)
   */
  getAllPlans: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
    
    // Check superuser
    if (!await isSuperuser(ctx.user.id)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
    }
    
    const plans = await db
      .select()
      .from(platformPlans)
      .orderBy(platformPlans.sortOrder);
    
    return plans;
  }),
  
  /**
   * Create or update a plan (superuser only)
   */
  upsertPlan: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      code: z.string(),
      name: z.string(),
      description: z.string().optional(),
      monthlyPrice: z.string(),
      annualPrice: z.string(),
      currency: z.string().default("USD"),
      maxUsers: z.number(),
      maxAssets: z.number(),
      maxStorage: z.number(),
      maxCustomers: z.number(),
      maxMonthlyApiCalls: z.number(),
      features: z.object({
        customerPortal: z.boolean(),
        customBranding: z.boolean(),
        apiAccess: z.boolean(),
        advancedReporting: z.boolean(),
        whiteLabeling: z.boolean(),
        prioritySupport: z.boolean(),
        ssoIntegration: z.boolean(),
        customIntegrations: z.boolean(),
        auditLogs: z.boolean(),
        dataExport: z.boolean(),
      }),
      isActive: z.boolean().default(true),
      isPublic: z.boolean().default(true),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      if (input.id) {
        // Update existing plan
        await db
          .update(platformPlans)
          .set({
            code: input.code,
            name: input.name,
            description: input.description,
            monthlyPrice: input.monthlyPrice,
            annualPrice: input.annualPrice,
            currency: input.currency,
            maxUsers: input.maxUsers,
            maxAssets: input.maxAssets,
            maxStorage: input.maxStorage,
            maxCustomers: input.maxCustomers,
            maxMonthlyApiCalls: input.maxMonthlyApiCalls,
            features: input.features,
            isActive: input.isActive,
            isPublic: input.isPublic,
            sortOrder: input.sortOrder,
          })
          .where(eq(platformPlans.id, input.id));
        
        await logBillingAction({
          userId: ctx.user.id,
          action: "plan_updated",
          entityType: "plan",
          entityId: input.id,
          newState: input,
        });
        
        return { id: input.id };
      } else {
        // Create new plan
        const [result] = await db
          .insert(platformPlans)
          .values({
            code: input.code,
            name: input.name,
            description: input.description,
            monthlyPrice: input.monthlyPrice,
            annualPrice: input.annualPrice,
            currency: input.currency,
            maxUsers: input.maxUsers,
            maxAssets: input.maxAssets,
            maxStorage: input.maxStorage,
            maxCustomers: input.maxCustomers,
            maxMonthlyApiCalls: input.maxMonthlyApiCalls,
            features: input.features,
            isActive: input.isActive,
            isPublic: input.isPublic,
            sortOrder: input.sortOrder,
          });
        
        await logBillingAction({
          userId: ctx.user.id,
          action: "plan_created",
          entityType: "plan",
          entityId: result.insertId,
          newState: input,
        });
        
        return { id: result.insertId };
      }
    }),
  
  /**
   * Create subscription for organization (superuser only)
   */
  createSubscription: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      planId: z.number(),
      billingCycle: z.enum(["monthly", "annual"]),
      status: z.enum(["trialing", "active", "past_due", "canceled", "paused"]).default("active"),
      trialDays: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      // Get plan pricing
      const [plan] = await db
        .select()
        .from(platformPlans)
        .where(eq(platformPlans.id, input.planId));
      
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }
      
      const price = input.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
      const now = new Date();
      const periodEnd = new Date(now);
      if (input.billingCycle === "annual") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      
      const trialEndsAt = input.trialDays 
        ? new Date(now.getTime() + input.trialDays * 24 * 60 * 60 * 1000)
        : null;
      
      const [result] = await db
        .insert(platformSubscriptions)
        .values({
          organizationId: input.organizationId,
          planId: input.planId,
          status: input.trialDays ? "trialing" : input.status,
          billingCycle: input.billingCycle,
          pricePerPeriod: price || "0",
          currency: plan.currency || "USD",
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
      
      await logBillingAction({
        organizationId: input.organizationId,
        userId: ctx.user.id,
        action: "subscription_created",
        entityType: "subscription",
        entityId: result.insertId,
        newState: input,
      });
      
      return { id: result.insertId };
    }),
  
  /**
   * Create platform invoice (superuser only)
   */
  createPlatformInvoice: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      subscriptionId: z.number().optional(),
      description: z.string().optional(),
      notes: z.string().optional(),
      dueDate: z.string(),
      lineItems: z.array(z.object({
        description: z.string(),
        quantity: z.string(),
        unitPrice: z.string(),
        itemType: z.enum(["subscription", "usage", "addon", "credit", "discount", "tax"]).default("subscription"),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      // Calculate totals
      let subtotal = 0;
      for (const item of input.lineItems) {
        subtotal += parseFloat(item.quantity) * parseFloat(item.unitPrice);
      }
      const total = subtotal; // Add tax calculation if needed
      
      // Generate invoice number
      const invoiceNumber = `KIISHA-${Date.now()}`;
      
      const [result] = await db
        .insert(platformInvoices)
        .values({
          organizationId: input.organizationId,
          subscriptionId: input.subscriptionId,
          invoiceNumber,
          status: "open",
          subtotal: subtotal.toFixed(2),
          tax: "0.00",
          total: total.toFixed(2),
          amountPaid: "0.00",
          amountDue: total.toFixed(2),
          currency: "USD",
          invoiceDate: new Date(),
          dueDate: new Date(input.dueDate),
          description: input.description,
          notes: input.notes,
        });
      
      // Insert line items
      for (const item of input.lineItems) {
        const amount = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        await db.insert(platformInvoiceLineItems).values({
          invoiceId: result.insertId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: amount.toFixed(2),
          itemType: item.itemType,
        });
      }
      
      await logBillingAction({
        organizationId: input.organizationId,
        userId: ctx.user.id,
        action: "platform_invoice_created",
        entityType: "platform_invoice",
        entityId: result.insertId,
        newState: { ...input, invoiceNumber, total },
      });
      
      return { id: result.insertId, invoiceNumber };
    }),
  
  /**
   * Record platform payment (superuser only)
   */
  recordPlatformPayment: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      invoiceId: z.number().optional(),
      amount: z.string(),
      paymentMethod: z.enum(["card", "bank_transfer", "manual"]),
      paymentDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      const [result] = await db
        .insert(platformPayments)
        .values({
          organizationId: input.organizationId,
          invoiceId: input.invoiceId,
          amount: input.amount,
          currency: "USD",
          status: "succeeded",
          paymentMethod: input.paymentMethod,
          paymentDate: new Date(input.paymentDate),
        });
      
      // Update invoice if provided
      if (input.invoiceId) {
        const [invoice] = await db
          .select()
          .from(platformInvoices)
          .where(eq(platformInvoices.id, input.invoiceId));
        
        if (invoice) {
          const newAmountPaid = parseFloat(invoice.amountPaid || "0") + parseFloat(input.amount);
          const newAmountDue = parseFloat(invoice.total || "0") - newAmountPaid;
          const newStatus = newAmountDue <= 0 ? "paid" : "open";
          
          await db
            .update(platformInvoices)
            .set({
              amountPaid: newAmountPaid.toFixed(2),
              amountDue: Math.max(0, newAmountDue).toFixed(2),
              status: newStatus,
              paidAt: newStatus === "paid" ? new Date() : null,
            })
            .where(eq(platformInvoices.id, input.invoiceId));
        }
      }
      
      await logBillingAction({
        organizationId: input.organizationId,
        userId: ctx.user.id,
        action: "platform_payment_recorded",
        entityType: "platform_payment",
        entityId: result.insertId,
        newState: input,
      });
      
      return { id: result.insertId };
    }),
  
  /**
   * Get billing audit log (superuser only)
   */
  getBillingAuditLog: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check superuser
      if (!await isSuperuser(ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Superuser access required" });
      }
      
      const conditions = [];
      if (input.organizationId) {
        conditions.push(eq(billingAuditLog.organizationId, input.organizationId));
      }
      
      const logs = await db
        .select()
        .from(billingAuditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(billingAuditLog.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      return logs;
    }),
});
