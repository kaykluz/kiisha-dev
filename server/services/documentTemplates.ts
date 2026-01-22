/**
 * Document Preview Templates Service
 */

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'invoice' | 'proposal' | 'report' | 'contract';
  content: string;
  variables: string[];
}

export interface RenderedDocument {
  html: string;
  variables: Record<string, any>;
}

const INVOICE_TEMPLATE = `<!DOCTYPE html><html><head><style>body{font-family:Arial;margin:40px}.header{display:flex;justify-content:space-between}.invoice-title{font-size:32px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:12px;border-bottom:1px solid #ddd}th{background:#333;color:white}.total{font-size:24px;text-align:right}</style></head><body><div class="header"><div>{{companyName}}</div><div class="invoice-title">INVOICE #{{invoiceNumber}}</div></div><p>To: {{customerName}}<br>{{customerAddress}}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>{{lineItems}}</tbody></table><div class="total">Total: {{currency}}{{total}}</div><p>Due: {{dueDate}}</p></body></html>`;

const PROPOSAL_TEMPLATE = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;margin:40px}.cover{text-align:center;padding:80px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;margin:-40px -40px 40px}h1{font-size:42px}.section{margin:30px 0}h2{color:#667eea;border-bottom:2px solid #667eea}table{width:100%;border-collapse:collapse}th,td{padding:15px;border:1px solid #ddd}th{background:#667eea;color:white}</style></head><body><div class="cover"><h1>{{proposalTitle}}</h1><p>For: {{customerName}}</p><p>{{date}}</p></div><div class="section"><h2>Summary</h2><p>{{executiveSummary}}</p></div><div class="section"><h2>Scope</h2><p>{{scopeOfWork}}</p></div><div class="section"><h2>Pricing</h2><table><thead><tr><th>Item</th><th>Description</th><th>Price</th></tr></thead><tbody>{{pricingItems}}</tbody></table></div><p><strong>Total: {{currency}}{{totalPrice}}</strong></p></body></html>`;

const REPORT_TEMPLATE = `<!DOCTYPE html><html><head><style>body{font-family:Georgia;margin:40px;line-height:1.6}.header{border-bottom:3px solid #333;padding-bottom:20px}h1{font-size:28px}.meta{color:#666;font-size:14px}.section{margin:30px 0}h2{font-size:20px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ddd}th{background:#f5f5f5}</style></head><body><div class="header"><h1>{{reportTitle}}</h1><div class="meta"><p>Period: {{reportPeriod}} | Generated: {{generatedDate}}</p></div></div><div class="section"><h2>Summary</h2><p>{{summary}}</p></div><div class="section"><h2>Metrics</h2>{{metricsTable}}</div><div class="section"><h2>Analysis</h2><p>{{analysis}}</p></div><div class="section"><h2>Recommendations</h2><p>{{recommendations}}</p></div></body></html>`;

export class DocumentTemplateService {
  private templates: Map<string, DocumentTemplate> = new Map();

  constructor() {
    this.templates.set('invoice-standard', { id: 'invoice-standard', name: 'Standard Invoice', type: 'invoice', content: INVOICE_TEMPLATE, variables: ['companyName', 'customerName', 'customerAddress', 'invoiceNumber', 'lineItems', 'total', 'currency', 'dueDate'] });
    this.templates.set('proposal-standard', { id: 'proposal-standard', name: 'Standard Proposal', type: 'proposal', content: PROPOSAL_TEMPLATE, variables: ['proposalTitle', 'customerName', 'date', 'executiveSummary', 'scopeOfWork', 'pricingItems', 'totalPrice', 'currency'] });
    this.templates.set('report-standard', { id: 'report-standard', name: 'Standard Report', type: 'report', content: REPORT_TEMPLATE, variables: ['reportTitle', 'reportPeriod', 'generatedDate', 'summary', 'metricsTable', 'analysis', 'recommendations'] });
  }

  getTemplate(id: string): DocumentTemplate | undefined { return this.templates.get(id); }
  listTemplates(type?: string): DocumentTemplate[] { const all = Array.from(this.templates.values()); return type ? all.filter(t => t.type === type) : all; }

  render(templateId: string, variables: Record<string, any>): RenderedDocument {
    const template = this.templates.get(templateId);
    if (!template) throw new Error(`Template ${templateId} not found`);
    let html = template.content;
    for (const [key, value] of Object.entries(variables)) html = html.replace(new RegExp(`{{${key}}}`, 'g'), String(value ?? ''));
    html = html.replace(/{{[^}]+}}/g, '');
    return { html, variables };
  }

  renderLineItems(items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>): string {
    return items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unitPrice.toFixed(2)}</td><td>${i.amount.toFixed(2)}</td></tr>`).join('');
  }

  renderPricingItems(items: Array<{ item: string; description: string; price: number }>): string {
    return items.map(i => `<tr><td>${i.item}</td><td>${i.description}</td><td>${i.price.toFixed(2)}</td></tr>`).join('');
  }

  renderMetricsTable(metrics: Array<{ metric: string; value: string; change?: string }>): string {
    return `<table><thead><tr><th>Metric</th><th>Value</th><th>Change</th></tr></thead><tbody>${metrics.map(m => `<tr><td>${m.metric}</td><td>${m.value}</td><td>${m.change || '-'}</td></tr>`).join('')}</tbody></table>`;
  }
}

export const documentTemplateService = new DocumentTemplateService();
export default documentTemplateService;
