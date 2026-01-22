/**
 * Meta WhatsApp Cloud API Adapter
 * 
 * Integrates with Meta's WhatsApp Business Cloud API for
 * sending and receiving WhatsApp messages.
 */

import type {
  WhatsAppProviderAdapter,
  WhatsAppWebhookConfig,
  ParsedWhatsAppMessage,
  WhatsAppContact,
  WhatsAppTemplateComponent,
  WhatsAppSendResult,
  WhatsAppMedia,
  TestConnectionResult,
} from '../../interfaces';
import crypto from 'crypto';

interface MetaWhatsAppConfig {
  phoneNumberId?: string;
  businessAccountId?: string;
}

export class MetaWhatsAppAdapter implements WhatsAppProviderAdapter {
  readonly providerId = 'meta' as const;
  readonly integrationType = 'whatsapp' as const;
  readonly isBuiltIn = false;
  
  private config: MetaWhatsAppConfig = {};
  private accessToken: string | null = null;
  private appSecret: string | null = null;
  private verifyToken: string | null = null;
  private baseUrl = 'https://graph.facebook.com/v18.0';
  
  async initialize(config: Record<string, unknown>, secrets?: Record<string, string>): Promise<void> {
    this.config = {
      phoneNumberId: config.phoneNumberId as string | undefined,
      businessAccountId: config.businessAccountId as string | undefined,
    };
    
    if (secrets?.accessToken) {
      this.accessToken = secrets.accessToken;
    }
    if (secrets?.appSecret) {
      this.appSecret = secrets.appSecret;
    }
    if (secrets?.verifyToken) {
      this.verifyToken = secrets.verifyToken;
    }
  }
  
