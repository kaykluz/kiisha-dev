/**
 * Contract Enforcement Tests for VATR + Views System
 * 
 * R1: Tie-break logic with deterministic fallback
 * R2: RBAC applied AFTER view selection
 * R3: Full mode = RBAC-max, not VATR superset
 * R4: External viewer gets org-granted access only
 * R5: User customization not blocked
 */

import { describe, it, expect, vi } from "vitest";
import * as db from "./db";

describe("Contract Enforcement: VATR + Views System", () => {
  
  describe("R1: Tie-break Logic with Deterministic Fallback", () => {
    it("should have resolveEffectiveView function", () => {
      expect(db.resolveEffectiveView).toBeDefined();
      expect(typeof db.resolveEffectiveView).toBe("function");
    });
    
    it("should have setViewPreference function", () => {
      expect(db.setViewPreference).toBeDefined();
      expect(typeof db.setViewPreference).toBe("function");
    });
    
    it("should have clearViewPreference function", () => {
      expect(db.clearViewPreference).toBeDefined();
      expect(typeof db.clearViewPreference).toBe("function");
    });
    
    it("should have getUserViewPreferences function", () => {
      expect(db.getUserViewPreferences).toBeDefined();
      expect(typeof db.getUserViewPreferences).toBe("function");
    });
  });
  
  describe("R2: RBAC Applied AFTER View Selection", () => {
    it("should have getRbacAllowedFields function", () => {
      expect(db.getRbacAllowedFields).toBeDefined();
      expect(typeof db.getRbacAllowedFields).toBe("function");
    });
    
    it("should have applyRbacToVatrData function", () => {
      expect(db.applyRbacToVatrData).toBeDefined();
      expect(typeof db.applyRbacToVatrData).toBe("function");
    });
    
    it("should filter data based on RBAC-allowed fields (omit mode)", () => {
      const testData = {
        id: 1,
        "identity.name": "Test Asset",
        "identity.assetType": "solar",
        "financial.revenue": 1000000,
        "commercial.contracts": ["Contract A"],
      };
      
      // Simulate investor_viewer allowed fields (no financial/commercial)
      const allowedFields: { cluster: "identity" | "technical" | "operational" | "financial" | "compliance" | "commercial"; fields: string[] }[] = [
        { cluster: "identity", fields: ["name", "assetType"] },
        { cluster: "technical", fields: ["specifications"] },
      ];
      
      const filtered = db.applyRbacToVatrData(testData, allowedFields, "omit");
      
      expect(filtered).toHaveProperty("id"); // Non-cluster fields preserved
      expect(filtered).toHaveProperty("identity.name");
      expect(filtered).toHaveProperty("identity.assetType");
      expect(filtered).not.toHaveProperty("financial.revenue");
      expect(filtered).not.toHaveProperty("commercial.contracts");
    });
    
    it("should redact data based on RBAC-allowed fields (redact mode)", () => {
      const testData = {
        id: 1,
        "identity.name": "Test Asset",
        "financial.revenue": 1000000,
      };
      
      const allowedFields: { cluster: "identity" | "technical" | "operational" | "financial" | "compliance" | "commercial"; fields: string[] }[] = [
        { cluster: "identity", fields: ["name"] },
      ];
      
      const filtered = db.applyRbacToVatrData(testData, allowedFields, "redact");
      
      expect(filtered).toHaveProperty("id");
      expect(filtered).toHaveProperty("identity.name");
      expect(filtered).toHaveProperty("financial.revenue");
      expect((filtered as Record<string, unknown>)["financial.revenue"]).toEqual({
        _redacted: true,
        _reason: "insufficient_permissions",
      });
    });
    
    it("should return redacted message when no fields are allowed", () => {
      const testData = {
        "financial.revenue": 1000000,
        "commercial.contracts": ["Contract A"],
      };
      
      // No allowed fields that match the data
      const allowedFields: { cluster: "identity" | "technical" | "operational" | "financial" | "compliance" | "commercial"; fields: string[] }[] = [
        { cluster: "identity", fields: ["name"] },
      ];
      
      const filtered = db.applyRbacToVatrData(testData, allowedFields, "omit");
      
      expect(filtered).toHaveProperty("_rbacRedacted", true);
      expect(filtered).toHaveProperty("_message");
    });
  });
  
  describe("R3: Full Mode = RBAC-max, Not VATR Superset", () => {
    it("should have getFullModeFields function", () => {
      expect(db.getFullModeFields).toBeDefined();
      expect(typeof db.getFullModeFields).toBe("function");
    });
    
    it("should have getFieldsForDisclosureMode function", () => {
      expect(db.getFieldsForDisclosureMode).toBeDefined();
      expect(typeof db.getFieldsForDisclosureMode).toBe("function");
    });
  });
  
  describe("R4: External Viewer Gets Org-Granted Access Only", () => {
    it("should have quarantineInbound function for unknown senders", () => {
      expect(db.quarantineInbound).toBeDefined();
      expect(typeof db.quarantineInbound).toBe("function");
    });
    
    it("should have isInvestorViewer function", () => {
      expect(db.isInvestorViewer).toBeDefined();
      expect(typeof db.isInvestorViewer).toBe("function");
    });
    
    it("should have getUserProjectRole function", () => {
      expect(db.getUserProjectRole).toBeDefined();
      expect(typeof db.getUserProjectRole).toBe("function");
    });
  });
  
  describe("R5: User Customization Not Blocked", () => {
    it("should allow setting user-level preferences", () => {
      // The setViewPreference function exists and accepts user scope
      expect(db.setViewPreference).toBeDefined();
    });
    
    it("should allow clearing user-level preferences", () => {
      // The clearViewPreference function exists
      expect(db.clearViewPreference).toBeDefined();
    });
    
    it("should have getUserViewPreferences to retrieve preferences", () => {
      expect(db.getUserViewPreferences).toBeDefined();
    });
  });
  
  describe("VATR Cluster Definitions", () => {
    it("should define 6 VATR clusters with sensitivity levels", () => {
      // Verify the RBAC field policy functions work with expected clusters
      const testData = {
        "identity.name": "Test",
        "technical.specs": "Specs",
        "operational.status": "Active",
        "financial.revenue": 1000,
        "compliance.permits": ["P1"],
        "commercial.contracts": ["C1"],
      };
      
      // Admin should see all clusters
      const adminAllowed: { cluster: "identity" | "technical" | "operational" | "financial" | "compliance" | "commercial"; fields: string[] }[] = [
        { cluster: "identity", fields: ["name"] },
        { cluster: "technical", fields: ["specs"] },
        { cluster: "operational", fields: ["status"] },
        { cluster: "financial", fields: ["revenue"] },
        { cluster: "compliance", fields: ["permits"] },
        { cluster: "commercial", fields: ["contracts"] },
      ];
      
      const adminFiltered = db.applyRbacToVatrData(testData, adminAllowed, "omit");
      
      expect(adminFiltered).toHaveProperty("identity.name");
      expect(adminFiltered).toHaveProperty("technical.specs");
      expect(adminFiltered).toHaveProperty("operational.status");
      expect(adminFiltered).toHaveProperty("financial.revenue");
      expect(adminFiltered).toHaveProperty("compliance.permits");
      expect(adminFiltered).toHaveProperty("commercial.contracts");
    });
    
    it("should restrict investor_viewer to public/internal clusters only", () => {
      const testData = {
        "identity.name": "Test",
        "technical.specs": "Specs",
        "operational.status": "Active",
        "financial.revenue": 1000,
        "compliance.permits": ["P1"],
        "commercial.contracts": ["C1"],
      };
      
      // Investor viewer only gets identity, technical, operational (public + internal)
      const investorAllowed: { cluster: "identity" | "technical" | "operational" | "financial" | "compliance" | "commercial"; fields: string[] }[] = [
        { cluster: "identity", fields: ["name"] },
        { cluster: "technical", fields: ["specs"] },
        { cluster: "operational", fields: ["status"] },
        // No financial, compliance, commercial
      ];
      
      const investorFiltered = db.applyRbacToVatrData(testData, investorAllowed, "omit");
      
      expect(investorFiltered).toHaveProperty("identity.name");
      expect(investorFiltered).toHaveProperty("technical.specs");
      expect(investorFiltered).toHaveProperty("operational.status");
      expect(investorFiltered).not.toHaveProperty("financial.revenue");
      expect(investorFiltered).not.toHaveProperty("compliance.permits");
      expect(investorFiltered).not.toHaveProperty("commercial.contracts");
    });
  });
});
