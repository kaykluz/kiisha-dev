/**
 * Capability Registry Service
 * 
 * Manages OpenClaw capabilities, access control, and approval workflows.
 * 
 * Architecture principle: "OpenClaw executes. KIISHA authorizes."
 * 
 * Capabilities are organized by risk level:
 * - Low: No approval required (queries, read-only operations)
 * - Medium: May require approval based on org policy
 * - High: Requires approval and/or admin permission
 * - Critical: Requires 2FA and admin approval
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { v4 as uuidv4 } from "uuid";

// Capability risk levels
export type RiskLevel = "low" | "medium" | "high" | "critical";

// Capability categories
export type CapabilityCategory = 
  | "channel" 
  | "query" 
  | "document" 
  | "operation" 
  | "browser" 
  | "skill" 
  | "cron" 
  | "payment";

// Capability access check result
export interface CapabilityAccessResult {
  allowed: boolean;
  requiresApproval: boolean;
  requires2FA: boolean;
  requiresAdmin: boolean;
  reason?: string;
  dailyUsageRemaining?: number;
  monthlyUsageRemaining?: number;
}

// Approval request input
export interface ApprovalRequestInput {
  organizationId: number;
  requestedBy: number;
  capabilityId: string;
  channelType?: string;
  channelIdentityId?: number;
  taskSpec: {
    taskType: string;
    task: Record<string, unknown>;
    constraints?: Record<string, unknown>;
  };
  summary: string;
}

// Approval request result
export interface ApprovalRequestResult {
  requestId: string;
  status: "pending" | "auto_approved";
  expiresAt?: string;
}

/**
 * Check if a user has access to a capability
 */
export async function checkCapabilityAccess(
  organizationId: number,
  userId: number,
  capabilityId: string
): Promise<CapabilityAccessResult> {
  // Get capability definition
  const [capability] = await sdk.db
    .select()
    .from(db.capabilityRegistry)
    .where(eq(db.capabilityRegistry.capabilityId, capabilityId))
    .limit(1);
  
  if (!capability) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: false,
      reason: "Capability not found",
    };
  }
  
  if (!capability.isActive) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: false,
      reason: "Capability is disabled system-wide",
    };
  }
  
  // Get org-specific capability settings
  const [orgCapability] = await sdk.db
    .select()
    .from(db.orgCapabilities)
    .where(and(
      eq(db.orgCapabilities.organizationId, organizationId),
      eq(db.orgCapabilities.capabilityId, capabilityId)
    ))
    .limit(1);
  
  // Check if capability is enabled for org
  if (!orgCapability?.enabled) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: false,
      reason: "Capability not enabled for your organization",
    };
  }
  
  // Check daily usage limit
  if (orgCapability.dailyLimit && orgCapability.currentDailyUsage >= orgCapability.dailyLimit) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: false,
      reason: "Daily usage limit exceeded",
      dailyUsageRemaining: 0,
    };
  }
  
  // Check monthly usage limit
  if (orgCapability.monthlyLimit && orgCapability.currentMonthlyUsage >= orgCapability.monthlyLimit) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: false,
      reason: "Monthly usage limit exceeded",
      monthlyUsageRemaining: 0,
    };
  }
  
  // Get org security policy
  const [securityPolicy] = await sdk.db
    .select()
    .from(db.openclawSecurityPolicies)
    .where(eq(db.openclawSecurityPolicies.organizationId, organizationId))
    .limit(1);
  
  // Check time-based restrictions
  if (securityPolicy?.allowedHours) {
    const allowedHours = securityPolicy.allowedHours as {
      start: string;
      end: string;
      timezone: string;
      daysOfWeek: number[];
    };
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    const [startHour] = allowedHours.start.split(":").map(Number);
    const [endHour] = allowedHours.end.split(":").map(Number);
    
    const isWithinHours = currentHour >= startHour && currentHour < endHour;
    const isAllowedDay = allowedHours.daysOfWeek.includes(currentDay);
    
    if (!isWithinHours || !isAllowedDay) {
      return {
        allowed: false,
        requiresApproval: false,
        requires2FA: false,
        requiresAdmin: false,
        reason: `This capability is only available during allowed hours (${allowedHours.start}-${allowedHours.end})`,
      };
    }
  }
  
  // Determine approval requirements
  let requiresApproval = capability.requiresApproval;
  
  if (orgCapability.approvalPolicy === "always") {
    requiresApproval = true;
  } else if (orgCapability.approvalPolicy === "never") {
    requiresApproval = false;
  }
  
  // Check if user is admin (admins may bypass some requirements)
  const [membership] = await sdk.db
    .select()
    .from(db.organizationMembers)
    .where(and(
      eq(db.organizationMembers.userId, userId),
      eq(db.organizationMembers.organizationId, organizationId),
      eq(db.organizationMembers.status, "active")
    ))
    .limit(1);
  
  const isAdmin = membership?.role === "admin";
  
  // Admin requirement check
  if (capability.requiresAdmin && !isAdmin) {
    return {
      allowed: false,
      requiresApproval: false,
      requires2FA: false,
      requiresAdmin: true,
      reason: "This capability requires admin privileges",
    };
  }
  
  // Calculate remaining usage
  const dailyUsageRemaining = orgCapability.dailyLimit 
    ? orgCapability.dailyLimit - (orgCapability.currentDailyUsage || 0)
    : undefined;
  const monthlyUsageRemaining = orgCapability.monthlyLimit
    ? orgCapability.monthlyLimit - (orgCapability.currentMonthlyUsage || 0)
    : undefined;
  
  return {
    allowed: true,
    requiresApproval,
    requires2FA: capability.requires2FA,
    requiresAdmin: capability.requiresAdmin,
    dailyUsageRemaining,
    monthlyUsageRemaining,
  };
}

