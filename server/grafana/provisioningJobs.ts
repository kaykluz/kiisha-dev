/**
 * Grafana Provisioning Jobs
 * 
 * Idempotent provisioning jobs for:
 * - Organization bootstrap (create Grafana org, datasource, service account)
 * - Project provisioning (create folder, dashboards)
 * - Client provisioning (create client folder, portal dashboard)
 * - Token rotation (rotate service account tokens)
 */

import { randomUUID } from 'crypto';
import { getDb } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { createGrafanaClient, GrafanaClient } from '../lib/grafanaClient';
import { loadTemplate, loadPortalTemplate, DashboardTemplateKey } from './templateLoader';

// ============================================================================
// Types
// ============================================================================

export type JobType = 
  | 'org_bootstrap'
  | 'project_provision'
  | 'client_provision'
  | 'token_rotation'
  | 'dashboard_update';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface ProvisioningJobResult {
  success: boolean;
  jobId: number;
  status: JobStatus;
  message?: string;
  data?: Record<string, unknown>;
}

export interface OrgBootstrapParams {
  kiishaOrgId: number;
  orgName: string;
  grafanaInstanceId: number;
}

export interface ProjectProvisionParams {
  kiishaOrgId: number;
  projectId: number;
  projectName: string;
}

export interface ClientProvisionParams {
  kiishaOrgId: number;
  clientAccountId: number;
  clientName: string;
  allowedProjectIds: number[];
}

// ============================================================================
// Job Execution Context
// ============================================================================

interface JobContext {
  jobId: number;
  correlationId: string;
  grafanaClient: GrafanaClient;
  db: ReturnType<typeof getDb>;
}

// ============================================================================
// Idempotency Helpers
// ============================================================================

/**
 * Generate idempotency key for a job
 */
function generateIdempotencyKey(jobType: JobType, targetType: string, targetId: number): string {
  return `${jobType}:${targetType}:${targetId}`;
}

/**
 * Check if a job with the same idempotency key has already completed
 */
async function checkIdempotency(
  db: ReturnType<typeof getDb>,
  idempotencyKey: string
): Promise<{ exists: boolean; status?: JobStatus; jobId?: number }> {
  const existing = await db.execute(
    sql`SELECT id, status FROM grafanaProvisioningJobs WHERE idempotencyKey = ${idempotencyKey} ORDER BY createdAt DESC LIMIT 1`
  );
  
  const rows = existing.rows as Array<{ id: number; status: JobStatus }>;
  if (rows.length === 0) {
    return { exists: false };
  }
  
  return {
    exists: true,
    status: rows[0].status,
    jobId: rows[0].id,
  };
}

/**
 * Create a new provisioning job record
 */
async function createJobRecord(
  db: ReturnType<typeof getDb>,
  jobType: JobType,
  targetType: string,
  targetId: number,
  idempotencyKey: string,
  triggeredBy?: number
): Promise<number> {
  const result = await db.execute(
    sql`INSERT INTO grafanaProvisioningJobs (jobType, targetType, targetId, idempotencyKey, status, triggeredBy, createdAt) 
        VALUES (${jobType}, ${targetType}, ${targetId}, ${idempotencyKey}, 'pending', ${triggeredBy || null}, NOW())`
  );
  
  return Number((result as { insertId: number }).insertId);
}

/**
 * Update job status
 */
async function updateJobStatus(
  db: ReturnType<typeof getDb>,
  jobId: number,
  status: JobStatus,
  resultPayload?: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  const completedAt = status === 'completed' || status === 'failed' ? sql`NOW()` : sql`NULL`;
  
  await db.execute(
    sql`UPDATE grafanaProvisioningJobs 
        SET status = ${status}, 
            resultPayload = ${resultPayload ? JSON.stringify(resultPayload) : null},
            errorMessage = ${errorMessage || null},
            completedAt = ${completedAt},
            lastAttemptAt = NOW(),
            attemptCount = attemptCount + 1
        WHERE id = ${jobId}`
  );
}

// ============================================================================
// Organization Bootstrap Job
// ============================================================================

