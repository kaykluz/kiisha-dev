import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Search,
  Plus,
  RefreshCw,
  Shield,
  Eye,
  Edit,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const REQUIREMENT_CATEGORIES = [
  { value: "corporate_identity", label: "Corporate Identity" },
  { value: "ownership_governance", label: "Ownership & Governance" },
  { value: "licenses_permits", label: "Licenses & Permits" },
  { value: "finance", label: "Finance" },
  { value: "banking", label: "Banking" },
  { value: "people_capability", label: "People & Capability" },
  { value: "hse_esg", label: "HSE & ESG" },
  { value: "insurance", label: "Insurance" },
  { value: "legal", label: "Legal" },
  { value: "custom", label: "Custom" }
];

const REQUIREMENT_TYPES = [
  { value: "document", label: "Document" },
  { value: "field", label: "Field" },
  { value: "checklist", label: "Checklist" },
  { value: "attestation", label: "Attestation" },
  { value: "external_verification", label: "External Verification" }
];

const EXPIRY_POLICIES = [
  { value: "none", label: "No Expiry" },
  { value: "fixed_date", label: "Fixed Date" },
  { value: "duration_from_issue", label: "Duration from Issue" },
  { value: "duration_from_upload", label: "Duration from Upload" },
  { value: "periodic", label: "Periodic" }
];

