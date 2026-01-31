/**
 * Provider-Agnostic Architecture Types
 * 
 * This module defines the capability registry and provider interfaces
 * that allow KIISHA to work with multiple backend providers.
 */

// ============ CAPABILITY REGISTRY ============

/**
 * Capabilities that providers can satisfy.
 * UI modules depend on capabilities, not specific vendors.
 */
export type Capability =
  | 'AUTH'           // Login, sessions, org membership, roles
  | 'STORAGE'        // Upload, download, signed URLs, versioning
  | 'EMAIL_INGEST'   // Inbound email → messages + attachments
  | 'WHATSAPP_INGEST' // Inbound WhatsApp → messages + media
  | 'NOTIFY'         // Outbound notifications (email, push, etc.)
  | 'LLM'            // Categorize, extract, summarize, entity resolution
  | 'OBSERVABILITY'  // Errors, performance, logs
  | 'MAPS';          // Geocoding, directions, places

/**
 * UI modules and their capability dependencies.
 * If a capability is not configured, dependent UI must be disabled.
 */
export const CAPABILITY_DEPENDENCIES: Record<string, Capability[]> = {
  // Document features
  'document-upload': ['STORAGE'],
  'document-download': ['STORAGE'],
  'document-preview': ['STORAGE'],
  
  // AI features
  'ai-categorization': ['LLM'],
  'ai-extraction': ['LLM'],
  'ai-entity-resolution': ['LLM'],
  'ai-summarization': ['LLM'],
  
  // Ingestion features
  'email-ingestion': ['EMAIL_INGEST', 'STORAGE'],
  'whatsapp-ingestion': ['WHATSAPP_INGEST', 'STORAGE'],
  
  // Notification features
  'email-notifications': ['NOTIFY'],
  'push-notifications': ['NOTIFY'],
  
  // Maps features
  'project-map': ['MAPS'],
  'site-geocoding': ['MAPS'],
  
  // Observability
  'error-tracking': ['OBSERVABILITY'],
  'performance-monitoring': ['OBSERVABILITY'],
};

// ============ PROVIDER TYPES ============

/**
 * Integration types supported by the platform.
 */
export type IntegrationType =
  | 'storage'
  | 'llm'
  | 'email_ingest'
  | 'whatsapp'
  | 'notify'
  | 'observability'
  | 'maps';

/**
 * Provider identifiers for each integration type.
 */
export type StorageProvider = 'manus' | 's3' | 'r2' | 'supabase' | 'gcs';
export type LLMProvider = 'manus' | 'openai' | 'anthropic' | 'azure_openai';
export type EmailIngestProvider = 'sendgrid' | 'mailgun' | 'postmark';
export type WhatsAppProvider = 'meta';
export type NotifyProvider = 'manus' | 'sendgrid' | 'ses' | 'resend';
export type ObservabilityProvider = 'sentry' | 'datadog' | 'custom';
export type MapsProvider = 'manus_proxy' | 'google' | 'mapbox';

export type ProviderIdentifier =
  | StorageProvider
  | LLMProvider
  | EmailIngestProvider
  | WhatsAppProvider
  | NotifyProvider
  | ObservabilityProvider
  | MapsProvider;

/**
 * Connection method for each provider.
 */
export type ConnectionMethod = 'oauth' | 'api_key' | 'webhook' | 'iam_role' | 'built_in';

/**
 * Integration status.
 */
export type IntegrationStatus = 'not_configured' | 'connected' | 'error' | 'disabled';

/**
 * Provider metadata for UI display.
 */
export interface ProviderInfo {
  id: ProviderIdentifier;
  name: string;
  description: string;
  logo?: string;
  connectionMethod: ConnectionMethod;
  capabilities: Capability[];
  configFields: ConfigField[];
  docsUrl?: string;
  oauthScopes?: string[];
  webhookFields?: WebhookField[];
}

/**
 * Configuration field for provider setup.
 */
export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

/**
 * Webhook configuration field.
 */
export interface WebhookField {
  key: string;
  label: string;
  type: 'endpoint' | 'secret' | 'verify_token';
  generated: boolean;
  copyable: boolean;
}

/**
 * Organization integration record.
 */
