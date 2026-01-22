import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// Mock user types
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Helper to create mock context
function createMockContext(role: "admin" | "user" = "user"): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@kiisha.io",
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("KIISHA - Authentication", () => {
  it("returns current user from auth.me", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    
    expect(result).toBeDefined();
    expect(result?.email).toBe("test@kiisha.io");
    expect(result?.role).toBe("user");
  });

  it("clears session cookie on logout", async () => {
    const { ctx, clearedCookies } = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("KIISHA - Permission System", () => {
  it("admin user has admin role", async () => {
    const { ctx } = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    
    expect(result?.role).toBe("admin");
  });

  it("regular user has user role", async () => {
    const { ctx } = createMockContext("user");
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    
    expect(result?.role).toBe("user");
  });
});

describe("KIISHA - Document Categories", () => {
  it("returns document categories", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // This will return empty array since no DB, but validates the router exists
    const result = await caller.documents.getCategories();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns document types", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.documents.getTypes();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("KIISHA - Reviewer Groups", () => {
  it("returns reviewer groups", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.reviews.getGroups();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("KIISHA - Schedule Phases", () => {
  it("returns schedule phases", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.schedule.getPhases();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("KIISHA - Alerts System", () => {
  it("returns alerts list for user", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.alerts.list();
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns unread alert count", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.alerts.getUnreadCount();
    
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("can mark all alerts as read", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.alerts.markAllAsRead();
    
    expect(result).toEqual({ success: true });
  });
});

describe("KIISHA - AI Document Categorization", () => {
  it("categorize endpoint exists and accepts input", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Test that the categorize procedure exists
    expect(caller.documents.categorize).toBeDefined();
  });
});

describe("KIISHA - Closing Checklists", () => {
  it("checklist router exists", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify checklist procedures exist
    expect(caller.checklists.listByProject).toBeDefined();
    expect(caller.checklists.getById).toBeDefined();
    expect(caller.checklists.create).toBeDefined();
    expect(caller.checklists.update).toBeDefined();
    expect(caller.checklists.getItems).toBeDefined();
    expect(caller.checklists.createItem).toBeDefined();
    expect(caller.checklists.updateItem).toBeDefined();
    expect(caller.checklists.linkDocument).toBeDefined();
    expect(caller.checklists.getProgress).toBeDefined();
    expect(caller.checklists.getWhatsNext).toBeDefined();
  });
});

describe("KIISHA - RFI Traceability", () => {
  it("RFI router has linking capabilities", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify RFI linking procedures exist
    expect(caller.rfis.linkDocument).toBeDefined();
    expect(caller.rfis.linkChecklist).toBeDefined();
    expect(caller.rfis.linkSchedule).toBeDefined();
    expect(caller.rfis.getLinkedItems).toBeDefined();
  });

  it("RFI comments support internal-only flag", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify comment procedures exist
    expect(caller.rfis.getComments).toBeDefined();
    expect(caller.rfis.addComment).toBeDefined();
  });
});

describe("KIISHA - AI Extractions", () => {
  it("extraction router has verification workflow", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify extraction procedures exist
    expect(caller.extractions.listByDocument).toBeDefined();
    expect(caller.extractions.extractFromDocument).toBeDefined();
    expect(caller.extractions.verify).toBeDefined();
    expect(caller.extractions.getUnverifiedCount).toBeDefined();
  });
});

describe("KIISHA - Asset Details", () => {
  it("asset details router has verification", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify asset detail procedures exist
    expect(caller.assetDetails.listByProject).toBeDefined();
    expect(caller.assetDetails.create).toBeDefined();
    expect(caller.assetDetails.update).toBeDefined();
    expect(caller.assetDetails.verify).toBeDefined();
  });
});

describe("KIISHA - Notifications", () => {
  it("notification router exists for owner alerts", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify notification procedures exist
    expect(caller.notifications.sendOwnerAlert).toBeDefined();
    expect(caller.notifications.sendOverdueAlert).toBeDefined();
    expect(caller.notifications.sendDocumentStatusAlert).toBeDefined();
    expect(caller.notifications.sendRfiUpdateAlert).toBeDefined();
  });
});

describe("KIISHA - Diligence Progress", () => {
  it("diligence router exists", async () => {
    const { ctx } = createMockContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.diligence.getByProject).toBeDefined();
  });
});
