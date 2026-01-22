/**
 * Organization Context Service
 * 
 * Provides hard multi-tenancy enforcement:
 * - Every request resolves ctx.organizationId deterministically
 * - All data queries must be scoped by organizationId
 * - Error responses never leak org existence
 */

import { TRPCError } from "@trpc/server";
import type { User, Organization, OrganizationMember } from "../../drizzle/schema";
import * as db from "../db";

// Standard error messages that don't leak information
export const ERRORS = {
  NOT_FOUND: "Resource not found",
  FORBIDDEN: "Access denied",
  INVALID_ORG: "Invalid organization context",
  NO_MEMBERSHIP: "No organization membership",
  ORG_SUSPENDED: "Organization is suspended",
  REQUIRES_2FA: "Two-factor authentication required",
} as const;

/**
 * Context resolved for every authenticated request
 */
export interface OrgContext {
  user: User;
  organizationId: number;
  organization: Organization;
  membership: OrganizationMember;
  role: OrganizationMember["role"];
  isOrgAdmin: boolean;
}

/**
 * Resolve organization context from user and optional org hint
 * 
 * Resolution order:
 * 1. Explicit orgId parameter (from subdomain or header)
 * 2. User's activeOrgId (from session)
 * 3. User's only membership (if single org)
 * 
 * Throws if:
 * - User has no memberships
 * - User has multiple orgs but no activeOrgId set
 * - Org is suspended
 * - Org requires 2FA but user hasn't enrolled
 */
export async function resolveOrgContext(
  user: User,
  orgHint?: { orgId?: number; orgSlug?: string }
): Promise<OrgContext> {
  // Get all user's active memberships
  const memberships = await db.getUserOrganizationMemberships(user.id);
  const activeMemberships = memberships.filter(m => m.status === "active");
  
  if (activeMemberships.length === 0) {
    // Check if user is in lobby
    const lobbyOrg = await db.getKiishaLobbyOrg();
    if (lobbyOrg) {
      // Return lobby context with minimal permissions
      return {
        user,
        organizationId: lobbyOrg.id,
        organization: lobbyOrg,
        membership: {
          id: 0,
          organizationId: lobbyOrg.id,
          userId: user.id,
          preApprovedEmail: null,
          preApprovedPhone: null,
          role: "reviewer",
          status: "active",
          invitedBy: null,
          invitedAt: null,
          acceptedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        role: "reviewer",
        isOrgAdmin: false,
      };
    }
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.NO_MEMBERSHIP });
  }
  
  let targetOrgId: number | undefined;
  
  // Priority 1: Explicit org hint
  if (orgHint?.orgId) {
    targetOrgId = orgHint.orgId;
  } else if (orgHint?.orgSlug) {
    const org = await db.getOrganizationBySlug(orgHint.orgSlug);
    if (org) targetOrgId = org.id;
  }
  
  // Priority 2: User's active org from session
  if (!targetOrgId && user.activeOrgId !== null && user.activeOrgId !== undefined) {
    targetOrgId = user.activeOrgId;
  }
  
  // Priority 3: Single membership
  if (!targetOrgId && activeMemberships.length === 1) {
    targetOrgId = activeMemberships[0].organizationId;
  }
  
  // If still no org and user has multiple, require explicit selection
  if (!targetOrgId && activeMemberships.length > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Multiple organizations available. Please select one.",
    });
  }
  
  if (!targetOrgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.INVALID_ORG });
  }
  
  // Verify membership in target org
  const membership = activeMemberships.find(m => m.organizationId === targetOrgId);
  if (!membership) {
    // Don't reveal if org exists - just say access denied
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.FORBIDDEN });
  }
  
  // Get full org details
  const organization = await db.getOrganizationById(targetOrgId);
  if (!organization) {
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.FORBIDDEN });
  }
  
  // Check org status
  if (organization.status === "suspended") {
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.ORG_SUSPENDED });
  }
  
  if (organization.status === "archived") {
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.FORBIDDEN });
  }
  
  // Check 2FA requirement
  if (organization.require2FA && !user.totpEnabled) {
    throw new TRPCError({ code: "FORBIDDEN", message: ERRORS.REQUIRES_2FA });
  }
  
  return {
    user,
    organizationId: organization.id,
    organization,
    membership,
    role: membership.role,
    isOrgAdmin: membership.role === "admin",
  };
}

/**
 * Verify user has access to a specific resource within their org
 * Returns true/false without leaking information
 */
export async function verifyResourceAccess(
  ctx: OrgContext,
  resourceType: "project" | "document" | "asset" | "view" | "dataroom",
  resourceId: number
): Promise<boolean> {
  switch (resourceType) {
    case "project": {
      const project = await db.getProjectById(resourceId);
      return project?.organizationId === ctx.organizationId;
    }
    case "document": {
      const doc = await db.getDocumentById(resourceId);
      if (!doc) return false;
      // Check via project
      const project = await db.getProjectById(doc.projectId);
      return project?.organizationId === ctx.organizationId;
    }
    case "asset": {
      const asset = await db.getAssetById(resourceId);
      if (!asset) return false;
      // Check via organizationId directly or via project
      if (asset.organizationId) {
        return asset.organizationId === ctx.organizationId;
      }
      if (asset.projectId) {
        const project = await db.getProjectById(asset.projectId);
        return project?.organizationId === ctx.organizationId;
      }
      return false;
    }
    case "view": {
      const view = await db.getViewScopeById(resourceId);
      return view?.organizationId === ctx.organizationId;
    }
    case "dataroom": {
      const dataroom = await db.getDataRoomById(resourceId);
      return dataroom?.organizationId === ctx.organizationId;
    }
    default:
      return false;
  }
}

/**
 * Assert resource access - throws standardized error if denied
 */
export async function assertResourceAccess(
  ctx: OrgContext,
  resourceType: "project" | "document" | "asset" | "view" | "dataroom",
  resourceId: number
): Promise<void> {
  const hasAccess = await verifyResourceAccess(ctx, resourceType, resourceId);
  if (!hasAccess) {
    // Always return NOT_FOUND to prevent enumeration
    throw new TRPCError({ code: "NOT_FOUND", message: ERRORS.NOT_FOUND });
  }
}

/**
 * Check if user is a KIISHA superuser with active elevation
 */
export async function checkSuperuserElevation(
  userId: number,
  targetOrgId?: number
): Promise<{
  isElevated: boolean;
  elevation?: {
    id: number;
    canRead: boolean;
    canWrite: boolean;
    canExport: boolean;
    reason: string;
    expiresAt: Date;
  };
}> {
  const elevation = await db.getActiveSuperuserElevation(userId, targetOrgId);
  if (!elevation) {
    return { isElevated: false };
  }
  
  return {
    isElevated: true,
    elevation: {
      id: elevation.id,
      canRead: elevation.canRead,
      canWrite: elevation.canWrite,
      canExport: elevation.canExport,
      reason: elevation.reason,
      expiresAt: elevation.expiresAt,
    },
  };
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  eventType: string,
  userId: number | null,
  details: {
    organizationId?: number;
    targetUserId?: number;
    targetOrganizationId?: number;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    elevationId?: number;
    elevationReason?: string;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  await db.createSecurityAuditLogEntry({
    eventType: eventType as any,
    userId,
    organizationId: details.organizationId,
    targetUserId: details.targetUserId,
    targetOrganizationId: details.targetOrganizationId,
    details: details.extra,
    ipAddress: details.ipAddress,
    userAgent: details.userAgent,
    sessionId: details.sessionId,
    elevationId: details.elevationId,
    elevationReason: details.elevationReason,
  });
}
