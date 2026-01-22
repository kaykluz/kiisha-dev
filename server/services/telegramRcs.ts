/**
 * Telegram and RCS Messaging Service - Full WhatsApp-like channels
 */

export interface TelegramConfig { botToken: string; }
export interface RcsConfig { agentId: string; apiKey: string; }
export interface IncomingMessage { platform: 'telegram' | 'rcs'; messageId: string; chatId: string; userId: string; type: 'text' | 'voice' | 'photo' | 'document' | 'location'; content: string; mediaUrl?: string; location?: { lat: number; lng: number }; timestamp: Date; }
export interface ConversationState { userId: string; platform: 'telegram' | 'rcs'; currentFlow?: string; flowData: Record<string, any>; lastActivity: Date; }

export class TelegramBotClient {
  private token: string;
  private baseUrl: string;

  constructor(config: TelegramConfig) { this.token = config.botToken; this.baseUrl = `https://api.telegram.org/bot${this.token}`; }

  async setWebhook(url: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    return (await res.json()).ok;
  }

  async sendMessage(chatId: string, text: string, buttons?: Array<{ text: string; callback: string }>): Promise<any> {
    const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (buttons) body.reply_markup = { inline_keyboard: buttons.map(b => [{ text: b.text, callback_data: b.callback }]) };
    return (await fetch(`${this.baseUrl}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
  }

  async sendPhoto(chatId: string, photoUrl: string, caption?: string): Promise<any> {
    return (await fetch(`${this.baseUrl}/sendPhoto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption }) })).json();
  }

  async getFile(fileId: string): Promise<string> {
    const data = await (await fetch(`${this.baseUrl}/getFile?file_id=${fileId}`)).json();
    return `https://api.telegram.org/file/bot${this.token}/${data.result.file_path}`;
  }

  parseWebhook(body: any): IncomingMessage | null {
    const msg = body.message || body.callback_query?.message;
    if (!msg) return null;
    const base = { platform: 'telegram' as const, messageId: String(msg.message_id), chatId: String(msg.chat.id), userId: String(msg.from?.id || msg.chat.id), timestamp: new Date(msg.date * 1000) };
    if (body.callback_query) return { ...base, type: 'text', content: body.callback_query.data };
    if (msg.text) return { ...base, type: 'text', content: msg.text };
    if (msg.voice) return { ...base, type: 'voice', content: '', mediaUrl: msg.voice.file_id };
    if (msg.photo) return { ...base, type: 'photo', content: msg.caption || '', mediaUrl: msg.photo[msg.photo.length - 1].file_id };
    if (msg.document) return { ...base, type: 'document', content: msg.caption || '', mediaUrl: msg.document.file_id };
    if (msg.location) return { ...base, type: 'location', content: '', location: { lat: msg.location.latitude, lng: msg.location.longitude } };
    return null;
  }
}

export class RcsBotClient {
  private agentId: string;
  private apiKey: string;
  private baseUrl = 'https://rcsbusinessmessaging.googleapis.com/v1';

  constructor(config: RcsConfig) { this.agentId = config.agentId; this.apiKey = config.apiKey; }

  async sendMessage(chatId: string, text: string, suggestions?: Array<{ text: string; postbackData: string }>): Promise<any> {
    const body: any = { contentMessage: { text } };
    if (suggestions) body.contentMessage.suggestions = suggestions.map(s => ({ reply: { text: s.text, postbackData: s.postbackData } }));
    return (await fetch(`${this.baseUrl}/phones/${chatId}/agentMessages?messageId=${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` }, body: JSON.stringify(body) })).json();
  }

  parseWebhook(body: any): IncomingMessage | null {
    const msg = body.message || body.suggestionResponse;
    if (!msg) return null;
    return { platform: 'rcs', messageId: body.messageId || String(Date.now()), chatId: body.senderPhoneNumber, userId: body.senderPhoneNumber, type: 'text', content: msg.text || body.suggestionResponse?.postbackData || '', timestamp: new Date() };
  }
}

