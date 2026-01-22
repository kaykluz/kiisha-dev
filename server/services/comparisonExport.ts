/**
 * Comparison Export Service
 * Generates PDF and Excel reports for actual vs projected comparisons
 */

import * as XLSX from 'xlsx';

export interface ComparisonData {
  projectName: string;
  modelName: string;
  modelVersion: number;
  scenarioType: string;
  generatedAt: Date;
  metrics: {
    npv: number | null;
    irr: number | null;
    paybackYears: number | null;
    totalCapex: number | null;
    avgDscr: number | null;
  };
  cashFlows: Array<{
    year: number;
    revenue: number;
    opex: number;
    ebitda: number;
    netCashFlow: number;
  }>;
  comparisons: Array<{
    periodStart: Date;
    periodEnd: Date;
    projectedRevenue: number;
    actualRevenue: number;
    revenueVariance: number;
    revenueVariancePercent: number;
    projectedProduction: number | null;
    actualProduction: number | null;
    productionVariance: number | null;
    productionVariancePercent: number | null;
    projectedOpex: number | null;
    actualOpex: number | null;
    opexVariance: number | null;
    opexVariancePercent: number | null;
    notes: string | null;
  }>;
  summary: {
    totalProjectedRevenue: number;
    totalActualRevenue: number;
    totalRevenueVariance: number;
    totalRevenueVariancePercent: number;
    totalProjectedOpex: number;
    totalActualOpex: number;
    totalOpexVariance: number;
    totalOpexVariancePercent: number;
  };
}

/**
 * Format currency for display
 */
function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
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
function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generate Excel workbook for comparison report
 */
