/**
 * Asset Templates Router
 * 
 * Provides API for requirement templates and view templates management,
 * including auto-matching templates to assets based on classification/profile.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { 
  assetRequirementTemplates, 
  assetViewTemplates,
  assetTemplateAssignments,
  vatrAssets 
} from "../../drizzle/schema";
import { eq, and, isNull, desc, or } from "drizzle-orm";

// Types for template matching
type AssetClassification = 
  | "residential"
  | "small_commercial"
  | "large_commercial"
  | "industrial"
  | "mini_grid"
  | "mesh_grid"
  | "interconnected_mini_grids"
  | "grid_connected";

type ConfigurationProfile = 
  | "PV_ONLY"
  | "PV_BESS"
  | "PV_DG"
  | "PV_BESS_DG"
  | "BESS_ONLY"
  | "DG_ONLY"
  | "WIND_ONLY"
  | "WIND_BESS"
  | "HYDRO_ONLY"
  | "MINIGRID_PV_BESS"
  | "MINIGRID_PV_BESS_DG"
  | "HYBRID_MULTI"
  | "OTHER";

/**
 * Calculate match score between asset and template
 * Returns a score from 0-100 based on how well the template matches
 */
function calculateMatchScore(
  asset: { 
    assetClassification: AssetClassification | null; 
    configurationProfile: ConfigurationProfile | null;
  },
  template: { 
    assetClassification: AssetClassification | null; 
    configurationProfile: ConfigurationProfile | null;
    priority: number | null;
  }
): number {
  let score = 0;
  
  // Classification match (40 points)
  if (template.assetClassification === null) {
    score += 20; // Wildcard match
  } else if (template.assetClassification === asset.assetClassification) {
    score += 40; // Exact match
  }
  
  // Configuration profile match (40 points)
  if (template.configurationProfile === null) {
    score += 20; // Wildcard match
  } else if (template.configurationProfile === asset.configurationProfile) {
    score += 40; // Exact match
  }
  
  // Priority bonus (up to 20 points)
  score += Math.min((template.priority || 0) * 2, 20);
  
  return score;
}

/**
 * Find best matching requirement template for an asset
 */
async function findBestRequirementTemplate(
  assetId: number,
  organizationId: number | null
): Promise<{ templateId: number; matchScore: number } | null> {
  const database = await getDb();
  if (!database) return null;
  // Get asset details
  const [asset] = await database
    .select()
    .from(vatrAssets)
    .where(eq(vatrAssets.id, assetId));
  
  if (!asset) return null;
  
  // Get all active templates (org-specific + global)
  const templates = await database
    .select()
    .from(assetRequirementTemplates)
    .where(
      and(
        eq(assetRequirementTemplates.isActive, true),
        or(
          eq(assetRequirementTemplates.organizationId, organizationId!),
          isNull(assetRequirementTemplates.organizationId)
        )
      )
    )
    .orderBy(desc(assetRequirementTemplates.priority));
  
  if (templates.length === 0) return null;
  
  // Find best match
  let bestMatch: { templateId: number; matchScore: number } | null = null;
  
  for (const template of templates) {
    const score = calculateMatchScore(
      { 
        assetClassification: asset.assetClassification as AssetClassification | null, 
        configurationProfile: asset.configurationProfile as ConfigurationProfile | null 
      },
      { 
        assetClassification: template.assetClassification as AssetClassification | null, 
        configurationProfile: template.configurationProfile as ConfigurationProfile | null,
        priority: template.priority 
      }
    );
    
    if (!bestMatch || score > bestMatch.matchScore) {
      bestMatch = { templateId: template.id, matchScore: score };
    }
  }
  
  return bestMatch;
}

/**
 * Find best matching view template for an asset
 */
