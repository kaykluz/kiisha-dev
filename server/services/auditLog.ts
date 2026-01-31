/**
 * Audit Logging Service
 * 
 * Comprehensive audit logging for all security-relevant events.
 * All logs are tenant-scoped and sensitive content is redacted.
 * 
 * LOGGED EVENTS:
 * - Login, org selection, membership joins
 * - View creation/edit/delete/share/revoke/access
 * - Document upload, version update, parsing runs
 * - Fact extraction and evidence pointer creation
 * - Conflict/difference detection events
 * - AI retrieval calls (scoped metadata only)
 * - Template autofill actions + confidence + user decisions
 * 
 * CONSTRAINTS:
 * - Do not log raw sensitive content
 * - Redact bank details, IDs, personal data
 * - Tenant-scope all logs and analytics
 */

import { PolicyContext } from "./policyContext";

// Audit event types
export type AuditEventType =
  // Authentication & Authorization
  | "auth.login"
  | "auth.logout"
  | "auth.org_select"
  | "auth.membership_join"
  | "auth.membership_leave"
  | "auth.role_change"
  | "auth.superuser_elevation"
  | "auth.superuser_deactivation"
  
  // Views
  | "view.create"
  | "view.edit"
  | "view.delete"
  | "view.share"
  | "view.share_revoke"
  | "view.access"
  | "view.export"
  
  // Documents
  | "document.upload"
  | "document.version_update"
  | "document.delete"
  | "document.access"
  | "document.parsing_start"
  | "document.parsing_complete"
  | "document.parsing_error"
  
  // VATR / Evidence
  | "vatr.fact_extracted"
  | "vatr.claim_extracted"
  | "vatr.evidence_created"
  | "vatr.infoitem_updated"
  | "vatr.conflict_detected"
  | "vatr.difference_detected"
  | "vatr.conflict_resolved"
  
  // AI
  | "ai.retrieval"
  | "ai.response"
  | "ai.scope_violation_blocked"
  | "ai.autofill_proposal"
  | "ai.autofill_decision"
  
  // Templates
  | "template.autofill_auto"
  | "template.autofill_selection"
  | "template.autofill_confirmation"
  | "template.autofill_rejection"
  | "template.mapping_saved"
  
  // Organization
  | "org.settings_update"
  | "org.member_invite"
  | "org.member_remove"
  | "org.join_request"
  | "org.join_approved"
  | "org.join_rejected"
  
  // Security
  | "security.rate_limit_exceeded"
  | "security.invalid_token"
  | "security.cross_org_attempt"
  | "security.permission_denied";

// Audit event severity
export type AuditSeverity = "info" | "warning" | "error" | "critical";

// Audit event structure
export interface AuditEvent {
  id?: number;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  
  // Actor
  userId: number | null;
  userEmail?: string;
  userRole?: string;
  isSuperuser: boolean;
  
  // Context
  organizationId: number | null;
  organizationName?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Resource
  resourceType?: string;
  resourceId?: number | string;
  resourceName?: string;
  
  // Action details
  action: string;
  outcome: "success" | "failure" | "blocked";
  
  // Additional data (redacted if sensitive)
  metadata?: Record<string, unknown>;
  
  // Error details (if applicable)
  errorCode?: string;
  errorMessage?: string;
}

// Sensitive fields to redact
const SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "token",
  "secret",
  "apiKey",
  "bankAccount",
  "accountNumber",
  "routingNumber",
  "ssn",
  "socialSecurityNumber",
  "taxId",
  "nationalId",
  "passportNumber",
  "creditCard",
  "cvv",
  "pin",
];

/**
 * Log an audit event
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  // Redact sensitive fields
  const redactedEvent = redactSensitiveData(event);

  // Insert into audit log table
  try {
    const { getDb } = await import("../db");
    const { auditLog } = await import("../../drizzle/schema");
    const db = await getDb();
    if (db) {
      await db.insert(auditLog).values({
        userId: event.userId ?? null,
        action: `${event.eventType}:${event.action}`,
        entityType: event.resourceType || event.eventType,
        entityId: typeof event.resourceId === "number" ? event.resourceId : null,
        oldValue: null,
        newValue: {
          severity: event.severity,
          outcome: event.outcome,
          organizationId: event.organizationId,
          metadata: redactedEvent.metadata,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
        },
        ipAddress: (event.metadata as any)?.ipAddress || null,
        userAgent: (event.metadata as any)?.userAgent || null,
      });
    }
  } catch (err) {
    // Fallback to console if DB insert fails
    console.error("[AUDIT] DB insert failed:", err);
    console.log("[AUDIT]", JSON.stringify(redactedEvent, null, 2));
  }

  // For critical events, also send to monitoring
  if (event.severity === "critical") {
    await sendCriticalAlert(redactedEvent);
  }
}

/**
 * Log an event from a PolicyContext
 */
