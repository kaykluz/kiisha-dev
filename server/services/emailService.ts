/**
 * Email Service with Resend Provider
 * 
 * Provides email sending capabilities with:
 * - Provider adapter pattern for easy switching
 * - Config validation on startup
 * - Template support
 * - Audit logging
 */

import * as db from "../db";

// Email provider interface
interface EmailProvider {
  name: string;
  send(options: SendEmailOptions): Promise<SendEmailResult>;
  validateConfig(): Promise<boolean>;
}

// Email options
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

// Email result
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

// Template types
export type EmailTemplateId = 
  | "email_verification"
  | "password_reset"
  | "welcome"
  | "notification";

interface EmailTemplate {
  subject: string;
  html: (data: Record<string, unknown>) => string;
  text: (data: Record<string, unknown>) => string;
}

// Email templates
const EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplate> = {
  email_verification: {
    subject: "Verify your email address",
    html: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Verify Your Email</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <p>Hi ${data.userName || "there"},</p>
            <p>You requested to change your email address to <strong>${data.newEmail}</strong>.</p>
            <p>Please use the following verification code to confirm this change:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea;">${data.verificationCode}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in ${data.expiresInMinutes || 30} minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this change, please ignore this email or contact support.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
              Reference ID: ${data.correlationId || "N/A"}<br>
              This email was sent by KIISHA.
            </p>
          </div>
        </body>
      </html>
    `,
    text: (data) => `
Verify Your Email

Hi ${data.userName || "there"},

You requested to change your email address to ${data.newEmail}.

Your verification code is: ${data.verificationCode}

This code will expire in ${data.expiresInMinutes || 30} minutes.

If you didn't request this change, please ignore this email or contact support.

Reference ID: ${data.correlationId || "N/A"}
    `.trim(),
  },
  
  password_reset: {
    subject: "Reset your password",
    html: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Reset Your Password</h1>
          <p>Hi ${data.userName || "there"},</p>
          <p>Click the link below to reset your password:</p>
          <a href="${data.resetLink}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Reset Password</a>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">This link will expire in ${data.expiresInMinutes || 60} minutes.</p>
        </body>
      </html>
    `,
    text: (data) => `
Reset Your Password

Hi ${data.userName || "there"},

Click the link below to reset your password:
${data.resetLink}

This link will expire in ${data.expiresInMinutes || 60} minutes.
    `.trim(),
  },
  
  welcome: {
    subject: "Welcome to KIISHA",
    html: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>Welcome to KIISHA!</h1>
          <p>Hi ${data.userName || "there"},</p>
          <p>Thank you for joining KIISHA. We're excited to have you on board!</p>
          <p>Get started by exploring your dashboard and setting up your first project.</p>
        </body>
      </html>
    `,
    text: (data) => `
Welcome to KIISHA!

Hi ${data.userName || "there"},

Thank you for joining KIISHA. We're excited to have you on board!

Get started by exploring your dashboard and setting up your first project.
    `.trim(),
  },
  
  notification: {
    subject: "Notification from KIISHA",
    html: (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Notification</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1>${data.title || "Notification"}</h1>
          <p>${data.message || ""}</p>
        </body>
      </html>
    `,
    text: (data) => `
${data.title || "Notification"}

${data.message || ""}
    `.trim(),
  },
};

// Resend provider implementation
class ResendProvider implements EmailProvider {
  name = "resend";
  private apiKey: string;
  private fromEmail: string;
  private baseUrl = "https://api.resend.com";

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || "";
    this.fromEmail = process.env.EMAIL_FROM || "noreply@kiisha.app";
  }

  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn("[EmailService] RESEND_API_KEY not configured");
      return false;
    }
    
    try {
      // Test API key by fetching domains (lightweight call)
      const response = await fetch(`${this.baseUrl}/domains`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      
      if (!response.ok) {
        console.error("[EmailService] Resend API key validation failed:", response.status);
        return false;
      }
      
      console.log("[EmailService] Resend provider configured successfully");
      return true;
    } catch (error) {
      console.error("[EmailService] Resend connection error:", error);
      return false;
    }
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Email provider not configured",
        provider: this.name,
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: options.from || this.fromEmail,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          tags: options.tags ? Object.entries(options.tags).map(([name, value]) => ({ name, value })) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || `HTTP ${response.status}`,
          provider: this.name,
        };
      }

      return {
        success: true,
        messageId: data.id,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        provider: this.name,
      };
    }
  }
}

// Console provider for development (fallback)
class ConsoleProvider implements EmailProvider {
  name = "console";

  async validateConfig(): Promise<boolean> {
    console.log("[EmailService] Using console provider (development mode)");
    return true;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    console.log("\n========== EMAIL (Console Provider) ==========");
    console.log(`To: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`From: ${options.from || "noreply@kiisha.app"}`);
    console.log("--- Text Content ---");
    console.log(options.text || "(no text content)");
    console.log("=================================================\n");

    return {
      success: true,
      messageId: `console_${Date.now()}`,
      provider: this.name,
    };
  }
}

// Email service singleton
class EmailService {
  private provider: EmailProvider;
  private initialized = false;

  constructor() {
    // Default to console provider, will be replaced if Resend is configured
    this.provider = new ConsoleProvider();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Try Resend first
    const resendProvider = new ResendProvider();
    if (await resendProvider.validateConfig()) {
      this.provider = resendProvider;
    } else {
      // Fall back to console provider
      this.provider = new ConsoleProvider();
      await this.provider.validateConfig();
    }

    this.initialized = true;
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    await this.initialize();
    return this.provider.send(options);
  }

  async sendTemplate(
    templateId: EmailTemplateId,
    to: string | string[],
    data: Record<string, unknown>,
    options?: Partial<SendEmailOptions>
  ): Promise<SendEmailResult> {
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      return {
        success: false,
        error: `Template '${templateId}' not found`,
        provider: this.provider.name,
      };
    }

    return this.send({
      to,
      subject: template.subject,
      html: template.html(data),
      text: template.text(data),
      ...options,
    });
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Convenience functions
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  return emailService.send(options);
}

export async function sendTemplateEmail(
  templateId: EmailTemplateId,
  to: string | string[],
  data: Record<string, unknown>,
  options?: Partial<SendEmailOptions>
): Promise<SendEmailResult> {
  return emailService.sendTemplate(templateId, to, data, options);
}

/**
 * Send email verification code
 */
export async function sendEmailVerification(
  to: string,
  data: {
    userName?: string;
    newEmail: string;
    verificationCode: string;
    correlationId?: string;
    expiresInMinutes?: number;
  },
  userId?: number
): Promise<SendEmailResult> {
  const result = await sendTemplateEmail("email_verification", to, data);

  // Log the email send attempt
  if (userId) {
    await db.createUserActivity({
      userId,
      action: "verification_email_sent",
      entityType: "email",
      entityId: 0,
      details: {
        newEmail: data.newEmail,
        success: result.success,
        provider: result.provider,
        messageId: result.messageId,
        correlationId: data.correlationId,
        error: result.error,
      },
    });
  }

  return result;
}

/**
 * Validate email service configuration
 * Call this on startup to ensure email is properly configured
 */
export async function validateEmailConfig(): Promise<{
  configured: boolean;
  provider: string;
  error?: string;
}> {
  try {
    await emailService.initialize();
    return {
      configured: true,
      provider: emailService.getProviderName(),
    };
  } catch (error) {
    return {
      configured: false,
      provider: "none",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
