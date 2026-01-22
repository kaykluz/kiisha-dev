import * as XLSX from 'xlsx';

// Types for extracted financial data
export interface ExtractedFinancialMetrics {
  npv?: number;
  irr?: number;
  paybackPeriod?: number;
  moic?: number;
  totalCapex?: number;
  debt?: number;
  equity?: number;
  leverage?: number;
  avgDscr?: number;
  minDscr?: number;
  avgEbitda?: number;
  annualProduction?: number;
  capacityFactor?: number;
  ppaRate?: number;
  escalation?: number;
  projectLife?: number;
  totalRevenue?: number;
  codDate?: Date;
  confidence: number;
  extractionNotes: string[];
}

export interface ExtractedCashFlow {
  year: number;
  revenue: number;
  opex: number;
  ebitda: number;
  debtService: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  dscr?: number;
}

export interface ExtractionResult {
  success: boolean;
  metrics: ExtractedFinancialMetrics;
  cashFlows: ExtractedCashFlow[];
  rawData: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

// Common cell patterns for financial metrics
const METRIC_PATTERNS = {
  npv: [
    /net\s*present\s*value/i,
    /npv/i,
    /project\s*npv/i,
    /equity\s*npv/i,
    /levered\s*npv/i,
  ],
  irr: [
    /internal\s*rate\s*of\s*return/i,
    /irr/i,
    /project\s*irr/i,
    /equity\s*irr/i,
    /levered\s*irr/i,
  ],
  payback: [
    /payback\s*period/i,
    /payback/i,
    /simple\s*payback/i,
    /discounted\s*payback/i,
  ],
  moic: [
    /multiple\s*on\s*invested\s*capital/i,
    /moic/i,
    /equity\s*multiple/i,
    /cash\s*on\s*cash/i,
  ],
  capex: [
    /total\s*capex/i,
    /capital\s*expenditure/i,
    /total\s*investment/i,
    /project\s*cost/i,
    /epc\s*cost/i,
  ],
  debt: [
    /total\s*debt/i,
    /senior\s*debt/i,
    /loan\s*amount/i,
    /debt\s*financing/i,
  ],
  equity: [
    /total\s*equity/i,
    /equity\s*investment/i,
    /sponsor\s*equity/i,
  ],
  dscr: [
    /debt\s*service\s*coverage/i,
    /dscr/i,
    /average\s*dscr/i,
    /min\s*dscr/i,
    /minimum\s*dscr/i,
  ],
  ebitda: [
    /ebitda/i,
    /earnings\s*before/i,
    /operating\s*income/i,
  ],
  production: [
    /annual\s*production/i,
    /energy\s*production/i,
    /generation/i,
    /mwh/i,
    /kwh/i,
  ],
  capacityFactor: [
    /capacity\s*factor/i,
    /cf/i,
    /net\s*capacity\s*factor/i,
  ],
  ppaRate: [
    /ppa\s*rate/i,
    /ppa\s*price/i,
    /offtake\s*price/i,
    /electricity\s*price/i,
  ],
  projectLife: [
    /project\s*life/i,
    /operating\s*period/i,
    /term/i,
    /years/i,
  ],
  cod: [
    /cod/i,
    /commercial\s*operation/i,
    /start\s*date/i,
    /operation\s*date/i,
  ],
};

// Sheet name patterns for financial models
const SHEET_PATTERNS = {
  summary: [/summary/i, /overview/i, /dashboard/i, /key\s*metrics/i, /output/i],
  cashFlow: [/cash\s*flow/i, /cf/i, /pro\s*forma/i, /projection/i, /forecast/i],
  assumptions: [/assumption/i, /input/i, /parameter/i],
  returns: [/return/i, /irr/i, /npv/i, /metrics/i],
};

/**
 * Extract financial data from an Excel file buffer
 */
export async function extractFinancialData(
  fileBuffer: Buffer,
  fileName: string
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    success: false,
    metrics: {
      confidence: 0,
      extractionNotes: [],
    },
    cashFlows: [],
    rawData: {},
    errors: [],
    warnings: [],
  };

  try {
    // Parse the workbook
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: true,
      cellStyles: true,
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      result.errors.push('No sheets found in the workbook');
      return result;
    }

    // Identify relevant sheets
    const sheets = identifySheets(workbook);
    result.rawData.identifiedSheets = sheets;

