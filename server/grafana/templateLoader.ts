/**
 * Grafana Dashboard Template Loader
 * 
 * Loads and interpolates dashboard templates with scoped variables
 * for multi-tenant isolation and portal-safe embedding.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Types
// ============================================================================

export type DashboardTemplateKey = 
  | 'portfolio-overview'
  | 'site-performance'
  | 'client-portal'
  | 'device-detail'
  | 'alerts-overview';

export interface TemplateVariables {
  /** KIISHA organization ID */
  org_id: number;
  /** Grafana datasource UID */
  datasource_uid: string;
  /** Optional: specific project ID */
  project_id?: number;
  /** Optional: specific site ID */
  site_id?: number;
  /** Optional: client account ID (for portal dashboards) */
  client_account_id?: number;
  /** Optional: comma-separated list of allowed project IDs */
  allowed_project_ids?: string;
  /** Optional: comma-separated list of allowed site IDs */
  allowed_site_ids?: string;
  /** Optional: custom dashboard UID (auto-generated if not provided) */
  dashboard_uid?: string;
  /** Optional: custom dashboard title suffix */
  title_suffix?: string;
}

export interface LoadedTemplate {
  /** The interpolated dashboard JSON */
  dashboard: Record<string, unknown>;
  /** The generated or provided UID */
  uid: string;
  /** The template key used */
  templateKey: DashboardTemplateKey;
  /** Variables used for interpolation */
  variables: TemplateVariables;
}

// ============================================================================
// Template Cache
// ============================================================================

const templateCache = new Map<string, Record<string, unknown>>();
const TEMPLATES_DIR = join(__dirname, 'templates');

/**
 * Load a raw template from disk (cached)
 */
function loadRawTemplate(templateKey: DashboardTemplateKey): Record<string, unknown> {
  if (!templateCache.has(templateKey)) {
    const templatePath = join(TEMPLATES_DIR, `${templateKey}.json`);
    const content = readFileSync(templatePath, 'utf-8');
    templateCache.set(templateKey, JSON.parse(content));
  }
  return JSON.parse(JSON.stringify(templateCache.get(templateKey)!)); // Deep clone
}

/**
 * List available template keys
 */
export function listAvailableTemplates(): DashboardTemplateKey[] {
  try {
    const files = readdirSync(TEMPLATES_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '') as DashboardTemplateKey);
  } catch {
    return [];
  }
}

// ============================================================================
// Variable Interpolation
// ============================================================================

/**
 * Recursively interpolate variables in a template object
 */
function interpolateVariables(
  obj: unknown,
  variables: Record<string, string | number | undefined>
): unknown {
  if (typeof obj === 'string') {
    // Replace ${variable_name} patterns
    return obj.replace(/\$\{(\w+)\}/g, (match, varName) => {
      const value = variables[varName];
      return value !== undefined ? String(value) : match;
    });
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => interpolateVariables(item, variables));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateVariables(value, variables);
    }
    return result;
  }
  
  return obj;
}

// ============================================================================
// Template Loader
// ============================================================================

/**
 * Load and interpolate a dashboard template
 */
export function loadTemplate(
  templateKey: DashboardTemplateKey,
  variables: TemplateVariables
): LoadedTemplate {
  // Load raw template
  const rawTemplate = loadRawTemplate(templateKey);
  
  // Generate UID if not provided
  const uid = variables.dashboard_uid || generateDashboardUid(templateKey, variables);
  
  // Prepare interpolation variables
  const interpolationVars: Record<string, string | number | undefined> = {
    ...variables,
    dashboard_uid: uid,
  };
  
  // Interpolate template
  const dashboard = interpolateVariables(rawTemplate, interpolationVars) as Record<string, unknown>;
  
  // Set the UID and update title if suffix provided
  dashboard.uid = uid;
  if (variables.title_suffix) {
    dashboard.title = `${dashboard.title} - ${variables.title_suffix}`;
  }
  
  // Ensure id is null for new dashboards
  dashboard.id = null;
  
  return {
    dashboard,
    uid,
    templateKey,
    variables,
  };
}

/**
 * Generate a deterministic dashboard UID based on scope
 */
