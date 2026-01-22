/**
 * Manus Built-in Notify Adapter
 * 
 * Uses the platform's built-in notification service.
 * No configuration required - credentials are injected automatically.
 */

import type {
  NotifyProviderAdapter,
  SendEmailOptions,
  NotifySendResult,
  TestConnectionResult,
} from '../../interfaces';
import { notifyOwner } from '../../../_core/notification';

export class ManusNotifyAdapter implements NotifyProviderAdapter {
  readonly providerId = 'manus' as const;
  readonly integrationType = 'notify' as const;
  readonly isBuiltIn = true;
  
  async initialize(): Promise<void> {
    // No initialization needed - uses platform credentials
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    // The Manus notification service is always available
    return {
      success: true,
      message: 'Manus notification service is operational',
    };
  }
  
  async disconnect(): Promise<void> {
    // Nothing to clean up
  }
  
  async sendEmail(options: SendEmailOptions): Promise<NotifySendResult> {
    // Manus built-in doesn't support arbitrary email sending
    // It only supports notifying the owner
    // For user emails, an external provider should be configured
    console.warn('[ManusNotify] Email sending not supported. Use notifyOwner instead.');
    
    return {
      success: false,
      error: 'Email sending not supported by Manus built-in. Configure an external email provider.',
    };
  }
  
  async notifyOwner(title: string, content: string): Promise<NotifySendResult> {
    try {
      const success = await notifyOwner({ title, content });
      
      return {
        success,
        messageId: success ? `manus-${Date.now()}` : undefined,
        error: success ? undefined : 'Failed to send notification',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
