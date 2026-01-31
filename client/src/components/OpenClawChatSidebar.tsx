/**
 * OpenClaw Chat Sidebar Component
 *
 * A collapsible sidebar that provides unified chat access across all KIISHA views.
 * Integrates with OpenClaw for multi-channel AI assistant functionality.
 *
 * Features:
 * - Persistent across all views
 * - Channel switching (WhatsApp, Telegram, Slack, Web)
 * - Conversation history with cursor pagination
 * - Quick actions and suggested prompts
 * - VATR-compliant message logging
 * - Typing indicators and retry on failure
 * - Keyboard accessible (Escape to close, Enter to send)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  FileText,
  AlertTriangle,
  Wrench,
  BarChart3,
  Phone,
  MessageSquare,
  Hash,
  Link2,
  X,
  RefreshCw,
  ChevronDown,
  Shield,
  Clock,
  ArrowDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";

// Message type
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  channel?: string;
  status?: "sending" | "sent" | "error";
  errorRetryable?: boolean;
}

// Channel type
type ChannelType = "webchat" | "whatsapp" | "telegram" | "slack";

// Quick action type
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
  description: string;
}

// Props
interface OpenClawChatSidebarProps {
  organizationId: number;
  projectId?: number;
  className?: string;
}

// Channel icons
const channelIcons: Record<ChannelType, React.ReactNode> = {
  webchat: <MessageCircle className="h-4 w-4" />,
  whatsapp: <Phone className="h-4 w-4" />,
  telegram: <MessageSquare className="h-4 w-4" />,
  slack: <Hash className="h-4 w-4" />,
};

// Channel labels
const channelLabels: Record<ChannelType, string> = {
  webchat: "Web Chat",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  slack: "Slack",
};

// Quick actions with descriptions
const quickActions: QuickAction[] = [
  {
    id: "portfolio",
    label: "Portfolio",
    icon: <BarChart3 className="h-4 w-4" />,
    prompt: "Show me my portfolio summary",
    description: "Overview of projects, capacity, and alerts",
  },
  {
    id: "documents",
    label: "Documents",
    icon: <FileText className="h-4 w-4" />,
    prompt: "What documents are missing or pending?",
    description: "Check document verification status",
  },
  {
    id: "alerts",
    label: "Alerts",
    icon: <AlertTriangle className="h-4 w-4" />,
    prompt: "Show me all active alerts",
    description: "View critical and active alerts",
  },
  {
    id: "tickets",
    label: "Work Orders",
    icon: <Wrench className="h-4 w-4" />,
    prompt: "List open work orders",
    description: "Maintenance and operations tickets",
  },
];

/**
 * OpenClaw Chat Sidebar Component
 */
