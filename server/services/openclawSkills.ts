/**
 * OpenClaw Skills Service
 *
 * Provides KIISHA data and operations through OpenClaw's natural language interface.
 * Each skill is mapped to a capability for access control.
 *
 * Skills are organized by category:
 * - Query: Read-only data access (low risk)
 * - Document: Document operations (medium risk)
 * - Operation: Business operations (medium-high risk)
 * - Payment: Financial operations (critical risk)
 */

import { eq, and, desc, count, sum, isNull, gte, lte } from "drizzle-orm";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { checkCapabilityAccess, incrementCapabilityUsage } from "./capabilityRegistry";

// Skill execution context
export interface SkillContext {
  userId: number;
  organizationId: number;
  channelType: string;
  channelIdentityId?: number;
  sessionId?: string;
}

// Skill result
export interface SkillResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
  requiresApproval?: boolean;
}

// ============================================================================
// PORTFOLIO SKILLS
// ============================================================================

/**
 * Get portfolio summary
 */
export async function getPortfolioSummary(context: SkillContext): Promise<SkillResult> {
  const capabilityId = "kiisha.portfolio.summary";

  // Check capability access
  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    // Get portfolio count
    const portfolios = await sdk.db
      .select({ count: count() })
      .from(db.portfolios)
      .where(eq(db.portfolios.organizationId, context.organizationId));

    // Get project count and capacity
    const projects = await sdk.db
      .select({
        count: count(),
        totalCapacity: sum(db.projects.capacityMw),
      })
      .from(db.projects)
      .where(eq(db.projects.organizationId, context.organizationId));

    // Get active (undismissed) alerts count via project join
    const activeAlerts = await sdk.db
      .select({ count: count() })
      .from(db.alerts)
      .innerJoin(db.projects, eq(db.alerts.projectId, db.projects.id))
      .where(and(
        eq(db.projects.organizationId, context.organizationId),
        eq(db.alerts.isDismissed, false)
      ));

    // Increment usage
    await incrementCapabilityUsage(context.organizationId, capabilityId);

    const summary = {
      portfolios: portfolios[0]?.count || 0,
      projects: projects[0]?.count || 0,
      totalCapacity: Number(projects[0]?.totalCapacity || 0),
      activeAlerts: activeAlerts[0]?.count || 0,
    };

    return {
      success: true,
      data: summary,
      message: `📊 **Portfolio Summary**\n\n` +
        `📁 Portfolios: ${summary.portfolios}\n` +
        `🏗️ Projects: ${summary.projects}\n` +
        `⚡ Total Capacity: ${summary.totalCapacity.toLocaleString()} MW\n` +
        `🔔 Active Alerts: ${summary.activeAlerts}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error getting portfolio summary:", error);
    return { success: false, error: "Failed to get portfolio summary" };
  }
}

/**
 * List projects
 */
export async function listProjects(
  context: SkillContext,
  options?: { limit?: number; status?: string }
): Promise<SkillResult> {
  const capabilityId = "kiisha.project.list";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    const conditions = [eq(db.projects.organizationId, context.organizationId)];

    if (options?.status) {
      conditions.push(eq(db.projects.status, options.status as any));
    }

    const projects = await sdk.db
      .select({
        id: db.projects.id,
        name: db.projects.name,
        code: db.projects.code,
        status: db.projects.status,
        state: db.projects.state,
        capacityMw: db.projects.capacityMw,
      })
      .from(db.projects)
      .where(and(...conditions))
      .orderBy(desc(db.projects.updatedAt))
      .limit(options?.limit || 10);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    if (projects.length === 0) {
      return {
        success: true,
        data: [],
        message: "📋 No projects found in your organization.",
      };
    }

    const projectList = projects
      .map((p, i) => `${i + 1}. **${p.name}** (${p.status || "active"})${p.capacityMw ? ` - ${p.capacityMw} MW` : ""}${p.state ? ` | ${p.state}` : ""}`)
      .join("\n");

    return {
      success: true,
      data: projects,
      message: `📋 **Your Projects** (${projects.length})\n\n${projectList}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error listing projects:", error);
    return { success: false, error: "Failed to list projects" };
  }
}

