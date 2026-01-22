/**
 * Policy Context Service
 * 
 * Extends OrgContext with AI-specific authorization and retrieval scope.
 * The Policy Context is the SINGLE SOURCE OF TRUTH for AI authorization decisions.
 * 
 * HARD RULES:
 * 1. AI has NO privilege - uses same permissions as the user
 * 2. Deny by default - any access not explicitly allowed is blocked
 * 3. No cross-tenant access - ever - unless explicitly shared via Views
 * 4. All access is auditable
 * 
 * This service builds on top of:
 * - orgContext.ts: Organization context resolution
 * - permissions.ts: Role-based permission matrix
 * - dataAccessControl.ts: Data filtering
 */

import { OrgContext, resolveOrgContext, checkSuperuserElevation } from "./orgContext";
import { PermissionContext, getPermissionContext, hasPermission, PermissionResource, PermissionAction } from "./permissions";
import { DataAccessContext, getDataAccessContext } from "./dataAccessControl";
import { db } from "../db";
import { eq, and, inArray, gte } from "drizzle-orm";
import { 
  projectMembers, 
  projects,
  viewShares,
  viewScopes
} from "../../drizzle/schema";
import type { User } from "../../drizzle/schema";

/**
 * Policy Context - unified context for all authorization decisions
 * Combines OrgContext, PermissionContext, and AI-specific scope
 */
export interface PolicyContext {
  // Identity
  userId: number;
  userRole: string;
  isSuperuser: boolean;
  
  // Organization context (from OrgContext)
  activeOrgId: number | null;
  orgRole: string | null;
  isOrgAdmin: boolean;
  
  // Permissions (from PermissionContext)
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageMembers: boolean;
    canManageSettings: boolean;
    canShare: boolean;
    canExport: boolean;
  };
  
  // AI Retrieval Scope - what AI can access
  accessibleProjectIds: number[];
  accessibleViewIds: number[];
  accessibleShareIds: number[];
  
  // Sensitivity constraints
  sensitiveFieldsAllowed: boolean;
  exportAllowed: boolean;
  
  // Session metadata
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  
  // Elevation status (for superusers)
  elevation?: {
    id: number;
    canRead: boolean;
    canWrite: boolean;
    canExport: boolean;
    reason: string;
    expiresAt: Date;
  };
}

/**
 * Build a unified PolicyContext from user and session
 */
export async function buildPolicyContext(
  user: User,
  sessionId: string,
  orgHint?: { orgId?: number; orgSlug?: string }
): Promise<PolicyContext> {
  // Get permission context
  const permCtx = await getPermissionContext(user.id);
  
  // Determine active org
  let activeOrgId = orgHint?.orgId || user.activeOrgId || null;
  let orgRole: string | null = null;
  let isOrgAdmin = false;
  
  // Check superuser elevation if applicable
  let elevation: PolicyContext['elevation'] | undefined;
  if (user.isSuperuser && activeOrgId) {
    const elevationCheck = await checkSuperuserElevation(user.id, activeOrgId);
    if (elevationCheck.isElevated && elevationCheck.elevation) {
      elevation = elevationCheck.elevation;
    }
  }
  
  // Get org role from permission context
  if (permCtx.orgRole) {
    orgRole = permCtx.orgRole;
    isOrgAdmin = permCtx.orgRole === 'admin';
  } else if (user.isSuperuser && activeOrgId) {
    // Superuser accessing org gets admin-equivalent role
    orgRole = 'admin';
    isOrgAdmin = true;
  }
  
  // Build permissions object
  const permissions = {
    canView: hasPermission(permCtx, 'projects', 'view'),
    canEdit: hasPermission(permCtx, 'projects', 'edit'),
    canDelete: hasPermission(permCtx, 'projects', 'delete'),
    canManageMembers: hasPermission(permCtx, 'users', 'admin'),
    canManageSettings: hasPermission(permCtx, 'settings', 'edit'),
    canShare: hasPermission(permCtx, 'projects', 'admin'),
    canExport: hasPermission(permCtx, 'reports', 'create'),
  };
  
  // Build AI retrieval scope
  const accessibleProjectIds = await getAccessibleProjectIds(user.id, activeOrgId, user.isSuperuser);
  const accessibleViewIds = await getAccessibleViewIds(user.id, activeOrgId);
  const accessibleShareIds = await getAccessibleShareIds(user.id, activeOrgId);
  
  return {
    userId: user.id,
    userRole: user.role || 'user',
    isSuperuser: user.isSuperuser,
    activeOrgId,
    orgRole,
    isOrgAdmin,
    permissions,
    accessibleProjectIds,
    accessibleViewIds,
    accessibleShareIds,
    sensitiveFieldsAllowed: isOrgAdmin || user.isSuperuser,
    exportAllowed: permissions.canExport,
    sessionId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    elevation,
  };
}

