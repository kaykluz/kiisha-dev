/**
 * Manus Built-in LLM Adapter
 * 
 * Uses the platform's built-in LLM service.
 * No configuration required - credentials are injected automatically.
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
import { invokeLLM } from '../../../_core/llm';

export class ManusLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = true;
  
  async initialize(): Promise<void> {
    // No initialization needed - uses platform credentials
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'Manus LLM is operational',
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
    // Nothing to clean up
  }
  
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      max_tokens: options?.maxTokens,
      tools: options?.tools?.map(t => ({
        type: t.type as 'function',
        function: t.function,
      })),
      tool_choice: options?.toolChoice as any,
    });
    
    return {
      id: response.id || `manus-${Date.now()}`,
      model: response.model || 'manus-default',
      choices: response.choices.map((c: any, i: number) => ({
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
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
    };
  }
  
  async structuredOutput<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    const response = await invokeLLM({
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'tool',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
      max_tokens: options?.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schema.name,
          strict: schema.strict ?? true,
          schema: schema.schema,
        },
      },
    });
    
    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('No content in LLM response');
    }
    
    const data = JSON.parse(typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent)) as T;
    
    return {
      data,
      raw: {
        id: response.id || `manus-${Date.now()}`,
        model: response.model || 'manus-default',
        choices: response.choices.map((c: any, i: number) => ({
          index: i,
          message: {
            role: 'assistant' as const,
            content: c.message?.content || null,
          },
          finishReason: c.finish_reason || 'stop',
        })),
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      },
    };
  }
}
