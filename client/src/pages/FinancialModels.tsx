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
} from "lucide-react";
import { Drawer, DrawerSection, DrawerFieldGrid, DrawerField } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { UploadFinancialModelDialog } from "@/components/UploadFinancialModelDialog";
import { BillingDataImportDialog } from "@/components/BillingDataImportDialog";
import { BulkUploadButton } from "@/components/BulkUploadDialog";
import { VarianceAlertSettingsButton } from "@/components/VarianceAlertSettings";
import { ExportReportButton } from "@/components/ExportReportDialog";
import { SkeletonTable } from "@/components/Skeleton";
import { mockProjects } from "@shared/mockData";

// Mock financial model data
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

const mockFinancialModels: FinancialModel[] = [
  {
    id: 1,
    projectId: 1,
    name: "MA Gillette - Base Case Model",
    version: 3,
    modelType: "project_finance",
    status: "approved",
    stage: "development",
    baseCase: true,
    scenarioName: null,
    fileName: "MA_Gillette_Financial_Model_v3.xlsx",
    fileSize: 2450000,
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-01-15T10:30:00Z",
    extractionStatus: "completed",
    extractionConfidence: 0.95,
    metrics: {
      npv: 4250000,
      irr: 0.142,
      paybackYears: 6.8,
      moic: 1.85,
      totalCapex: 15600000,
      totalRevenue: 52000000,
      avgEbitda: 1850000,
      dscr: 1.35,
      minDscr: 1.25,
      debtAmount: 10920000,
      equityAmount: 4680000,
      leverageRatio: 0.70,
      annualProductionMwh: 22500,
      capacityFactor: 0.205,
      ppaRate: 0.085,
      escalationRate: 0.02,
      projectLifeYears: 25,
      codDate: "2026-09-01",
    },
    cashFlows: [
      { year: 1, calendarYear: 2027, revenue: 1912500, opex: 312500, ebitda: 1600000, debtService: 1185000, freeCashFlow: 415000, dscr: 1.35, productionMwh: 22500 },
      { year: 2, calendarYear: 2028, revenue: 1950750, opex: 318750, ebitda: 1632000, debtService: 1185000, freeCashFlow: 447000, dscr: 1.38, productionMwh: 22275 },
      { year: 3, calendarYear: 2029, revenue: 1989765, opex: 325125, ebitda: 1664640, debtService: 1185000, freeCashFlow: 479640, dscr: 1.40, productionMwh: 22052 },
      { year: 4, calendarYear: 2030, revenue: 2029560, opex: 331628, ebitda: 1697932, debtService: 1185000, freeCashFlow: 512932, dscr: 1.43, productionMwh: 21832 },
      { year: 5, calendarYear: 2031, revenue: 2070151, opex: 338260, ebitda: 1731891, debtService: 1185000, freeCashFlow: 546891, dscr: 1.46, productionMwh: 21613 },
    ],
    isCurrentVersion: true,
  },
  {
    id: 2,
    projectId: 1,
    name: "MA Gillette - Downside Scenario",
    version: 1,
    modelType: "project_finance",
    status: "review",
    stage: "development",
    baseCase: false,
    scenarioName: "P90 Production",
    fileName: "MA_Gillette_Downside_v1.xlsx",
    fileSize: 2380000,
    uploadedBy: "Mike Johnson",
    uploadedAt: "2026-01-14T14:20:00Z",
    extractionStatus: "completed",
    extractionConfidence: 0.92,
    metrics: {
      npv: 2850000,
      irr: 0.118,
      paybackYears: 8.2,
      moic: 1.62,
      totalCapex: 15600000,
      totalRevenue: 46800000,
      avgEbitda: 1665000,
      dscr: 1.22,
      minDscr: 1.12,
      debtAmount: 10920000,
      equityAmount: 4680000,
      leverageRatio: 0.70,
      annualProductionMwh: 20250,
      capacityFactor: 0.185,
      ppaRate: 0.085,
      escalationRate: 0.02,
      projectLifeYears: 25,
      codDate: "2026-09-01",
    },
    cashFlows: [],
    isCurrentVersion: true,
  },
  {
    id: 3,
    projectId: 2,
    name: "NY Saratoga - NTP Model",
    version: 2,
    modelType: "project_finance",
    status: "approved",
    stage: "ntp",
    baseCase: true,
    scenarioName: null,
    fileName: "NY_Saratoga_NTP_Model_v2.xlsx",
    fileSize: 3120000,
    uploadedBy: "Emily Watson",
    uploadedAt: "2026-01-10T09:15:00Z",
    extractionStatus: "completed",
    extractionConfidence: 0.97,
    metrics: {
      npv: 3180000,
      irr: 0.156,
      paybackYears: 5.9,
      moic: 1.92,
      totalCapex: 12400000,
      totalRevenue: 41500000,
      avgEbitda: 1520000,
      dscr: 1.42,
      minDscr: 1.32,
      debtAmount: 8680000,
      equityAmount: 3720000,
      leverageRatio: 0.70,
      annualProductionMwh: 14760,
      capacityFactor: 0.206,
      ppaRate: 0.092,
      escalationRate: 0.025,
      projectLifeYears: 25,
      codDate: "2026-06-15",
    },
    cashFlows: [],
    isCurrentVersion: true,
  },
  {
    id: 4,
    projectId: 5,
    name: "PA Lancaster - Operations Model",
    version: 5,
    modelType: "project_finance",
    status: "approved",
    stage: "operations",
    baseCase: true,
    scenarioName: null,
    fileName: "PA_Lancaster_Ops_Model_v5.xlsx",
    fileSize: 4250000,
    uploadedBy: "Sarah Chen",
    uploadedAt: "2026-01-08T16:45:00Z",
    extractionStatus: "completed",
    extractionConfidence: 0.98,
    metrics: {
      npv: 5620000,
      irr: 0.168,
      paybackYears: 5.2,
      moic: 2.15,
      totalCapex: 18500000,
      totalRevenue: 68000000,
      avgEbitda: 2450000,
      dscr: 1.55,
      minDscr: 1.45,
      debtAmount: 12950000,
      equityAmount: 5550000,
      leverageRatio: 0.70,
      annualProductionMwh: 27000,
      capacityFactor: 0.205,
      ppaRate: 0.095,
      escalationRate: 0.02,
      projectLifeYears: 25,
      codDate: "2024-03-01",
    },
    cashFlows: [],
    isCurrentVersion: true,
  },
];

