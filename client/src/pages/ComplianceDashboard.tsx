import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Building2,
  RefreshCw,
  Download,
  Calendar
} from "lucide-react";

export default function ComplianceDashboard() {
  const [dateRange, setDateRange] = useState("30");
  
  const { data: analytics, isLoading, refetch } = trpc.diligence.getComplianceAnalytics.useQuery({});
  const { data: heatmap } = trpc.diligence.getRequirementHeatmap.useQuery({});

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const overview = analytics?.overview || {
    totalResponses: 0,
    totalSubmissions: 0,
    completionRate: 0,
    avgReviewTimeHours: 0
  };

  const responsesByStatus = analytics?.responsesByStatus || {
    draft: 0,
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0
  };

  const submissionsByStatus = analytics?.submissionsByStatus || {
    pending: 0,
    uploaded: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    needs_revision: 0
  };

  const uploadTrends = analytics?.uploadTrends || [];
  const companyCompletionRates = analytics?.companyCompletionRates || [];

  // Calculate max for chart scaling
  const maxUploads = Math.max(...uploadTrends.map(t => t.count), 1);

  return (
    <AppLayout>
      <div className="h-full overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Compliance Dashboard</h1>
              <p className="text-muted-foreground">
                Analytics and insights across all compliance activities
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[150px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalResponses}</div>
                <p className="text-xs text-muted-foreground">
                  Active compliance responses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.completionRate}%</div>
                <Progress value={overview.completionRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Review Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.avgReviewTimeHours}h</div>
                <p className="text-xs text-muted-foreground">
                  Average time to review
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overview.totalSubmissions}</div>
                <p className="text-xs text-muted-foreground">
                  Documents submitted
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="companies">By Company</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Response Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Response Status Distribution</CardTitle>
                    <CardDescription>Breakdown of all responses by status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <span>Draft</span>
                        </div>
                        <span className="font-medium">{responsesByStatus.draft}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Submitted</span>
                        </div>
                        <span className="font-medium">{responsesByStatus.submitted}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span>Under Review</span>
                        </div>
                        <span className="font-medium">{responsesByStatus.under_review}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Approved</span>
                        </div>
                        <span className="font-medium">{responsesByStatus.approved}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span>Rejected</span>
                        </div>
                        <span className="font-medium">{responsesByStatus.rejected}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submission Status Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Submission Status Distribution</CardTitle>
                    <CardDescription>Breakdown of all document submissions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                          <span>Pending</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.pending}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span>Uploaded</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.uploaded}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span>Under Review</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.under_review}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>Approved</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.approved}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span>Rejected</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.rejected}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                          <span>Needs Revision</span>
                        </div>
                        <span className="font-medium">{submissionsByStatus.needs_revision}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="companies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Company Completion Rates</CardTitle>
                  <CardDescription>Compliance completion by company</CardDescription>
                </CardHeader>
                <CardContent>
                  {companyCompletionRates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No company data available
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {companyCompletionRates.map((company) => (
                        <div key={company.companyId} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{company.companyName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">
                                {company.completed}/{company.total}
                              </span>
                              <Badge variant={company.rate >= 80 ? "default" : company.rate >= 50 ? "secondary" : "destructive"}>
                                {company.rate}%
                              </Badge>
                            </div>
                          </div>
                          <Progress value={company.rate} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Requirement Completion Heatmap</CardTitle>
                  <CardDescription>Completion rates by requirement type</CardDescription>
                </CardHeader>
                <CardContent>
                  {!heatmap || heatmap.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No requirement data available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {heatmap.slice(0, 20).map((req) => (
                        <div 
                          key={req.requirementId} 
                          className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div 
                            className="w-12 h-8 rounded flex items-center justify-center text-xs font-medium text-white"
                            style={{
                              backgroundColor: req.rate >= 80 ? '#22c55e' : 
                                req.rate >= 60 ? '#84cc16' : 
                                req.rate >= 40 ? '#eab308' : 
                                req.rate >= 20 ? '#f97316' : '#ef4444'
                            }}
                          >
                            {req.rate}%
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{req.requirementTitle}</p>
                            <p className="text-xs text-muted-foreground">
                              {req.category} • {req.completed}/{req.total} completed
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Document Upload Trends</CardTitle>
                  <CardDescription>Daily uploads over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {uploadTrends.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No upload data available
                    </div>
                  ) : (
                    <div className="h-64 flex items-end gap-1">
                      {uploadTrends.map((trend, index) => (
                        <div 
                          key={trend.date} 
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div 
                            className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                            style={{ 
                              height: `${(trend.count / maxUploads) * 200}px`,
                              minHeight: trend.count > 0 ? '4px' : '0'
                            }}
                            title={`${trend.date}: ${trend.count} uploads`}
                          />
                          {index % 5 === 0 && (
                            <span className="text-[10px] text-muted-foreground rotate-45 origin-left">
                              {trend.date.slice(5)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
