/**
 * AI Router - Task-to-Model Routing and Fallback Strategy
 * 
 * Determines which provider and model to use for each task.
 * Only KIISHA superuser can configure routing rules.
 */

import { KiishaTask, AIProvider } from "./types";
import { getProvider, getAvailableProviders } from "./providers";

// ============================================================================
// Routing Configuration Types
// ============================================================================

export interface ModelRoute {
  provider: AIProvider;
  model: string;
  priority: number; // Lower = higher priority
}

export interface TaskRoutingConfig {
  task: KiishaTask;
  routes: ModelRoute[];
  fallbackEnabled: boolean;
}

export interface GlobalRoutingConfig {
  defaultProvider: AIProvider;
  defaultModel: string;
  taskRoutes: Partial<Record<KiishaTask, TaskRoutingConfig>>;
  fallbackChain: AIProvider[];
  retryConfig: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
}

// ============================================================================
// Default Routing Configuration
// ============================================================================

const DEFAULT_ROUTING_CONFIG: GlobalRoutingConfig = {
  defaultProvider: "forge",
  defaultModel: "forge-default",
  taskRoutes: {
    // High-precision tasks use more capable models
    DOC_EXTRACT_FIELDS: {
      task: "DOC_EXTRACT_FIELDS",
      routes: [
        { provider: "forge", model: "forge-default", priority: 1 },
        { provider: "openai", model: "gpt-4o", priority: 2 },
        { provider: "anthropic", model: "claude-3-5-sonnet-20241022", priority: 3 },
      ],
      fallbackEnabled: true,
    },
    VALIDATE_CONSISTENCY: {
      task: "VALIDATE_CONSISTENCY",
      routes: [
        { provider: "forge", model: "forge-default", priority: 1 },
        { provider: "openai", model: "gpt-4o", priority: 2 },
      ],
      fallbackEnabled: true,
    },
    // Fast tasks can use lighter models
    INTENT_CLASSIFY: {
      task: "INTENT_CLASSIFY",
      routes: [
        { provider: "forge", model: "forge-fast", priority: 1 },
        { provider: "openai", model: "gpt-4o-mini", priority: 2 },
      ],
      fallbackEnabled: true,
    },
    DOC_CLASSIFY: {
      task: "DOC_CLASSIFY",
      routes: [
        { provider: "forge", model: "forge-fast", priority: 1 },
        { provider: "openai", model: "gpt-4o-mini", priority: 2 },
      ],
      fallbackEnabled: true,
    },
  },
  fallbackChain: ["forge", "openai", "anthropic"],
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
};

// ============================================================================
// Router State (loaded from DB at startup)
// ============================================================================

let currentConfig: GlobalRoutingConfig = DEFAULT_ROUTING_CONFIG;

export function setRoutingConfig(config: GlobalRoutingConfig): void {
  currentConfig = config;
}

export function getRoutingConfig(): GlobalRoutingConfig {
  return currentConfig;
}

// ============================================================================
// Route Selection
// ============================================================================

export interface SelectedRoute {
  provider: AIProvider;
  model: string;
  isDefault: boolean;
}

export function selectRoute(task: KiishaTask): SelectedRoute {
  const taskConfig = currentConfig.taskRoutes[task];
  
  if (taskConfig && taskConfig.routes.length > 0) {
    // Sort by priority and find first available provider
    const sortedRoutes = [...taskConfig.routes].sort((a, b) => a.priority - b.priority);
    
    for (const route of sortedRoutes) {
      const provider = getProvider(route.provider);
      if (provider?.isAvailable) {
        return {
          provider: route.provider,
          model: route.model,
          isDefault: false,
        };
      }
    }
  }
  
  // Fall back to default
  const defaultProvider = getProvider(currentConfig.defaultProvider);
  if (defaultProvider?.isAvailable) {
    return {
      provider: currentConfig.defaultProvider,
      model: currentConfig.defaultModel,
      isDefault: true,
    };
  }
  
  // Try fallback chain
  for (const providerName of currentConfig.fallbackChain) {
    const provider = getProvider(providerName);
    if (provider?.isAvailable) {
      const models = provider.getAvailableModels();
      return {
        provider: providerName,
        model: models[0] || "default",
        isDefault: true,
      };
    }
  }
  
  throw new Error("No AI providers available");
}

// ============================================================================
// Fallback Selection
// ============================================================================

export function selectFallback(
  task: KiishaTask, 
  failedProvider: AIProvider
): SelectedRoute | null {
  const taskConfig = currentConfig.taskRoutes[task];
  
  if (taskConfig?.fallbackEnabled && taskConfig.routes.length > 0) {
    // Find next available provider in the route list
    const sortedRoutes = [...taskConfig.routes].sort((a, b) => a.priority - b.priority);
    let foundFailed = false;
    
    for (const route of sortedRoutes) {
      if (route.provider === failedProvider) {
        foundFailed = true;
        continue;
      }
      
      if (foundFailed) {
        const provider = getProvider(route.provider);
        if (provider?.isAvailable) {
          return {
            provider: route.provider,
            model: route.model,
            isDefault: false,
          };
        }
      }
    }
  }
  
  // Try global fallback chain
  let foundFailed = false;
  for (const providerName of currentConfig.fallbackChain) {
    if (providerName === failedProvider) {
      foundFailed = true;
      continue;
    }
    
    if (foundFailed) {
      const provider = getProvider(providerName);
      if (provider?.isAvailable) {
        const models = provider.getAvailableModels();
        return {
          provider: providerName,
          model: models[0] || "default",
          isDefault: true,
        };
      }
    }
  }
  
  return null;
}

// ============================================================================
// Retry Logic
// ============================================================================

export async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = currentConfig.retryConfig;
  
  let lastError: Error | null = null;
  let delay = initialDelayMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastError);
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_ROUTING_CONFIG };
