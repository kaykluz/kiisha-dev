/**
 * Cron Scheduler Service
 * 
 * Manages scheduled background tasks for billing automation:
 * - processRecurringInvoices: Daily at midnight
 * - processPaymentReminders: Daily at 9am
 * 
 * WHO USES THIS:
 * - System: Automatically executes scheduled tasks
 * - Admin: Can view job status and trigger manual runs
 * - Located at: Admin Dashboard → Settings → Scheduled Jobs
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { processRecurringInvoices } from './recurringInvoices';
import { processPaymentReminders } from './paymentReminders';
import { processExpiryNotifications, NOTIFICATION_INTERVALS } from './expiryNotifications';

// Job definitions
export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  handler: () => Promise<any>;
  isEnabled: boolean;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'error';
  lastRunResult?: string;
  nextRunAt?: Date;
}

// In-memory job registry
const jobs: Map<string, ScheduledJob> = new Map();

// Job execution history (in-memory, limited to last 100 entries)
const jobHistory: Array<{
  jobId: string;
  startedAt: Date;
  completedAt: Date;
  status: 'success' | 'error';
  result: string;
}> = [];

// Active timers
const activeTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Register a scheduled job
 */
export function registerJob(job: Omit<ScheduledJob, 'lastRunAt' | 'lastRunStatus' | 'lastRunResult' | 'nextRunAt'>): void {
  const nextRunAt = calculateNextRun(job.cronExpression);
  jobs.set(job.id, {
    ...job,
    nextRunAt,
  });
  console.log(`[CronScheduler] Registered job: ${job.name} (${job.cronExpression})`);
}

/**
 * Calculate next run time from cron expression
 * Simplified parser for common patterns
 */
function calculateNextRun(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.split(' ');
  
  // Parse cron: minute hour day month dayOfWeek
  const [minute, hour] = parts;
  
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  if (minute !== '*') {
    next.setMinutes(parseInt(minute));
  }
  if (hour !== '*') {
    next.setHours(parseInt(hour));
  }
  
  // If the calculated time is in the past, move to next day
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Execute a job
 */
async function executeJob(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job || !job.isEnabled) return;

  console.log(`[CronScheduler] Starting job: ${job.name}`);
  const startedAt = new Date();
  
  try {
    const result = await job.handler();
    const completedAt = new Date();
    
    // Update job status
    job.lastRunAt = startedAt;
    job.lastRunStatus = 'success';
    job.lastRunResult = JSON.stringify(result);
    job.nextRunAt = calculateNextRun(job.cronExpression);
    
    // Add to history
    jobHistory.unshift({
      jobId,
      startedAt,
      completedAt,
      status: 'success',
      result: JSON.stringify(result),
    });
    
    // Persist to database
    await saveJobExecution(jobId, startedAt, completedAt, 'success', JSON.stringify(result));
    
    console.log(`[CronScheduler] Job completed: ${job.name}`, result);
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update job status
    job.lastRunAt = startedAt;
    job.lastRunStatus = 'error';
    job.lastRunResult = errorMessage;
    job.nextRunAt = calculateNextRun(job.cronExpression);
    
    // Add to history
    jobHistory.unshift({
      jobId,
      startedAt,
      completedAt,
      status: 'error',
      result: errorMessage,
    });
    
    // Persist to database
    await saveJobExecution(jobId, startedAt, completedAt, 'error', errorMessage);
    
    console.error(`[CronScheduler] Job failed: ${job.name}`, error);
  }
  
  // Trim history to last 100 entries
  while (jobHistory.length > 100) {
    jobHistory.pop();
  }
  
  // Schedule next run
  scheduleNextRun(jobId);
}

/**
 * Schedule the next run of a job
 */
function scheduleNextRun(jobId: string): void {
  const job = jobs.get(jobId);
  if (!job || !job.isEnabled || !job.nextRunAt) return;

  // Clear existing timer
  const existingTimer = activeTimers.get(jobId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const delay = job.nextRunAt.getTime() - Date.now();
  if (delay > 0) {
    const timer = setTimeout(() => executeJob(jobId), delay);
    activeTimers.set(jobId, timer);
    console.log(`[CronScheduler] Scheduled ${job.name} for ${job.nextRunAt.toISOString()}`);
  }
}

/**
 * Save job execution to database
 */
async function saveJobExecution(
  jobId: string,
  startedAt: Date,
  completedAt: Date,
  status: string,
  result: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    await db.execute(sql`
      INSERT INTO scheduled_job_executions (
        jobId, startedAt, completedAt, status, result
      ) VALUES (
        ${jobId},
        ${startedAt.toISOString()},
        ${completedAt.toISOString()},
        ${status},
        ${result.substring(0, 4000)}
      )
    `);
  } catch (error) {
    console.error('[CronScheduler] Failed to save job execution:', error);
  }
}

/**
 * Initialize the scheduler with default jobs
 */