    // Extract metrics from summary/returns sheets
    let metricsExtracted = 0;
    const summarySheets = [...(sheets.summary || []), ...(sheets.returns || [])];
    
    for (const sheetName of summarySheets) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const extracted = extractMetricsFromSheet(sheet, sheetName);
      metricsExtracted += mergeMetrics(result.metrics, extracted.metrics);
      result.warnings.push(...extracted.warnings);
    }

    // If no summary sheets, try all sheets
    if (metricsExtracted === 0) {
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const extracted = extractMetricsFromSheet(sheet, sheetName);
        metricsExtracted += mergeMetrics(result.metrics, extracted.metrics);
      }
    }

    // Extract cash flows
    const cashFlowSheets = sheets.cashFlow || [];
    for (const sheetName of cashFlowSheets) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const cashFlows = extractCashFlowsFromSheet(sheet, sheetName);
      if (cashFlows.length > 0) {
        result.cashFlows = cashFlows;
        break;
      }
    }

    // If no cash flow sheet identified, try to find cash flows in any sheet
    if (result.cashFlows.length === 0) {
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const cashFlows = extractCashFlowsFromSheet(sheet, sheetName);
        if (cashFlows.length > 0) {
          result.cashFlows = cashFlows;
          result.metrics.extractionNotes.push(`Cash flows extracted from sheet: ${sheetName}`);
          break;
        }
      }
    }

    // Calculate confidence score
    result.metrics.confidence = calculateConfidence(result.metrics, result.cashFlows);

    // Calculate derived metrics if possible
    calculateDerivedMetrics(result.metrics);

    result.success = metricsExtracted > 0 || result.cashFlows.length > 0;
    
    if (!result.success) {
      result.errors.push('Could not extract any financial metrics from the workbook');
    }

  } catch (error) {
    result.errors.push(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Identify relevant sheets in the workbook
 */
function identifySheets(workbook: XLSX.WorkBook): Record<string, string[]> {
  const identified: Record<string, string[]> = {};

  for (const sheetName of workbook.SheetNames) {
    for (const [category, patterns] of Object.entries(SHEET_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(sheetName)) {
          if (!identified[category]) {
            identified[category] = [];
          }
          if (!identified[category].includes(sheetName)) {
            identified[category].push(sheetName);
          }
          break;
        }
      }
    }
  }

  return identified;
}

/**
 * Extract metrics from a single sheet
 */
function extractMetricsFromSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): { metrics: Partial<ExtractedFinancialMetrics>; warnings: string[] } {
  const metrics: Partial<ExtractedFinancialMetrics> = {};
  const warnings: string[] = [];

  // Convert sheet to array of arrays for easier processing
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  // Scan each row for metric patterns
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx] as unknown[];
    if (!row || row.length === 0) continue;

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      if (typeof cell !== 'string') continue;

      const cellText = cell.toString().trim();
      if (!cellText) continue;

      // Check each metric pattern
      for (const [metricKey, patterns] of Object.entries(METRIC_PATTERNS)) {
        for (const pattern of patterns) {
          if (pattern.test(cellText)) {
            // Look for value in adjacent cells (right, below, or nearby)
            const value = findAdjacentValue(data, rowIdx, colIdx);
            if (value !== null) {
              assignMetricValue(metrics, metricKey, value, cellText);
            }
            break;
          }
        }
      }
    }
  }

  return { metrics, warnings };
}

/**
 * Find a numeric value in cells adjacent to the label
 */
function findAdjacentValue(
  data: unknown[][],
  rowIdx: number,
  colIdx: number
): number | null {
  const searchPositions = [
    [rowIdx, colIdx + 1],     // Right
    [rowIdx, colIdx + 2],     // Two right
    [rowIdx + 1, colIdx],     // Below
    [rowIdx + 1, colIdx + 1], // Below-right
  ];

  for (const [r, c] of searchPositions) {
    if (r >= 0 && r < data.length && c >= 0) {
      const row = data[r] as unknown[];
      if (row && c < row.length) {
        const value = parseNumericValue(row[c]);
        if (value !== null) {
          return value;
        }
      }
    }
  }

  return null;
}

/**
 * Parse a cell value as a number
 */
