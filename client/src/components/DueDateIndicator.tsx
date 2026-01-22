import { cn, formatDate, getDueDateStatus, getRelativeTime, type DueDateStatus } from "@/lib/utils";
import { AlertTriangle, Clock, CalendarX2, Calendar } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DueDateIndicatorProps {
  date: Date | string | number | null | undefined;
  showRelativeTime?: boolean;
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<DueDateStatus, {
  icon: typeof Clock;
  colorClass: string;
  bgClass: string;
  label: string;
}> = {
  overdue: {
    icon: CalendarX2,
    colorClass: "text-[var(--color-error)]",
    bgClass: "bg-[var(--color-error-muted)]",
    label: "Overdue",
  },
  approaching: {
    icon: AlertTriangle,
    colorClass: "text-[var(--color-warning)]",
    bgClass: "bg-[var(--color-warning-muted)]",
    label: "Due soon",
  },
  normal: {
    icon: Calendar,
    colorClass: "text-[var(--color-text-secondary)]",
    bgClass: "",
    label: "On track",
  },
  none: {
    icon: Clock,
    colorClass: "text-[var(--color-text-tertiary)]",
    bgClass: "",
    label: "No due date",
  },
};

export function DueDateIndicator({
  date,
  showRelativeTime = true,
  showIcon = true,
  className,
}: DueDateIndicatorProps) {
  const status = getDueDateStatus(date);
  const config = statusConfig[status];
  const Icon = config.icon;
  const formattedDate = formatDate(date);
  const relativeTime = getRelativeTime(date);

  if (status === "none") {
    return (
      <span className={cn("text-sm text-[var(--color-text-tertiary)]", className)}>
        Not set
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-sm",
            config.colorClass,
            status !== "normal" && "font-medium",
            className
          )}
        >
          {showIcon && <Icon className="w-4 h-4" />}
          <span>{formattedDate}</span>
          {showRelativeTime && relativeTime && status !== "normal" && (
            <span className="text-xs opacity-80">({relativeTime})</span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
        {relativeTime && <p className="text-xs text-muted-foreground">{relativeTime}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// Badge variant for more prominent display
interface DueDateBadgeProps {
  date: Date | string | number | null | undefined;
  className?: string;
}

export function DueDateBadge({ date, className }: DueDateBadgeProps) {
  const status = getDueDateStatus(date);
  const config = statusConfig[status];
  const Icon = config.icon;
  const formattedDate = formatDate(date);
  const relativeTime = getRelativeTime(date);

  if (status === "none") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
        "bg-[var(--color-bg-surface)] text-[var(--color-text-tertiary)]",
        className
      )}>
        <Clock className="w-3 h-3" />
        No due date
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
            config.bgClass || "bg-[var(--color-bg-surface)]",
            config.colorClass,
            className
          )}
        >
          <Icon className="w-3 h-3" />
          {formattedDate}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
        {relativeTime && <p className="text-xs text-muted-foreground">{relativeTime}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// Compact dot indicator for tables
interface DueDateDotProps {
  date: Date | string | number | null | undefined;
  className?: string;
}

export function DueDateDot({ date, className }: DueDateDotProps) {
  const status = getDueDateStatus(date);
  
  if (status === "none" || status === "normal") {
    return null;
  }

  const config = statusConfig[status];
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            status === "overdue" ? "bg-[var(--color-error)]" : "bg-[var(--color-warning)]",
            className
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
        <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
