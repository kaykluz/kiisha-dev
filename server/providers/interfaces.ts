/**
 * Provider Adapter Interfaces
 * 
 * These interfaces define the contract that all provider adapters must implement.
 * No vendor SDK calls should exist outside of these adapter implementations.
 */

import type { IntegrationType, ProviderIdentifier, OrgIntegration } from '../../shared/providers/types';

// ============ BASE PROVIDER INTERFACE ============

export interface ProviderAdapter<TConfig = Record<string, unknown>> {
  /** Provider identifier */
  readonly providerId: ProviderIdentifier;
  
  /** Integration type this adapter handles */
  readonly integrationType: IntegrationType;
  
  /** Whether this is a built-in provider (no external config needed) */
  readonly isBuiltIn: boolean;
  
  /** Initialize the adapter with configuration */
  initialize(config: TConfig, secrets?: Record<string, string>): Promise<void>;
  
  /** Test the connection to the provider */
  testConnection(): Promise<TestConnectionResult>;
  
  /** Clean up resources when disconnecting */
  disconnect(): Promise<void>;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
}

// ============ STORAGE PROVIDER ============

export interface StorageProviderAdapter extends ProviderAdapter {
  /**
   * Upload a file to storage.
   * @param key - The storage key/path for the file
   * @param data - File data as Buffer or Uint8Array
   * @param contentType - MIME type of the file
   * @returns Object containing the storage key and public URL
   */
  put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StoragePutResult>;
  
  /**
   * Get a signed URL for downloading a file.
   * @param key - The storage key/path
   * @param expiresIn - URL expiration time in seconds (default: 3600)
   * @returns Object containing the key and signed URL
   */
  getSignedUrl(key: string, expiresIn?: number): Promise<StorageGetResult>;
  
  /**
   * Delete a file from storage.
   * @param key - The storage key/path
   */
  delete(key: string): Promise<void>;
  
  /**
   * Check if a file exists.
   * @param key - The storage key/path
   */
  exists(key: string): Promise<boolean>;
  
  /**
   * Get file metadata.
   * @param key - The storage key/path
   */
  getMetadata(key: string): Promise<StorageMetadata | null>;
}

export interface StoragePutResult {
  key: string;
  url: string;
  size?: number;
  etag?: string;
}

export interface StorageGetResult {
  key: string;
  url: string;
  expiresAt?: Date;
}

export interface StorageMetadata {
  key: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
}

// ============ LLM PROVIDER ============

export interface LLMProviderAdapter extends ProviderAdapter {
  /**
   * Send a chat completion request.
   * @param messages - Array of chat messages
   * @param options - Additional options like model, temperature, etc.
   */
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse>;
  
  /**
   * Send a structured output request with JSON schema.
   * @param messages - Array of chat messages
   * @param schema - JSON schema for the response
   * @param options - Additional options
   */
  structuredOutput<T>(
    messages: LLMMessage[],
    schema: LLMJsonSchema,
    options?: LLMChatOptions
  ): Promise<LLMStructuredResponse<T>>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | LLMContentPart[];
}

export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'file_url'; file_url: { url: string; mime_type?: string } };

export interface LLMChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  tools?: LLMTool[];
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface LLMJsonSchema {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
}

export interface LLMChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      toolCalls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    };
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMStructuredResponse<T> {
  data: T;
  raw: LLMChatResponse;
}

// ============ EMAIL INGEST PROVIDER ============

export interface EmailIngestProviderAdapter extends ProviderAdapter {
  /**
   * Generate webhook configuration for the provider.
   * @param orgId - Organization ID for the webhook
   */
  generateWebhookConfig(orgId: number): Promise<EmailWebhookConfig>;
  
  /**
   * Verify an incoming webhook signature.
   * @param payload - Raw request body
   * @param signature - Signature header value
   * @param secret - Webhook secret
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean;
  
  /**
   * Parse an incoming email webhook payload.
   * @param payload - Raw webhook payload
   */
  parseInboundEmail(payload: unknown): Promise<ParsedEmail>;
}

export interface EmailWebhookConfig {
  webhookUrl: string;
  webhookSecret: string;
  setupInstructions: string[];
  verificationSteps: string[];
}

export interface ParsedEmail {
  messageId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  receivedAt: Date;
  rawPayload: unknown;
}

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer | string; // Buffer or base64 string
  contentId?: string;
}

// ============ WHATSAPP PROVIDER ============

export interface WhatsAppProviderAdapter extends ProviderAdapter {
  /**
   * Generate webhook configuration for the provider.
   * @param orgId - Organization ID for the webhook
   */
  generateWebhookConfig(orgId: number): Promise<WhatsAppWebhookConfig>;
  
