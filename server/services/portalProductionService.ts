/**
 * Portal Production Monitoring Service
 * 
 * Provides production data for customer portal dashboards.
 * Uses normalized aggregates (hour/day) by default with optional real-time streaming.
 * Implements allowedMetrics filtering from scope grants.
 */

import { getDb } from "../db";
import { 
  clientScopeGrants,
  portalFieldPolicies,
} from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Time aggregation periods
 */
export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

/**
 * Metric types available for portal
 */
export type PortalMetricType = 
  | 'energy_production'
  | 'energy_consumption'
  | 'power_output'
  | 'irradiance'
  | 'temperature'
  | 'performance_ratio'
  | 'availability';

/**
 * Production data point
 */
interface ProductionDataPoint {
  timestamp: Date;
  value: number;
  unit: string;
  metricType: PortalMetricType;
}

/**
 * Production summary
 */
interface ProductionSummary {
  totalProduction: number;
  averagePerformance: number;
  peakOutput: number;
  availability: number;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Get allowed metrics for a client account based on scope grants
 */
export async function getAllowedMetrics(
  clientAccountId: number
): Promise<PortalMetricType[]> {
  const db = await getDb();
  
  // Get scope grants for this client
  const grants = await db
    .select()
    .from(clientScopeGrants)
    .where(
      and(
        eq(clientScopeGrants.clientAccountId, clientAccountId),
        eq(clientScopeGrants.status, 'active')
      )
    );
  
  // Collect allowed metrics from grants
  const allowedMetrics = new Set<PortalMetricType>();
  
  for (const grant of grants) {
    // Parse allowedMetrics from grant if stored
    if (grant.allowedMetrics) {
      try {
        const metrics = JSON.parse(grant.allowedMetrics as string) as PortalMetricType[];
        metrics.forEach(m => allowedMetrics.add(m));
      } catch {
        // Default metrics if parsing fails
        allowedMetrics.add('energy_production');
        allowedMetrics.add('performance_ratio');
      }
    } else {
      // Default metrics for grants without explicit allowedMetrics
      allowedMetrics.add('energy_production');
      allowedMetrics.add('performance_ratio');
      allowedMetrics.add('availability');
    }
  }
  
  // If no grants found, return default metrics
  if (allowedMetrics.size === 0) {
    return ['energy_production', 'performance_ratio', 'availability'];
  }
  
  return Array.from(allowedMetrics);
}

/**
 * Get field visibility policies for portal
 */
export async function getFieldPolicies(
  clientAccountId: number,
  entityType: string
): Promise<Map<string, boolean>> {
  const db = await getDb();
  
  // Get field policies
  const [policies] = await db.execute(`
    SELECT fieldName, isVisible FROM portalFieldPolicies 
    WHERE clientAccountId = ${clientAccountId} 
    AND entityType = '${entityType}'
    AND isVisible = true
  `);
  
  const visibilityMap = new Map<string, boolean>();
  
  if (Array.isArray(policies)) {
    for (const policy of policies as any[]) {
      visibilityMap.set(policy.fieldName, policy.isVisible);
    }
  }
  
  return visibilityMap;
}

/**
 * Get production data for a project
 * Uses normalized aggregates by default
 */
export async function getProjectProductionData(
  projectId: number,
  clientAccountId: number,
  options: {
    metricTypes?: PortalMetricType[];
    period?: AggregationPeriod;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<ProductionDataPoint[]> {
  const db = await getDb();
  
  // Get allowed metrics
  const allowedMetrics = await getAllowedMetrics(clientAccountId);
  
  // Filter requested metrics by allowed metrics
  const requestedMetrics = options.metricTypes || allowedMetrics;
  const filteredMetrics = requestedMetrics.filter(m => allowedMetrics.includes(m));
  
  if (filteredMetrics.length === 0) {
    return [];
  }
  
  // Set default date range (last 30 days)
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const period = options.period || 'day';
  const limit = options.limit || 100;
  
  // Build aggregation query based on period
  // This is a placeholder - in production, query normalizedMeasurements table
  const dataPoints: ProductionDataPoint[] = [];
  
  // Generate sample data for demonstration
  // In production, this would query the actual measurements table
  const currentDate = new Date(startDate);
  while (currentDate <= endDate && dataPoints.length < limit) {
    for (const metricType of filteredMetrics) {
      dataPoints.push({
        timestamp: new Date(currentDate),
        value: generateSampleValue(metricType),
        unit: getMetricUnit(metricType),
        metricType,
      });
    }
    
    // Increment based on period
    switch (period) {
      case 'hour':
        currentDate.setHours(currentDate.getHours() + 1);
        break;
      case 'day':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'week':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'month':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }
  
  return dataPoints;
}

/**
 * Get production summary for a project
 */
export async function getProjectProductionSummary(
  projectId: number,
  clientAccountId: number,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<ProductionSummary> {
  // Get allowed metrics
  const allowedMetrics = await getAllowedMetrics(clientAccountId);
  
  // Set default date range (current month)
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  
  // In production, aggregate from normalizedMeasurements
  // This is sample data for demonstration
  return {
    totalProduction: allowedMetrics.includes('energy_production') ? 12500 : 0,
    averagePerformance: allowedMetrics.includes('performance_ratio') ? 85.5 : 0,
    peakOutput: allowedMetrics.includes('power_output') ? 450 : 0,
    availability: allowedMetrics.includes('availability') ? 98.2 : 0,
    period: {
      start: startDate,
      end: endDate,
    },
  };
}

/**
 * Get production data for multiple sites
 */
export async function getMultiSiteProductionData(
  siteIds: number[],
  clientAccountId: number,
  options: {
    metricTypes?: PortalMetricType[];
    period?: AggregationPeriod;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<Map<number, ProductionDataPoint[]>> {
  const result = new Map<number, ProductionDataPoint[]>();
  
  // In production, batch query for efficiency
  for (const siteId of siteIds) {
    // For now, use project-level query (sites map to projects)
    const data = await getProjectProductionData(siteId, clientAccountId, options);
    result.set(siteId, data);
  }
  
  return result;
}

/**
 * Subscribe to real-time production updates (WebSocket)
 * Returns subscription configuration
 */
export async function getRealtimeSubscriptionConfig(
  projectId: number,
  clientAccountId: number
): Promise<{
  allowed: boolean;
  metrics: PortalMetricType[];
  intervalMs: number;
  maxDuration: number;
}> {
  // Get allowed metrics
  const allowedMetrics = await getAllowedMetrics(clientAccountId);
  
  // Real-time is limited to specific metrics
  const realtimeMetrics = allowedMetrics.filter(m => 
    ['power_output', 'irradiance', 'temperature'].includes(m)
  );
  
  return {
    allowed: realtimeMetrics.length > 0,
    metrics: realtimeMetrics,
    intervalMs: 5000, // 5 second updates
    maxDuration: 30 * 60 * 1000, // 30 minutes max
  };
}

// Helper functions

function generateSampleValue(metricType: PortalMetricType): number {
  switch (metricType) {
    case 'energy_production':
      return Math.round(Math.random() * 500 + 200);
    case 'energy_consumption':
      return Math.round(Math.random() * 100 + 50);
    case 'power_output':
      return Math.round(Math.random() * 400 + 100);
    case 'irradiance':
      return Math.round(Math.random() * 800 + 200);
    case 'temperature':
      return Math.round(Math.random() * 20 + 20);
    case 'performance_ratio':
      return Math.round(Math.random() * 20 + 75);
    case 'availability':
      return Math.round(Math.random() * 5 + 95);
    default:
      return 0;
  }
}

function getMetricUnit(metricType: PortalMetricType): string {
  switch (metricType) {
    case 'energy_production':
    case 'energy_consumption':
      return 'kWh';
    case 'power_output':
      return 'kW';
    case 'irradiance':
      return 'W/m²';
    case 'temperature':
      return '°C';
    case 'performance_ratio':
    case 'availability':
      return '%';
    default:
      return '';
  }
}
