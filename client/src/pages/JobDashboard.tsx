import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { AdminGuard } from "@/components/AdminGuard";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  RefreshCw, Clock, Loader2, CheckCircle2, XCircle, Ban, 
  ChevronDown, ChevronUp, Copy, Check, AlertTriangle, 
  Search, Filter, RotateCcw, Trash2, Play
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JobStatusResponse, JOB_TYPE_LABELS, JOB_STATUS_LABELS } from "@shared/jobTypes";

type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
type JobType = "document_ingestion" | "ai_extraction" | "email_send" | "notification_send" | "report_generation" | "data_export" | "file_processing" | "webhook_delivery";

export default function JobDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedJobs, setSelectedJobs] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<JobType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch jobs - admins see all jobs, regular users see only their own
  const { data: adminJobsData, isLoading: isAdminLoading, refetch: refetchAdmin } = trpc.jobs.getAllJobs.useQuery(
    { 
      status: statusFilter === "all" ? undefined : statusFilter,
      type: typeFilter === "all" ? undefined : typeFilter,
      limit: 100 
    },
    { 
      refetchInterval: 5000,
      enabled: isAdmin
    }
  );

  const { data: userJobs, isLoading: isUserLoading, refetch: refetchUser } = trpc.jobs.getUserJobs.useQuery(
    { 
      status: statusFilter === "all" ? undefined : statusFilter,
      type: typeFilter === "all" ? undefined : typeFilter,
      limit: 100 
    },
    { 
      refetchInterval: 5000,
      enabled: !isAdmin
    }
  );

  // Normalize data based on user role
  const jobs = isAdmin ? adminJobsData?.jobs : userJobs;
  const isLoading = isAdmin ? isAdminLoading : isUserLoading;
  const refetch = isAdmin ? refetchAdmin : refetchUser;

  // Retry mutation
  const retryMutation = trpc.jobs.retry.useMutation({
    onSuccess: (newJob) => {
      toast.success(`Job retry initiated. New job ID: ${newJob.id}`);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to retry job: ${error.message}`);
    },
  });

  // Cancel mutation
  const cancelMutation = trpc.jobs.cancel.useMutation({
    onSuccess: () => {
      toast.success("Job cancelled");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to cancel job: ${error.message}`);
    },
  });

  // Filter jobs based on search query
  const filteredJobs = jobs?.filter((job) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.id.toString().includes(query) ||
      job.correlationId?.toLowerCase().includes(query) ||
      job.type.toLowerCase().includes(query) ||
      job.displayStatus.toLowerCase().includes(query)
    );
  }) ?? [];

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map((j) => j.id)));
    }
  };

  const handleBulkRetry = async () => {
    const failedJobs = filteredJobs.filter(
      (j) => selectedJobs.has(j.id) && j.status === "failed" && j.isRetryable
    );
    
    if (failedJobs.length === 0) {
      toast.error("No retryable failed jobs selected");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const job of failedJobs) {
      try {
        await retryMutation.mutateAsync({ jobId: job.id });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    toast.success(`Retried ${successCount} jobs${errorCount > 0 ? `, ${errorCount} failed` : ""}`);
    setSelectedJobs(new Set());
  };

  const handleBulkCancel = async () => {
    const cancellableJobs = filteredJobs.filter(
      (j) => selectedJobs.has(j.id) && ["queued", "processing"].includes(j.status)
    );

    if (cancellableJobs.length === 0) {
      toast.error("No cancellable jobs selected");
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const job of cancellableJobs) {
      try {
        await cancelMutation.mutateAsync({ jobId: job.id });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    toast.success(`Cancelled ${successCount} jobs${errorCount > 0 ? `, ${errorCount} failed` : ""}`);
    setSelectedJobs(new Set());
  };

  const toggleJobExpanded = (jobId: number) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "cancelled":
        return <Ban className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: JobStatus) => {
    switch (status) {
      case "queued":
        return "secondary";
      case "processing":
        return "default";
      case "completed":
        return "default";
      case "failed":
        return "destructive";
      case "cancelled":
        return "secondary";
      default:
        return "secondary";
    }
  };

  // Calculate stats
  const stats = {
    total: jobs?.length ?? 0,
    queued: jobs?.filter((j) => j.status === "queued").length ?? 0,
    processing: jobs?.filter((j) => j.status === "processing").length ?? 0,
    completed: jobs?.filter((j) => j.status === "completed").length ?? 0,
    failed: jobs?.filter((j) => j.status === "failed").length ?? 0,
    cancelled: jobs?.filter((j) => j.status === "cancelled").length ?? 0,
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Job Dashboard</h1>
              {isAdmin && (
                <Badge variant="secondary" className="text-xs">
                  Admin View
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {isAdmin 
                ? "Monitor and manage all background processing jobs" 
                : "Monitor your background processing jobs"}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Jobs</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("queued")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">{stats.queued}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Queued
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("processing")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-500">{stats.processing}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3" /> Processing
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("completed")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Completed
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("failed")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3" /> Failed
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter("cancelled")}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-gray-500">{stats.cancelled}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Ban className="h-3 w-3" /> Cancelled
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, correlation ID, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as JobStatus | "all")}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as JobType | "all")}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Job Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(JOB_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedJobs.size > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedJobs.size} job{selectedJobs.size > 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkRetry}
                    disabled={retryMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Failed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkCancel}
                    disabled={cancelMutation.isPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancel Active
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedJobs(new Set())}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Jobs List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Jobs</CardTitle>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Select All</span>
              </div>
            </div>
            <CardDescription>
              Showing {filteredJobs.length} of {jobs?.length ?? 0} jobs
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No jobs found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    isSelected={selectedJobs.has(job.id)}
                    isExpanded={expandedJobs.has(job.id)}
                    onSelect={(selected) => {
                      setSelectedJobs((prev) => {
                        const next = new Set(prev);
                        if (selected) {
                          next.add(job.id);
                        } else {
                          next.delete(job.id);
                        }
                        return next;
                      });
                    }}
                    onToggleExpand={() => toggleJobExpanded(job.id)}
                    onRetry={() => retryMutation.mutate({ jobId: job.id })}
                    onCancel={() => cancelMutation.mutate({ jobId: job.id })}
                    onCopyId={copyToClipboard}
                    copiedId={copiedId}
                    isRetrying={retryMutation.isPending}
                    isCancelling={cancelMutation.isPending}
                    getStatusIcon={getStatusIcon}
                    getStatusBadgeVariant={getStatusBadgeVariant}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

interface JobRowProps {
  job: JobStatusResponse;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (selected: boolean) => void;
  onToggleExpand: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onCopyId: (id: string) => void;
  copiedId: string | null;
  isRetrying: boolean;
  isCancelling: boolean;
  getStatusIcon: (status: JobStatus) => React.ReactNode;
  getStatusBadgeVariant: (status: JobStatus) => "default" | "secondary" | "destructive" | "outline";
}

function JobRow({
  job,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onRetry,
  onCancel,
  onCopyId,
  copiedId,
  isRetrying,
  isCancelling,
  getStatusIcon,
  getStatusBadgeVariant,
}: JobRowProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  return (
    <div className={cn("p-4 hover:bg-muted/50", isSelected && "bg-muted/30")}>
      <div className="flex items-start gap-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="mt-1"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusIcon(job.status as JobStatus)}
            <Badge variant={getStatusBadgeVariant(job.status as JobStatus)}>
              {JOB_STATUS_LABELS[job.status as keyof typeof JOB_STATUS_LABELS] || job.status}
            </Badge>
            <Badge variant="outline">
              {JOB_TYPE_LABELS[job.type as keyof typeof JOB_TYPE_LABELS] || job.type}
            </Badge>
            <span className="text-xs text-muted-foreground">ID: {job.id}</span>
            {job.correlationId && (
              <div className="flex items-center gap-1">
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  {job.correlationId.substring(0, 12)}...
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onCopyId(job.correlationId!)}
                >
                  {copiedId === job.correlationId ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </div>
          
          <p className="text-sm mt-1">{job.displayStatus}</p>
          
          {job.status === "processing" && job.progress !== undefined && (
            <div className="mt-2 space-y-1">
              <Progress value={job.progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{job.progress}%</span>
                {job.progressMessage && <span>{job.progressMessage}</span>}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span>Created: {formatDate(job.createdAt)}</span>
            {job.startedAt && <span>Started: {formatDate(job.startedAt)}</span>}
            {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
            <span>Attempts: {job.attempts}/{job.maxAttempts}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.status === "failed" && job.isRetryable && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RotateCcw className={cn("h-4 w-4", isRetrying && "animate-spin")} />
            </Button>
          )}
          {["queued", "processing"].includes(job.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isCancelling}
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <div className="mt-4 ml-10 space-y-4">
            {/* Error Details */}
            {job.status === "failed" && job.error && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    {job.userFriendlyError || "Job failed"}
                  </span>
                </div>
                <pre className="text-xs text-red-600 dark:text-red-500 whitespace-pre-wrap overflow-auto max-h-32">
                  {job.error}
                </pre>
              </div>
            )}

            {/* Result Details */}
            {job.status === "completed" && job.result && (
              <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    Job completed successfully
                  </span>
                </div>
                <pre className="text-xs text-green-600 dark:text-green-500 whitespace-pre-wrap overflow-auto max-h-32">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Priority:</span>{" "}
                <span className="capitalize">{job.priority}</span>
              </div>
              {job.parentJobId && (
                <div>
                  <span className="text-muted-foreground">Parent Job:</span>{" "}
                  <span>#{job.parentJobId}</span>
                </div>
              )}
              {job.linkedEntityType && (
                <div>
                  <span className="text-muted-foreground">Linked Entity:</span>{" "}
                  <span>{job.linkedEntityType} #{job.linkedEntityId}</span>
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
