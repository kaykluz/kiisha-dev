/**
 * Rollout Scheduling Service
 */

export interface RolloutSchedule {
  id: string;
  name: string;
  featureId: string;
  targetPercentage: number;
  currentPercentage: number;
  strategy: 'linear' | 'exponential' | 'manual';
  startDate: Date;
  endDate?: Date;
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
}

export interface RolloutStep { percentage: number; scheduledAt: Date; completedAt?: Date; status: 'pending' | 'completed'; }

export class RolloutSchedulingService {
  private schedules: Map<string, RolloutSchedule> = new Map();
  private steps: Map<string, RolloutStep[]> = new Map();

  create(config: { name: string; featureId: string; targetPercentage: number; strategy: 'linear' | 'exponential' | 'manual'; startDate: Date; endDate?: Date }): RolloutSchedule {
    const schedule: RolloutSchedule = { ...config, id: `rollout_${Date.now()}`, currentPercentage: 0, status: 'scheduled' };
    this.schedules.set(schedule.id, schedule);
    this.generateSteps(schedule);
    return schedule;
  }

  private generateSteps(s: RolloutSchedule): void {
    const steps: RolloutStep[] = [];
    const dur = s.endDate ? s.endDate.getTime() - s.startDate.getTime() : 7 * 24 * 60 * 60 * 1000;
    if (s.strategy === 'linear') {
      for (let i = 1; i <= 10; i++) steps.push({ percentage: (s.targetPercentage / 10) * i, scheduledAt: new Date(s.startDate.getTime() + (dur / 10) * i), status: 'pending' });
    } else if (s.strategy === 'exponential') {
      [1, 5, 10, 25, 50, 75, 100].filter(p => p <= s.targetPercentage).forEach((p, i, arr) => steps.push({ percentage: p, scheduledAt: new Date(s.startDate.getTime() + (dur / arr.length) * (i + 1)), status: 'pending' }));
    }
    this.steps.set(s.id, steps);
  }

  get(id: string): RolloutSchedule | undefined { return this.schedules.get(id); }
  list(): RolloutSchedule[] { return Array.from(this.schedules.values()); }
  getSteps(id: string): RolloutStep[] { return this.steps.get(id) || []; }

  start(id: string): void { const s = this.schedules.get(id); if (s?.status === 'scheduled') s.status = 'in_progress'; }
  pause(id: string): void { const s = this.schedules.get(id); if (s?.status === 'in_progress') s.status = 'paused'; }
  resume(id: string): void { const s = this.schedules.get(id); if (s?.status === 'paused') s.status = 'in_progress'; }
  cancel(id: string): void { const s = this.schedules.get(id); if (s) s.status = 'cancelled'; }

  advance(id: string): boolean {
    const s = this.schedules.get(id), steps = this.steps.get(id);
    if (!s || !steps || s.status !== 'in_progress') return false;
    const next = steps.find(st => st.status === 'pending');
    if (!next) { s.status = 'completed'; return false; }
    next.status = 'completed'; next.completedAt = new Date(); s.currentPercentage = next.percentage;
    if (s.currentPercentage >= s.targetPercentage) s.status = 'completed';
    return true;
  }

  isUserInRollout(scheduleId: string, userId: string): boolean {
    const s = this.schedules.get(scheduleId);
    if (!s || s.status !== 'in_progress') return false;
    let hash = 0; for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    return Math.abs(hash) % 100 < s.currentPercentage;
  }
}

export const rolloutSchedulingService = new RolloutSchedulingService();
export default rolloutSchedulingService;
