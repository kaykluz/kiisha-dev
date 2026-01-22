/**
 * Portal-Safe Grafana Embedding
 * 
 * Provides secure embedding of Grafana dashboards in the customer portal:
 * - TTL tokens (5-15 minutes) for time-limited access
 * - Token hashing (only hashes stored in DB)
 * - Scope validation against portal user's allowed projects
 * - Proxy endpoint to prevent direct Grafana access
 */

import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { resolvePortalScopeFromLegacy } from '../helpers/portalScopeResolver';

// ============================================================================
// Types
// ============================================================================

export interface EmbedTokenRequest {
  /** Portal user ID (from customerUsers) */
  portalUserId: number;
  /** Customer ID */
  customerId: number;
  /** Dashboard UID to embed */
  dashboardUid: string;
  /** Optional panel ID for single panel embed */
  panelId?: number;
  /** TTL in seconds (default 15 minutes, max 60 minutes) */
  ttlSeconds?: number;
  /** Theme preference */
  theme?: 'light' | 'dark';
  /** Time range */
  from?: string;
  to?: string;
}

export interface EmbedToken {
  /** The token to use in embed URL */
  token: string;
  /** Embed URL with token */
  embedUrl: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Dashboard UID */
  dashboardUid: string;
  /** Panel ID if specified */
  panelId?: number;
}

export interface TokenValidationResult {
  valid: boolean;
  expired?: boolean;
  dashboardUid?: string;
  panelId?: number;
  scopePayload?: Record<string, unknown>;
  grafanaOrgId?: number;
  grafanaBaseUrl?: string;
  theme?: string;
  from?: string;
  to?: string;
  errorMessage?: string;
}

// ============================================================================
// Token Generation
// ============================================================================

const MIN_TTL_SECONDS = 60; // 1 minute
const MAX_TTL_SECONDS = 3600; // 60 minutes
const DEFAULT_TTL_SECONDS = 900; // 15 minutes

/**
 * Generate a secure embed token for a portal user
 */
export async function generateEmbedToken(request: EmbedTokenRequest): Promise<EmbedToken> {
  const db = getDb();
  
  // Validate TTL
  const ttl = Math.max(MIN_TTL_SECONDS, Math.min(MAX_TTL_SECONDS, request.ttlSeconds || DEFAULT_TTL_SECONDS));
  
  // Resolve portal scope to validate access
  const scope = await resolvePortalScopeFromLegacy(request.customerId, request.portalUserId);
  
  if (!scope) {
    throw new Error('Invalid portal user or customer');
  }
  
  // Verify the dashboard is bound to this client
  const dashboardResult = await db.execute(
    sql`SELECT gd.id, gd.dashboardUid, gdb.scopePayload, go.grafanaOrgId, go.kiishaOrgId, gi.baseUrl
        FROM grafanaDashboards gd
        JOIN grafanaDashboardBindings gdb ON gd.id = gdb.dashboardId
        JOIN grafanaOrgs go ON gd.grafanaOrgsId = go.id
        JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
        WHERE gd.dashboardUid = ${request.dashboardUid}
          AND gdb.bindingType = 'client_account'
          AND gdb.bindingId = ${request.customerId}`
  );
  
  const dashboards = dashboardResult.rows as Array<{
    id: number;
    dashboardUid: string;
    scopePayload: string;
    grafanaOrgId: number;
    kiishaOrgId: number;
    baseUrl: string;
  }>;
  
  if (dashboards.length === 0) {
    throw new Error('Dashboard not found or not accessible to this client');
  }
  
  const dashboard = dashboards[0];
  
  // Verify org access
  if (!scope.allowedOrgIds.includes(dashboard.kiishaOrgId)) {
    throw new Error('Dashboard organization not accessible to this client');
  }
  
  // Generate secure token
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  
  // Calculate expiration
  const expiresAt = new Date(Date.now() + ttl * 1000);
  
  // Build scope payload for token
  const tokenScopePayload = {
    allowedProjectIds: scope.allowedProjectIds,
    theme: request.theme || 'light',
    from: request.from || 'now-24h',
    to: request.to || 'now',
    panelId: request.panelId,
  };
  
  // Store token hash (not the raw token)
  await db.execute(
    sql`INSERT INTO grafanaEmbedTokens (tokenHash, dashboardUid, subjectType, subjectId, expiresAt, scopePayload, panelId, createdAt)
        VALUES (${tokenHash}, ${request.dashboardUid}, 'portal_user', ${request.portalUserId}, ${expiresAt}, ${JSON.stringify(tokenScopePayload)}, ${request.panelId || null}, NOW())`
  );
  
  // Log audit event
  await logEmbedTokenCreated(db, {
    portalUserId: request.portalUserId,
    customerId: request.customerId,
    dashboardUid: request.dashboardUid,
    expiresAt,
  });
  
  // Build embed URL
  const embedUrl = buildEmbedUrl(rawToken, request.dashboardUid, request.panelId);
  
  return {
    token: rawToken,
    embedUrl,
    expiresAt,
    dashboardUid: request.dashboardUid,
    panelId: request.panelId,
  };
}