// Status badge component
function ModelStatusBadge({ status }: { status: FinancialModel["status"] }) {
  const config = {
    draft: { label: "Draft", className: "status-badge status-badge-muted" },
    review: { label: "In Review", className: "status-badge status-badge-warning" },
    approved: { label: "Approved", className: "status-badge status-badge-success" },
    superseded: { label: "Superseded", className: "status-badge status-badge-muted" },
  };
  const { label, className } = config[status];
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
  const { label, icon: Icon, className } = config[status];
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
function FinancialModelDrawer({ model, onClose }: { model: FinancialModel; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"metrics" | "cashflows" | "comparison" | "history">("metrics");
  const project = mockProjects.find(p => p.id === model.projectId);

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
      subtitle={`${project?.name} · v${model.version}`}
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
          {model.cashFlows.length > 0 ? (
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
  const { selectedProject } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selectedModel, setSelectedModel] = useState<FinancialModel | null>(null);

  // Filter models
  const filteredModels = useMemo(() => {
    return mockFinancialModels.filter((model) => {
      // Project filter
      if (selectedProject && model.projectId !== selectedProject.id) return false;
      
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
  }, [selectedProject, searchQuery, statusFilter, stageFilter]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const approvedModels = mockFinancialModels.filter(m => m.status === "approved" && m.metrics);
    if (approvedModels.length === 0) return null;
    
    const totalNpv = approvedModels.reduce((sum, m) => sum + (m.metrics?.npv || 0), 0);
    const avgIrr = approvedModels.reduce((sum, m) => sum + (m.metrics?.irr || 0), 0) / approvedModels.length;
    const totalCapex = approvedModels.reduce((sum, m) => sum + (m.metrics?.totalCapex || 0), 0);
    const avgDscr = approvedModels.reduce((sum, m) => sum + (m.metrics?.dscr || 0), 0) / approvedModels.length;
    
    return { totalNpv, avgIrr, totalCapex, avgDscr, modelCount: approvedModels.length };
  }, []);

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
              projectId={selectedProject?.id || 1}
              projectName={selectedProject?.name || "All Projects"}
              onSuccess={() => toast.success("Model uploaded successfully")}
            />
            <BulkUploadButton
              projectId={selectedProject?.id || 1}
              onSuccess={() => toast.success("Models uploaded successfully")}
            />
          </div>
        </div>

        {/* Portfolio Summary */}
        {!selectedProject && portfolioMetrics && (
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
                  const project = mockProjects.find(p => p.id === model.projectId);
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
                      <td className="py-3 px-4 text-sm text-[var(--color-text-secondary)]">{project?.name}</td>
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
              description={selectedProject ? "No financial models found for this project." : "Upload your first financial model to get started."}
              action={
                <UploadFinancialModelDialog
                  projectId={selectedProject?.id || 1}
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
        <FinancialModelDrawer model={selectedModel} onClose={() => setSelectedModel(null)} />
      )}
    </AppLayout>
  );
}
