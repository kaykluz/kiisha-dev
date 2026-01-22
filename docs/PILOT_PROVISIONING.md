# KIISHA Pilot Provisioning Guide

**Version:** 1.0
**Last Updated:** 2026-01-15
**Target:** Production Pilot with Real Users

---

## 1. Provider Selection Summary

| Category | Provider | Status | Provisioning Required |
|----------|----------|--------|----------------------|
| **Auth** | Manus OAuth (primary) + Local email/password | ✅ Ready | None - already integrated |
| **Database** | TiDB (MySQL-compatible) | ✅ Ready | None - already provisioned |
| **File Storage** | S3 via Manus Forge API | ✅ Ready | None - already integrated |
| **LLM/AI** | Manus Forge LLM API | ✅ Ready | None - already integrated |
| **Email Ingestion** | SendGrid Inbound Parse | 🔧 Needs Setup | See Section 2.1 |
| **WhatsApp** | Meta Cloud API | 🔧 Needs Setup | See Section 2.2 |
| **Error Monitoring** | Sentry | 🔧 Needs Setup | See Section 2.3 |
| **Logging** | Built-in (pino) | ✅ Ready | None |

---

## 2. External Dependency Provisioning Checklists

### 2.1 SendGrid Email Ingestion

**What Must Be Created:**
1. SendGrid account (if not existing)
2. Inbound Parse webhook configuration
3. Domain verification for receiving emails
4. MX records for ingest subdomain

**Required Configuration:**

| Setting | Value | Notes |
|---------|-------|-------|
| Inbound Parse URL | `https://your-domain.com/api/webhooks/email` | Must be HTTPS |
| Hostname | `ingest.kiisha.com` or subdomain | Receives forwarded emails |
| Spam Check | Enabled | Filter spam before processing |
| Send Raw | Enabled | Get full email with attachments |

**Required DNS Records:**
```
MX  ingest.kiisha.com  mx.sendgrid.net  10
```

**Required Permissions:**
- Inbound Parse: Full Access
- Mail Send: Not required for ingestion

**Validation Steps:**
1. Send test email to `test@ingest.kiisha.com`
2. Check webhook receives POST request
3. Verify attachment extraction works
4. Confirm artifact created in database

**Expected Result:** Email appears in Artifact Hub within 30 seconds

---

### 2.2 Meta WhatsApp Cloud API

**What Must Be Created:**
1. Meta Business Account
2. WhatsApp Business App
3. Phone number registration
4. Webhook configuration

**Required Configuration:**

| Setting | Value | Notes |
|---------|-------|-------|
| Webhook URL | `https://your-domain.com/api/webhooks/whatsapp` | Must be HTTPS |
| Verify Token | Random string (you generate) | Used for webhook verification |
| Webhook Fields | `messages` | Subscribe to message events |
| Phone Number | Business phone | Must be verified |

**Required Permissions:**
- `whatsapp_business_messaging`
- `whatsapp_business_management`

**Validation Steps:**
1. Complete Meta webhook verification challenge
2. Send test message to business number
3. Verify webhook receives message event
4. Confirm artifact created in database

**Expected Result:** WhatsApp message appears in Artifact Hub within 10 seconds

---

### 2.3 Sentry Error Monitoring

**What Must Be Created:**
1. Sentry organization (if not existing)
2. Sentry project for KIISHA
3. DSN (Data Source Name)

**Required Configuration:**

| Setting | Value | Notes |
|---------|-------|-------|
| Platform | Node.js | Backend errors |
| Platform | React | Frontend errors |
| Environment | `production` / `staging` | Separate tracking |
| Sample Rate | 1.0 (100%) | For pilot, capture all errors |

**Required Permissions:**
- Project: Admin (for setup)
- Runtime: Write (for error reporting)

**Validation Steps:**
1. Trigger intentional error in staging
2. Verify error appears in Sentry dashboard
3. Confirm source maps work for stack traces
4. Test alert notifications

**Expected Result:** Errors appear in Sentry within 5 seconds with full context

---

## 3. Environment Variables Contract

### 3.1 Required Variables (Pilot Will Not Start Without These)

| Variable | Format | Where Used | Failure Mode |
|----------|--------|------------|--------------|
| `DATABASE_URL` | `mysql://user:pass@host:port/db?ssl=true` | `server/_core/db.ts` | App crashes on startup |
| `JWT_SECRET` | 32+ char random string | `server/_core/auth.ts` | Auth fails |
| `VITE_APP_ID` | UUID | OAuth flow | Login fails |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | OAuth flow | Login fails |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im/oauth` | Login redirect | Login fails |
| `BUILT_IN_FORGE_API_URL` | `https://forge.manus.ai/v1` | LLM, Storage | AI/Storage fails |
| `BUILT_IN_FORGE_API_KEY` | Bearer token | Server-side API calls | AI/Storage fails |

### 3.2 Optional Variables (Features Degrade Gracefully)

| Variable | Format | Where Used | Failure Mode |
|----------|--------|------------|--------------|
| `SENDGRID_WEBHOOK_SECRET` | Random string | Email ingestion | Email ingestion disabled |
| `WHATSAPP_VERIFY_TOKEN` | Random string | WhatsApp webhook | WhatsApp disabled |
| `WHATSAPP_ACCESS_TOKEN` | Meta API token | WhatsApp API | WhatsApp disabled |
| `WHATSAPP_PHONE_NUMBER_ID` | Numeric ID | WhatsApp API | WhatsApp disabled |
| `SENTRY_DSN` | `https://xxx@sentry.io/xxx` | Error tracking | No error monitoring |
| `VITE_SENTRY_DSN` | Same as above | Frontend errors | No frontend monitoring |

