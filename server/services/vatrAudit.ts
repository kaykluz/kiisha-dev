/**
 * VATR Audit Service
 * Version, Audit, Track, Retain - Full audit trail for all data changes
 * 
 * This service ensures:
 * 1. All changes are logged with before/after values
 * 2. Manual overrides are explicitly tracked
 * 3. AI extractions vs manual entries are distinguished
 * 4. Full audit trail is maintained for compliance
 */

import { db } from "../db";
import { vatrAuditLog, vatrAssets } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export type VatrAction = 
  | "created" 
  | "updated" 
  | "viewed" 
  | "exported" 
  | "verified" 
  | "manual_override" 
  | "ai_extracted" 
  | "bulk_import"
  | "deleted"
  | "restored";

export type SourceType = 
  | "ai_extraction" 
  | "manual_entry" 
  | "bulk_import" 
  | "api" 
  | "system";

export interface VatrAuditEntry {
  vatrAssetId: number;
  action: VatrAction;
  actorId: number;
  actorRole?: string;
  beforeHash?: string;
  afterHash?: string;
  changesJson?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  isManualOverride?: boolean;
  overrideReason?: string;
  originalValue?: unknown;
  newValue?: unknown;
  sourceType?: SourceType;
}

/**
 * Generate a hash of the data for integrity verification
 */
export function generateDataHash(data: unknown): string {
  const jsonStr = JSON.stringify(data, Object.keys(data as object).sort());
  return crypto.createHash("sha256").update(jsonStr).digest("hex");
}

/**
 * Log a VATR audit entry
 */
export async function logVatrAudit(entry: VatrAuditEntry): Promise<number> {
  const result = await db.insert(vatrAuditLog).values({
    vatrAssetId: entry.vatrAssetId,
    action: entry.action,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    beforeHash: entry.beforeHash,
    afterHash: entry.afterHash,
    changesJson: entry.changesJson,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    isManualOverride: entry.isManualOverride ?? false,
    overrideReason: entry.overrideReason,
    originalValue: entry.originalValue,
    newValue: entry.newValue,
    sourceType: entry.sourceType ?? "manual_entry",
  });
  
  return result.insertId;
}

/**
 * Log a manual override with full tracking
 */
