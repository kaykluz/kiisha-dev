/**
 * Project Classification Charts
 * 
 * In KIISHA terminology:
 * - Asset = Project-level investable unit (e.g., "UMZA Oil Mill Solar+BESS")
 * - Component/Equipment = Sub-assets within a project (inverters, batteries, etc.)
 * 
 * This component displays classification distribution for project-level assets.
 */

import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { 
  PieChart, BarChart3, Network, Grid3X3, Download, 
  Circle, BarChart2, Layers, Zap, Globe, Activity, Flag
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Color palette for charts
const COLORS = [
  '#F97316', // orange (brand)
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F59E0B', // amber
  '#6366F1', // indigo
  '#84CC16', // lime
  '#06B6D4', // cyan
];

// Human-readable labels
const CLASSIFICATION_LABELS: Record<string, string> = {
  residential: 'Residential',
  small_commercial: 'Small Commercial',
  large_commercial: 'Large Commercial',
  industrial: 'Industrial',
  mini_grid: 'Mini-Grid',
  mesh_grid: 'Mesh Grid',
  interconnected_mini_grids: 'Interconnected',
  grid_connected: 'Grid Connected',
};

const GRID_CONNECTION_LABELS: Record<string, string> = {
  grid_tied: 'Grid-Tied',
  islanded: 'Islanded',
  islandable: 'Islandable',
  weak_grid: 'Weak Grid',
  no_grid: 'No Grid',
};

const CONFIG_LABELS: Record<string, string> = {
  solar_only: 'Solar Only',
  solar_bess: 'Solar + BESS',
  solar_genset: 'Solar + Genset',
  solar_bess_genset: 'Solar + BESS + Genset',
  bess_only: 'BESS Only',
  genset_only: 'Genset Only',
  hybrid: 'Hybrid',
};

const TOPOLOGY_LABELS: Record<string, string> = {
  radial: 'Radial',
  ring: 'Ring',
  mesh: 'Mesh',
  star: 'Star',
  unknown: 'Unknown',
};

const STATUS_LABELS: Record<string, string> = {
  prospecting: 'Prospecting',
  development: 'Development',
  construction: 'Construction',
  operational: 'Operational',
  decommissioned: 'Decommissioned',
};

const STAGE_LABELS: Record<string, string> = {
  origination: 'Origination',
  feasibility: 'Feasibility',
  development: 'Development',
  due_diligence: 'Due Diligence',
  ntp: 'NTP',
  construction: 'Construction',
  commissioning: 'Commissioning',
  cod: 'COD',
  operations: 'Operations',
};

const TECHNOLOGY_LABELS: Record<string, string> = {
  PV: 'Solar PV',
  BESS: 'Battery Storage',
  'PV+BESS': 'Solar + Storage',
  Wind: 'Wind',
  Minigrid: 'Mini-Grid',
  'C&I': 'C&I',
};

interface ChartData {
  name: string;
  value: number;
  capacityMw?: number;
}

type ChartType = 'donut' | 'bar' | 'pie';

// Chart type selector icons
function ChartTypeSelector({ 
  selected, 
  onChange 
}: { 
  selected: ChartType; 
  onChange: (type: ChartType) => void;
}) {
  return (
    <div className="flex gap-0.5 ml-auto">
      <button
        onClick={() => onChange('donut')}
        className={cn(
          "p-1 rounded transition-colors",
          selected === 'donut' 
            ? "bg-[var(--color-brand-primary)] text-white" 
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
        )}
        title="Donut Chart"
      >
        <Circle className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange('pie')}
        className={cn(
          "p-1 rounded transition-colors",
          selected === 'pie' 
            ? "bg-[var(--color-brand-primary)] text-white" 
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
        )}
        title="Pie Chart"
      >
        <PieChart className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onChange('bar')}
        className={cn(
          "p-1 rounded transition-colors",
          selected === 'bar' 
            ? "bg-[var(--color-brand-primary)] text-white" 
            : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
        )}
        title="Bar Chart"
      >
        <BarChart2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Donut/Pie Chart component
function CircularChart({ 
  data, 
  title, 
  icon: Icon, 
  labels,
  chartType = 'donut',
  showCapacity = false
}: { 
  data: ChartData[]; 
  title: string; 
  icon: typeof PieChart;
  labels: Record<string, string>;
  chartType?: 'donut' | 'pie';
  showCapacity?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const totalCapacity = data.reduce((sum, d) => sum + (d.capacityMw || 0), 0);
  
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <Icon className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  // Calculate segments
  let currentAngle = 0;
  const segments = data.map((d, i) => {
    const percentage = d.value / total;
    const startAngle = currentAngle;
    const endAngle = currentAngle + percentage * 360;
    currentAngle = endAngle;
    return {
      ...d,
      percentage,
      startAngle,
      endAngle,
      color: COLORS[i % COLORS.length],
    };
  });

  const size = 120;
  const strokeWidth = chartType === 'donut' ? 24 : 60;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-4 flex-1">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((segment, i) => {
            const offset = (segment.startAngle / 360) * circumference;
            const length = (segment.percentage) * circumference;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="transition-all duration-300"
              />
            );
          })}
        </svg>
        {chartType === 'donut' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-[var(--color-text-primary)]">{total}</span>
            {showCapacity && totalCapacity > 0 && (
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                {totalCapacity.toFixed(1)} MW
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 space-y-1 max-h-[120px] overflow-y-auto">
        {segments.slice(0, 5).map((segment, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0" 
              style={{ backgroundColor: segment.color }} 
            />
            <span className="text-[var(--color-text-secondary)] truncate flex-1">
              {labels[segment.name] || segment.name}
            </span>
            <span className="text-[var(--color-text-tertiary)] tabular-nums">
              {segment.value}
            </span>
          </div>
        ))}
        {segments.length > 5 && (
          <div className="text-xs text-[var(--color-text-tertiary)]">
            +{segments.length - 5} more
          </div>
        )}
      </div>
    </div>
  );
}

// Horizontal Bar Chart component
function HorizontalBarChart({ 
  data, 
  labels,
  showCapacity = false
}: { 
  data: ChartData[]; 
  labels: Record<string, string>;
  showCapacity?: boolean;
}) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 flex-1 overflow-y-auto">
      {data.slice(0, 6).map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-text-secondary)] truncate">
              {labels[item.name] || item.name}
            </span>
            <span className="text-[var(--color-text-tertiary)] tabular-nums ml-2">
              {item.value}
              {showCapacity && item.capacityMw ? ` (${item.capacityMw.toFixed(1)} MW)` : ''}
            </span>
          </div>
          <div className="h-2 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length]
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Chart Card wrapper with type selector
function ChartCard({ 
  title, 
  icon: Icon, 
  data, 
  labels,
  storageKey,
  showCapacity = false
}: { 
  title: string; 
  icon: typeof PieChart; 
  data: ChartData[];
  labels: Record<string, string>;
  storageKey: string;
  showCapacity?: boolean;
}) {
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(`project-chart-type-${storageKey}`) as ChartType) || 'donut';
    }
    return 'donut';
  });

  useEffect(() => {
    localStorage.setItem(`project-chart-type-${storageKey}`, chartType);
  }, [chartType, storageKey]);

  return (
    <div className="p-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-card)] min-h-[180px] flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{title}</span>
        <ChartTypeSelector selected={chartType} onChange={setChartType} />
      </div>
      
      {chartType === 'bar' ? (
        <HorizontalBarChart data={data} labels={labels} showCapacity={showCapacity} />
      ) : (
        <CircularChart 
          data={data} 
          title={title} 
          icon={Icon} 
          labels={labels}
          chartType={chartType}
          showCapacity={showCapacity}
        />
      )}
    </div>
  );
}

