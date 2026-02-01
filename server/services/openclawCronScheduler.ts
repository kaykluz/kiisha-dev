/**
 * OpenClaw Cron Scheduler Service
 *
 * Executes scheduled OpenClaw tasks based on cron expressions.
 * Currently a placeholder — the openclawScheduledTasks table
 * does not yet exist in the schema. The scheduler starts but
 * performs no work until the table is created.
 */

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check and execute any due scheduled tasks
 */
async function checkAndExecute(): Promise<void> {
  // No-op until openclawScheduledTasks table is added to the schema
}

/**
 * Start the cron scheduler (runs every minute)
 */
export function startCronScheduler(): void {
  if (schedulerInterval) return;
  console.log("[CronScheduler] Starting OpenClaw cron scheduler (no tasks table yet — idle)");
  schedulerInterval = setInterval(checkAndExecute, 60 * 1000);
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
