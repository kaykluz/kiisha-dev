/**
 * Customer Portal Dashboard
 * 
 * Overview page showing customer's projects, invoices,
 * payments, and quick actions.
 * 
 * For company users: Shows customer selector and consolidated view
 * For customer users: Shows their own data only
 */

import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, CreditCard, FolderOpen, DollarSign, 
  AlertCircle, CheckCircle, Clock, ArrowRight,
  Zap, LogOut, User, Bell, Building2, Users, Eye
} from 'lucide-react';
import { EnergyProductionChart } from '@/components/EnergyProductionChart';
import { NotificationBell } from '@/components/NotificationBell';
import { trpc } from '@/lib/trpc';

interface TokenPayload {
  type: 'customer' | 'company';
  userId: number;
  email: string;
  customerId?: number;
  isCompanyUser?: boolean;
  isSuperuser?: boolean;
  allowedCustomerIds?: number[];
}

interface CustomerOption {
  id: number;
  name: string;
  companyName: string | null;
  organizationId: number;
}

function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
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
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    paid: { variant: 'default', label: 'Paid' },
    partial: { variant: 'secondary', label: 'Partial' },
    pending: { variant: 'outline', label: 'Pending' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    sent: { variant: 'outline', label: 'Sent' },
    viewed: { variant: 'secondary', label: 'Viewed' },
    draft: { variant: 'outline', label: 'Draft' },
  };
  
  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPaymentStatusBadge(status: string) {
  const variants: Record<string, { className: string; label: string }> = {
    succeeded: { className: 'bg-green-500/10 text-green-400 border-green-500/20', label: 'Completed' },
    pending: { className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', label: 'Pending' },
    processing: { className: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Processing' },
    failed: { className: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Failed' },
  };
  
  const config = variants[status] || { className: 'bg-slate-500/10 text-slate-400', label: status };
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
}

// Parse and store token data
function parseToken(token: string): TokenPayload | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}

// Get stored customers from localStorage (set during login)
function getStoredCustomers(): CustomerOption[] {
  try {
    const stored = localStorage.getItem('portal_customers');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function PortalDashboard() {
  const [, setLocation] = useLocation();
  const [tokenData, setTokenData] = useState<TokenPayload | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | 'all' | null>(null);
  const [availableCustomers, setAvailableCustomers] = useState<CustomerOption[]>([]);
  
  // Check authentication and parse token
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setLocation('/portal/login');
      return;
    }
    
    const payload = parseToken(token);
    if (!payload) {
      setLocation('/portal/login');
      return;
    }
    
    setTokenData(payload);
    
    // For company users, get available customers
    if (payload.isCompanyUser) {
      const customers = getStoredCustomers();
      setAvailableCustomers(customers);
      // Default to "all" for company users
      setSelectedCustomerId('all');
    } else if (payload.customerId) {
      // For customer users, set their customer ID
      setSelectedCustomerId(payload.customerId);
    } else {
      setLocation('/portal/login');
    }
  }, [setLocation]);
  
  const isCompanyUser = tokenData?.isCompanyUser || false;
  const effectiveCustomerId = selectedCustomerId === 'all' ? null : selectedCustomerId;
  
  // Fetch dashboard data - for company users viewing "all", we'll aggregate
  const { data: dashboardData, isLoading, error } = trpc.customerPortal.getMyDashboard.useQuery(
    { customerId: effectiveCustomerId! },
    { enabled: !!effectiveCustomerId && effectiveCustomerId !== null }
  );
  
  // For company users viewing all customers, fetch consolidated data
  const { data: consolidatedData, isLoading: consolidatedLoading } = trpc.customerPortal.getConsolidatedDashboard.useQuery(
    { customerIds: availableCustomers.map(c => c.id) },
    { enabled: isCompanyUser && selectedCustomerId === 'all' && availableCustomers.length > 0 }
  );
  
  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('portal_customers');
    setLocation('/portal/login');
  };
  
  const handleCustomerChange = (value: string) => {
    if (value === 'all') {
      setSelectedCustomerId('all');
    } else {
      setSelectedCustomerId(parseInt(value, 10));
    }
  };
  
  // Loading state
  if (!tokenData || (isLoading && selectedCustomerId !== 'all') || (consolidatedLoading && selectedCustomerId === 'all')) {
    return (
      <div className="min-h-screen bg-slate-900">
        <header className="bg-slate-800 border-b border-slate-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div>
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-slate-800 border-slate-700">
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-24 mb-2" />
                  <Skeleton className="h-6 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }
  
  // Error state
  if (error && selectedCustomerId !== 'all') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h2>
            <p className="text-slate-400 mb-4">{error.message}</p>
            <Button onClick={() => setLocation('/portal/login')}>Return to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Use consolidated data for "all" view, otherwise use single customer data
  const displayData = selectedCustomerId === 'all' && consolidatedData 
    ? consolidatedData 
    : dashboardData;
  
  const { customer, summary, recentInvoices, recentPayments, projects } = displayData || {
    customer: { name: isCompanyUser ? 'All Customers' : 'Customer', companyName: isCompanyUser ? `${availableCustomers.length} customers` : null },
    summary: { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0 },
    recentInvoices: [],
    recentPayments: [],
    projects: [],
  };
  
  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {isCompanyUser ? 'Company Portal' : 'Customer Portal'}
                </h1>
                <p className="text-sm text-slate-400">
                  {isCompanyUser ? (
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Read-only view
                    </span>
                  ) : (
                    customer?.companyName || customer?.name
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Customer Selector for Company Users */}
              {isCompanyUser && availableCustomers.length > 0 && (
                <Select value={selectedCustomerId?.toString() || 'all'} onValueChange={handleCustomerChange}>
                  <SelectTrigger className="w-[250px] bg-slate-700 border-slate-600 text-white">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-slate-400" />
                      <SelectValue placeholder="Select customer" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" className="text-white hover:bg-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        All Customers ({availableCustomers.length})
                      </div>
                    </SelectItem>
                    {availableCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()} className="text-white hover:bg-slate-700">
                        {c.companyName || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {!isCompanyUser && typeof selectedCustomerId === 'number' && (
                <NotificationBell customerId={selectedCustomerId} />
              )}
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <User className="w-4 h-4 mr-2" />
                {tokenData?.email}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-white"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Company User Banner */}
      {isCompanyUser && (
        <div className="bg-blue-900/30 border-b border-blue-800/50">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center gap-2 text-blue-300 text-sm">
              <Eye className="w-4 h-4" />
              <span>You are viewing as a company user. This is a read-only view of customer data.</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="bg-slate-800/50 border-b border-slate-700">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {[
              { label: 'Dashboard', href: '/portal/dashboard', active: true },
              { label: 'Invoices', href: '/portal/invoices' },
              { label: 'Work Orders', href: '/portal/work-orders' },
              { label: 'Payments', href: '/portal/payments' },
              { label: 'Projects', href: '/portal/projects' },
              { label: 'Documents', href: '/portal/documents' },
            ].map((item) => (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  item.active 
                    ? 'text-orange-400 border-b-2 border-orange-400' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Consolidated View Header for Company Users */}
        {isCompanyUser && selectedCustomerId === 'all' && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Consolidated Customer View</h2>
            <p className="text-slate-400">
              Viewing aggregated data across {availableCustomers.length} customer{availableCustomers.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Invoiced</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(summary.totalInvoiced)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Paid</p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(summary.totalPaid)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Outstanding</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {formatCurrency(summary.totalOutstanding)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Overdue</p>
                  <p className="text-2xl font-bold text-red-400">
                    {summary.overdueCount}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Activity Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Invoices */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Recent Invoices</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-orange-400 hover:text-orange-300"
                  onClick={() => setLocation('/portal/invoices')}
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentInvoices.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {recentInvoices.map((invoice: any) => (
                    <div 
                      key={invoice.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/portal/invoices/${invoice.id}`)}
                    >
                      <div>
                        <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-slate-400">{formatDate(invoice.issueDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{formatCurrency(invoice.totalAmount)}</p>
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Recent Payments */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Recent Payments</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-orange-400 hover:text-orange-300"
                  onClick={() => setLocation('/portal/payments')}
                >
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No payments yet</p>
              ) : (
                <div className="space-y-3">
                  {recentPayments.map((payment: any) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50"
                    >
                      <div>
                        <p className="font-medium text-white">{payment.referenceNumber || `Payment #${payment.id}`}</p>
                        <p className="text-sm text-slate-400">{formatDate(payment.paymentDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-400">{formatCurrency(payment.amount)}</p>
                        {getPaymentStatusBadge(payment.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Customer List for Company Users viewing "All" */}
        {isCompanyUser && selectedCustomerId === 'all' && availableCustomers.length > 0 && (
          <Card className="bg-slate-800 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="text-white">Customer Overview</CardTitle>
              <CardDescription className="text-slate-400">
                Click on a customer to view their detailed portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{c.companyName || c.name}</p>
                        <p className="text-sm text-slate-400">{c.name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-slate-500">
            Powered by KIISHA • {isCompanyUser ? 'Company Portal' : 'Customer Portal'}
          </p>
        </div>
      </footer>
    </div>
  );
}
