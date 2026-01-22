/**
 * AWS S3 Storage Adapter
 * 
 * Uses the AWS SDK to interact with Amazon S3.
 */

import type {
  StorageProviderAdapter,
  StoragePutResult,
  StorageGetResult,
  StorageMetadata,
  TestConnectionResult,
} from '../../interfaces';

// We'll use fetch-based API calls instead of the full AWS SDK to keep bundle size small
// In production, you might want to use @aws-sdk/client-s3

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For S3-compatible services
}

export class S3StorageAdapter implements StorageProviderAdapter {
  readonly providerId = 's3' as const;
  readonly integrationType = 'storage' as const;
  readonly isBuiltIn = false;
  
  private config: S3Config | null = null;
  private credentials: { accessKeyId: string; secretAccessKey: string } | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      bucket: config.bucket as string,
      region: config.region as string || 'us-east-1',
      endpoint: config.endpoint as string | undefined,
    };
    
    if (secrets) {
      this.credentials = {
        accessKeyId: secrets.accessKeyId || '',
        secretAccessKey: secrets.secretAccessKey || '',
      };
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.config || !this.credentials) {
      return { success: false, message: 'S3 not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Try to list bucket (HEAD request)
      const endpoint = this.getEndpoint();
      const date = new Date().toUTCString();
      
      const response = await fetch(`${endpoint}/${this.config.bucket}?max-keys=1`, {
        method: 'GET',
        headers: {
          'Host': new URL(endpoint).host,
          'Date': date,
          'Authorization': this.getAuthHeader('GET', `/${this.config.bucket}?max-keys=1`, date),
        },
      });
      
      if (response.ok || response.status === 200) {
        return {
          success: true,
          message: `Connected to S3 bucket: ${this.config.bucket}`,
          latencyMs: Date.now() - start,
          details: { region: this.config.region },
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          message: `S3 error: ${response.status} - ${text.slice(0, 200)}`,
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
    this.credentials = null;
  }
  
  async put(key: string, data: Buffer | Uint8Array | string, contentType?: string): Promise<StoragePutResult> {
    if (!this.config || !this.credentials) {
      throw new Error('S3 not configured');
    }
    
    const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const date = new Date().toUTCString();
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'PUT',
      headers: {
        'Host': new URL(endpoint).host,
        'Date': date,
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': buffer.length.toString(),
        'Authorization': this.getAuthHeader('PUT', path, date, contentType),
      },
      body: buffer,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`S3 upload failed: ${response.status} - ${text}`);
    }
    
    const etag = response.headers.get('ETag') || undefined;
    
    return {
      key,
      url: `${endpoint}${path}`,
      size: buffer.length,
      etag,
    };
  }
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<StorageGetResult> {
    if (!this.config || !this.credentials) {
      throw new Error('S3 not configured');
    }
    
    // Generate a pre-signed URL
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    
    // Simplified pre-signed URL (in production, use proper AWS Signature V4)
    const stringToSign = `GET\n\n\n${expires}\n${path}`;
    const signature = this.sign(stringToSign);
    
    const url = `${endpoint}${path}?AWSAccessKeyId=${this.credentials.accessKeyId}&Expires=${expires}&Signature=${encodeURIComponent(signature)}`;
    
    return {
      key,
      url,
      expiresAt: new Date(expires * 1000),
    };
  }
  
  async delete(key: string): Promise<void> {
    if (!this.config || !this.credentials) {
      throw new Error('S3 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const date = new Date().toUTCString();
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'DELETE',
      headers: {
        'Host': new URL(endpoint).host,
        'Date': date,
        'Authorization': this.getAuthHeader('DELETE', path, date),
      },
    });
    
    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`S3 delete failed: ${response.status} - ${text}`);
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.config || !this.credentials) {
      throw new Error('S3 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const date = new Date().toUTCString();
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'HEAD',
      headers: {
        'Host': new URL(endpoint).host,
        'Date': date,
        'Authorization': this.getAuthHeader('HEAD', path, date),
      },
    });
    
    return response.ok;
  }
  
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    if (!this.config || !this.credentials) {
      throw new Error('S3 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const date = new Date().toUTCString();
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'HEAD',
      headers: {
        'Host': new URL(endpoint).host,
        'Date': date,
        'Authorization': this.getAuthHeader('HEAD', path, date),
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return {
      key,
      size: parseInt(response.headers.get('Content-Length') || '0', 10),
      contentType: response.headers.get('Content-Type') || undefined,
      lastModified: response.headers.get('Last-Modified') 
        ? new Date(response.headers.get('Last-Modified')!)
        : undefined,
      etag: response.headers.get('ETag') || undefined,
    };
  }
  
  private getEndpoint(): string {
    if (this.config?.endpoint) {
      return this.config.endpoint;
    }
    return `https://s3.${this.config?.region || 'us-east-1'}.amazonaws.com`;
  }
  
  private getAuthHeader(method: string, path: string, date: string, contentType?: string): string {
    if (!this.credentials) {
      throw new Error('Credentials not configured');
    }
    
    // AWS Signature Version 2 (simplified)
    const stringToSign = `${method}\n\n${contentType || ''}\n${date}\n${path}`;
    const signature = this.sign(stringToSign);
    
    return `AWS ${this.credentials.accessKeyId}:${signature}`;
  }
  
  private sign(stringToSign: string): string {
    if (!this.credentials) {
      throw new Error('Credentials not configured');
    }
    
    const crypto = require('crypto');
    return crypto
      .createHmac('sha1', this.credentials.secretAccessKey)
      .update(stringToSign)
      .digest('base64');
  }
}
