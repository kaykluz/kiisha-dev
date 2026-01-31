import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  FileText, 
  TrendingUp,
  Activity
} from "lucide-react";

interface AnalyticsData {
  totalRequests: number;
  completionRate: number;
  avgResponseDays: number;
  byStatus: Array<{ status: string; count: number }>;
  byTemplate: Array<{ template: string; count: number }>;
  recentActivity: Array<{ id: number; title: string; status: string; createdAt: Date }>;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  issued: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function RequestAnalytics() {
  // Placeholder data until tRPC types regenerate
  const analytics: AnalyticsData = {
    totalRequests: 0,
    completionRate: 0,
    avgResponseDays: 0,
    byStatus: [],
    byTemplate: [],
    recentActivity: [],
  };
  const isLoading = false;
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Request Analytics</h1>
              <p className="text-muted-foreground">Track request performance and completion metrics</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Request Analytics</h1>
            <p className="text-muted-foreground">Track request performance and completion metrics</p>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalRequests || 0}</div>
              <p className="text-xs text-muted-foreground">All time requests issued</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.completionRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Requests completed successfully</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.avgResponseDays || 0} days</div>
              <p className="text-xs text-muted-foreground">Average time to first response</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Requests</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.byStatus.find((s: { status: string; count: number }) => s.status === 'issued')?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">Currently awaiting response</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Requests by Status
              </CardTitle>
              <CardDescription>Distribution of requests across statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.byStatus.map((item: { status: string; count: number }) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge className={statusColors[item.status] || "bg-gray-100"}>
                        {item.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ 
                            width: `${analytics?.totalRequests ? (item.count / analytics.totalRequests) * 100 : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
                {(!analytics?.byStatus || analytics.byStatus.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No requests yet</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Template Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Requests by Template
              </CardTitle>
              <CardDescription>Most used request templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.byTemplate.map((item: { template: string; count: number }) => (
                  <div key={item.template} className="flex items-center justify-between">
                    <span className="text-sm truncate max-w-[200px]">{item.template}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ 
                            width: `${analytics?.totalRequests ? (item.count / analytics.totalRequests) * 100 : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
                {(!analytics?.byTemplate || analytics.byTemplate.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No templates used yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
