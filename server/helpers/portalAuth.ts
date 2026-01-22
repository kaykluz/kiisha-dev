/**
 * Portal Authentication Middleware
 * 
 * Provides tRPC middleware for portal authentication using the scope resolver.
 * Supports both canonical (portalUsers) and legacy (customerUsers) authentication.
 */

import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { ENV } from "../_core/env";
import { 
  resolvePortalScope, 
  resolvePortalScopeFromLegacy, 
  PortalScope, 
  EMPTY_SCOPE 
} from "./portalScopeResolver";

/**
 * Portal JWT payload structure
 */
export interface PortalJwtPayload {
  // Canonical model
  portalUserId?: number;
  
  // Legacy model
  customerUserId?: number;
  customerId?: number;
  
  // Common fields
  email: string;
  name?: string;
  role?: string;
  
  // JWT standard fields
  iat?: number;
  exp?: number;
}

/**
 * Portal context with resolved scope
 */
export interface PortalContext {
  portalUser: PortalJwtPayload;
  scope: PortalScope;
}

/**
 * Verify portal JWT token and return payload
 */
export function verifyPortalToken(token: string): PortalJwtPayload | null {
  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET) as PortalJwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create portal JWT token
 */
export function createPortalToken(payload: Omit<PortalJwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ENV.JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Extract portal token from request cookies
 */
export function extractPortalToken(cookies: string | undefined): string | null {
  if (!cookies) return null;
  
  const match = cookies.match(/portal_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Resolve portal context from JWT payload
 * Handles both canonical and legacy authentication
 */
export async function resolvePortalContext(payload: PortalJwtPayload): Promise<PortalContext> {
  let scope: PortalScope;
  
  if (payload.portalUserId) {
    // Canonical model - use portalUsers table
    scope = await resolvePortalScope(payload.portalUserId);
  } else if (payload.customerUserId) {
    // Legacy model - use customerUsers table
    scope = await resolvePortalScopeFromLegacy(payload.customerUserId);
  } else {
    // Invalid payload
    scope = EMPTY_SCOPE;
  }
  
  return {
    portalUser: payload,
    scope,
  };
}

/**
 * Authenticate portal request from cookie
 * Returns null if not authenticated
 */
export async function authenticatePortalRequest(
  cookies: string | undefined
): Promise<PortalContext | null> {
  const token = extractPortalToken(cookies);
  if (!token) return null;
  
  const payload = verifyPortalToken(token);
  if (!payload) return null;
  
  return resolvePortalContext(payload);
}

/**
 * Require portal authentication
 * Throws TRPCError if not authenticated
 */
export async function requirePortalAuth(
  cookies: string | undefined
): Promise<PortalContext> {
  const context = await authenticatePortalRequest(cookies);
  
  if (!context) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Portal authentication required",
    });
  }
  
  // Check if scope is valid (has at least one client account)
  if (context.scope.clientAccounts.length === 0 && !context.scope.legacyCustomerId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active client account access",
    });
  }
  
  return context;
}

/**
 * Require specific role for portal access
 */
export async function requirePortalRole(
  cookies: string | undefined,
  requiredRoles: ('CLIENT_ADMIN' | 'FINANCE' | 'OPS' | 'VIEWER')[]
): Promise<PortalContext> {
  const context = await requirePortalAuth(cookies);
  
  const hasRequiredRole = context.scope.clientAccounts.some(
    ca => requiredRoles.includes(ca.role)
  );
  
  if (!hasRequiredRole) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Required role: ${requiredRoles.join(' or ')}`,
    });
  }
  
  return context;
}

/**
 * Require finance access (CLIENT_ADMIN or FINANCE role)
 */
export async function requireFinanceAccess(
  cookies: string | undefined
): Promise<PortalContext> {
  return requirePortalRole(cookies, ['CLIENT_ADMIN', 'FINANCE']);
}

/**
 * Require admin access (CLIENT_ADMIN role)
 */
export async function requireClientAdmin(
  cookies: string | undefined
): Promise<PortalContext> {
  return requirePortalRole(cookies, ['CLIENT_ADMIN']);
}

/**
 * Check if portal user can access a specific project
 */
export function assertProjectAccess(context: PortalContext, projectId: number): void {
  // Check direct project access
  if (context.scope.allowedProjectIds.includes(projectId)) {
    return;
  }
  
  // Check legacy access
  if (context.scope.legacyCustomerId) {
    const legacyGrant = context.scope.grants.find(
      g => g.grantType === 'PROJECT' && g.targetId === projectId
    );
    if (legacyGrant) {
      return;
    }
  }
  
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Access denied to this project",
  });
}

/**
 * Check if portal user can access a specific organization
 */
export function assertOrgAccess(context: PortalContext, orgId: number): void {
  if (!context.scope.allowedOrgIds.includes(orgId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this organization",
    });
  }
}

/**
 * Check if portal user can access a specific site
 */
export function assertSiteAccess(context: PortalContext, siteId: number): void {
  if (!context.scope.allowedSiteIds.includes(siteId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this site",
    });
  }
}

/**
 * Check if portal user can access a specific asset
 */
export function assertAssetAccess(context: PortalContext, assetId: number): void {
  if (!context.scope.allowedAssetIds.includes(assetId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Access denied to this asset",
    });
  }
}
