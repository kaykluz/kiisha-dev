/**
 * AI Provider Factory - Creates provider instances based on configuration
 * 
 * This is the ONLY place where provider-specific code should exist.
 * All other code must use the abstract AIProvider interface.
 */

import { AIProvider, AIMessage, ToolDefinition, GatewayResponse } from "../types";

// ============================================================================
// Provider Interface - All providers must implement this
// ============================================================================

export interface ProviderCompletionRequest {
  messages: AIMessage[];
  tools?: ToolDefinition[];
  toolChoice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
  responseFormat?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict?: boolean;
      schema: unknown;
    };
  };
  maxTokens?: number;
  temperature?: number;
  model: string;
}

export interface ProviderCompletionResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface AIProviderInterface {
  readonly name: AIProvider;
  readonly isAvailable: boolean;
  
  /**
   * Execute a completion request
   */
  complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse>;
  
  /**
   * Validate that the provider is properly configured
   */
  validate(): Promise<boolean>;
  
  /**
   * Get available models for this provider
   */
  getAvailableModels(): string[];
}

// ============================================================================
// Provider Registry
// ============================================================================

const providerRegistry = new Map<AIProvider, AIProviderInterface>();

export function registerProvider(provider: AIProviderInterface): void {
  providerRegistry.set(provider.name, provider);
}

export function getProvider(name: AIProvider): AIProviderInterface | undefined {
  return providerRegistry.get(name);
}

export function getAvailableProviders(): AIProvider[] {
  return Array.from(providerRegistry.entries())
    .filter(([_, provider]) => provider.isAvailable)
    .map(([name]) => name);
}

// ============================================================================
// Provider Factory
// ============================================================================

export async function createProviderFactory(): Promise<void> {
  // Import and register providers
  const { OpenAIProvider } = await import("./openai");
  const { AnthropicProvider } = await import("./anthropic");
  const { ForgeProvider } = await import("./forge");
  const { GeminiProvider } = await import("./gemini");
  const { DeepSeekProvider } = await import("./deepseek");
  
  // Register all providers
  registerProvider(new OpenAIProvider());
  registerProvider(new AnthropicProvider());
  registerProvider(new ForgeProvider());
  registerProvider(new GeminiProvider());
  registerProvider(new DeepSeekProvider());
  
  console.log("[AI Gateway] Registered providers:", getAvailableProviders());
}

// ============================================================================
// Export types
// ============================================================================

export type { ProviderCompletionRequest, ProviderCompletionResponse, AIProviderInterface };
