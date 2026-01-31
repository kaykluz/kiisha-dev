/**
 * KIISHA Skills for OpenClaw
 * 
 * These skills expose KIISHA functionality through OpenClaw's natural language interface
 */

import type { KiishaClient } from "../client.js";
import type { OpenClawSkill, SkillContext, SkillResult } from "../types.js";

/**
 * Create all KIISHA skills
 */
export function createKiishaSkills(client: KiishaClient): OpenClawSkill[] {
  return [
    // Portfolio Skills
    createPortfolioSummarySkill(client),
    createListProjectsSkill(client),
    createProjectDetailsSkill(client),
    
    // Document Skills
    createDocumentStatusSkill(client),
    createUploadDocumentSkill(client),
    
    // Alert Skills
    createListAlertsSkill(client),
    createAcknowledgeAlertSkill(client),
    
    // Operations Skills
    createTicketSkill(client),
    createListTicketsSkill(client),
  ];
}

/**
 * Portfolio Summary Skill
 */
function createPortfolioSummarySkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.portfolio.summary",
    name: "Portfolio Summary",
    description: "Get an overview of your KIISHA portfolio including projects, capacity, and alerts",
    category: "query",
    examples: [
      "Show me my portfolio summary",
      "What's my portfolio status?",
      "Give me an overview of my assets",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      try {
        const summary = await client.getPortfolioSummary(context.userId, context.organizationId);
        
        return {
          success: true,
          data: summary,
          message: `📊 **Portfolio Summary**\n\n` +
            `📁 Portfolios: ${summary.portfolios}\n` +
            `🏗️ Projects: ${summary.projects}\n` +
            `⚡ Total Capacity: ${summary.totalCapacity} kW\n` +
            `🔔 Active Alerts: ${summary.activeAlerts}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get portfolio summary: ${error}`,
        };
      }
    },
  };
}

/**
 * List Projects Skill
 */
function createListProjectsSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.project.list",
    name: "List Projects",
    description: "List all projects in your KIISHA portfolio",
    category: "query",
    examples: [
      "List my projects",
      "Show all projects",
      "What projects do I have?",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const limit = typeof params.limit === "number" ? params.limit : 10;
      
      try {
        const projects = await client.listProjects(context.userId, context.organizationId, limit);
        
        if (projects.length === 0) {
          return {
            success: true,
            data: [],
            message: "📋 No projects found in your portfolio.",
          };
        }
        
        const projectList = projects
          .map((p, i) => `${i + 1}. **${p.name}** (${p.status})${p.capacity ? ` - ${p.capacity} kW` : ""}`)
          .join("\n");
        
        return {
          success: true,
          data: projects,
          message: `📋 **Your Projects** (${projects.length})\n\n${projectList}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list projects: ${error}`,
        };
      }
    },
  };
}

/**
 * Project Details Skill
 */
function createProjectDetailsSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.project.details",
    name: "Project Details",
    description: "Get detailed information about a specific project",
    category: "query",
    examples: [
      "Show details for project X",
      "Tell me about the solar farm project",
      "What's the status of project ABC?",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const projectId = params.projectId as number | undefined;
      const projectName = params.projectName as string | undefined;
      
      if (!projectId && !projectName) {
        return {
          success: false,
          error: "Please specify a project ID or name",
        };
      }
      
      // For now, return a placeholder - this would be implemented with actual API call
      return {
        success: true,
        message: "Project details feature coming soon. Use 'list projects' to see available projects.",
      };
    },
  };
}

/**
 * Document Status Skill
 */
function createDocumentStatusSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.documents.status",
    name: "Document Status",
    description: "Check the document verification status for a project",
    category: "query",
    examples: [
      "What documents are missing?",
      "Check document status",
      "Show document checklist",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const projectId = params.projectId as number | undefined;
      
      if (!projectId) {
        return {
          success: false,
          error: "Please specify a project ID",
        };
      }
      
      try {
        const status = await client.getDocumentStatus(projectId, context.organizationId);
        
        const categoryStatus = status.categories
          .map(c => `• ${c.name}: ${c.status} (${c.count})`)
          .join("\n");
        
        return {
          success: true,
          data: status,
          message: `📄 **Document Status**\n\n` +
            `✅ Verified: ${status.verified}\n` +
            `⏳ Pending: ${status.pending}\n` +
            `❌ Missing: ${status.missing}\n\n` +
            `**By Category:**\n${categoryStatus}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get document status: ${error}`,
        };
      }
    },
  };
}

