/**
 * Security Router
 * 
 * Handles 2FA setup, session management, and security audit logging.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import * as crypto from "crypto";
import { TOTP, generateSecret as otpGenerateSecret, generateURI, verify as otpVerify } from "otplib";

// TOTP configuration
const TOTP_DIGITS = 6;
const TOTP_STEP = 30; // 30-second window
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock drift

/**
 * Generate a cryptographically secure secret for 2FA
 * Uses otplib's built-in secret generation
 */
function generateSecret(): string {
  return otpGenerateSecret();
}

/**
 * Generate backup codes for account recovery
 * Each code is a unique 8-character hex string formatted as XXXX-XXXX
 */
function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

/**
 * Generate the otpauth:// URI for QR code scanning
 * This URI is compatible with Google Authenticator, Authy, 1Password, etc.
 */
function generateOtpAuthUri(secret: string, email: string, issuer: string = "KIISHA"): string {
  return generateURI({
    secret,
    label: email,
    issuer,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_STEP,
  });
}

/**
 * Generate a QR code URL using Google Charts API
 * In production, consider using a local QR code library for privacy
 */
function generateQRCodeUrl(secret: string, email: string, issuer: string = "KIISHA"): string {
  const otpAuthUrl = generateOtpAuthUri(secret, email, issuer);
  return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(otpAuthUrl)}`;
}

/**
 * Verify a TOTP code against the secret
 * Uses otplib's time-based verification with configurable window
 */
function verifyTOTP(secret: string, code: string): boolean {
  try {
    // Validate code format first
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      return false;
    }
    // Use otplib's verify function with time-based validation
    return otpVerify({
      token: code,
      secret,
      algorithm: "SHA1",
      digits: TOTP_DIGITS,
      period: TOTP_STEP,
      window: TOTP_WINDOW,
    });
  } catch (error) {
    console.error("TOTP verification error:", error);
    return false;
  }
}

/**
 * Check if a backup code is valid and mark it as used
 * Returns the updated backup codes array with the used code removed
 */
function verifyBackupCode(code: string, backupCodes: string[]): { valid: boolean; remainingCodes: string[] } {
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const formattedCode = normalizedCode.length === 8 
    ? `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`
    : code.toUpperCase();
  
  const index = backupCodes.findIndex(c => c === formattedCode);
  if (index === -1) {
    return { valid: false, remainingCodes: backupCodes };
  }
  
  // Remove the used code
  const remainingCodes = [...backupCodes];
  remainingCodes.splice(index, 1);
  return { valid: true, remainingCodes };
}

export const securityRouter = router({
  /**
   * Get current security status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      return {
        twoFactorEnabled: false,
        backupCodes: [],
        lastPasswordChange: null,
      };
    }
    
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id));
    
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    
    // Parse metadata
    const metadata = (user.metadata as any) || {};
    
    return {
      twoFactorEnabled: metadata.twoFactorEnabled || false,
      backupCodes: metadata.backupCodes || [],
      lastPasswordChange: metadata.lastPasswordChange || null,
      backupCodesRemaining: (metadata.backupCodes || []).length,
    };
  }),
  
  /**
   * Initiate 2FA setup - generates secret and QR code
   */
  initiate2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }
    
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id));
    
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    
    // Generate new secret
    const secret = generateSecret();
    const qrCodeUrl = generateQRCodeUrl(secret, user.email || "user@example.com");
    
    // Store pending secret in metadata
    const metadata = (user.metadata as any) || {};
    metadata.pending2FASecret = secret;
    
    await database
      .update(users)
      .set({ metadata })
      .where(eq(users.id, ctx.user.id));
    
    return {
      secret,
      qrCodeUrl,
    };
  }),
  
  /**
   * Verify 2FA code and enable 2FA
   */
  verify2FA: protectedProcedure
    .input(z.object({
      code: z.string().length(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
      
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id));
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      const metadata = (user.metadata as any) || {};
      const pendingSecret = metadata.pending2FASecret;
      
      if (!pendingSecret) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No pending 2FA setup. Please initiate setup first.",
        });
      }
      
      // Verify the code
      if (!verifyTOTP(pendingSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }
      
      // Generate backup codes
      const backupCodes = generateBackupCodes(10);
      
      // Enable 2FA
      metadata.twoFactorEnabled = true;
      metadata.twoFactorSecret = pendingSecret;
      metadata.backupCodes = backupCodes;
      metadata.twoFactorEnabledAt = new Date().toISOString();
      delete metadata.pending2FASecret;
      
      await database
        .update(users)
        .set({ metadata })
        .where(eq(users.id, ctx.user.id));
      
      // Log the event
      const { logAuth } = await import("../services/auditLog");
      await logAuth(ctx.user.id, ctx.user.activeOrgId || 0, "2fa_enabled", {
        method: "totp",
      });
      
      return {
        success: true,
        backupCodes,
      };
    }),
  
  /**
   * Disable 2FA
   */
  disable2FA: protectedProcedure
    .input(z.object({
      code: z.string().length(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }
      
      const [user] = await database
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id));
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      const metadata = (user.metadata as any) || {};
      
      if (!metadata.twoFactorEnabled) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "2FA is not enabled",
        });
      }
      
      // Verify the code
      if (!verifyTOTP(metadata.twoFactorSecret, input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }
      
      // Disable 2FA
      metadata.twoFactorEnabled = false;
      delete metadata.twoFactorSecret;
      delete metadata.backupCodes;
      metadata.twoFactorDisabledAt = new Date().toISOString();
      
      await database
        .update(users)
        .set({ metadata })
        .where(eq(users.id, ctx.user.id));
      
      // Log the event
      const { logAuth } = await import("../services/auditLog");
      await logAuth(ctx.user.id, ctx.user.activeOrgId || 0, "2fa_disabled", {});
      
      return { success: true };
    }),
  
  /**
   * Regenerate backup codes
   */
  regenerateBackupCodes: protectedProcedure.mutation(async ({ ctx }) => {
    const database = await getDb();
    if (!database) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Database unavailable",
      });
    }
    
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, ctx.user.id));
    
    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    
    const metadata = (user.metadata as any) || {};
    
    if (!metadata.twoFactorEnabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "2FA must be enabled to regenerate backup codes",
      });
    }
    
    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    metadata.backupCodes = backupCodes;
    metadata.backupCodesRegeneratedAt = new Date().toISOString();
    
    await database
      .update(users)
      .set({ metadata })
      .where(eq(users.id, ctx.user.id));
    
    // Log the event
    const { logAuth } = await import("../services/auditLog");
    await logAuth(ctx.user.id, ctx.user.activeOrgId || 0, "backup_codes_regenerated", {});
    
    return {
      success: true,
      backupCodes,
    };
  }),
  
  /**
   * List active sessions
   */
  listSessions: protectedProcedure.query(async ({ ctx }) => {
    // For demo, return mock sessions
    // In production, this would query a sessions table
    return [
      {
        id: "current",
        deviceInfo: "Chrome on Windows",
        ipAddress: "192.168.1.100",
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
      },
    ];
  }),
  
  /**
   * Revoke a specific session
   */
  revokeSession: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // In production, this would invalidate the session token
      const { logAuth } = await import("../services/auditLog");
      await logAuth(ctx.user.id, ctx.user.activeOrgId || 0, "session_revoked", {
        sessionId: input.sessionId,
      });
      
      return { success: true };
    }),
  
  /**
   * Revoke all sessions except current
   */
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    // In production, this would invalidate all session tokens except current
    const { logAuth } = await import("../services/auditLog");
    await logAuth(ctx.user.id, ctx.user.activeOrgId || 0, "all_sessions_revoked", {});
    
    return { success: true };
  }),
  
  /**
   * Get security audit log
   */
  getAuditLog: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input, ctx }) => {
      // For demo, return mock audit events
      // In production, this would query the audit_logs table
      return [
        {
          type: "login",
          description: "Successful login",
          timestamp: new Date().toISOString(),
          ipAddress: "192.168.1.100",
          severity: "low" as const,
        },
        {
          type: "2fa",
          description: "Two-factor authentication enabled",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          ipAddress: "192.168.1.100",
          severity: "medium" as const,
        },
      ];
    }),
  
  /**
   * Check policy compliance for current user
   */
  checkPolicyCompliance: protectedProcedure.query(async ({ ctx }) => {
    const { checkSecurityPolicies } = await import("../services/securityPolicy");
    
    const result = await checkSecurityPolicies(
      ctx.user.id,
      ctx.user.activeOrgId || 0,
      ctx.req?.ip || "unknown"
    );
    
    return result;
  }),
});
