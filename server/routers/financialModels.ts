import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { storagePut, storageGet } from "../storage";
import { extractFinancialData, getExtractionSummary } from "../services/excelExtraction";
import { checkComparisonForAlerts, sendVarianceAlertNotification, DEFAULT_THRESHOLDS, type VarianceThresholds } from "../services/varianceAlerts";
import { generateExcelReport, generateCSVReport, generateHTMLReport, type ComparisonData } from "../services/comparisonExport";
import { nanoid } from "nanoid";
import * as db from "../db";

// Input schemas
const uploadModelSchema = z.object({
  projectId: z.number(),
  name: z.string().min(1),
  scenarioType: z.string().default("Base"),
  fileBuffer: z.string(), // Base64 encoded file
  fileName: z.string(),
  mimeType: z.string(),
});

const extractMetricsSchema = z.object({
  modelId: z.number(),
});

const getModelsSchema = z.object({
  projectId: z.number().optional(),
  status: z.enum(["draft", "review", "approved", "superseded", "archived"]).optional(),
  scenarioType: z.string().optional(),
});

const updateModelSchema = z.object({
  modelId: z.number(),
  name: z.string().optional(),
  status: z.enum(["draft", "review", "approved", "superseded", "archived"]).optional(),
  scenarioType: z.string().optional(),
});

