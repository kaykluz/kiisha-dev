/**
 * Telemetry Query Provider Abstraction
 * 
 * Provides a unified interface for querying telemetry data from different backends:
 * - Phase 1: MySQL (normalizedMeasurements table)
 * - Phase 2: Prometheus (future)
 * - Phase 3: InfluxDB/TimescaleDB (future)
 */

// ============================================================================
// Types
// ============================================================================

export interface TimeRange {
  from: Date;
  to: Date;
}

export interface TelemetryQuery {
  /** Organization ID for multi-tenant isolation */
  orgId: number;
  /** Optional project IDs to filter */
  projectIds?: number[];
  /** Optional site IDs to filter */
  siteIds?: number[];
  /** Optional device IDs to filter */
  deviceIds?: number[];
  /** Metric names to query */
  metrics: string[];
  /** Time range */
  timeRange: TimeRange;
  /** Aggregation interval (e.g., '1h', '1d', '5m') */
  interval?: string;
  /** Aggregation function */
  aggregation?: 'avg' | 'sum' | 'min' | 'max' | 'count' | 'last';
  /** Maximum number of data points */
  maxDataPoints?: number;
  /** Group by dimensions */
  groupBy?: ('project' | 'site' | 'device' | 'metric')[];
}

export interface TelemetryDataPoint {
  timestamp: Date;
  value: number;
  metric: string;
  labels?: Record<string, string | number>;
}

export interface TelemetrySeries {
  metric: string;
  labels: Record<string, string | number>;
  dataPoints: TelemetryDataPoint[];
}

export interface TelemetryResult {
  series: TelemetrySeries[];
  query: TelemetryQuery;
  executionTimeMs: number;
}

export interface TelemetrySummary {
  metric: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  total: number;
  count: number;
  unit?: string;
}

export interface ProviderHealth {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface TelemetryQueryProvider {
  /** Provider name for logging */
  readonly name: string;
  
  /** Query time series data */
  query(query: TelemetryQuery): Promise<TelemetryResult>;
  
  /** Get summary statistics for metrics */
  getSummary(query: Omit<TelemetryQuery, 'interval' | 'aggregation'>): Promise<TelemetrySummary[]>;
  
  /** Get available metrics for a scope */
  getAvailableMetrics(orgId: number, projectIds?: number[]): Promise<string[]>;
  
  /** Health check */
  healthCheck(): Promise<ProviderHealth>;
}

// ============================================================================
// MySQL Telemetry Provider (Phase 1)
// ============================================================================

import { getDb } from '../db';
import { normalizedMeasurements, devices, projects } from '../../drizzle/schema';
import { eq, and, gte, lte, inArray, sql, desc } from 'drizzle-orm';

export class MySqlTelemetryProvider implements TelemetryQueryProvider {
  readonly name = 'mysql';

  async query(query: TelemetryQuery): Promise<TelemetryResult> {
    const startTime = Date.now();
    const db = getDb();

    // Build WHERE conditions
    const conditions = [
      eq(normalizedMeasurements.organizationId, query.orgId),
      gte(normalizedMeasurements.timestamp, query.timeRange.from),
      lte(normalizedMeasurements.timestamp, query.timeRange.to),
    ];

    if (query.metrics.length > 0) {
      conditions.push(inArray(normalizedMeasurements.metricName, query.metrics));
    }

    if (query.projectIds && query.projectIds.length > 0) {
      conditions.push(inArray(normalizedMeasurements.projectId, query.projectIds));
    }

    if (query.siteIds && query.siteIds.length > 0) {
      conditions.push(inArray(normalizedMeasurements.siteId, query.siteIds));
    }

    if (query.deviceIds && query.deviceIds.length > 0) {
      conditions.push(inArray(normalizedMeasurements.deviceId, query.deviceIds));
    }

    // Determine aggregation
    const aggFunc = this.getAggregationFunction(query.aggregation || 'avg');
    const intervalSeconds = this.parseInterval(query.interval || '1h');

    // Build query with time bucketing
    const results = await db
      .select({
        timestamp: sql<Date>`FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(${normalizedMeasurements.timestamp}) / ${intervalSeconds}) * ${intervalSeconds})`.as('bucket'),
        metricName: normalizedMeasurements.metricName,
        projectId: normalizedMeasurements.projectId,
        siteId: normalizedMeasurements.siteId,
        deviceId: normalizedMeasurements.deviceId,
        value: aggFunc,
      })
      .from(normalizedMeasurements)
      .where(and(...conditions))
      .groupBy(
        sql`bucket`,
        normalizedMeasurements.metricName,
        ...(query.groupBy?.includes('project') ? [normalizedMeasurements.projectId] : []),
        ...(query.groupBy?.includes('site') ? [normalizedMeasurements.siteId] : []),
        ...(query.groupBy?.includes('device') ? [normalizedMeasurements.deviceId] : []),
      )
      .orderBy(sql`bucket`)
      .limit(query.maxDataPoints || 1000);

    // Group results into series
    const seriesMap = new Map<string, TelemetrySeries>();

    for (const row of results) {
      const labels: Record<string, string | number> = {};
      if (query.groupBy?.includes('project') && row.projectId) {
        labels.projectId = row.projectId;
      }
      if (query.groupBy?.includes('site') && row.siteId) {
        labels.siteId = row.siteId;
      }
      if (query.groupBy?.includes('device') && row.deviceId) {
        labels.deviceId = row.deviceId;
      }

      const seriesKey = `${row.metricName}-${JSON.stringify(labels)}`;
      
      if (!seriesMap.has(seriesKey)) {
        seriesMap.set(seriesKey, {
          metric: row.metricName,
          labels,
          dataPoints: [],
        });
      }

      seriesMap.get(seriesKey)!.dataPoints.push({
        timestamp: row.timestamp,
        value: Number(row.value) || 0,
        metric: row.metricName,
        labels,
      });
    }

    return {
      series: Array.from(seriesMap.values()),
      query,
      executionTimeMs: Date.now() - startTime,
    };
  }

