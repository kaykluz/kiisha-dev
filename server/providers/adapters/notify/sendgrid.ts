/**
 * SendGrid Notify Adapter
 * 
 * Uses SendGrid for sending transactional emails.
 */

import type {
  NotifyProviderAdapter,
  SendEmailOptions,
  NotifySendResult,
  TestConnectionResult,
} from '../../interfaces';

interface SendGridConfig {
  fromEmail?: string;
  fromName?: string;
}

export class SendGridNotifyAdapter implements NotifyProviderAdapter {
  readonly providerId = 'sendgrid' as const;
  readonly integrationType = 'notify' as const;
  readonly isBuiltIn = false;
  
  private config: SendGridConfig = {};
  private apiKey: string | null = null;
  private baseUrl = 'https://api.sendgrid.com/v3';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      fromEmail: config.fromEmail as string,
      fromName: config.fromName as string || 'KIISHA',
    };
    
    if (secrets?.apiKey) {
      this.apiKey = secrets.apiKey;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return { success: false, message: 'SendGrid API key not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Test API connectivity by getting user info
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'Connected to SendGrid',
          latencyMs: Date.now() - start,
        };
      } else {
        const error = await response.json().catch(() => ({ errors: [{ message: response.statusText }] }));
        return {
          success: false,
          message: `SendGrid error: ${error.errors?.[0]?.message || response.status}`,
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
  }
  
  async sendEmail(options: SendEmailOptions): Promise<NotifySendResult> {
    if (!this.apiKey) {
      return { success: false, error: 'SendGrid API key not configured' };
    }
    
    const to = Array.isArray(options.to) ? options.to : [options.to];
    
    const personalizations: Array<{ to: Array<{ email: string }>; cc?: Array<{ email: string }>; bcc?: Array<{ email: string }> }> = [{
      to: to.map(email => ({ email })),
    }];
    
    if (options.cc && options.cc.length > 0) {
      personalizations[0].cc = options.cc.map(email => ({ email }));
    }
    
    if (options.bcc && options.bcc.length > 0) {
      personalizations[0].bcc = options.bcc.map(email => ({ email }));
    }
    
    const content: Array<{ type: string; value: string }> = [];
    if (options.text) {
      content.push({ type: 'text/plain', value: options.text });
    }
    if (options.html) {
      content.push({ type: 'text/html', value: options.html });
    }
    
    const body: Record<string, unknown> = {
      personalizations,
      from: {
        email: options.from || this.config.fromEmail,
        name: this.config.fromName,
      },
      subject: options.subject,
      content,
    };
    
    if (options.replyTo) {
      body.reply_to = { email: options.replyTo };
    }
    
    // Handle attachments
    if (options.attachments && options.attachments.length > 0) {
      body.attachments = options.attachments.map(att => ({
        content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
        filename: att.filename,
        type: att.contentType,
        disposition: 'attachment',
      }));
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (response.ok || response.status === 202) {
        const messageId = response.headers.get('X-Message-Id') || `sg-${Date.now()}`;
        return {
          success: true,
          messageId,
        };
      } else {
        const error = await response.json().catch(() => ({ errors: [{ message: response.statusText }] }));
        return {
          success: false,
          error: error.errors?.[0]?.message || `SendGrid error: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async notifyOwner(title: string, content: string): Promise<NotifySendResult> {
    // Get owner email from environment
    const ownerEmail = process.env.OWNER_EMAIL;
    
    if (!ownerEmail) {
      return {
        success: false,
        error: 'Owner email not configured',
      };
    }
    
    return this.sendEmail({
      to: ownerEmail,
      subject: `[KIISHA] ${title}`,
      text: content,
      html: `<h2>${title}</h2><p>${content.replace(/\n/g, '<br>')}</p>`,
    });
  }
}
