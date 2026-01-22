/**
 * Mailgun Routes Adapter
 * 
 * Receives emails via Mailgun's Routes webhook.
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

interface MailgunConfig {
  domain?: string;
}

export class MailgunEmailAdapter implements EmailIngestProviderAdapter {
  readonly providerId = 'mailgun' as const;
  readonly integrationType = 'email_ingest' as const;
  readonly isBuiltIn = false;
  
  private config: MailgunConfig = {};
  private apiKey: string | null = null;
  private webhookSigningKey: string | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      domain: config.domain as string | undefined,
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
    if (secrets?.webhookSigningKey) {
      this.webhookSigningKey = secrets.webhookSigningKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'Mailgun API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Test API connectivity by getting domain info
      const response = await fetch(
        `https://api.mailgun.net/v3/domains/${this.config.domain}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to Mailgun domain: ${data.domain?.name || this.config.domain}`,
          latencyMs: Date.now() - start,
          details: { state: data.domain?.state },
        };
      } else {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        return {
          success: false,
          message: `Mailgun error: ${error.message || response.status}`,
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
    this.apiKey = null;
    this.webhookSigningKey = null;
  }
  
  async generateWebhookConfig(orgId: number): Promise<EmailWebhookConfig> {
    const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.com';
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    return {
      webhookUrl: `${baseUrl}/api/webhooks/email/mailgun/${orgId}`,
      webhookSecret,
      setupInstructions: [
        '1. Log in to your Mailgun account at https://app.mailgun.com',
        '2. Go to Sending → Receiving → Create Route',
        '3. Set the Expression Type to "Match Recipient"',
        `4. Enter the pattern: .*@${this.config.domain || 'your-domain.com'}`,
        '5. Under Actions, select "Forward" and paste the Webhook URL',
        '6. Enable "Store and notify" to keep a copy',
        '7. Click "Create Route"',
        '8. Go to Settings → Webhooks → Webhook Signing Key',
        '9. Copy the signing key and add it to your integration secrets',
      ],
      verificationSteps: [
        'Send an email to any address @' + (this.config.domain || 'your-configured-domain'),
        'Check the webhook events log for the received email',
        'Verify the email appears in your KIISHA inbox',
      ],
    };
  }
  
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    if (!secret) return true; // Skip if no signing key configured
    
    // Mailgun uses timestamp + token + signature verification
    // The signature header format is: timestamp=xxx,token=xxx,signature=xxx
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    if (!parts.timestamp || !parts.token || !parts.signature) {
      return false;
    }
    
    // Verify timestamp is within 5 minutes
    const timestamp = parseInt(parts.timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      return false;
    }
    
    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(parts.timestamp + parts.token)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(parts.signature),
      Buffer.from(expectedSignature)
    );
  }
  
  async parseInboundEmail(payload: unknown): Promise<ParsedEmail> {
    const data = payload as Record<string, unknown>;
    
    // Mailgun sends form data with these fields:
    // - sender, from, recipient, To, Cc, Bcc, Subject
    // - body-plain, body-html, stripped-text, stripped-html
    // - message-headers (JSON array)
    // - attachment-count
    // - attachment-x (file data)
    
    const parseAddress = (addr: string): EmailAddress => {
      const match = addr.match(/^(.+?)\s*<(.+?)>$/);
      if (match) {
        return { name: match[1].trim(), email: match[2].trim() };
      }
      return { email: addr.trim() };
    };
    
    const parseAddressList = (list: string | undefined): EmailAddress[] => {
      if (!list) return [];
      return list.split(',').map(addr => parseAddress(addr.trim()));
    };
    
    // Parse headers
    let headers: Record<string, string> = {};
    if (data['message-headers'] && typeof data['message-headers'] === 'string') {
      try {
        const headerArray = JSON.parse(data['message-headers']);
        for (const [key, value] of headerArray) {
          headers[key] = value;
        }
      } catch {
        // Ignore header parsing errors
      }
    }
    
    // Parse attachments
    const attachments: EmailAttachment[] = [];
    const attachmentCount = parseInt(data['attachment-count'] as string || '0', 10);
    
    for (let i = 1; i <= attachmentCount; i++) {
      const attachment = data[`attachment-${i}`];
      if (attachment && typeof attachment === 'object') {
        const file = attachment as { filename?: string; 'content-type'?: string; data?: string };
        attachments.push({
          filename: file.filename || `attachment-${i}`,
          contentType: file['content-type'] || 'application/octet-stream',
          size: file.data?.length || 0,
          content: file.data || '',
        });
      }
    }
    
    // Generate message ID
    const messageId = data['Message-Id'] as string || 
                      headers['Message-Id'] ||
                      `mailgun-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return {
      messageId: messageId.replace(/[<>]/g, ''),
      from: parseAddress(data.from as string || data.sender as string || ''),
      to: parseAddressList(data.To as string || data.recipient as string),
      cc: parseAddressList(data.Cc as string),
      bcc: parseAddressList(data.Bcc as string),
      subject: data.Subject as string || data.subject as string || '(no subject)',
      textBody: data['body-plain'] as string || data['stripped-text'] as string,
      htmlBody: data['body-html'] as string || data['stripped-html'] as string,
      attachments,
      headers,
      receivedAt: new Date(parseInt(data.timestamp as string || '0', 10) * 1000 || Date.now()),
      rawPayload: payload,
    };
  }
}
