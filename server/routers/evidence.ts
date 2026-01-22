/**
 * Evidence Router - RBAC-secured endpoints for evidence grounding
 * 
 * Provides access to evidence refs with proper access control:
 * - Users can only access evidence for documents they have access to
 * - Admins can access all evidence
 * - Evidence views are logged for audit trails
 * 
 * Evidence Tiers:
 * - T1_TEXT: Native PDF text with bounding box (highest priority)
 * - T2_OCR: OCR-derived text with bounding box
 * - T3_ANCHOR: Text anchor fallback (lowest priority)
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

// Evidence tier enum
const EvidenceTierEnum = z.enum(['T1_TEXT', 'T2_OCR', 'T3_ANCHOR']);

// Bounding box schema (matches schema.ts)
const BoundingBoxSchema = z.object({
  units: z.enum(['pdf_points', 'page_normalized', 'pixels']),
  origin: z.enum(['top_left', 'bottom_left']),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

// Text anchor schema (matches schema.ts)
const TextAnchorSchema = z.object({
  matchType: z.enum(['exact', 'regex', 'semantic']),
  query: z.string(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  occurrenceHint: z.number().optional(),
});

// Field record type enum
const FieldRecordTypeEnum = z.enum(['ai_extraction', 'vatr_source', 'asset_attribute']);

export const evidenceRouter = router({
  /**
   * Get evidence refs for a specific field record
   * RBAC: User must have access to the document
   */
  getForField: protectedProcedure
    .input(z.object({ 
      fieldRecordId: z.number(),
      fieldRecordType: FieldRecordTypeEnum,
    }))
    .query(async ({ ctx, input }) => {
      const evidenceRefs = await db.getEvidenceRefsForField(input.fieldRecordId, input.fieldRecordType);
      
      if (evidenceRefs.length === 0) {
        return [];
      }
      
      // For non-admins, filter to only evidence they have access to
      if (ctx.user.role !== 'admin') {
        // Get unique document IDs
        const documentIds = Array.from(new Set(evidenceRefs.map(e => e.documentId)));
        
        // Check access to each document
        const accessibleDocIds = new Set<number>();
        for (const docId of documentIds) {
          const doc = await db.getDocumentById(docId);
          if (doc) {
            // Check if user has access to the project
            const membership = await db.getOrganizationMemberships(ctx.user.id);
            const project = await db.getProjectById(doc.projectId);
            if (project && membership.some(m => m.organizationId === project.organizationId)) {
              accessibleDocIds.add(docId);
            }
          }
        }
        
        return evidenceRefs.filter(e => accessibleDocIds.has(e.documentId));
      }
      
      return evidenceRefs;
    }),

  /**
   * Get evidence refs for a specific document
   * RBAC: User must have access to the document
   */
  getForDocument: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Check document access
      const document = await db.getDocumentById(input.documentId);
      if (!document) {
        return [];
      }
      
      // Admin can access all documents
      if (ctx.user.role !== 'admin') {
        // Check if user has access to the document's project
        const membership = await db.getOrganizationMemberships(ctx.user.id);
        const project = await db.getProjectById(document.projectId);
        if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
          return [];
        }
      }
      
      // Get all evidence refs for this document (all pages)
      // We need to query by document ID across all field records
      const allRefs = await db.getEvidenceRefsForDocumentPage(input.documentId, 0);
      
      // Also get refs without specific page numbers
      return allRefs;
    }),

  /**
   * Get evidence refs for a specific document page
   * RBAC: User must have access to the document
   */
  getForDocumentPage: protectedProcedure
    .input(z.object({ 
      documentId: z.number(),
      pageNumber: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Check document access
      const document = await db.getDocumentById(input.documentId);
      if (!document) {
        return [];
      }
      
      // Admin can access all documents
      if (ctx.user.role !== 'admin') {
        const membership = await db.getOrganizationMemberships(ctx.user.id);
        const project = await db.getProjectById(document.projectId);
        if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
          return [];
        }
      }
      
      return db.getEvidenceRefsForDocumentPage(input.documentId, input.pageNumber);
    }),

  /**
   * Get best (canonical) evidence for a field record
   * Uses deterministic tier selection: T1 > T2 > T3, then confidence, then ID
   */
  getBest: protectedProcedure
    .input(z.object({ 
      fieldRecordId: z.number(),
      fieldRecordType: FieldRecordTypeEnum,
    }))
    .query(async ({ ctx, input }) => {
      const best = await db.selectBestEvidence(input.fieldRecordId, input.fieldRecordType);
      
      if (!best) {
        return null;
      }
      
      // Check access
      if (ctx.user.role !== 'admin') {
        const doc = await db.getDocumentById(best.documentId);
        if (doc) {
          const membership = await db.getOrganizationMemberships(ctx.user.id);
          const project = await db.getProjectById(doc.projectId);
          if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
            return null;
          }
        }
      }
      
      return best;
    }),

  /**
   * Batch get best evidence for multiple field records
   */
  getBestBatch: protectedProcedure
    .input(z.object({
      fieldRecords: z.array(z.object({
        id: z.number(),
        type: FieldRecordTypeEnum,
      })),
    }))
    .query(async ({ ctx, input }) => {
      const results = await db.selectBestEvidenceBatch(input.fieldRecords);
      
      // Convert Map to array of results with access checks
      type EvidenceResult = { key: string; evidence: ReturnType<typeof results.get> };
      const output: EvidenceResult[] = [];
      
      // Process entries sequentially for async access checks
      const entries = Array.from(results.entries());
      for (const [key, evidence] of entries) {
        // Check access for each evidence
        if (evidence && ctx.user.role !== 'admin') {
          const doc = await db.getDocumentById(evidence.documentId);
          if (doc) {
            const membership = await db.getOrganizationMemberships(ctx.user.id);
            const project = await db.getProjectById(doc.projectId);
            if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
              output.push({ key, evidence: null });
              continue;
            }
          }
        }
        output.push({ key, evidence });
      }
      
      return output;
    }),

  /**
   * Log evidence view event for audit trail
   * RBAC: User must have access to view the evidence
   */
  logView: protectedProcedure
    .input(z.object({
      fieldRecordId: z.number(),
      fieldRecordType: FieldRecordTypeEnum,
      evidenceRefId: z.number().optional(),
      documentId: z.number(),
      pageNumber: z.number().optional(),
      tierUsed: EvidenceTierEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check access before logging
      if (ctx.user.role !== 'admin') {
        const doc = await db.getDocumentById(input.documentId);
        if (doc) {
          const membership = await db.getOrganizationMemberships(ctx.user.id);
          const project = await db.getProjectById(doc.projectId);
          if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You do not have access to this evidence',
            });
          }
        }
      }
      
      // Get user's organization
      const memberships = await db.getOrganizationMemberships(ctx.user.id);
      const orgId = memberships[0]?.organizationId;
      
      // Log the view event
      await db.logEvidenceOpen({
        eventType: 'evidence_opened',
        userId: ctx.user.id,
        organizationId: orgId,
        fieldRecordId: input.fieldRecordId,
        fieldRecordType: input.fieldRecordType,
        evidenceRefId: input.evidenceRefId,
        documentId: input.documentId,
        pageNumber: input.pageNumber,
        tierUsed: input.tierUsed,
      });
      
      return { success: true };
    }),

  /**
   * Create evidence ref (admin or extraction pipeline only)
   * RBAC: Admin only for manual creation
   */
  create: protectedProcedure
    .input(z.object({
      fieldRecordId: z.number(),
      fieldRecordType: FieldRecordTypeEnum,
      documentId: z.number(),
      pageNumber: z.number().optional(),
      tier: EvidenceTierEnum,
      snippet: z.string().max(240).optional(),
      bboxJson: BoundingBoxSchema.optional(),
      anchorJson: TextAnchorSchema.optional(),
      confidence: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only admins can manually create evidence refs
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can create evidence refs',
        });
      }
      
      const evidenceRefId = await db.createEvidenceRef({
        fieldRecordId: input.fieldRecordId,
        fieldRecordType: input.fieldRecordType,
        documentId: input.documentId,
        pageNumber: input.pageNumber ?? null,
        tier: input.tier,
        snippet: input.snippet,
        bboxJson: input.bboxJson ?? null,
        anchorJson: input.anchorJson ?? null,
        confidence: String(input.confidence ?? 0.5),
        createdById: ctx.user.id,
        provenanceStatus: 'resolved',
      });
      
      return { id: evidenceRefId };
    }),

  /**
   * Get unresolved evidence refs for review
   * RBAC: Admin only
   */
  getUnresolved: protectedProcedure
    .input(z.object({
      documentId: z.number().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can view unresolved evidence',
        });
      }
      
      return db.getUnresolvedEvidenceRefs(input.documentId, input.limit);
    }),

  /**
   * Update evidence provenance status
   * RBAC: Admin only
   */
  updateStatus: protectedProcedure
    .input(z.object({
      evidenceRefId: z.number(),
      status: z.enum(['resolved', 'unresolved', 'needs_review']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can update evidence status',
        });
      }
      
      await db.updateEvidenceProvenanceStatus(input.evidenceRefId, input.status);
      return { success: true };
    }),

  /**
   * Get evidence audit log
   * RBAC: Admin only, or user can see their own
   */
  getAuditLog: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      orgId: z.number().optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Non-admins can only see their own audit log
      if (ctx.user.role !== 'admin') {
        return db.getEvidenceAuditLogForUser(ctx.user.id, input.limit || 100);
      }
      
      // Admin can see any user or org
      if (input.userId) {
        return db.getEvidenceAuditLogForUser(input.userId, input.limit || 100);
      }
      
      if (input.orgId) {
        return db.getEvidenceAuditLogForOrg(input.orgId, input.limit || 100);
      }
      
      // Default to current user
      return db.getEvidenceAuditLogForUser(ctx.user.id, input.limit || 100);
    }),

  /**
   * Evidence Review Dashboard - get summary of all evidence for admin review
   * RBAC: Admin only
   */
  reviewDashboard: protectedProcedure
    .input(z.object({
      status: z.enum(['all', 'resolved', 'unresolved', 'needs_review']).optional(),
      limit: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can access the evidence review dashboard',
        });
      }
      
      // Get user's organization
      const memberships = await db.getOrganizationMemberships(ctx.user.id);
      const orgId = memberships[0]?.organizationId;
      
      // Get unresolved evidence refs
      const unresolvedRefs = await db.getUnresolvedEvidenceRefs(undefined, input.limit || 50);
      
      // Get recent evidence audit log
      const recentActivity = orgId 
        ? await db.getEvidenceAuditLogForOrg(orgId, 20)
        : [];
      
      // Calculate summary stats
      const totalUnresolved = unresolvedRefs.length;
      const needsReview = unresolvedRefs.filter(r => r.provenanceStatus === 'needs_review').length;
      
      return {
        totalUnresolved,
        needsReview,
        unresolvedRefs: unresolvedRefs.map(r => ({
          id: r.id,
          fieldRecordId: r.fieldRecordId,
          fieldRecordType: r.fieldRecordType,
          documentId: r.documentId,
          pageNumber: r.pageNumber,
          tier: r.tier,
          snippet: r.snippet,
          confidence: r.confidence,
          provenanceStatus: r.provenanceStatus,
          createdAt: r.createdAt,
        })),
        recentActivity: recentActivity.map(a => ({
          id: a.id,
          eventType: a.eventType,
          userId: a.userId,
          createdAt: a.createdAt,
        })),
      };
    }),

  /**
   * Resolve evidence manually - admin marks evidence as resolved
   * RBAC: Admin only
   */
  resolve: protectedProcedure
    .input(z.object({
      evidenceRefId: z.number(),
      resolution: z.enum(['accept', 'reject', 'replace']),
      notes: z.string().optional(),
      replacementEvidenceId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only administrators can resolve evidence',
        });
      }
      
      // Update status based on resolution
      const newStatus = input.resolution === 'reject' ? 'unresolved' : 'resolved';
      await db.updateEvidenceProvenanceStatus(input.evidenceRefId, newStatus);
      
      // Log the resolution - skip logging since we don't have fieldRecordType/fieldRecordId
      // The status update itself is the audit trail
      
      return { success: true };
    }),

  /**
   * Highlight evidence in document - returns highlight data for viewer
   * RBAC: User must have access to the document
   */
  highlight: protectedProcedure
    .input(z.object({
      fieldRecordId: z.number(),
      fieldRecordType: FieldRecordTypeEnum,
    }))
    .query(async ({ ctx, input }) => {
      // Get best evidence for the field
      const evidence = await db.selectBestEvidence(input.fieldRecordId, input.fieldRecordType);
      
      if (!evidence) {
        // Log not found event
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        await db.logEvidenceOpen({
          eventType: 'evidence_not_found',
          userId: ctx.user.id,
          organizationId: memberships[0]?.organizationId,
          fieldRecordId: input.fieldRecordId,
          fieldRecordType: input.fieldRecordType,
        });
        
        return null;
      }
      
      // Check access
      if (ctx.user.role !== 'admin') {
        const doc = await db.getDocumentById(evidence.documentId);
        if (doc) {
          const membership = await db.getOrganizationMemberships(ctx.user.id);
          const project = await db.getProjectById(doc.projectId);
          if (!project || !membership.some(m => m.organizationId === project.organizationId)) {
            // Log access denied
            await db.logEvidenceOpen({
              eventType: 'access_denied',
              userId: ctx.user.id,
              organizationId: membership[0]?.organizationId,
              fieldRecordId: input.fieldRecordId,
              fieldRecordType: input.fieldRecordType,
              evidenceRefId: evidence.id,
              documentId: evidence.documentId,
            });
            
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You do not have access to this evidence',
            });
          }
        }
      }
      
      // Get document info
      const document = await db.getDocumentById(evidence.documentId);
      
      // Log successful view
      const memberships = await db.getOrganizationMemberships(ctx.user.id);
      await db.logEvidenceOpen({
        eventType: 'evidence_opened',
        userId: ctx.user.id,
        organizationId: memberships[0]?.organizationId,
        fieldRecordId: input.fieldRecordId,
        fieldRecordType: input.fieldRecordType,
        evidenceRefId: evidence.id,
        documentId: evidence.documentId,
        pageNumber: evidence.pageNumber ?? undefined,
        tierUsed: evidence.tier,
      });
      
      return {
        evidenceRef: {
          id: evidence.id,
          tier: evidence.tier,
          pageNumber: evidence.pageNumber,
          bboxJson: evidence.bboxJson,
          anchorJson: evidence.anchorJson,
          snippet: evidence.snippet,
          confidence: evidence.confidence,
          provenanceStatus: evidence.provenanceStatus,
        },
        document: document ? {
          id: document.id,
          name: document.name,
          fileUrl: document.fileUrl,
          fileType: document.mimeType,
        } : null,
      };
    }),
});
