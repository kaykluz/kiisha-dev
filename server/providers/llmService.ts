/**
 * LLM Service
 * 
 * Provides a unified interface for LLM calls that uses the organization's
 * configured integration when available, falling back to the built-in Manus LLM.
 */

import { getLLMAdapter } from './factory';
import { invokeLLM as invokeManusLLM } from '../_core/llm';
import type { LLMMessage, LLMChatOptions, LLMChatResponse } from './interfaces';

/**
 * Invoke LLM using the organization's configured integration.
 * Falls back to Manus built-in LLM if no integration is configured.
 * 
 * @param orgId - Organization ID
 * @param messages - Chat messages
 * @param options - Optional LLM options (model, temperature, etc.)
 */
export async function invokeLLMForOrg(
  orgId: number,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: LLMChatOptions
): Promise<LLMChatResponse> {
  try {
    // Get the organization's LLM adapter
    const adapter = await getLLMAdapter(orgId);
    
    // Check if it's the built-in Manus adapter (no external integration configured)
    if (adapter.providerId === 'manus') {
      // Use the built-in Manus LLM
      const response = await invokeManusLLM({ messages });
      
      // Convert to LLMChatResponse format
      return {
        id: `manus-${Date.now()}`,
        model: 'gemini-2.5-flash',
        choices: response.choices.map((choice, index) => ({
          index,
          message: {
            role: 'assistant' as const,
            content: typeof choice.message.content === 'string' 
              ? choice.message.content 
              : Array.isArray(choice.message.content)
                ? choice.message.content
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => part.text)
                    .join('\n')
                : null,
            toolCalls: choice.message.tool_calls?.map((tc: any) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          },
          finishReason: (choice.finish_reason || 'stop') as 'stop' | 'length' | 'tool_calls' | 'content_filter',
        })),
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    }
    
    // Use the organization's configured LLM adapter (OpenAI, Anthropic, etc.)
    const llmMessages: LLMMessage[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    
    return await adapter.chat(llmMessages, options);
  } catch (error) {
    console.error('[LLM Service] Error using org adapter, falling back to Manus:', error);
    
    // Fallback to Manus LLM on error
    const response = await invokeManusLLM({ messages });
    
    return {
      id: `manus-fallback-${Date.now()}`,
      model: 'gemini-2.5-flash',
      choices: response.choices.map((choice, index) => ({
        index,
        message: {
          role: 'assistant' as const,
          content: typeof choice.message.content === 'string' 
            ? choice.message.content 
            : Array.isArray(choice.message.content)
              ? choice.message.content
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => part.text)
                  .join('\n')
              : null,
        },
        finishReason: 'stop' as const,
      })),
    };
  }
}

/**
 * Check if an organization has a custom LLM integration configured.
 */
export async function hasCustomLLMIntegration(orgId: number): Promise<boolean> {
  try {
    const adapter = await getLLMAdapter(orgId);
    return adapter.providerId !== 'manus';
  } catch {
    return false;
  }
}

/**
 * Get the LLM provider name for an organization.
 */
export async function getLLMProviderName(orgId: number): Promise<string> {
  try {
    const adapter = await getLLMAdapter(orgId);
    return adapter.providerId;
  } catch {
    return 'manus';
  }
}
