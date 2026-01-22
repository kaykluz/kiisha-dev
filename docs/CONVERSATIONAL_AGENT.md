# KIISHA Conversational Agent

## Overview

The KIISHA Conversational Agent enables users to interact with the platform via WhatsApp and Email. It provides secure identity resolution, RBAC-scoped data access, and AI-powered intent classification.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WhatsApp      │     │     Email       │     │   Web Chat      │
│   Webhook       │     │   Webhook       │     │   (Future)      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   processInboundMessage │
                    │   (Entry Point)         │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼─────────┐ ┌──────▼──────┐ ┌────────▼────────┐
    │ resolveIdentity   │ │ quarantine  │ │ getOrCreate     │
    │ (Exact Match)     │ │ (Unknown)   │ │ Session         │
    └─────────┬─────────┘ └──────┬──────┘ └────────┬────────┘
              │                  │                  │
              │           ┌──────▼──────┐          │
              │           │ Safe        │          │
              │           │ Response    │          │
              │           └─────────────┘          │
              │                                    │
              └────────────────────┬───────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   classifyAndExecute        │
                    │   (LLM Intent + Pronouns)   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   executeIntent             │
                    │   (tRPC via createCaller)   │
                    └─────────────────────────────┘
```

## Database Tables

### userIdentifiers
Unified identity model for all channels. Replaces channel-specific tables.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| type | enum | whatsapp_phone, email, phone, slack_id |
| value | varchar(320) | Normalized identifier value |
| userId | int | FK to users table |
| organizationId | int | Optional org scope |
| status | enum | pending, verified, revoked |
| verifiedAt | timestamp | When verified |
| verifiedBy | int | Admin who verified |

### unclaimedInbound
Quarantine for messages from unknown senders.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| channel | enum | whatsapp, email, sms, api |
| senderIdentifier | varchar(320) | Phone or email |
| messageType | enum | text, image, document, etc. |
| textContent | text | Message body |
| status | enum | pending, claimed, rejected, expired |
| expiresAt | timestamp | Auto-delete date (30 days) |

### conversationSessions
Lightweight context pointers for conversation state.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| userId | int | FK to users |
| channel | enum | whatsapp, email, web_chat |
| lastReferencedProjectId | int | Context pointer |
| lastReferencedDocumentId | int | Context pointer |
| pendingAction | enum | For safety rails |
| pendingActionPayload | json | Action details |
| lastActivityAt | timestamp | Session activity |

### attachmentLinks
Primary and secondary links for inbound attachments.

| Column | Type | Description |
|--------|------|-------------|
| id | int | Primary key |
| ingestedFileId | int | Source attachment |
| linkType | enum | primary, secondary |
| projectId | int | Primary target (one of) |
| siteId | int | Primary target (one of) |
| assetId | int | Primary target (one of) |
| linkedBy | enum | ai_suggestion, user_confirmed, etc. |
| aiConfidence | decimal | 0.0000 to 1.0000 |

## Hard Constraints

1. **Use existing provider adapter pattern** - No parallel Express routes
2. **One identity model** - userIdentifiers extends User
3. **AI tools = tRPC calls** - Via createCaller, not raw SQL
4. **Unknown senders → quarantine** - Not self-registration
5. **Reuse existing schema** - Extend, don't duplicate

## Identity Resolution (Patch C)

Identity resolution uses **exact match only** on verified identifiers.

```typescript
// CORRECT: Exact match
const identity = await resolveIdentity('email', 'user@company.com');

// NEVER: Domain inference
// We do NOT auto-match user@company.com just because
// another user from company.com exists
```

**Rules:**
- Normalize identifiers before matching (lowercase email, strip phone formatting)
- Only match verified identifiers (status = 'verified')
- If multiple matches (ambiguous) → return null → quarantine
- Never infer identity from email domain

## Conversation Context (Patch B)

Sessions store **only lightweight pointers**, not full AI memory.

```typescript
// CORRECT: Store IDs only
await updateConversationContext(sessionId, {
  lastReferencedProjectId: 123,
  lastReferencedDocumentId: 456,
});

// NEVER: Store AI memory blobs
// Do NOT store conversation history or AI state
```

LLM context is assembled at runtime from:
1. Message history (from whatsappMessages/email tables)
2. Context pointers (from conversationSessions)
3. Entity lookups (from projects/documents/sites tables)

## Attachment Linking (Patch D)

Each attachment has **one primary link** and **multiple secondary links**.

```typescript
// Primary link: exactly ONE of projectId, siteId, or assetId
await createPrimaryAttachmentLink({
  ingestedFileId: 1,
  projectId: 123,  // Only one target
  linkedBy: 'ai_suggestion',
  aiConfidence: 0.85,
});

