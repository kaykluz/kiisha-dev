/**
 * Grafana API Client Library
 * 
 * Production-grade client for Grafana HTTP API with:
 * - Retry logic with exponential backoff
 * - Idempotency support
 * - Correlation ID tracking
 * - Safe error redaction (no tokens in logs)
 * - Org context switching via headers
 */

import { randomUUID } from 'crypto';

// Types
export interface GrafanaClientConfig {
  baseUrl: string;
  adminToken: string;
  defaultOrgId?: number;
  timeout?: number;
  maxRetries?: number;
}

export interface GrafanaOrg {
  id: number;
  name: string;
}

export interface GrafanaFolder {
  id: number;
  uid: string;
  title: string;
}

export interface GrafanaDashboard {
  id: number;
  uid: string;
  title: string;
  url: string;
  version: number;
}

export interface GrafanaDataSource {
  id: number;
  uid: string;
  name: string;
  type: string;
  isDefault: boolean;
}

export interface GrafanaServiceAccount {
  id: number;
  name: string;
  login: string;
  orgId: number;
  isDisabled: boolean;
  role: string;
}

export interface GrafanaServiceAccountToken {
  id: number;
  name: string;
  key: string;
}

export interface GrafanaApiError {
  status: number;
  message: string;
  correlationId: string;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Grafana API Client
 */
export class GrafanaClient {
  private baseUrl: string;
  private adminToken: string;
  private defaultOrgId?: number;
  private timeout: number;
  private retryConfig: RetryConfig;

  constructor(config: GrafanaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.adminToken = config.adminToken;
    this.defaultOrgId = config.defaultOrgId;
    this.timeout = config.timeout || 30000;
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    };
  }