export interface OrgIntegration {
  id: number;
  orgId: number;
  organizationId: number; // Alias for orgId (from schema)
  integrationType: IntegrationType;
  provider: ProviderIdentifier;
  status: IntegrationStatus;
  config: Record<string, unknown> | null;
  secretRef?: string | null;
  connectedBy?: number | null;
  connectedAt?: Date | null;
  lastTestAt?: Date | null;
  lastTestSuccess?: boolean | null;
  lastError?: string | null;
  webhookUrl?: string | null;
  webhookSecret?: string | null;
  verifyToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Integration event for audit logging.
 */
export interface IntegrationEvent {
  id: number;
  orgId: number;
  integrationId: number;
  eventType: 'connected' | 'disconnected' | 'config_changed' | 'test_success' | 'test_failed' | 'webhook_received' | 'token_refreshed' | 'error';
  eventData?: Record<string, unknown>;
  userId?: number;
  createdAt: Date;
}

// ============ PROVIDER REGISTRY ============

/**
 * Registry of all available providers by integration type.
 */
export const PROVIDER_REGISTRY: Record<IntegrationType, ProviderInfo[]> = {
  storage: [
    {
      id: 'manus',
      name: 'Manus Storage',
      description: 'Built-in S3-compatible storage provided by Manus platform',
      connectionMethod: 'built_in',
      capabilities: ['STORAGE'],
      configFields: [],
    },
    {
      id: 's3',
      name: 'Amazon S3',
      description: 'Amazon Web Services Simple Storage Service',
      connectionMethod: 'api_key',
      capabilities: ['STORAGE'],
      configFields: [
        { key: 'bucket', label: 'Bucket Name', type: 'text', required: true, placeholder: 'my-bucket' },
        { key: 'region', label: 'Region', type: 'select', required: true, options: [
          { value: 'us-east-1', label: 'US East (N. Virginia)' },
          { value: 'us-west-2', label: 'US West (Oregon)' },
          { value: 'eu-west-1', label: 'EU (Ireland)' },
          { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
        ]},
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
        { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      ],
      docsUrl: 'https://docs.aws.amazon.com/s3/',
    },
    {
      id: 'r2',
      name: 'Cloudflare R2',
      description: 'S3-compatible object storage with zero egress fees',
      connectionMethod: 'api_key',
      capabilities: ['STORAGE'],
      configFields: [
        { key: 'accountId', label: 'Account ID', type: 'text', required: true },
        { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
        { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      ],
      docsUrl: 'https://developers.cloudflare.com/r2/',
    },
    {
      id: 'supabase',
      name: 'Supabase Storage',
      description: 'Open source storage with built-in CDN',
      connectionMethod: 'api_key',
      capabilities: ['STORAGE'],
      configFields: [
        { key: 'projectUrl', label: 'Project URL', type: 'url', required: true, placeholder: 'https://xxx.supabase.co' },
        { key: 'bucket', label: 'Bucket Name', type: 'text', required: true },
        { key: 'serviceKey', label: 'Service Role Key', type: 'password', required: true },
      ],
      docsUrl: 'https://supabase.com/docs/guides/storage',
    },
  ],
  
  llm: [
    {
      id: 'manus',
      name: 'Manus AI',
      description: 'Built-in LLM provided by Manus platform',
      connectionMethod: 'built_in',
      capabilities: ['LLM'],
      configFields: [],
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT-4, GPT-3.5-turbo, and other OpenAI models',
      connectionMethod: 'api_key',
      capabilities: ['LLM'],
      configFields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
        { key: 'model', label: 'Default Model', type: 'select', required: false, options: [
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        ]},
        { key: 'orgId', label: 'Organization ID', type: 'text', required: false, placeholder: 'org-...' },
      ],
      docsUrl: 'https://platform.openai.com/docs/',
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude 3 Opus, Sonnet, and Haiku models',
      connectionMethod: 'api_key',
      capabilities: ['LLM'],
      configFields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
        { key: 'model', label: 'Default Model', type: 'select', required: false, options: [
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
        ]},
      ],
      docsUrl: 'https://docs.anthropic.com/',
    },
    {
      id: 'azure_openai',
      name: 'Azure OpenAI',
      description: 'OpenAI models hosted on Azure',
      connectionMethod: 'api_key',
      capabilities: ['LLM'],
      configFields: [
        { key: 'endpoint', label: 'Endpoint URL', type: 'url', required: true, placeholder: 'https://xxx.openai.azure.com' },
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        { key: 'deploymentName', label: 'Deployment Name', type: 'text', required: true },
        { key: 'apiVersion', label: 'API Version', type: 'text', required: false, placeholder: '2024-02-15-preview' },
      ],
      docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/',
    },
  ],
  
  email_ingest: [
    {
      id: 'sendgrid',
      name: 'SendGrid Inbound Parse',
      description: 'Receive emails via SendGrid webhook',
      connectionMethod: 'webhook',
      capabilities: ['EMAIL_INGEST'],
      configFields: [
        { key: 'hostname', label: 'Receiving Hostname', type: 'text', required: true, placeholder: 'ingest.yourdomain.com', helpText: 'Domain that will receive forwarded emails' },
      ],
      webhookFields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'endpoint', generated: true, copyable: true },
        { key: 'webhookSecret', label: 'Webhook Secret', type: 'secret', generated: true, copyable: true },
      ],
      docsUrl: 'https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook',
    },
    {
      id: 'mailgun',
      name: 'Mailgun Routes',
      description: 'Receive emails via Mailgun routing',
      connectionMethod: 'webhook',
      capabilities: ['EMAIL_INGEST'],
      configFields: [
        { key: 'domain', label: 'Mailgun Domain', type: 'text', required: true, placeholder: 'mg.yourdomain.com' },
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, helpText: 'For signature verification' },
      ],
      webhookFields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'endpoint', generated: true, copyable: true },
      ],
      docsUrl: 'https://documentation.mailgun.com/en/latest/user_manual.html#routes',
    },
    {
      id: 'postmark',
      name: 'Postmark Inbound',
      description: 'Receive emails via Postmark inbound webhook',
      connectionMethod: 'webhook',
      capabilities: ['EMAIL_INGEST'],
      configFields: [],
      webhookFields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'endpoint', generated: true, copyable: true },
        { key: 'inboundAddress', label: 'Inbound Address', type: 'endpoint', generated: true, copyable: true },
      ],
      docsUrl: 'https://postmarkapp.com/developer/webhooks/inbound-webhook',
    },
  ],
  
  whatsapp: [
    {
      id: 'meta',
      name: 'Meta WhatsApp Cloud API',
      description: 'Official WhatsApp Business API via Meta',
      connectionMethod: 'webhook',
      capabilities: ['WHATSAPP_INGEST'],
      configFields: [
        { key: 'phoneNumberId', label: 'Phone Number ID', type: 'text', required: true },
        { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
        { key: 'businessAccountId', label: 'Business Account ID', type: 'text', required: false },
      ],
      webhookFields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'endpoint', generated: true, copyable: true },
        { key: 'verifyToken', label: 'Verify Token', type: 'verify_token', generated: true, copyable: true },
      ],
      docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    },
  ],
  
  notify: [
    {
      id: 'manus',
      name: 'Manus Notifications',
      description: 'Built-in notification service provided by Manus platform',
      connectionMethod: 'built_in',
      capabilities: ['NOTIFY'],
      configFields: [],
    },
    {
      id: 'sendgrid',
      name: 'SendGrid Email',
      description: 'Send transactional emails via SendGrid',
      connectionMethod: 'api_key',
      capabilities: ['NOTIFY'],
      configFields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        { key: 'fromEmail', label: 'From Email', type: 'text', required: true, placeholder: 'noreply@yourdomain.com' },
        { key: 'fromName', label: 'From Name', type: 'text', required: false, placeholder: 'KIISHA' },
      ],
      docsUrl: 'https://docs.sendgrid.com/',
    },
    {
      id: 'resend',
      name: 'Resend',
      description: 'Modern email API for developers',
      connectionMethod: 'api_key',
      capabilities: ['NOTIFY'],
      configFields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 're_...' },
        { key: 'fromEmail', label: 'From Email', type: 'text', required: true },
      ],
      docsUrl: 'https://resend.com/docs',
    },
  ],
  
  observability: [
    {
      id: 'sentry',
      name: 'Sentry',
      description: 'Error tracking and performance monitoring',
      connectionMethod: 'api_key',
      capabilities: ['OBSERVABILITY'],
      configFields: [
        { key: 'dsn', label: 'DSN', type: 'url', required: true, placeholder: 'https://xxx@sentry.io/xxx' },
        { key: 'environment', label: 'Environment', type: 'select', required: false, options: [
          { value: 'production', label: 'Production' },
          { value: 'staging', label: 'Staging' },
          { value: 'development', label: 'Development' },
        ]},
        { key: 'sampleRate', label: 'Sample Rate', type: 'text', required: false, placeholder: '1.0' },
      ],
      docsUrl: 'https://docs.sentry.io/',
    },
    {
      id: 'custom',
      name: 'Custom Logging',
      description: 'Built-in logging to console and files',
      connectionMethod: 'built_in',
      capabilities: ['OBSERVABILITY'],
      configFields: [
        { key: 'logLevel', label: 'Log Level', type: 'select', required: false, options: [
          { value: 'debug', label: 'Debug' },
          { value: 'info', label: 'Info' },
          { value: 'warn', label: 'Warn' },
          { value: 'error', label: 'Error' },
        ]},
      ],
    },
  ],
  
  maps: [
    {
      id: 'manus_proxy',
      name: 'Manus Maps Proxy',
      description: 'Google Maps via Manus proxy (no API key needed)',
      connectionMethod: 'built_in',
      capabilities: ['MAPS'],
      configFields: [],
    },
    {
      id: 'google',
      name: 'Google Maps',
      description: 'Direct Google Maps Platform integration',
      connectionMethod: 'api_key',
      capabilities: ['MAPS'],
      configFields: [
        { key: 'apiKey', label: 'API Key', type: 'password', required: true },
        { key: 'mapId', label: 'Map ID', type: 'text', required: false, helpText: 'For custom map styling' },
      ],
      docsUrl: 'https://developers.google.com/maps/documentation',
    },
  ],
};