const getComparisonSchema = z.object({
  modelId: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const createComparisonSchema = z.object({
  modelId: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  actualRevenue: z.number(),
  actualProduction: z.number().optional(),
  actualOpex: z.number().optional(),
  notes: z.string().optional(),
});

// Bulk upload schema
const bulkUploadSchema = z.object({
  projectId: z.number(),
  files: z.array(z.object({
    name: z.string(),
    scenarioType: z.string().default("Base"),
    fileBuffer: z.string(), // Base64 encoded
    fileName: z.string(),
    mimeType: z.string(),
  })),
});

// Variance alert settings schema
const varianceAlertSettingsSchema = z.object({
  projectId: z.number().optional(),
  modelId: z.number().optional(),
  revenueThreshold: z.number().min(0).max(100).default(10),
  productionThreshold: z.number().min(0).max(100).default(10),
  opexThreshold: z.number().min(0).max(100).default(15),
  ebitdaThreshold: z.number().min(0).max(100).default(10),
  enabled: z.boolean().default(true),
});

export const financialModelsRouter = router({
  // Upload a new financial model
  upload: protectedProcedure
    .input(uploadModelSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, name, scenarioType, fileBuffer, fileName, mimeType } = input;

      // Decode base64 file
      const buffer = Buffer.from(fileBuffer, 'base64');
      
      // Generate unique file key
      const fileKey = `financial-models/${projectId}/${nanoid()}-${fileName}`;
      
      // Upload to S3
      const { url } = await storagePut(fileKey, buffer, mimeType);

      // Create the financial model record
      const model = await db.createFinancialModel({
        projectId,
        name,
        scenarioType: scenarioType || 'Base',
        fileUrl: url,
        fileKey,
        fileName,
        mimeType,
        uploadedBy: ctx.user.id,
        status: 'draft',
        version: 1,
      });

      // Trigger extraction asynchronously
      try {
        const extractionResult = await extractFinancialData(buffer, fileName);
        
        if (extractionResult.success) {
          // Save extracted metrics
          await db.saveFinancialModelMetrics(model.id, extractionResult.metrics);
          
          // Save cash flows
          if (extractionResult.cashFlows.length > 0) {
            await db.saveFinancialModelCashFlows(model.id, extractionResult.cashFlows);
          }

          // Update model with extraction status
          await db.updateFinancialModel(model.id, {
            extractionStatus: 'completed',
          });
        } else {
          await db.updateFinancialModel(model.id, {
            extractionStatus: 'failed',
            extractionNotes: extractionResult.errors.join('\n'),
          });
        }
      } catch (error) {
        console.error('Extraction error:', error);
        await db.updateFinancialModel(model.id, {
          extractionStatus: 'failed',
        });
      }

      return { 
        success: true, 
        modelId: model.id,
        message: 'Financial model uploaded. Extraction in progress.' 
      };
    }),

  // Re-extract metrics from an existing model
  reextract: protectedProcedure
    .input(extractMetricsSchema)
    .mutation(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      // Get the file from S3
      const { url } = await storageGet(model.fileKey);
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Re-run extraction
      const extractionResult = await extractFinancialData(buffer, model.fileName);

      if (extractionResult.success) {
        // Clear old metrics and save new ones
        await db.deleteFinancialModelMetrics(model.id);
        await db.saveFinancialModelMetrics(model.id, extractionResult.metrics);
        
        // Clear old cash flows and save new ones
        await db.deleteFinancialModelCashFlows(model.id);
        if (extractionResult.cashFlows.length > 0) {
          await db.saveFinancialModelCashFlows(model.id, extractionResult.cashFlows);
        }

        await db.updateFinancialModel(model.id, {
          extractionStatus: 'completed',
        });

        return { 
          success: true, 
          confidence: extractionResult.metrics.confidence,
          summary: getExtractionSummary(extractionResult),
        };
      } else {
        await db.updateFinancialModel(model.id, {
          extractionStatus: 'failed',
        });

        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: `Extraction failed: ${extractionResult.errors.join(', ')}` 
        });
      }
    }),

  // Get financial models with optional filters
  list: protectedProcedure
    .input(getModelsSchema)
    .query(async ({ ctx, input }) => {
      const models = await db.getFinancialModels({
        projectId: input.projectId,
        status: input.status,
        scenarioType: input.scenarioType,
      });

      // Enrich with metrics
      const enrichedModels = await Promise.all(
        models.map(async (model) => {
          const metrics = await db.getFinancialModelMetrics(model.id);
          const cashFlowCount = await db.getFinancialModelCashFlowCount(model.id);
          
          return {
            ...model,
            metrics,
            cashFlowYears: cashFlowCount,
          };
        })
      );

      return enrichedModels;
    }),

  // Get a single financial model with full details
  get: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      const metrics = await db.getFinancialModelMetrics(model.id);
      const cashFlows = await db.getFinancialModelCashFlows(model.id);
      const versions = await db.getFinancialModelVersions(model.id);

      return {
        ...model,
        metrics,
        cashFlows,
        versions,
      };
    }),

  // Update a financial model
  update: protectedProcedure
    .input(updateModelSchema)
    .mutation(async ({ ctx, input }) => {
      const { modelId, ...updates } = input;
      
      const model = await db.getFinancialModelById(modelId);
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      await db.updateFinancialModel(modelId, updates);
      
      return { success: true };
    }),

  // Get actual vs projected comparison data
  getComparison: protectedProcedure
    .input(getComparisonSchema)
    .query(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      // Get projected cash flows
      const projectedCashFlows = await db.getFinancialModelCashFlows(input.modelId);
      
      // Get actual comparison records
      const comparisons = await db.getFinancialModelComparisons(input.modelId, {
        startDate: input.startDate,
        endDate: input.endDate,
      });

      // Calculate variance metrics
      const variance = calculateVariance(projectedCashFlows, comparisons);

      return {
        projected: projectedCashFlows,
        actual: comparisons,
        variance,
      };
    }),

  // Create a new comparison record (actual data entry)
  createComparison: protectedProcedure
    .input(createComparisonSchema)
    .mutation(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      // Get projected values for the period
      const projectedCashFlows = await db.getFinancialModelCashFlows(input.modelId);
      
      // Find matching projected period
      const periodYear = new Date(input.periodStart).getFullYear();
      const projectedForPeriod = projectedCashFlows.find(cf => cf.year === periodYear);

      const comparison = await db.createFinancialModelComparison({
        modelId: input.modelId,
        projectId: model.projectId,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        projectedRevenue: Number(projectedForPeriod?.revenue) || 0,
        actualRevenue: input.actualRevenue,
        projectedProduction: projectedForPeriod?.revenue ? Number(projectedForPeriod.revenue) / 100 : undefined,
        actualProduction: input.actualProduction,
        projectedOpex: projectedForPeriod?.opex ? Number(projectedForPeriod.opex) : undefined,
        actualOpex: input.actualOpex,
        notes: input.notes,
        createdBy: ctx.user.id,
      });

      return { success: true, comparisonId: comparison.id };
    }),

  // Bulk upload multiple financial models
  bulkUpload: protectedProcedure
    .input(bulkUploadSchema)
    .mutation(async ({ ctx, input }) => {
      const { projectId, files } = input;
      const results: Array<{ fileName: string; success: boolean; modelId?: number; error?: string }> = [];

      for (const file of files) {
        try {
          // Decode base64 file
          const buffer = Buffer.from(file.fileBuffer, 'base64');
          
          // Generate unique file key
          const fileKey = `financial-models/${projectId}/${nanoid()}-${file.fileName}`;
          
          // Upload to S3
          const { url } = await storagePut(fileKey, buffer, file.mimeType);

          // Create the financial model record
          const model = await db.createFinancialModel({
            projectId,
            name: file.name,
            scenarioType: file.scenarioType || 'Base',
            fileUrl: url,
            fileKey,
            fileName: file.fileName,
            mimeType: file.mimeType,
            uploadedBy: ctx.user.id,
            status: 'draft',
            version: 1,
          });

          // Trigger extraction
          try {
            const extractionResult = await extractFinancialData(buffer, file.fileName);
            
            if (extractionResult.success) {
              await db.saveFinancialModelMetrics(model.id, extractionResult.metrics);
              
              if (extractionResult.cashFlows.length > 0) {
                await db.saveFinancialModelCashFlows(model.id, extractionResult.cashFlows);
              }

              await db.updateFinancialModel(model.id, {
                extractionStatus: 'completed',
              });
            } else {
              await db.updateFinancialModel(model.id, {
                extractionStatus: 'failed',
                extractionNotes: extractionResult.errors.join('\n'),
              });
            }
          } catch (error) {
            console.error('Extraction error:', error);
            await db.updateFinancialModel(model.id, {
              extractionStatus: 'failed',
            });
          }

          results.push({ fileName: file.fileName, success: true, modelId: model.id });
        } catch (error) {
          console.error('Upload error for', file.fileName, error);
          results.push({ 
            fileName: file.fileName, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        success: failCount === 0,
        results,
        summary: {
          total: files.length,
          successful: successCount,
          failed: failCount,
        },
      };
    }),

  // Check variance alerts for a model's comparisons
  checkVarianceAlerts: protectedProcedure
    .input(z.object({ 
      modelId: z.number(),
      thresholds: z.object({
        revenueVariancePercent: z.number().optional(),
        productionVariancePercent: z.number().optional(),
        opexVariancePercent: z.number().optional(),
        ebitdaVariancePercent: z.number().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      // Get project name
      const project = await db.getProjectById(model.projectId);
      const projectName = project?.name || 'Unknown Project';

      // Get all comparisons for this model
      const comparisons = await db.getFinancialModelComparisons(input.modelId, {});

      // Use custom thresholds or defaults
      const thresholds: VarianceThresholds = {
        ...DEFAULT_THRESHOLDS,
        ...input.thresholds,
      };

      // Check each comparison for alerts
      const allAlerts = [];
      for (const comparison of comparisons) {
        const alerts = checkComparisonForAlerts(
          {
            id: comparison.id,
            projectId: model.projectId,
            financialModelId: model.id,
            periodStart: comparison.periodStart,
            periodEnd: comparison.periodEnd,
            projectedRevenue: comparison.projectedRevenue,
            actualRevenue: comparison.actualRevenue,
            projectedProduction: comparison.projectedProduction,
            actualProduction: comparison.actualProduction,
            projectedOpex: comparison.projectedOpex,
            actualOpex: comparison.actualOpex,
            projectedEbitda: comparison.projectedEbitda,
            actualEbitda: comparison.actualEbitda,
          },
          projectName,
          model.name,
          thresholds
        );
        allAlerts.push(...alerts);
      }

      return {
        alerts: allAlerts,
        summary: {
          total: allAlerts.length,
          critical: allAlerts.filter(a => a.severity === 'critical').length,
          warning: allAlerts.filter(a => a.severity === 'warning').length,
        },
        thresholds,
      };
    }),

  // Send variance alert notification
  sendVarianceAlert: protectedProcedure
    .input(z.object({
      modelId: z.number(),
      alertType: z.enum(['revenue', 'production', 'opex', 'ebitda']),
      comparisonId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const model = await db.getFinancialModelById(input.modelId);
      
      if (!model) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
      }

      const project = await db.getProjectById(model.projectId);
      const projectName = project?.name || 'Unknown Project';

      const comparisons = await db.getFinancialModelComparisons(input.modelId, {});
      const comparison = comparisons.find(c => c.id === input.comparisonId);

      if (!comparison) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comparison not found' });
      }

      const alerts = checkComparisonForAlerts(
        {
          id: comparison.id,
          projectId: model.projectId,
          financialModelId: model.id,
          periodStart: comparison.periodStart,
          periodEnd: comparison.periodEnd,
          projectedRevenue: comparison.projectedRevenue,
          actualRevenue: comparison.actualRevenue,
          projectedProduction: comparison.projectedProduction,
          actualProduction: comparison.actualProduction,
          projectedOpex: comparison.projectedOpex,
          actualOpex: comparison.actualOpex,
          projectedEbitda: comparison.projectedEbitda,
          actualEbitda: comparison.actualEbitda,
        },
        projectName,
        model.name
      );

      const alert = alerts.find(a => a.type === input.alertType);
      
      if (!alert) {
        return { success: false, message: 'No alert found for this type' };
      }

      const sent = await sendVarianceAlertNotification(alert);
      
      return { success: sent, message: sent ? 'Alert notification sent' : 'Failed to send notification' };
    }),

  // Get variance alert settings
  getVarianceAlertSettings: protectedProcedure
    .input(z.object({ projectId: z.number().optional(), modelId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      // For now, return default settings
      // In production, these would be stored per project/model
      return {
        enabled: true,
        thresholds: DEFAULT_THRESHOLDS,
        notifyOnWarning: true,
        notifyOnCritical: true,
        notificationChannels: ['email', 'in_app'],
      };
    }),

  // Update variance alert settings
  updateVarianceAlertSettings: protectedProcedure
    .input(varianceAlertSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      // Store settings (would be saved to database in production)
      return {
        success: true,
        settings: {
          enabled: input.enabled,
          thresholds: {
            revenueVariancePercent: input.revenueThreshold,
            productionVariancePercent: input.productionThreshold,
            opexVariancePercent: input.opexThreshold,
            ebitdaVariancePercent: input.ebitdaThreshold,
          },
        },
      };
    }),

  // Export comparison report as Excel
  exportExcel: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const reportData = await buildComparisonReportData(input.modelId);
      const buffer = generateExcelReport(reportData);
      
      // Convert buffer to base64 for transport
      const base64 = buffer.toString('base64');
      
      return {
        success: true,
        data: base64,
        filename: `${reportData.projectName}-${reportData.modelName}-comparison.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    }),

  // Export comparison report as CSV
  exportCSV: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const reportData = await buildComparisonReportData(input.modelId);
      const csv = generateCSVReport(reportData);
      
      return {
        success: true,
        data: csv,
        filename: `${reportData.projectName}-${reportData.modelName}-comparison.csv`,
        mimeType: 'text/csv',
      };
    }),

  // Export comparison report as HTML (for PDF generation)
  exportHTML: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const reportData = await buildComparisonReportData(input.modelId);
      const html = generateHTMLReport(reportData);
      
      return {
        success: true,
        data: html,
        filename: `${reportData.projectName}-${reportData.modelName}-comparison.html`,
        mimeType: 'text/html',
      };
    }),

  // Get portfolio summary metrics
  getPortfolioSummary: protectedProcedure
    .input(z.object({ projectIds: z.array(z.number()).optional() }))
    .query(async ({ ctx, input }) => {
      const models = await db.getFinancialModels({
        projectIds: input.projectIds,
        status: 'approved',
      });

      let totalNpv = 0;
      let totalCapex = 0;
      let totalIrr = 0;
      let totalDscr = 0;
      let modelCount = 0;

      for (const model of models) {
        const metrics = await db.getFinancialModelMetrics(model.id);
        if (metrics) {
          if (metrics.npv) totalNpv += metrics.npv;
          if (metrics.totalCapex) totalCapex += metrics.totalCapex;
          if (metrics.irr) {
            totalIrr += metrics.irr;
            modelCount++;
          }
          if (metrics.avgDscr) totalDscr += metrics.avgDscr;
        }
      }

      return {
        totalNpv,
        totalCapex,
        avgIrr: modelCount > 0 ? totalIrr / modelCount : 0,
        avgDscr: modelCount > 0 ? totalDscr / modelCount : 0,
        modelCount: models.length,
      };
    }),
});

// Helper function to build comparison report data
async function buildComparisonReportData(modelId: number): Promise<ComparisonData> {
  const model = await db.getFinancialModelById(modelId);
  
  if (!model) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Financial model not found' });
  }

  const project = await db.getProjectById(model.projectId);
  const metrics = await db.getFinancialModelMetrics(modelId);
  const cashFlows = await db.getFinancialModelCashFlows(modelId);
  const comparisons = await db.getFinancialModelComparisons(modelId, {});

  // Calculate summary
  let totalProjectedRevenue = 0;
  let totalActualRevenue = 0;
  let totalProjectedOpex = 0;
  let totalActualOpex = 0;

  const formattedComparisons = comparisons.map(c => {
    const projRev = Number(c.projectedRevenue) || 0;
    const actRev = Number(c.actualRevenue) || 0;
    const projOpex = c.projectedOpex ? Number(c.projectedOpex) : null;
    const actOpex = c.actualOpex ? Number(c.actualOpex) : null;
    const projProd = c.projectedProduction ? Number(c.projectedProduction) : null;
    const actProd = c.actualProduction ? Number(c.actualProduction) : null;

    totalProjectedRevenue += projRev;
    totalActualRevenue += actRev;
    if (projOpex !== null) totalProjectedOpex += projOpex;
    if (actOpex !== null) totalActualOpex += actOpex;

    const revenueVariance = actRev - projRev;
    const revenueVariancePercent = projRev > 0 ? (revenueVariance / projRev) * 100 : 0;

    return {
      periodStart: c.periodStart,
      periodEnd: c.periodEnd,
      projectedRevenue: projRev,
      actualRevenue: actRev,
      revenueVariance,
      revenueVariancePercent,
      projectedProduction: projProd,
      actualProduction: actProd,
      productionVariance: projProd !== null && actProd !== null ? actProd - projProd : null,
      productionVariancePercent: projProd !== null && actProd !== null && projProd > 0 
        ? ((actProd - projProd) / projProd) * 100 : null,
      projectedOpex: projOpex,
      actualOpex: actOpex,
      opexVariance: projOpex !== null && actOpex !== null ? actOpex - projOpex : null,
      opexVariancePercent: projOpex !== null && actOpex !== null && projOpex > 0 
        ? ((actOpex - projOpex) / projOpex) * 100 : null,
      notes: c.notes || null,
    };
  });

  const totalRevenueVariance = totalActualRevenue - totalProjectedRevenue;
  const totalOpexVariance = totalActualOpex - totalProjectedOpex;

  return {
    projectName: project?.name || 'Unknown Project',
    modelName: model.name,
    modelVersion: model.version || 1,
    scenarioType: model.scenarioType || 'Base',
    generatedAt: new Date(),
    metrics: {
      npv: metrics?.npv ? Number(metrics.npv) : null,
      irr: metrics?.irr ? Number(metrics.irr) : null,
      paybackYears: metrics?.paybackYears ? Number(metrics.paybackYears) : null,
      totalCapex: metrics?.totalCapex ? Number(metrics.totalCapex) : null,
      avgDscr: metrics?.avgDscr ? Number(metrics.avgDscr) : null,
    },
    cashFlows: cashFlows.map(cf => ({
      year: cf.year,
      revenue: Number(cf.revenue) || 0,
      opex: Number(cf.opex) || 0,
      ebitda: Number(cf.ebitda) || 0,
      netCashFlow: Number(cf.netCashFlow) || 0,
    })),
    comparisons: formattedComparisons,
    summary: {
      totalProjectedRevenue,
      totalActualRevenue,
      totalRevenueVariance,
      totalRevenueVariancePercent: totalProjectedRevenue > 0 
        ? (totalRevenueVariance / totalProjectedRevenue) * 100 : 0,
      totalProjectedOpex,
      totalActualOpex,
      totalOpexVariance,
      totalOpexVariancePercent: totalProjectedOpex > 0 
        ? (totalOpexVariance / totalProjectedOpex) * 100 : 0,
    },
  };
}

// Helper function to calculate variance between projected and actual
function calculateVariance(
  projected: Array<{ year: number; revenue: number; opex: number; ebitda: number }>,
  actual: Array<{ periodStart: Date; actualRevenue: number; projectedRevenue: number; actualOpex?: number; projectedOpex?: number }>
): {
  revenueVariance: number;
  revenueVariancePercent: number;
  opexVariance: number;
  opexVariancePercent: number;
  cumulativeVariance: number;
} {
  let totalProjectedRevenue = 0;
  let totalActualRevenue = 0;
  let totalProjectedOpex = 0;
  let totalActualOpex = 0;

  for (const record of actual) {
    totalProjectedRevenue += record.projectedRevenue || 0;
    totalActualRevenue += record.actualRevenue || 0;
    totalProjectedOpex += record.projectedOpex || 0;
    totalActualOpex += record.actualOpex || 0;
  }

  const revenueVariance = totalActualRevenue - totalProjectedRevenue;
  const opexVariance = totalActualOpex - totalProjectedOpex;

  return {
    revenueVariance,
    revenueVariancePercent: totalProjectedRevenue > 0 ? (revenueVariance / totalProjectedRevenue) * 100 : 0,
    opexVariance,
    opexVariancePercent: totalProjectedOpex > 0 ? (opexVariance / totalProjectedOpex) * 100 : 0,
    cumulativeVariance: revenueVariance - opexVariance,
  };
}
