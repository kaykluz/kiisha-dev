/**
 * Cross-Organization Sharing Router
 * 
 * Enables explicit sharing between organizations:
 * - Scoped tokens with specific resource access
 * - Time-bounded access
 * - Full audit trail
 * - Revocable at any time
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logSecurityEvent, assertResourceAccess } from "../services/orgContext";
import crypto from "crypto";

const TOKEN_HASH_ALGORITHM = "sha256";
const MAX_TOKEN_DAYS = 365;
const DEFAULT_TOKEN_DAYS = 30;

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
  return crypto.createHash(TOKEN_HASH_ALGORITHM).update(token).digest("hex");
}

export const crossOrgSharingRouter = router({
  /**
   * Create a cross-org share token
   */
  createShareToken: protectedProcedure
    .input(z.object({
      // Target organization or email
      recipientOrganizationId: z.number().optional(),
      recipientEmail: z.string().email().optional(),
      
      // Resource scope
      shareType: z.enum(["view", "assets", "documents", "dataroom"]),
      scopeConfig: z.object({
        viewId: z.number().optional(),
        assetIds: z.array(z.number()).optional(),
        documentIds: z.array(z.number()).optional(),
        dataroomId: z.number().optional(),
        allowedFields: z.array(z.string()).optional(),
        readOnly: z.boolean().optional(),
      }),
      
      // Time bounds
      expiresInDays: z.number().min(1).max(MAX_TOKEN_DAYS).default(DEFAULT_TOKEN_DAYS),
      
      // Optional restrictions
      maxUses: z.number().min(1).max(10000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }
      
      // Generate token
      const rawToken = generateToken();
      const tokenHash = hashToken(rawToken);
      
      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);
      
      // Create token record
      const tokenId = await db.createCrossOrgShareToken({
        tokenHash,
        sourceOrganizationId: ctx.user.activeOrgId,
        createdBy: ctx.user.id,
        shareType: input.shareType,
        scopeConfig: input.scopeConfig,
        recipientOrganizationId: input.recipientOrganizationId,
        recipientEmail: input.recipientEmail,
        expiresAt,
        maxUses: input.maxUses,
      });
      
      // Log token creation
      await logSecurityEvent("share_token_created", ctx.user.id, {
        organizationId: ctx.user.activeOrgId,
        targetOrganizationId: input.recipientOrganizationId,
        extra: {
          tokenId,
          shareType: input.shareType,
          expiresAt: expiresAt.toISOString(),
        },
      });
      
      // Build share URL
      const baseUrl = process.env.KIISHA_BASE_URL || "https://app.kiisha.io";
      const shareUrl = `${baseUrl}/shared/${rawToken}`;
      
      return {
        success: true,
        tokenId,
        // Return raw token ONLY ONCE
        token: rawToken,
        shareUrl,
        expiresAt,
        message: "Save this link - it cannot be retrieved again",
      };
    }),

  /**
   * Access a shared resource via token
   */
  accessSharedResource: protectedProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tokenHash = hashToken(input.token);
      const token = await db.getCrossOrgShareTokenByHash(tokenHash);
      
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired share link",
        });
      }
      
      // Check expiry
      if (token.expiresAt && new Date() > token.expiresAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has expired",
        });
      }
      
      // Check revocation
      if (token.status === "revoked") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has been revoked",
        });
      }
      
      // Check usage limit
      if (token.maxUses && token.usedCount >= token.maxUses) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link has reached its usage limit",
        });
      }
      
      // Check target restrictions
      if (token.recipientEmail && ctx.user.email !== token.recipientEmail) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link is restricted to a specific email",
        });
      }
      
      if (token.recipientOrganizationId && ctx.user.activeOrgId !== token.recipientOrganizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share link is restricted to a specific organization",
        });
      }
      
      // Log access
      await db.logCrossOrgShareAccess({
        tokenId: token.id,
        userId: ctx.user.id,
        organizationId: ctx.user.activeOrgId,
        accessType: "view",
      });
      
      await logSecurityEvent("cross_org_access", ctx.user.id, {
        organizationId: ctx.user.activeOrgId || undefined,
        extra: {
          tokenId: token.id,
          shareType: token.shareType,
          sourceOrgId: token.sourceOrganizationId,
        },
      });
      
      return {
        success: true,
        shareType: token.shareType,
        scopeConfig: token.scopeConfig,
        expiresAt: token.expiresAt,
      };
    }),

  /**
   * Revoke a share token
   */
  revokeShareToken: protectedProcedure
    .input(z.object({
      tokenId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get token to verify ownership
      const token = await db.getCrossOrgShareTokenById(input.tokenId);
      
      if (!token) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found",
        });
      }
      
      // Verify user is from source org
      if (token.sourceOrganizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only revoke tokens from your organization",
        });
      }
      
      await db.revokeCrossOrgShareToken(input.tokenId, ctx.user.id, input.reason);
      
      await logSecurityEvent("share_token_revoked", ctx.user.id, {
        organizationId: ctx.user.activeOrgId || undefined,
        extra: {
          tokenId: input.tokenId,
          reason: input.reason,
        },
      });
      
      return { success: true };
    }),

  /**
   * List share tokens created by current org
   */
  listShareTokens: protectedProcedure
    .input(z.object({
      status: z.enum(["active", "expired", "revoked", "all"]).default("active"),
      shareType: z.enum(["view", "assets", "documents", "dataroom"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active organization",
        });
      }
      
      // Get tokens for org
      const allTokens = await db.getCrossOrgShareTokensForOrg(ctx.user.activeOrgId);
      
      // Filter by status
      let tokens = allTokens;
      if (input.status !== "all") {
        const now = new Date();
        tokens = allTokens.filter(t => {
          if (input.status === "active") {
            return t.status === "active" && (!t.expiresAt || t.expiresAt > now);
          }
          if (input.status === "expired") {
            return t.expiresAt && t.expiresAt <= now;
          }
          if (input.status === "revoked") {
            return t.status === "revoked";
          }
          return true;
        });
      }
      
      // Filter by share type
      if (input.shareType) {
        tokens = tokens.filter(t => t.shareType === input.shareType);
      }
      
      // Return without hash
      const now = new Date();
      return tokens.slice(0, input.limit).map(t => ({
        id: t.id,
        shareType: t.shareType,
        scopeConfig: t.scopeConfig,
        recipientOrganizationId: t.recipientOrganizationId,
        recipientEmail: t.recipientEmail,
        expiresAt: t.expiresAt,
        usedCount: t.usedCount,
        maxUses: t.maxUses,
        status: t.status,
        createdAt: t.createdAt,
        isActive: t.status === "active" && (t.expiresAt === null || t.expiresAt > now),
      }));
    }),

  /**
   * Get access log for a share token
   */
  getTokenAccessLog: protectedProcedure
    .input(z.object({
      tokenId: z.number(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ ctx, input }) => {
      // Verify token ownership
      const token = await db.getCrossOrgShareTokenById(input.tokenId);
      
      if (!token || token.sourceOrganizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token not found",
        });
      }
      
      return db.getCrossOrgShareAccessLog(input.tokenId, input.limit);
    }),
});