export function OpenClawChatSidebar({
  organizationId,
  projectId,
  className,
}: OpenClawChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<ChannelType>("webchat");
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get linked channels
  const { data: linkedChannels } = trpc.openclaw.getLinkedChannels.useQuery(
    { organizationId },
    { enabled: isOpen && !!organizationId }
  );

  // Get conversation history
  const { data: history } = trpc.openclaw.getConversationHistory.useQuery(
    { organizationId, limit: 50 },
    { enabled: isOpen && !!organizationId }
  );

  // Send message mutation
  const sendMessage = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      setMessages((prev) => {
        // Mark the last sending message as sent
        const updated = prev.map((m) =>
          m.status === "sending" ? { ...m, status: "sent" as const } : m
        );
        // Add assistant response
        return [
          ...updated,
          {
            id: `msg-${Date.now()}`,
            role: "assistant" as const,
            content: response.content || response,
            timestamp: new Date(),
            channel: "webchat",
            status: "sent" as const,
          },
        ];
      });
      setIsLoading(false);
      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMessages((prev) => {
        // Mark sending message as error
        const updated = prev.map((m) =>
          m.status === "sending"
            ? { ...m, status: "error" as const, errorRetryable: true }
            : m
        );
        return [
          ...updated,
          {
            id: `msg-err-${Date.now()}`,
            role: "assistant" as const,
            content:
              "I encountered an error processing your request. This may be a temporary issue — please try again.",
            timestamp: new Date(),
            channel: "webchat",
            status: "error" as const,
          },
        ];
      });
      setIsLoading(false);
    },
  });

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Track scroll position for "scroll to bottom" button
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  // Load history when opened
  useEffect(() => {
    if (isOpen && history?.items && messages.length === 0) {
      const historyMessages: ChatMessage[] = history.items.flatMap((item) => [
        {
          id: `hist-user-${item.id}`,
          role: "user" as const,
          content: item.userMessage,
          timestamp: new Date(item.messageReceivedAt),
          channel: item.channelType,
          status: "sent" as const,
        },
        {
          id: `hist-ai-${item.id}`,
          role: "assistant" as const,
          content: item.aiResponse,
          timestamp: new Date(item.messageReceivedAt),
          channel: item.channelType,
          status: "sent" as const,
        },
      ]);
      setMessages(historyMessages.reverse());
    }
  }, [isOpen, history]);

  // Reset unread when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle send message
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      channel: activeChannel,
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // Build context-aware system prompt
    const systemPrompt = `You are KIISHA, an AI assistant for infrastructure and renewable energy asset management. Be concise, helpful, and professional. Use markdown formatting for clarity.

Current context:
- Organization ID: ${organizationId}
${projectId ? `- Active Project ID: ${projectId}` : ""}
- Channel: ${activeChannel}

Respond with real data when available. If you don't have specific data, suggest where to find it in the platform.`;

    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages
        .filter((m) => m.status !== "error")
        .slice(-10) // Keep last 10 messages for context window
        .map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage.content },
    ];

    sendMessage.mutate({ messages: allMessages });
  }, [inputValue, isLoading, activeChannel, organizationId, projectId, messages, sendMessage]);

  // Handle retry
  const handleRetry = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message || message.role !== "user") return;

      // Remove error messages after this one
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        return prev.slice(0, idx + 1).map((m) =>
          m.id === messageId ? { ...m, status: "sending" as const } : m
        );
      });
      setIsLoading(true);

      const systemPrompt = `You are KIISHA, an AI assistant for infrastructure and renewable energy asset management. Organization ID: ${organizationId}. Be concise and helpful.`;

      sendMessage.mutate({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.content },
        ],
      });
    },
    [messages, organizationId, sendMessage]
  );

  // Handle quick action
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (isLoading) return;

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: action.prompt,
        timestamp: new Date(),
        channel: activeChannel,
        status: "sending",
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const systemPrompt = `You are KIISHA, an AI assistant for infrastructure and renewable energy asset management. Organization ID: ${organizationId}. Be concise and helpful.`;

      sendMessage.mutate({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: action.prompt },
        ],
      });
    },
    [activeChannel, organizationId, sendMessage, isLoading]
  );

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Format relative time
  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Render message
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    const hasError = message.status === "error";

    return (
      <div
        key={message.id}
        className={cn(
          "group flex gap-2.5 py-3 px-3 rounded-lg transition-colors",
          isUser
            ? "bg-primary/5 hover:bg-primary/8"
            : hasError
              ? "bg-destructive/5"
              : "hover:bg-muted/50"
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted border border-border"
          )}
        >
          {isUser ? (
            <User className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {isUser ? "You" : "KIISHA"}
            </span>
            {message.channel && message.channel !== "webchat" && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {channelLabels[message.channel as ChannelType] || message.channel}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              {formatTime(message.timestamp)}
            </span>
          </div>
          <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Streamdown text={message.content} />
          </div>
          {/* Error state with retry */}
          {isUser && hasError && message.errorRetryable && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-destructive">Failed to send</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => handleRetry(message.id)}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}
          {/* Sending indicator */}
          {isUser && message.status === "sending" && (
            <span className="text-[10px] text-muted-foreground/60">Sending...</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating trigger button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="lg"
            className={cn(
              "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
              "hover:scale-105 active:scale-95 transition-all",
              "bg-primary hover:bg-primary/90",
              className
            )}
            onClick={() => setIsOpen(true)}
            aria-label="Open KIISHA Assistant"
          >
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>KIISHA Assistant</p>
        </TooltipContent>
      </Tooltip>

      {/* Chat sidebar sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[420px] sm:w-[460px] p-0 flex flex-col gap-0"
          onEscapeKeyDown={() => setIsOpen(false)}
        >
          {/* Header */}
          <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-base leading-tight">KIISHA Assistant</SheetTitle>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-[11px] text-muted-foreground">Online</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Channel selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs">
                      {channelIcons[activeChannel]}
                      {channelLabels[activeChannel]}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setActiveChannel("webchat")}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Web Chat
                      {activeChannel === "webchat" && (
                        <Badge variant="secondary" className="ml-auto text-[10px]">Active</Badge>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {linkedChannels
                      ?.filter((c) => c.verificationStatus === "verified")
                      .map((channel) => (
                        <DropdownMenuItem
                          key={channel.id}
                          onClick={() =>
                            setActiveChannel(channel.channelType as ChannelType)
                          }
                        >
                          {channelIcons[channel.channelType as ChannelType]}
                          <span className="ml-2">
                            {channelLabels[channel.channelType as ChannelType]}
                          </span>
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            Linked
                          </Badge>
                        </DropdownMenuItem>
                      ))}
                    {(!linkedChannels ||
                      linkedChannels.filter((c) => c.verificationStatus === "verified")
                        .length === 0) && (
                      <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                        No linked channels
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/settings/channels" className="flex items-center">
                        <Link2 className="h-4 w-4 mr-2" />
                        Link New Channel
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </SheetHeader>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto px-3 py-2 relative"
            ref={scrollAreaRef}
            onScroll={handleScroll}
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-1">How can I help?</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                  Ask about your portfolio, documents, alerts, compliance, or operations.
                </p>

                {/* Quick actions grid */}
                <div className="grid grid-cols-2 gap-2 w-full max-w-[340px]">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 rounded-lg border border-border/50",
                        "hover:bg-muted/80 hover:border-border transition-all text-left",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isLoading && "opacity-50 pointer-events-none"
                      )}
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary">{action.icon}</span>
                        <span className="text-sm font-medium">{action.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        {action.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map(renderMessage)}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-2.5 py-3 px-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5 py-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">
                        Analyzing...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Scroll to bottom button */}
            {showScrollToBottom && messages.length > 0 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-2 right-4 h-8 w-8 rounded-full shadow-md"
                onClick={scrollToBottom}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t bg-background">
            {/* Quick action pills when there are messages */}
            {messages.length > 0 && (
              <div className="flex gap-1.5 px-3 pt-2.5 pb-1 overflow-x-auto scrollbar-none">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 gap-1 h-7 text-[11px] rounded-full px-2.5"
                    onClick={() => handleQuickAction(action)}
                    disabled={isLoading}
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex gap-2 p-3 pt-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isLoading ? "Waiting for response..." : "Ask KIISHA anything..."}
                className="min-h-[42px] max-h-[120px] resize-none text-sm"
                disabled={isLoading}
                aria-label="Chat message input"
              />
              <Button
                size="icon"
                className="h-[42px] w-[42px] flex-shrink-0"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Send message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-1.5 pb-2.5 px-3">
              <Shield className="h-3 w-3 text-muted-foreground/40" />
              <p className="text-[10px] text-muted-foreground/60">
                VATR-compliant. Messages are logged for compliance.
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default OpenClawChatSidebar;
