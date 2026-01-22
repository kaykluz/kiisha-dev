import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Plus, Save, History, Share2, GitBranch, Eye, EyeOff,
  Columns, Filter, SortAsc, Layout, FileText, Clock
} from "lucide-react";

interface ViewDefinition {
  columns: string[];
  filters: Record<string, unknown>;
  grouping?: string[];
  sorting?: { field: string; direction: "asc" | "desc" }[];
  cardMode?: "summary" | "expanded" | "full";
  disclosureMode?: "summary" | "expanded" | "full";
  formRequirements?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

interface ViewTemplateEditorProps {
  templateId?: string;
  onSave?: (templateId: string) => void;
  onCancel?: () => void;
}

const AVAILABLE_COLUMNS = [
  "name", "status", "type", "location", "capacity", "owner",
  "createdAt", "updatedAt", "verificationStatus", "confidence",
  "technicalSpecs", "financialData", "complianceStatus"
];

const CATEGORIES = [
  { value: "due_diligence", label: "Due Diligence" },
  { value: "compliance", label: "Compliance" },
  { value: "reporting", label: "Reporting" },
  { value: "investor_relations", label: "Investor Relations" },
  { value: "operations", label: "Operations" },
  { value: "custom", label: "Custom" },
];

export function ViewTemplateEditor({ templateId, onSave, onCancel }: ViewTemplateEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("custom");
  const [isPublic, setIsPublic] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  
  const [definition, setDefinition] = useState<ViewDefinition>({
    columns: ["name", "status", "type"],
    filters: {},
    grouping: [],
    sorting: [{ field: "name", direction: "asc" }],
    cardMode: "summary",
    disclosureMode: "summary",
  });
  
  // Fetch existing template if editing
  const { data: template, isLoading } = trpc.versionedViews.templates.get.useQuery(
    { templateId: templateId! },
    { enabled: !!templateId }
  );
  
  // Initialize form with template data
  useState(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setCategory(template.category || "custom");
      setIsPublic(template.isPublic || false);
      if (template.currentVersion) {
        setDefinition(template.currentVersion.definitionJson as ViewDefinition);
      }
    }
  });
  
  const createMutation = trpc.versionedViews.templates.create.useMutation({
    onSuccess: (result) => {
      toast.success("Template created successfully");
      if (result && onSave) onSave(result.templateId);
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
  
  const publishMutation = trpc.versionedViews.templates.publishVersion.useMutation({
    onSuccess: (result) => {
      toast.success(`Version ${result?.versionNumber} published`);
      setShowPublishDialog(false);
      setChangelog("");
    },
    onError: (error) => {
      toast.error(`Failed to publish version: ${error.message}`);
    },
  });
  
  const handleCreate = () => {
    createMutation.mutate({
      name,
      description,
      category,
      isPublic,
      initialDefinition: definition,
    });
  };
  
  const handlePublish = () => {
    if (!templateId) return;
    publishMutation.mutate({
      templateId,
      definition,
      changelog,
    });
  };
  
  const toggleColumn = (column: string) => {
    setDefinition(prev => ({
      ...prev,
      columns: prev.columns.includes(column)
        ? prev.columns.filter(c => c !== column)
        : [...prev.columns, column],
    }));
  };
  
  const addSorting = (field: string) => {
    setDefinition(prev => ({
      ...prev,
      sorting: [...(prev.sorting || []), { field, direction: "asc" }],
    }));
  };
  
  const removeSorting = (index: number) => {
    setDefinition(prev => ({
      ...prev,
      sorting: prev.sorting?.filter((_, i) => i !== index),
    }));
  };
  
  const toggleSortDirection = (index: number) => {
    setDefinition(prev => ({
      ...prev,
      sorting: prev.sorting?.map((s, i) => 
        i === index ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" } : s
      ),
    }));
  };
  
  if (isLoading && templateId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{templateId ? "Edit View Template" : "Create View Template"}</CardTitle>
            <CardDescription>
              {templateId 
                ? `Editing template - changes will create a new version`
                : "Define a reusable view configuration"
              }
            </CardDescription>
          </div>
          {template && (
            <Badge variant="outline" className="flex items-center gap-1">
              <History className="h-3 w-3" />
              v{template.currentVersion?.versionNumber || 1}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Due Diligence Review"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this view is for..."
            rows={2}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={isPublic ? "default" : "outline"}
            size="sm"
            onClick={() => setIsPublic(!isPublic)}
          >
            {isPublic ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
            {isPublic ? "Public" : "Private"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {isPublic ? "Visible to all organization members" : "Only visible to you"}
          </span>
        </div>
        
        <Separator />
        
        {/* Definition Editor */}
        <Tabs defaultValue="columns" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="columns" className="flex items-center gap-1">
              <Columns className="h-4 w-4" />
              Columns
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filters
            </TabsTrigger>
            <TabsTrigger value="sorting" className="flex items-center gap-1">
              <SortAsc className="h-4 w-4" />
              Sorting
            </TabsTrigger>
            <TabsTrigger value="display" className="flex items-center gap-1">
              <Layout className="h-4 w-4" />
              Display
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="columns" className="mt-4">
            <div className="space-y-2">
              <Label>Select columns to display</Label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COLUMNS.map(column => (
                  <Button
                    key={column}
                    variant={definition.columns.includes(column) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleColumn(column)}
                  >
                    {column}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {definition.columns.length} columns selected
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="filters" className="mt-4">
            <div className="space-y-4">
              <Label>Filter Configuration</Label>
              <Textarea
                value={JSON.stringify(definition.filters, null, 2)}
                onChange={(e) => {
                  try {
                    const filters = JSON.parse(e.target.value);
                    setDefinition(prev => ({ ...prev, filters }));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"status": "active", "type": "solar"}'
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Enter filter criteria as JSON
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="sorting" className="mt-4">
            <div className="space-y-4">
              <Label>Sort Order</Label>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {definition.sorting?.map((sort, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Badge variant="secondary">{sort.field}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSortDirection(index)}
                      >
                        {sort.direction === "asc" ? "↑ Ascending" : "↓ Descending"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSorting(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Select onValueChange={addSorting}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Add sort field..." />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_COLUMNS.filter(c => !definition.sorting?.some(s => s.field === c)).map(column => (
                    <SelectItem key={column} value={column}>{column}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          
          <TabsContent value="display" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Card Mode</Label>
                <Select 
                  value={definition.cardMode || "summary"} 
                  onValueChange={(value: "summary" | "expanded" | "full") => 
                    setDefinition(prev => ({ ...prev, cardMode: value }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="expanded">Expanded</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Disclosure Mode</Label>
                <Select 
                  value={definition.disclosureMode || "summary"} 
                  onValueChange={(value: "summary" | "expanded" | "full") => 
                    setDefinition(prev => ({ ...prev, disclosureMode: value }))
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary - Basic fields only</SelectItem>
                    <SelectItem value="expanded">Expanded - Include details</SelectItem>
                    <SelectItem value="full">Full - All RBAC-allowed fields</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <Separator />
        
        {/* Version History (if editing) */}
        {template && template.versions && template.versions.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Version History
            </Label>
            <ScrollArea className="h-24 rounded border p-2">
              {template.versions.map((version: { id: string; versionNumber: number; changelog: string | null; createdAt: Date }) => (
                <div key={version.id} className="flex items-center justify-between py-1 text-sm">
                  <span className="font-medium">v{version.versionNumber}</span>
                  <span className="text-muted-foreground">{version.changelog || "No changelog"}</span>
                  <span className="text-muted-foreground">
                    {new Date(version.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          
          {templateId ? (
            <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
              <DialogTrigger asChild>
                <Button>
                  <GitBranch className="h-4 w-4 mr-1" />
                  Publish New Version
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Publish New Version</DialogTitle>
                  <DialogDescription>
                    This will create a new version of the template. Managed instances will be notified of the update.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="changelog">Changelog</Label>
                  <Textarea
                    id="changelog"
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="Describe what changed in this version..."
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handlePublish} disabled={!changelog || publishMutation.isPending}>
                    {publishMutation.isPending ? "Publishing..." : "Publish"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button onClick={handleCreate} disabled={!name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Template
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ViewTemplateEditor;
