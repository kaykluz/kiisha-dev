/**
 * Phase 34: Runtime Defaults Service
 * Applies org preferences when user enters a workspace
 */
import {
  getOrgPreferences,
  getActiveFieldPacksForOrg,
  getUserViewCustomization,
  getPendingPushUpdatesForUser,
  markPushUpdateAccepted,
} from "../db";

export interface WorkspaceDefaults {
  // Asset classifications available in this org
  assetClassifications: string[];
  
  // Configuration profiles available in this org
  configurationProfiles: string[];
  
  // Active field packs for this org
  fieldPacks: Array<{
    id: number;
    name: string;
    scope: string;
    fieldCount: number;
    docRequirementCount: number;
  }>;
  
  // Default disclosure mode
  disclosureMode: "summary" | "expanded" | "full";
  
  // Charts configuration
  chartsConfig: {
    allowedChartTypes: string[];
    defaultChartType: string;
    dashboardCharts: Array<{
      chartKey: string;
      chartType: string;
      position: number;
      dataBinding: string;
    }>;
  } | null;
  
  // AI setup status
  aiSetupCompleted: boolean;
  
  // Pending updates that need user acknowledgment
  pendingUpdates: Array<{
    id: number;
    updateType: string;
    description: string;
    createdAt: Date;
  }>;
}

/**
 * Get workspace defaults for a user entering an organization
 * This is called when user selects/switches workspace
 */
export async function getWorkspaceDefaults(
  userId: number,
  organizationId: number
): Promise<WorkspaceDefaults> {
  // Get org preferences
  const prefs = await getOrgPreferences(organizationId);
  
  // Get active field packs
  const fieldPacks = await getActiveFieldPacksForOrg(organizationId);
  
  // Get pending push updates for this user
  const pendingUpdates = await getPendingPushUpdatesForUser(userId, organizationId);
  
  return {
    assetClassifications: prefs?.defaultAssetClassifications || [],
    configurationProfiles: prefs?.defaultConfigurationProfiles || [],
    fieldPacks: fieldPacks.map(p => ({
      id: p.id,
      name: p.name,
      scope: p.scope,
      fieldCount: p.fields?.length || 0,
      docRequirementCount: p.docRequirements?.length || 0,
    })),
    disclosureMode: prefs?.defaultDisclosureMode || "summary",
    chartsConfig: prefs?.defaultChartsConfig || null,
    aiSetupCompleted: prefs?.aiSetupCompleted || false,
    pendingUpdates: pendingUpdates.map(u => ({
      id: u.id,
      updateType: u.updateType,
      description: `${u.updateType} update (version ${u.updateVersion})`,
      createdAt: u.createdAt,
    })),
  };
}

/**
 * Get effective view configuration for a user
 * Merges org defaults with user customizations
 */
export async function getEffectiveViewConfig(
  userId: number,
  organizationId: number,
  viewId: number
): Promise<{
  charts: Array<{
    chartKey: string;
    chartType: string;
    position: number;
    dataBinding: string;
    isCustomized: boolean;
  }>;
  columnOrder: string[] | null;
  hiddenFields: string[] | null;
  hasLocalChanges: boolean;
}> {
  // Get org-level chart config
  const prefs = await getOrgPreferences(organizationId);
  const orgCharts = prefs?.defaultChartsConfig?.dashboardCharts || [];
  
  // Get user customizations
  const userCustom = await getUserViewCustomization(userId, organizationId, viewId);
  
  // Merge charts - user overrides take precedence
  const userChartOverrides = userCustom?.localChartOverrides as Record<string, { chartType: string }> | null;
  const effectiveCharts = orgCharts.map(chart => ({
    ...chart,
    chartType: userChartOverrides?.[chart.chartKey]?.chartType || chart.chartType,
    isCustomized: !!userChartOverrides?.[chart.chartKey],
  }));
  
  return {
    charts: effectiveCharts,
    columnOrder: userCustom?.localColumnOrder as string[] | null,
    hiddenFields: userCustom?.localHiddenFields as string[] | null,
    hasLocalChanges: userCustom?.hasLocalChanges || false,
  };
}

/**
 * Accept a push update notification
 */