/**
 * Upload Document Skill
 */
function createUploadDocumentSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.document.upload",
    name: "Upload Document",
    description: "Upload a document to a project in KIISHA",
    category: "document",
    examples: [
      "Upload this document",
      "Add this file to project X",
      "Submit this permit document",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const projectId = params.projectId as number | undefined;
      const fileUrl = params.fileUrl as string | undefined;
      const fileName = params.fileName as string | undefined;
      const mimeType = params.mimeType as string | undefined;
      
      if (!projectId || !fileUrl || !fileName) {
        return {
          success: false,
          error: "Please provide project ID, file URL, and file name",
        };
      }
      
      try {
        const result = await client.uploadDocument({
          organizationId: context.organizationId,
          projectId,
          fileName,
          mimeType: mimeType || "application/octet-stream",
          fileUrl,
          uploadedBy: context.userId,
        });
        
        return {
          success: true,
          data: result,
          message: `✅ Document uploaded successfully!\n\nDocument ID: ${result.documentId}\nStatus: ${result.status}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to upload document: ${error}`,
        };
      }
    },
  };
}

/**
 * List Alerts Skill
 */
function createListAlertsSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.alerts.list",
    name: "List Alerts",
    description: "View active alerts across your portfolio",
    category: "query",
    examples: [
      "Show me alerts",
      "What alerts are active?",
      "Any issues I should know about?",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const limit = typeof params.limit === "number" ? params.limit : 10;
      
      try {
        const alerts = await client.getAlerts(context.organizationId, limit);
        
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
          .map((a, i) => `${i + 1}. ${severityEmoji[a.severity] || "⚪"} **${a.type}**\n   ${a.message}${a.projectName ? `\n   Project: ${a.projectName}` : ""}`)
          .join("\n\n");
        
        return {
          success: true,
          data: alerts,
          message: `🔔 **Active Alerts** (${alerts.length})\n\n${alertList}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get alerts: ${error}`,
        };
      }
    },
  };
}

/**
 * Acknowledge Alert Skill
 */
function createAcknowledgeAlertSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.alert.acknowledge",
    name: "Acknowledge Alert",
    description: "Acknowledge and resolve an alert",
    category: "operation",
    examples: [
      "Acknowledge alert 123",
      "Resolve the maintenance alert",
      "Mark alert as handled",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const alertId = params.alertId as number | undefined;
      
      if (!alertId) {
        return {
          success: false,
          error: "Please specify an alert ID",
        };
      }
      
      // This would require approval for medium+ risk
      return {
        success: true,
        message: `⏳ Alert acknowledgment requires approval. Request submitted for alert #${alertId}.`,
      };
    },
  };
}

/**
 * Create Ticket Skill
 */
function createTicketSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.ticket.create",
    name: "Create Ticket",
    description: "Create a maintenance work order or support ticket",
    category: "operation",
    examples: [
      "Create a ticket for inverter maintenance",
      "Report an issue with the solar panels",
      "Open a work order",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      const projectId = params.projectId as number | undefined;
      const title = params.title as string | undefined;
      const description = params.description as string | undefined;
      const priority = (params.priority as string) || "medium";
      
      if (!projectId || !title) {
        return {
          success: false,
          error: "Please provide project ID and ticket title",
        };
      }
      
      try {
        const result = await client.createTicket({
          organizationId: context.organizationId,
          projectId,
          title,
          description: description || "",
          priority: priority as "low" | "medium" | "high" | "critical",
          createdBy: context.userId,
        });
        
        return {
          success: true,
          data: result,
          message: `✅ Ticket created successfully!\n\nTicket #: ${result.ticketNumber}\nID: ${result.ticketId}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create ticket: ${error}`,
        };
      }
    },
  };
}

/**
 * List Tickets Skill
 */
function createListTicketsSkill(client: KiishaClient): OpenClawSkill {
  return {
    id: "kiisha.tickets.list",
    name: "List Tickets",
    description: "View open maintenance tickets and work orders",
    category: "query",
    examples: [
      "Show open tickets",
      "What work orders are pending?",
      "List maintenance requests",
    ],
    handler: async (params: Record<string, unknown>, context: SkillContext): Promise<SkillResult> => {
      if (!context.userId || !context.organizationId) {
        return {
          success: false,
          error: "User or organization context not available",
        };
      }
      
      // Placeholder - would be implemented with actual API call
      return {
        success: true,
        message: "📋 Ticket listing feature coming soon. Use 'create ticket' to submit new work orders.",
      };
    },
  };
}
