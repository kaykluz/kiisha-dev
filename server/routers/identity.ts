/**
 * Identity Binding Router
 * 
 * Handles:
 * - WhatsApp binding via proof-of-control code
 * - Email immutability (admin-only changes)
 * - Identifier revocation
 * - Multi-channel identity management
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logSecurityEvent } from "../services/orgContext";
import crypto from "crypto";

// Binding code configuration
const BINDING_CODE_LENGTH = 6;
const BINDING_CODE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_BINDING_ATTEMPTS = 3;

/**
 * Generate 6-digit binding code
 */
function generateBindingCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export const identityRouter = router({
  /**
   * List user's verified identifiers (regular users see their own, admins see all)
   */
  listIdentifiers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === 'admin') {
      // Admins see all identifiers
      return db.getAllUserIdentifiers();
    }
    // Regular users see only their own
    const identifiers = await db.getUserIdentifiers(ctx.user.id);
    
    return identifiers.map(id => ({
      id: id.id,
      type: id.type,
      value: maskIdentifier(id.type, id.value),
      status: id.status,
      verifiedAt: id.verifiedAt,
      createdAt: id.createdAt,
    }));
  }),

  /**
   * List quarantined messages (admin only)
   */
  listQuarantined: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
    }
    return db.getPendingUnclaimedInbound(undefined, 100);
  }),

  /**
   * Verify an identifier (admin only)
   */
  verifyIdentifier: protectedProcedure
    .input(z.object({ identifierId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      return db.verifyUserIdentifier(input.identifierId, ctx.user.id);
    }),

  /**
   * Claim a quarantined message (admin only)
   */
  claimInbound: protectedProcedure
    .input(z.object({
      inboundId: z.number(),
      userId: z.number(),
      createIdentifier: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      return db.claimInbound(input.inboundId, input.userId, ctx.user.id, input.createIdentifier);
    }),

  /**
   * Reject a quarantined message (admin only)
   */
  rejectInbound: protectedProcedure
    .input(z.object({ inboundId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
      }
      return db.rejectInbound(input.inboundId, 'Rejected by admin');
    }),

  /**
   * Request WhatsApp binding - generates code user must send to KIISHA number
   */
  requestWhatsappBinding: protectedProcedure
    .input(z.object({
      phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { phoneNumber } = input;
      
      // Check if phone already bound to another user
      const existing = await db.resolveIdentity("whatsapp_phone", phoneNumber);
      if (existing && existing.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This phone number is already linked to another account",
        });
      }
      
      // Check for existing pending binding
      const pendingToken = await db.getWhatsappBindingToken(ctx.user.id, phoneNumber);
      if (pendingToken && new Date() < pendingToken.expiresAt) {
        // Return existing code if still valid
        return {
          success: true,
          message: `Send code ${pendingToken.code} to KIISHA WhatsApp`,
          expiresAt: pendingToken.expiresAt,
          kiishaWhatsappNumber: process.env.KIISHA_WHATSAPP_NUMBER || "+1234567890",
        };
      }
      
      // Generate new binding code
      const code = generateBindingCode();
      const expiresAt = new Date(Date.now() + BINDING_CODE_EXPIRY_MS);
      
      await db.createWhatsappBindingToken({
        code,
        userId: ctx.user.id,
        phoneNumber,
        expiresAt,
        maxAttempts: MAX_BINDING_ATTEMPTS,
      });
      
      await logSecurityEvent("whatsapp_binding_requested", ctx.user.id, {
        extra: { phoneNumber: maskPhone(phoneNumber) },
      });
      
      return {
        success: true,
        message: `Send code ${code} to KIISHA WhatsApp to verify ownership`,
        expiresAt,
        kiishaWhatsappNumber: process.env.KIISHA_WHATSAPP_NUMBER || "+1234567890",
        instructions: [
          "1. Open WhatsApp",
          "2. Send a message to the KIISHA number",
          `3. Include the code: ${code}`,
          "4. Wait for confirmation",
        ],
      };
    }),

  /**
   * Verify WhatsApp binding (called by webhook when code received)
   * This would be called internally by the WhatsApp webhook handler
   */
  verifyWhatsappBinding: protectedProcedure
    .input(z.object({
      phoneNumber: z.string(),
      code: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { phoneNumber, code } = input;
      
      // Find pending token
      const token = await db.getWhatsappBindingToken(ctx.user.id, phoneNumber);
      
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No pending binding request found",
        });
      }
      
      // Check expiry
      if (new Date() > token.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Binding code has expired",
        });
      }
      
      // Check attempts
      if (token.attempts >= token.maxAttempts) {
        await logSecurityEvent("whatsapp_binding_failed", ctx.user.id, {
          extra: { reason: "max_attempts", phoneNumber: maskPhone(phoneNumber) },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Too many failed attempts. Please request a new code.",
        });
      }
      
      // Verify code
      if (token.code !== code) {
        await db.incrementWhatsappBindingAttempts(token.id);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid code",
        });
      }
      
      // Mark token as verified
      await db.verifyWhatsappBindingToken(token.id);
      
      // Create verified identifier
      await db.createUserIdentifier({
        type: "whatsapp_phone",
        value: phoneNumber,
        userId: ctx.user.id,
        status: "verified",
        verifiedAt: new Date(),
        verifiedBy: ctx.user.id,
      });
      
      await logSecurityEvent("whatsapp_binding_verified", ctx.user.id, {
        extra: { phoneNumber: maskPhone(phoneNumber) },
      });
      
      return {
        success: true,
        message: "WhatsApp number verified successfully",
      };
    }),

  /**
   * Revoke an identifier
   */
  revokeIdentifier: protectedProcedure
    .input(z.object({
      identifierId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const identifiers = await db.getUserIdentifiers(ctx.user.id);
      const identifier = identifiers.find(id => id.id === input.identifierId);
      
      if (!identifier) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Identifier not found",
        });
      }
      
      // Can't revoke primary email
      if (identifier.type === "email" && identifier.value === ctx.user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot revoke primary email",
        });
      }
      
      await db.revokeUserIdentifier(input.identifierId, ctx.user.id, input.reason);
      
      await logSecurityEvent("identifier_revoked", ctx.user.id, {
        extra: {
          identifierType: identifier.type,
          identifierValue: maskIdentifier(identifier.type, identifier.value),
          reason: input.reason,
        },
      });
      
      return { success: true };
    }),

  /**
   * Admin: Change user's email (requires re-verification)
   */
  adminChangeEmail: protectedProcedure
    .input(z.object({
      targetUserId: z.number(),
      newEmail: z.string().email(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify caller is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }
      
      // Get target user
      const targetUser = await db.getUserById(input.targetUserId);
      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      const oldEmail = targetUser.email;
      
      // Update email and require re-verification
      await db.upsertUser({
        openId: targetUser.openId,
        email: input.newEmail,
        emailVerified: false,
        emailVerifiedAt: null,
      });
      
      await logSecurityEvent("email_change_completed", ctx.user.id, {
        targetUserId: input.targetUserId,
        extra: {
          oldEmail: maskEmail(oldEmail || ""),
          newEmail: maskEmail(input.newEmail),
          reason: input.reason,
          changedBy: ctx.user.id,
        },
      });
      
      return {
        success: true,
        message: "Email changed. User must verify new email.",
      };
    }),

  /**
   * Get identifier resolution status (for inbound message handling)
   */
  resolveInboundIdentifier: protectedProcedure
    .input(z.object({
      type: z.enum(["whatsapp_phone", "email", "phone"]),
      value: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Only admins can resolve identifiers
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }
      
      const result = await db.resolveIdentity(input.type, input.value);
      
      if (!result) {
        return {
          found: false,
          status: "unknown",
          message: "Identifier not registered",
        };
      }
      
      if (result.status === "revoked") {
        return {
          found: true,
          status: "revoked",
          message: "Identifier has been revoked - treat as unknown sender",
        };
      }
      
      return {
        found: true,
        status: result.status,
        userId: result.userId,
        organizationId: result.organizationId,
      };
    }),
});

/**
 * Mask phone number for logging (show last 4 digits)
 */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

/**
 * Mask email for logging
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const maskedLocal = local.length > 2 
    ? local[0] + "*".repeat(local.length - 2) + local.slice(-1)
    : "**";
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask identifier based on type
 */
function maskIdentifier(type: string, value: string): string {
  switch (type) {
    case "whatsapp_phone":
    case "phone":
      return maskPhone(value);
    case "email":
      return maskEmail(value);
    default:
      return value.slice(0, 3) + "***";
  }
}
