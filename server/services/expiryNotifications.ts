/**
 * Expiry Notifications Service
 * Handles automated email notifications for expiring documents and items
 */

import { getDb } from "../db";
import { 
  expiryRecords, 
  requirementItems,
  users,
  companyProfiles
} from "../../drizzle/schema";
import { eq, and, or, lte, gte, sql, isNull, inArray } from "drizzle-orm";
import { sendEmail } from "./email";

// Notification intervals in days
export const NOTIFICATION_INTERVALS = [30, 14, 7, 3, 1, 0] as const;

export interface ExpiryNotificationConfig {
  organizationId: number;
  enabledIntervals: number[]; // Days before expiry to send notifications
  notifyOwner: boolean;
  notifyAssignee: boolean;
  notifyAdmins: boolean;
  emailTemplate?: string;
}

export interface ExpiryNotificationLog {
  id: number;
  expiryRecordId: number;
  notificationType: 'warning' | 'due_soon' | 'overdue';
  daysUntilExpiry: number;
  recipientEmail: string;
  sentAt: Date;
  status: 'sent' | 'failed';
  errorMessage?: string;
}

/**
 * Get items expiring within specified days
 */
export async function getExpiringItems(organizationId: number, daysFromNow: number) {
  const db = await getDb();
  if (!db) return [];
  
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysFromNow);
  
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const items = await db.select({
    expiryRecord: expiryRecords,
    requirement: requirementItems
  })
    .from(expiryRecords)
    .leftJoin(requirementItems, eq(expiryRecords.requirementItemId, requirementItems.id))
    .where(and(
      eq(expiryRecords.organizationId, organizationId),
      or(
        eq(expiryRecords.status, "valid"),
        eq(expiryRecords.status, "due_soon")
      ),
      gte(expiryRecords.expiresAt, startOfDay),
      lte(expiryRecords.expiresAt, endOfDay)
    ));
  
  return items;
}

/**
 * Get all overdue items
 */
export async function getOverdueItems(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  const items = await db.select({
    expiryRecord: expiryRecords,
    requirement: requirementItems
  })
    .from(expiryRecords)
    .leftJoin(requirementItems, eq(expiryRecords.requirementItemId, requirementItems.id))
    .where(and(
      eq(expiryRecords.organizationId, organizationId),
      eq(expiryRecords.status, "overdue"),
      lte(expiryRecords.expiresAt, now)
    ));
  
  return items;
}

/**
 * Generate email content for expiry notification
 */
export function generateExpiryEmailContent(
  itemTitle: string,
  entityName: string,
  expiryDate: Date,
  daysUntilExpiry: number,
  renewalUrl: string
): { subject: string; html: string; text: string } {
  const formattedDate = expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  let urgencyLevel: string;
  let urgencyColor: string;
  
  if (daysUntilExpiry <= 0) {
    urgencyLevel = "OVERDUE";
    urgencyColor = "#dc2626"; // red
  } else if (daysUntilExpiry <= 7) {
    urgencyLevel = "URGENT";
    urgencyColor = "#ea580c"; // orange
  } else if (daysUntilExpiry <= 14) {
    urgencyLevel = "WARNING";
    urgencyColor = "#ca8a04"; // amber
  } else {
    urgencyLevel = "REMINDER";
    urgencyColor = "#2563eb"; // blue
  }
  
  const subject = `[${urgencyLevel}] ${itemTitle} ${daysUntilExpiry <= 0 ? 'has expired' : `expires in ${daysUntilExpiry} days`} - ${entityName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">
      <span style="color: ${urgencyColor};">●</span> Expiry ${daysUntilExpiry <= 0 ? 'Alert' : 'Reminder'}
    </h1>
  </div>
  
  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <div style="background: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; font-weight: 600; color: ${urgencyColor};">
        ${daysUntilExpiry <= 0 
          ? `This item has expired!` 
          : daysUntilExpiry === 1 
            ? `This item expires tomorrow!`
            : `This item expires in ${daysUntilExpiry} days`}
      </p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 120px;">Item</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${itemTitle}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Entity</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${entityName}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Expiry Date</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: ${urgencyColor}; font-weight: 600;">${formattedDate}</td>
      </tr>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${renewalUrl}" style="display: inline-block; background: #f97316; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600;">
        Submit Renewal →
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      This is an automated notification from KIISHA. Please ensure all required documents are renewed before the expiry date to maintain compliance.
    </p>
  </div>
</body>
</html>
  `.trim();
  
  const text = `
${urgencyLevel}: ${itemTitle} ${daysUntilExpiry <= 0 ? 'has expired' : `expires in ${daysUntilExpiry} days`}

Item: ${itemTitle}
Entity: ${entityName}
Expiry Date: ${formattedDate}

Please submit your renewal at: ${renewalUrl}

This is an automated notification from KIISHA.
  `.trim();
  
  return { subject, html, text };
}

/**
 * Send expiry notification email
 */