export function generateExcelReport(data: ComparisonData): Buffer {
  const workbook = XLSX.utils.book_new();

  // Summary Sheet
  const summaryData = [
    ['Financial Model Comparison Report'],
    [''],
    ['Project', data.projectName],
    ['Model', data.modelName],
    ['Version', data.modelVersion],
    ['Scenario', data.scenarioType],
    ['Generated', formatDate(data.generatedAt)],
    [''],
    ['Key Metrics'],
    ['NPV', formatCurrency(data.metrics.npv)],
    ['IRR', data.metrics.irr ? `${(data.metrics.irr * 100).toFixed(2)}%` : 'N/A'],
    ['Payback Period', data.metrics.paybackYears ? `${data.metrics.paybackYears.toFixed(1)} years` : 'N/A'],
    ['Total CapEx', formatCurrency(data.metrics.totalCapex)],
    ['Avg DSCR', data.metrics.avgDscr ? data.metrics.avgDscr.toFixed(2) : 'N/A'],
    [''],
    ['Performance Summary'],
    ['', 'Projected', 'Actual', 'Variance', 'Variance %'],
    ['Total Revenue', formatCurrency(data.summary.totalProjectedRevenue), formatCurrency(data.summary.totalActualRevenue), formatCurrency(data.summary.totalRevenueVariance), formatPercent(data.summary.totalRevenueVariancePercent)],
    ['Total OpEx', formatCurrency(data.summary.totalProjectedOpex), formatCurrency(data.summary.totalActualOpex), formatCurrency(data.summary.totalOpexVariance), formatPercent(data.summary.totalOpexVariancePercent)],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Cash Flows Sheet
  const cashFlowHeaders = ['Year', 'Revenue', 'OpEx', 'EBITDA', 'Net Cash Flow'];
  const cashFlowData = [
    cashFlowHeaders,
    ...data.cashFlows.map(cf => [
      cf.year,
      cf.revenue,
      cf.opex,
      cf.ebitda,
      cf.netCashFlow,
    ]),
  ];

  const cashFlowSheet = XLSX.utils.aoa_to_sheet(cashFlowData);
  cashFlowSheet['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, cashFlowSheet, 'Projected Cash Flows');

  // Actual vs Projected Sheet
  if (data.comparisons.length > 0) {
    const comparisonHeaders = [
      'Period Start', 'Period End',
      'Projected Revenue', 'Actual Revenue', 'Revenue Variance', 'Revenue Variance %',
      'Projected Production', 'Actual Production', 'Production Variance', 'Production Variance %',
      'Projected OpEx', 'Actual OpEx', 'OpEx Variance', 'OpEx Variance %',
      'Notes'
    ];
    const comparisonData = [
      comparisonHeaders,
      ...data.comparisons.map(c => [
        formatDate(c.periodStart),
        formatDate(c.periodEnd),
        c.projectedRevenue,
        c.actualRevenue,
        c.revenueVariance,
        c.revenueVariancePercent,
        c.projectedProduction ?? '',
        c.actualProduction ?? '',
        c.productionVariance ?? '',
        c.productionVariancePercent ?? '',
        c.projectedOpex ?? '',
        c.actualOpex ?? '',
        c.opexVariance ?? '',
        c.opexVariancePercent ?? '',
        c.notes ?? '',
      ]),
    ];

    const comparisonSheet = XLSX.utils.aoa_to_sheet(comparisonData);
    comparisonSheet['!cols'] = Array(15).fill({ wch: 14 });
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, 'Actual vs Projected');
  }

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}

/**
 * Generate CSV for comparison report (simpler format)
 */
export function generateCSVReport(data: ComparisonData): string {
  const lines: string[] = [];

  // Header
  lines.push(`Financial Model Comparison Report - ${data.projectName}`);
  lines.push(`Model: ${data.modelName} (v${data.modelVersion})`);
  lines.push(`Scenario: ${data.scenarioType}`);
  lines.push(`Generated: ${formatDate(data.generatedAt)}`);
  lines.push('');

  // Summary
  lines.push('PERFORMANCE SUMMARY');
  lines.push('Metric,Projected,Actual,Variance,Variance %');
  lines.push(`Revenue,${data.summary.totalProjectedRevenue},${data.summary.totalActualRevenue},${data.summary.totalRevenueVariance},${data.summary.totalRevenueVariancePercent.toFixed(1)}%`);
  lines.push(`OpEx,${data.summary.totalProjectedOpex},${data.summary.totalActualOpex},${data.summary.totalOpexVariance},${data.summary.totalOpexVariancePercent.toFixed(1)}%`);
  lines.push('');

  // Detailed comparisons
  if (data.comparisons.length > 0) {
    lines.push('DETAILED COMPARISONS');
    lines.push('Period Start,Period End,Projected Revenue,Actual Revenue,Revenue Variance,Revenue Variance %,Notes');
    for (const c of data.comparisons) {
      lines.push(`${formatDate(c.periodStart)},${formatDate(c.periodEnd)},${c.projectedRevenue},${c.actualRevenue},${c.revenueVariance},${c.revenueVariancePercent.toFixed(1)}%,"${c.notes || ''}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate HTML report (for PDF conversion)
 */
export function generateHTMLReport(data: ComparisonData): string {
  const varianceColor = (value: number) => value >= 0 ? '#16a34a' : '#dc2626';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Financial Model Comparison Report</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px; color: #1f2937; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .meta-item { background: #f9fafb; padding: 16px; border-radius: 8px; }
    .meta-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta-value { font-size: 18px; font-weight: 600; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #f3f4f6; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .number { text-align: right; font-variant-numeric: tabular-nums; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 32px; }
    .summary-card { background: #f9fafb; padding: 20px; border-radius: 8px; }
    .summary-title { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .summary-row:last-child { border-bottom: none; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>Financial Model Comparison Report</h1>
  <p class="subtitle">${data.projectName} - ${data.modelName} (v${data.modelVersion})</p>
  
  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">NPV</div>
      <div class="meta-value">${formatCurrency(data.metrics.npv)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">IRR</div>
      <div class="meta-value">${data.metrics.irr ? `${(data.metrics.irr * 100).toFixed(2)}%` : 'N/A'}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Payback Period</div>
      <div class="meta-value">${data.metrics.paybackYears ? `${data.metrics.paybackYears.toFixed(1)} years` : 'N/A'}</div>
    </div>
  </div>

  <h2>Performance Summary</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-title">Revenue</div>
      <div class="summary-row">
        <span>Projected</span>
        <span>${formatCurrency(data.summary.totalProjectedRevenue)}</span>
      </div>
      <div class="summary-row">
        <span>Actual</span>
        <span>${formatCurrency(data.summary.totalActualRevenue)}</span>
      </div>
      <div class="summary-row">
        <span>Variance</span>
        <span style="color: ${varianceColor(data.summary.totalRevenueVariance)}">${formatCurrency(data.summary.totalRevenueVariance)} (${formatPercent(data.summary.totalRevenueVariancePercent)})</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-title">Operating Expenses</div>
      <div class="summary-row">
        <span>Projected</span>
        <span>${formatCurrency(data.summary.totalProjectedOpex)}</span>
      </div>
      <div class="summary-row">
        <span>Actual</span>
        <span>${formatCurrency(data.summary.totalActualOpex)}</span>
      </div>
      <div class="summary-row">
        <span>Variance</span>
        <span style="color: ${varianceColor(-data.summary.totalOpexVariance)}">${formatCurrency(data.summary.totalOpexVariance)} (${formatPercent(data.summary.totalOpexVariancePercent)})</span>
      </div>
    </div>
  </div>

  ${data.comparisons.length > 0 ? `
  <h2>Period-by-Period Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th class="number">Projected Revenue</th>
        <th class="number">Actual Revenue</th>
        <th class="number">Variance</th>
        <th class="number">Variance %</th>
      </tr>
    </thead>
    <tbody>
      ${data.comparisons.map(c => `
      <tr>
        <td>${formatDate(c.periodStart)} - ${formatDate(c.periodEnd)}</td>
        <td class="number">${formatCurrency(c.projectedRevenue)}</td>
        <td class="number">${formatCurrency(c.actualRevenue)}</td>
        <td class="number ${c.revenueVariance >= 0 ? 'positive' : 'negative'}">${formatCurrency(c.revenueVariance)}</td>
        <td class="number ${c.revenueVariancePercent >= 0 ? 'positive' : 'negative'}">${formatPercent(c.revenueVariancePercent)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : '<p>No comparison data available yet.</p>'}

  <h2>Projected Cash Flows</h2>
  <table>
    <thead>
      <tr>
        <th>Year</th>
        <th class="number">Revenue</th>
        <th class="number">OpEx</th>
        <th class="number">EBITDA</th>
        <th class="number">Net Cash Flow</th>
      </tr>
    </thead>
    <tbody>
      ${data.cashFlows.map(cf => `
      <tr>
        <td>${cf.year}</td>
        <td class="number">${formatCurrency(cf.revenue)}</td>
        <td class="number">${formatCurrency(cf.opex)}</td>
        <td class="number">${formatCurrency(cf.ebitda)}</td>
        <td class="number">${formatCurrency(cf.netCashFlow)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated on ${formatDate(data.generatedAt)} | ${data.scenarioType} Scenario</p>
    <p>This report is for informational purposes only. Please verify all figures before making investment decisions.</p>
  </div>
</body>
</html>
  `.trim();
}
