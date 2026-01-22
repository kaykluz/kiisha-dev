import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, FileText, Plus, X } from "lucide-react";

const TEMPLATE_CATEGORIES = [
  { value: "kyb", label: "KYB Basic" },
  { value: "investor", label: "Investor DD" },
  { value: "grant", label: "Grant / Donor" },
  { value: "regulator", label: "Regulator" },
  { value: "vendor", label: "Vendor / Subcontractor" },
  { value: "bank", label: "Bank / Lender" },
  { value: "hse_esg", label: "HSE + ESG" },
  { value: "tax", label: "Tax + Statutory" },
  { value: "insurance", label: "Insurance & Risk" },
  { value: "governance", label: "Corporate Governance" },
  { value: "procurement", label: "Procurement / Tender" },
  { value: "project_spv", label: "Project SPV" },
  { value: "custom", label: "Custom" }
];

export default function TemplateNew() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "custom",
    signOffRequired: false,
    signOffRoles: [] as string[],
  });
  
  const orgId = user?.activeOrgId || 1;
  
  // Get requirement items for selection
  const { data: requirementItems } = trpc.diligence.listRequirementItems.useQuery({
    category: undefined,
    isActive: true
  });
  
  const [selectedRequirements, setSelectedRequirements] = useState<number[]>([]);
  
  // Create template mutation
  const createMutation = trpc.diligence.createTemplate.useMutation({
    onSuccess: (data) => {
      toast.success("Template created successfully");
      navigate(`/diligence/templates/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create template");
    }
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) {
      toast.error("Please fill in required fields");
      return;
    }
    
    createMutation.mutate({
      ...formData,
      organizationId: orgId,
      requirementIds: selectedRequirements
    });
  };
  
  const toggleRequirement = (id: number) => {
    setSelectedRequirements(prev => 
      prev.includes(id) 
        ? prev.filter(r => r !== id)
        : [...prev, id]
    );
  };
  
  // Group requirements by category
  const groupedRequirements = requirementItems?.reduce((acc, item) => {
    const category = item.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, typeof requirementItems>) || {};
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/diligence/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Create New Template
          </h1>
          <p className="text-muted-foreground">
            Define a new diligence pack template
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>Basic details about this template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Custom KYB Pack"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Template Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                  placeholder="e.g., CUSTOM_KYB"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the purpose of this template..."
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Sign-off Required</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="signOff"
                    checked={formData.signOffRequired}
                    onCheckedChange={(checked) => setFormData({ ...formData, signOffRequired: !!checked })}
                  />
                  <Label htmlFor="signOff" className="font-normal">
                    Require sign-off before submission
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Requirements Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
            <CardDescription>
              Select the requirements to include in this template ({selectedRequirements.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedRequirements).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h4 className="font-medium capitalize text-sm text-muted-foreground">
                    {category.replace(/_/g, " ")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {items?.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRequirements.includes(item.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => toggleRequirement(item.id)}
                      >
                        <Checkbox
                          checked={selectedRequirements.includes(item.id)}
                          onCheckedChange={() => toggleRequirement(item.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {item.requirementType} • {item.code}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {Object.keys(groupedRequirements).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No requirement items available</p>
                  <p className="text-sm">Seed the requirement catalog first</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/diligence/templates">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>Creating...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Template
              </>
            )}
          </Button>
        </div>
      </form>
      </div>
    </AppLayout>
  );
}
