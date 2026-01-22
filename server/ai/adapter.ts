/**
 * AI Gateway Adapter
 * 
 * This module provides a drop-in replacement for invokeLLM that routes
 * through the AI Gateway with proper task classification, budget enforcement,
 * and telemetry tracking.
 * 
 * Usage:
 * - Replace `import { invokeLLM } from "./_core/llm"` with
 *   `import { invokeAI } from "./ai/adapter"`
 * - Add the `task` parameter to specify the KIISHA task type
 */

import { runTask } from "./gateway";
import { KiishaTask, AIMessage, GatewayRequest, GatewayResponse } from "./types";
import { invokeLLM, InvokeParams, InvokeResult } from "../_core/llm";

// ============================================================================
// Adapter Types
// ============================================================================

export interface InvokeAIParams extends Omit<InvokeParams, "messages"> {
  /** KIISHA task type - required for routing and policy enforcement */
  task: KiishaTask;
  /** User ID for budget tracking and audit */
  userId?: number;
  /** Organization ID for budget enforcement */
  orgId?: number;
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Channel for cross-channel parity */
  channel?: "web" | "whatsapp" | "email" | "api";
  /** Messages in OpenAI format */
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    name?: string;
    tool_call_id?: string;
  }>;
}

export interface InvokeAIResult extends InvokeResult {
  /** Tracking metadata */
  _meta?: {
    task: KiishaTask;
    provider: string;
    model: string;
    tokensUsed: number;
    latencyMs: number;
    cached: boolean;
  };
}

// ============================================================================
// Main Adapter Function
// ============================================================================

/**
 * Invoke AI through the gateway with proper task classification.
 * 
 * This is the recommended way to call LLMs in KIISHA.
 * It provides:
 * - Task-based routing to optimal models
 * - Org budget enforcement
 * - Telemetry and audit logging
 * - Retry with fallback providers
 * - Structured output validation
 */
export async function invokeAI(params: InvokeAIParams): Promise<InvokeAIResult> {
  const startTime = Date.now();
  
  // Convert messages to gateway format
  const messages: AIMessage[] = params.messages.map(msg => ({
    role: msg.role,
    content: typeof msg.content === "string" 
      ? msg.content 
      : msg.content.map(c => {
          if (c.type === "text") return { type: "text" as const, text: c.text || "" };
          if (c.type === "image_url") return { 
            type: "image_url" as const, 
            image_url: { url: c.image_url?.url || "" } 
          };
          return { type: "text" as const, text: "" };
        }),
    name: msg.name,
    tool_call_id: msg.tool_call_id,
  }));
  
  // Build gateway request
  const request: GatewayRequest = {
    task: params.task,
    messages,
    userId: params.userId,
    orgId: params.orgId,
    correlationId: params.correlationId,
    channel: params.channel || "api",
  };
  
  // Add optional parameters
  if (params.tools) {
    request.tools = params.tools as any;
  }
  if (params.tool_choice) {
    request.toolChoice = params.tool_choice as any;
  }
  if (params.response_format) {
    request.responseFormat = params.response_format as any;
  }
  
  try {
    // Route through gateway
    const response = await runTask(request);
    
    const latencyMs = Date.now() - startTime;
    
    // Convert gateway response to invokeLLM format
    const result: InvokeAIResult = {
      choices: [{
        message: {
          role: "assistant",
          content: response.content || '',
          tool_calls: response.toolCalls,
        },
        finish_reason: response.finishReason,
        index: 0,
      }],
      usage: {
        prompt_tokens: response.usage?.promptTokens || 0,
        completion_tokens: response.usage?.completionTokens || 0,
        total_tokens: response.usage?.totalTokens || 0,
      },
      model: response.model,
      _meta: {
        task: params.task,
        provider: response.provider,
        model: response.model,
        tokensUsed: response.usage?.totalTokens || 0,
        latencyMs,
        cached: (response as any).cached || false,
      },
    };
    
    return result;
  } catch (error) {
    // On gateway failure, fall back to direct invokeLLM
    console.warn("[AI Adapter] Gateway failed, falling back to direct LLM:", error);
    
    const fallbackResult = await invokeLLM({
      messages: params.messages as InvokeParams["messages"],
      tools: params.tools,
      tool_choice: params.tool_choice,
      response_format: params.response_format,
    });
    
    return {
      ...fallbackResult,
      _meta: {
        task: params.task,
        provider: "forge",
        model: fallbackResult.model || "forge-default",
        tokensUsed: fallbackResult.usage?.total_tokens || 0,
        latencyMs: Date.now() - startTime,
        cached: false,
      },
    };
  }
}

