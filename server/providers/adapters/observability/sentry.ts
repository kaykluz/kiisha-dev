/**
 * Sentry Observability Adapter
 * 
 * Integrates with Sentry for error tracking and performance monitoring.
 */

import type {
  ObservabilityProviderAdapter,
  ObservabilityTransaction,
  TestConnectionResult,
} from '../../interfaces';

interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

export class SentryObservabilityAdapter implements ObservabilityProviderAdapter {
  readonly providerId = 'sentry' as const;
  readonly integrationType = 'observability' as const;
  readonly isBuiltIn = false;
  
  private config: SentryConfig = {};
  private initialized = false;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      dsn: secrets?.dsn || config.dsn as string,
      environment: config.environment as string || process.env.NODE_ENV || 'development',
      release: config.release as string || process.env.npm_package_version,
      tracesSampleRate: config.tracesSampleRate as number || 0.1,
    };
    
    if (this.config.dsn) {
      // In production, you would initialize the Sentry SDK here
      // For now, we'll use the HTTP API directly to avoid SDK dependency
      this.initialized = true;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.config.dsn) {
      return { success: false, message: 'Sentry DSN not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Parse DSN to get project ID and key
      const dsnMatch = this.config.dsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
      if (!dsnMatch) {
        return { success: false, message: 'Invalid Sentry DSN format' };
      }
      
      const [, publicKey, host, projectId] = dsnMatch;
      
      // Send a test event
      const response = await fetch(`https://${host}/api/${projectId}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
        },
        body: JSON.stringify({
          event_id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          platform: 'node',
          level: 'info',
          message: 'KIISHA connection test',
          environment: this.config.environment,
          release: this.config.release,
          tags: { test: 'true' },
        }),
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'Connected to Sentry',
          latencyMs: Date.now() - start,
          details: {
            projectId,
            environment: this.config.environment,
          },
        };
      } else {
        const text = await response.text();
        return {
          success: false,
          message: `Sentry error: ${response.status} - ${text.slice(0, 100)}`,
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
    this.config = {};
    this.initialized = false;
  }
  
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized || !this.config.dsn) {
      console.error('[Sentry not configured]', error);
      return;
    }
    
    this.sendEvent({
      exception: {
        values: [{
          type: error.name,
          value: error.message,
          stacktrace: this.parseStacktrace(error.stack),
        }],
      },
      level: 'error',
      extra: context,
    });
  }
  
  captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error',
    context?: Record<string, unknown>
  ): void {
    if (!this.initialized || !this.config.dsn) {
      console.log(`[Sentry not configured] [${level}]`, message);
      return;
    }
    
    this.sendEvent({
      message,
      level,
      extra: context,
    });
  }
  
  setUser(user: { id: string; email?: string; name?: string } | null): void {
    // In a full implementation, this would set the user context
    // For the HTTP API approach, we'd store this and include it in events
    if (user) {
      console.log('[Sentry] User context set:', user.id);
    } else {
      console.log('[Sentry] User context cleared');
    }
  }
  
  startTransaction(name: string, op: string): ObservabilityTransaction {
    const transactionId = this.generateEventId();
    const startTime = Date.now();
    const tags: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    
    return {
      setTag: (key: string, value: string) => {
        tags[key] = value;
      },
      setData: (key: string, value: unknown) => {
        data[key] = value;
      },
      finish: () => {
        if (!this.initialized || !this.config.dsn) return;
        
        const duration = Date.now() - startTime;
        
        // Send transaction event
        this.sendEvent({
          type: 'transaction',
          transaction: name,
          contexts: {
            trace: {
              trace_id: transactionId,
              span_id: transactionId.slice(0, 16),
              op,
            },
          },
          start_timestamp: startTime / 1000,
          timestamp: Date.now() / 1000,
          tags,
          extra: data,
        });
      },
    };
  }
  
  private async sendEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.config.dsn) return;
    
    const dsnMatch = this.config.dsn.match(/https:\/\/([^@]+)@([^/]+)\/(\d+)/);
    if (!dsnMatch) return;
    
    const [, publicKey, host, projectId] = dsnMatch;
    
    try {
      await fetch(`https://${host}/api/${projectId}/store/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${publicKey}`,
        },
        body: JSON.stringify({
          event_id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          platform: 'node',
          environment: this.config.environment,
          release: this.config.release,
          ...event,
        }),
      });
    } catch (error) {
      console.error('[Sentry] Failed to send event:', error);
    }
  }
  
  private generateEventId(): string {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }
  
  private parseStacktrace(stack?: string): { frames: Array<{ filename: string; lineno?: number; function?: string }> } | undefined {
    if (!stack) return undefined;
    
    const frames = stack
      .split('\n')
      .slice(1)
      .map(line => {
        const match = line.match(/at (.+?) \((.+?):(\d+):\d+\)/);
        if (match) {
          return {
            function: match[1],
            filename: match[2],
            lineno: parseInt(match[3], 10),
          };
        }
        return null;
      })
      .filter(Boolean)
      .reverse() as Array<{ filename: string; lineno?: number; function?: string }>;
    
    return { frames };
  }
}
