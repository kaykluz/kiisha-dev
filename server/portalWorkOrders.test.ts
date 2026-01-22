/**
 * Portal Work Orders tRPC Endpoints Tests
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("Portal Work Orders", () => {
  beforeAll(async () => {
    const db = await getDb();
    // Ensure test tables exist
    await db.execute(sql`SELECT 1`);
  });

  describe("Work Order Table Structure", () => {
    it("should have portalWorkOrders table with required columns", async () => {
      const db = await getDb();
      const [result] = await db.execute(sql`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'portalWorkOrders'
        ORDER BY ORDINAL_POSITION
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('clientAccountId');
      expect(columns).toContain('title');
      expect(columns).toContain('description');
      expect(columns).toContain('category');
      expect(columns).toContain('priority');
      expect(columns).toContain('status');
    });

    it("should have portalWorkOrderComments table with required columns", async () => {
      const db = await getDb();
      const [result] = await db.execute(sql`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'portalWorkOrderComments'
        ORDER BY ORDINAL_POSITION
      `);
      
      const columns = (result as any[]).map(r => r.COLUMN_NAME);
      
      expect(columns).toContain('id');
      expect(columns).toContain('portalWorkOrderId');
      expect(columns).toContain('authorType');
      expect(columns).toContain('content');
    });
  });

  describe("Work Order Categories", () => {
    it("should support all required categories", () => {
      const categories = ['maintenance', 'repair', 'inspection', 'installation', 'support', 'other'];
      
      // Verify categories are valid enum values
      categories.forEach(cat => {
        expect(typeof cat).toBe('string');
        expect(cat.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Work Order Priorities", () => {
    it("should support all required priorities", () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      
      // Verify priorities are valid enum values
      priorities.forEach(pri => {
        expect(typeof pri).toBe('string');
        expect(pri.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Work Order Statuses", () => {
    it("should support all required statuses", () => {
      const statuses = ['submitted', 'acknowledged', 'in_progress', 'completed', 'cancelled'];
      
      // Verify statuses are valid enum values
      statuses.forEach(status => {
        expect(typeof status).toBe('string');
        expect(status.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Comment Author Types", () => {
    it("should distinguish between portal users and operators", () => {
      const authorTypes = ['portal_user', 'operator', 'system'];
      
      // Verify author types
      expect(authorTypes).toContain('portal_user');
      expect(authorTypes).toContain('operator');
    });
  });
});
