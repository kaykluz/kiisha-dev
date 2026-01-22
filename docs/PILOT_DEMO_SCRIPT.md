# KIISHA Conversational Agent - Pilot Demo Script

## Overview

This document provides a step-by-step demo script for validating the WhatsApp + Email Conversational Agent implementation.

## Prerequisites

1. WhatsApp Business API configured in Settings > Integrations
2. At least one verified user identifier (email or phone)
3. Test project with documents and data rooms

---

## Demo 1: Known User - Query Flow

### Setup
- User: John Doe (john@example.com, +2348012345678)
- Project: UMZA Oil Mill Solar+BESS
- Role: Editor

### Steps

1. **Send WhatsApp message**: "What's the status of UMZA?"

2. **Expected Response**:
   ```
   Hi John! Here's the status for UMZA Oil Mill Solar+BESS:
   
   📊 Document Status:
   - 12 documents verified
   - 3 pending review
   - 1 needs revision
   
   📋 Data Room: 85% complete
   - Missing: Environmental Impact Assessment, Grid Connection Agreement
   
   🔔 Open RFIs: 2
   - RFI-001: Transformer specifications (Due: Jan 20)
   - RFI-002: Site access permits (Due: Jan 25)
   
   Would you like me to show more details on any of these?
   ```

3. **Verify**:
   - Response is RBAC-filtered (John can see all as Editor)
   - Context pointer updated: `lastReferencedProjectId = UMZA.id`

---

## Demo 2: Unknown Sender - Quarantine Flow

### Steps

1. **Send WhatsApp from unknown number**: +2349999999999
   Message: "What's the status of all projects?"

2. **Expected Response**:
   ```
   This phone number isn't linked to a KIISHA account.
   
   If you believe this is an error, please contact your administrator or reply with your registered email address.
   ```

3. **Verify in Admin UI** (`/admin/identity`):
   - Message appears in "Quarantined Messages" tab
   - Shows sender phone, timestamp, message preview
   - "Claim" and "Reject" buttons available

4. **Admin claims message**:
   - Select user to link
   - Message moves to user's conversation history
   - User identifier created (pending verification)

---

## Demo 3: Attachment Upload Flow

### Steps

1. **Send WhatsApp with PDF attachment**:
   Message: "Here's the EIA report for UMZA"
   Attachment: environmental_impact_assessment.pdf

2. **Expected Response**:
   ```
   📄 I've received your document: environmental_impact_assessment.pdf
   
   Based on the content, I suggest linking this to:
   - Project: UMZA Oil Mill Solar+BESS (95% confidence)
   - Category: Environmental (90% confidence)
   - Type: Environmental Impact Assessment (85% confidence)
   
   Should I link this document? Reply YES to confirm or provide different details.
   ```

3. **User confirms**: "Yes"

4. **Expected Response**:
   ```
   ✅ Document linked successfully!
   
   - Project: UMZA Oil Mill Solar+BESS
   - Category: Environmental
   - Type: Environmental Impact Assessment
   - Status: Pending Review
   
   The document is now visible in the Document Hub and Data Room.
   ```

5. **Verify**:
   - Document appears in Document Hub
   - Primary link: Project (UMZA)
   - Secondary links: Data Room row, Checklist item (if applicable)
   - File stored in S3, metadata in database

---

## Demo 4: Pronoun Resolution

### Steps

1. **First message**: "Show me the PPA for UMZA"

2. **Response shows PPA document details**

3. **Follow-up message**: "When does it expire?"

4. **Expected Response**:
   ```
   The Power Purchase Agreement for UMZA Oil Mill Solar+BESS expires on December 31, 2045.
   
   Key terms:
   - Duration: 25 years
   - Tariff: $0.12/kWh
   - Off-taker: Nigerian Bulk Electricity Trading Plc
   ```

5. **Verify**:
   - "it" resolved to the PPA document from previous context
   - Context pointer: `lastReferencedDocumentId = PPA.id`

---

## Demo 5: Safety Rails - Confirm Before Mutate

### Steps

1. **Send message**: "Delete the EIA document"

2. **Expected Response**:
   ```
   ⚠️ You're about to delete:
   - Document: Environmental Impact Assessment
   - Project: UMZA Oil Mill Solar+BESS
   
   This action cannot be undone. Reply YES to confirm or NO to cancel.
   ```

