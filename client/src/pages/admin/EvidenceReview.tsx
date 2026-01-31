import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Eye,
  XCircle,
  RefreshCw
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function EvidenceReview() {
  const { data: dashboard, isLoading, refetch } = trpc.evidence.reviewDashboard.useQuery({});
  const resolveMutation = trpc.evidence.resolve.useMutation({
    onSuccess: () => {
      toast.success("Evidence resolved successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Evidence Review</h1>
              <p className="text-muted-foreground">Review and resolve unverified evidence references</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  const tierColors: Record<string, string> = {
    T1_TEXT: "bg-green-100 text-green-800",
    T2_OCR: "bg-yellow-100 text-yellow-800",
    T3_ANCHOR: "bg-orange-100 text-orange-800",
  };
  
  const statusColors: Record<string, string> = {
    resolved: "bg-green-100 text-green-800",
    unresolved: "bg-red-100 text-red-800",
    needs_review: "bg-yellow-100 text-yellow-800",
  };
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Evidence Review</h1>
            <p className="text-muted-foreground">Review and resolve unverified evidence references</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Unresolved</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.totalUnresolved || 0}</div>
              <p className="text-xs text-muted-foreground">Evidence refs pending review</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.needsReview || 0}</div>
              <p className="text-xs text-muted-foreground">Flagged for manual review</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.recentActivity?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Evidence events today</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Unresolved Evidence List */}
        <Card>
          <CardHeader>
            <CardTitle>Unresolved Evidence</CardTitle>
            <CardDescription>Evidence references that need verification or resolution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard?.unresolvedRefs?.map((ref) => (
                <div key={ref.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={tierColors[ref.tier] || "bg-gray-100"}>
                        {ref.tier}
                      </Badge>
                      <Badge className={statusColors[ref.provenanceStatus || 'unresolved'] || "bg-gray-100"}>
                        {ref.provenanceStatus || 'unresolved'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Doc #{ref.documentId}, Page {ref.pageNumber || 'N/A'}
                      </span>
                    </div>
                    <p className="text-sm mb-2">
                      {ref.snippet ? `"${ref.snippet}"` : 'No snippet available'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Field: {ref.fieldRecordType} #{ref.fieldRecordId} • 
                      Confidence: {ref.confidence ? `${(parseFloat(String(ref.confidence)) * 100).toFixed(0)}%` : 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate({ evidenceRefId: ref.id, resolution: 'accept' })}
                      disabled={resolveMutation.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveMutation.mutate({ evidenceRefId: ref.id, resolution: 'reject' })}
                      disabled={resolveMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
              {(!dashboard?.unresolvedRefs || dashboard.unresolvedRefs.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>All evidence is resolved!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest evidence-related events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboard?.recentActivity?.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{activity.eventType}</Badge>
                    <span className="text-sm text-muted-foreground">User #{activity.userId}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : 'Unknown'}
                  </span>
                </div>
              ))}
              {(!dashboard?.recentActivity || dashboard.recentActivity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
