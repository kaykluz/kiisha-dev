/**
 * Grafana Alert Webhook Bridge
 * 
 * Receives Grafana alert notifications and:
 * - Deduplicates using fingerprint-based idempotency
 * - Maps alerts to KIISHA entities (org, project, site, device)
 * - Applies alert policies for routing and actions
 * - Creates KIISHA alerts/notifications
 */

import { createHash, randomUUID } from 'crypto';
import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { Request, Response } from 'express';

// ============================================================================
// Types
// ============================================================================

/**
 * Grafana alert webhook payload structure
 * @see https://grafana.com/docs/grafana/latest/alerting/manage-notifications/webhook-notifier/
 */
export interface GrafanaAlertPayload {
  receiver: string;
  status: 'firing' | 'resolved';
  alerts: GrafanaAlert[];
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  version: string;
  groupKey: string;
  truncatedAlerts: number;
  title?: string;
  state?: string;
  message?: string;
}

export interface GrafanaAlert {
  status: 'firing' | 'resolved';
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
  silenceURL?: string;
  dashboardURL?: string;
  panelURL?: string;
  values?: Record<string, number>;
  valueString?: string;
}

export type AlertAction = 'create_alert' | 'create_notification' | 'create_work_order' | 'ignore' | 'escalate';

export interface AlertPolicyMatch {
  policyId: number;
  action: AlertAction;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notifyOwner: boolean;
  notifyClient: boolean;
  autoCreateWorkOrder: boolean;
}

export interface ProcessedAlert {
  ingestionId: number;
  fingerprint: string;
  status: 'firing' | 'resolved';
  kiishaOrgId: number;
  projectId?: number;
  siteId?: number;
  deviceId?: number;
  alertTitle: string;
  alertMessage: string;
  severity: string;
  policyMatch?: AlertPolicyMatch;
  actions: string[];
}

// ============================================================================
// Webhook Handler
// ============================================================================

/**
 * Express handler for Grafana alert webhooks
 */
