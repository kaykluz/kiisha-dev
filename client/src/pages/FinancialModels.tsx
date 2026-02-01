import { useState, useMemo } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatDate, formatCurrency, formatPercent } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Upload,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  FileSpreadsheet,
  History,
  Eye,
  Download,
  MoreVertical,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  LineChart,
  PieChart,
  Zap,
  Loader2,
} from "lucide-react";
import { Drawer, DrawerSection, DrawerFieldGrid, DrawerField } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { UploadFinancialModelDialog } from "@/components/UploadFinancialModelDialog";
import { BillingDataImportDialog } from "@/components/BillingDataImportDialog";
import { BulkUploadButton } from "@/components/BulkUploadDialog";
import { VarianceAlertSettingsButton } from "@/components/VarianceAlertSettings";
import { ExportReportButton } from "@/components/ExportReportDialog";
import { SkeletonTable } from "@/components/Skeleton";
import { trpc } from "@/lib/trpc";

// Financial model types
interface FinancialModelMetrics {
  npv: number;
  irr: number;
  paybackYears: number;
  moic: number;
  totalCapex: number;
  totalRevenue: number;
  avgEbitda: number;
  dscr: number;
  minDscr: number;
  debtAmount: number;
  equityAmount: number;
  leverageRatio: number;
  annualProductionMwh: number;
  capacityFactor: number;
  ppaRate: number;
  escalationRate: number;
  projectLifeYears: number;
  codDate: string;
}

interface CashFlowYear {
  year: number;
  calendarYear: number;
  revenue: number;
  opex: number;
  ebitda: number;
  debtService: number;
  freeCashFlow: number;
  dscr: number;
  productionMwh: number;
}

interface FinancialModel {
  id: number;
  projectId: number;
  name: string;
  version: number;
  modelType: "project_finance" | "acquisition" | "development" | "budget" | "cashflow_forecast";
  status: "draft" | "review" | "approved" | "superseded";
  stage: "development" | "ntp" | "construction" | "cod" | "operations" | "financial_close";
  baseCase: boolean;
  scenarioName: string | null;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  extractionStatus: "pending" | "processing" | "completed" | "failed";
  extractionConfidence: number;
  metrics: FinancialModelMetrics | null;
  cashFlows: CashFlowYear[];
  isCurrentVersion: boolean;
}

// Status badge component
function ModelStatusBadge({ status }: { status: FinancialModel["status"] }) {
  const config = {
    draft: { label: "Draft", className: "status-badge status-badge-muted" },
    review: { label: "In Review", className: "status-badge status-badge-warning" },
    approved: { label: "Approved", className: "status-badge status-badge-success" },
    superseded: { label: "Superseded", className: "status-badge status-badge-muted" },
  };
  const { label, className } = config[status] || config.draft;
  return <span className={className}>{label}</span>;
}