async function findBestViewTemplate(
  assetId: number,
  organizationId: number | null
): Promise<{ templateId: number; matchScore: number } | null> {
  const database = await getDb();
  if (!database) return null;
  const [asset] = await database
    .select()
    .from(vatrAssets)
    .where(eq(vatrAssets.id, assetId));
  
  if (!asset) return null;
  
  const templates = await database
    .select()
    .from(assetViewTemplates)
    .where(
      and(
        eq(assetViewTemplates.isActive, true),
        or(
          eq(assetViewTemplates.organizationId, organizationId!),
          isNull(assetViewTemplates.organizationId)
        )
      )
    )
    .orderBy(desc(assetViewTemplates.priority));
  
  if (templates.length === 0) return null;
  
  let bestMatch: { templateId: number; matchScore: number } | null = null;
  
  for (const template of templates) {
    const score = calculateMatchScore(
      { 
        assetClassification: asset.assetClassification as AssetClassification | null, 
        configurationProfile: asset.configurationProfile as ConfigurationProfile | null 
      },
      { 
        assetClassification: template.assetClassification as AssetClassification | null, 
        configurationProfile: template.configurationProfile as ConfigurationProfile | null,
        priority: template.priority 
      }
    );
    
    if (!bestMatch || score > bestMatch.matchScore) {
      bestMatch = { templateId: template.id, matchScore: score };
    }
  }
  
  return bestMatch;
}