export async function handleGrafanaAlertWebhook(req: Request, res: Response): Promise<void> {
  const correlationId = randomUUID();
  const startTime = Date.now();
  
  try {
    // Validate webhook signature if configured
    const signatureValid = await validateWebhookSignature(req);
    if (!signatureValid) {
      console.warn(`[GrafanaAlerts] Invalid webhook signature`, { correlationId });
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
    
    const payload = req.body as GrafanaAlertPayload;
    
    // Validate payload structure
    if (!payload.alerts || !Array.isArray(payload.alerts)) {
      res.status(400).json({ error: 'Invalid payload: missing alerts array' });
      return;
    }
    
    console.log(`[GrafanaAlerts] Received ${payload.alerts.length} alerts`, { 
      correlationId,
      status: payload.status,
      receiver: payload.receiver,
    });
    
    // Process each alert
    const results: ProcessedAlert[] = [];
    
    for (const alert of payload.alerts) {
      try {
        const processed = await processAlert(alert, payload, correlationId);
        if (processed) {
          results.push(processed);
        }
      } catch (error) {
        console.error(`[GrafanaAlerts] Failed to process alert ${alert.fingerprint}:`, error);
        // Continue processing other alerts
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`[GrafanaAlerts] Processed ${results.length}/${payload.alerts.length} alerts in ${duration}ms`, { correlationId });
    
    res.status(200).json({
      success: true,
      processed: results.length,
      total: payload.alerts.length,
      correlationId,
    });
    
  } catch (error) {
    console.error(`[GrafanaAlerts] Webhook handler error:`, error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Alert Processing
// ============================================================================

/**
 * Process a single Grafana alert
 */
async function processAlert(
  alert: GrafanaAlert,
  payload: GrafanaAlertPayload,
  correlationId: string
): Promise<ProcessedAlert | null> {
  const db = getDb();
  
  // Check idempotency using fingerprint
  const existingResult = await db.execute(
    sql`SELECT id, status FROM grafanaAlertIngestions 
        WHERE fingerprint = ${alert.fingerprint} 
        AND status = ${alert.status}
        AND createdAt > NOW() - INTERVAL 1 HOUR`
  );
  
  const existing = existingResult.rows as Array<{ id: number; status: string }>;
  
  if (existing.length > 0) {
    console.log(`[GrafanaAlerts] Duplicate alert ignored: ${alert.fingerprint}`, { correlationId });
    return null;
  }
  
  // Extract KIISHA entity IDs from labels
  const kiishaOrgId = extractOrgId(alert.labels);
  if (!kiishaOrgId) {
    console.warn(`[GrafanaAlerts] Alert missing org_id label: ${alert.fingerprint}`, { correlationId });
    return null;
  }
  
  const projectId = extractNumericLabel(alert.labels, 'project_id');
  const siteId = extractNumericLabel(alert.labels, 'site_id');
  const deviceId = extractNumericLabel(alert.labels, 'device_id');
  
  // Store ingestion record
  const ingestionResult = await db.execute(
    sql`INSERT INTO grafanaAlertIngestions (kiishaOrgId, fingerprint, alertStatus, payloadJson, labels, annotations, startsAt, endsAt, correlationId, createdAt)
        VALUES (${kiishaOrgId}, ${alert.fingerprint}, ${alert.status}, ${JSON.stringify(alert)}, ${JSON.stringify(alert.labels)}, ${JSON.stringify(alert.annotations)}, ${alert.startsAt}, ${alert.endsAt || null}, ${correlationId}, NOW())`
  );
  
  const ingestionId = Number((ingestionResult as { insertId: number }).insertId);
  
  // Build alert title and message
  const alertTitle = alert.annotations.summary || alert.labels.alertname || 'Grafana Alert';
  const alertMessage = alert.annotations.description || alert.valueString || '';
  const severity = alert.labels.severity || 'warning';
  
  // Find matching alert policy
  const policyMatch = await findMatchingPolicy(db, kiishaOrgId, alert, projectId, siteId, deviceId);
  
  // Execute actions based on policy
  const actions: string[] = [];
  
  if (policyMatch) {
    if (policyMatch.action === 'create_alert' || policyMatch.action === 'escalate') {
      await createKiishaAlert(db, {
        kiishaOrgId,
        projectId,
        siteId,
        deviceId,
        title: alertTitle,
        message: alertMessage,
        severity,
        status: alert.status,
        fingerprint: alert.fingerprint,
        grafanaUrl: alert.generatorURL,
      });
      actions.push('created_alert');
    }
    
    if (policyMatch.notifyOwner) {
      await notifyOwner(db, kiishaOrgId, alertTitle, alertMessage, severity);
      actions.push('notified_owner');
    }
    
    if (policyMatch.notifyClient && projectId) {
      await notifyClient(db, kiishaOrgId, projectId, alertTitle, alertMessage);
      actions.push('notified_client');
    }
    
    if (policyMatch.autoCreateWorkOrder && alert.status === 'firing') {
      await createWorkOrderFromAlert(db, {
        kiishaOrgId,
        projectId,
        siteId,
        deviceId,
        title: `Alert: ${alertTitle}`,
        description: alertMessage,
        priority: policyMatch.priority,
      });
      actions.push('created_work_order');
    }
  } else {
    // Default action: create alert
    await createKiishaAlert(db, {
      kiishaOrgId,
      projectId,
      siteId,
      deviceId,
      title: alertTitle,
      message: alertMessage,
      severity,
      status: alert.status,
      fingerprint: alert.fingerprint,
      grafanaUrl: alert.generatorURL,
    });
    actions.push('created_alert_default');
  }
  
  // Update ingestion status
  await db.execute(
    sql`UPDATE grafanaAlertIngestions SET status = 'processed', processedAt = NOW(), actions = ${JSON.stringify(actions)} WHERE id = ${ingestionId}`
  );
  
  // Log audit event
  await logAlertProcessed(db, {
    ingestionId,
    fingerprint: alert.fingerprint,
    kiishaOrgId,
    projectId,
    actions,
    correlationId,
  });
  
  return {
    ingestionId,
    fingerprint: alert.fingerprint,
    status: alert.status,
    kiishaOrgId,
    projectId,
    siteId,
    deviceId,
    alertTitle,
    alertMessage,
    severity,
    policyMatch,
    actions,
  };
}

// ============================================================================
// Policy Matching
// ============================================================================

/**
 * Find matching alert policy for an alert
 */
async function findMatchingPolicy(
  db: ReturnType<typeof getDb>,
  kiishaOrgId: number,
  alert: GrafanaAlert,
  projectId?: number,
  siteId?: number,
  deviceId?: number
): Promise<AlertPolicyMatch | null> {
  // Get all enabled policies for this org, ordered by specificity
  const policiesResult = await db.execute(
    sql`SELECT id, scopeType, scopeId, ruleMatch, action, priority, notifyOwner, notifyClient, autoCreateWorkOrder
        FROM grafanaAlertPolicies
        WHERE kiishaOrgId = ${kiishaOrgId}
          AND enabled = TRUE
        ORDER BY 
          CASE scopeType 
            WHEN 'device' THEN 1
            WHEN 'site' THEN 2
            WHEN 'project' THEN 3
            WHEN 'org' THEN 4
            ELSE 5
          END,
          createdAt DESC`
  );
  
  const policies = policiesResult.rows as Array<{
    id: number;
    scopeType: string;
    scopeId: number | null;
    ruleMatch: string;
    action: AlertAction;
    priority: string;
    notifyOwner: boolean;
    notifyClient: boolean;
    autoCreateWorkOrder: boolean;
  }>;
  
  for (const policy of policies) {
    // Check scope match
    if (!matchesScope(policy.scopeType, policy.scopeId, projectId, siteId, deviceId)) {
      continue;
    }
    
    // Check rule match (JSON pattern matching)
    if (policy.ruleMatch && !matchesRule(policy.ruleMatch, alert)) {
      continue;
    }
    
    return {
      policyId: policy.id,
      action: policy.action,
      priority: policy.priority as 'low' | 'medium' | 'high' | 'critical',
      notifyOwner: policy.notifyOwner,
      notifyClient: policy.notifyClient,
      autoCreateWorkOrder: policy.autoCreateWorkOrder,
    };
  }
  
  return null;
}

/**
 * Check if policy scope matches the alert's entities
 */
function matchesScope(
  scopeType: string,
  scopeId: number | null,
  projectId?: number,
  siteId?: number,
  deviceId?: number
): boolean {
  switch (scopeType) {
    case 'org':
      return true; // Org-level policies match all alerts in the org
    case 'project':
      return scopeId === projectId;
    case 'site':
      return scopeId === siteId;
    case 'device':
      return scopeId === deviceId;
    default:
      return false;
  }
}

/**
 * Check if alert matches the rule pattern
 */
function matchesRule(ruleMatch: string, alert: GrafanaAlert): boolean {
  try {
    const rule = JSON.parse(ruleMatch) as Record<string, string | string[]>;
    
    for (const [key, pattern] of Object.entries(rule)) {
      const labelValue = alert.labels[key];
      
      if (Array.isArray(pattern)) {
        // Match any of the patterns
        if (!pattern.some(p => matchesPattern(labelValue, p))) {
          return false;
        }
      } else {
        if (!matchesPattern(labelValue, pattern)) {
          return false;
        }
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Simple pattern matching (supports * wildcard)
 */
function matchesPattern(value: string | undefined, pattern: string): boolean {
  if (!value) return false;
  if (pattern === '*') return true;
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(value);
  }
  return value === pattern;
}

// ============================================================================
// Action Executors
// ============================================================================

interface KiishaAlertParams {
  kiishaOrgId: number;
  projectId?: number;
  siteId?: number;
  deviceId?: number;
  title: string;
  message: string;
  severity: string;
  status: string;
  fingerprint: string;
  grafanaUrl: string;
}

async function createKiishaAlert(db: ReturnType<typeof getDb>, params: KiishaAlertParams): Promise<void> {
  // Check if alert already exists (for resolved status, update existing)
  if (params.status === 'resolved') {
    await db.execute(
      sql`UPDATE alerts SET status = 'resolved', resolvedAt = NOW() 
          WHERE grafanaFingerprint = ${params.fingerprint} AND status = 'active'`
    );
    return;
  }
  
  // Create new alert
  await db.execute(
    sql`INSERT INTO alerts (organizationId, projectId, siteId, deviceId, title, message, severity, status, grafanaFingerprint, grafanaUrl, createdAt)
        VALUES (${params.kiishaOrgId}, ${params.projectId || null}, ${params.siteId || null}, ${params.deviceId || null}, ${params.title}, ${params.message}, ${params.severity}, 'active', ${params.fingerprint}, ${params.grafanaUrl}, NOW())
        ON DUPLICATE KEY UPDATE updatedAt = NOW()`
  );
}

async function notifyOwner(
  db: ReturnType<typeof getDb>,
  kiishaOrgId: number,
  title: string,
  message: string,
  severity: string
): Promise<void> {
  // Get owner info
  const ownerResult = await db.execute(
    sql`SELECT ownerId FROM organizations WHERE id = ${kiishaOrgId}`
  );
  
  const owners = ownerResult.rows as Array<{ ownerId: number }>;
  if (owners.length === 0) return;
  
  // Create notification (using existing notification system)
  await db.execute(
    sql`INSERT INTO notifications (userId, type, title, message, severity, read, createdAt)
        VALUES (${owners[0].ownerId}, 'alert', ${title}, ${message}, ${severity}, FALSE, NOW())`
  );
}

async function notifyClient(
  db: ReturnType<typeof getDb>,
  kiishaOrgId: number,
  projectId: number,
  title: string,
  message: string
): Promise<void> {
  // Find client accounts with access to this project
  const clientsResult = await db.execute(
    sql`SELECT DISTINCT ca.id FROM clientAccounts ca
        JOIN clientScopeGrants csg ON ca.id = csg.clientAccountId
        WHERE csg.grantType = 'PROJECT' AND csg.targetId = ${projectId}`
  );
  
  const clients = clientsResult.rows as Array<{ id: number }>;
  
  for (const client of clients) {
    await db.execute(
      sql`INSERT INTO portalNotifications (clientAccountId, type, title, message, read, createdAt)
          VALUES (${client.id}, 'alert', ${title}, ${message}, FALSE, NOW())`
    );
  }
}

interface WorkOrderParams {
  kiishaOrgId: number;
  projectId?: number;
  siteId?: number;
  deviceId?: number;
  title: string;
  description: string;
  priority: string;
}

async function createWorkOrderFromAlert(db: ReturnType<typeof getDb>, params: WorkOrderParams): Promise<void> {
  await db.execute(
    sql`INSERT INTO workOrders (organizationId, projectId, siteId, deviceId, title, description, priority, status, source, createdAt)
        VALUES (${params.kiishaOrgId}, ${params.projectId || null}, ${params.siteId || null}, ${params.deviceId || null}, ${params.title}, ${params.description}, ${params.priority}, 'open', 'grafana_alert', NOW())`
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function extractOrgId(labels: Record<string, string>): number | null {
  const orgId = labels.org_id || labels.kiisha_org_id || labels.organization_id;
  return orgId ? parseInt(orgId, 10) : null;
}

function extractNumericLabel(labels: Record<string, string>, key: string): number | undefined {
  const value = labels[key];
  return value ? parseInt(value, 10) : undefined;
}

async function validateWebhookSignature(req: Request): Promise<boolean> {
  const signature = req.headers['x-grafana-signature'] as string;
  const webhookSecret = process.env.GRAFANA_WEBHOOK_SECRET;
  
  // If no secret configured, skip validation (not recommended for production)
  if (!webhookSecret) {
    return true;
  }
  
  if (!signature) {
    return false;
  }
  
  // Validate HMAC signature
  const expectedSignature = createHash('sha256')
    .update(JSON.stringify(req.body) + webhookSecret)
    .digest('hex');
  
  return signature === expectedSignature;
}

async function logAlertProcessed(
  db: ReturnType<typeof getDb>,
  details: {
    ingestionId: number;
    fingerprint: string;
    kiishaOrgId: number;
    projectId?: number;
    actions: string[];
    correlationId: string;
  }
): Promise<void> {
  await db.execute(
    sql`INSERT INTO grafanaAuditLog (eventType, actorType, targetType, targetId, kiishaOrgId, details, correlationId, createdAt)
        VALUES ('alert_processed', 'webhook', 'alert_ingestion', ${String(details.ingestionId)}, ${details.kiishaOrgId}, ${JSON.stringify(details)}, ${details.correlationId}, NOW())`
  );
}

// ============================================================================
// Alert Policy Management
// ============================================================================

export interface CreateAlertPolicyParams {
  kiishaOrgId: number;
  scopeType: 'org' | 'project' | 'site' | 'device';
  scopeId?: number;
  ruleMatch?: Record<string, string | string[]>;
  action: AlertAction;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  notifyOwner?: boolean;
  notifyClient?: boolean;
  autoCreateWorkOrder?: boolean;
  createdBy: number;
}

export async function createAlertPolicy(params: CreateAlertPolicyParams): Promise<number> {
  const db = getDb();
  
  const result = await db.execute(
    sql`INSERT INTO grafanaAlertPolicies (kiishaOrgId, scopeType, scopeId, ruleMatch, action, priority, notifyOwner, notifyClient, autoCreateWorkOrder, enabled, createdBy, createdAt)
        VALUES (${params.kiishaOrgId}, ${params.scopeType}, ${params.scopeId || null}, ${params.ruleMatch ? JSON.stringify(params.ruleMatch) : null}, ${params.action}, ${params.priority || 'medium'}, ${params.notifyOwner ?? false}, ${params.notifyClient ?? false}, ${params.autoCreateWorkOrder ?? false}, TRUE, ${params.createdBy}, NOW())`
  );
  
  return Number((result as { insertId: number }).insertId);
}

export async function updateAlertPolicy(
  policyId: number,
  updates: Partial<Omit<CreateAlertPolicyParams, 'kiishaOrgId' | 'createdBy'>>
): Promise<void> {
  const db = getDb();
  
  const setClauses: string[] = [];
  const values: unknown[] = [];
  
  if (updates.scopeType !== undefined) {
    setClauses.push('scopeType = ?');
    values.push(updates.scopeType);
  }
  if (updates.scopeId !== undefined) {
    setClauses.push('scopeId = ?');
    values.push(updates.scopeId);
  }
  if (updates.ruleMatch !== undefined) {
    setClauses.push('ruleMatch = ?');
    values.push(JSON.stringify(updates.ruleMatch));
  }
  if (updates.action !== undefined) {
    setClauses.push('action = ?');
    values.push(updates.action);
  }
  if (updates.priority !== undefined) {
    setClauses.push('priority = ?');
    values.push(updates.priority);
  }
  if (updates.notifyOwner !== undefined) {
    setClauses.push('notifyOwner = ?');
    values.push(updates.notifyOwner);
  }
  if (updates.notifyClient !== undefined) {
    setClauses.push('notifyClient = ?');
    values.push(updates.notifyClient);
  }
  if (updates.autoCreateWorkOrder !== undefined) {
    setClauses.push('autoCreateWorkOrder = ?');
    values.push(updates.autoCreateWorkOrder);
  }
  
  if (setClauses.length === 0) return;
  
  setClauses.push('updatedAt = NOW()');
  
  await db.execute(
    sql`UPDATE grafanaAlertPolicies SET ${sql.raw(setClauses.join(', '))} WHERE id = ${policyId}`
  );
}

export async function deleteAlertPolicy(policyId: number): Promise<void> {
  const db = getDb();
  await db.execute(sql`DELETE FROM grafanaAlertPolicies WHERE id = ${policyId}`);
}

export async function toggleAlertPolicy(policyId: number, enabled: boolean): Promise<void> {
  const db = getDb();
  await db.execute(sql`UPDATE grafanaAlertPolicies SET enabled = ${enabled}, updatedAt = NOW() WHERE id = ${policyId}`);
}
