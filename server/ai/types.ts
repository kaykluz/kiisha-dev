/**
 * KIISHA AI Types - Core type definitions for the AI orchestration layer
 * 
 * All AI calls must be one of the enumerated KIISHA tasks.
 * No freeform AI mode allowed.
 */

import { z } from "zod";

// ============================================================================
// KIISHA Task Enum - The ONLY allowed AI operations
// ============================================================================

export const KiishaTaskSchema = z.enum([
  "INTENT_CLASSIFY",           // Router intent classification for chat
  "DOC_CLASSIFY",              // Document type/category classification
  "DOC_EXTRACT_FIELDS",        // Extraction with evidence refs
  "DOC_SUMMARIZE",             // Safe summary within access
  "DOC_COMPARE_VERSIONS",      // Diff detection and change summary
  "LINK_SUGGEST_PRIMARY",      // Propose primary entity linking
  "LINK_SUGGEST_SECONDARY",    // Propose dataroom/checklist links
  "RFI_DRAFT_RESPONSE",        // Draft structured responses based on allowed data
  "REQUEST_TEMPLATE_ASSIST",   // Help create field packs/templates (admin only)
  "QUALITY_SCORE",             // Submission quality score
  "VALIDATE_CONSISTENCY",      // Cross-check extracted vs VATR vs prior docs
  "CHAT_RESPONSE",             // Conversational response restricted to KIISHA tools
  "OCR_EXTRACT",               // OCR pipeline
  "GEO_PARSE",                 // Parse GIS / coordinates / site data
]);

export type KiishaTask = z.infer<typeof KiishaTaskSchema>;

// ============================================================================
// Provider Types
// ============================================================================

export const AIProviderSchema = z.enum([
  "openai",
  "anthropic", 
  "forge",
  "azure_openai",
  "gemini",
  "deepseek",
]);

export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIModelSchema = z.object({
  provider: AIProviderSchema,
  modelId: z.string(),
  displayName: z.string(),
  maxTokens: z.number(),
  supportsVision: z.boolean().default(false),
  supportsTools: z.boolean().default(true),
  costPer1kInput: z.number().optional(),
  costPer1kOutput: z.number().optional(),
});

export type AIModel = z.infer<typeof AIModelSchema>;

// ============================================================================
// Message Types (OpenAI-compatible format)
// ============================================================================

export const MessageRoleSchema = z.enum(["system", "user", "assistant", "tool"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ImageContentSchema = z.object({
  type: z.literal("image_url"),
  image_url: z.object({
    url: z.string(),
    detail: z.enum(["auto", "low", "high"]).optional(),
  }),
});

export const FileContentSchema = z.object({
  type: z.literal("file_url"),
  file_url: z.object({
    url: z.string(),
    mime_type: z.string().optional(),
  }),
});

export const MessageContentSchema = z.union([
  z.string(),
  z.array(z.union([TextContentSchema, ImageContentSchema, FileContentSchema])),
]);

export const AIMessageSchema = z.object({
  role: MessageRoleSchema,
  content: MessageContentSchema,
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export type AIMessage = z.infer<typeof AIMessageSchema>;

// ============================================================================
// Tool Definition Types
// ============================================================================

export const ToolParameterSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
  items: z.any().optional(),
  properties: z.record(z.any()).optional(),
  required: z.array(z.string()).optional(),
});

export const ToolDefinitionSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
      type: z.literal("object"),
      properties: z.record(ToolParameterSchema),
      required: z.array(z.string()).optional(),
    }),
  }),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ============================================================================
// Gateway Request/Response Types
// ============================================================================

