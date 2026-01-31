/**
 * OpenClaw Plugin SDK Types
 * 
 * These types define the interface between OpenClaw and KIISHA Bridge
 */

// Channel types supported by OpenClaw
export type ChannelType = 
  | "whatsapp" 
  | "telegram" 
  | "slack" 
  | "discord" 
  | "msteams" 
  | "signal" 
  | "imessage" 
  | "matrix" 
  | "googlechat" 
  | "webchat";

// Message types
export type MessageType = "text" | "image" | "audio" | "video" | "document" | "location";

// Incoming message from a channel
export interface IncomingMessage {
  id: string;
  timestamp: string;
  type: MessageType;
  text?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  sender: {
    id: string;
    handle?: string;
    displayName?: string;
  };
  attachments?: Array<{
    type: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  replyToId?: string;
}

// Message context
export interface MessageContext {
  channel: {
    type: ChannelType;
    accountId?: string;
  };
  sessionId?: string;
  group?: {
    id: string;
    name?: string;
  };
}

// Message handler response
export interface MessageHandlerResponse {
  reply?: string;
  sessionId?: string;
  error?: boolean;
}

// Skill definition
export interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  category: string;
  examples: string[];
  handler: (params: Record<string, unknown>, context: SkillContext) => Promise<SkillResult>;
}

// Skill execution context
export interface SkillContext {
  userId?: number;
  organizationId?: number;
  channelType: ChannelType;
  sessionId?: string;
}

// Skill result
export interface SkillResult {
  success: boolean;
  data?: unknown;
  message?: string;
  error?: string;
}

// Plugin API provided by OpenClaw
export interface OpenClawPluginApi {
  // Register a skill
  registerSkill(skill: OpenClawSkill): void;
  
  // Register a message handler
  onMessage(handler: (message: IncomingMessage, context: MessageContext) => Promise<MessageHandlerResponse>): void;
  
  // Register a webhook endpoint
  registerWebhook(path: string, handler: (req: unknown, res: unknown) => Promise<void>): void;
  
  // Get runtime configuration
  getConfig(): Record<string, unknown>;
  
  // Log a message
  log(level: "debug" | "info" | "warn" | "error", message: string, data?: unknown): void;
}

// Plugin service interface
export interface OpenClawPluginService<TConfig = Record<string, unknown>> {
  id: string;
  name: string;
  description: string;
  configSchema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
  register(api: OpenClawPluginApi, config: TConfig): void;
}

// KIISHA Event - sent to KIISHA webhook
export interface KiishaEvent {
  eventId: string;
  timestamp: string;
  channel: {
    type: ChannelType;
    accountId?: string;
  };
  sender: {
    id: string;
    handle?: string;
    displayName?: string;
  };
  content: {
    type: MessageType;
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
    fileName?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  attachments?: Array<{
    type: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
  sessionId?: string;
  replyToMessageId?: string;
  group?: {
    id: string;
    name?: string;
  };
}

// KIISHA Response - returned from KIISHA webhook
export interface KiishaResponse {
  reply: string;
  sessionId?: string;
  requiresVerification?: boolean;
  error?: string;
}

// Task specification - sent from KIISHA to OpenClaw
export interface TaskSpec {
  taskId: string;
  taskType: "query" | "document" | "browser" | "skill" | "cron" | "api";
  capabilityId: string;
  task: Record<string, unknown>;
  constraints?: {
    maxRuntimeSeconds?: number;
    allowedDomains?: string[];
    sandboxLevel?: "none" | "basic" | "strict";
  };
  authContext: {
    userId: number;
    organizationId: number;
    projectIds?: number[];
    permissions: string[];
    tokenHash: string;
  };
}

// Task result - returned from OpenClaw to KIISHA
export interface TaskResult {
  taskId: string;
  status: "success" | "partial" | "failed" | "timeout" | "rejected";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  artifacts?: Array<{
    type: "file" | "text" | "json" | "screenshot";
    name: string;
    mimeType: string;
    size: number;
    content?: string;
    downloadUrl?: string;
    hash: string;
  }>;
  provenance?: {
    toolsUsed: string[];
    urlsAccessed: string[];
    actionsPerformed: Array<{
      action: string;
      target: string;
      timestamp: string;
      result: "success" | "failed";
    }>;
    logs: string[];
  };
  compliance?: {
    constraintsRespected: boolean;
    violations?: Array<{
      constraint: string;
      violation: string;
      severity: "warning" | "error";
    }>;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}
