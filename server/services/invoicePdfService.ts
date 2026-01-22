/**
 * Invoice PDF Generation Service
 * 
 * Generates PDF invoices and stores them as Artifacts with VATR provenance.
 * Implements cache invalidation based on invoice updatedAt vs artifact createdAt.
 */

import { getDb } from "../db";
import { 
  invoices, 
  invoiceLineItems, 
  customers, 
  projects,
  artifacts,
  vatrRecords,
  clientAccounts
} from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { storagePut, storageGet } from "../storage";
import crypto from "crypto";

/**
 * Invoice data for PDF generation
 */
interface InvoicePdfData {
  invoice: {
    id: number;
    invoiceNumber: string;
    issueDate: Date | null;
    dueDate: Date | null;
    status: string;
    subtotal: string | null;
    taxAmount: string | null;
    totalAmount: string | null;
    notes: string | null;
    terms: string | null;
    currency: string | null;
  };
  customer: {
    name: string;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    taxId: string | null;
  } | null;
  clientAccount: {
    name: string;
    primaryEmail: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
    taxId: string | null;
  } | null;
  lineItems: {
    description: string | null;
    quantity: string | null;
    unitPrice: string | null;
    amount: string | null;
  }[];
  project: {
    name: string;
  } | null;
}

/**
 * Get invoice data for PDF generation
 */
export async function getInvoicePdfData(invoiceId: number): Promise<InvoicePdfData | null> {
  const db = await getDb();
  
  // Get invoice
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) return null;
  
  // Get customer (legacy)
  let customer = null;
  if (invoice.customerId) {
    const [cust] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, invoice.customerId))
      .limit(1);
    if (cust) {
      customer = {
        name: cust.name,
        email: cust.email,
        address: cust.address,
        city: cust.city,
        state: cust.state,
        country: cust.country,
        postalCode: cust.postalCode,
        taxId: cust.taxId,
      };
    }
  }
  
  // Get client account (canonical)
  let clientAccount = null;
  if ((invoice as any).clientAccountId) {
    const [ca] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, (invoice as any).clientAccountId))
      .limit(1);
    if (ca) {
      clientAccount = {
        name: ca.name,
        primaryEmail: ca.primaryEmail,
        address: ca.address,
        city: ca.city,
        state: ca.state,
        country: ca.country,
        postalCode: ca.postalCode,
        taxId: ca.taxId,
      };
    }
  }
  
  // Get line items
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId));
  
  // Get project if linked
  let project = null;
  if ((invoice as any).projectId) {
    const [proj] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, (invoice as any).projectId))
      .limit(1);
    if (proj) {
      project = { name: proj.name };
    }
  }
  
  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      notes: invoice.notes,
      terms: invoice.terms,
      currency: invoice.currency,
    },
    customer,
    clientAccount,
    lineItems: lineItems.map(li => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
    })),
    project,
  };
}

/**
 * Generate HTML content for invoice PDF
 */