  /**
   * Make an API request with retry logic
   */
  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      orgId?: number;
      correlationId?: string;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const correlationId = options.correlationId || randomUUID();
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.adminToken}`,
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    };

    // Org context switching
    if (options.orgId || this.defaultOrgId) {
      headers['X-Grafana-Org-Id'] = String(options.orgId || this.defaultOrgId);
    }

    // Idempotency key for POST/PUT requests
    if (options.idempotencyKey && (method === 'POST' || method === 'PUT')) {
      headers['X-Idempotency-Key'] = options.idempotencyKey;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => 'Unknown error');
          
          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new GrafanaApiException({
              status: response.status,
              message: this.sanitizeErrorMessage(errorBody),
              correlationId,
            });
          }

          // Retry on server errors (5xx) and rate limits (429)
          throw new Error(`HTTP ${response.status}: ${this.sanitizeErrorMessage(errorBody)}`);
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        return JSON.parse(text) as T;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on GrafanaApiException (client errors)
        if (error instanceof GrafanaApiException) {
          throw error;
        }

        // Log retry attempt (without sensitive data)
        console.log(`[Grafana] Request failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}): ${method} ${path}`, {
          correlationId,
          error: this.sanitizeErrorMessage(String(error)),
        });

        if (attempt < this.retryConfig.maxRetries) {
          const delay = Math.min(
            this.retryConfig.baseDelayMs * Math.pow(2, attempt),
            this.retryConfig.maxDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    throw new GrafanaApiException({
      status: 500,
      message: `Request failed after ${this.retryConfig.maxRetries + 1} attempts: ${this.sanitizeErrorMessage(String(lastError))}`,
      correlationId,
    });
  }

  /**
   * Sanitize error messages to remove sensitive data
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove any potential tokens or credentials from error messages
    return message
      .replace(/Bearer\s+[A-Za-z0-9_-]+/gi, 'Bearer [REDACTED]')
      .replace(/token[=:]\s*[A-Za-z0-9_-]+/gi, 'token=[REDACTED]')
      .replace(/password[=:]\s*[^\s&]+/gi, 'password=[REDACTED]')
      .replace(/secret[=:]\s*[^\s&]+/gi, 'secret=[REDACTED]');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Organization Management
  // ============================================================================

  /**
   * Create a new Grafana organization
   */
  async createOrg(name: string, correlationId?: string): Promise<GrafanaOrg> {
    const result = await this.request<{ orgId: number; message: string }>(
      'POST',
      '/api/orgs',
      {
        body: { name },
        correlationId,
        idempotencyKey: `create-org-${name}`,
      }
    );
    return { id: result.orgId, name };
  }

  /**
   * Get organization by ID
   */
  async getOrg(orgId: number, correlationId?: string): Promise<GrafanaOrg> {
    return this.request<GrafanaOrg>('GET', `/api/orgs/${orgId}`, { correlationId });
  }

  /**
   * List all organizations
   */
  async listOrgs(correlationId?: string): Promise<GrafanaOrg[]> {
    return this.request<GrafanaOrg[]>('GET', '/api/orgs', { correlationId });
  }

  // ============================================================================
  // Folder Management
  // ============================================================================

  /**
   * Create a folder in a specific org
   */
  async createFolder(
    title: string,
    options: {
      uid?: string;
      orgId?: number;
      correlationId?: string;
    } = {}
  ): Promise<GrafanaFolder> {
    const uid = options.uid || randomUUID().replace(/-/g, '').substring(0, 12);
    
    return this.request<GrafanaFolder>(
      'POST',
      '/api/folders',
      {
        body: { title, uid },
        orgId: options.orgId,
        correlationId: options.correlationId,
        idempotencyKey: `create-folder-${options.orgId}-${title}`,
      }
    );
  }

  /**
   * Get folder by UID
   */
  async getFolder(uid: string, options: { orgId?: number; correlationId?: string } = {}): Promise<GrafanaFolder> {
    return this.request<GrafanaFolder>('GET', `/api/folders/${uid}`, options);
  }

  /**
   * List all folders in an org
   */
  async listFolders(options: { orgId?: number; correlationId?: string } = {}): Promise<GrafanaFolder[]> {
    return this.request<GrafanaFolder[]>('GET', '/api/folders', options);
  }

  /**
   * Set folder permissions
   */
  async setFolderPermissions(
    uid: string,
    permissions: Array<{
      role?: string;
      teamId?: number;
      userId?: number;
      permission: 1 | 2 | 4; // 1=View, 2=Edit, 4=Admin
    }>,
    options: { orgId?: number; correlationId?: string } = {}
  ): Promise<void> {
    await this.request<{ message: string }>(
      'POST',
      `/api/folders/${uid}/permissions`,
      {
        body: { items: permissions },
        orgId: options.orgId,
        correlationId: options.correlationId,
      }
    );
  }

  // ============================================================================
  // Dashboard Management
  // ============================================================================

  /**
   * Create or update a dashboard
   */
  async createDashboard(
    dashboard: Record<string, unknown>,
    options: {
      folderId?: number;
      folderUid?: string;
      overwrite?: boolean;
      orgId?: number;
      correlationId?: string;
    } = {}
  ): Promise<GrafanaDashboard> {
    const result = await this.request<{
      id: number;
      uid: string;
      url: string;
      status: string;
      version: number;
      slug: string;
    }>(
      'POST',
      '/api/dashboards/db',
      {
        body: {
          dashboard,
          folderId: options.folderId,
          folderUid: options.folderUid,
          overwrite: options.overwrite ?? false,
        },
        orgId: options.orgId,
        correlationId: options.correlationId,
        idempotencyKey: dashboard.uid ? `create-dashboard-${dashboard.uid}` : undefined,
      }
    );

    return {
      id: result.id,
      uid: result.uid,
      title: String(dashboard.title || 'Untitled'),
      url: result.url,
      version: result.version,
    };
  }

  /**
   * Get dashboard by UID
   */
  async getDashboard(uid: string, options: { orgId?: number; correlationId?: string } = {}): Promise<{
    dashboard: Record<string, unknown>;
    meta: Record<string, unknown>;
  }> {
    return this.request('GET', `/api/dashboards/uid/${uid}`, options);
  }

  /**
   * Delete dashboard by UID
   */
  async deleteDashboard(uid: string, options: { orgId?: number; correlationId?: string } = {}): Promise<void> {
    await this.request<{ message: string }>('DELETE', `/api/dashboards/uid/${uid}`, options);
  }

  // ============================================================================
  // Data Source Management
  // ============================================================================

  /**
   * Create a data source
   */
  async createDataSource(
    config: {
      name: string;
      type: string;
      url?: string;
      access?: 'proxy' | 'direct';
      isDefault?: boolean;
      database?: string;
      user?: string;
      secureJsonData?: Record<string, string>;
      jsonData?: Record<string, unknown>;
    },
    options: { orgId?: number; correlationId?: string } = {}
  ): Promise<GrafanaDataSource> {
    const result = await this.request<{
      datasource: GrafanaDataSource;
      id: number;
      message: string;
      name: string;
    }>(
      'POST',
      '/api/datasources',
      {
        body: {
          name: config.name,
          type: config.type,
          url: config.url,
          access: config.access || 'proxy',
          isDefault: config.isDefault ?? false,
          database: config.database,
          user: config.user,
          secureJsonData: config.secureJsonData,
          jsonData: config.jsonData,
        },
        orgId: options.orgId,
        correlationId: options.correlationId,
        idempotencyKey: `create-ds-${options.orgId}-${config.name}`,
      }
    );

    return result.datasource;
  }

  /**
   * Get data source by name
   */
  async getDataSourceByName(name: string, options: { orgId?: number; correlationId?: string } = {}): Promise<GrafanaDataSource> {
    return this.request<GrafanaDataSource>('GET', `/api/datasources/name/${encodeURIComponent(name)}`, options);
  }

  /**
   * List all data sources in an org
   */
  async listDataSources(options: { orgId?: number; correlationId?: string } = {}): Promise<GrafanaDataSource[]> {
    return this.request<GrafanaDataSource[]>('GET', '/api/datasources', options);
  }

  // ============================================================================
  // Service Account Management
  // ============================================================================

  /**
   * Create a service account
   */
  async createServiceAccount(
    name: string,
    role: 'Viewer' | 'Editor' | 'Admin',
    options: { orgId?: number; correlationId?: string } = {}
  ): Promise<GrafanaServiceAccount> {
    return this.request<GrafanaServiceAccount>(
      'POST',
      '/api/serviceaccounts',
      {
        body: { name, role, isDisabled: false },
        orgId: options.orgId,
        correlationId: options.correlationId,
        idempotencyKey: `create-sa-${options.orgId}-${name}`,
      }
    );
  }

  /**
   * Create a token for a service account
   */
  async createServiceAccountToken(
    serviceAccountId: number,
    tokenName: string,
    options: { orgId?: number; correlationId?: string; secondsToLive?: number } = {}
  ): Promise<GrafanaServiceAccountToken> {
    return this.request<GrafanaServiceAccountToken>(
      'POST',
      `/api/serviceaccounts/${serviceAccountId}/tokens`,
      {
        body: {
          name: tokenName,
          secondsToLive: options.secondsToLive,
        },
        orgId: options.orgId,
        correlationId: options.correlationId,
      }
    );
  }

  /**
   * Delete a service account token
   */
  async deleteServiceAccountToken(
    serviceAccountId: number,
    tokenId: number,
    options: { orgId?: number; correlationId?: string } = {}
  ): Promise<void> {
    await this.request<{ message: string }>(
      'DELETE',
      `/api/serviceaccounts/${serviceAccountId}/tokens/${tokenId}`,
      options
    );
  }

  // ============================================================================
  // Embed URL Generation
  // ============================================================================

  /**
   * Generate an embed URL for a dashboard panel
   */
  generateEmbedUrl(
    dashboardUid: string,
    options: {
      panelId?: number;
      from?: string;
      to?: string;
      theme?: 'light' | 'dark';
      variables?: Record<string, string>;
      refresh?: string;
    } = {}
  ): string {
    const params = new URLSearchParams();
    
    if (options.panelId) {
      params.set('panelId', String(options.panelId));
    }
    if (options.from) {
      params.set('from', options.from);
    }
    if (options.to) {
      params.set('to', options.to);
    }
    if (options.theme) {
      params.set('theme', options.theme);
    }
    if (options.refresh) {
      params.set('refresh', options.refresh);
    }
    
    // Add template variables
    if (options.variables) {
      for (const [key, value] of Object.entries(options.variables)) {
        params.set(`var-${key}`, value);
      }
    }

    const queryString = params.toString();
    const basePath = options.panelId 
      ? `/d-solo/${dashboardUid}`
      : `/d/${dashboardUid}`;
    
    return `${this.baseUrl}${basePath}${queryString ? `?${queryString}` : ''}`;
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check Grafana health status
   */
  async healthCheck(correlationId?: string): Promise<{
    healthy: boolean;
    database: string;
    version: string;
  }> {
    try {
      const result = await this.request<{
        database: string;
        version: string;
        commit: string;
      }>('GET', '/api/health', { correlationId });
      
      return {
        healthy: true,
        database: result.database,
        version: result.version,
      };
    } catch (error) {
      return {
        healthy: false,
        database: 'unknown',
        version: 'unknown',
      };
    }
  }
}

/**
 * Custom error class for Grafana API errors
 */
export class GrafanaApiException extends Error {
  public readonly status: number;
  public readonly correlationId: string;

  constructor(error: GrafanaApiError) {
    super(error.message);
    this.name = 'GrafanaApiException';
    this.status = error.status;
    this.correlationId = error.correlationId;
  }
}

/**
 * Create a Grafana client instance
 */
export function createGrafanaClient(config: GrafanaClientConfig): GrafanaClient {
  return new GrafanaClient(config);
}
