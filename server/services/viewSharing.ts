/**
 * View Sharing Service
 * 
 * Cross-org sharing occurs ONLY through explicit View sharing.
 * A View is a permissioned "package" of information with defined scope.
 * 
 * HARD RULES:
 * 1. Share Unit = View (or View Package)
 * 2. Sharing must be: explicit, revocable, time-bounded (optional), audited
 * 3. Receiving org members can ONLY access that View and ONLY what it contains
 * 4. AI may use ONLY the view's contents and allowed evidence within it
 * 5. AI must NOT "follow links" from shared view into owner org's wider document hub
 * 
 * Uses existing viewShares and viewScopes tables.
 */

import { db } from "../db";
import { eq, and, or } from "drizzle-orm";
import { viewShares, viewScopes } from "../../drizzle/schema";
import type { OrgContext } from "./orgContext";
import { buildIsolationAuditEntry } from "./tenantIsolation";

// View share request
export interface ShareViewRequest {
  viewId: number;
  targetType: "user" | "team" | "department" | "organization";
  targetId: number;
  permissionLevel?: "view_only" | "edit" | "admin";
  expiresAt?: Date;
}

// Share result
export interface ShareResult {
  shareId: number;
  shareUrl: string;
  expiresAt: Date | null;
}

// Shared view access result
export interface SharedViewAccess {
  viewId: number;
  viewName: string;
  viewType: string;
  scope: {
    projectIds: number[];
    documentIds: number[];
    infoItemIds: number[];
  };
  restrictions: {
    canExport: boolean;
    canCopy: boolean;
    sensitiveFieldsHidden: boolean;
  };
  expiresAt: Date | null;
  permissionLevel: string;
}

/**
 * Create a view share
 * Only Org Admins or View Owners with canShare can create shares
 */
export async function createViewShare(
  ctx: OrgContext,
  request: ShareViewRequest
): Promise<ShareResult> {
  // Validate permissions
  if (!ctx.isOrgAdmin) {
    throw new Error("Only organization admins can share views");
  }
  
  // Validate view exists and belongs to user's org
  const view = await db.query.viewScopes.findFirst({
    where: and(
      eq(viewScopes.id, request.viewId),
      eq(viewScopes.organizationId, ctx.organizationId)
    ),
  });
  
  if (!view) {
    throw new Error("View not found or access denied");
  }
  
  // Create the share record using existing schema
  const [result] = await db.insert(viewShares).values({
    viewId: request.viewId,
    sharedWithType: request.targetType,
    sharedWithId: request.targetId,
    permissionLevel: request.permissionLevel || "view_only",
    sharedBy: ctx.user.id,
    sharedAt: new Date(),
    expiresAt: request.expiresAt || null,
    isActive: true,
  });
  
  const shareId = result.insertId;
  
  // Generate share URL
  const shareUrl = `/shared/view/${shareId}`;
  
  // Log the share creation
  console.log("[AUDIT] View share created:", buildIsolationAuditEntry(
    ctx,
    "create_share",
    "view",
    request.viewId,
    true,
    { targetType: request.targetType, targetId: request.targetId }
  ));
  
  return {
    shareId,
    shareUrl,
    expiresAt: request.expiresAt || null,
  };
}

/**
 * Revoke a view share
 * Revocation MUST immediately remove access
 */
export async function revokeViewShare(
  ctx: OrgContext,
  shareId: number,
  _reason?: string
): Promise<void> {
  // Validate permissions
  if (!ctx.isOrgAdmin) {
    throw new Error("Only organization admins can revoke shares");
  }
  
  // Get the share to verify ownership
  const share = await db.query.viewShares.findFirst({
    where: eq(viewShares.id, shareId),
  });
  
  if (!share) {
    throw new Error("Share not found");
  }
  
  // Verify the view belongs to user's org
  const view = await db.query.viewScopes.findFirst({
    where: and(
      eq(viewScopes.id, share.viewId),
      eq(viewScopes.organizationId, ctx.organizationId)
    ),
  });
  
  if (!view) {
    throw new Error("Access denied");
  }
  
  // Update share status to revoked
  await db.update(viewShares)
    .set({ 
      isActive: false, 
      revokedAt: new Date(), 
      revokedBy: ctx.user.id,
    })
    .where(eq(viewShares.id, shareId));
  
  // Log the revocation
  console.log("[AUDIT] View share revoked:", buildIsolationAuditEntry(
    ctx,
    "revoke_share",
    "view_share",
    shareId,
    true,
    {}
  ));
}