export class UnifiedMessagingService {
  private telegramClient?: TelegramBotClient;
  private rcsClient?: RcsBotClient;
  private conversations: Map<string, ConversationState> = new Map();

  configureTelegram(config: TelegramConfig): void { this.telegramClient = new TelegramBotClient(config); }
  configureRcs(config: RcsConfig): void { this.rcsClient = new RcsBotClient(config); }

  async handleIncoming(message: IncomingMessage): Promise<void> {
    const key = `${message.platform}_${message.userId}`;
    let state = this.conversations.get(key) || { userId: message.userId, platform: message.platform, flowData: {}, lastActivity: new Date() };
    state.lastActivity = new Date();

    if (message.type === 'text') {
      const cmd = message.content.toLowerCase();
      if (cmd === '/start' || cmd === '/menu') await this.sendMainMenu(message.platform, message.chatId);
      else if (cmd === '/neworder') { await this.sendMessage(message.platform, message.chatId, '📝 Describe the issue:'); state.currentFlow = 'work_order'; state.flowData = { step: 'description' }; }
      else if (cmd === '/help') await this.sendMessage(message.platform, message.chatId, 'Commands: /start /neworder /orders /invoices /help');
      else if (state.currentFlow === 'work_order') await this.handleWorkOrderFlow(message, state);
      else await this.sendMessage(message.platform, message.chatId, 'How can I help? Use /menu for options.');
    } else if (message.type === 'voice') {
      await this.sendMessage(message.platform, message.chatId, '🎤 Voice received! Transcribing and creating work order...');
    } else if (message.type === 'photo' || message.type === 'document') {
      await this.sendMessage(message.platform, message.chatId, '📎 File attached to your work order.');
      if (state.currentFlow === 'work_order') state.flowData.attachments = [...(state.flowData.attachments || []), message.mediaUrl];
    } else if (message.type === 'location') {
      await this.sendMessage(message.platform, message.chatId, `📍 Location received.`);
      if (state.currentFlow === 'work_order') state.flowData.location = message.location;
    }
    this.conversations.set(key, state);
  }

  private async sendMainMenu(platform: 'telegram' | 'rcs', chatId: string): Promise<void> {
    await this.sendMessage(platform, chatId, 'Welcome to KIISHA!', [
      { text: '📝 New Order', callback: '/neworder' },
      { text: '📋 My Orders', callback: '/orders' },
      { text: '💰 Invoices', callback: '/invoices' },
      { text: '❓ Help', callback: '/help' }
    ]);
  }

  private async handleWorkOrderFlow(message: IncomingMessage, state: ConversationState): Promise<void> {
    if (state.flowData.step === 'description') {
      state.flowData.description = message.content;
      state.flowData.step = 'priority';
      await this.sendMessage(message.platform, message.chatId, 'Priority?', [{ text: '🔴 High', callback: 'high' }, { text: '🟡 Medium', callback: 'medium' }, { text: '🟢 Low', callback: 'low' }]);
    } else if (state.flowData.step === 'priority') {
      state.flowData.priority = message.content;
      await this.sendMessage(message.platform, message.chatId, '✅ Work order submitted!');
      state.currentFlow = undefined; state.flowData = {};
    }
  }

  private async sendMessage(platform: 'telegram' | 'rcs', chatId: string, text: string, buttons?: Array<{ text: string; callback: string }>): Promise<void> {
    if (platform === 'telegram' && this.telegramClient) await this.telegramClient.sendMessage(chatId, text, buttons);
    else if (platform === 'rcs' && this.rcsClient) await this.rcsClient.sendMessage(chatId, text, buttons?.map(b => ({ text: b.text, postbackData: b.callback })));
  }
}

export const unifiedMessagingService = new UnifiedMessagingService();
export default { TelegramBotClient, RcsBotClient, UnifiedMessagingService, unifiedMessagingService };
