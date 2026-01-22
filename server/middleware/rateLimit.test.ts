/**
 * Rate Limiting Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimit, RateLimits } from './rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Reset all rate limits before each test
    resetRateLimit('test-key');
    resetRateLimit('test-key-2');
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit('test-key', RateLimits.passwordReset);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RateLimits.passwordReset.maxRequests - 1);
    });

    it('should block requests exceeding limit', () => {
      // Exhaust the limit
      for (let i = 0; i < RateLimits.passwordReset.maxRequests; i++) {
        checkRateLimit('test-key-2', RateLimits.passwordReset);
      }
      
      // Next request should be blocked
      const result = checkRateLimit('test-key-2', RateLimits.passwordReset);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('should track different keys separately', () => {
      // Use up limit for key1
      for (let i = 0; i < RateLimits.passwordReset.maxRequests; i++) {
        checkRateLimit('key1', RateLimits.passwordReset);
      }
      
      // key2 should still be allowed
      const result = checkRateLimit('key2', RateLimits.passwordReset);
      expect(result.allowed).toBe(true);
    });

    it('should apply different limits for different types', () => {
      // File upload has higher limit than password reset
      expect(RateLimits.fileUpload.maxRequests).toBeGreaterThan(RateLimits.passwordReset.maxRequests);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', () => {
      // Use up limit
      for (let i = 0; i < RateLimits.passwordReset.maxRequests; i++) {
        checkRateLimit('reset-test', RateLimits.passwordReset);
      }
      
      // Should be blocked
      expect(checkRateLimit('reset-test', RateLimits.passwordReset).allowed).toBe(false);
      
      // Reset
      resetRateLimit('reset-test');
      
      // Should be allowed again
      expect(checkRateLimit('reset-test', RateLimits.passwordReset).allowed).toBe(true);
    });
  });
});
