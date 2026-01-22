/**
 * Phase 36: Obligations tRPC Router
 * 
 * Provides CRUD operations for obligations with RBAC guards.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createObligation,
  getObligationById,
  listObligations,
  updateObligation,
  updateObligationStatus,
  getObligationsDueSoon,
  getOverdueObligations,
  createObligationLink,
  getObligationLinks,
  getObligationsForEntity,
  removeObligationLink,
  assignObligation,
  getObligationAssignments,
  getObligationsAssignedToUser,
  unassignObligation,
  logObligationAction,
  getObligationAuditLog,
  getObligationsForView,
  addObligationToView,
  removeObligationFromView
} from "../db";

// Validation schemas
const obligationTypeSchema = z.enum([
  "RFI_ITEM",
  "APPROVAL_GATE",
  "WORK_ORDER",
  "MAINTENANCE",
  "DOCUMENT_EXPIRY",
  "MILESTONE",
  "REPORT_DEADLINE",
  "COMPLIANCE_REQUIREMENT",
  "CUSTOM"
]);

const obligationStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "WAITING_REVIEW",
  "APPROVED",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED"
]);

const obligationPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

const obligationVisibilitySchema = z.enum([
  "INTERNAL_ONLY",
  "ORG_SHARED",
  "EXTERNAL_GRANTED"
]);

const entityTypeSchema = z.enum([
  "ASSET",
  "PROJECT",
  "SITE",
  "DATAROOM",
  "RFI",
  "WORKSPACE_VIEW",
  "DOCUMENT",
  "PORTFOLIO"
]);

const linkTypeSchema = z.enum(["PRIMARY", "SECONDARY"]);

const assignmentRoleSchema = z.enum([
  "OWNER",
  "CONTRIBUTOR",
  "REVIEWER",
  "APPROVER"
]);

const assigneeTypeSchema = z.enum(["USER", "TEAM"]);

export const obligationsRouter = router({
  /**
   * Create a new obligation
   */
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      obligationType: obligationTypeSchema,
      priority: obligationPrioritySchema.optional().default("MEDIUM"),
      startAt: z.date().optional(),
      dueAt: z.date().optional(),
      timezone: z.string().optional().default("UTC"),
      recurrenceRule: z.string().optional(),
      reminderPolicyId: z.number().optional(),
      escalationPolicyId: z.number().optional(),
      visibility: obligationVisibilitySchema.optional().default("ORG_SHARED"),
      sourceRef: z.object({
        docId: z.number().optional(),
        formId: z.number().optional(),
        rfiId: z.number().optional(),
        workOrderId: z.number().optional(),
        clauseRef: z.string().optional(),
        checklistItemId: z.number().optional(),
        complianceItemId: z.number().optional()
      }).optional(),
      vatrFieldPointers: z.object({
        clusterId: z.string().optional(),
        fieldIds: z.array(z.string()).optional(),
        assetId: z.number().optional()
      }).optional(),
      // Initial link
      linkedEntity: z.object({
        entityType: entityTypeSchema,
        entityId: z.number(),
        linkType: linkTypeSchema.optional().default("PRIMARY")
      }).optional(),
      // Initial assignments
      assignees: z.array(z.object({
        assigneeType: assigneeTypeSchema,
        assigneeId: z.number(),
        role: assignmentRoleSchema.optional().default("CONTRIBUTOR")
      })).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Create the obligation
      const obligationId = await createObligation({
        organizationId,
        createdByUserId: ctx.user.id,
        title: input.title,
        description: input.description,
        obligationType: input.obligationType,
        status: "OPEN",
        priority: input.priority,
        startAt: input.startAt,
        dueAt: input.dueAt,
        timezone: input.timezone,
        recurrenceRule: input.recurrenceRule,
        reminderPolicyId: input.reminderPolicyId,
        escalationPolicyId: input.escalationPolicyId,
        visibility: input.visibility,
        sourceType: "MANUAL",
        sourceRef: input.sourceRef,
        vatrFieldPointers: input.vatrFieldPointers
      });

      // Create initial link if provided
      if (input.linkedEntity) {
        await createObligationLink({
          organizationId,
          obligationId,
          entityType: input.linkedEntity.entityType,
          entityId: input.linkedEntity.entityId,
          linkType: input.linkedEntity.linkType,
          createdByUserId: ctx.user.id
        });
      }

      // Create initial assignments if provided
      if (input.assignees?.length) {
        for (const assignee of input.assignees) {
          await assignObligation({
            organizationId,
            obligationId,
            assigneeType: assignee.assigneeType,
            assigneeId: assignee.assigneeId,
            role: assignee.role,
            createdByUserId: ctx.user.id
          });
        }
      }

      // Log creation
      await logObligationAction({
        organizationId,
        obligationId,
        action: "CREATED",
        newValue: { title: input.title, obligationType: input.obligationType },
        userId: ctx.user.id,
        systemGenerated: false
      });

      return { id: obligationId };
    }),

  /**
   * Get obligation by ID
   */
  get: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const obligation = await getObligationById(input.id, organizationId);
      if (!obligation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      // Get links and assignments
      const [links, assignments] = await Promise.all([
        getObligationLinks(input.id, organizationId),
        getObligationAssignments(input.id, organizationId)
      ]);

      return {
        ...obligation,
        links,
        assignments
      };
    }),

  /**
   * List upcoming obligations (for dashboard widget)
   * Returns obligations due soon, sorted by due date
   */
  listUpcoming: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      projectId: z.number().optional(),
      assetId: z.number().optional(),
      limit: z.number().min(1).max(50).optional().default(10)
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = input.organizationId || ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Get obligations due in the next 30 days + overdue
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const obligations = await listObligations(organizationId, {
        status: ["OPEN", "IN_PROGRESS", "BLOCKED", "WAITING_REVIEW", "OVERDUE"],
        entityType: input.assetId ? "ASSET" : input.projectId ? "PROJECT" : undefined,
        entityId: input.assetId || input.projectId,
        dueBefore: thirtyDaysFromNow,
        limit: input.limit,
        offset: 0
      });

      // Sort by due date (nulls last), then by priority
      return obligations.sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }).map(ob => ({
        id: ob.id,
        title: ob.title,
        obligationType: ob.obligationType,
        status: ob.status,
        priority: ob.priority,
        dueDate: ob.dueAt,
        assetName: null as string | null, // Would need join to get entity name
        assigneeCount: 0 // Would need join to get assignee count
      }));
    }),

  /**
   * List obligations with filters
   */
  list: protectedProcedure
    .input(z.object({
      status: z.array(obligationStatusSchema).optional(),
      obligationType: z.array(obligationTypeSchema).optional(),
      priority: z.array(obligationPrioritySchema).optional(),
      assigneeUserId: z.number().optional(),
      entityType: entityTypeSchema.optional(),
      entityId: z.number().optional(),
      dueBefore: z.date().optional(),
      dueAfter: z.date().optional(),
      limit: z.number().min(1).max(100).optional().default(50),
      offset: z.number().min(0).optional().default(0)
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const obligations = await listObligations(organizationId, {
        status: input.status,
        obligationType: input.obligationType,
        priority: input.priority,
        assigneeUserId: input.assigneeUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        dueBefore: input.dueBefore,
        dueAfter: input.dueAfter,
        limit: input.limit,
        offset: input.offset
      });

      return obligations;
    }),

  /**
   * Update obligation
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      priority: obligationPrioritySchema.optional(),
      startAt: z.date().nullable().optional(),
      dueAt: z.date().nullable().optional(),
      timezone: z.string().optional(),
      recurrenceRule: z.string().nullable().optional(),
      reminderPolicyId: z.number().nullable().optional(),
      escalationPolicyId: z.number().nullable().optional(),
      visibility: obligationVisibilitySchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const existing = await getObligationById(input.id, organizationId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      const { id, ...updates } = input;
      const success = await updateObligation(id, organizationId, updates as any);

      if (success) {
        await logObligationAction({
          organizationId,
          obligationId: id,
          action: "UPDATED",
          previousValue: { title: existing.title, priority: existing.priority },
          newValue: updates,
          userId: ctx.user.id,
          systemGenerated: false
        });
      }

      return { success };
    }),

  /**
   * Update obligation status
   */
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: obligationStatusSchema
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const existing = await getObligationById(input.id, organizationId);
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      const success = await updateObligationStatus(
        input.id,
        organizationId,
        input.status,
        input.status === "COMPLETED" ? ctx.user.id : undefined
      );

      if (success) {
        await logObligationAction({
          organizationId,
          obligationId: input.id,
          action: "STATUS_CHANGED",
          previousValue: { status: existing.status },
          newValue: { status: input.status },
          userId: ctx.user.id,
          systemGenerated: false
        });
      }

      return { success };
    }),

  /**
   * Get obligations due soon
   */
  getDueSoon: protectedProcedure
    .input(z.object({
      daysAhead: z.number().min(1).max(90).optional().default(7)
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await getObligationsDueSoon(organizationId, input.daysAhead);
    }),

  /**
   * Get overdue obligations
   */
  getOverdue: protectedProcedure
    .query(async ({ ctx }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await getOverdueObligations(organizationId);
    }),

  /**
   * Get my assigned obligations
   */
  getMyAssignments: protectedProcedure
    .input(z.object({
      status: z.array(obligationStatusSchema).optional(),
      role: assignmentRoleSchema.optional()
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await getObligationsAssignedToUser(ctx.user.id, organizationId, {
        status: input.status,
        role: input.role
      });
    }),

  /**
   * Link obligation to entity
   */
  link: protectedProcedure
    .input(z.object({
      obligationId: z.number(),
      entityType: entityTypeSchema,
      entityId: z.number(),
      linkType: linkTypeSchema.optional().default("SECONDARY")
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Verify obligation exists
      const obligation = await getObligationById(input.obligationId, organizationId);
      if (!obligation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      const linkId = await createObligationLink({
        organizationId,
        obligationId: input.obligationId,
        entityType: input.entityType,
        entityId: input.entityId,
        linkType: input.linkType,
        createdByUserId: ctx.user.id
      });

      await logObligationAction({
        organizationId,
        obligationId: input.obligationId,
        action: "LINKED",
        newValue: { entityType: input.entityType, entityId: input.entityId },
        userId: ctx.user.id,
        systemGenerated: false
      });

      return { id: linkId };
    }),

  /**
   * Unlink obligation from entity
   */
  unlink: protectedProcedure
    .input(z.object({
      obligationId: z.number(),
      entityType: entityTypeSchema,
      entityId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const success = await removeObligationLink(
        input.obligationId,
        input.entityType,
        input.entityId,
        organizationId
      );

      if (success) {
        await logObligationAction({
          organizationId,
          obligationId: input.obligationId,
          action: "UNLINKED",
          previousValue: { entityType: input.entityType, entityId: input.entityId },
          userId: ctx.user.id,
          systemGenerated: false
        });
      }

      return { success };
    }),

  /**
   * Get obligations for an entity
   */
  getForEntity: protectedProcedure
    .input(z.object({
      entityType: entityTypeSchema,
      entityId: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await getObligationsForEntity(input.entityType, input.entityId, organizationId);
    }),

  /**
   * Assign user/team to obligation
   */
  assign: protectedProcedure
    .input(z.object({
      obligationId: z.number(),
      assigneeType: assigneeTypeSchema,
      assigneeId: z.number(),
      role: assignmentRoleSchema.optional().default("CONTRIBUTOR")
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Verify obligation exists
      const obligation = await getObligationById(input.obligationId, organizationId);
      if (!obligation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      const assignmentId = await assignObligation({
        organizationId,
        obligationId: input.obligationId,
        assigneeType: input.assigneeType,
        assigneeId: input.assigneeId,
        role: input.role,
        createdByUserId: ctx.user.id
      });

      await logObligationAction({
        organizationId,
        obligationId: input.obligationId,
        action: "ASSIGNED",
        newValue: { assigneeType: input.assigneeType, assigneeId: input.assigneeId, role: input.role },
        userId: ctx.user.id,
        systemGenerated: false
      });

      return { id: assignmentId };
    }),

  /**
   * Unassign user/team from obligation
   */
  unassign: protectedProcedure
    .input(z.object({
      obligationId: z.number(),
      assigneeType: assigneeTypeSchema,
      assigneeId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const success = await unassignObligation(
        input.obligationId,
        input.assigneeType,
        input.assigneeId,
        organizationId
      );

      if (success) {
        await logObligationAction({
          organizationId,
          obligationId: input.obligationId,
          action: "UNASSIGNED",
          previousValue: { assigneeType: input.assigneeType, assigneeId: input.assigneeId },
          userId: ctx.user.id,
          systemGenerated: false
        });
      }

      return { success };
    }),

  /**
   * Get audit log for an obligation
   */
  getAuditLog: protectedProcedure
    .input(z.object({
      obligationId: z.number(),
      limit: z.number().min(1).max(100).optional().default(50)
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Verify obligation exists
      const obligation = await getObligationById(input.obligationId, organizationId);
      if (!obligation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Obligation not found"
        });
      }

      return await getObligationAuditLog(input.obligationId, organizationId, input.limit);
    }),

  /**
   * Get obligations for a view (calendar overlay)
   */
  getForView: protectedProcedure
    .input(z.object({
      viewId: z.number()
    }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      return await getObligationsForView(input.viewId, organizationId);
    }),

  /**
   * Add obligation to view overlay
   */
  addToView: protectedProcedure
    .input(z.object({
      viewId: z.number(),
      obligationId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const id = await addObligationToView(input.viewId, input.obligationId, organizationId);
      return { id };
    }),

  /**
   * Remove obligation from view overlay
   */
  removeFromView: protectedProcedure
    .input(z.object({
      viewId: z.number(),
      obligationId: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const success = await removeObligationFromView(input.viewId, input.obligationId, ctx.user.id);
      return { success };
    }),

  // ==================== Reminder Policies ====================

  /**
   * List reminder policies for the organization
   */
  listReminderPolicies: protectedProcedure
    .query(async ({ ctx }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return [] as Array<{
        id: number;
        name: string;
        obligationType: string | null;
        isDefault: boolean;
        isActive: boolean;
        reminderOffsets: number[];
        escalationOffsets: number[];
        channels: string[];
      }>;
    }),

  /**
   * Create a reminder policy
   */
  createReminderPolicy: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      obligationType: obligationTypeSchema.optional(),
      isDefault: z.boolean().optional().default(false),
      reminderOffsets: z.array(z.number()),
      escalationOffsets: z.array(z.number()),
      channels: z.array(z.enum(["EMAIL", "WHATSAPP", "IN_APP", "PUSH"]))
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return { id: 1 };
    }),

  /**
   * Toggle reminder policy active status
   */
  toggleReminderPolicy: protectedProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return { success: true };
    }),

  /**
   * Delete a reminder policy
   */
  deleteReminderPolicy: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return { success: true };
    }),

  // ==================== Calendar Integrations ====================

  /**
   * List calendar integrations for the user
   */
  listCalendarIntegrations: protectedProcedure
    .query(async ({ ctx }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return [] as Array<{
        id: number;
        calendarName: string | null;
        provider: string;
        lastSyncAt: Date | null;
        lastSyncError: string | null;
        syncEnabled: boolean;
      }>;
    }),

  /**
   * Toggle calendar integration sync
   */
  toggleCalendarIntegration: protectedProcedure
    .input(z.object({
      id: z.number(),
      syncEnabled: z.boolean()
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }
      // TODO: Implement db function
      return { success: true };
    }),

  // ==================== Obligation Templates ====================

  /**
   * Get available obligation templates
   */
  getTemplates: protectedProcedure
    .query(async () => {
      // Return predefined obligation templates
      return [
        {
          id: "document_review",
          name: "Document Review",
          description: "Review and approve a document within the specified deadline",
          type: "APPROVAL_GATE" as const,
          priority: "MEDIUM" as const,
          defaultDaysToComplete: 7,
          fields: [
            { key: "documentId", label: "Document", type: "reference", required: true },
            { key: "reviewNotes", label: "Review Notes", type: "text", required: false },
          ],
        },
        {
          id: "compliance_check",
          name: "Compliance Check",
          description: "Verify compliance with regulatory requirements",
          type: "COMPLIANCE_REQUIREMENT" as const,
          priority: "HIGH" as const,
          defaultDaysToComplete: 14,
          fields: [
            { key: "regulationRef", label: "Regulation Reference", type: "text", required: true },
            { key: "checklistItems", label: "Checklist Items", type: "array", required: true },
            { key: "evidenceRequired", label: "Evidence Required", type: "boolean", required: true },
          ],
        },
        {
          id: "quarterly_report",
          name: "Quarterly Report",
          description: "Submit quarterly performance report",
          type: "REPORT_DEADLINE" as const,
          priority: "HIGH" as const,
          defaultDaysToComplete: 30,
          fields: [
            { key: "quarter", label: "Quarter", type: "select", options: ["Q1", "Q2", "Q3", "Q4"], required: true },
            { key: "year", label: "Year", type: "number", required: true },
            { key: "reportType", label: "Report Type", type: "select", options: ["Financial", "Operational", "ESG", "Combined"], required: true },
          ],
        },
        {
          id: "maintenance_schedule",
          name: "Scheduled Maintenance",
          description: "Complete scheduled maintenance task",
          type: "MAINTENANCE" as const,
          priority: "MEDIUM" as const,
          defaultDaysToComplete: 7,
          fields: [
            { key: "assetId", label: "Asset", type: "reference", required: true },
            { key: "maintenanceType", label: "Maintenance Type", type: "select", options: ["Preventive", "Corrective", "Inspection"], required: true },
            { key: "workOrderRef", label: "Work Order Reference", type: "text", required: false },
          ],
        },
        {
          id: "document_expiry",
          name: "Document Renewal",
          description: "Renew expiring document before deadline",
          type: "DOCUMENT_EXPIRY" as const,
          priority: "HIGH" as const,
          defaultDaysToComplete: 30,
          fields: [
            { key: "documentId", label: "Document", type: "reference", required: true },
            { key: "expiryDate", label: "Expiry Date", type: "date", required: true },
            { key: "renewalProcess", label: "Renewal Process", type: "text", required: false },
          ],
        },
        {
          id: "milestone_gate",
          name: "Project Milestone",
          description: "Complete project milestone and obtain sign-off",
          type: "MILESTONE" as const,
          priority: "HIGH" as const,
          defaultDaysToComplete: 14,
          fields: [
            { key: "milestoneName", label: "Milestone Name", type: "text", required: true },
            { key: "projectId", label: "Project", type: "reference", required: true },
            { key: "deliverables", label: "Deliverables", type: "array", required: true },
            { key: "approvers", label: "Approvers", type: "array", required: true },
          ],
        },
      ];
    }),

  /**
   * Create obligation from template
   */
  createFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      dueDate: z.date(),
      priority: obligationPrioritySchema.optional(),
      linkedEntityType: entityTypeSchema.optional(),
      linkedEntityId: z.number().optional(),
      customFields: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      // Map template to obligation type
      const templateTypeMap: Record<string, string> = {
        document_review: "APPROVAL_GATE",
        compliance_check: "COMPLIANCE_REQUIREMENT",
        quarterly_report: "REPORT_DEADLINE",
        maintenance_schedule: "MAINTENANCE",
        document_expiry: "DOCUMENT_EXPIRY",
        milestone_gate: "MILESTONE",
      };

      const obligationType = templateTypeMap[input.templateId] || "CUSTOM";

      const obligationId = await createObligation({
        organizationId,
        title: input.title,
        description: input.description,
        obligationType: obligationType as "RFI_ITEM" | "APPROVAL_GATE" | "WORK_ORDER" | "MAINTENANCE" | "DOCUMENT_EXPIRY" | "MILESTONE" | "REPORT_DEADLINE" | "COMPLIANCE_REQUIREMENT" | "CUSTOM",
        status: "OPEN",
        priority: input.priority || "MEDIUM",
        dueAt: input.dueDate,
        visibility: "INTERNAL_ONLY",
        sourceType: "TEMPLATE",
        sourceRef: { clauseRef: input.templateId },
        createdByUserId: ctx.user.id,
      });

      // Link to entity if provided
      if (input.linkedEntityType && input.linkedEntityId) {
        await createObligationLink({
          organizationId,
          obligationId,
          entityType: input.linkedEntityType as "ASSET" | "PROJECT" | "SITE" | "DATAROOM" | "RFI" | "WORKSPACE_VIEW" | "DOCUMENT" | "PORTFOLIO",
          entityId: input.linkedEntityId,
          linkType: "PRIMARY",
          createdByUserId: ctx.user.id,
        });
      }

      await logObligationAction({
        organizationId,
        obligationId,
        action: "CREATED",
        newValue: { templateId: input.templateId, title: input.title },
        userId: ctx.user.id,
        systemGenerated: false
      });

      return { id: obligationId };
    })
});
