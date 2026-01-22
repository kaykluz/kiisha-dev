/**
 * Customer Portal Dashboard
 * 
 * Overview page showing customer's projects, invoices,
 * payments, and quick actions.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, CreditCard, FolderOpen, DollarSign, 
  AlertCircle, CheckCircle, Clock, ArrowRight,
  Zap, LogOut, User, Bell
} from 'lucide-react';
import { EnergyProductionChart } from '@/components/EnergyProductionChart';
import { NotificationBell } from '@/components/NotificationBell';
import { trpc } from '@/lib/trpc';

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

export default function PortalDashboard() {
  const [, setLocation] = useLocation();
  const [customerId, setCustomerId] = useState<number | null>(null);
  
  // Check authentication and get customer ID from token
  useEffect(() => {
    const token = localStorage.getItem('customer_token');
    if (!token) {
      setLocation('/portal/login');
      return;
    }
    
    try {
      // Decode JWT to get customer ID (simple base64 decode of payload)
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
  
  // Fetch real dashboard data
  const { data: dashboardData, isLoading, error } = trpc.customerPortal.getMyDashboard.useQuery(
    { customerId: customerId! },
    { enabled: !!customerId }
  );
  
  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    setLocation('/portal/login');
  };
  
  // Loading state
  if (isLoading || !customerId) {
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
  if (error) {
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
  
  const { customer, summary, recentInvoices, recentPayments, projects } = dashboardData || {
    customer: { name: 'Customer' },
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
                <h1 className="text-lg font-semibold text-white">Customer Portal</h1>
                <p className="text-sm text-slate-400">{customer?.companyName || customer?.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationBell customerId={customerId} />
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <User className="w-4 h-4 mr-2" />
                Profile
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
                    {summary.overdueCount} invoice{summary.overdueCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Invoices & Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Recent Invoices */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Recent Invoices</CardTitle>
                <CardDescription className="text-slate-400">Your latest invoices</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-orange-400 hover:text-orange-300"
                onClick={() => setLocation('/portal/invoices')}
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentInvoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No invoices yet</p>
                  </div>
                ) : (
                  recentInvoices.map((invoice) => (
                    <div 
                      key={invoice.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/portal/invoices/${invoice.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-slate-400">Due {formatDate(invoice.dueDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-white">{formatCurrency(invoice.totalAmount, invoice.currency || 'USD')}</p>
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Recent Payments */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Recent Payments</CardTitle>
                <CardDescription className="text-slate-400">Your payment history</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-orange-400 hover:text-orange-300"
                onClick={() => setLocation('/portal/payments')}
              >
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentPayments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No payments yet</p>
                  </div>
                ) : (
                  recentPayments.map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{formatCurrency(payment.amount, payment.currency || 'USD')}</p>
                          <p className="text-sm text-slate-400">{formatDate(payment.paymentDate)}</p>
                        </div>
                      </div>
                      {getPaymentStatusBadge(payment.status)}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Energy Production Chart */}
        <div className="mb-8">
          <EnergyProductionChart />
        </div>
        
        {/* Projects */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Your Projects</CardTitle>
              <CardDescription className="text-slate-400">Projects you have access to</CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-orange-400 hover:text-orange-300"
              onClick={() => setLocation('/portal/projects')}
            >
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8">
                <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No projects assigned yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {projects.map((project) => (
                  <div 
                    key={project.id}
                    className="p-4 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/portal/projects/${project.projectId}`)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                        <FolderOpen className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">Project #{project.projectId}</p>
                        <Badge variant="outline" className="text-xs">
                          {project.accessLevel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