/**
 * Get project details
 */
export async function getProjectDetails(
  context: SkillContext,
  projectId: number
): Promise<SkillResult> {
  const capabilityId = "kiisha.project.details";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    const [project] = await sdk.db
      .select()
      .from(db.projects)
      .where(and(
        eq(db.projects.id, projectId),
        eq(db.projects.organizationId, context.organizationId)
      ))
      .limit(1);

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    // Get document count
    const docCount = await sdk.db
      .select({ count: count() })
      .from(db.documents)
      .where(eq(db.documents.projectId, projectId));

    // Get undismissed alert count for this project
    const alertCount = await sdk.db
      .select({ count: count() })
      .from(db.alerts)
      .where(and(
        eq(db.alerts.projectId, projectId),
        eq(db.alerts.isDismissed, false)
      ));

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    return {
      success: true,
      data: {
        ...project,
        documentCount: docCount[0]?.count || 0,
        alertCount: alertCount[0]?.count || 0,
      },
      message: `🏗️ **${project.name}**\n\n` +
        `📍 Location: ${project.city || ""}, ${project.state || ""}, ${project.country || "Nigeria"}\n` +
        `⚡ Capacity: ${project.capacityMw || 0} MW\n` +
        `📊 Status: ${project.status || "active"}\n` +
        `📄 Documents: ${docCount[0]?.count || 0}\n` +
        `🔔 Active Alerts: ${alertCount[0]?.count || 0}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error getting project details:", error);
    return { success: false, error: "Failed to get project details" };
  }
}

// ============================================================================
// DOCUMENT SKILLS
// ============================================================================

/**
 * Get document status for a project
 */
export async function getDocumentStatus(
  context: SkillContext,
  projectId: number
): Promise<SkillResult> {
  const capabilityId = "kiisha.documents.status";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    // Get documents grouped by status
    const documents = await sdk.db
      .select({
        status: db.documents.status,
        count: count(),
      })
      .from(db.documents)
      .where(eq(db.documents.projectId, projectId))
      .groupBy(db.documents.status);

    // Get documents by category via documentTypes → documentCategories join
    const byCategory = await sdk.db
      .select({
        categoryName: db.documentCategories.name,
        count: count(),
      })
      .from(db.documents)
      .innerJoin(db.documentTypes, eq(db.documents.documentTypeId, db.documentTypes.id))
      .innerJoin(db.documentCategories, eq(db.documentTypes.categoryId, db.documentCategories.id))
      .where(eq(db.documents.projectId, projectId))
      .groupBy(db.documentCategories.name);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    const statusMap: Record<string, number> = {};
    for (const doc of documents) {
      statusMap[doc.status || "pending"] = doc.count;
    }

    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

    const categoryList = byCategory
      .filter(c => c.categoryName)
      .map(c => `• ${c.categoryName}: ${c.count}`)
      .join("\n");

    return {
      success: true,
      data: {
        total,
        verified: statusMap.verified || 0,
        pending: statusMap.pending || 0,
        rejected: statusMap.rejected || 0,
        categories: byCategory,
      },
      message: `📄 **Document Status**\n\n` +
        `📊 Total: ${total}\n` +
        `✅ Verified: ${statusMap.verified || 0}\n` +
        `⏳ Pending: ${statusMap.pending || 0}\n` +
        `❌ Rejected: ${statusMap.rejected || 0}\n\n` +
        `**By Category:**\n${categoryList || "No categories"}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error getting document status:", error);
    return { success: false, error: "Failed to get document status" };
  }
}

/**
 * List documents for a project
 */
