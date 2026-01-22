/**
 * Cloudflare R2 Storage Adapter
 * 
 * Uses the S3-compatible API to interact with Cloudflare R2.
 * R2 offers zero egress fees, making it cost-effective for high-bandwidth use cases.
 */

import type {
  StorageProviderAdapter,
  StoragePutResult,
  StorageGetResult,
  StorageMetadata,
  TestConnectionResult,
} from '../../interfaces';
import crypto from 'crypto';

interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string; // Optional custom domain for public access
}

export class R2StorageAdapter implements StorageProviderAdapter {
  readonly providerId = 'r2' as const;
  readonly integrationType = 'storage' as const;
  readonly isBuiltIn = false;
  
  private config: R2Config | null = null;
  private credentials: { accessKeyId: string; secretAccessKey: string } | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      accountId: config.accountId as string,
      bucket: config.bucket as string,
      publicUrl: config.publicUrl as string | undefined,
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
      return { success: false, message: 'R2 not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Try to list bucket contents
      const endpoint = this.getEndpoint();
      const path = `/${this.config.bucket}?max-keys=1`;
      const headers = await this.getSignedHeaders('GET', path);
      
      const response = await fetch(`${endpoint}${path}`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        return {
          success: true,
          message: `Connected to R2 bucket: ${this.config.bucket}`,
          latencyMs: Date.now() - start,
          details: { accountId: this.config.accountId },
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          message: `R2 error: ${response.status} - ${text.slice(0, 200)}`,
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
      throw new Error('R2 not configured');
    }
    
    const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    
    const headers = await this.getSignedHeaders('PUT', path, {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': buffer.length.toString(),
    });
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'PUT',
      headers,
      body: buffer,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`R2 upload failed: ${response.status} - ${text}`);
    }
    
    const etag = response.headers.get('ETag') || undefined;
    
    // Use public URL if configured, otherwise use endpoint
    const url = this.config.publicUrl 
      ? `${this.config.publicUrl}/${key}`
      : `${endpoint}${path}`;
    
    return {
      key,
      url,
      size: buffer.length,
      etag,
    };
  }
  
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<StorageGetResult> {
    if (!this.config || !this.credentials) {
      throw new Error('R2 not configured');
    }
    
    // Generate a pre-signed URL using AWS Signature V4
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    
    // Simplified pre-signed URL generation
    const region = 'auto'; // R2 uses 'auto' for region
    const service = 's3';
    const algorithm = 'AWS4-HMAC-SHA256';
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    
    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': algorithm,
      'X-Amz-Credential': `${this.credentials.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': datetime,
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host',
    });
    
    const canonicalRequest = [
      'GET',
      path,
      queryParams.toString(),
      `host:${new URL(endpoint).host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    
    const stringToSign = [
      algorithm,
      datetime,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    
    const signature = this.getSignatureV4(stringToSign, date, region, service);
    queryParams.set('X-Amz-Signature', signature);
    
    const url = `${endpoint}${path}?${queryParams.toString()}`;
    
    return {
      key,
      url,
      expiresAt: new Date(expires * 1000),
    };
  }
  
  async delete(key: string): Promise<void> {
    if (!this.config || !this.credentials) {
      throw new Error('R2 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const headers = await this.getSignedHeaders('DELETE', path);
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'DELETE',
      headers,
    });
    
    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(`R2 delete failed: ${response.status} - ${text}`);
    }
  }
  
  async exists(key: string): Promise<boolean> {
    if (!this.config || !this.credentials) {
      throw new Error('R2 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const headers = await this.getSignedHeaders('HEAD', path);
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'HEAD',
      headers,
    });
    
    return response.ok;
  }
  
  async getMetadata(key: string): Promise<StorageMetadata | null> {
    if (!this.config || !this.credentials) {
      throw new Error('R2 not configured');
    }
    
    const endpoint = this.getEndpoint();
    const path = `/${this.config.bucket}/${key}`;
    const headers = await this.getSignedHeaders('HEAD', path);
    
    const response = await fetch(`${endpoint}${path}`, {
      method: 'HEAD',
      headers,
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
    return `https://${this.config?.accountId}.r2.cloudflarestorage.com`;
  }
  
  private async getSignedHeaders(
    method: string,
    path: string,
    additionalHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    if (!this.credentials || !this.config) {
      throw new Error('Credentials not configured');
    }
    
    const endpoint = this.getEndpoint();
    const host = new URL(endpoint).host;
    const datetime = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = datetime.slice(0, 8);
    const region = 'auto';
    const service = 's3';
    
    const headers: Record<string, string> = {
      'Host': host,
      'X-Amz-Date': datetime,
      'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
      ...additionalHeaders,
    };
    
    const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
    const canonicalHeaders = Object.entries(headers)
      .map(([k, v]) => `${k.toLowerCase()}:${v}`)
      .sort()
      .join('\n') + '\n';
    
    const canonicalRequest = [
      method,
      path,
      '',
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      datetime,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    
    const signature = this.getSignatureV4(stringToSign, date, region, service);
    
    headers['Authorization'] = [
      `AWS4-HMAC-SHA256 Credential=${this.credentials.accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');
    
    return headers;
  }
  
  private getSignatureV4(stringToSign: string, date: string, region: string, service: string): string {
    if (!this.credentials) {
      throw new Error('Credentials not configured');
    }
    
    const kDate = crypto.createHmac('sha256', `AWS4${this.credentials.secretAccessKey}`).update(date).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    
    return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  }
}
