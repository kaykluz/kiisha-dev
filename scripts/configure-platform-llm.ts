/**
 * Configure Platform-Wide LLM Integration
 * 
 * This script sets up the platform-wide LLM configuration (orgId=0).
 * Only superusers should run this script.
 * 
 * Usage:
 *   npx tsx scripts/configure-platform-llm.ts <provider> <apiKey> [model]
 * 
 * Examples:
 *   npx tsx scripts/configure-platform-llm.ts openai sk-xxx gpt-4-turbo
 *   npx tsx scripts/configure-platform-llm.ts anthropic sk-ant-xxx claude-3-opus-20240229
 *   npx tsx scripts/configure-platform-llm.ts gemini AIza... gemini-1.5-pro
 *   npx tsx scripts/configure-platform-llm.ts deepseek xxx deepseek-chat
 *   npx tsx scripts/configure-platform-llm.ts grok xxx grok-beta
 *   npx tsx scripts/configure-platform-llm.ts llama xxx meta-llama/Llama-3.3-70B-Instruct-Turbo
 * 
 * Supported providers: openai, anthropic, gemini, deepseek, grok, llama
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import * as schema from '../drizzle/schema';
import crypto from 'crypto';

const PLATFORM_ORG_ID = 0;

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'gemini', 'deepseek', 'grok', 'llama'];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4-turbo',
  anthropic: 'claude-3-opus-20240229',
  gemini: 'gemini-1.5-pro',
  deepseek: 'deepseek-chat',
  grok: 'grok-beta',
  llama: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
};

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/configure-platform-llm.ts <provider> <apiKey> [model]');
    console.log('');
    console.log('Supported providers:', SUPPORTED_PROVIDERS.join(', '));
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx scripts/configure-platform-llm.ts openai sk-xxx gpt-4-turbo');
    console.log('  npx tsx scripts/configure-platform-llm.ts anthropic sk-ant-xxx');
    console.log('  npx tsx scripts/configure-platform-llm.ts gemini AIza...');
    process.exit(1);
  }
  
  const [provider, apiKey, model] = args;
  
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    console.error(`Error: Unsupported provider "${provider}"`);
    console.error('Supported providers:', SUPPORTED_PROVIDERS.join(', '));
    process.exit(1);
  }
  
  const selectedModel = model || DEFAULT_MODELS[provider];
  
  console.log('');
  console.log('=== Platform-Wide LLM Configuration ===');
  console.log('');
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${selectedModel}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log('');
  
  // Connect to database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable not set');
    process.exit(1);
  }
  
  const connection = await mysql.createConnection(databaseUrl);
  const db = drizzle(connection, { schema, mode: 'default' });
  
  try {
    // Check for existing platform LLM integration
    const existing = await db.select()
      .from(schema.orgIntegrations)
      .where(
        and(
          eq(schema.orgIntegrations.organizationId, PLATFORM_ORG_ID),
          eq(schema.orgIntegrations.integrationType, 'llm')
        )
      )
      .limit(1);
    
    let integrationId: number;
    
    if (existing.length > 0) {
      // Update existing integration
      integrationId = existing[0].id;
      
      await db.update(schema.orgIntegrations)
        .set({
          provider: provider,
          status: 'connected',
          config: { model: selectedModel },
          updatedAt: new Date(),
        })
        .where(eq(schema.orgIntegrations.id, integrationId));
      
      console.log(`Updated existing platform LLM integration (ID: ${integrationId})`);
    } else {
      // Create new integration
      const result = await db.insert(schema.orgIntegrations).values({
        organizationId: PLATFORM_ORG_ID,
        integrationType: 'llm',
        provider: provider,
        status: 'connected',
        config: { model: selectedModel },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      integrationId = Number(result[0].insertId);
      console.log(`Created new platform LLM integration (ID: ${integrationId})`);
    }
    
    // Store the API key as a secret
    // Generate encryption key from a secret (in production, use proper key management)
    const encryptionKey = process.env.SECRETS_ENCRYPTION_KEY || 'kiisha-default-encryption-key-32b';
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedValue = iv.toString('hex') + ':' + encrypted;
    
    // Check for existing secret
    const existingSecret = await db.select()
      .from(schema.integrationSecrets)
      .where(
        and(
          eq(schema.integrationSecrets.integrationId, integrationId),
          eq(schema.integrationSecrets.key, 'apiKey')
        )
      )
      .limit(1);
    
    if (existingSecret.length > 0) {
      await db.update(schema.integrationSecrets)
        .set({
          encryptedValue: encryptedValue,
          updatedAt: new Date(),
        })
        .where(eq(schema.integrationSecrets.id, existingSecret[0].id));
      
      console.log('Updated API key secret');
    } else {
      await db.insert(schema.integrationSecrets).values({
        integrationId: integrationId,
        key: 'apiKey',
        encryptedValue: encryptedValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log('Stored API key secret');
    }
    
    console.log('');
    console.log('=== Configuration Complete ===');
    console.log('');
    console.log('The platform-wide LLM is now configured.');
    console.log('All AI features across the platform will use this provider.');
    console.log('');
    console.log('To change the provider, run this script again with different parameters.');
    console.log('');
    
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
