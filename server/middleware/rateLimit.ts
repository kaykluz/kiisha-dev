/**
 * Rate Limiting Middleware
 * 
 * Provides rate limiting for sensitive endpoints like password reset
 * to prevent abuse and brute force attacks.
 */

// In-memory store for rate limiting (use Redis in production for distributed systems)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for grouping rate limits */
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
}

/**
 * Check rate limit for a given key
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  const now = Date.now();
  
  let entry = rateLimitStore.get(fullKey);
  
  // Create new entry if doesn't exist or window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }
  
  // Increment count and store
  entry.count++;
  rateLimitStore.set(fullKey, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Pre-configured rate limits for common use cases
 */
export const RateLimits = {
  /**
   * Password reset: 5 requests per 15 minutes per email
   * Prevents email enumeration and abuse
   */
  passwordReset: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'pwd-reset',
  },
  
  /**
   * Login attempts: 10 per 15 minutes per IP
   * Prevents brute force attacks
   */
  login: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'login',
  },
  
  /**
   * Work order creation: 10 per hour per user
   * Prevents spam
   */
  workOrderCreate: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'wo-create',
  },
  
  /**
   * File upload: 20 per hour per user
   * Prevents storage abuse
   */
  fileUpload: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'upload',
  },
  
  /**
   * API general: 100 requests per minute per user
   * General API protection
   */
  apiGeneral: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'api',
  },
};

/**
 * Reset rate limit for a given key (useful for testing)
 */
export function resetRateLimit(key: string): void {
  // Delete all keys that start with the given key
  for (const [storeKey] of rateLimitStore.entries()) {
    if (storeKey === key || storeKey.includes(`:${key}`) || storeKey.startsWith(`${key}:`)) {
      rateLimitStore.delete(storeKey);
    }
  }
}

/**
 * Create a rate limiter function with pre-configured settings
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (key: string): RateLimitResult => checkRateLimit(key, config);
}

/**
 * Express-style middleware for rate limiting (if needed)
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return (req: any, res: any, next: any) => {
    // Use IP address as key, or user ID if authenticated
    const key = req.user?.id?.toString() || req.ip || 'unknown';
    const result = checkRateLimit(key, config);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));
    
    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfterSeconds);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfterSeconds,
      });
    }
    
    next();
  };
}
