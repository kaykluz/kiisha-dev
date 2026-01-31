# OpenClaw Integration for KIISHA

## Overview

This document describes the integration between KIISHA and OpenClaw, enabling multi-channel AI assistant functionality across WhatsApp, Telegram, Slack, Discord, Microsoft Teams, and other messaging platforms.

**Core Principle:** "OpenClaw executes. KIISHA authorizes."

OpenClaw handles channel adapters and message routing, while KIISHA maintains control over identity, permissions, data governance, and audit trails.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KIISHA Platform                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Identity   │  │  Capability  │  │      VATR Logging        │  │
│  │   Bridge     │  │   Registry   │  │   (Conversation Audit)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                           │                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    OpenClaw Webhook Router                    │  │
│  │              (server/routers/openclaw.ts)                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      KIISHA Skills                            │  │
│  │   Portfolio | Documents | Alerts | Operations | Compliance    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                                  │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   KIISHA Bridge Extension                     │  │
│  │               (openclaw-bridge/src/index.ts)                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Channel Adapters                           │  │
│  │  WhatsApp | Telegram | Slack | Discord | Teams | Signal | ... │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Channel Identities
Maps external channel identities to KIISHA users.

```sql
CREATE TABLE channel_identities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  organization_id INT NOT NULL,
  channel_type ENUM('whatsapp', 'telegram', 'slack', 'discord', 'msteams', ...),
  external_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  verification_status ENUM('pending', 'verified', 'revoked'),
  verified_at TIMESTAMP,
  last_used_at TIMESTAMP,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE KEY (channel_type, external_id)
);
```

### Capability Registry
Defines available capabilities and their risk levels.

```sql
CREATE TABLE capability_registry (
  id INT PRIMARY KEY AUTO_INCREMENT,
  capability_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category ENUM('channel', 'query', 'document', 'operation', 'browser', 'skill', 'cron', 'payment'),
  risk_level ENUM('low', 'medium', 'high', 'critical'),
  requires_approval BOOLEAN DEFAULT FALSE,
  requires_2fa BOOLEAN DEFAULT FALSE,
  requires_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);
```

### Organization Capabilities
Per-organization capability settings.

```sql
CREATE TABLE org_capabilities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  capability_id VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  approval_policy ENUM('inherit', 'always', 'never'),
  daily_limit INT,
  monthly_limit INT,
  current_daily_usage INT DEFAULT 0,
  current_monthly_usage INT DEFAULT 0,
  UNIQUE KEY (organization_id, capability_id)
);
```

### Approval Requests
Tracks approval requests for sensitive operations.

```sql
CREATE TABLE approval_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  request_id VARCHAR(36) UNIQUE NOT NULL,
  organization_id INT NOT NULL,
  requested_by INT NOT NULL,
  capability_id VARCHAR(100) NOT NULL,
  task_spec JSON NOT NULL,
  summary TEXT,
  risk_assessment JSON,
  status ENUM('pending', 'approved', 'rejected', 'expired', 'auto_approved'),
  approved_by INT,
  approved_at TIMESTAMP,
  approval_method ENUM('web', 'mobile', 'channel', 'api'),
  rejection_reason TEXT,
  expires_at TIMESTAMP,
  audit_trail JSON
);
```

### Conversation VATRs
VATR-compliant conversation logging.

```sql
CREATE TABLE conversation_vatrs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  user_id INT,
  channel_identity_id INT,
  channel_type VARCHAR(50) NOT NULL,
  session_id VARCHAR(100),
  message_received_at TIMESTAMP NOT NULL,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  response_sent_at TIMESTAMP NOT NULL,
  latency_ms INT,
  capabilities_used JSON,
  data_accessed JSON,
  vatr_hash VARCHAR(64) NOT NULL,
  INDEX (organization_id, message_received_at)
);
```

## API Endpoints

### Webhook Router (server/routers/openclaw.ts)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `openclaw.handleEvent` | POST | Receive incoming messages from OpenClaw |
| `openclaw.handleTaskResult` | POST | Receive task execution results |
| `openclaw.initiateChannelLink` | POST | Start channel linking process |
| `openclaw.verifyChannelLink` | POST | Complete channel verification |
| `openclaw.revokeChannel` | POST | Revoke a linked channel |
| `openclaw.getLinkedChannels` | GET | List linked channels for user |
| `openclaw.getConversationHistory` | GET | Get conversation history |
| `openclaw.checkCapability` | GET | Check capability access |
| `openclaw.requestApproval` | POST | Request approval for sensitive action |
| `openclaw.getPendingApprovals` | GET | List pending approvals |
| `openclaw.processApproval` | POST | Approve or reject a request |

