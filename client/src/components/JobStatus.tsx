import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  Ban,
  Copy,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types matching the canonical contract
interface JobStatusResponse {
  id: number;
  correlationId: string;
  type: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  priority: "low" | "normal" | "high" | "critical";
  progress?: number;
  progressMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  updatedAt: Date;
  attempts: number;
  maxAttempts: number;
  isRetryable: boolean;
  nextRetryAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
  errorDetails?: Record<string, unknown>;
  userId?: number;
  entityType?: string;
  entityId?: number;
  displayName: string;
  displayStatus: string;
  userFriendlyError?: string;
}

interface JobStatusProps {
  // Either provide jobId or correlationId
  jobId?: number;
  correlationId?: string;
  // Polling interval in ms (default: 2000ms for active jobs, 0 for completed)
  pollInterval?: number;
  // Compact mode for inline display
  compact?: boolean;
  // Show detailed error information
  showErrorDetails?: boolean;
  // Callback when job completes
  onComplete?: (job: JobStatusResponse) => void;
  // Callback when job fails
  onFail?: (job: JobStatusResponse) => void;
  // Custom class name
  className?: string;
}

// Maximum polling duration before showing timeout message (5 minutes)
const MAX_POLLING_DURATION_MS = 5 * 60 * 1000;

// Format duration in human-readable format
function formatDuration(ms: number): string {
  if (ms < 1000) return "< 1s";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Calculate estimated time remaining based on progress and elapsed time
function calculateETA(progress: number, startTime: number): string {
  if (progress <= 0 || progress >= 100) return "--";
  const elapsed = Date.now() - startTime;
  const estimatedTotal = (elapsed / progress) * 100;
  const remaining = estimatedTotal - elapsed;
  if (remaining < 0) return "< 1s";
  return formatDuration(remaining);
}

export function JobStatus({
  jobId,
  correlationId,
  pollInterval = 2000,
  compact = false,
  showErrorDetails = true,
  onComplete,
  onFail,
  className,
}: JobStatusProps) {
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);
  const [copiedCorrelationId, setCopiedCorrelationId] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [pollingStartTime] = useState(() => Date.now());
  const [isPollingTimedOut, setIsPollingTimedOut] = useState(false);

  // Check for polling timeout
  useEffect(() => {
    const checkTimeout = () => {
      if (Date.now() - pollingStartTime > MAX_POLLING_DURATION_MS) {
        setIsPollingTimedOut(true);
      }
    };
    const interval = setInterval(checkTimeout, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [pollingStartTime]);

  // Fetch job status by ID or correlation ID
  const { data: jobByIdData, refetch: refetchById } = trpc.jobs.getStatus.useQuery(
    { jobId: jobId! },
    { 
      enabled: !!jobId,
      refetchInterval: (query) => {
        // Stop polling if timed out
        if (isPollingTimedOut) return false;
        const data = query.state.data;
        if (!data) return pollInterval;
        // Stop polling for terminal states
        if (["completed", "failed", "cancelled"].includes(data.status)) {
          return false;
        }
        return pollInterval;
      },
    }
  );

  const { data: jobByCorrelationData, refetch: refetchByCorrelation } = trpc.jobs.getByCorrelation.useQuery(
    { correlationId: correlationId! },
    { 
      enabled: !!correlationId && !jobId,
      refetchInterval: (query) => {
        // Stop polling if timed out
        if (isPollingTimedOut) return false;
        const data = query.state.data;
        if (!data) return pollInterval;
        if (["completed", "failed", "cancelled"].includes(data.status)) {
          return false;
        }
        return pollInterval;
      },
    }
  );

  const job = jobByIdData ?? jobByCorrelationData;

  // Retry mutation
  const retryMutation = trpc.jobs.retry.useMutation({
    onSuccess: (updatedJob) => {
      toast.success(`${updatedJob.displayName} has been queued for retry.`);
      // Refetch to get updated status
      if (jobId) refetchById();
      else if (correlationId) refetchByCorrelation();
    },
    onError: (error) => {
      toast.error(`Retry failed: ${error.message}`);
    },
  });

  // Cancel mutation
  const cancelMutation = trpc.jobs.cancel.useMutation({
    onSuccess: () => {
      toast.success("The job has been cancelled.");
      if (jobId) refetchById();
      else if (correlationId) refetchByCorrelation();
    },
    onError: (error) => {
      toast.error(`Cancel failed: ${error.message}`);
    },
  });

  // Handle status changes
  useEffect(() => {
    if (!job) return;
    
    if (prevStatus && prevStatus !== job.status) {
      if (job.status === "completed") {
        onComplete?.(job);
      } else if (job.status === "failed") {
        onFail?.(job);
      }
    }
    
    setPrevStatus(job.status);
  }, [job?.status, prevStatus, onComplete, onFail]);

  // Copy correlation ID to clipboard
  const copyCorrelationId = async () => {
    if (!job) return;
    await navigator.clipboard.writeText(job.correlationId);
    setCopiedCorrelationId(true);
    setTimeout(() => setCopiedCorrelationId(false), 2000);
  };

  if (!job) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading job status...</span>
      </div>
    );
  }

  // Show timeout message if polling exceeded max duration
  if (isPollingTimedOut && ["queued", "processing"].includes(job.status)) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">Taking Longer Than Expected</CardTitle>
          </div>
          <CardDescription>
            This job is taking longer than usual. It may still complete, but you can refresh to check the latest status.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Reference ID:</span>
            <code className="bg-muted px-1 py-0.5 rounded">{job.correlationId}</code>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsPollingTimedOut(false);
                if (jobId) refetchById();
                else if (correlationId) refetchByCorrelation();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `/admin/jobs?id=${job.id}`}
            >
              View Job Details
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status icon and color
  const getStatusIcon = () => {
    switch (job.status) {
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

  const getStatusBadgeVariant = () => {
    switch (job.status) {
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

  // Compact mode - inline display
  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {getStatusIcon()}
        <span className="text-sm">{job.displayStatus}</span>
        {job.status === "processing" && job.progress !== undefined && (
          <Progress value={job.progress} className="w-20 h-1.5" />
        )}
        {job.isRetryable && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => retryMutation.mutate({ jobId: job.id })}
            disabled={retryMutation.isPending}
          >
            <RefreshCw className={cn("h-3 w-3", retryMutation.isPending && "animate-spin")} />
          </Button>
        )}
      </div>
    );
  }

  // Full card display
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-base">{job.displayName}</CardTitle>
          </div>
          <Badge variant={getStatusBadgeVariant()}>
            {job.displayStatus}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>Started {new Date(job.createdAt).toLocaleString()}</span>
          {job.attempts > 1 && (
            <Badge variant="outline" className="text-xs">
              Attempt {job.attempts}/{job.maxAttempts}
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress bar for processing jobs */}
        {job.status === "processing" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{job.progressMessage || "Processing..."}</span>
                {job.progress !== undefined && (
                  <span className="font-medium">{job.progress}%</span>
                )}
              </div>
              <Progress value={job.progress ?? 0} className="h-2" />
            </div>
            {/* ETA calculation */}
            {job.progress !== undefined && job.progress > 0 && job.startedAt && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Elapsed: {formatDuration(Date.now() - new Date(job.startedAt).getTime())}</span>
                <span>ETA: {calculateETA(job.progress, new Date(job.startedAt).getTime())}</span>
              </div>
            )}
          </div>
        )}

        {/* Success result */}
        {job.status === "completed" && job.result && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm">
            <p className="font-medium text-green-700 dark:text-green-400">
              Completed successfully
            </p>
            {job.completedAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Finished at {new Date(job.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Error display */}
        {job.status === "failed" && (
          <div className="space-y-2">
            <div className="rounded-md bg-red-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {job.userFriendlyError || "An error occurred"}
                  </p>
                  {job.failedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Failed at {new Date(job.failedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Error details collapsible */}
            {showErrorDetails && job.error && (
              <Collapsible open={errorDetailsOpen} onOpenChange={setErrorDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs">View error details</span>
                    {errorDetailsOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-md bg-muted p-3 mt-2">
                    <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words">
                      {job.error}
                    </pre>
                    {job.errorDetails && (
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words mt-2 pt-2 border-t">
                        {JSON.stringify(job.errorDetails, null, 2)}
                      </pre>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Correlation ID for support */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Reference ID:</span>
              <code className="bg-muted px-1 py-0.5 rounded">{job.correlationId}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={copyCorrelationId}
              >
                {copiedCorrelationId ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {job.isRetryable && (
            <Button
              variant="default"
              size="sm"
              onClick={() => retryMutation.mutate({ jobId: job.id })}
              disabled={retryMutation.isPending}
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
          )}
          
          {["queued", "processing"].includes(job.status) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cancelMutation.mutate({ jobId: job.id })}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * JobStatusBadge - Minimal inline status indicator
 */
interface JobStatusBadgeProps {
  jobId?: number;
  correlationId?: string;
  className?: string;
}

export function JobStatusBadge({ jobId, correlationId, className }: JobStatusBadgeProps) {
  const [pollingStartTime] = useState(() => Date.now());
  const [isPollingTimedOut, setIsPollingTimedOut] = useState(false);

  // Check for polling timeout
  useEffect(() => {
    const checkTimeout = () => {
      if (Date.now() - pollingStartTime > MAX_POLLING_DURATION_MS) {
        setIsPollingTimedOut(true);
      }
    };
    const interval = setInterval(checkTimeout, 10000);
    return () => clearInterval(interval);
  }, [pollingStartTime]);

  const { data: jobByIdData } = trpc.jobs.getStatus.useQuery(
    { jobId: jobId! },
    { 
      enabled: !!jobId,
      refetchInterval: (query) => {
        if (isPollingTimedOut) return false;
        const data = query.state.data;
        if (!data || ["completed", "failed", "cancelled"].includes(data.status)) {
          return false;
        }
        return 2000;
      },
    }
  );

  const { data: jobByCorrelationData } = trpc.jobs.getByCorrelation.useQuery(
    { correlationId: correlationId! },
    { 
      enabled: !!correlationId && !jobId,
      refetchInterval: (query) => {
        if (isPollingTimedOut) return false;
        const data = query.state.data;
        if (!data || ["completed", "failed", "cancelled"].includes(data.status)) {
          return false;
        }
        return 2000;
      },
    }
  );

  const job = jobByIdData ?? jobByCorrelationData;

  if (!job) return null;

  const getStatusColor = () => {
    switch (job.status) {
      case "queued":
        return "bg-muted text-muted-foreground";
      case "processing":
        return "bg-blue-500/10 text-blue-500";
      case "completed":
        return "bg-green-500/10 text-green-500";
      case "failed":
        return "bg-red-500/10 text-red-500";
      case "cancelled":
        return "bg-gray-500/10 text-gray-500";
    }
  };

  const getStatusIcon = () => {
    switch (job.status) {
      case "queued":
        return <Clock className="h-3 w-3" />;
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3" />;
      case "failed":
        return <XCircle className="h-3 w-3" />;
      case "cancelled":
        return <Ban className="h-3 w-3" />;
    }
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      getStatusColor(),
      className
    )}>
      {getStatusIcon()}
      {job.displayStatus}
    </span>
  );
}

/**
 * JobStatusList - Display multiple jobs for an entity
 */
interface JobStatusListProps {
  entityType: string;
  entityId: number;
  className?: string;
}

export function JobStatusList({ entityType, entityId, className }: JobStatusListProps) {
  const { data: jobs, isLoading } = trpc.jobs.getByEntity.useQuery(
    { entityType, entityId },
    { refetchInterval: 5000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading jobs...</span>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {jobs.map((job) => (
        <JobStatus key={job.id} jobId={job.id} compact />
      ))}
    </div>
  );
}

export default JobStatus;
