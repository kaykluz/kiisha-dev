/**
 * KIISHA Feature Flags
 * 
 * Controls which features are enabled for the pilot.
 * Features that require external provisioning are disabled by default.
 * 
 * To enable a feature:
 * 1. Provision the required external dependency (see PILOT_PROVISIONING.md)
 * 2. Set the corresponding environment variable to 'true'
 * 3. Restart the application
 */

// Feature flag definitions with metadata
export interface FeatureFlagDefinition {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  envVar?: string;
  requiredDependencies: string[];
}

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  // Core Features - Enabled by default
  {
    key: 'AUTH_LOCAL',
    name: 'Local Authentication',
    description: 'Email/password login with JWT tokens',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL', 'JWT_SECRET'],
  },
  {
    key: 'AUTH_OAUTH',
    name: 'Manus OAuth',
    description: 'Login with Manus OAuth provider',
    defaultEnabled: true,
    requiredDependencies: ['VITE_APP_ID', 'OAUTH_SERVER_URL'],
  },
  {
    key: 'DOCUMENT_UPLOAD',
    name: 'Document Upload',
    description: 'Upload documents to S3 storage',
    defaultEnabled: true,
    requiredDependencies: ['BUILT_IN_FORGE_API_URL', 'BUILT_IN_FORGE_API_KEY'],
  },
  {
    key: 'AI_CATEGORIZATION',
    name: 'AI Document Categorization',
    description: 'Automatic document categorization using LLM',
    defaultEnabled: true,
    requiredDependencies: ['BUILT_IN_FORGE_API_URL', 'BUILT_IN_FORGE_API_KEY'],
  },
  {
    key: 'COMMENTS',
    name: 'Comments & Threads',
    description: 'Threaded comments with @mentions and resolution',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'WORKSPACE_CRUD',
    name: 'Workspace Management',
    description: 'Create, edit, delete RFIs and tasks',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'CHECKLIST_CRUD',
    name: 'Checklist Management',
    description: 'Create, edit, delete checklist items',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'ARTIFACT_HUB',
    name: 'Artifact Hub',
    description: 'Universal artifact management with processing pipeline',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL', 'BUILT_IN_FORGE_API_URL'],
  },
  {
    key: 'OM_PORTAL',
    name: 'O&M Portal',
    description: 'Operations and maintenance work order management',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL'],
  },

  // Advanced Features - Disabled by default (require provisioning)
  {
    key: 'EMAIL_INGESTION',
    name: 'Email Ingestion',
    description: 'Ingest documents from email attachments',
    defaultEnabled: false,
    envVar: 'FEATURE_EMAIL_INGESTION',
    requiredDependencies: ['SENDGRID_WEBHOOK_SECRET'],
  },
  {
    key: 'WHATSAPP_INGESTION',
    name: 'WhatsApp Ingestion',
    description: 'Ingest documents from WhatsApp messages',
    defaultEnabled: false,
    envVar: 'FEATURE_WHATSAPP',
    requiredDependencies: ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ACCESS_TOKEN'],
  },
  {
    key: 'LINKING_ENGINE',
    name: 'Linking Engine',
    description: 'Link RFIs to documents, checklists, and schedule items',
    defaultEnabled: false,
    envVar: 'FEATURE_LINKING',
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'EXPORT_CSV',
    name: 'CSV Export',
    description: 'Export data to CSV format',
    defaultEnabled: true,
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'EXPORT_DD_PACK',
    name: 'Due Diligence Pack Export',
    description: 'Generate comprehensive due diligence document package',
    defaultEnabled: false,
    envVar: 'FEATURE_EXPORT_DD_PACK',
    requiredDependencies: ['DATABASE_URL', 'BUILT_IN_FORGE_API_URL'],
  },
  {
    key: 'VATR_EDIT',
    name: 'VATR Asset Editing',
    description: 'Edit VATR asset attributes with versioning',
    defaultEnabled: false,
    envVar: 'FEATURE_VATR_EDIT',
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'ENTITY_RESOLUTION',
    name: 'Entity Resolution',
    description: 'Bulk entity resolution and linking',
    defaultEnabled: false,
    envVar: 'FEATURE_ENTITY_RESOLUTION',
    requiredDependencies: ['DATABASE_URL'],
  },
  {
    key: 'TWO_FA_DISABLE',
    name: '2FA Disable',
    description: 'Allow users to disable two-factor authentication',
    defaultEnabled: false,
    envVar: 'FEATURE_TWO_FA_DISABLE',
    requiredDependencies: ['DATABASE_URL'],
  },
];

// Runtime feature flag values
export type FeatureFlagKey = 
  | 'AUTH_LOCAL'
  | 'AUTH_OAUTH'
  | 'DOCUMENT_UPLOAD'
  | 'AI_CATEGORIZATION'
  | 'COMMENTS'
  | 'WORKSPACE_CRUD'
  | 'CHECKLIST_CRUD'
  | 'ARTIFACT_HUB'
  | 'OM_PORTAL'
  | 'EMAIL_INGESTION'
  | 'WHATSAPP_INGESTION'
  | 'LINKING_ENGINE'
  | 'EXPORT_CSV'
  | 'EXPORT_DD_PACK'
  | 'VATR_EDIT'
  | 'ENTITY_RESOLUTION'
  | 'TWO_FA_DISABLE';