  async getSummary(query: Omit<TelemetryQuery, 'interval' | 'aggregation'>): Promise<TelemetrySummary[]> {
    const db = getDb();

    const conditions = [
      eq(normalizedMeasurements.organizationId, query.orgId),
      gte(normalizedMeasurements.timestamp, query.timeRange.from),
      lte(normalizedMeasurements.timestamp, query.timeRange.to),
    ];

    if (query.metrics.length > 0) {
      conditions.push(inArray(normalizedMeasurements.metricName, query.metrics));
    }

    if (query.projectIds && query.projectIds.length > 0) {
      conditions.push(inArray(normalizedMeasurements.projectId, query.projectIds));
    }

    const results = await db
      .select({
        metricName: normalizedMeasurements.metricName,
        unit: normalizedMeasurements.unit,
        current: sql<number>`(SELECT ${normalizedMeasurements.value} FROM ${normalizedMeasurements} m2 WHERE m2.metric_name = ${normalizedMeasurements.metricName} ORDER BY m2.timestamp DESC LIMIT 1)`,
        min: sql<number>`MIN(${normalizedMeasurements.value})`,
        max: sql<number>`MAX(${normalizedMeasurements.value})`,
        avg: sql<number>`AVG(${normalizedMeasurements.value})`,
        total: sql<number>`SUM(${normalizedMeasurements.value})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(normalizedMeasurements)
      .where(and(...conditions))
      .groupBy(normalizedMeasurements.metricName, normalizedMeasurements.unit);

    return results.map(row => ({
      metric: row.metricName,
      current: Number(row.current) || 0,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
      avg: Number(row.avg) || 0,
      total: Number(row.total) || 0,
      count: Number(row.count) || 0,
      unit: row.unit || undefined,
    }));
  }

  async getAvailableMetrics(orgId: number, projectIds?: number[]): Promise<string[]> {
    const db = getDb();

    const conditions = [eq(normalizedMeasurements.organizationId, orgId)];
    
    if (projectIds && projectIds.length > 0) {
      conditions.push(inArray(normalizedMeasurements.projectId, projectIds));
    }

    const results = await db
      .selectDistinct({ metricName: normalizedMeasurements.metricName })
      .from(normalizedMeasurements)
      .where(and(...conditions))
      .orderBy(normalizedMeasurements.metricName);

    return results.map(r => r.metricName);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      const db = getDb();
      await db.select({ count: sql<number>`1` }).from(normalizedMeasurements).limit(1);
      
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: String(error),
      };
    }
  }

  private getAggregationFunction(agg: string) {
    switch (agg) {
      case 'sum':
        return sql<number>`SUM(${normalizedMeasurements.value})`;
      case 'min':
        return sql<number>`MIN(${normalizedMeasurements.value})`;
      case 'max':
        return sql<number>`MAX(${normalizedMeasurements.value})`;
      case 'count':
        return sql<number>`COUNT(*)`;
      case 'last':
        return sql<number>`(SELECT ${normalizedMeasurements.value} ORDER BY ${normalizedMeasurements.timestamp} DESC LIMIT 1)`;
      case 'avg':
      default:
        return sql<number>`AVG(${normalizedMeasurements.value})`;
    }
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }
}

// ============================================================================
// Prometheus Telemetry Provider (Phase 2 Stub)
// ============================================================================

export class PrometheusTelemetryProvider implements TelemetryQueryProvider {
  readonly name = 'prometheus';
  
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async query(query: TelemetryQuery): Promise<TelemetryResult> {
    const startTime = Date.now();
    const step = this.intervalToSeconds(query.interval || '1h');
    const metricsExpr = query.metrics.map(m => `{__name__="${m}"}`).join(' or ');
    const promQuery = query.aggregation
      ? `${query.aggregation}_over_time(${metricsExpr}[${query.interval || '1h'}])`
      : metricsExpr;

    const params = new URLSearchParams({
      query: promQuery,
      start: (query.timeRange.from.getTime() / 1000).toString(),
      end: (query.timeRange.to.getTime() / 1000).toString(),
      step: step.toString(),
    });

    const response = await fetch(`${this.baseUrl}/api/v1/query_range?${params}`);
    if (!response.ok) throw new Error(`Prometheus query failed: ${response.status}`);

    const data = await response.json();
    const series: TelemetrySeries[] = (data.data?.result || []).map((r: any) => ({
      metric: r.metric?.__name__ || 'unknown',
      labels: r.metric || {},
      dataPoints: (r.values || []).map(([ts, val]: [number, string]) => ({
        timestamp: new Date(ts * 1000),
        value: parseFloat(val),
        metric: r.metric?.__name__ || 'unknown',
      })),
    }));

    return { series, query, executionTimeMs: Date.now() - startTime };
  }

  async getSummary(query: Omit<TelemetryQuery, 'interval' | 'aggregation'>): Promise<TelemetrySummary[]> {
    const summaries: TelemetrySummary[] = [];
    for (const metric of query.metrics) {
      const fns = ['avg', 'min', 'max', 'count'] as const;
      const results: Record<string, number> = {};

      for (const fn of fns) {
        const duration = Math.floor((query.timeRange.to.getTime() - query.timeRange.from.getTime()) / 1000);
        const promQuery = `${fn}_over_time({__name__="${metric}"}[${duration}s])`;
        const params = new URLSearchParams({ query: promQuery, time: (query.timeRange.to.getTime() / 1000).toString() });
        const response = await fetch(`${this.baseUrl}/api/v1/query?${params}`);
        if (response.ok) {
          const data = await response.json();
          const val = data.data?.result?.[0]?.value?.[1];
          results[fn] = val ? parseFloat(val) : 0;
        }
      }

      summaries.push({
        metric,
        current: results.avg || 0,
        min: results.min || 0,
        max: results.max || 0,
        avg: results.avg || 0,
        total: (results.avg || 0) * (results.count || 0),
        count: results.count || 0,
      });
    }
    return summaries;
  }

  async getAvailableMetrics(_orgId: number, _projectIds?: number[]): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/label/__name__/values`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  }

  private intervalToSeconds(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) return 3600;
    const [, num, unit] = match;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return parseInt(num) * (multipliers[unit] || 3600);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/-/healthy`);
      return {
        healthy: response.ok,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: String(error),
      };
    }
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

export type TelemetryProviderType = 'mysql' | 'prometheus';

const providerInstances = new Map<string, TelemetryQueryProvider>();

export function getTelemetryProvider(
  type: TelemetryProviderType = 'mysql',
  config?: { prometheusUrl?: string }
): TelemetryQueryProvider {
  const cacheKey = `${type}-${JSON.stringify(config)}`;
  
  if (!providerInstances.has(cacheKey)) {
    switch (type) {
      case 'prometheus':
        if (!config?.prometheusUrl) {
          throw new Error('Prometheus URL required for prometheus provider');
        }
        providerInstances.set(cacheKey, new PrometheusTelemetryProvider(config.prometheusUrl));
        break;
      case 'mysql':
      default:
        providerInstances.set(cacheKey, new MySqlTelemetryProvider());
        break;
    }
  }

  return providerInstances.get(cacheKey)!;
}

/**
 * Get the default telemetry provider for an organization
 * In the future, this could be configurable per-org
 */
export function getOrgTelemetryProvider(_orgId: number): TelemetryQueryProvider {
  // Phase 1: Always use MySQL
  // Phase 2: Look up org config to determine provider
  return getTelemetryProvider('mysql');
}
