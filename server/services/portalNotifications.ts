/**
 * Portal Email Notifications Service
 * 
 * Sends automated email notifications to customers for:
 * - Work order status changes
 * - New invoice creation
 * - Payment confirmations
 * - Work order comments from support
 */

import { getDb } from '../db';
import { customers, customerUsers, invoices, invoiceLineItems } from '../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { sendEmail, EmailOptions } from './email';

// Email template types
type NotificationType = 
  | 'work_order_status_change'
  | 'work_order_comment'
  | 'new_invoice'
  | 'payment_confirmation'
  | 'password_reset';

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// WORK ORDER NOTIFICATIONS
// ============================================

interface WorkOrderStatusChangeParams {
  workOrderId: number;
  customerId: number;
  oldStatus: string;
  newStatus: string;
  workOrderTitle: string;
  workOrderReference: string;
  portalUrl?: string;
}

export async function sendWorkOrderStatusChangeEmail(
  params: WorkOrderStatusChangeParams
): Promise<NotificationResult> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    // Get customer details
    const [customer] = await db.select().from(customers).where(eq(customers.id, params.customerId)).limit(1);
    if (!customer?.email) {
      return { success: false, error: 'Customer email not found' };
    }
    
    // Get customer user for personalization
    const [customerUser] = await db.select()
      .from(customerUsers)
      .where(eq(customerUsers.customerId, params.customerId))
      .limit(1);
    
    const customerName = customerUser?.name || customer.name || 'Valued Customer';
    const portalUrl = params.portalUrl || process.env.VITE_APP_URL || 'https://portal.kiisha.com';
    
    // Status display names
    const statusLabels: Record<string, string> = {
      submitted: 'Submitted',
      acknowledged: 'Acknowledged',
      in_progress: 'In Progress',
      scheduled: 'Scheduled',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    
    const newStatusLabel = statusLabels[params.newStatus] || params.newStatus;
    
    // Build email content
    const subject = `Work Order Update: ${params.workOrderTitle} - ${newStatusLabel}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Work Order Status Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">Work Order Update</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
                Hi ${customerName},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46;">
                Your work order has been updated to <strong style="color: #f97316;">${newStatusLabel}</strong>.
              </p>
              
              <!-- Work Order Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Reference Number</p>
                    <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #18181b;">${params.workOrderReference}</p>
                    
                    <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Title</p>
                    <p style="margin: 0; font-size: 16px; color: #18181b;">${params.workOrderTitle}</p>
                  </td>
                </tr>
              </table>
              
              ${getStatusMessage(params.newStatus)}
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #f97316;">
                    <a href="${portalUrl}/portal/work-orders/${params.workOrderId}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      View Work Order
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                If you have any questions, please reply to this email or add a comment on your work order.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                This is an automated message from KIISHA Solar Management Platform.
                <br>
                © ${new Date().getFullYear()} KIISHA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });
    
    return { success: result.success, messageId: result.messageId, error: result.error };
  } catch (error) {
    console.error('[PortalNotifications] Work order status email error:', error);
    return { success: false, error: String(error) };
  }
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    acknowledged: `
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Our team has acknowledged your work order and will begin reviewing it shortly.
      </p>
    `,
    in_progress: `
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Great news! Our technicians are now actively working on your request.
      </p>
    `,
    scheduled: `
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Your work order has been scheduled. A technician will arrive at the scheduled time.
      </p>
    `,
    completed: `
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Your work order has been completed. Please review the details and let us know if you have any questions.
      </p>
    `,
    cancelled: `
      <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
        Your work order has been cancelled. If this was unexpected, please contact our support team.
      </p>
    `,
  };
  
  return messages[status] || '';
}

// ============================================
// WORK ORDER COMMENT NOTIFICATIONS
// ============================================

interface WorkOrderCommentParams {
  workOrderId: number;
  customerId: number;
  workOrderTitle: string;
  workOrderReference: string;
  commentAuthor: string;
  commentContent: string;
  portalUrl?: string;
}

export async function sendWorkOrderCommentEmail(
  params: WorkOrderCommentParams
): Promise<NotificationResult> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    // Get customer details
    const [customer] = await db.select().from(customers).where(eq(customers.id, params.customerId)).limit(1);
    if (!customer?.email) {
      return { success: false, error: 'Customer email not found' };
    }
    
    // Get customer user for personalization
    const [customerUser] = await db.select()
      .from(customerUsers)
      .where(eq(customerUsers.customerId, params.customerId))
      .limit(1);
    
    const customerName = customerUser?.name || customer.name || 'Valued Customer';
    const portalUrl = params.portalUrl || process.env.VITE_APP_URL || 'https://portal.kiisha.com';
    
    const subject = `New Comment on Work Order: ${params.workOrderTitle}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">New Comment</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
                Hi ${customerName},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46;">
                <strong>${params.commentAuthor}</strong> added a comment to your work order.
              </p>
              
              <!-- Comment Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Work Order: ${params.workOrderReference}</p>
                    <p style="margin: 0; font-size: 16px; color: #18181b; white-space: pre-wrap;">${params.commentContent}</p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #f97316;">
                    <a href="${portalUrl}/portal/work-orders/${params.workOrderId}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      View & Reply
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                © ${new Date().getFullYear()} KIISHA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });
    
    return { success: result.success, messageId: result.messageId, error: result.error };
  } catch (error) {
    console.error('[PortalNotifications] Work order comment email error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// INVOICE NOTIFICATIONS
// ============================================

interface NewInvoiceParams {
  invoiceId: number;
  customerId: number;
  portalUrl?: string;
}

export async function sendNewInvoiceEmail(
  params: NewInvoiceParams
): Promise<NotificationResult> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    // Get invoice details
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, params.invoiceId)).limit(1);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    
    // Get customer details
    const [customer] = await db.select().from(customers).where(eq(customers.id, params.customerId)).limit(1);
    if (!customer?.email) {
      return { success: false, error: 'Customer email not found' };
    }
    
    // Get customer user for personalization
    const [customerUser] = await db.select()
      .from(customerUsers)
      .where(eq(customerUsers.customerId, params.customerId))
      .limit(1);
    
    const customerName = customerUser?.name || customer.name || 'Valued Customer';
    const portalUrl = params.portalUrl || process.env.VITE_APP_URL || 'https://portal.kiisha.com';
    
    // Get line items
    const lineItems = await db.select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, params.invoiceId));
    
    // Format currency
    const formatCurrency = (amount: number, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount / 100);
    };
    
    const formatDate = (date: Date | string | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };
    
    const totalAmount = Number(invoice.totalAmount) || 0;
    const dueDate = formatDate(invoice.dueDate);
    
    const subject = `New Invoice ${invoice.invoiceNumber} - ${formatCurrency(totalAmount, invoice.currency || 'USD')}`;
    
    // Build line items HTML
    let lineItemsHtml = '';
    for (const item of lineItems) {
      const lineTotal = Number(item.quantity) * Number(item.unitPrice);
      lineItemsHtml += `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #3f3f46;">${item.description}</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; font-size: 14px; color: #3f3f46; text-align: right;">${formatCurrency(lineTotal, invoice.currency || 'USD')}</td>
        </tr>
      `;
    }
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">New Invoice</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
                Hi ${customerName},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46;">
                A new invoice has been generated for your account.
              </p>
              
              <!-- Invoice Summary Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Invoice Number</p>
                          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 600; color: #18181b;">${invoice.invoiceNumber}</p>
                        </td>
                        <td style="padding-bottom: 12px; text-align: right;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Amount Due</p>
                          <p style="margin: 4px 0 0; font-size: 24px; font-weight: 700; color: #f97316;">${formatCurrency(totalAmount, invoice.currency || 'USD')}</p>
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding-top: 12px; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Due Date</p>
                          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 500; color: #18181b;">${dueDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Line Items -->
              ${lineItems.length > 0 ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 2px solid #18181b; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase;">Description</td>
                  <td style="padding: 12px 0; border-bottom: 2px solid #18181b; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; text-align: right;">Amount</td>
                </tr>
                ${lineItemsHtml}
                <tr>
                  <td style="padding: 16px 0; font-size: 16px; font-weight: 600; color: #18181b;">Total</td>
                  <td style="padding: 16px 0; font-size: 16px; font-weight: 600; color: #18181b; text-align: right;">${formatCurrency(totalAmount, invoice.currency || 'USD')}</td>
                </tr>
              </table>
              ` : ''}
              
              <!-- CTA Buttons -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #f97316;">
                    <a href="${portalUrl}/portal/invoices/${params.invoiceId}" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      View Invoice
                    </a>
                  </td>
                  <td style="width: 12px;"></td>
                  <td style="border-radius: 6px; border: 2px solid #f97316;">
                    <a href="${portalUrl}/portal/invoices/${params.invoiceId}?action=pay" style="display: inline-block; padding: 10px 22px; font-size: 16px; font-weight: 600; color: #f97316; text-decoration: none;">
                      Pay Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; font-size: 14px; color: #71717a;">
                If you have any questions about this invoice, please contact our billing team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                © ${new Date().getFullYear()} KIISHA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });
    
    return { success: result.success, messageId: result.messageId, error: result.error };
  } catch (error) {
    console.error('[PortalNotifications] New invoice email error:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// PAYMENT CONFIRMATION NOTIFICATIONS
// ============================================

interface PaymentConfirmationParams {
  invoiceId: number;
  customerId: number;
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber: string;
  portalUrl?: string;
}

export async function sendPaymentConfirmationEmail(
  params: PaymentConfirmationParams
): Promise<NotificationResult> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };
  
  try {
    // Get invoice details
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, params.invoiceId)).limit(1);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    
    // Get customer details
    const [customer] = await db.select().from(customers).where(eq(customers.id, params.customerId)).limit(1);
    if (!customer?.email) {
      return { success: false, error: 'Customer email not found' };
    }
    
    // Get customer user for personalization
    const [customerUser] = await db.select()
      .from(customerUsers)
      .where(eq(customerUsers.customerId, params.customerId))
      .limit(1);
    
    const customerName = customerUser?.name || customer.name || 'Valued Customer';
    const portalUrl = params.portalUrl || process.env.VITE_APP_URL || 'https://portal.kiisha.com';
    
    // Format currency
    const formatCurrency = (amount: number, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount / 100);
    };
    
    const subject = `Payment Received - ${formatCurrency(params.paymentAmount, invoice.currency || 'USD')}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Success Icon -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e4e4e7;">
              <div style="width: 64px; height: 64px; margin: 0 auto 16px; background-color: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px; color: white;">✓</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #18181b;">Payment Received</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; font-size: 16px; color: #3f3f46;">
                Hi ${customerName},
              </p>
              
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46;">
                Thank you for your payment. We've received your payment and updated your account.
              </p>
              
              <!-- Payment Details Card -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 16px;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Amount Paid</p>
                          <p style="margin: 4px 0 0; font-size: 28px; font-weight: 700; color: #22c55e;">${formatCurrency(params.paymentAmount, invoice.currency || 'USD')}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Invoice Number</p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #18181b;">${invoice.invoiceNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Reference Number</p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #18181b;">${params.referenceNumber}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Payment Method</p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #18181b;">${params.paymentMethod}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-top: 1px solid #e4e4e7;">
                          <p style="margin: 0; font-size: 14px; color: #71717a;">Date</p>
                          <p style="margin: 4px 0 0; font-size: 16px; color: #18181b;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td style="border-radius: 6px; background-color: #f97316;">
                    <a href="${portalUrl}/portal/payments" style="display: inline-block; padding: 12px 24px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                      View Payment History
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #e4e4e7; background-color: #fafafa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                © ${new Date().getFullYear()} KIISHA. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    
    const result = await sendEmail({
      to: customer.email,
      subject,
      html,
    });
    
    return { success: result.success, messageId: result.messageId, error: result.error };
  } catch (error) {
    console.error('[PortalNotifications] Payment confirmation email error:', error);
    return { success: false, error: String(error) };
  }
}
