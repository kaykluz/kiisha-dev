/**
 * Resend Notify Adapter
 * 
 * Uses Resend API for sending transactional emails.
 */

import type {
  NotifyProviderAdapter,
  SendEmailOptions,
  NotifySendResult,
  TestConnectionResult,
} from '../../interfaces';
import { ENV } from '../../../_core/env';

interface ResendEmailResponse {
  id: string;
}

interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

export class ResendNotifyAdapter implements NotifyProviderAdapter {
  readonly providerId = 'resend' as const;
  readonly integrationType = 'notify' as const;
  readonly isBuiltIn = false;
  
  private apiKey: string = '';
  private fromEmail: string = 'noreply@mail.kiisha.io';
  
  async initialize(config?: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    // Try to get API key from secrets first, then from environment
    this.apiKey = secrets?.apiKey || ENV.resendApiKey || '';
    
    if (config?.fromEmail) {
      this.fromEmail = config.fromEmail as string;
    }
    
    if (!this.apiKey) {
      console.warn('[ResendNotify] No API key configured');
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        message: 'Resend API key not configured',
      };
    }
    
    try {
      // Test by getting API key info
      const response = await fetch('https://api.resend.com/api-keys', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      if (response.ok) {
        return {
          success: true,
          message: 'Resend connection successful',
        };
      } else {
        const error = await response.json() as ResendErrorResponse;
        return {
          success: false,
          message: error.message || 'Failed to connect to Resend',
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async disconnect(): Promise<void> {
    // Nothing to clean up
  }
  
  async sendEmail(options: SendEmailOptions): Promise<NotifySendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Resend API key not configured',
      };
    }
    
    try {
      const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
      
      const payload = {
        from: options.from || this.fromEmail,
        to: toAddresses,
        subject: options.subject,
        text: options.text,
        html: options.html,
        reply_to: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
      };
      
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json() as ResendEmailResponse;
        console.log(`[ResendNotify] Email sent successfully: ${data.id}`);
        return {
          success: true,
          messageId: data.id,
        };
      } else {
        const error = await response.json() as ResendErrorResponse;
        console.error(`[ResendNotify] Failed to send email: ${error.message}`);
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }
    } catch (error) {
      console.error('[ResendNotify] Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  async notifyOwner(title: string, content: string): Promise<NotifySendResult> {
    // For owner notifications, we could send to a configured admin email
    // For now, just log it
    console.log(`[ResendNotify] Owner notification: ${title} - ${content}`);
    return {
      success: true,
      messageId: `resend-owner-${Date.now()}`,
    };
  }
}
