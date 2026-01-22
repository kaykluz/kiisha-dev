/**
 * Secrets Encryption Service
 * 
 * Handles encryption/decryption of integration secrets using AES-256-GCM.
 * Secrets are never stored in plain text in the database.
 */

import crypto from 'crypto';
import { getDb } from '../db';
import { integrationSecrets, InsertIntegrationSecret } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';

// Encryption key should be 32 bytes for AES-256
// In production, this should come from a KMS or environment variable
const ENCRYPTION_KEY = process.env.INTEGRATION_SECRETS_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';

function getEncryptionKey(): Buffer {
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt a secret value using AES-256-GCM.
 */
export function encryptSecret(plaintext: string): { encryptedValue: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits for GCM
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encryptedValue: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt a secret value using AES-256-GCM.
 */
export function decryptSecret(encryptedValue: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedValue, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Store an encrypted secret in the database.
 */
export async function storeSecret(
  organizationId: number,
  integrationId: number,
  secretKey: string,
  secretValue: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const { encryptedValue, iv, authTag } = encryptSecret(secretValue);
  
  // Check if secret already exists
  const existing = await db.select()
    .from(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.integrationId, integrationId),
        eq(integrationSecrets.secretKey, secretKey)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing secret
    await db.update(integrationSecrets)
      .set({
        encryptedValue,
        iv,
        authTag,
        keyVersion: existing[0].keyVersion + 1,
        lastRotatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrationSecrets.id, existing[0].id));
  } else {
    // Insert new secret
    await db.insert(integrationSecrets).values({
      organizationId,
      integrationId,
      secretKey,
      encryptedValue,
      iv,
      authTag,
      keyVersion: 1,
    });
  }
}

/**
 * Retrieve and decrypt a secret from the database.
 */
export async function getSecret(
  integrationId: number,
  secretKey: string
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(integrationSecrets)
    .where(
      and(
        eq(integrationSecrets.integrationId, integrationId),
        eq(integrationSecrets.secretKey, secretKey)
      )
    )
    .limit(1);
  
  if (result.length === 0) return null;
  
  const secret = result[0];
  
  try {
    return decryptSecret(secret.encryptedValue, secret.iv, secret.authTag);
  } catch (error) {
    console.error(`Failed to decrypt secret ${secretKey}:`, error);
    return null;
  }
}

/**
 * Retrieve all secrets for an integration.
 */
export async function getAllSecrets(
  integrationId: number
): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  
  const results = await db.select()
    .from(integrationSecrets)
    .where(eq(integrationSecrets.integrationId, integrationId));
  
  const secrets: Record<string, string> = {};
  
  for (const secret of results) {
    try {
      secrets[secret.secretKey] = decryptSecret(
        secret.encryptedValue,
        secret.iv,
        secret.authTag
      );
    } catch (error) {
      console.error(`Failed to decrypt secret ${secret.secretKey}:`, error);
    }
  }
  
  return secrets;
}

/**
 * Delete all secrets for an integration.
 */
export async function deleteSecrets(integrationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(integrationSecrets)
    .where(eq(integrationSecrets.integrationId, integrationId));
}

/**
 * Mask a secret for display (show only last 4 characters).
 */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

/**
 * Generate a random webhook secret.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a random verify token.
 */
export function generateVerifyToken(): string {
  return crypto.randomBytes(16).toString('hex');
}
