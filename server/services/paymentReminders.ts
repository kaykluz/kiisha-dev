/**
 * Payment Reminder Service
 * 
 * Sends automated email reminders for overdue invoices at configurable intervals.
 * Supports escalation rules for severely overdue accounts.
 * 
 * WHO MANAGES THIS:
 * - Admin/Operator: Configures reminder intervals and escalation rules
 * - System: Automatically sends reminders on schedule
 * - Customer: Receives reminder emails (can opt-out via notification preferences)
 */

import { getDb } from '../db';
import { sql } from 'drizzle-orm';
import { sendEmail } from './email';

// Types
export interface ReminderConfig {
  id: number;
  organizationId?: number;
  reminderDays: string; // comma-separated: "7,14,30"
  escalationDays: number;
  escalationAction: 'none' | 'notify_admin' | 'suspend_service' | 'collections';
  isActive: boolean;
}

export interface ReminderLog {
  id: number;
  invoiceId: number;
  customerId: number;
  reminderType: 'first' | 'second' | 'third' | 'escalation' | 'final';
  daysPastDue: number;
  sentAt: Date;
  sentTo: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
}

/**
 * Process all overdue invoices and send reminders
 * Called by: System cron job (daily)
 */
export async function processPaymentReminders(): Promise<{
  processed: number;
  remindersSent: number;
  escalations: number;
  errors: number;
}> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get reminder configuration
  const [configs] = await db.execute(sql`
    SELECT * FROM payment_reminder_config WHERE isActive = TRUE LIMIT 1
  `);
  
  const config = (configs as ReminderConfig[])[0];
  if (!config) {
    console.log('[PaymentReminders] No active reminder configuration found');
    return { processed: 0, remindersSent: 0, escalations: 0, errors: 0 };
  }

  const reminderDays = config.reminderDays.split(',').map(d => parseInt(d.trim()));
  
  // Find all overdue invoices
  const [overdueInvoices] = await db.execute(sql`
    SELECT i.*, c.companyName, cu.email as customerEmail, cu.firstName, cu.lastName
    FROM invoices i
    JOIN customers c ON i.customerId = c.id
    LEFT JOIN customerUsers cu ON cu.customerId = c.id AND cu.role = 'owner'
    WHERE i.status IN ('pending', 'overdue')
    AND i.dueDate < CURDATE()
    ORDER BY i.dueDate ASC
  `);

  const invoices = overdueInvoices as any[];
  let remindersSent = 0;
  let escalations = 0;
  let errors = 0;

  for (const invoice of invoices) {
    try {
      const daysPastDue = Math.floor(
        (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if customer has opted out of payment reminders
      const [prefs] = await db.execute(sql`
        SELECT emailPaymentReminder FROM customer_notification_preferences
        WHERE customerUserId = (
          SELECT id FROM customerUsers WHERE customerId = ${invoice.customerId} LIMIT 1
        )
      `);
      
      const preferences = (prefs as any[])[0];
      if (preferences && preferences.emailPaymentReminder === false) {
        continue; // Customer opted out
      }

      // Check what reminders have already been sent
      const [sentReminders] = await db.execute(sql`
        SELECT reminderType, daysPastDue FROM payment_reminder_log
        WHERE invoiceId = ${invoice.id}
        ORDER BY sentAt DESC
      `);
      
      const sentList = sentReminders as any[];
      const sentTypes = new Set(sentList.map(r => r.reminderType));

      // Determine which reminder to send
      let reminderToSend: { type: string; days: number } | null = null;

      // Check escalation first
      if (daysPastDue >= config.escalationDays && !sentTypes.has('escalation')) {
        reminderToSend = { type: 'escalation', days: daysPastDue };
      } else {
        // Check regular reminders
        for (let i = 0; i < reminderDays.length; i++) {
          const days = reminderDays[i];
          const type = i === 0 ? 'first' : i === 1 ? 'second' : 'third';
          
          if (daysPastDue >= days && !sentTypes.has(type)) {
            reminderToSend = { type, days: daysPastDue };
            break;
          }
        }
      }

      if (reminderToSend && invoice.customerEmail) {
        await sendPaymentReminder({
          invoice,
          reminderType: reminderToSend.type as any,
          daysPastDue: reminderToSend.days,
          config
        });
        
        if (reminderToSend.type === 'escalation') {
          escalations++;
          await handleEscalation(invoice, config);
        } else {
          remindersSent++;
        }
      }
    } catch (error) {
      console.error(`[PaymentReminders] Error processing invoice ${invoice.id}:`, error);
      errors++;
    }
  }

  console.log(`[PaymentReminders] Processed ${invoices.length} invoices, sent ${remindersSent} reminders, ${escalations} escalations, ${errors} errors`);
  
  return {
    processed: invoices.length,
    remindersSent,
    escalations,
    errors
  };
}

/**
 * Send a payment reminder email
 */
async function sendPaymentReminder(params: {
  invoice: any;
  reminderType: 'first' | 'second' | 'third' | 'escalation' | 'final';
  daysPastDue: number;
  config: ReminderConfig;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const { invoice, reminderType, daysPastDue } = params;
  
  // Generate email content based on reminder type
  const subject = getSubjectLine(reminderType, invoice.invoiceNumber, daysPastDue);
  const html = generateReminderEmail(invoice, reminderType, daysPastDue);

  // Send email
  const result = await sendEmail({
    to: invoice.customerEmail,
    subject,
    html
  });

  // Log the reminder
  await db.execute(sql`
    INSERT INTO payment_reminder_log (
      invoiceId, customerId, reminderType, daysPastDue, sentTo, status
    ) VALUES (
      ${invoice.id},
      ${invoice.customerId},
      ${reminderType},
      ${daysPastDue},
      ${invoice.customerEmail},
      ${result.success ? 'sent' : 'failed'}
    )
  `);

  // Update invoice status to overdue if not already
  if (invoice.status !== 'overdue') {
    await db.execute(sql`
      UPDATE invoices SET status = 'overdue' WHERE id = ${invoice.id}
    `);
  }

  console.log(`[PaymentReminders] Sent ${reminderType} reminder for invoice ${invoice.id} to ${invoice.customerEmail}`);
}

/**
 * Handle escalation actions
 */
async function handleEscalation(invoice: any, config: ReminderConfig): Promise<void> {
  const db = await getDb();
  if (!db) return;

  switch (config.escalationAction) {
    case 'notify_admin':
      // Send notification to admin/owner
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@kiisha.com',
        subject: `[ESCALATION] Severely Overdue Invoice ${invoice.invoiceNumber}`,
        html: `
          <h2>Invoice Escalation Alert</h2>
          <p>Invoice ${invoice.invoiceNumber} is severely overdue and requires attention.</p>
          <ul>
            <li><strong>Customer:</strong> ${invoice.companyName}</li>
            <li><strong>Amount:</strong> $${(invoice.total / 100).toFixed(2)}</li>
            <li><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</li>
            <li><strong>Days Overdue:</strong> ${Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))}</li>
          </ul>
          <p>Please review and take appropriate action.</p>
        `
      });
      break;

    case 'suspend_service':
      // Flag customer for service suspension
      await db.execute(sql`
        UPDATE customers SET status = 'suspended' WHERE id = ${invoice.customerId}
      `);
      console.log(`[PaymentReminders] Suspended service for customer ${invoice.customerId}`);
      break;

    case 'collections':
      // Flag for collections
      await db.execute(sql`
        UPDATE invoices SET notes = CONCAT(IFNULL(notes, ''), '\n[COLLECTIONS] Flagged for collections on ', NOW())
        WHERE id = ${invoice.id}
      `);
      console.log(`[PaymentReminders] Flagged invoice ${invoice.id} for collections`);
      break;
  }
}

