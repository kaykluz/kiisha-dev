import { describe, expect, it } from "vitest";
import {
  mockProjects,
  mockDocumentCategories,
  mockDocumentTypes,
  mockRfis,
  mockSchedulePhases,
  mockScheduleItems,
  mockAssetDetails,
  mockAlerts,
  getDocumentStatus,
} from "../shared/mockData";

describe("Mock Data Integrity", () => {
  describe("Projects", () => {
    it("should have valid project data", () => {
      expect(mockProjects.length).toBeGreaterThan(0);
      mockProjects.forEach((project) => {
        expect(project.id).toBeDefined();
        expect(project.name).toBeDefined();
        expect(project.technology).toBeDefined();
        expect(project.stage).toBeDefined();
      });
    });

    it("should have unique project IDs", () => {
      const ids = mockProjects.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("Document Categories and Types", () => {
    it("should have valid document categories", () => {
      expect(mockDocumentCategories.length).toBeGreaterThan(0);
      mockDocumentCategories.forEach((category) => {
        expect(category.id).toBeDefined();
        expect(category.name).toBeDefined();
      });
    });

    it("should have valid document types", () => {
      expect(mockDocumentTypes.length).toBeGreaterThan(0);
      mockDocumentTypes.forEach((docType) => {
        expect(docType.id).toBeDefined();
        expect(docType.name).toBeDefined();
        expect(docType.categoryId).toBeDefined();
      });
    });

    it("should have document types linked to valid categories", () => {
      const categoryIds = new Set(mockDocumentCategories.map((c) => c.id));
      mockDocumentTypes.forEach((docType) => {
        expect(categoryIds.has(docType.categoryId)).toBe(true);
      });
    });
  });

  describe("RFIs", () => {
    it("should have valid RFI data", () => {
      expect(mockRfis.length).toBeGreaterThan(0);
      mockRfis.forEach((rfi) => {
        expect(rfi.id).toBeDefined();
        expect(rfi.title).toBeDefined();
        expect(rfi.projectId).toBeDefined();
        expect(rfi.status).toBeDefined();
        expect(rfi.priority).toBeDefined();
      });
    });

    it("should have RFIs linked to valid projects", () => {
      const projectIds = new Set(mockProjects.map((p) => p.id));
      mockRfis.forEach((rfi) => {
        expect(projectIds.has(rfi.projectId)).toBe(true);
      });
    });

    it("should have valid status values", () => {
      const validStatuses = ["open", "in_progress", "resolved"];
      mockRfis.forEach((rfi) => {
        expect(validStatuses).toContain(rfi.status);
      });
    });

    it("should have valid priority values", () => {
      const validPriorities = ["critical", "high", "medium", "low"];
      mockRfis.forEach((rfi) => {
        expect(validPriorities).toContain(rfi.priority);
      });
    });
  });

  describe("Schedule", () => {
    it("should have valid schedule phases", () => {
      expect(mockSchedulePhases.length).toBeGreaterThan(0);
      mockSchedulePhases.forEach((phase) => {
        expect(phase.id).toBeDefined();
        expect(phase.name).toBeDefined();
      });
    });

    it("should have valid schedule items", () => {
      expect(mockScheduleItems.length).toBeGreaterThan(0);
      mockScheduleItems.forEach((item) => {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.projectId).toBeDefined();
        expect(item.phaseId).toBeDefined();
      });
    });

    it("should have schedule items linked to valid projects and phases", () => {
      const projectIds = new Set(mockProjects.map((p) => p.id));
      const phaseIds = new Set(mockSchedulePhases.map((p) => p.id));
      mockScheduleItems.forEach((item) => {
        expect(projectIds.has(item.projectId)).toBe(true);
        expect(phaseIds.has(item.phaseId)).toBe(true);
      });
    });
  });

  describe("Asset Details", () => {
    it("should have valid asset details", () => {
      expect(mockAssetDetails.length).toBeGreaterThan(0);
      mockAssetDetails.forEach((detail) => {
        expect(detail.projectId).toBeDefined();
        expect(detail.category).toBeDefined();
        expect(detail.fieldName).toBeDefined();
      });
    });

    it("should have asset details linked to valid projects", () => {
      const projectIds = new Set(mockProjects.map((p) => p.id));
      mockAssetDetails.forEach((detail) => {
        expect(projectIds.has(detail.projectId)).toBe(true);
      });
    });
  });

  describe("Alerts", () => {
    it("should have valid alerts", () => {
      expect(mockAlerts.length).toBeGreaterThan(0);
      mockAlerts.forEach((alert) => {
        expect(alert.id).toBeDefined();
        expect(alert.title).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.isRead).toBeDefined();
      });
    });

    it("should have valid severity values", () => {
      const validSeverities = ["critical", "warning", "info"];
      mockAlerts.forEach((alert) => {
        expect(validSeverities).toContain(alert.severity);
      });
    });
  });

  describe("getDocumentStatus", () => {
    it("should return valid status for any project/docType combination", () => {
      const validStatuses = ["verified", "pending", "missing", "na"];
      mockProjects.forEach((project) => {
        mockDocumentTypes.forEach((docType) => {
          const status = getDocumentStatus(project.id, docType.id);
          expect(validStatuses).toContain(status);
        });
      });
    });

    it("should be deterministic (same input returns same output)", () => {
      const projectId = mockProjects[0].id;
      const docTypeId = mockDocumentTypes[0].id;
      const status1 = getDocumentStatus(projectId, docTypeId);
      const status2 = getDocumentStatus(projectId, docTypeId);
      expect(status1).toBe(status2);
    });
  });
});
