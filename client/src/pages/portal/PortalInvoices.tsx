/**
 * Customer Portal Invoices Page
 * 
 * List and view invoices with payment functionality.
 */

import { useState, useEffect } from 'react';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, CreditCard, Download, Search, Filter,
  ArrowLeft, ExternalLink, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { InvoicePdfDownload } from '@/components/InvoicePdf';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import PortalLayout from './PortalLayout';

function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

function formatDate(date: string | Date | null) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
    paid: { variant: 'default', label: 'Paid', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
    partial: { variant: 'secondary', label: 'Partial', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    pending: { variant: 'outline', label: 'Pending', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    overdue: { variant: 'destructive', label: 'Overdue', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    sent: { variant: 'outline', label: 'Sent', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
    viewed: { variant: 'secondary', label: 'Viewed', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    draft: { variant: 'outline', label: 'Draft', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  };
  
  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
}

export default function PortalInvoices() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, isReadOnly, customerId, isCompanyUser } = usePortalAuth();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Debounced search query for server-side filtering
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Debounce the search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Fetch real invoices from API with server-side search
  const { data: invoicesData, isLoading, error } = trpc.customerPortal.getMyInvoices.useQuery(
    { 
      customerId: customerId || 0,
      status: statusFilter !== 'all' ? statusFilter as any : undefined,
      search: debouncedSearch || undefined,
      limit: 50,
    },
    { enabled: !authLoading && customerId !== null }
  );
  
  const filteredInvoices = invoicesData || [];
  
  // Loading state
  if (authLoading || isLoading) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </PortalLayout>
    );
  }
  
  // Error state
  if (error) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Unable to Load Invoices</h2>
          <p className="text-slate-400 mb-4">There was an error loading your invoices. Please try again.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </PortalLayout>
    );
  }
  
  return (
    <PortalLayout activeTab="invoices">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Invoices</h1>
            <p className="text-slate-400">
              {isCompanyUser ? 'View all customer invoices' : 'View and pay your invoices'}
            </p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-slate-800 border-slate-700 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-white">All Status</SelectItem>
              <SelectItem value="pending" className="text-white">Pending</SelectItem>
              <SelectItem value="sent" className="text-white">Sent</SelectItem>
              <SelectItem value="viewed" className="text-white">Viewed</SelectItem>
              <SelectItem value="partial" className="text-white">Partial</SelectItem>
              <SelectItem value="paid" className="text-white">Paid</SelectItem>
              <SelectItem value="overdue" className="text-white">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-slate-500 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Invoices Found</h3>
              <p className="text-slate-400 text-center">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your filters to see more results.'
                  : 'You don\'t have any invoices yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredInvoices.map((invoice: any) => (
              <Card 
                key={invoice.id} 
                className="bg-slate-800/50 border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setLocation(`/portal/invoices/${invoice.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{invoice.invoiceNumber}</h3>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <p className="text-sm text-slate-400">
                          Due: {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-white">
                          {formatCurrency(invoice.totalAmount, invoice.currency)}
                        </p>
                        {invoice.paidAmount > 0 && invoice.status !== 'paid' && (
                          <p className="text-sm text-green-400">
                            Paid: {formatCurrency(invoice.paidAmount, invoice.currency)}
                          </p>
                        )}
                      </div>
                      {!isReadOnly && invoice.status !== 'paid' && (
                        <Button 
                          size="sm" 
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/portal/invoices/${invoice.id}`);
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

// Invoice Detail Component (for /portal/invoices/:id route)
export function PortalInvoiceDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, isReadOnly, customerId } = usePortalAuth();
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  
  const invoiceId = params.id ? parseInt(params.id, 10) : null;
  
  // Fetch invoice details
  const { data: invoice, isLoading, error } = trpc.customerPortal.getInvoiceDetail.useQuery(
    { invoiceId: invoiceId! },
    { enabled: !authLoading && !!invoiceId && customerId !== null }
  );
  
  // Loading state
  if (authLoading || isLoading) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PortalLayout>
    );
  }
  
  // Error or not found
  if (error || !invoice) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Invoice Not Found</h2>
          <p className="text-slate-400 mb-4">The invoice you're looking for doesn't exist or you don't have access to it.</p>
          <Button onClick={() => setLocation('/portal/invoices')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </div>
      </PortalLayout>
    );
  }
  
  const outstandingAmount = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount || '0');
  
  return (
    <PortalLayout activeTab="invoices">
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="text-slate-400 hover:text-white"
          onClick={() => setLocation('/portal/invoices')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-slate-400">
              Issued: {formatDate(invoice.issueDate)} • Due: {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <InvoicePdfDownload invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
            {!isReadOnly && invoice.status !== 'paid' && (
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                disabled={isPaymentProcessing}
              >
                {isPaymentProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {formatCurrency(outstandingAmount, invoice.currency)}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Invoice Details Card */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400">Total Amount</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(invoice.totalAmount, invoice.currency)}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400">Amount Paid</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatCurrency(invoice.paidAmount || 0, invoice.currency)}
                </p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-sm text-slate-400">Outstanding</p>
                <p className="text-2xl font-bold text-orange-400">
                  {formatCurrency(outstandingAmount, invoice.currency)}
                </p>
              </div>
            </div>
            
            {/* Line Items */}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Line Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 text-slate-400 font-medium">Description</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Qty</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Unit Price</th>
                        <th className="text-right py-2 text-slate-400 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.lineItems.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-slate-700/50">
                          <td className="py-3 text-white">{item.description}</td>
                          <td className="py-3 text-right text-slate-300">{item.quantity}</td>
                          <td className="py-3 text-right text-slate-300">
                            {formatCurrency(item.unitPrice, invoice.currency)}
                          </td>
                          <td className="py-3 text-right text-white font-medium">
                            {formatCurrency(item.amount, invoice.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Notes */}
            {invoice.notes && (
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Notes</h3>
                <p className="text-slate-400">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
