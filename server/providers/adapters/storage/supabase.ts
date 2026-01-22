/**
 * Supabase Storage Adapter
 * 
 * Uses the Supabase Storage API for file storage.
 * Provides built-in CDN and easy integration with Supabase projects.
 */

import type {
  StorageProviderAdapter,
  StoragePutResult,
  StorageGetResult,
  StorageMetadata,
  TestConnectionResult,
} from '../../interfaces';

interface SupabaseConfig {
  projectUrl: string;
  bucket: string;
  serviceKey?: string;
}

export class SupabaseStorageAdapter implements StorageProviderAdapter {
  readonly providerId = 'supabase' as const;
  readonly integrationType = 'storage' as const;
  readonly isBuiltIn = false;
  
  private config: SupabaseConfig | null = null;
  private serviceKey: string | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      projectUrl: (config.projectUrl as string).replace(/\/$/, ''), // Remove trailing slash
      bucket: config.bucket as string,
    };
    
    if (secrets?.serviceKey) {
      this.serviceKey = secrets.serviceKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.config || !this.serviceKey) {
      return { success: false, message: 'Supabase not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Try to list bucket contents
      const response = await fetch(
        `${this.config.projectUrl}/storage/v1/bucket/${this.config.bucket}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.serviceKey}`,
            'apikey': this.serviceKey,
          },
        }
      );
      
      if (response.ok) {
        const bucket = await response.json();
        return {
          success: true,
          message: `Connected to Supabase bucket: ${bucket.name || this.config.bucket}`,
          latencyMs: Date.now() - start,
          details: { public: bucket.public },
        };
      } else {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          message: `Supabase error: ${error.message || response.status}`,
          latencyMs: Date.now() - start,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      };
    }
  }
  
  async disconnect(): Promise<void> {
    this.config = null;
    this.serviceKey = null;
  }
  
  async put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StoragePutResult> {
    if (!this.config || !this.serviceKey) {
      throw new Error('Supabase not configured');
    }
    
    const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    
    const response = await fetch(
      `${this.config.projectUrl}/storage/v1/object/${this.config.bucket}/${key}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey,
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'true', // Overwrite if exists
        },
        body: buffer,
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Supabase upload failed: ${error.message || response.status}`);
    }
    
    const result = await response.json();
    
    // Construct public URL
    const url = `${this.config.projectUrl}/storage/v1/object/public/${this.config.bucket}/${key}`;
    
    return {
      key,
      url,
      size: buffer.length,
      etag: result.Id,
    };
  }
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<StorageGetResult> {
    if (!this.config || !this.serviceKey) {
      throw new Error('Supabase not configured');
    }
    
    const response = await fetch(
      `${this.config.projectUrl}/storage/v1/object/sign/${this.config.bucket}/${key}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Supabase signed URL failed: ${error.message || response.status}`);
    }
    
    const result = await response.json();
    
    return {
      key,
      url: `${this.config.projectUrl}/storage/v1${result.signedURL}`,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
  
  async delete(key: string): Promise<void> {
    if (!this.config || !this.serviceKey) {
      throw new Error('Supabase not configured');
    }
    
    const response = await fetch(
      `${this.config.projectUrl}/storage/v1/object/${this.config.bucket}/${key}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey,
        },
      }
    );
    
    if (!response.ok && response.status !== 404) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Supabase delete failed: ${error.message || response.status}`);
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.config || !this.serviceKey) {
      throw new Error('Supabase not configured');
    }
    
    // Try to get object info
    const response = await fetch(
      `${this.config.projectUrl}/storage/v1/object/info/${this.config.bucket}/${key}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey,
        },
      }
    );
    
    return response.ok;
  }
  
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    if (!this.config || !this.serviceKey) {
      throw new Error('Supabase not configured');
    }
    
    const response = await fetch(
      `${this.config.projectUrl}/storage/v1/object/info/${this.config.bucket}/${key}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.serviceKey}`,
          'apikey': this.serviceKey,
        },
      }
    );
    
    if (!response.ok) {
      return null;
    }
    
    const info = await response.json();
    
    return {
      key,
      size: info.metadata?.size || 0,
      contentType: info.metadata?.mimetype,
      lastModified: info.updated_at ? new Date(info.updated_at) : undefined,
      etag: info.id,
    };
  }
}