// Get feature flag value (server-side)
export function getFeatureFlag(key: FeatureFlagKey): boolean {
  const definition = FEATURE_FLAG_DEFINITIONS.find(f => f.key === key);
  if (!definition) return false;
  
  // Check environment variable override
  if (definition.envVar) {
    const envValue = process.env[definition.envVar];
    if (envValue !== undefined) {
      return envValue === 'true' || envValue === '1';
    }
  }
  
  return definition.defaultEnabled;
}

// Get all feature flags (for client-side hydration)
export function getAllFeatureFlags(): Record<FeatureFlagKey, boolean> {
  const flags: Record<string, boolean> = {};
  for (const definition of FEATURE_FLAG_DEFINITIONS) {
    flags[definition.key] = getFeatureFlag(definition.key as FeatureFlagKey);
  }
  return flags as Record<FeatureFlagKey, boolean>;
}

// Check if feature is available (has required dependencies)
export function isFeatureAvailable(key: FeatureFlagKey): boolean {
  const definition = FEATURE_FLAG_DEFINITIONS.find(f => f.key === key);
  if (!definition) return false;
  
  // Check all required dependencies are present
  for (const dep of definition.requiredDependencies) {
    if (!process.env[dep]) {
      return false;
    }
  }
  
  return true;
}


// ============ ORG-SCOPED FEATURE FLAGS ============

import type { OrgIntegration, IntegrationType, Capability } from './providers/types';
import { CAPABILITY_DEPENDENCIES, CAPABILITY_REGISTRY } from './providers/types';

/**
 * Check if a capability is satisfied by org integrations.
 */
export function isCapabilitySatisfiedByOrg(
  capability: Capability,
  orgIntegrations: OrgIntegration[]
): boolean {
  const connectedIntegrations = orgIntegrations.filter(i => i.status === 'connected');
  
  for (const integration of connectedIntegrations) {
    const capabilityInfo = CAPABILITY_REGISTRY[integration.integrationType];
    if (capabilityInfo?.capabilities.includes(capability)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a UI module is enabled based on org integrations.
 */
export function isModuleEnabledForOrg(
  moduleKey: string,
  orgIntegrations: OrgIntegration[]
): boolean {
  const requiredCapabilities = CAPABILITY_DEPENDENCIES[moduleKey];
  
  if (!requiredCapabilities || requiredCapabilities.length === 0) {
    // No capability requirements, always enabled
    return true;
  }
  
  // All required capabilities must be satisfied
  return requiredCapabilities.every(cap => 
    isCapabilitySatisfiedByOrg(cap, orgIntegrations)
  );
}

/**
 * Get all disabled modules for an org with reasons.
 */
export function getDisabledModulesForOrg(
  orgIntegrations: OrgIntegration[]
): Array<{ moduleKey: string; missingCapabilities: Capability[] }> {
  const disabled: Array<{ moduleKey: string; missingCapabilities: Capability[] }> = [];
  
  for (const [moduleKey, requiredCapabilities] of Object.entries(CAPABILITY_DEPENDENCIES)) {
    const missing = requiredCapabilities.filter(
      cap => !isCapabilitySatisfiedByOrg(cap, orgIntegrations)
    );
    
    if (missing.length > 0) {
      disabled.push({ moduleKey, missingCapabilities: missing });
    }
  }
  
  return disabled;
}

/**
 * Get integration type needed for a capability.
 */
export function getIntegrationTypeForCapability(capability: Capability): IntegrationType | null {
  for (const [type, info] of Object.entries(CAPABILITY_REGISTRY)) {
    if (info.capabilities.includes(capability)) {
      return type as IntegrationType;
    }
  }
  return null;
}

/**
 * Combined feature flag check (global + org-scoped).
 */
export function isFeatureEnabledForOrg(
  featureKey: FeatureFlagKey,
  orgIntegrations: OrgIntegration[]
): boolean {
  // First check global feature flag
  if (!getFeatureFlag(featureKey)) {
    return false;
  }
  
  // Map feature keys to module keys for capability checking
  const featureToModuleMap: Partial<Record<FeatureFlagKey, string>> = {
    'DOCUMENT_UPLOAD': 'document-upload',
    'AI_CATEGORIZATION': 'ai-categorization',
    'EMAIL_INGESTION': 'email-ingestion',
    'WHATSAPP_INGESTION': 'whatsapp-ingestion',
  };
  
  const moduleKey = featureToModuleMap[featureKey];
  if (moduleKey) {
    return isModuleEnabledForOrg(moduleKey, orgIntegrations);
  }
  
  // No org-scoped check needed
  return true;
}
