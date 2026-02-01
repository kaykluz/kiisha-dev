/**
 * Manus Built-in LLM Adapter
 * 
 * Uses the platform's built-in LLM service with fallback to direct OpenAI/Gemini APIs.
 * Priority order:
 * 1. OpenAI API (if OPENAI_API_KEY is set)
 * 2. Gemini API (if GEMINI_API_KEY is set)
 * 3. Manus Forge API (if BUILT_IN_FORGE_API_KEY is set)
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

// Direct API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;
const LLM_PROVIDER = process.env.LLM_PROVIDER; // 'openai' | 'gemini' | 'manus'

// Models
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

type Provider = 'manus' | 'openai' | 'gemini';

function getActiveProvider(): Provider {
  // If explicitly set, use that
  if (LLM_PROVIDER === 'openai' && OPENAI_API_KEY) return 'openai';
  if (LLM_PROVIDER === 'gemini' && GEMINI_API_KEY) return 'gemini';
  if (LLM_PROVIDER === 'manus' && BUILT_IN_FORGE_API_KEY) return 'manus';
  
  // Otherwise, use priority order: OpenAI > Gemini > Manus
  if (OPENAI_API_KEY) return 'openai';
  if (GEMINI_API_KEY) return 'gemini';
  if (BUILT_IN_FORGE_API_KEY) return 'manus';
  
  // Default to manus (will fail if no key, but that's expected)
  return 'manus';
}

async function callOpenAI(
  messages: LLMMessage[],
  options?: LLMChatOptions & { responseFormat?: any }
): Promise<any> {
  const payload: any = {
    model: OPENAI_MODEL,
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  };
  
  if (options?.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }
  
  if (options?.tools && options.tools.length > 0) {
    payload.tools = options.tools;
  }
  
  if (options?.toolChoice) {
    payload.tool_choice = options.toolChoice;
  }
  
  if (options?.responseFormat) {
    payload.response_format = options.responseFormat;
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function callGemini(
  messages: LLMMessage[],
  options?: LLMChatOptions & { responseFormat?: any }
): Promise<any> {
  // Gemini uses a different API format, but we'll use the OpenAI-compatible endpoint
  const payload: any = {
    model: GEMINI_MODEL,
    messages: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  };
  
  if (options?.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }
  
  // Use the OpenAI-compatible Gemini endpoint
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function callManus(
  messages: LLMMessage[],
  options?: LLMChatOptions & { responseFormat?: any }
): Promise<any> {
  const payload: any = {
    model: 'gemini-2.5-flash',
    messages: messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    max_tokens: options?.maxTokens || 32768,
  };
  
  if (options?.tools && options.tools.length > 0) {
    payload.tools = options.tools;
  }
  
  if (options?.toolChoice) {
    payload.tool_choice = options.toolChoice;
  }
  
  if (options?.responseFormat) {
    payload.response_format = options.responseFormat;
  }
  
  const response = await fetch('https://forge.manus.im/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Manus API error: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function callLLM(
  messages: LLMMessage[],
  options?: LLMChatOptions & { responseFormat?: any }
): Promise<any> {
  const provider = getActiveProvider();
  
  console.log(`[LLM] Using provider: ${provider}`);
  
  switch (provider) {
    case 'openai':
      return callOpenAI(messages, options);
    case 'gemini':
      return callGemini(messages, options);
    case 'manus':
      return callManus(messages, options);
    default:
      throw new Error(`No LLM provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or BUILT_IN_FORGE_API_KEY`);
  }
}

export class ManusLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = true;
  
  private activeProvider: Provider = 'manus';
  
  async initialize(): Promise<void> {
    this.activeProvider = getActiveProvider();
    console.log(`[ManusLLMAdapter] Initialized with provider: ${this.activeProvider}`);
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    
    try {
      const provider = getActiveProvider();
      
      // Check if any API key is available
      if (!OPENAI_API_KEY && !GEMINI_API_KEY && !BUILT_IN_FORGE_API_KEY) {
        return {
          success: false,
          message: 'No LLM API key configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or BUILT_IN_FORGE_API_KEY',
          latencyMs: Date.now() - start,
        };
      }
      
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: `LLM is operational (provider: ${provider})`,
          latencyMs: Date.now() - start,
          details: { model: response.model, provider },
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
    const response = await callLLM(messages, {
      maxTokens: options?.maxTokens,
      tools: options?.tools,
      toolChoice: options?.toolChoice,
    });
    
    return {
      id: response.id || `llm-${Date.now()}`,
      model: response.model || getActiveProvider(),
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
    const response = await callLLM(messages, {
      maxTokens: options?.maxTokens,
      responseFormat: {
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
        id: response.id || `llm-${Date.now()}`,
        model: response.model || getActiveProvider(),
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