### 3.3 Feature Flag Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FEATURE_EMAIL_INGESTION` | `false` | Enable live email ingestion |
| `FEATURE_WHATSAPP` | `false` | Enable live WhatsApp integration |
| `FEATURE_LINKING` | `false` | Enable RFI-to-document linking |
| `FEATURE_EXPORT_DD_PACK` | `false` | Enable due diligence pack export |

---

## 4. Secrets Handling Approach

### 4.1 Rules
1. **No secrets in code** - All secrets via environment variables
2. **No secrets in git** - `.env` files in `.gitignore`
3. **Separate environments** - Different secrets for staging/production
4. **Least privilege** - Each service gets only required permissions

### 4.2 Secret Injection Methods

| Platform | Method | Notes |
|----------|--------|-------|
| Manus Hosting | Settings → Secrets panel | Preferred for Manus deployment |
| Vercel | Environment Variables | Encrypted at rest |
| AWS | Secrets Manager / Parameter Store | With IAM roles |
| Docker | Docker secrets / env files | For self-hosted |

### 4.3 Key Rotation Instructions

| Secret | Rotation Frequency | Rotation Steps |
|--------|-------------------|----------------|
| `JWT_SECRET` | 90 days | 1. Generate new secret 2. Deploy with new secret 3. Old sessions invalidate |
| `SENDGRID_WEBHOOK_SECRET` | On compromise | 1. Generate new in SendGrid 2. Update env var 3. Redeploy |
| `WHATSAPP_ACCESS_TOKEN` | 60 days (Meta policy) | 1. Refresh in Meta dashboard 2. Update env var |
| `SENTRY_DSN` | Never (unless compromised) | 1. Regenerate in Sentry 2. Update env var |

---

## 5. Feature Flags and Defaults

### 5.1 Pilot Launch Defaults

```typescript
// shared/featureFlags.ts
export const PILOT_FLAGS = {
  // Core Features - ENABLED
  AUTH_LOCAL: true,           // Email/password login
  AUTH_OAUTH: true,           // Manus OAuth login
  DOCUMENT_UPLOAD: true,      // Document upload to S3
  AI_CATEGORIZATION: true,    // AI document categorization
  COMMENTS: true,             // Threaded comments
  WORKSPACE_CRUD: true,       // RFI create/edit/delete
  CHECKLIST_CRUD: true,       // Checklist management
  
  // Advanced Features - DISABLED (need provisioning)
  EMAIL_INGESTION: false,     // Requires SendGrid setup
  WHATSAPP_INGESTION: false,  // Requires Meta setup
  LINKING_ENGINE: false,      // Needs completion
  EXPORT_DD_PACK: false,      // Needs completion
  VATR_EDIT: false,           // Needs completion
  ENTITY_RESOLUTION: false,   // Needs completion
  TWO_FA_DISABLE: false,      // Needs completion
};
```

### 5.2 Feature Flag UI Behavior

When a feature is disabled:
1. Button shows with 50% opacity
2. Tooltip displays "This feature is coming soon"
3. Click does nothing (no error)
4. No backend call attempted

---

## 6. Boundary Rules

### 6.1 Dependency → UI Mapping

| External Dependency | Required For | If Not Provisioned |
|--------------------|--------------|-------------------|
| SendGrid | Email ingestion | Hide "Email" tab in Admin Ingest |
| Meta WhatsApp | WhatsApp ingestion | Hide "WhatsApp" tab in Admin Ingest |
| Sentry | Error monitoring | Log errors locally only |

### 6.2 Graceful Degradation

```typescript
// Example: Email ingestion with graceful degradation
export async function handleEmailWebhook(req: Request) {
  if (!process.env.SENDGRID_WEBHOOK_SECRET) {
    console.warn('Email ingestion not configured - webhook ignored');
    return { status: 200, body: 'OK (not configured)' };
  }
  // ... actual processing
}
```

---

## 7. Pre-Pilot Checklist

### 7.1 Infrastructure
- [ ] Database migrations applied
- [ ] S3 bucket accessible
- [ ] SSL certificate valid
- [ ] Domain DNS configured

### 7.2 Authentication
- [ ] Manus OAuth callback URL registered
- [ ] JWT secret generated and set
- [ ] Test login flow works

### 7.3 Features
- [ ] Document upload works
- [ ] AI categorization works
- [ ] Comments work
- [ ] RFI CRUD works
- [ ] Checklist CRUD works

### 7.4 Monitoring
- [ ] Sentry DSN configured (if using)
- [ ] Health check endpoint responds
- [ ] Error logging working

### 7.5 Security
- [ ] All secrets in environment variables
- [ ] No hardcoded credentials
- [ ] HTTPS enforced
- [ ] CORS configured correctly

---

## 8. What I Need From You

To complete pilot provisioning, please provide:

### Required Now:
1. **Custom domain** for production deployment (for OAuth callbacks)

### Required for Email Ingestion:
2. **SendGrid account** credentials
3. **DNS access** to add MX records for ingest subdomain

### Required for WhatsApp:
4. **Meta Business Account** access
5. **Business phone number** for WhatsApp

### Required for Monitoring:
6. **Sentry DSN** (or confirm if you want different provider)

### Optional:
7. **Seed data** - Sample projects/documents for pilot users
8. **User list** - Email addresses for pilot user accounts
