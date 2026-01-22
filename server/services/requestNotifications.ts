/**
 * Request Notification Service
 * 
 * Handles email and in-app notifications for request lifecycle events:
 * - Request issued
 * - Submission received
 * - Clarification needed
 */

import { emailService } from "./emailService";
import * as db from "../db";

// Request notification types
export type RequestNotificationType = 
  | "request_issued"
  | "submission_received"
  | "clarification_needed"
  | "request_status_changed"
  | "comment_added";

interface NotificationRecipient {
  userId: number;
  email: string | null;
  name: string | null;
  emailEnabled?: boolean;
}

interface RequestNotificationData {
  requestId: number;
  requestTitle: string;
  templateName?: string;
  issuerOrgName?: string;
  recipientOrgName?: string;
  deadline?: Date;
  message?: string;
  actionUrl?: string;
  actorName?: string;
}

/**
 * Send request issued notification to recipients
 */
export async function notifyRequestIssued(
  recipients: NotificationRecipient[],
  data: RequestNotificationData,
  actorUserId: number,
  organizationId: number
): Promise<void> {
  const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
  const actionUrl = data.actionUrl || `${baseUrl}/requests/${data.requestId}`;
  
  for (const recipient of recipients) {
    // Create in-app notification
    await db.createNotificationEvent({
      organizationId,
      recipientUserId: recipient.userId,
      eventType: "STATUS_CHANGE",
      channel: "in_app",
      status: "sent",
      sentAt: new Date(),
      contentSnapshot: {
        subject: "New Request Received",
        body: `You have received a new request: "${data.requestTitle}" from ${data.issuerOrgName || "an organization"}`,
        templateData: {
          requestId: data.requestId,
          templateName: data.templateName,
          deadline: data.deadline?.toISOString(),
          actionUrl,
        },
      },
      createdAt: new Date(),
    });
    
    // Send email if enabled and email exists
    if (recipient.email && recipient.emailEnabled !== false) {
      try {
        await emailService.send({
          to: recipient.email,
          subject: `New Request: ${data.requestTitle}`,
          html: generateRequestIssuedEmailHtml(data, recipient, actionUrl),
          text: generateRequestIssuedEmailText(data, recipient, actionUrl),
        });
      } catch (error) {
        // Log email skip but don't fail
        await db.createAuditLog({
          userId: actorUserId,
          action: "email_skipped_error",
          entityType: "request",
          entityId: data.requestId,
          newValue: { 
            error: error instanceof Error ? error.message : "Unknown error",
            recipientEmail: recipient.email,
            organizationId,
          },
          createdAt: new Date(),
        });
      }
    } else if (!recipient.email) {
      // Log email skip due to no email
      await db.createAuditLog({
        userId: actorUserId,
        action: "email_skipped_no_email",
        entityType: "request",
        entityId: data.requestId,
        newValue: { recipientUserId: recipient.userId, organizationId },
        createdAt: new Date(),
      });
    }
  }
}

/**
 * Send submission received notification to issuer
 */
export async function notifySubmissionReceived(
  issuers: NotificationRecipient[],
  data: RequestNotificationData,
  actorUserId: number,
  organizationId: number
): Promise<void> {
  const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
  const actionUrl = data.actionUrl || `${baseUrl}/requests/${data.requestId}`;
  
  for (const issuer of issuers) {
    // Create in-app notification
    await db.createNotificationEvent({
      organizationId,
      recipientUserId: issuer.userId,
      eventType: "STATUS_CHANGE",
      channel: "in_app",
      status: "sent",
      sentAt: new Date(),
      contentSnapshot: {
        subject: "Submission Received",
        body: `${data.recipientOrgName || "A recipient"} has submitted a response to "${data.requestTitle}"`,
        templateData: {
          requestId: data.requestId,
          actionUrl,
        },
      },
      createdAt: new Date(),
    });
    
    // Send email if enabled
    if (issuer.email && issuer.emailEnabled !== false) {
      try {
        await emailService.send({
          to: issuer.email,
          subject: `Submission Received: ${data.requestTitle}`,
          html: generateSubmissionReceivedEmailHtml(data, issuer, actionUrl),
          text: generateSubmissionReceivedEmailText(data, issuer, actionUrl),
        });
      } catch (error) {
        await db.createAuditLog({
          userId: actorUserId,
          action: "email_skipped_error",
          entityType: "request",
          entityId: data.requestId,
          newValue: { 
            error: error instanceof Error ? error.message : "Unknown error",
            recipientEmail: issuer.email,
            organizationId,
          },
          createdAt: new Date(),
        });
      }
    }
  }
}

/**
 * Send clarification needed notification
 */
