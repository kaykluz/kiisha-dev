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
  Columns3,
  Search,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  X,
} from "lucide-react";

interface DataField {
  id: string;
  category: string;
  field: string;
  unit?: string;
  values: Record<number, { value: string; source?: string; documentName?: string }>;
}

const DATA_CATEGORIES = [
  {
    name: "Project Overview",
    fields: [
      { field: "Technology", key: "technology" },
      { field: "Capacity (MW DC)", key: "capacityMw", unit: "MW" },
      { field: "Storage (MWh)", key: "capacityMwh", unit: "MWh" },
      { field: "Status", key: "status" },
      { field: "Stage", key: "stage" },
      { field: "COD Date", key: "codDate" },
    ],
  },
  {
    name: "Location",
    fields: [
      { field: "Country", key: "country" },
      { field: "State", key: "state" },
      { field: "City", key: "city" },
      { field: "Latitude", key: "latitude" },
      { field: "Longitude", key: "longitude" },
    ],
  },
  {
    name: "Off-taker",
    fields: [
      { field: "Off-taker Name", key: "offtakerName" },
      { field: "Off-taker Type", key: "offtakerType" },
      { field: "Contract Type", key: "contractType" },
      { field: "Tariff ($/kWh)", key: "tariffUsdKwh", unit: "$/kWh" },
    ],
  },
  {
    name: "Financial",
    fields: [
      { field: "Project Value", key: "projectValueUsd", unit: "USD" },
      { field: "Cost per Watt", key: "costPerWatt", unit: "$/W" },
    ],
  },
  {
    name: "Classification",
    fields: [
      { field: "Asset Classification", key: "assetClassification" },
      { field: "Grid Connection", key: "gridConnectionType" },
      { field: "Configuration", key: "configurationProfile" },
      { field: "Coupling Topology", key: "couplingTopology" },
    ],
  },
];

function DataComparisonContent() {
  const { state: authState } = useAuth();
  const orgId = authState?.activeOrganization?.id ?? 1;
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(DATA_CATEGORIES.map(c => c.name)));

  const { data: allProjects } = trpc.projects.list.useQuery();
  const projects = allProjects ?? [];

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const getFieldValue = (project: any, key: string): string => {
    if (key === "costPerWatt") {
      const value = parseFloat(project.projectValueUsd) || 0;
      const mw = parseFloat(project.capacityMw) || 0;
      if (mw > 0 && value > 0) return `$${(value / (mw * 1_000_000)).toFixed(2)}`;
      return "-";
    }
    const val = project[key];
    if (val === null || val === undefined || val === "") return "-";
    if (key === "projectValueUsd") return `$${Number(val).toLocaleString()}`;
    return String(val);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return DATA_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return DATA_CATEGORIES.map(cat => ({
      ...cat,
      fields: cat.fields.filter(f => f.field.toLowerCase().includes(q)),
    })).filter(cat => cat.fields.length > 0);
  }, [searchQuery]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Columns3 className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Data Comparison</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Compare extracted data fields across projects</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-1" /> Export to Excel
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search fields..." className="pl-9" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                </button>
              )}
            </div>
            <span className="text-xs text-[var(--color-text-tertiary)]">{projects.length} projects</span>
          </div>
        </div>

        <div className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <Columns3 className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p className="text-lg font-medium">No projects to compare</p>
              <p className="text-sm mt-1">Create projects to see the data comparison</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-r border-[var(--color-border-primary)] min-w-[220px]">
                        Data Field
                      </th>
                      {projects.map((project: any) => (
                        <th key={project.id} className="bg-[var(--color-bg-secondary)] text-center px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-primary)] min-w-[150px]">
                          <div className="truncate" title={project.name}>{project.name}</div>
                          <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{project.technology} | {project.capacityMw || "?"} MW</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map(cat => (
                      <>
                        <tr key={`cat-${cat.name}`}>
                          <td
                            colSpan={projects.length + 1}
                            className="sticky left-0 z-10 bg-[var(--color-bg-tertiary)] px-4 py-2 cursor-pointer border-b border-[var(--color-border-primary)]"
                            onClick={() => toggleCategory(cat.name)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedCategories.has(cat.name) ? <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />}
                              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{cat.name}</span>
                              <Badge variant="secondary" className="text-[10px]">{cat.fields.length}</Badge>
                            </div>
                          </td>
                        </tr>
                        {expandedCategories.has(cat.name) && cat.fields.map(field => (
                          <tr key={`field-${field.key}`} className="hover:bg-[var(--color-bg-secondary)]/50">
                            <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] px-4 py-2.5 border-b border-r border-[var(--color-border-primary)]">
                              <div className="pl-6 flex items-center gap-1.5">
                                <span className="text-sm text-[var(--color-text-primary)]">{field.field}</span>
                                {field.unit && <span className="text-[10px] text-[var(--color-text-tertiary)]">({field.unit})</span>}
                              </div>
                            </td>
                            {projects.map((project: any) => {
                              const val = getFieldValue(project, field.key);
                              const isDiff = projects.length > 1 && projects.some((p: any) => getFieldValue(p, field.key) !== val);
                              return (
                                <td key={project.id} className={`text-center px-4 py-2.5 border-b border-[var(--color-border-primary)] ${isDiff ? "bg-[var(--color-semantic-warning)]/5" : ""}`}>
                                  <span className="text-sm text-[var(--color-text-primary)]">{val}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function DataComparison() {
  return <DataComparisonContent />;
}