/**
 * Hash a token for storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Build the embed URL with token
 */
function buildEmbedUrl(token: string, dashboardUid: string, panelId?: number): string {
  const basePath = panelId 
    ? `/api/portal/grafana/embed/${dashboardUid}/panel/${panelId}`
    : `/api/portal/grafana/embed/${dashboardUid}`;
  
  return `${basePath}?token=${encodeURIComponent(token)}`;
}

// ============================================================================
// Token Validation
// ============================================================================

/**
 * Validate an embed token
 */
export async function validateEmbedToken(token: string): Promise<TokenValidationResult> {
  const db = getDb();
  const tokenHash = hashToken(token);
  
  // Look up token
  const tokenResult = await db.execute(
    sql`SELECT get.id, get.dashboardUid, get.subjectType, get.subjectId, get.expiresAt, get.scopePayload, get.panelId, get.usedAt,
               go.grafanaOrgId, gi.baseUrl
        FROM grafanaEmbedTokens get
        JOIN grafanaDashboards gd ON get.dashboardUid = gd.dashboardUid
        JOIN grafanaOrgs go ON gd.grafanaOrgsId = go.id
        JOIN grafanaInstances gi ON go.grafanaInstanceId = gi.id
        WHERE get.tokenHash = ${tokenHash}`
  );
  
  const tokens = tokenResult.rows as Array<{
    id: number;
    dashboardUid: string;
    subjectType: string;
    subjectId: number;
    expiresAt: Date;
    scopePayload: string;
    panelId: number | null;
    usedAt: Date | null;
    grafanaOrgId: number;
    baseUrl: string;
  }>;
  
  if (tokens.length === 0) {
    return {
      valid: false,
      errorMessage: 'Token not found',
    };
  }
  
  const tokenRecord = tokens[0];
  
  // Check expiration
  if (new Date(tokenRecord.expiresAt) < new Date()) {
    // Log expired token usage attempt
    await logEmbedTokenExpired(db, tokenRecord.id);
    
    return {
      valid: false,
      expired: true,
      errorMessage: 'Token has expired',
    };
  }
  
  // Mark token as used (for audit)
  if (!tokenRecord.usedAt) {
    await db.execute(
      sql`UPDATE grafanaEmbedTokens SET usedAt = NOW() WHERE id = ${tokenRecord.id}`
    );
    
    await logEmbedTokenUsed(db, tokenRecord.id);
  }
  
  const scopePayload = JSON.parse(tokenRecord.scopePayload);
  
  return {
    valid: true,
    dashboardUid: tokenRecord.dashboardUid,
    panelId: tokenRecord.panelId || undefined,
    scopePayload,
    grafanaOrgId: tokenRecord.grafanaOrgId,
    grafanaBaseUrl: tokenRecord.baseUrl,
    theme: scopePayload.theme,
    from: scopePayload.from,
    to: scopePayload.to,
  };
}

// ============================================================================
// Proxy Request Builder
// ============================================================================

export interface ProxyRequest {
  /** Target Grafana URL */
  targetUrl: string;
  /** Headers to forward */
  headers: Record<string, string>;
  /** Query parameters */
  queryParams: Record<string, string>;
}

/**
 * Build a proxy request to Grafana
 */
export async function buildProxyRequest(
  token: string,
  path: string
): Promise<ProxyRequest | null> {
  const validation = await validateEmbedToken(token);
  
  if (!validation.valid) {
    return null;
  }
  
  const db = getDb();
  
  // Get service account token for this org
  const orgResult = await db.execute(
    sql`SELECT serviceAccountToken FROM grafanaOrgs WHERE grafanaOrgId = ${validation.grafanaOrgId}`
  );
  
  const orgs = orgResult.rows as Array<{ serviceAccountToken: string }>;
  if (orgs.length === 0) {
    return null;
  }
  
  // Build query params with scope variables
  const queryParams: Record<string, string> = {
    'var-org_id': String(validation.scopePayload?.orgId || ''),
    'var-allowed_project_ids': (validation.scopePayload?.allowedProjectIds || []).join(','),
    theme: validation.theme || 'light',
    from: validation.from || 'now-24h',
    to: validation.to || 'now',
  };
  
  if (validation.panelId) {
    queryParams.panelId = String(validation.panelId);
  }
  
  return {
    targetUrl: `${validation.grafanaBaseUrl}${path}`,
    headers: {
      'Authorization': `Bearer ${orgs[0].serviceAccountToken}`,
      'X-Grafana-Org-Id': String(validation.grafanaOrgId),
    },
    queryParams,
  };
}