function generateDashboardUid(
  templateKey: DashboardTemplateKey,
  variables: TemplateVariables
): string {
  // Create a deterministic UID based on template and scope
  const scopeParts = [
    templateKey,
    `o${variables.org_id}`,
  ];
  
  if (variables.project_id) {
    scopeParts.push(`p${variables.project_id}`);
  }
  if (variables.site_id) {
    scopeParts.push(`s${variables.site_id}`);
  }
  if (variables.client_account_id) {
    scopeParts.push(`c${variables.client_account_id}`);
  }
  
  // Create a short hash-like UID
  const baseString = scopeParts.join('-');
  const hash = simpleHash(baseString);
  
  return `${templateKey.substring(0, 8)}-${hash}`.substring(0, 40);
}

/**
 * Simple hash function for UID generation
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

// ============================================================================
// Portal-Safe Template Loading
// ============================================================================

/**
 * Load a portal-safe dashboard template with client scope restrictions
 */
export function loadPortalTemplate(
  variables: TemplateVariables & {
    client_account_id: number;
    allowed_project_ids: string;
  }
): LoadedTemplate {
  // Always use the client-portal template for portal dashboards
  const template = loadTemplate('client-portal', variables);
  
  // Additional portal safety: ensure editable is false
  template.dashboard.editable = false;
  
  // Remove any annotations that might leak data
  if (template.dashboard.annotations) {
    (template.dashboard.annotations as { list: unknown[] }).list = [];
  }
  
  return template;
}

/**
 * Validate that a template is portal-safe
 */
export function isPortalSafe(dashboard: Record<string, unknown>): boolean {
  // Check editable flag
  if (dashboard.editable !== false) {
    return false;
  }
  
  // Check for hidden scope variables
  const templating = dashboard.templating as { list?: Array<{ name: string; hide: number }> };
  if (templating?.list) {
    const requiredHidden = ['org_id', 'client_account_id', 'allowed_project_ids'];
    for (const varDef of templating.list) {
      if (requiredHidden.includes(varDef.name) && varDef.hide !== 2) {
        return false;
      }
    }
  }
  
  return true;
}

// ============================================================================
// Template Metadata
// ============================================================================

export interface TemplateMetadata {
  key: DashboardTemplateKey;
  title: string;
  description: string;
  tags: string[];
  requiredVariables: string[];
  portalSafe: boolean;
}

const TEMPLATE_METADATA: Record<DashboardTemplateKey, TemplateMetadata> = {
  'portfolio-overview': {
    key: 'portfolio-overview',
    title: 'Portfolio Overview',
    description: 'High-level view of all sites and projects in the organization',
    tags: ['portfolio', 'overview'],
    requiredVariables: ['org_id', 'datasource_uid'],
    portalSafe: false,
  },
  'site-performance': {
    key: 'site-performance',
    title: 'Site Performance',
    description: 'Detailed performance metrics for a specific site',
    tags: ['site', 'performance'],
    requiredVariables: ['org_id', 'datasource_uid', 'site_id'],
    portalSafe: false,
  },
  'client-portal': {
    key: 'client-portal',
    title: 'Client Portal Dashboard',
    description: 'Portal-safe dashboard for client viewing with scope restrictions',
    tags: ['portal', 'client'],
    requiredVariables: ['org_id', 'datasource_uid', 'client_account_id', 'allowed_project_ids'],
    portalSafe: true,
  },
  'device-detail': {
    key: 'device-detail',
    title: 'Device Detail',
    description: 'Detailed metrics and status for a specific device',
    tags: ['device', 'detail'],
    requiredVariables: ['org_id', 'datasource_uid', 'device_id'],
    portalSafe: false,
  },
  'alerts-overview': {
    key: 'alerts-overview',
    title: 'Alerts Overview',
    description: 'Overview of all active alerts and alert history',
    tags: ['alerts', 'monitoring'],
    requiredVariables: ['org_id', 'datasource_uid'],
    portalSafe: false,
  },
};

/**
 * Get metadata for a template
 */
export function getTemplateMetadata(templateKey: DashboardTemplateKey): TemplateMetadata | undefined {
  return TEMPLATE_METADATA[templateKey];
}

/**
 * Get all template metadata
 */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return Object.values(TEMPLATE_METADATA);
}

/**
 * Get portal-safe templates only
 */
export function getPortalSafeTemplates(): TemplateMetadata[] {
  return Object.values(TEMPLATE_METADATA).filter(t => t.portalSafe);
}
