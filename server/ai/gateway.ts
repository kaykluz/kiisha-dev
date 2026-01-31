/**
 * KIISHA AI Gateway - The SINGLE entry point for all AI operations
 * 
 * This is the ONLY place that:
 * - Selects provider & model
 * - Executes completions
 * - Enforces policy
 * - Records usage + audits
 * - Validates structured outputs
 * - Supports retries/fallback
 * 
 * NO direct provider calls anywhere else in the codebase.
 */

import { v4 as uuidv4 } from "uuid";
import { 
  GatewayRequest, 
  GatewayResponse, 
  KiishaTask,
  AIProvider,
  AIMessage,
} from "./types";
import { 
  getProvider, 
  createProviderFactory,
  ProviderCompletionRequest,
} from "./providers";
import { 
  KIISHA_SYSTEM_PROMPT, 
  getTaskPolicy, 
  isTaskAllowedForRole,
  getRolePermissions,
} from "./policies";
import { selectRoute, selectFallback, withRetry, getRoutingConfig } from "./router";
import { 
  recordAuditEntry, 
  recordUsage, 
  hashPrompt,
  recordRealtimeMetric,
} from "./telemetry";
import { checkBudget, consumeBudget } from "./budget";

// ============================================================================
// Gateway Initialization
// ============================================================================

let initialized = false;

export async function initializeGateway(): Promise<void> {
  if (initialized) return;
  
  await createProviderFactory();
  initialized = true;
  console.log("[AI Gateway] Initialized");
}

// ============================================================================
// Main Gateway Function
// ============================================================================

