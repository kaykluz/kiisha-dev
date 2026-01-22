# KIISHA Provider Options

This document lists all available providers for each integration type, with setup instructions and configuration requirements.

## Architecture Overview

KIISHA uses a **provider-agnostic architecture** that allows organizations to choose their preferred external services. Each integration type (Storage, LLM, Email, etc.) can be satisfied by multiple providers.

### Key Concepts

- **Capability**: A functional requirement (e.g., `STORAGE`, `LLM`, `EMAIL_INGEST`)
- **Integration Type**: Category of external service (e.g., `storage`, `llm`, `email_ingest`)
- **Provider**: Specific implementation (e.g., `s3`, `openai`, `sendgrid`)
- **Adapter**: Code that translates between KIISHA and provider APIs

### Built-in vs External Providers

| Type | Built-in Provider | External Options |
|------|-------------------|------------------|
| Storage | Manus Storage | AWS S3, Cloudflare R2, Supabase Storage |
| LLM | Manus AI | OpenAI, Anthropic Claude, Azure OpenAI |
| Email Ingest | - | SendGrid, Mailgun, Postmark |
| WhatsApp | - | Meta Cloud API |
| Notifications | Manus Notify | SendGrid |
| Observability | Custom Logging | Sentry |
| Maps | Manus Proxy | Google Maps |

---

## Storage Providers

### Manus Storage (Built-in)

**No configuration required.** Uses the platform's built-in S3-compatible storage.

- **Pros**: Zero setup, automatic credentials, included in platform
- **Cons**: Limited to Manus platform, no custom bucket policies

### Amazon S3

Industry-standard object storage with global availability.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `bucket` | S3 bucket name | `kiisha-documents` |
| `region` | AWS region | `us-east-1` |
| `accessKeyId` | IAM access key | `AKIA...` |
| `secretAccessKey` | IAM secret key | `wJal...` |

