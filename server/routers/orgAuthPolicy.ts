import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { orgAuthPolicies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Organization Auth Policy Router
 * Allows admins to manage authentication policies for their organization
 */
export const orgAuthPolicyRouter = router({
  // Get auth policy for an organization
  getPolicy: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is admin of the org
      if (ctx.user.role !== "admin" && ctx.user.activeOrgId !== input.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized to view this policy" });
      }
      
      const [policy] = await db
        .select()
        .from(orgAuthPolicies)
        .where(eq(orgAuthPolicies.organizationId, input.orgId))
        .limit(1);
      
      // Return default policy if none exists
      if (!policy) {
        return {
          organizationId: input.orgId,
          allowedProviders: ["manus", "google", "github", "microsoft", "email"],
          requireCompanyEmail: false,
          allowedEmailDomains: null,
          requirePhoneVerification: false,
          allowedPhoneCountries: null,
          allowSocialAccountLinking: true,
          maxLinkedAccounts: 5,
          requireMfa: false,
          mfaMethods: ["totp"],
          maxSessionDurationHours: 720,
          idleTimeoutMinutes: 60,
          minPasswordLength: 8,
          requirePasswordComplexity: true,
          passwordExpiryDays: null,
          allowedIpRanges: null,
        };
      }
      
      return policy;
    }),
  
  // Update auth policy for an organization
  updatePolicy: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      allowedProviders: z.array(z.string()).optional(),
      requireCompanyEmail: z.boolean().optional(),
      allowedEmailDomains: z.array(z.string()).optional().nullable(),
      requirePhoneVerification: z.boolean().optional(),
      allowedPhoneCountries: z.array(z.string()).optional().nullable(),
      allowSocialAccountLinking: z.boolean().optional(),
      maxLinkedAccounts: z.number().min(1).max(10).optional(),
      requireMfa: z.boolean().optional(),
      mfaMethods: z.array(z.enum(["totp", "sms", "email"])).optional(),
      maxSessionDurationHours: z.number().min(1).max(8760).optional(), // Max 1 year
      idleTimeoutMinutes: z.number().min(5).max(1440).optional(), // Max 24 hours
      minPasswordLength: z.number().min(6).max(128).optional(),
      requirePasswordComplexity: z.boolean().optional(),
      passwordExpiryDays: z.number().min(30).max(365).optional().nullable(),
      allowedIpRanges: z.array(z.string()).optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update auth policies" });
      }
      
      const { orgId, ...updates } = input;
      
      // Check if policy exists
      const [existing] = await db
        .select()
        .from(orgAuthPolicies)
        .where(eq(orgAuthPolicies.organizationId, orgId))
        .limit(1);
      
      if (existing) {
        // Update existing policy
        await db
          .update(orgAuthPolicies)
          .set({
            ...updates,
            updatedBy: ctx.user.id,
          })
          .where(eq(orgAuthPolicies.organizationId, orgId));
      } else {
        // Create new policy
        await db.insert(orgAuthPolicies).values({
          organizationId: orgId,
          allowedProviders: updates.allowedProviders || ["manus", "google", "github", "microsoft", "email"],
          requireCompanyEmail: updates.requireCompanyEmail ?? false,
          allowedEmailDomains: updates.allowedEmailDomains,
          requirePhoneVerification: updates.requirePhoneVerification ?? false,
          allowedPhoneCountries: updates.allowedPhoneCountries,
          allowSocialAccountLinking: updates.allowSocialAccountLinking ?? true,
          maxLinkedAccounts: updates.maxLinkedAccounts ?? 5,
          requireMfa: updates.requireMfa ?? false,
          mfaMethods: updates.mfaMethods || ["totp"],
          maxSessionDurationHours: updates.maxSessionDurationHours ?? 720,
          idleTimeoutMinutes: updates.idleTimeoutMinutes ?? 60,
          minPasswordLength: updates.minPasswordLength ?? 8,
          requirePasswordComplexity: updates.requirePasswordComplexity ?? true,
          passwordExpiryDays: updates.passwordExpiryDays,
          allowedIpRanges: updates.allowedIpRanges,
          updatedBy: ctx.user.id,
        });
      }
      
      return { success: true };
    }),
  
  // Check if a provider is allowed for an organization
  isProviderAllowed: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      provider: z.string(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { allowed: true };
      
      const [policy] = await db
        .select()
        .from(orgAuthPolicies)
        .where(eq(orgAuthPolicies.organizationId, input.orgId))
        .limit(1);
      
      if (!policy || !policy.allowedProviders) {
        // Default: all providers allowed
        return { allowed: true };
      }
      
      return { allowed: policy.allowedProviders.includes(input.provider) };
    }),
  
  // Check if email domain is allowed for an organization
  isEmailDomainAllowed: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      email: z.string().email(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { allowed: true };
      
      const [policy] = await db
        .select()
        .from(orgAuthPolicies)
        .where(eq(orgAuthPolicies.organizationId, input.orgId))
        .limit(1);
      
      if (!policy || !policy.requireCompanyEmail || !policy.allowedEmailDomains) {
        // No domain restrictions
        return { allowed: true };
      }
      
      const domain = input.email.split("@")[1]?.toLowerCase();
      const allowed = policy.allowedEmailDomains.some(
        (d) => d.toLowerCase() === domain
      );
      
      return { allowed, requiredDomains: policy.allowedEmailDomains };
    }),
  
  // Check if social account linking is allowed
  canLinkSocialAccount: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      currentLinkedCount: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { allowed: true, canAddMore: input.currentLinkedCount < 5, maxAllowed: 5 };
      
      const [policy] = await db
        .select()
        .from(orgAuthPolicies)
        .where(eq(orgAuthPolicies.organizationId, input.orgId))
        .limit(1);
      
      if (!policy) {
        // Default: linking allowed, max 5
        return { 
          allowed: true, 
          canAddMore: input.currentLinkedCount < 5,
          maxAllowed: 5,
        };
      }
      
      if (!policy.allowSocialAccountLinking) {
        return { 
          allowed: false, 
          canAddMore: false,
          reason: "Social account linking is disabled for this organization",
        };
      }
      
      const maxAllowed = policy.maxLinkedAccounts || 5;
      return {
        allowed: true,
        canAddMore: input.currentLinkedCount < maxAllowed,
        maxAllowed,
      };
    }),
});