export const templatesRouter = router({
  // ============================================
  // REQUIREMENT TEMPLATES
  // ============================================
  
  requirementTemplates: router({
    list: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        assetClassification: z.string().optional(),
        configurationProfile: z.string().optional(),
        includeGlobal: z.boolean().default(true),
      }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const conditions = [eq(assetRequirementTemplates.isActive, true)];
        
        if (input.organizationId) {
          if (input.includeGlobal) {
            conditions.push(
              or(
                eq(assetRequirementTemplates.organizationId, input.organizationId),
                isNull(assetRequirementTemplates.organizationId)
              )!
            );
          } else {
            conditions.push(eq(assetRequirementTemplates.organizationId, input.organizationId));
          }
        }
        
        const templates = await database
          .select()
          .from(assetRequirementTemplates)
          .where(and(...conditions))
          .orderBy(desc(assetRequirementTemplates.priority));
        
        return templates;
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const [template] = await database
          .select()
          .from(assetRequirementTemplates)
          .where(eq(assetRequirementTemplates.id, input.id));
        
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        
        return template;
      }),
    
    create: adminProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        assetClassification: z.string().optional(),
        configurationProfile: z.string().optional(),
        stage: z.string().optional(),
        requiredDocumentTypes: z.array(z.object({
          typeCode: z.string(),
          typeName: z.string(),
          required: z.boolean(),
          description: z.string().optional(),
        })).optional(),
        requiredFields: z.array(z.object({
          fieldKey: z.string(),
          fieldName: z.string(),
          required: z.boolean(),
          dataType: z.enum(["string", "number", "date", "boolean", "json"]),
          description: z.string().optional(),
        })).optional(),
        requiredChecklistItems: z.array(z.object({
          itemCode: z.string(),
          itemName: z.string(),
          required: z.boolean(),
          category: z.string().optional(),
          description: z.string().optional(),
        })).optional(),
        requiredMonitoringDatapoints: z.array(z.object({
          metricCode: z.string(),
          metricName: z.string(),
          required: z.boolean(),
          unit: z.string().optional(),
          frequency: z.string().optional(),
        })).optional(),
        completenessWeights: z.object({
          documents: z.number(),
          fields: z.number(),
          checklist: z.number(),
          monitoring: z.number(),
        }).optional(),
        priority: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) return [];
        const [template] = await database
          .insert(assetRequirementTemplates)
          .values({
            ...input,
            assetClassification: input.assetClassification as AssetClassification | undefined,
            configurationProfile: input.configurationProfile as ConfigurationProfile | undefined,
            createdBy: ctx.user.id,
          })
          .$returningId();
        
        return { id: template.id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        assetClassification: z.string().optional(),
        configurationProfile: z.string().optional(),
        stage: z.string().optional(),
        requiredDocumentTypes: z.array(z.any()).optional(),
        requiredFields: z.array(z.any()).optional(),
        requiredChecklistItems: z.array(z.any()).optional(),
        requiredMonitoringDatapoints: z.array(z.any()).optional(),
        completenessWeights: z.any().optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const { id, ...updates } = input;
        
        await database
          .update(assetRequirementTemplates)
          .set({
            ...updates,
            assetClassification: updates.assetClassification as AssetClassification | undefined,
            configurationProfile: updates.configurationProfile as ConfigurationProfile | undefined,
          })
          .where(eq(assetRequirementTemplates.id, id));
        
        return { success: true };
      }),
  }),
  
  // ============================================
  // VIEW TEMPLATES
  // ============================================
  
  viewTemplates: router({
    list: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        assetClassification: z.string().optional(),
        configurationProfile: z.string().optional(),
        includeGlobal: z.boolean().default(true),
      }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const conditions = [eq(assetViewTemplates.isActive, true)];
        
        if (input.organizationId) {
          if (input.includeGlobal) {
            conditions.push(
              or(
                eq(assetViewTemplates.organizationId, input.organizationId),
                isNull(assetViewTemplates.organizationId)
              )!
            );
          } else {
            conditions.push(eq(assetViewTemplates.organizationId, input.organizationId));
          }
        }
        
        const templates = await database
          .select()
          .from(assetViewTemplates)
          .where(and(...conditions))
          .orderBy(desc(assetViewTemplates.priority));
        
        return templates;
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const [template] = await database
          .select()
          .from(assetViewTemplates)
          .where(eq(assetViewTemplates.id, input.id));
        
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        
        return template;
      }),
    
    create: adminProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        assetClassification: z.string().optional(),
        configurationProfile: z.string().optional(),
        detailsTableColumns: z.array(z.object({
          fieldKey: z.string(),
          label: z.string(),
          width: z.number().optional(),
          sortable: z.boolean().optional(),
          visible: z.boolean().optional(),
          order: z.number(),
        })).optional(),
        dashboardWidgets: z.array(z.object({
          widgetType: z.string(),
          title: z.string(),
          dataSource: z.string(),
          position: z.object({
            x: z.number(),
            y: z.number(),
            w: z.number(),
            h: z.number(),
          }),
          config: z.record(z.string(), z.unknown()).optional(),
        })).optional(),
        diligenceSections: z.array(z.object({
          sectionCode: z.string(),
          sectionName: z.string(),
          order: z.number(),
          subsections: z.array(z.object({
            code: z.string(),
            name: z.string(),
            order: z.number(),
          })).optional(),
        })).optional(),
        dataRoomCategories: z.array(z.object({
          categoryCode: z.string(),
          categoryName: z.string(),
          order: z.number(),
          documentTypes: z.array(z.string()).optional(),
        })).optional(),
        priority: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) return [];
        const [template] = await database
          .insert(assetViewTemplates)
          .values({
            ...input,
            assetClassification: input.assetClassification as AssetClassification | undefined,
            configurationProfile: input.configurationProfile as ConfigurationProfile | undefined,
            createdBy: ctx.user.id,
          })
          .$returningId();
        
        return { id: template.id, success: true };
      }),
  }),
  
  // ============================================
  // TEMPLATE ASSIGNMENTS
  // ============================================
  
  assignments: router({
    /**
     * Get current template assignment for an asset
     */
    getForAsset: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        const database = await getDb();
        if (!database) return [];
        const [assignment] = await database
          .select()
          .from(assetTemplateAssignments)
          .where(eq(assetTemplateAssignments.assetId, input.assetId))
          .orderBy(desc(assetTemplateAssignments.assignedAt))
          .limit(1);
        
        return assignment || null;
      }),
    
    /**
     * Auto-match templates to an asset based on classification/profile
     */
    autoMatch: protectedProcedure
      .input(z.object({ 
        assetId: z.number(),
        organizationId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const reqMatch = await findBestRequirementTemplate(input.assetId, input.organizationId || null);
        const viewMatch = await findBestViewTemplate(input.assetId, input.organizationId || null);
        
        if (!reqMatch && !viewMatch) {
          return { success: false, message: "No matching templates found" };
        }
        
        // Create assignment record
        const database = await getDb();
        if (!database) return [];
        await database
          .insert(assetTemplateAssignments)
          .values({
            assetId: input.assetId,
            requirementTemplateId: reqMatch?.templateId,
            viewTemplateId: viewMatch?.templateId,
            assignmentType: "auto_matched",
            matchScore: String(Math.max(reqMatch?.matchScore || 0, viewMatch?.matchScore || 0)),
            assignedBy: ctx.user.id,
          });
        
        return { 
          success: true, 
          requirementTemplateId: reqMatch?.templateId,
          viewTemplateId: viewMatch?.templateId,
          matchScore: Math.max(reqMatch?.matchScore || 0, viewMatch?.matchScore || 0),
        };
      }),
    
    /**
     * Admin override template assignment
     */
    override: adminProcedure
      .input(z.object({
        assetId: z.number(),
        requirementTemplateId: z.number().optional(),
        viewTemplateId: z.number().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const database = await getDb();
        if (!database) return [];
        await database
          .insert(assetTemplateAssignments)
          .values({
            assetId: input.assetId,
            requirementTemplateId: input.requirementTemplateId,
            viewTemplateId: input.viewTemplateId,
            assignmentType: "admin_override",
            overrideReason: input.reason,
            assignedBy: ctx.user.id,
          });
        
        return { success: true };
      }),
  }),
  
  // ============================================
  // COMPLETENESS SCORING
  // ============================================
  
  /**
   * Calculate completeness score for an asset based on its assigned template
   */
  getCompletenessScore: protectedProcedure
    .input(z.object({ assetId: z.number() }))
    .query(async ({ input }) => {
      const database = await getDb();
        if (!database) return [];
      // Get asset and its template assignment
      const [asset] = await database
        .select()
        .from(vatrAssets)
        .where(eq(vatrAssets.id, input.assetId));
      
      if (!asset) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }
      
      const [assignment] = await database
        .select()
        .from(assetTemplateAssignments)
        .where(eq(assetTemplateAssignments.assetId, input.assetId))
        .orderBy(desc(assetTemplateAssignments.assignedAt))
        .limit(1);
      
      if (!assignment?.requirementTemplateId) {
        return {
          hasTemplate: false,
          overallScore: null,
          breakdown: null,
          missingItems: [],
        };
      }
      
      const [template] = await database
        .select()
        .from(assetRequirementTemplates)
        .where(eq(assetRequirementTemplates.id, assignment.requirementTemplateId));
      
      if (!template) {
        return {
          hasTemplate: false,
          overallScore: null,
          breakdown: null,
          missingItems: [],
        };
      }
      
      // Calculate completeness (simplified - would need to check actual data)
      // This is a placeholder that returns the template requirements
      const missingItems: { type: string; code: string; name: string }[] = [];
      
      // Check required fields
      const requiredFields = template.requiredFields || [];
      for (const field of requiredFields) {
        if (field.required) {
          // Check if field exists on asset (simplified check)
          const fieldValue = (asset as Record<string, unknown>)[field.fieldKey];
          if (fieldValue === null || fieldValue === undefined) {
            missingItems.push({ type: "field", code: field.fieldKey, name: field.fieldName });
          }
        }
      }
      
      // Calculate scores (placeholder)
      const weights = template.completenessWeights || { documents: 25, fields: 25, checklist: 25, monitoring: 25 };
      const fieldScore = requiredFields.length > 0 
        ? Math.round(((requiredFields.length - missingItems.filter(m => m.type === "field").length) / requiredFields.length) * 100)
        : 100;
      
      return {
        hasTemplate: true,
        templateName: template.name,
        overallScore: fieldScore, // Simplified
        breakdown: {
          documents: { score: 0, total: (template.requiredDocumentTypes || []).length },
          fields: { score: fieldScore, total: requiredFields.length },
          checklist: { score: 0, total: (template.requiredChecklistItems || []).length },
          monitoring: { score: 0, total: (template.requiredMonitoringDatapoints || []).length },
        },
        weights,
        missingItems,
      };
    }),

  // ============================================
  // AUTOFILL SUGGESTIONS
  // ============================================
  
  /**
   * Get autofill suggestions for a template field
   */
  getAutofillSuggestions: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      fieldId: z.string(),
      projectId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        return { suggestions: [] };
      }
      
      // Import the autofill service
      const { proposeAutofill } = await import("../services/templateAutofill");
      const { getOrgContext } = await import("../services/orgContext");
      
      // Get org context
      const orgContext = await getOrgContext(ctx.user.id);
      if (!orgContext) {
        return { suggestions: [] };
      }
      
      // Get template field definition
      const [template] = await database
        .select()
        .from(assetRequirementTemplates)
        .where(eq(assetRequirementTemplates.id, input.templateId));
      
      if (!template) {
        return { suggestions: [] };
      }
      
      // Parse requirements to find the field
      const requirements = template.requirements as any[] || [];
      const field = requirements.find((r: any) => r.fieldId === input.fieldId);
      
      if (!field) {
        return { suggestions: [] };
      }
      
      // Get autofill proposals
      const proposals = await proposeAutofill(
        orgContext,
        input.templateId,
        [{
          fieldId: field.fieldId,
          label: field.label || field.fieldId,
          description: field.description,
          dataType: field.dataType || "string",
          required: field.required || false,
          sensitivityCategory: field.sensitivityCategory,
          confidenceThreshold: field.confidenceThreshold,
        }],
        input.projectId
      );
      
      const proposal = proposals.find(p => p.fieldId === input.fieldId);
      
      if (!proposal) {
        return { suggestions: [] };
      }
      
      return {
        suggestions: proposal.options.map(opt => ({
          predicateId: opt.predicateId,
          predicateLabel: opt.predicateLabel,
          confidence: opt.confidence,
          value: opt.value,
          sourceType: opt.sourceType,
          sourceId: opt.sourceId,
          sourcePage: opt.sourcePage,
          sourceLabel: opt.sourceLabel,
        })),
        canAutoFill: proposal.canAutoFill,
        isSensitive: proposal.isSensitive,
      };
    }),
  
  /**
   * Record an autofill decision for learning
   */
  /**
   * Get bulk autofill suggestions for all fields in a template
   */
  getBulkAutofillSuggestions: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      projectId: z.number().optional(),
      organizationId: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const database = await getDb();
      if (!database) {
        return { fieldSuggestions: {} };
      }
      
      const { proposeAutofill } = await import("../services/templateAutofill");
      const { getOrgContext } = await import("../services/orgContext");
      
      const orgContext = await getOrgContext(ctx.user.id);
      if (!orgContext) {
        return { fieldSuggestions: {} };
      }
      
      // Get template
      const [template] = await database
        .select()
        .from(assetRequirementTemplates)
        .where(eq(assetRequirementTemplates.id, input.templateId));
      
      if (!template) {
        return { fieldSuggestions: {} };
      }
      
      // Parse all fields from template requirements
      const requirements = template.requirements as any[] || [];
      const fields = requirements.map((r: any) => ({
        fieldId: r.fieldId || r.id,
        label: r.label || r.fieldId || r.id,
        description: r.description,
        dataType: r.dataType || "string",
        required: r.required || false,
        sensitivityCategory: r.sensitivityCategory,
        confidenceThreshold: r.confidenceThreshold,
      }));
      
      if (fields.length === 0) {
        return { fieldSuggestions: {} };
      }
      
      // Get proposals for all fields
      const proposals = await proposeAutofill(
        orgContext,
        input.templateId,
        fields,
        input.projectId
      );
      
      // Map to field suggestions
      const fieldSuggestions: Record<string, any[]> = {};
      for (const proposal of proposals) {
        fieldSuggestions[proposal.fieldId] = proposal.options.map(opt => ({
          predicateId: opt.predicateId,
          predicateLabel: opt.predicateLabel,
          confidence: opt.confidence,
          value: opt.value,
          sourceType: opt.sourceType,
          sourceId: opt.sourceId,
          sourcePage: opt.sourcePage,
          sourceLabel: opt.sourceLabel,
        }));
      }
      
      return { fieldSuggestions };
    }),
  
  recordAutofillDecision: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      fieldId: z.string(),
      predicateId: z.string(),
      decision: z.enum(["accepted", "rejected", "viewed"]),
      confidence: z.number(),
      organizationId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { saveFieldMapping } = await import("../services/templateAutofill");
      const { getOrgContext } = await import("../services/orgContext");
      
      const orgContext = await getOrgContext(ctx.user.id);
      if (!orgContext) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Organization context required",
        });
      }
      
      // Only save mapping if accepted
      if (input.decision === "accepted") {
        await saveFieldMapping(
          orgContext,
          input.templateId,
          input.fieldId,
          input.predicateId,
          ctx.user.id
        );
      }
      
      // Log the decision for analytics
      const { logAutofill } = await import("../services/auditLog");
      await logAutofill(
        ctx.user.id,
        orgContext.organizationId,
        input.templateId,
        input.fieldId,
        input.decision,
        input.confidence,
        input.predicateId
      );
      
      return { success: true };
    }),
});