export async function acceptPushUpdate(
  notificationId: number,
  userId: number
): Promise<void> {
  await markPushUpdateAccepted(notificationId, userId);
}

/**
 * Check if user needs to see setup wizard
 * Returns true if org has no preferences configured
 */
export async function needsSetupWizard(organizationId: number): Promise<boolean> {
  const prefs = await getOrgPreferences(organizationId);
  
  // If no preferences exist, or AI setup not completed and no manual config
  if (!prefs) return true;
  
  const hasAssetClasses = prefs.defaultAssetClassifications && prefs.defaultAssetClassifications.length > 0;
  const hasConfigProfiles = prefs.defaultConfigurationProfiles && prefs.defaultConfigurationProfiles.length > 0;
  const hasFieldPacks = prefs.preferredFieldPacks && prefs.preferredFieldPacks.length > 0;
  
  // Need setup if nothing is configured
  return !hasAssetClasses && !hasConfigProfiles && !hasFieldPacks && !prefs.aiSetupCompleted;
}

/**
 * Get field pack fields for a specific scope
 * Used when creating new assets/projects
 */
export async function getFieldsForScope(
  organizationId: number,
  scope: "asset" | "project" | "site" | "portfolio" | "dataroom" | "rfi"
): Promise<Array<{
  fieldKey: string;
  required: boolean;
  displayLabel: string;
  group: string;
  order: number;
  validationRules?: {
    type: string;
    min?: number;
    max?: number;
    pattern?: string;
  };
  sensitivity?: "public" | "internal" | "confidential" | "restricted";
}>> {
  const fieldPacks = await getActiveFieldPacksForOrg(organizationId);
  
  // Filter to packs matching the scope
  const scopedPacks = fieldPacks.filter(p => p.scope === scope);
  
  // Merge all fields from matching packs, deduplicating by fieldKey
  const fieldMap = new Map<string, {
    fieldKey: string;
    required: boolean;
    displayLabel: string;
    group: string;
    order: number;
    validationRules?: {
      type: string;
      min?: number;
      max?: number;
      pattern?: string;
    };
    sensitivity?: "public" | "internal" | "confidential" | "restricted";
  }>();
  
  for (const pack of scopedPacks) {
    for (const field of (pack.fields || [])) {
      // Later packs override earlier ones
      fieldMap.set(field.fieldKey, field as {
        fieldKey: string;
        required: boolean;
        displayLabel: string;
        group: string;
        order: number;
        validationRules?: {
          type: string;
          min?: number;
          max?: number;
          pattern?: string;
        };
        sensitivity?: "public" | "internal" | "confidential" | "restricted";
      });
    }
  }
  
  // Sort by order and return
  return Array.from(fieldMap.values()).sort((a, b) => a.order - b.order);
}

/**
 * Get document requirements for a specific scope
 * Used when checking document completeness
 */
export async function getDocRequirementsForScope(
  organizationId: number,
  scope: "asset" | "project" | "site" | "portfolio" | "dataroom" | "rfi"
): Promise<Array<{
  docTypeKey: string;
  required: boolean;
  reviewerGroups: string[];
  allowedFileTypes: string[];
  statusLightsConfig?: {
    green: string;
    yellow: string;
    red: string;
  };
}>> {
  const fieldPacks = await getActiveFieldPacksForOrg(organizationId);
  
  // Filter to packs matching the scope
  const scopedPacks = fieldPacks.filter(p => p.scope === scope);
  
  // Merge all doc requirements, deduplicating by docTypeKey
  const docMap = new Map<string, {
    docTypeKey: string;
    required: boolean;
    reviewerGroups: string[];
    allowedFileTypes: string[];
    statusLightsConfig?: {
      green: string;
      yellow: string;
      red: string;
    };
  }>();
  
  for (const pack of scopedPacks) {
    for (const doc of (pack.docRequirements || [])) {
      docMap.set(doc.docTypeKey, doc as {
        docTypeKey: string;
        required: boolean;
        reviewerGroups: string[];
        allowedFileTypes: string[];
        statusLightsConfig?: {
          green: string;
          yellow: string;
          red: string;
        };
      });
    }
  }
  
  return Array.from(docMap.values());
}
