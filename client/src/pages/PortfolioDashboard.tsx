import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Circle,
  AlertCircle,
  FileText,
  TrendingUp,
  Zap,
  MapPin,
  Clock,
  ChevronRight,
  Sun,
  Battery,
  Wind,
  Users,
  Shield,
  Calendar,
  DollarSign,
  Target,
} from "lucide-react";

const techIcons: Record<string, typeof Sun> = {
  PV: Sun,
  BESS: Battery,
  "PV+BESS": Zap,
  Wind: Wind,
  Minigrid: Zap,
  "C&I": Building2,
};

function ProgressBar({ value, max, color = "var(--color-brand-primary)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium text-[var(--color-text-secondary)] min-w-[36px] text-right">{pct}%</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, subtitle }: { label: string; value: string | number; icon: typeof Sun; color: string; subtitle?: string }) {
  return (
    <div className="p-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{value}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function PortfolioDashboardContent() {
  const { state: authState } = useAuth();
  const orgId = authState?.activeOrganization?.id ?? 1;
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");

  const { data: portfolioList } = trpc.portfolioViews.list.useQuery();
  const { data: allProjects } = trpc.projects.list.useQuery();
  const { data: diligenceProgress } = trpc.documents.getDiligenceProgress.useQuery(
    { portfolioId: selectedPortfolioId !== "all" ? parseInt(selectedPortfolioId) : undefined, organizationId: orgId },
    { enabled: true }
  );

  const projects = allProjects ?? [];
  const progress = diligenceProgress ?? { total: 0, verified: 0, pending: 0, missing: 0, byCategory: [] };

  // Compute portfolio stats
  const totalMW = projects.reduce((sum: number, p: any) => sum + (parseFloat(p.capacityMw) || 0), 0);
  const totalValue = projects.reduce((sum: number, p: any) => sum + (parseFloat(p.projectValueUsd) || 0), 0);
  const costPerWatt = totalMW > 0 ? (totalValue / (totalMW * 1_000_000)).toFixed(2) : "0.00";

  // Group by status
  const statusCounts = projects.reduce((acc: Record<string, number>, p: any) => {
    acc[p.status || "development"] = (acc[p.status || "development"] || 0) + 1;
    return acc;
  }, {});

  // Group by stage
  const stageCounts = projects.reduce((acc: Record<string, number>, p: any) => {
    acc[p.stage || "feasibility"] = (acc[p.stage || "feasibility"] || 0) + 1;
    return acc;
  }, {});

  // Group by technology
  const techCounts = projects.reduce((acc: Record<string, { count: number; mw: number }>, p: any) => {
    const tech = p.technology || "PV";
    if (!acc[tech]) acc[tech] = { count: 0, mw: 0 };
    acc[tech].count++;
    acc[tech].mw += parseFloat(p.capacityMw) || 0;
    return acc;
  }, {});

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Portfolio Dashboard</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Transaction summary, diligence progress, and portfolio analytics</p>
              </div>
            </div>
            <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Portfolios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Portfolios</SelectItem>
                {portfolioList?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Projects" value={projects.length} icon={Building2} color="bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]" />
            <StatCard label="Total Capacity" value={`${totalMW.toFixed(1)} MW`} icon={Zap} color="bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)]" />
            <StatCard label="Portfolio Value" value={`$${(totalValue / 1_000_000).toFixed(1)}M`} icon={DollarSign} color="bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)]" subtitle={`$${costPerWatt}/W`} />
            <StatCard label="Documents" value={progress.total} icon={FileText} color="bg-[var(--color-semantic-info)]/10 text-[var(--color-semantic-info)]" subtitle={`${progress.verified} verified`} />
          </div>

          {/* Diligence Progress */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Progress */}
            <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--color-brand-primary)]" />
                Due Diligence Progress
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--color-text-secondary)]">Overall Verification</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{progress.verified} / {progress.total}</span>
                  </div>
                  <ProgressBar value={progress.verified} max={progress.total} color="var(--color-semantic-success)" />
                </div>
                {/* By category */}
                <div className="space-y-3 mt-4">
                  {progress.byCategory?.map((cat: any) => (
                    <div key={cat.categoryId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--color-text-secondary)]">{cat.categoryName}</span>
                        <span className="text-[var(--color-text-tertiary)]">{cat.verified}/{cat.total}</span>
                      </div>
                      <ProgressBar value={cat.verified} max={cat.total} />
                    </div>
                  ))}
                  {(!progress.byCategory || progress.byCategory.length === 0) && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">No document categories to show</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline by Stage */}
            <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-brand-primary)]" />
                Pipeline by Stage
              </h3>
              <div className="space-y-3">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)]" />
                      <span className="text-sm text-[var(--color-text-primary)] capitalize">{stage.replace(/_/g, " ")}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
                {Object.keys(stageCounts).length === 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">No projects in pipeline</p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--color-border-primary)]">
                <h4 className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Technology Mix</h4>
                <div className="space-y-2">
                  {Object.entries(techCounts).map(([tech, { count, mw }]) => {
                    const Icon = techIcons[tech] || Zap;
                    return (
                      <div key={tech} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                          <span className="text-sm text-[var(--color-text-primary)]">{tech}</span>
                        </div>
                        <span className="text-xs text-[var(--color-text-secondary)]">{count} projects / {mw.toFixed(1)} MW</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Status Overview + Project List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status breakdown */}
            <div className="rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Project Status</h3>
              <div className="space-y-3">
                {[
                  { key: "operational", label: "Operational", color: "bg-[var(--color-semantic-success)]" },
                  { key: "construction", label: "Construction", color: "bg-[var(--color-semantic-warning)]" },
                  { key: "development", label: "Development", color: "bg-[var(--color-brand-primary)]" },
                  { key: "prospecting", label: "Prospecting", color: "bg-[var(--color-text-tertiary)]" },
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{statusCounts[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Projects */}
            <div className="lg:col-span-2 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Projects</h3>
                <Link href="/projects/new">
                  <Button size="sm" variant="outline">
                    New Project
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="space-y-2">
                {projects.slice(0, 8).map((project: any) => {
                  const Icon = techIcons[project.technology] || Zap;
                  return (
                    <div
                      key={project.id}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{project.name}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {[project.city, project.state, project.country].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {project.capacityMw && (
                          <span className="text-xs text-[var(--color-text-secondary)]">{project.capacityMw} MW</span>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {(project.stage || "").replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && (
                  <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">No projects yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PortfolioDashboard() {
  return <PortfolioDashboardContent />;
}
