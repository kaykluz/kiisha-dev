# Conversational Agent Evidence Report

## Section A1: Critical File Paths & Functions

### Inbound Entrypoints

| Channel | File | Handler Function | Status |
|---------|------|------------------|--------|
| WhatsApp | `server/routers.ts:2500` | `whatsapp.processInbound` | ✅ Implemented |
| Email | `server/routers.ts:4022` | `ingestion.processEmail` | ✅ Implemented |

**WhatsApp Entrypoint** (`server/routers.ts:2500-2560`):
```typescript
processInbound: publicProcedure
  .input(z.object({
    webhookSecret: z.string(),
    payload: z.any(),
    signature: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    // Verify webhook secret and find config
    const config = await db.getWhatsappConfigBySecret(input.webhookSecret);
    if (!config) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid webhook secret' });
    }
    // ... process message
  })
```

**Email Entrypoint** (`server/routers.ts:4022-4120`):
```typescript
processEmail: publicProcedure
  .input(z.object({
    from: z.string(),
    to: z.string(),
    subject: z.string().optional(),
    textBody: z.string().optional(),
    htmlBody: z.string().optional(),
    attachments: z.array(z.object({...})).optional(),
  }))
  .mutation(async ({ input }) => {
    // Process email ingestion
  })
```

### Provider Adapters

| Provider | File | Status |
|----------|------|--------|
| Meta WhatsApp | `server/providers/adapters/whatsapp/meta.ts` | ✅ Implemented |
| SendGrid Email | `server/providers/adapters/email/sendgrid.ts` | ✅ Implemented |
| Mailgun Email | `server/providers/adapters/email/mailgun.ts` | ✅ Implemented |
| Postmark Email | `server/providers/adapters/email/postmark.ts` | ✅ Implemented |

### Identity Resolution

**File**: `server/db.ts:4895-4930`
**Function**: `resolveIdentity(type, value)`

```typescript
export async function resolveIdentity(
  type: 'whatsapp_phone' | 'email' | 'phone' | 'slack_id',
  value: string
): Promise<{ userId: number; organizationId: number | null; status: string } | null> {
  const normalizedValue = normalizeIdentifier(type, value);
  
  // EXACT MATCH ONLY - no fuzzy matching, no domain inference
  const results = await db.select({...})
    .from(userIdentifiers)
    .where(and(
      eq(userIdentifiers.type, type),
      eq(userIdentifiers.value, normalizedValue),
      ne(userIdentifiers.status, 'revoked') // Exclude revoked
    ))
    .limit(2); // Detect ambiguity
  
  // If no match or multiple matches → return null
  if (results.length !== 1) return null;
  return results[0];
}
```

### Quarantine Path

**File**: `server/db.ts:5023-5040`
**Function**: `quarantineInbound(data)`

```typescript
export async function quarantineInbound(data: InsertUnclaimedInbound) {
  const result = await db.insert(unclaimedInbound).values({
    ...data,
    status: 'pending',
    receivedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
  return result[0]?.insertId || null;
}
```

**Safe Reply** (`server/services/conversationalAgent.ts:153-157`):
```typescript
return {
  success: false,
  message: `This ${message.channel === 'whatsapp' ? 'number' : 'email'} isn't linked to a KIISHA user. Please contact your administrator to get access.`,
};
```

### Conversation Pointer Updates

**File**: `server/db.ts:5132-5220`
**Functions**:
- `getOrCreateConversationSession(userId, channel, identifier)` - Creates/retrieves session
- `getConversationSession(sessionId)` - Reads session with all pointers
- `updateConversationContext(sessionId, context)` - Updates pointers

**Pointers Stored** (from schema `drizzle/schema.ts:1265-1285`):
- `lastReferencedProjectId`
- `lastReferencedSiteId`
- `lastReferencedAssetId`
- `lastReferencedDocumentId`
- `activeDataroomId`
- `activeViewScopeId`
- `pendingAction` / `pendingActionPayload` (for confirmation flow)

### Tool Execution

**File**: `server/services/conversationalAgent.ts`

⚠️ **GAP IDENTIFIED**: Tool execution currently uses direct `db.*` calls instead of `appRouter.createCaller(ctx)`. This needs to be fixed to ensure RBAC parity.

**Current Implementation** (lines 420-450):
```typescript
// Currently uses direct db calls:
const workOrderId = await db.createWorkOrder({...});
const dataroomId = await db.createDataRoom({...});
```

**Required Fix**: Should use:
```typescript
const caller = appRouter.createCaller({ user: { id: context.userId, ... } });
await caller.maintenance.createWorkOrder({...});
await caller.datarooms.create({...});
```

---

## Section A2: WhatsApp Signature Verification

**File**: `server/providers/adapters/whatsapp/meta.ts:95-115`

```typescript
verifyWebhookSignature(payload: string | Buffer, signature: string, appSecret: string): boolean {
  if (!signature || !appSecret) return false;
  
  // Meta uses sha256 HMAC
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(typeof payload === 'string' ? payload : payload.toString())
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
```

⚠️ **CRITICAL GAP**: Raw body is NOT captured at webhook entrypoint!

**Current Issue** (`server/_core/index.ts:79`):
```typescript
app.use(express.json({ limit: "50mb" }));
```

This parses JSON before we can access raw bytes for signature verification.

**Required Fix**: Add raw body capture middleware:
```typescript
app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body;
  req.body = JSON.parse(req.body.toString());
  next();
});
```

---

## Section A3: RBAC Parity Proof

⚠️ **GAP IDENTIFIED**: RBAC is not enforced in conversational agent because it uses direct `db.*` calls instead of tRPC procedures.

**Required Fix**: Implement tool execution via `createCaller` pattern to inherit all RBAC guards.

---

## Section A4: Attachment Flow

**File**: `server/services/conversationalAgent.ts:380-430`
**Function**: `handleAttachment(context, message)`

**Current Flow**:
1. ✅ Store attachment in `ingestedFiles` table
2. ✅ Suggest primary link based on context
3. ⚠️ **GAP**: Auto-links without explicit confirmation (violates B1)
4. ✅ Supports "link to [project]" command for manual linking

---

## Section A5: Cross-Channel Parity

**Email Flow** (`server/routers.ts:4022-4120`):
1. ✅ Email received via `processEmail` endpoint
2. ✅ Attachments processed and stored
3. ✅ Same ingestion tables used
4. ⚠️ **GAP**: Does not go through conversational agent for classification/linking

---

## Section B: Must Fix Items Summary

| Item | Status | Fix Required |
|------|--------|--------------|
| B1: AI confidence must NOT auto-link | ❌ FAILING | Add confirmation step |
| B2: Unknown sender non-leaky | ✅ PASSING | Safe message reveals nothing |
| B3: Identity uniqueness | ✅ PASSING | Unique constraint + revoked check |
| B4: ConversationSessions pointers only | ✅ PASSING | No memory blob |
| B5: High-impact confirmation + audit | ⚠️ PARTIAL | Confirmation exists, audit needs work |

---

## Required Fixes Before Pilot

1. **Add raw body capture for WhatsApp webhooks** (A2)
2. **Implement tool execution via createCaller** (A1, A3)
3. **Add explicit confirmation for attachment linking** (B1)
4. **Add audit trail for confirmations** (B5)
5. **Route email attachments through conversational agent** (A5)
