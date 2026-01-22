/**
 * Phase 34: Org Preferences Router
 * Manages organization-level defaults for views, fields, and charts
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getOrgPreferences,
  upsertOrgPreferences,
  createOrgPreferenceVersion,
  getOrgPreferenceVersions,
  getLatestOrgPreferenceVersion,
  getUserOrgRole,
} from "../db";

// Require admin role for org preference changes
const requireOrgAdmin = async (userId: number, organizationId: number) => {
  const role = await getUserOrgRole(userId, organizationId);
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org admins can modify organization preferences",
    });
  }
};

export const orgPreferencesRouter = router({
  /**
   * Get org preferences for the current organization
   */
  get: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
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
      
      const prefs = await getOrgPreferences(input.organizationId);
      
      // Return defaults if no preferences set
      if (!prefs) {
        return {
          organizationId: input.organizationId,
          defaultAssetClassifications: null,
          defaultConfigurationProfiles: null,
          preferredFieldPacks: null,
          defaultDisclosureMode: "summary" as const,
          defaultChartsConfig: null,
          defaultDocumentHubSchemaId: null,
          aiSetupCompleted: false,
          aiSetupCompletedAt: null,
        };
      }
      
      return prefs;
    }),

  /**
   * Update org preferences (admin only)
   */
  update: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      defaultAssetClassifications: z.array(z.string()).optional().nullable(),
      defaultConfigurationProfiles: z.array(z.string()).optional().nullable(),
      preferredFieldPacks: z.array(z.number()).optional().nullable(),
      defaultDisclosureMode: z.enum(["summary", "expanded", "full"]).optional(),
      defaultChartsConfig: z.object({
        allowedChartTypes: z.array(z.string()),
        defaultChartType: z.string(),
        dashboardCharts: z.array(z.object({
          chartKey: z.string(),
          chartType: z.string(),
          position: z.number(),
          dataBinding: z.string(),
        })),
      }).optional().nullable(),
      defaultDocumentHubSchemaId: z.number().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      // Get current preferences for versioning
      const currentPrefs = await getOrgPreferences(input.organizationId);
      const currentVersion = await getLatestOrgPreferenceVersion(input.organizationId);
      
      // Create version snapshot before update
      if (currentPrefs) {
        await createOrgPreferenceVersion(
          input.organizationId,
          currentVersion + 1,
          currentPrefs,
          "Updated via admin console",
          ctx.user.id
        );
      }
      
      // Update preferences
      const updated = await upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: input.defaultAssetClassifications,
        defaultConfigurationProfiles: input.defaultConfigurationProfiles,
        preferredFieldPacks: input.preferredFieldPacks,
        defaultDisclosureMode: input.defaultDisclosureMode,
        defaultChartsConfig: input.defaultChartsConfig,
        defaultDocumentHubSchemaId: input.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
      
      return updated;
    }),

  /**
   * Get version history for org preferences
   */
  getVersionHistory: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      return getOrgPreferenceVersions(input.organizationId);
    }),

  /**
   * Set default disclosure mode
   */
  setDisclosureMode: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      mode: z.enum(["summary", "expanded", "full"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const currentPrefs = await getOrgPreferences(input.organizationId);
      
      return upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: currentPrefs?.defaultAssetClassifications,
        defaultConfigurationProfiles: currentPrefs?.defaultConfigurationProfiles,
        preferredFieldPacks: currentPrefs?.preferredFieldPacks,
        defaultDisclosureMode: input.mode,
        defaultChartsConfig: currentPrefs?.defaultChartsConfig,
        defaultDocumentHubSchemaId: currentPrefs?.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
    }),

  /**
   * Set allowed asset classifications for this org
   */
  setAssetClassifications: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      classifications: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const currentPrefs = await getOrgPreferences(input.organizationId);
      
      return upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: input.classifications,
        defaultConfigurationProfiles: currentPrefs?.defaultConfigurationProfiles,
        preferredFieldPacks: currentPrefs?.preferredFieldPacks,
        defaultDisclosureMode: currentPrefs?.defaultDisclosureMode,
        defaultChartsConfig: currentPrefs?.defaultChartsConfig,
        defaultDocumentHubSchemaId: currentPrefs?.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
    }),

  /**
   * Set configuration profiles for this org
   */
  setConfigurationProfiles: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      profiles: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const currentPrefs = await getOrgPreferences(input.organizationId);
      
      return upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: currentPrefs?.defaultAssetClassifications,
        defaultConfigurationProfiles: input.profiles,
        preferredFieldPacks: currentPrefs?.preferredFieldPacks,
        defaultDisclosureMode: currentPrefs?.defaultDisclosureMode,
        defaultChartsConfig: currentPrefs?.defaultChartsConfig,
        defaultDocumentHubSchemaId: currentPrefs?.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
    }),

  /**
   * Set preferred field packs for this org
   */
  setPreferredFieldPacks: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      fieldPackIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const currentPrefs = await getOrgPreferences(input.organizationId);
      
      return upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: currentPrefs?.defaultAssetClassifications,
        defaultConfigurationProfiles: currentPrefs?.defaultConfigurationProfiles,
        preferredFieldPacks: input.fieldPackIds,
        defaultDisclosureMode: currentPrefs?.defaultDisclosureMode,
        defaultChartsConfig: currentPrefs?.defaultChartsConfig,
        defaultDocumentHubSchemaId: currentPrefs?.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
    }),

  /**
   * Set charts configuration for this org
   */
  setChartsConfig: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      config: z.object({
        allowedChartTypes: z.array(z.string()),
        defaultChartType: z.string(),
        dashboardCharts: z.array(z.object({
          chartKey: z.string(),
          chartType: z.string(),
          position: z.number(),
          dataBinding: z.string(),
        })),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      const currentPrefs = await getOrgPreferences(input.organizationId);
      
      return upsertOrgPreferences({
        organizationId: input.organizationId,
        defaultAssetClassifications: currentPrefs?.defaultAssetClassifications,
        defaultConfigurationProfiles: currentPrefs?.defaultConfigurationProfiles,
        preferredFieldPacks: currentPrefs?.preferredFieldPacks,
        defaultDisclosureMode: currentPrefs?.defaultDisclosureMode,
        defaultChartsConfig: input.config,
        defaultDocumentHubSchemaId: currentPrefs?.defaultDocumentHubSchemaId,
        updatedBy: ctx.user.id,
      });
    }),
});
