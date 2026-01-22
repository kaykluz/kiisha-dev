/**
 * Portal Scope Resolver
 * 
 * This module implements the VIEW-first access control model for the customer portal.
 * It resolves what organizations, projects, sites, and assets a portal user can access
 * based on their client account memberships and scope grants.
 * 
 * Key concepts:
 * - Portal users belong to client accounts via memberships
 * - Client accounts have scope grants that define access to orgs/projects/sites/assets
 * - Scope grants can be VIEW, PROJECT, SITE, or ASSET type
 * - Field policies control which fields are visible in each entity type
 */

import { getDb } from "../db";
import { 
  clientAccounts, 
  portalUsers, 
  clientAccountMemberships, 
  clientScopeGrants,
  portalFieldPolicies,
  // Legacy tables for backward compatibility
  customers,
  customerUsers,
  customerProjects
} from "../../drizzle/schema";
import { eq, and, inArray, isNull, or } from "drizzle-orm";

/**
 * Resolved portal scope containing all access information for a portal user
 */
export interface PortalScope {
  // Portal user info
  portalUserId: number;
  email: string;
  name: string | null;
  
  // Client accounts the user belongs to
  clientAccounts: {
    id: number;
    code: string;
    name: string;
    role: 'CLIENT_ADMIN' | 'FINANCE' | 'OPS' | 'VIEWER';
  }[];
  
  // Aggregated access from all client accounts
  allowedOrgIds: number[];
  allowedProjectIds: number[];
  allowedSiteIds: number[];
  allowedAssetIds: number[];
  allowedViewIds: number[];
  
  // Detailed grants for fine-grained access control
  grants: {
    id: number;
    clientAccountId: number;
    grantType: 'VIEW' | 'PROJECT' | 'SITE' | 'ASSET';
    orgId: number;
    targetId: number;
    accessLevel: 'full' | 'limited' | 'reports_only';
    fieldPolicyId: number | null;
  }[];
  
  // Field policies for visibility control
  fieldPolicies: {
    id: number;
    name: string;
    allowedFields: {
      invoice?: string[];
      project?: string[];
      site?: string[];
      asset?: string[];
      measurement?: string[];
      workOrder?: string[];
      document?: string[];
    };
    allowedMetrics: string[] | null;
  }[];
  
  // Legacy support
  legacyCustomerId: number | null;
  legacyCustomerUserId: number | null;
}

/**
 * Empty scope for unauthenticated or invalid users
 */
export const EMPTY_SCOPE: PortalScope = {
  portalUserId: 0,
  email: '',
  name: null,
  clientAccounts: [],
  allowedOrgIds: [],
  allowedProjectIds: [],
  allowedSiteIds: [],
  allowedAssetIds: [],
  allowedViewIds: [],
  grants: [],
  fieldPolicies: [],
  legacyCustomerId: null,
  legacyCustomerUserId: null,
};

/**
 * Resolve portal scope for a portal user by ID
 * Uses the canonical model (portalUsers, clientAccounts, clientScopeGrants)
 */