// Filter interface
export interface ProjectClassificationFilters {
  portfolioId?: number;
  organizationId?: number;
  country?: string;
  status?: string;
  stage?: string;
  assetClassification?: string;
  gridConnectionType?: string;
  configurationProfile?: string;
  networkTopology?: string;
}

// Main component with filter support
export function ProjectClassificationCharts({ 
  filters,
  onExport 
}: { 
  filters?: ProjectClassificationFilters;
  onExport?: () => void;
}) {
  const { data: stats, isLoading } = trpc.projects.getClassificationStats.useQuery(filters);

  const handleExport = () => {
    if (!stats) return;
    
    // Build CSV content
    const lines: string[] = ['Category,Type,Count,Capacity (MW)'];
    
    stats.byClassification.forEach(item => {
      lines.push(`Classification,${CLASSIFICATION_LABELS[item.name] || item.name},${item.value},${item.capacityMw || 0}`);
    });
    stats.byGridConnection.forEach(item => {
      lines.push(`Grid Connection,${GRID_CONNECTION_LABELS[item.name] || item.name},${item.value},`);
    });
    stats.byConfiguration.forEach(item => {
      lines.push(`Configuration,${CONFIG_LABELS[item.name] || item.name},${item.value},`);
    });
    stats.byTopology.forEach(item => {
      lines.push(`Topology,${TOPOLOGY_LABELS[item.name] || item.name},${item.value},`);
    });
    stats.byCountry.forEach(item => {
      lines.push(`Country,${item.name},${item.value},${item.capacityMw || 0}`);
    });
    stats.byStatus.forEach(item => {
      lines.push(`Status,${STATUS_LABELS[item.name] || item.name},${item.value},`);
    });
    stats.byStage.forEach(item => {
      lines.push(`Stage,${STAGE_LABELS[item.name] || item.name},${item.value},`);
    });
    stats.byTechnology.forEach(item => {
      lines.push(`Technology,${TECHNOLOGY_LABELS[item.name] || item.name},${item.value},${item.capacityMw || 0}`);
    });
    
    // Add totals
    lines.push('');
    lines.push(`Total Assets,${stats.total},,`);
    lines.push(`Total Capacity (MW),${stats.totalCapacityMw.toFixed(2)},,`);
    lines.push(`Total Value (USD),${stats.totalValueUsd.toLocaleString()},,`);
    
    // Download CSV
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    onExport?.();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-card)]">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-card)] text-center">
        <PieChart className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)] opacity-50" />
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No project-level assets in this view.
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
          Add projects with classification data to see distribution charts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">{stats.total}</span> assets
          <span className="mx-2">•</span>
          <span className="font-medium text-[var(--color-text-primary)]">{stats.totalCapacityMw.toFixed(1)}</span> MW
          <span className="mx-2">•</span>
          <span className="font-medium text-[var(--color-text-primary)]">${(stats.totalValueUsd / 1000000).toFixed(1)}M</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleExport}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <ChartCard 
          title="By Classification" 
          icon={Layers}
          data={stats.byClassification}
          labels={CLASSIFICATION_LABELS}
          storageKey="classification"
          showCapacity
        />
        
        <ChartCard 
          title="By Grid Connection" 
          icon={Network}
          data={stats.byGridConnection}
          labels={GRID_CONNECTION_LABELS}
          storageKey="grid-connection"
        />
        
        <ChartCard 
          title="Configuration Profile" 
          icon={Zap}
          data={stats.byConfiguration}
          labels={CONFIG_LABELS}
          storageKey="configuration"
        />
        
        <ChartCard 
          title="By Country" 
          icon={Globe}
          data={stats.byCountry}
          labels={{}} // Countries use their own names
          storageKey="country"
          showCapacity
        />
        
        <ChartCard 
          title="By Status" 
          icon={Activity}
          data={stats.byStatus}
          labels={STATUS_LABELS}
          storageKey="status"
        />
        
        <ChartCard 
          title="By Technology" 
          icon={Flag}
          data={stats.byTechnology}
          labels={TECHNOLOGY_LABELS}
          storageKey="technology"
          showCapacity
        />
      </div>
    </div>
  );
}