/**
 * Get provider info by type and ID.
 */
export function getProviderInfo(type: IntegrationType, providerId: ProviderIdentifier): ProviderInfo | undefined {
  return PROVIDER_REGISTRY[type]?.find(p => p.id === providerId);
}

/**
 * Get all providers for an integration type.
 */
export function getProvidersForType(type: IntegrationType): ProviderInfo[] {
  return PROVIDER_REGISTRY[type] || [];
}

/**
 * Check if a capability is satisfied by any configured integration.
 */
export function isCapabilitySatisfied(
  capability: Capability,
  orgIntegrations: OrgIntegration[]
): boolean {
  const connectedIntegrations = orgIntegrations.filter(i => i.status === 'connected');
  
  for (const integration of connectedIntegrations) {
    const providers = PROVIDER_REGISTRY[integration.integrationType];
    const provider = providers?.find(p => p.id === integration.provider);
    if (provider?.capabilities.includes(capability)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the active provider for an integration type.
 */
export function getActiveProvider(
  type: IntegrationType,
  orgIntegrations: OrgIntegration[]
): OrgIntegration | undefined {
  return orgIntegrations.find(
    i => i.integrationType === type && i.status === 'connected'
  );
}


// ============ CAPABILITY REGISTRY (for UI) ============

/**
 * Capability registry mapping integration types to their capabilities.
 */
export const CAPABILITY_REGISTRY: Record<IntegrationType, {
  capabilities: Capability[];
  required: boolean;
  description: string;
}> = {
  storage: {
    capabilities: ['STORAGE'],
    required: true,
    description: 'File storage for documents and media',
  },
  llm: {
    capabilities: ['LLM'],
    required: true,
    description: 'AI-powered document processing',
  },
  email_ingest: {
    capabilities: ['EMAIL_INGEST'],
    required: false,
    description: 'Receive documents via email',
  },
  whatsapp: {
    capabilities: ['WHATSAPP_INGEST'],
    required: false,
    description: 'Receive documents via WhatsApp',
  },
  notify: {
    capabilities: ['NOTIFY'],
    required: false,
    description: 'Send notifications to users',
  },
  observability: {
    capabilities: ['OBSERVABILITY'],
    required: false,
    description: 'Error tracking and monitoring',
  },
  maps: {
    capabilities: ['MAPS'],
    required: false,
    description: 'Location and mapping services',
  },
};

/**
 * Provider options for UI selection.
 */
export interface ProviderOption {
  id: ProviderIdentifier;
  name: string;
  description: string;
  isBuiltIn: boolean;
  configFields?: ConfigField[];
  secretFields?: ConfigField[];
}

/**
 * Get provider options for an integration type.
 */
export const PROVIDER_OPTIONS: Record<IntegrationType, ProviderOption[]> = {
  storage: PROVIDER_REGISTRY.storage.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  llm: PROVIDER_REGISTRY.llm.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  email_ingest: PROVIDER_REGISTRY.email_ingest.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  whatsapp: PROVIDER_REGISTRY.whatsapp.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  notify: PROVIDER_REGISTRY.notify.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  observability: PROVIDER_REGISTRY.observability.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
  maps: PROVIDER_REGISTRY.maps.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isBuiltIn: p.connectionMethod === 'built_in',
    configFields: p.configFields.filter(f => f.type !== 'password'),
    secretFields: p.configFields.filter(f => f.type === 'password'),
  })),
};
