import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { 
  customers, customerUsers, customerProjects,
  invoices, invoiceLineItems, payments
} from "../../drizzle/schema";
import { eq, and, desc, sql, gte, lte, like, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../_core/env";
import { resolvePortalScopeFromLegacy, PortalScope } from "../helpers/portalScopeResolver";
import { sendWorkOrderStatusChangeEmail, sendWorkOrderCommentEmail, sendNewInvoiceEmail, sendPaymentConfirmationEmail } from '../services/portalNotifications';

/**
 * Customer Portal Router
 * Handles customer-facing operations: authentication, invoices, payments, project access
 */
export const customerPortalRouter = router({
  // ============================================
  // CUSTOMER MANAGEMENT (Admin Operations)
  // ============================================
  
  // List all customers for an organization
  listCustomers: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Build conditions array
      const conditions = [eq(customers.organizationId, input.orgId)];
      
      if (input.status) {
        conditions.push(eq(customers.status, input.status));
      }
      
      // Add search filter for name, email, or company
      if (input.search && input.search.trim()) {
        const searchTerm = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(customers.name, searchTerm),
            like(customers.email, searchTerm),
            like(customers.companyName, searchTerm)
          )!
        );
      }
      
      const result = await db.select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      // Get total count for pagination
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(customers)
        .where(and(...conditions));
      
      return {
        customers: result,
        total: countResult?.count || 0,
      };
    }),
  
  // Get single customer details
  getCustomer: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      
      // Get linked projects
      const projects = await db.select().from(customerProjects).where(eq(customerProjects.customerId, input.customerId));
      
      // Get customer users
      const users = await db.select({
        id: customerUsers.id,
        email: customerUsers.email,
        name: customerUsers.name,
        role: customerUsers.role,
        status: customerUsers.status,
        lastLoginAt: customerUsers.lastLoginAt,
      }).from(customerUsers).where(eq(customerUsers.customerId, input.customerId));
      
      return { ...customer, projects, users };
    }),
  
  // Create new customer
  createCustomer: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      code: z.string().min(1).max(50),
      name: z.string().min(1).max(255),
      companyName: z.string().max(255).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(20).optional(),
      address: z.string().optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
      postalCode: z.string().max(20).optional(),
      billingEmail: z.string().email().optional(),
      taxId: z.string().max(50).optional(),
      currency: z.string().length(3).default("USD"),
      paymentTermsDays: z.number().min(0).max(365).default(30),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const result = await db.insert(customers).values({
        organizationId: input.orgId,
        code: input.code,
        name: input.name,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        billingEmail: input.billingEmail || input.email,
        taxId: input.taxId,
        currency: input.currency,
        paymentTermsDays: input.paymentTermsDays,
        notes: input.notes,
        createdBy: ctx.user.id,
      });
      
      return { id: Number(result.insertId), success: true };
    }),
  
  // Update customer
  updateCustomer: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      name: z.string().min(1).max(255).optional(),
      companyName: z.string().max(255).optional().nullable(),
      email: z.string().email().optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      address: z.string().optional().nullable(),
      city: z.string().max(100).optional().nullable(),
      state: z.string().max(100).optional().nullable(),
      country: z.string().max(100).optional().nullable(),
      postalCode: z.string().max(20).optional().nullable(),
      billingEmail: z.string().email().optional().nullable(),
      billingAddress: z.string().optional().nullable(),
      taxId: z.string().max(50).optional().nullable(),
      currency: z.string().length(3).optional(),
      paymentTermsDays: z.number().min(0).max(365).optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const { customerId, ...updates } = input;
      
      await db.update(customers).set(updates).where(eq(customers.id, customerId));
      
      return { success: true };
    }),
  
  // Link customer to project
  linkProject: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      projectId: z.number(),
      accessLevel: z.enum(["full", "limited", "reports_only"]).default("full"),
      contractStartDate: z.string().optional(),
      contractEndDate: z.string().optional(),
      contractValue: z.number().optional(),
      billingCycle: z.enum(["monthly", "quarterly", "annually", "one_time"]).default("monthly"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const result = await db.insert(customerProjects).values({
        customerId: input.customerId,
        projectId: input.projectId,
        accessLevel: input.accessLevel,
        contractStartDate: input.contractStartDate ? new Date(input.contractStartDate) : null,
        contractEndDate: input.contractEndDate ? new Date(input.contractEndDate) : null,
        contractValue: input.contractValue?.toString(),
        billingCycle: input.billingCycle,
      });
      
      return { id: Number(result.insertId), success: true };
    }),
  
  // ============================================
  // CUSTOMER USER MANAGEMENT
  // ============================================
  
  // Invite customer user
  inviteCustomerUser: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      email: z.string().email(),
      name: z.string().max(255).optional(),
      role: z.enum(["owner", "admin", "viewer"]).default("viewer"),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user already exists
      const [existing] = await db.select()
        .from(customerUsers)
        .where(and(
          eq(customerUsers.customerId, input.customerId),
          eq(customerUsers.email, input.email)
        ))
        .limit(1);
      
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User already exists for this customer" });
      }
      
      // Generate verification token
      const verificationToken = crypto.randomUUID();
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      const result = await db.insert(customerUsers).values({
        customerId: input.customerId,
        email: input.email,
        name: input.name,
        role: input.role,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expires,
        invitedBy: ctx.user.id,
      });
      
      // Send invitation email with verification link
      const portalUrl = ENV.appUrl || 'https://app.kiisha.io';
      const verifyUrl = `${portalUrl}/portal/verify?token=${verificationToken}`;
      const { sendEmail } = await import('../services/email');
      await sendEmail({
        to: input.email,
        subject: 'You\'ve been invited to KIISHA Portal',
        html: `
          <h2>Welcome to KIISHA Portal</h2>
          <p>Hi ${input.name},</p>
          <p>You've been invited to access the KIISHA customer portal. Click the link below to verify your email and set up your account:</p>
          <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Verify Email & Get Started</a></p>
          <p>This link expires in 7 days.</p>
          <p>- The KIISHA Team</p>
        `,
      }).catch(err => console.error('[CustomerPortal] Failed to send invite email:', err));

      return { id: Number(result.insertId), verificationToken, success: true };
    }),
  
  // ============================================
  // CUSTOMER PORTAL AUTHENTICATION
  // ============================================
  
  // Customer login
  customerLogin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // First, try to find in customerUsers table (external customers)
      const [customerUser] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.email, input.email))
        .limit(1);
      
      if (customerUser && customerUser.passwordHash) {
        // Customer user found - authenticate as customer
        const validPassword = await bcrypt.compare(input.password, customerUser.passwordHash);
        if (!validPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        
        if (customerUser.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account is not active" });
        }
        
        // Resolve portal scope using the canonical model
        const portalScope = await resolvePortalScopeFromLegacy(customerUser.id);
        
        // Update last login
        await db.update(customerUsers)
          .set({
            lastLoginAt: new Date(),
            lastLoginIp: ctx.req?.headers?.["x-forwarded-for"]?.toString() || ctx.req?.socket?.remoteAddress,
          })
          .where(eq(customerUsers.id, customerUser.id));
        
        // Generate JWT token with portal scope info
        const token = jwt.sign(
          { 
            type: "customer",
            userId: customerUser.id,
            portalUserId: portalScope.portalUserId || customerUser.id,
            customerId: customerUser.customerId,
            email: customerUser.email,
            role: customerUser.role,
            isCompanyUser: false,
            // Include scope info for quick access checks
            allowedOrgIds: portalScope.allowedOrgIds,
            allowedProjectIds: portalScope.allowedProjectIds,
          },
          ENV.JWT_SECRET,
          { expiresIn: "7d" }
        );
        
        return {
          token,
          user: {
            id: customerUser.id,
            email: customerUser.email,
            name: customerUser.name,
            role: customerUser.role,
            customerId: customerUser.customerId,
            isCompanyUser: false,
          },
          // Include scope summary in response for client-side access control
          scope: {
            clientAccounts: portalScope.clientAccounts,
            allowedProjectIds: portalScope.allowedProjectIds,
            allowedSiteIds: portalScope.allowedSiteIds,
          },
        };
      }
      
      // If not found in customerUsers, try main users table (company users)
      const { users, organizationMembers, organizations } = await import('../../drizzle/schema');
      const [companyUser] = await db.select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      
      if (!companyUser || !companyUser.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      
      const validPassword = await bcrypt.compare(input.password, companyUser.passwordHash);
      if (!validPassword) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      
      // Get all organizations this company user has access to
      const memberships = await db.select({
        orgId: organizationMembers.organizationId,
        orgName: organizations.name,
        role: organizationMembers.role,
      })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
        .where(
          and(
            eq(organizationMembers.userId, companyUser.id),
            eq(organizationMembers.status, "active")
          )
        );
      
      // Get all customers across all orgs this user has access to
      const orgIds = memberships.map(m => m.orgId);
      let allCustomers: { id: number; name: string; companyName: string | null; organizationId: number }[] = [];
      
      if (orgIds.length > 0) {
        allCustomers = await db.select({
          id: customers.id,
          name: customers.name,
          companyName: customers.companyName,
          organizationId: customers.organizationId,
        })
          .from(customers)
          .where(sql`${customers.organizationId} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`);
      }
      
      // Generate JWT token for company user with full access
      const token = jwt.sign(
        { 
          type: "company",
          userId: companyUser.id,
          email: companyUser.email,
          name: companyUser.name,
          isCompanyUser: true,
          isSuperuser: companyUser.isSuperuser || false,
          // Company users can access all customers in their orgs
          allowedOrgIds: orgIds,
          allowedCustomerIds: allCustomers.map(c => c.id),
        },
        ENV.JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      return {
        token,
        user: {
          id: companyUser.id,
          email: companyUser.email,
          name: companyUser.name,
          role: "company_admin",
          isCompanyUser: true,
          isSuperuser: companyUser.isSuperuser || false,
        },
        // Include all accessible customers for company users
        scope: {
          organizations: memberships,
          customers: allCustomers,
          isCompanyUser: true,
        },
      };
    }),
  
  // Customer set password (first time or reset)
  customerSetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Find user by verification or reset token
      const [user] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.emailVerificationToken, input.token))
        .limit(1);
      
      if (!user) {
        // Try password reset token
        const [resetUser] = await db.select()
          .from(customerUsers)
          .where(eq(customerUsers.passwordResetToken, input.token))
          .limit(1);
        
        if (!resetUser || (resetUser.passwordResetExpires && resetUser.passwordResetExpires < new Date())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
        }
        
        const passwordHash = await bcrypt.hash(input.password, 10);
        await db.update(customerUsers)
          .set({
            passwordHash,
            passwordResetToken: null,
            passwordResetExpires: null,
          })
          .where(eq(customerUsers.id, resetUser.id));
        
        return { success: true };
      }
      
      // Check expiry
      if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token has expired" });
      }
      
      const passwordHash = await bcrypt.hash(input.password, 10);
      await db.update(customerUsers)
        .set({
          passwordHash,
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          status: "active",
        })
        .where(eq(customerUsers.id, user.id));
      
      return { success: true };
    }),
  
  // Request password reset (with rate limiting)
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // Rate limit by email to prevent abuse
      const { checkRateLimit, RateLimits } = await import('../middleware/rateLimit');
      const rateLimitResult = checkRateLimit(input.email.toLowerCase(), RateLimits.passwordReset);
      
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many password reset requests. Please try again in ${rateLimitResult.retryAfterSeconds} seconds.`,
        });
      }
      
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Find user by email
      const [user] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.email, input.email))
        .limit(1);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return { success: true };
      }
      
      // Generate reset token (single UUID, 36 chars fits in 64 char field)
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Store token in database
      await db.update(customerUsers)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: expiresAt,
        })
        .where(eq(customerUsers.id, user.id));
      
      // Send password reset email
      const { sendPasswordResetEmail } = await import('../services/email');
      const portalBaseUrl = process.env.PORTAL_BASE_URL || 'https://kiisha.io/portal';
      await sendPasswordResetEmail(input.email, resetToken, portalBaseUrl);
      
      // Also log for debugging
      console.log(`[Password Reset] Token for ${input.email}: ${resetToken}`);
      console.log(`[Password Reset] Reset URL: /portal/reset-password?token=${resetToken}`);
      
      return { success: true };
    }),
  
  // Get customer stats for dashboard card (admin view)
  getCustomerStats: protectedProcedure
    .input(z.object({
      orgId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get total customers count
      const [customerCount] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(customers)
        .where(eq(customers.organizationId, input.orgId));
      
      // Get active portal users count (customers with at least one active user)
      const [portalUserCount] = await db.select({ count: sql<number>`COUNT(DISTINCT ${customerUsers.customerId})` })
        .from(customerUsers)
        .innerJoin(customers, eq(customerUsers.customerId, customers.id))
        .where(
          and(
            eq(customers.organizationId, input.orgId),
            eq(customerUsers.status, "active"),
            eq(customerUsers.emailVerified, true)
          )
        );
      
      // Get customers with pending invoices
      const [pendingInvoiceCount] = await db.select({ count: sql<number>`COUNT(DISTINCT ${invoices.customerId})` })
        .from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .where(
          and(
            eq(customers.organizationId, input.orgId),
            sql`${invoices.status} IN ('sent', 'viewed', 'partial', 'overdue')`
          )
        );
      
      return {
        totalCustomers: customerCount?.count || 0,
        activePortalUsers: portalUserCount?.count || 0,
        customersWithPendingInvoices: pendingInvoiceCount?.count || 0,
      };
    }),
  
  // ============================================
  // CUSTOMER PORTAL - DASHBOARD DATA
  // ============================================
  
  // Get customer's dashboard data (for logged-in customer users)
  getMyDashboard: publicProcedure
    .input(z.object({
      customerId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get customer info
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      
      // Get invoice summary
      const invoiceStats = await db.select({
        totalInvoiced: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(${invoices.paidAmount}), 0)`,
        totalOutstanding: sql<number>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
        overdueCount: sql<number>`SUM(CASE WHEN ${invoices.status} = 'overdue' THEN 1 ELSE 0 END)`,
      })
        .from(invoices)
        .where(eq(invoices.customerId, input.customerId));
      
      const stats = invoiceStats[0] || { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 };
      
      // Get recent invoices (last 5)
      const recentInvoices = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        balanceDue: invoices.balanceDue,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        currency: invoices.currency,
      })
        .from(invoices)
        .where(eq(invoices.customerId, input.customerId))
        .orderBy(desc(invoices.issueDate))
        .limit(5);
      
      // Get recent payments (last 5)
      const recentPayments = await db.select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        paymentDate: payments.paymentDate,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
      })
        .from(payments)
        .where(eq(payments.customerId, input.customerId))
        .orderBy(desc(payments.paymentDate))
        .limit(5);
      
      // Get linked projects
      const projects = await db.select({
        id: customerProjects.id,
        projectId: customerProjects.projectId,
        accessLevel: customerProjects.accessLevel,
        status: customerProjects.status,
      })
        .from(customerProjects)
        .where(eq(customerProjects.customerId, input.customerId));
      
      return {
        customer: {
          id: customer.id,
          name: customer.name,
          companyName: customer.companyName,
          email: customer.email,
        },
        summary: {
          // Convert from cents to dollars
          totalInvoiced: Number(stats.totalInvoiced) / 100,
          totalPaid: Number(stats.totalPaid) / 100,
          totalOutstanding: Number(stats.totalOutstanding) / 100,
          overdueCount: Number(stats.overdueCount) || 0,
        },
        recentInvoices: recentInvoices.map(inv => ({
          ...inv,
          // Convert from cents to dollars
          totalAmount: Number(inv.totalAmount) / 100,
          paidAmount: Number(inv.paidAmount) / 100,
          balanceDue: Number(inv.balanceDue) / 100,
        })),
        recentPayments: recentPayments.map(pay => ({
          ...pay,
          // Convert from cents to dollars
          amount: Number(pay.amount) / 100,
        })),
        projects,
      };
    }),
  
  // ============================================
  // CUSTOMER PORTAL - INVOICES
  // ============================================
  
  // Get customer's invoices (customer-facing)
  getMyInvoices: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      status: z.enum(["draft", "sent", "viewed", "partial", "paid", "overdue", "cancelled", "refunded"]).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Build conditions array
      const conditions = [eq(invoices.customerId, input.customerId)];
      
      if (input.status) {
        conditions.push(eq(invoices.status, input.status));
      }
      
      // Add search filter for invoice number or notes
      if (input.search && input.search.trim()) {
        const searchTerm = `%${input.search.trim()}%`;
        conditions.push(
          or(
            like(invoices.invoiceNumber, searchTerm),
            like(invoices.notes, searchTerm)
          )!
        );
      }
      
      const result = await db.select()
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.issueDate))
        .limit(input.limit)
        .offset(input.offset);
      
      return result;
    }),
  
  // Get invoice details with line items
  getInvoiceDetails: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      
      const lineItems = await db.select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, input.invoiceId))
        .orderBy(invoiceLineItems.sortOrder);
      
      const paymentHistory = await db.select()
        .from(payments)
        .where(eq(payments.invoiceId, input.invoiceId))
        .orderBy(desc(payments.paymentDate));
      
      return { ...invoice, lineItems, payments: paymentHistory };
    }),
  
  // Mark invoice as viewed (customer action)
  markInvoiceViewed: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      
      if (invoice && invoice.status === "sent") {
        await db.update(invoices)
          .set({ status: "viewed" })
          .where(eq(invoices.id, input.invoiceId));
      }
      
      return { success: true };
    }),
  
  // Download invoice as PDF (customer action)
  downloadInvoicePdf: protectedProcedure
    .input(z.object({ 
      invoiceId: z.number(),
      customerId: z.number(),
    }))
    .query(async ({ input }) => {
      const { generateInvoicePdf } = await import('../services/invoicePdf');
      
      const result = await generateInvoicePdf(input.invoiceId, input.customerId);
      
      if (!result) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found or access denied" });
      }
      
      return result;
    }),
  
  // Preview invoice HTML (customer action)
  previewInvoice: protectedProcedure
    .input(z.object({ 
      invoiceId: z.number(),
      customerId: z.number(),
    }))
    .query(async ({ input }) => {
      const { generateInvoicePreview } = await import('../services/invoicePdf');
      
      const html = await generateInvoicePreview(input.invoiceId, input.customerId);
      
      if (!html) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found or access denied" });
      }
      
      return { html };
    }),
  
  // ============================================
  // INVOICE MANAGEMENT (Admin Operations)
  // ============================================
  
  // Create invoice
  createInvoice: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      customerId: z.number(),
      issueDate: z.string(),
      dueDate: z.string(),
      currency: z.string().length(3).default("USD"),
      notes: z.string().optional(),
      termsAndConditions: z.string().optional(),
      lineItems: z.array(z.object({
        description: z.string(),
        quantity: z.number().default(1),
        unitPrice: z.number(), // In cents
        taxRate: z.number().default(0),
        projectId: z.number().optional(),
        serviceType: z.string().optional(),
        periodStart: z.string().optional(),
        periodEnd: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Generate invoice number
      const year = new Date().getFullYear();
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(invoices)
        .where(eq(invoices.organizationId, input.orgId));
      const invoiceNumber = `INV-${year}-${String((countResult?.count || 0) + 1).padStart(5, "0")}`;
      
      // Calculate totals
      let subtotal = 0;
      let taxAmount = 0;
      
      for (const item of input.lineItems) {
        const amount = Math.round(item.quantity * item.unitPrice);
        const itemTax = Math.round(amount * (item.taxRate / 100));
        subtotal += amount;
        taxAmount += itemTax;
      }
      
      const totalAmount = subtotal + taxAmount;
      
      // Create invoice
      const result = await db.insert(invoices).values({
        organizationId: input.orgId,
        customerId: input.customerId,
        invoiceNumber,
        issueDate: new Date(input.issueDate),
        dueDate: new Date(input.dueDate),
        subtotal,
        taxAmount,
        totalAmount,
        balanceDue: totalAmount,
        currency: input.currency,
        notes: input.notes,
        termsAndConditions: input.termsAndConditions,
        createdBy: ctx.user.id,
      });
      
      const invoiceId = Number(result.insertId);
      
      // Create line items
      for (let i = 0; i < input.lineItems.length; i++) {
        const item = input.lineItems[i];
        const amount = Math.round(item.quantity * item.unitPrice);
        const itemTax = Math.round(amount * (item.taxRate / 100));
        
        await db.insert(invoiceLineItems).values({
          invoiceId,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice,
          amount,
          taxRate: item.taxRate.toString(),
          taxAmount: itemTax,
          projectId: item.projectId,
          serviceType: item.serviceType,
          periodStart: item.periodStart ? new Date(item.periodStart) : null,
          periodEnd: item.periodEnd ? new Date(item.periodEnd) : null,
          sortOrder: i,
        });
      }
      
      return { id: invoiceId, invoiceNumber, success: true };
    }),
  
  // Send invoice to customer
  sendInvoice: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });

      await db.update(invoices)
        .set({ status: "sent" })
        .where(eq(invoices.id, input.invoiceId));

      // Send email notification to customer
      if (invoice.customerId) {
        sendNewInvoiceEmail({
          invoiceId: input.invoiceId,
          customerId: invoice.customerId,
        }).catch(err => console.error('[CustomerPortal] Failed to send invoice email:', err));
      }

      return { success: true };
    }),
  
  // Record payment
  recordPayment: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      amount: z.number(), // In cents
      paymentMethod: z.enum(["card", "bank_transfer", "check", "cash", "other"]).default("bank_transfer"),
      referenceNumber: z.string().optional(),
      paymentDate: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      
      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }
      
      // Create payment record
      const result = await db.insert(payments).values({
        organizationId: invoice.organizationId,
        invoiceId: input.invoiceId,
        customerId: invoice.customerId,
        amount: input.amount,
        currency: invoice.currency,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.referenceNumber,
        status: "succeeded",
        paymentDate: new Date(input.paymentDate),
        processedAt: new Date(),
        notes: input.notes,
        recordedBy: ctx.user.id,
      });
      
      // Update invoice
      const newPaidAmount = (invoice.paidAmount || 0) + input.amount;
      const newBalanceDue = invoice.totalAmount - newPaidAmount;
      const newStatus = newBalanceDue <= 0 ? "paid" : newPaidAmount > 0 ? "partial" : invoice.status;
      
      await db.update(invoices)
        .set({
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
          paidDate: newBalanceDue <= 0 ? new Date() : null,
        })
        .where(eq(invoices.id, input.invoiceId));
      
      return { id: Number(result.insertId), success: true };
    }),
  
  // ============================================
  // BILLING DASHBOARD
  // ============================================
  
  // Get billing summary for organization
  getBillingSummary: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Total outstanding
      const [outstanding] = await db.select({
        total: sql<number>`COALESCE(SUM(balanceDue), 0)`,
        count: sql<number>`COUNT(*)`,
      })
        .from(invoices)
        .where(and(
          eq(invoices.organizationId, input.orgId),
          sql`status IN ('sent', 'viewed', 'partial', 'overdue')`
        ));
      
      // Overdue
      const [overdue] = await db.select({
        total: sql<number>`COALESCE(SUM(balanceDue), 0)`,
        count: sql<number>`COUNT(*)`,
      })
        .from(invoices)
        .where(and(
          eq(invoices.organizationId, input.orgId),
          eq(invoices.status, "overdue")
        ));
      
      // Collected this month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [collected] = await db.select({
        total: sql<number>`COALESCE(SUM(amount), 0)`,
      })
        .from(payments)
        .where(and(
          eq(payments.organizationId, input.orgId),
          eq(payments.status, "succeeded"),
          gte(payments.paymentDate, startOfMonth)
        ));
      
      // Recent invoices
      const recentInvoices = await db.select()
        .from(invoices)
        .where(eq(invoices.organizationId, input.orgId))
        .orderBy(desc(invoices.createdAt))
        .limit(5);
      
      return {
        totalOutstanding: outstanding?.total || 0,
        outstandingCount: outstanding?.count || 0,
        totalOverdue: overdue?.total || 0,
        overdueCount: overdue?.count || 0,
        collectedThisMonth: collected?.total || 0,
        recentInvoices,
      };
    }),
  
  // Get receivables aging report
  getReceivablesAging: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const now = new Date();
      
      // Get all unpaid invoices grouped by customer
      const unpaidInvoices = await db.select({
        customerId: invoices.customerId,
        balanceDue: invoices.balanceDue,
        dueDate: invoices.dueDate,
      })
        .from(invoices)
        .where(and(
          eq(invoices.organizationId, input.orgId),
          sql`status IN ('sent', 'viewed', 'partial', 'overdue')`,
          sql`balanceDue > 0`
        ));
      
      // Group by customer and aging bucket
      const agingByCustomer: Record<number, {
        current: number;
        days1to30: number;
        days31to60: number;
        days61to90: number;
        days91Plus: number;
        total: number;
      }> = {};
      
      for (const inv of unpaidInvoices) {
        if (!agingByCustomer[inv.customerId]) {
          agingByCustomer[inv.customerId] = {
            current: 0,
            days1to30: 0,
            days31to60: 0,
            days61to90: 0,
            days91Plus: 0,
            total: 0,
          };
        }
        
        const daysOverdue = inv.dueDate 
          ? Math.floor((now.getTime() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000))
          : 0;
        
        const bucket = agingByCustomer[inv.customerId];
        const amount = inv.balanceDue || 0;
        
        if (daysOverdue <= 0) {
          bucket.current += amount;
        } else if (daysOverdue <= 30) {
          bucket.days1to30 += amount;
        } else if (daysOverdue <= 60) {
          bucket.days31to60 += amount;
        } else if (daysOverdue <= 90) {
          bucket.days61to90 += amount;
        } else {
          bucket.days91Plus += amount;
        }
        bucket.total += amount;
      }
      
      // Get customer names
      const customerIds = Object.keys(agingByCustomer).map(Number);
      const customerList = customerIds.length > 0
        ? await db.select({ id: customers.id, name: customers.name, code: customers.code })
            .from(customers)
            .where(sql`id IN (${sql.join(customerIds.map(id => sql`${id}`), sql`, `)})`)
        : [];
      
      const customerMap = Object.fromEntries(customerList.map(c => [c.id, c]));
      
      return Object.entries(agingByCustomer).map(([customerId, aging]) => ({
        customerId: Number(customerId),
        customerName: customerMap[Number(customerId)]?.name || "Unknown",
        customerCode: customerMap[Number(customerId)]?.code || "",
        ...aging,
      }));
    }),

  // ============================================
  // PORTAL WORK ORDERS
  // ============================================
  
  // Create a new work order from portal
  createWorkOrder: publicProcedure
    .input(z.object({
      token: z.string(),
      title: z.string().min(5).max(200),
      description: z.string().min(10).max(5000),
      category: z.enum(['maintenance', 'repair', 'inspection', 'installation', 'support', 'other']),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
      projectId: z.number().optional(),
      siteId: z.number().optional(),
      assetId: z.number().optional(),
      preferredDate: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      attachmentUrls: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const portalUserId = decoded.portalUserId;
      const customerId = decoded.customerId;
      
      // Get customer for org context
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      
      // Generate reference number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const referenceNumber = `WO-${timestamp}-${random}`;
      
      // Create work order
      await db.execute(sql`
        INSERT INTO portalWorkOrders (
          clientAccountId, organizationId, projectId, siteId, assetId,
          title, description, category, priority, status,
          preferredDate, contactPhone, contactEmail, createdAt, updatedAt
        ) VALUES (
          ${customerId}, ${customer.organizationId}, ${input.projectId || null}, ${input.siteId || null}, ${input.assetId || null},
          ${input.title}, ${input.description}, ${input.category}, ${input.priority}, 'submitted',
          ${input.preferredDate || null}, ${input.contactPhone || null}, ${input.contactEmail || null},
          NOW(), NOW()
        )
      `);
      
      // Get the inserted work order
      const [workOrder] = await db.execute(sql`
        SELECT * FROM portalWorkOrders 
        WHERE clientAccountId = ${customerId} 
        ORDER BY createdAt DESC LIMIT 1
      `);
      
      const workOrderId = (workOrder as any[])[0]?.id;
      
      // Store attachments if provided
      if (input.attachmentUrls && input.attachmentUrls.length > 0 && workOrderId) {
        for (const url of input.attachmentUrls) {
          await db.execute(sql`
            INSERT INTO portalWorkOrderAttachments (
              portalWorkOrderId, url, uploadedAt
            ) VALUES (
              ${workOrderId}, ${url}, NOW()
            )
          `);
        }
      }
      
      return {
        success: true,
        workOrderId,
        referenceNumber,
      };
    }),
  
  // Upload file for work order
  uploadWorkOrderFile: publicProcedure
    .input(z.object({
      token: z.string(),
      filename: z.string(),
      mimeType: z.string(),
      data: z.string(), // base64 encoded
    }))
    .mutation(async ({ input }) => {
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Rate limit file uploads
      const { checkRateLimit, RateLimits } = await import('../middleware/rateLimit');
      const rateLimitResult = checkRateLimit(`customer-${customerId}`, RateLimits.fileUpload);
      
      if (!rateLimitResult.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many file uploads. Please try again in ${rateLimitResult.retryAfterSeconds} seconds.`,
        });
      }
      
      // Validate file size (base64 is ~33% larger than binary)
      const maxBase64Size = 10 * 1024 * 1024 * 1.4; // ~14MB base64 for 10MB file
      if (input.data.length > maxBase64Size) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 10MB)" });
      }
      
      // Validate mime type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ];
      if (!allowedTypes.includes(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File type not allowed" });
      }
      
      // Convert base64 to buffer
      const buffer = Buffer.from(input.data, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = input.filename.split('.').pop() || 'bin';
      const fileKey = `portal-uploads/${customerId}/${timestamp}-${random}.${ext}`;
      
      // Upload to S3
      const { storagePut } = await import('../storage');
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      
      return {
        success: true,
        url,
        filename: input.filename,
      };
    }),
  
  // List work orders for portal user
  listMyWorkOrders: publicProcedure
    .input(z.object({
      token: z.string(),
      status: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      let query = `SELECT * FROM portalWorkOrders WHERE clientAccountId = ${customerId}`;
      
      if (input.status) {
        query += ` AND status = '${input.status}'`;
      }
      if (input.category) {
        query += ` AND category = '${input.category}'`;
      }
      
      query += ` ORDER BY createdAt DESC LIMIT ${input.limit} OFFSET ${input.offset}`;
      
      const [workOrders] = await db.execute(sql.raw(query));
      
      // Get total count
      let countQuery = `SELECT COUNT(*) as count FROM portalWorkOrders WHERE clientAccountId = ${customerId}`;
      if (input.status) countQuery += ` AND status = '${input.status}'`;
      if (input.category) countQuery += ` AND category = '${input.category}'`;
      
      const [countResult] = await db.execute(sql.raw(countQuery));
      
      return {
        workOrders: workOrders as any[],
        total: (countResult as any[])[0]?.count || 0,
      };
    }),
  
  // Get work order details with comments
  getMyWorkOrder: publicProcedure
    .input(z.object({
      token: z.string(),
      workOrderId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get work order
      const [workOrderResult] = await db.execute(sql`
        SELECT * FROM portalWorkOrders 
        WHERE id = ${input.workOrderId} AND clientAccountId = ${customerId}
        LIMIT 1
      `);
      
      const workOrder = (workOrderResult as any[])[0];
      if (!workOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
      }
      
      // Get comments (excluding internal notes)
      const [comments] = await db.execute(sql`
        SELECT * FROM portalWorkOrderComments 
        WHERE portalWorkOrderId = ${input.workOrderId}
        AND (authorType = 'portal_user' OR authorType = 'operator')
        ORDER BY createdAt ASC
      `);
      
      return {
        workOrder,
        comments: comments as any[],
      };
    }),
  
  // Add comment to work order
  addWorkOrderComment: publicProcedure
    .input(z.object({
      token: z.string(),
      workOrderId: z.number(),
      content: z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const portalUserId = decoded.portalUserId;
      const customerId = decoded.customerId;
      
      // Verify work order belongs to customer
      const [workOrderResult] = await db.execute(sql`
        SELECT * FROM portalWorkOrders 
        WHERE id = ${input.workOrderId} AND clientAccountId = ${customerId}
        LIMIT 1
      `);
      
      if (!(workOrderResult as any[])[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
      }
      
      // Get portal user name
      const [portalUser] = await db.select().from(customerUsers).where(eq(customerUsers.id, portalUserId)).limit(1);
      const authorName = portalUser?.name || 'Customer';
      
      // Add comment
      await db.execute(sql`
        INSERT INTO portalWorkOrderComments (
          portalWorkOrderId, authorType, portalUserId, authorName, content, createdAt
        ) VALUES (
          ${input.workOrderId}, 'portal_user', ${portalUserId}, ${authorName}, ${input.content}, NOW()
        )
      `);
      
      // Update work order timestamp
      await db.execute(sql`
        UPDATE portalWorkOrders SET updatedAt = NOW() WHERE id = ${input.workOrderId}
      `);
      
      return { success: true };
    }),

  // ============================================
  // PORTAL PRODUCTION MONITORING
  // ============================================
  
  // Get production data for customer's projects
  getProductionData: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number().optional(),
      period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      metricTypes: z.array(z.string()).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get allowed projects for customer
      const allowedProjects = await db.select()
        .from(customerProjects)
        .where(eq(customerProjects.customerId, customerId));
      
      const allowedProjectIds = allowedProjects.map(p => p.projectId);
      
      // If specific project requested, verify access
      if (input.projectId && !allowedProjectIds.includes(input.projectId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this project" });
      }
      
      // Default allowed metrics
      const allowedMetrics = ['energy_production', 'performance_ratio', 'availability'];
      const requestedMetrics = input.metricTypes || allowedMetrics;
      const filteredMetrics = requestedMetrics.filter(m => allowedMetrics.includes(m));
      
      // Set default date range (last 30 days)
      const endDate = input.endDate ? new Date(input.endDate) : new Date();
      const startDate = input.startDate ? new Date(input.startDate) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Generate sample data (in production, query normalizedMeasurements)
      const dataPoints: any[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate && dataPoints.length < 100) {
        for (const metricType of filteredMetrics) {
          dataPoints.push({
            timestamp: new Date(currentDate).toISOString(),
            value: generateSampleValue(metricType),
            unit: getMetricUnit(metricType),
            metricType,
          });
        }
        
        switch (input.period) {
          case 'hour': currentDate.setHours(currentDate.getHours() + 1); break;
          case 'day': currentDate.setDate(currentDate.getDate() + 1); break;
          case 'week': currentDate.setDate(currentDate.getDate() + 7); break;
          case 'month': currentDate.setMonth(currentDate.getMonth() + 1); break;
        }
      }
      
      return {
        dataPoints,
        period: { start: startDate.toISOString(), end: endDate.toISOString() },
        metrics: filteredMetrics,
      };
    }),
  
  // Get production summary
  getProductionSummary: publicProcedure
    .input(z.object({
      token: z.string(),
      projectId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify portal user token
      let decoded: any;
      try {
        decoded = jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get allowed projects for customer
      const allowedProjects = await db.select()
        .from(customerProjects)
        .where(eq(customerProjects.customerId, customerId));
      
      // If specific project requested, verify access
      if (input.projectId && !allowedProjects.some(p => p.projectId === input.projectId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied to this project" });
      }
      
      // Return sample summary (in production, aggregate from normalizedMeasurements)
      return {
        totalProduction: 12500,
        averagePerformance: 85.5,
        peakOutput: 450,
        availability: 98.2,
        period: {
          start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          end: new Date().toISOString(),
        },
      };
    }),
  
  // Get allowed metrics for customer
  getAllowedMetrics: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      // Verify portal user token
      try {
        jwt.verify(input.token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      // Return default allowed metrics
      return {
        metrics: [
          { type: 'energy_production', label: 'Energy Production', unit: 'kWh' },
          { type: 'performance_ratio', label: 'Performance Ratio', unit: '%' },
          { type: 'availability', label: 'Availability', unit: '%' },
        ],
      };
    }),

  // ============================================
  // PORTAL PAYMENTS
  // ============================================
  
  // List customer's payments
  listMyPayments: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get token from cookies
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get payments for customer's invoices
      const customerPayments = await db.select({
        id: payments.id,
        invoiceId: payments.invoiceId,
        amount: payments.amount,
        method: payments.paymentMethod,
        status: payments.status,
        paymentDate: payments.paymentDate,
        referenceNumber: payments.referenceNumber,
        receiptUrl: payments.receiptUrl,
        invoiceNumber: invoices.invoiceNumber,
      })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(eq(invoices.customerId, customerId))
        .orderBy(desc(payments.paymentDate))
        .limit(input.limit)
        .offset(input.offset);
      
      // Get total count
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(eq(invoices.customerId, customerId));
      
      return {
        payments: customerPayments,
        total: countResult?.count || 0,
      };
    }),

  // ============================================
  // PORTAL PROJECTS
  // ============================================
  
  // List customer's projects
  listMyProjects: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get token from cookies
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get projects linked to customer
      const [projectsResult] = await db.execute(sql`
        SELECT 
          p.id,
          p.name,
          p.location,
          p.status,
          p.capacity,
          p.systemType,
          p.commissionDate,
          p.performanceRatio
        FROM customerProjects cp
        INNER JOIN projects p ON cp.projectId = p.id
        WHERE cp.customerId = ${customerId}
        ORDER BY p.name ASC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `);
      
      // Get total count
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM customerProjects WHERE customerId = ${customerId}
      `);
      
      return {
        projects: projectsResult as any[],
        total: (countResult as any[])[0]?.count || 0,
      };
    }),

  // ============================================
  // PORTAL DOCUMENTS
  // ============================================
  
  // List customer's documents
  listMyDocuments: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(100),
      offset: z.number().min(0).default(0),
      category: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get token from cookies
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Get customer's project IDs
      const customerProjectLinks = await db.select()
        .from(customerProjects)
        .where(eq(customerProjects.customerId, customerId));
      
      const projectIds = customerProjectLinks.map(p => p.projectId);
      
      if (projectIds.length === 0) {
        return { documents: [], total: 0 };
      }
      
      // Build category filter
      const categoryFilter = input.category ? sql`AND d.category = ${input.category}` : sql``;
      
      // Get documents for customer's projects
      const [documentsResult] = await db.execute(sql`
        SELECT 
          d.id,
          d.name,
          d.category,
          d.description,
          d.mimeType,
          d.size,
          d.url as downloadUrl,
          d.url as previewUrl,
          d.createdAt,
          p.name as projectName
        FROM documents d
        LEFT JOIN projects p ON d.projectId = p.id
        WHERE d.projectId IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})
        AND d.isCustomerVisible = 1
        ${categoryFilter}
        ORDER BY d.createdAt DESC
        LIMIT ${input.limit} OFFSET ${input.offset}
      `);
      
      // Get total count
      const [countResult] = await db.execute(sql`
        SELECT COUNT(*) as count FROM documents d
        WHERE d.projectId IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})
        AND d.isCustomerVisible = 1
        ${categoryFilter}
      `);
      
      return {
        documents: documentsResult as any[],
        total: (countResult as any[])[0]?.count || 0,
      };
    }),

  // Get single project detail for customer
  getMyProjectDetail: publicProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Verify customer has access to this project
      const [accessResult] = await db.execute(sql`
        SELECT cp.accessLevel FROM customerProjects cp
        WHERE cp.customerId = ${customerId} AND cp.projectId = ${input.projectId}
      `);
      
      if ((accessResult as any[]).length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or access denied" });
      }
      
      // Get project details
      const [projectResult] = await db.execute(sql`
        SELECT 
          id, name, code, status, stage, technology,
          capacityMw, capacityMwh, city, state, country, timezone,
          latitude, longitude, createdAt
        FROM projects
        WHERE id = ${input.projectId}
      `);
      
      if ((projectResult as any[]).length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      
      return (projectResult as any[])[0];
    }),

  // Get project production data
  getProjectProduction: publicProcedure
    .input(z.object({
      projectId: z.number(),
      period: z.enum(["day", "week", "month", "year"]).default("month"),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Verify access
      const [accessResult] = await db.execute(sql`
        SELECT cp.accessLevel FROM customerProjects cp
        WHERE cp.customerId = ${customerId} AND cp.projectId = ${input.projectId}
      `);
      
      if ((accessResult as any[]).length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or access denied" });
      }
      
      // Generate sample production data based on period
      const dataPoints = input.period === "day" ? 24 : input.period === "week" ? 7 : input.period === "month" ? 30 : 12;
      
      const data = Array.from({ length: dataPoints }, (_, i) => ({
        timestamp: new Date(Date.now() - (dataPoints - 1 - i) * (input.period === "day" ? 3600000 : 86400000)).toISOString(),
        production: Math.round(Math.random() * 100 + 50),
        expected: 120,
        performanceRatio: Math.round(Math.random() * 15 + 80),
        availability: Math.round(Math.random() * 3 + 97),
      }));
      
      return {
        projectId: input.projectId,
        period: input.period,
        data,
        summary: {
          totalProduction: data.reduce((sum, d) => sum + d.production, 0),
          avgPerformanceRatio: Math.round(data.reduce((sum, d) => sum + d.performanceRatio, 0) / data.length),
          avgAvailability: Math.round(data.reduce((sum, d) => sum + d.availability, 0) / data.length * 10) / 10,
        },
      };
    }),

  // Upload document from customer portal
  uploadDocument: publicProcedure
    .input(z.object({
      fileName: z.string(),
      fileData: z.string(), // Base64 encoded
      mimeType: z.string(),
      category: z.string(),
      description: z.string().optional(),
      projectId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Validate file size (10MB max)
      const fileBuffer = Buffer.from(input.fileData, 'base64');
      if (fileBuffer.length > 10 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File size exceeds 10MB limit" });
      }
      
      // If projectId provided, verify customer has access
      if (input.projectId) {
        const [accessResult] = await db.execute(sql`
          SELECT cp.accessLevel FROM customerProjects cp
          WHERE cp.customerId = ${customerId} AND cp.projectId = ${input.projectId}
        `);
        
        if ((accessResult as any[]).length === 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project" });
        }
      }
      
      // Upload to storage (using S3 helper)
      const { storagePut } = await import('../storage');
      const fileKey = `customer-uploads/${customerId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
      
      // Get a document type ID (create generic one if needed)
      let documentTypeId = 1;
      try {
        const [typeResult] = await db.execute(sql`
          SELECT id FROM documentTypes WHERE code = ${input.category} LIMIT 1
        `);
        if ((typeResult as any[]).length > 0) {
          documentTypeId = (typeResult as any[])[0].id;
        }
      } catch {
        // Use default type
      }
      
      // Insert document record
      const [result] = await db.execute(sql`
        INSERT INTO documents (projectId, documentTypeId, name, fileUrl, fileKey, mimeType, fileSize, status, notes, uploadedById, createdAt, updatedAt)
        VALUES (
          ${input.projectId || null},
          ${documentTypeId},
          ${input.fileName},
          ${url},
          ${fileKey},
          ${input.mimeType},
          ${fileBuffer.length},
          'pending',
          ${input.description || null},
          ${customerId},
          NOW(),
          NOW()
        )
      `);
      
      return {
        success: true,
        documentId: (result as any).insertId,
        url,
      };
    }),

  // Get project maintenance history
  getProjectMaintenance: publicProcedure
    .input(z.object({
      projectId: z.number(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerId = decoded.customerId;
      
      // Verify access
      const [accessResult] = await db.execute(sql`
        SELECT cp.accessLevel FROM customerProjects cp
        WHERE cp.customerId = ${customerId} AND cp.projectId = ${input.projectId}
      `);
      
      if ((accessResult as any[]).length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or access denied" });
      }
      
      // Try to get work orders for this project
      try {
        const [workOrdersResult] = await db.execute(sql`
          SELECT 
            id, title as description, type, status, createdAt as date
          FROM workOrders
          WHERE projectId = ${input.projectId}
          ORDER BY createdAt DESC
          LIMIT ${input.limit}
        `);
        
        return workOrdersResult as any[];
      } catch {
        // Return empty array if workOrders table doesn't exist or has different schema
        return [];
      }
    }),

  // ============================================
  // ADMIN ENDPOINTS FOR PORTAL WORK ORDERS
  // ============================================

  // Update portal work order status (admin only)
  updatePortalWorkOrderStatus: protectedProcedure
    .input(z.object({
      workOrderId: z.number(),
      status: z.enum(['submitted', 'acknowledged', 'in_progress', 'scheduled', 'completed', 'cancelled']),
      adminNotes: z.string().optional(),
      scheduledDate: z.string().optional(),
      sendNotification: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get work order details before update
      const [workOrderResult] = await db.execute(sql`
        SELECT * FROM portalWorkOrders WHERE id = ${input.workOrderId} LIMIT 1
      `);
      
      const workOrder = (workOrderResult as any[])[0];
      if (!workOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
      }
      
      const oldStatus = workOrder.status;
      
      // Update work order status
      if (input.scheduledDate) {
        await db.execute(sql`
          UPDATE portalWorkOrders 
          SET status = ${input.status}, scheduledDate = ${input.scheduledDate}, updatedAt = NOW()
          WHERE id = ${input.workOrderId}
        `);
      } else {
        await db.execute(sql`
          UPDATE portalWorkOrders 
          SET status = ${input.status}, updatedAt = NOW()
          WHERE id = ${input.workOrderId}
        `);
      }
      
      // Add admin notes as internal comment if provided
      if (input.adminNotes) {
        await db.execute(sql`
          INSERT INTO portalWorkOrderComments (
            portalWorkOrderId, authorType, authorName, content, createdAt
          ) VALUES (
            ${input.workOrderId}, 'operator', 'Support Team', ${input.adminNotes}, NOW()
          )
        `);
      }
      
      // Send email notification if enabled
      if (input.sendNotification && oldStatus !== input.status) {
        try {
          await sendWorkOrderStatusChangeEmail({
            workOrderId: input.workOrderId,
            customerId: workOrder.clientAccountId,
            oldStatus,
            newStatus: input.status,
            workOrderTitle: workOrder.title,
            workOrderReference: workOrder.referenceNumber || `WO-${input.workOrderId}`,
          });
        } catch (error) {
          console.error('[CustomerPortal] Failed to send status change email:', error);
        }
      }
      
      return { 
        success: true,
        oldStatus,
        newStatus: input.status,
        notificationSent: input.sendNotification,
      };
    }),

  // Add comment to work order from admin/operator (with email notification)
  addOperatorComment: protectedProcedure
    .input(z.object({
      workOrderId: z.number(),
      content: z.string().min(1).max(5000),
      authorName: z.string().default('Support Team'),
      sendNotification: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get work order details
      const [workOrderResult] = await db.execute(sql`
        SELECT * FROM portalWorkOrders WHERE id = ${input.workOrderId} LIMIT 1
      `);
      
      const workOrder = (workOrderResult as any[])[0];
      if (!workOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Work order not found" });
      }
      
      // Add comment
      await db.execute(sql`
        INSERT INTO portalWorkOrderComments (
          portalWorkOrderId, authorType, authorName, content, createdAt
        ) VALUES (
          ${input.workOrderId}, 'operator', ${input.authorName}, ${input.content}, NOW()
        )
      `);
      
      // Update work order timestamp
      await db.execute(sql`
        UPDATE portalWorkOrders SET updatedAt = NOW() WHERE id = ${input.workOrderId}
      `);
      
      // Send email notification if enabled
      if (input.sendNotification) {
        try {
          await sendWorkOrderCommentEmail({
            workOrderId: input.workOrderId,
            customerId: workOrder.clientAccountId,
            workOrderTitle: workOrder.title,
            workOrderReference: workOrder.referenceNumber || `WO-${input.workOrderId}`,
            commentAuthor: input.authorName,
            commentContent: input.content,
          });
        } catch (error) {
          console.error('[CustomerPortal] Failed to send comment notification email:', error);
        }
      }
      
      return { 
        success: true,
        notificationSent: input.sendNotification,
      };
    }),

  // Send new invoice notification email
  sendInvoiceNotification: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      customerId: z.number(),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await sendNewInvoiceEmail({
          invoiceId: input.invoiceId,
          customerId: input.customerId,
        });
        return result;
      } catch (error) {
        console.error('[CustomerPortal] Failed to send invoice notification:', error);
        return { success: false, error: String(error) };
      }
    }),

  // Send payment confirmation email
  sendPaymentConfirmation: protectedProcedure
    .input(z.object({
      invoiceId: z.number(),
      customerId: z.number(),
      paymentAmount: z.number(),
      paymentMethod: z.string(),
      referenceNumber: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const result = await sendPaymentConfirmationEmail(input);
        return result;
      } catch (error) {
        console.error('[CustomerPortal] Failed to send payment confirmation:', error);
        return { success: false, error: String(error) };
      }
    }),

  // ============================================
  // NOTIFICATION PREFERENCES
  // ============================================

  // Get customer notification preferences
  getNotificationPreferences: publicProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerUserId = decoded.userId;
      
      const [prefsResult] = await db.execute(sql`
        SELECT * FROM customer_notification_preferences
        WHERE customerUserId = ${customerUserId}
        LIMIT 1
      `);
      
      const prefs = (prefsResult as any[])[0];
      
      if (!prefs) {
        // Return defaults
        return {
          emailNewInvoice: true,
          emailPaymentConfirmation: true,
          emailPaymentReminder: true,
          emailWorkOrderStatusChange: true,
          emailWorkOrderComment: true,
          emailProductionReport: false,
          emailMaintenanceAlert: true,
          emailFrequency: 'immediate' as const,
          digestTime: '09:00',
          digestDayOfWeek: 1,
        };
      }
      
      return {
        emailNewInvoice: prefs.emailNewInvoice === 1,
        emailPaymentConfirmation: prefs.emailPaymentConfirmation === 1,
        emailPaymentReminder: prefs.emailPaymentReminder === 1,
        emailWorkOrderStatusChange: prefs.emailWorkOrderStatusChange === 1,
        emailWorkOrderComment: prefs.emailWorkOrderComment === 1,
        emailProductionReport: prefs.emailProductionReport === 1,
        emailMaintenanceAlert: prefs.emailMaintenanceAlert === 1,
        emailFrequency: prefs.emailFrequency || 'immediate',
        digestTime: prefs.digestTime || '09:00',
        digestDayOfWeek: prefs.digestDayOfWeek || 1,
      };
    }),

  // Update customer notification preferences
  updateNotificationPreferences: publicProcedure
    .input(z.object({
      emailNewInvoice: z.boolean(),
      emailPaymentConfirmation: z.boolean(),
      emailPaymentReminder: z.boolean(),
      emailWorkOrderStatusChange: z.boolean(),
      emailWorkOrderComment: z.boolean(),
      emailProductionReport: z.boolean(),
      emailMaintenanceAlert: z.boolean(),
      emailFrequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']),
      digestTime: z.string(),
      digestDayOfWeek: z.number().min(0).max(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const token = ctx.req?.cookies?.customer_token || ctx.req?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
      }
      
      let decoded: any;
      try {
        decoded = jwt.verify(token, ENV.JWT_SECRET);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });
      }
      
      const customerUserId = decoded.userId;
      
      await db.execute(sql`
        INSERT INTO customer_notification_preferences (
          customerUserId,
          emailNewInvoice,
          emailPaymentConfirmation,
          emailPaymentReminder,
          emailWorkOrderStatusChange,
          emailWorkOrderComment,
          emailProductionReport,
          emailMaintenanceAlert,
          emailFrequency,
          digestTime,
          digestDayOfWeek
        ) VALUES (
          ${customerUserId},
          ${input.emailNewInvoice ? 1 : 0},
          ${input.emailPaymentConfirmation ? 1 : 0},
          ${input.emailPaymentReminder ? 1 : 0},
          ${input.emailWorkOrderStatusChange ? 1 : 0},
          ${input.emailWorkOrderComment ? 1 : 0},
          ${input.emailProductionReport ? 1 : 0},
          ${input.emailMaintenanceAlert ? 1 : 0},
          ${input.emailFrequency},
          ${input.digestTime},
          ${input.digestDayOfWeek}
        )
        ON DUPLICATE KEY UPDATE
          emailNewInvoice = ${input.emailNewInvoice ? 1 : 0},
          emailPaymentConfirmation = ${input.emailPaymentConfirmation ? 1 : 0},
          emailPaymentReminder = ${input.emailPaymentReminder ? 1 : 0},
          emailWorkOrderStatusChange = ${input.emailWorkOrderStatusChange ? 1 : 0},
          emailWorkOrderComment = ${input.emailWorkOrderComment ? 1 : 0},
          emailProductionReport = ${input.emailProductionReport ? 1 : 0},
          emailMaintenanceAlert = ${input.emailMaintenanceAlert ? 1 : 0},
          emailFrequency = ${input.emailFrequency},
          digestTime = ${input.digestTime},
          digestDayOfWeek = ${input.digestDayOfWeek},
          updatedAt = NOW()
      `);
      
      return { success: true };
    }),
  
  // ============================================
  // COMPANY USER - CONSOLIDATED VIEW
  // ============================================
  
  // Get consolidated dashboard for company users viewing all customers
  getConsolidatedDashboard: publicProcedure
    .input(z.object({
      customerIds: z.array(z.number()),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (input.customerIds.length === 0) {
        return {
          customer: { name: 'All Customers', companyName: '0 customers' },
          summary: { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 },
          recentInvoices: [],
          recentPayments: [],
          projects: [],
        };
      }
      
      // Get aggregated invoice stats across all customers
      const invoiceStats = await db.select({
        totalInvoiced: sql<number>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        totalPaid: sql<number>`COALESCE(SUM(${invoices.paidAmount}), 0)`,
        totalOutstanding: sql<number>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
        overdueCount: sql<number>`SUM(CASE WHEN ${invoices.status} = 'overdue' THEN 1 ELSE 0 END)`,
      })
        .from(invoices)
        .where(sql`${invoices.customerId} IN (${sql.join(input.customerIds.map(id => sql`${id}`), sql`, `)})`);
      
      const stats = invoiceStats[0] || { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 };
      
      // Get recent invoices across all customers (last 10)
      const recentInvoices = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        balanceDue: invoices.balanceDue,
        status: invoices.status,
        issueDate: invoices.issueDate,
        dueDate: invoices.dueDate,
        currency: invoices.currency,
        customerId: invoices.customerId,
        customerName: customers.name,
        customerCompany: customers.companyName,
      })
        .from(invoices)
        .innerJoin(customers, eq(invoices.customerId, customers.id))
        .where(sql`${invoices.customerId} IN (${sql.join(input.customerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(invoices.issueDate))
        .limit(10);
      
      // Get recent payments across all customers (last 10)
      const recentPayments = await db.select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        paymentDate: payments.paymentDate,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        referenceNumber: payments.referenceNumber,
        customerId: payments.customerId,
        customerName: customers.name,
        customerCompany: customers.companyName,
      })
        .from(payments)
        .innerJoin(customers, eq(payments.customerId, customers.id))
        .where(sql`${payments.customerId} IN (${sql.join(input.customerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(payments.paymentDate))
        .limit(10);
      
      // Get all linked projects across all customers
      const projects = await db.select({
        id: customerProjects.id,
        projectId: customerProjects.projectId,
        accessLevel: customerProjects.accessLevel,
        status: customerProjects.status,
        customerId: customerProjects.customerId,
      })
        .from(customerProjects)
        .where(sql`${customerProjects.customerId} IN (${sql.join(input.customerIds.map(id => sql`${id}`), sql`, `)})`);
      
      return {
        customer: { 
          name: 'All Customers', 
          companyName: `${input.customerIds.length} customer${input.customerIds.length !== 1 ? 's' : ''}` 
        },
        summary: {
          // Convert from cents to dollars
          totalInvoiced: Number(stats.totalInvoiced) / 100,
          totalPaid: Number(stats.totalPaid) / 100,
          totalOutstanding: Number(stats.totalOutstanding) / 100,
          overdueCount: Number(stats.overdueCount) || 0,
        },
        recentInvoices: recentInvoices.map(inv => ({
          ...inv,
          // Convert from cents to dollars
          totalAmount: Number(inv.totalAmount) / 100,
          paidAmount: Number(inv.paidAmount) / 100,
          balanceDue: Number(inv.balanceDue) / 100,
        })),
        recentPayments: recentPayments.map(pay => ({
          ...pay,
          // Convert from cents to dollars
          amount: Number(pay.amount) / 100,
        })),
        projects,
      };
    }),
  
  // ============================================
  // PORTAL OAUTH AUTHENTICATION
  // ============================================
  
  // Get OAuth authorization URL for portal
  getPortalOAuthUrl: publicProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"]),
    }))
    .mutation(async ({ input }) => {
      const crypto = await import('crypto');
      
      const OAUTH_PROVIDERS: Record<string, { authorizationUrl: string; scopes: string[]; clientIdEnv: string }> = {
        google: {
          authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          scopes: ["openid", "email", "profile"],
          clientIdEnv: "GOOGLE_CLIENT_ID",
        },
        github: {
          authorizationUrl: "https://github.com/login/oauth/authorize",
          scopes: ["read:user", "user:email"],
          clientIdEnv: "GITHUB_CLIENT_ID",
        },
        microsoft: {
          authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
          scopes: ["openid", "email", "profile", "User.Read"],
          clientIdEnv: "MICROSOFT_CLIENT_ID",
        },
      };
      
      const config = OAUTH_PROVIDERS[input.provider];
      const clientId = process.env[config.clientIdEnv];
      
      if (!clientId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${input.provider} OAuth is not configured`,
        });
      }
      
      const state = crypto.randomBytes(16).toString("hex");
      const redirectUri = `${ENV.appUrl}/portal/oauth/callback`;
      
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: config.scopes.join(" "),
        state: `portal_${input.provider}_${state}`,
      });
      
      if (input.provider === "google") {
        params.set("access_type", "offline");
        params.set("prompt", "consent");
      }
      
      return {
        url: `${config.authorizationUrl}?${params.toString()}`,
        state: `portal_${input.provider}_${state}`,
      };
    }),
  
  // Handle OAuth callback for portal
  handlePortalOAuthCallback: publicProcedure
    .input(z.object({
      provider: z.enum(["google", "github", "microsoft"]),
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const OAUTH_CONFIGS: Record<string, { tokenUrl: string; userInfoUrl: string; emailUrl?: string; clientIdEnv: string; clientSecretEnv: string }> = {
        google: {
          tokenUrl: "https://oauth2.googleapis.com/token",
          userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
          clientIdEnv: "GOOGLE_CLIENT_ID",
          clientSecretEnv: "GOOGLE_CLIENT_SECRET",
        },
        github: {
          tokenUrl: "https://github.com/login/oauth/access_token",
          userInfoUrl: "https://api.github.com/user",
          emailUrl: "https://api.github.com/user/emails",
          clientIdEnv: "GITHUB_CLIENT_ID",
          clientSecretEnv: "GITHUB_CLIENT_SECRET",
        },
        microsoft: {
          tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
          userInfoUrl: "https://graph.microsoft.com/v1.0/me",
          clientIdEnv: "MICROSOFT_CLIENT_ID",
          clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
        },
      };
      
      const config = OAUTH_CONFIGS[input.provider];
      const clientId = process.env[config.clientIdEnv];
      const clientSecret = process.env[config.clientSecretEnv];
      
      if (!clientId || !clientSecret) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `${input.provider} OAuth is not configured` });
      }
      
      const redirectUri = `${ENV.appUrl}/portal/oauth/callback`;
      
      // Exchange code for tokens
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });
      
      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
      if (input.provider === "github") headers["Accept"] = "application/json";
      
      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers,
        body: tokenParams.toString(),
      });
      
      if (!tokenResponse.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to exchange code for tokens" });
      }
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      
      // Get user info
      const userInfoResponse = await fetch(config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      });
      
      if (!userInfoResponse.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to get user info" });
      }
      
      const userData = await userInfoResponse.json();
      
      // Extract email based on provider
      let email: string | null = null;
      let name: string | null = null;
      let providerId: string;
      
      switch (input.provider) {
        case "google":
          email = userData.email;
          name = userData.name;
          providerId = userData.id;
          break;
        case "github":
          email = userData.email;
          name = userData.name || userData.login;
          providerId = String(userData.id);
          // GitHub may not return email, need to fetch separately
          if (!email && config.emailUrl) {
            const emailResponse = await fetch(config.emailUrl, {
              headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
            });
            if (emailResponse.ok) {
              const emails = await emailResponse.json();
              const primaryEmail = emails.find((e: { primary: boolean }) => e.primary);
              email = primaryEmail?.email || emails[0]?.email;
            }
          }
          break;
        case "microsoft":
          email = userData.mail || userData.userPrincipalName;
          name = userData.displayName;
          providerId = userData.id;
          break;
      }
      
      if (!email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not retrieve email from OAuth provider" });
      }
      
      // Check if this email exists in customerUsers (customer)
      const [existingCustomerUser] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.email, email))
        .limit(1);
      
      if (existingCustomerUser) {
        // Customer user exists - authenticate them
        if (existingCustomerUser.status !== "active") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Account is not active" });
        }
        
        // Update OAuth provider info
        await db.update(customerUsers)
          .set({
            oauthProvider: input.provider,
            oauthProviderId: providerId,
            lastLoginAt: new Date(),
            lastLoginIp: ctx.req?.headers?.["x-forwarded-for"]?.toString() || ctx.req?.socket?.remoteAddress,
          })
          .where(eq(customerUsers.id, existingCustomerUser.id));
        
        const portalScope = await resolvePortalScopeFromLegacy(existingCustomerUser.id);
        
        const token = jwt.sign(
          {
            type: "customer",
            userId: existingCustomerUser.id,
            portalUserId: portalScope.portalUserId || existingCustomerUser.id,
            customerId: existingCustomerUser.customerId,
            email: existingCustomerUser.email,
            role: existingCustomerUser.role,
            isCompanyUser: false,
            allowedOrgIds: portalScope.allowedOrgIds,
            allowedProjectIds: portalScope.allowedProjectIds,
          },
          ENV.JWT_SECRET,
          { expiresIn: "7d" }
        );
        
        return {
          token,
          user: {
            id: existingCustomerUser.id,
            email: existingCustomerUser.email,
            name: existingCustomerUser.name,
            role: existingCustomerUser.role,
            customerId: existingCustomerUser.customerId,
            isCompanyUser: false,
          },
          scope: {
            clientAccounts: portalScope.clientAccounts,
            allowedProjectIds: portalScope.allowedProjectIds,
            allowedSiteIds: portalScope.allowedSiteIds,
          },
          isNewUser: false,
        };
      }
      
      // Check if this email exists in main users table (company user)
      const { users, organizationMembers, organizations } = await import('../../drizzle/schema');
      const [companyUser] = await db.select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (companyUser) {
        // Company user - authenticate with full access
        const memberships = await db.select({
          orgId: organizationMembers.organizationId,
          orgName: organizations.name,
          role: organizationMembers.role,
        })
          .from(organizationMembers)
          .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
          .where(
            and(
              eq(organizationMembers.userId, companyUser.id),
              eq(organizationMembers.status, "active")
            )
          );
        
        const orgIds = memberships.map(m => m.orgId);
        let allCustomers: { id: number; name: string; companyName: string | null; organizationId: number }[] = [];
        
        if (orgIds.length > 0) {
          allCustomers = await db.select({
            id: customers.id,
            name: customers.name,
            companyName: customers.companyName,
            organizationId: customers.organizationId,
          })
            .from(customers)
            .where(sql`${customers.organizationId} IN (${sql.join(orgIds.map(id => sql`${id}`), sql`, `)})`);
        }
        
        const token = jwt.sign(
          {
            type: "company",
            userId: companyUser.id,
            email: companyUser.email,
            name: companyUser.name,
            isCompanyUser: true,
            isSuperuser: companyUser.isSuperuser || false,
            allowedOrgIds: orgIds,
            allowedCustomerIds: allCustomers.map(c => c.id),
          },
          ENV.JWT_SECRET,
          { expiresIn: "7d" }
        );
        
        return {
          token,
          user: {
            id: companyUser.id,
            email: companyUser.email,
            name: companyUser.name,
            role: "company_admin",
            isCompanyUser: true,
            isSuperuser: companyUser.isSuperuser || false,
          },
          scope: {
            organizations: memberships,
            customers: allCustomers,
            isCompanyUser: true,
          },
          isNewUser: false,
        };
      }
      
      // New user - create a pending customer user account
      // They won't have access to any customer data until an admin approves them
      const [newCustomerUser] = await db.insert(customerUsers)
        .values({
          email,
          name,
          customerId: 0, // No customer assigned yet - pending approval
          role: "viewer",
          status: "pending", // Pending until admin approves
          oauthProvider: input.provider,
          oauthProviderId: providerId,
          emailVerified: true, // OAuth emails are verified
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      // Generate token for new user (limited access)
      const token = jwt.sign(
        {
          type: "customer",
          userId: newCustomerUser.id,
          portalUserId: newCustomerUser.id,
          customerId: 0,
          email: newCustomerUser.email,
          role: "viewer",
          isCompanyUser: false,
          isPendingApproval: true,
          allowedOrgIds: [],
          allowedProjectIds: [],
        },
        ENV.JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      return {
        token,
        user: {
          id: newCustomerUser.id,
          email: newCustomerUser.email,
          name: newCustomerUser.name,
          role: "viewer",
          customerId: 0,
          isCompanyUser: false,
          isPendingApproval: true,
        },
        scope: {
          clientAccounts: [],
          allowedProjectIds: [],
          allowedSiteIds: [],
        },
        isNewUser: true,
        pendingApproval: true,
      };
    }),
  
  // Customer self-registration with email/password
  customerRegister: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if email already exists
      const [existingUser] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.email, input.email))
        .limit(1);
      
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      }
      
      // Also check main users table
      const { users } = await import('../../drizzle/schema');
      const [existingCompanyUser] = await db.select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      
      if (existingCompanyUser) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists. Please use the main login." });
      }
      
      // Create verification token
      const crypto = await import('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const passwordHash = await bcrypt.hash(input.password, 10);
      
      // Create pending customer user
      const [newUser] = await db.insert(customerUsers)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
          customerId: 0, // No customer assigned yet
          role: "viewer",
          status: "pending", // Pending until email verified and admin approves
          emailVerified: false,
          emailVerificationToken: verificationToken,
          emailVerificationExpires: verificationExpires,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      // Send verification email
      const { getNotifyAdapter } = await import('../providers/factory');
      const notifyProvider = await getNotifyAdapter(0);
      
      const verifyUrl = `${ENV.appUrl}/portal/verify-email?token=${verificationToken}`;
      
      await notifyProvider.sendEmail({
        to: input.email,
        subject: 'Verify your KIISHA Customer Portal account',
        html: `
          <h1>Welcome to KIISHA Customer Portal!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="${verifyUrl}">Verify Email</a></p>
          <p>Or copy and paste this link: ${verifyUrl}</p>
          <p>This link expires in 24 hours.</p>
          <p>After verification, you'll need to wait for your service provider to grant you access to your account.</p>
        `,
      });
      
      return {
        success: true,
        message: 'Account created. Please check your email to verify your account.',
      };
    }),
  
  // Verify customer email
  verifyCustomerEmail: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [user] = await db.select()
        .from(customerUsers)
        .where(eq(customerUsers.emailVerificationToken, input.token))
        .limit(1);
      
      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid verification token" });
      }
      
      if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Verification token has expired" });
      }
      
      await db.update(customerUsers)
        .set({
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(customerUsers.id, user.id));
      
      return {
        success: true,
        message: 'Email verified successfully. Please wait for your service provider to grant you access.',
      };
    }),
  
  // Get available OAuth providers for portal
  getPortalOAuthProviders: publicProcedure.query(async () => {
    return [
      {
        provider: "google",
        name: "Google",
        configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
      {
        provider: "github",
        name: "GitHub",
        configured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      },
      {
        provider: "microsoft",
        name: "Microsoft",
        configured: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      },
    ];
  }),
  
  // ============================================
  // PENDING USER MANAGEMENT (Admin Operations)
  // ============================================
  
  // List pending customer users awaiting approval
  listPendingCustomerUsers: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get pending users (status = 'pending' or customerId = 0)
      const pendingUsers = await db.select({
        id: customerUsers.id,
        email: customerUsers.email,
        name: customerUsers.name,
        status: customerUsers.status,
        emailVerified: customerUsers.emailVerified,
        createdAt: customerUsers.createdAt,
        customerId: customerUsers.customerId,
      })
        .from(customerUsers)
        .where(
          or(
            eq(customerUsers.status, 'pending'),
            eq(customerUsers.customerId, 0)
          )
        )
        .orderBy(desc(customerUsers.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      
      // Get total count
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` })
        .from(customerUsers)
        .where(
          or(
            eq(customerUsers.status, 'pending'),
            eq(customerUsers.customerId, 0)
          )
        );
      
      return {
        users: pendingUsers,
        total: countResult?.count || 0,
      };
    }),
  
  // Approve a pending customer user and assign to a customer
  approveCustomerUser: protectedProcedure
    .input(z.object({
      userId: z.number(),
      customerId: z.number(),
      role: z.enum(['admin', 'viewer']).default('viewer'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify customer exists
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      
      // Verify user exists and is pending
      const [user] = await db.select().from(customerUsers).where(eq(customerUsers.id, input.userId)).limit(1);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      
      // Update user to assign to customer and activate
      await db.update(customerUsers)
        .set({
          customerId: input.customerId,
          status: 'active',
          role: input.role,
          updatedAt: new Date(),
        })
        .where(eq(customerUsers.id, input.userId));
      
      // Send approval notification email to user
      if (user.email) {
        const { sendEmail } = await import('../services/email');
        sendEmail({
          to: user.email,
          subject: 'Your KIISHA Portal Access Has Been Approved',
          html: `
            <h2>Access Approved</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your request to access the KIISHA customer portal has been approved. You now have access to ${customer.name}'s portal.</p>
            <p><a href="${ENV.appUrl || 'https://app.kiisha.io'}/portal" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Go to Portal</a></p>
            <p>- The KIISHA Team</p>
          `,
        }).catch(err => console.error('[CustomerPortal] Failed to send approval email:', err));
      }

      return {
        success: true,
        message: `User ${user.email} has been approved and assigned to ${customer.name}`,
      };
    }),
  
  // Reject/delete a pending customer user
  rejectCustomerUser: protectedProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify user exists
      const [user] = await db.select().from(customerUsers).where(eq(customerUsers.id, input.userId)).limit(1);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      
      // Delete the user
      await db.delete(customerUsers).where(eq(customerUsers.id, input.userId));
      
      // Send rejection notification email to user
      if (user.email) {
        const { sendEmail } = await import('../services/email');
        sendEmail({
          to: user.email,
          subject: 'KIISHA Portal Access Update',
          html: `
            <h2>Access Request Update</h2>
            <p>Hi ${user.name || 'there'},</p>
            <p>Your request to access the KIISHA customer portal was not approved${input.reason ? `: ${input.reason}` : '.'}.</p>
            <p>If you believe this was a mistake, please contact the account administrator.</p>
            <p>- The KIISHA Team</p>
          `,
        }).catch(err => console.error('[CustomerPortal] Failed to send rejection email:', err));
      }

      return {
        success: true,
        message: `User ${user.email} has been rejected and removed`,
      };
    }),
  
  // Pre-register an email for automatic access (whitelist)
  preRegisterCustomerEmail: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      email: z.string().email(),
      role: z.enum(['admin', 'viewer']).default('viewer'),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Verify customer exists
      const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }
      
      // Check if email already exists
      const [existingUser] = await db.select().from(customerUsers).where(eq(customerUsers.email, input.email.toLowerCase())).limit(1);
      if (existingUser) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }
      
      // Create a pre-registered user entry (they'll complete registration when they sign up)
      await db.insert(customerUsers).values({
        customerId: input.customerId,
        email: input.email.toLowerCase(),
        name: input.email.split('@')[0], // Placeholder name
        password: '', // No password yet
        role: input.role,
        status: 'invited', // Special status for pre-registered
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      return {
        success: true,
        message: `Email ${input.email} has been pre-registered for ${customer.name}`,
      };
    }),
  
  // List pre-registered emails for a customer
  listPreRegisteredEmails: protectedProcedure
    .input(z.object({
      customerId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const preRegistered = await db.select({
        id: customerUsers.id,
        email: customerUsers.email,
        role: customerUsers.role,
        status: customerUsers.status,
        createdAt: customerUsers.createdAt,
      })
        .from(customerUsers)
        .where(
          and(
            eq(customerUsers.customerId, input.customerId),
            eq(customerUsers.status, 'invited')
          )
        )
        .orderBy(desc(customerUsers.createdAt));
      
      return preRegistered;
    }),
  
  // Remove a pre-registered email
  removePreRegisteredEmail: protectedProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [user] = await db.select().from(customerUsers).where(eq(customerUsers.id, input.userId)).limit(1);
      if (!user || user.status !== 'invited') {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pre-registered email not found" });
      }
      
      await db.delete(customerUsers).where(eq(customerUsers.id, input.userId));
      
      return {
        success: true,
        message: `Pre-registered email ${user.email} has been removed`,
      };
    }),
});

// Helper functions for production data
function generateSampleValue(metricType: string): number {
  switch (metricType) {
    case 'energy_production': return Math.round(Math.random() * 500 + 200);
    case 'performance_ratio': return Math.round(Math.random() * 20 + 75);
    case 'availability': return Math.round(Math.random() * 5 + 95);
    default: return 0;
  }
}

function getMetricUnit(metricType: string): string {
  switch (metricType) {
    case 'energy_production': return 'kWh';
    case 'performance_ratio':
    case 'availability': return '%';
    default: return '';
  }
}
