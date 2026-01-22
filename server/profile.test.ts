import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-open-id",
    email: "test@example.com",
    name: "Test User",
    role: "user",
    avatarUrl: null,
    organization: null,
    userType: "internal",
    loginMethod: "local",
    totpEnabled: false,
    createdAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

describe("Profile Router", () => {
  describe("profile.get", () => {
    it("should return user profile with notification preferences", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const profile = await caller.profile.get();
      
      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(profile.email).toBeDefined();
      expect(profile.notificationPreferences).toBeDefined();
      expect(typeof profile.twoFactorEnabled).toBe("boolean");
    });
  });

  describe("profile.update", () => {
    it("should update user name", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.update({
        name: "Updated Name",
      });
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it("should update user organization", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.update({
        organization: "New Organization",
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe("profile.getNotificationPreferences", () => {
    it("should return notification preferences", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const prefs = await caller.profile.getNotificationPreferences();
      
      expect(prefs).toBeDefined();
      expect(typeof prefs.emailDocuments).toBe("boolean");
      expect(typeof prefs.emailRfis).toBe("boolean");
      expect(typeof prefs.emailAlerts).toBe("boolean");
      expect(["realtime", "daily", "weekly"]).toContain(prefs.digestFrequency);
    });
  });

  describe("profile.updateNotificationPreferences", () => {
    it("should update email notification preferences", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.updateNotificationPreferences({
        emailDocuments: false,
        emailRfis: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.preferences).toBeDefined();
    });

    it("should update digest frequency", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.updateNotificationPreferences({
        digestFrequency: "daily",
      });
      
      expect(result.success).toBe(true);
      expect(result.preferences?.digestFrequency).toBe("daily");
    });

    it("should update WhatsApp preferences", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.updateNotificationPreferences({
        whatsappEnabled: true,
        whatsappDocuments: true,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe("profile.get2FAStatus", () => {
    it("should return 2FA status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const status = await caller.profile.get2FAStatus();
      
      expect(status).toBeDefined();
      expect(typeof status.enabled).toBe("boolean");
      expect(typeof status.hasSecret).toBe("boolean");
    });
  });
});

describe("Auth Router - 2FA Setup", () => {
  describe("auth.setup2FA", () => {
    it("should generate TOTP secret", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.auth.setup2FA();
      
      expect(result).toBeDefined();
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpAuthUrl).toBeDefined();
      expect(result.otpAuthUrl).toContain("otpauth://totp/");
    });
  });
});
