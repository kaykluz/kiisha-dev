/**
 * Provider Factory
 * 
 * Creates and manages provider adapter instances based on organization configuration.
 * Handles caching, initialization, and provider switching.
 */

import { getDb } from '../db';
import { orgIntegrations, integrationEvents, InsertIntegrationEvent } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import type { IntegrationType, ProviderIdentifier, OrgIntegration } from '../../shared/providers/types';
import type {
  StorageProviderAdapter,
  LLMProviderAdapter,
  EmailIngestProviderAdapter,
  WhatsAppProviderAdapter,
  NotifyProviderAdapter,
  ObservabilityProviderAdapter,
  TestConnectionResult,
} from './interfaces';
import { getAllSecrets, storeSecret, deleteSecrets, generateWebhookSecret, generateVerifyToken } from './secrets';

// Import adapters
import { ManusStorageAdapter } from './adapters/storage/manus';
import { S3StorageAdapter } from './adapters/storage/s3';
import { R2StorageAdapter } from './adapters/storage/r2';
import { SupabaseStorageAdapter } from './adapters/storage/supabase';
import { ManusLLMAdapter } from './adapters/llm/manus';
import { OpenAILLMAdapter } from './adapters/llm/openai';
import { AnthropicLLMAdapter } from './adapters/llm/anthropic';
import { GeminiLLMAdapter } from './adapters/llm/gemini';
import { DeepSeekLLMAdapter } from './adapters/llm/deepseek';
import { GrokLLMAdapter } from './adapters/llm/grok';
import { LlamaLLMAdapter } from './adapters/llm/llama';
import { SendGridEmailAdapter } from './adapters/email/sendgrid';
import { MailgunEmailAdapter } from './adapters/email/mailgun';
import { PostmarkEmailAdapter } from './adapters/email/postmark';
import { MetaWhatsAppAdapter } from './adapters/whatsapp/meta';
import { SendGridNotifyAdapter } from './adapters/notify/sendgrid';
import { ResendNotifyAdapter } from './adapters/notify/resend';
import { SentryObservabilityAdapter } from './adapters/observability/sentry';
import { CustomObservabilityAdapter } from './adapters/observability/custom';

// Cache for initialized adapters
const adapterCache = new Map<string, unknown>();

function getCacheKey(orgId: number, type: IntegrationType): string {
  return `${orgId}:${type}`;
}

/**
 * Get or create a storage provider adapter for an organization.
 */
export async function getStorageAdapter(orgId: number): Promise<StorageProviderAdapter> {
  const cacheKey = getCacheKey(orgId, 'storage');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as StorageProviderAdapter;
  }
  
  const integration = await getActiveIntegration(orgId, 'storage');
  
  let adapter: StorageProviderAdapter;
  
  if (!integration || integration.provider === 'manus') {
    // Default to Manus built-in storage
    adapter = new ManusStorageAdapter();
    await adapter.initialize({});
  } else {
    const secrets = await getAllSecrets(integration.id);
    const config = integration.config || {};
    
    switch (integration.provider) {
      case 's3':
        adapter = new S3StorageAdapter();
        break;
      case 'r2':
        adapter = new R2StorageAdapter();
        break;
      case 'supabase':
        adapter = new SupabaseStorageAdapter();
        break;
      default:
        adapter = new ManusStorageAdapter();
    }
    
    await adapter.initialize(config, secrets);
  }
  
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

// Platform-wide LLM configuration ID (superuser-controlled)
const PLATFORM_LLM_ORG_ID = 0;

// Track Manus fallback for alerting
let lastManusFallbackAlert: number = 0;
const MANUS_FALLBACK_ALERT_INTERVAL = 60 * 60 * 1000; // 1 hour between alerts

/**
 * Log alert to superusers when Manus fallback is triggered.
 */
async function logManusFallbackAlert(reason: string): Promise<void> {
  const now = Date.now();
  if (now - lastManusFallbackAlert < MANUS_FALLBACK_ALERT_INTERVAL) {
    return; // Don't spam alerts
  }
  lastManusFallbackAlert = now;
  
  console.error(`[LLM FALLBACK ALERT] Using Manus fallback LLM. Reason: ${reason}`);
  console.error('[LLM FALLBACK ALERT] Superusers should configure a primary LLM provider (OpenAI, Anthropic, Gemini, DeepSeek, Grok, or Llama)');
  
  // Log to database for superuser visibility
  try {
    const db = await getDb();
    if (db) {
      await db.insert(integrationEvents).values({
        integrationId: 0, // Platform-level event
        eventType: 'llm_fallback',
        eventData: {
          reason,
          timestamp: new Date().toISOString(),
          message: 'Platform fell back to Manus LLM. Configure a primary LLM provider.',
        },
        createdAt: new Date(),
      } as InsertIntegrationEvent);
    }
  } catch (err) {
    console.error('[LLM FALLBACK ALERT] Failed to log to database:', err);
  }
}

