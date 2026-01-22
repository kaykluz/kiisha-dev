/**
 * Phase 35: Session Hardening
 * 
 * Security enhancements for session management:
 * - HttpOnly, Secure, SameSite cookies
 * - CSRF token generation and validation
 * - Session rotation on privilege escalation
 * - Automatic session revocation
 */

import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "@shared/const";
import * as sessionManager from "../services/sessionManager";
import * as db from "../db";
import { randomBytes } from "crypto";

// Cookie configuration
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// CSRF token cookie name
export const CSRF_COOKIE_NAME = "kiisha_csrf";

/**
 * Set session cookie with hardened options
 */
export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(COOKIE_NAME, sessionId, SESSION_COOKIE_OPTIONS);
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Set CSRF token cookie (readable by JavaScript for inclusion in headers)
 */
export function setCsrfCookie(res: Response, csrfToken: string): void {
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JS
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * CSRF protection middleware
 * Validates CSRF token on state-changing requests
 */
export function csrfProtection() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Skip for public auth endpoints
    const publicPaths = [
      "/api/oauth",
      "/api/trpc/auth.login",
      "/api/trpc/mfa.verify",
    ];
    if (publicPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    // Get session
    const sessionId = req.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return next(); // No session, auth guard will handle
    }

    const session = await db.getSessionById(sessionId);
    if (!session || !session.csrfSecret) {
      return next();
    }

    // Validate CSRF token from header
    const csrfToken = req.headers["x-csrf-token"] as string;
    if (!csrfToken) {
      return res.status(403).json({ 
        error: "CSRF token required",
        code: "CSRF_MISSING",
      });
    }

    if (!sessionManager.validateCsrf(session, csrfToken)) {
      await sessionManager.logAuthEvent({
        eventType: "login_failed",
        userId: session.userId,
        sessionId: session.id,
        success: false,
        failureReason: "invalid_csrf_token",
      });

      return res.status(403).json({ 
        error: "Invalid CSRF token",
        code: "CSRF_INVALID",
      });
    }

    next();
  };
}

/**
 * Session rotation - create new session while preserving state
 * Used after privilege escalation (login, MFA, password change)
 */
export async function rotateSession(
  oldSessionId: string,
  userId: number,
  options: {
    preserveActiveOrg?: boolean;
    preserveMfaState?: boolean;
    ip?: string;
    userAgent?: string;
  } = {}
): Promise<{ sessionId: string; csrfSecret: string; refreshToken: string }> {
  // Get old session state
  const oldSession = await db.getSessionById(oldSessionId);
  
  // Create new session
  const newSession = await sessionManager.createSession({
    userId,
    ip: options.ip,
    userAgent: options.userAgent,
    activeOrganizationId: options.preserveActiveOrg && oldSession?.activeOrganizationId 
      ? oldSession.activeOrganizationId 
      : undefined,
    mfaSatisfied: options.preserveMfaState && oldSession?.mfaSatisfiedAt 
      ? true 
      : false,
  });

  // Revoke old session
  if (oldSession) {
    await sessionManager.revokeSessionById(oldSessionId, userId, "session_rotated");
  }

  // Log rotation
  await sessionManager.logAuthEvent({
    eventType: "session_created",
    userId,
    sessionId: newSession.sessionId,
    success: true,
    details: { 
      reason: "privilege_escalation",
      preservedActiveOrg: options.preserveActiveOrg,
      preservedMfa: options.preserveMfaState,
    },
  });

  return newSession;
}

/**
 * Automatic session cleanup middleware
 * Runs periodically to clean up expired sessions
 */
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

export function sessionCleanup() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    
    // Only run cleanup once per interval
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      lastCleanup = now;
      
      // Run cleanup in background
      db.cleanupExpiredSessions().catch(err => {
        console.error("Session cleanup error:", err);
      });
    }
    
    next();
  };
}

/**
 * IP binding validation
 * Optionally validates that session IP matches request IP
 */
export function ipBindingValidation(strict: boolean = false) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return next();
    }

    const session = await db.getSessionById(sessionId);
    if (!session || !session.ipHash) {
      return next();
    }

    const currentIpHash = sessionManager.hashValue(req.ip || "");
    
    if (session.ipHash !== currentIpHash) {
      if (strict) {
        // Strict mode: reject request
        await sessionManager.logAuthEvent({
          eventType: "session_revoked",
          userId: session.userId,
          sessionId: session.id,
          success: false,
          failureReason: "ip_changed",
        });

        await sessionManager.revokeSessionById(sessionId, session.userId, "ip_mismatch");
        clearSessionCookie(res);

        return res.status(401).json({
          error: "Session invalidated due to IP change",
          code: "IP_MISMATCH",
        });
      } else {
        // Non-strict mode: log but allow
        await sessionManager.logAuthEvent({
          eventType: "session_created",
          userId: session.userId,
          sessionId: session.id,
          success: true,
          details: { action: "ip_changed_warning" },
        });
      }
    }

    next();
  };
}

/**
 * User agent binding validation
 * Validates that session user agent matches request user agent
 */
export function userAgentValidation() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.cookies?.[COOKIE_NAME];
    if (!sessionId) {
      return next();
    }

    const session = await db.getSessionById(sessionId);
    if (!session || !session.userAgentHash) {
      return next();
    }

    const currentUaHash = sessionManager.hashValue(req.headers["user-agent"] || "");
    
    if (session.userAgentHash !== currentUaHash) {
      // Log but don't reject (user agents can change slightly)
      await sessionManager.logAuthEvent({
        eventType: "session_created",
        userId: session.userId,
        sessionId: session.id,
        success: true,
        details: { action: "ua_changed_warning" },
      });
    }

    next();
  };
}

/**
 * Concurrent session limit enforcement
 */
const MAX_CONCURRENT_SESSIONS = 5;

export async function enforceSessionLimit(userId: number): Promise<void> {
  const sessions = await sessionManager.getUserSessions(userId);
  
  if (sessions.length >= MAX_CONCURRENT_SESSIONS) {
    // Revoke oldest sessions
    const sessionsToRevoke = sessions
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, sessions.length - MAX_CONCURRENT_SESSIONS + 1);
    
    for (const session of sessionsToRevoke) {
      await sessionManager.revokeSessionById(session.id, userId, "session_limit_exceeded");
    }
  }
}
