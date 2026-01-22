/**
 * Portal Work Orders List Page
 * 
 * Displays customer's work orders with filtering and status tracking.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, Search, Filter, Clock, CheckCircle, 
  AlertCircle, Wrench, ArrowRight, RefreshCw
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

function formatDate(date: string | Date | null) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode }> = {
    submitted: { variant: 'outline', label: 'Submitted', icon: <Clock className="h-3 w-3" /> },
    acknowledged: { variant: 'secondary', label: 'Acknowledged', icon: <CheckCircle className="h-3 w-3" /> },
    in_progress: { variant: 'default', label: 'In Progress', icon: <RefreshCw className="h-3 w-3" /> },
    completed: { variant: 'default', label: 'Completed', icon: <CheckCircle className="h-3 w-3" /> },
    cancelled: { variant: 'destructive', label: 'Cancelled', icon: <AlertCircle className="h-3 w-3" /> },
  };
  
  const config = variants[status] || { variant: 'outline' as const, label: status, icon: null };
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    low: { variant: 'outline', label: 'Low' },
    medium: { variant: 'secondary', label: 'Medium' },
    high: { variant: 'default', label: 'High' },
    urgent: { variant: 'destructive', label: 'Urgent' },
  };
  
  const config = variants[priority] || { variant: 'outline' as const, label: priority };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getCategoryIcon(category: string) {
  const icons: Record<string, React.ReactNode> = {
    maintenance: <Wrench className="h-4 w-4" />,
    repair: <AlertCircle className="h-4 w-4" />,
    inspection: <Search className="h-4 w-4" />,
    installation: <Plus className="h-4 w-4" />,
    support: <Clock className="h-4 w-4" />,
    other: <Filter className="h-4 w-4" />,
  };
  return icons[category] || <Wrench className="h-4 w-4" />;
}

export default function PortalWorkOrders() {
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Get token from localStorage (matches the key used in PortalLogin)
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/portal/login');
    }
  }, [token, navigate]);
  
  // Fetch work orders
  const { data, isLoading, refetch } = trpc.customerPortal.listMyWorkOrders.useQuery(
    { 
      token: token || '',
      status: statusFilter !== 'all' ? statusFilter : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      limit: 50,
    },
    { enabled: !!token }
  );
  
  if (!token) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Work Orders</h1>
              <p className="text-muted-foreground">Submit and track service requests</p>
            </div>
            <Button onClick={() => navigate('/portal/work-orders/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </div>
        </div>
      </header>
      
      {/* Filters */}
      <div className="container py-4">
        <div className="flex flex-wrap gap-4 mb-6">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="repair">Repair</SelectItem>
              <SelectItem value="inspection">Inspection</SelectItem>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Work Orders List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.workOrders && data.workOrders.length > 0 ? (
          <div className="space-y-4">
            {data.workOrders.map((wo: any) => (
              <Card 
                key={wo.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/portal/work-orders/${wo.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        {getCategoryIcon(wo.category)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{wo.title}</h3>
                        <p className="text-muted-foreground text-sm line-clamp-2 mt-1">
                          {wo.description}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {getStatusBadge(wo.status)}
                          {getPriorityBadge(wo.priority)}
                          <Badge variant="outline" className="capitalize">
                            {wo.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Created {formatDate(wo.createdAt)}</p>
                      {wo.scheduledDate && (
                        <p className="mt-1">Scheduled: {formatDate(wo.scheduledDate)}</p>
                      )}
                      <ArrowRight className="h-4 w-4 ml-auto mt-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Work Orders</h3>
              <p className="text-muted-foreground mb-4">
                You haven't submitted any service requests yet.
              </p>
              <Button onClick={() => navigate('/portal/work-orders/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Submit a Request
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Pagination info */}
        {data?.total && data.total > 0 && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            Showing {data.workOrders.length} of {data.total} work orders
          </p>
        )}
      </div>
    </div>
  );
}
