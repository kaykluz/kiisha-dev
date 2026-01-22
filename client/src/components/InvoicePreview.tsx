import { useMemo } from "react";
import { format } from "date-fns";

export interface InvoicePreviewData {
  // Company Info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyState?: string;
  companyPostalCode?: string;
  companyCountry: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite?: string;
  taxId?: string;
  registrationNumber?: string;
  
  // Logo & Branding
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  
  // Bank Details
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwiftCode?: string;
  bankIban?: string;
  bankBranch?: string;
  bankAddress?: string;
  
  // Payment & Terms
  paymentInstructions?: string;
  acceptedPaymentMethods?: string[];
  footerText?: string;
  termsAndConditions?: string;
  latePaymentPolicy?: string;
  
  // Display Options
  showLogo: boolean;
  showBankDetails: boolean;
  showPaymentInstructions: boolean;
  showTerms: boolean;
  showTaxBreakdown: boolean;
  showLineItemTax: boolean;
  
  // Formatting
  currencySymbol: string;
  currencyPosition: "before" | "after";
  dateFormat: string;
  invoicePrefix: string;
}

interface InvoicePreviewProps {
  data: InvoicePreviewData;
  scale?: number;
}

// Sample invoice data for preview
const sampleInvoice = {
  invoiceNumber: "INV-2026-0001",
  issueDate: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  customer: {
    name: "Acme Solar Solutions Ltd",
    address: "456 Energy Boulevard, Suite 200",
    city: "Lagos",
    country: "Nigeria",
    email: "accounts@acmesolar.ng",
  },
  lineItems: [
    { description: "Solar Panel Installation (10kW System)", quantity: 1, unitPrice: 5000, taxRate: 7.5 },
    { description: "Inverter Setup & Configuration", quantity: 2, unitPrice: 1200, taxRate: 7.5 },
    { description: "Annual Maintenance Contract", quantity: 1, unitPrice: 2000, taxRate: 0 },
    { description: "Site Assessment & Engineering", quantity: 1, unitPrice: 800, taxRate: 7.5 },
  ],
};

