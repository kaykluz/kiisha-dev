/**
 * Tenant Isolation Service
 * 
 * HARD RULES (Non-Negotiable):
 * 1. Orgs cannot see other orgs' data - EVER - unless explicitly shared via Views
 * 2. Every data fetch MUST include an org boundary constraint
 * 3. AI is subject to the EXACT same authorization checks as the user
 * 4. No cross-org retrieval: AI must not reference, infer, or return anything outside scope
 * 5. No training/learning across orgs: customer data never used to train shared models
 * 
 * This service provides utilities to enforce tenant isolation at the data layer.
 * Works with: orgContext.ts, permissions.ts, policyContext.ts
 */

import { TRPCError } from "@trpc/server";
import type { OrgContext } from "./orgContext";
import type { PolicyContext } from "./policyContext";

// Error thrown when tenant isolation is violated
export class TenantIsolationError extends Error {
  constructor(
    message: string,
    public userId: number,
    public attemptedOrgId: number | null,
    public allowedOrgId: number | null
  ) {
    super(message);
    this.name = "TenantIsolationError";
  }
  
  toTRPCError(): TRPCError {
    // Never reveal org existence in error messages
    return new TRPCError({
      code: "NOT_FOUND",
      message: "Resource not found",
    });
  }
}

// Error thrown when trying to access cross-org data
export class CrossOrgAccessError extends Error {
  constructor(
    message: string,
    public sourceOrgId: number,
    public targetOrgId: number
  ) {
    super(message);
    this.name = "CrossOrgAccessError";
  }
  
  toTRPCError(): TRPCError {
    return new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied",
    });
  }
}

/**
 * Validate that a record belongs to the user's active org
 * Throws TenantIsolationError if validation fails
 */
export function validateOrgOwnership(
  ctx: OrgContext | PolicyContext,
  record: { organizationId: number | null },
  resourceType: string
): void {
  const orgId = 'organizationId' in ctx ? ctx.organizationId : ctx.activeOrgId;
  
  if (!orgId) {
    throw new TenantIsolationError(
      `No organization context for accessing ${resourceType}`,
      'userId' in ctx ? ctx.userId : ctx.user.id,
      null,
      null
    );
  }
  
  if (record.organizationId !== orgId) {
    throw new TenantIsolationError(
      `Access denied: ${resourceType} belongs to different organization`,
      'userId' in ctx ? ctx.userId : ctx.user.id,
      record.organizationId,
      orgId
    );
  }
}

/**
 * Filter an array of records to only those in the user's org
 * Use this as a safety net after queries (defense in depth)
 */
export function filterByOrg<T extends { organizationId: number | null }>(
  ctx: OrgContext | PolicyContext,
  records: T[]
): T[] {
  const orgId = 'organizationId' in ctx ? ctx.organizationId : ctx.activeOrgId;
  
  if (!orgId) {
    return [];
  }
  
  return records.filter(r => r.organizationId === orgId);
}

/**
 * Filter an array of records to only accessible projects
 */
export function filterByProject<T extends { projectId: number }>(
  ctx: PolicyContext,
  records: T[]
): T[] {
  if (ctx.accessibleProjectIds.length === 0) {
    return [];
  }
  
  return records.filter(r => ctx.accessibleProjectIds.includes(r.projectId));
}

/**
 * Check if user can access a specific org
 * Returns false for cross-org access attempts
 */
export function canAccessOrg(ctx: OrgContext | PolicyContext, orgId: number): boolean {
  const isSuperuser = 'isSuperuser' in ctx ? ctx.isSuperuser : false;
  const activeOrgId = 'organizationId' in ctx ? ctx.organizationId : ctx.activeOrgId;
  
  // Superusers can access any org (but must still select it)
  if (isSuperuser) {
    return true;
  }
  
  // Regular users can only access their active org
  return activeOrgId === orgId;
}

/**
 * Validate cross-org sharing is allowed
 * Only allowed through explicit View shares
 */
export function validateCrossOrgAccess(
  ctx: PolicyContext,
  targetOrgId: number,
  shareId: number | null
): void {
  if (ctx.activeOrgId === targetOrgId) {
    return; // Same org, allowed
  }
  
  if (!shareId) {
    throw new CrossOrgAccessError(
      "Cross-org access requires explicit View share",
      ctx.activeOrgId!,
      targetOrgId
    );
  }
  
  // Verify share is in accessible shares
  if (!ctx.accessibleShareIds.includes(shareId)) {
    throw new CrossOrgAccessError(
      "Share not accessible or has been revoked",
      ctx.activeOrgId!,
      targetOrgId
    );
  }
}

