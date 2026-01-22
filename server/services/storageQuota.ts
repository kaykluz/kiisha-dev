/**
 * Storage Quota Enforcement Service
 */

export interface StorageQuota { organizationId: number; maxBytes: number; usedBytes: number; warningThreshold: number; }
export interface StorageUsage { totalBytes: number; fileCount: number; byType: Record<string, { bytes: number; count: number }>; }

export class StorageQuotaService {
  private quotas: Map<number, StorageQuota> = new Map();
  private usage: Map<number, StorageUsage> = new Map();
  private defaultQuota = 10 * 1024 * 1024 * 1024; // 10GB

  setQuota(orgId: number, maxBytes: number, warningThreshold = 0.8): void {
    const existing = this.quotas.get(orgId);
    this.quotas.set(orgId, { organizationId: orgId, maxBytes, usedBytes: existing?.usedBytes || 0, warningThreshold });
  }

  getQuota(orgId: number): StorageQuota {
    return this.quotas.get(orgId) || { organizationId: orgId, maxBytes: this.defaultQuota, usedBytes: 0, warningThreshold: 0.8 };
  }

  getUsage(orgId: number): StorageUsage {
    return this.usage.get(orgId) || { totalBytes: 0, fileCount: 0, byType: {} };
  }

  canUpload(orgId: number, fileSize: number): { allowed: boolean; reason?: string; remaining: number } {
    const quota = this.getQuota(orgId);
    const remaining = quota.maxBytes - quota.usedBytes;
    if (fileSize > remaining) return { allowed: false, reason: `Insufficient storage. Need ${this.formatBytes(fileSize)}, have ${this.formatBytes(remaining)}`, remaining };
    return { allowed: true, remaining: remaining - fileSize };
  }

  recordUpload(orgId: number, fileSize: number, fileType: string): void {
    const quota = this.getQuota(orgId);
    quota.usedBytes += fileSize;
    this.quotas.set(orgId, quota);
    const usage = this.getUsage(orgId);
    usage.totalBytes += fileSize;
    usage.fileCount++;
    usage.byType[fileType] = usage.byType[fileType] || { bytes: 0, count: 0 };
    usage.byType[fileType].bytes += fileSize;
    usage.byType[fileType].count++;
    this.usage.set(orgId, usage);
  }

  recordDeletion(orgId: number, fileSize: number, fileType: string): void {
    const quota = this.getQuota(orgId);
    quota.usedBytes = Math.max(0, quota.usedBytes - fileSize);
    this.quotas.set(orgId, quota);
    const usage = this.getUsage(orgId);
    usage.totalBytes = Math.max(0, usage.totalBytes - fileSize);
    usage.fileCount = Math.max(0, usage.fileCount - 1);
    if (usage.byType[fileType]) { usage.byType[fileType].bytes = Math.max(0, usage.byType[fileType].bytes - fileSize); usage.byType[fileType].count = Math.max(0, usage.byType[fileType].count - 1); }
    this.usage.set(orgId, usage);
  }

  isNearLimit(orgId: number): boolean { const q = this.getQuota(orgId); return q.usedBytes / q.maxBytes >= q.warningThreshold; }
  getUsagePercentage(orgId: number): number { const q = this.getQuota(orgId); return Math.round((q.usedBytes / q.maxBytes) * 100); }
  private formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`; }
}

export const storageQuotaService = new StorageQuotaService();
export default storageQuotaService;
