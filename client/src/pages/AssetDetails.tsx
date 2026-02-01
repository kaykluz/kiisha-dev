import { useState } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import {
  Download,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Sparkles,
  Quote,
  Loader2,
} from "lucide-react";
import { ViewSourceButton, EvidenceSource } from "@/components/ViewSource";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";

// Confidence indicator component
function ConfidenceIndicator({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const percentage = Math.round(confidence * 100);
  const color = percentage >= 80 ? "var(--color-success)" : percentage >= 50 ? "var(--color-warning)" : "var(--color-error)";
  
  return (
    <span 
      className="text-[10px] font-medium ml-1" 
      style={{ color }}
      title={`AI Confidence: ${percentage}%`}
    >
      {percentage}%
    </span>
  );
}

// AI indicator component
function AiIndicator() {
  return (
    <span 
      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[var(--color-info)] bg-[var(--color-info-muted)] px-1 py-0.5 rounded"
      title="AI Extracted"
    >
      <Sparkles className="w-2.5 h-2.5" />
      AI
    </span>
  );
}

// Editable cell component
interface EditableCellProps {
  value: string | null;
  isAiExtracted: boolean;
  aiConfidence: number | null;
  onSave: (value: string) => void;
  evidence?: EvidenceSource;
  onViewSource?: (evidence: EvidenceSource) => void;
}

function EditableCell({ value, isAiExtracted, aiConfidence, onSave, evidence, onViewSource }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-7 text-sm"
          autoFocus
        />
        <button 
          className="p-1 rounded hover:bg-[var(--color-success-muted)] text-[var(--color-success)]"
          onClick={handleSave}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button 
          className="p-1 rounded hover:bg-[var(--color-error-muted)] text-[var(--color-error)]"
          onClick={handleCancel}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-1.5 cursor-pointer hover:bg-[var(--color-bg-surface-hover)] rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      <span className="text-sm text-[var(--color-text-primary)]">{value || "—"}</span>
      {isAiExtracted && (
        <>
          <AiIndicator />
          <ConfidenceIndicator confidence={aiConfidence} />
          {evidence && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-0.5 rounded hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSource?.(evidence);
                    }}
                  >
                    <Quote className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View source document</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}
      <Pencil className="w-3 h-3 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
    </div>
  );
}

