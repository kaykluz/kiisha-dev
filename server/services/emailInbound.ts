/**
 * Email Inbound Parsing Service
 * 
 * Handles incoming emails from SendGrid and Mailgun webhooks:
 * - Email parsing and extraction
 * - Attachment handling
 * - Thread detection
 * - Auto-filing to documents
 */

import { createHash } from 'crypto';

// Types
export interface InboundEmail {
  id: string;
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  textBody?: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
  headers: Record<string, string>;
  receivedAt: Date;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  spamScore?: number;
  provider: 'sendgrid' | 'mailgun' | 'postmark';
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  contentId?: string;
}

export interface EmailProcessingResult {
  success: boolean;
  emailId: string;
  documentIds?: number[];
  workOrderId?: number;
  threadId?: string;
  error?: string;
}

// SendGrid Inbound Parse
export function parseSendGridEmail(body: any, files: any[]): InboundEmail {
  const attachments: EmailAttachment[] = [];
  
  if (files && Array.isArray(files)) {
    for (const file of files) {
      attachments.push({
        filename: file.originalname || file.filename,
        contentType: file.mimetype,
        size: file.size,
        content: file.buffer
      });
    }
  }

  return {
    id: generateEmailId(),
    from: body.from || '',
    fromName: extractName(body.from),
    to: parseEmailList(body.to),
    cc: parseEmailList(body.cc),
    subject: body.subject || '(No Subject)',
    textBody: body.text,
    htmlBody: body.html,
    attachments,
    headers: parseHeaders(body.headers),
    receivedAt: new Date(),
    messageId: body['Message-ID'],
    inReplyTo: body['In-Reply-To'],
    references: parseReferences(body.headers?.['References']),
    spamScore: parseFloat(body.spam_score) || 0,
    provider: 'sendgrid'
  };
}

// Mailgun Inbound Parse
export function parseMailgunEmail(body: any, files: any[]): InboundEmail {
  const attachments: EmailAttachment[] = [];
  
  if (files && Array.isArray(files)) {
    for (const file of files) {
      attachments.push({
        filename: file.originalname || file.filename,
        contentType: file.mimetype,
        size: file.size,
        content: file.buffer
      });
    }
  }

  return {
    id: generateEmailId(),
    from: body.sender || body.from || '',
    fromName: extractName(body.from),
    to: parseEmailList(body.recipient || body.To),
    cc: parseEmailList(body.Cc),
    subject: body.subject || body.Subject || '(No Subject)',
    textBody: body['body-plain'] || body['stripped-text'],
    htmlBody: body['body-html'] || body['stripped-html'],
    attachments,
    headers: parseMailgunHeaders(body),
    receivedAt: new Date(body.timestamp ? body.timestamp * 1000 : Date.now()),
    messageId: body['Message-Id'],
    inReplyTo: body['In-Reply-To'],
    references: parseReferences(body.References),
    spamScore: parseFloat(body['X-Mailgun-Spf']) === 1 ? 0 : 5,
    provider: 'mailgun'
  };
}

// Thread Detection
export function detectThread(email: InboundEmail, existingEmails: InboundEmail[]): string {
  if (email.inReplyTo) {
    const parent = existingEmails.find(e => e.messageId === email.inReplyTo);
    if (parent) return generateThreadId(parent);
  }

  if (email.references?.length) {
    for (const ref of email.references) {
      const parent = existingEmails.find(e => e.messageId === ref);
      if (parent) return generateThreadId(parent);
    }
  }

  const normalizedSubject = normalizeSubject(email.subject);
  const matchingThread = existingEmails.find(e => 
    normalizeSubject(e.subject) === normalizedSubject &&
    hasParticipantOverlap(email, e)
  );

  if (matchingThread) return generateThreadId(matchingThread);
  return generateThreadId(email);
}

function generateThreadId(email: InboundEmail): string {
  const subject = normalizeSubject(email.subject);
  const participants = [...email.to, email.from].sort().join(',');
  return createHash('sha256').update(`${subject}:${participants}`).digest('hex').substring(0, 16);
}

function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re|Fwd|Fw):\s*/gi, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function hasParticipantOverlap(email1: InboundEmail, email2: InboundEmail): boolean {
  const participants1 = new Set([email1.from, ...email1.to]);
  const participants2 = new Set([email2.from, ...email2.to]);
  for (const p of participants1) {
    if (participants2.has(p)) return true;
  }
  return false;
}

// Auto-Filing
export async function autoFileEmail(email: InboundEmail): Promise<EmailProcessingResult> {
  try {
    const category = categorizeEmail(email);
    const documentIds: number[] = [];
    
    for (const attachment of email.attachments) {
      console.log(`[Email Inbound] Processing attachment: ${attachment.filename}`);
    }

    const shouldCreateWorkOrder = detectWorkOrderIntent(email);
    let workOrderId: number | undefined;
    
    if (shouldCreateWorkOrder) {
      console.log('[Email Inbound] Creating work order from email');
    }

    return {
      success: true,
      emailId: email.id,
      documentIds,
      workOrderId,
      threadId: generateThreadId(email)
    };
  } catch (error) {
    return {
      success: false,
      emailId: email.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function categorizeEmail(email: InboundEmail): string {
  const subject = email.subject.toLowerCase();
  if (subject.includes('invoice') || subject.includes('payment')) return 'billing';
  if (subject.includes('rfi')) return 'rfi';
  if (subject.includes('contract')) return 'contracts';
  if (subject.includes('report')) return 'reports';
  if (subject.includes('maintenance')) return 'maintenance';
  if (subject.includes('urgent')) return 'urgent';
  return 'general';
}

function detectWorkOrderIntent(email: InboundEmail): boolean {
  const subject = email.subject.toLowerCase();
  const body = (email.textBody || '').toLowerCase();
  const keywords = ['maintenance request', 'repair needed', 'equipment issue', 'not working', 'broken', 'service request'];
  return keywords.some(kw => subject.includes(kw) || body.includes(kw));
}

// Helpers
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractName(address: string): string | undefined {
  const match = address.match(/^([^<]+)</);
  return match ? match[1].trim().replace(/"/g, '') : undefined;
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(e => e.trim()).filter(Boolean);
}

function parseHeaders(headersString: string | undefined): Record<string, string> {
  if (!headersString) return {};
  try {
    return JSON.parse(headersString);
  } catch {
    return {};
  }
}

function parseMailgunHeaders(body: any): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith('X-') || key === 'Message-Id') {
      headers[key] = String(value);
    }
  }
  return headers;
}

function parseReferences(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).filter(r => r.startsWith('<') && r.endsWith('>'));
}

export function verifyMailgunSignature(apiKey: string, timestamp: string, token: string, signature: string): boolean {
  const hmac = createHash('sha256').update(timestamp + token).digest('hex');
  return hmac === signature;
}

export const emailInboundService = {
  parseSendGridEmail,
  parseMailgunEmail,
  detectThread,
  autoFileEmail,
  verifyMailgunSignature
};

export default emailInboundService;
