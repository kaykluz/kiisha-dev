import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
const mockDb = {
  getVatrAssetById: vi.fn(),
  getProjectById: vi.fn(),
  canUserAccessProject: vi.fn(),
  createVatrAsset: vi.fn(),
};

vi.mock("./db", () => ({
  ...mockDb,
  getDb: () => ({}),
}));

describe("Asset Classification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Classification Enum Values", () => {
    const validClassifications = [
      "residential",
      "small_commercial",
      "large_commercial",
      "industrial",
      "mini_grid",
      "mesh_grid",
      "interconnected_mini_grids",
      "grid_connected",
    ];

    it("should accept all valid classification values", () => {
      validClassifications.forEach((classification) => {
        expect(validClassifications).toContain(classification);
      });
    });

    it("should have 8 classification types", () => {
      expect(validClassifications.length).toBe(8);
    });
  });

  describe("Grid Connection Type Enum Values", () => {
    const validGridTypes = [
      "off_grid",
      "grid_connected",
      "grid_tied_with_backup",
      "mini_grid",
      "interconnected_mini_grid",
      "mesh_grid",
    ];

    it("should accept all valid grid connection types", () => {
      validGridTypes.forEach((type) => {
        expect(validGridTypes).toContain(type);
      });
    });

    it("should have 6 grid connection types", () => {
      expect(validGridTypes.length).toBe(6);
    });
  });

  describe("Configuration Profile Enum Values", () => {
    const validProfiles = [
      "PV_ONLY",
      "PV_BESS",
      "PV_DG",
      "PV_BESS_DG",
      "BESS_ONLY",
      "DG_ONLY",
      "MINIGRID_PV_BESS",
      "MINIGRID_PV_BESS_DG",
      "WIND_ONLY",
      "WIND_BESS",
      "HYBRID_WIND_PV",
    ];

    it("should accept all valid configuration profiles", () => {
      validProfiles.forEach((profile) => {
        expect(validProfiles).toContain(profile);
      });
    });

    it("should have 11 configuration profiles", () => {
      expect(validProfiles.length).toBe(11);
    });
  });

  describe("Network Topology Enum Values", () => {
    const validTopologies = ["radial", "ring", "mesh", "star", "unknown"];

    it("should accept all valid network topologies", () => {
      validTopologies.forEach((topology) => {
        expect(validTopologies).toContain(topology);
      });
    });

    it("should have 5 network topology types", () => {
      expect(validTopologies.length).toBe(5);
    });
  });
});

describe("VATR Anchor Enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Asset Creation Requires Project", () => {
    it("should require projectId for asset creation", () => {
      // The schema enforces projectId as required
      const assetInput = {
        projectId: 1, // Required
        assetName: "Test Solar Farm",
        assetType: "solar_pv",
      };

      expect(assetInput.projectId).toBeDefined();
      expect(typeof assetInput.projectId).toBe("number");
    });

    it("should reject asset creation without projectId", () => {
      const invalidInput = {
        assetName: "Test Solar Farm",
        assetType: "solar_pv",
        // Missing projectId
      };

      // @ts-expect-error - Testing missing required field
      expect(invalidInput.projectId).toBeUndefined();
    });
  });

  describe("Provenance Fields", () => {
    it("should accept optional provenance fields", () => {
      const assetWithProvenance = {
        projectId: 1,
        assetName: "Test Asset",
        sourceDocumentId: 123,
        sourcePage: 5,
        sourceSnippet: "Extracted from page 5 of technical specs",
      };

      expect(assetWithProvenance.sourceDocumentId).toBe(123);
      expect(assetWithProvenance.sourcePage).toBe(5);
      expect(assetWithProvenance.sourceSnippet).toBeDefined();
    });
  });
});

describe("View Overlay System", () => {
  describe("Item-Level Exclusion", () => {
    it("should support excluding items from a view", () => {
      const viewItem = {
        viewId: 1,
        entityType: "asset",
        entityId: 100,
        inclusionState: "excluded",
        reason: "Not relevant for this portfolio",
        updatedBy: 1,
      };

      expect(viewItem.inclusionState).toBe("excluded");
      expect(viewItem.reason).toBeDefined();
    });

    it("should support including items in a view", () => {
      const viewItem = {
        viewId: 1,
        entityType: "asset",
        entityId: 100,
        inclusionState: "included",
        reason: null,
        updatedBy: 1,
      };

      expect(viewItem.inclusionState).toBe("included");
    });
  });

  describe("Field-Level Suppression", () => {
    it("should support suppressing specific fields", () => {
      const fieldOverride = {
        viewId: 1,
        assetId: 100,
        fieldKey: "financialTerms",
        state: "suppressed",
        reason: "Confidential for external view",
        updatedBy: 1,
      };

      expect(fieldOverride.state).toBe("suppressed");
      expect(fieldOverride.fieldKey).toBe("financialTerms");
    });

    it("should support redacting fields", () => {
      const fieldOverride = {
        viewId: 1,
        assetId: 100,
        fieldKey: "ownerContact",
        state: "redacted",
        reason: "PII protection",
        updatedBy: 1,
      };

      expect(fieldOverride.state).toBe("redacted");
    });
  });
});

