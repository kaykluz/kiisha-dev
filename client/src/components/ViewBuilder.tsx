/**
 * View Builder Component
 * 
 * Allows users to create custom views by selecting data sources,
 * fields, and filters from documents across their accessible scope.
 */

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Filter,
  SortAsc,
  SortDesc,
  Save,
  Share2,
  Copy,
  MoreVertical,
  FileText,
  Database,
  Layers,
  Settings,
  Lock,
  Unlock,
  Users,
  Building2,
  FolderOpen,
  Check,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface DataSource {
  id: string;
  name: string;
  type: "document" | "template" | "vatr" | "project";
  fields: Field[];
}

interface Field {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "currency";
  sourceId: string;
}

interface SelectedField extends Field {
  visible: boolean;
  sortOrder?: "asc" | "desc";
  filter?: {
    operator: "equals" | "contains" | "gt" | "lt" | "between";
    value: string | number;
  };
}

interface ViewConfig {
  id?: string;
  name: string;
  description: string;
  dataSources: string[];
  fields: SelectedField[];
  accessLevel: "private" | "project" | "team" | "organization";
  isShared: boolean;
  sharedWith: string[];
  collaborativeMode: boolean;
  frozenSnapshot: boolean;
}

// Mock data sources
const mockDataSources: DataSource[] = [
  {
    id: "ds-1",
    name: "Project Documents",
    type: "document",
    fields: [
      { id: "f-1", name: "Document Name", type: "text", sourceId: "ds-1" },
      { id: "f-2", name: "Upload Date", type: "date", sourceId: "ds-1" },
      { id: "f-3", name: "Category", type: "text", sourceId: "ds-1" },
      { id: "f-4", name: "Status", type: "text", sourceId: "ds-1" },
    ],
  },
  {
    id: "ds-2",
    name: "Financial Models",
    type: "template",
    fields: [
      { id: "f-5", name: "Project Name", type: "text", sourceId: "ds-2" },
      { id: "f-6", name: "IRR", type: "number", sourceId: "ds-2" },
      { id: "f-7", name: "NPV", type: "currency", sourceId: "ds-2" },
      { id: "f-8", name: "Payback Period", type: "number", sourceId: "ds-2" },
    ],
  },
  {
    id: "ds-3",
    name: "VATR Facts",
    type: "vatr",
    fields: [
      { id: "f-9", name: "Fact Type", type: "text", sourceId: "ds-3" },
      { id: "f-10", name: "Value", type: "text", sourceId: "ds-3" },
      { id: "f-11", name: "Confidence", type: "number", sourceId: "ds-3" },
      { id: "f-12", name: "Source Document", type: "text", sourceId: "ds-3" },
      { id: "f-13", name: "Evidence Date", type: "date", sourceId: "ds-3" },
    ],
  },
  {
    id: "ds-4",
    name: "Project Details",
    type: "project",
    fields: [
      { id: "f-14", name: "Project Name", type: "text", sourceId: "ds-4" },
      { id: "f-15", name: "Capacity (kW)", type: "number", sourceId: "ds-4" },
      { id: "f-16", name: "Location", type: "text", sourceId: "ds-4" },
      { id: "f-17", name: "COD", type: "date", sourceId: "ds-4" },
      { id: "f-18", name: "Status", type: "text", sourceId: "ds-4" },
    ],
  },
];

interface ViewBuilderProps {
  existingView?: ViewConfig;
  onSave?: (view: ViewConfig) => void;
  onCancel?: () => void;
}