  async testConnection(): Promise<TestConnectionResult> {
    if (!this.accessToken || !this.config.phoneNumberId) {
      return { success: false, message: 'WhatsApp not configured' };
    }
    
    const start = Date.now();
    
    try {
      // Test API connectivity by getting phone number info
      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `Connected to WhatsApp: ${data.display_phone_number || data.verified_name}`,
          latencyMs: Date.now() - start,
          details: {
            phoneNumber: data.display_phone_number,
            verifiedName: data.verified_name,
            qualityRating: data.quality_rating,
          },
        };
      } else {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        return {
          success: false,
          message: `WhatsApp error: ${error.error?.message || response.status}`,
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
    this.accessToken = null;
    this.appSecret = null;
    this.verifyToken = null;
  }
  
  async generateWebhookConfig(orgId: number): Promise<WhatsAppWebhookConfig> {
    const baseUrl = process.env.VITE_APP_URL || 'https://your-domain.com';
    const verifyToken = crypto.randomBytes(16).toString('hex');
    
    return {
      webhookUrl: `${baseUrl}/api/webhooks/whatsapp/${orgId}`,
      verifyToken,
      setupInstructions: [
        '1. Go to Meta for Developers: https://developers.facebook.com',
        '2. Select your WhatsApp Business App',
        '3. Go to WhatsApp → Configuration',
        '4. Under "Webhook", click "Edit"',
        '5. Paste the Webhook URL shown above',
        '6. Paste the Verify Token shown above',
        '7. Click "Verify and Save"',
        '8. Subscribe to these webhook fields:',
        '   - messages',
        '   - message_template_status_update',
        '9. Go to App Settings → Basic',
        '10. Copy your App Secret and add it to integration secrets',
        '11. Generate a System User Access Token with whatsapp_business_messaging permission',
      ],
    };
  }
  
  verifyWebhookChallenge(mode: string, token: string, challenge: string, expectedToken: string): string | null {
    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    return null;
  }
  
  verifyWebhookSignature(payload: string | Buffer, signature: string, appSecret: string): boolean {
    if (!signature || !appSecret) return false;
    
    // Meta uses sha256 HMAC
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(typeof payload === 'string' ? payload : payload.toString())
      .digest('hex');
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
  
  async parseInboundMessage(payload: unknown): Promise<ParsedWhatsAppMessage[]> {
    const data = payload as Record<string, unknown>;
    const messages: ParsedWhatsAppMessage[] = [];
    
    // Meta webhook payload structure:
    // { object: 'whatsapp_business_account', entry: [{ changes: [{ value: { messages: [...] } }] }] }
    
    if (data.object !== 'whatsapp_business_account') {
      return messages;
    }
    
    const entries = data.entry as Array<Record<string, unknown>> || [];
    
    for (const entry of entries) {
      const changes = entry.changes as Array<Record<string, unknown>> || [];
      
      for (const change of changes) {
        const value = change.value as Record<string, unknown>;
        if (!value) continue;
        
        const incomingMessages = value.messages as Array<Record<string, unknown>> || [];
        
        for (const msg of incomingMessages) {
          const message = this.parseMessage(msg);
          if (message) {
            messages.push(message);
          }
        }
      }
    }
    
    return messages;
  }
  
  private parseMessage(msg: Record<string, unknown>): ParsedWhatsAppMessage | null {
    const type = msg.type as string;
    
    const base: Partial<ParsedWhatsAppMessage> = {
      messageId: msg.id as string,
      from: msg.from as string,
      timestamp: new Date(parseInt(msg.timestamp as string, 10) * 1000),
      rawPayload: msg,
    };
    
    switch (type) {
      case 'text':
        const textContent = msg.text as Record<string, unknown>;
        return {
          ...base,
          type: 'text',
          text: textContent?.body as string,
        } as ParsedWhatsAppMessage;
        
      case 'image':
      case 'document':
      case 'audio':
      case 'video':
        const mediaContent = msg[type] as Record<string, unknown>;
        return {
          ...base,
          type: type as 'image' | 'document' | 'audio' | 'video',
          mediaId: mediaContent?.id as string,
          mimeType: mediaContent?.mime_type as string,
          filename: mediaContent?.filename as string,
          caption: mediaContent?.caption as string,
        } as ParsedWhatsAppMessage;
        
      case 'location':
        const locationContent = msg.location as Record<string, unknown>;
        return {
          ...base,
          type: 'location',
          location: {
            latitude: locationContent?.latitude as number,
            longitude: locationContent?.longitude as number,
            name: locationContent?.name as string,
            address: locationContent?.address as string,
          },
        } as ParsedWhatsAppMessage;
        
      case 'contacts':
        const contactsContent = msg.contacts as Array<Record<string, unknown>>;
        return {
          ...base,
          type: 'contacts',
          contacts: contactsContent?.map(c => ({
            name: c.name as WhatsAppContact['name'],
            phones: c.phones as WhatsAppContact['phones'],
            emails: c.emails as WhatsAppContact['emails'],
          })),
        } as ParsedWhatsAppMessage;
        
      case 'reaction':
        const reactionContent = msg.reaction as Record<string, unknown>;
        return {
          ...base,
          type: 'reaction',
          reaction: {
            messageId: reactionContent?.message_id as string,
            emoji: reactionContent?.emoji as string,
          },
        } as ParsedWhatsAppMessage;
        
      case 'interactive':
        const interactiveContent = msg.interactive as Record<string, unknown>;
        return {
          ...base,
          type: 'interactive',
          text: JSON.stringify(interactiveContent),
        } as ParsedWhatsAppMessage;
        
      default:
        return null;
    }
  }
  
  async sendTextMessage(to: string, message: string): Promise<WhatsAppSendResult> {
    if (!this.accessToken || !this.config.phoneNumberId) {
      throw new Error('WhatsApp not configured');
    }
    
    const response = await fetch(
      `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`WhatsApp send failed: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    return {
      messageId: data.messages?.[0]?.id || '',
      status: 'sent',
    };
  }
  
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: WhatsAppTemplateComponent[]
  ): Promise<WhatsAppSendResult> {
    if (!this.accessToken || !this.config.phoneNumberId) {
      throw new Error('WhatsApp not configured');
    }
    
    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: languageCode },
    };
    
    if (components && components.length > 0) {
      template.components = components;
    }
    
    const response = await fetch(
      `${this.baseUrl}/${this.config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template,
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`WhatsApp template send failed: ${error.error?.message || response.status}`);
    }
    
    const data = await response.json();
    
    return {
      messageId: data.messages?.[0]?.id || '',
      status: 'sent',
    };
  }
  
  async downloadMedia(mediaId: string): Promise<WhatsAppMedia> {
    if (!this.accessToken) {
      throw new Error('WhatsApp not configured');
    }
    
    // First, get the media URL
    const urlResponse = await fetch(
      `${this.baseUrl}/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      }
    );
    
    if (!urlResponse.ok) {
      throw new Error(`Failed to get media URL: ${urlResponse.status}`);
    }
    
    const urlData = await urlResponse.json();
    const mediaUrl = urlData.url;
    const mimeType = urlData.mime_type;
    
    // Then download the actual media
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status}`);
    }
    
    const buffer = Buffer.from(await mediaResponse.arrayBuffer());
    
    return {
      data: buffer,
      mimeType,
      filename: urlData.filename,
    };
  }
}
