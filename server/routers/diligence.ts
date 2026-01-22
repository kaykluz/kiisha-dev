/**
 * Diligence Router
 * Handles diligence templates, requirement items, expiry tracking, and renewals
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { 
  diligenceTemplates, 
  diligenceTemplateVersions,
  requirementItems, 
  templateRequirements,
  expiryRecords,
  renewalRecords,
  diligenceReadiness,
  diligenceAuditLog,
  companyProfiles,
  companyShareholders,
  companyDirectors,
  companyBankAccounts,
  templateResponses,
  responseSubmissions,
  submissionComments,
  submissionHistory,
  submissionExtractions,
  sharedSubmissions,
  updateNotifications,
  senderUpdateAlerts,
  documentVersions
} from "../../drizzle/schema";
import { eq, and, or, desc, asc, sql, gte, lte, isNull, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { runAllSeeds } from "../services/diligenceSeedData";

export const diligenceRouter = router({
  // =========================================================================
  // TEMPLATES
  // =========================================================================
  
  /**
   * List all templates (global + org-specific)
   */
  listTemplates: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      category: z.string().optional(),
      status: z.enum(["draft", "active", "deprecated", "archived"]).optional(),
      includeGlobal: z.boolean().default(true)
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input.category) {
        conditions.push(eq(diligenceTemplates.category, input.category as any));
      }
      
      if (input.status) {
        conditions.push(eq(diligenceTemplates.status, input.status));
      }
      
      // Include global templates and/or org-specific
      if (input.includeGlobal && input.organizationId) {
        conditions.push(or(
          eq(diligenceTemplates.isGlobalDefault, true),
          eq(diligenceTemplates.organizationId, input.organizationId)
        ));
      } else if (input.organizationId) {
        conditions.push(eq(diligenceTemplates.organizationId, input.organizationId));
      } else if (input.includeGlobal) {
        conditions.push(eq(diligenceTemplates.isGlobalDefault, true));
      }
      
      const templates = await db.select().from(diligenceTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(diligenceTemplates.category), asc(diligenceTemplates.name));
      
      return templates;
    }),
  
  /**
   * Get template by ID with requirements
   */
  getTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [template] = await db.select().from(diligenceTemplates).where(eq(diligenceTemplates.id, input.id)).limit(1);
      
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Get requirements for this template
      const requirements = await db
        .select({
          mapping: templateRequirements,
          item: requirementItems
        })
        .from(templateRequirements)
        .innerJoin(requirementItems, eq(templateRequirements.requirementItemId, requirementItems.id))
        .where(eq(templateRequirements.templateId, input.id))
        .orderBy(asc(templateRequirements.sortOrder));
      
      return {
        ...template,
        requirements: requirements.map(r => ({
          ...r.mapping,
          item: r.item
        }))
      };
    }),
  
  /**
   * Clone a template for an organization
   */
  cloneTemplate: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      organizationId: z.number(),
      newName: z.string().optional(),
      newDescription: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [original] = await db.select().from(diligenceTemplates).where(eq(diligenceTemplates.id, input.templateId)).limit(1);
      
      if (!original) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Create forked template
      const [newTemplate] = await db.insert(diligenceTemplates).values({
        code: `${original.code}_ORG${input.organizationId}_${Date.now()}`,
        name: input.newName || `${original.name} (Custom)`,
        description: input.newDescription || original.description,
        category: original.category,
        organizationId: input.organizationId,
        parentTemplateId: original.id,
        isGlobalDefault: false,
        version: 1,
        shareBoundary: original.shareBoundary,
        requireSignOff: original.requireSignOff,
        signOffRoles: original.signOffRoles,
        status: "draft",
        createdBy: ctx.user.id
      });
      
      // Copy requirements
      const originalRequirements = await db.select().from(templateRequirements).where(eq(templateRequirements.templateId, input.templateId));
      
      if (originalRequirements.length > 0) {
        await db.insert(templateRequirements).values(
          originalRequirements.map(r => ({
            templateId: Number(newTemplate.insertId),
            requirementItemId: r.requirementItemId,
            required: r.required,
            sortOrder: r.sortOrder,
            customValidation: r.customValidation,
            customExpiryDays: r.customExpiryDays
          }))
        );
      }
      
      // Log audit
      await db.insert(diligenceAuditLog).values({
        entityType: "template",
        entityId: Number(newTemplate.insertId),
        action: "forked",
        organizationId: input.organizationId,
        newValue: { parentTemplateId: original.id },
        changeDescription: `Forked from template: ${original.name}`,
        performedBy: ctx.user.id
      });
      
      return { id: Number(newTemplate.insertId) };
    }),
  
  /**
   * Create a new template
   */
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string(),
      code: z.string(),
      description: z.string().optional(),
      category: z.string(),
      organizationId: z.number(),
      signOffRequired: z.boolean().default(false),
      signOffRoles: z.array(z.string()).optional(),
      requirementIds: z.array(z.number()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Check if code already exists
      const [existing] = await db.select().from(diligenceTemplates).where(eq(diligenceTemplates.code, input.code)).limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Template code already exists" });
      }
      
      // Create template
      const [newTemplate] = await db.insert(diligenceTemplates).values({
        code: input.code,
        name: input.name,
        description: input.description,
        category: input.category as any,
        organizationId: input.organizationId,
        isGlobalDefault: false,
        version: 1,
        requireSignOff: input.signOffRequired,
        signOffRoles: input.signOffRoles,
        status: "draft",
        createdBy: ctx.user.id
      });
      
      const templateId = Number(newTemplate.insertId);
      
      // Add requirements if provided
      if (input.requirementIds && input.requirementIds.length > 0) {
        await db.insert(templateRequirements).values(
          input.requirementIds.map((reqId, index) => ({
            templateId,
            requirementItemId: reqId,
            required: true,
            sortOrder: index + 1
          }))
        );
      }
      
      // Log audit
      await db.insert(diligenceAuditLog).values({
        entityType: "template",
        entityId: templateId,
        action: "created",
        organizationId: input.organizationId,
        newValue: { name: input.name, code: input.code },
        changeDescription: `Created template: ${input.name}`,
        performedBy: ctx.user.id
      });
      
      return { id: templateId };
    }),

  // =========================================================================
  // REQUIREMENT ITEMS
  // =========================================================================
  
  /**
   * List all requirement items
   */
  listRequirementItems: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      category: z.string().optional(),
      requirementType: z.string().optional(),
      appliesTo: z.string().optional(),
      includeGlobal: z.boolean().default(true)
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [eq(requirementItems.isActive, true)];
      
      if (input.category) {
        conditions.push(eq(requirementItems.category, input.category as any));
      }
      
      if (input.requirementType) {
        conditions.push(eq(requirementItems.requirementType, input.requirementType as any));
      }
      
      if (input.appliesTo) {
        conditions.push(eq(requirementItems.appliesTo, input.appliesTo as any));
      }
      
      if (input.includeGlobal && input.organizationId) {
        conditions.push(or(
          eq(requirementItems.isGlobalDefault, true),
          eq(requirementItems.organizationId, input.organizationId)
        ));
      } else if (input.organizationId) {
        conditions.push(eq(requirementItems.organizationId, input.organizationId));
      } else if (input.includeGlobal) {
        conditions.push(eq(requirementItems.isGlobalDefault, true));
      }
      
      const items = await db.select().from(requirementItems)
        .where(and(...conditions))
        .orderBy(asc(requirementItems.category), asc(requirementItems.sortOrder));
      
      return items;
    }),
  
  /**
   * Get requirement item by ID
   */
  getRequirementItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [item] = await db.select().from(requirementItems).where(eq(requirementItems.id, input.id)).limit(1);
      
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Requirement item not found" });
      }
      
      return item;
    }),
  
  /**
   * Create custom requirement item for an organization
   */
  createRequirementItem: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      code: z.string(),
      title: z.string(),
      description: z.string().optional(),
      requirementType: z.enum(["field", "document", "checklist", "attestation", "external_verification"]),
      appliesTo: z.enum(["company_profile", "asset", "site", "project", "person"]),
      category: z.enum(["corporate_identity", "ownership_governance", "licenses_permits", "finance", "banking", "people_capability", "hse_esg", "insurance", "legal", "custom"]),
      required: z.boolean().default(true),
      evidenceRequired: z.boolean().default(true),
      expiryPolicy: z.enum(["none", "fixed_date", "duration_from_issue", "duration_from_upload", "periodic"]).default("none"),
      expiryDurationDays: z.number().optional(),
      gracePeriodDays: z.number().default(0),
      renewalWindowDays: z.number().default(30),
      renewalPolicy: z.enum(["none", "manual", "recurring", "auto_obligation"]).default("none"),
      sensitivity: z.enum(["normal", "restricted", "highly_restricted"]).default("normal"),
      defaultDocCategories: z.array(z.string()).optional(),
      acceptedFileTypes: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [newItem] = await db.insert(requirementItems).values({
        ...input,
        isGlobalDefault: false,
        isActive: true,
        createdBy: ctx.user.id
      });
      
      await db.insert(diligenceAuditLog).values({
        entityType: "requirement_item",
        entityId: Number(newItem.insertId),
        action: "created",
        organizationId: input.organizationId,
        newValue: input as any,
        performedBy: ctx.user.id
      });
      
      return { id: Number(newItem.insertId) };
    }),
  
  // =========================================================================
  // EXPIRY TRACKING
  // =========================================================================
  
  /**
   * List expiry records for an entity
   */
  listExpiryRecords: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      entityType: z.enum(["company_profile", "asset", "site", "project", "person"]).optional(),
      entityId: z.number().optional(),
      status: z.enum(["valid", "due_soon", "due_now", "overdue", "renewed_pending_review", "renewed_approved", "archived"]).optional(),
      dueSoonDays: z.number().optional() // Filter items expiring within X days
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [eq(expiryRecords.organizationId, input.organizationId)];
      
      if (input.entityType) {
        conditions.push(eq(expiryRecords.entityType, input.entityType));
      }
      
      if (input.entityId) {
        conditions.push(eq(expiryRecords.entityId, input.entityId));
      }
      
      if (input.status) {
        conditions.push(eq(expiryRecords.status, input.status));
      }
      
      if (input.dueSoonDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + input.dueSoonDays);
        conditions.push(lte(expiryRecords.expiresAt, futureDate));
        conditions.push(gte(expiryRecords.expiresAt, new Date()));
      }
      
      const records = await db
        .select({
          expiry: expiryRecords,
          requirement: requirementItems
        })
        .from(expiryRecords)
        .innerJoin(requirementItems, eq(expiryRecords.requirementItemId, requirementItems.id))
        .where(and(...conditions))
        .orderBy(asc(expiryRecords.expiresAt));
      
      return records.map(r => ({
        ...r.expiry,
        requirement: r.requirement
      }));
    }),
  
  /**
   * Create or update expiry record
   */
  upsertExpiryRecord: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      requirementItemId: z.number(),
      entityType: z.enum(["company_profile", "asset", "site", "project", "person"]),
      entityId: z.number(),
      organizationId: z.number(),
      documentId: z.number().optional(),
      evidenceRefId: z.number().optional(),
      issuedAt: z.date().optional(),
      expiresAt: z.date().optional(),
      validForDays: z.number().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Calculate expiry status
      let status: "valid" | "due_soon" | "due_now" | "overdue" = "valid";
      if (input.expiresAt) {
        const now = new Date();
        const expiresAt = new Date(input.expiresAt);
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Get requirement item for renewal window
        const [reqItem] = await db.select().from(requirementItems).where(eq(requirementItems.id, input.requirementItemId)).limit(1);
        
        const renewalWindow = reqItem?.renewalWindowDays || 30;
        const gracePeriod = reqItem?.gracePeriodDays || 0;
        
        if (daysUntilExpiry < -gracePeriod) {
          status = "overdue";
        } else if (daysUntilExpiry < 0) {
          status = "due_now";
        } else if (daysUntilExpiry <= renewalWindow) {
          status = "due_soon";
        }
      }
      
      if (input.id) {
        // Update existing
        await db.update(expiryRecords)
          .set({
            ...input,
            status,
            updatedAt: new Date()
          })
          .where(eq(expiryRecords.id, input.id));
        
        return { id: input.id };
      } else {
        // Create new
        const [newRecord] = await db.insert(expiryRecords).values({
          ...input,
          status,
          verificationStatus: "unverified"
        });
        
        return { id: Number(newRecord.insertId) };
      }
    }),
  
  /**
   * Verify expiry record (confirm AI extraction)
   */
  verifyExpiryRecord: protectedProcedure
    .input(z.object({
      id: z.number(),
      verified: z.boolean(),
      correctedIssuedAt: z.date().optional(),
      correctedExpiresAt: z.date().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [record] = await db.select().from(expiryRecords).where(eq(expiryRecords.id, input.id)).limit(1);
      
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expiry record not found" });
      }
      
      await db.update(expiryRecords)
        .set({
          verificationStatus: input.verified ? "verified" : "rejected",
          verifiedBy: ctx.user.id,
          verifiedAt: new Date(),
          issuedAt: input.correctedIssuedAt || record.issuedAt,
          expiresAt: input.correctedExpiresAt || record.expiresAt,
          updatedAt: new Date()
        })
        .where(eq(expiryRecords.id, input.id));
      
      await db.insert(diligenceAuditLog).values({
        entityType: "expiry_record",
        entityId: input.id,
        action: "verified",
        organizationId: record.organizationId,
        previousValue: { verificationStatus: record.verificationStatus },
        newValue: { verificationStatus: input.verified ? "verified" : "rejected" },
        performedBy: ctx.user.id
      });
      
      return { success: true };
    }),
  
  // =========================================================================
  // RENEWALS
  // =========================================================================
  
  /**
   * Submit renewal for an expiry record
   */
  submitRenewal: protectedProcedure
    .input(z.object({
      expiryRecordId: z.number(),
      newDocumentId: z.number().optional(),
      newEvidenceRefId: z.number().optional(),
      newIssuedAt: z.date().optional(),
      newExpiresAt: z.date().optional(),
      documentUrls: z.array(z.string()).optional(),
      documentKeys: z.array(z.string()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [expiryRecord] = await db.select().from(expiryRecords).where(eq(expiryRecords.id, input.expiryRecordId)).limit(1);
      
      if (!expiryRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Expiry record not found" });
      }
      
      // Create renewal record with document references
      const [renewal] = await db.insert(renewalRecords).values({
        expiryRecordId: input.expiryRecordId,
        previousExpiryRecordId: expiryRecord.id,
        newDocumentId: input.newDocumentId,
        newEvidenceRefId: input.newEvidenceRefId,
        newIssuedAt: input.newIssuedAt,
        newExpiresAt: input.newExpiresAt,
        documentUrls: input.documentUrls ? JSON.stringify(input.documentUrls) : null,
        documentKeys: input.documentKeys ? JSON.stringify(input.documentKeys) : null,
        status: "submitted",
        submittedBy: ctx.user.id
      });
      
      // Update expiry record status
      await db.update(expiryRecords)
        .set({
          status: "renewed_pending_review",
          updatedAt: new Date()
        })
        .where(eq(expiryRecords.id, input.expiryRecordId));
      
      await db.insert(diligenceAuditLog).values({
        entityType: "renewal",
        entityId: Number(renewal.insertId),
        action: "submitted",
        organizationId: expiryRecord.organizationId,
        newValue: input as any,
        performedBy: ctx.user.id
      });
      
      return { id: Number(renewal.insertId) };
    }),
  
  /**
   * Approve or reject renewal
   */
  reviewRenewal: protectedProcedure
    .input(z.object({
      renewalId: z.number(),
      approved: z.boolean(),
      reviewNotes: z.string().optional(),
      rejectionReason: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [renewal] = await db.select().from(renewalRecords).where(eq(renewalRecords.id, input.renewalId)).limit(1);
      
      if (!renewal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Renewal not found" });
      }
      
      const now = new Date();
      
      if (input.approved) {
        // Update renewal record
        await db.update(renewalRecords)
          .set({
            status: "approved",
            reviewNotes: input.reviewNotes,
            reviewedBy: ctx.user.id,
            reviewedAt: now,
            approvedBy: ctx.user.id,
            approvedAt: now,
            updatedAt: now
          })
          .where(eq(renewalRecords.id, input.renewalId));
        
        // Update expiry record with new dates
        await db.update(expiryRecords)
          .set({
            status: "renewed_approved",
            issuedAt: renewal.newIssuedAt,
            expiresAt: renewal.newExpiresAt,
            documentId: renewal.newDocumentId,
            evidenceRefId: renewal.newEvidenceRefId,
            verificationStatus: "verified",
            verifiedBy: ctx.user.id,
            verifiedAt: now,
            updatedAt: now
          })
          .where(eq(expiryRecords.id, renewal.expiryRecordId));
      } else {
        // Reject renewal
        await db.update(renewalRecords)
          .set({
            status: "rejected",
            reviewNotes: input.reviewNotes,
            rejectionReason: input.rejectionReason,
            reviewedBy: ctx.user.id,
            reviewedAt: now,
            updatedAt: now
          })
          .where(eq(renewalRecords.id, input.renewalId));
        
        // Revert expiry record status
        const [expiryRecord] = await db.select().from(expiryRecords).where(eq(expiryRecords.id, renewal.expiryRecordId)).limit(1);
        
        if (expiryRecord?.expiresAt) {
          const daysUntilExpiry = Math.ceil((expiryRecord.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let status: "valid" | "due_soon" | "due_now" | "overdue" = "valid";
          
          if (daysUntilExpiry < 0) {
            status = "overdue";
          } else if (daysUntilExpiry <= 30) {
            status = "due_soon";
          }
          
          await db.update(expiryRecords)
            .set({ status, updatedAt: now })
            .where(eq(expiryRecords.id, renewal.expiryRecordId));
        }
      }
      
      await db.insert(diligenceAuditLog).values({
        entityType: "renewal",
        entityId: input.renewalId,
        action: input.approved ? "approved" : "rejected",
        organizationId: null,
        newValue: { approved: input.approved, reviewNotes: input.reviewNotes },
        performedBy: ctx.user.id
      });
      
      return { success: true };
    }),
  
  /**
   * List renewals
   */
  listRenewals: protectedProcedure
    .input(z.object({
      expiryRecordId: z.number().optional(),
      status: z.enum(["submitted", "under_review", "approved", "rejected", "cancelled"]).optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input.expiryRecordId) {
        conditions.push(eq(renewalRecords.expiryRecordId, input.expiryRecordId));
      }
      
      if (input.status) {
        conditions.push(eq(renewalRecords.status, input.status));
      }
      
      const renewals = await db.select().from(renewalRecords)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(renewalRecords.submittedAt));
      
      return renewals;
    }),
  
  // =========================================================================
  // READINESS CALCULATION
  // =========================================================================
  
  /**
   * Calculate and cache readiness score for an entity
   */
  calculateReadiness: protectedProcedure
    .input(z.object({
      entityType: z.enum(["company_profile", "asset", "site", "project", "person"]),
      entityId: z.number(),
      organizationId: z.number(),
      templateId: z.number().optional()
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      // Get all expiry records for this entity
      const expiries = await db.select().from(expiryRecords).where(and(
        eq(expiryRecords.entityType, input.entityType),
        eq(expiryRecords.entityId, input.entityId),
        eq(expiryRecords.organizationId, input.organizationId)
      ));
      
      // Calculate metrics
      const totalExpirable = expiries.length;
      const validExpirable = expiries.filter(e => e.status === "valid" || e.status === "renewed_approved").length;
      const dueSoonCount = expiries.filter(e => e.status === "due_soon").length;
      const overdueCount = expiries.filter(e => e.status === "overdue" || e.status === "due_now").length;
      const pendingApprovalCount = expiries.filter(e => e.status === "renewed_pending_review").length;
      
      // Calculate scores
      const expiryScore = totalExpirable > 0 ? (validExpirable / totalExpirable) * 100 : 100;
      const overallScore = expiryScore; // Can be extended with more factors
      
      // Upsert readiness record
      const [existing] = await db.select().from(diligenceReadiness).where(and(
        eq(diligenceReadiness.entityType, input.entityType),
        eq(diligenceReadiness.entityId, input.entityId),
        eq(diligenceReadiness.organizationId, input.organizationId),
        input.templateId 
          ? eq(diligenceReadiness.templateId, input.templateId)
          : isNull(diligenceReadiness.templateId)
      )).limit(1);
      
      const readinessData = {
        entityType: input.entityType,
        entityId: input.entityId,
        organizationId: input.organizationId,
        templateId: input.templateId || null,
        totalExpirable,
        validExpirable,
        dueSoonCount,
        overdueCount,
        pendingApprovalCount,
        overallScore: overallScore.toFixed(2),
        expiryScore: expiryScore.toFixed(2),
        calculatedAt: new Date()
      };
      
      if (existing) {
        await db.update(diligenceReadiness)
          .set(readinessData)
          .where(eq(diligenceReadiness.id, existing.id));
        return { id: existing.id, ...readinessData };
      } else {
        const [newRecord] = await db.insert(diligenceReadiness).values(readinessData as any);
        return { id: Number(newRecord.insertId), ...readinessData };
      }
    }),
  
  /**
   * Get readiness for an entity
   */
  getReadiness: protectedProcedure
    .input(z.object({
      entityType: z.enum(["company_profile", "asset", "site", "project", "person"]),
      entityId: z.number(),
      organizationId: z.number(),
      templateId: z.number().optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [readiness] = await db.select().from(diligenceReadiness).where(and(
        eq(diligenceReadiness.entityType, input.entityType),
        eq(diligenceReadiness.entityId, input.entityId),
        eq(diligenceReadiness.organizationId, input.organizationId),
        input.templateId 
          ? eq(diligenceReadiness.templateId, input.templateId)
          : isNull(diligenceReadiness.templateId)
      )).limit(1);
      
      return readiness || null;
    }),
  
  // =========================================================================
  // COMPANY PROFILES
  // =========================================================================
  
  /**
   * List company profiles for an organization
   */
  listCompanyProfiles: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      status: z.enum(["active", "inactive", "pending", "archived"]).optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [eq(companyProfiles.organizationId, input.organizationId)];
      
      if (input.status) {
        conditions.push(eq(companyProfiles.status, input.status));
      }
      
      const profiles = await db.select().from(companyProfiles)
        .where(and(...conditions))
        .orderBy(asc(companyProfiles.legalName));
      
      return profiles;
    }),
  
  /**
   * Get company profile with related data
   */
  getCompanyProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.id, input.id)).limit(1);
      
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Company profile not found" });
      }
      
      // Get related data
      const shareholders = await db.select().from(companyShareholders).where(eq(companyShareholders.companyProfileId, input.id));
      const directors = await db.select().from(companyDirectors).where(eq(companyDirectors.companyProfileId, input.id));
      const bankAccounts = await db.select().from(companyBankAccounts).where(eq(companyBankAccounts.companyProfileId, input.id));
      
      // Get readiness
      const [readiness] = await db.select().from(diligenceReadiness).where(and(
        eq(diligenceReadiness.entityType, "company_profile"),
        eq(diligenceReadiness.entityId, input.id),
        eq(diligenceReadiness.organizationId, profile.organizationId)
      )).limit(1);
      
      // Get expiring items
      const expiringItems = await db
        .select({
          expiry: expiryRecords,
          requirement: requirementItems
        })
        .from(expiryRecords)
        .innerJoin(requirementItems, eq(expiryRecords.requirementItemId, requirementItems.id))
        .where(and(
          eq(expiryRecords.entityType, "company_profile"),
          eq(expiryRecords.entityId, input.id),
          inArray(expiryRecords.status, ["due_soon", "due_now", "overdue"])
        ))
        .orderBy(asc(expiryRecords.expiresAt));
      
      return {
        ...profile,
        shareholders,
        directors,
        bankAccounts,
        readiness: readiness || null,
        expiringItems: expiringItems.map(e => ({
          ...e.expiry,
          requirement: e.requirement
        }))
      };
    }),
  
  /**
   * Create or update company profile
   */
  upsertCompanyProfile: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      organizationId: z.number(),
      legalName: z.string(),
      tradingName: z.string().optional(),
      registrationNumber: z.string().optional(),
      taxId: z.string().optional(),
      vatNumber: z.string().optional(),
      incorporationDate: z.date().optional(),
      incorporationCountry: z.string().optional(),
      incorporationState: z.string().optional(),
      companyType: z.string().optional(),
      registeredAddress: z.string().optional(),
      registeredCity: z.string().optional(),
      registeredState: z.string().optional(),
      registeredPostalCode: z.string().optional(),
      registeredCountry: z.string().optional(),
      operatingAddress: z.string().optional(),
      operatingCity: z.string().optional(),
      operatingState: z.string().optional(),
      operatingPostalCode: z.string().optional(),
      operatingCountry: z.string().optional(),
      primaryEmail: z.string().optional(),
      primaryPhone: z.string().optional(),
      website: z.string().optional(),
      industry: z.string().optional(),
      sector: z.string().optional(),
      employeeCount: z.number().optional(),
      vatrData: z.record(z.any()).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      if (input.id) {
        await db.update(companyProfiles)
          .set({
            ...input,
            updatedBy: ctx.user.id,
            updatedAt: new Date()
          })
          .where(eq(companyProfiles.id, input.id));
        
        return { id: input.id };
      } else {
        const [newProfile] = await db.insert(companyProfiles).values({
          ...input,
          status: "active",
          createdBy: ctx.user.id
        } as any);
        
        return { id: Number(newProfile.insertId) };
      }
    }),
  
  /**
   * Create company profile (alias for upsertCompanyProfile without id)
   */
  createCompanyProfile: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      legalName: z.string(),
      tradingName: z.string().optional(),
      registrationNumber: z.string().optional(),
      taxId: z.string().optional(),
      incorporationDate: z.date().optional(),
      jurisdiction: z.string().optional(),
      companyType: z.string().optional(),
      industry: z.string().optional(),
      website: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      
      const [newProfile] = await db.insert(companyProfiles).values({
        organizationId: input.organizationId,
        legalName: input.legalName,
        tradingName: input.tradingName || null,
        registrationNumber: input.registrationNumber || null,
        taxId: input.taxId || null,
        incorporationDate: input.incorporationDate || null,
        incorporationCountry: input.jurisdiction || null,
        companyType: input.companyType || null,
        industry: input.industry || null,
        website: input.website || null,
        primaryEmail: input.email || null,
        primaryPhone: input.phone || null,
        registeredAddress: input.addressLine1 || null,
        registeredCity: input.city || null,
        registeredState: input.state || null,
        registeredPostalCode: input.postalCode || null,
        registeredCountry: input.country || null,
        status: "active",
        createdBy: ctx.user.id
      } as any);
      
      return { id: Number(newProfile.insertId) };
    }),

  // =========================================================================
  // SEED DATA
  // =========================================================================
  
  /**
   * Run seed data (admin only)
   */
  runSeedData: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Check if user is admin
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      
      const result = await runAllSeeds();
      
      return {
        message: "Seed data completed",
        ...result
      };
    }),
  
  // =========================================================================
  // AUDIT LOG
  // =========================================================================
  
  /**
   * Get audit log for an entity
   */
  getAuditLog: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
      limit: z.number().default(50)
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const logs = await db.select().from(diligenceAuditLog)
        .where(and(
          eq(diligenceAuditLog.entityType, input.entityType),
          eq(diligenceAuditLog.entityId, input.entityId)
        ))
        .orderBy(desc(diligenceAuditLog.performedAt))
        .limit(input.limit);
      
      return logs;
    }),

  // =========================================================================
  // TEMPLATE RESPONSES (Workspace)
  // =========================================================================
  
  /**
   * Create a template response (start filling in a template)
   */
  createTemplateResponse: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      companyId: z.number(),
      organizationId: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get template with requirements
      const template = await db.select().from(diligenceTemplates)
        .where(eq(diligenceTemplates.id, input.templateId))
        .limit(1);
      
      if (!template.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      
      // Get template requirements
      const requirements = await db.select().from(templateRequirements)
        .where(eq(templateRequirements.templateId, input.templateId));
      
      // Get company name for response name
      const [company] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.id, input.companyId))
        .limit(1);
      
      // Create response record
      const [{ id: responseId }] = await db.insert(templateResponses).values({
        templateId: input.templateId,
        companyProfileId: input.companyId,
        organizationId: input.organizationId,
        name: `${template[0].name} - ${company?.legalName || 'Company'}`,
        status: "draft",
        createdBy: ctx.user.id,
        createdAt: new Date()
      }).$returningId();
      
      // Create submission records for each requirement
      if (requirements.length > 0) {
        await db.insert(responseSubmissions).values(
          requirements.map(req => ({
            responseId: responseId,
            requirementItemId: req.requirementItemId,
            status: "pending",
            createdAt: new Date()
          }))
        );
      }
      
      return { id: responseId };
    }),
  
  /**
   * Get template response with all submissions
   */
  getTemplateResponse: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      // Get response
      const [response] = await db.select().from(templateResponses)
        .where(eq(templateResponses.id, input.id))
        .limit(1);
      
      if (!response) return null;
      
      // Get template
      const [template] = await db.select().from(diligenceTemplates)
        .where(eq(diligenceTemplates.id, response.templateId))
        .limit(1);
      
      // Get company
      const [company] = await db.select().from(companyProfiles)
        .where(eq(companyProfiles.id, response.companyProfileId || 0))
        .limit(1);
      
      // Get submissions with requirement details
      const submissions = await db.select().from(responseSubmissions)
        .where(eq(responseSubmissions.responseId, input.id));
      
      // Get requirement details for each submission
      const submissionsWithDetails = await Promise.all(submissions.map(async (sub) => {
        const [requirement] = await db.select().from(requirementItems)
          .where(eq(requirementItems.id, sub.requirementItemId))
          .limit(1);
        
        // Files are stored directly in responseSubmissions
        const files = sub.documentUrl ? [{
          id: sub.id,
          name: sub.fileName || 'Document',
          url: sub.documentUrl,
          fileKey: sub.documentKey,
          mimeType: sub.mimeType,
          size: sub.fileSize
        }] : [];
        
        // Get comments
        const comments = await db.select().from(submissionComments)
          .where(eq(submissionComments.submissionId, sub.id))
          .orderBy(desc(submissionComments.createdAt));
        
        // Get history
        const history = await db.select().from(submissionHistory)
          .where(eq(submissionHistory.submissionId, sub.id))
          .orderBy(desc(submissionHistory.createdAt));
        
        // Get extractions
        const extractions = await db.select().from(submissionExtractions)
          .where(eq(submissionExtractions.submissionId, sub.id));
        
        return {
          ...sub,
          requirement,
          files,
          comments,
          history,
          extractions
        };
      }));
      
      return {
        ...response,
        template,
        company,
        submissions: submissionsWithDetails
      };
    }),
  
  /**
   * Upload file to S3 and return URL
   */
  uploadFile: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileData: z.string(), // base64 encoded
      mimeType: z.string(),
      folder: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { storagePut } = await import("../storage");
      
      // Decode base64
      const buffer = Buffer.from(input.fileData, 'base64');
      
      // Generate unique key
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const folder = input.folder || 'submissions';
      const fileKey = `${folder}/${ctx.user.id}/${timestamp}-${randomSuffix}-${input.fileName}`;
      
      // Upload to S3
      const { url, key } = await storagePut(fileKey, buffer, input.mimeType);
      
      return {
        url,
        fileKey: key,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: buffer.length
      };
    }),

  /**
   * Upload submission (document for a requirement)
   */
  uploadSubmission: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      requirementItemId: z.number(),
      files: z.array(z.object({
        name: z.string(),
        url: z.string(),
        fileKey: z.string(),
        mimeType: z.string(),
        size: z.number()
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get submission
      const [submission] = await db.select().from(responseSubmissions)
        .where(and(
          eq(responseSubmissions.responseId, input.responseId),
          eq(responseSubmissions.requirementItemId, input.requirementItemId)
        ))
        .limit(1);
      
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }
      
      // Update submission with file info (use first file)
      const file = input.files[0];
      await db.update(responseSubmissions)
        .set({ 
          status: "uploaded",
          documentUrl: file.url,
          documentKey: file.fileKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.mimeType,
          uploadedAt: new Date(),
          uploadedBy: ctx.user.id
        })
        .where(eq(responseSubmissions.id, submission.id));
      
      // Add history entry
      await db.insert(submissionHistory).values({
        submissionId: submission.id,
        version: 1,
        documentUrl: file.url,
        documentKey: file.fileKey,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.mimeType,
        uploadedBy: ctx.user.id,
        changeNote: `Uploaded ${input.files.length} file(s)`,
        createdAt: new Date()
      });
      
      return { success: true };
    }),
  
  /**
   * Add comment to submission
   */
  addSubmissionComment: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      requirementItemId: z.number(),
      content: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get submission
      const [submission] = await db.select().from(responseSubmissions)
        .where(and(
          eq(responseSubmissions.responseId, input.responseId),
          eq(responseSubmissions.requirementItemId, input.requirementItemId)
        ))
        .limit(1);
      
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }
      
      // Insert comment
      const [comment] = await db.insert(submissionComments).values({
        submissionId: submission.id,
        content: input.content,
        authorId: ctx.user.id,
        authorName: ctx.user.name || "User",
        createdAt: new Date()
      }).returning();
      
      return comment;
    }),
  
  /**
   * Review submission (approve/reject)
   */
  reviewSubmission: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      requirementItemId: z.number(),
      approved: z.boolean(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get submission
      const [submission] = await db.select().from(responseSubmissions)
        .where(and(
          eq(responseSubmissions.responseId, input.responseId),
          eq(responseSubmissions.requirementItemId, input.requirementItemId)
        ))
        .limit(1);
      
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }
      
      // Update submission
      await db.update(responseSubmissions)
        .set({
          status: input.approved ? "approved" : "rejected",
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewNotes: input.notes
        })
        .where(eq(responseSubmissions.id, submission.id));
      
      // Add history entry
      await db.insert(submissionHistory).values({
        submissionId: submission.id,
        action: input.approved ? "approved" : "rejected",
        description: input.notes || (input.approved ? "Approved" : "Rejected"),
        userId: ctx.user.id,
        userName: ctx.user.name || "User",
        createdAt: new Date()
      });
      
      return { success: true };
    }),
  
  /**
   * Add custom section to response
   */
  addCustomSection: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      sectionName: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Create a custom requirement item for this section
      const result = await db.insert(requirementItems).values({
        code: `CUSTOM-${Date.now()}`,
        title: input.sectionName,
        description: "Custom section",
        category: "custom",
        appliesTo: "company_profile",
        requirementType: "document",
        isGlobalDefault: false,
        createdAt: new Date()
      }).$returningId();
      const customItemId = result[0].id;
      
      // Add to response submissions
      await db.insert(responseSubmissions).values({
        responseId: input.responseId,
        requirementItemId: customItemId,
        status: "missing",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { success: true, sectionId: customItemId };
    }),
  
  /**
   * Add requirement to response
   */
  addRequirementToResponse: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      requirementItemId: z.number()
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Check if already exists
      const existing = await db.select().from(responseSubmissions)
        .where(and(
          eq(responseSubmissions.responseId, input.responseId),
          eq(responseSubmissions.requirementItemId, input.requirementItemId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Requirement already added" });
      }
      
      // Add to response
      await db.insert(responseSubmissions).values({
        responseId: input.responseId,
        requirementItemId: input.requirementItemId,
        status: "pending",
        createdAt: new Date()
      });
      
      return { success: true };
    }),
  
  /**
   * List template responses for a company
   */
  listTemplateResponses: protectedProcedure
    .input(z.object({
      companyId: z.number().optional(),
      organizationId: z.number().optional(),
      status: z.string().optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input.companyId) {
        conditions.push(eq(templateResponses.companyId, input.companyId));
      }
      
      if (input.organizationId) {
        conditions.push(eq(templateResponses.organizationId, input.organizationId));
      }
      
      if (input.status) {
        conditions.push(eq(templateResponses.status, input.status as any));
      }
      
      const responses = await db.select().from(templateResponses)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(templateResponses.createdAt));
      
      // Get template and company details for each response
      const responsesWithDetails = await Promise.all(responses.map(async (response) => {
        const [template] = await db.select().from(diligenceTemplates)
          .where(eq(diligenceTemplates.id, response.templateId))
          .limit(1);
        
        const [company] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.id, response.companyProfileId || 0))
          .limit(1);
        
        return {
          ...response,
          template,
          company
        };
      }));
      
      return responsesWithDetails;
    }),

  /**
   * Submit response for review
   */
  submitResponse: protectedProcedure
    .input(z.object({
      responseId: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get response
      const [response] = await db.select().from(templateResponses)
        .where(eq(templateResponses.id, input.responseId))
        .limit(1);
      
      if (!response) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Response not found" });
      }
      
      if (response.status !== "draft") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Response has already been submitted" });
      }
      
      // Check all required submissions are uploaded
      const submissions = await db.select().from(responseSubmissions)
        .where(eq(responseSubmissions.responseId, input.responseId));
      
      const pendingCount = submissions.filter(s => s.status === "pending" || s.status === "missing").length;
      if (pendingCount > 0) {
        throw new TRPCError({ 
          code: "BAD_REQUEST", 
          message: `Cannot submit: ${pendingCount} requirement(s) still pending` 
        });
      }
      
      // Update status to submitted
      await db.update(templateResponses)
        .set({ 
          status: "submitted",
          submittedAt: new Date(),
          submittedBy: ctx.user.id,
          updatedAt: new Date()
        })
        .where(eq(templateResponses.id, input.responseId));
      
      // Lock all submissions
      await db.update(responseSubmissions)
        .set({ 
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: ctx.user.id
        })
        .where(eq(responseSubmissions.responseId, input.responseId));
      
      // Send notification
      try {
        const { notifyResponseSubmitted } = await import("../services/diligenceNotifications");
        const [template] = await db.select().from(diligenceTemplates)
          .where(eq(diligenceTemplates.id, response.templateId))
          .limit(1);
        const [company] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.id, response.companyProfileId))
          .limit(1);
        
        await notifyResponseSubmitted(
          {
            responseName: response.name,
            companyName: company?.legalName || "Unknown Company",
            templateName: template?.name || "Unknown Template",
            responseId: input.responseId
          },
          { id: ctx.user.id, name: ctx.user.name || "User" }
        );
      } catch (e) {
        console.warn("Failed to send notification:", e);
      }
      
      return { success: true };
    }),

  /**
   * Approve or reject response (admin/reviewer)
   */
  reviewResponse: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      approved: z.boolean(),
      notes: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get response
      const [response] = await db.select().from(templateResponses)
        .where(eq(templateResponses.id, input.responseId))
        .limit(1);
      
      if (!response) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Response not found" });
      }
      
      if (response.status !== "submitted" && response.status !== "reviewing") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Response is not pending review" });
      }
      
      const newStatus = input.approved ? "approved" : "rejected";
      
      await db.update(templateResponses)
        .set({ 
          status: newStatus,
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          reviewNotes: input.notes,
          updatedAt: new Date()
        })
        .where(eq(templateResponses.id, input.responseId));
      
      // Send notification
      try {
        const { notifyResponseApproved, notifyResponseRejected } = await import("../services/diligenceNotifications");
        const [template] = await db.select().from(diligenceTemplates)
          .where(eq(diligenceTemplates.id, response.templateId))
          .limit(1);
        const [company] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.id, response.companyProfileId))
          .limit(1);
        
        const context = {
          responseName: response.name,
          companyName: company?.legalName || "Unknown Company",
          templateName: template?.name || "Unknown Template",
          responseId: input.responseId
        };
        const reviewer = { id: ctx.user.id, name: ctx.user.name || "Reviewer" };
        
        if (input.approved) {
          await notifyResponseApproved(context, reviewer);
        } else {
          await notifyResponseRejected(context, reviewer, input.notes);
        }
      } catch (e) {
        console.warn("Failed to send notification:", e);
      }
      
      return { success: true, status: newStatus };
    }),

  /**
   * Request revision (send back to draft)
   */
  requestRevision: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      notes: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get response
      const [response] = await db.select().from(templateResponses)
        .where(eq(templateResponses.id, input.responseId))
        .limit(1);
      
      if (!response) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Response not found" });
      }
      
      // Update status back to draft
      await db.update(templateResponses)
        .set({ 
          status: "draft",
          reviewNotes: input.notes,
          updatedAt: new Date()
        })
        .where(eq(templateResponses.id, input.responseId));
      
      // Unlock submissions for editing
      await db.update(responseSubmissions)
        .set({ 
          isLocked: false,
          lockedAt: null,
          lockedBy: null
        })
        .where(eq(responseSubmissions.responseId, input.responseId));
      
      return { success: true };
    }),

  /**
   * Share response with external party (investor, regulator, etc.)
   */
  shareResponse: protectedProcedure
    .input(z.object({
      responseId: z.number(),
      recipientType: z.enum(["investor", "regulator", "partner", "customer", "other"]),
      recipientName: z.string(),
      recipientEmail: z.string().email().optional(),
      shareMethod: z.enum(["data_room", "email", "portal", "api"]),
      expiresAt: z.date().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get response with all submissions
      const [response] = await db.select().from(templateResponses)
        .where(eq(templateResponses.id, input.responseId))
        .limit(1);
      
      if (!response) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Response not found" });
      }
      
      if (response.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved responses can be shared" });
      }
      
      // Get all submissions for snapshot
      const submissions = await db.select().from(responseSubmissions)
        .where(eq(responseSubmissions.responseId, input.responseId));
      
      // Create snapshot of current data
      const snapshotData = {
        response: {
          id: response.id,
          name: response.name,
          status: response.status,
          completionPercentage: response.completionPercentage,
          submittedAt: response.submittedAt,
          reviewedAt: response.reviewedAt
        },
        submissions: submissions.map(s => ({
          id: s.id,
          requirementItemId: s.requirementItemId,
          status: s.status,
          documentUrl: s.documentUrl,
          fileName: s.fileName,
          uploadedAt: s.uploadedAt
        })),
        sharedAt: new Date()
      };
      
      // Generate access token
      const accessToken = crypto.randomUUID();
      
      // Create shared submission record
      const result = await db.insert(sharedSubmissions).values({
        organizationId: response.organizationId,
        companyProfileId: response.companyProfileId || 0,
        responseId: input.responseId,
        recipientType: input.recipientType,
        recipientName: input.recipientName,
        recipientEmail: input.recipientEmail,
        shareMethod: input.shareMethod,
        accessToken,
        status: "sent",
        snapshotData,
        snapshotVersion: 1,
        sharedAt: new Date(),
        expiresAt: input.expiresAt,
        sharedBy: ctx.user.id,
        createdAt: new Date()
      }).$returningId();
      
      // Send notification
      try {
        const { notifyResponseShared } = await import("../services/diligenceNotifications");
        const [template] = await db.select().from(diligenceTemplates)
          .where(eq(diligenceTemplates.id, response.templateId))
          .limit(1);
        const [company] = await db.select().from(companyProfiles)
          .where(eq(companyProfiles.id, response.companyProfileId))
          .limit(1);
        
        await notifyResponseShared(
          {
            responseName: response.name,
            companyName: company?.legalName || "Unknown Company",
            templateName: template?.name || "Unknown Template",
            responseId: input.responseId
          },
          {
            name: input.recipientName,
            email: input.recipientEmail,
            type: input.recipientType
          },
          { id: ctx.user.id, name: ctx.user.name || "User" }
        );
      } catch (e) {
        console.warn("Failed to send notification:", e);
      }
      
      return { 
        success: true, 
        sharedSubmissionId: result[0].id,
        accessToken 
      };
    }),

  /**
   * Get shared submissions for a response
   */
  getSharedSubmissions: protectedProcedure
    .input(z.object({
      responseId: z.number()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      return db.select().from(sharedSubmissions)
        .where(eq(sharedSubmissions.responseId, input.responseId))
        .orderBy(desc(sharedSubmissions.sharedAt));
    }),

  /**
   * Get sender update alerts (stale data notifications)
   */
  getSenderAlerts: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      status: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [eq(senderUpdateAlerts.status, "active")];
      
      if (input.organizationId) {
        conditions.push(eq(senderUpdateAlerts.organizationId, input.organizationId));
      }
      
      return db.select().from(senderUpdateAlerts)
        .where(and(...conditions))
        .orderBy(desc(senderUpdateAlerts.createdAt));
    }),

  /**
   * Request to push an update to shared submission
   */
  requestUpdatePush: protectedProcedure
    .input(z.object({
      alertId: z.number(),
      reason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get alert
      const [alert] = await db.select().from(senderUpdateAlerts)
        .where(eq(senderUpdateAlerts.id, input.alertId))
        .limit(1);
      
      if (!alert) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Alert not found" });
      }
      
      if (!alert.canPushUpdate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Submission timeline is closed, cannot push updates" });
      }
      
      // Update alert status
      await db.update(senderUpdateAlerts)
        .set({
          status: "push_requested",
          pushRequestedAt: new Date(),
          pushRequestedBy: ctx.user.id
        })
        .where(eq(senderUpdateAlerts.id, input.alertId));
      
      // Create update notification for recipient
      await db.insert(updateNotifications).values({
        sharedSubmissionId: alert.sharedSubmissionId,
        fieldName: alert.fieldName,
        oldValue: alert.submittedValue,
        newValue: alert.currentValue,
        changeReason: input.reason,
        status: "pending",
        isPushRequested: true,
        pushRequestedAt: new Date(),
        pushRequestedBy: ctx.user.id,
        createdAt: new Date()
      });
      
      return { success: true };
    }),

  /**
   * Accept or reject update push (recipient side)
   */
  respondToUpdatePush: protectedProcedure
    .input(z.object({
      notificationId: z.number(),
      accepted: z.boolean(),
      reason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      
      // Get notification
      const [notification] = await db.select().from(updateNotifications)
        .where(eq(updateNotifications.id, input.notificationId))
        .limit(1);
      
      if (!notification) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Notification not found" });
      }
      
      if (input.accepted) {
        // Accept the update
        await db.update(updateNotifications)
          .set({
            status: "accepted",
            acceptedAt: new Date(),
            acceptedBy: ctx.user.id,
            pushApproved: true,
            pushApprovedAt: new Date(),
            pushApprovedBy: ctx.user.id,
            updatedAt: new Date()
          })
          .where(eq(updateNotifications.id, input.notificationId));
        
        // Update the shared submission snapshot with new value
        const [shared] = await db.select().from(sharedSubmissions)
          .where(eq(sharedSubmissions.id, notification.sharedSubmissionId))
          .limit(1);
        
        if (shared) {
          const updatedSnapshot = { ...shared.snapshotData as any };
          updatedSnapshot[notification.fieldName] = notification.newValue;
          updatedSnapshot.lastUpdated = new Date();
          
          await db.update(sharedSubmissions)
            .set({
              snapshotData: updatedSnapshot,
              snapshotVersion: shared.snapshotVersion + 1,
              updatedAt: new Date()
            })
            .where(eq(sharedSubmissions.id, notification.sharedSubmissionId));
        }
        
        // Update sender alert
        await db.update(senderUpdateAlerts)
          .set({
            status: "push_sent",
            pushSentAt: new Date()
          })
          .where(eq(senderUpdateAlerts.sharedSubmissionId, notification.sharedSubmissionId));
      } else {
        // Reject the update
        await db.update(updateNotifications)
          .set({
            status: "rejected",
            rejectedAt: new Date(),
            rejectedBy: ctx.user.id,
            rejectionReason: input.reason,
            pushApproved: false,
            updatedAt: new Date()
          })
          .where(eq(updateNotifications.id, input.notificationId));
        
        // Update sender alert
        await db.update(senderUpdateAlerts)
          .set({
            status: "dismissed"
          })
          .where(eq(senderUpdateAlerts.sharedSubmissionId, notification.sharedSubmissionId));
      }
      
      return { success: true, accepted: input.accepted };
    }),

  /**
   * Get update notifications for recipient
   */
  getUpdateNotifications: protectedProcedure
    .input(z.object({
      sharedSubmissionId: z.number().optional(),
      status: z.string().optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      const conditions = [];
      
      if (input.sharedSubmissionId) {
        conditions.push(eq(updateNotifications.sharedSubmissionId, input.sharedSubmissionId));
      }
      
      if (input.status) {
        conditions.push(eq(updateNotifications.status, input.status as any));
      }
      
      return db.select().from(updateNotifications)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(updateNotifications.createdAt));
    }),

  /**
   * Get data room by access token (public access for recipients)
   */
  getDataRoomByToken: publicProcedure
    .input(z.object({
      accessToken: z.string()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const [shared] = await db.select().from(sharedSubmissions)
        .where(eq(sharedSubmissions.accessToken, input.accessToken))
        .limit(1);
      
      if (!shared) return null;
      
      // Check if expired
      if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
        return null;
      }
      
      // Mark as viewed if first time
      if (!shared.viewedAt) {
        await db.update(sharedSubmissions)
          .set({ viewedAt: new Date() })
          .where(eq(sharedSubmissions.id, shared.id));
      }
      
      return shared;
    }),

  /**
   * AI: Analyze uploaded document for compliance
   */
  aiAnalyzeDocument: protectedProcedure
    .input(z.object({
      documentUrl: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      requirementTitle: z.string(),
      requirementDescription: z.string()
    }))
    .mutation(async ({ input }) => {
      const { analyzeDocument } = await import("../services/diligenceAI");
      return analyzeDocument(input);
    }),

  /**
   * AI: Get suggestions for completing a requirement
   */
  aiSuggestCompletion: protectedProcedure
    .input(z.object({
      requirementTitle: z.string(),
      requirementDescription: z.string(),
      companyName: z.string(),
      companyType: z.string().optional(),
      existingDocuments: z.array(z.object({
        name: z.string(),
        type: z.string()
      })).optional()
    }))
    .mutation(async ({ input }) => {
      const { suggestRequirementCompletion } = await import("../services/diligenceAI");
      return suggestRequirementCompletion(input);
    }),

  /**
   * AI: Generate compliance review summary
   */
  aiGenerateReview: protectedProcedure
    .input(z.object({
      templateName: z.string(),
      companyName: z.string(),
      submissions: z.array(z.object({
        requirementTitle: z.string(),
        status: z.string(),
        documentName: z.string().optional(),
        issues: z.array(z.string()).optional()
      }))
    }))
    .mutation(async ({ input }) => {
      const { generateComplianceReview } = await import("../services/diligenceAI");
      return generateComplianceReview(input);
    }),

  /**
   * AI: Chat with compliance assistant
   */
  aiChat: protectedProcedure
    .input(z.object({
      message: z.string(),
      context: z.object({
        templateName: z.string().optional(),
        companyName: z.string().optional(),
        currentRequirement: z.string().optional(),
        submissionStatus: z.string().optional()
      }),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string()
      })).optional()
    }))
    .mutation(async ({ input }) => {
      const { chatWithAssistant } = await import("../services/diligenceAI");
      return chatWithAssistant(input);
    }),

  // =========================================================================
  // DOCUMENT VERSIONING
  // =========================================================================

  /**
   * Get version history for a submission
   */
  getVersionHistory: protectedProcedure
    .input(z.object({
      submissionId: z.number()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const versions = await db.select()
        .from(documentVersions)
        .where(eq(documentVersions.submissionId, input.submissionId))
        .orderBy(desc(documentVersions.version));

      return versions;
    }),

  /**
   * Upload new version of a document
   */
  uploadNewVersion: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileKey: z.string(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
      changeNotes: z.string().optional(),
      checksum: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get current max version
      const existing = await db.select()
        .from(documentVersions)
        .where(eq(documentVersions.submissionId, input.submissionId))
        .orderBy(desc(documentVersions.version))
        .limit(1);

      const nextVersion = existing.length > 0 ? (existing[0].version || 0) + 1 : 1;

      // Mark all previous versions as not current
      await db.update(documentVersions)
        .set({ isCurrentVersion: false })
        .where(eq(documentVersions.submissionId, input.submissionId));

      // Insert new version
      const [newVersion] = await db.insert(documentVersions).values({
        submissionId: input.submissionId,
        version: nextVersion,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadedById: ctx.user.id,
        uploadedByName: ctx.user.name || "Unknown",
        notes: input.changeNotes,
        isCurrentVersion: true,
        checksum: input.checksum
      }).$returningId();

      // Update the submission with new document
      await db.update(responseSubmissions)
        .set({
          documentUrl: input.fileUrl,
          documentKey: input.fileKey,
          documentName: input.fileName,
          updatedAt: new Date()
        })
        .where(eq(responseSubmissions.id, input.submissionId));

      return { id: newVersion.id, version: nextVersion };
    }),

  /**
   * Rollback to a previous version
   */
  rollbackVersion: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      versionId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get the version to rollback to
      const [targetVersion] = await db.select()
        .from(documentVersions)
        .where(and(
          eq(documentVersions.id, input.versionId),
          eq(documentVersions.submissionId, input.submissionId)
        ));

      if (!targetVersion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      }

      // Mark all versions as not current
      await db.update(documentVersions)
        .set({ isCurrentVersion: false })
        .where(eq(documentVersions.submissionId, input.submissionId));

      // Mark target version as current
      await db.update(documentVersions)
        .set({ isCurrentVersion: true })
        .where(eq(documentVersions.id, input.versionId));

      // Update the submission with rollback document
      await db.update(responseSubmissions)
        .set({
          documentUrl: targetVersion.fileUrl,
          documentKey: targetVersion.fileKey,
          documentName: targetVersion.fileName,
          updatedAt: new Date()
        })
        .where(eq(responseSubmissions.id, input.submissionId));

      // Log the rollback in history
      await db.insert(submissionHistory).values({
        submissionId: input.submissionId,
        action: "rollback",
        previousStatus: "current",
        newStatus: `v${targetVersion.version}`,
        changedBy: ctx.user.id,
        changedByName: ctx.user.name || "Unknown",
        notes: `Rolled back to version ${targetVersion.version}`
      });

      return { success: true, version: targetVersion.version };
    }),

  /**
   * Compare two versions
   */
  compareVersions: protectedProcedure
    .input(z.object({
      submissionId: z.number(),
      versionA: z.number(),
      versionB: z.number()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const versions = await db.select()
        .from(documentVersions)
        .where(and(
          eq(documentVersions.submissionId, input.submissionId),
          inArray(documentVersions.version, [input.versionA, input.versionB])
        ));

      const vA = versions.find(v => v.version === input.versionA);
      const vB = versions.find(v => v.version === input.versionB);

      if (!vA || !vB) {
        return null;
      }

      return {
        versionA: vA,
        versionB: vB,
        changes: {
          fileName: vA.fileName !== vB.fileName,
          fileSize: vA.fileSize !== vB.fileSize,
          checksum: vA.checksum !== vB.checksum,
          uploadedBy: vA.uploadedById !== vB.uploadedById,
          uploadDate: vA.createdAt?.getTime() !== vB.createdAt?.getTime()
        }
      };
    }),

  // =========================================================================
  // BATCH APPROVAL
  // =========================================================================

  /**
   * Batch update submission statuses
   */
  batchUpdateStatus: protectedProcedure
    .input(z.object({
      submissionIds: z.array(z.number()),
      status: z.enum(["pending", "uploaded", "under_review", "approved", "rejected", "needs_revision"]),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const results = [];

      for (const submissionId of input.submissionIds) {
        // Get current submission
        const [submission] = await db.select()
          .from(responseSubmissions)
          .where(eq(responseSubmissions.id, submissionId));

        if (!submission) continue;

        const previousStatus = submission.status;

        // Update status
        await db.update(responseSubmissions)
          .set({
            status: input.status,
            reviewedBy: ctx.user.id,
            reviewedByName: ctx.user.name || "Unknown",
            reviewedAt: new Date(),
            reviewNotes: input.notes,
            updatedAt: new Date()
          })
          .where(eq(responseSubmissions.id, submissionId));

        // Log in history
        await db.insert(submissionHistory).values({
          submissionId,
          action: "batch_status_update",
          previousStatus,
          newStatus: input.status,
          changedBy: ctx.user.id,
          changedByName: ctx.user.name || "Unknown",
          notes: input.notes || `Batch updated to ${input.status}`
        });

        results.push({ submissionId, success: true, previousStatus, newStatus: input.status });
      }

      return { updated: results.length, results };
    }),

  /**
   * Batch approve submissions
   */
  batchApprove: protectedProcedure
    .input(z.object({
      submissionIds: z.array(z.number()),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let approved = 0;
      let skipped = 0;

      for (const submissionId of input.submissionIds) {
        const [submission] = await db.select()
          .from(responseSubmissions)
          .where(eq(responseSubmissions.id, submissionId));

        if (!submission || submission.status === "approved") {
          skipped++;
          continue;
        }

        await db.update(responseSubmissions)
          .set({
            status: "approved",
            reviewedBy: ctx.user.id,
            reviewedByName: ctx.user.name || "Unknown",
            reviewedAt: new Date(),
            reviewNotes: input.notes,
            updatedAt: new Date()
          })
          .where(eq(responseSubmissions.id, submissionId));

        await db.insert(submissionHistory).values({
          submissionId,
          action: "batch_approve",
          previousStatus: submission.status,
          newStatus: "approved",
          changedBy: ctx.user.id,
          changedByName: ctx.user.name || "Unknown",
          notes: input.notes || "Batch approved"
        });

        approved++;
      }

      return { approved, skipped, total: input.submissionIds.length };
    }),

  /**
   * Batch reject submissions
   */
  batchReject: protectedProcedure
    .input(z.object({
      submissionIds: z.array(z.number()),
      reason: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let rejected = 0;
      let skipped = 0;

      for (const submissionId of input.submissionIds) {
        const [submission] = await db.select()
          .from(responseSubmissions)
          .where(eq(responseSubmissions.id, submissionId));

        if (!submission || submission.status === "rejected") {
          skipped++;
          continue;
        }

        await db.update(responseSubmissions)
          .set({
            status: "rejected",
            reviewedBy: ctx.user.id,
            reviewedByName: ctx.user.name || "Unknown",
            reviewedAt: new Date(),
            reviewNotes: input.reason,
            updatedAt: new Date()
          })
          .where(eq(responseSubmissions.id, submissionId));

        await db.insert(submissionHistory).values({
          submissionId,
          action: "batch_reject",
          previousStatus: submission.status,
          newStatus: "rejected",
          changedBy: ctx.user.id,
          changedByName: ctx.user.name || "Unknown",
          notes: input.reason
        });

        rejected++;
      }

      return { rejected, skipped, total: input.submissionIds.length };
    }),

  // =========================================================================
  // COMPLIANCE ANALYTICS
  // =========================================================================

  /**
   * Get compliance dashboard analytics
   */
  getComplianceAnalytics: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get all responses
      const responses = await db.select()
        .from(templateResponses);

      // Get all submissions
      const submissions = await db.select()
        .from(responseSubmissions);

      // Calculate metrics
      const totalResponses = responses.length;
      const responsesByStatus = {
        draft: responses.filter(r => r.status === "draft").length,
        submitted: responses.filter(r => r.status === "submitted").length,
        under_review: responses.filter(r => r.status === "under_review").length,
        approved: responses.filter(r => r.status === "approved").length,
        rejected: responses.filter(r => r.status === "rejected").length
      };

      const totalSubmissions = submissions.length;
      const submissionsByStatus = {
        pending: submissions.filter(s => s.status === "pending").length,
        uploaded: submissions.filter(s => s.status === "uploaded").length,
        under_review: submissions.filter(s => s.status === "under_review").length,
        approved: submissions.filter(s => s.status === "approved").length,
        rejected: submissions.filter(s => s.status === "rejected").length,
        needs_revision: submissions.filter(s => s.status === "needs_revision").length
      };

      // Calculate completion rates
      const completedSubmissions = submissions.filter(s => 
        s.status === "approved" || s.status === "uploaded"
      ).length;
      const completionRate = totalSubmissions > 0 
        ? Math.round((completedSubmissions / totalSubmissions) * 100) 
        : 0;

      // Calculate average review time (for reviewed submissions)
      const reviewedSubmissions = submissions.filter(s => 
        s.reviewedAt && s.createdAt
      );
      let avgReviewTimeHours = 0;
      if (reviewedSubmissions.length > 0) {
        const totalReviewTime = reviewedSubmissions.reduce((sum, s) => {
          const reviewTime = s.reviewedAt!.getTime() - s.createdAt!.getTime();
          return sum + reviewTime;
        }, 0);
        avgReviewTimeHours = Math.round(totalReviewTime / reviewedSubmissions.length / (1000 * 60 * 60));
      }

      // Get upload trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSubmissions = submissions.filter(s => 
        s.createdAt && s.createdAt >= thirtyDaysAgo
      );

      // Group by date
      const uploadTrends: Record<string, number> = {};
      recentSubmissions.forEach(s => {
        if (s.createdAt) {
          const dateKey = s.createdAt.toISOString().split('T')[0];
          uploadTrends[dateKey] = (uploadTrends[dateKey] || 0) + 1;
        }
      });

      // Get company completion rates
      const companyStats: Record<number, { total: number; completed: number; name: string }> = {};
      for (const response of responses) {
        if (!response.companyProfileId) continue;
        
        if (!companyStats[response.companyProfileId]) {
          companyStats[response.companyProfileId] = { total: 0, completed: 0, name: "" };
        }
        
        const responseSubmissions_ = submissions.filter(s => s.responseId === response.id);
        companyStats[response.companyProfileId].total += responseSubmissions_.length;
        companyStats[response.companyProfileId].completed += responseSubmissions_.filter(s => 
          s.status === "approved" || s.status === "uploaded"
        ).length;
      }

      // Get company names
      const companies = await db.select()
        .from(companyProfiles)
        .where(inArray(companyProfiles.id, Object.keys(companyStats).map(Number)));

      companies.forEach(c => {
        if (companyStats[c.id]) {
          companyStats[c.id].name = c.name || "Unknown";
        }
      });

      const companyCompletionRates = Object.entries(companyStats).map(([id, stats]) => ({
        companyId: Number(id),
        companyName: stats.name,
        total: stats.total,
        completed: stats.completed,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      }));

      return {
        overview: {
          totalResponses,
          totalSubmissions,
          completionRate,
          avgReviewTimeHours
        },
        responsesByStatus,
        submissionsByStatus,
        uploadTrends: Object.entries(uploadTrends).map(([date, count]) => ({ date, count })),
        companyCompletionRates
      };
    }),

  /**
   * Get requirement completion heatmap
   */
  getRequirementHeatmap: protectedProcedure
    .input(z.object({
      templateId: z.number().optional()
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all requirements
      const requirements = await db.select()
        .from(requirementItems);

      // Get all submissions
      const submissions = await db.select()
        .from(responseSubmissions);

      // Calculate completion rate per requirement
      const heatmapData = requirements.map(req => {
        const reqSubmissions = submissions.filter(s => s.requirementItemId === req.id);
        const completed = reqSubmissions.filter(s => 
          s.status === "approved" || s.status === "uploaded"
        ).length;
        const total = reqSubmissions.length;

        return {
          requirementId: req.id,
          requirementTitle: req.title,
          category: req.category,
          total,
          completed,
          rate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
      });

      return heatmapData;
    })
});