export async function sendExpiryNotification(
  recipientEmail: string,
  itemTitle: string,
  entityName: string,
  expiryDate: Date,
  daysUntilExpiry: number,
  renewalUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { subject, html, text } = generateExpiryEmailContent(
      itemTitle,
      entityName,
      expiryDate,
      daysUntilExpiry,
      renewalUrl
    );
    
    await sendEmail({
      to: recipientEmail,
      subject,
      html,
      text
    });
    
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to send expiry notification to ${recipientEmail}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Process all expiry notifications for an organization
 * This should be called daily by a cron job
 */
export async function processExpiryNotifications(
  organizationId: number,
  config: ExpiryNotificationConfig,
  baseUrl: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  const db = await getDb();
  if (!db) {
    results.errors.push("Database not available");
    return results;
  }
  
  // Get admin users for the organization
  const adminUsers = await db.select().from(users).where(
    and(
      eq(users.role, "admin"),
      eq(users.activeOrgId, organizationId)
    )
  );
  
  const adminEmails = adminUsers.map(u => u.email).filter(Boolean) as string[];
  
  // Process each notification interval
  for (const days of config.enabledIntervals) {
    const expiringItems = await getExpiringItems(organizationId, days);
    
    for (const item of expiringItems) {
      if (!item.expiryRecord || !item.requirement) continue;
      
      const itemTitle = item.requirement.title || `Requirement #${item.requirement.id}`;
      const entityName = item.expiryRecord.entityType === "company" 
        ? `Company #${item.expiryRecord.entityId}`
        : `Project #${item.expiryRecord.entityId}`;
      const expiryDate = item.expiryRecord.expiresAt;
      const renewalUrl = `${baseUrl}/renewals?expiryId=${item.expiryRecord.id}`;
      
      if (!expiryDate) continue;
      
      // Determine recipients
      const recipients: string[] = [];
      
      if (config.notifyAdmins) {
        recipients.push(...adminEmails);
      }
      
      // Send to each recipient
      for (const email of [...new Set(recipients)]) {
        const result = await sendExpiryNotification(
          email,
          itemTitle,
          entityName,
          expiryDate,
          days,
          renewalUrl
        );
        
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          if (result.error) {
            results.errors.push(`${email}: ${result.error}`);
          }
        }
      }
    }
  }
  
  // Also process overdue items (send daily reminders)
  const overdueItems = await getOverdueItems(organizationId);
  
  for (const item of overdueItems) {
    if (!item.expiryRecord || !item.requirement) continue;
    
    const itemTitle = item.requirement.title || `Requirement #${item.requirement.id}`;
    const entityName = item.expiryRecord.entityType === "company" 
      ? `Company #${item.expiryRecord.entityId}`
      : `Project #${item.expiryRecord.entityId}`;
    const expiryDate = item.expiryRecord.expiresAt;
    const renewalUrl = `${baseUrl}/renewals?expiryId=${item.expiryRecord.id}`;
    
    if (!expiryDate) continue;
    
    const daysOverdue = Math.floor((Date.now() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine recipients for overdue items
    const recipients: string[] = [];
    
    if (config.notifyAdmins) {
      recipients.push(...adminEmails);
    }
    
    for (const email of [...new Set(recipients)]) {
      const result = await sendExpiryNotification(
        email,
        itemTitle,
        entityName,
        expiryDate,
        -daysOverdue, // Negative to indicate overdue
        renewalUrl
      );
      
      if (result.success) {
        results.sent++;
      } else {
        results.failed++;
        if (result.error) {
          results.errors.push(`${email}: ${result.error}`);
        }
      }
    }
  }
  
  return results;
}

/**
 * Get notification summary for dashboard
 */
export async function getNotificationSummary(organizationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  
  // Count items by urgency
  const [overdueCount] = await db.select({ count: sql<number>`count(*)` })
    .from(expiryRecords)
    .where(and(
      eq(expiryRecords.organizationId, organizationId),
      eq(expiryRecords.status, "overdue")
    ));
  
  const [dueSoonCount] = await db.select({ count: sql<number>`count(*)` })
    .from(expiryRecords)
    .where(and(
      eq(expiryRecords.organizationId, organizationId),
      or(eq(expiryRecords.status, "valid"), eq(expiryRecords.status, "due_soon")),
      lte(expiryRecords.expiresAt, in7Days),
      gte(expiryRecords.expiresAt, now)
    ));
  
  const [upcomingCount] = await db.select({ count: sql<number>`count(*)` })
    .from(expiryRecords)
    .where(and(
      eq(expiryRecords.organizationId, organizationId),
      or(eq(expiryRecords.status, "valid"), eq(expiryRecords.status, "due_soon")),
      lte(expiryRecords.expiresAt, in30Days),
      gte(expiryRecords.expiresAt, in7Days)
    ));
  
  return {
    overdue: Number(overdueCount?.count || 0),
    dueSoon: Number(dueSoonCount?.count || 0),
    upcoming: Number(upcomingCount?.count || 0),
    total: Number(overdueCount?.count || 0) + Number(dueSoonCount?.count || 0) + Number(upcomingCount?.count || 0)
  };
}
