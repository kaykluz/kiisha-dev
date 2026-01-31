import { useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  FolderPlus,
  FileText,
  Sparkles,
  Lock,
  Settings,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";

interface DocumentCategory {
  id: number;
  name: string;
  code: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isSystem: boolean;
  documentTypesCount: number;
  createdAt: string;
}

interface DocumentType {
  id: number;
  categoryId: number;
  name: string;
  code: string;
  description: string | null;
  aiCreated: boolean;
  extractionConfig: Record<string, unknown> | null;
  createdAt: string;
}

// Sample data (used when API returns empty)
const sampleCategories: DocumentCategory[] = [
  {
    id: 1,
    name: "Site & Real Estate",
    code: "SITE_REAL_ESTATE",
    description: "Documents related to land acquisition, surveys, and property agreements",
    icon: "map",
    color: "#10B981",
    isSystem: true,
    documentTypesCount: 6,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "Permits & Approvals",
    code: "PERMITS_APPROVALS",
    description: "Regulatory permits, licenses, and governmental approvals",
    icon: "shield",
    color: "#F59E0B",
    isSystem: true,
    documentTypesCount: 4,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 3,
    name: "Technical",
    code: "TECHNICAL",
    description: "Engineering designs, specifications, and technical documentation",
    icon: "settings",
    color: "#3B82F6",
    isSystem: true,
    documentTypesCount: 5,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: 4,
    name: "Financial Models",
    code: "FINANCIAL_MODELS",
    description: "Project finance models, projections, and financial analysis",
    icon: "calculator",
    color: "#8B5CF6",
    isSystem: false,
    documentTypesCount: 3,
    createdAt: "2024-06-20T14:30:00Z",
  },
  {
    id: 5,
    name: "Energy Analysis & Modeling",
    code: "ENERGY_ANALYSIS",
    description: "Energy yield predictions, performance modeling, and simulation reports",
    icon: "zap",
    color: "#EC4899",
    isSystem: false,
    documentTypesCount: 3,
    createdAt: "2024-08-15T09:00:00Z",
  },
];

const sampleDocumentTypes: DocumentType[] = [
  {
    id: 1,
    categoryId: 4,
    name: "Project Finance Model",
    code: "PROJECT_FINANCE_MODEL",
    description: "Complete project finance model with NPV, IRR, and cash flow projections",
    aiCreated: true,
    extractionConfig: { fields: ["NPV", "IRR", "DSCR"], numericFields: ["npv", "irr"] },
    createdAt: "2024-06-20T14:30:00Z",
  },
  {
    id: 2,
    categoryId: 4,
    name: "Acquisition Model",
    code: "ACQUISITION_MODEL",
    description: "Financial model for asset acquisition analysis",
    aiCreated: true,
    extractionConfig: { fields: ["Purchase Price", "IRR", "MOIC"] },
    createdAt: "2024-06-20T14:30:00Z",
  },
  {
    id: 3,
    categoryId: 5,
    name: "PVsyst Simulation Report",
    code: "PVSYST_REPORT",
    description: "Energy yield simulation from PVsyst software",
    aiCreated: true,
    extractionConfig: { fields: ["Annual Yield", "Performance Ratio", "Specific Yield"] },
    createdAt: "2024-08-15T09:00:00Z",
  },
];

export default function CategoryManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<DocumentCategory | null>(null);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [deletingType, setDeletingType] = useState<DocumentType | null>(null);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");

  // Fetch categories from API
  const { data: apiCategories = [] } = trpc.documents.getCategories.useQuery();

  // Fetch document types from API
  const { data: apiDocumentTypes = [] } = trpc.documents.getTypes.useQuery();

  // Transform API data or use sample data
  const categories: DocumentCategory[] = useMemo(() => {
    if ((apiCategories as any[]).length === 0) return sampleCategories;
    return (apiCategories as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      description: c.description,
      icon: c.icon,
      color: c.color,
      isSystem: c.isSystem || false,
      documentTypesCount: c.documentTypesCount || 0,
      createdAt: c.createdAt,
    }));
  }, [apiCategories]);

  const documentTypes: DocumentType[] = useMemo(() => {
    if ((apiDocumentTypes as any[]).length === 0) return sampleDocumentTypes;
    return (apiDocumentTypes as any[]).map((t: any) => ({
      id: t.id,
      categoryId: t.categoryId,
      name: t.name,
      code: t.code,
      description: t.description,
      aiCreated: t.aiCreated || false,
      extractionConfig: t.extractionConfig,
      createdAt: t.createdAt,
    }));
  }, [apiDocumentTypes]);

  // Filter categories
  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get document types for selected category
  const categoryTypes = selectedCategory
    ? documentTypes.filter((t) => t.categoryId === selectedCategory.id)
    : [];

  const handleEditCategory = (category: DocumentCategory) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditDescription(category.description || "");
    setEditColor(category.color || "#3B82F6");
  };

  const updateCategoryMutation = trpc.documentCategories.updateCategory.useMutation({
    onSuccess: () => { toast.success("Category updated"); setEditingCategory(null); },
    onError: (err) => toast.error(err.message),
  });
  const deleteCategoryMutation = trpc.documentCategories.deleteCategory.useMutation({
    onSuccess: () => { toast.success("Category deleted"); setDeletingCategory(null); },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveCategory = () => {
    if (!editingCategory) return;
    updateCategoryMutation.mutate({ id: editingCategory.id, name: editName, description: editDescription, color: editColor });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory) return;
    deleteCategoryMutation.mutate({ id: deletingCategory.id });
    if (selectedCategory?.id === deletingCategory.id) {
      setSelectedCategory(null);
    }
  };

  const handleEditType = (type: DocumentType) => {
    setEditingType(type);
    setEditName(type.name);
    setEditDescription(type.description || "");
  };

  const updateTypeMutation = trpc.documentCategories.updateDocumentType.useMutation({
    onSuccess: () => { toast.success("Document type updated"); setEditingType(null); },
    onError: (err) => toast.error(err.message),
  });
  const deleteTypeMutation = trpc.documentCategories.deleteDocumentType.useMutation({
    onSuccess: () => { toast.success("Document type deleted"); setDeletingType(null); },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveType = () => {
    if (!editingType) return;
    updateTypeMutation.mutate({ id: editingType.id, name: editName, description: editDescription });
  };

  const handleDeleteType = () => {
    if (!deletingType) return;
    deleteTypeMutation.mutate({ id: deletingType.id });
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Categories List */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Document Categories</h2>
              <CreateCategoryDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                }
                onCategoryCreated={() => {
                  toast.success("Category created");
                }}
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    selectedCategory?.id === category.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedCategory(category)}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: category.color || "#3B82F6" }}
                  >
                    <FolderPlus className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{category.name}</span>
                      {category.isSystem && (
                        <Lock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {category.documentTypesCount} document types
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Category Details */}
        <div className="flex-1 flex flex-col">
          {selectedCategory ? (
            <>
              <div className="p-6 border-b">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: selectedCategory.color || "#3B82F6" }}
                    >
                      <FolderPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-semibold">{selectedCategory.name}</h1>
                        {selectedCategory.isSystem && (
                          <Badge variant="secondary">
                            <Lock className="w-3 h-3 mr-1" />
                            System
                          </Badge>
                        )}
                        {!selectedCategory.isSystem && (
                          <Badge variant="outline" className="text-primary border-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI Created
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-1">
                        {selectedCategory.description || "No description"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Code: {selectedCategory.code} • Created{" "}
                        {formatDate(selectedCategory.createdAt)}
                      </p>
                    </div>
                  </div>

                  {!selectedCategory.isSystem && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCategory(selectedCategory)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Category
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletingCategory(selectedCategory)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Category
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              <div className="flex-1 p-6 overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Document Types</h2>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Type
                  </Button>
                </div>

                {categoryTypes.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryTypes.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                {type.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {type.code}
                              </code>
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {type.description || "-"}
                            </TableCell>
                            <TableCell>
                              {type.aiCreated ? (
                                <Badge variant="outline" className="text-primary border-primary">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  AI
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Manual</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditType(type)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Configure Extraction
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeletingType(type)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<FileText className="w-12 h-12" />}
                    title="No Document Types"
                    description="This category doesn't have any document types yet."
                    action={
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Document Type
                      </Button>
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<FolderPlus className="w-12 h-12" />}
                title="Select a Category"
                description="Choose a category from the list to view and manage its document types."
              />
            </div>
          )}
        </div>
      </div>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the category name, description, and appearance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Type Dialog */}
      <Dialog open={!!editingType} onOpenChange={() => setEditingType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document Type</DialogTitle>
            <DialogDescription>
              Update the document type name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveType}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCategory?.name}"? This will also
              delete all associated document types. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Type Confirmation */}
      <AlertDialog open={!!deletingType} onOpenChange={() => setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingType?.name}"? Documents of this
              type will need to be recategorized. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteType}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