/**
 * Bootstrap a KIISHA organization in Grafana
 * Creates: Grafana org, datasource, service account, and base dashboards
 */
export async function runOrgBootstrapJob(
  params: OrgBootstrapParams,
  triggeredBy?: number
): Promise<ProvisioningJobResult> {
  const db = getDb();
  const idempotencyKey = generateIdempotencyKey('org_bootstrap', 'org', params.kiishaOrgId);
  const correlationId = randomUUID();
  
  // Check idempotency
  const existing = await checkIdempotency(db, idempotencyKey);
  if (existing.exists && existing.status === 'completed') {
    return {
      success: true,
      jobId: existing.jobId!,
      status: 'skipped',
      message: 'Organization already bootstrapped',
    };
  }
  
  // Create job record
  const jobId = await createJobRecord(db, 'org_bootstrap', 'org', params.kiishaOrgId, idempotencyKey, triggeredBy);
  
  try {
    // Update status to running
    await updateJobStatus(db, jobId, 'running');
    
    // Get Grafana instance config
    const instanceResult = await db.execute(
      sql`SELECT baseUrl, adminToken FROM grafanaInstances WHERE id = ${params.grafanaInstanceId} AND status = 'active'`
    );
    const instances = instanceResult.rows as Array<{ baseUrl: string; adminToken: string }>;
    
    if (instances.length === 0) {
      throw new Error(`Grafana instance ${params.grafanaInstanceId} not found or inactive`);
    }
    
    const grafanaClient = createGrafanaClient({
      baseUrl: instances[0].baseUrl,
      adminToken: instances[0].adminToken,
    });
    
    // Step 1: Create Grafana organization
    console.log(`[GrafanaJob] Creating org for KIISHA org ${params.kiishaOrgId}`, { correlationId });
    const grafanaOrg = await grafanaClient.createOrg(
      `KIISHA-${params.kiishaOrgId}-${params.orgName}`,
      correlationId
    );
    
    // Step 2: Create service account for this org
    console.log(`[GrafanaJob] Creating service account for Grafana org ${grafanaOrg.id}`, { correlationId });
    const serviceAccount = await grafanaClient.createServiceAccount(
      `kiisha-sa-${params.kiishaOrgId}`,
      'Editor',
      { orgId: grafanaOrg.id, correlationId }
    );
    
    // Step 3: Create service account token
    const saToken = await grafanaClient.createServiceAccountToken(
      serviceAccount.id,
      `kiisha-token-${Date.now()}`,
      { orgId: grafanaOrg.id, correlationId, secondsToLive: 365 * 24 * 60 * 60 } // 1 year
    );
    
    // Step 4: Create default datasource (MySQL pointing to KIISHA DB)
    const datasource = await grafanaClient.createDataSource(
      {
        name: 'KIISHA-MySQL',
        type: 'mysql',
        url: process.env.DATABASE_HOST || 'localhost:3306',
        database: process.env.DATABASE_NAME || 'kiisha',
        user: process.env.DATABASE_USER || 'kiisha_readonly',
        isDefault: true,
        secureJsonData: {
          password: process.env.DATABASE_READONLY_PASSWORD || '',
        },
        jsonData: {
          maxOpenConns: 10,
          maxIdleConns: 5,
          connMaxLifetime: 14400,
        },
      },
      { orgId: grafanaOrg.id, correlationId }
    );
    
    // Step 5: Store in grafanaOrgs table
    await db.execute(
      sql`INSERT INTO grafanaOrgs (grafanaInstanceId, kiishaOrgId, grafanaOrgId, serviceAccountId, serviceAccountToken, datasourceUid, createdAt)
          VALUES (${params.grafanaInstanceId}, ${params.kiishaOrgId}, ${grafanaOrg.id}, ${serviceAccount.id}, ${saToken.key}, ${datasource.uid}, NOW())`
    );
    
    // Step 6: Store datasource record
    await db.execute(
      sql`INSERT INTO grafanaDataSources (grafanaOrgsId, datasourceUid, datasourceType, datasourceName, isDefault, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), ${datasource.uid}, 'mysql', 'KIISHA-MySQL', TRUE, NOW())`
    );
    
    // Step 7: Create Portfolio Overview dashboard
    const portfolioTemplate = loadTemplate('portfolio-overview', {
      org_id: params.kiishaOrgId,
      datasource_uid: datasource.uid,
    });
    
    const portfolioDashboard = await grafanaClient.createDashboard(
      portfolioTemplate.dashboard,
      { orgId: grafanaOrg.id, correlationId }
    );
    
    // Store dashboard record
    await db.execute(
      sql`INSERT INTO grafanaDashboards (grafanaOrgsId, dashboardUid, dashboardId, dashboardName, dashboardType, templateKey, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), ${portfolioDashboard.uid}, ${portfolioDashboard.id}, ${portfolioDashboard.title}, 'org', 'portfolio-overview', NOW())`
    );
    
    // Log audit event
    await logAuditEvent(db, {
      eventType: 'org_provisioned',
      actorType: triggeredBy ? 'user' : 'system',
      actorId: triggeredBy,
      kiishaOrgId: params.kiishaOrgId,
      grafanaOrgId: grafanaOrg.id,
      correlationId,
      details: {
        grafanaOrgName: grafanaOrg.name,
        datasourceUid: datasource.uid,
        dashboardUid: portfolioDashboard.uid,
      },
    });
    
    // Update job as completed
    await updateJobStatus(db, jobId, 'completed', {
      grafanaOrgId: grafanaOrg.id,
      serviceAccountId: serviceAccount.id,
      datasourceUid: datasource.uid,
      dashboardUid: portfolioDashboard.uid,
    });
    
    return {
      success: true,
      jobId,
      status: 'completed',
      data: {
        grafanaOrgId: grafanaOrg.id,
        datasourceUid: datasource.uid,
      },
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GrafanaJob] Org bootstrap failed for KIISHA org ${params.kiishaOrgId}:`, errorMessage);
    
    await updateJobStatus(db, jobId, 'failed', undefined, errorMessage);
    
    return {
      success: false,
      jobId,
      status: 'failed',
      message: errorMessage,
    };
  }
}

// ============================================================================
// Project Provisioning Job
// ============================================================================

/**
 * Provision dashboards for a KIISHA project
 */
export async function runProjectProvisionJob(
  params: ProjectProvisionParams,
  triggeredBy?: number
): Promise<ProvisioningJobResult> {
  const db = getDb();
  const idempotencyKey = generateIdempotencyKey('project_provision', 'project', params.projectId);
  const correlationId = randomUUID();
  
  // Check idempotency
  const existing = await checkIdempotency(db, idempotencyKey);
  if (existing.exists && existing.status === 'completed') {
    return {
      success: true,
      jobId: existing.jobId!,
      status: 'skipped',
      message: 'Project already provisioned',
    };
  }
  
  const jobId = await createJobRecord(db, 'project_provision', 'project', params.projectId, idempotencyKey, triggeredBy);
  
  try {
    await updateJobStatus(db, jobId, 'running');
    
    // Get Grafana org config for this KIISHA org
    const orgResult = await db.execute(
      sql`SELECT go.grafanaOrgId, go.serviceAccountToken, go.datasourceUid, gi.baseUrl
          FROM grafanaOrgs go
          JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
          WHERE go.kiishaOrgId = ${params.kiishaOrgId}`
    );
    const orgs = orgResult.rows as Array<{ grafanaOrgId: number; serviceAccountToken: string; datasourceUid: string; baseUrl: string }>;
    
    if (orgs.length === 0) {
      throw new Error(`Grafana org not found for KIISHA org ${params.kiishaOrgId}. Run org bootstrap first.`);
    }
    
    const orgConfig = orgs[0];
    const grafanaClient = createGrafanaClient({
      baseUrl: orgConfig.baseUrl,
      adminToken: orgConfig.serviceAccountToken,
      defaultOrgId: orgConfig.grafanaOrgId,
    });
    
    // Create folder for project
    const folder = await grafanaClient.createFolder(
      `Project: ${params.projectName}`,
      { orgId: orgConfig.grafanaOrgId, correlationId }
    );
    
    // Store folder record
    await db.execute(
      sql`INSERT INTO grafanaFolders (grafanaOrgsId, folderUid, folderId, folderName, scopeType, scopeId, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), ${folder.uid}, ${folder.id}, ${folder.title}, 'project', ${params.projectId}, NOW())`
    );
    
    // Create Site Performance dashboard for this project
    const siteTemplate = loadTemplate('site-performance', {
      org_id: params.kiishaOrgId,
      datasource_uid: orgConfig.datasourceUid,
      project_id: params.projectId,
      title_suffix: params.projectName,
    });
    
    const siteDashboard = await grafanaClient.createDashboard(
      siteTemplate.dashboard,
      { folderId: folder.id, orgId: orgConfig.grafanaOrgId, correlationId }
    );
    
    // Store dashboard record
    await db.execute(
      sql`INSERT INTO grafanaDashboards (grafanaOrgsId, folderId, dashboardUid, dashboardId, dashboardName, dashboardType, templateKey, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), 
                  (SELECT id FROM grafanaFolders WHERE folderUid = ${folder.uid} LIMIT 1),
                  ${siteDashboard.uid}, ${siteDashboard.id}, ${siteDashboard.title}, 'project', 'site-performance', NOW())`
    );
    
    await updateJobStatus(db, jobId, 'completed', {
      folderUid: folder.uid,
      dashboardUid: siteDashboard.uid,
    });
    
    return {
      success: true,
      jobId,
      status: 'completed',
      data: {
        folderUid: folder.uid,
        dashboardUid: siteDashboard.uid,
      },
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GrafanaJob] Project provision failed for project ${params.projectId}:`, errorMessage);
    
    await updateJobStatus(db, jobId, 'failed', undefined, errorMessage);
    
    return {
      success: false,
      jobId,
      status: 'failed',
      message: errorMessage,
    };
  }
}

