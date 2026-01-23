/**
 * Google Gemini LLM Adapter
 * 
 * Uses the Google Gemini API for Gemini models.
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

interface GeminiConfig {
  model?: string;
}

export class GeminiLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'gemini' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = false;
  
  private apiKey: string | null = null;
  private config: GeminiConfig = {};
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      model: config.model as string || 'gemini-1.5-pro',
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'Gemini API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'Gemini connection successful',
          latencyMs: Date.now() - start,
          details: { model: response.model },
        };
      } else {
        return {
          success: false,
          message: 'No response from Gemini',
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
  
  async chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }
    
    const model = options?.model || this.config.model || 'gemini-1.5-pro';
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
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
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
    // Add JSON instruction to the messages
    const jsonMessages = [...messages];
    const lastUserMessage = jsonMessages.findIndex(m => m.role === 'user');
    if (lastUserMessage >= 0) {
      const originalContent = jsonMessages[lastUserMessage].content;
      jsonMessages[lastUserMessage] = {
        ...jsonMessages[lastUserMessage],
        content: `${originalContent}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(schema.schema)}`,
      };
    }
    
    const response = await this.chat(jsonMessages, options);
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
