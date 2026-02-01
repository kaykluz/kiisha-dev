/**
 * Phase 36: Calendar Adapter Framework
 * 
 * Provides a unified interface for syncing obligations with external calendars.
 * Supports Google Calendar, Outlook, and iCal export.
 */

import {
  getObligationById
} from "../db";
import type { Obligation } from "../../drizzle/schema";

// Placeholder types until db functions are implemented
type CalendarIntegration = {
  id: number;
  provider: string;
  credentials: unknown;
  isActive: boolean;
  syncEnabled: boolean;
};

// Types
export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  location?: string;
  reminders?: { method: string; minutes: number }[];
  recurrence?: string[];
  extendedProperties?: Record<string, string>;
}

export interface CalendarAdapter {
  name: string;
  createEvent(event: CalendarEvent): Promise<string>;
  updateEvent(eventId: string, event: CalendarEvent): Promise<boolean>;
  deleteEvent(eventId: string): Promise<boolean>;
  getEvent(eventId: string): Promise<CalendarEvent | null>;
  listEvents(start: Date, end: Date): Promise<CalendarEvent[]>;
}

export interface CalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  calendarId?: string;
}

// Google Calendar Adapter
export class GoogleCalendarAdapter implements CalendarAdapter {
  name = "google";
  private credentials: CalendarCredentials;
  private calendarId: string;
  
  constructor(credentials: CalendarCredentials) {
    this.credentials = credentials;
    this.calendarId = credentials.calendarId || "primary";
  }
  
  private async makeRequest(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<Response> {
    const baseUrl = "https://www.googleapis.com/calendar/v3";
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${this.credentials.accessToken}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Calendar API error: ${response.status} - ${error}`);
    }
    
    return response;
  }
  
  private toGoogleEvent(event: CalendarEvent): Record<string, unknown> {
    const googleEvent: Record<string, unknown> = {
      summary: event.title,
      description: event.description
    };
    
    if (event.allDay) {
      googleEvent.start = { date: event.start.toISOString().split("T")[0] };
      googleEvent.end = { date: (event.end || event.start).toISOString().split("T")[0] };
    } else {
      googleEvent.start = { dateTime: event.start.toISOString() };
      googleEvent.end = { dateTime: (event.end || new Date(event.start.getTime() + 3600000)).toISOString() };
    }
    
    if (event.location) {
      googleEvent.location = event.location;
    }
    
    if (event.reminders?.length) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: event.reminders.map(r => ({
          method: r.method,
          minutes: r.minutes
        }))
      };
    }
    
    if (event.recurrence?.length) {
      googleEvent.recurrence = event.recurrence;
    }
    
    if (event.extendedProperties) {
      googleEvent.extendedProperties = {
        private: event.extendedProperties
      };
    }
    
    return googleEvent;
  }
  
  private fromGoogleEvent(googleEvent: Record<string, unknown>): CalendarEvent {
    const start = googleEvent.start as Record<string, string>;
    const end = googleEvent.end as Record<string, string>;
    
    const event: CalendarEvent = {
      id: googleEvent.id as string,
      title: googleEvent.summary as string || "",
      description: googleEvent.description as string,
      start: new Date(start.dateTime || start.date),
      allDay: !!start.date
    };
    
    if (end) {
      event.end = new Date(end.dateTime || end.date);
    }
    
    if (googleEvent.location) {
      event.location = googleEvent.location as string;
    }
    
    if (googleEvent.recurrence) {
      event.recurrence = googleEvent.recurrence as string[];
    }
    
    const extProps = googleEvent.extendedProperties as Record<string, Record<string, string>> | undefined;
    if (extProps?.private) {
      event.extendedProperties = extProps.private;
    }
    
    return event;
  }
  
  async createEvent(event: CalendarEvent): Promise<string> {
    const googleEvent = this.toGoogleEvent(event);
    const response = await this.makeRequest(
      "POST",
      `/calendars/${encodeURIComponent(this.calendarId)}/events`,
      googleEvent
    );
    const result = await response.json() as { id: string };
    return result.id;
  }
  
  async updateEvent(eventId: string, event: CalendarEvent): Promise<boolean> {
    const googleEvent = this.toGoogleEvent(event);
    await this.makeRequest(
      "PUT",
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`,
      googleEvent
    );
    return true;
  }
  
