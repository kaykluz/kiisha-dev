/**
 * Scheduled Jobs Router
 * 
 * Admin endpoints for managing scheduled background tasks:
 * - View all registered jobs
 * - View job execution history
 * - Manually trigger jobs
 * - Enable/disable jobs
 * - Update job schedules
 * 
 * WHO USES THIS: Admin only
 * LOCATION: Admin Dashboard → Settings → Scheduled Jobs
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { 
  getJobs, 
  getJob, 
  getJobHistory, 
  getJobHistoryFromDb,
  triggerJob, 
  setJobEnabled, 
  updateJobSchedule 
} from "../services/cronScheduler";

export const scheduledJobsRouter = router({
  // List all registered jobs
  listJobs: protectedProcedure
    .query(async () => {
      const jobs = getJobs();
      return jobs.map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        cronExpression: job.cronExpression,
        isEnabled: job.isEnabled,
        lastRunAt: job.lastRunAt,
        lastRunStatus: job.lastRunStatus,
        lastRunResult: job.lastRunResult,
        nextRunAt: job.nextRunAt,
      }));
    }),

  // Get single job details
  getJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const job = getJob(input.jobId);
      if (!job) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
      }
      return {
        id: job.id,
        name: job.name,
        description: job.description,
        cronExpression: job.cronExpression,
        isEnabled: job.isEnabled,
        lastRunAt: job.lastRunAt,
        lastRunStatus: job.lastRunStatus,
        lastRunResult: job.lastRunResult,
        nextRunAt: job.nextRunAt,
      };
    }),

  // Get job execution history (in-memory)
  getJobHistory: protectedProcedure
    .input(z.object({
      jobId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return getJobHistory(input.jobId, input.limit);
    }),

  // Get job execution history from database
  getJobHistoryFromDb: protectedProcedure
    .input(z.object({
      jobId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      return getJobHistoryFromDb(input);
    }),

  // Manually trigger a job
  triggerJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const result = await triggerJob(input.jobId);
        return { success: true, result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to trigger job",
        });
      }
    }),

  // Enable or disable a job
  setJobEnabled: protectedProcedure
    .input(z.object({
      jobId: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      try {
        setJobEnabled(input.jobId, input.enabled);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update job",
        });
      }
    }),

  // Update job schedule
  updateJobSchedule: protectedProcedure
    .input(z.object({
      jobId: z.string(),
      cronExpression: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        updateJobSchedule(input.jobId, input.cronExpression);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update schedule",
        });
      }
    }),
});
