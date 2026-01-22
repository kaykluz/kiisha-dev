/**
 * Variance Alerts Service
 * Monitors financial model comparisons and triggers alerts when
 * actual values deviate beyond configured thresholds
 */

import { db } from "../db";
import { notifyOwner } from "../_core/notification";

// Default thresholds (can be overridden per project/model)
export const DEFAULT_THRESHOLDS = {
  revenueVariancePercent: 10, // Alert if revenue deviates > 10%
  productionVariancePercent: 10, // Alert if production deviates > 10%
  opexVariancePercent: 15, // Alert if OpEx deviates > 15%
  ebitdaVariancePercent: 10, // Alert if EBITDA deviates > 10%
};

export interface VarianceThresholds {
  revenueVariancePercent: number;
  productionVariancePercent: number;
  opexVariancePercent: number;
  ebitdaVariancePercent: number;
}

export interface VarianceAlert {
  id: string;
  type: 'revenue' | 'production' | 'opex' | 'ebitda';
  projectId: number;
  projectName: string;
  financialModelId: number;
  modelName: string;
  periodStart: Date;
  periodEnd: Date;
  projected: number;
  actual: number;
  variance: number;
  variancePercent: number;
  threshold: number;
  severity: 'warning' | 'critical';
  createdAt: Date;
}

/**
 * Calculate variance percentage
 */
function calculateVariancePercent(projected: number, actual: number): number {
  if (projected === 0) return actual === 0 ? 0 : 100;
  return ((actual - projected) / Math.abs(projected)) * 100;
}

/**
 * Determine alert severity based on variance magnitude
 */
function getSeverity(variancePercent: number, threshold: number): 'warning' | 'critical' {
  const absVariance = Math.abs(variancePercent);
  // Critical if variance is more than 2x the threshold
  return absVariance > threshold * 2 ? 'critical' : 'warning';
}

/**
 * Check a single comparison record for variance alerts
 */
