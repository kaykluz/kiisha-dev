/**
 * Core LLM Module
 * 
 * Provides the invokeLLM function that uses the platform-configured LLM provider.
 * The LLM provider is configured by superusers at the platform level (orgId=0).
 * 
 * Supported providers: OpenAI, Anthropic, Gemini, DeepSeek, Grok, Llama
 * Fallback: Manus (with superuser alert logging)
 */

import { getPlatformLLMAdapter } from '../providers/factory';
import type { LLMMessage, LLMChatOptions, LLMChatResponse } from '../providers/interfaces';

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  temperature?: number;
  topP?: number;
  top_p?: number;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

/**
 * Normalize message content to a string for the adapter.
 */
function normalizeMessageContent(content: MessageContent | MessageContent[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part.type === 'text') return part.text;
      return JSON.stringify(part);
    }).join('\n');
  }
  
  if (content.type === 'text') {
    return content.text;
  }
  
  return JSON.stringify(content);
}

/**
 * Convert InvokeParams messages to LLMMessage format.
 */
function convertMessages(messages: Message[]): LLMMessage[] {
  return messages.map(m => ({
    role: m.role as 'system' | 'user' | 'assistant' | 'tool',
    content: normalizeMessageContent(m.content),
  }));
}

/**
 * Convert LLMChatResponse to InvokeResult format.
 */
function convertResponse(response: LLMChatResponse): InvokeResult {
  return {
    id: response.id,
    created: Date.now(),
    model: response.model,
    choices: response.choices.map(c => ({
      index: c.index,
      message: {
        role: c.message.role as Role,
        content: c.message.content || '',
        tool_calls: c.message.toolCalls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      finish_reason: c.finishReason,
    })),
    usage: response.usage ? {
      prompt_tokens: response.usage.promptTokens,
      completion_tokens: response.usage.completionTokens,
      total_tokens: response.usage.totalTokens,
    } : undefined,
  };
}

/**
 * Invoke the platform-configured LLM.
 * 
 * This function uses the LLM provider configured by superusers at the platform level.
 * All organizations share the same LLM configuration.
 * 
 * Supported providers: OpenAI, Anthropic, Gemini, DeepSeek, Grok, Llama
 * Fallback: Manus (with superuser alert logging)
 * 
 * @param params - The invocation parameters
 * @returns The LLM response
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    temperature,
    topP,
    top_p,
  } = params;

  // Get the platform-configured LLM adapter
  const adapter = await getPlatformLLMAdapter();
  
  // Convert messages to adapter format
  const llmMessages = convertMessages(messages);
  
  // Build options
  const options: LLMChatOptions = {};
  
  if (maxTokens || max_tokens) {
    options.maxTokens = maxTokens || max_tokens;
  }
  
  if (temperature !== undefined) {
    options.temperature = temperature;
  }
  
  if (topP !== undefined || top_p !== undefined) {
    options.topP = topP || top_p;
  }
  
  if (tools && tools.length > 0) {
    options.tools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));
  }
  
  const resolvedToolChoice = toolChoice || tool_choice;
  if (resolvedToolChoice) {
    if (typeof resolvedToolChoice === 'string') {
      options.toolChoice = resolvedToolChoice;
    } else if ('name' in resolvedToolChoice) {
      options.toolChoice = { type: 'function', function: { name: resolvedToolChoice.name } };
    } else {
      options.toolChoice = resolvedToolChoice;
    }
  }
  
  // Call the adapter
  const response = await adapter.chat(llmMessages, options);
  
  // Convert response to InvokeResult format
  return convertResponse(response);
}

/**
 * Invoke the LLM with structured JSON output.
 * 
 * @param params - The invocation parameters (must include response_format with json_schema)
 * @returns The LLM response with parsed JSON
 */
export async function invokeLLMStructured<T>(
  params: InvokeParams & { response_format: { type: 'json_schema'; json_schema: JsonSchema } }
): Promise<{ data: T; raw: InvokeResult }> {
  const adapter = await getPlatformLLMAdapter();
  
  const llmMessages = convertMessages(params.messages);
  
  const schema = params.response_format.json_schema;
  
  const result = await adapter.structuredOutput<T>(llmMessages, {
    name: schema.name,
    schema: schema.schema,
    strict: schema.strict,
  });
  
  return {
    data: result.data,
    raw: convertResponse(result.raw),
  };
}
