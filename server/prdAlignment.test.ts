/**
 * PRD Alignment Tests
 * 
 * Tests for the canonical model tables and services:
 * - Portal Scope Resolver
 * - Invoice PDF Service
 * - Portal Upload Service
 * - Portal Work Order Service
 * - Portal Production Service
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { 
  clientAccounts, 
  portalUsers, 
  clientAccountMemberships,
  clientScopeGrants,
  portalFieldPolicies,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("PRD Alignment - Canonical Tables", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  
  beforeAll(async () => {
    db = await getDb();
  });
  
  describe("clientAccounts table", () => {
    it("should have clientAccounts table with required columns", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'clientAccounts'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('code');
      expect(columns).toContain('name');
      expect(columns).toContain('primaryEmail');
      expect(columns).toContain('status');
      expect(columns).toContain('legacyCustomerId');
    });
    
    it("should have migrated test customer to clientAccounts", async () => {
      const [account] = await db
        .select()
        .from(clientAccounts)
        .where(eq(clientAccounts.legacyCustomerId, 1))
        .limit(1);
      
      expect(account).toBeDefined();
      expect(account.name).toBe('Test Customer');
    });
  });
  
  describe("portalUsers table", () => {
    it("should have portalUsers table with required columns", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'portalUsers'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('passwordHash');
      expect(columns).toContain('status');
      expect(columns).toContain('legacyCustomerUserId');
    });
    
    it("should have migrated test customer user to portalUsers", async () => {
      const [user] = await db
        .select()
        .from(portalUsers)
        .where(eq(portalUsers.email, 'test@customer.com'))
        .limit(1);
      
      expect(user).toBeDefined();
      expect(user.legacyCustomerUserId).toBe(1);
    });
  });
  
  describe("clientAccountMemberships table", () => {
    it("should have clientAccountMemberships table", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'clientAccountMemberships'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('clientAccountId');
      expect(columns).toContain('portalUserId');
      expect(columns).toContain('role');
    });
    
    it("should have membership linking portal user to client account", async () => {
      const [membership] = await db
        .select()
        .from(clientAccountMemberships)
        .limit(1);
      
      expect(membership).toBeDefined();
      expect(membership.role).toBe('VIEWER');
    });
  });
  
  describe("clientScopeGrants table", () => {
    it("should have clientScopeGrants table with grant types", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'clientScopeGrants'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('clientAccountId');
      expect(columns).toContain('grantType');
      expect(columns).toContain('orgId');
      expect(columns).toContain('targetId');
    });
    
    it("should have PROJECT grant from migration", async () => {
      const [grant] = await db
        .select()
        .from(clientScopeGrants)
        .where(eq(clientScopeGrants.grantType, 'PROJECT'))
        .limit(1);
      
      expect(grant).toBeDefined();
      expect(grant.status).toBe('active');
    });
  });
  
  describe("portalFieldPolicies table", () => {
    it("should have portalFieldPolicies table", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'portalFieldPolicies'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('name');
      expect(columns).toContain('description');
    });
  });
});

describe("PRD Alignment - Portal Tables", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  
  beforeAll(async () => {
    db = await getDb();
  });
  
  describe("portalUploads table", () => {
    it("should have portalUploads table with artifact linking", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'portalUploads'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('portalUserId');
      expect(columns).toContain('artifactId');
      expect(columns).toContain('uploadType');
    });
  });
  
  describe("portalWorkOrders table", () => {
    it("should have portalWorkOrders table", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'portalWorkOrders'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('clientAccountId');
      expect(columns).toContain('title');
      expect(columns).toContain('status');
    });
  });
  
  describe("portalWorkOrderComments table", () => {
    it("should have portalWorkOrderComments table with internal flag", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'portalWorkOrderComments'
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('portalWorkOrderId');
      expect(columns).toContain('content');
      // Uses authorType to distinguish internal (operator) vs external (portal user) comments
      expect(columns).toContain('authorType');
    });
  });
});

describe("PRD Alignment - Invoice Enhancements", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  
  beforeAll(async () => {
    db = await getDb();
  });
  
  describe("invoices table enhancements", () => {
    it("should have projectId column on invoices", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'projectId'
      `);
      
      expect((result as any[]).length).toBe(1);
    });
    
    it("should have clientAccountId column on invoices", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'clientAccountId'
      `);
      
      expect((result as any[]).length).toBe(1);
    });
    
    it("should have pdfArtifactId column on invoices", async () => {
      const [result] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'pdfArtifactId'
      `);
      
      expect((result as any[]).length).toBe(1);
    });
  });
});
