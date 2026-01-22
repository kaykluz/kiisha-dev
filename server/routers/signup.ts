/**
 * Signup Router - Secure onboarding with anti-enumeration
 * 
 * Key security principles:
 * 1. Always email verify first - never reveal if account/org exists
 * 2. After verification, resolve eligibility:
 *    - Case 1: Email pre-approved → proceed to setup
 *    - Case 2: Invite token supplied → redeem token, bind access
 *    - Case 3: Not approved → place in KIISHA Lobby org
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logSecurityEvent } from "../services/orgContext";
import crypto from "crypto";

// Standard response for all signup initiation - prevents enumeration
const STANDARD_SIGNUP_RESPONSE = {
  message: "If eligible, we'll email you a verification link.",
  success: true,
};

// Token expiry times
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const INVITE_TOKEN_HASH_ALGORITHM = "sha256";

/**
 * Generate secure random token
 */
function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash token for storage (one-way)
 */
function hashToken(token: string): string {
  return crypto.createHash(INVITE_TOKEN_HASH_ALGORITHM).update(token).digest("hex");
}

export const signupRouter = router({
  /**
   * Initiate signup - always returns same response (anti-enumeration)
   */
  initiate: publicProcedure
    .input(z.object({
      email: z.string().email().transform(e => e.toLowerCase()),
    }))
    .mutation(async ({ input }) => {
      const { email } = input;
      
      // Log signup attempt (no user ID yet)
      await logSecurityEvent("signup_started", null, {
        extra: { email },
      });
      
      // Check if user already exists
      const existingUser = await db.getUserByEmail(email);
      
      if (existingUser) {
        // User exists - in production, send "account already exists" email
        // But return same response to prevent enumeration
        console.log(`[Signup] Existing user attempted signup: ${email}`);
        return STANDARD_SIGNUP_RESPONSE;
      }
      
      // Generate verification token
      const verificationToken = generateToken();
      const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
      
      // Store verification token (would create pending user record)
      // For now, we'll use the email verification system
      // In production, this would send an actual email
      
      console.log(`[Signup] Verification token for ${email}: ${verificationToken}`);
      console.log(`[Signup] In production, this would send an email`);
      
      // Always return same response
      return STANDARD_SIGNUP_RESPONSE;
    }),

  /**
   * Verify email and check eligibility
   */
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string(),
      inviteToken: z.string().optional(), // Optional invite token
    }))
    .mutation(async ({ input }) => {
      const { token, inviteToken } = input;
      
      // Find user by verification token
      const user = await db.getUserByEmailVerificationToken(token);
      
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification link",
        });
      }
      
      // Mark email as verified
      await db.verifyUserEmail(user.id);
      
      // Log verification
      await logSecurityEvent("email_verified", user.id, {
        extra: { email: user.email },
      });
      
      // Now check eligibility
      const eligibility = await resolveEligibility(user.email!, inviteToken);
      
      return {
        success: true,
        eligibility,
        userId: user.id,
      };
    }),

  /**
   * Complete signup after email verification
   */
  complete: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      password: z.string().min(8).optional(), // Optional if using OAuth
      inviteToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name, inviteToken } = input;
      
      if (!ctx.user.emailVerified) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Please verify your email first",
        });
      }
      
      // Check eligibility
      const eligibility = await resolveEligibility(ctx.user.email!, inviteToken);
      
      // Update user profile
      await db.upsertUser({
        openId: ctx.user.openId,
        name,
        onboardingStatus: "completed",
      });
      
      // Handle based on eligibility
      if (eligibility.type === "pre_approved") {
        // Activate pre-approved membership
        await db.activatePreApprovedMembership(eligibility.membershipId!, ctx.user.id);
        
        // Set active org
        await db.updateUserActiveOrg(ctx.user.id, eligibility.organizationId!);
        
        await logSecurityEvent("signup_completed", ctx.user.id, {
          organizationId: eligibility.organizationId,
          extra: { method: "pre_approved" },
        });
        
        return {
          success: true,
          type: "pre_approved",
          organizationId: eligibility.organizationId,
        };
      }
      
      if (eligibility.type === "invite_token" && inviteToken) {
        // Redeem invite token
        const result = await redeemInviteToken(inviteToken, ctx.user.id, ctx.user.email!);
        
        if (result.success) {
          await db.updateUserActiveOrg(ctx.user.id, result.organizationId!);
          
          await logSecurityEvent("invite_redeemed", ctx.user.id, {
            organizationId: result.organizationId,
            extra: { tokenId: result.tokenId },
          });
          
          return {
            success: true,
            type: "invite_token",
            organizationId: result.organizationId,
          };
        }
      }
      
      // Not approved - place in lobby
      const lobbyOrg = await db.getKiishaLobbyOrg();
      if (lobbyOrg) {
        await db.updateUserActiveOrg(ctx.user.id, lobbyOrg.id);
      }
      
      await logSecurityEvent("signup_completed", ctx.user.id, {
        extra: { method: "lobby" },
      });
      
      return {
        success: true,
        type: "lobby",
        message: "Your account is awaiting access approval",
      };
    }),

  /**
   * Validate an invite token (public - for invitation acceptance page)
   */
  validateInviteToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const { token } = input;
      
      if (!token) {
        return { valid: false };
      }
      
      const tokenHash = hashToken(token);
      const tokenRecord = await db.getInviteTokenByHash(tokenHash);
      
      if (!tokenRecord) {
        // Generic response - don't reveal if token ever existed
        return { valid: false };
      }
      
      // Check if token is still valid
      if (new Date() > tokenRecord.expiresAt) {
        return { valid: false };
      }
      
      if (tokenRecord.usedCount >= tokenRecord.maxUses) {
        return { valid: false };
      }
      
      if (tokenRecord.revokedAt) {
        return { valid: false };
      }
      
      // Get organization details
      const org = await db.getOrganizationById(tokenRecord.organizationId);
      
      // Get inviter details
      let inviterName: string | null = null;
      if (tokenRecord.createdBy) {
        const inviter = await db.getUserById(tokenRecord.createdBy);
        inviterName = inviter?.name || null;
      }
      
      return {
        valid: true,
        organizationName: org?.name || "Organization",
        role: tokenRecord.role,
        inviterName,
        expiresAt: tokenRecord.expiresAt.toISOString(),
      };
    }),

  /**
   * Accept an invitation (for logged-in users)
   */
  acceptInvitation: protectedProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { token } = input;
      
      const result = await redeemInviteToken(token, ctx.user.id, ctx.user.email || "");
      
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired invitation",
        });
      }
      
      // Set active org to the new organization
      await db.updateUserActiveOrg(ctx.user.id, result.organizationId!);
      
      await logSecurityEvent("invite_accepted", ctx.user.id, {
        organizationId: result.organizationId,
        extra: { tokenId: result.tokenId },
      });
      
      return {
        success: true,
        organizationId: result.organizationId,
      };
    }),

  /**
   * Request access to an organization (from lobby)
   */
  requestAccess: protectedProcedure
    .input(z.object({
      organizationName: z.string().optional(),
      organizationId: z.number().optional(),
      reason: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create access request
      await db.createAccessRequest({
        userId: ctx.user.id,
        userEmail: ctx.user.email || "",
        targetOrganizationId: input.organizationId,
        targetOrganizationName: input.organizationName,
        requestReason: input.reason,
      });
      
      return {
        success: true,
        message: "Your access request has been submitted",
      };
    }),
});