/**
 * Create an approval request for a capability
 */
export async function createApprovalRequest(
  input: ApprovalRequestInput
): Promise<ApprovalRequestResult> {
  const requestId = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  // Get capability for risk assessment
  const [capability] = await sdk.db
    .select()
    .from(db.capabilityRegistry)
    .where(eq(db.capabilityRegistry.capabilityId, input.capabilityId))
    .limit(1);
  
  // Build risk assessment
  const riskAssessment = {
    level: capability?.riskLevel || "medium",
    factors: [] as string[],
    dataAccessed: [] as string[],
    potentialImpact: "",
  };
  
  if (capability?.riskLevel === "high" || capability?.riskLevel === "critical") {
    riskAssessment.factors.push("High-risk capability");
  }
  
  if (input.taskSpec.taskType === "browser") {
    riskAssessment.factors.push("Browser automation involved");
  }
  
  if (input.taskSpec.taskType === "payment") {
    riskAssessment.factors.push("Financial transaction");
    riskAssessment.potentialImpact = "May result in financial charges";
  }
  
  // Create the approval request
  await sdk.db.insert(db.approvalRequests).values({
    requestId,
    organizationId: input.organizationId,
    requestedBy: input.requestedBy,
    channelType: input.channelType as any,
    channelIdentityId: input.channelIdentityId,
    capabilityId: input.capabilityId,
    taskSpec: JSON.stringify(input.taskSpec),
    summary: input.summary,
    riskAssessment: JSON.stringify(riskAssessment),
    status: "pending",
    expiresAt,
    auditTrail: JSON.stringify([{
      action: "created",
      timestamp: new Date().toISOString(),
      userId: input.requestedBy,
    }]),
  });
  
  return {
    requestId,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Process an approval response
 */
export async function processApprovalResponse(
  requestId: string,
  action: "approve" | "reject",
  userId: number,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const [request] = await sdk.db
    .select()
    .from(db.approvalRequests)
    .where(eq(db.approvalRequests.requestId, requestId))
    .limit(1);
  
  if (!request) {
    return { success: false, error: "Approval request not found" };
  }
  
  if (request.status !== "pending") {
    return { success: false, error: "Request has already been processed" };
  }
  
  if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
    // Mark as expired
    await sdk.db
      .update(db.approvalRequests)
      .set({ status: "expired" })
      .where(eq(db.approvalRequests.id, request.id));
    return { success: false, error: "Request has expired" };
  }
  
  // Update audit trail
  const auditTrail = request.auditTrail ? JSON.parse(request.auditTrail as string) : [];
  auditTrail.push({
    action: action === "approve" ? "approved" : "rejected",
    timestamp: new Date().toISOString(),
    userId,
    details: reason,
  });
  
  // Update the request
  await sdk.db
    .update(db.approvalRequests)
    .set({
      status: action === "approve" ? "approved" : "rejected",
      approvedBy: userId,
      approvedAt: new Date(),
      approvalMethod: "web",
      rejectionReason: action === "reject" ? reason : null,
      auditTrail: JSON.stringify(auditTrail),
    })
    .where(eq(db.approvalRequests.id, request.id));
  
  return { success: true };
}

/**
 * Increment capability usage counter
 */
export async function incrementCapabilityUsage(
  organizationId: number,
  capabilityId: string
): Promise<void> {
  await sdk.db
    .update(db.orgCapabilities)
    .set({
      currentDailyUsage: sql`${db.orgCapabilities.currentDailyUsage} + 1`,
      currentMonthlyUsage: sql`${db.orgCapabilities.currentMonthlyUsage} + 1`,
    })
    .where(and(
      eq(db.orgCapabilities.organizationId, organizationId),
      eq(db.orgCapabilities.capabilityId, capabilityId)
    ));
}

/**
 * Reset daily usage counters (called by cron job)
 */
export async function resetDailyUsageCounters(): Promise<void> {
  await sdk.db
    .update(db.orgCapabilities)
    .set({ currentDailyUsage: 0 });
}

/**
 * Reset monthly usage counters (called by cron job)
 */
export async function resetMonthlyUsageCounters(): Promise<void> {
  await sdk.db
    .update(db.orgCapabilities)
    .set({ currentMonthlyUsage: 0 });
}

/**
 * Get pending approvals for an organization
 */
export async function getPendingApprovals(
  organizationId: number,
  options?: { limit?: number; forUser?: number }
): Promise<Array<{
  requestId: string;
  capabilityId: string;
  summary: string;
  requestedBy: number;
  requestedAt: Date;
  expiresAt: Date | null;
  riskLevel: string;
}>> {
  const conditions = [
    eq(db.approvalRequests.organizationId, organizationId),
    eq(db.approvalRequests.status, "pending"),
  ];
  
  if (options?.forUser) {
    conditions.push(eq(db.approvalRequests.requestedBy, options.forUser));
  }
  
  const requests = await sdk.db
    .select({
      requestId: db.approvalRequests.requestId,
      capabilityId: db.approvalRequests.capabilityId,
      summary: db.approvalRequests.summary,
      requestedBy: db.approvalRequests.requestedBy,
      requestedAt: db.approvalRequests.requestedAt,
      expiresAt: db.approvalRequests.expiresAt,
      riskAssessment: db.approvalRequests.riskAssessment,
    })
    .from(db.approvalRequests)
    .where(and(...conditions))
    .orderBy(desc(db.approvalRequests.requestedAt))
    .limit(options?.limit || 50);
  
  return requests.map(r => ({
    requestId: r.requestId,
    capabilityId: r.capabilityId,
    summary: r.summary || "",
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt,
    expiresAt: r.expiresAt,
    riskLevel: r.riskAssessment ? (JSON.parse(r.riskAssessment as string) as { level: string }).level : "medium",
  }));
}

/**
 * Initialize default capabilities for a new organization
 */
export async function initializeOrgCapabilities(organizationId: number): Promise<void> {
  // Get all active capabilities
  const capabilities = await sdk.db
    .select()
    .from(db.capabilityRegistry)
    .where(eq(db.capabilityRegistry.isActive, true));
  
  // Enable low-risk capabilities by default
  for (const cap of capabilities) {
    const enabled = cap.riskLevel === "low";
    
    await sdk.db.insert(db.orgCapabilities).values({
      organizationId,
      capabilityId: cap.capabilityId,
      enabled,
      approvalPolicy: "inherit",
    }).onDuplicateKeyUpdate({
      set: { enabled },
    });
  }
}

/**
 * Create default security policy for a new organization
 */
export async function createDefaultSecurityPolicy(organizationId: number): Promise<void> {
  await sdk.db.insert(db.openclawSecurityPolicies).values({
    organizationId,
    allowedChannels: JSON.stringify(["whatsapp", "telegram", "slack", "webchat"]),
    requirePairing: true,
    requireAdminApprovalForNewChannels: true,
    exportRequiresApproval: true,
    browserAutomationAllowed: false,
    shellExecutionAllowed: false,
    fileUploadAllowed: true,
    globalRateLimitPerMinute: 60,
    globalRateLimitPerDay: 1000,
    auditLevel: "standard",
    retainConversationsForDays: 365,
  }).onDuplicateKeyUpdate({
    set: { organizationId }, // No-op update
  });
}