/**
 * Sanitize error messages to prevent org enumeration
 * NEVER reveal whether an org exists in error messages
 */
export function sanitizeOrgError(_error: Error): string {
  // Generic error message that doesn't reveal org existence
  return "Invalid request. Please check your access permissions.";
}

/**
 * Enforce org scope - check if access should be allowed
 * Returns result object instead of throwing for testability
 */
export async function enforceOrgScope(
  userOrgId: number | null,
  requestedOrgId: number | null
): Promise<{ allowed: boolean; reason: string }> {
  if (!userOrgId) {
    return { allowed: false, reason: "Access denied: No organization context" };
  }
  
  if (!requestedOrgId) {
    return { allowed: false, reason: "Access denied: Invalid request" };
  }
  
  if (userOrgId !== requestedOrgId) {
    // Generic error - don't reveal org existence
    return { allowed: false, reason: "Access denied: Invalid request" };
  }
  
  return { allowed: true, reason: "Access granted" };
}

/**
 * Assert that org context exists in the request context
 * Throws if no org context is present
 */
export function assertOrgContext(ctx: { organizationId?: number | null }): void {
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Organization context required",
    });
  }
}

/**
 * Rate limit key for org-related requests
 * Used to prevent enumeration attacks
 */
export function getOrgRateLimitKey(
  action: "login" | "join_request" | "token_check",
  identifier: string // IP or user ID
): string {
  return `org_rate_limit:${action}:${identifier}`;
}

/**
 * Check if a query result should be filtered for sensitive data
 */
export function shouldHideSensitiveFields(ctx: PolicyContext): boolean {
  return !ctx.sensitiveFieldsAllowed;
}

/**
 * Redact sensitive fields from a record
 */
export function redactSensitiveFields<T extends Record<string, unknown>>(
  record: T,
  sensitiveFields: string[]
): T {
  const redacted = { ...record };
  for (const field of sensitiveFields) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]" as any;
    }
  }
  return redacted;
}

/**
 * Build audit log entry for tenant isolation events
 */
export function buildIsolationAuditEntry(
  ctx: OrgContext | PolicyContext,
  action: string,
  resourceType: string,
  resourceId: number | null,
  allowed: boolean,
  details?: Record<string, unknown>
): Record<string, unknown> {
  const userId = 'userId' in ctx ? ctx.userId : ctx.user.id;
  const activeOrgId = 'organizationId' in ctx ? ctx.organizationId : ctx.activeOrgId;
  const isSuperuser = 'isSuperuser' in ctx ? ctx.isSuperuser : false;
  const sessionId = 'sessionId' in ctx ? ctx.sessionId : undefined;
  
  return {
    timestamp: new Date().toISOString(),
    userId,
    activeOrgId,
    sessionId,
    action,
    resourceType,
    resourceId,
    allowed,
    isSuperuser,
    details,
  };
}

// ============================================================================
// AI-SPECIFIC ISOLATION
// ============================================================================

/**
 * Validate AI retrieval results are within scope
 * Throws error if any result is outside allowed scope
 */
export function validateAIRetrievalResults(
  ctx: PolicyContext,
  results: Array<{ organizationId: number; projectId?: number }>
): void {
  for (const result of results) {
    if (result.organizationId !== ctx.activeOrgId) {
      throw new TenantIsolationError(
        "AI retrieval returned cross-org data - blocked",
        ctx.userId,
        result.organizationId,
        ctx.activeOrgId
      );
    }
    
    if (result.projectId && !ctx.accessibleProjectIds.includes(result.projectId)) {
      throw new TenantIsolationError(
        "AI retrieval returned inaccessible project data - blocked",
        ctx.userId,
        result.organizationId,
        ctx.activeOrgId
      );
    }
  }
}

/**
 * Filter AI response to remove any cross-org references
 * This is a safety net - should never be needed if retrieval is correct
 */
export function filterAIResponse(
  _ctx: PolicyContext,
  response: string,
  knownOrgNames: string[]
): string {
  // Remove any mentions of other org names
  let filtered = response;
  for (const orgName of knownOrgNames) {
    filtered = filtered.replace(new RegExp(orgName, "gi"), "[REDACTED]");
  }
  return filtered;
}