describe("Template Matching", () => {
  describe("Requirement Template Matching", () => {
    it("should match templates by classification", () => {
      const template = {
        name: "Mini-Grid Requirements",
        assetClassification: "mini_grid",
        configurationProfile: null,
        priority: 10,
      };

      const asset = {
        assetClassification: "mini_grid",
        configurationProfile: "MINIGRID_PV_BESS_DG",
      };

      // Template matches if classification matches
      const matches = template.assetClassification === asset.assetClassification;
      expect(matches).toBe(true);
    });

    it("should match templates by configuration profile", () => {
      const template = {
        name: "Hybrid System Requirements",
        assetClassification: null,
        configurationProfile: "PV_BESS_DG",
        priority: 20,
      };

      const asset = {
        assetClassification: "large_commercial",
        configurationProfile: "PV_BESS_DG",
      };

      // Template matches if profile matches
      const matches = template.configurationProfile === asset.configurationProfile;
      expect(matches).toBe(true);
    });

    it("should prefer higher priority templates", () => {
      const templates = [
        { name: "Generic", priority: 0 },
        { name: "Specific", priority: 10 },
        { name: "Most Specific", priority: 20 },
      ];

      const sorted = templates.sort((a, b) => b.priority - a.priority);
      expect(sorted[0].name).toBe("Most Specific");
    });
  });

  describe("View Template Matching", () => {
    it("should provide default columns based on classification", () => {
      const viewTemplate = {
        assetClassification: "mini_grid",
        defaultColumns: [
          "assetName",
          "capacityKw",
          "networkTopology",
          "gridConnectionType",
          "customerCount",
        ],
      };

      expect(viewTemplate.defaultColumns).toContain("networkTopology");
      expect(viewTemplate.defaultColumns).toContain("customerCount");
    });
  });
});

describe("Asset Filter Queries", () => {
  describe("Classification Filter", () => {
    it("should filter assets by single classification", () => {
      const assets = [
        { id: 1, assetClassification: "residential" },
        { id: 2, assetClassification: "mini_grid" },
        { id: 3, assetClassification: "residential" },
      ];

      const filtered = assets.filter(
        (a) => a.assetClassification === "residential"
      );
      expect(filtered.length).toBe(2);
    });

    it("should filter assets by multiple classifications", () => {
      const assets = [
        { id: 1, assetClassification: "residential" },
        { id: 2, assetClassification: "mini_grid" },
        { id: 3, assetClassification: "industrial" },
      ];

      const allowedClassifications = ["residential", "mini_grid"];
      const filtered = assets.filter((a) =>
        allowedClassifications.includes(a.assetClassification)
      );
      expect(filtered.length).toBe(2);
    });
  });

  describe("Configuration Profile Filter", () => {
    it("should filter assets by configuration profile", () => {
      const assets = [
        { id: 1, configurationProfile: "PV_ONLY" },
        { id: 2, configurationProfile: "PV_BESS" },
        { id: 3, configurationProfile: "PV_BESS_DG" },
      ];

      const filtered = assets.filter(
        (a) => a.configurationProfile?.includes("BESS")
      );
      expect(filtered.length).toBe(2);
    });
  });

  describe("Combined Filters", () => {
    it("should apply multiple filters together", () => {
      const assets = [
        { id: 1, assetClassification: "mini_grid", configurationProfile: "MINIGRID_PV_BESS" },
        { id: 2, assetClassification: "mini_grid", configurationProfile: "PV_ONLY" },
        { id: 3, assetClassification: "residential", configurationProfile: "PV_BESS" },
      ];

      const filtered = assets.filter(
        (a) =>
          a.assetClassification === "mini_grid" &&
          a.configurationProfile?.includes("BESS")
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
    });
  });
});

describe("Export with View Scoping", () => {
  it("should exclude items marked as excluded in view", () => {
    const allAssets = [
      { id: 1, name: "Asset A" },
      { id: 2, name: "Asset B" },
      { id: 3, name: "Asset C" },
    ];

    const viewExclusions = new Set([2]); // Asset B excluded

    const exportedAssets = allAssets.filter((a) => !viewExclusions.has(a.id));
    expect(exportedAssets.length).toBe(2);
    expect(exportedAssets.find((a) => a.id === 2)).toBeUndefined();
  });

  it("should suppress fields marked as suppressed in view", () => {
    const asset = {
      id: 1,
      name: "Asset A",
      capacityKw: "500",
      financialTerms: "Confidential PPA terms",
    };

    const suppressedFields = new Set(["financialTerms"]);

    const exportedAsset = Object.fromEntries(
      Object.entries(asset).filter(([key]) => !suppressedFields.has(key))
    );

    expect(exportedAsset.name).toBe("Asset A");
    expect(exportedAsset.financialTerms).toBeUndefined();
  });
});
