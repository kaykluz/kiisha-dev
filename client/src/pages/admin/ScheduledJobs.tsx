/**
 * Admin Scheduled Jobs Management
 * 
 * View and manage automated background tasks:
 * - Recurring invoice generation
 * - Payment reminder processing
 * 
 * WHO USES THIS: Admin only
 * LOCATION: Admin Dashboard → Settings → Scheduled Jobs
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Play, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Calendar,
  History,
  Settings
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ScheduledJobs() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Fetch all jobs
  const { data: jobs, isLoading, refetch } = trpc.scheduledJobs.listJobs.useQuery();

  // Fetch job history
  const { data: jobHistory } = trpc.scheduledJobs.getJobHistory.useQuery(
    { jobId: selectedJobId || undefined, limit: 50 },
    { enabled: showHistoryDialog }
  );

  // Mutations
  const triggerJob = trpc.scheduledJobs.triggerJob.useMutation({
    onSuccess: (result) => {
      toast.success("Job triggered successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const setJobEnabled = trpc.scheduledJobs.setJobEnabled.useMutation({
    onSuccess: () => {
      toast.success("Job status updated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const formatCron = (cron: string) => {
    // Simple cron to human-readable
    const parts = cron.split(' ');
    if (parts.length >= 2) {
      const minute = parts[0];
      const hour = parts[1];
      if (minute === '0' && hour !== '*') {
        return `Daily at ${hour}:00`;
      }
      if (minute !== '*' && hour !== '*') {
        return `Daily at ${hour}:${minute.padStart(2, '0')}`;
      }
    }
    return cron;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Scheduled Jobs</h1>
            <p className="text-muted-foreground">Manage automated background tasks</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold">{jobs?.length || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                  <p className="text-2xl font-bold">
                    {jobs?.filter(j => j.isEnabled).length || 0}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed (Last Run)</p>
                  <p className="text-2xl font-bold">
                    {jobs?.filter(j => j.lastRunStatus === 'error').length || 0}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registered Jobs</CardTitle>
            <CardDescription>
              Background tasks that run automatically on schedule
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : jobs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No scheduled jobs found
                    </TableCell>
                  </TableRow>
                ) : (
                  jobs?.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{job.name}</p>
                          <p className="text-sm text-muted-foreground">{job.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatCron(job.cronExpression)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(job.lastRunAt)}</span>
                      </TableCell>
                      <TableCell>
                        {job.lastRunStatus === 'success' ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : job.lastRunStatus === 'error' ? (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Never Run</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatDate(job.nextRunAt)}</span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={job.isEnabled}
                          onCheckedChange={(checked) => {
                            setJobEnabled.mutate({ jobId: job.id, enabled: checked });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedJobId(job.id);
                              setShowHistoryDialog(true);
                            }}
                            title="View History"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => triggerJob.mutate({ jobId: job.id })}
                            disabled={triggerJob.isPending}
                            title="Run Now"
                          >
                            <Play className={`h-4 w-4 ${triggerJob.isPending ? 'animate-pulse' : ''}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Job History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Job Execution History</DialogTitle>
              <DialogDescription>
                Recent executions for {jobs?.find(j => j.id === selectedJobId)?.name || 'selected job'}
              </DialogDescription>
            </DialogHeader>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobHistory?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No execution history found
                    </TableCell>
                  </TableRow>
                ) : (
                  jobHistory?.map((execution, index) => {
                    const duration = new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();
                    return (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {formatDate(execution.startedAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(execution.completedAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(duration / 1000).toFixed(2)}s
                        </TableCell>
                        <TableCell>
                          {execution.status === 'success' ? (
                            <Badge variant="default" className="bg-green-500">Success</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {execution.result}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
