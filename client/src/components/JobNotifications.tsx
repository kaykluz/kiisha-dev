import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Clock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { JOB_TYPE_LABELS } from "@shared/jobTypes";

interface JobNotification {
  id: number;
  type: string;
  status: string;
  displayName: string;
  displayStatus: string;
  correlationId: string;
  isRetryable: boolean;
  userFriendlyError?: string;
}

/**
 * JobNotifications component
 * 
 * Monitors user's jobs and shows toast notifications when jobs complete or fail.
 * This provides real-time feedback for background processing without requiring
 * users to stay on a specific page.
 */
export function JobNotifications() {
  const [, setLocation] = useLocation();
  const previousJobsRef = useRef<Map<number, string>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  // Poll for user's active jobs
  const { data: jobs } = trpc.jobs.getUserJobs.useQuery(
    { limit: 50 },
    { 
      refetchInterval: 3000, // Poll every 3 seconds
      enabled: true,
    }
  );

  // Retry mutation
  const retryMutation = trpc.jobs.retry.useMutation({
    onSuccess: (newJob) => {
      toast.success(`Retry initiated. New job ID: ${newJob.id}`);
    },
    onError: (error) => {
      toast.error(`Failed to retry: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!jobs) return;

    // On first load, just record the current state without showing notifications
    if (!isInitialized) {
      const initialMap = new Map<number, string>();
      jobs.forEach((job) => {
        initialMap.set(job.id, job.status);
      });
      previousJobsRef.current = initialMap;
      setIsInitialized(true);
      return;
    }

    // Check for status changes
    jobs.forEach((job) => {
      const previousStatus = previousJobsRef.current.get(job.id);
      
      // Only notify on status transitions
      if (previousStatus && previousStatus !== job.status) {
        const notification = createNotification(job as JobNotification);
        if (notification) {
          showNotification(notification, job as JobNotification, setLocation, retryMutation);
        }
      }
      
      // Update the previous status
      previousJobsRef.current.set(job.id, job.status);
    });
  }, [jobs, isInitialized, setLocation, retryMutation]);

  // This component doesn't render anything visible
  return null;
}

interface NotificationConfig {
  type: "success" | "error" | "info";
  title: string;
  description: string;
  duration: number;
  showRetry: boolean;
  showViewDetails: boolean;
}

function createNotification(job: JobNotification): NotificationConfig | null {
  const jobLabel = JOB_TYPE_LABELS[job.type] || job.displayName;
  
  switch (job.status) {
    case "completed":
      return {
        type: "success",
        title: `${jobLabel} Complete`,
        description: job.displayStatus,
        duration: 5000,
        showRetry: false,
        showViewDetails: true,
      };
    
    case "failed":
      return {
        type: "error",
        title: `${jobLabel} Failed`,
        description: job.userFriendlyError || "An error occurred during processing",
        duration: 10000,
        showRetry: job.isRetryable,
        showViewDetails: true,
      };
    
    case "processing":
      // Only show notification when transitioning from queued to processing
      return {
        type: "info",
        title: `${jobLabel} Started`,
        description: "Processing has begun...",
        duration: 3000,
        showRetry: false,
        showViewDetails: false,
      };
    
    case "cancelled":
      return {
        type: "info",
        title: `${jobLabel} Cancelled`,
        description: "The job was cancelled",
        duration: 3000,
        showRetry: false,
        showViewDetails: false,
      };
    
    default:
      return null;
  }
}

function showNotification(
  config: NotificationConfig,
  job: JobNotification,
  setLocation: (path: string) => void,
  retryMutation: { mutate: (params: { jobId: number }) => void; isPending: boolean }
) {
  const toastFn = config.type === "success" 
    ? toast.success 
    : config.type === "error" 
      ? toast.error 
      : toast.info;

  toastFn(config.title, {
    description: config.description,
    duration: config.duration,
    action: config.showViewDetails ? {
      label: "View Details",
      onClick: () => setLocation("/admin/jobs"),
    } : undefined,
  });

  // Show retry button for failed jobs
  if (config.showRetry && job.isRetryable) {
    setTimeout(() => {
      toast(
        <div className="flex items-center gap-2">
          <span>Would you like to retry this job?</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => retryMutation.mutate({ jobId: job.id })}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "Retry"
            )}
          </Button>
        </div>,
        { duration: 8000 }
      );
    }, 500);
  }
}

/**
 * JobNotificationBanner component
 * 
 * Shows a persistent banner when there are active jobs processing.
 * Can be placed at the top of the page to give users visibility into
 * ongoing background work.
 */
export function JobNotificationBanner() {
  const [, setLocation] = useLocation();
  
  const { data: jobs } = trpc.jobs.getUserJobs.useQuery(
    { status: "processing", limit: 10 },
    { refetchInterval: 3000 }
  );

  const activeJobs = jobs?.filter((j) => j.status === "processing") ?? [];
  const queuedJobs = jobs?.filter((j) => j.status === "queued") ?? [];

  if (activeJobs.length === 0 && queuedJobs.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2">
      <div className="container flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          <span className="text-sm">
            {activeJobs.length > 0 && (
              <span className="font-medium">
                {activeJobs.length} job{activeJobs.length > 1 ? "s" : ""} processing
              </span>
            )}
            {activeJobs.length > 0 && queuedJobs.length > 0 && " • "}
            {queuedJobs.length > 0 && (
              <span className="text-muted-foreground">
                {queuedJobs.length} queued
              </span>
            )}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-blue-500 hover:text-blue-600"
          onClick={() => setLocation("/admin/jobs")}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View Jobs
        </Button>
      </div>
    </div>
  );
}

/**
 * useJobNotification hook
 * 
 * Provides a simple way to track a specific job and get notified when it completes.
 * Useful for components that initiate jobs and want to show completion status.
 */
export function useJobNotification(jobId: number | null) {
  const [status, setStatus] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: job } = trpc.jobs.getStatus.useQuery(
    { jobId: jobId! },
    {
      enabled: !!jobId && !isComplete,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        if (["completed", "failed", "cancelled"].includes(data.status)) {
          return false; // Stop polling
        }
        return 2000;
      },
    }
  );

  useEffect(() => {
    if (!job) return;

    setStatus(job.status);

    if (job.status === "completed") {
      setIsComplete(true);
      toast.success(job.displayName + " completed successfully");
    } else if (job.status === "failed") {
      setIsComplete(true);
      setError(job.userFriendlyError || job.error || "Job failed");
      toast.error(job.displayName + " failed", {
        description: job.userFriendlyError || "An error occurred",
      });
    } else if (job.status === "cancelled") {
      setIsComplete(true);
    }
  }, [job]);

  return {
    status,
    isComplete,
    error,
    progress: job?.progress,
    progressMessage: job?.progressMessage,
    job,
  };
}

/**
 * JobStatusToast component
 * 
 * A toast-style component that can be rendered inline to show job status.
 * Useful for showing status next to the action that triggered the job.
 */
export function JobStatusToast({ 
  jobId, 
  onComplete,
  onError,
}: { 
  jobId: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}) {
  const { status, isComplete, error, progress, progressMessage, job } = useJobNotification(jobId);

  useEffect(() => {
    if (isComplete && status === "completed" && onComplete) {
      onComplete();
    }
    if (isComplete && status === "failed" && error && onError) {
      onError(error);
    }
  }, [isComplete, status, error, onComplete, onError]);

  if (!job) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  const getIcon = () => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <span className="font-medium">{job.displayStatus}</span>
        {progressMessage && (
          <span className="text-muted-foreground ml-1">- {progressMessage}</span>
        )}
        {progress !== undefined && status === "processing" && (
          <span className="text-muted-foreground ml-1">({progress}%)</span>
        )}
      </div>
    </div>
  );
}