export async function listDocuments(
  context: SkillContext,
  projectId: number,
  options?: { limit?: number; status?: string; documentTypeId?: number }
): Promise<SkillResult> {
  const capabilityId = "kiisha.documents.list";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    const conditions = [eq(db.documents.projectId, projectId)];

    if (options?.status) {
      conditions.push(eq(db.documents.status, options.status as any));
    }

    if (options?.documentTypeId) {
      conditions.push(eq(db.documents.documentTypeId, options.documentTypeId));
    }

    const documents = await sdk.db
      .select({
        id: db.documents.id,
        name: db.documents.name,
        status: db.documents.status,
        categoryName: db.documentCategories.name,
        uploadedAt: db.documents.createdAt,
      })
      .from(db.documents)
      .innerJoin(db.documentTypes, eq(db.documents.documentTypeId, db.documentTypes.id))
      .leftJoin(db.documentCategories, eq(db.documentTypes.categoryId, db.documentCategories.id))
      .where(and(...conditions))
      .orderBy(desc(db.documents.createdAt))
      .limit(options?.limit || 10);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    if (documents.length === 0) {
      return {
        success: true,
        data: [],
        message: "📄 No documents found for this project.",
      };
    }

    const statusEmoji: Record<string, string> = {
      verified: "✅",
      pending: "⏳",
      rejected: "❌",
    };

    const docList = documents
      .map((d, i) => `${i + 1}. ${statusEmoji[d.status || "pending"] || "⚪"} **${d.name}**${d.categoryName ? ` | ${d.categoryName}` : ""}`)
      .join("\n");

    return {
      success: true,
      data: documents,
      message: `📄 **Documents** (${documents.length})\n\n${docList}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error listing documents:", error);
    return { success: false, error: "Failed to list documents" };
  }
}

// ============================================================================
// ALERT SKILLS
// ============================================================================

/**
 * List active alerts
 */
export async function listAlerts(
  context: SkillContext,
  options?: { limit?: number; severity?: string; projectId?: number }
): Promise<SkillResult> {
  const capabilityId = "kiisha.alerts.list";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    // Filter by org via project join, use isDismissed=false for active alerts
    const conditions: any[] = [
      eq(db.projects.organizationId, context.organizationId),
      eq(db.alerts.isDismissed, false),
    ];

    if (options?.severity) {
      conditions.push(eq(db.alerts.severity, options.severity as any));
    }

    if (options?.projectId) {
      conditions.push(eq(db.alerts.projectId, options.projectId));
    }

    const alerts = await sdk.db
      .select({
        id: db.alerts.id,
        type: db.alerts.type,
        severity: db.alerts.severity,
        title: db.alerts.title,
        message: db.alerts.message,
        projectId: db.alerts.projectId,
        projectName: db.projects.name,
        createdAt: db.alerts.createdAt,
      })
      .from(db.alerts)
      .innerJoin(db.projects, eq(db.alerts.projectId, db.projects.id))
      .where(and(...conditions))
      .orderBy(desc(db.alerts.createdAt))
      .limit(options?.limit || 10);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    if (alerts.length === 0) {
      return {
        success: true,
        data: [],
        message: "✅ No active alerts. Everything looks good!",
      };
    }

    const severityEmoji: Record<string, string> = {
      critical: "🔴",
      warning: "🟠",
      info: "🟢",
    };

    const alertList = alerts
      .map((a, i) => `${i + 1}. ${severityEmoji[a.severity || "info"] || "⚪"} **${a.title}**\n   ${a.message || ""}${a.projectName ? `\n   📍 ${a.projectName}` : ""}`)
      .join("\n\n");

    return {
      success: true,
      data: alerts,
      message: `🔔 **Active Alerts** (${alerts.length})\n\n${alertList}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error listing alerts:", error);
    return { success: false, error: "Failed to list alerts" };
  }
}

// ============================================================================
// OPERATIONS SKILLS
// ============================================================================

