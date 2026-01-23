/**
 * Grok (xAI) LLM Adapter
 * 
 * Uses the xAI API for Grok models.
 * xAI uses an OpenAI-compatible API.
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

interface GrokConfig {
  model?: string;
}

export class GrokLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'grok' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = false;
  
  private apiKey: string | null = null;
  private config: GrokConfig = {};
  private baseUrl = 'https://api.x.ai/v1';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      model: config.model as string || 'grok-beta',
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'Grok API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'Grok connection successful',
          latencyMs: Date.now() - start,
          details: { model: response.model },
        };
      } else {
        return {
          success: false,
          message: 'No response from Grok',
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
    this.config = {};
  }
  
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (!this.apiKey) {
      throw new Error('Grok API key not configured');
    }
    
    const body: Record<string, unknown> = {
      model: options?.model || this.config.model || 'grok-beta',
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
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Grok error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    return {
      id: data.id,
      model: data.model,
      choices: data.choices.map((c: any) => ({
        index: c.index,
        message: {
          role: 'assistant' as const,
          content: c.message.content,
          toolCalls: c.message.tool_calls?.map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        },
        finishReason: c.finish_reason,
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
      throw new Error('Grok API key not configured');
    }
    
    // Add JSON instruction to the messages
    const messagesWithSchema = [...messages];
    const lastUserIdx = messagesWithSchema.findLastIndex(m => m.role === 'user');
    if (lastUserIdx >= 0) {
      const original = messagesWithSchema[lastUserIdx].content;
      messagesWithSchema[lastUserIdx] = {
        ...messagesWithSchema[lastUserIdx],
        content: `${original}\n\nRespond with valid JSON only, matching this schema: ${JSON.stringify(schema.schema)}`,
      };
    }
    
    const body: Record<string, unknown> = {
      model: options?.model || this.config.model || 'grok-beta',
      messages: messagesWithSchema.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };
    
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Grok error: ${error.error?.message || response.status}`);
    }
    
    const apiResponse = await response.json();
    const content = apiResponse.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Grok response');
    }
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    const data = JSON.parse(jsonStr) as T;
    
    return {
      data,
      raw: {
        id: apiResponse.id,
        model: apiResponse.model,
        choices: apiResponse.choices.map((c: any) => ({
          index: c.index,
          message: {
            role: 'assistant' as const,
            content: c.message.content,
          },
          finishReason: c.finish_reason,
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
