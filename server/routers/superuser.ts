/**
 * KIISHA Superuser Router
 * 
 * Elevated support mode for KIISHA staff:
 * - Time-boxed elevation with explicit scope
 * - Full audit trail
 * - Org-scoped or global access
 * - Automatic expiry
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { logSecurityEvent, checkSuperuserElevation } from "../services/orgContext";

// Maximum elevation duration
const MAX_ELEVATION_HOURS = 8;
const DEFAULT_ELEVATION_HOURS = 1;

/**
 * Verify caller is a KIISHA superuser
 */
async function requireSuperuser(userId: number) {
  const superusers = await db.getAllOrganizationSuperusers();
  const isSuperuser = superusers.some(s => s.userId === userId);
  
  if (!isSuperuser) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "KIISHA superuser access required",
    });
  }
}

export const superuserRouter = router({
  /**
   * Start elevated support session
   */
  startElevation: protectedProcedure
    .input(z.object({
      reason: z.string().min(10).max(500),
      targetOrganizationId: z.number().optional(),
      scope: z.enum(["global", "organization"]).default("organization"),
      durationHours: z.number().min(0.25).max(MAX_ELEVATION_HOURS).default(DEFAULT_ELEVATION_HOURS),
      canRead: z.boolean().default(true),
      canWrite: z.boolean().default(false),
      canExport: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Check for existing active elevation
      const existing = await db.getActiveSuperuserElevation(ctx.user.id);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an active elevation. End it first.",
        });
      }
      
      // Validate organization scope requires org ID
      if (input.scope === "organization" && !input.targetOrganizationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Organization ID required for org-specific scope",
        });
      }
      
      // Calculate expiry
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + input.durationHours * 60 * 60 * 1000);
      
      // Create elevation
      const elevationId = await db.createSuperuserElevation({
        userId: ctx.user.id,
        targetOrganizationId: input.targetOrganizationId,
        scope: input.scope,
        reason: input.reason,
        canRead: input.canRead,
        canWrite: input.canWrite,
        canExport: input.canExport,
        startedAt,
        expiresAt,
        status: "active",
      });
      
      // Log elevation start
      await logSecurityEvent("elevation_started", ctx.user.id, {
        targetOrganizationId: input.targetOrganizationId,
        elevationId: elevationId || undefined,
        elevationReason: input.reason,
        extra: {
          scope: input.scope,
          durationHours: input.durationHours,
          canRead: input.canRead,
          canWrite: input.canWrite,
          canExport: input.canExport,
        },
      });
      
      return {
        success: true,
        elevationId,
        expiresAt,
        message: `Elevation active until ${expiresAt.toISOString()}`,
      };
    }),

  /**
   * End elevated support session
   */
  endElevation: protectedProcedure
    .input(z.object({
      elevationId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Get active elevation
      const elevation = await db.getActiveSuperuserElevation(ctx.user.id);
      
      if (!elevation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active elevation found",
        });
      }
      
      // End elevation
      await db.endSuperuserElevation(elevation.id);
      
      // Log elevation end
      await logSecurityEvent("elevation_ended", ctx.user.id, {
        targetOrganizationId: elevation.targetOrganizationId || undefined,
        elevationId: elevation.id,
        extra: {
          reason: "manual_end",
          durationMinutes: Math.round(
            (Date.now() - elevation.startedAt.getTime()) / 60000
          ),
        },
      });
      
      return { success: true };
    }),

  /**
   * Get current elevation status
   */
  getElevationStatus: protectedProcedure.query(async ({ ctx }) => {
    await requireSuperuser(ctx.user.id);
    
    const elevation = await db.getActiveSuperuserElevation(ctx.user.id);
    
    if (!elevation) {
      return {
        isElevated: false,
      };
    }
    
    return {
      isElevated: true,
      elevation: {
        id: elevation.id,
        scope: elevation.scope,
        targetOrganizationId: elevation.targetOrganizationId,
        reason: elevation.reason,
        canRead: elevation.canRead,
        canWrite: elevation.canWrite,
        canExport: elevation.canExport,
        startedAt: elevation.startedAt,
        expiresAt: elevation.expiresAt,
        remainingMinutes: Math.max(
          0,
          Math.round((elevation.expiresAt.getTime() - Date.now()) / 60000)
        ),
      },
    };
  }),

  /**
   * View org data with elevation (read-only)
   */
  viewOrgData: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      dataType: z.enum(["users", "projects", "documents", "audit_log"]),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Check elevation
      const { isElevated, elevation } = await checkSuperuserElevation(
        ctx.user.id,
        input.organizationId
      );
      
      if (!isElevated) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Elevation required to view org data",
        });
      }
      
      if (!elevation?.canRead) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Read permission not granted in current elevation",
        });
      }
      
      // Log the access
      await logSecurityEvent("elevated_data_access", ctx.user.id, {
        organizationId: input.organizationId,
        elevationId: elevation.id,
        extra: {
          dataType: input.dataType,
          limit: input.limit,
        },
      });
      
      // Return data based on type
      switch (input.dataType) {
        case "users": {
          // Get org members
          const members = await db.getOrganizationMemberships(input.organizationId);
          return {
            dataType: "users",
            count: members.length,
            data: members.slice(0, input.limit),
          };
        }
        case "projects": {
          const projects = await db.getAllProjects();
          const orgProjects = projects.filter(p => p.organizationId === input.organizationId);
          return {
            dataType: "projects",
            count: orgProjects.length,
            data: orgProjects.slice(0, input.limit),
          };
        }
        case "audit_log": {
          const logs = await db.getSecurityAuditLog({
            organizationId: input.organizationId,
            limit: input.limit,
          });
          return {
            dataType: "audit_log",
            count: logs.length,
            data: logs,
          };
        }
        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unsupported data type",
          });
      }
    }),

  /**
   * List all KIISHA superusers (admin only)
   */
  listSuperusers: protectedProcedure.query(async ({ ctx }) => {
    // Only existing superusers can list other superusers
    await requireSuperuser(ctx.user.id);
    
    const superusers = await db.getAllOrganizationSuperusers();
    
    return superusers.map(s => ({
      id: s.id,
      userId: s.userId,
      organizationId: s.organizationId,
      grantedBy: s.grantedBy,
      grantedAt: s.grantedAt,
    }));
  }),

  /**
   * Get elevation history for audit
   */
  getElevationHistory: protectedProcedure
    .input(z.object({
      userId: z.number().optional(),
      organizationId: z.number().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Get elevation events from security audit log
      const logs = await db.getSecurityAuditLog({
        userId: input.userId,
        organizationId: input.organizationId,
        eventType: "elevation_started",
        startDate: input.startDate,
        endDate: input.endDate,
        limit: input.limit,
      });
      
      return logs;
    }),

  /**
   * List all organizations (for superuser org switcher)
   */
  listAllOrganizations: protectedProcedure.query(async ({ ctx }) => {
    await requireSuperuser(ctx.user.id);
    
    const organizations = await db.getAllOrganizations();
    
    return organizations.map(org => ({
      id: org.id,
      name: org.name,
      code: org.code,
      slug: org.slug,
      status: org.status,
      createdAt: org.createdAt,
    }));
  }),

  /**
   * Create new organization (superuser only)
   */
  createOrganization: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(100),
      code: z.string().min(2).max(10).toUpperCase(),
      slug: z.string().min(2).max(50).toLowerCase().regex(/^[a-z0-9-]+$/),
      description: z.string().max(500).optional(),
      signupMode: z.enum(["invite_only", "domain_allowlist", "open"]).default("invite_only"),
      allowedEmailDomains: z.string().optional(),
      require2FA: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Check for duplicate code or slug
      const existing = await db.getOrganizationByCode(input.code);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization code already exists",
        });
      }
      
      const existingSlug = await db.getOrganizationBySlug(input.slug);
      if (existingSlug) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization slug already exists",
        });
      }
      
      // Create organization
      const orgId = await db.createOrganization({
        name: input.name,
        code: input.code,
        slug: input.slug,
        description: input.description,
        signupMode: input.signupMode,
        allowedEmailDomains: input.allowedEmailDomains ? input.allowedEmailDomains.split(",").map(d => d.trim()) : undefined,
        require2FA: input.require2FA,
        status: "active",
        createdBy: ctx.user.id,
      });
      
      // Log creation
      await logSecurityEvent("org_created", ctx.user.id, {
        organizationId: orgId || undefined,
        extra: {
          name: input.name,
          code: input.code,
          slug: input.slug,
        },
      });
      
      return {
        success: true,
        organizationId: orgId,
        message: `Organization ${input.name} created successfully`,
      };
    }),

  /**
   * Update organization status (suspend/archive/activate)
   */
  updateOrganizationStatus: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      status: z.enum(["active", "suspended", "archived"]),
      reason: z.string().min(10).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      const org = await db.getOrganizationById(input.organizationId);
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }
      
      const oldStatus = org.status;
      
      await db.updateOrganizationStatus(input.organizationId, input.status);
      
      // Log status change
      await logSecurityEvent("org_status_changed", ctx.user.id, {
        organizationId: input.organizationId,
        extra: {
          oldStatus,
          newStatus: input.status,
          reason: input.reason,
        },
      });
      
      return {
        success: true,
        message: `Organization status changed from ${oldStatus} to ${input.status}`,
      };
    }),

  /**
   * Get all users across organizations (for superuser management)
   */
  listAllUsers: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      const users = await db.getAllUsersFiltered({
        organizationId: input.organizationId,
        search: input.search,
        limit: input.limit,
        offset: input.offset,
      });
      
      return users;
    }),

  /**
   * Grant or revoke user access to organization
   */
  manageUserAccess: protectedProcedure
    .input(z.object({
      userId: z.number(),
      organizationId: z.number(),
      action: z.enum(["grant", "revoke"]),
      role: z.enum(["admin", "editor", "reviewer", "investor_viewer"]).optional(),
      reason: z.string().min(10).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSuperuser(ctx.user.id);
      
      // Verify user exists
      const user = await db.getUserById(input.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
      
      // Verify org exists
      const org = await db.getOrganizationById(input.organizationId);
      if (!org) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }
      
      if (input.action === "grant") {
        // Check if already a member
        const memberships = await db.getUserOrganizationMemberships(input.userId);
        const existing = memberships.find(m => m.organizationId === input.organizationId);
        
        if (existing && existing.status === "active") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this organization",
          });
        }
        
        // Grant access
        await db.createOrganizationMembership({
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role || "editor",
          status: "active",
          invitedBy: ctx.user.id,
        });
        
        await logSecurityEvent("org_access_granted", ctx.user.id, {
          organizationId: input.organizationId,
          targetUserId: input.userId,
          extra: {
            action: "superuser_grant",
            role: input.role || "editor",
            reason: input.reason,
          },
        });
      } else {
        // Revoke access
        const memberships = await db.getUserOrganizationMemberships(input.userId);
        const membership = memberships.find(m => m.organizationId === input.organizationId);
        
        if (!membership) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User is not a member of this organization",
          });
        }
        
        await db.removeOrganizationMember(membership.id);
        
        await logSecurityEvent("org_access_revoked", ctx.user.id, {
          organizationId: input.organizationId,
          targetUserId: input.userId,
          extra: {
            action: "superuser_revoke",
            reason: input.reason,
          },
        });
      }
      
      return {
        success: true,
        message: input.action === "grant" 
          ? `Access granted to ${user.name || user.email}` 
          : `Access revoked for ${user.name || user.email}`,
      };
    }),
});