/**
 * Create an LLM adapter instance for a given provider.
 */
function createLLMAdapter(provider: string): LLMProviderAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAILLMAdapter();
    case 'anthropic':
      return new AnthropicLLMAdapter();
    case 'gemini':
      return new GeminiLLMAdapter();
    case 'deepseek':
      return new DeepSeekLLMAdapter();
    case 'grok':
      return new GrokLLMAdapter();
    case 'llama':
      return new LlamaLLMAdapter();
    default:
      return new ManusLLMAdapter();
  }
}

/**
 * Get the platform-wide LLM adapter (superuser-configured).
 * This is used by all organizations across the platform.
 * 
 * Priority:
 * 1. Platform-configured LLM (orgId=0)
 * 2. Manus (absolute last resort, with superuser alert)
 */
export async function getPlatformLLMAdapter(): Promise<LLMProviderAdapter> {
  const cacheKey = getCacheKey(PLATFORM_LLM_ORG_ID, 'llm');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as LLMProviderAdapter;
  }
  
  // Check for platform-wide LLM configuration (orgId=0)
  const integration = await getActiveIntegration(PLATFORM_LLM_ORG_ID, 'llm');
  
  let adapter: LLMProviderAdapter;
  
  if (integration && integration.provider !== 'manus') {
    // Use the platform-configured LLM
    const secrets = await getAllSecrets(integration.id);
    const config = integration.config || {};
    
    adapter = createLLMAdapter(integration.provider);
    await adapter.initialize(config, secrets);
    
    console.log(`[LLM] Using platform-configured provider: ${integration.provider}`);
  } else {
    // No platform LLM configured - fall back to Manus with alert
    await logManusFallbackAlert('No platform LLM integration configured');
    
    adapter = new ManusLLMAdapter();
    await adapter.initialize({});
  }
  
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get or create an LLM provider adapter.
 * 
 * This function now uses the platform-wide LLM configuration (orgId=0)
 * which is controlled by superusers only. All organizations share the same LLM.
 * 
 * @param _orgId - Deprecated, kept for backwards compatibility. Ignored.
 */
export async function getLLMAdapter(_orgId?: number): Promise<LLMProviderAdapter> {
  // Always use platform-wide LLM configuration
  return getPlatformLLMAdapter();
}

/**
 * Get or create an email ingest provider adapter for an organization.
 */
export async function getEmailIngestAdapter(orgId: number): Promise<EmailIngestProviderAdapter | null> {
  const cacheKey = getCacheKey(orgId, 'email_ingest');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as EmailIngestProviderAdapter;
  }
  
  const integration = await getActiveIntegration(orgId, 'email_ingest');
  
  if (!integration) {
    return null; // Email ingestion not configured
  }
  
  const secrets = await getAllSecrets(integration.id);
  const config = integration.config || {};
  
  let adapter: EmailIngestProviderAdapter;
  
  switch (integration.provider) {
    case 'sendgrid':
      adapter = new SendGridEmailAdapter();
      break;
    case 'mailgun':
      adapter = new MailgunEmailAdapter();
      break;
    case 'postmark':
      adapter = new PostmarkEmailAdapter();
      break;
    default:
      return null;
  }
  
  await adapter.initialize(config, secrets);
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get or create a WhatsApp provider adapter for an organization.
 */
export async function getWhatsAppAdapter(orgId: number): Promise<WhatsAppProviderAdapter | null> {
  const cacheKey = getCacheKey(orgId, 'whatsapp');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as WhatsAppProviderAdapter;
  }
  
  const integration = await getActiveIntegration(orgId, 'whatsapp');
  
  if (!integration) {
    return null;
  }
  
  const secrets = await getAllSecrets(integration.id);
  const config = integration.config || {};
  
  const adapter = new MetaWhatsAppAdapter();
  await adapter.initialize(config, secrets);
  
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get or create a notify provider adapter for an organization.
 */
