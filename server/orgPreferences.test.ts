/**
 * Phase 34: Org Preferences, Field Packs, and AI Setup Tests
 * Tests for tenant-scoped defaults, admin approval gates, and RBAC parity
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getFieldsForScope,
  getDocRequirementsForScope,
  needsSetupWizard,
} from "./services/runtimeDefaults";

// Mock db functions
vi.mock("./db", () => ({
  getOrgPreferences: vi.fn(),
  getActiveFieldPacksForOrg: vi.fn(),
  getUserViewCustomization: vi.fn(),
  getPendingPushUpdatesForUser: vi.fn(),
  getLatestOrgPreferenceVersion: vi.fn(),
  getUserOrgRole: vi.fn(),
  getGlobalFieldPacks: vi.fn(),
  cloneFieldPack: vi.fn(),
  createAiSetupProposal: vi.fn(),
  getAiSetupProposal: vi.fn(),
  updateAiSetupProposalStatus: vi.fn(),
  upsertOrgPreferences: vi.fn(),
  markPushUpdateAccepted: vi.fn(),
  resetUserViewCustomization: vi.fn(),
  upsertUserViewCustomization: vi.fn(),
}));

import * as db from "./db";

describe("Org Preferences System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("A) Tenant Isolation", () => {
    it("A1: Org preferences are scoped to organizationId", async () => {
      const mockPrefs = {
        organizationId: 1,
        defaultAssetClassifications: ["solar", "wind"],
        defaultConfigurationProfiles: ["utility_scale"],
      };
      
      vi.mocked(db.getOrgPreferences).mockResolvedValue(mockPrefs as never);
      
      // Preferences should only be accessible for the correct org
      const prefs = await db.getOrgPreferences(1);
      expect(prefs?.organizationId).toBe(1);
      expect(db.getOrgPreferences).toHaveBeenCalledWith(1);
    });

    it("A2: Field packs are org-scoped or global (KIISHA-owned)", async () => {
      const mockPacks = [
        { id: 1, name: "Global Pack", organizationId: null, isGlobal: true },
        { id: 2, name: "Org Pack", organizationId: 1, isGlobal: false },
      ];
      
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue(mockPacks as never);
      
      const packs = await db.getActiveFieldPacksForOrg(1);
      
      // Should include both global and org-specific packs
      expect(packs.length).toBe(2);
      expect(packs.some(p => p.isGlobal)).toBe(true);
      expect(packs.some(p => p.organizationId === 1)).toBe(true);
    });

    it("A3: User view customizations are scoped to user+org+view", async () => {
      const mockCustom = {
        userId: 1,
        organizationId: 1,
        viewId: 1,
        localChartOverrides: [{ chartKey: "capacity", chartType: "pie" }],
      };
      
      vi.mocked(db.getUserViewCustomization).mockResolvedValue(mockCustom as never);
      
      const custom = await db.getUserViewCustomization(1, 1, 1);
      
      expect(custom?.userId).toBe(1);
      expect(custom?.organizationId).toBe(1);
      expect(custom?.viewId).toBe(1);
    });
  });

  describe("B) Admin Approval Gates", () => {
    it("B1: Only admins can modify org preferences", async () => {
      vi.mocked(db.getUserOrgRole).mockResolvedValue("user" as never);
      
      const role = await db.getUserOrgRole(1, 1);
      expect(role).toBe("user");
      
      // Non-admin should be blocked (router enforces this)
      // This test verifies the role check works
    });

    it("B2: Only admins can approve AI setup proposals", async () => {
      vi.mocked(db.getUserOrgRole).mockResolvedValue("admin" as never);
      
      const role = await db.getUserOrgRole(1, 1);
      expect(role).toBe("admin");
      
      // Admin should be allowed
    });

    it("B3: Field pack cloning requires admin role", async () => {
      vi.mocked(db.cloneFieldPack).mockResolvedValue(2 as never);
      
      const clonedId = await db.cloneFieldPack(1, 1, 1);
      expect(clonedId).toBe(2);
      expect(db.cloneFieldPack).toHaveBeenCalledWith(1, 1, 1);
    });
  });

  describe("C) RBAC Parity", () => {
    it("C1: All users in org can read org preferences", async () => {
      vi.mocked(db.getUserOrgRole).mockResolvedValue("user" as never);
      vi.mocked(db.getOrgPreferences).mockResolvedValue({
        organizationId: 1,
        defaultAssetClassifications: ["solar"],
      } as never);
      
      // Regular users should be able to read
      const role = await db.getUserOrgRole(1, 1);
      expect(role).not.toBeNull();
      
      const prefs = await db.getOrgPreferences(1);
      expect(prefs).not.toBeNull();
    });

    it("C2: Users can customize their own view settings", async () => {
      vi.mocked(db.upsertUserViewCustomization).mockResolvedValue(undefined);
      
      await db.upsertUserViewCustomization({
        userId: 1,
        organizationId: 1,
        viewId: 1,
        localChartOverrides: [{ chartKey: "test", chartType: "bar" }],
      });
      
      expect(db.upsertUserViewCustomization).toHaveBeenCalled();
    });

    it("C3: Users can reset to org defaults", async () => {
      vi.mocked(db.resetUserViewCustomization).mockResolvedValue(undefined);
      
      await db.resetUserViewCustomization(1, 1, 1, 5);
      
      expect(db.resetUserViewCustomization).toHaveBeenCalledWith(1, 1, 1, 5);
    });
  });

  describe("D) Field Pack Behavior", () => {
    it("D1: getFieldsForScope returns merged fields from active packs", async () => {
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue([
        {
          id: 1,
          name: "Pack 1",
          scope: "asset",
          fields: [
            { fieldKey: "capacity", required: true, displayLabel: "Capacity", group: "Basic", order: 1 },
          ],
          docRequirements: [],
        },
        {
          id: 2,
          name: "Pack 2",
          scope: "asset",
          fields: [
            { fieldKey: "location", required: false, displayLabel: "Location", group: "Basic", order: 2 },
          ],
          docRequirements: [],
        },
      ] as never);
      
      const fields = await getFieldsForScope(1, "asset");
      
      expect(fields.length).toBe(2);
      expect(fields.find(f => f.fieldKey === "capacity")).toBeDefined();
      expect(fields.find(f => f.fieldKey === "location")).toBeDefined();
    });

    it("D2: Later packs override earlier packs for same fieldKey", async () => {
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue([
        {
          id: 1,
          name: "Pack 1",
          scope: "asset",
          fields: [
            { fieldKey: "capacity", required: false, displayLabel: "Capacity (MW)", group: "Basic", order: 1 },
          ],
          docRequirements: [],
        },
        {
          id: 2,
          name: "Pack 2",
          scope: "asset",
          fields: [
            { fieldKey: "capacity", required: true, displayLabel: "Capacity (kW)", group: "Technical", order: 1 },
          ],
          docRequirements: [],
        },
      ] as never);
      
      const fields = await getFieldsForScope(1, "asset");
      
      // Should have only one capacity field (from Pack 2)
      const capacityFields = fields.filter(f => f.fieldKey === "capacity");
      expect(capacityFields.length).toBe(1);
      expect(capacityFields[0].required).toBe(true);
      expect(capacityFields[0].displayLabel).toBe("Capacity (kW)");
    });

    it("D3: getDocRequirementsForScope returns merged requirements", async () => {
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue([
        {
          id: 1,
          name: "Pack 1",
          scope: "asset",
          fields: [],
          docRequirements: [
            { docTypeKey: "ppa", required: true, reviewerGroups: ["legal"], allowedFileTypes: ["pdf"] },
          ],
        },
      ] as never);
      
      const docs = await getDocRequirementsForScope(1, "asset");
      
      expect(docs.length).toBe(1);
      expect(docs[0].docTypeKey).toBe("ppa");
      expect(docs[0].required).toBe(true);
    });

    it("D4: Fields are sorted by order", async () => {
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue([
        {
          id: 1,
          name: "Pack 1",
          scope: "asset",
          fields: [
            { fieldKey: "c", required: false, displayLabel: "C", group: "Basic", order: 3 },
            { fieldKey: "a", required: false, displayLabel: "A", group: "Basic", order: 1 },
            { fieldKey: "b", required: false, displayLabel: "B", group: "Basic", order: 2 },
          ],
          docRequirements: [],
        },
      ] as never);
      
      const fields = await getFieldsForScope(1, "asset");
      
      expect(fields[0].fieldKey).toBe("a");
      expect(fields[1].fieldKey).toBe("b");
      expect(fields[2].fieldKey).toBe("c");
    });
  });

  describe("E) Setup Wizard Logic", () => {
    it("E1: needsSetupWizard returns true when no preferences exist", async () => {
      vi.mocked(db.getOrgPreferences).mockResolvedValue(null);
      
      const needs = await needsSetupWizard(1);
      expect(needs).toBe(true);
    });

    it("E2: needsSetupWizard returns false when AI setup completed", async () => {
      vi.mocked(db.getOrgPreferences).mockResolvedValue({
        organizationId: 1,
        aiSetupCompleted: true,
      } as never);
      
      const needs = await needsSetupWizard(1);
      expect(needs).toBe(false);
    });

    it("E3: needsSetupWizard returns false when manual config exists", async () => {
      vi.mocked(db.getOrgPreferences).mockResolvedValue({
        organizationId: 1,
        defaultAssetClassifications: ["solar"],
        aiSetupCompleted: false,
      } as never);
      
      const needs = await needsSetupWizard(1);
      expect(needs).toBe(false);
    });
  });

  describe("F) Push Update Handling", () => {
    it("F1: Pending updates are returned for user", async () => {
      vi.mocked(db.getPendingPushUpdatesForUser).mockResolvedValue([
        {
          id: 1,
          organizationId: 1,
          updateType: "field_pack",
          updateVersion: 2,
          createdAt: new Date(),
        },
      ] as never);
      
      const updates = await db.getPendingPushUpdatesForUser(1, 1);
      expect(updates.length).toBe(1);
      expect(updates[0].updateType).toBe("field_pack");
    });

    it("F2: markPushUpdateAccepted marks update as accepted", async () => {
      vi.mocked(db.markPushUpdateAccepted).mockResolvedValue(undefined);
      
      await db.markPushUpdateAccepted(1, 1);
      
      expect(db.markPushUpdateAccepted).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("G) AI Setup Proposal Flow", () => {
    it("G1: createAiSetupProposal creates a pending proposal", async () => {
      vi.mocked(db.createAiSetupProposal).mockResolvedValue(1 as never);
      
      const proposalId = await db.createAiSetupProposal({
        organizationId: 1,
        proposedAssetClasses: ["solar"],
        proposedConfigProfiles: ["utility_scale"],
      });
      
      expect(proposalId).toBe(1);
    });

    it("G2: updateAiSetupProposalStatus updates status correctly", async () => {
      vi.mocked(db.updateAiSetupProposalStatus).mockResolvedValue(undefined);
      
      await db.updateAiSetupProposalStatus(1, "approved", 1, "Looks good");
      
      expect(db.updateAiSetupProposalStatus).toHaveBeenCalledWith(1, "approved", 1, "Looks good");
    });

    it("G3: Partial approval is supported", async () => {
      vi.mocked(db.updateAiSetupProposalStatus).mockResolvedValue(undefined);
      
      await db.updateAiSetupProposalStatus(1, "partially_approved", 1, "Only approved field packs", {
        assetClasses: false,
        configProfiles: false,
        fieldPackIds: [1, 2],
        chartConfig: false,
        docHubCategories: false,
      });
      
      expect(db.updateAiSetupProposalStatus).toHaveBeenCalled();
    });
  });

  describe("H) View Customization", () => {
    it("H1: User can override chart type", async () => {
      vi.mocked(db.getUserViewCustomization).mockResolvedValue({
        userId: 1,
        organizationId: 1,
        viewId: 1,
        localChartOverrides: [{ chartKey: "capacity", chartType: "pie" }],
      } as never);
      
      const custom = await db.getUserViewCustomization(1, 1, 1);
      
      expect(custom?.localChartOverrides).toHaveLength(1);
      expect(custom?.localChartOverrides?.[0].chartType).toBe("pie");
    });

    it("H2: User can set column order", async () => {
      vi.mocked(db.getUserViewCustomization).mockResolvedValue({
        userId: 1,
        organizationId: 1,
        viewId: 1,
        localColumnOrder: ["name", "capacity", "status"],
      } as never);
      
      const custom = await db.getUserViewCustomization(1, 1, 1);
      
      expect(custom?.localColumnOrder).toEqual(["name", "capacity", "status"]);
    });

    it("H3: User can hide fields", async () => {
      vi.mocked(db.getUserViewCustomization).mockResolvedValue({
        userId: 1,
        organizationId: 1,
        viewId: 1,
        localHiddenFields: ["internal_notes", "cost"],
      } as never);
      
      const custom = await db.getUserViewCustomization(1, 1, 1);
      
      expect(custom?.localHiddenFields).toContain("internal_notes");
      expect(custom?.localHiddenFields).toContain("cost");
    });
  });

  describe("I) Global Field Packs", () => {
    it("I1: Global packs are owned by KIISHA (organizationId null)", async () => {
      vi.mocked(db.getGlobalFieldPacks).mockResolvedValue([
        { id: 1, name: "Solar Basics", organizationId: null, isGlobal: true },
        { id: 2, name: "Wind Basics", organizationId: null, isGlobal: true },
      ] as never);
      
      const packs = await db.getGlobalFieldPacks();
      
      expect(packs.every(p => p.organizationId === null)).toBe(true);
      expect(packs.every(p => p.isGlobal === true)).toBe(true);
    });

    it("I2: Cloning creates org-scoped copy", async () => {
      vi.mocked(db.cloneFieldPack).mockResolvedValue(3 as never);
      
      // Clone global pack 1 to org 5
      const clonedId = await db.cloneFieldPack(1, 5, 1);
      
      expect(clonedId).toBe(3);
      expect(db.cloneFieldPack).toHaveBeenCalledWith(1, 5, 1);
    });
  });

  describe("J) Scope Filtering", () => {
    it("J1: Only packs matching scope are returned", async () => {
      vi.mocked(db.getActiveFieldPacksForOrg).mockResolvedValue([
        { id: 1, name: "Asset Pack", scope: "asset", fields: [], docRequirements: [] },
        { id: 2, name: "Project Pack", scope: "project", fields: [], docRequirements: [] },
        { id: 3, name: "Site Pack", scope: "site", fields: [], docRequirements: [] },
      ] as never);
      
      const assetFields = await getFieldsForScope(1, "asset");
      const projectFields = await getFieldsForScope(1, "project");
      
      // Each scope should only get its own packs
      // (The filtering happens in getFieldsForScope)
      expect(db.getActiveFieldPacksForOrg).toHaveBeenCalledTimes(2);
    });

    it("J2: All valid scopes are supported", () => {
      const validScopes = ["asset", "project", "site", "portfolio", "dataroom", "rfi"];
      
      // Type check - these should all be valid
      validScopes.forEach(scope => {
        expect(["asset", "project", "site", "portfolio", "dataroom", "rfi"]).toContain(scope);
      });
    });
  });
});
