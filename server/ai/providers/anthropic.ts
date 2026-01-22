/**
 * Anthropic Provider Implementation
 * 
 * Handles all Anthropic API interactions including Claude models.
 */

import { AIProvider } from "../types";
import { 
  AIProviderInterface, 
  ProviderCompletionRequest, 
  ProviderCompletionResponse 
} from "./index";

export class AnthropicProvider implements AIProviderInterface {
  readonly name: AIProvider = "anthropic";
  private apiKey: string | undefined;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    this.baseUrl = process.env.ANTHROPIC_API_BASE_URL || "https://api.anthropic.com/v1";
  }
  
  get isAvailable(): boolean {
    return !!this.apiKey;
  }
  
  async validate(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      // Anthropic doesn't have a simple validation endpoint, so we'll just check the key format
      return this.apiKey.startsWith("sk-ant-");
    } catch {
      return false;
    }
  }
  
  getAvailableModels(): string[] {
    return [
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ];
  }
  
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse> {
    if (!this.apiKey) {
      throw new Error("Anthropic API key not configured");
    }
    
    // Convert OpenAI-style messages to Anthropic format
    const { systemPrompt, messages } = this.convertMessages(request.messages);
    
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      messages,
      ...(systemPrompt && { system: systemPrompt }),
    };
    
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
      
      if (request.toolChoice === "required") {
        body.tool_choice = { type: "any" };
      } else if (request.toolChoice === "none") {
        // Don't include tools
        delete body.tools;
      } else if (typeof request.toolChoice === "object") {
        body.tool_choice = { 
          type: "tool", 
          name: request.toolChoice.function.name 
        };
      }
    }
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as {
      content: Array<{
        type: "text" | "tool_use";
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      }>;
      stop_reason: string;
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
      model: string;
    };
    
    // Extract text content and tool calls
    let textContent: string | null = null;
    const toolCalls: ProviderCompletionResponse["toolCalls"] = [];
    
    for (const block of data.content) {
      if (block.type === "text" && block.text) {
        textContent = (textContent || "") + block.text;
      } else if (block.type === "tool_use" && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }
    
    return {
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(data.stop_reason),
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };
  }
  
  private convertMessages(messages: ProviderCompletionRequest["messages"]): {
    systemPrompt: string | null;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  } {
    let systemPrompt: string | null = null;
    const convertedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    
    for (const msg of messages) {
      if (msg.role === "system") {
        // Anthropic uses a separate system field
        const content = typeof msg.content === "string" 
          ? msg.content 
          : msg.content.map(c => c.type === "text" ? c.text : "").join("\n");
        systemPrompt = (systemPrompt || "") + content + "\n";
      } else if (msg.role === "user" || msg.role === "assistant") {
        const content = typeof msg.content === "string"
          ? msg.content
          : msg.content.map(c => c.type === "text" ? c.text : "").join("\n");
        convertedMessages.push({ role: msg.role, content });
      } else if (msg.role === "tool") {
        // Convert tool results to user messages
        const content = typeof msg.content === "string"
          ? msg.content
          : msg.content.map(c => c.type === "text" ? c.text : "").join("\n");
        convertedMessages.push({ 
          role: "user", 
          content: `Tool result for ${msg.name || "unknown"}: ${content}` 
        });
      }
    }
    
    return { systemPrompt: systemPrompt?.trim() || null, messages: convertedMessages };
  }
  
  private mapFinishReason(reason: string): ProviderCompletionResponse["finishReason"] {
    switch (reason) {
      case "end_turn": return "stop";
      case "max_tokens": return "length";
      case "tool_use": return "tool_calls";
      case "stop_sequence": return "stop";
      default: return "error";
    }
  }
}
