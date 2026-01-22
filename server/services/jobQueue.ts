/**
 * Background Job Queue Service
 * 
 * Provides non-blocking job processing for:
 * - Document ingestion and AI extraction
 * - Email sending
 * - Notification delivery
 * - Report generation
 * - Data exports
 * - Webhook delivery
 * 
 * Key features:
 * - Fast 200 pattern: Return immediately, process in background
 * - Retry with exponential backoff
 * - Job correlation for tracing
 * - Priority queuing
 */

import * as db from "../db";

// Job processor function type
type JobProcessor = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

// Registry of job processors
const processors: Map<db.JobType, JobProcessor> = new Map();

// Register a job processor
export function registerProcessor(type: db.JobType, processor: JobProcessor) {
  processors.set(type, processor);
}

// Enqueue a job with "Fast 200" pattern
export async function enqueueJob(
  type: db.JobType,
  payload: Record<string, unknown>,
  options?: {
    priority?: db.JobPriority;
    userId?: number;
    organizationId?: number;
    correlationId?: string;
    scheduledFor?: Date;
  }
): Promise<{ jobId: number | null; correlationId: string }> {
  const fallbackCorrelationId = options?.correlationId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const jobResult = await db.createJob(type, payload, {
    ...options,
    correlationId: fallbackCorrelationId,
  });
  
  const jobId = jobResult?.id || null;
  const correlationId = jobResult?.correlationId || fallbackCorrelationId;
  
  // Trigger async processing (don't await)
  if (jobId) {
    setImmediate(() => processNextJob());
  }
  
  return { jobId, correlationId };
}

// Get job status for polling
export async function getJobStatus(jobId: number) {
  const job = await db.getJob(jobId);
  if (!job) return null;
  
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: calculateProgress(job),
    result: job.result,
    error: job.error,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  };
}

// Get job status by correlation ID
export async function getJobStatusByCorrelationId(correlationId: string) {
  const job = await db.getJobByCorrelationId(correlationId);
  if (!job) return null;
  
  return getJobStatus(job.id);
}

// Calculate progress percentage
function calculateProgress(job: db.Job): number {
  switch (job.status) {
    case "queued":
      return 0;
    case "processing":
      return 50; // Could be more granular with job-specific progress
    case "completed":
      return 100;
    case "failed":
    case "cancelled":
      return -1;
    default:
      return 0;
  }
}

// Process the next available job
async function processNextJob() {
  try {
    // Get highest priority queued job
    const queuedJobs = await db.getQueuedJobs({ limit: 1 });
    if (queuedJobs.length === 0) return;
    
    const job = queuedJobs[0];
    const processor = processors.get(job.type as db.JobType);
    
    if (!processor) {
      await db.failJob(job.id, `No processor registered for job type: ${job.type}`);
      return;
    }
    
    // Start the job
    await db.startJob(job.id);
    await db.logJobMessage(job.id, "info", `Starting job processing`, { type: job.type });
    
    try {
      // Execute the processor
      const result = await processor(job.payload as Record<string, unknown>);
      
      // Mark as completed
      await db.completeJob(job.id, result);
      await db.logJobMessage(job.id, "info", `Job completed successfully`, { result });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await db.logJobMessage(job.id, "error", `Job failed: ${errorMessage}`);
      
      // Fail the job (will retry if attempts < maxAttempts)
      const willRetry = await db.failJob(job.id, errorMessage);
      
      if (willRetry) {
        await db.logJobMessage(job.id, "info", `Job will be retried (attempt ${job.attempts + 1}/${job.maxAttempts})`);
        // Schedule retry with exponential backoff
        const backoffMs = Math.pow(2, job.attempts) * 1000; // 1s, 2s, 4s, 8s...
        setTimeout(() => processNextJob(), backoffMs);
      }
    }
    
    // Process next job if available
    setImmediate(() => processNextJob());
    
  } catch (error) {
    console.error("[JobQueue] Error processing job:", error);
  }
}

// Start the job worker (call on server startup)
let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(intervalMs: number = 5000) {
  if (workerInterval) return;
  
  console.log("[JobQueue] Starting worker with interval:", intervalMs, "ms");
  
  // Process immediately
  processNextJob();
  
  // Then poll at interval
  workerInterval = setInterval(() => processNextJob(), intervalMs);
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[JobQueue] Worker stopped");
  }
}

// ============ DEFAULT JOB PROCESSORS ============

// Document ingestion processor
registerProcessor("document_ingestion", async (payload) => {
  const { fileUploadId, documentId, extractionOptions } = payload as {
    fileUploadId: number;
    documentId?: number;
    extractionOptions?: Record<string, unknown>;
  };
  
  // Update file status
  await db.updateFileUploadStatus(fileUploadId, "processing");
  
  // TODO: Actual document processing logic
  // - Parse document content
  // - Extract text
  // - Generate preview
  // - Run AI extraction if enabled
  
  await db.updateFileUploadStatus(fileUploadId, "processed", {
    linkedEntityType: "document",
    linkedEntityId: documentId,
  });
  
  return { processed: true, fileUploadId, documentId };
});

// AI extraction processor
registerProcessor("ai_extraction", async (payload) => {
  const { documentId, extractionType, fields } = payload as {
    documentId: number;
    extractionType: string;
    fields?: string[];
  };
  
  // TODO: Call AI extraction service
  // - Load document content
  // - Run LLM extraction
  // - Store results
  
  return { extracted: true, documentId, extractionType };
});

// Email send processor
registerProcessor("email_send", async (payload) => {
  const { to, subject, body, templateId } = payload as {
    to: string;
    subject: string;
    body: string;
    templateId?: string;
  };
  
  // TODO: Integrate with email service
  console.log(`[Email] Would send email to ${to}: ${subject}`);
  
  return { sent: true, to, subject };
});

// Notification send processor
registerProcessor("notification_send", async (payload) => {
  const { userId, type, title, message, data } = payload as {
    userId: number;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  };
  
  // TODO: Create notification in database
  console.log(`[Notification] Would notify user ${userId}: ${title}`);
  
  return { notified: true, userId, type };
});

// Report generation processor
registerProcessor("report_generation", async (payload) => {
  const { reportType, parameters, outputFormat } = payload as {
    reportType: string;
    parameters: Record<string, unknown>;
    outputFormat: string;
  };
  
  // TODO: Generate report
  console.log(`[Report] Would generate ${reportType} report`);
  
  return { generated: true, reportType, outputFormat };
});

// Data export processor
registerProcessor("data_export", async (payload) => {
  const { exportType, entityType, filters, format } = payload as {
    exportType: string;
    entityType: string;
    filters?: Record<string, unknown>;
    format: string;
  };
  
  // TODO: Generate export file
  console.log(`[Export] Would export ${entityType} data as ${format}`);
  
  return { exported: true, entityType, format };
});

// File processing processor
registerProcessor("file_processing", async (payload) => {
  const { fileUploadId, processingType } = payload as {
    fileUploadId: number;
    processingType: string;
  };
  
  // TODO: Process file (thumbnail, preview, etc.)
  console.log(`[FileProcessing] Would process file ${fileUploadId}: ${processingType}`);
  
  return { processed: true, fileUploadId, processingType };
});

// Webhook delivery processor
registerProcessor("webhook_delivery", async (payload) => {
  const { url, method, headers, body, retryCount } = payload as {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    retryCount?: number;
  };
  
  // TODO: Make HTTP request to webhook URL
  console.log(`[Webhook] Would deliver to ${url}`);
  
  return { delivered: true, url, method };
});
