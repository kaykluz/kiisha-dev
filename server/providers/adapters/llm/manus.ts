/**
 * Manus Built-in LLM Adapter
 * 
 * Uses OpenAI or Gemini API as the fallback LLM.
 * This is the default adapter when no LLM is configured.
 * 
 * Priority:
 * 1. OPENAI_API_KEY (OpenAI or compatible API)
 * 2. GEMINI_API_KEY (Google Gemini)
 * 
 * Environment variables:
 * - OPENAI_API_KEY: OpenAI API key
 * - OPENAI_BASE_URL: Custom base URL for OpenAI-compatible APIs
 * - OPENAI_MODEL: Custom model name (default: gpt-4o-mini)
 * - GEMINI_API_KEY: Google Gemini API key
 * - GEMINI_MODEL: Custom Gemini model (default: gemini-1.5-flash)
 * - LLM_PROVIDER: Force a specific provider ('openai' or 'gemini')
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

type Provider = 'openai' | 'gemini';

export class ManusLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = true;
  
  private provider: Provider = 'openai';
  private openaiApiKey: string | null = null;
  private openaiBaseUrl: string = 'https://api.openai.com/v1';
  private openaiModel: string = 'gpt-4o-mini';
  private geminiApiKey: string | null = null;
  private geminiBaseUrl: string = 'https://generativelanguage.googleapis.com/v1beta';
  private geminiModel: string = 'gemini-1.5-flash';
  
  async initialize(): Promise<void> {
    // Get API keys from environment
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    
    // Check for custom configurations
    if (process.env.OPENAI_BASE_URL) {
      this.openaiBaseUrl = process.env.OPENAI_BASE_URL;
    }
    if (process.env.OPENAI_MODEL) {
      this.openaiModel = process.env.OPENAI_MODEL;
    }
    if (process.env.GEMINI_MODEL) {
      this.geminiModel = process.env.GEMINI_MODEL;
    }
    
    // Determine which provider to use
    const forcedProvider = process.env.LLM_PROVIDER as Provider;
    if (forcedProvider === 'gemini' && this.geminiApiKey) {
      this.provider = 'gemini';
    } else if (forcedProvider === 'openai' && this.openaiApiKey) {
      this.provider = 'openai';
    } else if (this.openaiApiKey) {
      this.provider = 'openai';
    } else if (this.geminiApiKey) {
      this.provider = 'gemini';
    }
    
    const hasKey = this.openaiApiKey || this.geminiApiKey;
    if (!hasKey) {
      console.warn('[ManusLLM] No API key found. Set OPENAI_API_KEY or GEMINI_API_KEY environment variable.');
    } else {
      console.log(`[ManusLLM] Using ${this.provider} as LLM provider`);
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    
    if (!this.openaiApiKey && !this.geminiApiKey) {
      return {
        success: false,
        message: 'No API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY environment variable.',
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
          message: `LLM is operational (${this.provider})`,
          latencyMs: Date.now() - start,
          details: { model: response.model, provider: this.provider },
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
    this.openaiApiKey = null;
    this.geminiApiKey = null;
  }
  
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (this.provider === 'gemini') {
      return this.chatGemini(messages, options);
    }
    return this.chatOpenAI(messages, options);
  }
  
  private async chatOpenAI(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (!this.openaiApiKey) {
      throw new Error('No OpenAI API key configured. Set OPENAI_API_KEY environment variable.');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.openaiApiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body: Record<string, unknown> = {
      model: options?.model || this.openaiModel,
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
    
    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    return {
      id: data.id || `openai-${Date.now()}`,
      model: data.model || this.openaiModel,
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
  
  private convertToGeminiMessages(messages: LLMMessage[]): { contents: any[]; systemInstruction?: any } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');
    
    const contents = otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));
    
    const result: { contents: any[]; systemInstruction?: any } = { contents };
    
    if (systemMessages.length > 0) {
      result.systemInstruction = {
        parts: [{ text: systemMessages.map(m => 
          typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        ).join('\n') }],
      };
    }
    
    return result;
  }
  
  private async chatGemini(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (!this.geminiApiKey) {
      throw new Error('No Gemini API key configured. Set GEMINI_API_KEY environment variable.');
    }
    
    const model = options?.model || this.geminiModel;
    const { contents, systemInstruction } = this.convertToGeminiMessages(messages);
    
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 8192,
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP,
      },
    };
    
    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }
    
    const response = await fetch(
      `${this.geminiBaseUrl}/models/${model}:generateContent?key=${this.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Gemini error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      id: `gemini-${Date.now()}`,
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finishReason: data.candidates?.[0]?.finishReason || 'stop',
      }],
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount || 0,
        completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
    };
  }
  
  async structuredOutput<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    if (this.provider === 'gemini') {
      return this.structuredOutputGemini<T>(messages, schema, options);
    }
    return this.structuredOutputOpenAI<T>(messages, schema, options);
  }
  
  private async structuredOutputOpenAI<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    if (!this.openaiApiKey) {
      throw new Error('No OpenAI API key configured. Set OPENAI_API_KEY environment variable.');
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.openaiApiKey}`,
      'Content-Type': 'application/json',
    };
    
    const body: Record<string, unknown> = {
      model: options?.model || this.openaiModel,
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
    
    const response = await fetch(`${this.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI error: ${error.error?.message || response.status}`);
    }
    
    const apiResponse = await response.json();
    const content = apiResponse.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in OpenAI response');
    }
    
    const data = JSON.parse(content) as T;
    
    return {
      data,
      raw: {
        id: apiResponse.id || `openai-${Date.now()}`,
        model: apiResponse.model || this.openaiModel,
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
  
  private async structuredOutputGemini<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    // Add JSON instruction to the messages
    const jsonMessages = [...messages];
    const lastUserIdx = jsonMessages.map((m, i) => m.role === 'user' ? i : -1).filter(i => i >= 0).pop();
    
    if (lastUserIdx !== undefined && lastUserIdx >= 0) {
      const originalContent = jsonMessages[lastUserIdx].content;
      jsonMessages[lastUserIdx] = {
        ...jsonMessages[lastUserIdx],
        content: `${originalContent}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(schema.schema)}`,
      };
    }
    
    const response = await this.chatGemini(jsonMessages, options);
    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Gemini response');
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
      raw: response,
    };
  }
}