/**
 * Access a shared view
 * Validates share is active and returns accessible scope
 */
export async function accessSharedView(
  ctx: OrgContext,
  shareId: number
): Promise<SharedViewAccess | null> {
  // Query share from database
  const share = await db.query.viewShares.findFirst({
    where: and(
      eq(viewShares.id, shareId),
      eq(viewShares.isActive, true),
      or(
        and(
          eq(viewShares.sharedWithType, "organization"),
          eq(viewShares.sharedWithId, ctx.organizationId)
        ),
        and(
          eq(viewShares.sharedWithType, "user"),
          eq(viewShares.sharedWithId, ctx.user.id)
        )
      )
    ),
  });
  
  if (!share) {
    // Don't reveal whether share exists - anti-enumeration
    return null;
  }
  
  // Check expiry
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    // Share has expired
    return null;
  }
  
  // Get view details
  const view = await db.query.viewScopes.findFirst({
    where: eq(viewScopes.id, share.viewId),
  });
  
  if (!view) {
    return null;
  }
  
  // Log the access
  console.log("[AUDIT] Shared view accessed:", buildIsolationAuditEntry(
    ctx,
    "access_shared_view",
    "view_share",
    shareId,
    true,
    { viewId: share.viewId }
  ));
  
  // Parse scope from view config
  const config = view.config as { projectIds?: number[]; documentIds?: number[]; infoItemIds?: number[] } || {};
  
  // Return accessible scope
  return {
    viewId: share.viewId,
    viewName: view.name,
    viewType: view.viewType || "custom",
    scope: {
      projectIds: config.projectIds || (view.projectId ? [view.projectId] : []),
      documentIds: config.documentIds || [],
      infoItemIds: config.infoItemIds || [],
    },
    restrictions: {
      canExport: share.permissionLevel === "admin" || share.permissionLevel === "edit",
      canCopy: share.permissionLevel === "admin" || share.permissionLevel === "edit",
      sensitiveFieldsHidden: share.permissionLevel === "view_only",
    },
    expiresAt: share.expiresAt,
    permissionLevel: share.permissionLevel,
  };
}

/**
 * List shares for a view
 */
export async function listViewShares(
  ctx: OrgContext,
  viewId: number
): Promise<Array<{
  shareId: number;
  targetType: string;
  targetId: number;
  permissionLevel: string;
  isActive: boolean;
  expiresAt: Date | null;
  sharedAt: Date;
}>> {
  // Verify view belongs to user's org
  const view = await db.query.viewScopes.findFirst({
    where: and(
      eq(viewScopes.id, viewId),
      eq(viewScopes.organizationId, ctx.organizationId)
    ),
  });
  
  if (!view) {
    throw new Error("View not found or access denied");
  }
  
  const shares = await db.query.viewShares.findMany({
    where: eq(viewShares.viewId, viewId),
  });
  
  return shares.map(s => ({
    shareId: s.id,
    targetType: s.sharedWithType,
    targetId: s.sharedWithId,
    permissionLevel: s.permissionLevel,
    isActive: s.isActive,
    expiresAt: s.expiresAt,
    sharedAt: s.sharedAt,
  }));
}

/**
 * List shares received by the user's org
 */
