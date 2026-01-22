/**
 * Tests for Customer Portal Invoice Data Endpoints
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

describe('Customer Portal Dashboard Data', () => {
  it('should return dashboard data for existing customer', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Use the test customer we seeded (ID 1)
    const result = await caller.customerPortal.getMyDashboard({
      customerId: 1,
    });
    
    expect(result).toHaveProperty('customer');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('recentInvoices');
    expect(result).toHaveProperty('recentPayments');
    expect(result).toHaveProperty('projects');
    
    expect(result.summary).toHaveProperty('totalInvoiced');
    expect(result.summary).toHaveProperty('totalPaid');
    expect(result.summary).toHaveProperty('totalOutstanding');
    expect(result.summary).toHaveProperty('overdueCount');
    
    expect(typeof result.summary.totalInvoiced).toBe('number');
    expect(typeof result.summary.totalPaid).toBe('number');
    expect(typeof result.summary.totalOutstanding).toBe('number');
    expect(typeof result.summary.overdueCount).toBe('number');
  });
  
  it('should throw error for non-existent customer', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.customerPortal.getMyDashboard({
        customerId: 99999,
      })
    ).rejects.toThrow('Customer not found');
  });
  
  it('should return arrays for invoices and payments', async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyDashboard({
      customerId: 1,
    });
    
    expect(Array.isArray(result.recentInvoices)).toBe(true);
    expect(Array.isArray(result.recentPayments)).toBe(true);
    expect(Array.isArray(result.projects)).toBe(true);
  });
});

describe('Customer Portal Invoices List', () => {
  it('should return invoices for customer', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      limit: 20,
    });
    
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should respect limit parameter', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      limit: 5,
    });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);
  });
  
  it('should filter by status when provided', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      status: 'paid',
      limit: 20,
    });
    
    expect(Array.isArray(result)).toBe(true);
    // All returned invoices should have 'paid' status
    result.forEach(invoice => {
      expect(invoice.status).toBe('paid');
    });
  });
});

describe('Customer Portal Invoice Details', () => {
  it('should throw error for non-existent invoice', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    await expect(
      caller.customerPortal.getInvoiceDetails({
        invoiceId: 99999,
      })
    ).rejects.toThrow('Invoice not found');
  });
});

describe('Customer Portal Invoice Search', () => {
  it('should accept search parameter', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Search should work without errors
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      search: 'INV',
      limit: 20,
    });
    
    expect(Array.isArray(result)).toBe(true);
  });
  
  it('should return empty array for non-matching search', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      search: 'NONEXISTENT12345',
      limit: 20,
    });
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
  
  it('should combine search with status filter', async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.customerPortal.getMyInvoices({
      customerId: 1,
      search: 'INV',
      status: 'paid',
      limit: 20,
    });
    
    expect(Array.isArray(result)).toBe(true);
    // All results should have 'paid' status
    result.forEach(invoice => {
      expect(invoice.status).toBe('paid');
    });
  });
});