export async function logFromContext(
  ctx: PolicyContext,
  eventType: AuditEventType,
  action: string,
  outcome: "success" | "failure" | "blocked",
  options?: {
    severity?: AuditSeverity;
    resourceType?: string;
    resourceId?: number | string;
    resourceName?: string;
    metadata?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const event: AuditEvent = {
    timestamp: new Date(),
    eventType,
    severity: options?.severity || "info",
    userId: ctx.userId,
    isSuperuser: ctx.isSuperuser,
    organizationId: ctx.activeOrgId,
    sessionId: ctx.sessionId,
    resourceType: options?.resourceType,
    resourceId: options?.resourceId,
    resourceName: options?.resourceName,
    action,
    outcome,
    metadata: options?.metadata,
    errorCode: options?.errorCode,
    errorMessage: options?.errorMessage,
  };
  
  await logAuditEvent(event);
}

/**
 * Log authentication events
 */
export async function logAuth(
  eventType: "auth.login" | "auth.logout" | "auth.org_select",
  userId: number,
  outcome: "success" | "failure",
  details: {
    organizationId?: number;
    ipAddress?: string;
    userAgent?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await logAuditEvent({
    timestamp: new Date(),
    eventType,
    severity: outcome === "failure" ? "warning" : "info",
    userId,
    isSuperuser: false,
    organizationId: details.organizationId || null,
    ipAddress: details.ipAddress,
    userAgent: details.userAgent,
    action: eventType.split(".")[1],
    outcome,
    errorMessage: details.errorMessage,
  });
}

/**
 * Log view sharing events
 */
export async function logViewShare(
  ctx: PolicyContext,
  action: "share" | "revoke" | "access",
  viewId: number,
  targetOrgId?: number,
  targetUserId?: number
): Promise<void> {
  const eventType = action === "share" ? "view.share" 
    : action === "revoke" ? "view.share_revoke" 
    : "view.access";
  
  await logFromContext(ctx, eventType, action, "success", {
    resourceType: "view",
    resourceId: viewId,
    metadata: {
      targetOrgId,
      targetUserId,
    },
  });
}

/**
 * Log AI retrieval events
 */
export async function logAIRetrieval(
  ctx: PolicyContext,
  queryType: string,
  retrievedCount: number,
  scopeViolationAttempted: boolean,
  details?: {
    queryText?: string; // Truncated
    citedSources?: Array<{ documentId: number; page?: number }>;
  }
): Promise<void> {
  await logFromContext(
    ctx,
    scopeViolationAttempted ? "ai.scope_violation_blocked" : "ai.retrieval",
    `AI ${queryType} retrieval`,
    scopeViolationAttempted ? "blocked" : "success",
    {
      severity: scopeViolationAttempted ? "warning" : "info",
      metadata: {
        queryType,
        retrievedCount,
        scopeViolationAttempted,
        // Truncate query text to avoid logging sensitive content
        queryTextPreview: details?.queryText?.substring(0, 100),
        citedSourceCount: details?.citedSources?.length,
      },
    }
  );
}

/**
 * Log template autofill events
 */
export async function logAutofill(
  ctx: PolicyContext,
  templateId: number,
  fieldId: string,
  decision: "auto_filled" | "user_selected" | "user_confirmed" | "user_rejected" | "skipped",
  confidence: number
): Promise<void> {
  const eventType = decision === "auto_filled" ? "template.autofill_auto"
    : decision === "user_selected" ? "template.autofill_selection"
    : decision === "user_confirmed" ? "template.autofill_confirmation"
    : "template.autofill_rejection";
  
  await logFromContext(ctx, eventType, `Autofill ${decision}`, "success", {
    resourceType: "template_field",
    resourceId: `${templateId}:${fieldId}`,
    metadata: {
      templateId,
      fieldId,
      decision,
      confidence,
    },
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  eventType: "security.rate_limit_exceeded" | "security.invalid_token" | "security.cross_org_attempt" | "security.permission_denied",
  details: {
    userId?: number;
    organizationId?: number;
    ipAddress?: string;
    attemptedResource?: string;
    attemptedAction?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await logAuditEvent({
    timestamp: new Date(),
    eventType,
    severity: "warning",
    userId: details.userId || null,
    isSuperuser: false,
    organizationId: details.organizationId || null,
    ipAddress: details.ipAddress,
    action: eventType.split(".")[1],
    outcome: "blocked",
    metadata: {
      attemptedResource: details.attemptedResource,
      attemptedAction: details.attemptedAction,
    },
    errorMessage: details.errorMessage,
  });
}

/**
 * Redact sensitive data from an object
 */
function redactSensitiveData<T extends Record<string, unknown>>(obj: T): T {
  const redacted = { ...obj };
  
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key matches sensitive field patterns
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = "[REDACTED]" as any;
    }
    
    // Recursively redact nested objects
    if (typeof redacted[key] === "object" && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key] as Record<string, unknown>) as any;
    }
  }
  
  return redacted;
}

/**
 * Send critical alert to monitoring system
 */
async function sendCriticalAlert(event: AuditEvent): Promise<void> {
  console.error("[CRITICAL AUDIT EVENT]", event);
  // Send critical events as notifications to all org admins
  try {
    const { enqueueJob } = await import("./jobQueue");
    await enqueueJob("notification_send", {
      userId: event.userId || 0,
      type: "critical_audit",
      title: `Critical Security Event: ${event.action}`,
      message: `${event.eventType}: ${event.action} - ${event.outcome}`,
      data: { organizationId: event.organizationId, severity: "critical" },
    });
  } catch {
    // Best-effort notification
  }
}

/**
 * Query audit logs (for admin UI)
 */
export async function queryAuditLogs(
  ctx: PolicyContext,
  filters: {
    eventTypes?: AuditEventType[];
    startDate?: Date;
    endDate?: Date;
    userId?: number;
    resourceType?: string;
    resourceId?: number | string;
    outcome?: "success" | "failure" | "blocked";
    limit?: number;
    offset?: number;
  }
): Promise<{
  events: AuditEvent[];
  total: number;
}> {
  // Enforce org scope - can only query own org's logs
  if (!ctx.activeOrgId && !ctx.isSuperuser) {
    throw new Error("Organization context required to query audit logs");
  }
  
  try {
    const { getDb } = await import("../db");
    const { auditLog } = await import("../../drizzle/schema");
    const { eq, and, gte, lte, sql, desc } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return { events: [], total: 0 };

    const conditions: any[] = [];

    // Org scope: filter by organizationId in the newValue JSON
    if (ctx.activeOrgId) {
      conditions.push(sql`JSON_EXTRACT(${auditLog.newValue}, '$.organizationId') = ${ctx.activeOrgId}`);
    }
    if (filters.userId) conditions.push(eq(auditLog.userId, filters.userId));
    if (filters.resourceType) conditions.push(eq(auditLog.entityType, filters.resourceType));
    if (filters.resourceId && typeof filters.resourceId === "number") {
      conditions.push(eq(auditLog.entityId, filters.resourceId));
    }
    if (filters.startDate) conditions.push(gte(auditLog.createdAt, filters.startDate));
    if (filters.endDate) conditions.push(lte(auditLog.createdAt, filters.endDate));
    if (filters.outcome) {
      conditions.push(sql`JSON_EXTRACT(${auditLog.newValue}, '$.outcome') = ${filters.outcome}`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db.select().from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0),
      db.select({ count: sql<number>`count(*)` }).from(auditLog).where(whereClause),
    ]);

    const events: AuditEvent[] = rows.map(row => {
      const meta = (row.newValue as any) || {};
      const [eventType, ...actionParts] = (row.action || "").split(":");
      return {
        timestamp: row.createdAt,
        eventType: eventType as AuditEventType,
        severity: meta.severity || "info",
        userId: row.userId ?? undefined,
        organizationId: meta.organizationId,
        action: actionParts.join(":") || row.action,
        outcome: meta.outcome || "success",
        resourceType: row.entityType,
        resourceId: row.entityId ?? undefined,
        metadata: meta.metadata,
        errorCode: meta.errorCode,
        errorMessage: meta.errorMessage,
      };
    });

    return { events, total: Number(countResult[0]?.count || 0) };
  } catch (err) {
    console.error("[AUDIT] Query failed:", err);
    return { events: [], total: 0 };
  }
}