export default function InvoicePreview({ data, scale = 1 }: InvoicePreviewProps) {
  const formatCurrency = (amount: number) => {
    const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return data.currencyPosition === "before" 
      ? `${data.currencySymbol}${formatted}`
      : `${formatted}${data.currencySymbol}`;
  };

  const formatDate = (date: Date) => {
    try {
      // Simple date formatting based on format string
      const formatMap: Record<string, string> = {
        "MMM DD, YYYY": "MMM dd, yyyy",
        "DD/MM/YYYY": "dd/MM/yyyy",
        "MM/DD/YYYY": "MM/dd/yyyy",
        "YYYY-MM-DD": "yyyy-MM-dd",
      };
      return format(date, formatMap[data.dateFormat] || "MMM dd, yyyy");
    } catch {
      return date.toLocaleDateString();
    }
  };

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = sampleInvoice.lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    const taxAmount = sampleInvoice.lineItems.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice;
      return sum + (lineTotal * (item.taxRate / 100));
    }, 0);

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  }, []);

  // Build company address string
  const companyFullAddress = [
    data.companyAddress,
    [data.companyCity, data.companyState, data.companyPostalCode].filter(Boolean).join(", "),
    data.companyCountry,
  ].filter(Boolean).join("\n");

  return (
    <div 
      className="bg-white text-black shadow-lg overflow-hidden"
      style={{ 
        fontFamily: data.fontFamily,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: "210mm", // A4 width
        minHeight: "297mm", // A4 height
      }}
    >
      {/* Invoice Container */}
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          {/* Company Info & Logo */}
          <div className="flex items-start gap-4">
            {data.showLogo && data.logoUrl && (
              <img 
                src={data.logoUrl} 
                alt="Company Logo"
                style={{ 
                  maxWidth: data.logoWidth || 200,
                  maxHeight: data.logoHeight || 60,
                  objectFit: "contain",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div>
              <h1 
                className="text-2xl font-bold mb-1"
                style={{ color: data.primaryColor }}
              >
                {data.companyName || "Your Company Name"}
              </h1>
              <div className="text-sm whitespace-pre-line" style={{ color: data.secondaryColor }}>
                {companyFullAddress}
              </div>
              {data.companyEmail && (
                <div className="text-sm mt-1" style={{ color: data.secondaryColor }}>
                  {data.companyEmail}
                </div>
              )}
              {data.companyPhone && (
                <div className="text-sm" style={{ color: data.secondaryColor }}>
                  {data.companyPhone}
                </div>
              )}
            </div>
          </div>

          {/* Invoice Title & Number */}
          <div className="text-right">
            <h2 
              className="text-3xl font-bold mb-2"
              style={{ color: data.primaryColor }}
            >
              INVOICE
            </h2>
            <div className="text-sm" style={{ color: data.secondaryColor }}>
              <div className="font-semibold">{sampleInvoice.invoiceNumber}</div>
              <div className="mt-2">
                <span className="text-gray-500">Issue Date:</span>{" "}
                {formatDate(sampleInvoice.issueDate)}
              </div>
              <div>
                <span className="text-gray-500">Due Date:</span>{" "}
                {formatDate(sampleInvoice.dueDate)}
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Section */}
        <div 
          className="mb-8 p-4 rounded-lg"
          style={{ backgroundColor: `${data.primaryColor}10` }}
        >
          <h3 
            className="text-sm font-semibold mb-2 uppercase tracking-wide"
            style={{ color: data.primaryColor }}
          >
            Bill To
          </h3>
          <div style={{ color: data.secondaryColor }}>
            <div className="font-semibold">{sampleInvoice.customer.name}</div>
            <div className="text-sm">{sampleInvoice.customer.address}</div>
            <div className="text-sm">{sampleInvoice.customer.city}, {sampleInvoice.customer.country}</div>
            <div className="text-sm">{sampleInvoice.customer.email}</div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full">
            <thead>
              <tr 
                className="text-left text-sm uppercase tracking-wide"
                style={{ 
                  backgroundColor: data.primaryColor,
                  color: "white",
                }}
              >
                <th className="py-3 px-4 rounded-tl-lg">Description</th>
                <th className="py-3 px-4 text-center">Qty</th>
                <th className="py-3 px-4 text-right">Unit Price</th>
                {data.showLineItemTax && (
                  <th className="py-3 px-4 text-right">Tax</th>
                )}
                <th className="py-3 px-4 text-right rounded-tr-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleInvoice.lineItems.map((item, index) => {
                const lineTotal = item.quantity * item.unitPrice;
                const lineTax = lineTotal * (item.taxRate / 100);
                return (
                  <tr 
                    key={index}
                    className="border-b"
                    style={{ 
                      borderColor: `${data.secondaryColor}20`,
                      backgroundColor: index % 2 === 0 ? "white" : `${data.secondaryColor}05`,
                    }}
                  >
                    <td className="py-3 px-4" style={{ color: data.secondaryColor }}>
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-center" style={{ color: data.secondaryColor }}>
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right" style={{ color: data.secondaryColor }}>
                      {formatCurrency(item.unitPrice)}
                    </td>
                    {data.showLineItemTax && (
                      <td className="py-3 px-4 text-right text-sm" style={{ color: data.secondaryColor }}>
                        {item.taxRate > 0 ? `${item.taxRate}%` : "-"}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-medium" style={{ color: data.secondaryColor }}>
                      {formatCurrency(lineTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end mb-8">
          <div className="w-72">
            <div 
              className="flex justify-between py-2 border-b"
              style={{ borderColor: `${data.secondaryColor}20` }}
            >
              <span style={{ color: data.secondaryColor }}>Subtotal</span>
              <span style={{ color: data.secondaryColor }}>{formatCurrency(calculations.subtotal)}</span>
            </div>
            {data.showTaxBreakdown && calculations.taxAmount > 0 && (
              <div 
                className="flex justify-between py-2 border-b"
                style={{ borderColor: `${data.secondaryColor}20` }}
              >
                <span style={{ color: data.secondaryColor }}>Tax</span>
                <span style={{ color: data.secondaryColor }}>{formatCurrency(calculations.taxAmount)}</span>
              </div>
            )}
            <div 
              className="flex justify-between py-3 text-lg font-bold"
              style={{ 
                backgroundColor: `${data.primaryColor}10`,
                borderRadius: "0.375rem",
                marginTop: "0.5rem",
                padding: "0.75rem",
              }}
            >
              <span style={{ color: data.primaryColor }}>Total Due</span>
              <span style={{ color: data.primaryColor }}>{formatCurrency(calculations.total)}</span>
            </div>
          </div>
        </div>

        {/* Bank Details Section */}
        {data.showBankDetails && data.bankName && (
          <div 
            className="mb-6 p-4 rounded-lg"
            style={{ 
              backgroundColor: `${data.accentColor}10`,
              borderLeft: `4px solid ${data.accentColor}`,
            }}
          >
            <h3 
              className="text-sm font-semibold mb-3 uppercase tracking-wide"
              style={{ color: data.accentColor }}
            >
              Bank Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm" style={{ color: data.secondaryColor }}>
              <div>
                <span className="text-gray-500">Bank Name:</span>{" "}
                <span className="font-medium">{data.bankName}</span>
              </div>
              {data.bankAccountName && (
                <div>
                  <span className="text-gray-500">Account Name:</span>{" "}
                  <span className="font-medium">{data.bankAccountName}</span>
                </div>
              )}
              {data.bankAccountNumber && (
                <div>
                  <span className="text-gray-500">Account Number:</span>{" "}
                  <span className="font-medium">{data.bankAccountNumber}</span>
                </div>
              )}
              {data.bankRoutingNumber && (
                <div>
                  <span className="text-gray-500">Routing/Sort Code:</span>{" "}
                  <span className="font-medium">{data.bankRoutingNumber}</span>
                </div>
              )}
              {data.bankSwiftCode && (
                <div>
                  <span className="text-gray-500">SWIFT/BIC:</span>{" "}
                  <span className="font-medium">{data.bankSwiftCode}</span>
                </div>
              )}
              {data.bankIban && (
                <div className="col-span-2">
                  <span className="text-gray-500">IBAN:</span>{" "}
                  <span className="font-medium">{data.bankIban}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        {data.showPaymentInstructions && data.paymentInstructions && (
          <div className="mb-6">
            <h3 
              className="text-sm font-semibold mb-2 uppercase tracking-wide"
              style={{ color: data.primaryColor }}
            >
              Payment Instructions
            </h3>
            <p className="text-sm" style={{ color: data.secondaryColor }}>
              {data.paymentInstructions}
            </p>
            {data.acceptedPaymentMethods && data.acceptedPaymentMethods.length > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {data.acceptedPaymentMethods.map((method) => (
                  <span 
                    key={method}
                    className="text-xs px-2 py-1 rounded"
                    style={{ 
                      backgroundColor: `${data.accentColor}20`,
                      color: data.accentColor,
                    }}
                  >
                    {method.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Late Payment Policy */}
        {data.latePaymentPolicy && (
          <div className="mb-6 text-sm" style={{ color: "#dc2626" }}>
            <strong>Late Payment Policy:</strong> {data.latePaymentPolicy}
          </div>
        )}

        {/* Terms & Conditions */}
        {data.showTerms && data.termsAndConditions && (
          <div 
            className="mb-6 p-4 rounded-lg text-sm"
            style={{ 
              backgroundColor: `${data.secondaryColor}05`,
              color: data.secondaryColor,
            }}
          >
            <h3 className="font-semibold mb-2">Terms & Conditions</h3>
            <p className="whitespace-pre-line">{data.termsAndConditions}</p>
          </div>
        )}

        {/* Footer */}
        <div 
          className="pt-6 mt-6 border-t text-center"
          style={{ borderColor: `${data.secondaryColor}20` }}
        >
          {data.footerText && (
            <p 
              className="text-sm mb-2"
              style={{ color: data.primaryColor }}
            >
              {data.footerText}
            </p>
          )}
          <div className="text-xs" style={{ color: data.secondaryColor }}>
            {data.taxId && <span>Tax ID: {data.taxId}</span>}
            {data.taxId && data.registrationNumber && <span className="mx-2">|</span>}
            {data.registrationNumber && <span>Reg. No: {data.registrationNumber}</span>}
          </div>
          {data.companyWebsite && (
            <div className="text-xs mt-1" style={{ color: data.accentColor }}>
              {data.companyWebsite}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