// ============================================================================
// Token Cleanup
// ============================================================================

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const db = getDb();
  
  const result = await db.execute(
    sql`DELETE FROM grafanaEmbedTokens WHERE expiresAt < NOW() - INTERVAL 1 DAY`
  );
  
  return (result as { affectedRows: number }).affectedRows || 0;
}

/**
 * Revoke all tokens for a portal user
 */
export async function revokeUserTokens(portalUserId: number): Promise<number> {
  const db = getDb();
  
  const result = await db.execute(
    sql`DELETE FROM grafanaEmbedTokens WHERE subjectType = 'portal_user' AND subjectId = ${portalUserId}`
  );
  
  return (result as { affectedRows: number }).affectedRows || 0;
}

/**
 * Revoke all tokens for a dashboard
 */
export async function revokeDashboardTokens(dashboardUid: string): Promise<number> {
  const db = getDb();
  
  const result = await db.execute(
    sql`DELETE FROM grafanaEmbedTokens WHERE dashboardUid = ${dashboardUid}`
  );
  
  return (result as { affectedRows: number }).affectedRows || 0;
}

// ============================================================================
// Audit Logging
// ============================================================================

async function logEmbedTokenCreated(
  db: ReturnType<typeof getDb>,
  details: { portalUserId: number; customerId: number; dashboardUid: string; expiresAt: Date }
): Promise<void> {
  await db.execute(
    sql`INSERT INTO grafanaAuditLog (eventType, actorType, actorId, targetType, targetId, details, createdAt)
        VALUES ('embed_token_created', 'portal_user', ${details.portalUserId}, 'dashboard', ${details.dashboardUid}, ${JSON.stringify(details)}, NOW())`
  );
}

async function logEmbedTokenUsed(db: ReturnType<typeof getDb>, tokenId: number): Promise<void> {
  await db.execute(
    sql`INSERT INTO grafanaAuditLog (eventType, actorType, targetType, targetId, createdAt)
        VALUES ('embed_token_used', 'system', 'embed_token', ${String(tokenId)}, NOW())`
  );
}

async function logEmbedTokenExpired(db: ReturnType<typeof getDb>, tokenId: number): Promise<void> {
  await db.execute(
    sql`INSERT INTO grafanaAuditLog (eventType, actorType, targetType, targetId, createdAt)
        VALUES ('embed_token_expired', 'system', 'embed_token', ${String(tokenId)}, NOW())`
  );
}

// ============================================================================
// Express Route Handlers
// ============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware to validate embed token
 */
export function validateEmbedTokenMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.query.token as string;
    
    if (!token) {
      return res.status(401).json({ error: 'Missing embed token' });
    }
    
    const validation = await validateEmbedToken(token);
    
    if (!validation.valid) {
      return res.status(401).json({ 
        error: validation.errorMessage,
        expired: validation.expired,
      });
    }
    
    // Attach validation result to request
    (req as any).embedValidation = validation;
    next();
  };
}

/**
 * Express handler for embed iframe
 */
export async function handleEmbedRequest(req: Request, res: Response): Promise<void> {
  const validation = (req as any).embedValidation as TokenValidationResult;
  
  if (!validation || !validation.valid) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  
  // Build Grafana embed URL
  const panelPath = validation.panelId 
    ? `/d-solo/${validation.dashboardUid}`
    : `/d/${validation.dashboardUid}`;
  
  const params = new URLSearchParams({
    'var-org_id': String(validation.scopePayload?.orgId || ''),
    'var-allowed_project_ids': (validation.scopePayload?.allowedProjectIds || []).join(','),
    theme: validation.theme || 'light',
    from: validation.from || 'now-24h',
    to: validation.to || 'now',
    kiosk: 'tv', // Hide Grafana UI chrome
  });
  
  if (validation.panelId) {
    params.set('panelId', String(validation.panelId));
  }
  
  const grafanaUrl = `${validation.grafanaBaseUrl}${panelPath}?${params.toString()}`;
  
  // Return HTML page with iframe
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <iframe src="${grafanaUrl}" allowfullscreen></iframe>
</body>
</html>
  `.trim();
  
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.send(html);
}

/**
 * Express handler for proxy requests
 */
export async function handleProxyRequest(req: Request, res: Response): Promise<void> {
  const token = req.query.token as string;
  const path = req.params[0] || '';
  
  const proxyRequest = await buildProxyRequest(token, `/api/${path}`);
  
  if (!proxyRequest) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  
  try {
    // Build URL with query params
    const url = new URL(proxyRequest.targetUrl);
    for (const [key, value] of Object.entries(proxyRequest.queryParams)) {
      url.searchParams.set(key, value);
    }
    
    // Forward request to Grafana
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: proxyRequest.headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    // Forward response
    res.status(response.status);
    
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    const body = await response.text();
    res.send(body);
    
  } catch (error) {
    console.error('[GrafanaProxy] Request failed:', error);
    res.status(502).json({ error: 'Proxy request failed' });
  }
}