export async function getNotifyAdapter(orgId: number): Promise<NotifyProviderAdapter> {
  const cacheKey = getCacheKey(orgId, 'notify');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as NotifyProviderAdapter;
  }
  
  const integration = await getActiveIntegration(orgId, 'notify');
  
  let adapter: NotifyProviderAdapter;
  
  // Always use Resend as the default email provider
  const { env } = await import('../_core/env');
  
  if (!integration) {
    // No integration configured - use Resend from environment
    adapter = new ResendNotifyAdapter();
    await adapter.initialize({}, { apiKey: env.resendApiKey });
  } else {
    const secrets = await getAllSecrets(integration.id);
    const config = integration.config || {};
    
    switch (integration.provider) {
      case 'sendgrid':
        adapter = new SendGridNotifyAdapter();
        break;
      case 'resend':
      default:
        // Default to Resend for all cases
        adapter = new ResendNotifyAdapter();
        break;
    }
    
    // Use secrets from integration if available, otherwise fall back to env
    const apiKey = secrets?.apiKey || env.resendApiKey;
    await adapter.initialize(config, { ...secrets, apiKey });
  }
  
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get or create an observability provider adapter for an organization.
 */
export async function getObservabilityAdapter(orgId: number): Promise<ObservabilityProviderAdapter> {
  const cacheKey = getCacheKey(orgId, 'observability');
  
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey) as ObservabilityProviderAdapter;
  }
  
  const integration = await getActiveIntegration(orgId, 'observability');
  
  let adapter: ObservabilityProviderAdapter;
  
  if (!integration || integration.provider === 'custom') {
    adapter = new CustomObservabilityAdapter();
    await adapter.initialize({});
  } else {
    const secrets = await getAllSecrets(integration.id);
    const config = integration.config || {};
    
    switch (integration.provider) {
      case 'sentry':
        adapter = new SentryObservabilityAdapter();
        break;
      default:
        adapter = new CustomObservabilityAdapter();
    }
    
    await adapter.initialize(config, secrets);
  }
  
  adapterCache.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get the active integration for an organization and type.
 */
export async function getActiveIntegration(
  orgId: number,
  type: IntegrationType
): Promise<OrgIntegration | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(orgIntegrations)
    .where(
      and(
        eq(orgIntegrations.organizationId, orgId),
        eq(orgIntegrations.integrationType, type),
        eq(orgIntegrations.status, 'connected')
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] as unknown as OrgIntegration : null;
}

/**
 * Get all integrations for an organization.
 */
export async function getOrgIntegrations(orgId: number): Promise<OrgIntegration[]> {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.organizationId, orgId));
  
  return result as unknown as OrgIntegration[];
}

/**
 * Create or update an integration.
 */
export async function upsertIntegration(
  orgId: number,
  type: IntegrationType,
  provider: ProviderIdentifier,
  config: Record<string, unknown>,
  secrets: Record<string, string>,
  userId: number
): Promise<{ integration: OrgIntegration; webhookConfig?: { url: string; secret?: string; verifyToken?: string } }> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Check for existing integration
  const existing = await db.select()
    .from(orgIntegrations)
    .where(
      and(
        eq(orgIntegrations.organizationId, orgId),
        eq(orgIntegrations.integrationType, type)
      )
    )
    .limit(1);
  
  let integrationId: number;
  let webhookUrl: string | undefined;
  let webhookSecret: string | undefined;
  let verifyToken: string | undefined;
  
  // Generate webhook config for inbound integrations
  if (type === 'email_ingest' || type === 'whatsapp') {
    const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.com';
    webhookSecret = generateWebhookSecret();
    verifyToken = generateVerifyToken();
    webhookUrl = `${baseUrl}/api/webhooks/${type}/${orgId}`;
  }
  
  if (existing.length > 0) {
    // Update existing
    integrationId = existing[0].id;
    
    await db.update(orgIntegrations)
      .set({
        provider,
        config,
        status: 'not_configured',
        connectedBy: userId,
        webhookUrl,
        webhookSecret,
        verifyToken,
        updatedAt: new Date(),
      })
      .where(eq(orgIntegrations.id, integrationId));
    
    // Delete old secrets
    await deleteSecrets(integrationId);
  } else {
    // Create new
    const result = await db.insert(orgIntegrations).values({
      organizationId: orgId,
      integrationType: type,
      provider,
      config,
      status: 'not_configured',
      connectedBy: userId,
      webhookUrl,
      webhookSecret,
      verifyToken,
    });
    
    integrationId = Number(result[0].insertId);
  }
  
  // Store secrets
  for (const [key, value] of Object.entries(secrets)) {
    if (value) {
      await storeSecret(orgId, integrationId, key, value);
    }
  }
  
  // Log event
  await logIntegrationEvent(orgId, integrationId, 'config_changed', { provider }, userId);
  
  // Clear cache
  adapterCache.delete(getCacheKey(orgId, type));
  
  // Get updated integration
  const updated = await db.select()
    .from(orgIntegrations)
    .where(eq(orgIntegrations.id, integrationId))
    .limit(1);
  
  return {
    integration: updated[0] as unknown as OrgIntegration,
    webhookConfig: webhookUrl ? { url: webhookUrl, secret: webhookSecret, verifyToken } : undefined,
  };
}