**IAM Policy (Least Privilege):**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::kiisha-documents",
      "arn:aws:s3:::kiisha-documents/*"
    ]
  }]
}
```

**CORS Configuration:**
```json
[{
  "AllowedHeaders": ["*"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedOrigins": ["https://your-kiisha-domain.com"],
  "ExposeHeaders": ["ETag"]
}]
```

### Cloudflare R2

S3-compatible storage with zero egress fees.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `accountId` | Cloudflare account ID | `abc123...` |
| `bucket` | R2 bucket name | `kiisha-docs` |
| `accessKeyId` | R2 access key | `...` |
| `secretAccessKey` | R2 secret key | `...` |

### Supabase Storage

Open-source storage with built-in CDN.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `projectUrl` | Supabase project URL | `https://xxx.supabase.co` |
| `bucket` | Storage bucket name | `documents` |
| `serviceKey` | Service role key | `eyJ...` |

---

## LLM Providers

### Manus AI (Built-in)

**No configuration required.** Uses the platform's built-in LLM service.

- **Pros**: Zero setup, automatic credentials, optimized for KIISHA
- **Cons**: Limited model selection

### OpenAI

Access to GPT-4, GPT-3.5-turbo, and other OpenAI models.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `apiKey` | OpenAI API key | `sk-...` |
| `model` | Default model (optional) | `gpt-4-turbo` |
| `orgId` | Organization ID (optional) | `org-...` |

**Available Models:**
- `gpt-4-turbo` - Latest GPT-4 with vision
- `gpt-4` - Standard GPT-4
- `gpt-3.5-turbo` - Fast and cost-effective

### Anthropic Claude

Access to Claude 3 family of models.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `apiKey` | Anthropic API key | `sk-ant-...` |
| `model` | Default model (optional) | `claude-3-opus-20240229` |

**Available Models:**
- `claude-3-opus-20240229` - Most capable
- `claude-3-sonnet-20240229` - Balanced
- `claude-3-haiku-20240307` - Fast and efficient

### Azure OpenAI

OpenAI models hosted on Azure with enterprise features.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `endpoint` | Azure OpenAI endpoint | `https://xxx.openai.azure.com` |
| `apiKey` | Azure API key | `...` |
| `deploymentName` | Model deployment name | `gpt-4-deployment` |
| `apiVersion` | API version (optional) | `2024-02-15-preview` |

---

## Email Ingestion Providers

### SendGrid Inbound Parse

Receive emails via SendGrid's webhook.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `hostname` | Receiving domain | `ingest.yourdomain.com` |

**Setup Steps:**
1. Add MX record: `ingest.yourdomain.com → mx.sendgrid.net`
2. In SendGrid dashboard, go to Settings → Inbound Parse
3. Add hostname and paste the webhook URL from KIISHA
4. Enable "POST the raw, full MIME message"

### Mailgun Routes

Receive emails via Mailgun's routing rules.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `domain` | Mailgun domain | `mg.yourdomain.com` |
| `apiKey` | Mailgun API key | `key-...` |
| `webhookSigningKey` | Webhook signing key | `...` |

### Postmark Inbound

Receive emails via Postmark's inbound webhook.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `inboundDomain` | Custom inbound domain (optional) | `inbound.yourdomain.com` |
| `serverToken` | Postmark server token | `...` |

---

## WhatsApp Provider

### Meta Cloud API

Official WhatsApp Business API via Meta.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `phoneNumberId` | WhatsApp phone number ID | `123456789` |
| `businessAccountId` | Business account ID | `987654321` |
| `accessToken` | System user access token | `EAA...` |
| `appSecret` | App secret for webhook verification | `...` |
| `verifyToken` | Webhook verify token | `...` |

**Setup Steps:**
1. Create a Meta Business App at developers.facebook.com
2. Add WhatsApp product to your app
3. Set up a System User with `whatsapp_business_messaging` permission
4. Generate a permanent access token
5. Configure webhook URL in Meta dashboard

---

## Notification Providers

### Manus Notify (Built-in)

**No configuration required.** Sends notifications to the platform owner.

- **Limitation**: Only supports owner notifications, not user emails

### SendGrid (Transactional Email)

Send emails to users via SendGrid.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `fromEmail` | Sender email address | `noreply@yourdomain.com` |
| `fromName` | Sender display name | `KIISHA` |
| `apiKey` | SendGrid API key | `SG...` |

---

## Observability Providers

### Custom Logging (Built-in)

**No configuration required.** Logs to console and optionally to database.

**Optional Configuration:**
| Field | Description | Default |
|-------|-------------|---------|
| `logLevel` | Minimum log level | `info` |
| `enableConsole` | Log to console | `true` |
| `enableDatabase` | Log to database | `false` |

### Sentry

Error tracking and performance monitoring.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `dsn` | Sentry DSN | `https://xxx@sentry.io/123` |
| `environment` | Environment name (optional) | `production` |
| `release` | Release version (optional) | `1.0.0` |
| `tracesSampleRate` | Performance sampling rate | `0.1` |

---

## Maps Providers

### Manus Proxy (Built-in)

**No configuration required.** Uses the platform's Google Maps proxy.

- **Pros**: Zero setup, no API key needed
- **Full Access**: All Google Maps features available

### Google Maps Direct

Direct integration with Google Maps Platform.

**Required Configuration:**
| Field | Description | Example |
|-------|-------------|---------|
| `apiKey` | Google Maps API key | `AIza...` |
| `mapId` | Custom map ID (optional) | `...` |

---

## Configuration via Settings UI

1. Navigate to **Settings → Integrations**
2. Select the integration type tab (Core Services, Communication, Monitoring)
3. Click **Configure** on the desired integration
4. Select a provider from the list
5. Enter the required configuration and secrets
6. Click **Save & Test Connection**

For webhook-based integrations (Email, WhatsApp), you'll receive:
- **Webhook URL**: Configure this in your provider's dashboard
- **Verify Token**: Used for webhook verification (WhatsApp)

---

## Troubleshooting

### Connection Test Failures

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not configured" | Missing secret | Re-enter API key in configuration |
| "Invalid credentials" | Wrong key/secret | Verify credentials in provider dashboard |
| "Network error" | Firewall/connectivity | Check network access to provider |
| "Rate limited" | Too many requests | Wait and retry |

### Webhook Not Receiving

1. Verify webhook URL is correctly configured in provider dashboard
2. Check that your domain is publicly accessible
3. Verify SSL certificate is valid
4. Check provider's webhook logs for delivery attempts

### Feature Not Enabled

If a feature shows as disabled:
1. Check if the required integration is configured
2. Verify the integration status is "Connected"
3. Run a connection test to ensure it's working
