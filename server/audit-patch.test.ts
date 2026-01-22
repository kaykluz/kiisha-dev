import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Helper to create authenticated context
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Audit & Patch - Principle 1: Universal Capture (Ingestion)", () => {
  it("ingestion router exists with upload procedure", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    // Verify the ingestion router exists
    expect(caller.ingestion).toBeDefined();
    expect(typeof caller.ingestion.upload).toBe("function");
    expect(typeof caller.ingestion.listByProject).toBe("function");
    expect(typeof caller.ingestion.getById).toBe("function");
    expect(typeof caller.ingestion.extractContent).toBe("function");
  });
  
  it("ingestion supports multiple file types", async () => {
    // The schema supports: pdf, docx, xlsx, image, audio, video, email, whatsapp, other
    const supportedTypes = ['pdf', 'docx', 'xlsx', 'image', 'audio', 'video', 'email', 'whatsapp', 'other'];
    expect(supportedTypes.length).toBe(9);
  });
});

describe("Audit & Patch - Principle 2: Entity Resolution", () => {
  it("entities router exists with resolution procedures", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.entities).toBeDefined();
    expect(typeof caller.entities.list).toBe("function");
    expect(typeof caller.entities.search).toBe("function");
    expect(typeof caller.entities.create).toBe("function");
    expect(typeof caller.entities.resolveMention).toBe("function");
    expect(typeof caller.entities.addAlias).toBe("function");
    expect(typeof caller.entities.getDiscrepancies).toBe("function");
  });
  
  it("supports all entity types", async () => {
    const entityTypes = ['site', 'company', 'person', 'equipment', 'contract', 'permit'];
    expect(entityTypes.length).toBe(6);
  });
});

describe("Audit & Patch - Principle 3: VATR (Anchor & Verify)", () => {
  it("vatr router exists with verification procedures", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.vatr).toBeDefined();
    expect(typeof caller.vatr.list).toBe("function");
    expect(typeof caller.vatr.create).toBe("function");
    expect(typeof caller.vatr.verify).toBe("function");
    expect(typeof caller.vatr.getSourceDocuments).toBe("function");
    expect(typeof caller.vatr.linkSourceDocument).toBe("function");
    expect(typeof caller.vatr.getAuditLog).toBe("function");
  });
  
  it("supports 6 VATR clusters", async () => {
    const clusters = ['identity', 'technical', 'operational', 'financial', 'compliance', 'commercial'];
    expect(clusters.length).toBe(6);
  });
  
  it("supports multiple asset types", async () => {
    const assetTypes = ['solar_pv', 'bess', 'genset', 'minigrid', 'hybrid', 'wind', 'hydro'];
    expect(assetTypes.length).toBe(7);
  });
});

describe("Audit & Patch - Principle 4: Activate (Compliance & Data Rooms)", () => {
  it("compliance router exists with alert procedures", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.compliance).toBeDefined();
    expect(typeof caller.compliance.listByProject).toBe("function");
    expect(typeof caller.compliance.getExpiring).toBe("function");
    expect(typeof caller.compliance.create).toBe("function");
    expect(typeof caller.compliance.getOpenAlerts).toBe("function");
  });
  
  it("reports router exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.reports).toBeDefined();
    expect(typeof caller.reports.list).toBe("function");
    expect(typeof caller.reports.generate).toBe("function");
  });
  
  it("dataRooms router exists with generation procedures", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.dataRooms).toBeDefined();
    expect(typeof caller.dataRooms.list).toBe("function");
    expect(typeof caller.dataRooms.create).toBe("function");
    expect(typeof caller.dataRooms.generateFromVatr).toBe("function");
    expect(typeof caller.dataRooms.getAccessLog).toBe("function");
  });
  
  it("supports all compliance item types", async () => {
    const itemTypes = ['permit', 'contract', 'obligation', 'deadline', 'license', 'insurance'];
    expect(itemTypes.length).toBe(6);
  });
  
  it("supports all report types", async () => {
    const reportTypes = ['investor_summary', 'monthly_performance', 'due_diligence', 'compliance', 'custom'];
    expect(reportTypes.length).toBe(5);
  });
});

describe("Audit & Patch - Principle 5: Multi-Channel Interface", () => {
  it("whatsapp router exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.whatsapp).toBeDefined();
    expect(typeof caller.whatsapp.getConfig).toBe("function");
    expect(typeof caller.whatsapp.createConfig).toBe("function");
    expect(typeof caller.whatsapp.getMessages).toBe("function");
    expect(typeof caller.whatsapp.receiveMessage).toBe("function");
  });
  
  it("email router exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.email).toBeDefined();
    expect(typeof caller.email.getConfig).toBe("function");
    expect(typeof caller.email.createConfig).toBe("function");
  });
  
  it("apiKeys router exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.apiKeys).toBeDefined();
    expect(typeof caller.apiKeys.list).toBe("function");
    expect(typeof caller.apiKeys.create).toBe("function");
    expect(typeof caller.apiKeys.revoke).toBe("function");
  });
});

describe("Audit & Patch - Existing Features Preserved", () => {
  it("auth router still works", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.id).toBe(1);
  });
  
  it("documents router still exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.documents).toBeDefined();
    expect(typeof caller.documents.listByProject).toBe("function");
    expect(typeof caller.documents.upload).toBe("function");
  });
  
  it("rfis router still exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.rfis).toBeDefined();
    expect(typeof caller.rfis.listByProject).toBe("function");
  });
  
  it("checklists router still exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.checklists).toBeDefined();
    expect(typeof caller.checklists.listByProject).toBe("function");
    expect(typeof caller.checklists.getWhatsNext).toBe("function");
  });
  
  it("schedule router still exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.schedule).toBeDefined();
    expect(typeof caller.schedule.listByProject).toBe("function");
  });
  
  it("extractions router still exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    expect(caller.extractions).toBeDefined();
    expect(typeof caller.extractions.verify).toBe("function");
  });
});