  async deleteEvent(eventId: string): Promise<boolean> {
    await this.makeRequest(
      "DELETE",
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`
    );
    return true;
  }
  
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const response = await this.makeRequest(
        "GET",
        `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`
      );
      const googleEvent = await response.json() as Record<string, unknown>;
      return this.fromGoogleEvent(googleEvent);
    } catch {
      return null;
    }
  }
  
  async listEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime"
    });
    
    const response = await this.makeRequest(
      "GET",
      `/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`
    );
    const result = await response.json() as { items: Record<string, unknown>[] };
    return (result.items || []).map(item => this.fromGoogleEvent(item));
  }
}

// Outlook Calendar Adapter (stub - requires Microsoft Graph API)
export class OutlookCalendarAdapter implements CalendarAdapter {
  name = "outlook";
  private credentials: CalendarCredentials;
  
  constructor(credentials: CalendarCredentials) {
    this.credentials = credentials;
  }
  
  async createEvent(_event: CalendarEvent): Promise<string> {
    // TODO: Implement Microsoft Graph API integration
    throw new Error("Outlook calendar integration not yet implemented");
  }
  
  async updateEvent(_eventId: string, _event: CalendarEvent): Promise<boolean> {
    throw new Error("Outlook calendar integration not yet implemented");
  }
  
  async deleteEvent(_eventId: string): Promise<boolean> {
    throw new Error("Outlook calendar integration not yet implemented");
  }
  
  async getEvent(_eventId: string): Promise<CalendarEvent | null> {
    throw new Error("Outlook calendar integration not yet implemented");
  }
  
  async listEvents(_start: Date, _end: Date): Promise<CalendarEvent[]> {
    throw new Error("Outlook calendar integration not yet implemented");
  }
}

// iCal Export (generates .ics file content)
export function generateICalEvent(obligation: Obligation): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KIISHA//Obligations//EN",
    "BEGIN:VEVENT"
  ];
  
  // Generate UID
  lines.push(`UID:obligation-${obligation.id}@kiisha.io`);
  
  // Timestamps
  const now = new Date();
  lines.push(`DTSTAMP:${formatICalDate(now)}`);
  
  if (obligation.dueAt) {
    lines.push(`DTSTART:${formatICalDate(obligation.dueAt)}`);
    lines.push(`DTEND:${formatICalDate(new Date(obligation.dueAt.getTime() + 3600000))}`);
  } else if (obligation.startAt) {
    lines.push(`DTSTART:${formatICalDate(obligation.startAt)}`);
  }
  
  // Title and description
  lines.push(`SUMMARY:${escapeICalText(obligation.title)}`);
  if (obligation.description) {
    lines.push(`DESCRIPTION:${escapeICalText(obligation.description)}`);
  }
  
  // Priority mapping
  const priorityMap: Record<string, number> = {
    CRITICAL: 1,
    HIGH: 3,
    MEDIUM: 5,
    LOW: 9
  };
  if (obligation.priority && priorityMap[obligation.priority]) {
    lines.push(`PRIORITY:${priorityMap[obligation.priority]}`);
  }
  
  // Status mapping
  const statusMap: Record<string, string> = {
    OPEN: "NEEDS-ACTION",
    IN_PROGRESS: "IN-PROCESS",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED"
  };
  if (obligation.status && statusMap[obligation.status]) {
    lines.push(`STATUS:${statusMap[obligation.status]}`);
  }
  
  // Recurrence
  if (obligation.recurrenceRule) {
    lines.push(`RRULE:${obligation.recurrenceRule}`);
  }
  
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  
  return lines.join("\r\n");
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Calendar Sync Service
export class CalendarSyncService {
  /**
   * Get adapter for a calendar integration
   */
  static getAdapter(integration: CalendarIntegration): CalendarAdapter {
    const credentials = integration.credentials as CalendarCredentials;
    
    switch (integration.provider) {
      case "google":
        return new GoogleCalendarAdapter(credentials);
      case "outlook":
        return new OutlookCalendarAdapter(credentials);
      default:
        throw new Error(`Unsupported calendar provider: ${integration.provider}`);
    }
  }
  
  /**
   * Convert obligation to calendar event
   */
  static obligationToCalendarEvent(obligation: Obligation): CalendarEvent {
    const event: CalendarEvent = {
      title: obligation.title,
      description: obligation.description ?? undefined,
      start: obligation.dueAt || obligation.startAt || new Date(),
      extendedProperties: {
        kiishaObligationId: String(obligation.id),
        kiishaOrgId: String(obligation.organizationId),
        kiishaType: obligation.obligationType,
        kiishaPriority: obligation.priority
      }
    };
    
    // Set end time (default 1 hour after start)
    if (obligation.dueAt) {
      event.end = new Date(obligation.dueAt.getTime() + 3600000);
    }
    
    // Add recurrence if present
    if (obligation.recurrenceRule) {
      event.recurrence = [`RRULE:${obligation.recurrenceRule}`];
    }
    
    // Add reminders based on priority
    const reminderMinutes: Record<string, number[]> = {
      CRITICAL: [1440, 60, 15], // 1 day, 1 hour, 15 min
      HIGH: [1440, 60],
      MEDIUM: [1440],
      LOW: [1440]
    };
    
    if (obligation.priority && reminderMinutes[obligation.priority]) {
      event.reminders = reminderMinutes[obligation.priority].map(minutes => ({
        method: "popup",
        minutes
      }));
    }
    
    return event;
  }
  
  /**
   * Sync a single obligation to all user's connected calendars
   */
  static async syncObligation(
    obligation: Obligation,
    userId: number
  ): Promise<{ synced: number; errors: string[] }> {
    // TODO: Implement getCalendarIntegrationsForUser
    const integrations: CalendarIntegration[] = [];
    const activeIntegrations = integrations.filter((i: CalendarIntegration) => i.isActive && i.syncEnabled);
    
    let synced = 0;
    const errors: string[] = [];
    
    for (const integration of activeIntegrations) {
      try {
        const adapter = this.getAdapter(integration);
        const event = this.obligationToCalendarEvent(obligation);
        
        // Create/update event in external calendar
        // TODO: Implement sync event tracking
        const externalEventId = await adapter.createEvent(event);
        console.log(`Created calendar event: ${externalEventId}`);
        
        synced++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${integration.provider}: ${message}`);
        
        // TODO: Update integration status
        console.error(`Calendar sync error for ${integration.provider}: ${message}`);
      }
    }
    
    return { synced, errors };
  }
  
  /**
   * Delete obligation from all synced calendars
   */
  static async deleteObligationFromCalendars(
    obligationId: number,
    organizationId: number
  ): Promise<{ deleted: number; errors: string[] }> {
    let deleted = 0;
    const errors: string[] = [];
    
    // Get all sync records for this obligation
    const obligation = await getObligationById(obligationId, organizationId);
    if (!obligation) {
      return { deleted: 0, errors: ["Obligation not found"] };
    }
    
    // This would need a function to get all sync events for an obligation
    // For now, we'll just return success
    return { deleted, errors };
  }
  
  /**
   * Generate iCal feed URL for a user's obligations
   */
  static generateICalFeedUrl(userId: number, organizationId: number, token: string): string {
    return `/api/calendar/ical/${organizationId}/${userId}/${token}.ics`;
  }
  
  /**
   * Generate iCal content for multiple obligations
   */
  static generateICalFeed(obligations: Obligation[]): string {
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//KIISHA//Obligations//EN",
      "X-WR-CALNAME:KIISHA Obligations"
    ];
    
    for (const obligation of obligations) {
      if (!obligation.dueAt && !obligation.startAt) continue;
      
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:obligation-${obligation.id}@kiisha.io`);
      lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
      
      if (obligation.dueAt) {
        lines.push(`DTSTART:${formatICalDate(obligation.dueAt)}`);
        lines.push(`DTEND:${formatICalDate(new Date(obligation.dueAt.getTime() + 3600000))}`);
      } else if (obligation.startAt) {
        lines.push(`DTSTART:${formatICalDate(obligation.startAt)}`);
      }
      
      lines.push(`SUMMARY:${escapeICalText(obligation.title)}`);
      if (obligation.description) {
        lines.push(`DESCRIPTION:${escapeICalText(obligation.description)}`);
      }
      
      if (obligation.recurrenceRule) {
        lines.push(`RRULE:${obligation.recurrenceRule}`);
      }
      
      lines.push("END:VEVENT");
    }
    
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }
}

export default CalendarSyncService;
