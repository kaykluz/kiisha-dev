/**
 * Customer Portal Payments Page
 * 
 * Shows payment history and allows customers to make payments.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import PortalLayout from './PortalLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CreditCard, 
  Search, 
  Download, 
  CheckCircle, 
  Clock, 
  XCircle,
  DollarSign,
  Calendar,
  FileText,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';

export default function PortalPayments() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get customer context
  const { data: dashboardData, isLoading: dashboardLoading } = trpc.customerPortal.getMyDashboard.useQuery({
    customerId: 0, // Will be resolved from token
  });
  
  // Get payments
  const { data: paymentsData, isLoading: paymentsLoading } = trpc.customerPortal.listMyPayments.useQuery({
    limit: 50,
    offset: 0,
  });
  
  const isLoading = dashboardLoading || paymentsLoading;
  const payments = paymentsData?.payments || [];
  
  // Filter payments by search term
  const filteredPayments = payments.filter(payment => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      payment.referenceNumber?.toLowerCase().includes(search) ||
      payment.method?.toLowerCase().includes(search) ||
      payment.invoiceNumber?.toLowerCase().includes(search)
    );
  });
  
  // Calculate summary stats
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const thisMonthPayments = payments.filter(p => {
    const paymentDate = new Date(p.paymentDate);
    const now = new Date();
    return paymentDate.getMonth() === now.getMonth() && paymentDate.getFullYear() === now.getFullYear();
  });
  const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'card':
      case 'credit_card':
        return <CreditCard className="w-4 h-4" />;
      case 'bank_transfer':
      case 'eft':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
  };

  return (
    <PortalLayout activeTab="payments">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Payment History</h1>
            <p className="text-slate-400 mt-1">View your payment history and receipts</p>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Paid</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">
                      ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">This Month</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">
                      ${thisMonthTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <FileText className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Transactions</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold text-white">{payments.length}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by reference number, method, or invoice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>
        
        {/* Payments List */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Payments</CardTitle>
            <CardDescription className="text-slate-400">
              {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div>
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-300 mb-2">No payments found</h3>
                <p className="text-slate-500">
                  {searchTerm ? 'Try adjusting your search terms' : 'Your payment history will appear here'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPayments.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-800 rounded-lg">
                        {getMethodIcon(payment.method)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">
                            ${payment.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                          {getStatusBadge(payment.status)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                          <span>{format(new Date(payment.paymentDate), 'MMM d, yyyy')}</span>
                          {payment.referenceNumber && (
                            <>
                              <span>•</span>
                              <span>Ref: {payment.referenceNumber}</span>
                            </>
                          )}
                          {payment.invoiceNumber && (
                            <>
                              <span>•</span>
                              <span>Invoice: {payment.invoiceNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400 capitalize">
                        {payment.method?.replace('_', ' ')}
                      </span>
                      {payment.receiptUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={() => window.open(payment.receiptUrl, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