// ============================================================================
// Task-Specific Helpers
// ============================================================================

/**
 * Classify document type using AI
 */
export async function classifyDocument(
  content: string,
  options?: { userId?: number; orgId?: number }
): Promise<{ type: string; confidence: number }> {
  const response = await invokeAI({
    task: "DOC_CLASSIFY",
    messages: [
      {
        role: "system",
        content: "You are a document classification expert. Classify the document type and return JSON with 'type' and 'confidence' fields.",
      },
      {
        role: "user",
        content: `Classify this document:\n\n${content.substring(0, 5000)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "document_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            type: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["type", "confidence"],
          additionalProperties: false,
        },
      },
    },
    ...options,
  });
  
  try {
    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : "{}");
  } catch {
    return { type: "unknown", confidence: 0 };
  }
}

/**
 * Extract fields from document with evidence tracking
 */
export async function extractFields(
  content: string,
  schema: Record<string, { type: string; description: string }>,
  options?: { userId?: number; orgId?: number }
): Promise<{
  fields: Record<string, unknown>;
  evidence: Array<{ field: string; source: string; location?: string }>;
}> {
  const fieldDescriptions = Object.entries(schema)
    .map(([name, def]) => `- ${name}: ${def.description} (${def.type})`)
    .join("\n");
  
  const response = await invokeAI({
    task: "DOC_EXTRACT_FIELDS",
    messages: [
      {
        role: "system",
        content: `You are a document extraction expert. Extract the requested fields and provide evidence for each extraction.
        
Return JSON with:
- "fields": object with extracted values
- "evidence": array of { field, source, location } for each extraction

Fields to extract:
${fieldDescriptions}`,
      },
      {
        role: "user",
        content: content.substring(0, 10000),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "field_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            fields: { type: "object" },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string" },
                  source: { type: "string" },
                  location: { type: "string" },
                },
                required: ["field", "source"],
              },
            },
          },
          required: ["fields", "evidence"],
          additionalProperties: false,
        },
      },
    },
    ...options,
  });
  
  try {
    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : "{}");
  } catch {
    return { fields: {}, evidence: [] };
  }
}

/**
 * Draft RFI response based on available data
 */
export async function draftRFIResponse(
  question: string,
  context: string,
  options?: { userId?: number; orgId?: number }
): Promise<{ response: string; sources: string[] }> {
  const response = await invokeAI({
    task: "RFI_DRAFT_RESPONSE",
    messages: [
      {
        role: "system",
        content: `You are an RFI response assistant. Draft a professional response based only on the provided context.
        
Return JSON with:
- "response": the drafted response text
- "sources": array of source references used`,
      },
      {
        role: "user",
        content: `Question: ${question}\n\nContext:\n${context}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rfi_response",
        strict: true,
        schema: {
          type: "object",
          properties: {
            response: { type: "string" },
            sources: { type: "array", items: { type: "string" } },
          },
          required: ["response", "sources"],
          additionalProperties: false,
        },
      },
    },
    ...options,
  });
  
  try {
    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : "{}");
  } catch {
    return { response: "", sources: [] };
  }
}

/**
 * Classify user intent for chat routing
 */
export async function classifyIntent(
  message: string,
  options?: { userId?: number; orgId?: number }
): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, string>;
}> {
  const response = await invokeAI({
    task: "INTENT_CLASSIFY",
    messages: [
      {
        role: "system",
        content: `Classify the user's intent and extract entities. Return JSON with:
- "intent": one of [query_asset, query_document, create_rfi, update_vatr, general_question, navigation]
- "confidence": 0-1 confidence score
- "entities": extracted entities like asset_id, document_type, etc.`,
      },
      {
        role: "user",
        content: message,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intent_classification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intent: { type: "string" },
            confidence: { type: "number" },
            entities: { type: "object" },
          },
          required: ["intent", "confidence", "entities"],
          additionalProperties: false,
        },
      },
    },
    ...options,
  });
  
  try {
    const content = response.choices[0].message.content;
    return JSON.parse(typeof content === 'string' ? content : "{}");
  } catch {
    return { intent: "general_question", confidence: 0, entities: {} };
  }
}