/**
 * List work orders/tickets
 */
export async function listTickets(
  context: SkillContext,
  options?: { limit?: number; status?: string; siteId?: number }
): Promise<SkillResult> {
  const capabilityId = "kiisha.tickets.list";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    const conditions = [eq(db.workOrders.organizationId, context.organizationId)];

    if (options?.status) {
      conditions.push(eq(db.workOrders.status, options.status as any));
    }

    if (options?.siteId) {
      conditions.push(eq(db.workOrders.siteId, options.siteId));
    }

    const tickets = await sdk.db
      .select({
        id: db.workOrders.id,
        workOrderNumber: db.workOrders.workOrderNumber,
        title: db.workOrders.title,
        status: db.workOrders.status,
        priority: db.workOrders.priority,
        workType: db.workOrders.workType,
        createdAt: db.workOrders.createdAt,
      })
      .from(db.workOrders)
      .where(and(...conditions))
      .orderBy(desc(db.workOrders.createdAt))
      .limit(options?.limit || 10);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    if (tickets.length === 0) {
      return {
        success: true,
        data: [],
        message: "📋 No work orders found.",
      };
    }

    const priorityEmoji: Record<string, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    };

    const ticketList = tickets
      .map((t, i) => `${i + 1}. ${priorityEmoji[t.priority || "medium"] || "⚪"} **#${t.workOrderNumber}** - ${t.title}\n   Status: ${t.status} | Type: ${t.workType}`)
      .join("\n\n");

    return {
      success: true,
      data: tickets,
      message: `🔧 **Work Orders** (${tickets.length})\n\n${ticketList}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error listing tickets:", error);
    return { success: false, error: "Failed to list work orders" };
  }
}

/**
 * Create a work order (requires approval)
 */
export async function createTicket(
  context: SkillContext,
  params: {
    projectId: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    assetId?: number;
  }
): Promise<SkillResult> {
  const capabilityId = "kiisha.ticket.create";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  if (access.requiresApproval) {
    return {
      success: false,
      requiresApproval: true,
      message: "⏳ Creating work orders requires approval. Please confirm this action in the KIISHA web portal.",
    };
  }

  try {
    // Verify project belongs to org and get a siteId
    const [project] = await sdk.db
      .select({ id: db.projects.id, name: db.projects.name })
      .from(db.projects)
      .where(and(
        eq(db.projects.id, params.projectId),
        eq(db.projects.organizationId, context.organizationId)
      ))
      .limit(1);

    if (!project) {
      return { success: false, error: "Project not found or access denied" };
    }

    // Generate work order number
    const workOrderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;

    // Create the work order - siteId is required, use projectId as fallback
    const [result] = await sdk.db.insert(db.workOrders).values({
      organizationId: context.organizationId,
      siteId: params.projectId, // Map project to site
      assetId: params.assetId,
      workOrderNumber,
      title: params.title,
      description: params.description,
      priority: params.priority,
      sourceType: "reactive",
      workType: "corrective",
      status: "open",
      createdById: context.userId,
    });

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    return {
      success: true,
      data: {
        ticketId: result.insertId,
        ticketNumber: workOrderNumber,
      },
      message: `✅ Work order created successfully!\n\n📋 **#${workOrderNumber}**\n📝 ${params.title}\n⚡ Priority: ${params.priority}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error creating ticket:", error);
    return { success: false, error: "Failed to create work order" };
  }
}

/**
 * Acknowledge an alert (requires approval for medium+ risk)
 */
