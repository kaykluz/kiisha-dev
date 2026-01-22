/**
 * Custom Logging Observability Adapter
 * 
 * Default observability adapter that logs to console and optionally to a database.
 * Used when no external observability provider is configured.
 */

import type {
  ObservabilityProviderAdapter,
  ObservabilityTransaction,
  TestConnectionResult,
} from '../../interfaces';

interface CustomConfig {
  logLevel?: 'debug' | 'info' | 'warning' | 'error';
  enableConsole?: boolean;
  enableDatabase?: boolean;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
};

export class CustomObservabilityAdapter implements ObservabilityProviderAdapter {
  readonly providerId = 'custom' as const;
  readonly integrationType = 'observability' as const;
  readonly isBuiltIn = true;
  
  private config: CustomConfig = {};
  private currentUser: { id: string; email?: string; name?: string } | null = null;
  
  async initialize(config?: Record<string, unknown>): Promise<void> {
    this.config = {
      logLevel: (config?.logLevel as CustomConfig['logLevel']) || 'info',
      enableConsole: config?.enableConsole !== false,
      enableDatabase: config?.enableDatabase === true,
    };
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    return {
      success: true,
      message: 'Custom logging adapter is operational',
      details: {
        logLevel: this.config.logLevel,
        enableConsole: this.config.enableConsole,
        enableDatabase: this.config.enableDatabase,
      },
    };
  }
  
  async disconnect(): Promise<void> {
    this.config = {};
    this.currentUser = null;
  }
  
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return;
    
    const logEntry = this.formatLogEntry('error', {
      type: 'exception',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    });
    
    if (this.config.enableConsole) {
      console.error('[KIISHA Error]', logEntry);
    }
    
    if (this.config.enableDatabase) {
      this.saveToDatabase(logEntry);
    }
  }
  
  captureMessage(
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error',
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(level)) return;
    
    const logEntry = this.formatLogEntry(level, {
      type: 'message',
      message,
      context,
    });
    
    if (this.config.enableConsole) {
      const logFn = level === 'error' ? console.error :
                    level === 'warning' ? console.warn :
                    level === 'debug' ? console.debug :
                    console.log;
      logFn(`[KIISHA ${level.toUpperCase()}]`, logEntry);
    }
    
    if (this.config.enableDatabase) {
      this.saveToDatabase(logEntry);
    }
  }
  
  setUser(user: { id: string; email?: string; name?: string } | null): void {
    this.currentUser = user;
  }
  
  startTransaction(name: string, op: string): ObservabilityTransaction {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();
    const tags: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    
    if (this.shouldLog('debug')) {
      console.debug(`[KIISHA Transaction Start] ${name} (${op})`);
    }
    
    return {
      setTag: (key: string, value: string) => {
        tags[key] = value;
      },
      setData: (key: string, value: unknown) => {
        data[key] = value;
      },
      finish: () => {
        const duration = Date.now() - startTime;
        
        if (this.shouldLog('debug')) {
          console.debug(`[KIISHA Transaction End] ${name} (${op}) - ${duration}ms`, { tags, data });
        }
        
        if (this.config.enableDatabase) {
          this.saveToDatabase({
            type: 'transaction',
            transactionId,
            name,
            op,
            duration,
            tags,
            data,
            timestamp: new Date().toISOString(),
            user: this.currentUser,
          });
        }
      },
    };
  }
  
  private shouldLog(level: 'debug' | 'info' | 'warning' | 'error'): boolean {
    const configLevel = this.config.logLevel || 'info';
    return LOG_LEVELS[level] >= LOG_LEVELS[configLevel];
  }
  
  private formatLogEntry(level: string, data: Record<string, unknown>): Record<string, unknown> {
    return {
      timestamp: new Date().toISOString(),
      level,
      user: this.currentUser,
      ...data,
    };
  }
  
  private async saveToDatabase(entry: Record<string, unknown>): Promise<void> {
    // In a full implementation, this would save to the database
    // For now, we just log that we would save
    // This could be extended to use the userActivityLog table
    try {
      // Placeholder for database logging
      // const db = await getDb();
      // await db.insert(observabilityLogs).values({ ... });
    } catch (error) {
      console.error('[KIISHA] Failed to save log to database:', error);
    }
  }
}