export function ViewBuilder({ existingView, onSave, onCancel }: ViewBuilderProps) {
  const [viewConfig, setViewConfig] = useState<ViewConfig>(
    existingView || {
      name: "",
      description: "",
      dataSources: [],
      fields: [],
      accessLevel: "private",
      isShared: false,
      sharedWith: [],
      collaborativeMode: false,
      frozenSnapshot: true,
    }
  );
  const [activeTab, setActiveTab] = useState("sources");
  const [isSaving, setIsSaving] = useState(false);

  // Get available fields from selected data sources
  const availableFields = mockDataSources
    .filter((ds) => viewConfig.dataSources.includes(ds.id))
    .flatMap((ds) => ds.fields);

  // Toggle data source selection
  const toggleDataSource = (sourceId: string) => {
    setViewConfig((prev) => {
      const isSelected = prev.dataSources.includes(sourceId);
      const newSources = isSelected
        ? prev.dataSources.filter((id) => id !== sourceId)
        : [...prev.dataSources, sourceId];

      // Remove fields from deselected sources
      const newFields = isSelected
        ? prev.fields.filter((f) => f.sourceId !== sourceId)
        : prev.fields;

      return {
        ...prev,
        dataSources: newSources,
        fields: newFields,
      };
    });
  };

  // Add field to view
  const addField = (field: Field) => {
    if (viewConfig.fields.some((f) => f.id === field.id)) return;

    setViewConfig((prev) => ({
      ...prev,
      fields: [
        ...prev.fields,
        { ...field, visible: true },
      ],
    }));
  };

  // Remove field from view
  const removeField = (fieldId: string) => {
    setViewConfig((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== fieldId),
    }));
  };

  // Toggle field visibility
  const toggleFieldVisibility = (fieldId: string) => {
    setViewConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === fieldId ? { ...f, visible: !f.visible } : f
      ),
    }));
  };

  // Set field sort order
  const setFieldSort = (fieldId: string, order?: "asc" | "desc") => {
    setViewConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === fieldId ? { ...f, sortOrder: order } : { ...f, sortOrder: undefined }
      ),
    }));
  };

  // Handle save
  const handleSave = async () => {
    if (!viewConfig.name.trim()) {
      toast.error("Please enter a view name");
      return;
    }

    if (viewConfig.fields.length === 0) {
      toast.error("Please add at least one field to the view");
      return;
    }

    setIsSaving(true);
    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("View saved successfully");
      onSave?.(viewConfig);
    } catch (error) {
      toast.error("Failed to save view");
    } finally {
      setIsSaving(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "document":
        return <FileText className="w-4 h-4" />;
      case "template":
        return <Layers className="w-4 h-4" />;
      case "vatr":
        return <Database className="w-4 h-4" />;
      case "project":
        return <FolderOpen className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Input
            placeholder="View Name"
            value={viewConfig.name}
            onChange={(e) => setViewConfig((prev) => ({ ...prev, name: e.target.value }))}
            className="text-xl font-bold border-none bg-transparent px-0 focus-visible:ring-0"
          />
          <Input
            placeholder="Description (optional)"
            value={viewConfig.description}
            onChange={(e) => setViewConfig((prev) => ({ ...prev, description: e.target.value }))}
            className="text-sm text-muted-foreground border-none bg-transparent px-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save View
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sources">Data Sources</TabsTrigger>
          <TabsTrigger value="fields">Fields & Layout</TabsTrigger>
          <TabsTrigger value="access">Access & Sharing</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Select Data Sources</CardTitle>
              <CardDescription>
                Choose the data sources to include in your custom view
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockDataSources.map((source) => {
                  const isSelected = viewConfig.dataSources.includes(source.id);
                  return (
                    <div
                      key={source.id}
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => toggleDataSource(source.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            isSelected ? "bg-primary/20" : "bg-muted"
                          )}>
                            {getSourceIcon(source.type)}
                          </div>
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {source.fields.length} fields available
                            </p>
                          </div>
                        </div>
                        <Checkbox checked={isSelected} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Available Fields */}
            <Card>
              <CardHeader>
                <CardTitle>Available Fields</CardTitle>
                <CardDescription>
                  Click to add fields to your view
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {viewConfig.dataSources.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Select data sources first
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {mockDataSources
                        .filter((ds) => viewConfig.dataSources.includes(ds.id))
                        .map((source) => (
                          <div key={source.id}>
                            <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                              {getSourceIcon(source.type)}
                              {source.name}
                            </p>
                            <div className="space-y-1">
                              {source.fields.map((field) => {
                                const isAdded = viewConfig.fields.some((f) => f.id === field.id);
                                return (
                                  <div
                                    key={field.id}
                                    className={cn(
                                      "flex items-center justify-between p-2 rounded-lg cursor-pointer",
                                      isAdded
                                        ? "bg-muted/50 text-muted-foreground"
                                        : "hover:bg-muted"
                                    )}
                                    onClick={() => !isAdded && addField(field)}
                                  >
                                    <span className="text-sm">{field.name}</span>
                                    {isAdded ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Plus className="w-4 h-4" />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Selected Fields */}
            <Card>
              <CardHeader>
                <CardTitle>View Fields</CardTitle>
                <CardDescription>
                  Drag to reorder, configure visibility and sorting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {viewConfig.fields.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      Add fields from the left panel
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {viewConfig.fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 group"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                          <span className="flex-1 text-sm">{field.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleFieldVisibility(field.id)}
                            >
                              {field.visible ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                setFieldSort(
                                  field.id,
                                  field.sortOrder === "asc"
                                    ? "desc"
                                    : field.sortOrder === "desc"
                                    ? undefined
                                    : "asc"
                                )
                              }
                            >
                              {field.sortOrder === "asc" ? (
                                <SortAsc className="w-3 h-3 text-primary" />
                              ) : field.sortOrder === "desc" ? (
                                <SortDesc className="w-3 h-3 text-primary" />
                              ) : (
                                <SortAsc className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => removeField(field.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="access" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Level</CardTitle>
              <CardDescription>
                Control who can see this view within your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { value: "private", label: "Private", icon: Lock, desc: "Only you" },
                  { value: "project", label: "Project", icon: FolderOpen, desc: "Project members" },
                  { value: "team", label: "Team", icon: Users, desc: "Team members" },
                  { value: "organization", label: "Organization", icon: Building2, desc: "All org members" },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      viewConfig.accessLevel === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    onClick={() =>
                      setViewConfig((prev) => ({
                        ...prev,
                        accessLevel: option.value as ViewConfig["accessLevel"],
                      }))
                    }
                  >
                    <option.icon className="w-5 h-5 mb-2" />
                    <p className="font-medium">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>External Sharing</CardTitle>
              <CardDescription>
                Share this view with users outside your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable External Sharing</p>
                  <p className="text-sm text-muted-foreground">
                    Allow sharing with other organizations
                  </p>
                </div>
                <Switch
                  checked={viewConfig.isShared}
                  onCheckedChange={(checked) =>
                    setViewConfig((prev) => ({ ...prev, isShared: checked }))
                  }
                />
              </div>

              {viewConfig.isShared && (
                <>
                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Collaborative Mode</p>
                        <p className="text-sm text-muted-foreground">
                          Allow external users to see live updates
                        </p>
                      </div>
                      <Switch
                        checked={viewConfig.collaborativeMode}
                        onCheckedChange={(checked) =>
                          setViewConfig((prev) => ({
                            ...prev,
                            collaborativeMode: checked,
                            frozenSnapshot: !checked,
                          }))
                        }
                      />
                    </div>

                    {!viewConfig.collaborativeMode && (
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-500 mb-2">
                          <Lock className="w-4 h-4" />
                          <span className="font-medium">Frozen Snapshot Mode</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          External recipients will see a frozen snapshot of the view as it was
                          when shared. They will not see any subsequent updates.
                        </p>
                      </div>
                    )}

                    {viewConfig.collaborativeMode && (
                      <div className="p-4 bg-green-500/10 rounded-lg">
                        <div className="flex items-center gap-2 text-green-500 mb-2">
                          <Unlock className="w-4 h-4" />
                          <span className="font-medium">Live Collaborative Mode</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          External recipients will see live updates to this view. Use this for
                          multi-organization collaboration on shared projects.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// View List Component for managing multiple views
export function ViewList() {
  const [views, setViews] = useState<ViewConfig[]>([
    {
      id: "v-1",
      name: "Project Overview",
      description: "Key metrics across all projects",
      dataSources: ["ds-2", "ds-4"],
      fields: [],
      accessLevel: "organization",
      isShared: false,
      sharedWith: [],
      collaborativeMode: false,
      frozenSnapshot: true,
    },
    {
      id: "v-2",
      name: "Financial Summary",
      description: "IRR and NPV analysis",
      dataSources: ["ds-2"],
      fields: [],
      accessLevel: "team",
      isShared: true,
      sharedWith: ["org-external"],
      collaborativeMode: false,
      frozenSnapshot: true,
    },
  ]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingView, setEditingView] = useState<ViewConfig | undefined>();

  const handleCreateView = () => {
    setEditingView(undefined);
    setIsBuilderOpen(true);
  };

  const handleEditView = (view: ViewConfig) => {
    setEditingView(view);
    setIsBuilderOpen(true);
  };

  const handleSaveView = (view: ViewConfig) => {
    if (view.id) {
      setViews((prev) => prev.map((v) => (v.id === view.id ? view : v)));
    } else {
      setViews((prev) => [...prev, { ...view, id: `v-${Date.now()}` }]);
    }
    setIsBuilderOpen(false);
  };

  const handleDeleteView = (viewId: string) => {
    setViews((prev) => prev.filter((v) => v.id !== viewId));
    toast.success("View deleted");
  };

  const getAccessIcon = (level: string) => {
    switch (level) {
      case "private":
        return <Lock className="w-4 h-4" />;
      case "project":
        return <FolderOpen className="w-4 h-4" />;
      case "team":
        return <Users className="w-4 h-4" />;
      case "organization":
        return <Building2 className="w-4 h-4" />;
      default:
        return <Lock className="w-4 h-4" />;
    }
  };

  if (isBuilderOpen) {
    return (
      <ViewBuilder
        existingView={editingView}
        onSave={handleSaveView}
        onCancel={() => setIsBuilderOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My Views</h2>
          <p className="text-muted-foreground">
            Create and manage custom views across your data
          </p>
        </div>
        <Button onClick={handleCreateView}>
          <Plus className="w-4 h-4 mr-2" />
          Create View
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {views.map((view) => (
          <Card key={view.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{view.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditView(view)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="w-4 h-4 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteView(view.id!)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardDescription>{view.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  {getAccessIcon(view.accessLevel)}
                  {view.accessLevel}
                </Badge>
                {view.isShared && (
                  <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-400 border-blue-500/30">
                    <ExternalLink className="w-3 h-3" />
                    {view.collaborativeMode ? "Live" : "Frozen"}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" className="w-full mt-4" onClick={() => handleEditView(view)}>
                <Eye className="w-4 h-4 mr-2" />
                Open View
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
