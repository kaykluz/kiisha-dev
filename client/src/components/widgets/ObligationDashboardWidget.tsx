/**
 * Phase 37: Obligation Dashboard Widget
 * 
 * Compact widget for dashboard showing:
 * - Upcoming obligations count by urgency
 * - Next 5 due obligations
 * - Quick links to obligation management
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  FileText,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { formatDistanceToNow, format, isPast, isToday, addDays, isBefore } from "date-fns";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface ObligationDashboardWidgetProps {
  organizationId: number;
  projectId?: number;
  assetId?: number;
  maxItems?: number;
  className?: string;
}

type UrgencyLevel = "overdue" | "critical" | "upcoming" | "future";

function getUrgencyLevel(dueDate: Date): UrgencyLevel {
  const now = new Date();
  if (isPast(dueDate) && !isToday(dueDate)) return "overdue";
  if (isToday(dueDate) || isBefore(dueDate, addDays(now, 3))) return "critical";
  if (isBefore(dueDate, addDays(now, 14))) return "upcoming";
  return "future";
}

function getUrgencyStyles(urgency: UrgencyLevel) {
  switch (urgency) {
    case "overdue":
      return {
        badge: "bg-destructive/20 text-destructive border-destructive/30",
        icon: AlertTriangle,
        iconColor: "text-destructive",
        label: "Overdue",
      };
    case "critical":
      return {
        badge: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
        icon: AlertCircle,
        iconColor: "text-orange-500",
        label: "Due Soon",
      };
    case "upcoming":
      return {
        badge: "bg-warning/20 text-warning border-warning/30",
        icon: Clock,
        iconColor: "text-warning",
        label: "Upcoming",
      };
    case "future":
      return {
        badge: "bg-muted text-muted-foreground border-border",
        icon: Calendar,
        iconColor: "text-muted-foreground",
        label: "Scheduled",
      };
  }
}

export function ObligationDashboardWidget({
  organizationId,
  projectId,
  assetId,
  maxItems = 5,
  className,
}: ObligationDashboardWidgetProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Fetch upcoming obligations
  const { data: obligations, isLoading } = trpc.obligations.listUpcoming.useQuery(
    {
      organizationId,
      projectId,
      assetId,
      limit: maxItems + 10, // Fetch extra for counting
    },
    { enabled: !!organizationId }
  );

  // Calculate urgency counts
  const urgencyCounts = {
    overdue: 0,
    critical: 0,
    upcoming: 0,
    future: 0,
  };

  const displayObligations = (obligations || []).slice(0, maxItems);
  
  (obligations || []).forEach((ob) => {
    if (ob.dueDate) {
      const urgency = getUrgencyLevel(new Date(ob.dueDate));
      urgencyCounts[urgency]++;
    }
  });

  const totalPending = urgencyCounts.overdue + urgencyCounts.critical + urgencyCounts.upcoming + urgencyCounts.future;
  const completionRate = totalPending > 0 
    ? Math.round(((obligations?.length || 0) - totalPending) / (obligations?.length || 1) * 100)
    : 100;

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Obligations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            Obligations
          </CardTitle>
          <Link href="/obligations">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Urgency Summary */}
        <div className="grid grid-cols-4 gap-2">
          {(["overdue", "critical", "upcoming", "future"] as UrgencyLevel[]).map((urgency) => {
            const styles = getUrgencyStyles(urgency);
            const Icon = styles.icon;
            const count = urgencyCounts[urgency];
            
            return (
              <div
                key={urgency}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border",
                  styles.badge
                )}
              >
                <Icon className={cn("h-4 w-4 mb-1", styles.iconColor)} />
                <span className="text-lg font-semibold">{count}</span>
                <span className="text-[10px] opacity-80">{styles.label}</span>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        {totalPending > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Completion Rate</span>
              <span>{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-1.5" />
          </div>
        )}

        {/* Obligation List */}
        {displayObligations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs">No pending obligations</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayObligations.map((obligation) => {
              const dueDate = obligation.dueDate ? new Date(obligation.dueDate) : null;
              const urgency = dueDate ? getUrgencyLevel(dueDate) : "future";
              const styles = getUrgencyStyles(urgency);
              const Icon = styles.icon;
              const isHovered = hoveredId === obligation.id;

              return (
                <Link
                  key={obligation.id}
                  href={`/obligations/${obligation.id}`}
                >
                  <div
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      "hover:border-accent/50 hover:bg-accent/5",
                      isHovered && "border-accent/50 bg-accent/5"
                    )}
                    onMouseEnter={() => setHoveredId(obligation.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", styles.iconColor)} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {obligation.title}
                          </p>
                          {obligation.assetName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {obligation.assetName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {dueDate && (
                          <Badge variant="outline" className={cn("text-[10px]", styles.badge)}>
                            {urgency === "overdue" 
                              ? `${formatDistanceToNow(dueDate)} overdue`
                              : isToday(dueDate)
                                ? "Today"
                                : format(dueDate, "MMM d")
                            }
                          </Badge>
                        )}
                        <ChevronRight className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isHovered && "translate-x-0.5"
                        )} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* View More Link */}
        {(obligations?.length || 0) > maxItems && (
          <Link href="/obligations">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              View {(obligations?.length || 0) - maxItems} more obligations
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact version for sidebar or narrow spaces
 */
export function ObligationMiniWidget({
  organizationId,
  className,
}: {
  organizationId: number;
  className?: string;
}) {
  const { data: obligations } = trpc.obligations.listUpcoming.useQuery(
    { organizationId, limit: 20 },
    { enabled: !!organizationId }
  );

  const overdueCount = (obligations || []).filter(
    (ob) => ob.dueDate && isPast(new Date(ob.dueDate)) && !isToday(new Date(ob.dueDate))
  ).length;

  const criticalCount = (obligations || []).filter((ob) => {
    if (!ob.dueDate) return false;
    const dueDate = new Date(ob.dueDate);
    return isToday(dueDate) || (isBefore(dueDate, addDays(new Date(), 3)) && !isPast(dueDate));
  }).length;

  const hasUrgent = overdueCount > 0 || criticalCount > 0;

  return (
    <Link href="/obligations">
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg transition-colors cursor-pointer",
          hasUrgent 
            ? "bg-destructive/10 hover:bg-destructive/20" 
            : "bg-muted/50 hover:bg-muted",
          className
        )}
      >
        <FileText className={cn(
          "h-4 w-4",
          hasUrgent ? "text-destructive" : "text-muted-foreground"
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Obligations</p>
          {hasUrgent ? (
            <p className="text-[10px] text-destructive">
              {overdueCount > 0 && `${overdueCount} overdue`}
              {overdueCount > 0 && criticalCount > 0 && ", "}
              {criticalCount > 0 && `${criticalCount} due soon`}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              {obligations?.length || 0} pending
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