export const GatewayRequestSchema = z.object({
  task: KiishaTaskSchema,
  messages: z.array(AIMessageSchema),
  tools: z.array(ToolDefinitionSchema).optional(),
  toolChoice: z.union([
    z.literal("none"),
    z.literal("auto"),
    z.literal("required"),
    z.object({
      type: z.literal("function"),
      function: z.object({ name: z.string() }),
    }),
  ]).optional(),
  responseFormat: z.object({
    type: z.literal("json_schema"),
    json_schema: z.object({
      name: z.string(),
      strict: z.boolean().optional(),
      schema: z.any(),
    }),
  }).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).optional(),
  // Context for RBAC and auditing
  userId: z.number().optional(),
  orgId: z.number().optional(),
  correlationId: z.string().optional(),
  channel: z.enum(["web", "whatsapp", "email", "api"]).default("web"),
  // Optional overrides (superuser only)
  providerOverride: AIProviderSchema.optional(),
  modelOverride: z.string().optional(),
});

export type GatewayRequest = z.infer<typeof GatewayRequestSchema>;

export const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const GatewayResponseSchema = z.object({
  success: z.boolean(),
  content: z.string().nullable(),
  toolCalls: z.array(ToolCallSchema).optional(),
  finishReason: z.enum(["stop", "length", "tool_calls", "content_filter", "error"]),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
    totalTokens: z.number(),
  }),
  model: z.string(),
  provider: AIProviderSchema,
  latencyMs: z.number(),
  auditId: z.string(),
  error: z.string().optional(),
});

export type GatewayResponse = z.infer<typeof GatewayResponseSchema>;

// ============================================================================
// Evidence Reference Types
// ============================================================================

export const EvidenceRefSchema = z.object({
  documentId: z.number(),
  pageNumber: z.number().optional(),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
  textSpan: z.object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
  }).optional(),
  confidence: z.number().min(0).max(1),
  extractorRunId: z.string().optional(),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const ExtractedFieldSchema = z.object({
  fieldName: z.string(),
  value: z.any(),
  confidence: z.number().min(0).max(1),
  evidenceRefs: z.array(EvidenceRefSchema),
  requiresVerification: z.boolean().default(true),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

// ============================================================================
// Audit Types
// ============================================================================

export const AIAuditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  task: KiishaTaskSchema,
  userId: z.number(),
  orgId: z.number(),
  channel: z.enum(["web", "whatsapp", "email", "api"]),
  correlationId: z.string(),
  provider: AIProviderSchema,
  model: z.string(),
  promptVersionHash: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  latencyMs: z.number(),
  success: z.boolean(),
  toolCalls: z.array(z.object({
    name: z.string(),
    arguments: z.string(),
    result: z.string().optional(),
  })).optional(),
  outputSummary: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type AIAuditEntry = z.infer<typeof AIAuditEntrySchema>;

// ============================================================================
// Budget Types
// ============================================================================

export const OrgBudgetStatusSchema = z.object({
  orgId: z.number(),
  period: z.string(), // e.g., "2026-01"
  allocatedTokens: z.number(),
  consumedTokens: z.number(),
  remainingTokens: z.number(),
  percentUsed: z.number(),
  softLimitReached: z.boolean(),
  hardLimitReached: z.boolean(),
});

export type OrgBudgetStatus = z.infer<typeof OrgBudgetStatusSchema>;

// ============================================================================
// Confirmation Types
// ============================================================================

export const PendingConfirmationSchema = z.object({
  id: z.string(),
  userId: z.number(),
  orgId: z.number(),
  channel: z.enum(["web", "whatsapp", "email", "api"]),
  correlationId: z.string(),
  actionType: z.string(),
  actionDescription: z.string(),
  payload: z.any(), // Encrypted at rest
  expiresAt: z.date(),
  status: z.enum(["pending", "confirmed", "declined", "expired"]),
  createdAt: z.date(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.number().optional(),
});

export type PendingConfirmation = z.infer<typeof PendingConfirmationSchema>;

// ============================================================================
// Policy Types
// ============================================================================

export const TaskPolicySchema = z.object({
  task: KiishaTaskSchema,
  requiresConfirmation: z.boolean().default(false),
  requiresApproval: z.boolean().default(false),
  allowedRoles: z.array(z.string()),
  maxTokensPerCall: z.number().optional(),
  rateLimit: z.object({
    maxCallsPerMinute: z.number(),
    maxCallsPerHour: z.number(),
  }).optional(),
});

export type TaskPolicy = z.infer<typeof TaskPolicySchema>;
