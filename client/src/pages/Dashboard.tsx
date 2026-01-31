import AppLayout, { useProject } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { cn } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Link } from "wouter";
import {
  Building2,
  Zap,
  AlertTriangle,
  FileText,
  ChevronRight,
  Clock,
  ArrowUpRight,
  Sun,
  Battery,
  Wind,
  TrendingUp,
  Filter,
  X,
  MapPin,
  Users,
  ExternalLink,
  Settings,
} from "lucide-react";
import { ProjectAssetsMap } from "@/components/ProjectAssetsMap";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  mockProjects,
  mockPortfolio,
  mockAlerts,
  mockRfis,
  mockDiligenceProgress,
  getPortfolioSummary,
} from "@shared/mockData";
import { EmptyState } from "@/components/EmptyState";
import { ProjectClassificationCharts, type ProjectClassificationFilters } from "@/components/ProjectClassificationCharts";

// Technology icons
const techIcons: Record<string, typeof Sun> = {
  PV: Sun,
  BESS: Battery,
  "PV+BESS": Zap,
  Wind: Wind,
};

// Filter options for the dashboard
const COUNTRY_OPTIONS = [
  { value: 'all', label: 'All Countries' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Tanzania', label: 'Tanzania' },
  { value: 'Senegal', label: 'Senegal' },
  { value: "Côte d'Ivoire", label: "Côte d'Ivoire" },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'operational', label: 'Operational' },
  { value: 'construction', label: 'Construction' },
  { value: 'development', label: 'Development' },
  { value: 'prospecting', label: 'Prospecting' },
];

const CLASSIFICATION_OPTIONS = [
  { value: 'all', label: 'All Classifications' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'large_commercial', label: 'Large Commercial' },
  { value: 'small_commercial', label: 'Small Commercial' },
  { value: 'mini_grid', label: 'Mini-Grid' },
  { value: 'grid_connected', label: 'Grid Connected' },
  { value: 'residential', label: 'Residential' },
];

const MAP_COLOR_OPTIONS = [
  { value: 'status', label: 'By Status' },
  { value: 'classification', label: 'By Classification' },
];