export function checkComparisonForAlerts(
  comparison: {
    id: number;
    projectId: number;
    financialModelId: number;
    periodStart: Date;
    periodEnd: Date;
    projectedRevenue: number | null;
    actualRevenue: number | null;
    projectedProduction: number | null;
    actualProduction: number | null;
    projectedOpex: number | null;
    actualOpex: number | null;
    projectedEbitda: number | null;
    actualEbitda: number | null;
  },
  projectName: string,
  modelName: string,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS
): VarianceAlert[] {
  const alerts: VarianceAlert[] = [];
  const baseAlert = {
    projectId: comparison.projectId,
    projectName,
    financialModelId: comparison.financialModelId,
    modelName,
    periodStart: comparison.periodStart,
    periodEnd: comparison.periodEnd,
    createdAt: new Date(),
  };

  // Check revenue variance
  if (comparison.projectedRevenue !== null && comparison.actualRevenue !== null) {
    const variancePercent = calculateVariancePercent(
      Number(comparison.projectedRevenue),
      Number(comparison.actualRevenue)
    );
    if (Math.abs(variancePercent) > thresholds.revenueVariancePercent) {
      alerts.push({
        ...baseAlert,
        id: `revenue-${comparison.id}-${Date.now()}`,
        type: 'revenue',
        projected: Number(comparison.projectedRevenue),
        actual: Number(comparison.actualRevenue),
        variance: Number(comparison.actualRevenue) - Number(comparison.projectedRevenue),
        variancePercent,
        threshold: thresholds.revenueVariancePercent,
        severity: getSeverity(variancePercent, thresholds.revenueVariancePercent),
      });
    }
  }

  // Check production variance
  if (comparison.projectedProduction !== null && comparison.actualProduction !== null) {
    const variancePercent = calculateVariancePercent(
      Number(comparison.projectedProduction),
      Number(comparison.actualProduction)
    );
    if (Math.abs(variancePercent) > thresholds.productionVariancePercent) {
      alerts.push({
        ...baseAlert,
        id: `production-${comparison.id}-${Date.now()}`,
        type: 'production',
        projected: Number(comparison.projectedProduction),
        actual: Number(comparison.actualProduction),
        variance: Number(comparison.actualProduction) - Number(comparison.projectedProduction),
        variancePercent,
        threshold: thresholds.productionVariancePercent,
        severity: getSeverity(variancePercent, thresholds.productionVariancePercent),
      });
    }
  }

  // Check OpEx variance
  if (comparison.projectedOpex !== null && comparison.actualOpex !== null) {
    const variancePercent = calculateVariancePercent(
      Number(comparison.projectedOpex),
      Number(comparison.actualOpex)
    );
    if (Math.abs(variancePercent) > thresholds.opexVariancePercent) {
      alerts.push({
        ...baseAlert,
        id: `opex-${comparison.id}-${Date.now()}`,
        type: 'opex',
        projected: Number(comparison.projectedOpex),
        actual: Number(comparison.actualOpex),
        variance: Number(comparison.actualOpex) - Number(comparison.projectedOpex),
        variancePercent,
        threshold: thresholds.opexVariancePercent,
        severity: getSeverity(variancePercent, thresholds.opexVariancePercent),
      });
    }
  }

  // Check EBITDA variance
  if (comparison.projectedEbitda !== null && comparison.actualEbitda !== null) {
    const variancePercent = calculateVariancePercent(
      Number(comparison.projectedEbitda),
      Number(comparison.actualEbitda)
    );
    if (Math.abs(variancePercent) > thresholds.ebitdaVariancePercent) {
      alerts.push({
        ...baseAlert,
        id: `ebitda-${comparison.id}-${Date.now()}`,
        type: 'ebitda',
        projected: Number(comparison.projectedEbitda),
        actual: Number(comparison.actualEbitda),
        variance: Number(comparison.actualEbitda) - Number(comparison.projectedEbitda),
        variancePercent,
        threshold: thresholds.ebitdaVariancePercent,
        severity: getSeverity(variancePercent, thresholds.ebitdaVariancePercent),
      });
    }
  }

  return alerts;
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage for display
 */
function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Send notification for variance alert
 */
export async function sendVarianceAlertNotification(alert: VarianceAlert): Promise<boolean> {
  const typeLabels: Record<string, string> = {
    revenue: 'Revenue',
    production: 'Production',
    opex: 'Operating Expenses',
    ebitda: 'EBITDA',
  };

  const title = `${alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ Warning'}: ${typeLabels[alert.type]} Variance Alert`;
  
  const periodStr = `${alert.periodStart.toLocaleDateString()} - ${alert.periodEnd.toLocaleDateString()}`;
  const isProduction = alert.type === 'production';
  
  const content = `
**Project:** ${alert.projectName}
**Financial Model:** ${alert.modelName}
**Period:** ${periodStr}

**${typeLabels[alert.type]} Variance Detected:**
- Projected: ${isProduction ? `${alert.projected.toLocaleString()} MWh` : formatCurrency(alert.projected)}
- Actual: ${isProduction ? `${alert.actual.toLocaleString()} MWh` : formatCurrency(alert.actual)}
- Variance: ${isProduction ? `${alert.variance.toLocaleString()} MWh` : formatCurrency(alert.variance)} (${formatPercent(alert.variancePercent)})
- Threshold: ±${alert.threshold}%

${alert.variancePercent < 0 
  ? `⬇️ Actual ${typeLabels[alert.type].toLowerCase()} is ${Math.abs(alert.variancePercent).toFixed(1)}% below projections.`
  : `⬆️ Actual ${typeLabels[alert.type].toLowerCase()} is ${alert.variancePercent.toFixed(1)}% above projections.`
}

Please review the financial model and investigate the cause of this variance.
  `.trim();

  return await notifyOwner({ title, content });
}

/**
 * Get alert summary for a project
 */
export function getAlertSummary(alerts: VarianceAlert[]): {
  total: number;
  critical: number;
  warning: number;
  byType: Record<string, number>;
} {
  const summary = {
    total: alerts.length,
    critical: 0,
    warning: 0,
    byType: {} as Record<string, number>,
  };

  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      summary.critical++;
    } else {
      summary.warning++;
    }
    summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
  }

  return summary;
}
