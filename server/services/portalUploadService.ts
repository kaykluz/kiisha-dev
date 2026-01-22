/**
 * Portal Upload Service
 * 
 * Handles file uploads from the customer portal and routes them
 * to the Artifact pipeline with proper VATR provenance.
 */

import { getDb } from "../db";
import { 
  portalUploads, 
  artifacts,
  vatrRecords,
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut } from "../storage";
import crypto from "crypto";

/**
 * Upload types supported by the portal
 */
export type PortalUploadType = 
  | 'meter_photo'
  | 'document'
  | 'support_attachment'
  | 'work_order_photo'
  | 'signature';

/**
 * Upload metadata
 */
interface UploadMetadata {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadType: PortalUploadType;
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}

/**
 * Create a portal upload and store in S3
 */
export async function createPortalUpload(
  portalUserId: number,
  clientAccountId: number,
  organizationId: number,
  fileBuffer: Buffer,
  metadata: UploadMetadata
): Promise<{ uploadId: number; artifactId: number; url: string } | null> {
  const db = await getDb();
  
  // Generate unique file key
  const hash = crypto.createHash('md5').update(fileBuffer).digest('hex').substring(0, 8);
  const timestamp = Date.now();
  const ext = metadata.originalFilename.split('.').pop() || 'bin';
  const fileKey = `portal-uploads/${clientAccountId}/${metadata.uploadType}/${timestamp}-${hash}.${ext}`;
  
  // Upload to S3
  const { url } = await storagePut(fileKey, fileBuffer, metadata.mimeType);
  
  // Create artifact record
  await db.execute(`
    INSERT INTO artifacts (
      organizationId, artifactType, status, title, description,
      sourceUrl, sourceType, fileSize, mimeType, createdAt, updatedAt
    ) VALUES (
      ${organizationId}, 'PORTAL_UPLOAD', 'processed', 
      '${metadata.originalFilename.replace(/'/g, "''")}',
      '${(metadata.description || '').replace(/'/g, "''")}',
      '${url}', 'uploaded', ${metadata.fileSize}, '${metadata.mimeType}',
      NOW(), NOW()
    )
  `);
  
  // Get the inserted artifact ID
  const [insertedArtifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.sourceUrl, url))
    .orderBy(desc(artifacts.createdAt))
    .limit(1);
  
  if (!insertedArtifact) return null;
  
  // Create portal upload record
  await db.execute(`
    INSERT INTO portalUploads (
      portalUserId, clientAccountId, artifactId, uploadType,
      originalFilename, mimeType, fileSize, fileUrl,
      relatedEntityType, relatedEntityId, status, createdAt, updatedAt
    ) VALUES (
      ${portalUserId}, ${clientAccountId}, ${insertedArtifact.id}, '${metadata.uploadType}',
      '${metadata.originalFilename.replace(/'/g, "''")}', '${metadata.mimeType}', ${metadata.fileSize}, '${url}',
      ${metadata.relatedEntityType ? `'${metadata.relatedEntityType}'` : 'NULL'},
      ${metadata.relatedEntityId || 'NULL'},
      'pending_review', NOW(), NOW()
    )
  `);
  
  // Get the inserted upload ID
  const [insertedUpload] = await db
    .select()
    .from(portalUploads)
    .where(eq(portalUploads.artifactId, insertedArtifact.id))
    .orderBy(desc(portalUploads.createdAt))
    .limit(1);
  
  if (!insertedUpload) return null;
  
  // Create VATR record for provenance
  await db.execute(`
    INSERT INTO vatrRecords (
      organizationId, entityType, entityId, action, actorType, actorId,
      timestamp, metadata, createdAt
    ) VALUES (
      ${organizationId}, 'portal_upload', ${insertedUpload.id}, 'created', 
      'portal_user', ${portalUserId},
      NOW(), 
      '{"uploadType": "${metadata.uploadType}", "filename": "${metadata.originalFilename}", "artifactId": ${insertedArtifact.id}}',
      NOW()
    )
  `);
  
  return {
    uploadId: insertedUpload.id,
    artifactId: insertedArtifact.id,
    url,
  };
}

/**
 * Get uploads for a portal user
 */
export async function getPortalUserUploads(
  portalUserId: number,
  clientAccountId: number,
  options?: {
    uploadType?: PortalUploadType;
    relatedEntityType?: string;
    relatedEntityId?: number;
    limit?: number;
    offset?: number;
  }
): Promise<typeof portalUploads.$inferSelect[]> {
  const db = await getDb();
  
  let query = `
    SELECT * FROM portalUploads 
    WHERE portalUserId = ${portalUserId} 
    AND clientAccountId = ${clientAccountId}
  `;
  
  if (options?.uploadType) {
    query += ` AND uploadType = '${options.uploadType}'`;
  }
  
  if (options?.relatedEntityType) {
    query += ` AND relatedEntityType = '${options.relatedEntityType}'`;
  }
  
  if (options?.relatedEntityId) {
    query += ` AND relatedEntityId = ${options.relatedEntityId}`;
  }
  
  query += ` ORDER BY createdAt DESC`;
  
  if (options?.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  
  if (options?.offset) {
    query += ` OFFSET ${options.offset}`;
  }
  
  const [rows] = await db.execute(query);
  return rows as typeof portalUploads.$inferSelect[];
}

/**
 * Update upload status (for admin review)
 */
export async function updateUploadStatus(
  uploadId: number,
  status: 'pending_review' | 'approved' | 'rejected',
  reviewedBy?: number,
  reviewNotes?: string
): Promise<boolean> {
  const db = await getDb();
  
  await db.execute(`
    UPDATE portalUploads 
    SET status = '${status}', 
        reviewedBy = ${reviewedBy || 'NULL'},
        reviewNotes = ${reviewNotes ? `'${reviewNotes.replace(/'/g, "''")}'` : 'NULL'},
        reviewedAt = NOW(),
        updatedAt = NOW()
    WHERE id = ${uploadId}
  `);
  
  return true;
}

/**
 * Delete a portal upload (soft delete via status)
 */
export async function deletePortalUpload(
  uploadId: number,
  portalUserId: number
): Promise<boolean> {
  const db = await getDb();
  
  // Verify ownership
  const [upload] = await db
    .select()
    .from(portalUploads)
    .where(
      and(
        eq(portalUploads.id, uploadId),
        eq(portalUploads.portalUserId, portalUserId)
      )
    )
    .limit(1);
  
  if (!upload) return false;
  
  // Only allow deletion of pending uploads
  if (upload.status !== 'pending_review') return false;
  
  await db.execute(`
    UPDATE portalUploads 
    SET status = 'rejected', 
        reviewNotes = 'Deleted by user',
        updatedAt = NOW()
    WHERE id = ${uploadId}
  `);
  
  return true;
}
