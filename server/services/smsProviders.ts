/**
 * SMS Provider Adapters - Twilio and Africa's Talking
 */

export interface SmsConfig {
  provider: 'twilio' | 'africastalking';
  accountSid?: string;
  authToken?: string;
  apiKey?: string;
  username?: string;
  senderId?: string;
}

export interface SmsMessage {
  to: string;
  body: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
}

export class TwilioAdapter {
  private accountSid: string;
  private authToken: string;
  private senderId?: string;

  constructor(config: SmsConfig) {
    this.accountSid = config.accountSid || '';
    this.authToken = config.authToken || '';
    this.senderId = config.senderId;
  }

  async sendSms(message: SmsMessage): Promise<SmsResult> {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`
          },
          body: new URLSearchParams({
            To: message.to,
            From: message.from || this.senderId || '',
            Body: message.body
          })
        }
      );
      const data = await response.json();
      if (data.error_code) return { success: false, error: data.error_message };
      return { success: true, messageId: data.sid, status: data.status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  parseWebhook(body: any) {
    return {
      provider: 'twilio' as const,
      messageId: body.MessageSid,
      from: body.From,
      to: body.To,
      body: body.Body,
      timestamp: new Date()
    };
  }
}

export class AfricasTalkingAdapter {
  private apiKey: string;
  private username: string;
  private senderId?: string;
  private baseUrl: string;

  constructor(config: SmsConfig) {
    this.apiKey = config.apiKey || '';
    this.username = config.username || '';
    this.senderId = config.senderId;
    this.baseUrl = config.username === 'sandbox' 
      ? 'https://api.sandbox.africastalking.com' 
      : 'https://api.africastalking.com';
  }

  async sendSms(message: SmsMessage): Promise<SmsResult> {
    try {
      const response = await fetch(`${this.baseUrl}/version1/messaging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': this.apiKey
        },
        body: new URLSearchParams({
          username: this.username,
          to: message.to,
          message: message.body,
          ...(message.from || this.senderId ? { from: message.from || this.senderId || '' } : {})
        })
      });
      const data = await response.json();
      const recipient = data.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === 'Success') {
        return { success: true, messageId: recipient.messageId, status: recipient.status };
      }
      return { success: false, error: recipient?.status || 'Failed' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  parseWebhook(body: any) {
    return {
      provider: 'africastalking' as const,
      messageId: body.id,
      from: body.from,
      to: body.to,
      body: body.text,
      timestamp: new Date(body.date || Date.now())
    };
  }
}

export class SmsService {
  private adapter: TwilioAdapter | AfricasTalkingAdapter;

  constructor(config: SmsConfig) {
    this.adapter = config.provider === 'twilio' 
      ? new TwilioAdapter(config) 
      : new AfricasTalkingAdapter(config);
  }

  async send(message: SmsMessage): Promise<SmsResult> {
    return this.adapter.sendSms(message);
  }

  parseWebhook(body: any) {
    return this.adapter.parseWebhook(body);
  }
}

export function createSmsService(config: SmsConfig): SmsService {
  return new SmsService(config);
}

export default { createSmsService, TwilioAdapter, AfricasTalkingAdapter, SmsService };
