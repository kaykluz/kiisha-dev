import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { invoiceBrandingSettings } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Invoice Branding Router
 * Manages invoice PDF branding settings
 */
export const invoiceBrandingRouter = router({
  // Get branding settings for an organization (or global default)
  getSettings: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const orgId = input?.organizationId;

      // Try to get org-specific settings first
      if (orgId) {
        const [orgSettings] = await db
          .select()
          .from(invoiceBrandingSettings)
          .where(and(
            eq(invoiceBrandingSettings.organizationId, orgId),
            eq(invoiceBrandingSettings.isActive, true)
          ))
          .limit(1);

        if (orgSettings) return orgSettings;
      }

      // Fall back to global settings (organizationId is null)
      const [globalSettings] = await db
        .select()
        .from(invoiceBrandingSettings)
        .where(and(
          isNull(invoiceBrandingSettings.organizationId),
          eq(invoiceBrandingSettings.isActive, true)
        ))
        .limit(1);

      // Return default settings if none exist
      if (!globalSettings) {
        return {
          id: 0,
          organizationId: null,
          companyName: "KIISHA Energy",
          companyAddress: "123 Solar Street",
          companyCity: "Lagos",
          companyState: null,
          companyPostalCode: null,
          companyCountry: "Nigeria",
          companyEmail: "billing@kiisha.energy",
          companyPhone: "+234 800 000 0000",
          companyWebsite: "https://kiisha.energy",
          taxId: "NG-12345678",
          registrationNumber: null,
          logoUrl: "/logo.png",
          logoWidth: 200,
          logoHeight: 60,
          primaryColor: "#f97316",
          secondaryColor: "#1e293b",
          accentColor: "#3b82f6",
          fontFamily: "Inter",
          headerFontSize: 24,
          bodyFontSize: 10,
          bankName: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankRoutingNumber: null,
          bankSwiftCode: null,
          bankIban: null,
          bankBranch: null,
          bankAddress: null,
          paymentInstructions: "Please make payment within the due date to avoid late fees.",
          acceptedPaymentMethods: ["bank_transfer", "credit_card"],
          footerText: "Thank you for your business!",
          termsAndConditions: null,
          latePaymentPolicy: "A late fee of 1.5% per month will be applied to overdue invoices.",
          invoicePrefix: "INV",
          invoiceNumberFormat: "{{prefix}}-{{year}}-{{number}}",
          nextInvoiceNumber: 1,
          showLogo: true,
          showBankDetails: true,
          showPaymentInstructions: true,
          showTerms: true,
          showTaxBreakdown: true,
          showLineItemTax: true,
          paperSize: "A4" as const,
          defaultCurrency: "USD",
          currencySymbol: "$",
          currencyPosition: "before" as const,
          dateFormat: "MMM DD, YYYY",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null,
          updatedBy: null,
        };
      }

      return globalSettings;
    }),

  // Save branding settings
  saveSettings: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional().nullable(),
      companyName: z.string().optional(),
      companyAddress: z.string().optional(),
      companyCity: z.string().optional(),
      companyState: z.string().optional(),
      companyPostalCode: z.string().optional(),
      companyCountry: z.string().optional(),
      companyEmail: z.string().email().optional(),
      companyPhone: z.string().optional(),
      companyWebsite: z.string().optional(),
      taxId: z.string().optional(),
      registrationNumber: z.string().optional(),
      logoUrl: z.string().optional(),
      logoWidth: z.number().optional(),
      logoHeight: z.number().optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      fontFamily: z.string().optional(),
      headerFontSize: z.number().optional(),
      bodyFontSize: z.number().optional(),
      bankName: z.string().optional(),
      bankAccountName: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      bankRoutingNumber: z.string().optional(),
      bankSwiftCode: z.string().optional(),
      bankIban: z.string().optional(),
      bankBranch: z.string().optional(),
      bankAddress: z.string().optional(),
      paymentInstructions: z.string().optional(),
      acceptedPaymentMethods: z.array(z.string()).optional(),
      footerText: z.string().optional(),
      termsAndConditions: z.string().optional(),
      latePaymentPolicy: z.string().optional(),
      invoicePrefix: z.string().optional(),
      invoiceNumberFormat: z.string().optional(),
      nextInvoiceNumber: z.number().optional(),
      showLogo: z.boolean().optional(),
      showBankDetails: z.boolean().optional(),
      showPaymentInstructions: z.boolean().optional(),
      showTerms: z.boolean().optional(),
      showTaxBreakdown: z.boolean().optional(),
      showLineItemTax: z.boolean().optional(),
      paperSize: z.enum(["A4", "Letter", "Legal"]).optional(),
      defaultCurrency: z.string().optional(),
      currencySymbol: z.string().optional(),
      currencyPosition: z.enum(["before", "after"]).optional(),
      dateFormat: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const orgId = input.organizationId;

      // Check if settings already exist
      const whereClause = orgId 
        ? eq(invoiceBrandingSettings.organizationId, orgId)
        : isNull(invoiceBrandingSettings.organizationId);

      const [existing] = await db
        .select()
        .from(invoiceBrandingSettings)
        .where(whereClause)
        .limit(1);

      const updateData = {
        ...input,
        updatedBy: ctx.user?.id,
      };

      if (existing) {
        // Update existing
        await db
          .update(invoiceBrandingSettings)
          .set(updateData)
          .where(eq(invoiceBrandingSettings.id, existing.id));

        return { success: true, id: existing.id, action: "updated" };
      } else {
        // Insert new
        const [result] = await db
          .insert(invoiceBrandingSettings)
          .values({
            ...updateData,
            createdBy: ctx.user?.id,
          });

        return { success: true, id: result.insertId, action: "created" };
      }
    }),

  // Upload logo (returns URL after upload)
  uploadLogo: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      fileType: z.string(),
      fileBase64: z.string(),
    }))
    .mutation(async ({ input }) => {
      // In a real implementation, this would upload to S3
      // For now, we'll return a placeholder URL
      const { storagePut } = await import("../storage");
      
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `invoice-branding/logos/${Date.now()}-${input.fileName}`;
      
      const { url } = await storagePut(key, buffer, input.fileType);
      
      return { url };
    }),

  // Preview invoice with current settings
  previewInvoice: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }))
    .query(async ({ input }) => {
      // Return sample invoice data for preview
      return {
        invoiceNumber: "INV-2026-0001",
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        customer: {
          name: "Sample Customer Ltd",
          address: "456 Customer Avenue",
          city: "Lagos",
          country: "Nigeria",
          email: "customer@example.com",
        },
        lineItems: [
          { description: "Solar Panel Installation", quantity: 10, unitPrice: 500, taxRate: 7.5 },
          { description: "Inverter Setup", quantity: 2, unitPrice: 1200, taxRate: 7.5 },
          { description: "Maintenance Contract (Annual)", quantity: 1, unitPrice: 2000, taxRate: 0 },
        ],
        subtotal: 9400,
        taxAmount: 555,
        total: 9955,
        amountPaid: 0,
        amountDue: 9955,
        status: "pending",
      };
    }),
});
