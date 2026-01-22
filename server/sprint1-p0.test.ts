import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Sprint 1 P0 Tests", () => {
  describe("Job Status Polling", () => {
    it("should return null for non-existent job", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.jobs.getStatus({ jobId: 999999 });
      expect(result).toBeNull();
    });

    it("should return null for non-existent correlation ID", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.jobs.getByCorrelation({ correlationId: "non_existent_id" });
      expect(result).toBeNull();
    });

    it("should return user jobs list", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.jobs.getUserJobs({});
      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter jobs by status", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.jobs.getUserJobs({ status: "queued" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should filter jobs by type", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.jobs.getUserJobs({ type: "document_ingestion" });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Job Retry Behavior", () => {
    it("should reject retry for non-existent job", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(caller.jobs.retry({ jobId: 999999 }))
        .rejects.toThrow("Job not found");
    });

    it("should reject cancel for non-existent job", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(caller.jobs.cancel({ jobId: 999999 }))
        .rejects.toThrow("Job not found");
    });
  });

  describe("Email Service - Email Change Flow", () => {
    it("should request email change and create verification record", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const newEmail = `test-${Date.now()}@example.com`;
      const result = await caller.profile.requestEmailChange({ newEmail });
      
      expect(result.success).toBe(true);
      expect(result.message.toLowerCase()).toContain("verification");
    });

    it("should reject verification with invalid token", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      await expect(caller.profile.verifyEmailChange({ token: "invalid_token_123" }))
        .rejects.toThrow();
    });
  });

  describe("Activity Logging", () => {
    it("should return activity log for user", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.getActivityLogs({ limit: 10 });
      
      expect(result).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should respect limit parameter", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.profile.getActivityLogs({ limit: 5 });
      
      expect(result.logs.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Storage Health Check", () => {
    it("should return storage health status", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      
      const result = await caller.storage.health();
      
      expect(result).toBeDefined();
      expect(typeof result.configured).toBe("boolean");
      expect(typeof result.healthy).toBe("boolean");
    });
  });
});

describe("Error Handling Utilities", () => {
  it("should generate correlation IDs", async () => {
    const { generateCorrelationId } = await import("../shared/errors");
    
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("err_")).toBe(true);
  });

  it("should create app errors with correct structure", async () => {
    const { createAppError } = await import("../shared/errors");
    
    const error = createAppError("NETWORK_ERROR", "Connection failed");
    
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.message).toBe("Connection failed");
    expect(error.userMessage).toBeDefined();
    expect(error.severity).toBeDefined();
    expect(typeof error.retryable).toBe("boolean");
    expect(error.timestamp).toBeDefined();
  });

  it("should normalize unknown errors", async () => {
    const { normalizeError } = await import("../shared/errors");
    
    const normalized = normalizeError(new Error("Something went wrong"));
    
    expect(normalized.code).toBeDefined();
    expect(normalized.message).toBe("Something went wrong");
    expect(normalized.userMessage).toBeDefined();
  });

  it("should format errors for response", async () => {
    const { createAppError, formatErrorForResponse } = await import("../shared/errors");
    
    const error = createAppError("NOT_FOUND", "Resource not found");
    const formatted = formatErrorForResponse(error);
    
    expect(formatted.error.code).toBe("NOT_FOUND");
    expect(formatted.error.message).toBeDefined();
    expect(typeof formatted.error.retryable).toBe("boolean");
  });
});

describe("Job Types Contract", () => {
  it("should export canonical job types", async () => {
    const { JOB_TYPES, JOB_STATUS, JOB_PRIORITY } = await import("../shared/jobTypes");
    
    expect(JOB_TYPES).toBeDefined();
    expect(JOB_TYPES.DOCUMENT_INGESTION).toBe("document_ingestion");
    expect(JOB_TYPES.AI_EXTRACTION).toBe("ai_extraction");
    expect(JOB_TYPES.EMAIL_SEND).toBe("email_send");
    
    expect(JOB_STATUS).toBeDefined();
    expect(JOB_STATUS.QUEUED).toBe("queued");
    expect(JOB_STATUS.PROCESSING).toBe("processing");
    expect(JOB_STATUS.COMPLETED).toBe("completed");
    expect(JOB_STATUS.FAILED).toBe("failed");
    
    expect(JOB_PRIORITY).toBeDefined();
    expect(JOB_PRIORITY.LOW).toBe("low");
    expect(JOB_PRIORITY.NORMAL).toBe("normal");
    expect(JOB_PRIORITY.HIGH).toBe("high");
    expect(JOB_PRIORITY.CRITICAL).toBe("critical");
  });

  it("should have display name mapping for all job types", async () => {
    const { JOB_TYPES, getJobDisplayName } = await import("../shared/jobTypes");
    
    Object.values(JOB_TYPES).forEach((type) => {
      const displayName = getJobDisplayName(type);
      expect(displayName).toBeDefined();
      expect(typeof displayName).toBe("string");
      expect(displayName.length).toBeGreaterThan(0);
    });
  });

  it("should have display status mapping for all statuses", async () => {
    const { JOB_STATUS, getJobDisplayStatus } = await import("../shared/jobTypes");
    
    Object.values(JOB_STATUS).forEach((status) => {
      const displayStatus = getJobDisplayStatus(status);
      expect(displayStatus).toBeDefined();
      expect(typeof displayStatus).toBe("string");
      expect(displayStatus.length).toBeGreaterThan(0);
    });
  });

  it("should correctly identify retryable jobs", async () => {
    const { isJobRetryable } = await import("../shared/jobTypes");
    
    // Failed job with attempts remaining should be retryable
    expect(isJobRetryable({ status: "failed", attempts: 1, maxAttempts: 3 })).toBe(true);
    
    // Failed job with no attempts remaining should not be retryable
    expect(isJobRetryable({ status: "failed", attempts: 3, maxAttempts: 3 })).toBe(false);
    
    // Completed job should not be retryable
    expect(isJobRetryable({ status: "completed", attempts: 1, maxAttempts: 3 })).toBe(false);
  });
});
