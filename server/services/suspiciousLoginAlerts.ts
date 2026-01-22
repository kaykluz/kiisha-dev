/**
 * Suspicious Login Alerts Service
 */

export interface LoginAttempt { userId: string; ip: string; userAgent: string; timestamp: Date; success: boolean; location?: { country: string; city: string }; }
export interface LoginRisk { score: number; factors: string[]; action: 'allow' | 'challenge' | 'block'; }
export interface UserLoginHistory { userId: string; knownIps: Set<string>; knownDevices: Set<string>; knownCountries: Set<string>; lastLogin?: Date; failedAttempts: number; }

export class SuspiciousLoginAlertsService {
  private history: Map<string, UserLoginHistory> = new Map();
  private blockedIps: Set<string> = new Set();
  private alerts: Array<{ userId: string; type: string; details: string; timestamp: Date }> = [];

  assessRisk(attempt: LoginAttempt): LoginRisk {
    const factors: string[] = [];
    let score = 0;
    if (this.blockedIps.has(attempt.ip)) return { score: 100, factors: ['Blocked IP'], action: 'block' };
    const h = this.history.get(attempt.userId);
    if (!h) { score += 20; factors.push('New user'); }
    else {
      if (!h.knownIps.has(attempt.ip)) { score += 25; factors.push('New IP'); }
      if (!h.knownDevices.has(attempt.userAgent)) { score += 20; factors.push('New device'); }
      if (attempt.location && !h.knownCountries.has(attempt.location.country)) { score += 30; factors.push('New country'); }
      if (h.failedAttempts > 3) { score += 15 * Math.min(h.failedAttempts - 3, 5); factors.push(`${h.failedAttempts} failed attempts`); }
    }
    if (['curl', 'wget', 'python', 'bot'].some(s => attempt.userAgent.toLowerCase().includes(s))) { score += 20; factors.push('Suspicious UA'); }
    return { score: Math.min(score, 100), factors, action: score >= 70 ? 'block' : score >= 40 ? 'challenge' : 'allow' };
  }

  recordLogin(attempt: LoginAttempt): void {
    let h = this.history.get(attempt.userId);
    if (!h) { h = { userId: attempt.userId, knownIps: new Set(), knownDevices: new Set(), knownCountries: new Set(), failedAttempts: 0 }; this.history.set(attempt.userId, h); }
    if (attempt.success) { h.knownIps.add(attempt.ip); h.knownDevices.add(attempt.userAgent); if (attempt.location) h.knownCountries.add(attempt.location.country); h.lastLogin = attempt.timestamp; h.failedAttempts = 0; }
    else { h.failedAttempts++; if (h.failedAttempts >= 10) this.blockedIps.add(attempt.ip); }
  }

  createAlert(userId: string, type: string, details: string): void { this.alerts.push({ userId, type, details, timestamp: new Date() }); }
  getAlerts(userId?: string) { return userId ? this.alerts.filter(a => a.userId === userId) : this.alerts; }
  blockIp(ip: string): void { this.blockedIps.add(ip); }
  unblockIp(ip: string): void { this.blockedIps.delete(ip); }
  isIpBlocked(ip: string): boolean { return this.blockedIps.has(ip); }
}

export const suspiciousLoginAlertsService = new SuspiciousLoginAlertsService();
export default suspiciousLoginAlertsService;
