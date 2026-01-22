/**
 * Diligence Notification Service
 * Handles email notifications for response submissions, approvals, and update pushes
 */

import { notifyOwner } from "../_core/notification";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

interface NotificationContext {
  responseName: string;
  companyName: string;
  templateName: string;
  responseId: number;
}

interface RecipientInfo {
  name: string;
  email?: string;
  type: string;
}

/**
 * Notify when a response is submitted for review
 */
export async function notifyResponseSubmitted(
  context: NotificationContext,
  submittedBy: { id: number; name: string }
): Promise<boolean> {
  const title = `📋 Response Submitted: ${context.templateName}`;
  const content = `
**Response Submitted for Review**

A diligence response has been submitted and is awaiting review.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Submitted by: ${submittedBy.name}
- Response ID: ${context.responseId}

Please review the submission at your earliest convenience.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when a response is approved
 */
export async function notifyResponseApproved(
  context: NotificationContext,
  approvedBy: { id: number; name: string }
): Promise<boolean> {
  const title = `✅ Response Approved: ${context.templateName}`;
  const content = `
**Response Approved**

A diligence response has been approved.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Approved by: ${approvedBy.name}
- Response ID: ${context.responseId}

The response is now ready to be shared with external parties.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when a response is rejected
 */
export async function notifyResponseRejected(
  context: NotificationContext,
  rejectedBy: { id: number; name: string },
  reason?: string
): Promise<boolean> {
  const title = `❌ Response Rejected: ${context.templateName}`;
  const content = `
**Response Rejected**

A diligence response has been rejected and requires revision.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Rejected by: ${rejectedBy.name}
- Response ID: ${context.responseId}
${reason ? `- Reason: ${reason}` : ""}

Please review the feedback and resubmit.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when a response is shared with external party
 */
export async function notifyResponseShared(
  context: NotificationContext,
  recipient: RecipientInfo,
  sharedBy: { id: number; name: string }
): Promise<boolean> {
  const title = `🔗 Response Shared: ${context.templateName}`;
  const content = `
**Response Shared with External Party**

A diligence response has been shared.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Shared by: ${sharedBy.name}
- Response ID: ${context.responseId}

**Recipient:**
- Name: ${recipient.name}
- Type: ${recipient.type}
${recipient.email ? `- Email: ${recipient.email}` : ""}

A snapshot of the data has been locked and shared.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when an update is pushed to a shared submission
 */
export async function notifyUpdatePushed(
  context: NotificationContext,
  recipient: RecipientInfo,
  fieldName: string,
  oldValue: string,
  newValue: string,
  pushedBy: { id: number; name: string }
): Promise<boolean> {
  const title = `🔄 Update Pushed: ${context.templateName}`;
  const content = `
**Update Pushed to Shared Submission**

An update has been pushed to a previously shared response.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Pushed by: ${pushedBy.name}

**Update:**
- Field: ${fieldName}
- Previous Value: ${oldValue || "(empty)"}
- New Value: ${newValue}

**Recipient:**
- Name: ${recipient.name}
- Type: ${recipient.type}

The recipient will need to accept or reject this update.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when an update push is accepted
 */
export async function notifyUpdateAccepted(
  context: NotificationContext,
  recipient: RecipientInfo,
  fieldName: string
): Promise<boolean> {
  const title = `✅ Update Accepted: ${context.templateName}`;
  const content = `
**Update Accepted by Recipient**

An update push has been accepted.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Field Updated: ${fieldName}

**Recipient:**
- Name: ${recipient.name}
- Type: ${recipient.type}

The shared submission has been updated with the new value.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify when an update push is rejected
 */
export async function notifyUpdateRejected(
  context: NotificationContext,
  recipient: RecipientInfo,
  fieldName: string,
  reason?: string
): Promise<boolean> {
  const title = `❌ Update Rejected: ${context.templateName}`;
  const content = `
**Update Rejected by Recipient**

An update push has been rejected.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}
- Field: ${fieldName}
${reason ? `- Reason: ${reason}` : ""}

**Recipient:**
- Name: ${recipient.name}
- Type: ${recipient.type}

The shared submission retains the original value.
  `.trim();

  return notifyOwner({ title, content });
}

/**
 * Notify sender about stale data in submitted response
 */
export async function notifySenderStaleData(
  context: NotificationContext,
  fieldName: string,
  submittedValue: string,
  currentValue: string,
  canPushUpdate: boolean
): Promise<boolean> {
  const title = `⚠️ Stale Data Alert: ${context.templateName}`;
  const content = `
**Stale Data Detected in Shared Submission**

The data in a shared submission differs from the current value.

**Details:**
- Template: ${context.templateName}
- Company: ${context.companyName}
- Response: ${context.responseName}

**Data Difference:**
- Field: ${fieldName}
- Submitted Value: ${submittedValue || "(empty)"}
- Current Value: ${currentValue}

${canPushUpdate 
  ? "You can push an update to the recipient with the current value."
  : "The submission timeline has closed. Updates cannot be pushed."}
  `.trim();

  return notifyOwner({ title, content });
}
