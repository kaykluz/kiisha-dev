# OpenClaw + KIISHA Integration Notes

## OpenClaw Overview

OpenClaw is an open-source personal AI assistant that:
- Runs locally and connects to 15+ messaging channels
- Supports: WhatsApp, Telegram, Slack, Discord, MS Teams, Signal, iMessage, Matrix, etc.
- Uses WebSocket control plane on `ws://127.0.0.1:18789`
- Has a plugin/extension architecture for channels
- Has a skills system for capabilities
- Includes voice wake + talk mode
- Provides session management per-user/per-group

## Architecture Principle

> **OpenClaw executes. KIISHA authorizes.**

- OpenClaw = edge connectors + agent runtime + tool runner
- KIISHA = identity, RBAC, VATR, org security policies, approvals, audit logs, data governance

## Key Integration Points

### 1. Channel Adapters (OpenClaw)
- WhatsApp via Baileys (WhatsApp Web protocol)
- Telegram via grammY
- Slack/Discord/Teams native bots
- Signal/iMessage desktop integrations

### 2. Identity Bridge (KIISHA)
- Map OpenClaw sender IDs to KIISHA users
- Verification via OTP/email/admin approval
- Multi-tenant isolation enforced

### 3. Capability Registry (KIISHA)
- Per-org skill enablement
- Risk levels: low, medium, high, critical
- Approval requirements per capability

### 4. Formal Contracts
- OpenClawEvent: Incoming messages from channels
- TaskSpec: KIISHA → OpenClaw task requests
- TaskResult: OpenClaw → KIISHA task completion

## Database Tables Needed

1. `channel_identities` - Map external channel IDs to KIISHA users
2. `capability_registry` - Define available capabilities
3. `org_capabilities` - Per-org capability enablement
4. `approval_requests` - Approval workflow for sensitive ops
5. `security_policies` - Per-org security policies
6. `conversation_vatrs` - Audit trail for all conversations

## Security Boundaries (7 Iron Rules)

1. No shared super-tokens
2. All permissions live in KIISHA
3. Domain allowlists for tool runs
4. Approval routing through KIISHA
5. Artifact ingestion via KIISHA only
6. Strong tenant isolation
7. Separate processes (OpenClaw and KIISHA never share process space)

## Implementation Phases

### Phase 1: Channel Foundation (Weeks 1-3)
- Deploy OpenClaw as Docker service
- Build kiisha-bridge extension
- Create webhook endpoint in KIISHA
- Implement identity resolution
- Build verification flow

### Phase 2: Document Ingestion (Weeks 4-5)
- Media pipeline integration
- Document categorization via chat
- VATR creation from chat
- Confirmation workflow

### Phase 3: Tool Execution (Weeks 6-8)
- Implement TaskSpec/TaskResult contracts
- Build capability registry
- Create approval engine
- Safe tool bucket: web fetch, document parse

### Phase 4: Field Operations (Weeks 9-10)
- Voice transcription (Whisper)
- Photo + GPS capture
- Work order creation via chat

### Phase 5: Compliance Automation (Weeks 11-12)
- Cron-based polling
- Automated reminders
- Proactive compliance management

### Phase 6: Skills Marketplace (Weeks 13+)
- Allowed Capabilities Registry
- Per-org skill enablement
- Extensible capability ecosystem

## KIISHA Skills to Expose

### Low Risk (No Approval)
- `kiisha.portfolio.summary` - Portfolio overview
- `kiisha.documents.status` - Document checklist
- `kiisha.project.details` - Project information
- `kiisha.alerts.list` - Active alerts

### Medium Risk (Requires Approval)
- `kiisha.document.upload` - Upload documents
- `kiisha.rfi.respond` - Respond to RFIs
- `kiisha.ticket.create` - Create work orders

### High Risk (Requires 2FA/Admin)
- `kiisha.payment.initiate` - Payment transactions
- `kiisha.user.invite` - Invite users
- `kiisha.data.export` - Export data

## Key Files in OpenClaw

- `extensions/whatsapp/` - WhatsApp channel plugin
- `extensions/telegram/` - Telegram channel plugin
- `extensions/slack/` - Slack channel plugin
- `skills/` - Skills directory (50+ skills)
- `src/plugin-sdk/` - Plugin SDK for extensions
- `src/gateway/` - Gateway server implementation

## Next Steps for Implementation

1. Create KIISHA OpenClaw bridge extension
2. Add webhook endpoint in KIISHA tRPC router
3. Create database tables for identity mapping
4. Implement verification flow
5. Build capability registry
6. Add sidebar chat component to KIISHA UI
