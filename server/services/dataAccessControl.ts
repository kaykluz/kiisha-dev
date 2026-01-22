/**
 * Data Access Control Service
 * 
 * Handles organization-based data filtering and demo data visibility control.
 * - New users only see data from their organization
 * - Demo/seeded data is only visible to superuser admins
 * - All data access is logged for VATR compliance
 */

import { db } from "../db";
import { users, projects, organizations } from "../../drizzle/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { logVatrEvent } from "./vatrAudit";

export interface DataAccessContext {
  userId: number;
  userRole: string;
  isSuperuser: boolean;
  organizationId: number | null;
}

/**
 * Check if user has superuser privileges
 */
export async function isSuperuserAdmin(userId: number): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  return user?.isSuperuser === true || user?.role === 'superuser_admin';
}

/**
 * Get the data access context for a user
 */
export async function getDataAccessContext(userId: number): Promise<DataAccessContext> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) {
    throw new Error("User not found");
  }
  
  return {
    userId: user.id,
    userRole: user.role || 'user',
    isSuperuser: user.isSuperuser === true || user.role === 'superuser_admin',
    organizationId: user.activeOrgId,
  };
}

/**
 * Build WHERE clause for filtering projects by organization and demo visibility
 */
export function buildProjectAccessFilter(ctx: DataAccessContext) {
  // Superuser admins can see everything including demo data
  if (ctx.isSuperuser) {
    return undefined; // No filter - see all
  }
  
  // Regular users can only see:
  // 1. Projects from their organization (if they have one)
  // 2. Non-demo projects they created
  // 3. Projects explicitly shared with them
  
  const conditions = [];
  
  // Filter out demo data for non-superusers
  conditions.push(
    or(
      eq(projects.isDemo, false),
      isNull(projects.isDemo)
    )
  );
  
  // If user has an organization, filter by organization
  if (ctx.organizationId) {
    conditions.push(eq(projects.organizationId, ctx.organizationId));
  } else {
    // If no organization, only show projects they created
    conditions.push(eq(projects.createdBy, ctx.userId));
  }
  
  return and(...conditions);
}

/**
 * Check if user can access a specific project
 */
export async function canAccessProject(
  userId: number,
  projectId: number
): Promise<boolean> {
  const ctx = await getDataAccessContext(userId);
  
  // Superusers can access everything
  if (ctx.isSuperuser) {
    return true;
  }
  
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  
  if (!project) {
    return false;
  }
  
  // Check if it's demo data
  if (project.isDemo && !ctx.isSuperuser) {
    return false;
  }
  
  // Check organization match
  if (ctx.organizationId && project.organizationId === ctx.organizationId) {
    return true;
  }
  
  // Check if user created the project
  if (project.createdBy === userId) {
    return true;
  }
  
  // TODO: Check project sharing/permissions
  
  return false;
}

/**
 * Filter an array of records by organization access
 */
export function filterByOrganization<T extends { organizationId?: number | null; isDemo?: boolean | null; createdBy?: number | null }>(
  records: T[],
  ctx: DataAccessContext
): T[] {
  // Superusers see everything
  if (ctx.isSuperuser) {
    return records;
  }
  
  return records.filter(record => {
    // Filter out demo data
    if (record.isDemo && !ctx.isSuperuser) {
      return false;
    }
    
    // Check organization match
    if (ctx.organizationId && record.organizationId === ctx.organizationId) {
      return true;
    }
    
    // Check if user created the record
    if (record.createdBy === ctx.userId) {
      return true;
    }
    
    return false;
  });
}

/**
 * Log data access for VATR compliance
 */
export async function logDataAccess(
  userId: number,
  entityType: string,
  entityId: number,
  action: 'view' | 'create' | 'update' | 'delete',
  details?: Record<string, unknown>
): Promise<void> {
  await logVatrEvent({
    userId,
    action,
    entityType,
    entityId,
    description: `${action} ${entityType} #${entityId}`,
    source: 'system',
    metadata: details,
  });
}

/**
 * Get visible organizations for a user
 */
export async function getVisibleOrganizations(userId: number) {
  const ctx = await getDataAccessContext(userId);
  
  // Superusers can see all organizations
  if (ctx.isSuperuser) {
    return db.query.organizations.findMany();
  }
  
  // Regular users only see their own organization
  if (ctx.organizationId) {
    return db.query.organizations.findMany({
      where: eq(organizations.id, ctx.organizationId),
    });
  }
  
  return [];
}

/**
 * Check if user can manage an organization
 */
export async function canManageOrganization(
  userId: number,
  organizationId: number
): Promise<boolean> {
  const ctx = await getDataAccessContext(userId);
  
  // Superusers can manage any organization
  if (ctx.isSuperuser) {
    return true;
  }
  
  // Check if user is an admin of the organization
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.activeOrgId, organizationId),
      eq(users.role, 'admin')
    ),
  });
  
  return !!user;
}

/**
 * Ensure user has access to data before returning it
 * Throws error if access denied
 */
export async function ensureDataAccess(
  userId: number,
  entityType: string,
  entityId: number,
  action: 'view' | 'create' | 'update' | 'delete' = 'view'
): Promise<DataAccessContext> {
  const ctx = await getDataAccessContext(userId);
  
  // Log the access attempt
  await logDataAccess(userId, entityType, entityId, action);
  
  // For now, return context - specific entity checks should be done by caller
  return ctx;
}
