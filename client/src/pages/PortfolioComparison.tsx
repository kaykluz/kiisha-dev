import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import AppLayout from '@/components/AppLayout';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ChevronDown,
  ChevronRight,
  History,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Check,
  ExternalLink,
  X,
  Loader2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { trpc } from '@/lib/trpc';

interface ModelVersion {
  version: string;
  date: string;
  npv: number;
  irr: number;
  dscr: number;
  payback: number;
  ebitda: number;
  status: string;
}

interface ModelData {
  id: number;
  projectName: string;
  modelName: string;
  currentVersion: string;
  versions: ModelVersion[];
  actuals: { revenue: number; production: number; opex: number } | null;
  projected: { revenue: number; production: number; opex: number };
}

// Calculate variance
function calculateVariance(actual: number, projected: number): { value: number; percent: number; trend: 'up' | 'down' | 'neutral' } {
  const diff = actual - projected;
  const percent = projected !== 0 ? (diff / projected) * 100 : 0;
  return {
    value: diff,
    percent,
    trend: percent > 2 ? 'up' : percent < -2 ? 'down' : 'neutral'
  };
}

// Version comparison card
function VersionCard({ model, expanded, onToggle, selected, onSelect, onNavigate }: { 
  model: ModelData; 
  expanded: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onNavigate: () => void;
}) {
  const currentVersion = model.versions[0];
  const previousVersion = model.versions[1];
  
  if (!currentVersion) return null;
  
  const npvChange = previousVersion 
    ? ((currentVersion.npv - previousVersion.npv) / previousVersion.npv) * 100 
    : 0;
  const irrChange = previousVersion 
    ? (currentVersion.irr - previousVersion.irr) * 100 
    : 0;

  return (
    <Card className={cn("overflow-hidden transition-all", selected && "ring-2 ring-primary")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <Checkbox 
              checked={selected} 
              onCheckedChange={onSelect}
              className="mt-1"
            />
            <div 
              className="cursor-pointer hover:text-primary transition-colors"
              onClick={onNavigate}
            >
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {model.projectName}
                <ExternalLink className="h-3.5 w-3.5 opacity-50" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">{model.modelName}</p>
            </div>
          </div>
          <Badge variant={currentVersion.status === 'approved' ? 'default' : 'secondary'}>
            {currentVersion.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Current Version Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">NPV</p>
            <p className="text-lg font-semibold text-primary">{formatCurrency(currentVersion.npv)}</p>
            {npvChange !== 0 && (
              <div className={cn(
                "flex items-center text-xs",
                npvChange > 0 ? "text-green-500" : "text-red-500"
              )}>
                {npvChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(npvChange).toFixed(1)}% vs {previousVersion?.version}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">IRR</p>
            <p className="text-lg font-semibold">{formatPercent(currentVersion.irr)}</p>
            {irrChange !== 0 && (
              <div className={cn(
                "flex items-center text-xs",
                irrChange > 0 ? "text-green-500" : "text-red-500"
              )}>
                {irrChange > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(irrChange).toFixed(2)}pp
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">DSCR</p>
            <p className="text-lg font-semibold">{currentVersion.dscr.toFixed(2)}x</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Payback</p>
            <p className="text-lg font-semibold">{currentVersion.payback.toFixed(1)} yrs</p>
          </div>
        </div>

        {/* Actual vs Projected (if available) */}
        {model.actuals && (
          <div className="border-t pt-3 mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">ACTUAL VS PROJECTED (YTD)</p>
            <div className="grid grid-cols-3 gap-3">
              {['revenue', 'production', 'opex'].map((metric) => {
                const actual = model.actuals![metric as keyof typeof model.actuals];
                const projected = model.projected[metric as keyof typeof model.projected];
                const variance = calculateVariance(actual, projected);
                const isOpex = metric === 'opex';
                const isPositive = isOpex ? variance.trend === 'down' : variance.trend === 'up';
                
                return (
                  <div key={metric} className="text-center">
                    <p className="text-xs text-muted-foreground capitalize">{metric}</p>
                    <div className={cn(
                      "flex items-center justify-center gap-1 text-sm font-medium",
                      variance.trend === 'neutral' ? "text-muted-foreground" :
                      isPositive ? "text-green-500" : "text-red-500"
                    )}>
                      {variance.trend === 'up' && <TrendingUp className="h-3 w-3" />}
                      {variance.trend === 'down' && <TrendingDown className="h-3 w-3" />}
                      {variance.trend === 'neutral' && <Minus className="h-3 w-3" />}
                      {variance.percent > 0 ? '+' : ''}{variance.percent.toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Version History Toggle */}
        <button 
          onClick={onToggle}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full pt-2 border-t"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <History className="h-4 w-4" />
          {model.versions.length} versions
          <span className="text-xs ml-auto">Current: {currentVersion.version}</span>
        </button>

        {/* Expanded Version History */}
        {expanded && (
          <div className="mt-3 space-y-2">
            {model.versions.map((version, idx) => (
              <div 
                key={version.version}
                className={cn(
                  "flex items-center justify-between p-2 rounded text-sm",
                  idx === 0 ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "font-medium",
                    idx === 0 && "text-primary"
                  )}>{version.version}</span>
                  <span className="text-muted-foreground">{version.date}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>NPV: {formatCurrency(version.npv)}</span>
                  <Badge variant={idx === 0 ? 'default' : 'outline'} className="text-xs">
                    {version.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Comparison Table
function ComparisonTable({ models, metric }: { models: ModelData[]; metric: string }) {
  const getMetricValue = (version: ModelVersion, metric: string) => {
    switch (metric) {
      case 'npv': return formatCurrency(version.npv);
      case 'irr': return formatPercent(version.irr);
      case 'dscr': return version.dscr.toFixed(2) + 'x';
      case 'payback': return version.payback.toFixed(1) + ' yrs';
      case 'ebitda': return formatCurrency(version.ebitda);
      default: return '-';
    }
  };

  const getMetricRawValue = (version: ModelVersion, metric: string) => {
    switch (metric) {
      case 'npv': return version.npv;
      case 'irr': return version.irr;
      case 'dscr': return version.dscr;
      case 'payback': return -version.payback; // Lower is better
      case 'ebitda': return version.ebitda;
      default: return 0;
    }
  };

  // Find best value for highlighting
  const currentVersions = models.map(m => m.versions[0]).filter(Boolean);
  const values = currentVersions.map(v => getMetricRawValue(v, metric));
  const maxValue = Math.max(...values);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Project</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Model</th>
            <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Version</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground capitalize">{metric}</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">vs Previous</th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => {
            const current = model.versions[0];
            const previous = model.versions[1];
            if (!current) return null;
            
            const currentValue = getMetricRawValue(current, metric);
            const isBest = currentValue === maxValue;
            
            let change = 0;
            if (previous) {
              const prevValue = getMetricRawValue(previous, metric);
              change = prevValue !== 0 ? ((currentValue - prevValue) / Math.abs(prevValue)) * 100 : 0;
            }

            return (
              <tr key={model.id} className="border-b hover:bg-muted/50">
                <td className="py-3 px-4">
                  <span className="font-medium">{model.projectName}</span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">{model.modelName}</td>
                <td className="py-3 px-4 text-center">
                  <Badge variant="outline">{current.version}</Badge>
                </td>
                <td className={cn(
                  "py-3 px-4 text-right font-semibold",
                  isBest && "text-primary"
                )}>
                  {getMetricValue(current, metric)}
                  {isBest && <span className="ml-2 text-xs">★</span>}
                </td>
                <td className="py-3 px-4 text-right">
                  {previous ? (
                    <span className={cn(
                      "flex items-center justify-end gap-1 text-sm",
                      change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground"
                    )}>
                      {change > 0 ? <TrendingUp className="h-3 w-3" /> : 
                       change < 0 ? <TrendingDown className="h-3 w-3" /> : 
                       <Minus className="h-3 w-3" />}
                      {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Variance Trend Chart (simplified visual)
function VarianceTrendChart({ models }: { models: ModelData[] }) {
  const modelsWithActuals = models.filter(m => m.actuals);
  
  if (modelsWithActuals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No actual data available for variance comparison</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {modelsWithActuals.map((model) => {
        const revenueVariance = calculateVariance(model.actuals!.revenue, model.projected.revenue);
        const productionVariance = calculateVariance(model.actuals!.production, model.projected.production);
        
        return (
          <div key={model.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">{model.projectName}</span>
              <Badge variant="outline">{model.currentVersion}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenue Variance</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        revenueVariance.percent >= 0 ? "bg-green-500" : "bg-red-500"
                      )}
                      style={{ 
                        width: `${Math.min(Math.abs(revenueVariance.percent) * 5, 100)}%`,
                        marginLeft: revenueVariance.percent < 0 ? 'auto' : 0
                      }}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-medium min-w-[60px] text-right",
                    revenueVariance.percent >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {revenueVariance.percent > 0 ? '+' : ''}{revenueVariance.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Production Variance</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        productionVariance.percent >= 0 ? "bg-green-500" : "bg-red-500"
                      )}
                      style={{ 
                        width: `${Math.min(Math.abs(productionVariance.percent) * 5, 100)}%`,
                        marginLeft: productionVariance.percent < 0 ? 'auto' : 0
                      }}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-medium min-w-[60px] text-right",
                    productionVariance.percent >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {productionVariance.percent > 0 ? '+' : ''}{productionVariance.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PortfolioComparison() {
  const [, setLocation] = useLocation();
  const [expandedModels, setExpandedModels] = useState<Set<number>>(new Set());
  const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set());
  const [selectedMetric, setSelectedMetric] = useState('npv');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [compareMode, setCompareMode] = useState(false);

  // Fetch financial models from API
  const { data: apiModels = [], isLoading } = trpc.financialModels.list.useQuery({});
  const { data: portfolioSummaryData } = trpc.financialModels.getPortfolioSummary.useQuery({});

  // Transform API data to component format
  const models: ModelData[] = useMemo(() => {
    return (apiModels as any[]).map((model: any) => ({
      id: model.id,
      projectName: model.projectName || `Project ${model.projectId}`,
      modelName: model.name,
      currentVersion: `v${model.version || 1}`,
      versions: [{
        version: `v${model.version || 1}`,
        date: model.createdAt ? new Date(model.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        npv: model.metrics?.npv || 0,
        irr: model.metrics?.irr || 0,
        dscr: model.metrics?.avgDscr || 0,
        payback: model.metrics?.paybackYears || 0,
        ebitda: model.metrics?.ebitda || 0,
        status: model.status || 'draft',
      }],
      actuals: null, // Would come from comparison data
      projected: {
        revenue: model.metrics?.projectedRevenue || 0,
        production: model.metrics?.projectedProduction || 0,
        opex: model.metrics?.projectedOpex || 0,
      },
    }));
  }, [apiModels]);

  const toggleModelSelection = (id: number, checked: boolean) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAllModels = () => {
    setSelectedModels(new Set(filteredModels.map(m => m.id)));
  };

  const clearSelection = () => {
    setSelectedModels(new Set());
    setCompareMode(false);
  };

  const navigateToModel = (projectName: string) => {
    const encodedProject = encodeURIComponent(projectName);
    setLocation(`/financial-models?project=${encodedProject}`);
  };

  const filteredModels = useMemo(() => {
    if (filterStatus === 'all') return models;
    return models.filter(m => m.versions[0]?.status?.toLowerCase() === filterStatus.toLowerCase());
  }, [models, filterStatus]);

  // Get models to display based on compare mode
  const displayModels = useMemo(() => {
    if (compareMode && selectedModels.size > 0) {
      return filteredModels.filter(m => selectedModels.has(m.id));
    }
    return filteredModels;
  }, [filteredModels, compareMode, selectedModels]);

  const toggleExpanded = (id: number) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Portfolio summary from API or calculated
  const portfolioSummary = useMemo(() => {
    if (portfolioSummaryData) {
      return {
        totalNpv: (portfolioSummaryData as any).totalNpv || 0,
        avgIrr: (portfolioSummaryData as any).avgIrr || 0,
        avgDscr: (portfolioSummaryData as any).avgDscr || 0,
        totalModels: (portfolioSummaryData as any).modelCount || models.length,
        totalVersions: models.length,
      };
    }
    
    const currentVersions = models.map(m => m.versions[0]).filter(Boolean);
    return {
      totalNpv: currentVersions.reduce((sum, v) => sum + (v?.npv || 0), 0),
      avgIrr: currentVersions.length > 0 ? currentVersions.reduce((sum, v) => sum + (v?.irr || 0), 0) / currentVersions.length : 0,
      avgDscr: currentVersions.length > 0 ? currentVersions.reduce((sum, v) => sum + (v?.dscr || 0), 0) / currentVersions.length : 0,
      totalModels: models.length,
      totalVersions: models.length,
    };
  }, [portfolioSummaryData, models]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <h1 className="text-2xl font-semibold">Portfolio Comparison</h1>
          <p className="text-muted-foreground">Compare financial models across all projects with variance tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">TOTAL NPV</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(portfolioSummary.totalNpv)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">AVG IRR</p>
            <p className="text-2xl font-bold">{formatPercent(portfolioSummary.avgIrr)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">AVG DSCR</p>
            <p className="text-2xl font-bold">{portfolioSummary.avgDscr.toFixed(2)}x</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">MODELS</p>
            <p className="text-2xl font-bold">{portfolioSummary.totalModels}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">TOTAL VERSIONS</p>
            <p className="text-2xl font-bold">{portfolioSummary.totalVersions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="comparison" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="comparison">Side-by-Side</TabsTrigger>
            <TabsTrigger value="variance">Variance Trends</TabsTrigger>
            <TabsTrigger value="history">Version History</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Side-by-Side Comparison */}
        <TabsContent value="comparison" className="space-y-4">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            {selectedModels.size > 0 && (
              <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{selectedModels.size} selected</span>
                <Button variant="ghost" size="sm" onClick={() => setCompareMode(true)} className="h-7">
                  Compare Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 px-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {!compareMode && selectedModels.size === 0 && (
              <Button variant="outline" size="sm" onClick={selectAllModels}>
                Select All
              </Button>
            )}
            {compareMode && (
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Show All Models
              </Button>
            )}
            <span className="text-sm text-muted-foreground">Compare by:</span>
            <div className="flex gap-2">
              {['npv', 'irr', 'dscr', 'payback', 'ebitda'].map((metric) => (
                <Button
                  key={metric}
                  variant={selectedMetric === metric ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric(metric)}
                  className="capitalize"
                >
                  {metric}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                Cards
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                Table
              </Button>
            </div>
          </div>

          {displayModels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>No financial models found. Upload models to see portfolio comparison.</p>
              </CardContent>
            </Card>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-2 gap-4">
              {displayModels.map((model) => (
                <VersionCard
                  key={model.id}
                  model={model}
                  expanded={expandedModels.has(model.id)}
                  onToggle={() => toggleExpanded(model.id)} 
                  selected={selectedModels.has(model.id)} 
                  onSelect={(checked) => toggleModelSelection(model.id, checked as boolean)} 
                  onNavigate={() => navigateToModel(model.projectName)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ComparisonTable models={filteredModels} metric={selectedMetric} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Variance Trends */}
        <TabsContent value="variance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Actual vs Projected Variance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VarianceTrendChart models={filteredModels} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Version History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Model Version Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayModels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No models to display</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {displayModels.map((model) => (
                    <div key={model.id} className="border-b pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{model.projectName}</h3>
                          <p className="text-sm text-muted-foreground">{model.modelName}</p>
                        </div>
                        <Badge>{model.versions.length} versions</Badge>
                      </div>
                      <div className="relative pl-4 border-l-2 border-muted space-y-3">
                        {model.versions.map((version, idx) => (
                          <div 
                            key={version.version}
                            className={cn(
                              "relative pl-4",
                              idx === 0 && "font-medium"
                            )}
                          >
                            <div className={cn(
                              "absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2",
                              idx === 0 ? "bg-primary border-primary" : "bg-background border-muted-foreground"
                            )} />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={idx === 0 ? "text-primary" : ""}>{version.version}</span>
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {version.date}
                                </span>
                                <Badge variant={idx === 0 ? 'default' : 'outline'} className="text-xs">
                                  {version.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>NPV: {formatCurrency(version.npv)}</span>
                                <span>IRR: {formatPercent(version.irr)}</span>
                                <span>DSCR: {version.dscr.toFixed(2)}x</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}
