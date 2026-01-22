/**
 * Tests for Customer Portal Password Reset and Stats Features
 */
import { describe, it, expect } from 'vitest';
import { appRouter } from './routers';
import type { TrpcContext } from './_core/context';

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-open-id",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "oauth",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe('Customer Portal Password Reset', () => {
  it('should accept password reset request for any email', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Should not throw even for non-existent email (to prevent email enumeration)
    const result = await caller.customerPortal.requestPasswordReset({
      email: 'nonexistent@example.com',
    });
    
    expect(result.success).toBe(true);
  });
  
  it('should accept password reset request for existing email', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Using the test customer email we seeded
    const result = await caller.customerPortal.requestPasswordReset({
      email: 'test@customer.com',
    });
    
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email format', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.customerPortal.requestPasswordReset({
        email: 'invalid-email',
      })
    ).rejects.toThrow();
  });
});

describe('Customer Portal Stats', () => {
  it('should return customer stats for organization', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getCustomerStats({
      orgId: 1,
    });
    
    expect(result).toHaveProperty('totalCustomers');
    expect(result).toHaveProperty('activePortalUsers');
    expect(result).toHaveProperty('customersWithPendingInvoices');
    expect(typeof result.totalCustomers).toBe('number');
    expect(typeof result.activePortalUsers).toBe('number');
    expect(typeof result.customersWithPendingInvoices).toBe('number');
  });
  
  it('should return zero for empty organization', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Use a non-existent org ID
    const result = await caller.customerPortal.getCustomerStats({
      orgId: 99999,
    });
    
    expect(result.totalCustomers).toBe(0);
    expect(result.activePortalUsers).toBe(0);
    expect(result.customersWithPendingInvoices).toBe(0);
  });
  
  it('should require authentication for stats', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.customerPortal.getCustomerStats({
        orgId: 1,
      })
    ).rejects.toThrow();
  });
});
