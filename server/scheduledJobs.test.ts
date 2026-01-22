/**
 * Scheduled Jobs Router Tests
 * 
 * Tests for the cron scheduler and scheduled jobs management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getJobs, getJob, triggerJob, setJobEnabled, initializeScheduler, shutdownScheduler } from "./services/cronScheduler";

describe("Cron Scheduler Service", () => {
  beforeEach(() => {
    // Initialize scheduler for tests
    initializeScheduler();
  });

  afterEach(() => {
    // Clean up timers
    shutdownScheduler();
  });

  it("should register default jobs on initialization", () => {
    const jobs = getJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    
    const jobIds = jobs.map(j => j.id);
    expect(jobIds).toContain("recurring-invoices");
    expect(jobIds).toContain("payment-reminders");
  });

  it("should return job by ID", () => {
    const job = getJob("recurring-invoices");
    expect(job).toBeDefined();
    expect(job?.name).toBe("Process Recurring Invoices");
    expect(job?.isEnabled).toBe(true);
  });

  it("should return undefined for non-existent job", () => {
    const job = getJob("non-existent-job");
    expect(job).toBeUndefined();
  });

  it("should enable and disable jobs", () => {
    const jobId = "recurring-invoices";
    
    // Disable job
    setJobEnabled(jobId, false);
    let job = getJob(jobId);
    expect(job?.isEnabled).toBe(false);
    
    // Re-enable job
    setJobEnabled(jobId, true);
    job = getJob(jobId);
    expect(job?.isEnabled).toBe(true);
  });

  it("should throw error when enabling non-existent job", () => {
    expect(() => setJobEnabled("non-existent", true)).toThrow("Job not found");
  });

  it("should have correct cron expressions", () => {
    const recurringJob = getJob("recurring-invoices");
    expect(recurringJob?.cronExpression).toBe("0 0 * * *"); // Daily at midnight
    
    const reminderJob = getJob("payment-reminders");
    expect(reminderJob?.cronExpression).toBe("0 9 * * *"); // Daily at 9am
  });

  it("should calculate next run time", () => {
    const job = getJob("recurring-invoices");
    expect(job?.nextRunAt).toBeDefined();
    expect(job?.nextRunAt).toBeInstanceOf(Date);
    
    // Next run should be in the future
    const now = new Date();
    expect(job?.nextRunAt!.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("Scheduled Jobs Integration", () => {
  it("should have all required job properties", () => {
    initializeScheduler();
    
    const jobs = getJobs();
    for (const job of jobs) {
      expect(job.id).toBeDefined();
      expect(job.name).toBeDefined();
      expect(job.description).toBeDefined();
      expect(job.cronExpression).toBeDefined();
      expect(typeof job.isEnabled).toBe("boolean");
    }
    
    shutdownScheduler();
  });
});
