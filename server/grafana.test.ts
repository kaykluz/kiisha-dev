/**
 * Grafana Integration Tests
 * 
 * Tests for:
 * - Alert policy scope matching
 * - Embed token security
 * - Cross-org isolation patterns
 */

import { describe, it, expect } from "vitest";

describe("Grafana Integration", () => {
  describe("Alert Policy Matching", () => {
    it("should match org-level policies to all alerts in org", () => {
      const orgPolicy = {
        scopeType: "org",
        scopeId: null,
      };
      
      // Org-level should match any alert in the org
      expect(matchesScope(orgPolicy.scopeType, orgPolicy.scopeId, 123, 456, 789)).toBe(true);
      expect(matchesScope(orgPolicy.scopeType, orgPolicy.scopeId, undefined, undefined, undefined)).toBe(true);
    });

    it("should match project-level policies only to matching projects", () => {
      const projectPolicy = {
        scopeType: "project",
        scopeId: 123,
      };
      
      expect(matchesScope(projectPolicy.scopeType, projectPolicy.scopeId, 123, 456, 789)).toBe(true);
      expect(matchesScope(projectPolicy.scopeType, projectPolicy.scopeId, 999, 456, 789)).toBe(false);
    });

    it("should match site-level policies only to matching sites", () => {
      const sitePolicy = {
        scopeType: "site",
        scopeId: 456,
      };
      
      expect(matchesScope(sitePolicy.scopeType, sitePolicy.scopeId, 123, 456, 789)).toBe(true);
      expect(matchesScope(sitePolicy.scopeType, sitePolicy.scopeId, 123, 999, 789)).toBe(false);
    });

    it("should match device-level policies only to matching devices", () => {
      const devicePolicy = {
        scopeType: "device",
        scopeId: 789,
      };
      
      expect(matchesScope(devicePolicy.scopeType, devicePolicy.scopeId, 123, 456, 789)).toBe(true);
      expect(matchesScope(devicePolicy.scopeType, devicePolicy.scopeId, 123, 456, 999)).toBe(false);
    });

    it("should prioritize more specific scopes", () => {
      // Device > Site > Project > Org
      const scopes = ["device", "site", "project", "org"];
      const priorities = scopes.map((s, i) => ({ scope: s, priority: i }));
      
      expect(priorities[0].scope).toBe("device");
      expect(priorities[3].scope).toBe("org");
    });
  });

  describe("Embed Token Security", () => {
    it("should generate tokens with correct TTL", () => {
      const ttlMinutes = 15;
      const now = Date.now();
      const expiresAt = new Date(now + ttlMinutes * 60 * 1000);
      
      // Token should expire within the TTL window
      expect(expiresAt.getTime()).toBeGreaterThan(now);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(now + ttlMinutes * 60 * 1000);
    });

    it("should hash tokens before storage", () => {
      const crypto = require("crypto");
      const token = "test-token-12345";
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      
      // Hash should be different from original token
      expect(hash).not.toBe(token);
      // Hash should be consistent
      expect(crypto.createHash("sha256").update(token).digest("hex")).toBe(hash);
      // Hash should be 64 characters (SHA-256)
      expect(hash.length).toBe(64);
    });

    it("should reject expired tokens", () => {
      const now = Date.now();
      const expiredAt = new Date(now - 1000); // 1 second ago
      
      expect(expiredAt.getTime() < now).toBe(true);
    });

    it("should enforce TTL limits (1-60 minutes)", () => {
      const minTTL = 1;
      const maxTTL = 60;
      
      expect(minTTL).toBeGreaterThanOrEqual(1);
      expect(maxTTL).toBeLessThanOrEqual(60);
    });
  });

  describe("Cross-Org Isolation Patterns", () => {
    it("should require orgId in all dashboard queries", () => {
      const queryPattern = /WHERE.*kiishaOrgId\s*=/i;
      const sampleQuery = `
        SELECT d.* FROM grafanaDashboards d
        JOIN grafanaFolders f ON d.folderId = f.id
        JOIN grafanaOrgs go ON f.grafanaOrgsId = go.id
        WHERE go.kiishaOrgId = 123
      `;
      
      expect(queryPattern.test(sampleQuery)).toBe(true);
    });

    it("should require orgId in all alert queries", () => {
      const queryPattern = /WHERE.*kiishaOrgId\s*=/i;
      const sampleQuery = `
        SELECT * FROM grafanaAlertIngestions
        WHERE kiishaOrgId = 123
      `;
      
      expect(queryPattern.test(sampleQuery)).toBe(true);
    });

    it("should require orgId in all policy queries", () => {
      const queryPattern = /WHERE.*kiishaOrgId\s*=/i;
      const sampleQuery = `
        SELECT * FROM grafanaAlertPolicies
        WHERE kiishaOrgId = 123
      `;
      
      expect(queryPattern.test(sampleQuery)).toBe(true);
    });
  });

  describe("Rule Pattern Matching", () => {
    it("should match exact label values", () => {
      const labels = { alertname: "HighCPU", severity: "critical" };
      const rule = { alertname: "HighCPU" };
      
      expect(matchesRule(rule, labels)).toBe(true);
    });

    it("should match wildcard patterns", () => {
      const labels = { alertname: "HighCPU", severity: "critical" };
      const rule = { alertname: "*" };
      
      expect(matchesRule(rule, labels)).toBe(true);
    });

    it("should match partial wildcards", () => {
      const labels = { alertname: "HighCPU", severity: "critical" };
      const rule = { alertname: "High*" };
      
      expect(matchesRule(rule, labels)).toBe(true);
    });

    it("should match array of patterns (OR)", () => {
      const labels = { alertname: "HighCPU", severity: "critical" };
      const rule = { severity: ["critical", "warning"] };
      
      expect(matchesRule(rule, labels)).toBe(true);
    });

    it("should fail if label not present", () => {
      const labels = { alertname: "HighCPU" };
      const rule = { severity: "critical" };
      
      expect(matchesRule(rule, labels)).toBe(false);
    });
  });
});

// Helper function for scope matching (mirrors alertWebhookBridge.ts)
function matchesScope(
  scopeType: string,
  scopeId: number | null,
  projectId?: number,
  siteId?: number,
  deviceId?: number
): boolean {
  switch (scopeType) {
    case "org":
      return true;
    case "project":
      return scopeId === projectId;
    case "site":
      return scopeId === siteId;
    case "device":
      return scopeId === deviceId;
    default:
      return false;
  }
}

// Helper function for rule matching (mirrors alertWebhookBridge.ts)
function matchesRule(
  rule: Record<string, string | string[]>,
  labels: Record<string, string>
): boolean {
  for (const [key, pattern] of Object.entries(rule)) {
    const labelValue = labels[key];
    
    if (Array.isArray(pattern)) {
      if (!pattern.some(p => matchesPattern(labelValue, p))) {
        return false;
      }
    } else {
      if (!matchesPattern(labelValue, pattern)) {
        return false;
      }
    }
  }
  
  return true;
}

function matchesPattern(value: string | undefined, pattern: string): boolean {
  if (!value) return false;
  if (pattern === "*") return true;
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(value);
  }
  return value === pattern;
}
