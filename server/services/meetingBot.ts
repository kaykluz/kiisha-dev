/**
 * Meeting Bot Integration Service
 * Zoom, Microsoft Teams, and Google Meet integration
 */

export interface MeetingPlatform {
  type: 'zoom' | 'teams' | 'meet';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface MeetingEvent {
  id: string;
  platform: 'zoom' | 'teams' | 'meet';
  externalId: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  hostEmail: string;
  participants: string[];
  status: 'scheduled' | 'in_progress' | 'ended';
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface MeetingTranscript {
  meetingId: string;
  segments: TranscriptSegment[];
  summary?: string;
  actionItems?: ActionItem[];
}

export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

// Zoom Integration
export class ZoomBotClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: MeetingPlatform) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state
    });
    return `https://zoom.us/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: this.redirectUri })
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async listMeetings(): Promise<MeetingEvent[]> {
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return (data.meetings || []).map((m: any) => ({
      id: `zoom_${m.id}`,
      platform: 'zoom' as const,
      externalId: String(m.id),
      title: m.topic,
      startTime: new Date(m.start_time),
      hostEmail: m.host_email,
      participants: [],
      status: m.status === 'started' ? 'in_progress' : 'scheduled'
    }));
  }

  async getRecordings(meetingId: string): Promise<{ recordingUrl: string; transcriptUrl?: string }> {
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return {
      recordingUrl: data.recording_files?.find((f: any) => f.file_type === 'MP4')?.download_url || '',
      transcriptUrl: data.recording_files?.find((f: any) => f.file_type === 'TRANSCRIPT')?.download_url
    };
  }
}

// Microsoft Teams Integration
export class TeamsBotClient {
  private clientId: string;
  private clientSecret: string;
  private tenantId: string;
  private accessToken?: string;

  constructor(config: MeetingPlatform & { tenantId?: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tenantId = config.tenantId || 'common';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'OnlineMeetings.ReadWrite Calendars.ReadWrite',
      state
    });
    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch(`https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async listMeetings(): Promise<MeetingEvent[]> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return (data.value || []).map((m: any) => ({
      id: `teams_${m.id}`,
      platform: 'teams' as const,
      externalId: m.id,
      title: m.subject,
      startTime: new Date(m.startDateTime),
      hostEmail: m.participants?.organizer?.emailAddress?.address || '',
      participants: (m.participants?.attendees || []).map((a: any) => a.emailAddress?.address),
      status: 'scheduled'
    }));
  }
}

// Google Meet Integration
export class MeetBotClient {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private accessToken?: string;

  constructor(config: MeetingPlatform) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      state
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const data = await response.json();
    this.accessToken = data.access_token;
    return { accessToken: data.access_token, refreshToken: data.refresh_token };
  }

  async listCalendarEvents(): Promise<MeetingEvent[]> {
    const now = new Date().toISOString();
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=50`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    return (data.items || [])
      .filter((e: any) => e.conferenceData?.conferenceSolution?.name === 'Google Meet')
      .map((e: any) => ({
        id: `meet_${e.id}`,
        platform: 'meet' as const,
        externalId: e.id,
        title: e.summary,
        startTime: new Date(e.start.dateTime || e.start.date),
        hostEmail: e.organizer?.email || '',
        participants: (e.attendees || []).map((a: any) => a.email),
        status: 'scheduled'
      }));
  }
}

export async function extractActionItems(transcript: MeetingTranscript): Promise<ActionItem[]> {
  const fullText = transcript.segments.map(s => `${s.speaker}: ${s.text}`).join('\n');
  const items: ActionItem[] = [];
  const patterns = [/(?:will|should|need to|action item[:\s]+)([^.]+)/gi];
  for (const pattern of patterns) {
    const matches = fullText.matchAll(pattern);
    for (const match of matches) {
      items.push({ description: match[1]?.trim() || match[0], priority: 'medium', status: 'pending' });
    }
  }
  return items;
}

export function createMeetingBot(platform: MeetingPlatform): ZoomBotClient | TeamsBotClient | MeetBotClient {
  switch (platform.type) {
    case 'zoom': return new ZoomBotClient(platform);
    case 'teams': return new TeamsBotClient(platform);
    case 'meet': return new MeetBotClient(platform);
  }
}

export default { createMeetingBot, extractActionItems, ZoomBotClient, TeamsBotClient, MeetBotClient };
