import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Plus, FolderPlus, FileText, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SuggestedDocType {
  name: string;
  code: string;
  description: string;
  extractionConfig: {
    fields: string[];
    dateFields: string[];
    numericFields: string[];
  };
}

interface CategorySuggestion {
  name: string;
  code: string;
  description: string;
  icon: string;
  color: string;
  suggestedTypes: SuggestedDocType[];
}

interface CreateCategoryDialogProps {
  trigger?: React.ReactNode;
  onCategoryCreated?: (category: { id: number; name: string }) => void;
}

export function CreateCategoryDialog({ trigger, onCategoryCreated }: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set());
  
  // Manual mode state
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  
  const suggestMutation = trpc.documentCategories.suggestCategory.useMutation({
    onSuccess: (data) => {
      setSuggestion(data);
      // Select all suggested types by default
      setSelectedTypes(new Set(data.suggestedTypes.map((_: SuggestedDocType, i: number) => i)));
    },
    onError: (error) => {
      toast.error("Failed to generate suggestion", { description: error.message });
    },
  });
  
  const createCategoryMutation = trpc.documentCategories.createCategory.useMutation({
    onSuccess: async (category) => {
      toast.success("Category created", { description: `${category.name} has been created` });
      
      // Create selected document types
      if (suggestion && selectedTypes.size > 0) {
        const typesToCreate = suggestion.suggestedTypes.filter((_: SuggestedDocType, i: number) => selectedTypes.has(i));
        for (const docType of typesToCreate) {
          await createDocTypeMutation.mutateAsync({
            categoryId: category.id,
            name: docType.name,
            code: docType.code,
            description: docType.description,
            extractionConfig: docType.extractionConfig,
            aiCreated: true,
          });
        }
      }
      
      onCategoryCreated?.(category);
      handleClose();
    },
    onError: (error) => {
      toast.error("Failed to create category", { description: error.message });
    },
  });
  
  const createDocTypeMutation = trpc.documentCategories.createDocumentType.useMutation();
  
  const handleSuggest = () => {
    if (!description.trim()) {
      toast.error("Please describe the document category");
      return;
    }
    suggestMutation.mutate({ description });
  };
  
  const handleCreate = () => {
    if (mode === "ai" && suggestion) {
      createCategoryMutation.mutate({
        name: suggestion.name,
        code: suggestion.code,
        description: suggestion.description,
        icon: suggestion.icon,
        color: suggestion.color,
        isSystem: false,
      });
    } else if (mode === "manual") {
      if (!manualName.trim() || !manualCode.trim()) {
        toast.error("Please fill in required fields");
        return;
      }
      createCategoryMutation.mutate({
        name: manualName,
        code: manualCode.toUpperCase().replace(/\s+/g, "_"),
        description: manualDescription,
        isSystem: false,
      });
    }
  };
  
  const handleClose = () => {
    setOpen(false);
    setDescription("");
    setSuggestion(null);
    setSelectedTypes(new Set());
    setManualName("");
    setManualCode("");
    setManualDescription("");
  };
  
  const toggleTypeSelection = (index: number) => {
    const newSelected = new Set(selectedTypes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTypes(newSelected);
  };
  
  const isLoading = suggestMutation.isPending || createCategoryMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Create Document Category
          </DialogTitle>
          <DialogDescription>
            Use AI to automatically create a category with suggested document types, or create one manually.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={mode} onValueChange={(v) => setMode(v as "ai" | "manual")} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI-Powered
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="description">Describe the document category</Label>
              <Textarea
                id="description"
                placeholder="e.g., Financial models and projections for renewable energy projects, including NPV, IRR, cash flows, and EBITDA analysis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Be specific about what types of documents belong in this category and what information they contain.
              </p>
            </div>
            
            <Button 
              onClick={handleSuggest} 
              disabled={isLoading || !description.trim()}
              className="w-full"
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Category
                </>
              )}
            </Button>
            
            {suggestion && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: suggestion.color }}
                      >
                        {suggestion.name.charAt(0)}
                      </div>
                      {suggestion.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {suggestion.code}
                    </Badge>
                  </div>
                  <CardDescription>{suggestion.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Suggested Document Types</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select which document types to create with this category
                    </p>
                    <div className="space-y-2">
                      {suggestion.suggestedTypes.map((docType, index) => (
                        <div
                          key={index}
                          onClick={() => toggleTypeSelection(index)}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedTypes.has(index)
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm">{docType.name}</div>
                                <div className="text-xs text-muted-foreground">{docType.description}</div>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedTypes.has(index)
                                ? "border-amber-500 bg-amber-500 text-white"
                                : "border-muted-foreground"
                            }`}>
                              {selectedTypes.has(index) && <Check className="h-3 w-3" />}
                            </div>
                          </div>
                          {docType.extractionConfig.fields.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {docType.extractionConfig.fields.slice(0, 5).map((field, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                              {docType.extractionConfig.fields.length > 5 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{docType.extractionConfig.fields.length - 5} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Financial Models"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Category Code *</Label>
                <Input
                  id="code"
                  placeholder="e.g., FINANCIAL_MODELS"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  disabled={isLoading}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualDescription">Description</Label>
              <Textarea
                id="manualDescription"
                placeholder="Describe what documents belong in this category..."
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isLoading || (mode === "ai" && !suggestion) || (mode === "manual" && (!manualName.trim() || !manualCode.trim()))}
          >
            {createCategoryMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Category
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Also export a component for creating document types within an existing category
interface CreateDocumentTypeDialogProps {
  categoryId: number;
  categoryName: string;
  trigger?: React.ReactNode;
  onDocumentTypeCreated?: (docType: { id: number; name: string }) => void;
}

export function CreateDocumentTypeDialog({ 
  categoryId, 
  categoryName, 
  trigger, 
  onDocumentTypeCreated 
}: CreateDocumentTypeDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [description, setDescription] = useState("");
  const [suggestion, setSuggestion] = useState<{
    name: string;
    code: string;
    description: string;
    extractionConfig: Record<string, unknown>;
    validationRules: Record<string, unknown>;
  } | null>(null);
  
  // Manual mode state
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  
  const suggestMutation = trpc.documentCategories.suggestDocumentType.useMutation({
    onSuccess: (data) => {
      setSuggestion(data);
    },
    onError: (error) => {
      toast.error("Failed to generate suggestion", { description: error.message });
    },
  });
  
  const createMutation = trpc.documentCategories.createDocumentType.useMutation({
    onSuccess: (docType) => {
      toast.success("Document type created", { description: `${docType.name} has been created` });
      onDocumentTypeCreated?.(docType);
      handleClose();
    },
    onError: (error) => {
      toast.error("Failed to create document type", { description: error.message });
    },
  });
  
  const handleSuggest = () => {
    if (!description.trim()) {
      toast.error("Please describe the document type");
      return;
    }
    suggestMutation.mutate({ categoryId, description });
  };
  
  const handleCreate = () => {
    if (mode === "ai" && suggestion) {
      createMutation.mutate({
        categoryId,
        name: suggestion.name,
        code: suggestion.code,
        description: suggestion.description,
        extractionConfig: suggestion.extractionConfig,
        validationRules: suggestion.validationRules,
        aiCreated: true,
      });
    } else if (mode === "manual") {
      if (!manualName.trim() || !manualCode.trim()) {
        toast.error("Please fill in required fields");
        return;
      }
      createMutation.mutate({
        categoryId,
        name: manualName,
        code: manualCode.toUpperCase().replace(/\s+/g, "_"),
        description: manualDescription,
        aiCreated: false,
      });
    }
  };
  
  const handleClose = () => {
    setOpen(false);
    setDescription("");
    setSuggestion(null);
    setManualName("");
    setManualCode("");
    setManualDescription("");
  };
  
  const isLoading = suggestMutation.isPending || createMutation.isPending;
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Document Type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Add Document Type
          </DialogTitle>
          <DialogDescription>
            Add a new document type to the "{categoryName}" category.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={mode} onValueChange={(v) => setMode(v as "ai" | "manual")} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI-Powered
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="docDescription">Describe the document type</Label>
              <Textarea
                id="docDescription"
                placeholder="e.g., Energy production reports from PVsyst software showing expected annual yield, performance ratio, and loss analysis..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>
            
            <Button 
              onClick={handleSuggest} 
              disabled={isLoading || !description.trim()}
              className="w-full"
            >
              {suggestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Document Type
                </>
              )}
            </Button>
            
            {suggestion && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{suggestion.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-xs">
                      {suggestion.code}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm">{suggestion.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1">
                    {((suggestion.extractionConfig as any)?.fields || []).slice(0, 6).map((field: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="docName">Name *</Label>
                <Input
                  id="docName"
                  placeholder="e.g., PVsyst Report"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="docCode">Code *</Label>
                <Input
                  id="docCode"
                  placeholder="e.g., PVSYST_REPORT"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                  disabled={isLoading}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docManualDescription">Description</Label>
              <Textarea
                id="docManualDescription"
                placeholder="Describe what this document type contains..."
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                rows={2}
                disabled={isLoading}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isLoading || (mode === "ai" && !suggestion) || (mode === "manual" && (!manualName.trim() || !manualCode.trim()))}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
