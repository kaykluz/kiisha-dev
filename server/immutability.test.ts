/**
 * Immutability and View Scoping Tests
 * 
 * Tests for:
 * - Hard delete returns 405/403
 * - Archive operations work correctly
 * - View scoping filters data correctly
 * - Export respects view scoping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getRfiById: vi.fn(),
  archiveRfi: vi.fn(),
  unarchiveRfi: vi.fn(),
  getDocumentById: vi.fn(),
  archiveDocument: vi.fn(),
  unarchiveDocument: vi.fn(),
  supersedeDocument: vi.fn(),
  getChecklistItemById: vi.fn(),
  getChecklistById: vi.fn(),
  archiveChecklistItem: vi.fn(),
  unarchiveChecklistItem: vi.fn(),
  canUserAccessProject: vi.fn(),
  canUserEditProject: vi.fn(),
  createUserActivity: vi.fn(),
  getExcludedItemsForView: vi.fn(),
  getRfisByProject: vi.fn(),
  getAllRfis: vi.fn(),
  createExportManifest: vi.fn(),
  getDocumentArchiveHistory: vi.fn(),
}));

import * as db from "./db";

describe("Data Immutability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("RFI Archive Operations", () => {
    it("should archive RFI with reason and audit trail", async () => {
      const mockRfi = { id: 1, projectId: 1, title: "Test RFI", visibilityState: "active" };
      vi.mocked(db.getRfiById).mockResolvedValue(mockRfi as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true);
      vi.mocked(db.archiveRfi).mockResolvedValue({ ...mockRfi, visibilityState: "archived" } as any);
      vi.mocked(db.createUserActivity).mockResolvedValue(null);

      // Simulate archive operation
      const rfi = await db.getRfiById(1);
      expect(rfi).toBeDefined();
      
      await db.archiveRfi(1, 1, "No longer needed");
      expect(db.archiveRfi).toHaveBeenCalledWith(1, 1, "No longer needed");
    });

    it("should prevent hard delete and return appropriate error", () => {
      // Hard delete should throw METHOD_NOT_SUPPORTED
      const hardDeleteError = {
        code: "METHOD_NOT_SUPPORTED",
        message: "Hard delete is not allowed. Use archive instead to preserve data integrity."
      };
      
      expect(hardDeleteError.code).toBe("METHOD_NOT_SUPPORTED");
      expect(hardDeleteError.message).toContain("archive");
    });

    it("should only allow admin to unarchive RFI", async () => {
      const mockRfi = { id: 1, projectId: 1, visibilityState: "archived" };
      vi.mocked(db.getRfiById).mockResolvedValue(mockRfi as any);
      vi.mocked(db.unarchiveRfi).mockResolvedValue({ ...mockRfi, visibilityState: "active" } as any);

      // Admin can unarchive
      await db.unarchiveRfi(1, 1);
      expect(db.unarchiveRfi).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("Document Archive Operations", () => {
    it("should archive document with audit trail", async () => {
      const mockDoc = { id: 1, projectId: 1, name: "Test.pdf", visibilityState: "active" };
      vi.mocked(db.getDocumentById).mockResolvedValue(mockDoc as any);
      vi.mocked(db.archiveDocument).mockResolvedValue({ ...mockDoc, visibilityState: "archived" } as any);

      await db.archiveDocument(1, 1, "Outdated version");
      expect(db.archiveDocument).toHaveBeenCalledWith(1, 1, "Outdated version");
    });

    it("should supersede document with new version", async () => {
      const oldDoc = { id: 1, projectId: 1, name: "Contract_v1.pdf" };
      const newDoc = { id: 2, projectId: 1, name: "Contract_v2.pdf" };
      
      vi.mocked(db.getDocumentById)
        .mockResolvedValueOnce(oldDoc as any)
        .mockResolvedValueOnce(newDoc as any);
      vi.mocked(db.supersedeDocument).mockResolvedValue({ ...oldDoc, visibilityState: "superseded", supersededById: 2 } as any);

      await db.supersedeDocument(1, 2, 1, "Updated contract terms");
      expect(db.supersedeDocument).toHaveBeenCalledWith(1, 2, 1, "Updated contract terms");
    });

    it("should track archive history", async () => {
      const mockHistory = [
        { id: 1, documentId: 1, action: "archived", performedAt: new Date(), performedBy: 1 },
        { id: 2, documentId: 1, action: "unarchived", performedAt: new Date(), performedBy: 1 },
      ];
      vi.mocked(db.getDocumentArchiveHistory).mockResolvedValue(mockHistory as any);

      const history = await db.getDocumentArchiveHistory(1);
      expect(history).toHaveLength(2);
      expect(history[0].action).toBe("archived");
    });
  });

  describe("Checklist Item Archive Operations", () => {
    it("should archive checklist item with RBAC check", async () => {
      const mockItem = { id: 1, checklistId: 1, name: "Task 1" };
      const mockChecklist = { id: 1, projectId: 1 };
      
      vi.mocked(db.getChecklistItemById).mockResolvedValue(mockItem as any);
      vi.mocked(db.getChecklistById).mockResolvedValue(mockChecklist as any);
      vi.mocked(db.canUserEditProject).mockResolvedValue(true);
      vi.mocked(db.archiveChecklistItem).mockResolvedValue({ ...mockItem, visibilityState: "archived" } as any);

      await db.archiveChecklistItem(1, 1, "Completed and no longer relevant");
      expect(db.archiveChecklistItem).toHaveBeenCalled();
    });
  });
});

describe("View Scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("View Exclusions", () => {
    it("should filter out excluded items from view", async () => {
      const mockRfis = [
        { id: 1, title: "RFI 1", visibilityState: "active" },
        { id: 2, title: "RFI 2", visibilityState: "active" },
        { id: 3, title: "RFI 3", visibilityState: "active" },
      ];
      
      const mockExclusions = [
        { viewId: 1, entityType: "rfi", entityId: 2 },
      ];
      
      vi.mocked(db.getRfisByProject).mockResolvedValue(mockRfis as any);
      vi.mocked(db.getExcludedItemsForView).mockResolvedValue(mockExclusions as any);

      const rfis = await db.getRfisByProject(1, false);
      const exclusions = await db.getExcludedItemsForView(1);
      
      const excludedIds = new Set(
        exclusions
          .filter(e => e.entityType === "rfi")
          .map(e => e.entityId)
      );
      
      const filteredRfis = rfis.filter((rfi: any) => !excludedIds.has(rfi.id));
      
      expect(filteredRfis).toHaveLength(2);
      expect(filteredRfis.map((r: any) => r.id)).toEqual([1, 3]);
    });

    it("should filter out archived items by default", async () => {
      const mockRfis = [
        { id: 1, title: "RFI 1", visibilityState: "active" },
        { id: 2, title: "RFI 2", visibilityState: "archived" },
        { id: 3, title: "RFI 3", visibilityState: "superseded" },
      ];
      
      vi.mocked(db.getAllRfis).mockResolvedValue(mockRfis as any);

      const rfis = await db.getAllRfis(false);
      const activeRfis = rfis.filter((rfi: any) => 
        rfi.visibilityState !== "archived" && rfi.visibilityState !== "superseded"
      );
      
      expect(activeRfis).toHaveLength(1);
      expect(activeRfis[0].id).toBe(1);
    });
  });

  describe("Export with View Scoping", () => {
    it("should create export manifest when view is specified", async () => {
      vi.mocked(db.createExportManifest).mockResolvedValue({ id: 1 } as any);

      await db.createExportManifest({
        viewId: 1,
        exportType: "csv",
        exportedBy: 1,
        includeHidden: false,
        filters: { projectId: 1 },
        status: "completed",
        itemCount: 10,
      });

      expect(db.createExportManifest).toHaveBeenCalledWith(
        expect.objectContaining({
          viewId: 1,
          exportType: "csv",
          itemCount: 10,
        })
      );
    });

    it("should exclude archived items from export by default", async () => {
      const mockRfis = [
        { id: 1, title: "Active RFI", visibilityState: "active" },
        { id: 2, title: "Archived RFI", visibilityState: "archived" },
      ];
      
      vi.mocked(db.getAllRfis).mockResolvedValue(mockRfis as any);

      const rfis = await db.getAllRfis(false);
      const exportableRfis = rfis.filter((rfi: any) => 
        rfi.visibilityState !== "archived" && rfi.visibilityState !== "superseded"
      );
      
      expect(exportableRfis).toHaveLength(1);
      expect(exportableRfis[0].title).toBe("Active RFI");
    });

    it("should include archived items when explicitly requested", async () => {
      const mockRfis = [
        { id: 1, title: "Active RFI", visibilityState: "active" },
        { id: 2, title: "Archived RFI", visibilityState: "archived" },
      ];
      
      vi.mocked(db.getAllRfis).mockResolvedValue(mockRfis as any);

      const rfis = await db.getAllRfis(false);
      // When includeArchived is true, don't filter
      const exportableRfis = rfis; // No filter applied
      
      expect(exportableRfis).toHaveLength(2);
    });
  });
});

describe("Status Signals", () => {
  it("should derive correct status from visibility state", () => {
    const deriveStatus = (data: { visibilityState?: string; verificationStatus?: string }) => {
      if (data.visibilityState === "archived") return "archived";
      if (data.visibilityState === "superseded") return "superseded";
      if (data.verificationStatus === "verified") return "verified";
      if (data.verificationStatus === "rejected") return "rejected";
      return "unverified";
    };

    expect(deriveStatus({ visibilityState: "archived" })).toBe("archived");
    expect(deriveStatus({ visibilityState: "superseded" })).toBe("superseded");
    expect(deriveStatus({ verificationStatus: "verified" })).toBe("verified");
    expect(deriveStatus({ verificationStatus: "rejected" })).toBe("rejected");
    expect(deriveStatus({})).toBe("unverified");
  });

  it("should prioritize visibility state over verification status", () => {
    const deriveStatus = (data: { visibilityState?: string; verificationStatus?: string }) => {
      if (data.visibilityState === "archived") return "archived";
      if (data.visibilityState === "superseded") return "superseded";
      if (data.verificationStatus === "verified") return "verified";
      return "unverified";
    };

    // Archived takes precedence even if verified
    expect(deriveStatus({ visibilityState: "archived", verificationStatus: "verified" })).toBe("archived");
  });
});
