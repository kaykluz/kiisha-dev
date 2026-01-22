# KIISHA Environment Variables Contract

**Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** Production Ready

---

## Overview

This document defines the complete contract for all environment variables used by KIISHA. Each variable is documented with its format, usage location, failure mode, and whether it is required or optional.

---

## Variable Categories

| Category | Count | Description |
|----------|-------|-------------|
| **System (Manus Platform)** | 11 | Auto-injected by platform, do not modify |
| **Application Config** | 3 | Customizable via Settings panel |
| **Feature Flags** | 7 | Enable/disable specific features |
| **External Integrations** | 5 | Required only if corresponding feature enabled |

---

## System Variables (Manus Platform)

These variables are automatically injected by the Manus hosting platform. They should not be manually configured or modified.

| Variable | Type | Format | Usage Location | Failure Mode |
|----------|------|--------|----------------|--------------|
| `DATABASE_URL` | Required | `mysql://user:pass@host:port/db?ssl=true` | `server/_core/db.ts` | Application fails to start; database operations throw errors |
| `JWT_SECRET` | Required | 256-bit hex string (64 chars) | `server/_core/auth.ts` | Authentication fails; sessions cannot be created or verified |
| `VITE_APP_ID` | Required | UUID format | `client/src/const.ts` | OAuth login button fails; users cannot authenticate via Manus |
| `OAUTH_SERVER_URL` | Required | URL (e.g., `https://api.manus.im`) | `server/_core/oauth.ts` | OAuth token exchange fails; login flow breaks |
| `VITE_OAUTH_PORTAL_URL` | Required | URL (e.g., `https://manus.im/oauth`) | `client/src/const.ts` | OAuth redirect fails; login button opens wrong URL |
| `OWNER_OPEN_ID` | Required | String | `server/_core/notification.ts` | Owner notifications fail silently |
| `OWNER_NAME` | Required | String | `server/_core/notification.ts` | Cosmetic only; notifications show empty name |
| `BUILT_IN_FORGE_API_URL` | Required | URL | `server/_core/llm.ts`, `server/storage.ts` | AI categorization fails; file uploads fail |
| `BUILT_IN_FORGE_API_KEY` | Required | Bearer token | `server/_core/llm.ts`, `server/storage.ts` | Server-side AI/storage operations fail with 401 |
| `VITE_FRONTEND_FORGE_API_KEY` | Required | Bearer token | `client/src/lib/api.ts` | Frontend AI features fail |
| `VITE_FRONTEND_FORGE_API_URL` | Required | URL | `client/src/lib/api.ts` | Frontend API calls fail |

---

## Application Configuration Variables

These variables can be customized via the Manus Management UI → Settings → Secrets panel.

| Variable | Type | Format | Default | Usage Location | Failure Mode |
|----------|------|--------|---------|----------------|--------------|
| `VITE_APP_TITLE` | Optional | String | "KIISHA" | `client/index.html`, UI headers | Shows default title |
| `VITE_APP_LOGO` | Optional | URL to image | Platform default | `client/src/components/AppLayout.tsx` | Shows default logo |
| `NODE_ENV` | Optional | "development" \| "production" | "production" | Server startup | Affects logging verbosity and error details |

---

## Feature Flag Variables

These variables control feature availability. All default to `false` unless explicitly set to `"true"`.

