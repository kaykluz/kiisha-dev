import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

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

describe("Job Queue", () => {
  describe("createJob", () => {
    it("should create a job with default values", async () => {
      const result = await db.createJob("document_ingestion", {
        fileUploadId: 123,
        filename: "test.pdf",
      });

      expect(result).toBeDefined();
      expect(typeof result?.id).toBe("number");

      const job = await db.getJob(result!.id);
      expect(job).toBeDefined();
      expect(job?.type).toBe("document_ingestion");
      expect(job?.status).toBe("queued");
      expect(job?.priority).toBe("normal");
      expect(job?.attempts).toBe(0);
      expect(job?.maxAttempts).toBe(3);
    });

    it("should create a job with custom priority", async () => {
      const result = await db.createJob(
        "ai_extraction",
        { documentId: 456 },
        { priority: "high" }
      );

      const job = await db.getJob(result!.id);
      expect(job?.priority).toBe("high");
    });

    it("should generate a correlation ID", async () => {
      const result = await db.createJob("notification_send", { userId: 1 });

      const job = await db.getJob(result!.id);
      expect(job?.correlationId).toBeDefined();
      expect(job?.correlationId).toMatch(/^job_\d+_[a-z0-9]+$/);
    });
  });

  describe("job status transitions", () => {
    it("should start a job", async () => {
      const result = await db.createJob("file_processing", { fileId: 789 });
      
      await db.startJob(result!.id);
      
      const job = await db.getJob(result!.id);
      expect(job?.status).toBe("processing");
      expect(job?.startedAt).toBeDefined();
      expect(job?.attempts).toBe(1);
    });

    it("should complete a job", async () => {
      const result = await db.createJob("data_export", { format: "csv" });
      await db.startJob(result!.id);
      
      await db.completeJob(result!.id, { exportUrl: "https://example.com/export.csv" });
      
      const job = await db.getJob(result!.id);
      expect(job?.status).toBe("completed");
      expect(job?.completedAt).toBeDefined();
      expect(job?.result).toEqual({ exportUrl: "https://example.com/export.csv" });
    });

    it("should fail a job and allow retry", async () => {
      const result = await db.createJob("webhook_delivery", { url: "https://example.com" });
      await db.startJob(result!.id);
      
      const willRetry = await db.failJob(result!.id, "Connection timeout");
      
      expect(willRetry).toBe(true);
      
      const job = await db.getJob(result!.id);
      expect(job?.status).toBe("queued"); // Back to queued for retry
      expect(job?.error).toBe("Connection timeout");
    });

    it("should fail a job permanently after max attempts", async () => {
      const result = await db.createJob(
        "webhook_delivery",
        { url: "https://example.com" },
        { maxAttempts: 1 }
      );
      await db.startJob(result!.id);
      
      const willRetry = await db.failJob(result!.id, "Connection timeout");
      
      expect(willRetry).toBe(false);
      
      const job = await db.getJob(result!.id);
      expect(job?.status).toBe("failed");
      expect(job?.failedAt).toBeDefined();
    });

    it("should cancel a job", async () => {
      const result = await db.createJob("report_generation", { reportType: "monthly" });
      
      await db.cancelJob(result!.id);
      
      const job = await db.getJob(result!.id);
      expect(job?.status).toBe("cancelled");
    });
  });

  describe("job logs", () => {
    it("should log job messages", async () => {
      const result = await db.createJob("file_processing", { fileId: 999 });
      
      await db.logJobMessage(result!.id, "info", "Starting processing");
      await db.logJobMessage(result!.id, "debug", "Reading file", { size: 1024 });
      await db.logJobMessage(result!.id, "error", "Failed to read file");
      
      const logs = await db.getJobLogs(result!.id);
      
      expect(logs.length).toBe(3);
      expect(logs[0].level).toBe("info");
      expect(logs[1].level).toBe("debug");
      expect(logs[1].data).toEqual({ size: 1024 });
      expect(logs[2].level).toBe("error");
    });
  });
});

describe("File Upload Validation", () => {
  describe("validateFileUpload", () => {
    it("should accept valid PDF files", () => {
      const result = db.validateFileUpload("application/pdf", 10 * 1024 * 1024);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should accept valid image files", () => {
      const result = db.validateFileUpload("image/jpeg", 5 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid mime types", () => {
      const result = db.validateFileUpload("application/x-executable", 1024);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("File type 'application/x-executable' is not allowed");
    });

    it("should reject files that are too large", () => {
      const result = db.validateFileUpload("application/pdf", 200 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("exceeds maximum"))).toBe(true);
    });
  });

  describe("generateStorageKey", () => {
    it("should generate consistent storage keys", () => {
      const key = db.generateStorageKey("web", "test-document.pdf", {
        userId: 1,
        projectId: 2,
      });
      
      expect(key).toContain("uploads/web/");
      expect(key).toContain("test-document.pdf");
      expect(key).toContain("user_1");
      expect(key).toContain("project_2");
    });

    it("should sanitize filenames", () => {
      const key = db.generateStorageKey("web", "test file (1).pdf");
      
      expect(key).not.toContain(" ");
      expect(key).not.toContain("(");
      expect(key).not.toContain(")");
    });

    it("should organize by source and date", () => {
      const key = db.generateStorageKey("whatsapp", "image.jpg");
      const today = new Date().toISOString().split("T")[0].replace(/-/g, "/");
      
      expect(key).toContain("uploads/whatsapp/");
      expect(key).toContain(today);
    });
  });
});

describe("Jobs Router", () => {
  describe("jobs.getStatus", () => {
    it("should return job status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create a job first
      const result = await db.createJob("document_ingestion", { test: true }, { userId: ctx.user!.id });
      
      const status = await caller.jobs.getStatus({ jobId: result!.id });
      
      expect(status).toBeDefined();
      expect(status?.id).toBe(result!.id);
      expect(status?.status).toBe("queued");
    });
  });

  describe("jobs.getUserJobs", () => {
    it("should return user jobs", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create some jobs for the user
      await db.createJob("ai_extraction", { test: 1 }, { userId: ctx.user!.id });
      
      const jobs = await caller.jobs.getUserJobs({});
      
      expect(Array.isArray(jobs)).toBe(true);
    });
  });
});