function getSubjectLine(type: string, invoiceNumber: string, daysPastDue: number): string {
  switch (type) {
    case 'first':
      return `Payment Reminder: Invoice ${invoiceNumber} is past due`;
    case 'second':
      return `Second Notice: Invoice ${invoiceNumber} - ${daysPastDue} days overdue`;
    case 'third':
      return `Urgent: Invoice ${invoiceNumber} requires immediate attention`;
    case 'escalation':
      return `Final Notice: Invoice ${invoiceNumber} - Account at risk`;
    default:
      return `Payment Reminder: Invoice ${invoiceNumber}`;
  }
}

function generateReminderEmail(invoice: any, type: string, daysPastDue: number): string {
  const amount = (invoice.total / 100).toFixed(2);
  const dueDate = new Date(invoice.dueDate).toLocaleDateString();
  const customerName = invoice.firstName ? `${invoice.firstName}` : 'Valued Customer';
  
  const urgencyLevel = type === 'escalation' ? 'critical' : 
                       type === 'third' ? 'high' :
                       type === 'second' ? 'medium' : 'normal';

  const urgencyColor = urgencyLevel === 'critical' ? '#dc2626' :
                       urgencyLevel === 'high' ? '#ea580c' :
                       urgencyLevel === 'medium' ? '#d97706' : '#f97316';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${urgencyColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .amount { font-size: 32px; font-weight: bold; color: ${urgencyColor}; }
    .btn { display: inline-block; background: ${urgencyColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${type === 'escalation' ? '⚠️ Final Notice' : type === 'third' ? '⚠️ Urgent Reminder' : '📋 Payment Reminder'}</h1>
    </div>
    <div class="content">
      <p>Dear ${customerName},</p>
      
      ${type === 'first' ? `
        <p>This is a friendly reminder that your invoice is now past due. We kindly request that you process this payment at your earliest convenience.</p>
      ` : type === 'second' ? `
        <p>We noticed that payment for the invoice below has not been received. This is your second reminder. Please arrange payment as soon as possible to avoid any service interruptions.</p>
      ` : type === 'third' ? `
        <p><strong>This is an urgent notice.</strong> Your invoice is now ${daysPastDue} days overdue. Immediate payment is required to prevent account suspension.</p>
      ` : `
        <p><strong>FINAL NOTICE:</strong> Despite our previous reminders, we have not received payment for the invoice below. Your account is now at risk of service suspension and may be referred to collections.</p>
      `}
      
      <div class="invoice-details">
        <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Original Due Date:</strong> ${dueDate}</p>
        <p><strong>Days Overdue:</strong> ${daysPastDue} days</p>
        <p class="amount">Amount Due: $${amount}</p>
      </div>
      
      <p>To make a payment, please log in to your customer portal or contact our billing department.</p>
      
      <center>
        <a href="${process.env.VITE_APP_URL || 'https://kiisha.com'}/portal/invoices" class="btn">
          Pay Now
        </a>
      </center>
      
      <p style="margin-top: 30px;">If you have already made this payment, please disregard this notice and accept our thanks.</p>
      
      <p>If you have any questions or need to discuss payment arrangements, please contact us at billing@kiisha.com.</p>
      
      <p>Thank you for your prompt attention to this matter.</p>
      
      <p>Best regards,<br>KIISHA Billing Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message from KIISHA. Please do not reply directly to this email.</p>
      <p>To manage your notification preferences, visit your <a href="${process.env.VITE_APP_URL || 'https://kiisha.com'}/portal/settings">account settings</a>.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get reminder configuration
 * Called by: Admin Dashboard → Settings → Payment Reminders
 */
export async function getReminderConfig(organizationId?: number): Promise<ReminderConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const [configs] = await db.execute(sql`
    SELECT * FROM payment_reminder_config
    WHERE organizationId IS NULL OR organizationId = ${organizationId || null}
    ORDER BY organizationId DESC
    LIMIT 1
  `);

  return (configs as ReminderConfig[])[0] || null;
}

/**
 * Update reminder configuration
 * Called by: Admin Dashboard → Settings → Payment Reminders
 */
export async function updateReminderConfig(params: {
  organizationId?: number;
  reminderDays: number[];
  escalationDays: number;
  escalationAction: 'none' | 'notify_admin' | 'suspend_service' | 'collections';
  isActive: boolean;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const reminderDaysStr = params.reminderDays.join(',');

  await db.execute(sql`
    INSERT INTO payment_reminder_config (
      organizationId, reminderDays, escalationDays, escalationAction, isActive
    ) VALUES (
      ${params.organizationId || null},
      ${reminderDaysStr},
      ${params.escalationDays},
      ${params.escalationAction},
      ${params.isActive}
    )
    ON DUPLICATE KEY UPDATE
      reminderDays = ${reminderDaysStr},
      escalationDays = ${params.escalationDays},
      escalationAction = ${params.escalationAction},
      isActive = ${params.isActive},
      updatedAt = NOW()
  `);

  console.log('[PaymentReminders] Updated reminder configuration');
}

/**
 * Get reminder history for an invoice
 */
export async function getReminderHistory(invoiceId: number): Promise<ReminderLog[]> {
  const db = await getDb();
  if (!db) return [];

  const [logs] = await db.execute(sql`
    SELECT * FROM payment_reminder_log
    WHERE invoiceId = ${invoiceId}
    ORDER BY sentAt DESC
  `);

  return logs as ReminderLog[];
}

/**
 * Manually trigger a reminder for a specific invoice
 * Called by: Admin Dashboard → Invoices → Send Reminder
 */
export async function sendManualReminder(invoiceId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: 'Database not available' };

  try {
    const [invoices] = await db.execute(sql`
      SELECT i.*, c.companyName, cu.email as customerEmail, cu.firstName, cu.lastName
      FROM invoices i
      JOIN customers c ON i.customerId = c.id
      LEFT JOIN customerUsers cu ON cu.customerId = c.id AND cu.role = 'owner'
      WHERE i.id = ${invoiceId}
    `);

    const invoice = (invoices as any[])[0];
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (!invoice.customerEmail) {
      return { success: false, error: 'Customer email not found' };
    }

    const daysPastDue = Math.max(0, Math.floor(
      (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    ));

    const [configs] = await db.execute(sql`
      SELECT * FROM payment_reminder_config WHERE isActive = TRUE LIMIT 1
    `);
    const config = (configs as ReminderConfig[])[0] || {
      reminderDays: '7,14,30',
      escalationDays: 60,
      escalationAction: 'notify_admin',
      isActive: true
    };

    await sendPaymentReminder({
      invoice,
      reminderType: 'first',
      daysPastDue,
      config: config as ReminderConfig
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
