/**
 * Canonical Job Status Contract
 * 
 * This defines the unified job status interface used across:
 * - Web upload jobs
 * - WhatsApp/email ingestion jobs
 * - AI extraction jobs
 * - Any other background processing jobs
 */

// Job types enum - all supported job types
export const JOB_TYPES = {
  // Document processing
  DOCUMENT_INGESTION: "document_ingestion",
  AI_EXTRACTION: "ai_extraction",
  DOCUMENT_CATEGORIZATION: "document_categorization",
  
  // File processing
  FILE_PROCESSING: "file_processing",
  FILE_CONVERSION: "file_conversion",
  
  // Communication
  EMAIL_SEND: "email_send",
  NOTIFICATION_SEND: "notification_send",
  WEBHOOK_DELIVERY: "webhook_delivery",
  
  // WhatsApp/Email ingestion
  WHATSAPP_INGESTION: "whatsapp_ingestion",
  EMAIL_INGESTION: "email_ingestion",
  
  // Reports and exports
  REPORT_GENERATION: "report_generation",
  DATA_EXPORT: "data_export",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

// Job status enum
export const JOB_STATUS = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// Job priority enum
export const JOB_PRIORITY = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type JobPriority = (typeof JOB_PRIORITY)[keyof typeof JOB_PRIORITY];

/**
 * Canonical Job Status Response
 * 
 * This is the unified response format returned by all job status endpoints.
 * UI components should use this interface for consistent rendering.
 */
export interface JobStatusResponse {
  // Core identifiers
  id: number;
  correlationId: string;
  type: JobType;
  
  // Status
  status: JobStatus;
  priority: JobPriority;
  
  // Progress (optional, 0-100)
  progress?: number;
  progressMessage?: string;
  
  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  updatedAt: Date;
  
  // Retry info
  attempts: number;
  maxAttempts: number;
  isRetryable: boolean;
  nextRetryAt?: Date;
  
  // Result/Error
  result?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, unknown>;
  
  // Context
  userId?: number;
  entityType?: string;
  entityId?: number;
  
  // Linked entity (for document uploads, etc.)
  linkedEntityType?: string;
  linkedEntityId?: number;
  
  // Parent job (for retries)
  parentJobId?: number;
  
  // Human-readable info
  displayName: string;
  displayStatus: string;
  userFriendlyError?: string;
}

/**
 * Job creation options
 */
export interface CreateJobOptions {
  priority?: JobPriority;
  maxAttempts?: number;
  scheduledFor?: Date;
  userId?: number;
  entityType?: string;
  entityId?: number;
  parentJobId?: number;
  correlationId?: string;
}

/**
 * Job payload types for each job type
 */
export interface DocumentIngestionPayload {
  fileUploadId: number;
  filename: string;
  mimeType: string;
  storageKey: string;
  projectId?: number;
  linkedEntityType?: string;
  linkedEntityId?: number;
}

export interface AIExtractionPayload {
  documentId: number;
  extractionType: "metadata" | "content" | "entities" | "full";
  options?: Record<string, unknown>;
}

export interface DocumentCategorizationPayload {
  documentId: number;
  suggestedCategory?: string;
}

export interface EmailSendPayload {
  to: string;
  subject: string;
  templateId: string;
  templateData: Record<string, unknown>;
  correlationId?: string;
}

export interface WhatsAppIngestionPayload {
  messageId: string;
  mediaUrl: string;
  mimeType: string;
  filename?: string;
  sessionId: number;
}

export interface EmailIngestionPayload {
  emailId: string;
  attachmentIndex: number;
  filename: string;
  mimeType: string;
  storageKey: string;
}

export type JobPayload =
  | DocumentIngestionPayload
  | AIExtractionPayload
  | DocumentCategorizationPayload
  | EmailSendPayload
  | WhatsAppIngestionPayload
  | EmailIngestionPayload
  | Record<string, unknown>;

/**
 * Helper functions for job status display
 */
export function getJobDisplayName(type: JobType): string {
  const displayNames: Record<JobType, string> = {
    document_ingestion: "Document Upload",
    ai_extraction: "AI Analysis",
    document_categorization: "Document Categorization",
    file_processing: "File Processing",
    file_conversion: "File Conversion",
    email_send: "Email Delivery",
    notification_send: "Notification",
    webhook_delivery: "Webhook Delivery",
    whatsapp_ingestion: "WhatsApp Attachment",
    email_ingestion: "Email Attachment",
    report_generation: "Report Generation",
    data_export: "Data Export",
  };
  return displayNames[type] || type;
}

export function getJobDisplayStatus(status: JobStatus): string {
  const displayStatuses: Record<JobStatus, string> = {
    queued: "Waiting in queue",
    processing: "Processing...",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return displayStatuses[status] || status;
}

export function isJobRetryable(job: { status: JobStatus; attempts: number; maxAttempts: number }): boolean {
  return job.status === "failed" && job.attempts < job.maxAttempts;
}

export function getJobProgressPercent(job: { status: JobStatus; progress?: number }): number {
  if (job.status === "completed") return 100;
  if (job.status === "queued") return 0;
  if (job.status === "failed" || job.status === "cancelled") return 0;
  return job.progress ?? 50; // Default to 50% if processing but no progress
}

/**
 * Job status colors for UI
 */
export function getJobStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    queued: "text-muted-foreground",
    processing: "text-blue-500",
    completed: "text-green-500",
    failed: "text-red-500",
    cancelled: "text-gray-500",
  };
  return colors[status] || "text-muted-foreground";
}

export function getJobStatusBgColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    queued: "bg-muted",
    processing: "bg-blue-500/10",
    completed: "bg-green-500/10",
    failed: "bg-red-500/10",
    cancelled: "bg-gray-500/10",
  };
  return colors[status] || "bg-muted";
}

/**
 * Labels for UI display
 */
export const JOB_TYPE_LABELS: Record<string, string> = {
  document_ingestion: "Document Upload",
  ai_extraction: "AI Analysis",
  document_categorization: "Document Categorization",
  file_processing: "File Processing",
  file_conversion: "File Conversion",
  email_send: "Email Delivery",
  notification_send: "Notification",
  webhook_delivery: "Webhook Delivery",
  whatsapp_ingestion: "WhatsApp Attachment",
  email_ingestion: "Email Attachment",
  report_generation: "Report Generation",
  data_export: "Data Export",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};
