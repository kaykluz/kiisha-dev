/**
 * Document Tools - AI-callable tools for document operations
 * 
 * These tools wrap tRPC procedures and enforce RBAC.
 */

import { z } from "zod";
import { registerTool, ToolExecutionContext, ToolResult } from "./registry";
import { createCaller } from "../../routers";
import { getDb } from "../../db";

// ============================================================================
// Search Documents Tool
// ============================================================================

const searchDocumentsInput = z.object({
  query: z.string().describe("Search query for documents"),
  projectId: z.number().optional().describe("Filter by project ID"),
  categoryId: z.number().optional().describe("Filter by category ID"),
  limit: z.number().default(20).describe("Maximum results to return"),
});

registerTool({
  name: "search_documents",
  description: "Search for documents in the current project or organization. Returns document metadata including title, category, and upload date.",
  inputSchema: searchDocumentsInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = searchDocumentsInput.parse(input);
    
    try {
      // Use tRPC caller with user context
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const results = await caller.documents.search({
        query: parsed.query,
        projectId: parsed.projectId,
        limit: parsed.limit,
      });
      
      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});

// ============================================================================
// Get Document Details Tool
// ============================================================================

const getDocumentInput = z.object({
  documentId: z.number().describe("The document ID to retrieve"),
});

registerTool({
  name: "get_document",
  description: "Get detailed information about a specific document including its content, metadata, and linked entities.",
  inputSchema: getDocumentInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getDocumentInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const document = await caller.documents.getById({
        id: parsed.documentId,
      });
      
      return {
        success: true,
        data: document,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get document",
      };
    }
  },
});

// ============================================================================
// List Document Categories Tool
// ============================================================================

const listCategoriesInput = z.object({
  projectId: z.number().optional().describe("Filter by project ID"),
});

registerTool({
  name: "list_document_categories",
  description: "List all document categories available in the project or organization.",
  inputSchema: listCategoriesInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = listCategoriesInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const categories = await caller.documents.listCategories({
        projectId: parsed.projectId,
      });
      
      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list categories",
      };
    }
  },
});

// ============================================================================
// Update Document Category Tool (requires confirmation)
// ============================================================================

const updateCategoryInput = z.object({
  documentId: z.number().describe("The document ID to update"),
  categoryId: z.number().describe("The new category ID"),
  reason: z.string().optional().describe("Reason for the category change"),
});

registerTool({
  name: "update_document_category",
  description: "Change the category of a document. This action requires confirmation.",
  inputSchema: updateCategoryInput,
  requiredPermission: "write",
  requiresConfirmation: true,
  allowedRoles: ["admin", "editor"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = updateCategoryInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      await caller.documents.updateCategory({
        documentId: parsed.documentId,
        categoryId: parsed.categoryId,
      });
      
      return {
        success: true,
        data: { message: "Document category updated successfully" },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update category",
      };
    }
  },
});

// ============================================================================
// Get Document Summary Tool
// ============================================================================

const getDocumentSummaryInput = z.object({
  documentId: z.number().describe("The document ID to summarize"),
});

registerTool({
  name: "get_document_summary",
  description: "Get an AI-generated summary of a document's contents.",
  inputSchema: getDocumentSummaryInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getDocumentSummaryInput.parse(input);
    
    try {
      // This would call the AI gateway for summarization
      // For now, return a placeholder
      return {
        success: true,
        data: {
          documentId: parsed.documentId,
          summary: "Document summary would be generated here using the AI Gateway.",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate summary",
      };
    }
  },
});

// ============================================================================
// Export registered tools
// ============================================================================

export const documentToolNames = [
  "search_documents",
  "get_document",
  "list_document_categories",
  "update_document_category",
  "get_document_summary",
];