function generateInvoiceHtml(data: InvoicePdfData): string {
  const { invoice, customer, clientAccount, lineItems, project } = data;
  const billTo = clientAccount || customer;
  
  const formatCurrency = (amount: string | null) => {
    if (!amount) return '$0.00';
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency || 'USD',
    }).format(num);
  };
  
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .invoice-title { text-align: right; }
    .invoice-title h1 { font-size: 32px; color: #1f2937; margin-bottom: 8px; }
    .invoice-number { font-size: 14px; color: #6b7280; }
    .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .bill-to, .invoice-info { width: 45%; }
    .section-title { font-size: 10px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
    .company-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .address { color: #4b5563; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-draft { background: #e5e7eb; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    th { background: #f9fafb; padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 16px 12px; border-bottom: 1px solid #e5e7eb; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .total-row.grand-total { border-top: 2px solid #1f2937; padding-top: 12px; margin-top: 8px; font-size: 16px; font-weight: 600; }
    .notes { margin-top: 40px; padding: 20px; background: #f9fafb; border-radius: 8px; }
    .notes-title { font-weight: 600; margin-bottom: 8px; }
    .notes-content { color: #4b5563; }
    .footer { margin-top: 60px; text-align: center; color: #9ca3af; font-size: 10px; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">KIISHA</div>
      <div class="invoice-title">
        <h1>INVOICE</h1>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
      </div>
    </div>
    
    <div class="details">
      <div class="bill-to">
        <div class="section-title">Bill To</div>
        <div class="company-name">${billTo?.name || 'N/A'}</div>
        <div class="address">
          ${billTo?.address || ''}<br>
          ${[billTo?.city, billTo?.state, billTo?.postalCode].filter(Boolean).join(', ')}<br>
          ${billTo?.country || ''}
        </div>
        ${billTo?.taxId ? `<div style="margin-top: 8px;">Tax ID: ${billTo.taxId}</div>` : ''}
      </div>
      <div class="invoice-info">
        <div class="section-title">Invoice Details</div>
        <div class="info-row">
          <span class="info-label">Issue Date:</span>
          <span class="info-value">${formatDate(invoice.issueDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Due Date:</span>
          <span class="info-value">${formatDate(invoice.dueDate)}</span>
        </div>
        ${project ? `
        <div class="info-row">
          <span class="info-label">Project:</span>
          <span class="info-value">${project.name}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="status status-${invoice.status}">${invoice.status}</span>
        </div>
      </div>
    </div>
    
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map(item => `
        <tr>
          <td>${item.description || ''}</td>
          <td class="text-right">${item.quantity || '1'}</td>
          <td class="text-right">${formatCurrency(item.unitPrice)}</td>
          <td class="text-right">${formatCurrency(item.amount)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="totals">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatCurrency(invoice.subtotal)}</span>
      </div>
      <div class="total-row">
        <span>Tax</span>
        <span>${formatCurrency(invoice.taxAmount)}</span>
      </div>
      <div class="total-row grand-total">
        <span>Total Due</span>
        <span>${formatCurrency(invoice.totalAmount)}</span>
      </div>
    </div>
    
    ${invoice.notes || invoice.terms ? `
    <div class="notes">
      ${invoice.notes ? `
      <div class="notes-title">Notes</div>
      <div class="notes-content">${invoice.notes}</div>
      ` : ''}
      ${invoice.terms ? `
      <div class="notes-title" style="margin-top: 16px;">Terms & Conditions</div>
      <div class="notes-content">${invoice.terms}</div>
      ` : ''}
    </div>
    ` : ''}
    
    <div class="footer">
      Generated by KIISHA • Invoice ${invoice.invoiceNumber}
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from HTML using puppeteer (if available) or return HTML
 */
async function generatePdfBuffer(html: string): Promise<Buffer> {
  // For now, return HTML as buffer - in production, use puppeteer or similar
  // This is a placeholder that returns the HTML content
  return Buffer.from(html, 'utf-8');
}

/**
 * Check if invoice PDF needs regeneration
 */
export async function needsPdfRegeneration(invoiceId: number): Promise<boolean> {
  const db = await getDb();
  
  // Get invoice with pdfArtifactId
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice) return false;
  
  // If no PDF artifact exists, need to generate
  if (!(invoice as any).pdfArtifactId) return true;
  
  // Get the artifact
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, (invoice as any).pdfArtifactId))
    .limit(1);
  
  if (!artifact) return true;
  
  // Compare timestamps - regenerate if invoice updated after artifact created
  const invoiceUpdated = invoice.updatedAt ? new Date(invoice.updatedAt) : new Date(0);
  const artifactCreated = artifact.createdAt ? new Date(artifact.createdAt) : new Date(0);
  
  return invoiceUpdated > artifactCreated;
}

/**
 * Generate and store invoice PDF as artifact
 */
export async function generateInvoicePdf(
  invoiceId: number, 
  organizationId: number,
  userId?: number
): Promise<{ artifactId: number; url: string } | null> {
  const db = await getDb();
  
  // Get invoice data
  const data = await getInvoicePdfData(invoiceId);
  if (!data) return null;
  
  // Generate HTML
  const html = generateInvoiceHtml(data);
  
  // Generate PDF buffer (currently HTML)
  const pdfBuffer = await generatePdfBuffer(html);
  
  // Generate file key with hash for uniqueness
  const hash = crypto.createHash('md5').update(pdfBuffer).digest('hex').substring(0, 8);
  const fileKey = `invoices/${data.invoice.invoiceNumber}-${hash}.html`;
  
  // Upload to S3
  const { url } = await storagePut(fileKey, pdfBuffer, 'text/html');
  
  // Create artifact record
  const [artifactResult] = await db.execute(`
    INSERT INTO artifacts (
      organizationId, artifactType, status, title, description,
      sourceUrl, sourceType, fileSize, mimeType, createdAt, updatedAt
    ) VALUES (
      ${organizationId}, 'INVOICE_PDF', 'processed', 
      'Invoice ${data.invoice.invoiceNumber}',
      'PDF invoice for ${data.customer?.name || data.clientAccount?.name || 'Customer'}',
      '${url}', 'generated', ${pdfBuffer.length}, 'text/html',
      NOW(), NOW()
    )
  `);
  
  // Get the inserted artifact ID
  const [insertedArtifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.sourceUrl, url))
    .orderBy(desc(artifacts.createdAt))
    .limit(1);
  
  if (!insertedArtifact) return null;
  
  // Update invoice with artifact ID
  await db.execute(`
    UPDATE invoices SET pdfArtifactId = ${insertedArtifact.id} WHERE id = ${invoiceId}
  `);
  
  // Create VATR record for provenance
  await db.execute(`
    INSERT INTO vatrRecords (
      organizationId, entityType, entityId, action, actorType, actorId,
      timestamp, metadata, createdAt
    ) VALUES (
      ${organizationId}, 'artifact', ${insertedArtifact.id}, 'created', 
      'system', ${userId || 0},
      NOW(), 
      '{"source": "invoice", "invoiceId": ${invoiceId}, "invoiceNumber": "${data.invoice.invoiceNumber}"}',
      NOW()
    )
  `);
  
  return {
    artifactId: insertedArtifact.id,
    url,
  };
}

/**
 * Get signed URL for invoice PDF with TTL
 */
export async function getInvoicePdfUrl(
  invoiceId: number, 
  organizationId: number,
  userId?: number,
  ttlSeconds: number = 3600
): Promise<string | null> {
  const db = await getDb();
  
  // Check if regeneration needed
  const needsRegen = await needsPdfRegeneration(invoiceId);
  
  if (needsRegen) {
    const result = await generateInvoicePdf(invoiceId, organizationId, userId);
    if (!result) return null;
    return result.url;
  }
  
  // Get existing artifact URL
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  if (!invoice || !(invoice as any).pdfArtifactId) return null;
  
  const [artifact] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, (invoice as any).pdfArtifactId))
    .limit(1);
  
  if (!artifact || !artifact.sourceUrl) return null;
  
  // For now, return the direct URL
  // In production, generate a signed URL with TTL
  return artifact.sourceUrl;
}
