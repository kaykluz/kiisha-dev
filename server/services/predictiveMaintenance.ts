/**
 * Predictive Maintenance ML Service
 */

export interface TelemetryDataPoint {
  deviceId: string;
  timestamp: Date;
  metrics: Record<string, number>;
}

export interface AnomalyDetectionResult {
  deviceId: string;
  timestamp: Date;
  isAnomaly: boolean;
  anomalyScore: number;
  affectedMetrics: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface FailurePrediction {
  deviceId: string;
  predictedFailureDate: Date;
  confidence: number;
  failureType: string;
  recommendedAction: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DeviceHealthScore {
  deviceId: string;
  overallScore: number;
  componentScores: Record<string, number>;
  trend: 'improving' | 'stable' | 'degrading';
  lastUpdated: Date;
}

export interface MaintenanceSchedule {
  id: string;
  deviceId: string;
  scheduledDate: Date;
  maintenanceType: 'preventive' | 'corrective' | 'predictive';
  priority: number;
  estimatedDuration: number;
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const stdDev = (v: number[]) => Math.sqrt(mean(v.map(x => Math.pow(x - mean(v), 2))));

export class AnomalyDetector {
  private history: Map<string, Map<string, number[]>> = new Map();

  addDataPoint(point: TelemetryDataPoint): void {
    if (!this.history.has(point.deviceId)) this.history.set(point.deviceId, new Map());
    const device = this.history.get(point.deviceId)!;
    for (const [metric, value] of Object.entries(point.metrics)) {
      if (!device.has(metric)) device.set(metric, []);
      const values = device.get(metric)!;
      values.push(value);
      if (values.length > 1000) values.shift();
    }
  }

  detect(point: TelemetryDataPoint): AnomalyDetectionResult {
    const device = this.history.get(point.deviceId);
    if (!device) return { deviceId: point.deviceId, timestamp: point.timestamp, isAnomaly: false, anomalyScore: 0, affectedMetrics: [], severity: 'low', description: 'No data' };
    
    const affected: string[] = [];
    let maxScore = 0;
    for (const [metric, value] of Object.entries(point.metrics)) {
      const h = device.get(metric);
      if (!h || h.length < 10) continue;
      const z = Math.abs((value - mean(h)) / (stdDev(h) || 1));
      if (z > 3) { affected.push(metric); maxScore = Math.max(maxScore, z / 3); }
    }
    
    const severity = maxScore > 2 ? 'critical' : maxScore > 1.5 ? 'high' : maxScore > 1 ? 'medium' : 'low';
    return { deviceId: point.deviceId, timestamp: point.timestamp, isAnomaly: affected.length > 0, anomalyScore: Math.min(maxScore, 1), affectedMetrics: affected, severity, description: affected.length ? `Anomaly in ${affected.join(', ')}` : 'Normal' };
  }
}

export class FailurePredictor {
  private rates: Map<string, Map<string, number[]>> = new Map();

  update(deviceId: string, metric: string, value: number, baseline: number): void {
    if (!this.rates.has(deviceId)) this.rates.set(deviceId, new Map());
    const device = this.rates.get(deviceId)!;
    if (!device.has(metric)) device.set(metric, []);
    device.get(metric)!.push((baseline - value) / baseline);
  }

  predict(deviceId: string): FailurePrediction | null {
    const device = this.rates.get(deviceId);
    if (!device) return null;
    let maxDeg = 0, critMetric = '', rate = 0;
    for (const [metric, r] of device) {
      if (r.length < 5) continue;
      const deg = r[r.length - 1];
      const avgRate = (r[r.length - 1] - r[0]) / r.length;
      if (deg > maxDeg) { maxDeg = deg; critMetric = metric; rate = avgRate; }
    }
    if (maxDeg < 0.1 || rate <= 0) return null;
    const days = Math.max(1, Math.round((0.3 - maxDeg) / rate));
    const date = new Date(); date.setDate(date.getDate() + days);
    return { deviceId, predictedFailureDate: date, confidence: Math.min(0.95, 0.5 + maxDeg), failureType: `${critMetric} degradation`, recommendedAction: days < 7 ? 'Immediate maintenance' : 'Plan maintenance', riskLevel: days < 7 ? 'high' : days < 30 ? 'medium' : 'low' };
  }
}

export class HealthScoreCalculator {
  calculate(deviceId: string, metrics: Record<string, number>, baselines: Record<string, number>): DeviceHealthScore {
    const scores: Record<string, number> = {};
    let total = 0, count = 0;
    for (const [m, v] of Object.entries(metrics)) {
      if (baselines[m]) { scores[m] = Math.min(100, (v / baselines[m]) * 100); total += scores[m]; count++; }
    }
    const overall = count ? total / count : 50;
    return { deviceId, overallScore: Math.round(overall), componentScores: scores, trend: overall > 80 ? 'improving' : overall > 60 ? 'stable' : 'degrading', lastUpdated: new Date() };
  }
}

export class MaintenanceScheduler {
  private schedules: MaintenanceSchedule[] = [];

  addFromPrediction(p: FailurePrediction): MaintenanceSchedule {
    const s: MaintenanceSchedule = {
      id: `maint_${Date.now()}`,
      deviceId: p.deviceId,
      scheduledDate: new Date(p.predictedFailureDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      maintenanceType: 'predictive',
      priority: p.riskLevel === 'high' ? 1 : 2,
      estimatedDuration: p.riskLevel === 'high' ? 4 : 2
    };
    this.schedules.push(s);
    return s;
  }

  getUpcoming(days: number = 30): MaintenanceSchedule[] {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + days);
    return this.schedules.filter(s => s.scheduledDate <= cutoff).sort((a, b) => a.priority - b.priority);
  }
}

export class PredictiveMaintenanceService {
  private anomaly = new AnomalyDetector();
  private failure = new FailurePredictor();
  private health = new HealthScoreCalculator();
  private scheduler = new MaintenanceScheduler();

  process(point: TelemetryDataPoint, baselines: Record<string, number>) {
    this.anomaly.addDataPoint(point);
    const a = this.anomaly.detect(point);
    const h = this.health.calculate(point.deviceId, point.metrics, baselines);
    for (const [m, v] of Object.entries(point.metrics)) if (baselines[m]) this.failure.update(point.deviceId, m, v, baselines[m]);
    const p = this.failure.predict(point.deviceId);
    if (p && p.riskLevel !== 'low') this.scheduler.addFromPrediction(p);
    return { anomaly: a, health: h, prediction: p };
  }

  getUpcomingMaintenance(days = 30) { return this.scheduler.getUpcoming(days); }
}

export const predictiveMaintenanceService = new PredictiveMaintenanceService();
export default predictiveMaintenanceService;
