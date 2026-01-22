import { Button } from "@/components/ui/button";
import { Download, Eye, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface InvoicePdfProps {
  invoiceId: number;
  invoiceNumber: string;
  variant?: "button" | "icon";
  customerId?: number;
}

export function InvoicePdfDownload({ invoiceId, invoiceNumber, variant = "button", customerId }: InvoicePdfProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<number | null>(customerId || null);
  
  // Get customer ID from token if not provided
  useEffect(() => {
    if (!customerId) {
      const token = localStorage.getItem('customer_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.customerId) {
            setResolvedCustomerId(payload.customerId);
          }
        } catch {
          console.error('Failed to parse customer token');
        }
      }
    }
  }, [customerId]);

  const handleDownload = async () => {
    if (!resolvedCustomerId) {
      toast.error("Customer ID not available");
      return;
    }
    
    setIsGenerating(true);
    try {
      // Fetch HTML from tRPC endpoint
      const response = await fetch(`/api/trpc/customerPortal.downloadInvoicePdf?input=${encodeURIComponent(JSON.stringify({ invoiceId, customerId: resolvedCustomerId }))}`);
      
      if (!response.ok) {
        throw new Error("Failed to generate invoice");
      }
      
      const data = await response.json();
      const { html, filename } = data.result.data;
      
      // Convert HTML to PDF using browser print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
        
        toast.success("Invoice opened for printing/saving as PDF");
      } else {
        // Fallback: download as HTML
        const blob = new Blob([html], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.replace('.pdf', '.html');
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.info("Invoice downloaded as HTML. Open in browser and print to PDF.");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to download invoice. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isGenerating || !resolvedCustomerId}
        title="Download PDF"
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isGenerating || !resolvedCustomerId}
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </>
      )}
    </Button>
  );
}

// Invoice Preview Dialog Component
export function InvoicePreviewDialog({ invoiceId, invoiceNumber, customerId }: InvoicePdfProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedCustomerId, setResolvedCustomerId] = useState<number | null>(customerId || null);
  
  // Get customer ID from token if not provided
  useEffect(() => {
    if (!customerId) {
      const token = localStorage.getItem('customer_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.customerId) {
            setResolvedCustomerId(payload.customerId);
          }
        } catch {
          console.error('Failed to parse customer token');
        }
      }
    }
  }, [customerId]);
  
  const { data, isLoading, error } = trpc.customerPortal.previewInvoice.useQuery(
    { invoiceId, customerId: resolvedCustomerId! },
    { enabled: isOpen && !!resolvedCustomerId }
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Preview Invoice">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Invoice {invoiceNumber}</DialogTitle>
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <div className="text-center py-12 text-red-400">
            Failed to load invoice preview
          </div>
        )}
        {data?.html && (
          <div 
            className="bg-white rounded-lg overflow-hidden"
            dangerouslySetInnerHTML={{ __html: data.html }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Invoice preview component for displaying invoice details (legacy)
interface InvoiceData {
  invoice: {
    id: number;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    currency: string;
    notes?: string;
  };
  customer: {
    name: string;
    companyName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate?: string;
    lineTotal: number;
  }>;
  company: {
    name: string;
    address: string;
    city: string;
    country: string;
    email: string;
    phone: string;
    taxId: string;
    logo: string;
  };
}

export function InvoicePreview({ data }: { data: InvoiceData }) {
  const { invoice, customer, lineItems, company } = data;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: invoice.currency || "USD",
    }).format(amount);
  };

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto" id="invoice-preview">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-gray-600">{company.address}</p>
          <p className="text-gray-600">{company.city}, {company.country}</p>
          <p className="text-gray-600">{company.email}</p>
          <p className="text-gray-600">{company.phone}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
          <p className="text-gray-600">#{invoice.invoiceNumber}</p>
          <div className="mt-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              invoice.status === "paid" ? "bg-green-100 text-green-800" :
              invoice.status === "overdue" ? "bg-red-100 text-red-800" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {invoice.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Bill To / Invoice Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h3>
          <p className="font-semibold text-gray-900">{customer.companyName || customer.name}</p>
          {customer.companyName && <p className="text-gray-600">{customer.name}</p>}
          {customer.address && <p className="text-gray-600">{customer.address}</p>}
          {(customer.city || customer.state || customer.postalCode) && (
            <p className="text-gray-600">
              {[customer.city, customer.state, customer.postalCode].filter(Boolean).join(", ")}
            </p>
          )}
          {customer.country && <p className="text-gray-600">{customer.country}</p>}
          {customer.email && <p className="text-gray-600">{customer.email}</p>}
        </div>
        <div className="text-right">
          <div className="mb-2">
            <span className="text-gray-500">Issue Date: </span>
            <span className="text-gray-900">{new Date(invoice.issueDate).toLocaleDateString()}</span>
          </div>
          <div className="mb-2">
            <span className="text-gray-500">Due Date: </span>
            <span className="text-gray-900">{new Date(invoice.dueDate).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 text-gray-500 font-semibold">Description</th>
            <th className="text-right py-3 text-gray-500 font-semibold">Qty</th>
            <th className="text-right py-3 text-gray-500 font-semibold">Unit Price</th>
            <th className="text-right py-3 text-gray-500 font-semibold">Tax</th>
            <th className="text-right py-3 text-gray-500 font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={index} className="border-b border-gray-100">
              <td className="py-3 text-gray-900">{item.description}</td>
              <td className="py-3 text-right text-gray-600">{item.quantity}</td>
              <td className="py-3 text-right text-gray-600">{formatCurrency(parseFloat(item.unitPrice))}</td>
              <td className="py-3 text-right text-gray-600">{item.taxRate || "0"}%</td>
              <td className="py-3 text-right text-gray-900 font-medium">{formatCurrency(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Tax</span>
            <span className="text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-gray-200 font-bold">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{formatCurrency(invoice.total)}</span>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between py-2 text-green-600">
              <span>Paid</span>
              <span>-{formatCurrency(invoice.amountPaid)}</span>
            </div>
          )}
          {invoice.amountDue > 0 && (
            <div className="flex justify-between py-2 bg-gray-100 px-2 rounded font-bold">
              <span className="text-gray-900">Amount Due</span>
              <span className="text-gray-900">{formatCurrency(invoice.amountDue)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
          <p className="text-gray-600">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>Thank you for your business!</p>
        <p>Tax ID: {company.taxId}</p>
      </div>
    </div>
  );
}
