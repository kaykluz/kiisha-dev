/**
 * Invoice PDF Generation Service
 * 
 * Generates professional PDF invoices with company branding,
 * customer details, line items, and payment information.
 */

import { getDb } from '../db';
import { invoices, invoiceLineItems, customers, organizations } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

// PDF generation using built-in capabilities
interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  status: string;
  
  // Company details
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyLogo?: string;
  companyTaxId?: string;
  
  // Customer details
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerPhone?: string;
  customerTaxId?: string;
  
  // Line items
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate?: number;
  }[];
  
  // Totals
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  
  // Payment details
  paymentTerms?: string;
  bankName?: string;
  bankAccount?: string;
  bankRouting?: string;
  notes?: string;
}

/**
 * Generate HTML content for invoice PDF
 */
function generateInvoiceHtml(data: InvoiceData): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Convert cents to dollars
  };
  
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const statusColors: Record<string, string> = {
    paid: '#22c55e',
    partial: '#f59e0b',
    pending: '#3b82f6',
    overdue: '#ef4444',
    draft: '#6b7280',
  };
  
  const statusColor = statusColors[data.status.toLowerCase()] || '#6b7280';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      background: #ffffff;
    }
    
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    
    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f97316;
    }
    
    .company-info {
      flex: 1;
    }
    
    .company-logo {
      max-width: 180px;
      max-height: 60px;
      margin-bottom: 10px;
    }
    
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin-bottom: 5px;
    }
    
    .company-details {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }
    
    .invoice-title-section {
      text-align: right;
    }
    
    .invoice-title {
      font-size: 32px;
      font-weight: 700;
      color: #f97316;
      margin-bottom: 10px;
    }
    
    .invoice-number {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    
    .invoice-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: white;
      background-color: ${statusColor};
    }
    
    /* Billing Section */
    .billing-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    
    .billing-box {
      flex: 1;
      max-width: 45%;
    }
    
    .billing-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    
    .billing-name {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 5px;
    }
    
    .billing-details {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }
    
    .invoice-dates {
      text-align: right;
    }
    
    .date-row {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 5px;
    }
    
    .date-label {
      font-size: 11px;
      color: #6b7280;
      margin-right: 10px;
    }
    
    .date-value {
      font-size: 11px;
      font-weight: 600;
      color: #1f2937;
      min-width: 100px;
      text-align: right;
    }
    
    /* Line Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    
    .items-table th {
      background-color: #1f2937;
      color: white;
      padding: 12px 15px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .items-table th:last-child {
      text-align: right;
    }
    
    .items-table td {
      padding: 15px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
    }
    
    .items-table td:last-child {
      text-align: right;
      font-weight: 500;
    }
    
    .items-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    .item-description {
      font-weight: 500;
      color: #1f2937;
    }
    
    .item-details {
      font-size: 10px;
      color: #6b7280;
      margin-top: 3px;
    }
    
    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }
    
    .totals-box {
      width: 300px;
    }
    
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .totals-row.total {
      border-bottom: none;
      border-top: 2px solid #1f2937;
      margin-top: 10px;
      padding-top: 15px;
    }
    
    .totals-label {
      font-size: 12px;
      color: #6b7280;
    }
    
    .totals-value {
      font-size: 12px;
      font-weight: 500;
      color: #1f2937;
    }
    
    .totals-row.total .totals-label,
    .totals-row.total .totals-value {
      font-size: 16px;
      font-weight: 700;
      color: #1f2937;
    }
    
    .totals-row.due .totals-label,
    .totals-row.due .totals-value {
      color: #f97316;
      font-weight: 700;
    }
    
    /* Payment Info */
    .payment-section {
      display: flex;
      gap: 40px;
      padding: 25px;
      background-color: #f9fafb;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    
    .payment-box {
      flex: 1;
    }
    
    .payment-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }
    
    .payment-details {
      font-size: 11px;
      color: #4b5563;
      line-height: 1.8;
    }
    
    .payment-details strong {
      color: #1f2937;
    }
    
    /* Notes */
    .notes-section {
      padding: 20px;
      background-color: #fffbeb;
      border-left: 4px solid #f97316;
      border-radius: 0 8px 8px 0;
      margin-bottom: 30px;
    }
    
    .notes-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #92400e;
      margin-bottom: 8px;
    }
    
    .notes-content {
      font-size: 11px;
      color: #78350f;
      line-height: 1.6;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      font-size: 10px;
      color: #9ca3af;
      margin-bottom: 5px;
    }
    
    .footer-brand {
      font-size: 11px;
      font-weight: 600;
      color: #f97316;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <div class="company-info">
        ${data.companyLogo ? `<img src="${data.companyLogo}" alt="Company Logo" class="company-logo">` : ''}
        <div class="company-name">${data.companyName}</div>
        <div class="company-details">
          ${data.companyAddress}<br>
          ${data.companyPhone}<br>
          ${data.companyEmail}
          ${data.companyTaxId ? `<br>Tax ID: ${data.companyTaxId}` : ''}
        </div>
      </div>
      <div class="invoice-title-section">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${data.invoiceNumber}</div>
        <span class="invoice-status">${data.status}</span>
      </div>
    </div>
    
    <!-- Billing Section -->
    <div class="billing-section">
      <div class="billing-box">
        <div class="billing-label">Bill To</div>
        <div class="billing-name">${data.customerName}</div>
        <div class="billing-details">
          ${data.customerAddress}<br>
          ${data.customerEmail}
          ${data.customerPhone ? `<br>${data.customerPhone}` : ''}
          ${data.customerTaxId ? `<br>Tax ID: ${data.customerTaxId}` : ''}
        </div>
      </div>
      <div class="billing-box invoice-dates">
        <div class="date-row">
          <span class="date-label">Invoice Date:</span>
          <span class="date-value">${formatDate(data.invoiceDate)}</span>
        </div>
        <div class="date-row">
          <span class="date-label">Due Date:</span>
          <span class="date-value">${formatDate(data.dueDate)}</span>
        </div>
        <div class="date-row">
          <span class="date-label">Payment Terms:</span>
          <span class="date-value">${data.paymentTerms || 'Net 30'}</span>
        </div>
      </div>
    </div>
    
    <!-- Line Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%">Description</th>
          <th style="width: 15%">Quantity</th>
          <th style="width: 15%">Unit Price</th>
          <th style="width: 20%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.lineItems.map(item => `
          <tr>
            <td>
              <div class="item-description">${item.description}</div>
              ${item.taxRate ? `<div class="item-details">Tax Rate: ${item.taxRate}%</div>` : ''}
            </td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-row">
          <span class="totals-label">Subtotal</span>
          <span class="totals-value">${formatCurrency(data.subtotal)}</span>
        </div>
        ${data.taxAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Tax</span>
            <span class="totals-value">${formatCurrency(data.taxAmount)}</span>
          </div>
        ` : ''}
        <div class="totals-row total">
          <span class="totals-label">Total</span>
          <span class="totals-value">${formatCurrency(data.total)}</span>
        </div>
        ${data.amountPaid > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Amount Paid</span>
            <span class="totals-value">-${formatCurrency(data.amountPaid)}</span>
          </div>
        ` : ''}
        <div class="totals-row due">
          <span class="totals-label">Amount Due</span>
          <span class="totals-value">${formatCurrency(data.amountDue)}</span>
        </div>
      </div>
    </div>
    
    <!-- Payment Information -->
    ${(data.bankName || data.bankAccount) ? `
      <div class="payment-section">
        <div class="payment-box">
          <div class="payment-title">Payment Information</div>
          <div class="payment-details">
            ${data.bankName ? `<strong>Bank:</strong> ${data.bankName}<br>` : ''}
            ${data.bankAccount ? `<strong>Account:</strong> ${data.bankAccount}<br>` : ''}
            ${data.bankRouting ? `<strong>Routing:</strong> ${data.bankRouting}<br>` : ''}
          </div>
        </div>
        <div class="payment-box">
          <div class="payment-title">Payment Methods</div>
          <div class="payment-details">
            • Bank Transfer (ACH/Wire)<br>
            • Credit Card (via customer portal)<br>
            • Check payable to ${data.companyName}
          </div>
        </div>
      </div>
    ` : ''}
    
    <!-- Notes -->
    ${data.notes ? `
      <div class="notes-section">
        <div class="notes-title">Notes</div>
        <div class="notes-content">${data.notes}</div>
      </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-text">Thank you for your business!</div>
      <div class="footer-text">Questions? Contact us at ${data.companyEmail}</div>
      <div class="footer-brand">Powered by KIISHA</div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Fetch invoice data from database
 */
export async function getInvoiceData(invoiceId: number, customerId: number): Promise<InvoiceData | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get invoice with customer and organization
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) {
    return null;
  }
  
  // Verify customer access
  if (invoice.customerId !== customerId) {
    return null;
  }
  
  // Get customer details
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  
  if (!customer) {
    return null;
  }
  
  // Get line items
  const lineItemsData = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));
  
  // Get organization (company) details
  let companyName = 'KIISHA Solar';
  let companyAddress = '123 Solar Way, San Francisco, CA 94102';
  let companyPhone = '+1 (555) 123-4567';
  let companyEmail = 'billing@kiisha.com';
  let companyLogo = '';
  let companyTaxId = '';
  let bankName = 'First National Bank';
  let bankAccount = '****4567';
  let bankRouting = '****1234';
  
  if (invoice.organizationId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invoice.organizationId))
      .limit(1);
    
    if (org) {
      companyName = org.name;
      companyAddress = org.address || companyAddress;
      companyPhone = org.phone || companyPhone;
      companyEmail = org.email || companyEmail;
      companyLogo = org.logo || '';
      companyTaxId = org.taxId || '';
    }
  }
  
  // Calculate totals
  const subtotal = lineItemsData.reduce((sum, item) => sum + (item.amount || 0), 0);
  const taxAmount = lineItemsData.reduce((sum, item) => {
    const itemTax = item.taxRate ? (item.amount || 0) * (item.taxRate / 100) : 0;
    return sum + itemTax;
  }, 0);
  const total = invoice.totalAmount || subtotal + taxAmount;
  const amountPaid = invoice.paidAmount || 0;
  const amountDue = total - amountPaid;
  
  return {
    invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.toString().padStart(6, '0')}`,
    invoiceDate: invoice.invoiceDate || new Date(),
    dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: invoice.status || 'pending',
    
    companyName,
    companyAddress,
    companyPhone,
    companyEmail,
    companyLogo,
    companyTaxId,
    
    customerName: customer.name || customer.companyName || 'Customer',
    customerEmail: customer.email || '',
    customerAddress: customer.address || '',
    customerPhone: customer.phone || undefined,
    customerTaxId: customer.taxId || undefined,
    
    lineItems: lineItemsData.map(item => ({
      description: item.description || 'Service',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      amount: item.amount || 0,
      taxRate: item.taxRate || undefined,
    })),
    
    subtotal,
    taxAmount,
    total,
    amountPaid,
    amountDue,
    
    paymentTerms: invoice.paymentTerms || 'Net 30',
    bankName,
    bankAccount,
    bankRouting,
    notes: invoice.notes || undefined,
  };
}

/**
 * Generate invoice PDF as base64 string
 */
export async function generateInvoicePdf(invoiceId: number, customerId: number): Promise<{ html: string; filename: string } | null> {
  const data = await getInvoiceData(invoiceId, customerId);
  
  if (!data) {
    return null;
  }
  
  const html = generateInvoiceHtml(data);
  const filename = `Invoice_${data.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  
  return { html, filename };
}

/**
 * Generate invoice HTML for preview
 */
export async function generateInvoicePreview(invoiceId: number, customerId: number): Promise<string | null> {
  const data = await getInvoiceData(invoiceId, customerId);
  
  if (!data) {
    return null;
  }
  
  return generateInvoiceHtml(data);
}