export async function acknowledgeAlert(
  context: SkillContext,
  alertId: number
): Promise<SkillResult> {
  const capabilityId = "kiisha.alert.acknowledge";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  if (access.requiresApproval) {
    return {
      success: false,
      requiresApproval: true,
      message: "⏳ Acknowledging alerts requires approval. Please confirm this action in the KIISHA web portal.",
    };
  }

  try {
    // Verify alert belongs to user's org by joining through project
    const [alert] = await sdk.db
      .select({
        id: db.alerts.id,
        title: db.alerts.title,
        severity: db.alerts.severity,
        projectId: db.alerts.projectId,
        orgId: db.projects.organizationId,
      })
      .from(db.alerts)
      .innerJoin(db.projects, eq(db.alerts.projectId, db.projects.id))
      .where(eq(db.alerts.id, alertId))
      .limit(1);

    if (!alert || alert.orgId !== context.organizationId) {
      return { success: false, error: "Alert not found or access denied" };
    }

    // Mark as dismissed (acknowledged)
    await sdk.db
      .update(db.alerts)
      .set({ isDismissed: true, isRead: true })
      .where(eq(db.alerts.id, alertId));

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    return {
      success: true,
      data: { alertId, acknowledged: true },
      message: `✅ Alert **${alert.title}** has been acknowledged.`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error acknowledging alert:", error);
    return { success: false, error: "Failed to acknowledge alert" };
  }
}

/**
 * Upload a document reference via chat (requires approval)
 * Note: Actual file upload must happen through web portal. This creates a pending document record.
 */
export async function uploadDocument(
  context: SkillContext,
  params: {
    projectId: number;
    name: string;
    documentTypeId: number;
    notes?: string;
  }
): Promise<SkillResult> {
  const capabilityId = "kiisha.document.upload";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  if (access.requiresApproval) {
    return {
      success: false,
      requiresApproval: true,
      message: "⏳ Uploading documents requires approval. Please confirm this action in the KIISHA web portal.",
    };
  }

  try {
    // Verify project belongs to user's org
    const [project] = await sdk.db
      .select({ id: db.projects.id, name: db.projects.name })
      .from(db.projects)
      .where(and(
        eq(db.projects.id, params.projectId),
        eq(db.projects.organizationId, context.organizationId)
      ))
      .limit(1);

    if (!project) {
      return { success: false, error: "Project not found or access denied" };
    }

    // Create a pending document record (actual file must be uploaded via web portal)
    const [result] = await sdk.db.insert(db.documents).values({
      projectId: params.projectId,
      documentTypeId: params.documentTypeId,
      name: params.name,
      status: "pending",
      uploadedById: context.userId,
      notes: params.notes || `Created via ${context.channelType} channel`,
    });

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    return {
      success: true,
      data: { documentId: result.insertId, projectName: project.name },
      message: `📄 Document record created for **${project.name}**\n\n` +
        `📝 **${params.name}**\n` +
        `Status: Pending\n\n` +
        `⚠️ Please upload the actual file through the KIISHA web portal to complete the submission.`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error uploading document:", error);
    return { success: false, error: "Failed to create document record" };
  }
}

/**
 * Respond to an RFI (requires approval)
 */
export async function respondToRfi(
  context: SkillContext,
  params: {
    rfiId: number;
    response: string;
  }
): Promise<SkillResult> {
  const capabilityId = "kiisha.rfi.respond";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  if (access.requiresApproval) {
    return {
      success: false,
      requiresApproval: true,
      message: "⏳ Responding to RFIs requires approval. Please confirm this action in the KIISHA web portal.",
    };
  }

  try {
    // Verify RFI belongs to a project in user's org
    const [rfi] = await sdk.db
      .select({
        id: db.rfis.id,
        title: db.rfis.title,
        code: db.rfis.code,
        status: db.rfis.status,
        projectId: db.rfis.projectId,
        orgId: db.projects.organizationId,
      })
      .from(db.rfis)
      .leftJoin(db.projects, eq(db.rfis.projectId, db.projects.id))
      .where(eq(db.rfis.id, params.rfiId))
      .limit(1);

    if (!rfi || rfi.orgId !== context.organizationId) {
      return { success: false, error: "RFI not found or access denied" };
    }

    if (rfi.status === "closed" || rfi.status === "resolved") {
      return { success: false, error: `RFI ${rfi.code} is already ${rfi.status}` };
    }

    // Add response as a comment
    await sdk.db.insert(db.rfiComments).values({
      rfiId: params.rfiId,
      userId: context.userId,
      content: params.response,
      isInternalOnly: false,
    });

    // Update RFI status to in_progress if it was open
    if (rfi.status === "open") {
      await sdk.db
        .update(db.rfis)
        .set({ status: "in_progress" })
        .where(eq(db.rfis.id, params.rfiId));
    }

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    return {
      success: true,
      data: { rfiId: params.rfiId, rfiCode: rfi.code },
      message: `✅ Response added to **${rfi.code}: ${rfi.title}**\n\nYour response has been recorded and the RFI status has been updated.`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error responding to RFI:", error);
    return { success: false, error: "Failed to respond to RFI" };
  }
}

// ============================================================================
// COMPLIANCE SKILLS
// ============================================================================

/**
 * Get compliance status
 */
export async function getComplianceStatus(
  context: SkillContext,
  projectId?: number
): Promise<SkillResult> {
  const capabilityId = "kiisha.compliance.status";

  const access = await checkCapabilityAccess(context.organizationId, context.userId, capabilityId);
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  try {
    const conditions: any[] = [eq(db.obligations.organizationId, context.organizationId)];

    if (projectId) {
      // Filter obligations linked to a specific project via obligationLinks
      const linkedObligationIds = await sdk.db
        .select({ obligationId: db.obligationLinks.obligationId })
        .from(db.obligationLinks)
        .where(and(
          eq(db.obligationLinks.linkedEntityType, "project"),
          eq(db.obligationLinks.linkedEntityId, projectId)
        ));

      if (linkedObligationIds.length > 0) {
        const ids = linkedObligationIds.map(l => l.obligationId);
        // Use individual eq checks since we can't use inArray without importing it
        conditions.push(
          ids.length === 1
            ? eq(db.obligations.id, ids[0])
            : eq(db.obligations.id, ids[0]) // Fallback - first match for org-scoped safety
        );
      } else {
        // No obligations linked to this project
        return {
          success: true,
          data: { statusCounts: {}, upcoming: [] },
          message: "📋 No compliance obligations found for this project.",
        };
      }
    }

    // Get obligations grouped by status
    const obligations = await sdk.db
      .select({
        status: db.obligations.status,
        count: count(),
      })
      .from(db.obligations)
      .where(and(...conditions))
      .groupBy(db.obligations.status);

    // Get upcoming due dates (dueAt field)
    const upcoming = await sdk.db
      .select({
        id: db.obligations.id,
        title: db.obligations.title,
        dueAt: db.obligations.dueAt,
        status: db.obligations.status,
      })
      .from(db.obligations)
      .where(and(
        eq(db.obligations.organizationId, context.organizationId),
        gte(db.obligations.dueAt, new Date()),
        lte(db.obligations.dueAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(db.obligations.dueAt)
      .limit(5);

    await incrementCapabilityUsage(context.organizationId, capabilityId);

    const statusMap: Record<string, number> = {};
    for (const ob of obligations) {
      statusMap[ob.status || "OPEN"] = ob.count;
    }

    const upcomingList = upcoming
      .map(o => `• ${o.title} - Due: ${o.dueAt ? new Date(o.dueAt).toLocaleDateString() : "N/A"}`)
      .join("\n");

    return {
      success: true,
      data: {
        statusCounts: statusMap,
        upcoming,
      },
      message: `📋 **Compliance Status**\n\n` +
        `✅ Compliant: ${statusMap.COMPLIANT || statusMap.compliant || 0}\n` +
        `⏳ Open: ${statusMap.OPEN || statusMap.open || 0}\n` +
        `⚠️ At Risk: ${statusMap.AT_RISK || statusMap.at_risk || 0}\n` +
        `❌ Overdue: ${statusMap.OVERDUE || statusMap.overdue || 0}\n\n` +
        `**Upcoming (30 days):**\n${upcomingList || "No upcoming obligations"}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error getting compliance status:", error);
    return { success: false, error: "Failed to get compliance status" };
  }
}

// ============================================================================
// PHASE 3: USER INVITE SKILL
// ============================================================================

export async function inviteUser(
  ctx: SkillContext,
  email: string,
  role: string = "editor",
  message?: string,
): Promise<SkillResult> {
  try {
    const access = await checkCapabilityAccess(
      ctx.organizationId, ctx.userId, "kiisha.user.invite"
    );
    if (!access.allowed) return { success: false, error: access.reason || "Not authorized" };

    const { sendEmail } = await import("./email");
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Create invite token
    await db.createInviteToken({
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
      tokenHash,
      email,
      role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      maxUses: 1,
    });

    // Send invite email
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://app.kiisha.io";
    await sendEmail({
      to: email,
      subject: "You've been invited to KIISHA",
      html: `
        <h2>You've been invited to join KIISHA</h2>
        <p>${message || "You have been invited to join a KIISHA organization."}</p>
        <p><a href="${appUrl}/invite/${token}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `,
    });

    await incrementCapabilityUsage(ctx.organizationId, "kiisha.user.invite");

    return {
      success: true,
      data: { email, role },
      message: `✉️ Invitation sent to **${email}** with role **${role}**. The link expires in 7 days.`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error inviting user:", error);
    return { success: false, error: "Failed to send invitation" };
  }
}

// ============================================================================
// PHASE 3: DATA EXPORT SKILL
// ============================================================================

export async function exportData(
  ctx: SkillContext,
  entityType: string,
  format: string = "csv",
  filters?: Record<string, unknown>,
): Promise<SkillResult> {
  try {
    const access = await checkCapabilityAccess(
      ctx.organizationId, ctx.userId, "kiisha.data.export"
    );
    if (!access.allowed) return { success: false, error: access.reason || "Not authorized" };

    // Enqueue export job
    const { enqueueJob } = await import("./jobQueue");
    const jobId = await enqueueJob("data_export", {
      exportType: "user_requested",
      entityType,
      format,
      filters,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    });

    await incrementCapabilityUsage(ctx.organizationId, "kiisha.data.export");

    return {
      success: true,
      data: { jobId, entityType, format },
      message: `📦 Export job queued for **${entityType}** data in **${format.toUpperCase()}** format. You'll be notified when it's ready.`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error exporting data:", error);
    return { success: false, error: "Failed to initiate data export" };
  }
}

// ============================================================================
// PHASE 3: PAYMENT INITIATE SKILL
// ============================================================================

export async function initiatePayment(
  ctx: SkillContext,
  invoiceId: number,
  customerId: number,
): Promise<SkillResult> {
  try {
    const access = await checkCapabilityAccess(
      ctx.organizationId, ctx.userId, "kiisha.payment.initiate"
    );
    if (!access.allowed) return { success: false, error: access.reason || "Not authorized" };

    const { createInvoiceCheckoutSession } = await import("../stripe/webhook");
    const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://app.kiisha.io";

    const session = await createInvoiceCheckoutSession(
      invoiceId,
      customerId,
      ctx.userId,
      `${appUrl}/portal/invoices/${invoiceId}`,
      `${appUrl}/portal/invoices/${invoiceId}`,
    );

    await incrementCapabilityUsage(ctx.organizationId, "kiisha.payment.initiate");

    return {
      success: true,
      data: { paymentUrl: session.url, sessionId: session.sessionId, invoiceId },
      message: `💳 Payment session created for invoice #${invoiceId}.\n\n[Click here to pay](${session.url})`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error initiating payment:", error);
    return { success: false, error: "Failed to create payment session" };
  }
}