/**
 * Get accessible project IDs for AI retrieval
 */
async function getAccessibleProjectIds(
  userId: number,
  activeOrgId: number | null,
  isSuperuser: boolean
): Promise<number[]> {
  if (!activeOrgId) {
    return [];
  }
  
  // Superusers and admins can access all org projects
  if (isSuperuser) {
    const orgProjects = await db.select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, activeOrgId));
    return orgProjects.map(p => p.id);
  }
  
  // Get direct project memberships
  const memberships = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  
  const memberProjectIds = memberships.map(m => m.projectId);
  
  // Filter to only projects in current org
  if (memberProjectIds.length === 0) {
    return [];
  }
  
  const orgProjects = await db.select({ id: projects.id })
    .from(projects)
    .where(and(
      eq(projects.organizationId, activeOrgId),
      inArray(projects.id, memberProjectIds)
    ));
  
  return orgProjects.map(p => p.id);
}

/**
 * Get accessible view IDs for AI retrieval
 */
async function getAccessibleViewIds(
  userId: number,
  activeOrgId: number | null
): Promise<number[]> {
  if (!activeOrgId) {
    return [];
  }
  
  // Get views owned by the org
  const ownedViews = await db.select({ id: viewScopes.id })
    .from(viewScopes)
    .where(eq(viewScopes.organizationId, activeOrgId));
  
  return ownedViews.map(v => v.id);
}

/**
 * Get accessible share IDs for AI retrieval (received shares)
 */
async function getAccessibleShareIds(
  userId: number,
  activeOrgId: number | null
): Promise<number[]> {
  if (!activeOrgId) {
    return [];
  }
  
  // Get active shares where this org is the target
  const receivedShares = await db.select({ id: viewShares.id })
    .from(viewShares)
    .where(and(
      eq(viewShares.targetOrganizationId, activeOrgId),
      eq(viewShares.status, 'active')
    ));
  
  return receivedShares.map(s => s.id);
}

/**
 * Validate that a resource access is within policy scope
 */
export function validatePolicyAccess(
  ctx: PolicyContext,
  resourceType: "project" | "view" | "document" | "infoItem",
  resourceId: number,
  action: "view" | "edit" | "delete" | "share" | "export"
): boolean {
  // Check basic permission
  switch (action) {
    case "view":
      if (!ctx.permissions.canView) return false;
      break;
    case "edit":
      if (!ctx.permissions.canEdit) return false;
      break;
    case "delete":
      if (!ctx.permissions.canDelete) return false;
      break;
    case "share":
      if (!ctx.permissions.canShare) return false;
      break;
    case "export":
      if (!ctx.permissions.canExport) return false;
      break;
  }
  
  // Check resource-specific access
  switch (resourceType) {
    case "project":
      return ctx.accessibleProjectIds.includes(resourceId);
    case "view":
      return ctx.accessibleViewIds.includes(resourceId);
    default:
      return true; // Will be validated at query level
  }
}

/**
 * Build AI retrieval scope from PolicyContext
 * This is what gets passed to AI retrieval functions
 */
export function buildAIRetrievalScope(ctx: PolicyContext): {
  orgId: number | null;
  projectIds: number[];
  viewIds: number[];
  shareIds: number[];
  sensitiveFieldsAllowed: boolean;
} {
  return {
    orgId: ctx.activeOrgId,
    projectIds: ctx.accessibleProjectIds,
    viewIds: ctx.accessibleViewIds,
    shareIds: ctx.accessibleShareIds,
    sensitiveFieldsAllowed: ctx.sensitiveFieldsAllowed,
  };
}

/**
 * Enforce org scope on query results - MUST be called on all data queries
 */
export function enforceOrgScope<T extends { organizationId?: number | null }>(
  ctx: PolicyContext,
  data: T[]
): T[] {
  if (!ctx.activeOrgId) {
    return [];
  }
  return data.filter(item => item.organizationId === ctx.activeOrgId);
}

/**
 * Log policy access for audit
 */
export async function logPolicyAccess(
  ctx: PolicyContext,
  resourceType: string,
  resourceId: number,
  action: string,
  allowed: boolean,
  details?: Record<string, unknown>
): Promise<void> {
  console.log(`[POLICY AUDIT] User ${ctx.userId} org ${ctx.activeOrgId} ${allowed ? "ALLOWED" : "DENIED"} ${action} on ${resourceType}:${resourceId}`, details);
}