export async function notifyClarificationNeeded(
  recipients: NotificationRecipient[],
  data: RequestNotificationData,
  actorUserId: number,
  organizationId: number
): Promise<void> {
  const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
  const actionUrl = data.actionUrl || `${baseUrl}/requests/${data.requestId}`;
  
  for (const recipient of recipients) {
    // Create in-app notification
    await db.createNotificationEvent({
      organizationId,
      recipientUserId: recipient.userId,
      eventType: "COMMENT",
      channel: "in_app",
      status: "sent",
      sentAt: new Date(),
      contentSnapshot: {
        subject: "Clarification Requested",
        body: `${data.actorName || "The issuer"} has requested clarification on "${data.requestTitle}"`,
        templateData: {
          requestId: data.requestId,
          message: data.message,
          actionUrl,
        },
      },
      createdAt: new Date(),
    });
    
    // Send email if enabled
    if (recipient.email && recipient.emailEnabled !== false) {
      try {
        await emailService.send({
          to: recipient.email,
          subject: `Clarification Needed: ${data.requestTitle}`,
          html: generateClarificationEmailHtml(data, recipient, actionUrl),
          text: generateClarificationEmailText(data, recipient, actionUrl),
        });
      } catch (error) {
        await db.createAuditLog({
          userId: actorUserId,
          action: "email_skipped_error",
          entityType: "request",
          entityId: data.requestId,
          newValue: { 
            error: error instanceof Error ? error.message : "Unknown error",
            recipientEmail: recipient.email,
            organizationId,
          },
          createdAt: new Date(),
        });
      }
    }
  }
}

// Email template generators
function generateRequestIssuedEmailHtml(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  const deadlineText = data.deadline 
    ? `<p><strong>Deadline:</strong> ${data.deadline.toLocaleDateString()}</p>` 
    : "";
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>New Request</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Request Received</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${recipient.name || "there"},</p>
          <p>You have received a new information request from <strong>${data.issuerOrgName || "an organization"}</strong>.</p>
          
          <div style="background: white; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">${data.requestTitle}</h3>
            ${data.templateName ? `<p style="color: #666; margin: 0;">Template: ${data.templateName}</p>` : ""}
            ${deadlineText}
          </div>
          
          <a href="${actionUrl}" style="display: inline-block; background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Request</a>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This email was sent by KIISHA.</p>
        </div>
      </body>
    </html>
  `;
}

function generateRequestIssuedEmailText(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  const deadlineText = data.deadline 
    ? `Deadline: ${data.deadline.toLocaleDateString()}\n` 
    : "";
  
  return `
New Request Received

Hi ${recipient.name || "there"},

You have received a new information request from ${data.issuerOrgName || "an organization"}.

Request: ${data.requestTitle}
${data.templateName ? `Template: ${data.templateName}\n` : ""}${deadlineText}

View the request: ${actionUrl}

This email was sent by KIISHA.
  `.trim();
}

function generateSubmissionReceivedEmailHtml(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Submission Received</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Submission Received</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${recipient.name || "there"},</p>
          <p><strong>${data.recipientOrgName || "A recipient"}</strong> has submitted a response to your request.</p>
          
          <div style="background: white; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">${data.requestTitle}</h3>
          </div>
          
          <a href="${actionUrl}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review Submission</a>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This email was sent by KIISHA.</p>
        </div>
      </body>
    </html>
  `;
}

function generateSubmissionReceivedEmailText(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  return `
Submission Received

Hi ${recipient.name || "there"},

${data.recipientOrgName || "A recipient"} has submitted a response to your request.

Request: ${data.requestTitle}

Review the submission: ${actionUrl}

This email was sent by KIISHA.
  `.trim();
}

function generateClarificationEmailHtml(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  const messageBlock = data.message 
    ? `<blockquote style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; font-style: italic;">"${data.message}"</blockquote>` 
    : "";
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Clarification Needed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Clarification Requested</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hi ${recipient.name || "there"},</p>
          <p><strong>${data.actorName || "The issuer"}</strong> has requested clarification on your submission for:</p>
          
          <div style="background: white; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
            <h3 style="margin: 0;">${data.requestTitle}</h3>
          </div>
          
          ${messageBlock}
          
          <a href="${actionUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Respond to Request</a>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This email was sent by KIISHA.</p>
        </div>
      </body>
    </html>
  `;
}

function generateClarificationEmailText(
  data: RequestNotificationData,
  recipient: NotificationRecipient,
  actionUrl: string
): string {
  const messageText = data.message ? `\nMessage: "${data.message}"\n` : "";
  
  return `
Clarification Requested

Hi ${recipient.name || "there"},

${data.actorName || "The issuer"} has requested clarification on your submission for:

Request: ${data.requestTitle}
${messageText}
Respond to the request: ${actionUrl}

This email was sent by KIISHA.
  `.trim();
}
