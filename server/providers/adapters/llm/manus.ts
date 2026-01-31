/**
 * Manus Built-in LLM Adapter
 * 
 * Uses OpenAI-compatible API as the fallback LLM.
 * This is the default adapter when no LLM is configured.
 * Uses OPENAI_API_KEY from environment.
 */

import type {
  LLMProviderAdapter,
  LLMMessage,
  LLMChatOptions,
  LLMChatResponse,
  LLMJsonSchema,
  LLMStructuredResponse,
  TestConnectionResult,
} from '../../interfaces';

export class ManusLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = true;
  
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';
  private model: string = 'gpt-4o-mini';
  
  async initialize(): Promise<void> {
    // Get API key from environment
    this.apiKey = process.env.OPENAI_API_KEY || null;
    
    // Check for custom base URL (for OpenAI-compatible APIs)
    if (process.env.OPENAI_BASE_URL) {
      this.baseUrl = process.env.OPENAI_BASE_URL;
    }
    
    // Check for custom model
    if (process.env.OPENAI_MODEL) {
      this.model = process.env.OPENAI_MODEL;
    }
    
    if (!this.apiKey) {
      console.warn('[ManusLLM] No OPENAI_API_KEY found in environment. LLM calls will fail.');
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    
    if (!this.apiKey) {
      return {
        success: false,
        message: 'No API key configured. Set OPENAI_API_KEY environment variable.',
        latencyMs: Date.now() - start,
      };
    }
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'LLM is operational',
          latencyMs: Date.now() - start,
          details: { model: response.model },
        };
      } else {
        return {
          success: false,
          message: 'No response from LLM',
          latencyMs: Date.now() - start,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      };
    }
  }
  
  async disconnect(): Promise<void> {
    this.apiKey = null;
  }
  
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (!this.apiKey) {
      throw new Error('No API key configured. Set OPENAI_API_KEY environment variable.');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body: Record<string, unknown> = {
      model: options?.model || this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };
    
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
    if (options?.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
    if (options?.stop) body.stop = options.stop;
    if (options?.tools) body.tools = options.tools;
    if (options?.toolChoice) body.tool_choice = options.toolChoice;
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`LLM error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    return {
      id: data.id || `manus-${Date.now()}`,
      model: data.model || this.model,
      choices: data.choices.map((c: any, i: number) => ({
        index: i,
        message: {
          role: 'assistant' as const,
          content: c.message?.content || null,
          toolCalls: c.message?.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        },
        finishReason: c.finish_reason || 'stop',
      })),
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }
  
  async structuredOutput<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    if (!this.apiKey) {
      throw new Error('No API key configured. Set OPENAI_API_KEY environment variable.');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body: Record<string, unknown> = {
      model: options?.model || this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schema.name,
          strict: schema.strict ?? true,
          schema: schema.schema,
        },
      },
    };
    
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`LLM error: ${error.error?.message || response.status}`);
    }
    
    const apiResponse = await response.json();
    const content = apiResponse.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in LLM response');
    }
    
    const data = JSON.parse(content) as T;
    
    return {
      data,
      raw: {
        id: apiResponse.id || `manus-${Date.now()}`,
        model: apiResponse.model || this.model,
        choices: apiResponse.choices.map((c: any, i: number) => ({
          index: i,
          message: {
            role: 'assistant' as const,
            content: c.message?.content || null,
          },
          finishReason: c.finish_reason || 'stop',
        })),
        usage: apiResponse.usage ? {
          promptTokens: apiResponse.usage.prompt_tokens,
          completionTokens: apiResponse.usage.completion_tokens,
          totalTokens: apiResponse.usage.total_tokens,
        } : undefined,
      },
    };
  }
}