  /**
   * Verify webhook challenge (for Meta webhook verification).
   * @param mode - Hub mode
   * @param token - Verify token
   * @param challenge - Challenge string
   */
  verifyWebhookChallenge(mode: string, token: string, challenge: string, expectedToken: string): string | null;
  
  /**
   * Verify an incoming webhook signature.
   * @param payload - Raw request body
   * @param signature - X-Hub-Signature-256 header
   * @param appSecret - App secret for verification
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string, appSecret: string): boolean;
  
  /**
   * Parse an incoming WhatsApp message webhook.
   * @param payload - Webhook payload
   */
  parseInboundMessage(payload: unknown): Promise<ParsedWhatsAppMessage[]>;
  
  /**
   * Send a text message.
   * @param to - Recipient phone number
   * @param message - Message text
   */
  sendTextMessage(to: string, message: string): Promise<WhatsAppSendResult>;
  
  /**
   * Send a template message.
   * @param to - Recipient phone number
   * @param templateName - Template name
   * @param languageCode - Language code
   * @param components - Template components
   */
  sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: WhatsAppTemplateComponent[]
  ): Promise<WhatsAppSendResult>;
  
  /**
   * Download media from a message.
   * @param mediaId - Media ID from the message
   */
  downloadMedia(mediaId: string): Promise<WhatsAppMedia>;
}

export interface WhatsAppWebhookConfig {
  webhookUrl: string;
  verifyToken: string;
  setupInstructions: string[];
}

export interface ParsedWhatsAppMessage {
  messageId: string;
  from: string;
  timestamp: Date;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts' | 'reaction' | 'interactive';
  text?: string;
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: WhatsAppContact[];
  reaction?: { messageId: string; emoji: string };
  rawPayload: unknown;
}

export interface WhatsAppContact {
  name: { formatted_name: string; first_name?: string; last_name?: string };
  phones?: { phone: string; type?: string }[];
  emails?: { email: string; type?: string }[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: { type: string; text?: string; image?: { link: string } }[];
}

export interface WhatsAppSendResult {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
}

export interface WhatsAppMedia {
  data: Buffer;
  mimeType: string;
  filename?: string;
}

// ============ NOTIFY PROVIDER ============

export interface NotifyProviderAdapter extends ProviderAdapter {
  /**
   * Send an email notification.
   * @param options - Email options
   */
  sendEmail(options: SendEmailOptions): Promise<NotifySendResult>;
  
  /**
   * Send a notification to the platform owner.
   * @param title - Notification title
   * @param content - Notification content
   */
  notifyOwner(title: string, content: string): Promise<NotifySendResult>;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface NotifySendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============ OBSERVABILITY PROVIDER ============

export interface ObservabilityProviderAdapter extends ProviderAdapter {
  /**
   * Capture an error/exception.
   * @param error - Error object
   * @param context - Additional context
   */
  captureException(error: Error, context?: Record<string, unknown>): void;
  
  /**
   * Capture a message/event.
   * @param message - Message string
   * @param level - Severity level
   * @param context - Additional context
   */
  captureMessage(message: string, level: 'debug' | 'info' | 'warning' | 'error', context?: Record<string, unknown>): void;
  
  /**
   * Set user context for subsequent events.
   * @param user - User information
   */
  setUser(user: { id: string; email?: string; name?: string } | null): void;
  
  /**
   * Start a performance transaction.
   * @param name - Transaction name
   * @param op - Operation type
   */
  startTransaction(name: string, op: string): ObservabilityTransaction;
}

export interface ObservabilityTransaction {
  setTag(key: string, value: string): void;
  setData(key: string, value: unknown): void;
  finish(): void;
}

// ============ PROVIDER FACTORY ============

/**
 * Factory for creating provider adapters.
 */
export interface ProviderFactory {
  /**
   * Create a storage provider adapter.
   */
  createStorageAdapter(integration: OrgIntegration): Promise<StorageProviderAdapter>;
  
  /**
   * Create an LLM provider adapter.
   */
  createLLMAdapter(integration: OrgIntegration): Promise<LLMProviderAdapter>;
  
  /**
   * Create an email ingest provider adapter.
   */
  createEmailIngestAdapter(integration: OrgIntegration): Promise<EmailIngestProviderAdapter>;
  
  /**
   * Create a WhatsApp provider adapter.
   */
  createWhatsAppAdapter(integration: OrgIntegration): Promise<WhatsAppProviderAdapter>;
  
  /**
   * Create a notify provider adapter.
   */
  createNotifyAdapter(integration: OrgIntegration): Promise<NotifyProviderAdapter>;
  
  /**
   * Create an observability provider adapter.
   */
  createObservabilityAdapter(integration: OrgIntegration): Promise<ObservabilityProviderAdapter>;
}