export default function RequirementItems() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    requirementType: "document" as const,
    appliesTo: "company_profile" as const,
    category: "corporate_identity" as const,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "none" as const,
    expiryDurationDays: 365,
    gracePeriodDays: 0,
    renewalWindowDays: 30,
    renewalPolicy: "none" as const,
    sensitivity: "normal" as const
  });
  
  const orgId = user?.activeOrgId || 1;
  
  // Fetch requirement items
  const { data: items, isLoading, refetch } = trpc.diligence.listRequirementItems.useQuery({
    organizationId: orgId,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    requirementType: typeFilter !== "all" ? typeFilter : undefined,
    includeGlobal: true
  });
  
  // Create requirement item mutation
  const createMutation = trpc.diligence.createRequirementItem.useMutation({
    onSuccess: () => {
      toast.success("Requirement item created");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const resetForm = () => {
    setFormData({
      code: "",
      title: "",
      description: "",
      requirementType: "document",
      appliesTo: "company_profile",
      category: "corporate_identity",
      required: true,
      evidenceRequired: true,
      expiryPolicy: "none",
      expiryDurationDays: 365,
      gracePeriodDays: 0,
      renewalWindowDays: 30,
      renewalPolicy: "none",
      sensitivity: "normal"
    });
  };
  
  const handleCreate = () => {
    createMutation.mutate({
      ...formData,
      organizationId: orgId
    });
  };
  
  // Filter items
  const filteredItems = items?.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const globalItems = filteredItems?.filter(i => i.isGlobalDefault);
  const customItems = filteredItems?.filter(i => !i.isGlobalDefault);
  
  // Group by category
  const groupedItems = filteredItems?.reduce((acc, item) => {
    const cat = item.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
  
  const getExpiryBadge = (item: any) => {
    if (item.expiryPolicy === "none") {
      return <Badge variant="outline" className="bg-green-500/10">No Expiry</Badge>;
    }
    return (
      <Badge variant="outline" className="bg-amber-500/10">
        <Clock className="h-3 w-3 mr-1" />
        {item.expiryDurationDays || "—"} days
      </Badge>
    );
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Requirement Items Catalog
          </h1>
          <p className="text-muted-foreground">
            Manage diligence requirements and document types
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Requirement
          </Button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-3xl font-bold">{items?.length || 0}</p>
              </div>
              <FileText className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-3xl font-bold">
                  {items?.filter(i => i.requirementType === "document").length || 0}
                </p>
              </div>
              <FileText className="h-10 w-10 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expirable</p>
                <p className="text-3xl font-bold">
                  {items?.filter(i => i.expiryPolicy !== "none").length || 0}
                </p>
              </div>
              <Clock className="h-10 w-10 text-amber-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custom</p>
                <p className="text-3xl font-bold">{customItems?.length || 0}</p>
              </div>
              <Edit className="h-10 w-10 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requirements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {REQUIREMENT_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {REQUIREMENT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Items by Category */}
      <div className="space-y-6">
        {Object.entries(groupedItems || {}).map(([category, categoryItems]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="capitalize">
                {REQUIREMENT_CATEGORIES.find(c => c.value === category)?.label || category.replace(/_/g, " ")}
              </CardTitle>
              <CardDescription>
                {categoryItems?.length} requirement{categoryItems?.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requirement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Sensitivity</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.code}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {REQUIREMENT_TYPES.find(t => t.value === item.requirementType)?.label || item.requirementType}
                        </Badge>
                      </TableCell>
                      <TableCell>{getExpiryBadge(item)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            item.sensitivity === "highly_restricted" 
                              ? "bg-red-500/10" 
                              : item.sensitivity === "restricted"
                              ? "bg-amber-500/10"
                              : ""
                          }
                        >
                          {item.sensitivity?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.isGlobalDefault ? (
                          <Badge variant="secondary">Global</Badge>
                        ) : (
                          <Badge>Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedItem(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!item.isGlobalDefault && (
                            <Button size="sm" variant="ghost">
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Requirement Item</DialogTitle>
            <DialogDescription>
              Define a new requirement for your diligence templates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                  placeholder="e.g., CUSTOM_DOC_001"
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Custom Document"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this requirement is for..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select 
                  value={formData.requirementType} 
                  onValueChange={(v: any) => setFormData({ ...formData, requirementType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v: any) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Applies To</Label>
                <Select 
                  value={formData.appliesTo} 
                  onValueChange={(v: any) => setFormData({ ...formData, appliesTo: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_profile">Company Profile</SelectItem>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="person">Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sensitivity</Label>
                <Select 
                  value={formData.sensitivity} 
                  onValueChange={(v: any) => setFormData({ ...formData, sensitivity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="highly_restricted">Highly Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="required"
                  checked={formData.required}
                  onCheckedChange={(checked) => setFormData({ ...formData, required: !!checked })}
                />
                <Label htmlFor="required">Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="evidenceRequired"
                  checked={formData.evidenceRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, evidenceRequired: !!checked })}
                />
                <Label htmlFor="evidenceRequired">Evidence Required</Label>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Expiry Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Expiry Policy</Label>
                  <Select 
                    value={formData.expiryPolicy} 
                    onValueChange={(v: any) => setFormData({ ...formData, expiryPolicy: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_POLICIES.map(policy => (
                        <SelectItem key={policy.value} value={policy.value}>{policy.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.expiryPolicy !== "none" && (
                  <div>
                    <Label>Duration (days)</Label>
                    <Input
                      type="number"
                      value={formData.expiryDurationDays}
                      onChange={(e) => setFormData({ ...formData, expiryDurationDays: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
              
              {formData.expiryPolicy !== "none" && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <Label>Grace Period (days)</Label>
                    <Input
                      type="number"
                      value={formData.gracePeriodDays}
                      onChange={(e) => setFormData({ ...formData, gracePeriodDays: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Renewal Window (days)</Label>
                    <Input
                      type="number"
                      value={formData.renewalWindowDays}
                      onChange={(e) => setFormData({ ...formData, renewalWindowDays: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Renewal Policy</Label>
                    <Select 
                      value={formData.renewalPolicy} 
                      onValueChange={(v: any) => setFormData({ ...formData, renewalPolicy: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="recurring">Recurring</SelectItem>
                        <SelectItem value="auto_obligation">Auto Obligation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.code || !formData.title}
            >
              {createMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Item Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
            <DialogDescription>{selectedItem?.code}</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedItem.requirementType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{selectedItem.category?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Applies To</p>
                  <p className="font-medium capitalize">{selectedItem.appliesTo?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sensitivity</p>
                  <p className="font-medium capitalize">{selectedItem.sensitivity?.replace(/_/g, " ")}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Expiry Settings</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Expiry Policy</p>
                    <p className="font-medium capitalize">{selectedItem.expiryPolicy?.replace(/_/g, " ")}</p>
                  </div>
                  {selectedItem.expiryPolicy !== "none" && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">{selectedItem.expiryDurationDays} days</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Grace Period</p>
                        <p className="font-medium">{selectedItem.gracePeriodDays} days</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Renewal Window</p>
                        <p className="font-medium">{selectedItem.renewalWindowDays} days</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-2">
                {selectedItem.required && (
                  <Badge variant="outline" className="bg-red-500/10">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Required
                  </Badge>
                )}
                {selectedItem.evidenceRequired && (
                  <Badge variant="outline" className="bg-blue-500/10">
                    <FileText className="h-3 w-3 mr-1" />
                    Evidence Required
                  </Badge>
                )}
                {selectedItem.isGlobalDefault && (
                  <Badge variant="secondary">
                    <Shield className="h-3 w-3 mr-1" />
                    Global
                  </Badge>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
}
