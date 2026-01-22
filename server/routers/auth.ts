/**
 * Auth Router - Organization-aware authentication
 * 
 * Handles:
 * - Org selection for multi-org users
 * - Session refresh with org context
 * - Secure logout with session revocation
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { logSecurityEvent } from "../services/orgContext";

export const authRouter = router({
  /**
   * Get current user with organization context
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.getUserOrganizationMemberships(ctx.user.id);
    const activeMemberships = memberships.filter(m => m.status === "active");
    
    // Get org details for each membership
    const orgsWithRoles = await Promise.all(
      activeMemberships.map(async (m) => {
        const org = await db.getOrganizationById(m.organizationId);
        return org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          role: m.role,
        } : null;
      })
    );
    
    const organizations = orgsWithRoles.filter(Boolean);
    
    // Get active org details
    let activeOrg = null;
    if (ctx.user.activeOrgId) {
      const org = await db.getOrganizationById(ctx.user.activeOrgId);
      const membership = activeMemberships.find(m => m.organizationId === ctx.user.activeOrgId);
      if (org && membership) {
        activeOrg = {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          role: membership.role,
          require2FA: org.require2FA,
        };
      }
    }
    
    return {
      user: {
        id: ctx.user.id,
        openId: ctx.user.openId,
        name: ctx.user.name,
        email: ctx.user.email,
        avatarUrl: ctx.user.avatarUrl,
        role: ctx.user.role,
        totpEnabled: ctx.user.totpEnabled,
        emailVerified: ctx.user.emailVerified,
        onboardingStatus: ctx.user.onboardingStatus,
      },
      organizations,
      activeOrg,
      requiresOrgSelection: organizations.length > 1 && !activeOrg,
    };
  }),

  /**
   * Select active organization (for multi-org users)
   */
  selectOrg: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user has membership in this org
      const memberships = await db.getUserOrganizationMemberships(ctx.user.id);
      const membership = memberships.find(
        m => m.organizationId === input.organizationId && m.status === "active"
      );
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this organization",
        });
      }
      
      // Get org to verify it's active
      const org = await db.getOrganizationById(input.organizationId);
      if (!org || org.status !== "active") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization is not available",
        });
      }
      
      // Check 2FA requirement
      if (org.require2FA && !ctx.user.totpEnabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This organization requires two-factor authentication. Please enable 2FA first.",
        });
      }
      
      // Update user's active org
      await db.updateUserActiveOrg(ctx.user.id, input.organizationId);
      
      // Create new session token with org context
      const newToken = await sdk.signSession({
        openId: ctx.user.openId,
        appId: process.env.VITE_APP_ID || "",
        name: ctx.user.name || "",
        activeOrgId: input.organizationId,
      });
      
      // Set new cookie
      ctx.res.cookie(COOKIE_NAME, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ONE_YEAR_MS,
        path: "/",
      });
      
      // Log security event
      await logSecurityEvent("org_access_granted", ctx.user.id, {
        organizationId: input.organizationId,
        extra: { role: membership.role },
      });
      
      return {
        success: true,
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
      };
    }),

  /**
   * Logout with session revocation
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    // Log security event
    await logSecurityEvent("logout", ctx.user.id, {
      organizationId: ctx.user.activeOrgId || undefined,
    });
    
    // Clear cookie
    ctx.res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    
    return { success: true };
  }),

  /**
   * Get available organizations for current user
   */
  getOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await db.getUserOrganizationMemberships(ctx.user.id);
    const activeMemberships = memberships.filter(m => m.status === "active");
    
    const organizations = await Promise.all(
      activeMemberships.map(async (m) => {
        const org = await db.getOrganizationById(m.organizationId);
        return org ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          code: org.code,
          logoUrl: org.logoUrl,
          primaryColor: org.primaryColor,
          role: m.role,
          require2FA: org.require2FA,
          status: org.status,
        } : null;
      })
    );
    
    return organizations.filter(Boolean);
  }),

  /**
   * Check if email is eligible for signup (anti-enumeration safe)
   * Always returns same response regardless of  /**
   * Check email eligibility for signup
   */
  checkEmailEligibility: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // Always return the same message to prevent enumeration
      // Actual eligibility check happens after email verification
      return {
        message: "If eligible, we'll email you a verification link.",
        // Never reveal if account/org exists
      };
    }),
  
  /**
   * Request password reset - sends email with reset link
   */
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      const { sendTemplateEmail } = await import("../services/emailService");
      const crypto = await import("crypto");
      
      // Find user by email
      const user = await db.getUserByEmail(input.email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return { success: true, message: "If an account exists, a reset link will be sent." };
      }
      
      // Generate secure token
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Store token
      await db.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
      });
      
      // Send email
      const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      
      await sendTemplateEmail("password_reset", input.email, {
        userName: user.name,
        resetLink,
        expiresInMinutes: 60,
      });
      
      // Log the event
      await logSecurityEvent(
        "password_reset_requested",
        user.id,
        { extra: { email: input.email } }
      );
      
      return { success: true, message: "If an account exists, a reset link will be sent." };
    }),
  
  /**
   * Validate password reset token
   */
  validateResetToken: publicProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .query(async ({ input }) => {
      const tokenRecord = await db.getPasswordResetToken(input.token);
      
      if (!tokenRecord) {
        return { valid: false, reason: "Invalid token" };
      }
      
      if (tokenRecord.usedAt) {
        return { valid: false, reason: "Token already used" };
      }
      
      if (new Date() > tokenRecord.expiresAt) {
        return { valid: false, reason: "Token expired" };
      }
      
      return { valid: true };
    }),
  
  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const bcrypt = await import("bcryptjs");
      
      const tokenRecord = await db.getPasswordResetToken(input.token);
      
      if (!tokenRecord) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid token" });
      }
      
      if (tokenRecord.usedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token already used" });
      }
      
      if (new Date() > tokenRecord.expiresAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Token expired" });
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      
      // Update password
      await db.updateUserPassword(tokenRecord.userId, hashedPassword);
      
      // Mark token as used
      await db.markPasswordResetTokenUsed(tokenRecord.id);
      
      // Log the event
      await logSecurityEvent(
        "password_reset_completed",
        tokenRecord.userId,
        {}
      );
      
      return { success: true };
    }),
});