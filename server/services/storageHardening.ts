/**
 * Storage Hardening Service
 * 
 * Provides:
 * - Startup validation for storage configuration
 * - Consistent storage key conventions across all upload sources
 * - File type and size validation
 * - Canonical ingestion path for all uploads
 */

import { storagePut, storageGet, isUsingLocalStorage, storageCalculateHash } from "../storage";
import * as db from "../db";
import { enqueueJob } from "./jobQueue";

// ============ STARTUP VALIDATION ============

export interface StorageHealthStatus {
  healthy: boolean;
  mode: "s3" | "local";
  errors: string[];
  warnings: string[];
  configured?: boolean;
}

let storageHealthStatus: StorageHealthStatus | null = null;

export async function validateStorageOnStartup(): Promise<StorageHealthStatus> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isLocal = isUsingLocalStorage();
  
  if (isLocal) {
    warnings.push("Running in local storage mode - files will not persist across deployments");
    
    // In production, this should be an error
    if (process.env.NODE_ENV === "production") {
      errors.push("S3 storage is required in production but not configured");
    }
  } else {
    // Test S3 connectivity
    try {
      const testKey = `_health_check_${Date.now()}.txt`;
      const testContent = Buffer.from("health check");
      await storagePut(testKey, testContent, "text/plain");
      // Note: We don't delete the test file to avoid additional complexity
    } catch (error) {
      errors.push(`S3 connectivity test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  storageHealthStatus = {
    healthy: errors.length === 0,
    mode: isLocal ? "local" : "s3",
    errors,
    warnings,
  };
  
  // Log status
  if (errors.length > 0) {
    console.error("[Storage] Health check failed:", errors);
  }
  if (warnings.length > 0) {
    console.warn("[Storage] Health check warnings:", warnings);
  }
  if (storageHealthStatus.healthy) {
    console.log(`[Storage] Health check passed (mode: ${storageHealthStatus.mode})`);
  }
  
  return storageHealthStatus;
}

export function getStorageHealth(): StorageHealthStatus {
  // Return default status if not yet initialized
  if (!storageHealthStatus) {
    return {
      healthy: false,
      mode: isUsingLocalStorage() ? "local" : "s3",
      errors: ["Storage health check not yet performed"],
      warnings: [],
      configured: !isUsingLocalStorage(),
    };
  }
  return {
    ...storageHealthStatus,
    configured: storageHealthStatus.mode === "s3",
  };
}

// ============ CANONICAL INGESTION PATH ============

export interface UploadOptions {
  source: db.FileUploadSource;
  sourceId?: string;
  userId?: number;
  organizationId?: number;
  projectId?: number;
  linkedEntityType?: string;
  linkedEntityId?: number;
  skipValidation?: boolean;
  processImmediately?: boolean;
}

export interface UploadResult {
  success: boolean;
  fileUploadId?: number;
  storageKey?: string;
  storageUrl?: string;
  jobId?: number;
  correlationId?: string;
  errors: string[];
}

/**
 * Canonical upload function - ALL uploads should go through this
 * Handles validation, storage, tracking, and job queuing
 */
export async function uploadFile(
  file: {
    filename: string;
    content: Buffer;
    mimeType: string;
  },
  options: UploadOptions
): Promise<UploadResult> {
  const errors: string[] = [];
  
  // 1. Validate file
  if (!options.skipValidation) {
    const validation = db.validateFileUpload(file.mimeType, file.content.length);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
      };
    }
  }
  
  // 2. Generate canonical storage key
  const storageKey = db.generateStorageKey(options.source, file.filename, {
    userId: options.userId,
    projectId: options.projectId,
    organizationId: options.organizationId,
  });
  
  // 3. Upload to storage
  let storageUrl: string;
  try {
    const result = await storagePut(storageKey, file.content, file.mimeType);
    storageUrl = result.url;
  } catch (error) {
    return {
      success: false,
      errors: [`Storage upload failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
  
  // 4. Create file upload record
  const uploadResult = await db.createFileUpload({
    source: options.source,
    sourceId: options.sourceId,
    originalFilename: file.filename,
    mimeType: file.mimeType,
    fileSize: file.content.length,
    storageKey,
    storageUrl,
    userId: options.userId,
    organizationId: options.organizationId,
    projectId: options.projectId,
  });
  
  if (!uploadResult.id) {
    return {
      success: false,
      errors: ["Failed to create file upload record"],
    };
  }
  
  // 5. Link to entity if specified
  if (options.linkedEntityType && options.linkedEntityId) {
    await db.updateFileUploadStatus(uploadResult.id, "uploaded", {
      linkedEntityType: options.linkedEntityType,
      linkedEntityId: options.linkedEntityId,
    });
  }
  
  // 6. Enqueue processing job if needed
  let jobId: number | null = null;
  let correlationId: string | undefined;
  
  if (options.processImmediately !== false) {
    const jobResult = await enqueueJob("document_ingestion", {
      fileUploadId: uploadResult.id,
      storageKey,
      storageUrl,
      mimeType: file.mimeType,
      filename: file.filename,
      linkedEntityType: options.linkedEntityType,
      linkedEntityId: options.linkedEntityId,
    }, {
      userId: options.userId,
      organizationId: options.organizationId,
      priority: "normal",
    });
    
    jobId = jobResult.jobId;
    correlationId = jobResult.correlationId;
  }
  
  return {
    success: true,
    fileUploadId: uploadResult.id,
    storageKey,
    storageUrl,
    jobId: jobId || undefined,
    correlationId,
    errors: uploadResult.errors,
  };
}

/**
 * Upload from WhatsApp message attachment
 */
export async function uploadFromWhatsApp(
  file: {
    filename: string;
    content: Buffer;
    mimeType: string;
  },
  messageId: string,
  options?: {
    userId?: number;
    organizationId?: number;
    projectId?: number;
  }
): Promise<UploadResult> {
  return uploadFile(file, {
    source: "whatsapp",
    sourceId: messageId,
    ...options,
  });
}

/**
 * Upload from email attachment
 */
export async function uploadFromEmail(
  file: {
    filename: string;
    content: Buffer;
    mimeType: string;
  },
  emailId: string,
  options?: {
    userId?: number;
    organizationId?: number;
    projectId?: number;
  }
): Promise<UploadResult> {
  return uploadFile(file, {
    source: "email",
    sourceId: emailId,
    ...options,
  });
}

/**
 * Upload from web UI
 */
export async function uploadFromWeb(
  file: {
    filename: string;
    content: Buffer;
    mimeType: string;
  },
  options?: {
    userId?: number;
    organizationId?: number;
    projectId?: number;
    linkedEntityType?: string;
    linkedEntityId?: number;
  }
): Promise<UploadResult> {
  return uploadFile(file, {
    source: "web",
    ...options,
  });
}

/**
 * Upload from API
 */
export async function uploadFromApi(
  file: {
    filename: string;
    content: Buffer;
    mimeType: string;
  },
  apiKeyId: string,
  options?: {
    userId?: number;
    organizationId?: number;
    projectId?: number;
  }
): Promise<UploadResult> {
  return uploadFile(file, {
    source: "api",
    sourceId: apiKeyId,
    ...options,
  });
}

// ============ FILE TYPE HELPERS ============

export function isDocumentType(mimeType: string): boolean {
  return [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ].includes(mimeType);
}

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function isAudioType(mimeType: string): boolean {
  return mimeType.startsWith("audio/");
}

export function isVideoType(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

export function getFileCategory(mimeType: string): "document" | "image" | "audio" | "video" | "other" {
  if (isDocumentType(mimeType)) return "document";
  if (isImageType(mimeType)) return "image";
  if (isAudioType(mimeType)) return "audio";
  if (isVideoType(mimeType)) return "video";
  return "other";
}

// ============ CONTENT HASH FOR DEDUPLICATION ============

export function calculateContentHash(content: Buffer): string {
  return storageCalculateHash(content);
}

export async function findDuplicateUpload(contentHash: string): Promise<number | null> {
  // TODO: Add content hash column to fileUploads and implement lookup
  return null;
}
