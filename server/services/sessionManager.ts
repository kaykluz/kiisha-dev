/**
 * Phase 35: Session Management Service
 * 
 * Centralized service for server-side session management with:
 * - Secure session creation with cryptographic tokens
 * - Session validation with expiry and revocation checks
 * - MFA state tracking
 * - Workspace context management
 * - Audit logging
 */

import { randomBytes, createHash } from "crypto";
import * as db from "../db";
import type { InsertServerSession, ServerSession, InsertAuthAuditLog } from "../../drizzle/schema";

// Session configuration
const SESSION_ID_LENGTH = 32; // 256 bits
const CSRF_SECRET_LENGTH = 32;
const REFRESH_TOKEN_LENGTH = 32;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(SESSION_ID_LENGTH).toString("hex");
}

/**
 * Generate a CSRF secret for the session
 */
export function generateCsrfSecret(): string {
  return randomBytes(CSRF_SECRET_LENGTH).toString("hex");
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_LENGTH).toString("hex");
}

/**
 * Hash a value for storage (IP, user agent, refresh token)
 */
export function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Parse user agent to extract device info
 */
export function parseUserAgent(userAgent: string): { deviceType: string; browserName: string; osName: string } {
  const ua = userAgent.toLowerCase();
  
  // Device type
  let deviceType = "desktop";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }
  
  // Browser
  let browserName = "unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browserName = "Chrome";
  else if (ua.includes("firefox")) browserName = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browserName = "Safari";
  else if (ua.includes("edg")) browserName = "Edge";
  else if (ua.includes("opera") || ua.includes("opr")) browserName = "Opera";
  
  // OS
  let osName = "unknown";
  if (ua.includes("windows")) osName = "Windows";
  else if (ua.includes("mac os")) osName = "macOS";
  else if (ua.includes("linux")) osName = "Linux";
  else if (ua.includes("android")) osName = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) osName = "iOS";
  
  return { deviceType, browserName, osName };
}

export interface CreateSessionOptions {
  userId: number;
  ip?: string;
  userAgent?: string;
  activeOrganizationId?: number;
  mfaSatisfied?: boolean;
}

export interface SessionValidationResult {
  valid: boolean;
  session?: ServerSession;
  reason?: "not_found" | "expired" | "revoked" | "idle_timeout";
}

/**
 * Create a new server session
 */
export async function createSession(options: CreateSessionOptions): Promise<{
  sessionId: string;
  csrfSecret: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const sessionId = generateSessionId();
  const csrfSecret = generateCsrfSecret();
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_LIFETIME_MS);
  
  const deviceInfo = options.userAgent ? parseUserAgent(options.userAgent) : {
    deviceType: null,
    browserName: null,
    osName: null
  };
  
  const session: InsertServerSession = {
    id: sessionId,
    userId: options.userId,
    expiresAt,
    ipHash: options.ip ? hashValue(options.ip) : null,
    userAgentHash: options.userAgent ? hashValue(options.userAgent) : null,
    csrfSecret,
    refreshTokenHash: hashValue(refreshToken),
    activeOrganizationId: options.activeOrganizationId ?? null,
    mfaSatisfiedAt: options.mfaSatisfied ? new Date() : null,
    deviceType: deviceInfo.deviceType,
    browserName: deviceInfo.browserName,
    osName: deviceInfo.osName,
  };
  
  await db.createServerSession(session);
  
  // Log session creation
  await logAuthEvent({
    eventType: "session_created",
    userId: options.userId,
    sessionId,
    organizationId: options.activeOrganizationId,
    ipHash: session.ipHash,
    userAgentHash: session.userAgentHash,
    success: true,
    details: { deviceType: deviceInfo.deviceType }
  });
  
  return { sessionId, csrfSecret, refreshToken, expiresAt };
}

/**
 * Validate a session
 */
export async function validateSession(sessionId: string): Promise<SessionValidationResult> {
  const session = await db.getSessionById(sessionId);
  
  if (!session) {
    return { valid: false, reason: "not_found" };
  }
  
  if (session.revokedAt) {
    return { valid: false, reason: "revoked" };
  }
  
  if (session.expiresAt < new Date()) {
    return { valid: false, reason: "expired" };
  }
  
  // Check idle timeout
  const idleTime = Date.now() - session.lastSeenAt.getTime();
  if (idleTime > SESSION_IDLE_TIMEOUT_MS) {
    // Auto-revoke idle session
    await db.revokeSession(sessionId, "idle_timeout");
    await logAuthEvent({
      eventType: "session_expired",
      userId: session.userId,
      sessionId,
      success: true,
      details: { reason: "idle_timeout", idleMinutes: Math.floor(idleTime / 60000) }
    });
    return { valid: false, reason: "idle_timeout" };
  }
  
  // Touch session to update lastSeenAt
  await db.touchSession(sessionId);
  
  return { valid: true, session };
}

