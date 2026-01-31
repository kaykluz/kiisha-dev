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

import { eq, and, desc, sql, count, sum, isNull, gte, lte, inArray } from "drizzle-orm";
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
        totalCapacity: sum(db.projects.installedCapacity),
      })
      .from(db.projects)
      .where(eq(db.projects.organizationId, context.organizationId));
    
    // Get active alerts count
    const alerts = await sdk.db
      .select({ count: count() })
      .from(db.alerts)
      .where(and(
        eq(db.alerts.organizationId, context.organizationId),
        isNull(db.alerts.resolvedAt)
      ));
    
    // Increment usage
    await incrementCapabilityUsage(context.organizationId, capabilityId);
    
    const summary = {
      portfolios: portfolios[0]?.count || 0,
      projects: projects[0]?.count || 0,
      totalCapacity: Number(projects[0]?.totalCapacity || 0),
      activeAlerts: alerts[0]?.count || 0,
    };
    
    return {
      success: true,
      data: summary,
      message: `📊 **Portfolio Summary**\n\n` +
        `📁 Portfolios: ${summary.portfolios}\n` +
        `🏗️ Projects: ${summary.projects}\n` +
        `⚡ Total Capacity: ${summary.totalCapacity.toLocaleString()} kW\n` +
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
        installedCapacity: db.projects.installedCapacity,
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
      .map((p, i) => `${i + 1}. **${p.name}** (${p.status || "active"})${p.installedCapacity ? ` - ${p.installedCapacity} kW` : ""}${p.state ? ` | ${p.state}` : ""}`)
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
    
    // Get alert count
    const alertCount = await sdk.db
      .select({ count: count() })
      .from(db.alerts)
      .where(and(
        eq(db.alerts.projectId, projectId),
        isNull(db.alerts.resolvedAt)
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
        `⚡ Capacity: ${project.installedCapacity || 0} kW\n` +
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
    
    // Get documents by category
    const byCategory = await sdk.db
      .select({
        categoryId: db.documents.categoryId,
        categoryName: db.documentCategories.name,
        count: count(),
      })
      .from(db.documents)
      .leftJoin(db.documentCategories, eq(db.documents.categoryId, db.documentCategories.id))
      .where(eq(db.documents.projectId, projectId))
      .groupBy(db.documents.categoryId, db.documentCategories.name);
    
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
  options?: { limit?: number; status?: string; categoryId?: number }
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
    
    if (options?.categoryId) {
      conditions.push(eq(db.documents.categoryId, options.categoryId));
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
      .leftJoin(db.documentCategories, eq(db.documents.categoryId, db.documentCategories.id))
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
    const conditions = [
      eq(db.alerts.organizationId, context.organizationId),
      isNull(db.alerts.resolvedAt),
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
        message: db.alerts.message,
        projectId: db.alerts.projectId,
        projectName: db.projects.name,
        createdAt: db.alerts.createdAt,
      })
      .from(db.alerts)
      .leftJoin(db.projects, eq(db.alerts.projectId, db.projects.id))
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
      high: "🟠",
      medium: "🟡",
      low: "🟢",
    };
    
    const alertList = alerts
      .map((a, i) => `${i + 1}. ${severityEmoji[a.severity || "medium"] || "⚪"} **${a.type}**\n   ${a.message}${a.projectName ? `\n   📍 ${a.projectName}` : ""}`)
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
  options?: { limit?: number; status?: string; projectId?: number }
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
    
    if (options?.projectId) {
      conditions.push(eq(db.workOrders.projectId, options.projectId));
    }
    
    const tickets = await sdk.db
      .select({
        id: db.workOrders.id,
        workOrderNumber: db.workOrders.workOrderNumber,
        title: db.workOrders.title,
        status: db.workOrders.status,
        priority: db.workOrders.priority,
        projectName: db.projects.name,
        createdAt: db.workOrders.createdAt,
      })
      .from(db.workOrders)
      .leftJoin(db.projects, eq(db.workOrders.projectId, db.projects.id))
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
      .map((t, i) => `${i + 1}. ${priorityEmoji[t.priority || "medium"] || "⚪"} **#${t.workOrderNumber}** - ${t.title}\n   Status: ${t.status}${t.projectName ? ` | ${t.projectName}` : ""}`)
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
    // Generate work order number
    const workOrderNumber = `WO-${Date.now().toString(36).toUpperCase()}`;
    
    // Create the work order
    const [result] = await sdk.db.insert(db.workOrders).values({
      organizationId: context.organizationId,
      projectId: params.projectId,
      assetId: params.assetId,
      workOrderNumber,
      title: params.title,
      description: params.description,
      priority: params.priority,
      status: "open",
      createdBy: context.userId,
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
    const conditions = [eq(db.obligations.organizationId, context.organizationId)];
    
    if (projectId) {
      // Would need to join through obligationLinks
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
    
    // Get upcoming due dates
    const upcoming = await sdk.db
      .select({
        id: db.obligations.id,
        title: db.obligations.title,
        dueDate: db.obligations.dueDate,
        status: db.obligations.status,
      })
      .from(db.obligations)
      .where(and(
        eq(db.obligations.organizationId, context.organizationId),
        gte(db.obligations.dueDate, new Date()),
        lte(db.obligations.dueDate, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(db.obligations.dueDate)
      .limit(5);
    
    await incrementCapabilityUsage(context.organizationId, capabilityId);
    
    const statusMap: Record<string, number> = {};
    for (const ob of obligations) {
      statusMap[ob.status || "pending"] = ob.count;
    }
    
    const upcomingList = upcoming
      .map(o => `• ${o.title} - Due: ${o.dueDate ? new Date(o.dueDate).toLocaleDateString() : "N/A"}`)
      .join("\n");
    
    return {
      success: true,
      data: {
        statusCounts: statusMap,
        upcoming,
      },
      message: `📋 **Compliance Status**\n\n` +
        `✅ Compliant: ${statusMap.compliant || 0}\n` +
        `⏳ Pending: ${statusMap.pending || 0}\n` +
        `⚠️ At Risk: ${statusMap.at_risk || 0}\n` +
        `❌ Overdue: ${statusMap.overdue || 0}\n\n` +
        `**Upcoming (30 days):**\n${upcomingList || "No upcoming obligations"}`,
    };
  } catch (error) {
    console.error("[OpenClaw Skills] Error getting compliance status:", error);
    return { success: false, error: "Failed to get compliance status" };
  }
}