export async function runTask(request: GatewayRequest): Promise<GatewayResponse> {
  const startTime = Date.now();
  const correlationId = request.correlationId || uuidv4();
  
  // Ensure gateway is initialized
  if (!initialized) {
    await initializeGateway();
  }
  
  try {
    // 1. Validate task is allowed
    validateTask(request.task);
    
    // 2. Check role permissions (would need user role from context)
    // For now, we'll trust the caller has validated this
    
    // 3. Check org budget
    const budgetStatus = await checkBudget(request.orgId);
    if (budgetStatus.hardLimitReached) {
      return createErrorResponse(
        "AI budget exhausted. Please contact your administrator.",
        startTime,
        correlationId
      );
    }
    
    // 4. Select route (provider + model)
    const route = request.providerOverride 
      ? { provider: request.providerOverride, model: request.modelOverride || "default", isDefault: false }
      : selectRoute(request.task);
    
    // 5. Prepare messages with KIISHA system prompt
    const messages = prepareMessages(request.messages, request.task);
    
    // 6. Execute with retry and fallback
    const response = await executeWithFallback(
      request,
      messages,
      route.provider,
      route.model,
      correlationId,
      startTime
    );
    
    // 7. Record usage and audit
    const latencyMs = Date.now() - startTime;
    const promptHash = hashPrompt(JSON.stringify(messages));
    
    await Promise.all([
      recordAuditEntry({
        task: request.task,
        userId: request.userId,
        orgId: request.orgId,
        channel: request.channel,
        correlationId,
        provider: response.provider,
        model: response.model,
        promptVersionHash: promptHash,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        latencyMs,
        success: response.success,
        toolCalls: response.toolCalls?.map(tc => ({
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
        outputSummary: response.content?.substring(0, 500),
        errorMessage: response.error,
      }),
      recordUsage({
        task: request.task,
        userId: request.userId,
        orgId: request.orgId,
        channel: request.channel,
        correlationId,
        provider: response.provider,
        model: response.model,
        promptVersionHash: promptHash,
        inputTokens: response.usage.promptTokens,
        outputTokens: response.usage.completionTokens,
        latencyMs,
        success: response.success,
      }),
      consumeBudget(request.orgId, response.usage.totalTokens),
    ]);
    
    recordRealtimeMetric(latencyMs, response.success);
    
    return {
      ...response,
      latencyMs,
      auditId: correlationId,
    };
    
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    recordRealtimeMetric(latencyMs, false);
    
    return createErrorResponse(errorMessage, startTime, correlationId);
  }
}

// ============================================================================
// Task Validation
// ============================================================================

function validateTask(task: KiishaTask): void {
  const policy = getTaskPolicy(task);
  if (!policy) {
    throw new Error(`Unknown task: ${task}`);
  }
}

// ============================================================================
// Message Preparation
// ============================================================================

function prepareMessages(messages: AIMessage[], task: KiishaTask): AIMessage[] {
  // Always prepend KIISHA system prompt
  const systemMessage: AIMessage = {
    role: "system",
    content: KIISHA_SYSTEM_PROMPT + `\n\nCurrent task: ${task}`,
  };
  
  // Check if there's already a system message
  const hasSystemMessage = messages.some(m => m.role === "system");
  
  if (hasSystemMessage) {
    // Merge with existing system message
    return messages.map(m => {
      if (m.role === "system") {
        const existingContent = typeof m.content === "string" 
          ? m.content 
          : m.content.map(c => c.type === "text" ? c.text : "").join("\n");
        return {
          ...m,
          content: KIISHA_SYSTEM_PROMPT + "\n\n" + existingContent + `\n\nCurrent task: ${task}`,
        };
      }
      return m;
    });
  }
  
  return [systemMessage, ...messages];
}

// ============================================================================
// Execution with Fallback
// ============================================================================

async function executeWithFallback(
  request: GatewayRequest,
  messages: AIMessage[],
  initialProvider: AIProvider,
  initialModel: string,
  correlationId: string,
  startTime: number
): Promise<GatewayResponse> {
  let currentProvider = initialProvider;
  let currentModel = initialModel;
  let attempts = 0;
  const maxAttempts = getRoutingConfig().retryConfig.maxRetries + 1;
  
  while (attempts < maxAttempts) {
    try {
      const provider = getProvider(currentProvider);
      if (!provider) {
        throw new Error(`Provider ${currentProvider} not available`);
      }
      
      const providerRequest: ProviderCompletionRequest = {
        messages,
        tools: request.tools,
        toolChoice: request.toolChoice,
        responseFormat: request.responseFormat,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        model: currentModel,
      };
      
      const response = await provider.complete(providerRequest);
      
      return {
        success: true,
        content: response.content,
        toolCalls: response.toolCalls,
        finishReason: response.finishReason,
        usage: response.usage,
        model: response.model,
        provider: currentProvider,
        latencyMs: Date.now() - startTime,
        auditId: correlationId,
      };
      
    } catch (error) {
      attempts++;
      console.error(`[AI Gateway] Attempt ${attempts} failed for ${currentProvider}:`, error);
      
      // Try fallback provider
      const fallback = selectFallback(request.task, currentProvider);
      if (fallback && attempts < maxAttempts) {
        currentProvider = fallback.provider;
        currentModel = fallback.model;
        console.log(`[AI Gateway] Falling back to ${currentProvider}/${currentModel}`);
      } else {
        throw error;
      }
    }
  }
  
  throw new Error("All providers failed");
}

// ============================================================================
// Error Response Helper
// ============================================================================

function createErrorResponse(
  error: string,
  startTime: number,
  correlationId: string
): GatewayResponse {
  return {
    success: false,
    content: null,
    finishReason: "error",
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    model: "unknown",
    provider: "forge",
    latencyMs: Date.now() - startTime,
    auditId: correlationId,
    error,
  };
}

// ============================================================================
// Convenience Functions for Common Tasks
// ============================================================================

export async function classifyIntent(
  message: string,
  userId: number,
  orgId: number,
  channel: GatewayRequest["channel"] = "web"
): Promise<GatewayResponse> {
  return runTask({
    task: "INTENT_CLASSIFY",
    messages: [{ role: "user", content: message }],
    userId,
    orgId,
    correlationId: uuidv4(),
    channel,
  });
}

export async function extractDocumentFields(
  documentContent: string,
  documentType: string,
  userId: number,
  orgId: number,
  schema?: unknown
): Promise<GatewayResponse> {
  const messages: AIMessage[] = [
    {
      role: "user",
      content: `Extract structured data from this ${documentType} document:\n\n${documentContent}`,
    },
  ];
  
  return runTask({
    task: "DOC_EXTRACT_FIELDS",
    messages,
    userId,
    orgId,
    correlationId: uuidv4(),
    channel: "web",
    responseFormat: schema ? {
      type: "json_schema",
      json_schema: {
        name: "extracted_fields",
        strict: true,
        schema,
      },
    } : undefined,
  });
}

export async function summarizeDocument(
  documentContent: string,
  userId: number,
  orgId: number
): Promise<GatewayResponse> {
  return runTask({
    task: "DOC_SUMMARIZE",
    messages: [
      {
        role: "user",
        content: `Summarize this document, highlighting key information relevant to renewable energy asset diligence:\n\n${documentContent}`,
      },
    ],
    userId,
    orgId,
    correlationId: uuidv4(),
    channel: "web",
  });
}

export async function chatResponse(
  messages: AIMessage[],
  tools: GatewayRequest["tools"],
  userId: number,
  orgId: number,
  channel: GatewayRequest["channel"] = "web"
): Promise<GatewayResponse> {
  return runTask({
    task: "CHAT_RESPONSE",
    messages,
    tools,
    toolChoice: tools && tools.length > 0 ? "auto" : undefined,
    userId,
    orgId,
    correlationId: uuidv4(),
    channel,
  });
}