// Compact summary version
export function ProjectClassificationSummary({ filters }: { filters?: ProjectClassificationFilters }) {
  const { data: stats, isLoading } = trpc.projects.getClassificationStats.useQuery(filters);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!stats || stats.total === 0) {
    return null;
  }

  const topClassification = stats.byClassification[0];
  const topCountry = stats.byCountry[0];

  return (
    <div className="p-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-card)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          Asset Portfolio
        </span>
        <span className="text-sm font-bold text-[var(--color-text-primary)]">{stats.total}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-secondary)]">Total Capacity</span>
          <span className="text-[var(--color-text-primary)]">{stats.totalCapacityMw.toFixed(1)} MW</span>
        </div>
        {topClassification && (
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Top Classification</span>
            <span className="text-[var(--color-text-primary)]">
              {CLASSIFICATION_LABELS[topClassification.name] || topClassification.name} ({topClassification.value})
            </span>
          </div>
        )}
        {topCountry && (
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Top Country</span>
            <span className="text-[var(--color-text-primary)]">
              {topCountry.name} ({topCountry.value})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Export labels for use in other components
export { 
  CLASSIFICATION_LABELS, 
  GRID_CONNECTION_LABELS, 
  CONFIG_LABELS, 
  TOPOLOGY_LABELS,
  STATUS_LABELS,
  STAGE_LABELS,
  TECHNOLOGY_LABELS
};
