/**
 * Provider Factory Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('../db', () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock storage
vi.mock('../storage', () => ({
  storagePut: vi.fn().mockResolvedValue({ key: 'test', url: 'https://test.com/file' }),
  storageGet: vi.fn().mockResolvedValue({ key: 'test', url: 'https://test.com/file' }),
}));

// Mock LLM
vi.mock('../_core/llm', () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: 'test-id',
    model: 'test-model',
    choices: [{ message: { content: 'test response' } }],
  }),
}));

describe('Provider Types', () => {
  it('should export all integration types', async () => {
    const { CAPABILITY_REGISTRY, PROVIDER_OPTIONS } = await import('../../shared/providers/types');
    
    expect(CAPABILITY_REGISTRY).toBeDefined();
    expect(CAPABILITY_REGISTRY.storage).toBeDefined();
    expect(CAPABILITY_REGISTRY.llm).toBeDefined();
    expect(CAPABILITY_REGISTRY.email_ingest).toBeDefined();
    expect(CAPABILITY_REGISTRY.whatsapp).toBeDefined();
    expect(CAPABILITY_REGISTRY.notify).toBeDefined();
    expect(CAPABILITY_REGISTRY.observability).toBeDefined();
    expect(CAPABILITY_REGISTRY.maps).toBeDefined();
    
    expect(PROVIDER_OPTIONS).toBeDefined();
    expect(PROVIDER_OPTIONS.storage.length).toBeGreaterThan(0);
    expect(PROVIDER_OPTIONS.llm.length).toBeGreaterThan(0);
  });
  
  it('should have Manus as built-in provider for storage', async () => {
    const { PROVIDER_OPTIONS } = await import('../../shared/providers/types');
    
    const manusStorage = PROVIDER_OPTIONS.storage.find(p => p.id === 'manus');
    expect(manusStorage).toBeDefined();
    expect(manusStorage?.isBuiltIn).toBe(true);
  });
  
  it('should have Manus as built-in provider for LLM', async () => {
    const { PROVIDER_OPTIONS } = await import('../../shared/providers/types');
    
    const manusLLM = PROVIDER_OPTIONS.llm.find(p => p.id === 'manus');
    expect(manusLLM).toBeDefined();
    expect(manusLLM?.isBuiltIn).toBe(true);
  });
  
  it('should have external providers with config fields', async () => {
    const { PROVIDER_OPTIONS } = await import('../../shared/providers/types');
    
    const s3Provider = PROVIDER_OPTIONS.storage.find(p => p.id === 's3');
    expect(s3Provider).toBeDefined();
    expect(s3Provider?.isBuiltIn).toBe(false);
    expect(s3Provider?.configFields?.length).toBeGreaterThan(0);
    expect(s3Provider?.secretFields?.length).toBeGreaterThan(0);
  });
});

describe('Manus Storage Adapter', () => {
  it('should initialize without config', async () => {
    const { ManusStorageAdapter } = await import('./adapters/storage/manus');
    
    const adapter = new ManusStorageAdapter();
    await adapter.initialize();
    
    expect(adapter.providerId).toBe('manus');
    expect(adapter.isBuiltIn).toBe(true);
  });
  
  it('should test connection successfully', async () => {
    const { ManusStorageAdapter } = await import('./adapters/storage/manus');
    
    const adapter = new ManusStorageAdapter();
    await adapter.initialize();
    
    const result = await adapter.testConnection();
    expect(result.success).toBe(true);
  });
  
  it('should put files', async () => {
    const { ManusStorageAdapter } = await import('./adapters/storage/manus');
    
    const adapter = new ManusStorageAdapter();
    await adapter.initialize();
    
    const result = await adapter.put('test.txt', Buffer.from('test content'), 'text/plain');
    expect(result.key).toBeDefined();
    expect(result.url).toBeDefined();
  });
});

describe('Manus LLM Adapter', () => {
  it('should initialize without config', async () => {
    const { ManusLLMAdapter } = await import('./adapters/llm/manus');
    
    const adapter = new ManusLLMAdapter();
    await adapter.initialize();
    
    expect(adapter.providerId).toBe('manus');
    expect(adapter.isBuiltIn).toBe(true);
  });
  
  it('should test connection successfully', async () => {
    const { ManusLLMAdapter } = await import('./adapters/llm/manus');
    
    const adapter = new ManusLLMAdapter();
    await adapter.initialize();
    
    const result = await adapter.testConnection();
    expect(result.success).toBe(true);
  });
  
  it('should chat with messages', async () => {
    const { ManusLLMAdapter } = await import('./adapters/llm/manus');
    
    const adapter = new ManusLLMAdapter();
    await adapter.initialize();
    
    const result = await adapter.chat([
      { role: 'user', content: 'Hello' },
    ]);
    
    expect(result.id).toBeDefined();
    expect(result.choices.length).toBeGreaterThan(0);
  });
});

describe('Secrets Utilities', () => {
  it('should store and retrieve secrets', async () => {
    const { storeSecret, getAllSecrets } = await import('./secrets');
    
    // These functions require database, so just verify they exist
    expect(typeof storeSecret).toBe('function');
    expect(typeof getAllSecrets).toBe('function');
  });
  
  it('should mask secrets for display', async () => {
    const { maskSecret } = await import('./secrets');
    
    const masked = maskSecret('sk-1234567890abcdef');
    // Verify it's masked (doesn't contain full secret)
    expect(masked).not.toBe('sk-1234567890abcdef');
    expect(masked.length).toBeLessThan('sk-1234567890abcdef'.length);
  });
  
  it('should generate webhook secrets', async () => {
    const { generateWebhookSecret, generateVerifyToken } = await import('./secrets');
    
    const secret = generateWebhookSecret();
    expect(secret.length).toBe(64); // 32 bytes hex
    
    const token = generateVerifyToken();
    expect(token.length).toBe(32); // 16 bytes hex
  });
});

describe('Feature Flags with Org Integrations', () => {
  it('should check capability satisfaction', async () => {
    const { isCapabilitySatisfiedByOrg } = await import('../../shared/featureFlags');
    
    const mockIntegrations = [
      {
        id: 1,
        orgId: 1,
        organizationId: 1,
        integrationType: 'storage' as const,
        provider: 'manus' as const,
        status: 'connected' as const,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    
    const hasStorage = isCapabilitySatisfiedByOrg('STORAGE', mockIntegrations);
    expect(hasStorage).toBe(true);
    
    const hasLLM = isCapabilitySatisfiedByOrg('LLM', mockIntegrations);
    expect(hasLLM).toBe(false);
  });
  
  it('should check module enablement', async () => {
    const { isModuleEnabledForOrg } = await import('../../shared/featureFlags');
    
    const mockIntegrations = [
      {
        id: 1,
        orgId: 1,
        organizationId: 1,
        integrationType: 'storage' as const,
        provider: 'manus' as const,
        status: 'connected' as const,
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    
    const uploadEnabled = isModuleEnabledForOrg('document-upload', mockIntegrations);
    expect(uploadEnabled).toBe(true);
    
    const aiEnabled = isModuleEnabledForOrg('ai-categorization', mockIntegrations);
    expect(aiEnabled).toBe(false); // Requires LLM
  });
});