function parseNumericValue(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') {
    return null;
  }

  if (typeof cell === 'number') {
    return cell;
  }

  if (typeof cell === 'string') {
    // Remove currency symbols, commas, and percentage signs
    const cleaned = cell
      .replace(/[$€£¥,]/g, '')
      .replace(/%/g, '')
      .replace(/\s/g, '')
      .trim();

    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      // If original had %, convert to decimal
      if (cell.includes('%')) {
        return num / 100;
      }
      return num;
    }
  }

  return null;
}

/**
 * Assign a value to the appropriate metric field
 */
function assignMetricValue(
  metrics: Partial<ExtractedFinancialMetrics>,
  metricKey: string,
  value: number,
  label: string
): void {
  switch (metricKey) {
    case 'npv':
      if (!metrics.npv) metrics.npv = value;
      break;
    case 'irr':
      // IRR should be a percentage (0-1 range or already as decimal)
      if (!metrics.irr) {
        metrics.irr = value > 1 ? value / 100 : value;
      }
      break;
    case 'payback':
      if (!metrics.paybackPeriod) metrics.paybackPeriod = value;
      break;
    case 'moic':
      if (!metrics.moic) metrics.moic = value;
      break;
    case 'capex':
      if (!metrics.totalCapex) metrics.totalCapex = value;
      break;
    case 'debt':
      if (!metrics.debt) metrics.debt = value;
      break;
    case 'equity':
      if (!metrics.equity) metrics.equity = value;
      break;
    case 'dscr':
      if (label.toLowerCase().includes('min')) {
        if (!metrics.minDscr) metrics.minDscr = value;
      } else {
        if (!metrics.avgDscr) metrics.avgDscr = value;
      }
      break;
    case 'ebitda':
      if (!metrics.avgEbitda) metrics.avgEbitda = value;
      break;
    case 'production':
      if (!metrics.annualProduction) metrics.annualProduction = value;
      break;
    case 'capacityFactor':
      if (!metrics.capacityFactor) {
        metrics.capacityFactor = value > 1 ? value / 100 : value;
      }
      break;
    case 'ppaRate':
      if (!metrics.ppaRate) metrics.ppaRate = value;
      break;
    case 'projectLife':
      if (!metrics.projectLife) metrics.projectLife = Math.round(value);
      break;
  }
}

/**
 * Extract cash flows from a sheet
 */
function extractCashFlowsFromSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): ExtractedCashFlow[] {
  const cashFlows: ExtractedCashFlow[] = [];
  const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  // Look for year headers (e.g., 2024, 2025, Year 1, Year 2)
  let yearRow = -1;
  let yearCols: { col: number; year: number }[] = [];

  for (let rowIdx = 0; rowIdx < Math.min(20, data.length); rowIdx++) {
    const row = data[rowIdx] as unknown[];
    if (!row) continue;

    const potentialYears: { col: number; year: number }[] = [];
    
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx];
      if (cell === null || cell === undefined) continue;

      const cellStr = cell.toString().trim();
      
      // Check for year patterns
      const yearMatch = cellStr.match(/^(20\d{2}|Year\s*(\d+))$/i);
      if (yearMatch) {
        let year: number;
        if (yearMatch[2]) {
          year = parseInt(yearMatch[2]);
        } else {
          year = parseInt(yearMatch[1]);
        }
        potentialYears.push({ col: colIdx, year });
      }
    }

    // If we found multiple consecutive years, this is likely the header row
    if (potentialYears.length >= 3) {
      yearRow = rowIdx;
      yearCols = potentialYears;
      break;
    }
  }

  if (yearRow === -1 || yearCols.length === 0) {
    return cashFlows;
  }

  // Look for cash flow line items
  const lineItems: Record<string, { row: number; pattern: RegExp }> = {
    revenue: { row: -1, pattern: /revenue|income|sales/i },
    opex: { row: -1, pattern: /opex|operating\s*expense|o&m/i },
    ebitda: { row: -1, pattern: /ebitda/i },
    debtService: { row: -1, pattern: /debt\s*service|principal|interest/i },
    netCashFlow: { row: -1, pattern: /net\s*cash|free\s*cash|fcf|cash\s*flow/i },
  };

  // Find rows for each line item
  for (let rowIdx = yearRow + 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx] as unknown[];
    if (!row || row.length === 0) continue;

    const firstCell = row[0];
    if (typeof firstCell !== 'string') continue;

    const cellText = firstCell.toString().trim();
    
    for (const [key, item] of Object.entries(lineItems)) {
      if (item.row === -1 && item.pattern.test(cellText)) {
        item.row = rowIdx;
      }
    }
  }

  // Extract values for each year
  let cumulativeCashFlow = 0;
  
  for (const { col, year } of yearCols) {
    const cf: ExtractedCashFlow = {
      year,
      revenue: 0,
      opex: 0,
      ebitda: 0,
      debtService: 0,
      netCashFlow: 0,
      cumulativeCashFlow: 0,
    };

    for (const [key, item] of Object.entries(lineItems)) {
      if (item.row >= 0) {
        const row = data[item.row] as unknown[];
        if (row && col < row.length) {
          const value = parseNumericValue(row[col]);
          if (value !== null) {
            (cf as Record<string, number>)[key] = value;
          }
        }
      }
    }

    // Calculate cumulative if we have net cash flow
    if (cf.netCashFlow !== 0) {
      cumulativeCashFlow += cf.netCashFlow;
      cf.cumulativeCashFlow = cumulativeCashFlow;
    }

    // Calculate EBITDA if not found but have revenue and opex
    if (cf.ebitda === 0 && cf.revenue !== 0 && cf.opex !== 0) {
      cf.ebitda = cf.revenue - Math.abs(cf.opex);
    }

    // Calculate DSCR if we have EBITDA and debt service
    if (cf.ebitda !== 0 && cf.debtService !== 0) {
      cf.dscr = cf.ebitda / Math.abs(cf.debtService);
    }

    cashFlows.push(cf);
  }

  return cashFlows;
}

