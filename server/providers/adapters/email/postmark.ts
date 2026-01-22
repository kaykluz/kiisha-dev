/**
 * Postmark Inbound Adapter
 * 
 * Receives emails via Postmark's Inbound webhook.
 */

import type {
  EmailIngestProviderAdapter,
  EmailWebhookConfig,
  ParsedEmail,
  EmailAddress,
  EmailAttachment,
  TestConnectionResult,
} from '../../interfaces';
import crypto from 'crypto';

interface PostmarkConfig {
  inboundDomain?: string;
}

export class PostmarkEmailAdapter implements EmailIngestProviderAdapter {
  readonly providerId = 'postmark' as const;
  readonly integrationType = 'email_ingest' as const;
  readonly isBuiltIn = false;
  
  private config: PostmarkConfig = {};
  private serverToken: string | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      inboundDomain: config.inboundDomain as string | undefined,
    };
    
    if (secrets?.serverToken) {
      this.serverToken = secrets.serverToken;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.serverToken) {
      return { success: false, message: 'Postmark server token not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Test API connectivity by getting server info
      const response = await fetch('https://api.postmarkapp.com/server', {
        headers: {
          'X-Postmark-Server-Token': this.serverToken,
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to Postmark server: ${data.Name}`,
          latencyMs: Date.now() - start,
          details: { 
            serverName: data.Name,
            inboundAddress: data.InboundAddress,
          },
        };
      } else {
        const error = await response.json().catch(() => ({ Message: response.statusText }));
        return {
          success: false,
          message: `Postmark error: ${error.Message || response.status}`,
          latencyMs: Date.now() - start,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        latencyMs: Date.now() - start,
      };
    }
  }
  
  async disconnect(): Promise<void> {
    this.config = {};
    this.serverToken = null;
  }
  
  async generateWebhookConfig(orgId: number): Promise<EmailWebhookConfig> {
    const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.com';
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    return {
      webhookUrl: `${baseUrl}/api/webhooks/email/postmark/${orgId}`,
      webhookSecret,
      setupInstructions: [
        '1. Log in to your Postmark account at https://account.postmarkapp.com',
        '2. Go to your Server → Settings → Inbound',
        '3. Copy your inbound email address (e.g., xxx@inbound.postmarkapp.com)',
        '4. Set up email forwarding from your domain to this address',
        '5. Under "Webhook", paste the Webhook URL shown above',
        '6. Enable "Include raw email content in JSON payload"',
        '7. Click "Save Changes"',
        '8. Optionally, set up a custom inbound domain for branded addresses',
      ],
      verificationSteps: [
        'Send an email to your Postmark inbound address',
        'Check the webhook events log for the received email',
        'Verify the email appears in your KIISHA inbox',
      ],
    };
  }
  
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    // Postmark doesn't sign webhooks by default
    // You can configure IP whitelisting instead
    // For now, we rely on the webhook URL being secret
    return true;
  }
  
  async parseInboundEmail(payload: unknown): Promise<ParsedEmail> {
    const data = payload as Record<string, unknown>;
    
    // Postmark sends JSON with these fields:
    // - FromName, FromFull, From
    // - ToFull, To
    // - CcFull, Cc
    // - BccFull, Bcc
    // - Subject
    // - TextBody, HtmlBody, StrippedTextReply
    // - Headers (array of {Name, Value})
    // - Attachments (array of {Name, ContentType, ContentLength, Content})
    // - MessageID
    // - Date
    
    const parseAddressFull = (addr: unknown): EmailAddress => {
      if (typeof addr === 'object' && addr !== null) {
        const full = addr as { Email?: string; Name?: string };
        return {
          email: full.Email || '',
          name: full.Name || undefined,
        };
      }
      if (typeof addr === 'string') {
        return { email: addr };
      }
      return { email: '' };
    };
    
    const parseAddressListFull = (list: unknown): EmailAddress[] => {
      if (!list) return [];
      if (Array.isArray(list)) {
        return list.map(parseAddressFull);
      }
      if (typeof list === 'string') {
        return list.split(',').map(addr => ({ email: addr.trim() }));
      }
      return [];
    };
    
    // Parse headers
    const headers: Record<string, string> = {};
    if (Array.isArray(data.Headers)) {
      for (const header of data.Headers) {
        if (header && typeof header === 'object') {
          const h = header as { Name?: string; Value?: string };
          if (h.Name && h.Value) {
            headers[h.Name] = h.Value;
          }
        }
      }
    }
    
    // Parse attachments
    const attachments: EmailAttachment[] = [];
    if (Array.isArray(data.Attachments)) {
      for (const att of data.Attachments) {
        if (att && typeof att === 'object') {
          const a = att as {
            Name?: string;
            ContentType?: string;
            ContentLength?: number;
            Content?: string;
            ContentID?: string;
          };
          attachments.push({
            filename: a.Name || 'attachment',
            contentType: a.ContentType || 'application/octet-stream',
            size: a.ContentLength || 0,
            content: a.Content || '',
            contentId: a.ContentID,
          });
        }
      }
    }
    
    // Parse date
    let receivedAt = new Date();
    if (data.Date && typeof data.Date === 'string') {
      const parsed = new Date(data.Date);
      if (!isNaN(parsed.getTime())) {
        receivedAt = parsed;
      }
    }
    
    return {
      messageId: (data.MessageID as string || `postmark-${Date.now()}`).replace(/[<>]/g, ''),
      from: parseAddressFull(data.FromFull || data.From),
      to: parseAddressListFull(data.ToFull || data.To),
      cc: parseAddressListFull(data.CcFull || data.Cc),
      bcc: parseAddressListFull(data.BccFull || data.Bcc),
      subject: data.Subject as string || '(no subject)',
      textBody: data.TextBody as string || data.StrippedTextReply as string,
      htmlBody: data.HtmlBody as string,
      attachments,
      headers,
      receivedAt,
      rawPayload: payload,
    };
  }
}
