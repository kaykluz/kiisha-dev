/**
 * A/B Testing Framework Service
 */

export interface Experiment { id: string; name: string; variants: Variant[]; trafficAllocation: number; status: 'draft' | 'running' | 'paused' | 'completed'; metrics: string[]; }
export interface Variant { id: string; name: string; weight: number; config: Record<string, any>; }
export interface Assignment { experimentId: string; variantId: string; userId: string; assignedAt: Date; }

export class ABTestingService {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, Assignment> = new Map();
  private results: Map<string, number[]> = new Map();

  createExperiment(config: { name: string; variants: Variant[]; trafficAllocation: number; metrics: string[] }): Experiment {
    const experiment: Experiment = { ...config, id: `exp_${Date.now()}`, status: 'draft' };
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  startExperiment(id: string): void { const e = this.experiments.get(id); if (e) e.status = 'running'; }
  pauseExperiment(id: string): void { const e = this.experiments.get(id); if (e) e.status = 'paused'; }
  completeExperiment(id: string): void { const e = this.experiments.get(id); if (e) e.status = 'completed'; }

  getVariant(experimentId: string, userId: string): Variant | null {
    const exp = this.experiments.get(experimentId);
    if (!exp || exp.status !== 'running') return null;
    const key = `${experimentId}_${userId}`;
    const existing = this.assignments.get(key);
    if (existing) return exp.variants.find(v => v.id === existing.variantId) || null;
    const hash = this.hashUserId(userId);
    if ((hash % 100) >= exp.trafficAllocation) return null;
    const totalWeight = exp.variants.reduce((s, v) => s + v.weight, 0);
    let random = (hash % 1000) / 1000 * totalWeight;
    for (const v of exp.variants) { random -= v.weight; if (random <= 0) { this.assignments.set(key, { experimentId, variantId: v.id, userId, assignedAt: new Date() }); return v; } }
    return exp.variants[0];
  }

  recordMetric(experimentId: string, userId: string, metric: string, value: number): void {
    const key = `${experimentId}_${userId}`;
    const assignment = this.assignments.get(key);
    if (!assignment) return;
    const resultKey = `${experimentId}_${assignment.variantId}_${metric}`;
    const results = this.results.get(resultKey) || [];
    results.push(value);
    this.results.set(resultKey, results);
  }

  getResults(experimentId: string): Record<string, Record<string, { mean: number; count: number }>> {
    const exp = this.experiments.get(experimentId);
    if (!exp) return {};
    const results: Record<string, Record<string, { mean: number; count: number }>> = {};
    for (const v of exp.variants) {
      results[v.id] = {};
      for (const m of exp.metrics) {
        const data = this.results.get(`${experimentId}_${v.id}_${m}`) || [];
        results[v.id][m] = { mean: data.length ? data.reduce((s, x) => s + x, 0) / data.length : 0, count: data.length };
      }
    }
    return results;
  }

  getExperiment(id: string): Experiment | undefined { return this.experiments.get(id); }
  listExperiments(): Experiment[] { return Array.from(this.experiments.values()); }
  private hashUserId(userId: string): number { let hash = 0; for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash) + userId.charCodeAt(i); return Math.abs(hash); }
}

export const abTestingService = new ABTestingService();
export default abTestingService;
