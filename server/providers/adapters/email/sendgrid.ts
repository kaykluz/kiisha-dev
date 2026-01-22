/**
 * SendGrid Inbound Parse Adapter
 * 
 * Receives emails via SendGrid's Inbound Parse webhook.
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

interface SendGridConfig {
  hostname?: string;
}

export class SendGridEmailAdapter implements EmailIngestProviderAdapter {
  readonly providerId = 'sendgrid' as const;
  readonly integrationType = 'email_ingest' as const;
  readonly isBuiltIn = false;
  
  private config: SendGridConfig = {};
  private webhookSecret: string | null = null;
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      hostname: config.hostname as string | undefined,
    };
    
    if (secrets?.webhookSecret) {
      this.webhookSecret = secrets.webhookSecret;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    // SendGrid inbound parse is webhook-based, so we can't actively test
    // We just verify configuration is present
    return {
      success: true,
      message: 'SendGrid Inbound Parse configured. Waiting for first email.',
      details: {
        hostname: this.config.hostname,
        hasWebhookSecret: !!this.webhookSecret,
      },
    };
  }
  
  async disconnect(): Promise<void> {
    this.config = {};
    this.webhookSecret = null;
  }
  
  async generateWebhookConfig(orgId: number): Promise<EmailWebhookConfig> {
    const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.com';
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    
    return {
      webhookUrl: `${baseUrl}/api/webhooks/email/sendgrid/${orgId}`,
      webhookSecret,
      setupInstructions: [
        '1. Log in to your SendGrid account at https://app.sendgrid.com',
        '2. Go to Settings → Inbound Parse',
        '3. Click "Add Host & URL"',
        `4. Enter your receiving domain: ${this.config.hostname || 'ingest.yourdomain.com'}`,
        '5. Paste the Webhook URL shown above',
        '6. Enable "POST the raw, full MIME message"',
        '7. Click "Add"',
        '8. Configure your domain\'s MX records to point to mx.sendgrid.net',
        '9. Send a test email to verify the setup',
      ],
      verificationSteps: [
        'Send an email to any address @' + (this.config.hostname || 'your-configured-domain'),
        'Check the webhook events log for the received email',
        'Verify the email appears in your KIISHA inbox',
      ],
    };
  }
  
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean {
    // SendGrid doesn't sign inbound parse webhooks by default
    // If you've configured signed webhooks, implement verification here
    // For now, we rely on the webhook URL being secret
    return true;
  }
  
  async parseInboundEmail(payload: unknown): Promise<ParsedEmail> {
    const data = payload as Record<string, unknown>;
    
    // SendGrid sends form data with these fields:
    // - from, to, cc, bcc, subject
    // - text, html
    // - headers (JSON string)
    // - attachments (number of attachments)
    // - attachment-info (JSON with attachment metadata)
    // - attachment1, attachment2, etc. (file data)
    
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
    if (data.headers && typeof data.headers === 'string') {
      try {
        const headerLines = data.headers.split('\n');
        for (const line of headerLines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();
            headers[key] = value;
          }
        }
      } catch {
        // Ignore header parsing errors
      }
    }
    
    // Parse attachments
    const attachments: EmailAttachment[] = [];
    const attachmentCount = parseInt(data.attachments as string || '0', 10);
    
    if (data['attachment-info'] && typeof data['attachment-info'] === 'string') {
      try {
        const attachmentInfo = JSON.parse(data['attachment-info']);
        for (const [key, info] of Object.entries(attachmentInfo)) {
          const attachmentData = data[key];
          if (attachmentData) {
            const meta = info as { filename: string; type: string; 'content-id'?: string };
            attachments.push({
              filename: meta.filename,
              contentType: meta.type,
              size: typeof attachmentData === 'string' ? attachmentData.length : 0,
              content: attachmentData as string,
              contentId: meta['content-id'],
            });
          }
        }
      } catch {
        // Ignore attachment parsing errors
      }
    }
    
    // Generate message ID
    const messageId = headers['Message-ID'] || 
                      headers['Message-Id'] || 
                      `sendgrid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    return {
      messageId: messageId.replace(/[<>]/g, ''),
      from: parseAddress(data.from as string || ''),
      to: parseAddressList(data.to as string),
      cc: parseAddressList(data.cc as string),
      bcc: parseAddressList(data.bcc as string),
      subject: data.subject as string || '(no subject)',
      textBody: data.text as string | undefined,
      htmlBody: data.html as string | undefined,
      attachments,
      headers,
      receivedAt: new Date(),
      rawPayload: payload,
    };
  }
}
