/**
 * Tenant Routing Middleware
 * 
 * Handles subdomain-based organization routing:
 * - {tenant}.kiisha.io -> resolves to specific org
 * - app.kiisha.io -> generic lobby/login
 * - localhost:3000 -> development mode (uses header or session)
 */

import type { Request, Response, NextFunction } from "express";
import * as db from "../db";

// Known non-tenant subdomains
const RESERVED_SUBDOMAINS = new Set([
  "app", "www", "api", "admin", "support", "help", "docs", "status",
  "mail", "email", "smtp", "imap", "pop", "ftp", "sftp",
  "cdn", "static", "assets", "media", "images",
  "dev", "staging", "test", "qa", "demo",
]);

// Header for explicit org override (used in development)
const ORG_HEADER = "x-kiisha-org";
const ORG_SLUG_HEADER = "x-kiisha-org-slug";

export interface TenantContext {
  orgId?: number;
  orgSlug?: string;
  isLobby: boolean;
  isDevelopment: boolean;
}

/**
 * Extract tenant context from request
 */
export async function extractTenantContext(req: Request): Promise<TenantContext> {
  const host = req.hostname || req.headers.host || "";
  const isDevelopment = host.includes("localhost") || host.includes("127.0.0.1") || host.includes(".manus.computer");
  
  // Check for explicit header override (development only)
  if (isDevelopment) {
    const orgIdHeader = req.headers[ORG_HEADER] as string | undefined;
    const orgSlugHeader = req.headers[ORG_SLUG_HEADER] as string | undefined;
    
    if (orgIdHeader) {
      const orgId = parseInt(orgIdHeader, 10);
      if (!isNaN(orgId)) {
        return { orgId, isLobby: false, isDevelopment: true };
      }
    }
    
    if (orgSlugHeader) {
      const org = await db.getOrganizationBySlug(orgSlugHeader);
      if (org) {
        return { orgId: org.id, orgSlug: orgSlugHeader, isLobby: false, isDevelopment: true };
      }
    }
    
    // Development mode without explicit org - treat as lobby
    return { isLobby: true, isDevelopment: true };
  }
  
  // Production: Extract subdomain from host
  // Expected format: {tenant}.kiisha.io or {tenant}.kiisha.com
  const parts = host.split(".");
  
  // Need at least 3 parts for subdomain: tenant.kiisha.io
  if (parts.length < 3) {
    return { isLobby: true, isDevelopment: false };
  }
  
  const subdomain = parts[0].toLowerCase();
  
  // Check if reserved subdomain
  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return { isLobby: subdomain === "app", isDevelopment: false };
  }
  
  // Try to resolve org by slug
  const org = await db.getOrganizationBySlug(subdomain);
  if (org) {
    return { orgId: org.id, orgSlug: subdomain, isLobby: false, isDevelopment: false };
  }
  
  // Unknown subdomain - could be typo or old slug
  // Return lobby but preserve the attempted slug for error messaging
  return { orgSlug: subdomain, isLobby: true, isDevelopment: false };
}

/**
 * Express middleware to attach tenant context to request
 */
export function tenantRoutingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantContext = await extractTenantContext(req);
      
      // Attach to request for downstream use
      (req as any).tenantContext = tenantContext;
      
      // Set response headers for debugging (development only)
      if (tenantContext.isDevelopment) {
        res.setHeader("X-Kiisha-Tenant-Org", tenantContext.orgId?.toString() || "lobby");
        res.setHeader("X-Kiisha-Tenant-Slug", tenantContext.orgSlug || "none");
      }
      
      next();
    } catch (error) {
      console.error("[TenantRouting] Error:", error);
      next();
    }
  };
}

/**
 * Get tenant context from request (after middleware has run)
 */
export function getTenantContext(req: Request): TenantContext {
  return (req as any).tenantContext || { isLobby: true, isDevelopment: false };
}

/**
 * Build redirect URL for org-specific subdomain
 */
export function buildOrgUrl(orgSlug: string, path: string = "/"): string {
  const baseHost = process.env.KIISHA_BASE_HOST || "kiisha.io";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${orgSlug}.${baseHost}${path}`;
}

/**
 * Build redirect URL for lobby
 */
export function buildLobbyUrl(path: string = "/"): string {
  const baseHost = process.env.KIISHA_BASE_HOST || "kiisha.io";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://app.${baseHost}${path}`;
}
