/**
 * Global AI Chat Bubble
 * 
 * A floating chat bubble that appears on every page, allowing users to
 * ask questions about the portal and get AI-powered responses.
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  Sparkles, 
  User,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPT = `You are KIISHA AI, an intelligent assistant for the KIISHA solar project management platform.

You help users with:
- Understanding their solar project portfolio and documents
- Navigating the platform features (Documents, Workspace, Operations, Financial Models, etc.)
- Answering questions about solar energy projects, permits, interconnection, and technical specifications
- Providing insights from VATR (Valuation, Acquisition, Technical Review) data
- Explaining document statuses and reviewer approvals
- Helping with diligence templates and compliance requirements

Be concise, helpful, and professional. If you don't know something specific about the user's data, suggest where they might find that information in the platform.`;

export function GlobalAIChat() {
  const { user, isLoading: authLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: SYSTEM_PROMPT }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chat mutation
  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content,
      }]);
      setIsTyping(false);
    },
    onError: (error) => {
      toast.error('Failed to get AI response', {
        description: error.message,
      });
      setIsTyping(false);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
      if (viewport) {
        requestAnimationFrame(() => {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior: 'smooth',
          });
        });
      }
    }
  }, [messages, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isTyping) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: trimmedInput }];
    setMessages(newMessages);
    setInput('');
    setIsTyping(true);

    chatMutation.mutate({ 
      messages: newMessages.map(m => ({ role: m.role, content: m.content })),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const displayMessages = messages.filter(m => m.role !== 'system');

  const suggestedPrompts = [
    "What documents are missing?",
    "Show me project status",
    "Explain VATR data",
    "Help with diligence",
  ];

  // Don't show if not logged in
  if (authLoading || !user) {
    return null;
  }

  return (
    <>
      {/* Chat Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-brand-primary)] text-white shadow-lg hover:bg-[var(--color-brand-primary-hover)] transition-all hover:scale-105 active:scale-95"
          aria-label="Open AI Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed z-50 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg shadow-2xl transition-all duration-200",
            isMinimized
              ? "bottom-6 right-6 w-72 h-14"
              : "bottom-6 right-6 w-96 h-[500px] max-h-[80vh]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[var(--color-brand-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">KIISHA AI</h3>
                {!isMinimized && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">Ask me anything</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div ref={scrollAreaRef} className="flex-1 h-[calc(100%-120px)] overflow-hidden">
                {displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Sparkles className="w-10 h-10 text-[var(--color-text-tertiary)] opacity-30 mb-3" />
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      Hi {user.name?.split(' ')[0]}! How can I help you today?
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestedPrompts.map((prompt, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInput(prompt);
                            textareaRef.current?.focus();
                          }}
                          className="px-3 py-1.5 text-xs rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-3 p-4">
                      {displayMessages.map((message, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex gap-2",
                            message.role === 'user' ? "justify-end" : "justify-start"
                          )}
                        >
                          {message.role === 'assistant' && (
                            <div className="w-6 h-6 shrink-0 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                              <Sparkles className="w-3 h-3 text-[var(--color-brand-primary)]" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                              message.role === 'user'
                                ? "bg-[var(--color-brand-primary)] text-white"
                                : "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                            )}
                          >
                            {message.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <Streamdown>{message.content}</Streamdown>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="w-6 h-6 shrink-0 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center">
                              <User className="w-3 h-3 text-[var(--color-text-secondary)]" />
                            </div>
                          )}
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex gap-2 justify-start">
                          <div className="w-6 h-6 shrink-0 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                            <Sparkles className="w-3 h-3 text-[var(--color-brand-primary)]" />
                          </div>
                          <div className="bg-[var(--color-bg-elevated)] rounded-lg px-3 py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-tertiary)]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSubmit}
                className="flex gap-2 p-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] rounded-b-lg"
              >
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask KIISHA AI..."
                  className="flex-1 max-h-20 resize-none min-h-9 text-sm"
                  rows={1}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || isTyping}
                  className="h-9 w-9 p-0 shrink-0"
                >
                  {isTyping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
