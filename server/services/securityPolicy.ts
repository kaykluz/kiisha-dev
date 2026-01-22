/**
 * Security Policy Enforcement Service
 * 
 * Enforces organization-level security policies:
 * - 2FA requirements
 * - Session timeout
 * - IP restrictions
 * - Password policies
 * 
 * Policies are stored per-organization and checked on every protected request.
 */

import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { organizations, organizationMembers, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Security policy types
export interface SecurityPolicy {
  // 2FA settings
  require2FA: boolean;
  enforce2FAForRoles: string[]; // e.g., ["admin", "editor"]
  
  // Session settings
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  
  // IP restrictions
  enableIPRestrictions: boolean;
  allowedIPRanges: string[];
  
  // Password settings
  minPasswordLength: number;
  requirePasswordChange: boolean;
  passwordChangeIntervalDays: number;
  
  // Login settings
  maxFailedLoginAttempts: number;
  lockoutDurationMinutes: number;
  
  // Data access settings
  requireApprovalForExport: boolean;
  allowBulkDownload: boolean;
}

// Default security policy
export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  require2FA: false,
  enforce2FAForRoles: [],
  sessionTimeoutMinutes: 480, // 8 hours
  maxConcurrentSessions: 5,
  enableIPRestrictions: false,
  allowedIPRanges: [],
  minPasswordLength: 8,
  requirePasswordChange: false,
  passwordChangeIntervalDays: 90,
  maxFailedLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  requireApprovalForExport: false,
  allowBulkDownload: true,
};

// Policy violation types
export type PolicyViolationType = 
  | "2fa_required"
  | "session_expired"
  | "ip_not_allowed"
  | "password_change_required"
  | "account_locked"
  | "max_sessions_exceeded";

export interface PolicyViolation {
  type: PolicyViolationType;
  message: string;
  action: "block" | "warn" | "redirect";
  redirectUrl?: string;
}

/**
 * Get security policy for an organization
 */
export async function getSecurityPolicy(organizationId: number): Promise<SecurityPolicy> {
  const database = await getDb();
  if (!database) {
    return DEFAULT_SECURITY_POLICY;
  }
  
  const [org] = await database
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  
  if (!org) {
    return DEFAULT_SECURITY_POLICY;
  }
  
  // Parse stored policy or use defaults
  const storedPolicy = org.securitySettings as Partial<SecurityPolicy> | null;
  
  return {
    ...DEFAULT_SECURITY_POLICY,
    ...storedPolicy,
  };
}

/**
 * Update security policy for an organization
 */