// ============================================================================
// Client Provisioning Job
// ============================================================================

/**
 * Provision portal dashboard for a client account
 */
export async function runClientProvisionJob(
  params: ClientProvisionParams,
  triggeredBy?: number
): Promise<ProvisioningJobResult> {
  const db = getDb();
  const idempotencyKey = generateIdempotencyKey('client_provision', 'client_account', params.clientAccountId);
  const correlationId = randomUUID();
  
  // Check idempotency
  const existing = await checkIdempotency(db, idempotencyKey);
  if (existing.exists && existing.status === 'completed') {
    return {
      success: true,
      jobId: existing.jobId!,
      status: 'skipped',
      message: 'Client already provisioned',
    };
  }
  
  const jobId = await createJobRecord(db, 'client_provision', 'client_account', params.clientAccountId, idempotencyKey, triggeredBy);
  
  try {
    await updateJobStatus(db, jobId, 'running');
    
    // Get Grafana org config
    const orgResult = await db.execute(
      sql`SELECT go.grafanaOrgId, go.serviceAccountToken, go.datasourceUid, gi.baseUrl
          FROM grafanaOrgs go
          JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
          WHERE go.kiishaOrgId = ${params.kiishaOrgId}`
    );
    const orgs = orgResult.rows as Array<{ grafanaOrgId: number; serviceAccountToken: string; datasourceUid: string; baseUrl: string }>;
    
    if (orgs.length === 0) {
      throw new Error(`Grafana org not found for KIISHA org ${params.kiishaOrgId}`);
    }
    
    const orgConfig = orgs[0];
    const grafanaClient = createGrafanaClient({
      baseUrl: orgConfig.baseUrl,
      adminToken: orgConfig.serviceAccountToken,
      defaultOrgId: orgConfig.grafanaOrgId,
    });
    
    // Create folder for client
    const folder = await grafanaClient.createFolder(
      `Client: ${params.clientName}`,
      { orgId: orgConfig.grafanaOrgId, correlationId }
    );
    
    // Set folder permissions (view only for this client)
    // In production, this would map to a Grafana team or user
    
    // Store folder record
    await db.execute(
      sql`INSERT INTO grafanaFolders (grafanaOrgsId, folderUid, folderId, folderName, scopeType, scopeId, clientAccountId, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), ${folder.uid}, ${folder.id}, ${folder.title}, 'client', ${params.clientAccountId}, ${params.clientAccountId}, NOW())`
    );
    
    // Create portal dashboard
    const portalTemplate = loadPortalTemplate({
      org_id: params.kiishaOrgId,
      datasource_uid: orgConfig.datasourceUid,
      client_account_id: params.clientAccountId,
      allowed_project_ids: params.allowedProjectIds.join(','),
      title_suffix: params.clientName,
    });
    
    const portalDashboard = await grafanaClient.createDashboard(
      portalTemplate.dashboard,
      { folderId: folder.id, orgId: orgConfig.grafanaOrgId, correlationId }
    );
    
    // Store dashboard record with binding
    const dashboardInsert = await db.execute(
      sql`INSERT INTO grafanaDashboards (grafanaOrgsId, folderId, dashboardUid, dashboardId, dashboardName, dashboardType, templateKey, createdAt)
          VALUES ((SELECT id FROM grafanaOrgs WHERE kiishaOrgId = ${params.kiishaOrgId} LIMIT 1), 
                  (SELECT id FROM grafanaFolders WHERE folderUid = ${folder.uid} LIMIT 1),
                  ${portalDashboard.uid}, ${portalDashboard.id}, ${portalDashboard.title}, 'client', 'client-portal', NOW())`
    );
    
    const dashboardId = Number((dashboardInsert as { insertId: number }).insertId);
    
    // Create dashboard binding
    await db.execute(
      sql`INSERT INTO grafanaDashboardBindings (dashboardId, bindingType, bindingId, scopePayload, createdAt)
          VALUES (${dashboardId}, 'client_account', ${params.clientAccountId}, ${JSON.stringify({ allowedProjectIds: params.allowedProjectIds })}, NOW())`
    );
    
    await updateJobStatus(db, jobId, 'completed', {
      folderUid: folder.uid,
      dashboardUid: portalDashboard.uid,
    });
    
    return {
      success: true,
      jobId,
      status: 'completed',
      data: {
        folderUid: folder.uid,
        dashboardUid: portalDashboard.uid,
      },
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GrafanaJob] Client provision failed for client ${params.clientAccountId}:`, errorMessage);
    
    await updateJobStatus(db, jobId, 'failed', undefined, errorMessage);
    
    return {
      success: false,
      jobId,
      status: 'failed',
      message: errorMessage,
    };
  }
}

// ============================================================================
// Token Rotation Job
// ============================================================================

/**
 * Rotate service account token for a Grafana org
 */
export async function runTokenRotationJob(
  kiishaOrgId: number,
  triggeredBy?: number
): Promise<ProvisioningJobResult> {
  const db = getDb();
  const idempotencyKey = `token_rotation:org:${kiishaOrgId}:${Date.now()}`;
  const correlationId = randomUUID();
  
  const jobId = await createJobRecord(db, 'token_rotation', 'org', kiishaOrgId, idempotencyKey, triggeredBy);
  
  try {
    await updateJobStatus(db, jobId, 'running');
    
    // Get current org config
    const orgResult = await db.execute(
      sql`SELECT go.id, go.grafanaOrgId, go.serviceAccountId, go.serviceAccountToken, gi.baseUrl, gi.adminToken
          FROM grafanaOrgs go
          JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
          WHERE go.kiishaOrgId = ${kiishaOrgId}`
    );
    const orgs = orgResult.rows as Array<{ 
      id: number; 
      grafanaOrgId: number; 
      serviceAccountId: number; 
      serviceAccountToken: string; 
      baseUrl: string;
      adminToken: string;
    }>;
    
    if (orgs.length === 0) {
      throw new Error(`Grafana org not found for KIISHA org ${kiishaOrgId}`);
    }
    
    const orgConfig = orgs[0];
    const grafanaClient = createGrafanaClient({
      baseUrl: orgConfig.baseUrl,
      adminToken: orgConfig.adminToken, // Use admin token for token management
    });
    
    // Create new token
    const newToken = await grafanaClient.createServiceAccountToken(
      orgConfig.serviceAccountId,
      `kiisha-token-${Date.now()}`,
      { orgId: orgConfig.grafanaOrgId, correlationId, secondsToLive: 365 * 24 * 60 * 60 }
    );
    
    // Update token in database
    await db.execute(
      sql`UPDATE grafanaOrgs SET serviceAccountToken = ${newToken.key}, tokenRotatedAt = NOW() WHERE id = ${orgConfig.id}`
    );
    
    // Log audit event
    await logAuditEvent(db, {
      eventType: 'token_rotated',
      actorType: triggeredBy ? 'user' : 'system',
      actorId: triggeredBy,
      kiishaOrgId,
      grafanaOrgId: orgConfig.grafanaOrgId,
      correlationId,
      details: { tokenId: newToken.id },
    });
    
    await updateJobStatus(db, jobId, 'completed', { tokenId: newToken.id });
    
    return {
      success: true,
      jobId,
      status: 'completed',
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GrafanaJob] Token rotation failed for KIISHA org ${kiishaOrgId}:`, errorMessage);
    
    await updateJobStatus(db, jobId, 'failed', undefined, errorMessage);
    
    return {
      success: false,
      jobId,
      status: 'failed',
      message: errorMessage,
    };
  }
}