export async function resolvePortalScope(portalUserId: number): Promise<PortalScope> {
  const db = await getDb();
  
  // Get portal user
  const [portalUser] = await db
    .select()
    .from(portalUsers)
    .where(eq(portalUsers.id, portalUserId))
    .limit(1);
  
  if (!portalUser || portalUser.status !== 'active') {
    return EMPTY_SCOPE;
  }
  
  // Get client account memberships
  const memberships = await db
    .select({
      clientAccountId: clientAccountMemberships.clientAccountId,
      role: clientAccountMemberships.role,
      clientCode: clientAccounts.code,
      clientName: clientAccounts.name,
    })
    .from(clientAccountMemberships)
    .innerJoin(clientAccounts, eq(clientAccountMemberships.clientAccountId, clientAccounts.id))
    .where(
      and(
        eq(clientAccountMemberships.portalUserId, portalUserId),
        eq(clientAccountMemberships.status, 'active'),
        eq(clientAccounts.status, 'active')
      )
    );
  
  if (memberships.length === 0) {
    return {
      ...EMPTY_SCOPE,
      portalUserId: portalUser.id,
      email: portalUser.email,
      name: portalUser.name,
      legacyCustomerUserId: portalUser.legacyCustomerUserId,
    };
  }
  
  const clientAccountIds = memberships.map(m => m.clientAccountId);
  
  // Get all scope grants for these client accounts
  const grants = await db
    .select()
    .from(clientScopeGrants)
    .where(
      and(
        inArray(clientScopeGrants.clientAccountId, clientAccountIds),
        eq(clientScopeGrants.status, 'active')
      )
    );
  
  // Aggregate allowed IDs by grant type
  const allowedOrgIds = new Set<number>();
  const allowedProjectIds = new Set<number>();
  const allowedSiteIds = new Set<number>();
  const allowedAssetIds = new Set<number>();
  const allowedViewIds = new Set<number>();
  const fieldPolicyIds = new Set<number>();
  
  for (const grant of grants) {
    allowedOrgIds.add(grant.orgId);
    
    switch (grant.grantType) {
      case 'VIEW':
        allowedViewIds.add(grant.targetId);
        break;
      case 'PROJECT':
        allowedProjectIds.add(grant.targetId);
        break;
      case 'SITE':
        allowedSiteIds.add(grant.targetId);
        break;
      case 'ASSET':
        allowedAssetIds.add(grant.targetId);
        break;
    }
    
    if (grant.fieldPolicyId) {
      fieldPolicyIds.add(grant.fieldPolicyId);
    }
  }
  
  // Get field policies
  let fieldPolicies: PortalScope['fieldPolicies'] = [];
  if (fieldPolicyIds.size > 0) {
    const policies = await db
      .select()
      .from(portalFieldPolicies)
      .where(
        and(
          inArray(portalFieldPolicies.id, Array.from(fieldPolicyIds)),
          eq(portalFieldPolicies.status, 'active')
        )
      );
    
    fieldPolicies = policies.map(p => ({
      id: p.id,
      name: p.name,
      allowedFields: p.allowedFields as PortalScope['fieldPolicies'][0]['allowedFields'],
      allowedMetrics: p.allowedMetrics,
    }));
  }
  
  // Get default field policy if no specific policies
  if (fieldPolicies.length === 0) {
    const [defaultPolicy] = await db
      .select()
      .from(portalFieldPolicies)
      .where(
        and(
          eq(portalFieldPolicies.isDefault, true),
          eq(portalFieldPolicies.status, 'active')
        )
      )
      .limit(1);
    
    if (defaultPolicy) {
      fieldPolicies = [{
        id: defaultPolicy.id,
        name: defaultPolicy.name,
        allowedFields: defaultPolicy.allowedFields as PortalScope['fieldPolicies'][0]['allowedFields'],
        allowedMetrics: defaultPolicy.allowedMetrics,
      }];
    }
  }
  
  return {
    portalUserId: portalUser.id,
    email: portalUser.email,
    name: portalUser.name,
    clientAccounts: memberships.map(m => ({
      id: m.clientAccountId,
      code: m.clientCode,
      name: m.clientName,
      role: m.role as 'CLIENT_ADMIN' | 'FINANCE' | 'OPS' | 'VIEWER',
    })),
    allowedOrgIds: Array.from(allowedOrgIds),
    allowedProjectIds: Array.from(allowedProjectIds),
    allowedSiteIds: Array.from(allowedSiteIds),
    allowedAssetIds: Array.from(allowedAssetIds),
    allowedViewIds: Array.from(allowedViewIds),
    grants: grants.map(g => ({
      id: g.id,
      clientAccountId: g.clientAccountId,
      grantType: g.grantType as 'VIEW' | 'PROJECT' | 'SITE' | 'ASSET',
      orgId: g.orgId,
      targetId: g.targetId,
      accessLevel: g.accessLevel as 'full' | 'limited' | 'reports_only',
      fieldPolicyId: g.fieldPolicyId,
    })),
    fieldPolicies,
    legacyCustomerId: null,
    legacyCustomerUserId: portalUser.legacyCustomerUserId,
  };
}

/**
 * Resolve portal scope from legacy customer user ID
 * Used for backward compatibility during migration
 */
export async function resolvePortalScopeFromLegacy(customerUserId: number): Promise<PortalScope> {
  const db = await getDb();
  
  // Get legacy customer user
  const [customerUser] = await db
    .select()
    .from(customerUsers)
    .where(eq(customerUsers.id, customerUserId))
    .limit(1);
  
  if (!customerUser || customerUser.status !== 'active') {
    return EMPTY_SCOPE;
  }
  
  // Get customer
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerUser.customerId))
    .limit(1);
  
  if (!customer || customer.status !== 'active') {
    return EMPTY_SCOPE;
  }
  
  // Check if there's a linked portal user (canonical model)
  if (customerUser.id) {
    const [linkedPortalUser] = await db
      .select()
      .from(portalUsers)
      .where(eq(portalUsers.legacyCustomerUserId, customerUser.id))
      .limit(1);
    
    if (linkedPortalUser) {
      // Use canonical model
      const scope = await resolvePortalScope(linkedPortalUser.id);
      return {
        ...scope,
        legacyCustomerId: customer.id,
        legacyCustomerUserId: customerUser.id,
      };
    }
  }
  
  // Fall back to legacy model
  const customerProjectsList = await db
    .select()
    .from(customerProjects)
    .where(
      and(
        eq(customerProjects.customerId, customer.id),
        eq(customerProjects.status, 'active')
      )
    );
  
  const allowedProjectIds = customerProjectsList.map(cp => cp.projectId);
  
  return {
    portalUserId: 0, // No canonical portal user
    email: customerUser.email,
    name: customerUser.name,
    clientAccounts: [{
      id: customer.id,
      code: customer.code || `LEGACY-${customer.id}`,
      name: customer.name,
      role: customerUser.role === 'admin' ? 'CLIENT_ADMIN' : 'VIEWER',
    }],
    allowedOrgIds: customer.organizationId ? [customer.organizationId] : [],
    allowedProjectIds,
    allowedSiteIds: [],
    allowedAssetIds: [],
    allowedViewIds: [],
    grants: customerProjectsList.map(cp => ({
      id: cp.id,
      clientAccountId: customer.id,
      grantType: 'PROJECT' as const,
      orgId: customer.organizationId || 0,
      targetId: cp.projectId,
      accessLevel: 'full' as const,
      fieldPolicyId: null,
    })),
    fieldPolicies: [],
    legacyCustomerId: customer.id,
    legacyCustomerUserId: customerUser.id,
  };
}

