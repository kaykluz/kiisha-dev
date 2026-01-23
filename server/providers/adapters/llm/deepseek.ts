/**
 * DeepSeek LLM Adapter
 * 
 * Uses the DeepSeek API for DeepSeek models.
 * DeepSeek uses an OpenAI-compatible API.
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

interface DeepSeekConfig {
  model?: string;
}

export class DeepSeekLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'deepseek' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = false;
  
  private apiKey: string | null = null;
  private config: DeepSeekConfig = {};
  private baseUrl = 'https://api.deepseek.com/v1';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      model: config.model as string || 'deepseek-chat',
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'DeepSeek API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'DeepSeek connection successful',
          latencyMs: Date.now() - start,
          details: { model: response.model },
        };
      } else {
        return {
          success: false,
          message: 'No response from DeepSeek',
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
      throw new Error('DeepSeek API key not configured');
    }
    
    const body: Record<string, unknown> = {
      model: options?.model || this.config.model || 'deepseek-chat',
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
      throw new Error(`DeepSeek error: ${error.error?.message || response.status}`);
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
      throw new Error('DeepSeek API key not configured');
    }
    
    const body: Record<string, unknown> = {
      model: options?.model || this.config.model || 'deepseek-chat',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      response_format: {
        type: 'json_object',
      },
    };
    
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    
    // Add JSON instruction to the last user message
    const messagesWithSchema = [...messages];
    const lastUserIdx = messagesWithSchema.findLastIndex(m => m.role === 'user');
    if (lastUserIdx >= 0) {
      const original = messagesWithSchema[lastUserIdx].content;
      messagesWithSchema[lastUserIdx] = {
        ...messagesWithSchema[lastUserIdx],
        content: `${original}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(schema.schema)}`,
      };
    }
    
    body.messages = messagesWithSchema.map(m => ({
      role: m.role,
      content: m.content,
    }));
    
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
      throw new Error(`DeepSeek error: ${error.error?.message || response.status}`);
    }
    
    const apiResponse = await response.json();
    const content = apiResponse.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in DeepSeek response');
    }
    
    const data = JSON.parse(content) as T;
    
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