export async function updateSecurityPolicy(
  organizationId: number,
  policy: Partial<SecurityPolicy>,
  updatedBy: number
): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  // Get current policy
  const currentPolicy = await getSecurityPolicy(organizationId);
  
  // Merge with new settings
  const newPolicy = {
    ...currentPolicy,
    ...policy,
  };
  
  // Update organization
  await database
    .update(organizations)
    .set({
      securitySettings: newPolicy,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
  
  // Log the change
  await database.insert(auditLogs).values({
    userId: updatedBy,
    organizationId,
    action: "security_policy_updated",
    resourceType: "organization",
    resourceId: organizationId,
    details: {
      previousPolicy: currentPolicy,
      newPolicy,
      changedFields: Object.keys(policy),
    },
    ipAddress: null,
    userAgent: null,
  });
}

/**
 * Check if a user meets the security policy requirements
 * Returns violations if any, or empty array if compliant
 */
export async function checkSecurityPolicy(
  userId: number,
  organizationId: number,
  context: {
    ipAddress?: string;
    sessionStartTime?: Date;
    userRole?: string;
  }
): Promise<PolicyViolation[]> {
  const violations: PolicyViolation[] = [];
  const policy = await getSecurityPolicy(organizationId);
  
  const database = await getDb();
  if (!database) return violations;
  
  // Get user details
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) {
    return violations;
  }
  
  // Check 2FA requirement
  if (policy.require2FA || (context.userRole && policy.enforce2FAForRoles.includes(context.userRole))) {
    const has2FA = user.twoFactorEnabled || false;
    if (!has2FA) {
      violations.push({
        type: "2fa_required",
        message: "Two-factor authentication is required for your organization",
        action: "redirect",
        redirectUrl: "/settings/security",
      });
    }
  }
  
  // Check session timeout
  if (context.sessionStartTime) {
    const sessionAge = Date.now() - context.sessionStartTime.getTime();
    const maxAge = policy.sessionTimeoutMinutes * 60 * 1000;
    
    if (sessionAge > maxAge) {
      violations.push({
        type: "session_expired",
        message: "Your session has expired. Please log in again.",
        action: "redirect",
        redirectUrl: "/login",
      });
    }
  }
  
  // Check IP restrictions
  if (policy.enableIPRestrictions && context.ipAddress && policy.allowedIPRanges.length > 0) {
    const isAllowed = isIPAllowed(context.ipAddress, policy.allowedIPRanges);
    if (!isAllowed) {
      violations.push({
        type: "ip_not_allowed",
        message: "Access from your IP address is not allowed",
        action: "block",
      });
    }
  }
  
  // Check password change requirement
  if (policy.requirePasswordChange && user.passwordLastChanged) {
    const daysSinceChange = Math.floor(
      (Date.now() - new Date(user.passwordLastChanged).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceChange > policy.passwordChangeIntervalDays) {
      violations.push({
        type: "password_change_required",
        message: `Your password must be changed every ${policy.passwordChangeIntervalDays} days`,
        action: "redirect",
        redirectUrl: "/settings/security",
      });
    }
  }
  
  // Check account lockout
  if (user.failedLoginAttempts && user.failedLoginAttempts >= policy.maxFailedLoginAttempts) {
    const lockoutEnd = user.lockedUntil;
    if (lockoutEnd && new Date(lockoutEnd) > new Date()) {
      violations.push({
        type: "account_locked",
        message: "Your account is temporarily locked due to too many failed login attempts",
        action: "block",
      });
    }
  }
  
  return violations;
}

/**
 * Check if an IP address is in the allowed ranges
 */
function isIPAllowed(ip: string, allowedRanges: string[]): boolean {
  // Handle empty ranges (allow all)
  if (allowedRanges.length === 0) return true;
  
  for (const range of allowedRanges) {
    if (range.includes("/")) {
      // CIDR notation
      if (isIPInCIDR(ip, range)) return true;
    } else if (range.includes("-")) {
      // IP range notation (e.g., 192.168.1.1-192.168.1.255)
      if (isIPInRange(ip, range)) return true;
    } else {
      // Single IP
      if (ip === range) return true;
    }
  }
  
  return false;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split("/");
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);
  
  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IP is in range
 */
function isIPInRange(ip: string, range: string): boolean {
  const [start, end] = range.split("-");
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);
  
  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * Convert IP string to number
 */
function ipToNumber(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(userId: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, userId));
  
  if (!user) return;
  
  const newAttempts = (user.failedLoginAttempts || 0) + 1;
  
  // Get user's org policy for lockout duration
  const [membership] = await database
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  
  let lockoutUntil: Date | null = null;
  
  if (membership) {
    const policy = await getSecurityPolicy(membership.organizationId);
    
    if (newAttempts >= policy.maxFailedLoginAttempts) {
      lockoutUntil = new Date(Date.now() + policy.lockoutDurationMinutes * 60 * 1000);
    }
  }
  
  await database
    .update(users)
    .set({
      failedLoginAttempts: newAttempts,
      lockedUntil: lockoutUntil,
    })
    .where(eq(users.id, userId));
}

/**
 * Clear failed login attempts on successful login
 */
export async function clearFailedLogins(userId: number): Promise<void> {
  const database = await getDb();
  if (!database) return;
  
  await database
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, userId));
}

/**
 * Create tRPC middleware for security policy enforcement
 */
export function createSecurityPolicyMiddleware() {
  return async (opts: {
    ctx: {
      user?: { id: number; role?: string };
      organizationId?: number;
      req?: { ip?: string; headers?: Record<string, string> };
      sessionStartTime?: Date;
    };
    next: () => Promise<any>;
  }) => {
    const { ctx, next } = opts;
    
    // Skip if no user or org context
    if (!ctx.user?.id || !ctx.organizationId) {
      return next();
    }
    
    // Check security policy
    const violations = await checkSecurityPolicy(
      ctx.user.id,
      ctx.organizationId,
      {
        ipAddress: ctx.req?.ip || ctx.req?.headers?.["x-forwarded-for"]?.split(",")[0],
        sessionStartTime: ctx.sessionStartTime,
        userRole: ctx.user.role,
      }
    );
    
    // Handle violations
    const blockingViolation = violations.find(v => v.action === "block");
    if (blockingViolation) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: blockingViolation.message,
      });
    }
    
    // For redirect violations, we'll include them in the response context
    // The client can handle the redirect
    const redirectViolation = violations.find(v => v.action === "redirect");
    
    // Continue with the request, but include violation info
    const result = await next();
    
    // If there's a redirect violation, include it in the response
    if (redirectViolation && typeof result === "object" && result !== null) {
      return {
        ...result,
        _securityViolation: redirectViolation,
      };
    }
    
    return result;
  };
}

/**
 * Validate password against policy
 */
export function validatePassword(
  password: string,
  policy: SecurityPolicy
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < policy.minPasswordLength) {
    errors.push(`Password must be at least ${policy.minPasswordLength} characters`);
  }
  
  // Additional password requirements could be added here:
  // - Uppercase letters
  // - Lowercase letters
  // - Numbers
  // - Special characters
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