## KIISHA Skills

Skills expose KIISHA functionality through OpenClaw's natural language interface.

### Portfolio Skills
- `kiisha.portfolio.summary` - Get portfolio overview
- `kiisha.project.list` - List all projects
- `kiisha.project.details` - Get project details

### Document Skills
- `kiisha.documents.status` - Check document verification status
- `kiisha.documents.list` - List documents for a project
- `kiisha.document.upload` - Upload a document (requires approval)

### Alert Skills
- `kiisha.alerts.list` - View active alerts
- `kiisha.alert.acknowledge` - Acknowledge an alert (requires approval)

### Operations Skills
- `kiisha.tickets.list` - List work orders
- `kiisha.ticket.create` - Create a work order (requires approval)

### Compliance Skills
- `kiisha.compliance.status` - Get compliance status

## Security Model

### Risk Levels

| Level | Description | Approval Required |
|-------|-------------|-------------------|
| Low | Read-only queries | No |
| Medium | Data modifications | Configurable |
| High | Sensitive operations | Yes |
| Critical | Financial/admin actions | Yes + 2FA |

### Identity Verification

1. User initiates channel link from KIISHA web UI
2. System generates 6-digit OTP
3. User sends OTP from their channel account
4. System verifies and creates identity mapping
5. All future messages from that channel are authenticated

### Capability Access Control

1. Check if capability exists and is active
2. Check if capability is enabled for organization
3. Check usage limits (daily/monthly)
4. Check time-based restrictions
5. Check approval requirements
6. Check admin/2FA requirements

## UI Components

### OpenClawChatSidebar
A floating chat sidebar that provides unified messaging access across all KIISHA views.

Features:
- Persistent across all views
- Channel switching
- Quick actions
- Conversation history
- VATR-compliant logging

### ChannelSettings Page
Allows users to manage their linked communication channels.

Features:
- Link new channels
- Verify channel ownership
- Manage notification settings
- Revoke channel access

## Deployment

### Environment Variables

```env
# OpenClaw Configuration
OPENCLAW_API_URL=https://openclaw.example.com
OPENCLAW_WEBHOOK_SECRET=your-webhook-secret
OPENCLAW_API_KEY=your-api-key
```

### Database Migration

Run the migration to create OpenClaw tables:

```bash
mysql -u root -p kiisha < drizzle/migrations/openclaw-integration.sql
```

### OpenClaw Bridge Setup

1. Copy `openclaw-bridge` to your OpenClaw plugins directory
2. Configure the plugin in OpenClaw:

```json
{
  "plugins": {
    "kiisha-bridge": {
      "kiishaApiUrl": "https://your-kiisha-instance.com",
      "kiishaApiKey": "your-api-key",
      "webhookSecret": "your-webhook-secret"
    }
  }
}
```

## Usage Examples

### From WhatsApp

```
User: Show me my portfolio summary
KIISHA: 📊 Portfolio Summary

📁 Portfolios: 3
🏗️ Projects: 45
⚡ Total Capacity: 125,000 kW
🔔 Active Alerts: 7
```

### From Slack

```
User: What documents are missing for Project Alpha?
KIISHA: 📄 Document Status for Project Alpha

✅ Verified: 12
⏳ Pending: 3
❌ Missing: 5

Missing Documents:
• Environmental Impact Assessment
• Grid Connection Agreement
• Land Title Certificate
• Building Permit
• Insurance Certificate
```

### Creating a Work Order

```
User: Create a ticket for inverter maintenance at Site 7
KIISHA: ⏳ Creating work orders requires approval. 
Please confirm this action in the KIISHA web portal.

[Approval request sent to admins]
```

## Compliance

All conversations are logged with VATR (Verifiable Audit Trail Record) compliance:

- Every message is timestamped
- AI responses are logged with latency metrics
- Capabilities used are recorded
- Data accessed is tracked
- VATR hash ensures tamper-proof audit trail

## Future Enhancements

1. **Voice Support** - Enable voice messages via WhatsApp/Telegram
2. **Document Sharing** - Send/receive documents through channels
3. **Proactive Notifications** - Push alerts to linked channels
4. **Group Chat Support** - Enable team collaboration via channels
5. **Payment Integration** - Process payments through chat
6. **Scheduled Reports** - Automated report delivery via channels
