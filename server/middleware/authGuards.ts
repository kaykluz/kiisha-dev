/**
 * Phase 35: Auth Route Guards
 * 
 * Middleware for enforcing authentication requirements:
 * - Auth-first policy (no org data before auth)
 * - MFA gate (redirect to /2fa if required)
 * - Workspace gate (redirect to /select-workspace if needed)
 */

import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "@shared/const";
import * as sessionManager from "../services/sessionManager";
import * as db from "../db";

// Routes that don't require authentication
const AUTH_ALLOWLIST = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/2fa",
  "/select-workspace",
  "/pending-access",
  "/api/oauth",
  "/api/trpc/auth.getSession",
  "/api/trpc/auth.login",
  "/api/trpc/mfa.verify",
  "/api/trpc/authSession.getSession",
  "/api/trpc/authSession.listWorkspaces",
  "/api/trpc/authSession.selectWorkspace",
  "/api/trpc/authSession.logout",
  "/api/health",
  "/favicon.ico",
  "/robots.txt",
];

// Routes that require auth but not workspace selection
const NO_WORKSPACE_REQUIRED = [
  "/select-workspace",
  "/pending-access",
  "/api/trpc/authSession.listWorkspaces",
  "/api/trpc/authSession.selectWorkspace",
  "/api/trpc/workspace.listMemberships",
  "/api/trpc/workspace.setActive",
];

// Routes that require auth but not MFA
const NO_MFA_REQUIRED = [
  "/2fa",
  "/api/trpc/mfa.verify",
  "/api/trpc/mfa.getStatus",
];

/**
 * Check if a path matches any pattern in the list
 */
function matchesPath(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.endsWith("*")) {
      return path.startsWith(pattern.slice(0, -1));
    }
    return path === pattern || path.startsWith(pattern + "?") || path.startsWith(pattern + "/");
  });
}

export interface AuthState {
  authenticated: boolean;
  mfaRequired: boolean;
  mfaSatisfied: boolean;
  workspaceRequired: boolean;
  userId?: number;
  activeOrganizationId?: number;
  sessionId?: string;
}

/**
 * Get current auth state from request
 */
export async function getAuthState(req: Request): Promise<AuthState> {
  const sessionId = req.cookies?.[COOKIE_NAME];
  
  if (!sessionId) {
    return {
      authenticated: false,
      mfaRequired: false,
      mfaSatisfied: false,
      workspaceRequired: false,
    };
  }

  const validation = await sessionManager.validateSession(sessionId);
  if (!validation.valid || !validation.session) {
    return {
      authenticated: false,
      mfaRequired: false,
      mfaSatisfied: false,
      workspaceRequired: false,
    };
  }

  const session = validation.session;
  const mfaRequired = await sessionManager.sessionRequiresMfa(session);
  const mfaSatisfied = !!session.mfaSatisfiedAt;

  // Get workspace count
  const memberships = await db.getOrganizationMemberships(session.userId);
  const activeMembers = memberships.filter(m => m.status === "active");
  const workspaceCount = activeMembers.length;
  const workspaceRequired = !session.activeOrganizationId && workspaceCount > 1;

  return {
    authenticated: true,
    mfaRequired,
    mfaSatisfied: mfaRequired ? mfaSatisfied : true,
    workspaceRequired,
    userId: session.userId,
    activeOrganizationId: session.activeOrganizationId ?? undefined,
    sessionId,
  };
}

/**
 * Global auth guard middleware
 * Enforces auth-first policy for all routes
 */
export function authGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // Allow static assets
    if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return next();
    }

    // Allow routes in allowlist
    if (matchesPath(path, AUTH_ALLOWLIST)) {
      return next();
    }

    // Get auth state
    const authState = await getAuthState(req);

    // Not authenticated - redirect to login
    if (!authState.authenticated) {
      if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      // Store intended destination for redirect after login
      const returnUrl = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login?returnUrl=${returnUrl}`);
    }

    // Attach auth state to request for downstream use
    (req as any).authState = authState;

    // Check MFA requirement
    if (authState.mfaRequired && !authState.mfaSatisfied) {
      if (!matchesPath(path, NO_MFA_REQUIRED)) {
        if (req.path.startsWith("/api/")) {
          return res.status(403).json({ error: "MFA verification required", code: "MFA_REQUIRED" });
        }
        return res.redirect("/2fa");
      }
    }

    // Check workspace requirement
    if (authState.workspaceRequired) {
      if (!matchesPath(path, NO_WORKSPACE_REQUIRED)) {
        if (req.path.startsWith("/api/")) {
          return res.status(403).json({ error: "Workspace selection required", code: "WORKSPACE_REQUIRED" });
        }
        return res.redirect("/select-workspace");
      }
    }

    next();
  };
}

/**
 * Require specific organization membership
 */
export async function requireOrgMembership(userId: number, organizationId: number): Promise<boolean> {
  const memberships = await db.getOrganizationMemberships(userId);
  const membership = memberships.find(m => m.organizationId === organizationId);
  return membership?.status === "active";
}

/**
 * Require specific role in organization
 */
export async function requireOrgRole(
  userId: number, 
  organizationId: number, 
  allowedRoles: string[]
): Promise<boolean> {
  const memberships = await db.getOrganizationMemberships(userId);
  const membership = memberships.find(m => m.organizationId === organizationId);
  
  if (!membership || membership.status !== "active") {
    return false;
  }
  
  return allowedRoles.includes(membership.role);
}

/**
 * Verify resource belongs to user's active organization
 */
export async function verifyResourceOrg(
  resourceOrgId: number | null | undefined,
  activeOrgId: number | null | undefined
): Promise<boolean> {
  if (!resourceOrgId || !activeOrgId) {
    return false;
  }
  return resourceOrgId === activeOrgId;
}

/**
 * CSRF protection middleware
 */
export function csrfProtection() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip for GET, HEAD, OPTIONS
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Skip for allowlisted routes
    if (matchesPath(req.path, AUTH_ALLOWLIST)) {
      return next();
    }

    const sessionId = req.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return next(); // No session, auth guard will handle
    }

    const session = await db.getSessionById(sessionId);
    if (!session) {
      return next();
    }

    // Check CSRF token
    const csrfToken = req.headers["x-csrf-token"] as string;
    if (!csrfToken || !sessionManager.validateCsrf(session, csrfToken)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    next();
  };
}

/**
 * Rate limiting for auth endpoints
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function loginRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `login:${ip}`;
    
    const now = Date.now();
    const attempt = loginAttempts.get(key);
    
    if (attempt) {
      if (now > attempt.resetAt) {
        // Window expired, reset
        loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      } else if (attempt.count >= MAX_ATTEMPTS) {
        const retryAfter = Math.ceil((attempt.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());
        return res.status(429).json({ 
          error: "Too many login attempts", 
          retryAfterSeconds: retryAfter 
        });
      } else {
        attempt.count++;
      }
    } else {
      loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    }
    
    next();
  };
}

/**
 * Clear rate limit on successful login
 */
export function clearLoginRateLimit(ip: string): void {
  loginAttempts.delete(`login:${ip}`);
}