export async function listReceivedShares(
  ctx: OrgContext
): Promise<Array<{
  shareId: number;
  viewId: number;
  viewName: string;
  permissionLevel: string;
  expiresAt: Date | null;
}>> {
  const shares = await db.query.viewShares.findMany({
    where: and(
      eq(viewShares.sharedWithType, "organization"),
      eq(viewShares.sharedWithId, ctx.organizationId),
      eq(viewShares.isActive, true)
    ),
  });
  
  const result = [];
  for (const share of shares) {
    const view = await db.query.viewScopes.findFirst({
      where: eq(viewScopes.id, share.viewId),
    });
    
    if (view) {
      result.push({
        shareId: share.id,
        viewId: share.viewId,
        viewName: view.name,
        permissionLevel: share.permissionLevel,
        expiresAt: share.expiresAt,
      });
    }
  }
  
  return result;
}

/**
 * Validate that AI retrieval stays within shared view scope
 * AI must NOT "follow links" from shared view into non-shared data
 */
export function validateAISharedViewScope(
  sharedViewAccess: SharedViewAccess,
  requestedResourceType: "document" | "infoItem" | "project",
  requestedResourceId: number
): boolean {
  switch (requestedResourceType) {
    case "project":
      return sharedViewAccess.scope.projectIds.includes(requestedResourceId);
    case "document":
      return sharedViewAccess.scope.documentIds.includes(requestedResourceId);
    case "infoItem":
      return sharedViewAccess.scope.infoItemIds.includes(requestedResourceId);
    default:
      return false;
  }
}

/**
 * Get the combined scope for AI retrieval including shares
 * Used to build the full retrieval scope for AI queries
 */
export async function getAIRetrievalScopeWithShares(
  ctx: OrgContext
): Promise<{
  ownOrgScope: {
    projectIds: number[];
    documentIds: number[];
    infoItemIds: number[];
  };
  sharedScopes: Array<{
    shareId: number;
    sourceOrgId: number;
    projectIds: number[];
    documentIds: number[];
    infoItemIds: number[];
    sensitiveFieldsHidden: boolean;
  }>;
}> {
  // Get own org views
  const ownViews = await db.query.viewScopes.findMany({
    where: eq(viewScopes.organizationId, ctx.organizationId),
  });
  
  // Aggregate own org scope
  const ownOrgScope = {
    projectIds: [] as number[],
    documentIds: [] as number[],
    infoItemIds: [] as number[],
  };
  
  for (const view of ownViews) {
    const config = view.config as { projectIds?: number[]; documentIds?: number[]; infoItemIds?: number[] } || {};
    if (view.projectId) ownOrgScope.projectIds.push(view.projectId);
    if (config.projectIds) ownOrgScope.projectIds.push(...config.projectIds);
    if (config.documentIds) ownOrgScope.documentIds.push(...config.documentIds);
    if (config.infoItemIds) ownOrgScope.infoItemIds.push(...config.infoItemIds);
  }
  
  // Deduplicate
  ownOrgScope.projectIds = [...new Set(ownOrgScope.projectIds)];
  ownOrgScope.documentIds = [...new Set(ownOrgScope.documentIds)];
  ownOrgScope.infoItemIds = [...new Set(ownOrgScope.infoItemIds)];
  
  // Get shared scopes
  const receivedShares = await listReceivedShares(ctx);
  const sharedScopes = [];
  
  for (const share of receivedShares) {
    const access = await accessSharedView(ctx, share.shareId);
    if (access) {
      // Get source org from view
      const view = await db.query.viewScopes.findFirst({
        where: eq(viewScopes.id, share.viewId),
      });
      
      sharedScopes.push({
        shareId: share.shareId,
        sourceOrgId: view?.organizationId || 0,
        projectIds: access.scope.projectIds,
        documentIds: access.scope.documentIds,
        infoItemIds: access.scope.infoItemIds,
        sensitiveFieldsHidden: access.restrictions.sensitiveFieldsHidden,
      });
    }
  }
  
  return { ownOrgScope, sharedScopes };
}