3. **User replies**: "Yes"

4. **Expected Response**:
   ```
   ✅ Document archived successfully.
   
   Note: The document has been moved to archive and is no longer visible in the Data Room. It can be restored by an administrator if needed.
   ```

5. **Verify**:
   - Document status changed to 'archived'
   - Audit log entry created
   - Document removed from active views

---

## Demo 6: RBAC - Forbidden Action

### Setup
- User: Sarah (Investor Viewer role)
- Project: UMZA Oil Mill Solar+BESS

### Steps

1. **Send message**: "Add a new document to UMZA"

2. **Expected Response**:
   ```
   I'm sorry, but you don't have permission to add documents to this project.
   
   As an Investor Viewer, you can:
   - View approved documents
   - Download reports
   - View project status
   
   To request edit access, please contact the project administrator.
   ```

3. **Verify**:
   - No document created
   - RBAC check logged
   - Helpful guidance provided

---

## Demo 7: Email Flow (Cross-Channel Parity)

### Steps

1. **Send email to**: inbox@kiisha.app
   From: john@example.com
   Subject: UMZA status update
   Body: "What documents are still missing for UMZA?"

2. **Expected Email Response**:
   ```
   Subject: Re: UMZA status update
   
   Hi John,
   
   Here are the missing documents for UMZA Oil Mill Solar+BESS:
   
   📋 Data Room Gaps:
   1. Environmental Impact Assessment (Environmental)
   2. Grid Connection Agreement (Technical)
   3. Land Lease Agreement (Legal)
   
   Would you like me to:
   - Generate a checklist for these items?
   - Send reminders to the responsible parties?
   
   Best regards,
   KIISHA Assistant
   ```

3. **Verify**:
   - Same identity resolution as WhatsApp
   - Same RBAC filtering
   - Response sent via email

---

## Demo 8: WhatsApp Template Notification

### Steps

1. **Trigger document status change** (via web UI):
   - Mark EIA document as "Verified"

2. **Expected WhatsApp notification** (to document owner):
   ```
   KIISHA Document Update
   
   Hello John,
   
   Your document "Environmental Impact Assessment" for project UMZA Oil Mill Solar+BESS has been verified.
   
   View details: https://kiisha.app/documents/123
   
   Reply HELP for assistance
   ```

3. **Verify**:
   - Template used: document_status_update
   - Variables populated correctly
   - Sent to user's verified WhatsApp number

---

## Verification Checklist

| Test | Expected | Actual | Pass |
|------|----------|--------|------|
| Known user query | RBAC-filtered response | | |
| Unknown sender quarantine | Safe response + quarantine | | |
| Attachment upload | AI suggestion + confirmation | | |
| Pronoun resolution | Context-aware response | | |
| Safety rails | Confirmation prompt | | |
| RBAC forbidden | Helpful denial | | |
| Email parity | Same behavior as WhatsApp | | |
| Template notification | Formatted message sent | | |

---

## Admin UI Verification

### Identity Management (`/admin/identity`)
- [ ] List all user identifiers with status
- [ ] Verify pending identifiers
- [ ] Revoke verified identifiers
- [ ] View quarantined messages
- [ ] Claim quarantined messages to users
- [ ] Reject quarantined messages

### Conversation History (`/admin/conversations`)
- [ ] Filter by user
- [ ] Filter by channel (WhatsApp/Email)
- [ ] View message history
- [ ] See context pointers (project, document, etc.)
- [ ] View tool calls made

### WhatsApp Templates (`/admin/whatsapp-templates`)
- [ ] List all templates
- [ ] Create new template
- [ ] View template status (approved/pending/rejected)
- [ ] Delete template
- [ ] Use pre-built templates

---

## Troubleshooting

### Issue: Messages not being received
1. Check WhatsApp webhook configuration
2. Verify signature verification is working
3. Check server logs for errors

### Issue: Unknown sender not quarantined
1. Verify `resolveIdentity()` is being called
2. Check `unclaimedInbound` table for entries
3. Verify safe response is being sent

### Issue: RBAC not enforced
1. Verify `executeWithRBAC()` is being used
2. Check user's project membership
3. Verify `createCaller()` context includes user

### Issue: Attachments not linking
1. Check S3 upload is working
2. Verify AI categorization response
3. Check `attachmentLinks` table for entries
