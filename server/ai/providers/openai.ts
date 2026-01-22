/**
 * OpenAI Provider Implementation
 * 
 * Handles all OpenAI API interactions including GPT-4, GPT-4o, etc.
 */

import { AIProvider } from "../types";
import { 
  AIProviderInterface, 
  ProviderCompletionRequest, 
  ProviderCompletionResponse 
} from "./index";

export class OpenAIProvider implements AIProviderInterface {
  readonly name: AIProvider = "openai";
  private apiKey: string | undefined;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1";
  }
  
  get isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  async validate(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
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
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
    ];
  }
  
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured");
    }
    
    const body: Record<string, unknown> = {
      model: request.model,
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
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
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
      model: data.model,
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