/**
 * Check if a portal user can access a specific project
 */
export function canAccessProject(scope: PortalScope, projectId: number): boolean {
  // Direct project grant
  if (scope.allowedProjectIds.includes(projectId)) {
    return true;
  }
  
  // VIEW grants might include the project (would need to resolve view contents)
  // For now, only direct project grants are supported
  return false;
}

/**
 * Check if a portal user can access a specific site
 */
export function canAccessSite(scope: PortalScope, siteId: number): boolean {
  // Direct site grant
  if (scope.allowedSiteIds.includes(siteId)) {
    return true;
  }
  
  // Site access might be implied by project access (would need to resolve project sites)
  // For now, only direct site grants are supported
  return false;
}

/**
 * Check if a portal user can access a specific asset
 */
export function canAccessAsset(scope: PortalScope, assetId: number): boolean {
  // Direct asset grant
  if (scope.allowedAssetIds.includes(assetId)) {
    return true;
  }
  
  // Asset access might be implied by site/project access (would need to resolve)
  // For now, only direct asset grants are supported
  return false;
}

/**
 * Check if a portal user can access a specific organization
 */
export function canAccessOrg(scope: PortalScope, orgId: number): boolean {
  return scope.allowedOrgIds.includes(orgId);
}

/**
 * Get the access level for a specific grant
 */
export function getAccessLevel(
  scope: PortalScope, 
  grantType: 'PROJECT' | 'SITE' | 'ASSET', 
  targetId: number
): 'full' | 'limited' | 'reports_only' | null {
  const grant = scope.grants.find(
    g => g.grantType === grantType && g.targetId === targetId
  );
  return grant?.accessLevel || null;
}

/**
 * Filter fields based on field policies
 */
export function filterFields<T extends Record<string, unknown>>(
  scope: PortalScope,
  entityType: keyof PortalScope['fieldPolicies'][0]['allowedFields'],
  data: T
): Partial<T> {
  // If no field policies, return all fields (default permissive)
  if (scope.fieldPolicies.length === 0) {
    return data;
  }
  
  // Aggregate allowed fields from all policies
  const allowedFields = new Set<string>();
  for (const policy of scope.fieldPolicies) {
    const fields = policy.allowedFields[entityType];
    if (fields) {
      fields.forEach(f => allowedFields.add(f));
    }
  }
  
  // If no specific fields defined for this entity type, return all
  if (allowedFields.size === 0) {
    return data;
  }
  
  // Filter to only allowed fields
  const filtered: Partial<T> = {};
  for (const key of Object.keys(data)) {
    if (allowedFields.has(key)) {
      (filtered as Record<string, unknown>)[key] = data[key];
    }
  }
  
  // Always include id if present
  if ('id' in data) {
    (filtered as Record<string, unknown>)['id'] = data['id'];
  }
  
  return filtered;
}

/**
 * Get allowed metrics for monitoring dashboards
 */
export function getAllowedMetrics(scope: PortalScope): string[] {
  const metrics = new Set<string>();
  
  for (const policy of scope.fieldPolicies) {
    if (policy.allowedMetrics) {
      policy.allowedMetrics.forEach(m => metrics.add(m));
    }
  }
  
  // Default metrics if none specified
  if (metrics.size === 0) {
    return ['production', 'revenue', 'uptime', 'performance'];
  }
  
  return Array.from(metrics);
}

/**
 * Check if user has a specific role in any client account
 */
export function hasRole(scope: PortalScope, role: 'CLIENT_ADMIN' | 'FINANCE' | 'OPS' | 'VIEWER'): boolean {
  return scope.clientAccounts.some(ca => ca.role === role);
}

/**
 * Check if user is an admin of any client account
 */
export function isClientAdmin(scope: PortalScope): boolean {
  return hasRole(scope, 'CLIENT_ADMIN');
}

/**
 * Check if user has finance access (CLIENT_ADMIN or FINANCE role)
 */
export function hasFinanceAccess(scope: PortalScope): boolean {
  return scope.clientAccounts.some(
    ca => ca.role === 'CLIENT_ADMIN' || ca.role === 'FINANCE'
  );
}