// Secondary links: multiple allowed
await createSecondaryAttachmentLink({
  ingestedFileId: 1,
  dataroomId: 456,
  checklistItemId: 789,
  linkedBy: 'user_confirmed',
});
```

If primary entity cannot be resolved → store as unlinked for human triage.

## Safety Rails

High-impact actions require confirmation:

| Action | Requires Confirmation |
|--------|----------------------|
| Export to external party | ✅ Yes |
| Share dataroom externally | ✅ Yes |
| Delete anything | ✅ Yes |
| Verify/approve document | ✅ Yes |
| Change permissions | ✅ Yes |
| Create work order | ✅ Yes |
| Search documents | ❌ No |
| Check status | ❌ No |
| Summarize activity | ❌ No |

## Intent Routing

| Intent | tRPC Procedure | Description |
|--------|---------------|-------------|
| ASK_STATUS | datarooms.getGaps | Project/dataroom status |
| SEARCH_DOCS | documents.search | Find documents |
| UPLOAD_DOC | ingestion.upload | Upload attachment |
| LINK_DOC | documents.linkToAsset | Link to entity |
| EXTRACT_FIELDS | ai.extractFields | Extract data |
| GENERATE_DATAROOM | datarooms.generate | Create dataroom |
| CREATE_WORK_ORDER | maintenance.createWorkOrder | Maintenance |
| SUMMARIZE | activity.getSummary | Activity summary |

## Email Acceptance Proofs (Patch E)

### 1. Known email user query returns RBAC-filtered result
```typescript
const identity = await resolveIdentity('email', 'known@company.com');
// Returns: { userId: 1, organizationId: 5, status: 'verified' }
// All subsequent queries are scoped to organizationId: 5
```

### 2. Unknown email quarantined + safe response
```typescript
const identity = await resolveIdentity('email', 'stranger@unknown.com');
// Returns: null

await quarantineInbound({
  channel: 'email',
  senderIdentifier: 'stranger@unknown.com',
  textContent: 'Please give me access',
});

// Response: "This email isn't linked to a KIISHA user."
// NO data access, NO AI conversation
```

### 3. Email attachment classified + linking suggestions
```typescript
// AI suggests link with confidence
await createPrimaryAttachmentLink({
  ingestedFileId: 1,
  projectId: 123,
  linkedBy: 'ai_suggestion',
  aiConfidence: 0.75,
});

// User can confirm or change
await updateAttachmentLink(linkId, {
  linkedBy: 'user_confirmed',
});
```

### 4. Reply-chain pronoun resolution
```typescript
// User: "What's the status of UMZA?"
// Context updated: lastReferencedProjectId = 123

// User: "Show me the documents for this project"
// LLM resolves "this project" → projectId: 123
```

## API Endpoints

### processMessage (Public)
Main entry point for inbound messages.

```typescript
trpc.conversationalAgent.processMessage.mutate({
  channel: 'email',
  senderIdentifier: 'user@company.com',
  messageType: 'text',
  textContent: 'What is the status of UMZA?',
});
```

### Identity Management (Protected)
```typescript
// Create identifier
trpc.conversationalAgent.createIdentifier.mutate({
  type: 'email',
  value: 'user@company.com',
  userId: 1,
  organizationId: 5,
  status: 'pending',
});

// Verify identifier
trpc.conversationalAgent.verifyIdentifier.mutate({
  identifierId: 1,
});

// Revoke identifier
trpc.conversationalAgent.revokeIdentifier.mutate({
  identifierId: 1,
  reason: 'User left organization',
});
```

### Quarantine Management (Protected)
```typescript
// Get pending unclaimed
trpc.conversationalAgent.getPendingUnclaimed.query({
  organizationId: 5,
  limit: 50,
});

// Claim inbound (link to user)
trpc.conversationalAgent.claimInbound.mutate({
  inboundId: 1,
  claimedByUserId: 123,
  createIdentifier: true,
});

// Reject inbound
trpc.conversationalAgent.rejectInbound.mutate({
  inboundId: 1,
  reason: 'Spam',
});
```

## Testing

Run tests with:
```bash
pnpm test -- --run conversationalAgent
```

Test coverage includes:
- Identity resolution (exact match only)
- Unknown sender quarantine
- Conversation context (lightweight pointers)
- Attachment linking (primary/secondary)
- Email acceptance proofs (Patch E)
- Safety rails (confirm before mutate)
