/**
 * RFI Tools - AI-callable tools for RFI and request operations
 * 
 * These tools wrap tRPC procedures and enforce RBAC.
 */

import { z } from "zod";
import { registerTool, ToolExecutionContext, ToolResult } from "./registry";
import { createCaller } from "../../routers";

// ============================================================================
// List RFIs Tool
// ============================================================================

const listRfisInput = z.object({
  projectId: z.number().optional().describe("Filter by project ID"),
  status: z.enum(["open", "pending", "resolved", "all"]).default("open").describe("RFI status filter"),
  assignedToMe: z.boolean().default(false).describe("Only show RFIs assigned to current user"),
  limit: z.number().default(50).describe("Maximum results to return"),
});

registerTool({
  name: "list_rfis",
  description: "List RFIs (Requests for Information) in the project. Returns RFI metadata including title, status, assignee, and due date.",
  inputSchema: listRfisInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = listRfisInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const rfis = await caller.rfis.list({
        projectId: parsed.projectId,
        status: parsed.status === "all" ? undefined : parsed.status,
        assignedToUserId: parsed.assignedToMe ? ctx.userId : undefined,
        limit: parsed.limit,
      });
      
      return {
        success: true,
        data: rfis,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list RFIs",
      };
    }
  },
});

// ============================================================================
// Get RFI Details Tool
// ============================================================================

const getRfiInput = z.object({
  rfiId: z.number().describe("The RFI ID to retrieve"),
});

registerTool({
  name: "get_rfi",
  description: "Get detailed information about a specific RFI including its question, linked documents, comments, and response history.",
  inputSchema: getRfiInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getRfiInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const rfi = await caller.rfis.getById({
        id: parsed.rfiId,
      });
      
      return {
        success: true,
        data: rfi,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get RFI",
      };
    }
  },
});

// ============================================================================
// Draft RFI Response Tool (requires confirmation)
// ============================================================================

const draftRfiResponseInput = z.object({
  rfiId: z.number().describe("The RFI ID to respond to"),
  responseText: z.string().describe("The drafted response text"),
  linkedDocumentIds: z.array(z.number()).optional().describe("Document IDs to link as evidence"),
});

registerTool({
  name: "draft_rfi_response",
  description: "Draft a response to an RFI. The response will be saved as a draft and must be reviewed before sending. Requires confirmation.",
  inputSchema: draftRfiResponseInput,
  requiredPermission: "write",
  requiresConfirmation: true,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = draftRfiResponseInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      await caller.rfis.draftResponse({
        rfiId: parsed.rfiId,
        response: parsed.responseText,
        linkedDocumentIds: parsed.linkedDocumentIds,
      });
      
      return {
        success: true,
        data: { 
          message: "RFI response drafted successfully. Please review before sending.",
          status: "draft",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to draft RFI response",
      };
    }
  },
});

// ============================================================================
// Add RFI Comment Tool
// ============================================================================

const addRfiCommentInput = z.object({
  rfiId: z.number().describe("The RFI ID to comment on"),
  comment: z.string().describe("The comment text"),
  isInternal: z.boolean().default(false).describe("Whether this is an internal-only comment"),
});

registerTool({
  name: "add_rfi_comment",
  description: "Add a comment to an RFI for discussion or clarification.",
  inputSchema: addRfiCommentInput,
  requiredPermission: "write",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = addRfiCommentInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      await caller.rfis.addComment({
        rfiId: parsed.rfiId,
        comment: parsed.comment,
        isInternal: parsed.isInternal,
      });
      
      return {
        success: true,
        data: { message: "Comment added successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add comment",
      };
    }
  },
});

// ============================================================================
// Link Document to RFI Tool
// ============================================================================

const linkDocumentToRfiInput = z.object({
  rfiId: z.number().describe("The RFI ID"),
  documentId: z.number().describe("The document ID to link"),
  relevanceNote: z.string().optional().describe("Note explaining why this document is relevant"),
});

registerTool({
  name: "link_document_to_rfi",
  description: "Link a document to an RFI as supporting evidence or reference.",
  inputSchema: linkDocumentToRfiInput,
  requiredPermission: "write",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = linkDocumentToRfiInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      await caller.rfis.linkDocument({
        rfiId: parsed.rfiId,
        documentId: parsed.documentId,
        note: parsed.relevanceNote,
      });
      
      return {
        success: true,
        data: { message: "Document linked to RFI successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to link document",
      };
    }
  },
});

// ============================================================================
// Get RFI Statistics Tool
// ============================================================================

const getRfiStatsInput = z.object({
  projectId: z.number().optional().describe("Filter by project ID"),
  dateRange: z.enum(["week", "month", "quarter", "year"]).default("month").describe("Time range for statistics"),
});

registerTool({
  name: "get_rfi_statistics",
  description: "Get statistics about RFIs including counts by status, average response time, and trends.",
  inputSchema: getRfiStatsInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getRfiStatsInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const stats = await caller.rfis.getStatistics({
        projectId: parsed.projectId,
        dateRange: parsed.dateRange,
      });
      
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get RFI statistics",
      };
    }
  },
});

// ============================================================================
// Export registered tools
// ============================================================================

export const rfiToolNames = [
  "list_rfis",
  "get_rfi",
  "draft_rfi_response",
  "add_rfi_comment",
  "link_document_to_rfi",
  "get_rfi_statistics",
];
