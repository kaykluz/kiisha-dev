/**
 * Phase 33: Workspace Guardrails
 * 
 * Guard functions for workspace context enforcement:
 * - requireWorkspace(ctx) → throws UNAUTHORIZED if no active org
 * - requireOrgMembership(userId, orgId) → validates membership
 * - requireRole(...) → validates role
 * - All project/doc queries must have organizationId = ctx.organizationId
 */

import { TRPCError } from "@trpc/server";
import * as db from "../db";

// Context type with workspace info
export interface WorkspaceContext {
  user: {
    id: number;
    activeOrgId: number | null;
    role?: string;
    totpEnabled?: boolean;
  };
  organizationId?: number;
  organizationSlug?: string;
  orgRole?: string;
}

// Error messages - generic to prevent org existence leakage
export const WORKSPACE_ERRORS = {
  NO_WORKSPACE: "No active workspace selected. Please select a workspace to continue.",
  NOT_MEMBER: "Access denied",
  ORG_SUSPENDED: "This workspace is currently unavailable",
  REQUIRES_2FA: "This workspace requires two-factor authentication",
  INSUFFICIENT_ROLE: "You don't have permission to perform this action",
  RESOURCE_NOT_FOUND: "Resource not found",
  CROSS_ORG_ACCESS: "Access denied",
} as const;

/**
 * Require active workspace context
 * Throws UNAUTHORIZED if no active org
 */
export function requireWorkspace(ctx: WorkspaceContext): asserts ctx is WorkspaceContext & { 
  organizationId: number;
  user: { id: number; activeOrgId: number };
} {
  if (!ctx.user.activeOrgId || !ctx.organizationId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: WORKSPACE_ERRORS.NO_WORKSPACE,
    });
  }
}

/**
 * Require user is a member of the specified org
 * Returns the membership role if valid
 */
export async function requireOrgMembership(
  userId: number,
  organizationId: number
): Promise<string> {
  const role = await db.getUserOrgRole(userId, organizationId);
  if (!role) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: WORKSPACE_ERRORS.NOT_MEMBER,
    });
  }
  return role;
}

/**
 * Require user has one of the specified roles
 */
export function requireRole(
  userRole: string | undefined,
  allowedRoles: string[]
): void {
  if (!userRole || !allowedRoles.includes(userRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: WORKSPACE_ERRORS.INSUFFICIENT_ROLE,
    });
  }
}

/**
 * Require admin role
 */
export function requireAdmin(userRole: string | undefined): void {
  requireRole(userRole, ["admin"]);
}

/**
 * Require editor or admin role
 */
export function requireEditor(userRole: string | undefined): void {
  requireRole(userRole, ["admin", "editor"]);
}

/**
 * Require reviewer, editor, or admin role
 */
export function requireReviewer(userRole: string | undefined): void {
  requireRole(userRole, ["admin", "editor", "reviewer"]);
}

/**
 * Verify a resource belongs to the current workspace
 * Returns true if resource org matches context org
 * Returns false (not throws) to allow graceful handling
 */
export function verifyResourceOrg(
  resourceOrgId: number | null | undefined,
  contextOrgId: number
): boolean {
  return resourceOrgId === contextOrgId;
}

/**
 * Verify and throw if resource doesn't belong to workspace
 */
export function requireResourceInWorkspace(
  resourceOrgId: number | null | undefined,
  contextOrgId: number,
  resourceType: string = "Resource"
): void {
  if (!verifyResourceOrg(resourceOrgId, contextOrgId)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: WORKSPACE_ERRORS.RESOURCE_NOT_FOUND,
    });
  }
}

/**
 * Verify project belongs to current workspace
 */
export async function verifyProjectAccess(
  projectId: number,
  organizationId: number
): Promise<boolean> {
  const project = await db.getProjectById(projectId);
  if (!project) return false;
  return project.organizationId === organizationId;
}

/**
 * Verify document belongs to current workspace
 */
export async function verifyDocumentAccess(
  documentId: number,
  organizationId: number
): Promise<boolean> {
  const doc = await db.getDocumentById(documentId);
  if (!doc) return false;
  // Document access through project
  if (doc.projectId) {
    const project = await db.getProjectById(doc.projectId);
    return project?.organizationId === organizationId;
  }
  return false;
}

/**
 * Verify asset belongs to current workspace
 */
export async function verifyAssetAccess(
  assetId: number,
  organizationId: number
): Promise<boolean> {
  const asset = await db.getAssetById(assetId);
  if (!asset) return false;
  return asset.organizationId === organizationId;
}

/**
 * Build org-scoped query filter
 * Use this in all queries to ensure org isolation
 */
export function orgScopeFilter(organizationId: number) {
  return { organizationId };
}

/**
 * Validate subdomain matches session org
 * Returns true if match, false if mismatch
 */
export async function validateSubdomainMatch(
  subdomainSlug: string | null,
  sessionOrgId: number | null
): Promise<{ valid: boolean; reason?: string }> {
  // No subdomain = generic KIISHA (allowed)
  if (!subdomainSlug) {
    return { valid: true };
  }
  
  // Subdomain provided but no session org
  if (!sessionOrgId) {
    return { 
      valid: false, 
      reason: "Please select a workspace to access this domain" 
    };
  }
  
  // Look up org by slug
  const org = await db.getOrganizationBySlug(subdomainSlug);
  if (!org) {
    // Don't reveal org doesn't exist
    return { 
      valid: false, 
      reason: "Please select a workspace to access this domain" 
    };
  }
  
  // Check match
  if (org.id !== sessionOrgId) {
    return { 
      valid: false, 
      reason: "Session workspace does not match domain" 
    };
  }
  
  return { valid: true };
}

/**
 * Extract org slug from hostname
 * Returns null for generic domains (app.kiisha.io, localhost, etc.)
 */
export function extractOrgSlugFromHost(host: string): string | null {
  // Remove port if present
  const hostname = host.split(":")[0];
  
  // Check for known generic domains
  const genericDomains = [
    "app.kiisha.io",
    "kiisha.io",
    "localhost",
    "127.0.0.1",
  ];
  
  if (genericDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
    return null;
  }
  
  // Check for subdomain pattern: {slug}.kiisha.io
  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.kiisha\.io$/i);
  if (subdomainMatch) {
    return subdomainMatch[1].toLowerCase();
  }
  
  // Check for manus.computer dev domains
  if (hostname.includes(".manus.computer")) {
    return null;
  }
  
  // Custom domain - would need lookup in domains table
  // For now, return null (treat as generic)
  return null;
}
