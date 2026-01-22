/**
 * Phase 34: View Customization Router
 * User-level chart and view customizations
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getUserViewCustomization,
  upsertUserViewCustomization,
  resetUserViewCustomization,
  getLatestOrgPreferenceVersion,
  getUserOrgRole,
} from "../db";
import { getEffectiveViewConfig } from "../services/runtimeDefaults";

export const viewCustomizationRouter = router({
  /**
   * Get effective view configuration (merged org + user)
   */
  getEffective: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify access
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      return getEffectiveViewConfig(ctx.user.id, input.organizationId, input.viewId);
    }),

  /**
   * Get user's customizations for a view
   */
  getUserCustomizations: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      const custom = await getUserViewCustomization(ctx.user.id, input.organizationId, input.viewId);
      return custom;
    }),

  /**
   * Update chart type for a specific chart
   */
  setChartType: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
      chartKey: z.string(),
      chartType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      // Get current customizations
      const current = await getUserViewCustomization(ctx.user.id, input.organizationId, input.viewId);
      const currentOverrides = (current?.localChartOverrides as Array<{ chartKey: string; chartType: string }>) || [];
      
      // Update or add the chart override
      const existingIndex = currentOverrides.findIndex(o => o.chartKey === input.chartKey);
      let newOverrides: Array<{ chartKey: string; chartType: string }>;
      
      if (existingIndex >= 0) {
        newOverrides = [...currentOverrides];
        newOverrides[existingIndex] = { chartKey: input.chartKey, chartType: input.chartType };
      } else {
        newOverrides = [...currentOverrides, { chartKey: input.chartKey, chartType: input.chartType }];
      }
      
      await upsertUserViewCustomization({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        viewId: input.viewId,
        localChartOverrides: newOverrides,
        localColumnOrder: current?.localColumnOrder as string[] | undefined,
        localHiddenFields: current?.localHiddenFields as string[] | undefined,
      });
      
      return { success: true };
    }),

  /**
   * Update column order for a view
   */
  setColumnOrder: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
      columnOrder: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      const current = await getUserViewCustomization(ctx.user.id, input.organizationId, input.viewId);
      
      await upsertUserViewCustomization({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        viewId: input.viewId,
        localChartOverrides: current?.localChartOverrides as Array<{ chartKey: string; chartType: string }> | undefined,
        localColumnOrder: input.columnOrder,
        localHiddenFields: current?.localHiddenFields as string[] | undefined,
      });
      
      return { success: true };
    }),

  /**
   * Update hidden fields for a view
   */
  setHiddenFields: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
      hiddenFields: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      const current = await getUserViewCustomization(ctx.user.id, input.organizationId, input.viewId);
      
      await upsertUserViewCustomization({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        viewId: input.viewId,
        localChartOverrides: current?.localChartOverrides as Array<{ chartKey: string; chartType: string }> | undefined,
        localColumnOrder: current?.localColumnOrder as string[] | undefined,
        localHiddenFields: input.hiddenFields,
      });
      
      return { success: true };
    }),

  /**
   * Reset all user customizations for a view
   * Syncs back to org defaults
   */
  resetToOrgDefaults: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      const orgVersion = await getLatestOrgPreferenceVersion(input.organizationId);
      
      await resetUserViewCustomization(
        ctx.user.id,
        input.organizationId,
        input.viewId,
        orgVersion
      );
      
      return { success: true };
    }),

  /**
   * Batch update multiple customizations at once
   */
  batchUpdate: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      viewId: z.number(),
      chartOverrides: z.array(z.object({
        chartKey: z.string(),
        chartType: z.string(),
      })).optional(),
      columnOrder: z.array(z.string()).optional(),
      hiddenFields: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await getUserOrgRole(ctx.user.id, input.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      const current = await getUserViewCustomization(ctx.user.id, input.organizationId, input.viewId);
      
      await upsertUserViewCustomization({
        userId: ctx.user.id,
        organizationId: input.organizationId,
        viewId: input.viewId,
        localChartOverrides: input.chartOverrides !== undefined
          ? input.chartOverrides
          : current?.localChartOverrides as Array<{ chartKey: string; chartType: string }> | undefined,
        localColumnOrder: input.columnOrder !== undefined
          ? input.columnOrder
          : current?.localColumnOrder as string[] | undefined,
        localHiddenFields: input.hiddenFields !== undefined
          ? input.hiddenFields
          : current?.localHiddenFields as string[] | undefined,
      });
      
      return { success: true };
    }),
});
