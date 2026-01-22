/**
 * Auto-Prefill from Stored Data Service
 */

export interface PrefillSource { type: string; id: string; data: Record<string, any>; }
export interface PrefillResult { filled: Record<string, any>; missing: string[]; confidence: Record<string, number>; }

export class AutoPrefillService {
  private sources: Map<string, PrefillSource> = new Map();
  private mappings: Map<string, string[]> = new Map([
    ['companyName', ['company_name', 'organization_name', 'org_name', 'business_name']],
    ['companyAddress', ['company_address', 'business_address', 'address']],
    ['companyEmail', ['company_email', 'business_email', 'contact_email', 'email']],
    ['contactName', ['contact_name', 'full_name', 'name']],
    ['contactEmail', ['contact_email', 'email']],
    ['contactPhone', ['contact_phone', 'phone', 'mobile']],
    ['projectName', ['project_name', 'project_title', 'name']],
    ['projectLocation', ['project_location', 'location', 'site_address']],
    ['bankName', ['bank_name', 'bank']],
    ['accountNumber', ['account_number', 'bank_account']],
  ]);

  registerSource(source: PrefillSource): void { this.sources.set(`${source.type}_${source.id}`, source); }
  removeSource(type: string, id: string): void { this.sources.delete(`${type}_${id}`); }

  prefill(targetFields: string[], sourceTypes?: string[]): PrefillResult {
    const filled: Record<string, any> = {};
    const missing: string[] = [];
    const confidence: Record<string, number> = {};

    for (const field of targetFields) {
      const result = this.findMatch(field, sourceTypes);
      if (result) { filled[field] = result.value; confidence[field] = result.confidence; }
      else missing.push(field);
    }
    return { filled, missing, confidence };
  }

  private findMatch(field: string, sourceTypes?: string[]): { value: any; confidence: number } | null {
    const names = this.mappings.get(field) || [field];
    let best: { value: any; confidence: number } | null = null;

    for (const src of Array.from(this.sources.values())) {
      if (sourceTypes && !sourceTypes.includes(src.type)) continue;
      for (const name of names) {
        const value = this.getValue(src.data, name);
        if (value !== undefined && value !== null && value !== '') {
          const conf = field.toLowerCase() === name.toLowerCase() ? 1.0 : 0.8;
          if (!best || conf > best.confidence) best = { value, confidence: conf };
        }
      }
    }
    return best;
  }

  private getValue(obj: Record<string, any>, path: string): any {
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (!curr) return undefined;
      curr = curr[p] || curr[p.toLowerCase()] || curr[p.replace(/_([a-z])/g, (_, l) => l.toUpperCase())];
    }
    return curr;
  }

  suggestMappings(sourceData: Record<string, any>, targetFields: string[]): Map<string, string[]> {
    const suggestions = new Map<string, string[]>();
    const keys = this.flattenKeys(sourceData);
    for (const field of targetFields) {
      const names = this.mappings.get(field) || [field];
      const matches = keys.filter(k => names.some(n => k.toLowerCase().includes(n.toLowerCase())));
      if (matches.length) suggestions.set(field, [...new Set(matches)]);
    }
    return suggestions;
  }

  private flattenKeys(obj: Record<string, any>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const full = prefix ? `${prefix}.${k}` : k;
      keys.push(full);
      if (typeof v === 'object' && v && !Array.isArray(v)) keys.push(...this.flattenKeys(v, full));
    }
    return keys;
  }
}

export const autoPrefillService = new AutoPrefillService();
export default autoPrefillService;
