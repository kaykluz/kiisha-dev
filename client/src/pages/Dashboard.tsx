import AppLayout, { useProject } from "@/components/AppLayout";
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
  const summary = getPortfolioSummary();
  
  // Fetch customer stats for portal card
  const { data: customerStats } = trpc.customerPortal.getCustomerStats.useQuery(
    { orgId: 1 }, // TODO: Get from user context
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
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{selectedProjectId ? filteredProjects[0]?.name : mockPortfolio.name}</h1>
          <p className="page-subtitle">
            {selectedProjectId 
              ? `${filteredProjects[0]?.technology} • ${filteredProjects[0]?.capacityMw} MW • ${filteredProjects[0]?.state}`
              : `${filteredProjects.length} projects • ${totalCapacityMw.toFixed(1)} MW total capacity`
            }
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="metric-label">Total Sites</span>
            <Building2 className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="metric-value">{filteredProjects.length}</div>
          <div className="metric-change positive">
            <TrendingUp className="w-3 h-3" />
            +2 this quarter
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="metric-label">Total Capacity</span>
            <Zap className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="metric-value">
            {totalCapacityMw.toFixed(1)}
            <span className="text-lg font-normal text-[var(--color-text-tertiary)] ml-1">MW</span>
          </div>
          {totalCapacityMwh > 0 && (
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
              + {totalCapacityMwh.toFixed(1)} MWh storage
            </div>
          )}
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="metric-label">Diligence Progress</span>
            <FileText className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="metric-value">{diligencePercent}%</div>
          <div className="progress-bar mt-2">
            <div className="progress-bar-fill" style={{ width: `${diligencePercent}%` }} />
          </div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-3">
            <span className="metric-label">Open Items</span>
            <AlertTriangle className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="metric-value">{openRfis + activeAlerts}</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
            {openRfis} RFIs • {activeAlerts} alerts
          </div>
        </div>
      </div>

      {/* Customer Portal Quick Access */}
      <div className="mb-8">
        <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Customer Portal</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Self-service portal for customers to view invoices, track payments, and monitor their solar assets
                </p>
                {customerStats && (
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm">
                      <span className="font-semibold text-orange-400">{customerStats.totalCustomers}</span>
                      <span className="text-[var(--color-text-secondary)] ml-1">customers</span>
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-sm">
                      <span className="font-semibold text-green-400">{customerStats.activePortalUsers}</span>
                      <span className="text-[var(--color-text-secondary)] ml-1">active portal users</span>
                    </span>
                    {customerStats.customersWithPendingInvoices > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-sm">
                          <span className="font-semibold text-amber-400">{customerStats.customersWithPendingInvoices}</span>
                          <span className="text-[var(--color-text-secondary)] ml-1">with pending invoices</span>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/admin/customers">
                <Button variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Customers
                </Button>
              </Link>
              <Link href="/portal/login">
                <Button className="bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Needs Attention */}
        <div className="col-span-2 space-y-6">
          {/* Needs Attention Section */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Needs Attention</h2>
              <Link href="/workspace">
                <button className="text-sm text-[var(--color-brand-primary)] hover:underline flex items-center gap-1">
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
              <div className="space-y-3">
                {attentionItems.map((item) => (
                  <div key={item.id} className="attention-item">
                    <div 
                      className={cn(
                        "attention-item-dot",
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
                          "status-badge text-[10px]",
                          item.type === 'alert' ? "status-badge-error" : "status-badge-warning"
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
                    <button className="p-1.5 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)]">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Filter Controls */}
          <section className="mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <span className="text-sm font-medium text-[var(--color-text-secondary)]">Filter Assets:</span>
              </div>
              
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]">
                  <SelectValue placeholder="Classification" />
                </SelectTrigger>
                <SelectContent>
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
                  className="h-8 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
              
              {hasActiveFilters && (
                <div className="flex items-center gap-1.5 ml-2">
                  {countryFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {COUNTRY_OPTIONS.find(o => o.value === countryFilter)?.label}
                    </Badge>
                  )}
                  {statusFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs capitalize">
                      {statusFilter}
                    </Badge>
                  )}
                  {classificationFilter !== 'all' && (
                    <Badge variant="secondary" className="text-xs">
                      {CLASSIFICATION_OPTIONS.find(o => o.value === classificationFilter)?.label}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Map Section - Project-Level Assets */}
          <section>
            <div className="section-header">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                <h2 className="section-title">Asset Locations</h2>
              </div>
              <div className="flex items-center gap-2">
                <Select value={mapColorBy} onValueChange={(v) => setMapColorBy(v as 'status' | 'classification')}>
                  <SelectTrigger className="w-[130px] h-7 text-xs bg-transparent border-[var(--color-border-subtle)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MAP_COLOR_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-card)] p-0 overflow-hidden">
              <ProjectAssetsMap 
                filters={hasActiveFilters ? filters : undefined}
                colorBy={mapColorBy}
                height="350px"
              />
            </div>
          </section>

          {/* Asset Portfolio Distribution - Project-Level Assets */}
          <section>
            <div className="section-header">
              <h2 className="section-title">Asset Portfolio Distribution</h2>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {hasActiveFilters ? 'Filtered view' : 'All project-level assets'}
              </span>
            </div>
            <ProjectClassificationCharts filters={hasActiveFilters ? filters : undefined} />
          </section>
        </div>

        {/* Right Column - Projects List */}
        <div>
          <section>
            <div className="section-header">
              <h2 className="section-title">Projects</h2>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {filteredProjects.length} total
              </span>
            </div>

            <div className="space-y-3">
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
                    className="project-card"
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TechIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <span className="font-medium text-sm text-[var(--color-text-primary)]">
                          {project.name}
                        </span>
                      </div>
                      <span className={cn(
                        "status-badge text-[10px]",
                        project.status === "operational" ? "status-badge-success" :
                        project.status === "construction" ? "status-badge-warning" : "status-badge-info"
                      )}>
                        {project.stage}
                      </span>
                    </div>
                    
                    <div className="text-xs text-[var(--color-text-tertiary)] mb-3">
                      {project.capacityMw ? `${project.capacityMw} MW` : `${project.capacityMwh} MWh`} • {project.state}
                    </div>

                    <div className="progress-bar">
                      <div 
                        className="progress-bar-fill" 
                        style={{ width: `${progressPercent}%` }} 
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-[var(--color-text-tertiary)]">
                      <span>Diligence</span>
                      <span>{progressPercent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProjects.length > 6 && (
              <button className="w-full mt-4 py-2 text-sm text-[var(--color-brand-primary)] hover:underline">
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
