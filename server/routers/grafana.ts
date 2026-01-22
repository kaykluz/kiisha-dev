/**
 * Grafana tRPC Router
 * 
 * Provides endpoints for:
 * - Grafana instance management
 * - Dashboard listing and management
 * - Alert policy management
 * - Provisioning job tracking
 * - Portal embedding
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { 
  runOrgBootstrapJob, 
  runProjectProvisionJob, 
  runClientProvisionJob 
} from "../grafana/provisioningJobs";
import { 
  generateEmbedToken, 
  validateEmbedToken 
} from "../grafana/portalEmbedding";
import { 
  createAlertPolicy, 
  updateAlertPolicy, 
  deleteAlertPolicy, 
  toggleAlertPolicy 
} from "../grafana/alertWebhookBridge";

export const grafanaRouter = router({
  // ============================================================================
  // Instance Management (Admin only)
  // ============================================================================
  
  listInstances: adminProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT gi.id, gi.name, gi.baseUrl as url, gi.status, gi.createdAt, gi.updatedAt 
          FROM grafanaInstances gi
          JOIN grafanaOrgs go ON gi.id = go.grafanaInstanceId
          WHERE go.kiishaOrgId = ${ctx.user.organizationId}
          ORDER BY gi.createdAt DESC`
    );
    return result.rows as Array<{
      id: number;
      name: string;
      url: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }),

  // ============================================================================
  // Dashboard Management
  // ============================================================================
  
  listDashboards: protectedProcedure
    .input(z.object({
      folderId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      let query = sql`
        SELECT 
          d.id,
          d.name,
          d.dashboardUid,
          d.dashboardType,
          d.templateKey,
          f.name as folderName,
          f.folderUid,
          CONCAT(gi.baseUrl, '/d/', d.dashboardUid) as grafanaUrl,
          d.createdAt
        FROM grafanaDashboards d
        JOIN grafanaFolders f ON d.folderId = f.id
        JOIN grafanaOrgs go ON f.grafanaOrgsId = go.id
        JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
        WHERE go.kiishaOrgId = ${ctx.user.organizationId}
      `;
      
      if (input?.folderId) {
        query = sql`${query} AND d.folderId = ${input.folderId}`;
      }
      
      query = sql`${query} ORDER BY d.name ASC`;
      
      const result = await db.execute(query);
      return result.rows as Array<{
        id: number;
        name: string;
        dashboardUid: string;
        dashboardType: string;
        templateKey: string;
        folderName: string;
        folderUid: string;
        grafanaUrl: string;
        createdAt: string;
      }>;
    }),

  listFolders: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT f.id, f.name, f.folderUid, f.folderId, f.createdAt
          FROM grafanaFolders f
          JOIN grafanaOrgs go ON f.grafanaOrgsId = go.id
          WHERE go.kiishaOrgId = ${ctx.user.organizationId}
          ORDER BY f.name ASC`
    );
    return result.rows as Array<{
      id: number;
      name: string;
      folderUid: string;
      folderId: number;
      createdAt: string;
    }>;
  }),

  // ============================================================================
  // Alert Management
  // ============================================================================
  
  listRecentAlerts: protectedProcedure
    .input(z.object({
      timeRange: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
      status: z.enum(["all", "firing", "resolved"]).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      const timeRangeMap: Record<string, string> = {
        "1h": "1 HOUR",
        "24h": "24 HOUR",
        "7d": "7 DAY",
        "30d": "30 DAY",
      };
      
      let query = sql`
        SELECT 
          id,
          fingerprint,
          alertStatus as status,
          JSON_EXTRACT(labels, '$.alertname') as title,
          JSON_EXTRACT(annotations, '$.description') as message,
          JSON_EXTRACT(labels, '$.severity') as severity,
          startsAt,
          endsAt,
          createdAt
        FROM grafanaAlertIngestions
        WHERE kiishaOrgId = ${ctx.user.organizationId}
          AND createdAt > NOW() - INTERVAL ${sql.raw(timeRangeMap[input.timeRange])}
      `;
      
      if (input.status && input.status !== "all") {
        query = sql`${query} AND alertStatus = ${input.status}`;
      }
      
      query = sql`${query} ORDER BY createdAt DESC LIMIT ${input.limit}`;
      
      const result = await db.execute(query);
      return result.rows as Array<{
        id: number;
        fingerprint: string;
        status: string;
        title: string;
        message: string;
        severity: string;
        startsAt: string;
        endsAt: string | null;
        createdAt: string;
      }>;
    }),

  // ============================================================================
  // Alert Policy Management
  // ============================================================================
  
  listAlertPolicies: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const result = await db.execute(
      sql`SELECT id, scopeType, scopeId, ruleMatch, action, priority, 
                 notifyOwner, notifyClient, autoCreateWorkOrder, enabled, createdAt
          FROM grafanaAlertPolicies
          WHERE kiishaOrgId = ${ctx.user.organizationId}
          ORDER BY 
            CASE scopeType 
              WHEN 'device' THEN 1
              WHEN 'site' THEN 2
              WHEN 'project' THEN 3
              WHEN 'org' THEN 4
            END,
            createdAt DESC`
    );
    return result.rows as Array<{
      id: number;
      scopeType: string;
      scopeId: number | null;
      ruleMatch: string | null;
      action: string;
      priority: string;
      notifyOwner: boolean;
      notifyClient: boolean;
      autoCreateWorkOrder: boolean;
      enabled: boolean;
      createdAt: string;
    }>;
  }),

  createAlertPolicy: adminProcedure
    .input(z.object({
      scopeType: z.enum(["org", "project", "site", "device"]),
      scopeId: z.number().optional(),
      ruleMatch: z.record(z.union([z.string(), z.array(z.string())])).optional(),
      action: z.enum(["create_alert", "create_notification", "create_work_order", "ignore", "escalate"]),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      notifyOwner: z.boolean().default(false),
      notifyClient: z.boolean().default(false),
      autoCreateWorkOrder: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const policyId = await createAlertPolicy({
        kiishaOrgId: ctx.user.organizationId,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        ruleMatch: input.ruleMatch,
        action: input.action,
        priority: input.priority,
        notifyOwner: input.notifyOwner,
        notifyClient: input.notifyClient,
        autoCreateWorkOrder: input.autoCreateWorkOrder,
        createdBy: ctx.user.id,
      });
      return { id: policyId };
    }),

  updateAlertPolicy: adminProcedure
    .input(z.object({
      policyId: z.number(),
      scopeType: z.enum(["org", "project", "site", "device"]).optional(),
      scopeId: z.number().optional(),
      ruleMatch: z.record(z.union([z.string(), z.array(z.string())])).optional(),
      action: z.enum(["create_alert", "create_notification", "create_work_order", "ignore", "escalate"]).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      notifyOwner: z.boolean().optional(),
      notifyClient: z.boolean().optional(),
      autoCreateWorkOrder: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { policyId, ...updates } = input;
      await updateAlertPolicy(policyId, updates);
      return { success: true };
    }),

  deleteAlertPolicy: adminProcedure
    .input(z.object({
      policyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await deleteAlertPolicy(input.policyId);
      return { success: true };
    }),

  toggleAlertPolicy: adminProcedure
    .input(z.object({
      policyId: z.number(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await toggleAlertPolicy(input.policyId, input.enabled);
      return { success: true };
    }),

  // ============================================================================
  // Provisioning Jobs
  // ============================================================================
  
  listProvisioningJobs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(["all", "pending", "running", "completed", "failed"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      let query = sql`
        SELECT id, jobType, targetType, targetId, status, attemptCount, 
               lastError, startedAt, completedAt, createdAt
        FROM grafanaProvisioningJobs
        WHERE kiishaOrgId = ${ctx.user.organizationId}
      `;
      
      if (input.status && input.status !== "all") {
        query = sql`${query} AND status = ${input.status}`;
      }
      
      query = sql`${query} ORDER BY createdAt DESC LIMIT ${input.limit}`;
      
      const result = await db.execute(query);
      return result.rows as Array<{
        id: number;
        jobType: string;
        targetType: string;
        targetId: string;
        status: string;
        attemptCount: number;
        lastError: string | null;
        startedAt: string | null;
        completedAt: string | null;
        createdAt: string;
      }>;
    }),

  triggerOrgBootstrap: adminProcedure.mutation(async ({ ctx }) => {
    // Find or create Grafana instance for this org
    const db = getDb();
    const instanceResult = await db.execute(
      sql`SELECT gi.id FROM grafanaInstances gi
          JOIN grafanaOrgs go ON gi.id = go.grafanaInstanceId
          WHERE go.kiishaOrgId = ${ctx.user.organizationId}
          LIMIT 1`
    );
    
    const instances = instanceResult.rows as Array<{ id: number }>;
    
    if (instances.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Grafana instance configured for this organization",
      });
    }
    
    await runOrgBootstrapJob(instances[0].id, ctx.user.organizationId);
    return { success: true, message: "Organization bootstrap job started" };
  }),

  triggerProjectProvision: adminProcedure
    .input(z.object({
      projectId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const grafanaOrgResult = await db.execute(
        sql`SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${ctx.user.organizationId} LIMIT 1`
      );
      
      const grafanaOrgs = grafanaOrgResult.rows as Array<{ id: number }>;
      
      if (grafanaOrgs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not bootstrapped in Grafana",
        });
      }
      
      await runProjectProvisionJob(grafanaOrgs[0].id, input.projectId);
      return { success: true, message: "Project provisioning job started" };
    }),

  triggerClientProvision: adminProcedure
    .input(z.object({
      clientAccountId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const grafanaOrgResult = await db.execute(
        sql`SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${ctx.user.organizationId} LIMIT 1`
      );
      
      const grafanaOrgs = grafanaOrgResult.rows as Array<{ id: number }>;
      
      if (grafanaOrgs.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not bootstrapped in Grafana",
        });
      }
      
      await runClientProvisionJob(grafanaOrgs[0].id, input.clientAccountId);
      return { success: true, message: "Client provisioning job started" };
    }),

  // ============================================================================
  // Portal Embedding
  // ============================================================================
  
  getEmbedToken: protectedProcedure
    .input(z.object({
      dashboardUid: z.string(),
      ttlMinutes: z.number().min(1).max(60).default(15),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      
      // Verify user has access to this dashboard
      const bindingResult = await db.execute(
        sql`SELECT db.id FROM grafanaDashboardBindings db
            JOIN grafanaDashboards d ON db.dashboardId = d.id
            JOIN grafanaFolders f ON d.folderId = f.id
            JOIN grafanaOrgs go ON f.grafanaOrgsId = go.id
            WHERE d.dashboardUid = ${input.dashboardUid}
              AND go.kiishaOrgId = ${ctx.user.organizationId}
            LIMIT 1`
      );
      
      const bindings = bindingResult.rows as Array<{ id: number }>;
      
      if (bindings.length === 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this dashboard",
        });
      }
      
      const { token, expiresAt } = await generateEmbedToken({
        dashboardUid: input.dashboardUid,
        subjectType: "user",
        subjectId: ctx.user.id,
        ttlMinutes: input.ttlMinutes,
        scopePayload: {
          orgId: ctx.user.organizationId,
          userId: ctx.user.id,
        },
      });
      
      return { token, expiresAt };
    }),

  // ============================================================================
  // Audit Log
  // ============================================================================
  
  listAuditLog: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      eventType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      
      let query = sql`
        SELECT id, eventType, actorType, actorId, targetType, targetId, 
               details, correlationId, createdAt
        FROM grafanaAuditLog
        WHERE kiishaOrgId = ${ctx.user.organizationId}
      `;
      
      if (input.eventType) {
        query = sql`${query} AND eventType = ${input.eventType}`;
      }
      
      query = sql`${query} ORDER BY createdAt DESC LIMIT ${input.limit}`;
      
      const result = await db.execute(query);
      return result.rows as Array<{
        id: number;
        eventType: string;
        actorType: string;
        actorId: string | null;
        targetType: string;
        targetId: string;
        details: string;
        correlationId: string;
        createdAt: string;
      }>;
    }),

  // ============================================================================
  // Instance Configuration
  // ============================================================================
  
  saveInstanceConfig: adminProcedure
    .input(z.object({
      url: z.string().url(),
      adminToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      
      // Check if instance already exists for this URL
      const existingResult = await db.execute(
        sql`SELECT id FROM grafanaInstances WHERE baseUrl = ${input.url} LIMIT 1`
      );
      
      const existing = existingResult.rows as Array<{ id: number }>;
      
      if (existing.length > 0) {
        // Update existing instance
        await db.execute(
          sql`UPDATE grafanaInstances 
              SET adminToken = ${input.adminToken || null},
                  status = 'active',
                  updatedAt = NOW()
              WHERE id = ${existing[0].id}`
        );
        
        // Ensure org mapping exists
        await db.execute(
          sql`INSERT IGNORE INTO grafanaOrgs (grafanaInstanceId, kiishaOrgId, grafanaOrgId, createdAt)
              VALUES (${existing[0].id}, ${ctx.user.organizationId}, 1, NOW())`
        );
        
        return { id: existing[0].id, created: false };
      }
      
      // Create new instance
      await db.execute(
        sql`INSERT INTO grafanaInstances (name, baseUrl, adminToken, status, createdAt, updatedAt)
            VALUES ('Grafana', ${input.url}, ${input.adminToken || null}, 'active', NOW(), NOW())`
      );
      
      // Get the new instance ID
      const newResult = await db.execute(
        sql`SELECT id FROM grafanaInstances WHERE baseUrl = ${input.url} ORDER BY id DESC LIMIT 1`
      );
      
      const newInstance = newResult.rows as Array<{ id: number }>;
      const instanceId = newInstance[0]?.id;
      
      if (instanceId) {
        // Create org mapping
        await db.execute(
          sql`INSERT INTO grafanaOrgs (grafanaInstanceId, kiishaOrgId, grafanaOrgId, createdAt)
              VALUES (${instanceId}, ${ctx.user.organizationId}, 1, NOW())`
        );
      }
      
      return { id: instanceId, created: true };
    }),
});