function AssetDetailsContent() {
  const { selectedProjectId } = useProject();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Site & Real Estate", "Interconnection", "Technical"])
  );

  // Fetch real data from API
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();

  const isLoading = projectsLoading;

  const filteredProjects = selectedProjectId
    ? projects.filter((p: any) => p.id === selectedProjectId)
    : projects;

  // Define standard asset detail categories and fields
  const standardCategories = [
    {
      category: "Site & Real Estate",
      subcategories: [
        {
          subcategory: "Lease",
          fields: ["Lease Term", "Annual Rent", "Escalation Rate", "Land Area (acres)"]
        },
        {
          subcategory: "Site",
          fields: ["Site Owner", "Address", "Coordinates", "Zoning"]
        }
      ]
    },
    {
      category: "Interconnection",
      subcategories: [
        {
          subcategory: null,
          fields: ["IC Type", "IC Limit (kW)", "Voltage", "Utility", "Substation"]
        }
      ]
    },
    {
      category: "Technical",
      subcategories: [
        {
          subcategory: "Equipment",
          fields: ["Module Type", "Inverter Type", "Capacity (MW)", "Tilt Angle"]
        },
        {
          subcategory: "Performance",
          fields: ["Expected Yield (MWh/yr)", "Performance Ratio", "Degradation Rate"]
        }
      ]
    },
    {
      category: "Financial",
      subcategories: [
        {
          subcategory: null,
          fields: ["PPA Rate", "PPA Term", "PPA Escalation", "LCOE"]
        }
      ]
    }
  ];

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // For now, return empty values since we don't have asset details in the database yet
  const getValue = (projectId: number, category: string, subcategory: string | null, fieldName: string) => {
    return null;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading asset details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (filteredProjects.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Asset Details</h1>
            <p className="page-subtitle">Spreadsheet view of all asset data with AI extraction indicators</p>
          </div>
        </div>
        <EmptyState
          type="projects"
          title="No projects yet"
          description="Create a project to start tracking asset details"
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Details</h1>
          <p className="page-subtitle">Spreadsheet view of all asset data with AI extraction indicators</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Spreadsheet View */}
      <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            {/* Header Row - Projects */}
            <div className="flex border-b border-[var(--color-border-subtle)] sticky top-0 bg-[var(--color-bg-surface)] z-10">
              <div className="w-72 shrink-0 p-3 border-r border-[var(--color-border-subtle)]">
                <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                  Field
                </span>
              </div>
              {filteredProjects.map((project: any) => (
                <div
                  key={project.id}
                  className="w-44 shrink-0 p-3 border-r border-[var(--color-border-subtle)]"
                >
                  <div className="text-sm font-medium text-[var(--color-text-primary)] truncate" title={project.name}>
                    {project.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                    {project.technology || 'PV'} • {project.capacityMw || project.capacityMwh || 0} {project.capacityMw ? "MW" : "MWh"}
                  </div>
                </div>
              ))}
            </div>

            {/* Data Rows by Category */}
            {standardCategories.map(({ category, subcategories }) => (
              <Collapsible
                key={category}
                open={expandedCategories.has(category)}
                onOpenChange={() => toggleCategory(category)}
              >
                {/* Category Header */}
                <CollapsibleTrigger className="w-full">
                  <div className="flex border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                    <div className="w-72 shrink-0 p-3 border-r border-[var(--color-border-subtle)] flex items-center gap-2">
                      {expandedCategories.has(category) ? (
                        <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                      )}
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{category}</span>
                    </div>
                    {filteredProjects.map((project: any) => (
                      <div
                        key={project.id}
                        className="w-44 shrink-0 border-r border-[var(--color-border-subtle)]"
                      />
                    ))}
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {subcategories.map(({ subcategory, fields }) => (
                    <div key={subcategory || "main"}>
                      {/* Subcategory Header */}
                      {subcategory && (
                        <div className="flex border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
                          <div className="w-72 shrink-0 p-2 pl-10 border-r border-[var(--color-border-subtle)]">
                            <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                              {subcategory}
                            </span>
                          </div>
                          {filteredProjects.map((project: any) => (
                            <div
                              key={project.id}
                              className="w-44 shrink-0 border-r border-[var(--color-border-subtle)]"
                            />
                          ))}
                        </div>
                      )}

                      {/* Field Rows */}
                      {fields.map((fieldName) => (
                        <div
                          key={fieldName}
                          className="flex border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                        >
                          <div className="w-72 shrink-0 p-2 pl-14 border-r border-[var(--color-border-subtle)]">
                            <span className="text-sm text-[var(--color-text-secondary)]">{fieldName}</span>
                          </div>
                          {filteredProjects.map((project: any) => {
                            const detail = getValue(project.id, category, subcategory, fieldName);
                            return (
                              <div
                                key={project.id}
                                className="w-44 shrink-0 p-2 border-r border-[var(--color-border-subtle)]"
                              >
                                <EditableCell
                                  value={null}
                                  isAiExtracted={false}
                                  aiConfidence={null}
                                  onSave={(value) => {
                                    console.log("Save:", project.id, fieldName, value);
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-8 mt-4 text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-2">
          <AiIndicator />
          <span>AI Extracted Value</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-success)] font-medium">80%+</span>
          <span>High Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-warning)] font-medium">50-79%</span>
          <span>Medium Confidence</span>
        </div>
        <div className="flex items-center gap-2">
          <Pencil className="w-3 h-3" />
          <span>Click to edit</span>
        </div>
      </div>
    </div>
  );
}

export default function AssetDetails() {
  return (
    <AppLayout>
      <AssetDetailsContent />
    </AppLayout>
  );
}