/**
 * Merge extracted metrics into the result
 */
function mergeMetrics(
  target: ExtractedFinancialMetrics,
  source: Partial<ExtractedFinancialMetrics>
): number {
  let count = 0;

  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null && key !== 'confidence' && key !== 'extractionNotes') {
      const targetKey = key as keyof ExtractedFinancialMetrics;
      if ((target as Record<string, unknown>)[targetKey] === undefined) {
        (target as Record<string, unknown>)[targetKey] = value;
        count++;
      }
    }
  }

  return count;
}

/**
 * Calculate confidence score based on extracted data
 */
function calculateConfidence(
  metrics: ExtractedFinancialMetrics,
  cashFlows: ExtractedCashFlow[]
): number {
  let score = 0;
  const weights = {
    npv: 15,
    irr: 15,
    paybackPeriod: 5,
    moic: 5,
    totalCapex: 10,
    debt: 5,
    equity: 5,
    avgDscr: 10,
    minDscr: 5,
    avgEbitda: 5,
    annualProduction: 5,
    capacityFactor: 5,
    ppaRate: 5,
    projectLife: 5,
  };

  for (const [key, weight] of Object.entries(weights)) {
    if ((metrics as Record<string, unknown>)[key] !== undefined) {
      score += weight;
    }
  }

  // Bonus for cash flows
  if (cashFlows.length > 0) {
    score += Math.min(20, cashFlows.length * 2);
  }

  return Math.min(100, score);
}

/**
 * Calculate derived metrics from extracted data
 */
function calculateDerivedMetrics(metrics: ExtractedFinancialMetrics): void {
  // Calculate leverage if we have debt and equity
  if (metrics.debt && metrics.equity && !metrics.leverage) {
    metrics.leverage = metrics.debt / (metrics.debt + metrics.equity);
  }

  // Calculate total capex if we have debt and equity
  if (metrics.debt && metrics.equity && !metrics.totalCapex) {
    metrics.totalCapex = metrics.debt + metrics.equity;
  }
}

/**
 * Get a summary of the extraction for display
 */
export function getExtractionSummary(result: ExtractionResult): string {
  const parts: string[] = [];

  if (result.metrics.npv) {
    parts.push(`NPV: $${(result.metrics.npv / 1000000).toFixed(1)}M`);
  }
  if (result.metrics.irr) {
    parts.push(`IRR: ${(result.metrics.irr * 100).toFixed(1)}%`);
  }
  if (result.metrics.avgDscr) {
    parts.push(`DSCR: ${result.metrics.avgDscr.toFixed(2)}x`);
  }
  if (result.cashFlows.length > 0) {
    parts.push(`${result.cashFlows.length} years of cash flows`);
  }

  if (parts.length === 0) {
    return 'No metrics extracted';
  }

  return parts.join(' | ');
}
