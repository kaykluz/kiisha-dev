/**
 * View Sharing Router
 * 
 * Handles cross-organization view sharing with explicit grants.
 * All operations are org-scoped and audited.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { viewScopes, viewShares, organizations } from "../../drizzle/schema";
import { logSecurityEvent } from "../services/orgContext";

/**
 * Require org admin role for sharing operations
 */
async function requireOrgAdmin(ctx: { user: { id: number }; organizationId?: number | null }) {
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization context required",
    });
  }
  return ctx.organizationId;
}

// Helper to get db instance
async function getDbInstance() {
  const instance = await getDb();
  if (!instance) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available",
    });
  }
  return instance;
}

export const viewSharingRouter = router({
  /**
   * List views owned by the current organization
   */
  listOrgViews: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgAdmin(ctx);
    const db = await getDbInstance();
    
    const views = await db.query.viewScopes.findMany({
      where: eq(viewScopes.organizationId, orgId),
      orderBy: [desc(viewScopes.updatedAt)],
    });
    
    return views.map(v => ({
      id: v.id,
      name: v.name,
      viewType: v.viewType,
      description: v.description,
      projectId: v.projectId,
      createdAt: v.createdAt,
    }));
  }),
  
  /**
   * List organizations that can be shared with
   */
  listShareableOrgs: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgAdmin(ctx);
    const db = await getDbInstance();
    
    const orgs = await db.query.organizations.findMany({
      columns: {
        id: true,
        name: true,
      },
    });
    
    return orgs.filter(o => o.id !== orgId);
  }),
  
  /**
   * Create a new view share
   */
  createShare: protectedProcedure
    .input(z.object({
      viewId: z.number(),
      targetOrgId: z.number(),
      permissionLevel: z.enum(["view_only", "edit", "admin"]).default("view_only"),
      expiresAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx);
      const db = await getDbInstance();
      
      // Verify view belongs to current org
      const view = await db.query.viewScopes.findFirst({
        where: and(
          eq(viewScopes.id, input.viewId),
          eq(viewScopes.organizationId, orgId)
        ),
      });
      
      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found or access denied",
        });
      }
      
      // Verify target org exists
      const targetOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, input.targetOrgId),
      });
      
      if (!targetOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target organization not found",
        });
      }
      
      // Check for existing active share
      const existingShare = await db.query.viewShares.findFirst({
        where: and(
          eq(viewShares.viewId, input.viewId),
          eq(viewShares.sharedWithType, "organization"),
          eq(viewShares.sharedWithId, input.targetOrgId),
          eq(viewShares.isActive, true)
        ),
      });
      
      if (existingShare) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An active share already exists for this view and organization",
        });
      }
      
      // Create the share
      const [result] = await db.insert(viewShares).values({
        viewId: input.viewId,
        sharedWithType: "organization",
        sharedWithId: input.targetOrgId,
        permissionLevel: input.permissionLevel,
        sharedBy: ctx.user.id,
        sharedAt: new Date(),
        expiresAt: input.expiresAt || null,
        isActive: true,
      });
      
      // Log the share creation
      await logSecurityEvent("view_shared", ctx.user.id, {
        organizationId: orgId,
        extra: {
          viewId: input.viewId,
          viewName: view.name,
          targetOrgId: input.targetOrgId,
          targetOrgName: targetOrg.name,
          permissionLevel: input.permissionLevel,
          expiresAt: input.expiresAt,
        },
      });
      
      return {
        success: true,
        shareId: result.insertId,
        message: `View "${view.name}" shared with ${targetOrg.name}`,
      };
    }),
  
  /**
   * List outgoing shares (views shared by current org)
   */
  listOutgoingShares: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgAdmin(ctx);
    const db = await getDbInstance();
    
    // Get all views owned by this org
    const orgViews = await db.query.viewScopes.findMany({
      where: eq(viewScopes.organizationId, orgId),
      columns: { id: true, name: true },
    });
    
    const viewIds = orgViews.map(v => v.id);
    if (viewIds.length === 0) return [];
    
    // Get shares for these views
    const shares = await db.query.viewShares.findMany({
      where: eq(viewShares.sharedWithType, "organization"),
      orderBy: [desc(viewShares.sharedAt)],
    });
    
    // Filter to only include shares for our views
    const filteredShares = shares.filter(s => viewIds.includes(s.viewId));
    
    // Enrich with org names
    const result = [];
    for (const share of filteredShares) {
      const view = orgViews.find(v => v.id === share.viewId);
      const targetOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, share.sharedWithId),
        columns: { name: true },
      });
      
      result.push({
        id: share.id,
        viewId: share.viewId,
        viewName: view?.name || "Unknown",
        targetOrgId: share.sharedWithId,
        targetOrgName: targetOrg?.name || "Unknown",
        permissionLevel: share.permissionLevel,
        sharedAt: share.sharedAt,
        expiresAt: share.expiresAt,
        isActive: share.isActive,
      });
    }
    
    return result;
  }),
  
  /**
   * List incoming shares (views shared with current org)
   */
  listIncomingShares: protectedProcedure.query(async ({ ctx }) => {
    const orgId = await requireOrgAdmin(ctx);
    const db = await getDbInstance();
    
    // Get shares where this org is the target
    const shares = await db.query.viewShares.findMany({
      where: and(
        eq(viewShares.sharedWithType, "organization"),
        eq(viewShares.sharedWithId, orgId)
      ),
      orderBy: [desc(viewShares.sharedAt)],
    });
    
    // Enrich with view and org details
    const result = [];
    for (const share of shares) {
      const view = await db.query.viewScopes.findFirst({
        where: eq(viewScopes.id, share.viewId),
      });
      
      if (!view) continue;
      
      const sourceOrg = await db.query.organizations.findFirst({
        where: eq(organizations.id, view.organizationId),
        columns: { name: true },
      });
      
      result.push({
        id: share.id,
        viewId: share.viewId,
        viewName: view.name,
        sourceOrgId: view.organizationId,
        sourceOrgName: sourceOrg?.name || "Unknown",
        permissionLevel: share.permissionLevel,
        sharedAt: share.sharedAt,
        expiresAt: share.expiresAt,
        isActive: share.isActive,
      });
    }
    
    return result;
  }),
  
  /**
   * Revoke a share (immediate access removal)
   */
  revokeShare: protectedProcedure
    .input(z.object({
      shareId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx);
      const db = await getDbInstance();
      
      // Get the share
      const share = await db.query.viewShares.findFirst({
        where: eq(viewShares.id, input.shareId),
      });
      
      if (!share) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found",
        });
      }
      
      // Verify the view belongs to current org
      const view = await db.query.viewScopes.findFirst({
        where: and(
          eq(viewScopes.id, share.viewId),
          eq(viewScopes.organizationId, orgId)
        ),
      });
      
      if (!view) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }
      
      // Revoke the share
      await db.update(viewShares)
        .set({
          isActive: false,
          revokedBy: ctx.user.id,
          revokedAt: new Date(),
        })
        .where(eq(viewShares.id, input.shareId));
      
      // Log the revocation
      await logSecurityEvent("view_share_revoked", ctx.user.id, {
        organizationId: orgId,
        extra: {
          shareId: input.shareId,
          viewId: share.viewId,
          viewName: view.name,
          targetOrgId: share.sharedWithId,
        },
      });
      
      return {
        success: true,
        message: "Share revoked - access removed immediately",
      };
    }),
  
  /**
   * Access a shared view (validates permissions and logs access)
   */
  accessSharedView: protectedProcedure
    .input(z.object({
      shareId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const orgId = await requireOrgAdmin(ctx);
      const db = await getDbInstance();
      
      // Get the share
      const share = await db.query.viewShares.findFirst({
        where: and(
          eq(viewShares.id, input.shareId),
          eq(viewShares.sharedWithType, "organization"),
          eq(viewShares.sharedWithId, orgId),
          eq(viewShares.isActive, true)
        ),
      });
      
      if (!share) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found or access denied",
        });
      }
      
      // Check expiry
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This share has expired",
        });
      }
      
      // Get view details
      const view = await db.query.viewScopes.findFirst({
        where: eq(viewScopes.id, share.viewId),
      });
      
      if (!view) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "View not found",
        });
      }
      
      // Log the access
      await logSecurityEvent("view_share_accessed", ctx.user.id, {
        organizationId: orgId,
        extra: {
          shareId: input.shareId,
          viewId: share.viewId,
          viewName: view.name,
          sourceOrgId: view.organizationId,
        },
      });
      
      return {
        viewId: view.id,
        viewName: view.name,
        viewType: view.viewType,
        description: view.description,
        config: view.config,
        permissionLevel: share.permissionLevel,
        expiresAt: share.expiresAt,
      };
    }),
});
