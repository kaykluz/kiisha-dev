import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { invoices, invoiceLineItems, customers, payments, invoiceBrandingSettings } from "../../drizzle/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

/**
 * Get branding settings for an organization (or global default)
 */
async function getBrandingSettings(organizationId?: number | null) {
  const db = await getDb();
  if (!db) return null;

  // Try to get org-specific settings first
  if (organizationId) {
    const [orgSettings] = await db
      .select()
      .from(invoiceBrandingSettings)
      .where(and(
        eq(invoiceBrandingSettings.organizationId, organizationId),
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

  return globalSettings;
}

/**
 * Default branding settings when none are configured
 */
const defaultBranding = {
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
};

/**
 * Invoice PDF Router
 * Handles PDF generation for invoices with branding settings
 */
export const invoicePdfRouter = router({
  // Get invoice data for PDF generation (with branding)
  getInvoiceForPdf: protectedProcedure
    .input(z.object({ 
      invoiceId: z.number(),
      organizationId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get invoice
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      // Get customer
      const [customer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, invoice.customerId))
        .limit(1);

      // Get line items
      const lineItems = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, input.invoiceId))
        .orderBy(invoiceLineItems.sortOrder);

      // Get payments
      const invoicePayments = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, input.invoiceId))
        .orderBy(desc(payments.paymentDate));

      // Get branding settings
      const branding = await getBrandingSettings(input.organizationId) || defaultBranding;

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => {
        return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice));
      }, 0);

      const taxAmount = lineItems.reduce((sum, item) => {
        const lineTotal = parseFloat(item.quantity) * parseFloat(item.unitPrice);
        return sum + (lineTotal * (parseFloat(item.taxRate || "0") / 100));
      }, 0);

      const totalPaid = invoicePayments
        .filter(p => p.status === "completed")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      return {
        invoice: {
          ...invoice,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount,
          amountPaid: totalPaid,
          amountDue: subtotal + taxAmount - totalPaid,
        },
        customer,
        lineItems: lineItems.map(item => ({
          ...item,
          lineTotal: parseFloat(item.quantity) * parseFloat(item.unitPrice),
        })),
        payments: invoicePayments,
        // Company info from branding settings
        company: {
          name: branding.companyName || defaultBranding.companyName,
          address: branding.companyAddress || defaultBranding.companyAddress,
          city: branding.companyCity || defaultBranding.companyCity,
          state: branding.companyState,
          postalCode: branding.companyPostalCode,
          country: branding.companyCountry || defaultBranding.companyCountry,
          email: branding.companyEmail || defaultBranding.companyEmail,
          phone: branding.companyPhone || defaultBranding.companyPhone,
          website: branding.companyWebsite,
          taxId: branding.taxId || defaultBranding.taxId,
          registrationNumber: branding.registrationNumber,
          logo: branding.logoUrl || defaultBranding.logoUrl,
          logoWidth: branding.logoWidth || defaultBranding.logoWidth,
          logoHeight: branding.logoHeight || defaultBranding.logoHeight,
        },
        // Branding/styling settings
        branding: {
          primaryColor: branding.primaryColor || defaultBranding.primaryColor,
          secondaryColor: branding.secondaryColor || defaultBranding.secondaryColor,
          accentColor: branding.accentColor || defaultBranding.accentColor,
          fontFamily: branding.fontFamily || defaultBranding.fontFamily,
          headerFontSize: branding.headerFontSize || defaultBranding.headerFontSize,
          bodyFontSize: branding.bodyFontSize || defaultBranding.bodyFontSize,
        },
        // Bank details
        bankDetails: {
          bankName: branding.bankName,
          accountName: branding.bankAccountName,
          accountNumber: branding.bankAccountNumber,
          routingNumber: branding.bankRoutingNumber,
          swiftCode: branding.bankSwiftCode,
          iban: branding.bankIban,
          branch: branding.bankBranch,
          address: branding.bankAddress,
        },
        // Payment & terms
        paymentInfo: {
          instructions: branding.paymentInstructions || defaultBranding.paymentInstructions,
          acceptedMethods: branding.acceptedPaymentMethods || defaultBranding.acceptedPaymentMethods,
          latePaymentPolicy: branding.latePaymentPolicy || defaultBranding.latePaymentPolicy,
        },
        // Footer & terms
        footer: {
          text: branding.footerText || defaultBranding.footerText,
          termsAndConditions: branding.termsAndConditions,
        },
        // Display options
        displayOptions: {
          showLogo: branding.showLogo ?? defaultBranding.showLogo,
          showBankDetails: branding.showBankDetails ?? defaultBranding.showBankDetails,
          showPaymentInstructions: branding.showPaymentInstructions ?? defaultBranding.showPaymentInstructions,
          showTerms: branding.showTerms ?? defaultBranding.showTerms,
          showTaxBreakdown: branding.showTaxBreakdown ?? defaultBranding.showTaxBreakdown,
          showLineItemTax: branding.showLineItemTax ?? defaultBranding.showLineItemTax,
          paperSize: branding.paperSize || defaultBranding.paperSize,
        },
        // Formatting options
        formatting: {
          currency: branding.defaultCurrency || defaultBranding.defaultCurrency,
          currencySymbol: branding.currencySymbol || defaultBranding.currencySymbol,
          currencyPosition: branding.currencyPosition || defaultBranding.currencyPosition,
          dateFormat: branding.dateFormat || defaultBranding.dateFormat,
        },
      };
    }),

  // Generate PDF download URL
  generatePdfUrl: protectedProcedure
    .input(z.object({ invoiceId: z.number() }))
    .mutation(async ({ input }) => {
      // In a real implementation, this would generate a PDF and return a signed URL
      // For now, we return a URL that the frontend can use to trigger PDF generation
      return {
        url: `/api/invoices/${input.invoiceId}/pdf`,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
      };
    }),

  // Get branding settings only (for preview)
  getBrandingForPreview: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }))
    .query(async ({ input }) => {
      const branding = await getBrandingSettings(input.organizationId) || defaultBranding;
      
      return {
        company: {
          name: branding.companyName || defaultBranding.companyName,
          address: branding.companyAddress || defaultBranding.companyAddress,
          city: branding.companyCity || defaultBranding.companyCity,
          state: branding.companyState,
          postalCode: branding.companyPostalCode,
          country: branding.companyCountry || defaultBranding.companyCountry,
          email: branding.companyEmail || defaultBranding.companyEmail,
          phone: branding.companyPhone || defaultBranding.companyPhone,
          website: branding.companyWebsite,
          taxId: branding.taxId || defaultBranding.taxId,
          registrationNumber: branding.registrationNumber,
          logo: branding.logoUrl || defaultBranding.logoUrl,
          logoWidth: branding.logoWidth || defaultBranding.logoWidth,
          logoHeight: branding.logoHeight || defaultBranding.logoHeight,
        },
        branding: {
          primaryColor: branding.primaryColor || defaultBranding.primaryColor,
          secondaryColor: branding.secondaryColor || defaultBranding.secondaryColor,
          accentColor: branding.accentColor || defaultBranding.accentColor,
          fontFamily: branding.fontFamily || defaultBranding.fontFamily,
          headerFontSize: branding.headerFontSize || defaultBranding.headerFontSize,
          bodyFontSize: branding.bodyFontSize || defaultBranding.bodyFontSize,
        },
        bankDetails: {
          bankName: branding.bankName,
          accountName: branding.bankAccountName,
          accountNumber: branding.bankAccountNumber,
          routingNumber: branding.bankRoutingNumber,
          swiftCode: branding.bankSwiftCode,
          iban: branding.bankIban,
          branch: branding.bankBranch,
          address: branding.bankAddress,
        },
        paymentInfo: {
          instructions: branding.paymentInstructions || defaultBranding.paymentInstructions,
          acceptedMethods: branding.acceptedPaymentMethods || defaultBranding.acceptedPaymentMethods,
          latePaymentPolicy: branding.latePaymentPolicy || defaultBranding.latePaymentPolicy,
        },
        footer: {
          text: branding.footerText || defaultBranding.footerText,
          termsAndConditions: branding.termsAndConditions,
        },
        displayOptions: {
          showLogo: branding.showLogo ?? defaultBranding.showLogo,
          showBankDetails: branding.showBankDetails ?? defaultBranding.showBankDetails,
          showPaymentInstructions: branding.showPaymentInstructions ?? defaultBranding.showPaymentInstructions,
          showTerms: branding.showTerms ?? defaultBranding.showTerms,
          showTaxBreakdown: branding.showTaxBreakdown ?? defaultBranding.showTaxBreakdown,
          showLineItemTax: branding.showLineItemTax ?? defaultBranding.showLineItemTax,
          paperSize: branding.paperSize || defaultBranding.paperSize,
        },
        formatting: {
          currency: branding.defaultCurrency || defaultBranding.defaultCurrency,
          currencySymbol: branding.currencySymbol || defaultBranding.currencySymbol,
          currencyPosition: branding.currencyPosition || defaultBranding.currencyPosition,
          dateFormat: branding.dateFormat || defaultBranding.dateFormat,
        },
      };
    }),
});
