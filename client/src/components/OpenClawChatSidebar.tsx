/**
 * OpenClaw Chat Sidebar Component
 * 
 * A collapsible sidebar that provides unified chat access across all KIISHA views.
 * Integrates with OpenClaw for multi-channel AI assistant functionality.
 * 
 * Features:
 * - Persistent across all views
 * - Channel switching (WhatsApp, Telegram, Slack, Web)
 * - Conversation history
 * - Quick actions and suggested prompts
 * - VATR-compliant message logging
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MessageCircle,
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  ChevronRight,
  Settings,
  History,
  Zap,
  FileText,
  AlertTriangle,
  Wrench,
  BarChart3,
  Phone,
  MessageSquare,
  Hash,
  Link2,
  X,
  Plus,
  RefreshCw,
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
}

// Channel type
type ChannelType = "webchat" | "whatsapp" | "telegram" | "slack";

// Quick action type
interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
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

// Quick actions
const quickActions: QuickAction[] = [
  {
    id: "portfolio",
    label: "Portfolio Summary",
    icon: <BarChart3 className="h-4 w-4" />,
    prompt: "Show me my portfolio summary",
  },
  {
    id: "documents",
    label: "Document Status",
    icon: <FileText className="h-4 w-4" />,
    prompt: "What documents are missing or pending?",
  },
  {
    id: "alerts",
    label: "Active Alerts",
    icon: <AlertTriangle className="h-4 w-4" />,
    prompt: "Show me all active alerts",
  },
  {
    id: "tickets",
    label: "Work Orders",
    icon: <Wrench className="h-4 w-4" />,
    prompt: "List open work orders",
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Get linked channels
  const { data: linkedChannels } = trpc.openclaw.getLinkedChannels.useQuery(
    { organizationId },
    { enabled: isOpen }
  );
  
  // Get conversation history
  const { data: history, refetch: refetchHistory } = trpc.openclaw.getConversationHistory.useQuery(
    { organizationId, limit: 50 },
    { enabled: isOpen }
  );
  
  // Send message mutation (for web chat)
  const sendMessage = trpc.ai.chat.useMutation({
    onSuccess: (response) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date(),
        channel: "webchat",
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
        channel: "webchat",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    },
  });
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Load history when opened
  useEffect(() => {
    if (isOpen && history?.items) {
      const historyMessages: ChatMessage[] = history.items.flatMap((item) => [
        {
          id: `hist-user-${item.id}`,
          role: "user" as const,
          content: item.userMessage,
          timestamp: new Date(item.messageReceivedAt),
          channel: item.channelType,
        },
        {
          id: `hist-ai-${item.id}`,
          role: "assistant" as const,
          content: item.aiResponse,
          timestamp: new Date(item.messageReceivedAt),
          channel: item.channelType,
        },
      ]);
      // Only set if we don't have messages yet
      if (messages.length === 0) {
        setMessages(historyMessages.reverse());
      }
    }
  }, [isOpen, history]);
  
  // Handle send message
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
      channel: activeChannel,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    
    // Build context-aware system prompt
    const systemPrompt = `You are KIISHA, an AI assistant for infrastructure asset management. You help users with:
- Portfolio and project information
- Document status and verification
- Alerts and compliance
- Work orders and maintenance
- Financial metrics and reporting

Current context:
- Organization ID: ${organizationId}
${projectId ? `- Project ID: ${projectId}` : ""}
- Channel: ${activeChannel}

Be concise, helpful, and professional. Use markdown formatting for clarity.`;
    
    const allMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage.content },
    ];
    
    sendMessage.mutate({ messages: allMessages });
  }, [inputValue, isLoading, activeChannel, organizationId, projectId, messages, sendMessage]);
  
  // Handle quick action
  const handleQuickAction = useCallback((action: QuickAction) => {
    setInputValue(action.prompt);
    // Auto-send after a brief delay
    setTimeout(() => {
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: action.prompt,
        timestamp: new Date(),
        channel: activeChannel,
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      
      const systemPrompt = `You are KIISHA, an AI assistant for infrastructure asset management. Organization ID: ${organizationId}. Be concise and helpful.`;
      
      sendMessage.mutate({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: action.prompt },
        ],
      });
    }, 100);
  }, [activeChannel, organizationId, sendMessage]);
  
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
  
  // Render message
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3 p-3 rounded-lg",
          isUser ? "bg-primary/10" : "bg-muted"
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
            isUser ? "bg-primary text-primary-foreground" : "bg-secondary"
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {isUser ? "You" : "KIISHA"}
            </span>
            {message.channel && message.channel !== "webchat" && (
              <Badge variant="outline" className="text-xs">
                {channelLabels[message.channel as ChannelType] || message.channel}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {message.timestamp.toLocaleTimeString()}
            </span>
          </div>
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <Streamdown text={message.content} />
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <>
      {/* Floating trigger button */}
      <Button
        variant="default"
        size="lg"
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "hover:scale-105 transition-transform",
          className
        )}
        onClick={() => setIsOpen(true)}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      
      {/* Chat sidebar sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg">KIISHA Assistant</SheetTitle>
                  <p className="text-xs text-muted-foreground">
                    Powered by OpenClaw
                  </p>
                </div>
              </div>
              
              {/* Channel selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {channelIcons[activeChannel]}
                    {channelLabels[activeChannel]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setActiveChannel("webchat")}>
                    {channelIcons.webchat}
                    <span className="ml-2">Web Chat</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {linkedChannels?.filter((c) => c.verificationStatus === "verified").map((channel) => (
                    <DropdownMenuItem
                      key={channel.id}
                      onClick={() => setActiveChannel(channel.channelType as ChannelType)}
                    >
                      {channelIcons[channel.channelType as ChannelType]}
                      <span className="ml-2">
                        {channelLabels[channel.channelType as ChannelType]}
                      </span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Linked
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link2 className="h-4 w-4" />
                    <span className="ml-2">Link New Channel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SheetHeader>
          
          {/* Messages area */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Welcome to KIISHA Assistant</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Ask me anything about your portfolio, documents, alerts, or operations.
                </p>
                
                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2 w-full">
                  {quickActions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      className="h-auto py-3 flex flex-col items-center gap-1"
                      onClick={() => handleQuickAction(action)}
                    >
                      {action.icon}
                      <span className="text-xs">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(renderMessage)}
                
                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3 p-3 rounded-lg bg-muted">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        Thinking...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          
          {/* Input area */}
          <div className="p-4 border-t">
            {/* Quick action buttons when there are messages */}
            {messages.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0 gap-1"
                    onClick={() => handleQuickAction(action)}
                  >
                    {action.icon}
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask KIISHA anything..."
                className="min-h-[44px] max-h-[120px] resize-none"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Messages are logged for compliance. Press Enter to send.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default OpenClawChatSidebar;
