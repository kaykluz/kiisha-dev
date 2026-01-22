/**
 * Phase 38: Email Templates Router
 * 
 * Provides CRUD operations for customizable email templates per organization.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createEmailTemplate,
  getEmailTemplateById,
  getEmailTemplatesByOrg,
  updateEmailTemplate,
  deleteEmailTemplate,
} from "../db";

// Template type enum
const templateTypeSchema = z.enum([
  "request_issued",
  "request_reminder",
  "request_submitted",
  "request_clarification",
  "request_completed",
  "request_overdue",
  "password_reset",
  "welcome",
  "invitation",
  "invoice_new",
  "invoice_reminder",
  "payment_confirmation",
  "work_order_status",
  "work_order_comment",
  "production_report",
  "maintenance_alert",
  "custom"
]);

// Available variables per template type
const templateVariables: Record<string, string[]> = {
  request_issued: [
    "{{recipient_name}}",
    "{{recipient_email}}",
    "{{request_title}}",
    "{{request_description}}",
    "{{due_date}}",
    "{{issuer_name}}",
    "{{issuer_org}}",
    "{{request_link}}",
  ],
  request_reminder: [
    "{{recipient_name}}",
    "{{request_title}}",
    "{{due_date}}",
    "{{days_remaining}}",
    "{{request_link}}",
  ],
  request_submitted: [
    "{{issuer_name}}",
    "{{submitter_name}}",
    "{{request_title}}",
    "{{submission_date}}",
    "{{request_link}}",
  ],
  request_clarification: [
    "{{recipient_name}}",
    "{{request_title}}",
    "{{clarification_message}}",
    "{{sender_name}}",
    "{{request_link}}",
  ],
  request_completed: [
    "{{recipient_name}}",
    "{{request_title}}",
    "{{completion_date}}",
    "{{request_link}}",
  ],
  request_overdue: [
    "{{recipient_name}}",
    "{{request_title}}",
    "{{due_date}}",
    "{{days_overdue}}",
    "{{request_link}}",
  ],
  password_reset: [
    "{{user_name}}",
    "{{reset_link}}",
    "{{expiry_time}}",
  ],
  welcome: [
    "{{user_name}}",
    "{{org_name}}",
    "{{login_link}}",
  ],
  invitation: [
    "{{invitee_email}}",
    "{{inviter_name}}",
    "{{org_name}}",
    "{{role}}",
    "{{invite_link}}",
    "{{expiry_date}}",
  ],
  invoice_new: [
    "{{customer_name}}",
    "{{company_name}}",
    "{{invoice_number}}",
    "{{invoice_amount}}",
    "{{due_date}}",
    "{{invoice_link}}",
    "{{line_items}}",
  ],
  invoice_reminder: [
    "{{customer_name}}",
    "{{company_name}}",
    "{{invoice_number}}",
    "{{invoice_amount}}",
    "{{due_date}}",
    "{{days_overdue}}",
    "{{invoice_link}}",
    "{{reminder_number}}",
  ],
  payment_confirmation: [
    "{{customer_name}}",
    "{{company_name}}",
    "{{invoice_number}}",
    "{{payment_amount}}",
    "{{payment_date}}",
    "{{payment_method}}",
    "{{receipt_link}}",
  ],
  work_order_status: [
    "{{customer_name}}",
    "{{work_order_id}}",
    "{{work_order_title}}",
    "{{old_status}}",
    "{{new_status}}",
    "{{site_name}}",
    "{{work_order_link}}",
  ],
  work_order_comment: [
    "{{customer_name}}",
    "{{work_order_id}}",
    "{{work_order_title}}",
    "{{commenter_name}}",
    "{{comment_text}}",
    "{{work_order_link}}",
  ],
  production_report: [
    "{{customer_name}}",
    "{{report_period}}",
    "{{total_production}}",
    "{{average_daily}}",
    "{{site_name}}",
    "{{report_link}}",
  ],
  maintenance_alert: [
    "{{customer_name}}",
    "{{alert_type}}",
    "{{alert_message}}",
    "{{site_name}}",
    "{{device_name}}",
    "{{alert_time}}",
    "{{dashboard_link}}",
  ],
  custom: [],
};

// Default templates
const defaultTemplates: Record<string, { subject: string; bodyHtml: string }> = {
  request_issued: {
    subject: "New Request: {{request_title}}",
    bodyHtml: `
      <h2>Hello {{recipient_name}},</h2>
      <p>You have received a new request from {{issuer_name}} at {{issuer_org}}.</p>
      <h3>{{request_title}}</h3>
      <p>{{request_description}}</p>
      <p><strong>Due Date:</strong> {{due_date}}</p>
      <p><a href="{{request_link}}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Request</a></p>
    `,
  },
  request_reminder: {
    subject: "Reminder: {{request_title}} due in {{days_remaining}} days",
    bodyHtml: `
      <h2>Hello {{recipient_name}},</h2>
      <p>This is a reminder that your response to the following request is due soon.</p>
      <h3>{{request_title}}</h3>
      <p><strong>Due Date:</strong> {{due_date}}</p>
      <p><strong>Days Remaining:</strong> {{days_remaining}}</p>
      <p><a href="{{request_link}}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Complete Request</a></p>
    `,
  },
  request_submitted: {
    subject: "Submission Received: {{request_title}}",
    bodyHtml: `
      <h2>Hello {{issuer_name}},</h2>
      <p>{{submitter_name}} has submitted a response to your request.</p>
      <h3>{{request_title}}</h3>
      <p><strong>Submitted:</strong> {{submission_date}}</p>
      <p><a href="{{request_link}}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review Submission</a></p>
    `,
  },
  request_clarification: {
    subject: "Clarification Needed: {{request_title}}",
    bodyHtml: `
      <h2>Hello {{recipient_name}},</h2>
      <p>{{sender_name}} has requested clarification on your submission.</p>
      <h3>{{request_title}}</h3>
      <blockquote style="border-left: 4px solid #f97316; padding-left: 16px; margin: 16px 0;">
        {{clarification_message}}
      </blockquote>
      <p><a href="{{request_link}}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Respond to Clarification</a></p>
    `,
  },
};

export const emailTemplatesRouter = router({
  /**
   * List all email templates for the organization
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = ctx.user.activeOrgId;
    if (!organizationId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active organization selected"
      });
    }

    return await getEmailTemplatesByOrg(organizationId);
  }),

  /**
   * Get a single email template by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const template = await getEmailTemplateById(input.id);
      
      if (!template || template.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email template not found"
        });
      }

      return template;
    }),

  /**
   * Get available variables for a template type
   */
  getVariables: protectedProcedure
    .input(z.object({ templateType: templateTypeSchema }))
    .query(({ input }) => {
      return templateVariables[input.templateType] || [];
    }),

  /**
   * Get default template content for a type
   */
  getDefaultContent: protectedProcedure
    .input(z.object({ templateType: templateTypeSchema }))
    .query(({ input }) => {
      return defaultTemplates[input.templateType] || { subject: "", bodyHtml: "" };
    }),

  /**
   * Create a new email template
   */
  create: protectedProcedure
    .input(z.object({
      templateType: templateTypeSchema,
      name: z.string().min(1),
      description: z.string().optional(),
      subject: z.string().min(1),
      bodyHtml: z.string().min(1),
      bodyText: z.string().optional(),
      headerLogoUrl: z.string().optional(),
      footerText: z.string().optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.user.activeOrgId;
      if (!organizationId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active organization selected"
        });
      }

      const templateId = await createEmailTemplate({
        organizationId,
        templateType: input.templateType,
        name: input.name,
        description: input.description,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText,
        headerLogoUrl: input.headerLogoUrl,
        footerText: input.footerText,
        primaryColor: input.primaryColor,
        availableVariables: templateVariables[input.templateType],
        isDefault: input.isDefault || false,
        isActive: true,
        createdBy: ctx.user.id,
      });

      return { id: templateId };
    }),

  /**
   * Update an email template
   */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      subject: z.string().min(1).optional(),
      bodyHtml: z.string().min(1).optional(),
      bodyText: z.string().optional(),
      headerLogoUrl: z.string().optional(),
      footerText: z.string().optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await getEmailTemplateById(input.id);
      
      if (!template || template.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email template not found"
        });
      }

      const { id, ...updateData } = input;
      await updateEmailTemplate(id, {
        ...updateData,
        updatedBy: ctx.user.id,
      });

      return { success: true };
    }),

  /**
   * Delete an email template
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const template = await getEmailTemplateById(input.id);
      
      if (!template || template.organizationId !== ctx.user.activeOrgId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Email template not found"
        });
      }

      await deleteEmailTemplate(input.id);
      return { success: true };
    }),

  /**
   * Preview a template with sample data
   */
  preview: protectedProcedure
    .input(z.object({
      subject: z.string(),
      bodyHtml: z.string(),
      templateType: templateTypeSchema,
    }))
    .mutation(({ input }) => {
      // Sample data for preview
      const sampleData: Record<string, string> = {
        "{{recipient_name}}": "John Smith",
        "{{recipient_email}}": "john.smith@example.com",
        "{{request_title}}": "Q4 Financial Documents",
        "{{request_description}}": "Please provide the quarterly financial statements and supporting documentation.",
        "{{due_date}}": "January 31, 2026",
        "{{days_remaining}}": "7",
        "{{days_overdue}}": "3",
        "{{issuer_name}}": "Jane Doe",
        "{{issuer_org}}": "KIISHA Energy",
        "{{submitter_name}}": "John Smith",
        "{{submission_date}}": "January 24, 2026",
        "{{sender_name}}": "Jane Doe",
        "{{clarification_message}}": "Could you please provide more details about the depreciation schedule?",
        "{{completion_date}}": "January 25, 2026",
        "{{request_link}}": "https://app.kiisha.com/requests/123",
        "{{user_name}}": "John Smith",
        "{{reset_link}}": "https://app.kiisha.com/reset-password?token=abc123",
        "{{expiry_time}}": "24 hours",
        "{{org_name}}": "KIISHA Energy",
        "{{login_link}}": "https://app.kiisha.com/login",
        "{{invitee_email}}": "new.user@example.com",
        "{{inviter_name}}": "Jane Doe",
        "{{role}}": "Editor",
        "{{invite_link}}": "https://app.kiisha.com/invite/abc123",
        "{{expiry_date}}": "February 1, 2026",
      };

      let previewSubject = input.subject;
      let previewBody = input.bodyHtml;

      for (const [variable, value] of Object.entries(sampleData)) {
        previewSubject = previewSubject.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
        previewBody = previewBody.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
      }

      return {
        subject: previewSubject,
        bodyHtml: previewBody,
      };
    }),
});
