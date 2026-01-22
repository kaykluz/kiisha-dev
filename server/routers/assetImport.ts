/**
 * Phase 38: Asset Import Router
 * 
 * Provides bulk import functionality for VATR assets from CSV/Excel files.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";

// File type enum
const fileTypeSchema = z.enum(["csv", "xlsx", "xls"]);

// Import job status enum
const importStatusSchema = z.enum([
  "pending",
  "validating",
  "validated",
  "validation_failed",
  "importing",
  "completed",
  "failed",
  "cancelled"
]);

export const assetImportRouter = router({
  /**
   * Create a new import job
   */
  createJob: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileUrl: z.string(),
      fileType: fileTypeSchema,
      fileSize: z.number().optional(),
      targetAssetClass: z.string().optional(),
      columnMapping: z.record(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const jobId = await db.createAssetImportJob({
        organizationId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileType: input.fileType,
        fileSize: input.fileSize,
        targetAssetClass: input.targetAssetClass,
        columnMapping: input.columnMapping,
        status: "pending",
        createdBy: ctx.user.id,
      });

      return { jobId };
    }),

  /**
   * Get import job by ID
   */
  getJob: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const job = await db.getAssetImportJobById(input.id);
      
      if (!job || job.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import job not found"
        });
      }

      return job;
    }),

  /**
   * List import jobs for the organization
   */
  listJobs: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.user.activeOrgId;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active organization selected"
      });
    }

    return await db.getAssetImportJobsByOrg(organizationId);
  }),

  /**
   * Update column mapping for an import job
   */
  updateMapping: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      columnMapping: z.record(z.string()),
      targetAssetClass: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const job = await db.getAssetImportJobById(input.jobId);
      
      if (!job || job.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import job not found"
        });
      }

      if (job.status !== "pending" && job.status !== "validation_failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot update mapping for job in current status"
        });
      }

      await db.updateAssetImportJob(input.jobId, {
        columnMapping: input.columnMapping,
        targetAssetClass: input.targetAssetClass,
      });

      return { success: true };
    }),

  /**
   * Start validation for an import job
   */
  startValidation: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await db.getAssetImportJobById(input.jobId);
      
      if (!job || job.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import job not found"
        });
      }

      if (job.status !== "pending" && job.status !== "validation_failed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot start validation for job in current status"
        });
      }

      await db.updateAssetImportJob(input.jobId, {
        status: "validating",
        startedAt: new Date(),
      });

      // In a real implementation, this would trigger a background job
      // For now, we'll simulate validation
      return { success: true, message: "Validation started" };
    }),

  /**
   * Start import for a validated job
   */
  startImport: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await db.getAssetImportJobById(input.jobId);
      
      if (!job || job.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import job not found"
        });
      }

      if (job.status !== "validated") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job must be validated before import can start"
        });
      }

      await db.updateAssetImportJob(input.jobId, {
        status: "importing",
      });

      // In a real implementation, this would trigger a background job
      return { success: true, message: "Import started" };
    }),

  /**
   * Cancel an import job
   */
  cancelJob: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const job = await db.getAssetImportJobById(input.jobId);
      
      if (!job || job.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import job not found"
        });
      }

      if (job.status === "completed" || job.status === "cancelled") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot cancel job in current status"
        });
      }

      await db.updateAssetImportJob(input.jobId, {
        status: "cancelled",
      });

      return { success: true };
    }),

  // ============ IMPORT TEMPLATES ============

  /**
   * List import templates for the organization
   */
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.user.activeOrgId;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active organization selected"
      });
    }

    return await db.getAssetImportTemplatesByOrg(organizationId);
  }),

  /**
   * Create an import template
   */
  createTemplate: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      targetAssetClass: z.string(),
      columnMapping: z.record(z.string()),
      expectedColumns: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const templateId = await db.createAssetImportTemplate({
        organizationId,
        name: input.name,
        description: input.description,
        targetAssetClass: input.targetAssetClass,
        columnMapping: input.columnMapping,
        expectedColumns: input.expectedColumns,
        isActive: true,
        createdBy: ctx.user.id,
      });

      return { templateId };
    }),

  /**
   * Get import template by ID
   */
  getTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const template = await db.getAssetImportTemplateById(input.id);
      
      if (!template || template.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import template not found"
        });
      }

      return template;
    }),

  /**
   * Update an import template
   */
  updateTemplate: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      targetAssetClass: z.string().optional(),
      columnMapping: z.record(z.string()).optional(),
      expectedColumns: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await db.getAssetImportTemplateById(input.id);
      
      if (!template || template.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Import template not found"
        });
      }

      const { id, ...updateData } = input;
      await db.updateAssetImportTemplate(id, updateData);

      return { success: true };
    }),

  /**
   * Get available VATR fields for mapping
   */
  getAvailableFields: protectedProcedure
    .input(z.object({ assetClass: z.string().optional() }))
    .query(async () => {
      // Return standard VATR fields that can be mapped
      const standardFields = [
        { key: "name", label: "Asset Name", required: true, type: "string" },
        { key: "assetClass", label: "Asset Class", required: true, type: "string" },
        { key: "location", label: "Location", required: false, type: "string" },
        { key: "latitude", label: "Latitude", required: false, type: "number" },
        { key: "longitude", label: "Longitude", required: false, type: "number" },
        { key: "capacity", label: "Capacity (MW)", required: false, type: "number" },
        { key: "capacityUnit", label: "Capacity Unit", required: false, type: "string" },
        { key: "status", label: "Status", required: false, type: "string" },
        { key: "commissionDate", label: "Commission Date", required: false, type: "date" },
        { key: "owner", label: "Owner", required: false, type: "string" },
        { key: "operator", label: "Operator", required: false, type: "string" },
        { key: "technology", label: "Technology", required: false, type: "string" },
        { key: "manufacturer", label: "Manufacturer", required: false, type: "string" },
        { key: "model", label: "Model", required: false, type: "string" },
        { key: "serialNumber", label: "Serial Number", required: false, type: "string" },
        { key: "warrantyExpiry", label: "Warranty Expiry", required: false, type: "date" },
        { key: "notes", label: "Notes", required: false, type: "text" },
      ];

      return standardFields;
    }),

  /**
   * Generate sample CSV template
   */
  getSampleCsv: protectedProcedure
    .input(z.object({ assetClass: z.string().optional() }))
    .query(async () => {
      const headers = [
        "name",
        "assetClass",
        "location",
        "latitude",
        "longitude",
        "capacity",
        "capacityUnit",
        "status",
        "commissionDate",
        "owner",
        "operator",
        "technology",
        "notes"
      ];

      const sampleRow = [
        "Solar Farm Alpha",
        "solar",
        "Austin, TX",
        "30.2672",
        "-97.7431",
        "50",
        "MW",
        "operational",
        "2024-01-15",
        "KIISHA Energy",
        "KIISHA Operations",
        "Bifacial PV",
        "Sample asset for import"
      ];

      const csvContent = [
        headers.join(","),
        sampleRow.join(",")
      ].join("\n");

      return { csv: csvContent, headers };
    }),
});
