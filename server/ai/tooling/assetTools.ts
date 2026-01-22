/**
 * Asset Tools - AI-callable tools for asset and VATR operations
 * 
 * These tools wrap tRPC procedures and enforce RBAC.
 */

import { z } from "zod";
import { registerTool, ToolExecutionContext, ToolResult } from "./registry";
import { createCaller } from "../../routers";

// ============================================================================
// List Assets Tool
// ============================================================================

const listAssetsInput = z.object({
  projectId: z.number().optional().describe("Filter by project ID"),
  portfolioId: z.number().optional().describe("Filter by portfolio ID"),
  status: z.enum(["active", "inactive", "all"]).default("active").describe("Asset status filter"),
  limit: z.number().default(50).describe("Maximum results to return"),
});

registerTool({
  name: "list_assets",
  description: "List renewable energy assets in the organization. Returns asset metadata including name, type, capacity, and location.",
  inputSchema: listAssetsInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = listAssetsInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const assets = await caller.assets.list({
        projectId: parsed.projectId,
        portfolioId: parsed.portfolioId,
        limit: parsed.limit,
      });
      
      return {
        success: true,
        data: assets,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list assets",
      };
    }
  },
});

// ============================================================================
// Get Asset Details Tool
// ============================================================================

const getAssetInput = z.object({
  assetId: z.number().describe("The asset ID to retrieve"),
});

registerTool({
  name: "get_asset",
  description: "Get detailed information about a specific renewable energy asset including VATR data, linked documents, and compliance status.",
  inputSchema: getAssetInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getAssetInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const asset = await caller.assets.getById({
        id: parsed.assetId,
      });
      
      return {
        success: true,
        data: asset,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get asset",
      };
    }
  },
});

// ============================================================================
// Get VATR Fields Tool
// ============================================================================

const getVatrFieldsInput = z.object({
  assetId: z.number().describe("The asset ID to get VATR fields for"),
  category: z.string().optional().describe("Filter by field category"),
});

registerTool({
  name: "get_vatr_fields",
  description: "Get VATR (Verified Asset Technical Record) fields for an asset. Returns field values with verification status and evidence references.",
  inputSchema: getVatrFieldsInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getVatrFieldsInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const fields = await caller.vatr.getFields({
        assetId: parsed.assetId,
        category: parsed.category,
      });
      
      return {
        success: true,
        data: fields,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get VATR fields",
      };
    }
  },
});

// ============================================================================
// Suggest VATR Field Value Tool (requires confirmation)
// ============================================================================

const suggestVatrValueInput = z.object({
  assetId: z.number().describe("The asset ID"),
  fieldName: z.string().describe("The VATR field name"),
  suggestedValue: z.string().describe("The suggested value"),
  evidenceDocumentId: z.number().describe("Document ID providing evidence"),
  evidencePageNumber: z.number().optional().describe("Page number in the evidence document"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
});

registerTool({
  name: "suggest_vatr_value",
  description: "Suggest a value for a VATR field with evidence reference. This creates a suggestion that must be verified by a human. Requires confirmation.",
  inputSchema: suggestVatrValueInput,
  requiredPermission: "write",
  requiresConfirmation: true,
  allowedRoles: ["admin", "editor"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = suggestVatrValueInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      await caller.vatr.suggestValue({
        assetId: parsed.assetId,
        fieldName: parsed.fieldName,
        value: parsed.suggestedValue,
        evidenceRef: {
          documentId: parsed.evidenceDocumentId,
          pageNumber: parsed.evidencePageNumber,
        },
        confidence: parsed.confidence,
      });
      
      return {
        success: true,
        data: { 
          message: "VATR field suggestion created. Awaiting verification.",
          requiresVerification: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to suggest VATR value",
      };
    }
  },
});

// ============================================================================
// Get Asset Compliance Status Tool
// ============================================================================

const getComplianceStatusInput = z.object({
  assetId: z.number().describe("The asset ID to check compliance for"),
});

registerTool({
  name: "get_asset_compliance",
  description: "Get the compliance status for an asset including pending items, alerts, and deadlines.",
  inputSchema: getComplianceStatusInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = getComplianceStatusInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const compliance = await caller.compliance.getAssetStatus({
        assetId: parsed.assetId,
      });
      
      return {
        success: true,
        data: compliance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get compliance status",
      };
    }
  },
});

// ============================================================================
// Compare Asset Versions Tool
// ============================================================================

const compareVersionsInput = z.object({
  assetId: z.number().describe("The asset ID"),
  fromVersion: z.number().describe("Earlier version number"),
  toVersion: z.number().describe("Later version number"),
});

registerTool({
  name: "compare_asset_versions",
  description: "Compare two versions of an asset's VATR data to see what changed.",
  inputSchema: compareVersionsInput,
  requiredPermission: "read",
  requiresConfirmation: false,
  allowedRoles: ["admin", "editor", "reviewer"],
  execute: async (input, ctx): Promise<ToolResult> => {
    const parsed = compareVersionsInput.parse(input);
    
    try {
      const caller = createCaller({
        user: { id: ctx.userId, orgId: ctx.orgId, role: ctx.userRole },
      } as any);
      
      const diff = await caller.vatr.compareVersions({
        assetId: parsed.assetId,
        fromVersion: parsed.fromVersion,
        toVersion: parsed.toVersion,
      });
      
      return {
        success: true,
        data: diff,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compare versions",
      };
    }
  },
});

// ============================================================================
// Export registered tools
// ============================================================================

export const assetToolNames = [
  "list_assets",
  "get_asset",
  "get_vatr_fields",
  "suggest_vatr_value",
  "get_asset_compliance",
  "compare_asset_versions",
];