| Variable | Type | Default | Required Dependencies | Usage Location | When Disabled |
|----------|------|---------|----------------------|----------------|---------------|
| `FEATURE_EMAIL_INGESTION` | Optional | `"false"` | `SENDGRID_WEBHOOK_SECRET` | `server/routes/ingest.ts`, `shared/featureFlags.ts` | Email ingestion endpoint returns 501; Admin Ingest hides Email tab |
| `FEATURE_WHATSAPP` | Optional | `"false"` | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` | `server/routes/ingest.ts`, `shared/featureFlags.ts` | WhatsApp webhook returns 501; Admin Ingest hides WhatsApp tab |
| `FEATURE_LINKING` | Optional | `"false"` | None | `shared/featureFlags.ts`, `client/src/pages/Workspace.tsx` | Link buttons show disabled with tooltip |
| `FEATURE_EXPORT_DD_PACK` | Optional | `"false"` | None | `shared/featureFlags.ts` | DD Pack export button disabled |
| `FEATURE_VATR_EDIT` | Optional | `"false"` | None | `shared/featureFlags.ts` | VATR edit buttons disabled |
| `FEATURE_ENTITY_RESOLUTION` | Optional | `"false"` | None | `shared/featureFlags.ts` | Entity resolution UI hidden |
| `FEATURE_TWO_FA_DISABLE` | Optional | `"false"` | None | `shared/featureFlags.ts`, `client/src/pages/Profile.tsx` | 2FA disable button shows "contact admin" message |

---

## External Integration Variables

These variables are required only when the corresponding feature flag is enabled.

| Variable | Type | Format | Required When | Usage Location | Failure Mode |
|----------|------|--------|---------------|----------------|--------------|
| `SENDGRID_WEBHOOK_SECRET` | Conditional | String (webhook signing key) | `FEATURE_EMAIL_INGESTION=true` | `server/routes/ingest.ts` | Email webhooks rejected with 401 |
| `WHATSAPP_VERIFY_TOKEN` | Conditional | String (you generate) | `FEATURE_WHATSAPP=true` | `server/routes/ingest.ts` | WhatsApp webhook verification fails |
| `WHATSAPP_ACCESS_TOKEN` | Conditional | String (Meta API token) | `FEATURE_WHATSAPP=true` | `server/routes/ingest.ts` | WhatsApp API calls fail with 401 |
| `WHATSAPP_PHONE_NUMBER_ID` | Conditional | Numeric string | `FEATURE_WHATSAPP=true` | `server/routes/ingest.ts` | WhatsApp messages cannot be sent |
| `SENTRY_DSN` | Optional | URL (e.g., `https://xxx@sentry.io/xxx`) | Recommended for production | `server/_core/index.ts` | Errors logged locally only, no remote tracking |

---

## Variable Validation

The application validates required variables at startup. If validation fails, the application will not start and will log an error message indicating which variables are missing.

### Validation Logic

```typescript
// server/_core/env.ts
const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'VITE_APP_ID',
  'OAUTH_SERVER_URL',
  'BUILT_IN_FORGE_API_URL',
  'BUILT_IN_FORGE_API_KEY',
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}
```

### Conditional Validation

Feature-specific variables are validated only when the feature is enabled:

```typescript
if (process.env.FEATURE_EMAIL_INGESTION === 'true') {
  if (!process.env.SENDGRID_WEBHOOK_SECRET) {
    console.error('SENDGRID_WEBHOOK_SECRET required when FEATURE_EMAIL_INGESTION is enabled');
    process.exit(1);
  }
}
```

---

## Setting Variables

### Via Manus Management UI

1. Open the Management UI for your KIISHA deployment
2. Navigate to Settings → Secrets
3. Click "Add Secret" or edit existing
4. Enter the variable name and value
5. Click Save
6. Restart the application for changes to take effect

### Via Environment File (Development Only)

For local development, create a `.env` file in the project root:

```bash
# .env (DO NOT COMMIT)
DATABASE_URL=mysql://user:pass@localhost:3306/kiisha
JWT_SECRET=your-256-bit-secret-here
FEATURE_LINKING=true
```

---

## Security Considerations

1. **Never commit secrets to version control** - The `.env` file is in `.gitignore`
2. **Use strong secrets** - JWT_SECRET should be at least 256 bits of entropy
3. **Rotate secrets regularly** - See rotation schedule in PILOT_PROVISIONING.md
4. **Audit access** - Track who has access to production secrets
5. **Use separate secrets per environment** - Staging and production should have different secrets

---

## Troubleshooting

### Application Won't Start

Check the server logs for messages like:
```
Missing required environment variable: DATABASE_URL
```

Ensure all required variables are set in the Manus Secrets panel.

### OAuth Login Fails

Verify these variables are set correctly:
- `VITE_APP_ID` - Must match your Manus OAuth application
- `OAUTH_SERVER_URL` - Must be `https://api.manus.im`
- `VITE_OAUTH_PORTAL_URL` - Must be `https://manus.im/oauth`

### AI Features Not Working

Verify these variables are set:
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`

Check server logs for 401 errors indicating invalid API key.

### Feature Appears Disabled

If a feature button is grayed out:
1. Check if the feature flag is enabled (`FEATURE_*=true`)
2. Check if required dependencies are set
3. Restart the application after changing environment variables

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-15 | Manus AI | Initial contract document |
