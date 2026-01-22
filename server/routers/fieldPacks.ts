/**
 * Phase 34: Field Packs Router
 * Manages reusable bundles of fields and doc requirements
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getFieldPack,
  getFieldPacksForOrg,
  getGlobalFieldPacks,
  getActiveFieldPacksForOrg,
  createFieldPack,
  updateFieldPack,
  cloneFieldPack,
  activateFieldPack,
  archiveFieldPack,
  getUserOrgRole,
  ensureDefaultFieldPacksExist,
} from "../db";

// Field definition schema
const fieldDefinitionSchema = z.object({
  fieldKey: z.string(),
  required: z.boolean(),
  displayLabel: z.string(),
  group: z.string(),
  order: z.number(),
  validationRules: z.object({
    type: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  sensitivity: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
});

// Doc requirement schema
const docRequirementSchema = z.object({
  docTypeKey: z.string(),
  required: z.boolean(),
  reviewerGroups: z.array(z.string()),
  allowedFileTypes: z.array(z.string()),
  statusLightsConfig: z.object({
    green: z.string(),
    yellow: z.string(),
    red: z.string(),
  }).optional(),
});

// Chart config schema
const chartConfigSchema = z.object({
  chartKey: z.string(),
  defaultType: z.string(),
  allowedTypes: z.array(z.string()),
  dataBinding: z.string(),
});

// Require admin role for field pack changes
const requireOrgAdmin = async (userId: number, organizationId: number) => {
  const role = await getUserOrgRole(userId, organizationId);
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org admins can modify field packs",
    });
  }
};

export const fieldPacksRouter = router({
  /**
   * List all field packs available to an organization
   * Includes global KIISHA templates and org-specific packs
   */
  list: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      includeArchived: z.boolean().optional().default(false),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to this org
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      // Ensure default packs exist
      await ensureDefaultFieldPacksExist();
      
      const packs = await getFieldPacksForOrg(input.organizationId);
      
      // Filter archived if not requested
      if (!input.includeArchived) {
        return packs.filter(p => p.status !== "archived");
      }
      
      return packs;
    }),

  /**
   * List only global KIISHA template packs
   */
  listGlobalTemplates: protectedProcedure
    .query(async () => {
      await ensureDefaultFieldPacksExist();
      return getGlobalFieldPacks();
    }),

  /**
   * List active field packs for an organization
   */
  listActive: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      return getActiveFieldPacksForOrg(input.organizationId);
    }),

  /**
   * Get a single field pack by ID
   */
  get: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.id);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      // If org-specific, verify access
      if (pack.organizationId) {
        const role = await getUserOrgRole(ctx.user.id, pack.organizationId);
        if (!role) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this field pack",
          });
        }
      }
      
      return pack;
    }),

  /**
   * Create a new field pack for an organization
   */
  create: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      scope: z.enum(["asset", "project", "site", "portfolio", "dataroom", "rfi"]),
      fields: z.array(fieldDefinitionSchema).optional(),
      docRequirements: z.array(docRequirementSchema).optional(),
      charts: z.array(chartConfigSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const id = await createFieldPack({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        scope: input.scope,
        fields: input.fields || [],
        docRequirements: input.docRequirements || [],
        charts: input.charts || [],
        status: "draft",
        createdBy: ctx.user.id,
      });
      
      return { id };
    }),

  /**
   * Clone a field pack (from global template or another org pack)
   */
  clone: protectedProcedure
    .input(z.object({
      sourceId: z.number(),
      organizationId: z.number(),
      newName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      // Verify source pack exists and is accessible
      const sourcePack = await getFieldPack(input.sourceId);
      if (!sourcePack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source field pack not found",
        });
      }
      
      // Can clone global templates or own org's packs
      if (sourcePack.organizationId && sourcePack.organizationId !== input.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot clone field packs from other organizations",
        });
      }
      
      const id = await cloneFieldPack(
        input.sourceId,
        input.organizationId,
        ctx.user.id,
        input.newName
      );
      
      return { id };
    }),

  /**
   * Update a field pack
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      fields: z.array(fieldDefinitionSchema).optional(),
      docRequirements: z.array(docRequirementSchema).optional(),
      charts: z.array(chartConfigSchema).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.id);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      // Cannot edit global templates
      if (!pack.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot edit global KIISHA templates. Clone them first.",
        });
      }
      
      await requireOrgAdmin(ctx.user.id, pack.organizationId);
      
      await updateFieldPack(input.id, {
        name: input.name,
        description: input.description,
        fields: input.fields,
        docRequirements: input.docRequirements,
        charts: input.charts,
        updatedBy: ctx.user.id,
      });
      
      return { success: true };
    }),

  /**
   * Activate a field pack (make it available for use)
   */
  activate: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.id);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      if (!pack.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify global templates",
        });
      }
      
      await requireOrgAdmin(ctx.user.id, pack.organizationId);
      await activateFieldPack(input.id, ctx.user.id);
      
      return { success: true };
    }),

  /**
   * Archive a field pack (soft delete)
   */
  archive: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.id);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      if (!pack.organizationId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot modify global templates",
        });
      }
      
      await requireOrgAdmin(ctx.user.id, pack.organizationId);
      await archiveFieldPack(input.id, ctx.user.id);
      
      return { success: true };
    }),

  /**
   * Preview how a field pack would affect an asset view
   */
  preview: protectedProcedure
    .input(z.object({
      fieldPackId: z.number(),
      assetId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.fieldPackId);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      // Return preview data
      return {
        packName: pack.name,
        scope: pack.scope,
        fieldCount: pack.fields?.length || 0,
        docRequirementCount: pack.docRequirements?.length || 0,
        chartCount: pack.charts?.length || 0,
        fields: pack.fields || [],
        docRequirements: pack.docRequirements || [],
        charts: pack.charts || [],
        // In a real implementation, this would merge with actual asset data
        previewData: {
          fieldsWithValues: (pack.fields || []).map(f => ({
            ...f,
            currentValue: null, // Would be populated from asset
            hasValue: false,
          })),
          docStatus: (pack.docRequirements || []).map(d => ({
            ...d,
            status: "missing" as const, // Would be populated from asset docs
          })),
        },
      };
    }),

  /**
   * Get field pack usage statistics
   */
  getUsageStats: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const pack = await getFieldPack(input.id);
      if (!pack) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Field pack not found",
        });
      }
      
      // In a real implementation, this would query actual usage
      return {
        packId: input.id,
        packName: pack.name,
        viewsUsingPack: 0,
        assetsAffected: 0,
        lastUsed: null,
        cloneCount: 0,
      };
    }),
});
