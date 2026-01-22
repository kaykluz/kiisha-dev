/**
 * Manus Built-in Storage Adapter
 * 
 * Uses the platform's built-in S3-compatible storage.
 * No configuration required - credentials are injected automatically.
 */

import type {
  StorageProviderAdapter,
  StoragePutResult,
  StorageGetResult,
  StorageMetadata,
  TestConnectionResult,
} from '../../interfaces';
import { storagePut, storageGet } from '../../../storage';

export class ManusStorageAdapter implements StorageProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'storage' as const;
  readonly isBuiltIn = true;
  
  async initialize(): Promise<void> {
    // No initialization needed - uses platform credentials
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    
    try {
      // Try to upload a small test file
      const testKey = `_test/${Date.now()}.txt`;
      const testData = Buffer.from('test');
      
      await this.put(testKey, testData, 'text/plain');
      
      // Try to get a signed URL
      await this.getSignedUrl(testKey);
      
      // Clean up
      await this.delete(testKey);
      
      return {
        success: true,
        message: 'Manus storage is operational',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      };
    }
  }
  
  async disconnect(): Promise<void> {
    // Nothing to clean up
  }
  
  async put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StoragePutResult> {
    const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    const result = await storagePut(key, buffer, contentType);
    
    return {
      key,
      url: result.url,
      size: buffer.length,
    };
  }
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<StorageGetResult> {
    // Note: Manus storage doesn't support custom expiry, URLs are pre-signed
    const result = await storageGet(key);
    
    return {
      key,
      url: result.url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
  
  async delete(key: string): Promise<void> {
    // Manus storage doesn't expose delete directly
    // In production, this would call the delete endpoint
    console.warn(`Delete not implemented for Manus storage: ${key}`);
  }
  
  async exists(key: string): Promise<boolean> {
    try {
      await this.getSignedUrl(key, 60);
      return true;
    } catch {
      return false;
    }
  }
  
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    // Manus storage doesn't expose metadata directly
    // Return minimal info based on what we can determine
    try {
      const exists = await this.exists(key);
      if (!exists) return null;
      
      return {
        key,
        size: 0, // Unknown
        contentType: undefined,
        lastModified: undefined,
      };
    } catch {
      return null;
    }
  }
}
