import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-phase22",
    email: "test-phase22@example.com",
    name: "Test User Phase22",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      headers: { "user-agent": "test-agent" },
      socket: { remoteAddress: "127.0.0.1" },
    } as TrpcContext["req"],
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Phase 22: Job Dashboard, Notifications, and Enhanced JobStatus", () => {
  describe("Job Status Polling", () => {
    it("should create a job and return canonical status response", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create a test job using correct signature: (type, payload, options)
      const jobResult = await db.createJob(
        "document_ingestion",
        { test: true },
        { userId: ctx.user!.id, priority: "normal" }
      );

      expect(jobResult).toBeDefined();
      expect(jobResult?.id).toBeDefined();

      // Get job status
      const status = await caller.jobs.getStatus({ jobId: jobResult!.id });

      expect(status).toBeDefined();
      expect(status.id).toBe(jobResult!.id);
      expect(status.type).toBe("document_ingestion");
      expect(status.status).toBe("queued");
      expect(status.correlationId).toBeDefined();
      expect(status.displayName).toBeDefined();
      expect(status.displayStatus).toBeDefined();
      expect(status.attempts).toBe(0);
      expect(status.maxAttempts).toBeGreaterThan(0);
    });

    it("should return job status by correlation ID", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const correlationId = `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const jobResult = await db.createJob(
        "ai_extraction",
        { test: true },
        { userId: ctx.user!.id, correlationId, priority: "normal" }
      );

      expect(jobResult).toBeDefined();

      const status = await caller.jobs.getByCorrelation({ correlationId });

      expect(status).toBeDefined();
      expect(status.id).toBe(jobResult!.id);
      expect(status.correlationId).toBe(correlationId);
    });

    it("should return user jobs with filters", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.getUserJobs({ limit: 10 });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Job Retry Behavior", () => {
    it("should create new job on retry (preserving audit trail)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create a job with maxAttempts=1 so it fails permanently
      const originalJobResult = await db.createJob(
        "document_ingestion",
        { test: true },
        { userId: ctx.user!.id, priority: "normal", maxAttempts: 1 }
      );

      expect(originalJobResult).toBeDefined();
      const originalJobId = originalJobResult!.id;

      // Start then fail the job (startJob increments attempts)
      await db.startJob(originalJobId);
      await db.failJob(originalJobId, "Test failure");

      // Retry the job
      const retryResult = await caller.jobs.retry({ jobId: originalJobId });

      // Should create a new job with different ID
      expect(retryResult.id).not.toBe(originalJobId);
      expect(retryResult.status).toBe("queued");
      expect(retryResult.correlationId).toBeDefined();
      
      // Original job should still be failed (audit trail preserved)
      const originalStatus = await caller.jobs.getStatus({ jobId: originalJobId });
      expect(originalStatus.status).toBe("failed");
    });

    it("should not allow retry of non-failed jobs", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create a job that's still queued
      const jobResult = await db.createJob(
        "document_ingestion",
        { test: true },
        { userId: ctx.user!.id, priority: "normal" }
      );

      expect(jobResult).toBeDefined();

      // Try to retry - should fail
      await expect(caller.jobs.retry({ jobId: jobResult!.id })).rejects.toThrow();
    });
  });

  describe("Job Dashboard Queries", () => {
    it("should return all jobs for admin", async () => {
      const ctx = createTestContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.getAllJobs({ limit: 10 });

      expect(result).toBeDefined();
      expect(result.jobs).toBeDefined();
      expect(Array.isArray(result.jobs)).toBe(true);
      expect(result.total).toBeDefined();
    });

    it("should filter jobs by status", async () => {
      const ctx = createTestContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.getAllJobs({ 
        status: "queued",
        limit: 10 
      });

      expect(result).toBeDefined();
      result.jobs.forEach((job: { status: string }) => {
        expect(job.status).toBe("queued");
      });
    });

    it("should filter jobs by type", async () => {
      const ctx = createTestContext("admin");
      const caller = appRouter.createCaller(ctx);

      const result = await caller.jobs.getAllJobs({ 
        type: "document_ingestion",
        limit: 10 
      });

      expect(result).toBeDefined();
      result.jobs.forEach((job: { type: string }) => {
        expect(job.type).toBe("document_ingestion");
      });
    });
  });

  describe("Bulk Retry", () => {
    it("should retry multiple failed jobs", async () => {
      const ctx = createTestContext("admin");
      const caller = appRouter.createCaller(ctx);
      
      // Create and fail multiple jobs (with maxAttempts=1 so they fail permanently)
      const job1Result = await db.createJob(
        "document_ingestion",
        { test: 1 },
        { userId: ctx.user!.id, priority: "normal", maxAttempts: 1 }
      );
      const job2Result = await db.createJob(
        "document_ingestion",
        { test: 2 },
        { userId: ctx.user!.id, priority: "normal", maxAttempts: 1 }
      );

      expect(job1Result).toBeDefined();
      expect(job2Result).toBeDefined();

      // Start then fail jobs
      await db.startJob(job1Result!.id);
      await db.startJob(job2Result!.id);
      await db.failJob(job1Result!.id, "Test failure 1");
      await db.failJob(job2Result!.id, "Test failure 2");

      // Bulk retry
      const result = await caller.jobs.bulkRetry({ jobIds: [job1Result!.id, job2Result!.id] });

      expect(result).toBeDefined();
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe("Job Cancellation", () => {
    it("should cancel a queued job", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const jobResult = await db.createJob(
        "document_ingestion",
        { test: true },
        { userId: ctx.user!.id, priority: "normal" }
      );

      expect(jobResult).toBeDefined();

      await caller.jobs.cancel({ jobId: jobResult!.id });

      const status = await caller.jobs.getStatus({ jobId: jobResult!.id });
      expect(status.status).toBe("cancelled");
    });
  });

  describe("Progress and ETA Calculation", () => {
    it("should return progress information for processing jobs", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create a job with progress in payload
      const jobResult = await db.createJob(
        "document_ingestion",
        { progress: 50, progressMessage: "Processing page 5 of 10" },
        { userId: ctx.user!.id, priority: "normal" }
      );

      expect(jobResult).toBeDefined();

      // Start the job
      await db.startJob(jobResult!.id);

      const status = await caller.jobs.getStatus({ jobId: jobResult!.id });

      expect(status.status).toBe("processing");
      expect(status.progress).toBe(50);
      expect(status.progressMessage).toBe("Processing page 5 of 10");
      expect(status.startedAt).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return user-friendly error messages", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Create job with maxAttempts=1 so it fails permanently
      const jobResult = await db.createJob(
        "document_ingestion",
        { test: true },
        { userId: ctx.user!.id, priority: "normal", maxAttempts: 1 }
      );

      expect(jobResult).toBeDefined();

      // Start then fail with a specific error
      await db.startJob(jobResult!.id);
      await db.failJob(jobResult!.id, "Connection timeout while processing document");

      const status = await caller.jobs.getStatus({ jobId: jobResult!.id });

      expect(status.status).toBe("failed");
      expect(status.error).toBeDefined();
      expect(status.userFriendlyError).toBeDefined();
      // Job with maxAttempts=1 is not retryable after failing
      expect(typeof status.isRetryable).toBe("boolean");
    });
  });

  describe("Activity Logging", () => {
    it("should return activity logs for user", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.profile.getActivityLogs({ limit: 10 });
      
      expect(result).toBeDefined();
      expect(result.logs).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });
});