/**
 * Resolve user eligibility based on email and optional invite token
 */
async function resolveEligibility(
  email: string,
  inviteToken?: string
): Promise<{
  type: "pre_approved" | "invite_token" | "lobby";
  organizationId?: number;
  membershipId?: number;
  role?: string;
}> {
  // Case 1: Check for pre-approved membership
  const preApproved = await db.getPreApprovedMembershipByEmail(email);
  if (preApproved) {
    return {
      type: "pre_approved",
      organizationId: preApproved.organizationId,
      membershipId: preApproved.id,
      role: preApproved.role,
    };
  }
  
  // Case 2: Check invite token
  if (inviteToken) {
    const tokenHash = hashToken(inviteToken);
    const token = await db.getInviteTokenByHash(tokenHash);
    
    if (token && isTokenValid(token, email)) {
      return {
        type: "invite_token",
        organizationId: token.organizationId,
        role: token.role,
      };
    }
  }
  
  // Case 3: Not approved - lobby
  return { type: "lobby" };
}

/**
 * Check if invite token is valid for this email
 */
function isTokenValid(
  token: {
    expiresAt: Date;
    usedCount: number;
    maxUses: number;
    revokedAt: Date | null;
    restrictToEmail: string | null;
    restrictToDomain: string | null;
  },
  email: string
): boolean {
  // Check expiry
  if (new Date() > token.expiresAt) return false;
  
  // Check usage limit
  if (token.usedCount >= token.maxUses) return false;
  
  // Check revocation
  if (token.revokedAt) return false;
  
  // Check email restriction
  if (token.restrictToEmail && token.restrictToEmail.toLowerCase() !== email.toLowerCase()) {
    return false;
  }
  
  // Check domain restriction
  if (token.restrictToDomain) {
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (emailDomain !== token.restrictToDomain.toLowerCase()) {
      return false;
    }
  }
  
  return true;
}

/**
 * Redeem invite token and create membership
 */
async function redeemInviteToken(
  rawToken: string,
  userId: number,
  email: string
): Promise<{
  success: boolean;
  organizationId?: number;
  tokenId?: number;
}> {
  const tokenHash = hashToken(rawToken);
  const token = await db.getInviteTokenByHash(tokenHash);
  
  if (!token || !isTokenValid(token, email)) {
    return { success: false };
  }
  
  // Create membership
  await db.createPreApprovedMembership({
    organizationId: token.organizationId,
    email,
    role: token.role,
    invitedBy: token.createdBy,
  });
  
  // Get the membership and activate it
  const membership = await db.getPreApprovedMembershipByEmail(email);
  if (membership) {
    await db.activatePreApprovedMembership(membership.id, userId);
  }
  
  // Record redemption
  await db.redeemInviteToken(token.id, userId, email);
  
  return {
    success: true,
    organizationId: token.organizationId,
    tokenId: token.id,
  };
}
