/**
 * AI Tool Registry - Single source of truth for all AI-callable tools
 * 
 * All tools must:
 * - Be registered here
 * - Use createCaller(ctx-as-user) for execution
 * - Respect RBAC permissions
 * - Support confirmation gates for high-impact actions
 * 
 * Cross-channel parity: Same tools available for web, WhatsApp, email, API
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getRolePermissions, isHighImpactAction } from "../policies";

// ============================================================================
// Tool Definition Types
// ============================================================================

export interface ToolExecutionContext {
  userId: number;
  orgId: number;
  userRole: string;
  channel: "web" | "whatsapp" | "email" | "api";
  correlationId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationId?: string;
}

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  requiredPermission: "read" | "write" | "delete" | "share" | "verify";
  requiresConfirmation: boolean;
  allowedRoles: string[];
  execute: (input: unknown, ctx: ToolExecutionContext) => Promise<ToolResult>;
}

// ============================================================================
// Tool Registry
// ============================================================================

const toolRegistry = new Map<string, RegisteredTool>();

export function registerTool(tool: RegisteredTool): void {
  if (toolRegistry.has(tool.name)) {
    console.warn(`[Tool Registry] Overwriting existing tool: ${tool.name}`);
  }
  toolRegistry.set(tool.name, tool);
}

export function getTool(name: string): RegisteredTool | undefined {
  return toolRegistry.get(name);
}

export function getAllTools(): RegisteredTool[] {
  return Array.from(toolRegistry.values());
}

export function getToolsForRole(role: string): RegisteredTool[] {
  return getAllTools().filter(tool => tool.allowedRoles.includes(role));
}

// ============================================================================
// Tool Execution
// ============================================================================

export async function executeTool(
  toolName: string,
  input: unknown,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  const tool = getTool(toolName);
  
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }
  
  // Check role permission
  if (!tool.allowedRoles.includes(ctx.userRole)) {
    return {
      success: false,
      error: `Permission denied: ${toolName} requires role ${tool.allowedRoles.join(" or ")}`,
    };
  }
  
  // Check specific permission
  const permissions = getRolePermissions(ctx.userRole);
  const permissionMap: Record<string, boolean> = {
    read: permissions.canRead,
    write: permissions.canWrite,
    delete: permissions.canDelete,
    share: permissions.canShare,
    verify: permissions.canVerify,
  };
  
  if (!permissionMap[tool.requiredPermission]) {
    return {
      success: false,
      error: `Permission denied: ${ctx.userRole} cannot ${tool.requiredPermission}`,
    };
  }
  
  // Validate input
  const parseResult = tool.inputSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid input: ${parseResult.error.message}`,
    };
  }
  
  // Check if confirmation is required
  if (tool.requiresConfirmation) {
    // Return a confirmation request instead of executing
    return {
      success: true,
      requiresConfirmation: true,
      data: {
        toolName,
        input: parseResult.data,
        message: `This action requires confirmation. Reply YES to proceed with: ${tool.description}`,
      },
    };
  }
  
  // Execute the tool
  try {
    return await tool.execute(parseResult.data, ctx);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Tool execution failed: ${message}`,
    };
  }
}

// ============================================================================
// Convert to OpenAI Tool Format
// ============================================================================

export function toOpenAIToolFormat(tool: RegisteredTool): {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
} {
  // Convert Zod schema to JSON Schema
  const jsonSchema = zodToJsonSchema(tool.inputSchema);
  
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: jsonSchema,
    },
  };
}

export function getOpenAITools(role: string): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: unknown;
  };
}> {
  return getToolsForRole(role).map(toOpenAIToolFormat);
}

// ============================================================================
// Zod to JSON Schema Converter (simplified)
// ============================================================================

function zodToJsonSchema(schema: z.ZodType<unknown>): unknown {
  // This is a simplified converter - in production, use zod-to-json-schema
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodType<unknown>);
      if (!(value as z.ZodType<unknown>).isOptional()) {
        required.push(key);
      }
    }
    
    return {
      type: "object",
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }
  
  if (schema instanceof z.ZodString) {
    return { type: "string", description: schema.description };
  }
  
  if (schema instanceof z.ZodNumber) {
    return { type: "number", description: schema.description };
  }
  
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean", description: schema.description };
  }
  
  if (schema instanceof z.ZodArray) {
    return {
      type: "array",
      items: zodToJsonSchema(schema.element),
    };
  }
  
  if (schema instanceof z.ZodEnum) {
    return {
      type: "string",
      enum: schema.options,
    };
  }
  
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  
  // Default fallback
  return { type: "string" };
}

// ============================================================================
// Export
// ============================================================================

export { toolRegistry };
