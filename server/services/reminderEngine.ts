/**
 * Phase 36: Reminder and Escalation Engine
 * 
 * Processes obligations and sends reminders/escalations based on policies.
 */

import {
  listObligations,
  getObligationsDueSoon,
  getOverdueObligations,
  getObligationAssignments,
  getReminderPolicyById,
  getEscalationPolicyById,
  getDefaultReminderPolicy,
  createNotificationEvent,
  updateNotificationEventStatus,
  logObligationAction,
  updateObligationStatus,
  getUserById
} from "../db";
import { enqueueJob } from "./jobQueue";
import type { Obligation, ReminderPolicy, EscalationPolicy, ObligationAssignment } from "../../drizzle/schema";

// Types
interface ReminderRule {
  beforeDue?: { days: number; hours?: number }[];
  onDue?: boolean;
  afterDue?: { days: number; hours?: number }[];
}

interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  excludeWeekends: boolean;
}

interface EscalationTrigger {
  daysOverdue: number;
  notifyRoles: string[];
  notifyUserIds?: number[];
  notifyTeamIds?: number[];
  escalationLevel: number;
}

interface NotificationPayload {
  obligationId: number;
  organizationId: number;
  recipientUserId: number;
  channel: "in_app" | "email" | "whatsapp" | "sms";
  eventType: "REMINDER" | "ESCALATION" | "DUE_TODAY" | "OVERDUE";
  templateData: {
    obligationTitle: string;
    dueAt?: Date;
    daysUntilDue?: number;
    daysOverdue?: number;
    escalationLevel?: number;
    recipientName?: string;
  };
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(quietHours: QuietHours | undefined | null): boolean {
  if (!quietHours?.enabled) return false;
  
  const now = new Date();
  const tz = quietHours.timezone || "UTC";
  
  // Get current time in the specified timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short"
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
  const weekday = parts.find(p => p.type === "weekday")?.value || "";
  
  // Check weekends
  if (quietHours.excludeWeekends && (weekday === "Sat" || weekday === "Sun")) {
    return true;
  }
  
  // Parse quiet hours
  const [startHour, startMin] = quietHours.start.split(":").map(Number);
  const [endHour, endMin] = quietHours.end.split(":").map(Number);
  
  const currentMinutes = hour * 60 + minute;
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Calculate hours until due
 */
function hoursUntilDue(dueAt: Date): number {
  const now = new Date();
  return (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculate days overdue
 */
function daysOverdue(dueAt: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - dueAt.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a reminder should be sent based on rules
 */
function shouldSendReminder(
  obligation: Obligation,
  rules: ReminderRule
): { shouldSend: boolean; eventType: "REMINDER" | "DUE_TODAY" | "OVERDUE" } {
  if (!obligation.dueAt) {
    return { shouldSend: false, eventType: "REMINDER" };
  }
  
  const hours = hoursUntilDue(obligation.dueAt);
  const days = Math.floor(hours / 24);
  
  // Check "on due" (within 24 hours before due)
  if (rules.onDue && hours >= 0 && hours <= 24) {
    return { shouldSend: true, eventType: "DUE_TODAY" };
  }
  
  // Check "before due" rules
  if (rules.beforeDue) {
    for (const rule of rules.beforeDue) {
      const targetHours = rule.days * 24 + (rule.hours || 0);
      // Allow 1 hour window for matching
      if (hours >= targetHours - 0.5 && hours <= targetHours + 0.5) {
        return { shouldSend: true, eventType: "REMINDER" };
      }
    }
  }
  
  // Check "after due" (overdue) rules
  if (rules.afterDue && hours < 0) {
    const overdueDays = daysOverdue(obligation.dueAt);
    for (const rule of rules.afterDue) {
      if (overdueDays === rule.days) {
        return { shouldSend: true, eventType: "OVERDUE" };
      }
    }
  }
  
  return { shouldSend: false, eventType: "REMINDER" };
}

/**
 * Queue notification for delivery
 */
async function queueNotification(payload: NotificationPayload): Promise<number> {
  // Create notification event record
  const eventId = await createNotificationEvent({
    organizationId: payload.organizationId,
    obligationId: payload.obligationId,
    eventType: payload.eventType,
    recipientUserId: payload.recipientUserId,
    channel: payload.channel,
    status: "queued",
    contentSnapshot: {
      templateData: payload.templateData
    }
  });
  
  // Enqueue job for actual delivery
  await enqueueJob(
    "notification_send",
    {
      notificationEventId: eventId,
      channel: payload.channel,
      recipientUserId: payload.recipientUserId,
      templateData: payload.templateData
    },
    {
      organizationId: payload.organizationId,
      priority: payload.eventType === "ESCALATION" ? "high" : "normal"
    }
  );
  
  return eventId;
}

/**
 * Process reminders for a single obligation
 */
async function processObligationReminders(
  obligation: Obligation,
  assignments: ObligationAssignment[],
  policy: ReminderPolicy
): Promise<number> {
  let notificationsSent = 0;
  
  // Check quiet hours
  if (isQuietHours(policy.quietHours as QuietHours)) {
    return 0;
  }
  
  // Check if reminder should be sent
  const rules = policy.rules as ReminderRule;
  const { shouldSend, eventType } = shouldSendReminder(obligation, rules);
  
  if (!shouldSend) {
    return 0;
  }
  
  // Get channels
  const channels = policy.channels as { inApp: boolean; email: boolean; whatsapp: boolean; sms: boolean };
  const activeChannels: ("in_app" | "email" | "whatsapp" | "sms")[] = [];
  if (channels.inApp) activeChannels.push("in_app");
  if (channels.email) activeChannels.push("email");
  if (channels.whatsapp) activeChannels.push("whatsapp");
  if (channels.sms) activeChannels.push("sms");
  
  // Send to all assignees
  for (const assignment of assignments) {
    if (assignment.assigneeType !== "USER") continue;
    
    const user = await getUserById(assignment.assigneeId);
    if (!user) continue;
    
    for (const channel of activeChannels) {
      await queueNotification({
        obligationId: obligation.id,
        organizationId: obligation.organizationId,
        recipientUserId: assignment.assigneeId,
        channel,
        eventType,
        templateData: {
          obligationTitle: obligation.title,
          dueAt: obligation.dueAt ?? undefined,
          daysUntilDue: obligation.dueAt ? Math.max(0, Math.floor(hoursUntilDue(obligation.dueAt) / 24)) : undefined,
          recipientName: user.name ?? undefined
        }
      });
      notificationsSent++;
    }
  }
  
  // Log reminder sent
  if (notificationsSent > 0) {
    await logObligationAction({
      organizationId: obligation.organizationId,
      obligationId: obligation.id,
      action: "REMINDER_SENT",
      newValue: { eventType, assigneeCount: assignments.length },
      systemGenerated: true
    });
  }
  
  return notificationsSent;
}

/**
 * Process escalations for overdue obligations
 */
async function processObligationEscalation(
  obligation: Obligation,
  policy: EscalationPolicy
): Promise<number> {
  if (!obligation.dueAt) return 0;
  
  const overdue = daysOverdue(obligation.dueAt);
  if (overdue <= 0) return 0;
  
  let notificationsSent = 0;
  const rules = policy.rules as { triggers: EscalationTrigger[]; maxEscalationLevel: number };
  
  // Find matching escalation trigger
  const trigger = rules.triggers.find(t => t.daysOverdue === overdue);
  if (!trigger) return 0;
  
  // Update obligation status to OVERDUE if not already
  if (obligation.status !== "OVERDUE" && obligation.status !== "COMPLETED" && obligation.status !== "CANCELLED") {
    await updateObligationStatus(obligation.id, obligation.organizationId, "OVERDUE");
  }
  
  // Notify specified users
  if (trigger.notifyUserIds) {
    for (const userId of trigger.notifyUserIds) {
      const user = await getUserById(userId);
      if (!user) continue;
      
      await queueNotification({
        obligationId: obligation.id,
        organizationId: obligation.organizationId,
        recipientUserId: userId,
        channel: "email",
        eventType: "ESCALATION",
        templateData: {
          obligationTitle: obligation.title,
          dueAt: obligation.dueAt,
          daysOverdue: overdue,
          escalationLevel: trigger.escalationLevel,
          recipientName: user.name ?? undefined
        }
      });
      notificationsSent++;
    }
  }
  
  // Log escalation
  if (notificationsSent > 0) {
    await logObligationAction({
      organizationId: obligation.organizationId,
      obligationId: obligation.id,
      action: "ESCALATED",
      newValue: { escalationLevel: trigger.escalationLevel, daysOverdue: overdue },
      systemGenerated: true
    });
  }
  
  return notificationsSent;
}

/**
 * Main reminder processing job
 * Called periodically (e.g., every hour) to process all obligations
 */
export async function processReminders(organizationId: number): Promise<{
  processed: number;
  remindersSent: number;
  escalationsSent: number;
}> {
  let processed = 0;
  let remindersSent = 0;
  let escalationsSent = 0;
  
  // Get obligations that might need reminders (due within 30 days or overdue)
  const dueSoon = await getObligationsDueSoon(organizationId, 30);
  const overdue = await getOverdueObligations(organizationId);
  
  // Combine and dedupe
  const obligationMap = new Map<number, Obligation>();
  for (const o of [...dueSoon, ...overdue]) {
    obligationMap.set(o.id, o);
  }
  
  const obligations = Array.from(obligationMap.values());
  
  for (const obligation of obligations) {
    processed++;
    
    // Get assignments
    const assignments = await getObligationAssignments(obligation.id, organizationId);
    
    // Get reminder policy
    let reminderPolicy: ReminderPolicy | null = null;
    if (obligation.reminderPolicyId) {
      reminderPolicy = await getReminderPolicyById(obligation.reminderPolicyId, organizationId);
    }
    if (!reminderPolicy) {
      reminderPolicy = await getDefaultReminderPolicy(organizationId);
    }
    
    // Process reminders
    if (reminderPolicy?.isActive) {
      remindersSent += await processObligationReminders(obligation, assignments, reminderPolicy);
    }
    
    // Get escalation policy for overdue items
    if (obligation.dueAt && new Date() > obligation.dueAt) {
      let escalationPolicy: EscalationPolicy | null = null;
      if (obligation.escalationPolicyId) {
        escalationPolicy = await getEscalationPolicyById(obligation.escalationPolicyId, organizationId);
      }
      
      if (escalationPolicy?.isActive) {
        escalationsSent += await processObligationEscalation(obligation, escalationPolicy);
      }
    }
  }
  
  return { processed, remindersSent, escalationsSent };
}

/**
 * Schedule reminder processing job
 */
export async function scheduleReminderProcessing(organizationId: number): Promise<{ jobId: number | null; correlationId: string }> {
  return await enqueueJob(
    "reminder_processing" as any,
    { organizationId },
    {
      organizationId,
      priority: "normal"
    }
  );
}
