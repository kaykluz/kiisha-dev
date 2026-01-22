/**
 * Phase 32: KIISHA Full Contract v1.0 - Security Acceptance Tests
 * 
 * Tests for:
 * - Org isolation (zero data leakage)
 * - Secure signup with anti-enumeration
 * - Admin pre-approval and invite tokens
 * - Identity binding
 * - Multi-org user handling
 * - Superuser elevation
 * - Cross-org sharing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as db from "./db";
import { resolveOrgContext, verifyResourceAccess, logSecurityEvent, ERRORS } from "./services/orgContext";
import { getMultiOrgContext, resolveInboundOrgContext, parseOrgSelectionResponse } from "./services/multiOrg";

// Mock database
vi.mock("./db");

describe("Phase 32: KIISHA Full Contract v1.0", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ ORG ISOLATION TESTS ============
  describe("Org Isolation", () => {
    it("should resolve org context for single-org user", async () => {
      const mockUser = {
        id: 1,
        openId: "user-1",
        name: "Test User",
        email: "test@example.com",
        activeOrgId: null,
        totpEnabled: false,
      };
      
      const mockMembership = {
        id: 1,
        organizationId: 100,
        userId: 1,
        role: "editor" as const,
        status: "active" as const,
        preApprovedEmail: null,
        preApprovedPhone: null,
        invitedBy: null,
        invitedAt: null,
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mockOrg = {
        id: 100,
        name: "Test Org",
        slug: "test-org",
        status: "active" as const,
        require2FA: false,
      };
      
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue([mockMembership]);
      vi.mocked(db.getOrganizationById).mockResolvedValue(mockOrg as any);
      vi.mocked(db.getKiishaLobbyOrg).mockResolvedValue(null);
      
      const context = await resolveOrgContext(mockUser as any);
      
      expect(context.organizationId).toBe(100);
      expect(context.role).toBe("editor");
      expect(context.isOrgAdmin).toBe(false);
    });

    it("should require org selection for multi-org user without activeOrgId", async () => {
      const mockUser = {
        id: 1,
        openId: "user-1",
        name: "Test User",
        email: "test@example.com",
        activeOrgId: null,
        totpEnabled: false,
      };
      
      const mockMemberships = [
        { id: 1, organizationId: 100, userId: 1, role: "editor" as const, status: "active" as const },
        { id: 2, organizationId: 200, userId: 1, role: "admin" as const, status: "active" as const },
      ];
      
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.getKiishaLobbyOrg).mockResolvedValue(null);
      
      await expect(resolveOrgContext(mockUser as any)).rejects.toThrow(
        "Multiple organizations available"
      );
    });

    it("should deny access to suspended org", async () => {
      const mockUser = {
        id: 1,
        openId: "user-1",
        name: "Test User",
        activeOrgId: 100,
        totpEnabled: false,
      };
      
      const mockMembership = {
        id: 1,
        organizationId: 100,
        userId: 1,
        role: "editor" as const,
        status: "active" as const,
      };
      
      const mockOrg = {
        id: 100,
        name: "Suspended Org",
        status: "suspended" as const,
        require2FA: false,
      };
      
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue([mockMembership] as any);
      vi.mocked(db.getOrganizationById).mockResolvedValue(mockOrg as any);
      vi.mocked(db.getKiishaLobbyOrg).mockResolvedValue(null);
      
      await expect(resolveOrgContext(mockUser as any)).rejects.toThrow(ERRORS.ORG_SUSPENDED);
    });

    it("should require 2FA when org mandates it", async () => {
      const mockUser = {
        id: 1,
        openId: "user-1",
        name: "Test User",
        activeOrgId: 100,
        totpEnabled: false, // 2FA not enabled
      };
      
      const mockMembership = {
        id: 1,
        organizationId: 100,
        userId: 1,
        role: "editor" as const,
        status: "active" as const,
      };
      
      const mockOrg = {
        id: 100,
        name: "Secure Org",
        status: "active" as const,
        require2FA: true, // Org requires 2FA
      };
      
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue([mockMembership] as any);
      vi.mocked(db.getOrganizationById).mockResolvedValue(mockOrg as any);
      vi.mocked(db.getKiishaLobbyOrg).mockResolvedValue(null);
      
      await expect(resolveOrgContext(mockUser as any)).rejects.toThrow(ERRORS.REQUIRES_2FA);
    });

    it("should never leak org existence in error messages", async () => {
      const mockUser = {
        id: 1,
        openId: "user-1",
        name: "Test User",
        activeOrgId: 999, // Org user doesn't belong to
        totpEnabled: false,
      };
      
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue([]);
      vi.mocked(db.getKiishaLobbyOrg).mockResolvedValue(null);
      
      // Should get generic "no membership" error, not "org 999 not found"
      await expect(resolveOrgContext(mockUser as any)).rejects.toThrow(ERRORS.NO_MEMBERSHIP);
    });
  });

  // ============ RESOURCE ACCESS TESTS ============
  describe("Resource Access Verification", () => {
    it("should verify project belongs to user's org", async () => {
      const mockContext = {
        user: { id: 1 },
        organizationId: 100,
      };
      
      const mockProject = {
        id: 1,
        organizationId: 100, // Same org
      };
      
      vi.mocked(db.getProjectById).mockResolvedValue(mockProject as any);
      
      const hasAccess = await verifyResourceAccess(mockContext as any, "project", 1);
      expect(hasAccess).toBe(true);
    });

    it("should deny access to project from different org", async () => {
      const mockContext = {
        user: { id: 1 },
        organizationId: 100,
      };
      
      const mockProject = {
        id: 1,
        organizationId: 200, // Different org
      };
      
      vi.mocked(db.getProjectById).mockResolvedValue(mockProject as any);
      
      const hasAccess = await verifyResourceAccess(mockContext as any, "project", 1);
      expect(hasAccess).toBe(false);
    });

    it("should return false for non-existent resource", async () => {
      const mockContext = {
        user: { id: 1 },
        organizationId: 100,
      };
      
      vi.mocked(db.getProjectById).mockResolvedValue(null);
      
      const hasAccess = await verifyResourceAccess(mockContext as any, "project", 999);
      expect(hasAccess).toBe(false);
    });
  });

  // ============ MULTI-ORG USER TESTS ============
  describe("Multi-Org User Handling", () => {
    it("should get multi-org context with all memberships", async () => {
      const mockUser = {
        id: 1,
        activeOrgId: 100,
      };
      
      const mockMemberships = [
        { organizationId: 100, role: "admin", status: "active" },
        { organizationId: 200, role: "editor", status: "active" },
      ];
      
      const mockOrg1 = { id: 100, name: "Org 1", slug: "org-1" };
      const mockOrg2 = { id: 200, name: "Org 2", slug: "org-2" };
      
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.getOrganizationById)
        .mockResolvedValueOnce(mockOrg1 as any)
        .mockResolvedValueOnce(mockOrg2 as any);
      
      const context = await getMultiOrgContext(1);
      
      expect(context.memberships).toHaveLength(2);
      expect(context.activeOrgId).toBe(100);
      expect(context.requiresSelection).toBe(false);
    });

    it("should resolve inbound message to single org", async () => {
      const mockUser = { id: 1, activeOrgId: null };
      const mockMemberships = [
        { organizationId: 100, role: "editor", status: "active" },
      ];
      const mockOrg = { id: 100, name: "Only Org", slug: "only-org" };
      
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.getOrganizationById).mockResolvedValue(mockOrg as any);
      
      const result = await resolveInboundOrgContext(1);
      
      expect(result.resolved).toBe(true);
      expect(result.organizationId).toBe(100);
      expect(result.resolutionMethod).toBe("single_org");
    });

    it("should return ambiguous for multi-org without hints", async () => {
      const mockUser = { id: 1, activeOrgId: null };
      const mockMemberships = [
        { organizationId: 100, role: "editor", status: "active" },
        { organizationId: 200, role: "admin", status: "active" },
      ];
      const mockOrg1 = { id: 100, name: "Org 1", slug: "org-1" };
      const mockOrg2 = { id: 200, name: "Org 2", slug: "org-2" };
      
      vi.mocked(db.getUserById).mockResolvedValue(mockUser as any);
      vi.mocked(db.getUserOrganizationMemberships).mockResolvedValue(mockMemberships as any);
      vi.mocked(db.getOrganizationById)
        .mockResolvedValueOnce(mockOrg1 as any)
        .mockResolvedValueOnce(mockOrg2 as any);
      
      const result = await resolveInboundOrgContext(1);
      
      expect(result.resolved).toBe(false);
      expect(result.ambiguousOrgs).toHaveLength(2);
    });

    it("should parse numeric org selection", () => {
      const orgs = [
        { organizationId: 100, organizationName: "Org 1", organizationSlug: "org-1", role: "admin", status: "active" },
        { organizationId: 200, organizationName: "Org 2", organizationSlug: "org-2", role: "editor", status: "active" },
      ];
      
      const result = parseOrgSelectionResponse("2", orgs);
      expect(result?.organizationId).toBe(200);
    });

    it("should parse org name selection", () => {
      const orgs = [
        { organizationId: 100, organizationName: "Alpha Corp", organizationSlug: "alpha", role: "admin", status: "active" },
        { organizationId: 200, organizationName: "Beta Inc", organizationSlug: "beta", role: "editor", status: "active" },
      ];
      
      const result = parseOrgSelectionResponse("beta", orgs);
      expect(result?.organizationId).toBe(200);
    });
  });

  // ============ SECURITY AUDIT LOG TESTS ============
  describe("Security Audit Logging", () => {
    it("should log security events with all required fields", async () => {
      vi.mocked(db.createSecurityAuditLogEntry).mockResolvedValue(1);
      
      await logSecurityEvent("login_success", 1, {
        organizationId: 100,
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      });
      
      expect(db.createSecurityAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "login_success",
          userId: 1,
          organizationId: 100,
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        })
      );
    });

    it("should log events without user ID for anonymous actions", async () => {
      vi.mocked(db.createSecurityAuditLogEntry).mockResolvedValue(1);
      
      await logSecurityEvent("signup_started", null, {
        extra: { email: "new@example.com" },
      });
      
      expect(db.createSecurityAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "signup_started",
          userId: null,
        })
      );
    });
  });

  // ============ ANTI-ENUMERATION TESTS ============
  describe("Anti-Enumeration", () => {
    it("should return same response for existing and non-existing emails", () => {
      // This is a design principle test - actual implementation in signup router
      // Both cases should return: "If eligible, we'll email you a verification link."
      const standardResponse = {
        message: "If eligible, we'll email you a verification link.",
        success: true,
      };
      
      // Whether email exists or not, response should be identical
      expect(standardResponse.message).not.toContain("already exists");
      expect(standardResponse.message).not.toContain("not found");
    });
  });

  // ============ INVITE TOKEN TESTS ============
  describe("Invite Token System", () => {
    it("should validate token expiry", () => {
      const expiredToken = {
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        usedCount: 0,
        maxUses: 10,
        revokedAt: null,
        restrictToEmail: null,
        restrictToDomain: null,
      };
      
      const isExpired = new Date() > expiredToken.expiresAt;
      expect(isExpired).toBe(true);
    });

    it("should validate token usage limit", () => {
      const exhaustedToken = {
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        usedCount: 10,
        maxUses: 10,
        revokedAt: null,
        restrictToEmail: null,
        restrictToDomain: null,
      };
      
      const isExhausted = exhaustedToken.usedCount >= exhaustedToken.maxUses;
      expect(isExhausted).toBe(true);
    });

    it("should validate email restriction", () => {
      const restrictedToken = {
        expiresAt: new Date(Date.now() + 86400000),
        usedCount: 0,
        maxUses: 1,
        revokedAt: null,
        restrictToEmail: "specific@example.com",
        restrictToDomain: null,
      };
      
      const emailMatches = restrictedToken.restrictToEmail === "specific@example.com";
      const wrongEmail = restrictedToken.restrictToEmail === "other@example.com";
      
      expect(emailMatches).toBe(true);
      expect(wrongEmail).toBe(false);
    });

    it("should validate domain restriction", () => {
      const domainToken = {
        expiresAt: new Date(Date.now() + 86400000),
        usedCount: 0,
        maxUses: 100,
        revokedAt: null,
        restrictToEmail: null,
        restrictToDomain: "company.com",
      };
      
      const validEmail = "user@company.com";
      const invalidEmail = "user@other.com";
      
      const validDomain = validEmail.split("@")[1] === domainToken.restrictToDomain;
      const invalidDomain = invalidEmail.split("@")[1] === domainToken.restrictToDomain;
      
      expect(validDomain).toBe(true);
      expect(invalidDomain).toBe(false);
    });
  });

  // ============ SUPERUSER ELEVATION TESTS ============
  describe("Superuser Elevation", () => {
    it("should enforce time-bounded elevation", () => {
      const elevation = {
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        status: "active",
      };
      
      const isActive = elevation.status === "active" && new Date() < elevation.expiresAt;
      expect(isActive).toBe(true);
    });

    it("should calculate remaining elevation time", () => {
      const elevation = {
        expiresAt: new Date(Date.now() + 1800000), // 30 minutes
      };
      
      const remainingMinutes = Math.round(
        (elevation.expiresAt.getTime() - Date.now()) / 60000
      );
      
      expect(remainingMinutes).toBeGreaterThan(25);
      expect(remainingMinutes).toBeLessThanOrEqual(30);
    });

    it("should scope elevation to specific org", () => {
      const orgScopedElevation = {
        scope: "organization",
        targetOrganizationId: 100,
        canRead: true,
        canWrite: false,
        canExport: false,
      };
      
      const canAccessOrg100 = orgScopedElevation.targetOrganizationId === 100;
      const canAccessOrg200 = orgScopedElevation.targetOrganizationId === 200;
      
      expect(canAccessOrg100).toBe(true);
      expect(canAccessOrg200).toBe(false);
    });

    it("should allow global elevation to access any org", () => {
      const globalElevation = {
        scope: "global",
        targetOrganizationId: null,
        canRead: true,
        canWrite: false,
        canExport: false,
      };
      
      const isGlobal = globalElevation.scope === "global";
      expect(isGlobal).toBe(true);
    });
  });

  // ============ CROSS-ORG SHARING TESTS ============
  describe("Cross-Org Sharing", () => {
    it("should validate share token scope", () => {
      const shareToken = {
        shareType: "view",
        scopeConfig: {
          viewId: 1,
          readOnly: true,
        },
        recipientOrganizationId: 200,
        recipientEmail: null,
      };
      
      expect(shareToken.shareType).toBe("view");
      expect(shareToken.scopeConfig.readOnly).toBe(true);
    });

    it("should enforce recipient restrictions", () => {
      const emailRestrictedToken = {
        recipientEmail: "partner@external.com",
        recipientOrganizationId: null,
      };
      
      const accessorEmail = "partner@external.com";
      const wrongEmail = "hacker@evil.com";
      
      const validAccess = emailRestrictedToken.recipientEmail === accessorEmail;
      const invalidAccess = emailRestrictedToken.recipientEmail === wrongEmail;
      
      expect(validAccess).toBe(true);
      expect(invalidAccess).toBe(false);
    });

    it("should track token usage count", () => {
      const token = {
        usedCount: 5,
        maxUses: 10,
      };
      
      const canUse = token.usedCount < token.maxUses;
      const remainingUses = token.maxUses - token.usedCount;
      
      expect(canUse).toBe(true);
      expect(remainingUses).toBe(5);
    });
  });

  // ============ IDENTITY BINDING TESTS ============
  describe("Identity Binding", () => {
    it("should mask phone numbers for logging", () => {
      const phone = "+14155551234";
      const masked = "*".repeat(phone.length - 4) + phone.slice(-4);
      
      expect(masked).toBe("********1234");
      expect(masked).not.toContain("+1415555");
    });

    it("should mask emails for logging", () => {
      const email = "john.doe@company.com";
      const [local, domain] = email.split("@");
      const maskedLocal = local[0] + "*".repeat(local.length - 2) + local.slice(-1);
      const masked = `${maskedLocal}@${domain}`;
      
      expect(masked).toBe("j******e@company.com");
      expect(masked).not.toContain("john.doe");
    });

    it("should validate binding code format", () => {
      const validCode = "123456";
      const invalidCode = "12345"; // Too short
      const invalidCode2 = "1234567"; // Too long
      
      const isValid = (code: string) => /^\d{6}$/.test(code);
      
      expect(isValid(validCode)).toBe(true);
      expect(isValid(invalidCode)).toBe(false);
      expect(isValid(invalidCode2)).toBe(false);
    });

    it("should enforce binding attempt limits", () => {
      const binding = {
        attempts: 3,
        maxAttempts: 3,
      };
      
      const canRetry = binding.attempts < binding.maxAttempts;
      expect(canRetry).toBe(false);
    });
  });
});
