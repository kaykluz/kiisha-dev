import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitBranch,
  Table2,
  GanttChart,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Filter,
  Download,
  Plus,
  Zap,
  Sun,
  Battery,
  Wind,
  Building2,
  Calendar,
  Target,
} from "lucide-react";

const PIPELINE_STAGES = [
  { key: "origination", label: "Origination", color: "#6B7280" },
  { key: "feasibility", label: "Feasibility", color: "#8B5CF6" },
  { key: "development", label: "Development", color: "#3B82F6" },
  { key: "due_diligence", label: "Due Diligence", color: "#F59E0B" },
  { key: "ntp", label: "NTP", color: "#10B981" },
  { key: "construction", label: "Construction", color: "#EF4444" },
  { key: "commissioning", label: "Commissioning", color: "#F97316" },
  { key: "cod", label: "COD", color: "#06B6D4" },
  { key: "operations", label: "Operations", color: "#22C55E" },
];

const techIcons: Record<string, typeof Sun> = {
  PV: Sun,
  BESS: Battery,
  "PV+BESS": Zap,
  Wind: Wind,
  Minigrid: Zap,
  "C&I": Building2,
};

function PipelineManagementContent() {
  const { state: authState } = useAuth();
  const orgId = authState?.activeOrganization?.id ?? 1;
  const [viewMode, setViewMode] = useState<"spreadsheet" | "timeline">("spreadsheet");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: portfolioList } = trpc.portfolioViews.list.useQuery();
  const { data: allProjects } = trpc.projects.list.useQuery();

  const projects = useMemo(() => {
    let list = allProjects ?? [];
    if (stageFilter !== "all") {
      list = list.filter((p: any) => p.stage === stageFilter);
    }
    return list;
  }, [allProjects, stageFilter]);

  // Group projects by stage for summary
  const stageGroups = useMemo(() => {
    return PIPELINE_STAGES.map(stage => ({
      ...stage,
      projects: projects.filter((p: any) => p.stage === stage.key),
      totalMw: projects.filter((p: any) => p.stage === stage.key).reduce((sum: number, p: any) => sum + (parseFloat(p.capacityMw) || 0), 0),
    }));
  }, [projects]);

  const stageIndex = (stage: string) => PIPELINE_STAGES.findIndex(s => s.key === stage);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Pipeline Management</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Track project milestones and pipeline progression</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-[var(--color-border-primary)] overflow-hidden">
                <button
                  onClick={() => setViewMode("spreadsheet")}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${viewMode === "spreadsheet" ? "bg-[var(--color-brand-primary)] text-white" : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"}`}
                >
                  <Table2 className="w-3.5 h-3.5" /> Spreadsheet
                </button>
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 ${viewMode === "timeline" ? "bg-[var(--color-brand-primary)] text-white" : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"}`}
                >
                  <GanttChart className="w-3.5 h-3.5" /> Timeline
                </button>
              </div>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
            </div>
          </div>

          {/* Stage summary bar */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto">
            <button
              onClick={() => setStageFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${stageFilter === "all" ? "bg-[var(--color-brand-primary)] text-white" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80"}`}
            >
              All ({projects.length})
            </button>
            {stageGroups.map(sg => (
              <button
                key={sg.key}
                onClick={() => setStageFilter(sg.key === stageFilter ? "all" : sg.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${sg.key === stageFilter ? "bg-[var(--color-brand-primary)] text-white" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80"}`}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sg.color }} />
                {sg.label} ({sg.projects.length})
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* MW Summary */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
            {stageGroups.filter(sg => sg.projects.length > 0).map(sg => (
              <div key={sg.key} className="p-3 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sg.color }} />
                  <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider">{sg.label}</span>
                </div>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{sg.totalMw.toFixed(1)} MW</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{sg.projects.length} projects</p>
              </div>
            ))}
          </div>

          {viewMode === "spreadsheet" ? (
            /* Spreadsheet View */
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-bg-secondary)]">
                      <th className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)] min-w-[200px]">Project</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Tech</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">MW</th>
                      <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Location</th>
                      {PIPELINE_STAGES.map(s => (
                        <th key={s.key} className="text-center px-2 py-3 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-primary)] min-w-[80px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-[10px]">{s.label}</span>
                          </div>
                        </th>
                      ))}
                      <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">COD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project: any) => {
                      const Icon = techIcons[project.technology] || Zap;
                      const currentStageIdx = stageIndex(project.stage || "feasibility");
                      return (
                        <tr key={project.id} className="hover:bg-[var(--color-bg-secondary)]/50">
                          <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] px-4 py-3 border-b border-[var(--color-border-primary)]">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">{project.name}</span>
                          </td>
                          <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                            <div className="flex items-center gap-1.5">
                              <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                              <span className="text-xs">{project.technology}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-sm">{project.capacityMw || "-"}</td>
                          <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-xs text-[var(--color-text-secondary)]">{project.state || project.country || "-"}</td>
                          {PIPELINE_STAGES.map((s, idx) => (
                            <td key={s.key} className="text-center px-2 py-3 border-b border-[var(--color-border-primary)]">
                              {idx < currentStageIdx ? (
                                <CheckCircle2 className="w-4 h-4 text-[var(--color-semantic-success)] mx-auto" />
                              ) : idx === currentStageIdx ? (
                                <div className="w-4 h-4 rounded-full mx-auto animate-pulse" style={{ backgroundColor: s.color }} />
                              ) : (
                                <Circle className="w-4 h-4 text-[var(--color-text-tertiary)]/30 mx-auto" />
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-xs text-[var(--color-text-secondary)]">{project.codDate ? (project.codDate instanceof Date ? project.codDate.toLocaleDateString() : String(project.codDate)) : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          ) : (
            /* Timeline / Gantt View */
            <div className="space-y-1">
              {/* Stage header */}
              <div className="flex items-center">
                <div className="w-[200px] shrink-0" />
                <div className="flex-1 flex">
                  {PIPELINE_STAGES.map(s => (
                    <div key={s.key} className="flex-1 text-center px-1">
                      <div className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Project rows */}
              {projects.map((project: any) => {
                const Icon = techIcons[project.technology] || Zap;
                const currentStageIdx = stageIndex(project.stage || "feasibility");
                const progressPct = ((currentStageIdx + 1) / PIPELINE_STAGES.length) * 100;
                const stageColor = PIPELINE_STAGES[currentStageIdx]?.color || "#6B7280";

                return (
                  <div key={project.id} className="flex items-center py-2 hover:bg-[var(--color-bg-secondary)]/50 rounded">
                    <div className="w-[200px] shrink-0 px-3 flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{project.name}</span>
                    </div>
                    <div className="flex-1 px-2">
                      <div className="relative h-6 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{ width: `${progressPct}%`, backgroundColor: stageColor, opacity: 0.7 }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-medium text-[var(--color-text-primary)]">
                            {PIPELINE_STAGES[currentStageIdx]?.label}
                          </span>
                        </div>
                        {/* Stage markers */}
                        {PIPELINE_STAGES.map((s, idx) => (
                          <div
                            key={s.key}
                            className="absolute top-0 bottom-0 w-px bg-[var(--color-border-primary)]"
                            style={{ left: `${((idx + 1) / PIPELINE_STAGES.length) * 100}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {projects.length === 0 && (
                <div className="text-center py-12 text-[var(--color-text-secondary)]">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
                  <p>No projects in pipeline</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function PipelineManagement() {
  return <PipelineManagementContent />;
}
