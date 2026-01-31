/**
 * Customer Portal Invoices Page
 * 
 * List and view invoices with payment functionality.
 */

import { useState, useEffect } from 'react';
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  
  // Get customer ID from token
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setLocation('/portal/login');
      return;
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.customerId) {
        setCustomerId(payload.customerId);
      } else {
        setLocation('/portal/login');
      }
    } catch {
      setLocation('/portal/login');
    }
  }, [setLocation]);
  
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
      customerId: customerId!,
      status: statusFilter !== 'all' ? statusFilter as any : undefined,
      search: debouncedSearch || undefined,
      limit: 50,
    },
    { enabled: !!customerId }
  );
  
  const filteredInvoices = invoicesData || [];
  
  // Loading state
  if (isLoading || !customerId) {
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
            <Skeleton className="h-10 w-[180px]" />
          </div>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-0">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-4 border-b border-slate-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <div>
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }
  
  // Error state
  if (error) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="flex items-center justify-center py-12">
          <Card className="bg-slate-800 border-slate-700 max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Error Loading Invoices</h2>
              <p className="text-slate-400">{error.message}</p>
            </CardContent>
          </Card>
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
            <p className="text-slate-400">View and pay your invoices</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Invoice List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700">
              {filteredInvoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="p-4 hover:bg-slate-700/50 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/portal/invoices/${invoice.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <p className="text-xs text-slate-500">
                          Issued {formatDate(invoice.issueDate)} • Due {formatDate(invoice.dueDate)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">
                        {formatCurrency(Number(invoice.totalAmount) / 100, invoice.currency || 'USD')}
                      </p>
                      {invoice.status === 'partial' && (
                        <p className="text-sm text-slate-400">
                          Paid: {formatCurrency(Number(invoice.paidAmount) / 100, invoice.currency || 'USD')}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <div onClick={(e) => e.stopPropagation()}>
                          <InvoicePdfDownload 
                            invoiceId={invoice.id} 
                            invoiceNumber={invoice.invoiceNumber}
                            variant="icon"
                          />
                        </div>
                        {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue' || invoice.status === 'partial') && (
                          <Button 
                            size="sm" 
                            className="bg-orange-500 hover:bg-orange-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info('Redirecting to payment...');
                              // In production: create checkout session and redirect
                            }}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Pay Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredInvoices.length === 0 && (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No invoices found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

// Invoice Detail Page Component
export function PortalInvoiceDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const [isPaying, setIsPaying] = useState(false);
  const invoiceId = parseInt(params.id || '0');
  
  // Fetch real invoice details from API
  const { data: invoice, isLoading, error } = trpc.customerPortal.getInvoiceDetails.useQuery(
    { invoiceId },
    { enabled: !!invoiceId }
  );
  
  const handlePayNow = async () => {
    setIsPaying(true);
    toast.info('Redirecting to secure payment page...');
    
    // In production: create Stripe checkout session
    setTimeout(() => {
      if (invoice?.stripeHostedInvoiceUrl) {
        window.open(invoice.stripeHostedInvoiceUrl, '_blank');
      } else {
        toast.error('Payment link not available');
      }
      setIsPaying(false);
    }, 1000);
  };
  
  // Loading state
  if (isLoading) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="flex items-start justify-between">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex justify-between py-3 border-b border-slate-700">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div>
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }
  
  // Error state
  if (error || !invoice) {
    return (
      <PortalLayout activeTab="invoices">
        <div className="space-y-6">
          <Button 
            variant="ghost" 
            className="text-slate-400 hover:text-white"
            onClick={() => setLocation('/portal/invoices')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
          <Card className="bg-slate-800 border-slate-700 max-w-md mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Invoice Not Found</h2>
              <p className="text-slate-400">{error?.message || 'The requested invoice could not be found.'}</p>
            </CardContent>
          </Card>
        </div>
      </PortalLayout>
    );
  }
  
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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{invoice.invoiceNumber}</h1>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-slate-400 mt-1">
              Issued {formatDate(invoice.issueDate)} • Due {formatDate(invoice.dueDate)}
            </p>
          </div>
          
          <div className="flex gap-2">
            {invoice.stripePdfUrl && (
              <Button 
                variant="outline" 
                className="border-slate-600 text-slate-300"
                onClick={() => window.open(invoice.stripePdfUrl!, '_blank')}
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            )}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.status !== 'refunded' && (
              <Button 
                className="bg-orange-500 hover:bg-orange-600"
                onClick={handlePayNow}
                disabled={isPaying}
              >
                {isPaying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {formatCurrency(Number(invoice.balanceDue) / 100, invoice.currency || 'USD')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Invoice Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Line Items */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {invoice.lineItems && invoice.lineItems.length > 0 ? (
                    <>
                      {invoice.lineItems.map((item: any) => (
                        <div 
                          key={item.id}
                          className="flex items-start justify-between p-3 bg-slate-900/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-white">{item.description}</p>
                            <p className="text-sm text-slate-400">
                              {item.quantity} × {formatCurrency(Number(item.unitPrice) / 100, invoice.currency || 'USD')}
                            </p>
                          </div>
                          <p className="font-medium text-white">
                            {formatCurrency(Number(item.totalAmount) / 100, invoice.currency || 'USD')}
                          </p>
                        </div>
                      ))}
                      
                      {/* Totals */}
                      <div className="border-t border-slate-700 pt-4 space-y-2">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal</span>
                          <span>{formatCurrency(Number(invoice.subtotal) / 100, invoice.currency || 'USD')}</span>
                        </div>
                        {invoice.taxAmount && Number(invoice.taxAmount) > 0 && (
                          <div className="flex justify-between text-slate-400">
                            <span>Tax</span>
                            <span>{formatCurrency(Number(invoice.taxAmount) / 100, invoice.currency || 'USD')}</span>
                          </div>
                        )}
                        {invoice.discountAmount && Number(invoice.discountAmount) > 0 && (
                          <div className="flex justify-between text-green-400">
                            <span>Discount</span>
                            <span>-{formatCurrency(Number(invoice.discountAmount) / 100, invoice.currency || 'USD')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold text-white pt-2 border-t border-slate-700">
                          <span>Total</span>
                          <span>{formatCurrency(Number(invoice.totalAmount) / 100, invoice.currency || 'USD')}</span>
                        </div>
                        {Number(invoice.paidAmount) > 0 && (
                          <>
                            <div className="flex justify-between text-green-400">
                              <span>Paid</span>
                              <span>-{formatCurrency(Number(invoice.paidAmount) / 100, invoice.currency || 'USD')}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold text-orange-400">
                              <span>Balance Due</span>
                              <span>{formatCurrency(Number(invoice.balanceDue) / 100, invoice.currency || 'USD')}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No line items</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Payment History & Notes */}
          <div className="space-y-6">
            {/* Payment History */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="space-y-3">
                    {invoice.payments.map((payment: any) => (
                      <div 
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-white">
                            {formatCurrency(Number(payment.amount) / 100, payment.currency || 'USD')}
                          </p>
                          <p className="text-sm text-slate-400">{formatDate(payment.paymentDate)}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={payment.status === 'succeeded' ? 'bg-green-500/10 text-green-400 border-green-500/20' : ''}
                        >
                          {payment.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No payments recorded</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Notes */}
            {invoice.notes && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 whitespace-pre-wrap">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