/**
 * Test an integration connection.
 */
export async function testIntegration(
  orgId: number,
  type: IntegrationType
): Promise<TestConnectionResult> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const integration = await getActiveIntegration(orgId, type);
  if (!integration) {
    return { success: false, message: 'Integration not configured' };
  }
  
  let result: TestConnectionResult;
  
  try {
    // Get the appropriate adapter and test
    switch (type) {
      case 'storage':
        const storageAdapter = await getStorageAdapter(orgId);
        result = await storageAdapter.testConnection();
        break;
      case 'llm':
        const llmAdapter = await getLLMAdapter(orgId);
        result = await llmAdapter.testConnection();
        break;
      case 'email_ingest':
        const emailAdapter = await getEmailIngestAdapter(orgId);
        result = emailAdapter ? await emailAdapter.testConnection() : { success: false, message: 'Not configured' };
        break;
      case 'whatsapp':
        const whatsappAdapter = await getWhatsAppAdapter(orgId);
        result = whatsappAdapter ? await whatsappAdapter.testConnection() : { success: false, message: 'Not configured' };
        break;
      case 'notify':
        const notifyAdapter = await getNotifyAdapter(orgId);
        result = await notifyAdapter.testConnection();
        break;
      case 'observability':
        const obsAdapter = await getObservabilityAdapter(orgId);
        result = await obsAdapter.testConnection();
        break;
      default:
        result = { success: false, message: 'Unknown integration type' };
    }
  } catch (error) {
    result = {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // Update integration status
  await db.update(orgIntegrations)
    .set({
      status: result.success ? 'connected' : 'error',
      lastTestAt: new Date(),
      lastTestSuccess: result.success,
      lastError: result.success ? null : result.message,
      connectedAt: result.success ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(orgIntegrations.id, integration.id));
  
  // Log event
  await logIntegrationEvent(
    orgId,
    integration.id,
    result.success ? 'test_success' : 'test_failed',
    { message: result.message, latencyMs: result.latencyMs }
  );
  
  // Clear cache on status change
  adapterCache.delete(getCacheKey(orgId, type));
  
  return result;
}

/**
 * Disconnect an integration.
 */
export async function disconnectIntegration(
  orgId: number,
  type: IntegrationType,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const integration = await db.select()
    .from(orgIntegrations)
    .where(
      and(
        eq(orgIntegrations.organizationId, orgId),
        eq(orgIntegrations.integrationType, type)
      )
    )
    .limit(1);
  
  if (integration.length === 0) return;
  
  const integrationId = integration[0].id;
  
  // Delete secrets
  await deleteSecrets(integrationId);
  
  // Update status
  await db.update(orgIntegrations)
    .set({
      status: 'disabled',
      config: null,
      secretRef: null,
      webhookUrl: null,
      webhookSecret: null,
      verifyToken: null,
      updatedAt: new Date(),
    })
    .where(eq(orgIntegrations.id, integrationId));
  
  // Log event
  await logIntegrationEvent(orgId, integrationId, 'disconnected', {}, userId);
  
  // Clear cache
  adapterCache.delete(getCacheKey(orgId, type));
}

/**
 * Log an integration event.
 */
async function logIntegrationEvent(
  orgId: number,
  integrationId: number,
  eventType: InsertIntegrationEvent['eventType'],
  eventData?: Record<string, unknown>,
  userId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(integrationEvents).values({
    organizationId: orgId,
    integrationId,
    eventType,
    eventData,
    userId,
  });
}

/**
 * Clear adapter cache for an organization.
 */
export function clearAdapterCache(orgId?: number): void {
  if (orgId) {
    // Clear specific org's adapters
    for (const key of Array.from(adapterCache.keys())) {
      if (key.startsWith(`${orgId}:`)) {
        adapterCache.delete(key);
      }
    }
  } else {
    // Clear all
    adapterCache.clear();
  }
}
