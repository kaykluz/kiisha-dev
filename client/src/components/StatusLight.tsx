/**
 * StatusLight Component
 * 
 * A visual indicator component that shows the status of data items
 * with consistent styling across the application.
 * 
 * States:
 * - verified: Green - Data has been verified by a human
 * - ai_suggested: Amber/Yellow - AI has suggested this value, awaiting verification
 * - unverified: Gray - No verification status
 * - rejected: Red - Data has been rejected
 * - pending: Blue - Awaiting action
 * - archived: Muted - Item has been archived (soft deleted)
 * - superseded: Strikethrough - Replaced by newer version
 * - hidden_in_view: Dotted outline - Hidden in current view but exists
 */

import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  AlertCircle, 
  Circle, 
  XCircle, 
  Clock, 
  Archive, 
  ArrowRightLeft,
  EyeOff,
  Sparkles,
  HelpCircle
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type StatusType = 
  | "verified" 
  | "ai_suggested" 
  | "unverified" 
  | "rejected" 
  | "pending" 
  | "archived" 
  | "superseded" 
  | "hidden_in_view"
  | "missing"
  | "na";

interface StatusConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  verified: {
    icon: CheckCircle2,
    label: "Verified",
    description: "This data has been verified by a human reviewer",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
  },
  ai_suggested: {
    icon: Sparkles,
    label: "AI Suggested",
    description: "This value was extracted by AI and awaits human verification",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
  },
  unverified: {
    icon: HelpCircle,
    label: "Unverified",
    description: "This data has not been verified",
    colorClass: "text-gray-400",
    bgClass: "bg-gray-500/10",
    borderClass: "border-gray-500/30",
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    description: "This data has been rejected and should not be used",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    description: "This item is awaiting action or review",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
  },
  archived: {
    icon: Archive,
    label: "Archived",
    description: "This item has been archived and is no longer active",
    colorClass: "text-gray-500",
    bgClass: "bg-gray-500/10",
    borderClass: "border-gray-500/30 border-dashed",
  },
  superseded: {
    icon: ArrowRightLeft,
    label: "Superseded",
    description: "This item has been replaced by a newer version",
    colorClass: "text-gray-500 line-through",
    bgClass: "bg-gray-500/10",
    borderClass: "border-gray-500/30 border-dashed",
  },
  hidden_in_view: {
    icon: EyeOff,
    label: "Hidden in View",
    description: "This item exists but is hidden in the current view",
    colorClass: "text-gray-400",
    bgClass: "bg-transparent",
    borderClass: "border-gray-400/50 border-dotted",
  },
  missing: {
    icon: AlertCircle,
    label: "Missing",
    description: "This required item is missing",
    colorClass: "text-orange-500",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
  },
  na: {
    icon: Circle,
    label: "N/A",
    description: "Not applicable for this context",
    colorClass: "text-gray-400",
    bgClass: "bg-gray-500/5",
    borderClass: "border-gray-500/20",
  },
};

interface StatusLightProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function StatusLight({ 
  status, 
  size = "md", 
  showLabel = false,
  showTooltip = true,
  className 
}: StatusLightProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };
  
  const labelSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };
  
  const content = (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className={cn(sizeClasses[size], config.colorClass)} />
      {showLabel && (
        <span className={cn(labelSizeClasses[size], config.colorClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
  
  if (!showTooltip) {
    return content;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs gap-1",
    md: "px-2 py-1 text-sm gap-1.5",
    lg: "px-3 py-1.5 text-base gap-2",
  };
  
  const iconSizeClasses = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className={cn(
              "inline-flex items-center rounded-full border font-medium",
              sizeClasses[size],
              config.bgClass,
              config.borderClass,
              config.colorClass,
              className
            )}
          >
            <Icon className={iconSizeClasses[size]} />
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Utility function to determine status from various data shapes
export function deriveStatus(data: {
  visibilityState?: string;
  verificationStatus?: string;
  status?: string;
  aiSuggested?: boolean;
}): StatusType {
  // Check visibility state first (archived/superseded take precedence)
  if (data.visibilityState === "archived") return "archived";
  if (data.visibilityState === "superseded") return "superseded";
  
  // Check verification status
  if (data.verificationStatus === "verified") return "verified";
  if (data.verificationStatus === "rejected") return "rejected";
  
  // Check if AI suggested
  if (data.aiSuggested) return "ai_suggested";
  
  // Check general status
  if (data.status === "verified") return "verified";
  if (data.status === "pending") return "pending";
  if (data.status === "rejected") return "rejected";
  if (data.status === "missing") return "missing";
  if (data.status === "na") return "na";
  
  return "unverified";
}

// Export config for external use
export { STATUS_CONFIG };