export async function logManualOverride(params: {
  vatrAssetId: number;
  actorId: number;
  actorRole?: string;
  fieldName: string;
  originalValue: unknown;
  newValue: unknown;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<number> {
  const beforeHash = generateDataHash({ [params.fieldName]: params.originalValue });
  const afterHash = generateDataHash({ [params.fieldName]: params.newValue });
  
  return logVatrAudit({
    vatrAssetId: params.vatrAssetId,
    action: "manual_override",
    actorId: params.actorId,
    actorRole: params.actorRole,
    beforeHash,
    afterHash,
    changesJson: {
      field: params.fieldName,
      before: params.originalValue,
      after: params.newValue,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    isManualOverride: true,
    overrideReason: params.reason,
    originalValue: params.originalValue,
    newValue: params.newValue,
    sourceType: "manual_entry",
  });
}

/**
 * Log an AI extraction event
 */
export async function logAiExtraction(params: {
  vatrAssetId: number;
  actorId: number;
  extractedData: Record<string, unknown>;
  sourceDocumentId?: number;
  confidence?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<number> {
  const afterHash = generateDataHash(params.extractedData);
  
  return logVatrAudit({
    vatrAssetId: params.vatrAssetId,
    action: "ai_extracted",
    actorId: params.actorId,
    afterHash,
    changesJson: {
      extractedFields: Object.keys(params.extractedData),
      sourceDocumentId: params.sourceDocumentId,
      confidence: params.confidence,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    isManualOverride: false,
    newValue: params.extractedData,
    sourceType: "ai_extraction",
  });
}

/**
 * Log a bulk import event
 */
export async function logBulkImport(params: {
  vatrAssetId: number;
  actorId: number;
  importedData: Record<string, unknown>;
  sourceFileName?: string;
  rowNumber?: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<number> {
  const afterHash = generateDataHash(params.importedData);
  
  return logVatrAudit({
    vatrAssetId: params.vatrAssetId,
    action: "bulk_import",
    actorId: params.actorId,
    afterHash,
    changesJson: {
      importedFields: Object.keys(params.importedData),
      sourceFileName: params.sourceFileName,
      rowNumber: params.rowNumber,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    isManualOverride: false,
    newValue: params.importedData,
    sourceType: "bulk_import",
  });
}

/**
 * Get the full audit trail for a VATR asset
 */
export async function getAuditTrail(vatrAssetId: number) {
  return db
    .select()
    .from(vatrAuditLog)
    .where(eq(vatrAuditLog.vatrAssetId, vatrAssetId))
    .orderBy(desc(vatrAuditLog.actionTimestamp));
}

/**
 * Get all manual overrides for a VATR asset
 */
export async function getManualOverrides(vatrAssetId: number) {
  return db
    .select()
    .from(vatrAuditLog)
    .where(
      and(
        eq(vatrAuditLog.vatrAssetId, vatrAssetId),
        eq(vatrAuditLog.isManualOverride, true)
      )
    )
    .orderBy(desc(vatrAuditLog.actionTimestamp));
}

/**
 * Verify data integrity by comparing current hash with audit trail
 */
export async function verifyDataIntegrity(
  vatrAssetId: number,
  currentData: unknown
): Promise<{ isValid: boolean; lastHash?: string; currentHash: string }> {
  const currentHash = generateDataHash(currentData);
  
  // Get the most recent audit entry with an afterHash
  const [lastAudit] = await db
    .select()
    .from(vatrAuditLog)
    .where(eq(vatrAuditLog.vatrAssetId, vatrAssetId))
    .orderBy(desc(vatrAuditLog.actionTimestamp))
    .limit(1);
  
  if (!lastAudit?.afterHash) {
    return { isValid: true, currentHash };
  }
  
  return {
    isValid: lastAudit.afterHash === currentHash,
    lastHash: lastAudit.afterHash,
    currentHash,
  };
}

/**
 * Create a wrapper for tracking changes to any entity
 */
export function createVatrTracker<T extends Record<string, unknown>>(
  vatrAssetId: number,
  actorId: number,
  actorRole?: string
) {
  let originalData: T | null = null;
  
  return {
    /**
     * Set the original data before modifications
     */
    setOriginal(data: T) {
      originalData = { ...data };
    },
    
    /**
     * Track a field change
     */
    async trackChange(
      fieldName: keyof T,
      newValue: T[keyof T],
      reason?: string,
      ipAddress?: string,
      userAgent?: string
    ) {
      if (!originalData) {
        throw new Error("Original data not set. Call setOriginal() first.");
      }
      
      const originalValue = originalData[fieldName];
      
      if (originalValue !== newValue) {
        await logManualOverride({
          vatrAssetId,
          actorId,
          actorRole,
          fieldName: String(fieldName),
          originalValue,
          newValue,
          reason: reason ?? "Manual update",
          ipAddress,
          userAgent,
        });
        
        // Update the original data for subsequent changes
        originalData[fieldName] = newValue;
      }
    },
    
    /**
     * Track multiple field changes at once
     */
    async trackChanges(
      changes: Partial<T>,
      reason?: string,
      ipAddress?: string,
      userAgent?: string
    ) {
      if (!originalData) {
        throw new Error("Original data not set. Call setOriginal() first.");
      }
      
      const changedFields: Record<string, { before: unknown; after: unknown }> = {};
      
      for (const [key, newValue] of Object.entries(changes)) {
        const originalValue = originalData[key as keyof T];
        if (originalValue !== newValue) {
          changedFields[key] = { before: originalValue, after: newValue };
          originalData[key as keyof T] = newValue as T[keyof T];
        }
      }
      
      if (Object.keys(changedFields).length > 0) {
        const beforeHash = generateDataHash(
          Object.fromEntries(
            Object.entries(changedFields).map(([k, v]) => [k, v.before])
          )
        );
        const afterHash = generateDataHash(
          Object.fromEntries(
            Object.entries(changedFields).map(([k, v]) => [k, v.after])
          )
        );
        
        await logVatrAudit({
          vatrAssetId,
          action: "manual_override",
          actorId,
          actorRole,
          beforeHash,
          afterHash,
          changesJson: changedFields,
          ipAddress,
          userAgent,
          isManualOverride: true,
          overrideReason: reason ?? "Manual update",
          originalValue: Object.fromEntries(
            Object.entries(changedFields).map(([k, v]) => [k, v.before])
          ),
          newValue: Object.fromEntries(
            Object.entries(changedFields).map(([k, v]) => [k, v.after])
          ),
          sourceType: "manual_entry",
        });
      }
    },
  };
}