// Extraction status badge
function ExtractionStatusBadge({ status, confidence }: { status: FinancialModel["extractionStatus"]; confidence: number }) {
  const config = {
    pending: { label: "Pending", icon: Clock, className: "text-[var(--color-text-secondary)]" },
    processing: { label: "Processing", icon: RefreshCw, className: "text-[var(--color-semantic-warning)]" },
    completed: { label: `${Math.round(confidence * 100)}% Confidence`, icon: CheckCircle2, className: "text-[var(--color-semantic-success)]" },
    failed: { label: "Failed", icon: AlertTriangle, className: "text-[var(--color-semantic-error)]" },
  };
  const { label, icon: Icon, className } = config[status] || config.pending;
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

// Metric card component
function MetricCard({ 
  label, 
  value, 
  format = "number",
  trend,
  trendLabel,
  icon: Icon,
  highlight = false,
}: { 
  label: string; 
  value: number | string | null;
  format?: "number" | "currency" | "percent" | "years" | "ratio";
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: typeof DollarSign;
  highlight?: boolean;
}) {
  const formatValue = () => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "string") return value;
    
    switch (format) {
      case "currency":
        return formatCurrency(value);
      case "percent":
        return formatPercent(value);
      case "years":
        return `${value.toFixed(1)} yrs`;
      case "ratio":
        return `${value.toFixed(2)}x`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border border-[var(--color-border-subtle)]",
      highlight ? "bg-[var(--color-brand-primary)]/5 border-[var(--color-brand-primary)]/20" : "bg-[var(--color-bg-surface)]"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn(
          "text-xl font-semibold",
          highlight ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-primary)]"
        )}>
          {formatValue()}
        </span>
        {trend && trendLabel && (
          <span className={cn(
            "flex items-center gap-0.5 text-xs",
            trend === "up" ? "text-[var(--color-semantic-success)]" : 
            trend === "down" ? "text-[var(--color-semantic-error)]" : 
            "text-[var(--color-text-secondary)]"
          )}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : 
             trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// Financial Model Drawer
function FinancialModelDrawer({ model, project, onClose }: { model: FinancialModel; project: any; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"metrics" | "cashflows" | "comparison" | "history">("metrics");

  const tabs = [
    { id: "metrics", label: "Key Metrics" },
    { id: "cashflows", label: "Cash Flows" },
    { id: "comparison", label: "Actual vs Projected" },
    { id: "history", label: "Version History" },
  ];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={model.name}
      subtitle={`${project?.name || 'Unknown Project'} · v${model.version}`}
      size="lg"
      footer={
        <div className="flex gap-3 w-full">
          <ExportReportButton modelId={model.id} modelName={model.name} />
          <VarianceAlertSettingsButton modelId={model.id} />
          <Button className="btn-primary flex-1">
            <Upload className="w-4 h-4 mr-2" />
            Upload New Version
          </Button>
        </div>
      }
    >
      {/* Status Header */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-4">
          <ModelStatusBadge status={model.status} />
          <ExtractionStatusBadge status={model.extractionStatus} confidence={model.extractionConfidence} />
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          Uploaded by {model.uploadedBy} · {formatDate(model.uploadedAt)}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn("tab-item", activeTab === tab.id && "tab-item-active")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics Tab */}
      {activeTab === "metrics" && model.metrics && (
        <div className="space-y-6">
          {/* Key Returns */}
          <DrawerSection title="Returns & Value">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="NPV" value={model.metrics.npv} format="currency" icon={DollarSign} highlight />
              <MetricCard label="IRR" value={model.metrics.irr} format="percent" icon={TrendingUp} highlight />
              <MetricCard label="Payback" value={model.metrics.paybackYears} format="years" icon={Calendar} />
              <MetricCard label="MOIC" value={model.metrics.moic} format="ratio" icon={BarChart3} />
            </div>
          </DrawerSection>

          {/* Capital Structure */}
          <DrawerSection title="Capital Structure">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total CapEx" value={model.metrics.totalCapex} format="currency" icon={DollarSign} />
              <MetricCard label="Debt" value={model.metrics.debtAmount} format="currency" />
              <MetricCard label="Equity" value={model.metrics.equityAmount} format="currency" />
              <MetricCard label="Leverage" value={model.metrics.leverageRatio} format="percent" />
            </div>
          </DrawerSection>

          {/* Debt Service */}
          <DrawerSection title="Debt Coverage">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard label="Avg DSCR" value={model.metrics.dscr} format="ratio" icon={LineChart} />
              <MetricCard label="Min DSCR" value={model.metrics.minDscr} format="ratio" />
              <MetricCard label="Avg EBITDA" value={model.metrics.avgEbitda} format="currency" />
            </div>
          </DrawerSection>

          {/* Production & Revenue */}
          <DrawerSection title="Production & Revenue">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Annual Production" value={model.metrics.annualProductionMwh} icon={Zap} />
              <MetricCard label="Capacity Factor" value={model.metrics.capacityFactor} format="percent" />
              <MetricCard label="PPA Rate" value={model.metrics.ppaRate} format="currency" />
              <MetricCard label="Escalation" value={model.metrics.escalationRate} format="percent" />
            </div>
          </DrawerSection>

          {/* Project Details */}
          <DrawerSection title="Project Details">
            <DrawerFieldGrid>
              <DrawerField label="Project Life" value={`${model.metrics.projectLifeYears} years`} />
              <DrawerField label="COD Date" value={formatDate(model.metrics.codDate)} />
              <DrawerField label="Total Revenue" value={formatCurrency(model.metrics.totalRevenue)} />
            </DrawerFieldGrid>
          </DrawerSection>
        </div>
      )}

      {/* Cash Flows Tab */}
      {activeTab === "cashflows" && (
        <div className="space-y-4">
          {model.cashFlows && model.cashFlows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border-subtle)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)]">Year</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">OpEx</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">EBITDA</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">Debt Service</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">FCF</th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)]">DSCR</th>
                  </tr>
                </thead>
                <tbody>
                  {model.cashFlows.map((cf) => (
                    <tr key={cf.year} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)]">
                      <td className="py-3 px-4">
                        <div className="font-medium">Year {cf.year}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{cf.calendarYear}</div>
                      </td>
                      <td className="text-right py-3 px-4">{formatCurrency(cf.revenue)}</td>
                      <td className="text-right py-3 px-4">{formatCurrency(cf.opex)}</td>
                      <td className="text-right py-3 px-4 font-medium">{formatCurrency(cf.ebitda)}</td>
                      <td className="text-right py-3 px-4">{formatCurrency(cf.debtService)}</td>
                      <td className="text-right py-3 px-4 font-medium text-[var(--color-semantic-success)]">{formatCurrency(cf.freeCashFlow)}</td>
                      <td className="text-right py-3 px-4">{cf.dscr.toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="w-12 h-12 stroke-1" />}
              title="No Cash Flow Data"
              description="Cash flow projections have not been extracted from this model yet."
            />
          )}
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === "comparison" && (
        <EmptyState
          icon={<LineChart className="w-12 h-12 stroke-1" />}
          title="Actual vs Projected Comparison"
          description="Compare financial model projections against actual billing and revenue data once the project is operational."
          action={
            <BillingDataImportDialog
              modelId={model.id}
              modelName={model.name}
              onSuccess={() => toast.success("Billing data imported successfully")}
            />
          }
        />
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--color-brand-primary)]" />
                </div>
                <div>
                  <div className="font-medium">Version {model.version}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {model.uploadedBy} · {formatDate(model.uploadedAt)}
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)] border-[var(--color-semantic-success)]/20">
                Current
              </Badge>
            </div>
          </div>
          {model.version > 1 && (
            <div className="p-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-muted)]/10 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                </div>
                <div>
                  <div className="font-medium">Version {model.version - 1}</div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    Previous version · Superseded
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// Main Financial Models Page
export default function FinancialModels() {
  const { selectedProject, selectedProjectId } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<FinancialModel | null>(null);

  // Fetch projects from API
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const isLoading = projectsLoading;

  // For now, financial models are empty until we add the API endpoint
  const financialModels: FinancialModel[] = [];

  // Filter models
  const filteredModels = useMemo(() => {
    return financialModels.filter((model) => {
      // Project filter
      if (selectedProjectId && model.projectId !== selectedProjectId) return false;
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!model.name.toLowerCase().includes(query) && 
            !model.fileName.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Status filter
      if (statusFilter !== "all" && model.status !== statusFilter) return false;
      
      // Stage filter
      if (stageFilter !== "all" && model.stage !== stageFilter) return false;
      
      return true;
    });
  }, [selectedProjectId, searchQuery, statusFilter, stageFilter, financialModels]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const approvedModels = financialModels.filter(m => m.status === "approved" && m.metrics);
    if (approvedModels.length === 0) return null;
    
    const totalNpv = approvedModels.reduce((sum, m) => sum + (m.metrics?.npv || 0), 0);
    const avgIrr = approvedModels.reduce((sum, m) => sum + (m.metrics?.irr || 0), 0) / approvedModels.length;
    const totalCapex = approvedModels.reduce((sum, m) => sum + (m.metrics?.totalCapex || 0), 0);
    const avgDscr = approvedModels.reduce((sum, m) => sum + (m.metrics?.dscr || 0), 0) / approvedModels.length;
    
    return { totalNpv, avgIrr, totalCapex, avgDscr, modelCount: approvedModels.length };
  }, [financialModels]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">Loading financial models...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Financial Models</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Manage project finance models with automated metric extraction
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UploadFinancialModelDialog
              projectId={selectedProjectId || 1}
              projectName={selectedProject?.name || "All Projects"}
              onSuccess={() => toast.success("Model uploaded successfully")}
            />
            <BulkUploadButton
              projectId={selectedProjectId || 1}
              onSuccess={() => toast.success("Models uploaded successfully")}
            />
          </div>
        </div>

        {/* Portfolio Summary */}
        {!selectedProjectId && portfolioMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Total NPV" value={portfolioMetrics.totalNpv} format="currency" icon={DollarSign} highlight />
            <MetricCard label="Avg IRR" value={portfolioMetrics.avgIrr} format="percent" icon={TrendingUp} />
            <MetricCard label="Total CapEx" value={portfolioMetrics.totalCapex} format="currency" icon={Calculator} />
            <MetricCard label="Avg DSCR" value={portfolioMetrics.avgDscr} format="ratio" icon={LineChart} />
            <MetricCard label="Models" value={portfolioMetrics.modelCount} icon={FileSpreadsheet} />
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">In Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="superseded">Superseded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="ntp">NTP</SelectItem>
              <SelectItem value="construction">Construction</SelectItem>
              <SelectItem value="cod">COD</SelectItem>
              <SelectItem value="operations">Operations</SelectItem>
              <SelectItem value="financial_close">Financial Close</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Models Table */}
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
          {filteredModels.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">Model</th>
                  <th className="text-left py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">Project</th>
                  <th className="text-center py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">NPV</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">IRR</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">DSCR</th>
                  <th className="text-center py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">Extraction</th>
                  <th className="text-right py-3 px-4 font-medium text-[var(--color-text-secondary)] text-sm">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((model) => {
                  const project = projects.find((p: any) => p.id === model.projectId);
                  return (
                    <tr 
                      key={model.id} 
                      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] cursor-pointer"
                      onClick={() => setSelectedModel(model)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-primary)]/10 flex items-center justify-center">
                            <Calculator className="w-4 h-4 text-[var(--color-brand-primary)]" />
                          </div>
                          <div>
                            <div className="font-medium text-[var(--color-text-primary)]">{model.name}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">v{model.version} · {model.scenarioName || "Base Case"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-[var(--color-text-secondary)]">{project?.name || 'Unknown'}</td>
                      <td className="py-3 px-4 text-center">
                        <ModelStatusBadge status={model.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {model.metrics ? formatCurrency(model.metrics.npv) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {model.metrics ? formatPercent(model.metrics.irr) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {model.metrics ? `${model.metrics.dscr.toFixed(2)}x` : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-center">
                          <ExtractionStatusBadge status={model.extractionStatus} confidence={model.extractionConfidence} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-[var(--color-text-secondary)]">
                        {formatDate(model.uploadedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Calculator className="w-12 h-12 stroke-1" />}
              title="No Financial Models"
              description={selectedProjectId ? "No financial models found for this project." : "Upload your first financial model to get started."}
              action={
                <UploadFinancialModelDialog
                  projectId={selectedProjectId || 1}
                  projectName={selectedProject?.name || "All Projects"}
                  onSuccess={() => toast.success("Model uploaded successfully")}
                />
              }
            />
          )}
        </div>
      </div>

      {/* Model Drawer */}
      {selectedModel && (
        <FinancialModelDrawer 
          model={selectedModel} 
          project={projects.find((p: any) => p.id === selectedModel.projectId)}
          onClose={() => setSelectedModel(null)} 
        />
      )}
    </AppLayout>
  );
}
