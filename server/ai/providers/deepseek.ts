/**
 * DeepSeek Provider Implementation
 * 
 * Handles DeepSeek API for LLM completions.
 * DeepSeek uses OpenAI-compatible API format.
 */

import { AIProvider } from "../types";
import { 
  AIProviderInterface, 
  ProviderCompletionRequest, 
  ProviderCompletionResponse 
} from "./index";

export class DeepSeekProvider implements AIProviderInterface {
  readonly name: AIProvider = "deepseek";
  private apiKey: string | undefined;
  private baseUrl = "https://api.deepseek.com";
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }
  
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
  
  get isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  async validate(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
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
    return [
      "deepseek-chat",
      "deepseek-coder",
      "deepseek-reasoner",
    ];
  }
  
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse> {
    if (!this.apiKey) {
      throw new Error("DeepSeek API key not configured");
    }
    
    const model = request.model || "deepseek-chat";
    
    // DeepSeek uses OpenAI-compatible format
    const body: Record<string, unknown> = {
      model,
      messages: request.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        ...(msg.name && { name: msg.name }),
        ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
      })),
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      stream: false,
    };
    
    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = request.toolChoice || "auto";
    }
    
    // Add response format for JSON mode
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
      throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as DeepSeekResponse;
    
    const choice = data.choices[0];
    if (!choice) {
      throw new Error("No response from DeepSeek");
    }
    
    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls,
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model: data.model || model,
    };
  }
  
  private mapFinishReason(reason?: string): ProviderCompletionResponse["finishReason"] {
    switch (reason) {
      case "stop": return "stop";
      case "length": return "length";
      case "tool_calls": return "tool_calls";
      case "content_filter": return "content_filter";
      default: return "stop";
    }
  }
}

// DeepSeek API types (OpenAI-compatible)
interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
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
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
