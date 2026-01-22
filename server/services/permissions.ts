/**
 * Role-Based Permissions Matrix
 * 
 * Defines granular permissions (view/edit/delete) per feature per role.
 * All permission checks go through this service.
 */

import { db } from "../db";
import { users, organizationMembers, projectMembers } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Permission actions
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'admin';

// Features/resources that can be permissioned
export type PermissionResource = 
  | 'projects'
  | 'documents'
  | 'rfis'
  | 'schedule'
  | 'checklist'
  | 'financial_models'
  | 'operations'
  | 'reports'
  | 'users'
  | 'organizations'
  | 'settings'
  | 'audit_logs'
  | 'invitations';

// Role types
export type OrgRole = 'admin' | 'editor' | 'reviewer' | 'investor_viewer';
export type SystemRole = 'user' | 'admin' | 'superuser_admin';

// Permission matrix: role -> resource -> actions
const ORG_PERMISSIONS: Record<OrgRole, Record<PermissionResource, PermissionAction[]>> = {
  admin: {
    projects: ['view', 'create', 'edit', 'delete', 'admin'],
    documents: ['view', 'create', 'edit', 'delete', 'approve'],
    rfis: ['view', 'create', 'edit', 'delete'],
    schedule: ['view', 'create', 'edit', 'delete'],
    checklist: ['view', 'create', 'edit', 'delete', 'approve'],
    financial_models: ['view', 'create', 'edit', 'delete'],
    operations: ['view', 'create', 'edit', 'delete'],
    reports: ['view', 'create', 'edit', 'delete'],
    users: ['view', 'create', 'edit', 'delete', 'admin'],
    organizations: ['view', 'edit', 'admin'],
    settings: ['view', 'edit'],
    audit_logs: ['view'],
    invitations: ['view', 'create', 'delete'],
  },
  editor: {
    projects: ['view', 'create', 'edit'],
    documents: ['view', 'create', 'edit'],
    rfis: ['view', 'create', 'edit'],
    schedule: ['view', 'create', 'edit'],
    checklist: ['view', 'create', 'edit'],
    financial_models: ['view', 'create', 'edit'],
    operations: ['view', 'edit'],
    reports: ['view', 'create'],
    users: ['view'],
    organizations: ['view'],
    settings: ['view'],
    audit_logs: [],
    invitations: [],
  },
  reviewer: {
    projects: ['view'],
    documents: ['view', 'approve'],
    rfis: ['view', 'create', 'edit'],
    schedule: ['view'],
    checklist: ['view', 'approve'],
    financial_models: ['view'],
    operations: ['view'],
    reports: ['view'],
    users: ['view'],
    organizations: ['view'],
    settings: [],
    audit_logs: [],
    invitations: [],
  },
  investor_viewer: {
    projects: ['view'],
    documents: ['view'],
    rfis: ['view'],
    schedule: ['view'],
    checklist: ['view'],
    financial_models: ['view'],
    operations: ['view'],
    reports: ['view'],
    users: [],
    organizations: [],
    settings: [],
    audit_logs: [],
    invitations: [],
  },
};

// Superuser has all permissions across all orgs
const SUPERUSER_PERMISSIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'admin'];

export interface PermissionContext {
  userId: number;
  isSuperuser: boolean;
  systemRole: SystemRole;
  activeOrgId: number | null;
  orgRole: OrgRole | null;
}

/**
 * Get permission context for a user
 */
export async function getPermissionContext(userId: number): Promise<PermissionContext> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  const isSuperuser = user.isSuperuser === true || user.role === 'superuser_admin';
  
  // Get org role if user has active org
  let orgRole: OrgRole | null = null;
  if (user.activeOrgId) {
    const membership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, user.activeOrgId),
        eq(organizationMembers.status, 'active')
      ),
    });
    orgRole = membership?.role as OrgRole || null;
  }
  
  return {
    userId,
    isSuperuser,
    systemRole: user.role as SystemRole,
    activeOrgId: user.activeOrgId,
    orgRole,
  };
}

/**
 * Check if user has permission for an action on a resource
 */
export function hasPermission(
  ctx: PermissionContext,
  resource: PermissionResource,
  action: PermissionAction
): boolean {
  // Superusers have all permissions
  if (ctx.isSuperuser) {
    return true;
  }
  
  // Must have active org to access anything
  if (!ctx.activeOrgId || !ctx.orgRole) {
    return false;
  }
  
  // Check org role permissions
  const rolePermissions = ORG_PERMISSIONS[ctx.orgRole];
  if (!rolePermissions) {
    return false;
  }
  
  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }
  
  return resourcePermissions.includes(action);
}

/**
 * Check permission and throw if denied
 */
export async function requirePermission(
  userId: number,
  resource: PermissionResource,
  action: PermissionAction
): Promise<PermissionContext> {
  const ctx = await getPermissionContext(userId);
  
  if (!hasPermission(ctx, resource, action)) {
    throw new Error(`Permission denied: ${action} on ${resource}`);
  }
  
  return ctx;
}

/**
 * Get all permissions for a user's current context
 */
export function getAllPermissions(ctx: PermissionContext): Record<PermissionResource, PermissionAction[]> {
  if (ctx.isSuperuser) {
    // Return all permissions for all resources
    const allPerms: Record<PermissionResource, PermissionAction[]> = {} as any;
    for (const resource of Object.keys(ORG_PERMISSIONS.admin) as PermissionResource[]) {
      allPerms[resource] = [...SUPERUSER_PERMISSIONS];
    }
    return allPerms;
  }
  
  if (!ctx.orgRole) {
    // No permissions without org role
    const noPerms: Record<PermissionResource, PermissionAction[]> = {} as any;
    for (const resource of Object.keys(ORG_PERMISSIONS.admin) as PermissionResource[]) {
      noPerms[resource] = [];
    }
    return noPerms;
  }
  
  return ORG_PERMISSIONS[ctx.orgRole];
}

/**
 * Check if user can access a specific project
 */
export async function canAccessProject(
  userId: number,
  projectId: number
): Promise<boolean> {
  const ctx = await getPermissionContext(userId);
  
  // Superusers can access all (but still need to be in org context)
  if (ctx.isSuperuser && ctx.activeOrgId) {
    return true;
  }
  
  // Must have active org
  if (!ctx.activeOrgId) {
    return false;
  }
  
  // Check if project belongs to user's active org
  // This would need to query the project's organizationId
  // For now, return true if user has view permission on projects
  return hasPermission(ctx, 'projects', 'view');
}

/**
 * Get permission matrix for display in UI
 */
export function getPermissionMatrix(): Record<OrgRole, Record<PermissionResource, PermissionAction[]>> {
  return ORG_PERMISSIONS;
}

/**
 * Check if user can manage organization members
 */
export function canManageMembers(ctx: PermissionContext): boolean {
  return hasPermission(ctx, 'users', 'admin');
}

/**
 * Check if user can invite new members
 */
export function canInviteMembers(ctx: PermissionContext): boolean {
  return hasPermission(ctx, 'invitations', 'create');
}

/**
 * Check if user can view audit logs
 */
export function canViewAuditLogs(ctx: PermissionContext): boolean {
  return hasPermission(ctx, 'audit_logs', 'view');
}