function DashboardContent() {
  const { selectedProjectId, setSelectedProjectId } = useProject();
  const { state } = useAuth();
  const orgId = state?.activeOrganization?.id ?? 1;
  const summary = getPortfolioSummary();
  
  // Fetch customer stats for portal card
  const { data: customerStats } = trpc.customerPortal.getCustomerStats.useQuery(
    { orgId },
    { staleTime: 60000 } // Cache for 1 minute
  );
  
  // Filter state for map and charts
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [mapColorBy, setMapColorBy] = useState<'status' | 'classification'>('status');
  
  // Build filters object for API calls
  const filters = useMemo<ProjectClassificationFilters>(() => {
    const f: ProjectClassificationFilters = {};
    if (countryFilter !== 'all') f.country = countryFilter;
    if (statusFilter !== 'all') f.status = statusFilter;
    if (classificationFilter !== 'all') f.assetClassification = classificationFilter;
    return f;
  }, [countryFilter, statusFilter, classificationFilter]);
  
  // Check if any filters are active
  const hasActiveFilters = countryFilter !== 'all' || statusFilter !== 'all' || classificationFilter !== 'all';
  
  // Clear all filters
  const clearFilters = () => {
    setCountryFilter('all');
    setStatusFilter('all');
    setClassificationFilter('all');
  };

  // Filter data based on selected project
  const filteredProjects = selectedProjectId
    ? mockProjects.filter((p) => p.id === selectedProjectId)
    : mockProjects;

  const filteredAlerts = selectedProjectId
    ? mockAlerts.filter((a) => a.projectId === selectedProjectId)
    : mockAlerts;

  const filteredRfis = selectedProjectId
    ? mockRfis.filter((r) => r.projectId === selectedProjectId)
    : mockRfis;

  const filteredDiligence = selectedProjectId
    ? mockDiligenceProgress.filter((d) => d.projectId === selectedProjectId)
    : mockDiligenceProgress;

  // Calculate metrics
  const totalCapacityMw = filteredProjects.reduce((sum, p) => sum + (p.capacityMw || 0), 0);
  const totalCapacityMwh = filteredProjects.reduce((sum, p) => sum + (p.capacityMwh || 0), 0);
  const activeAlerts = filteredAlerts.filter((a) => !a.isRead).length;
  const openRfis = filteredRfis.filter((r) => r.status === "open" || r.status === "in_progress").length;

  // Aggregate diligence progress
  const overallDiligence = filteredDiligence.reduce(
    (acc, d) => ({ total: acc.total + d.totalItems, verified: acc.verified + d.verifiedItems }),
    { total: 0, verified: 0 }
  );
  const diligencePercent = overallDiligence.total > 0 
    ? Math.round((overallDiligence.verified / overallDiligence.total) * 100) 
    : 0;

  // Get attention items (high priority RFIs + critical alerts)
  const attentionItems = [
    ...filteredAlerts.filter(a => a.severity === 'critical' && !a.isRead).map(a => ({
      id: `alert-${a.id}`,
      type: 'alert' as const,
      title: a.title,
      project: mockProjects.find(p => p.id === a.projectId)?.name || 'Unknown',
      severity: a.severity,
      date: new Date().toISOString(),
    })),
    ...filteredRfis.filter(r => (r.priority === 'high' || r.priority === 'critical') && r.status !== 'resolved').map(r => ({
      id: `rfi-${r.id}`,
      type: 'rfi' as const,
      title: r.title,
      project: mockProjects.find(p => p.id === r.projectId)?.name || 'Unknown',
      severity: r.priority,
      date: r.dueDate,
    })),
  ].slice(0, 5);

  return (
    <div className="p-6 lg:p-8">
      {/* Page Header - O11-inspired welcome style */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-[var(--color-brand-primary)]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
              {selectedProjectId ? filteredProjects[0]?.name : `Welcome back`}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {selectedProjectId
                ? `${filteredProjects[0]?.technology} • ${filteredProjects[0]?.capacityMw} MW • ${filteredProjects[0]?.state}`
                : `Manage your renewable energy portfolio`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row - O11-inspired clean cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--color-bg-surface)] rounded-2xl p-5 border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-semantic-info)]/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[var(--color-semantic-info)]" />
            </div>
            <TrendingUp className="w-4 h-4 text-[var(--color-semantic-success)]" />
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text-primary)] tabular-nums">{filteredProjects.length}</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Total Sites</div>
        </div>

        <div className="bg-[var(--color-bg-surface)] rounded-2xl p-5 border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-brand-primary)]" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text-primary)] tabular-nums">
            {totalCapacityMw.toFixed(1)}
            <span className="text-lg font-normal text-[var(--color-text-tertiary)] ml-1">MW</span>
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Total Capacity</div>
        </div>

        <div className="bg-[var(--color-bg-surface)] rounded-2xl p-5 border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-semantic-success)]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[var(--color-semantic-success)]" />
            </div>
            <span className="text-xs font-medium text-[var(--color-semantic-success)] bg-[var(--color-semantic-success)]/10 px-2 py-1 rounded-full">{diligencePercent}%</span>
          </div>
          <div className="h-2 bg-[var(--color-bg-surface-hover)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-semantic-success)] to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${diligencePercent}%` }}
            />
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-3">Diligence Progress</div>
        </div>

        <div className="bg-[var(--color-bg-surface)] rounded-2xl p-5 border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-semantic-warning)]/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[var(--color-semantic-warning)]" />
            </div>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text-primary)] tabular-nums">{openRfis + activeAlerts}</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">
            {openRfis} RFIs • {activeAlerts} alerts
          </div>
        </div>
      </div>

      {/* Customer Portal Quick Access - O11-inspired feature card with image background */}
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border-subtle)]">
          {/* Background image with overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1509391366360-2e959784a276?w=1200&q=80')`,
              filter: 'sepia(20%) saturate(70%)'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg-surface)] via-[var(--color-bg-surface)]/90 to-transparent" />

          <div className="relative p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Customer Portal</h3>
                <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
                  Self-service portal for customers to view invoices and monitor their solar assets
                </p>
                {customerStats && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] px-2 py-0.5 rounded-full font-medium">
                      {customerStats.totalCustomers} customers
                    </span>
                    <span className="text-sm bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)] px-2 py-0.5 rounded-full font-medium">
                      {customerStats.activePortalUsers} active
                    </span>
                    {customerStats.customersWithPendingInvoices > 0 && (
                      <span className="text-sm bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)] px-2 py-0.5 rounded-full font-medium">
                        {customerStats.customersWithPendingInvoices} pending
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/customers">
                <Button variant="outline" className="h-10 border-[var(--color-border-default)] hover:bg-[var(--color-bg-surface-hover)] rounded-xl">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </Link>
              <Link href="/portal/login">
                <Button className="h-10 bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-lg shadow-amber-500/20">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Needs Attention */}
        <div className="lg:col-span-2 space-y-6">
          {/* Needs Attention Section - O11-inspired clean cards */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Needs Attention</h2>
              <Link href="/workspace">
                <button className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors">
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            {attentionItems.length === 0 ? (
              <EmptyState
                type="alerts"
                title="All caught up"
                description="No critical items need your attention right now."
              />
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <div key={item.id} className="bg-[var(--color-bg-surface)] rounded-xl p-4 flex items-start gap-3 border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors group">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                        item.severity === 'critical' ? "bg-[var(--color-semantic-error)]" :
                        item.severity === 'high' ? "bg-[var(--color-semantic-warning)]" :
                        "bg-[var(--color-semantic-info)]"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {item.title}
                        </span>
                        <span className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full",
                          item.type === 'alert'
                            ? "bg-[var(--color-semantic-error)]/10 text-[var(--color-semantic-error)]"
                            : "bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)]"
                        )}>
                          {item.type === 'alert' ? 'Alert' : 'RFI'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-tertiary)]">
                        <span>{item.project}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-all">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Filter Controls - O11-inspired clean filters */}
          <section className="mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
                <Filter className="w-4 h-4" />
                <span className="text-sm">Filters:</span>
              </div>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px] h-9 text-sm bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] rounded-xl hover:border-[var(--color-border-default)] transition-colors">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
                  {COUNTRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 text-sm bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] rounded-xl hover:border-[var(--color-border-default)] transition-colors">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="w-[160px] h-9 text-sm bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] rounded-xl hover:border-[var(--color-border-default)] transition-colors">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
                  {CLASSIFICATION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] rounded-xl"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}

              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 ml-2">
                  {countryFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] rounded-full">
                      {COUNTRY_OPTIONS.find(o => o.value === countryFilter)?.label}
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] rounded-full capitalize">
                      {statusFilter}
                    </Badge>
                  )}
                  {classificationFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs bg-[var(--color-bg-surface-hover)] text-[var(--color-text-secondary)] rounded-full">
                      {CLASSIFICATION_OPTIONS.find(o => o.value === classificationFilter)?.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Map Section - O11-inspired clean container */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Asset Locations</h2>
              </div>
              <Select value={mapColorBy} onValueChange={(v) => setMapColorBy(v as 'status' | 'classification')}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-surface-elevated)] border-[var(--color-border-subtle)]">
                  {MAP_COLOR_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
              <ProjectAssetsMap
                filters={hasActiveFilters ? filters : undefined}
                colorBy={mapColorBy}
                height="350px"
              />
            </div>
          </section>

          {/* Asset Portfolio Distribution - O11-inspired section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Asset Portfolio Distribution</h2>
              <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface-hover)] px-2 py-1 rounded-full">
                {hasActiveFilters ? 'Filtered view' : 'All assets'}
              </span>
            </div>
            <ProjectClassificationCharts filters={hasActiveFilters ? filters : undefined} />
          </section>
        </div>

        {/* Right Column - Projects List - O11-inspired clean cards */}
        <div>
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Projects</h2>
              <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface-hover)] px-2 py-1 rounded-full">
                {filteredProjects.length} total
              </span>
            </div>

            <div className="space-y-2">
              {filteredProjects.slice(0, 6).map((project) => {
                const TechIcon = techIcons[project.technology] || Sun;
                const projectDiligence = mockDiligenceProgress.filter(d => d.projectId === project.id);
                const progress = projectDiligence.reduce(
                  (acc, d) => ({ total: acc.total + d.totalItems, verified: acc.verified + d.verifiedItems }),
                  { total: 0, verified: 0 }
                );
                const progressPercent = progress.total > 0
                  ? Math.round((progress.verified / progress.total) * 100)
                  : 0;

                return (
                  <div
                    key={project.id}
                    className="bg-[var(--color-bg-surface)] rounded-xl p-4 cursor-pointer border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-all group"
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface-hover)] flex items-center justify-center group-hover:bg-[var(--color-brand-primary)]/10 transition-colors">
                          <TechIcon className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-brand-primary)] transition-colors" />
                        </div>
                        <div>
                          <span className="font-medium text-sm text-[var(--color-text-primary)] block">
                            {project.name}
                          </span>
                          <span className="text-xs text-[var(--color-text-tertiary)]">
                            {project.capacityMw ? `${project.capacityMw} MW` : `${project.capacityMwh} MWh`} • {project.state}
                          </span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        project.status === "operational"
                          ? "bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)]"
                          : project.status === "construction"
                          ? "bg-[var(--color-semantic-warning)]/10 text-[var(--color-semantic-warning)]"
                          : "bg-[var(--color-semantic-info)]/10 text-[var(--color-semantic-info)]"
                      )}>
                        {project.stage}
                      </span>
                    </div>

                    <div className="h-1.5 bg-[var(--color-bg-surface-hover)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--color-brand-primary)] to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-[var(--color-text-tertiary)]">
                      <span>Diligence</span>
                      <span className="font-medium">{progressPercent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProjects.length > 6 && (
              <button className="w-full mt-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-all">
                View all {filteredProjects.length} projects
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Check if user needs onboarding on first load
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('kiisha_onboarding_complete');
    const hasSkippedOnboarding = localStorage.getItem('kiisha_onboarding_skipped');
    
    if (!hasCompletedOnboarding && !hasSkippedOnboarding) {
      // Check if this is a new user (no projects/orgs set up)
      const isNewUser = !localStorage.getItem('kiisha_has_org');
      if (isNewUser) {
        setShowOnboarding(true);
      }
    }
  }, []);
  
  const handleOnboardingComplete = () => {
    localStorage.setItem('kiisha_onboarding_complete', 'true');
    localStorage.setItem('kiisha_has_org', 'true');
    setShowOnboarding(false);
  };
  
  const handleOnboardingSkip = () => {
    localStorage.setItem('kiisha_onboarding_skipped', 'true');
    setShowOnboarding(false);
  };
  
  if (showOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
  }
  
  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