/**
 * Validate CSRF token
 */
export function validateCsrf(session: ServerSession, providedToken: string): boolean {
  if (!session.csrfSecret || !providedToken) {
    return false;
  }
  // Simple comparison - in production, use timing-safe comparison
  return session.csrfSecret === providedToken;
}

/**
 * Check if session requires MFA
 */
export async function sessionRequiresMfa(session: ServerSession): Promise<boolean> {
  // If MFA already satisfied, no need to check again
  if (session.mfaSatisfiedAt) {
    return false;
  }
  
  // Check if user requires MFA
  return db.userRequiresMfa(session.userId, session.activeOrganizationId ?? undefined);
}

/**
 * Mark MFA as satisfied for session
 */
export async function satisfyMfa(sessionId: string, userId: number): Promise<void> {
  await db.markSessionMfaSatisfied(sessionId);
  
  await logAuthEvent({
    eventType: "mfa_verified",
    userId,
    sessionId,
    success: true
  });
}

/**
 * Update session's active organization
 */
export async function setActiveOrganization(sessionId: string, userId: number, organizationId: number): Promise<void> {
  await db.updateSessionActiveOrg(sessionId, organizationId);
  
  // Also update user's last context
  await db.updateUserLastContext(userId, { lastOrganizationId: organizationId });
  
  await logAuthEvent({
    eventType: "workspace_selected",
    userId,
    sessionId,
    organizationId,
    success: true
  });
}

/**
 * Revoke a session (logout)
 */
export async function revokeSessionById(sessionId: string, userId: number, reason: string = "logout"): Promise<void> {
  await db.revokeSession(sessionId, reason);
  
  await logAuthEvent({
    eventType: reason === "logout" ? "logout" : "session_revoked",
    userId,
    sessionId,
    success: true,
    details: { reason }
  });
}

/**
 * Revoke all sessions for a user (e.g., on password change)
 */
export async function revokeAllSessions(userId: number, reason: string, exceptSessionId?: string): Promise<number> {
  const count = await db.revokeAllServerSessions(userId, reason, undefined, exceptSessionId);
  
  await logAuthEvent({
    eventType: "session_revoked",
    userId,
    success: true,
    details: { reason, count, exceptCurrent: !!exceptSessionId }
  });
  
  return count;
}

/**
 * Get all active sessions for a user (for session management UI)
 */
export async function getUserSessions(userId: number): Promise<ServerSession[]> {
  return db.getUserActiveSessions(userId);
}

// ============ LOGIN RATE LIMITING ============

/**
 * Check if login is allowed (not rate limited)
 */
export async function checkLoginAllowed(email: string, ip: string): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  const emailHash = hashValue(email.toLowerCase());
  const ipHash = hashValue(ip);
  
  // Check if locked
  const isLocked = await db.isLoginLocked(emailHash, ipHash);
  if (isLocked) {
    return { allowed: false, retryAfterMinutes: LOCKOUT_DURATION_MINUTES };
  }
  
  // Check recent failures
  const recentFailures = await db.getRecentFailedAttempts(emailHash, ipHash, 15);
  if (recentFailures >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    await db.lockLogin(emailHash, ipHash, LOCKOUT_DURATION_MINUTES);
    return { allowed: false, retryAfterMinutes: LOCKOUT_DURATION_MINUTES };
  }
  
  return { allowed: true };
}

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  const emailHash = hashValue(email.toLowerCase());
  const ipHash = hashValue(ip);
  
  await db.recordLoginAttempt(emailHash, ipHash, success);
  
  if (success) {
    // Clear any locks on successful login
    await db.clearLoginLock(emailHash);
  }
}

// ============ AUTH AUDIT LOGGING ============

/**
 * Log an authentication event
 */
export async function logAuthEvent(event: Omit<InsertAuthAuditLog, "createdAt">): Promise<void> {
  await db.logAuthEvent(event as InsertAuthAuditLog);
}

/**
 * Get auth events for a user
 */
export async function getUserAuthEvents(userId: number, limit: number = 50) {
  return db.getUserAuthEvents(userId, limit);
}

/**
 * Get auth events for an organization
 */
export async function getOrgAuthEvents(organizationId: number, limit: number = 100) {
  return db.getOrgAuthEvents(organizationId, limit);
}
