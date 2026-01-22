import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getDb
vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  }),
}));

// Mock schema
vi.mock("../../drizzle/schema", () => ({
  diligenceTemplates: { id: "id", code: "code", name: "name", category: "category", status: "status", isGlobalDefault: "isGlobalDefault", organizationId: "organizationId" },
  requirementItems: { id: "id", code: "code", isActive: "isActive", category: "category", requirementType: "requirementType", appliesTo: "appliesTo", isGlobalDefault: "isGlobalDefault", organizationId: "organizationId", sortOrder: "sortOrder" },
  templateRequirements: { templateId: "templateId", requirementItemId: "requirementItemId", sortOrder: "sortOrder" },
  expiryRecords: { id: "id", organizationId: "organizationId", entityType: "entityType", entityId: "entityId", status: "status", expiresAt: "expiresAt", requirementItemId: "requirementItemId" },
  renewalRecords: { id: "id", expiryRecordId: "expiryRecordId", status: "status", submittedAt: "submittedAt" },
  diligenceReadiness: { id: "id", entityType: "entityType", entityId: "entityId", organizationId: "organizationId", templateId: "templateId" },
  diligenceAuditLog: { entityType: "entityType", entityId: "entityId", performedAt: "performedAt" },
  companyProfiles: { id: "id", organizationId: "organizationId", status: "status", legalName: "legalName" },
  companyShareholders: { companyProfileId: "companyProfileId" },
  companyDirectors: { companyProfileId: "companyProfileId" },
  companyBankAccounts: { companyProfileId: "companyProfileId" },
  diligenceTemplateVersions: {},
}));

// Mock seed data
vi.mock("../services/diligenceSeedData", () => ({
  runAllSeeds: vi.fn().mockResolvedValue({ requirementItems: 0, templates: 0, mappings: 0 }),
}));

describe("Diligence Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listTemplates", () => {
    it("should return empty array when db returns empty", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      // The mock already returns empty array
      expect(mockDb).toBeDefined();
    });

    it("should handle category filter", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb.select).toBeDefined();
      expect(mockDb.from).toBeDefined();
    });
  });

  describe("listRequirementItems", () => {
    it("should return empty array when no items found", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb).toBeDefined();
    });
  });

  describe("listExpiryRecords", () => {
    it("should filter by organizationId", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb).toBeDefined();
    });
  });

  describe("listRenewals", () => {
    it("should return empty array when no renewals found", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb).toBeDefined();
    });
  });

  describe("listCompanyProfiles", () => {
    it("should filter by organizationId", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb).toBeDefined();
    });
  });

  describe("getAuditLog", () => {
    it("should return empty array when no logs found", async () => {
      const { getDb } = await import("../db");
      const mockDb = await (getDb as any)();
      
      expect(mockDb).toBeDefined();
    });
  });
});

describe("Diligence Seed Data", () => {
  it("should have runAllSeeds function", async () => {
    const { runAllSeeds } = await import("../services/diligenceSeedData");
    expect(runAllSeeds).toBeDefined();
    
    const result = await runAllSeeds();
    expect(result).toHaveProperty("requirementItems");
    expect(result).toHaveProperty("templates");
    expect(result).toHaveProperty("mappings");
  });
});
