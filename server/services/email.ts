/**
 * Email Service
 * 
 * Handles sending emails via Resend API for:
 * - Password reset emails
 * - Work order status notifications
 * - Comment notifications
 */

import { ENV } from '../_core/env';

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send an email via Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = ENV.resendApiKey;
  
  if (!apiKey) {
    console.log('[Email] Resend API key not configured, logging email instead:');
    console.log(`  To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body: ${options.text || options.html.substring(0, 200)}...`);
    return { success: true, messageId: 'dev-mode-' + Date.now() };
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ENV.emailFromAddress,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Email] Failed to send email:', errorData);
      return { success: false, error: errorData.message || 'Failed to send email' };
    }
    
    const data = await response.json();
    console.log('[Email] Email sent successfully:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  portalBaseUrl: string = 'https://kiisha.io/portal'
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${portalBaseUrl}/reset-password?token=${resetToken}`;
  
  const template: EmailTemplate = {
    subject: 'Reset Your KIISHA Portal Password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">KIISHA</h1>
    <p style="color: #94a3b8; margin: 10px 0 0;">Customer Portal</p>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1e293b; margin-top: 0;">Reset Your Password</h2>
    
    <p>We received a request to reset your password for your KIISHA Customer Portal account.</p>
    
    <p>Click the button below to set a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
    </div>
    
    <p style="color: #64748b; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
    
    <p style="color: #64748b; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} KIISHA. All rights reserved.</p>
  </div>
</body>
</html>
    `,
    text: `
Reset Your KIISHA Portal Password

We received a request to reset your password for your KIISHA Customer Portal account.

Click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

© ${new Date().getFullYear()} KIISHA. All rights reserved.
    `,
  };
  
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send work order status update notification
 */
export async function sendWorkOrderStatusEmail(
  email: string,
  workOrderNumber: string,
  newStatus: string,
  siteName: string,
  portalBaseUrl: string = 'https://kiisha.io/portal'
): Promise<{ success: boolean; error?: string }> {
  const workOrderUrl = `${portalBaseUrl}/work-orders`;
  
  const statusColors: Record<string, string> = {
    submitted: '#3b82f6',
    acknowledged: '#8b5cf6',
    in_progress: '#f59e0b',
    pending_parts: '#ef4444',
    scheduled: '#06b6d4',
    resolved: '#10b981',
    closed: '#6b7280',
  };
  
  const statusLabels: Record<string, string> = {
    submitted: 'Submitted',
    acknowledged: 'Acknowledged',
    in_progress: 'In Progress',
    pending_parts: 'Pending Parts',
    scheduled: 'Scheduled',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  
  const statusColor = statusColors[newStatus] || '#6b7280';
  const statusLabel = statusLabels[newStatus] || newStatus;
  
  const template: EmailTemplate = {
    subject: `Work Order ${workOrderNumber} - Status Updated to ${statusLabel}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Work Order Update</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">KIISHA</h1>
    <p style="color: #94a3b8; margin: 10px 0 0;">Work Order Update</p>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1e293b; margin-top: 0;">Status Update</h2>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Work Order:</strong> ${workOrderNumber}</p>
      <p style="margin: 0 0 10px;"><strong>Site:</strong> ${siteName}</p>
      <p style="margin: 0;">
        <strong>New Status:</strong> 
        <span style="display: inline-block; background: ${statusColor}; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${statusLabel}</span>
      </p>
    </div>
    
    <p>Your work order status has been updated. Log in to the customer portal to view details and any comments from our team.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${workOrderUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Work Order</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
      You're receiving this email because you submitted a work order through the KIISHA Customer Portal.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} KIISHA. All rights reserved.</p>
  </div>
</body>
</html>
    `,
    text: `
Work Order ${workOrderNumber} - Status Updated

Your work order status has been updated.

Work Order: ${workOrderNumber}
Site: ${siteName}
New Status: ${statusLabel}

Log in to the customer portal to view details and any comments from our team:
${workOrderUrl}

© ${new Date().getFullYear()} KIISHA. All rights reserved.
    `,
  };
  
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send new comment notification
 */
export async function sendNewCommentEmail(
  email: string,
  workOrderNumber: string,
  commenterName: string,
  commentPreview: string,
  portalBaseUrl: string = 'https://kiisha.io/portal'
): Promise<{ success: boolean; error?: string }> {
  const workOrderUrl = `${portalBaseUrl}/work-orders`;
  
  // Truncate comment preview
  const preview = commentPreview.length > 200 
    ? commentPreview.substring(0, 200) + '...' 
    : commentPreview;
  
  const template: EmailTemplate = {
    subject: `New Comment on Work Order ${workOrderNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">KIISHA</h1>
    <p style="color: #94a3b8; margin: 10px 0 0;">New Comment</p>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1e293b; margin-top: 0;">New Comment Added</h2>
    
    <p>A new comment has been added to work order <strong>${workOrderNumber}</strong>.</p>
    
    <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 10px; font-weight: 600; color: #1e293b;">${commenterName}</p>
      <p style="margin: 0; color: #64748b;">${preview}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${workOrderUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Full Comment</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
      You're receiving this email because you have a work order in the KIISHA Customer Portal.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} KIISHA. All rights reserved.</p>
  </div>
</body>
</html>
    `,
    text: `
New Comment on Work Order ${workOrderNumber}

A new comment has been added to your work order.

From: ${commenterName}
"${preview}"

Log in to the customer portal to view the full comment and respond:
${workOrderUrl}

© ${new Date().getFullYear()} KIISHA. All rights reserved.
    `,
  };
  
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

/**
 * Send invoice payment confirmation
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  invoiceNumber: string,
  amount: number,
  currency: string = 'USD',
  portalBaseUrl: string = 'https://kiisha.io/portal'
): Promise<{ success: boolean; error?: string }> {
  const invoicesUrl = `${portalBaseUrl}/invoices`;
  
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100); // Assuming amount is in cents
  
  const template: EmailTemplate = {
    subject: `Payment Confirmed - Invoice ${invoiceNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
      <span style="font-size: 30px;">✓</span>
    </div>
    <h1 style="color: #fff; margin: 0; font-size: 24px;">Payment Confirmed</h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Thank you for your payment! Your transaction has been processed successfully.</p>
    
    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 10px;"><strong>Amount Paid:</strong> ${formattedAmount}</p>
      <p style="margin: 0;"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
    
    <p>You can view your invoice history and download receipts from the customer portal.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${invoicesUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">View Invoices</a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
    
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
      If you have any questions about this payment, please contact our support team.
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} KIISHA. All rights reserved.</p>
  </div>
</body>
</html>
    `,
    text: `
Payment Confirmed - Invoice ${invoiceNumber}

Thank you for your payment! Your transaction has been processed successfully.

Invoice: ${invoiceNumber}
Amount Paid: ${formattedAmount}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

You can view your invoice history and download receipts from the customer portal:
${invoicesUrl}

If you have any questions about this payment, please contact our support team.

© ${new Date().getFullYear()} KIISHA. All rights reserved.
    `,
  };
  
  return sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}
