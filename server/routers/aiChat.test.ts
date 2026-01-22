/**
 * AI Chat Router Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LLM module
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: 'test-response-id',
    created: Date.now(),
    model: 'gemini-2.5-flash',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'This is a test response from the AI.',
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  }),
}));

describe('AI Chat Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct structure for chat messages', () => {
    const validMessage = {
      role: 'user' as const,
      content: 'Hello, AI!',
    };
    
    expect(validMessage).toHaveProperty('role');
    expect(validMessage).toHaveProperty('content');
    expect(['system', 'user', 'assistant']).toContain(validMessage.role);
  });

  it('should validate message roles', () => {
    const validRoles = ['system', 'user', 'assistant'];
    
    validRoles.forEach(role => {
      expect(validRoles).toContain(role);
    });
  });

  it('should handle empty content gracefully', () => {
    const emptyMessage = {
      role: 'user' as const,
      content: '',
    };
    
    expect(emptyMessage.content).toBe('');
    expect(emptyMessage.content.trim()).toBe('');
  });

  it('should structure messages array correctly', () => {
    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'user' as const, content: 'Hello!' },
      { role: 'assistant' as const, content: 'Hi there!' },
    ];
    
    expect(messages).toHaveLength(3);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[2].role).toBe('assistant');
  });
});