// ============================================================================
// Audit Logging
// ============================================================================

interface AuditEvent {
  eventType: string;
  actorType: 'user' | 'portal_user' | 'system' | 'webhook';
  actorId?: number;
  targetType?: string;
  targetId?: string;
  kiishaOrgId?: number;
  grafanaOrgId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

async function logAuditEvent(db: ReturnType<typeof getDb>, event: AuditEvent): Promise<void> {
  await db.execute(
    sql`INSERT INTO grafanaAuditLog (eventType, actorType, actorId, targetType, targetId, kiishaOrgId, grafanaOrgId, details, ipAddress, userAgent, correlationId, createdAt)
        VALUES (${event.eventType}, ${event.actorType}, ${event.actorId || null}, ${event.targetType || null}, ${event.targetId || null}, ${event.kiishaOrgId || null}, ${event.grafanaOrgId || null}, ${event.details ? JSON.stringify(event.details) : null}, ${event.ipAddress || null}, ${event.userAgent || null}, ${event.correlationId || null}, NOW())`
  );
}

// ============================================================================
// Job Queue Helpers
// ============================================================================

/**
 * Get pending jobs for retry
 */
export async function getPendingJobs(limit: number = 10): Promise<Array<{
  id: number;
  jobType: JobType;
  targetType: string;
  targetId: number;
  attemptCount: number;
}>> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT id, jobType, targetType, targetId, attemptCount 
        FROM grafanaProvisioningJobs 
        WHERE status IN ('pending', 'failed') 
          AND attemptCount < 3
          AND (nextRetryAt IS NULL OR nextRetryAt <= NOW())
        ORDER BY createdAt ASC
        LIMIT ${limit}`
  );
  
  return result.rows as Array<{
    id: number;
    jobType: JobType;
    targetType: string;
    targetId: number;
    attemptCount: number;
  }>;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: number): Promise<{
  status: JobStatus;
  resultPayload?: Record<string, unknown>;
  errorMessage?: string;
} | null> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT status, resultPayload, errorMessage FROM grafanaProvisioningJobs WHERE id = ${jobId}`
  );
  
  const rows = result.rows as Array<{ status: JobStatus; resultPayload: string | null; errorMessage: string | null }>;
  if (rows.length === 0) {
    return null;
  }
  
  return {
    status: rows[0].status,
    resultPayload: rows[0].resultPayload ? JSON.parse(rows[0].resultPayload) : undefined,
    errorMessage: rows[0].errorMessage || undefined,
  };
}
