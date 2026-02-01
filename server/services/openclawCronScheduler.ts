/**
 * OpenClaw Cron Scheduler Service
 *
 * No-op placeholder until openclawScheduledTasks table is added to the schema.
 */

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

async function checkAndExecute(): Promise<void> {
  // No-op until openclawScheduledTasks table is added to the schema
}

export function startCronScheduler(): void {
  if (schedulerInterval) return;
  console.log("[CronScheduler] Starting OpenClaw cron scheduler (no-op mode)");
  schedulerInterval = setInterval(checkAndExecute, 60 * 1000);
}

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
