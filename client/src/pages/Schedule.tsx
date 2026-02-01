import { useState, useMemo } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Drawer, DrawerSection, DrawerField, DrawerFieldGrid } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock,
  Link2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: "var(--color-success-muted)", text: "var(--color-success)", label: "Completed" },
    in_progress: { bg: "var(--color-info-muted)", text: "var(--color-info)", label: "In Progress" },
    overdue: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "Overdue" },
    not_started: { bg: "var(--color-bg-surface)", text: "var(--color-text-secondary)", label: "Not Started" },
    blocked: { bg: "var(--color-error-muted)", text: "var(--color-error)", label: "Blocked" },
  };
  const { bg, text, label } = config[status] || config.not_started;
  
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  );
}

// Schedule item detail panel
interface SchedulePanelProps {
  item: any;
  project: any;
  phase: any;
  onClose: () => void;
}

function SchedulePanel({ item, project, phase, onClose }: SchedulePanelProps) {
  const startDate = item.startDate ? new Date(item.startDate) : null;
  const endDate = item.endDate ? new Date(item.endDate) : null;
  const duration = startDate && endDate 
    ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={item.name}
      subtitle={`${phase?.name || 'Unknown Phase'} Phase • ${project?.name || 'Unknown Project'}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1">Edit</Button>
          <Button className="flex-1">Mark Complete</Button>
        </div>
      }
    >
      {/* Status */}
      <DrawerSection title="Status">
        <StatusBadge status={item.status} />
      </DrawerSection>

      {/* Details */}
      <DrawerSection title="Schedule Details">
        <DrawerFieldGrid>
          <DrawerField 
            label="Start Date" 
            value={startDate ? startDate.toLocaleDateString() : "Not set"} 
          />
          <DrawerField 
            label="End Date" 
            value={endDate ? endDate.toLocaleDateString() : "Not set"} 
          />
          <DrawerField 
            label="Duration" 
            value={duration > 0 ? `${duration} days` : "-"} 
          />
          <DrawerField 
            label="Target End" 
            value={
              <div className="flex items-center gap-2">
                <span>{item.targetEndDate ? new Date(item.targetEndDate).toLocaleDateString() : "-"}</span>
                {item.status === "overdue" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-error-muted)] text-[var(--color-error)]">
                    Overdue
                  </span>
                )}
              </div>
            } 
          />
        </DrawerFieldGrid>
      </DrawerSection>

      {/* Progress */}
      <DrawerSection title="Progress">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">Completion</span>
            <span className="font-medium text-[var(--color-text-primary)]">{item.progress || 0}%</span>
          </div>
          <div className="h-2 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                item.status === "overdue" 
                  ? "bg-[var(--color-error)]" 
                  : item.status === "completed"
                  ? "bg-[var(--color-success)]"
                  : "bg-[var(--color-brand)]"
              )}
              style={{ width: `${item.progress || 0}%` }}
            />
          </div>
        </div>
      </DrawerSection>

      {/* Dependencies */}
      <DrawerSection title="Dependencies">
        <p className="text-sm text-[var(--color-text-tertiary)]">No dependencies</p>
      </DrawerSection>
    </Drawer>
  );
}

function ScheduleContent() {
  const { selectedProjectId } = useProject();
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(
    new Set([1, 2, 3, 4, 5])
  );
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  // Fetch real data from API
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();
  const { data: schedulePhases = [], isLoading: phasesLoading } = trpc.schedule.getPhases.useQuery();
  const { data: scheduleItems = [], isLoading: itemsLoading } = trpc.schedule.listByProject.useQuery(
    { projectId: selectedProjectId || 0 },
    { enabled: !!selectedProjectId }
  );

  const isLoading = projectsLoading || phasesLoading || (selectedProjectId && itemsLoading);

  // If no project selected, get all schedule items (for superusers/admins)
  const allScheduleItems = selectedProjectId ? scheduleItems : [];

  const filteredItems = selectedProjectId
    ? (allScheduleItems as any[]).filter((s: any) => s.projectId === selectedProjectId)
    : (allScheduleItems as any[]);

  const itemsByPhase = (schedulePhases as any[]).map((phase: any) => ({
    ...phase,
    items: filteredItems.filter((item: any) => item.phaseId === phase.id),
  }));

  const timelineData = useMemo(() => {
    const allDates = filteredItems.flatMap((item: any) => [
      item.startDate ? new Date(item.startDate) : null,
      item.endDate ? new Date(item.endDate) : null,
    ]).filter(Boolean) as Date[];
    
    if (allDates.length === 0) {
      // Default to current month if no items
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      
      const weeks: { start: Date; label: string }[] = [];
      const current = new Date(start);
      current.setDate(current.getDate() - current.getDay());
      
      while (current <= end) {
        weeks.push({
          start: new Date(current),
          label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        });
        current.setDate(current.getDate() + 7);
      }
      
      return { startDate: start, endDate: end, weeks };
    }

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);
    
    const weeks: { start: Date; label: string }[] = [];
    const current = new Date(minDate);
    current.setDate(current.getDate() - current.getDay());
    
    while (current <= maxDate) {
      weeks.push({
        start: new Date(current),
        label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
      current.setDate(current.getDate() + 7);
    }
    
    return { startDate: minDate, endDate: maxDate, weeks };
  }, [filteredItems]);

  const getBarStyle = (item: any) => {
    const start = item.startDate ? new Date(item.startDate) : new Date();
    const end = item.endDate ? new Date(item.endDate) : new Date();
    const totalDays = (timelineData.endDate.getTime() - timelineData.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const startOffset = (start.getTime() - timelineData.startDate.getTime()) / (1000 * 60 * 60 * 24);
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    
    return {
      left: `${Math.max(0, (startOffset / totalDays) * 100)}%`,
      width: `${Math.max(2, (duration / totalDays) * 100)}%`,
    };
  };

  const togglePhase = (phaseId: number) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case "completed": return "var(--color-success)";
      case "overdue": return "var(--color-error)";
      case "blocked": return "var(--color-error)";
      default: return "var(--color-brand)";
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no project selected
  if (!selectedProjectId) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Schedule</h1>
            <p className="page-subtitle">Gantt-style timeline view of project milestones and dependencies</p>
          </div>
        </div>
        <EmptyState
          type="projects"
          title="Select a project"
          description="Choose a project from the sidebar to view its schedule"
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Schedule</h1>
          <p className="page-subtitle">Gantt-style timeline view of project milestones and dependencies</p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Empty state when no schedule items */}
      {filteredItems.length === 0 ? (
        <EmptyState
          type="tasks"
          title="No schedule items"
          description="Add schedule items to track project milestones and timelines"
          actionLabel="Add Item"
          onAction={() => {}}
        />
      ) : (
        <>
          {/* Gantt Chart */}
          <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
            <div className="flex">
              {/* Left Panel - Schedule Items */}
              <div className="w-80 shrink-0 border-r border-[var(--color-border-subtle)]">
                <div className="h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex items-center px-4">
                  <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    Schedule Items
                  </span>
                </div>
                <ScrollArea className="h-[500px]">
                  {itemsByPhase
                    .filter((phase: any) => phase.items.length > 0)
                    .map((phase: any) => (
                      <Collapsible
                        key={phase.id}
                        open={expandedPhases.has(phase.id)}
                        onOpenChange={() => togglePhase(phase.id)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                            <div className="flex items-center gap-2">
                              {expandedPhases.has(phase.id) ? (
                                <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                              )}
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">{phase.name}</span>
                            </div>
                            <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-base)] px-2 py-0.5 rounded">
                              {phase.items.length}
                            </span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          {phase.items.map((item: any) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center gap-2 p-3 pl-10 border-b border-[var(--color-border-subtle)] cursor-pointer transition-colors",
                                selectedItem?.id === item.id 
                                  ? "bg-[var(--color-brand-muted)]" 
                                  : "hover:bg-[var(--color-bg-surface-hover)]"
                              )}
                              onClick={() => setSelectedItem(item)}
                            >
                              {(item.status === "overdue" || item.status === "blocked") && (
                                <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)] shrink-0" />
                              )}
                              <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">{item.name}</span>
                            </div>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                </ScrollArea>
              </div>

              {/* Right Panel - Timeline */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="w-full">
                  <div className="min-w-[800px]">
                    {/* Timeline Header */}
                    <div className="h-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex">
                      {timelineData.weeks.map((week, idx) => (
                        <div
                          key={idx}
                          className="flex-1 min-w-[100px] border-r border-[var(--color-border-subtle)] px-2 flex items-center"
                        >
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">{week.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Timeline Rows */}
                    <div className="h-[500px] relative">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {timelineData.weeks.map((_, idx) => (
                          <div
                            key={idx}
                            className="flex-1 min-w-[100px] border-r border-[var(--color-border-subtle)] opacity-50"
                          />
                        ))}
                      </div>

                      {/* Bars */}
                      <ScrollArea className="h-full">
                        {itemsByPhase
                          .filter((phase: any) => phase.items.length > 0)
                          .map((phase: any) => (
                            <div key={phase.id}>
                              {/* Phase header row */}
                              <div
                                className={cn(
                                  "h-[49px] border-b border-[var(--color-border-subtle)]",
                                  !expandedPhases.has(phase.id) && "hidden"
                                )}
                              />
                              {/* Item rows */}
                              {expandedPhases.has(phase.id) &&
                                phase.items.map((item: any) => (
                                  <div
                                    key={item.id}
                                    className="h-[49px] border-b border-[var(--color-border-subtle)] relative px-1 flex items-center"
                                  >
                                    <div
                                      className="absolute h-6 rounded cursor-pointer hover:opacity-80 transition-all shadow-sm"
                                      style={{
                                        ...getBarStyle(item),
                                        backgroundColor: getBarColor(item.status),
                                      }}
                                      onClick={() => setSelectedItem(item)}
                                    >
                                      <div className="absolute inset-0 flex items-center px-2">
                                        <span className="text-[10px] text-white font-medium truncate">
                                          {item.progress || 0}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ))}
                      </ScrollArea>
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-8 mt-4 text-xs text-[var(--color-text-tertiary)]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "var(--color-brand)" }} />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "var(--color-success)" }} />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded" style={{ backgroundColor: "var(--color-error)" }} />
              <span>Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)]" />
              <span>Past Target Date</span>
            </div>
          </div>
        </>
      )}

      {/* Detail Panel */}
      {selectedItem && (
        <SchedulePanel 
          item={selectedItem} 
          project={projects.find((p: any) => p.id === selectedItem.projectId)}
          phase={(schedulePhases as any[]).find((p: any) => p.id === selectedItem.phaseId)}
          onClose={() => setSelectedItem(null)} 
        />
      )}
    </div>
  );
}

export default function Schedule() {
  return (
    <AppLayout>
      <ScheduleContent />
    </AppLayout>
  );
}
