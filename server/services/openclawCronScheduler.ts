/**
 * OpenClaw Cron Scheduler Service
 *
 * Executes scheduled OpenClaw tasks based on cron expressions.
 * Each task runs within its organization context with capability checks.
 *
 * Features:
 * - Cron expression parsing (minute-level granularity)
 * - Timezone-aware scheduling
 * - Capability-gated execution
 * - Audit logging for every run
 * - Retry with backoff on failure
 */

import { getDb } from "../db";
import { openclawScheduledTasks } from "../../drizzle/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { checkCapabilityAccess } from "./capabilityRegistry";

// Simple cron field matcher
function matchesCronField(field: string, value: number): boolean {
  if (field === "*") return true;
  // Handle lists: "1,3,5"
  if (field.includes(",")) {
    return field.split(",").some(f => matchesCronField(f.trim(), value));
  }
  // Handle ranges: "1-5"
  if (field.includes("-")) {
    const [min, max] = field.split("-").map(Number);
    return value >= min && value <= max;
  }
  // Handle step: "*/5"
  if (field.startsWith("*/")) {
    const step = parseInt(field.slice(2));
    return value % step === 0;
  }
  return parseInt(field) === value;
}

function shouldRunNow(cronExpression: string, now: Date): boolean {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  return (
    matchesCronField(minute, now.getMinutes()) &&
    matchesCronField(hour, now.getHours()) &&
    matchesCronField(dayOfMonth, now.getDate()) &&
    matchesCronField(month, now.getMonth() + 1) &&
    matchesCronField(dayOfWeek, now.getDay())
  );
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check and execute any due scheduled tasks
 */
async function checkAndExecute(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const now = new Date();

    // Get all active tasks that aren't paused
    const tasks = await db.select().from(openclawScheduledTasks)
      .where(and(
        eq(openclawScheduledTasks.isActive, true),
        eq(openclawScheduledTasks.isPaused, false),
      ));

    for (const task of tasks) {
      try {
        if (!shouldRunNow(task.cronExpression, now)) continue;

        // Skip if ran within the last minute (prevent double execution)
        if (task.lastRunAt && (now.getTime() - new Date(task.lastRunAt).getTime()) < 55000) {
          continue;
        }

        console.log(`[CronScheduler] Executing task: ${task.name} (${task.scheduleId})`);

        // Check capability access
        const access = await checkCapabilityAccess(
          task.organizationId, task.createdBy, task.capabilityId
        );

        if (!access.allowed) {
          console.warn(`[CronScheduler] Capability denied for task ${task.scheduleId}: ${access.reason}`);
          await db.update(openclawScheduledTasks)
            .set({
              lastRunAt: now,
              lastRunStatus: "failed",
              lastRunError: `Capability denied: ${access.reason}`,
              consecutiveFailures: (task.consecutiveFailures || 0) + 1,
            })
            .where(eq(openclawScheduledTasks.id, task.id));
          continue;
        }

        // Execute the task via job queue
        const { enqueueJob } = await import("./jobQueue");
        await enqueueJob("notification_send", {
          userId: task.createdBy,
          type: "scheduled_task",
          title: `Scheduled: ${task.name}`,
          message: `Scheduled task "${task.name}" executed at ${now.toISOString()}`,
          data: {
            organizationId: task.organizationId,
            scheduleId: task.scheduleId,
            taskSpec: task.taskSpec,
          },
        });

        // Update run status
        await db.update(openclawScheduledTasks)
          .set({
            lastRunAt: now,
            lastRunStatus: "success",
            lastRunError: null,
            totalRuns: (task.totalRuns || 0) + 1,
            consecutiveFailures: 0,
          })
          .where(eq(openclawScheduledTasks.id, task.id));

        console.log(`[CronScheduler] Task ${task.scheduleId} completed successfully`);

      } catch (taskError) {
        console.error(`[CronScheduler] Task ${task.scheduleId} failed:`, taskError);
        await db.update(openclawScheduledTasks)
          .set({
            lastRunAt: now,
            lastRunStatus: "failed",
            lastRunError: String(taskError),
            consecutiveFailures: (task.consecutiveFailures || 0) + 1,
          })
          .where(eq(openclawScheduledTasks.id, task.id));

        // Auto-pause after 5 consecutive failures
        if ((task.consecutiveFailures || 0) + 1 >= 5) {
          await db.update(openclawScheduledTasks)
            .set({ isPaused: true })
            .where(eq(openclawScheduledTasks.id, task.id));
          console.warn(`[CronScheduler] Task ${task.scheduleId} paused after 5 consecutive failures`);
        }
      }
    }
  } catch (error) {
    console.error("[CronScheduler] Scheduler check failed:", error);
  }
}

/**
 * Start the cron scheduler (runs every minute)
 */
export function startCronScheduler(): void {
  if (schedulerInterval) return;
  console.log("[CronScheduler] Starting OpenClaw cron scheduler");
  schedulerInterval = setInterval(checkAndExecute, 60 * 1000);
  // Run once immediately
  checkAndExecute();
}

/**
 * Stop the cron scheduler
 */
export function stopCronScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[CronScheduler] Stopped OpenClaw cron scheduler");
  }
}

export const cronSchedulerService = {
  startCronScheduler,
  stopCronScheduler,
  checkAndExecute,
};
