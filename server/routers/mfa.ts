/**
 * Phase 35: MFA Router
 * 
 * TOTP-based MFA setup and verification endpoints.
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import * as sessionManager from "../services/sessionManager";
import { COOKIE_NAME } from "@shared/const";
import { createHash, randomBytes } from "crypto";

// TOTP configuration
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "SHA1";
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

/**
 * Generate a random TOTP secret (base32 encoded)
 */
function generateTotpSecret(): string {
  const buffer = randomBytes(20);
  // Base32 encode
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  let bits = 0;
  let value = 0;
  
  for (const byte of Array.from(buffer)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  
  return result;
}

/**
 * Generate TOTP code for a given secret and time
 */
function generateTotp(secret: string, time: number = Date.now()): string {
  const counter = Math.floor(time / 1000 / TOTP_PERIOD);
  
  // Decode base32 secret
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  
  for (const char of secret.toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  const keyBuffer = Buffer.from(bytes);
  
  // Create counter buffer (8 bytes, big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  
  // HMAC-SHA1
  const hmac = createHash("sha1");
  // Note: In production, use crypto.createHmac("sha1", keyBuffer).update(counterBuffer).digest()
  // For simplicity, we'll use a basic implementation
  const crypto = require("crypto");
  const hash = crypto.createHmac("sha1", keyBuffer).update(counterBuffer).digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

/**
 * Verify TOTP code (with time window tolerance)
 */
function verifyTotp(secret: string, code: string, windowSize: number = 1): boolean {
  const now = Date.now();
  
  for (let i = -windowSize; i <= windowSize; i++) {
    const time = now + (i * TOTP_PERIOD * 1000);
    if (generateTotp(secret, time) === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 for clarity
  
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = "";
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  
  return codes;
}

/**
 * Hash a backup code for storage
 */
function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace("-", "").toUpperCase()).digest("hex");
}

export const mfaRouter = router({
  /**
   * Get MFA status for current user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const config = await db.getUserMfaConfig(ctx.user.id);
    
    return {
      enabled: config?.totpEnabled ?? false,
      hasBackupCodes: !!(config?.backupCodesHash && config.backupCodesHash.length > 0),
      backupCodesRemaining: config?.backupCodesHash 
        ? config.backupCodesHash.length - (config.backupCodesUsedCount ?? 0)
        : 0,
    };
  }),

  /**
   * Start MFA setup - generate secret and QR code data
   */
  startSetup: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if already enabled
    const existing = await db.getUserMfaConfig(ctx.user.id);
    if (existing?.totpEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "MFA is already enabled",
      });
    }

    const secret = generateTotpSecret();
    
    // Store secret temporarily (not enabled yet)
    await db.upsertUserMfaConfig({
      userId: ctx.user.id,
      totpSecret: secret,
      totpEnabled: false,
    });

    // Generate otpauth URL for QR code
    const issuer = "KIISHA";
    const accountName = ctx.user.email || ctx.user.name || ctx.user.openId;
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=${TOTP_ALGORITHM}&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

    return {
      secret,
      otpauthUrl,
      // Frontend can use a library like qrcode to generate QR from otpauthUrl
    };
  }),

  /**
   * Complete MFA setup - verify the first code
   */
  completeSetup: protectedProcedure
    .input(z.object({
      code: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const config = await db.getUserMfaConfig(ctx.user.id);
      if (!config?.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA setup not started",
        });
      }

      if (config.totpEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA is already enabled",
        });
      }

      // Verify the code
      if (!verifyTotp(config.totpSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      // Enable TOTP
      await db.enableUserTotp(ctx.user.id, config.totpSecret);

      // Generate backup codes
      const backupCodes = generateBackupCodes();
      const hashedCodes = backupCodes.map(hashBackupCode);
      await db.storeUserBackupCodes(ctx.user.id, hashedCodes);

      // Log the event
      await sessionManager.logAuthEvent({
        eventType: "mfa_setup",
        userId: ctx.user.id,
        success: true,
      });

      return {
        success: true,
        backupCodes, // Show these to user ONCE
      };
    }),

  /**
   * Verify MFA code (during login)
   */
  verify: publicProcedure
    .input(z.object({
      code: z.string().min(6).max(10), // 6 for TOTP, 9 for backup (XXXX-XXXX)
    }))
    .mutation(async ({ ctx, input }) => {
      // Get session from cookie
      const sessionId = ctx.req?.cookies?.[COOKIE_NAME];
      if (!sessionId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active session",
        });
      }

      // Validate session
      const validation = await sessionManager.validateSession(sessionId);
      if (!validation.valid || !validation.session) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid session",
        });
      }

      const session = validation.session;
      const config = await db.getUserMfaConfig(session.userId);
      
      if (!config?.totpEnabled || !config.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA is not enabled for this account",
        });
      }

      const code = input.code.replace("-", "").toUpperCase();
      let verified = false;
      let usedBackupCode = false;

      // Try TOTP first
      if (code.length === 6 && verifyTotp(config.totpSecret, code)) {
        verified = true;
      }
      // Try backup codes
      else if (config.backupCodesHash) {
        const codeHash = hashBackupCode(code);
        const index = config.backupCodesHash.indexOf(codeHash);
        if (index !== -1) {
          verified = true;
          usedBackupCode = true;
          // Remove used backup code
          const newCodes = [...config.backupCodesHash];
          newCodes.splice(index, 1);
          await db.storeUserBackupCodes(session.userId, newCodes);
          await db.incrementBackupCodeUsed(session.userId);
        }
      }

      if (!verified) {
        await sessionManager.logAuthEvent({
          eventType: "mfa_failed",
          userId: session.userId,
          sessionId,
          success: false,
          failureReason: "invalid_code",
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      // Mark MFA as satisfied
      await sessionManager.satisfyMfa(sessionId, session.userId);

      return {
        success: true,
        usedBackupCode,
        backupCodesRemaining: usedBackupCode && config.backupCodesHash 
          ? config.backupCodesHash.length - 1 
          : undefined,
      };
    }),

  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: protectedProcedure
    .input(z.object({
      code: z.string().length(6), // Require current TOTP to regenerate
    }))
    .mutation(async ({ ctx, input }) => {
      const config = await db.getUserMfaConfig(ctx.user.id);
      
      if (!config?.totpEnabled || !config.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA is not enabled",
        });
      }

      // Verify current TOTP
      if (!verifyTotp(config.totpSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      // Generate new backup codes
      const backupCodes = generateBackupCodes();
      const hashedCodes = backupCodes.map(hashBackupCode);
      await db.storeUserBackupCodes(ctx.user.id, hashedCodes);

      return {
        success: true,
        backupCodes,
      };
    }),

  /**
   * Disable MFA
   */
  disable: protectedProcedure
    .input(z.object({
      code: z.string().length(6), // Require current TOTP to disable
    }))
    .mutation(async ({ ctx, input }) => {
      const config = await db.getUserMfaConfig(ctx.user.id);
      
      if (!config?.totpEnabled || !config.totpSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "MFA is not enabled",
        });
      }

      // Verify current TOTP
      if (!verifyTotp(config.totpSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }

      // Disable TOTP
      await db.disableUserTotp(ctx.user.id);

      // Log the event
      await sessionManager.logAuthEvent({
        eventType: "mfa_reset",
        userId: ctx.user.id,
        success: true,
        details: { action: "disabled_by_user" },
      });

      // Revoke all other sessions for security
      const sessionId = ctx.req?.cookies?.[COOKIE_NAME];
      await sessionManager.revokeAllSessions(ctx.user.id, "mfa_disabled", sessionId);

      return { success: true };
    }),

  /**
   * Admin: Reset MFA for a user (requires admin role)
   */
  adminReset: protectedProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().min(10).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check admin role
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      // Disable TOTP for target user
      await db.disableUserTotp(input.userId);

      // Log the event
      await sessionManager.logAuthEvent({
        eventType: "mfa_reset",
        userId: ctx.user.id,
        targetUserId: input.userId,
        success: true,
        details: { action: "admin_reset", reason: input.reason },
      });

      // Revoke all sessions for target user
      await sessionManager.revokeAllSessions(input.userId, "mfa_reset_by_admin");

      return { success: true };
    }),
});

export type MfaRouter = typeof mfaRouter;
