/**
 * Consistent Error Handling Utilities
 * 
 * Provides:
 * - Standardized error types and codes
 * - User-friendly error messages
 * - Error logging with correlation IDs
 * - Retry-able error detection
 */

// Standard error codes
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UPLOAD_FAILED"
  | "PROCESSING_FAILED"
  | "AI_EXTRACTION_FAILED"
  | "STORAGE_ERROR"
  | "DATABASE_ERROR"
  | "NETWORK_ERROR"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UNKNOWN_ERROR";

// Error severity levels
export type ErrorSeverity = "info" | "warning" | "error" | "critical";

// Structured error interface
export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  correlationId?: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// Create a standardized error
export function createAppError(
  code: ErrorCode,
  message: string,
  options?: {
    userMessage?: string;
    severity?: ErrorSeverity;
    retryable?: boolean;
    correlationId?: string;
    details?: Record<string, unknown>;
  }
): AppError {
  return {
    code,
    message,
    userMessage: options?.userMessage || getUserFriendlyMessage(code, message),
    severity: options?.severity || getSeverityForCode(code),
    retryable: options?.retryable ?? isRetryable(code),
    correlationId: options?.correlationId,
    details: options?.details,
    timestamp: Date.now(),
  };
}

// Get user-friendly message for error code
function getUserFriendlyMessage(code: ErrorCode, technicalMessage: string): string {
  const messages: Record<ErrorCode, string> = {
    VALIDATION_ERROR: "The provided data is invalid. Please check your input and try again.",
    UPLOAD_FAILED: "Failed to upload the file. Please try again.",
    PROCESSING_FAILED: "Failed to process your request. Our team has been notified.",
    AI_EXTRACTION_FAILED: "AI analysis could not be completed. The document has been saved and will be processed later.",
    STORAGE_ERROR: "Failed to save the file. Please try again.",
    DATABASE_ERROR: "A database error occurred. Please try again later.",
    NETWORK_ERROR: "Network connection issue. Please check your connection and try again.",
    PERMISSION_DENIED: "You don't have permission to perform this action.",
    NOT_FOUND: "The requested item could not be found.",
    RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
    TIMEOUT: "The operation timed out. Please try again.",
    UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
  };
  
  return messages[code] || technicalMessage;
}

// Get default severity for error code
function getSeverityForCode(code: ErrorCode): ErrorSeverity {
  const severities: Record<ErrorCode, ErrorSeverity> = {
    VALIDATION_ERROR: "warning",
    UPLOAD_FAILED: "error",
    PROCESSING_FAILED: "error",
    AI_EXTRACTION_FAILED: "warning",
    STORAGE_ERROR: "error",
    DATABASE_ERROR: "critical",
    NETWORK_ERROR: "warning",
    PERMISSION_DENIED: "warning",
    NOT_FOUND: "info",
    RATE_LIMITED: "warning",
    TIMEOUT: "warning",
    UNKNOWN_ERROR: "error",
  };
  
  return severities[code] || "error";
}

// Check if error is retryable
function isRetryable(code: ErrorCode): boolean {
  const retryableCodes: ErrorCode[] = [
    "UPLOAD_FAILED",
    "STORAGE_ERROR",
    "NETWORK_ERROR",
    "RATE_LIMITED",
    "TIMEOUT",
  ];
  
  return retryableCodes.includes(code);
}

// Convert unknown error to AppError
export function normalizeError(error: unknown, correlationId?: string): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    // Detect specific error types
    const message = error.message.toLowerCase();
    
    if (message.includes("timeout")) {
      return createAppError("TIMEOUT", error.message, { correlationId });
    }
    if (message.includes("network") || message.includes("fetch")) {
      return createAppError("NETWORK_ERROR", error.message, { correlationId });
    }
    if (message.includes("permission") || message.includes("forbidden")) {
      return createAppError("PERMISSION_DENIED", error.message, { correlationId });
    }
    if (message.includes("not found") || message.includes("404")) {
      return createAppError("NOT_FOUND", error.message, { correlationId });
    }
    
    return createAppError("UNKNOWN_ERROR", error.message, { correlationId });
  }
  
  return createAppError("UNKNOWN_ERROR", String(error), { correlationId });
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    "userMessage" in error
  );
}

// Format error for logging
export function formatErrorForLog(error: AppError): string {
  const parts = [
    `[${error.severity.toUpperCase()}]`,
    `[${error.code}]`,
    error.correlationId ? `[${error.correlationId}]` : "",
    error.message,
  ].filter(Boolean);
  
  return parts.join(" ");
}

// Format error for API response
export function formatErrorForResponse(error: AppError): {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    correlationId?: string;
  };
} {
  return {
    error: {
      code: error.code,
      message: error.userMessage,
      retryable: error.retryable,
      correlationId: error.correlationId,
    },
  };
}

// Generate correlation ID
export function generateCorrelationId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