export function initializeScheduler(): void {
  console.log('[CronScheduler] Initializing scheduler...');

  // Register recurring invoices job - runs daily at midnight
  registerJob({
    id: 'recurring-invoices',
    name: 'Process Recurring Invoices',
    description: 'Generate invoices for all active recurring schedules that are due',
    cronExpression: '0 0 * * *', // Every day at midnight
    handler: processRecurringInvoices,
    isEnabled: true,
  });

  // Register payment reminders job - runs daily at 9am
  registerJob({
    id: 'payment-reminders',
    name: 'Send Payment Reminders',
    description: 'Send reminder emails for overdue invoices based on configured intervals',
    cronExpression: '0 9 * * *', // Every day at 9am
    handler: processPaymentReminders,
    isEnabled: true,
  });

  // Register expiry notifications job - runs daily at 8am
  registerJob({
    id: 'expiry-notifications',
    name: 'Send Expiry Notifications',
    description: 'Send email notifications for documents expiring at configured intervals (30, 14, 7, 3, 1, 0 days)',
    cronExpression: '0 8 * * *', // Every day at 8am
    handler: async () => {
      // Process for all organizations (in production, iterate through orgs)
      const baseUrl = process.env.VITE_APP_URL || 'http://localhost:3000';
      return processExpiryNotifications(1, {
        organizationId: 1,
        enabledIntervals: [...NOTIFICATION_INTERVALS],
        notifyOwner: true,
        notifyAssignee: true,
        notifyAdmins: true,
      }, baseUrl);
    },
    isEnabled: true,
  });

  // Start all enabled jobs
  for (const [jobId, job] of jobs) {
    if (job.isEnabled) {
      scheduleNextRun(jobId);
    }
  }

  console.log('[CronScheduler] Scheduler initialized with', jobs.size, 'jobs');
}

/**
 * Get all registered jobs
 */
export function getJobs(): ScheduledJob[] {
  return Array.from(jobs.values());
}

/**
 * Get job by ID
 */
export function getJob(jobId: string): ScheduledJob | undefined {
  return jobs.get(jobId);
}

/**
 * Get job execution history
 */
export function getJobHistory(jobId?: string, limit: number = 50): typeof jobHistory {
  let history = jobHistory;
  if (jobId) {
    history = history.filter(h => h.jobId === jobId);
  }
  return history.slice(0, limit);
}

/**
 * Get job execution history from database
 */
export async function getJobHistoryFromDb(params: {
  jobId?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  let query = sql`SELECT * FROM scheduled_job_executions WHERE 1=1`;
  
  if (params.jobId) {
    query = sql`${query} AND jobId = ${params.jobId}`;
  }
  
  query = sql`${query} ORDER BY startedAt DESC LIMIT ${params.limit || 50} OFFSET ${params.offset || 0}`;

  const [results] = await db.execute(query);
  return results as any[];
}

/**
 * Manually trigger a job
 */
export async function triggerJob(jobId: string): Promise<any> {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  console.log(`[CronScheduler] Manually triggering job: ${job.name}`);
  const startedAt = new Date();
  
  try {
    const result = await job.handler();
    const completedAt = new Date();
    
    // Update job status
    job.lastRunAt = startedAt;
    job.lastRunStatus = 'success';
    job.lastRunResult = JSON.stringify(result);
    
    // Add to history
    jobHistory.unshift({
      jobId,
      startedAt,
      completedAt,
      status: 'success',
      result: JSON.stringify(result),
    });
    
    // Persist to database
    await saveJobExecution(jobId, startedAt, completedAt, 'success', JSON.stringify(result));
    
    return result;
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update job status
    job.lastRunAt = startedAt;
    job.lastRunStatus = 'error';
    job.lastRunResult = errorMessage;
    
    // Add to history
    jobHistory.unshift({
      jobId,
      startedAt,
      completedAt,
      status: 'error',
      result: errorMessage,
    });
    
    // Persist to database
    await saveJobExecution(jobId, startedAt, completedAt, 'error', errorMessage);
    
    throw error;
  }
}

/**
 * Enable or disable a job
 */
export function setJobEnabled(jobId: string, enabled: boolean): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  job.isEnabled = enabled;
  
  if (enabled) {
    job.nextRunAt = calculateNextRun(job.cronExpression);
    scheduleNextRun(jobId);
    console.log(`[CronScheduler] Enabled job: ${job.name}`);
  } else {
    const timer = activeTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(jobId);
    }
    console.log(`[CronScheduler] Disabled job: ${job.name}`);
  }
}

/**
 * Update job cron expression
 */
export function updateJobSchedule(jobId: string, cronExpression: string): void {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  job.cronExpression = cronExpression;
  job.nextRunAt = calculateNextRun(cronExpression);
  
  if (job.isEnabled) {
    scheduleNextRun(jobId);
  }
  
  console.log(`[CronScheduler] Updated schedule for ${job.name}: ${cronExpression}`);
}

/**
 * Shutdown the scheduler
 */
export function shutdownScheduler(): void {
  console.log('[CronScheduler] Shutting down scheduler...');
  
  for (const [jobId, timer] of activeTimers) {
    clearTimeout(timer);
    console.log(`[CronScheduler] Cancelled timer for job: ${jobId}`);
  }
  
  activeTimers.clear();
  console.log('[CronScheduler] Scheduler shutdown complete');
}
