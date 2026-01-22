/**
 * Anthropic Claude LLM Adapter
 * 
 * Uses the Anthropic API for Claude models.
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

interface AnthropicConfig {
  model?: string;
}

export class AnthropicLLMAdapter implements LLMProviderAdapter {
  readonly providerId = 'anthropic' as const;
  readonly integrationType = 'llm' as const;
  readonly isBuiltIn = false;
  
  private apiKey: string | null = null;
  private config: AnthropicConfig = {};
  private baseUrl = 'https://api.anthropic.com/v1';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      model: config.model as string || 'claude-3-sonnet-20240229',
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'Anthropic API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      const response = await this.chat([
        { role: 'user', content: 'Say "OK" if you can hear me.' }
      ], { maxTokens: 10 });
      
      if (response.choices.length > 0) {
        return {
          success: true,
          message: 'Anthropic connection successful',
          latencyMs: Date.now() - start,
          details: { model: response.model },
        };
      } else {
        return {
          success: false,
          message: 'No response from Anthropic',
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
      throw new Error('Anthropic API key not configured');
    }
    
    // Extract system message if present
    let systemMessage: string | undefined;
    const chatMessages = messages.filter(m => {
      if (m.role === 'system') {
        systemMessage = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return false;
      }
      return true;
    });
    
    const body: Record<string, unknown> = {
      model: options?.model || this.config.model || 'claude-3-sonnet-20240229',
      max_tokens: options?.maxTokens || 4096,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      })),
    };
    
    if (systemMessage) {
      body.system = systemMessage;
    }
    
    if (options?.temperature !== undefined) body.temperature = options.temperature;
    if (options?.topP !== undefined) body.top_p = options.topP;
    if (options?.stop) body.stop_sequences = options.stop;
    
    // Handle tools
    if (options?.tools) {
      body.tools = options.tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
      
      if (options.toolChoice) {
        if (options.toolChoice === 'auto') {
          body.tool_choice = { type: 'auto' };
        } else if (options.toolChoice === 'required') {
          body.tool_choice = { type: 'any' };
        } else if (typeof options.toolChoice === 'object') {
          body.tool_choice = { type: 'tool', name: options.toolChoice.function.name };
        }
      }
    }
    
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Anthropic error: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    // Convert Anthropic response to our format
    let content: string | null = null;
    const toolCalls: any[] = [];
    
    for (const block of data.content) {
      if (block.type === 'text') {
        content = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }
    
    return {
      id: data.id,
      model: data.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant' as const,
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 
                      data.stop_reason === 'tool_use' ? 'tool_calls' :
                      data.stop_reason === 'max_tokens' ? 'length' : 'stop',
      }],
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }
  
  async structuredOutput<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>> {
    // Anthropic doesn't have native JSON schema support like OpenAI
    // We'll use a tool to enforce the schema
    const toolMessages = [...messages];
    
    // Add instruction to use the tool
    const lastMessage = toolMessages[toolMessages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      const content = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);
      toolMessages[toolMessages.length - 1] = {
        ...lastMessage,
        content: `${content}\n\nRespond using the ${schema.name} tool.`,
      };
    }
    
    const response = await this.chat(toolMessages, {
      ...options,
      tools: [{
        type: 'function',
        function: {
          name: schema.name,
          description: `Output structured data according to the schema`,
          parameters: schema.schema,
        },
      }],
      toolChoice: { type: 'function', function: { name: schema.name } },
    });
    
    // Extract data from tool call
    const toolCall = response.choices[0]?.message?.toolCalls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in Anthropic response');
    }
    
    const data = JSON.parse(toolCall.function.arguments) as T;
    
    return {
      data,
      raw: response,
    };
  }
}
