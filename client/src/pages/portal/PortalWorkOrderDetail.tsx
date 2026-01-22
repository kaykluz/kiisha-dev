/**
 * Portal Work Order Detail Page
 * 
 * Shows work order details with comments and allows adding new comments.
 */

import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  ArrowLeft, Clock, CheckCircle, AlertCircle, 
  Wrench, Send, User, MessageSquare, Calendar
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

function formatDate(date: string | Date | null) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(date: string | Date | null) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    submitted: { variant: 'outline', label: 'Submitted' },
    acknowledged: { variant: 'secondary', label: 'Acknowledged' },
    in_progress: { variant: 'default', label: 'In Progress' },
    completed: { variant: 'default', label: 'Completed' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
  };
  
  const config = variants[status] || { variant: 'outline' as const, label: status };
  return <Badge variant={config.variant} className="text-sm">{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
    low: { variant: 'outline', label: 'Low Priority' },
    medium: { variant: 'secondary', label: 'Medium Priority' },
    high: { variant: 'default', label: 'High Priority' },
    urgent: { variant: 'destructive', label: 'Urgent' },
  };
  
  const config = variants[priority] || { variant: 'outline' as const, label: priority };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function PortalWorkOrderDetail() {
  const [, navigate] = useLocation();
  const params = useParams();
  const workOrderId = parseInt(params.id || '0');
  const [newComment, setNewComment] = useState('');
  
  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate('/portal/login');
    }
  }, [token, navigate]);
  
  // Fetch work order details
  const { data, isLoading, refetch } = trpc.customerPortal.getMyWorkOrder.useQuery(
    { token: token || '', workOrderId },
    { enabled: !!token && workOrderId > 0 }
  );
  
  // Add comment mutation
  const addCommentMutation = trpc.customerPortal.addWorkOrderComment.useMutation({
    onSuccess: () => {
      toast.success('Comment added successfully');
      setNewComment('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add comment');
    },
  });
  
  const handleAddComment = () => {
    if (!newComment.trim() || !token) return;
    
    addCommentMutation.mutate({
      token,
      workOrderId,
      content: newComment.trim(),
    });
  };
  
  if (!token) {
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <div className="container py-6">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-1/2 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  if (!data?.workOrder) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container py-4">
            <Button variant="ghost" onClick={() => navigate('/portal/work-orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Work Orders
            </Button>
          </div>
        </header>
        <div className="container py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Work Order Not Found</h2>
          <p className="text-muted-foreground">The requested work order could not be found.</p>
        </div>
      </div>
    );
  }
  
  const { workOrder, comments } = data;
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <Button variant="ghost" onClick={() => navigate('/portal/work-orders')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{workOrder.title}</h1>
              <p className="text-muted-foreground">
                Created {formatDate(workOrder.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              {getStatusBadge(workOrder.status)}
              {getPriorityBadge(workOrder.priority)}
            </div>
          </div>
        </div>
      </header>
      
      <div className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{workOrder.description}</p>
              </CardContent>
            </Card>
            
            {/* Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {comments && comments.length > 0 ? (
                  <div className="space-y-4">
                    {comments.map((comment: any, index: number) => (
                      <div key={comment.id || index}>
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {comment.authorType === 'portal_user' ? 'C' : 'S'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {comment.authorName || (comment.authorType === 'portal_user' ? 'You' : 'Support Team')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                        {index < comments.length - 1 && <Separator className="my-4" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No comments yet. Add a comment below.
                  </p>
                )}
                
                {/* Add Comment Form */}
                {workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
                  <div className="mt-6 pt-4 border-t">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className="mb-3"
                    />
                    <Button 
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {addCommentMutation.isPending ? 'Sending...' : 'Send Comment'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{workOrder.category}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(workOrder.status)}</div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <div className="mt-1">{getPriorityBadge(workOrder.priority)}</div>
                </div>
                {workOrder.preferredDate && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Preferred Date</p>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(workOrder.preferredDate)}
                      </p>
                    </div>
                  </>
                )}
                {workOrder.scheduledDate && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Scheduled Date</p>
                      <p className="font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDate(workOrder.scheduledDate)}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Contact Info */}
            {(workOrder.contactPhone || workOrder.contactEmail) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {workOrder.contactPhone && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Phone:</span> {workOrder.contactPhone}
                    </p>
                  )}
                  {workOrder.contactEmail && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Email:</span> {workOrder.contactEmail}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Completion Notes */}
            {workOrder.status === 'completed' && workOrder.completionNotes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Completion Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{workOrder.completionNotes}</p>
                  {workOrder.completedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Completed on {formatDateTime(workOrder.completedAt)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
