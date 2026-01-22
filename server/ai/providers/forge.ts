/**
 * Forge Provider Implementation
 * 
 * Handles Manus built-in LLM API (Forge).
 * This is the default provider when no external keys are configured.
 */

import { AIProvider } from "../types";
import { 
  AIProviderInterface, 
  ProviderCompletionRequest, 
  ProviderCompletionResponse 
} from "./index";
import { ENV } from "../../_core/env";

export class ForgeProvider implements AIProviderInterface {
  readonly name: AIProvider = "forge";
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  
  constructor() {
    this.apiKey = ENV.BUILT_IN_FORGE_API_KEY;
    this.baseUrl = ENV.BUILT_IN_FORGE_API_URL;
  }
  
  get isAvailable(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }
  
  async validate(): Promise<boolean> {
    if (!this.apiKey || !this.baseUrl) return false;
    
    try {
      // Simple validation - check if we can reach the endpoint
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getAvailableModels(): string[] {
    // Forge uses a default model, but we expose it as configurable
    return [
      "forge-default",
      "forge-fast",
    ];
  }
  
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse> {
    if (!this.apiKey || !this.baseUrl) {
      throw new Error("Forge API not configured");
    }
    
    // Forge uses OpenAI-compatible API format
    const body: Record<string, unknown> = {
      model: request.model === "forge-default" ? undefined : request.model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      })),
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
    };
    
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice || "auto";
    }
    
    if (request.responseFormat) {
      body.response_format = request.responseFormat;
    }
    
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Forge API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            id: string;
            type: "function";
            function: {
              name: string;
              arguments: string;
            };
          }>;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      model: string;
    };
    
    const choice = data.choices[0];
    
    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model || "forge-default",
    };
  }
  
  private mapFinishReason(reason: string): ProviderCompletionResponse["finishReason"] {
    switch (reason) {
      case "stop": return "stop";
      case "length": return "length";
      case "tool_calls": return "tool_calls";
      case "content_filter": return "content_filter";
      default: return "error";
    }
  }
}
