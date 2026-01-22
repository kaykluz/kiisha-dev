/**
 * Gemini Provider Implementation
 * 
 * Handles Google's Gemini API for LLM completions.
 */

import { AIProvider } from "../types";
import { 
  AIProviderInterface, 
  ProviderCompletionRequest, 
  ProviderCompletionResponse 
} from "./index";

export class GeminiProvider implements AIProviderInterface {
  readonly name: AIProvider = "gemini";
  private apiKey: string | undefined;
  
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
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }
  
  getAvailableModels(): string[] {
    return [
      "gemini-2.0-flash-exp",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.0-pro",
    ];
  }
  
  async complete(request: ProviderCompletionRequest): Promise<ProviderCompletionResponse> {
    if (!this.apiKey) {
      throw new Error("Gemini API key not configured");
    }
    
    const model = request.model || "gemini-1.5-flash";
    
    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(request.messages);
    
    // Build request body
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
      },
    };
    
    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        })),
      }];
    }
    
    // Add response format for JSON mode
    if (request.responseFormat?.type === "json_schema") {
      body.generationConfig = {
        ...(body.generationConfig as object),
        responseMimeType: "application/json",
      };
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as GeminiResponse;
    
    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error("No response from Gemini");
    }
    
    // Extract content and tool calls
    const content = candidate.content?.parts
      ?.filter(p => p.text)
      .map(p => p.text)
      .join("") || null;
    
    const toolCalls = candidate.content?.parts
      ?.filter(p => p.functionCall)
      .map((p, idx) => ({
        id: `call_${idx}`,
        type: "function" as const,
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args),
        },
      }));
    
    return {
      content,
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      finishReason: this.mapFinishReason(candidate.finishReason),
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      model,
    };
  }
  
  private convertMessagesToGeminiFormat(messages: ProviderCompletionRequest["messages"]): GeminiContent[] {
    const contents: GeminiContent[] = [];
    let systemInstruction = "";
    
    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += (typeof msg.content === "string" ? msg.content : "") + "\n";
        continue;
      }
      
      const role = msg.role === "assistant" ? "model" : "user";
      const parts: GeminiPart[] = [];
      
      if (typeof msg.content === "string") {
        // Prepend system instruction to first user message
        const text = contents.length === 0 && systemInstruction 
          ? `${systemInstruction}\n${msg.content}`
          : msg.content;
        parts.push({ text });
      } else if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === "text") {
            parts.push({ text: item.text });
          } else if (item.type === "image_url") {
            // Handle image content
            const url = item.image_url.url;
            if (url.startsWith("data:")) {
              const [meta, data] = url.split(",");
              const mimeType = meta.match(/data:([^;]+)/)?.[1] || "image/jpeg";
              parts.push({
                inlineData: {
                  mimeType,
                  data,
                },
              });
            }
          }
        }
      }
      
      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }
    
    return contents;
  }
  
  private mapFinishReason(reason?: string): ProviderCompletionResponse["finishReason"] {
    switch (reason) {
      case "STOP": return "stop";
      case "MAX_TOKENS": return "length";
      case "SAFETY": return "content_filter";
      case "RECITATION": return "content_filter";
      default: return "stop";
    }
  }
}

// Gemini API types
interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}
