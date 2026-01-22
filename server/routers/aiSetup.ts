/**
 * Phase 34: AI Setup Wizard Router
 * Handles document analysis and recommendation generation
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import {
  createAiSetupProposal,
  getAiSetupProposal,
  getPendingAiSetupProposals,
  getLatestAiSetupProposal,
  updateAiSetupProposalStatus,
  getOrgPreferences,
  upsertOrgPreferences,
  getUserOrgRole,
  getGlobalFieldPacks,
  cloneFieldPack,
} from "../db";

// Require admin role for AI setup
const requireOrgAdmin = async (userId: number, organizationId: number) => {
  const role = await getUserOrgRole(userId, organizationId);
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only org admins can use AI setup",
    });
  }
};

// AI prompt for analyzing documents and generating recommendations
const ANALYSIS_PROMPT = `You are an expert in renewable energy asset management. Analyze the provided documents and questionnaire responses to recommend:

1. Asset Classifications - Which types of assets does this organization manage?
2. Configuration Profiles - What system configurations are common?
3. Field Packs - Which standard field packs would be most useful?
4. Chart Types - What visualizations would help this organization?
5. Document Categories - What document types should be tracked?

Respond in JSON format with this structure:
{
  "assetClassifications": ["residential", "commercial", ...],
  "configurationProfiles": ["solar_only", "solar_bess", ...],
  "recommendedFieldPacks": [
    { "name": "Solar Asset Basics", "reason": "..." },
    ...
  ],
  "chartConfig": {
    "defaultType": "bar",
    "allowedTypes": ["bar", "line", "pie"],
    "dashboardCharts": [
      { "chartKey": "capacity_by_status", "chartType": "bar", "reason": "..." }
    ]
  },
  "documentCategories": [
    { "name": "PPA", "required": true, "reason": "..." },
    ...
  ],
  "confidence": 0.85,
  "reasoning": "Overall analysis summary..."
}`;

export const aiSetupRouter = router({
  /**
   * Analyze documents and generate setup recommendations
   */
  analyze: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      documentUrls: z.array(z.string()).optional(),
      questionnaire: z.object({
        primaryIndustry: z.string().optional(),
        operatingGeographies: z.string().optional(),
        reportingStyle: z.string().optional(),
        portfolioSize: z.string().optional(),
        additionalNotes: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      
      // Build context for AI analysis
      const contextParts: string[] = [];
      
      if (input.questionnaire) {
        contextParts.push("Organization Questionnaire:");
        if (input.questionnaire.primaryIndustry) {
          contextParts.push(`- Primary Industry: ${input.questionnaire.primaryIndustry}`);
        }
        if (input.questionnaire.operatingGeographies) {
          contextParts.push(`- Operating Geographies: ${input.questionnaire.operatingGeographies}`);
        }
        if (input.questionnaire.reportingStyle) {
          contextParts.push(`- Reporting Style: ${input.questionnaire.reportingStyle}`);
        }
        if (input.questionnaire.portfolioSize) {
          contextParts.push(`- Portfolio Size: ${input.questionnaire.portfolioSize}`);
        }
        if (input.questionnaire.additionalNotes) {
          contextParts.push(`- Additional Notes: ${input.questionnaire.additionalNotes}`);
        }
      }
      
      if (input.documentUrls && input.documentUrls.length > 0) {
        contextParts.push(`\nDocuments provided: ${input.documentUrls.length} files`);
        // In a real implementation, we would extract text from these documents
        // For now, we note they were provided
      }
      
      // Get available global field packs for reference
      const globalPacks = await getGlobalFieldPacks();
      contextParts.push("\nAvailable KIISHA Field Packs:");
      for (const pack of globalPacks) {
        contextParts.push(`- ${pack.name}: ${pack.description} (${pack.scope})`);
      }
      
      // Call LLM for analysis
      const response = await invokeLLM({
        messages: [
          { role: "system", content: ANALYSIS_PROMPT },
          { role: "user", content: contextParts.join("\n") },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "setup_recommendations",
            strict: true,
            schema: {
              type: "object",
              properties: {
                assetClassifications: { type: "array", items: { type: "string" } },
                configurationProfiles: { type: "array", items: { type: "string" } },
                recommendedFieldPacks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["name", "reason"],
                    additionalProperties: false,
                  },
                },
                chartConfig: {
                  type: "object",
                  properties: {
                    defaultType: { type: "string" },
                    allowedTypes: { type: "array", items: { type: "string" } },
                    dashboardCharts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          chartKey: { type: "string" },
                          chartType: { type: "string" },
                          reason: { type: "string" },
                        },
                        required: ["chartKey", "chartType", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["defaultType", "allowedTypes", "dashboardCharts"],
                  additionalProperties: false,
                },
                documentCategories: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      required: { type: "boolean" },
                      reason: { type: "string" },
                    },
                    required: ["name", "required", "reason"],
                    additionalProperties: false,
                  },
                },
                confidence: { type: "number" },
                reasoning: { type: "string" },
              },
              required: [
                "assetClassifications",
                "configurationProfiles",
                "recommendedFieldPacks",
                "chartConfig",
                "documentCategories",
                "confidence",
                "reasoning",
              ],
              additionalProperties: false,
            },
          },
        },
      });
      
      // Parse AI response
      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI analysis failed to generate recommendations",
        });
      }
      
      const recommendations = JSON.parse(content);
      
      // Create proposal record
      const proposalId = await createAiSetupProposal({
        organizationId: input.organizationId,
        proposedAssetClasses: recommendations.assetClassifications,
        proposedConfigProfiles: recommendations.configurationProfiles,
        proposedFieldPacks: recommendations.recommendedFieldPacks,
        proposedChartConfig: recommendations.chartConfig,
        proposedDocHubCategories: recommendations.documentCategories,
        inputDocumentIds: [], // Would be populated with actual doc IDs
        questionnaireResponses: input.questionnaire ? {
          industry: input.questionnaire.primaryIndustry,
          geographies: input.questionnaire.operatingGeographies ? [input.questionnaire.operatingGeographies] : undefined,
          reportingStyle: input.questionnaire.reportingStyle,
        } : undefined,
      });
      
      return {
        proposalId,
        recommendations,
      };
    }),

  /**
   * Get a specific proposal
   */
  getProposal: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const proposal = await getAiSetupProposal(input.proposalId);
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposal not found",
        });
      }
      
      // Verify access
      const role = await getUserOrgRole(ctx.user.id, proposal.organizationId);
      if (!role) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this proposal",
        });
      }
      
      return proposal;
    }),

  /**
   * Get pending proposals for an organization
   */
  getPendingProposals: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.organizationId);
      return getPendingAiSetupProposals(input.organizationId);
    }),

  /**
   * Get the latest proposal for an organization
   */
  getLatestProposal: protectedProcedure
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
      
      return getLatestAiSetupProposal(input.organizationId);
    }),

  /**
   * Approve a proposal (fully or partially)
   */
  approveProposal: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      approveAssetClasses: z.boolean(),
      approveConfigProfiles: z.boolean(),
      approveFieldPackIds: z.array(z.number()), // IDs of global packs to clone
      approveChartConfig: z.boolean(),
      approveDocHubCategories: z.boolean(),
      reviewNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getAiSetupProposal(input.proposalId);
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposal not found",
        });
      }
      
      await requireOrgAdmin(ctx.user.id, proposal.organizationId);
      
      // Determine approval status
      const allApproved = input.approveAssetClasses &&
        input.approveConfigProfiles &&
        input.approveFieldPackIds.length > 0 &&
        input.approveChartConfig &&
        input.approveDocHubCategories;
      
      const noneApproved = !input.approveAssetClasses &&
        !input.approveConfigProfiles &&
        input.approveFieldPackIds.length === 0 &&
        !input.approveChartConfig &&
        !input.approveDocHubCategories;
      
      const status = noneApproved ? "rejected" : allApproved ? "approved" : "partially_approved";
      
      // Apply approved items to org preferences
      const currentPrefs = await getOrgPreferences(proposal.organizationId);
      
      const updatedPrefs: Record<string, unknown> = {
        organizationId: proposal.organizationId,
        updatedBy: ctx.user.id,
      };
      
      if (input.approveAssetClasses) {
        updatedPrefs.defaultAssetClassifications = proposal.proposedAssetClasses;
      } else {
        updatedPrefs.defaultAssetClassifications = currentPrefs?.defaultAssetClassifications;
      }
      
      if (input.approveConfigProfiles) {
        updatedPrefs.defaultConfigurationProfiles = proposal.proposedConfigProfiles;
      } else {
        updatedPrefs.defaultConfigurationProfiles = currentPrefs?.defaultConfigurationProfiles;
      }
      
      if (input.approveChartConfig) {
        updatedPrefs.defaultChartsConfig = proposal.proposedChartConfig;
      } else {
        updatedPrefs.defaultChartsConfig = currentPrefs?.defaultChartsConfig;
      }
      
      // Clone approved field packs
      const clonedPackIds: number[] = [];
      for (const packId of input.approveFieldPackIds) {
        try {
          const clonedId = await cloneFieldPack(
            packId,
            proposal.organizationId,
            ctx.user.id
          );
          clonedPackIds.push(clonedId);
        } catch (e) {
          // Continue with other packs if one fails
          console.error(`Failed to clone pack ${packId}:`, e);
        }
      }
      
      if (clonedPackIds.length > 0) {
        updatedPrefs.preferredFieldPacks = [
          ...(currentPrefs?.preferredFieldPacks || []),
          ...clonedPackIds,
        ];
      } else {
        updatedPrefs.preferredFieldPacks = currentPrefs?.preferredFieldPacks;
      }
      
      // Mark AI setup as completed if fully approved
      if (status === "approved") {
        updatedPrefs.aiSetupCompleted = true;
        updatedPrefs.aiSetupCompletedAt = new Date();
      }
      
      // Update org preferences
      await upsertOrgPreferences({
        organizationId: proposal.organizationId,
        defaultAssetClassifications: updatedPrefs.defaultAssetClassifications as string[] | null | undefined,
        defaultConfigurationProfiles: updatedPrefs.defaultConfigurationProfiles as string[] | null | undefined,
        preferredFieldPacks: updatedPrefs.preferredFieldPacks as number[] | null | undefined,
        defaultChartsConfig: updatedPrefs.defaultChartsConfig as {
          allowedChartTypes: string[];
          defaultChartType: string;
          dashboardCharts: { chartKey: string; chartType: string; position: number; dataBinding: string; }[];
        } | null | undefined,
        updatedBy: ctx.user.id,
      });
      
      // Update proposal status
      await updateAiSetupProposalStatus(
        input.proposalId,
        status,
        ctx.user.id,
        input.reviewNotes,
        {
          assetClasses: input.approveAssetClasses,
          configProfiles: input.approveConfigProfiles,
          fieldPackIds: clonedPackIds,
          chartConfig: input.approveChartConfig,
          docHubCategories: input.approveDocHubCategories,
        }
      );
      
      return {
        status,
        clonedFieldPacks: clonedPackIds,
      };
    }),

  /**
   * Reject a proposal
   */
  rejectProposal: protectedProcedure
    .input(z.object({
      proposalId: z.number(),
      reviewNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const proposal = await getAiSetupProposal(input.proposalId);
      if (!proposal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Proposal not found",
        });
      }
      
      await requireOrgAdmin(ctx.user.id, proposal.organizationId);
      
      await updateAiSetupProposalStatus(
        input.proposalId,
        "rejected",
        ctx.user.id,
        input.reviewNotes
      );
      
      return { success: true };
    }),
});
