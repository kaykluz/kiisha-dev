import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  FileText, 
  Copy, 
  Edit, 
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  ChevronRight,
  Building2,
  Calendar,
  FileCheck
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from "lucide-react";

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneDescription, setCloneDescription] = useState("");
  const [showStartResponseDialog, setShowStartResponseDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  
  const orgId = user?.activeOrgId || 1;
  const templateId = parseInt(id || "0");
  
  // Fetch template details using getTemplate
  const { data: template, isLoading, refetch } = trpc.diligence.getTemplate.useQuery(
    { id: templateId },
    { enabled: templateId > 0 }
  );
  
  // Fetch requirement items for this template
  const { data: allRequirements } = trpc.diligence.listRequirementItems.useQuery({
    organizationId: orgId,
    includeGlobal: true
  });
  
  // Fetch companies for response creation
  const { data: companies } = trpc.diligence.listCompanyProfiles.useQuery({
    organizationId: orgId,
    status: "active"
  });
  
  // Create template response mutation
  const createResponseMutation = trpc.diligence.createTemplateResponse.useMutation({
    onSuccess: (result) => {
      toast.success("Response workspace created");
      setShowStartResponseDialog(false);
      navigate(`/diligence/response/${result.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleStartResponse = () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company");
      return;
    }
    createResponseMutation.mutate({
      templateId,
      companyId: selectedCompanyId,
      organizationId: orgId
    });
  };
  
  // Clone template mutation
  const cloneMutation = trpc.diligence.cloneTemplate.useMutation({
    onSuccess: (result) => {
      toast.success("Template cloned successfully");
      setShowCloneDialog(false);
      refetch().then(() => {
        navigate(`/diligence/templates/${result.id}`);
      });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const handleClone = () => {
    if (!cloneName.trim()) {
      toast.error("Please enter a name for the cloned template");
      return;
    }
    
    cloneMutation.mutate({
      templateId,
      organizationId: orgId,
      newName: cloneName,
      newDescription: cloneDescription || undefined
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <h2 className="text-xl font-semibold">Template Not Found</h2>
        <p className="text-muted-foreground">The template you're looking for doesn't exist or has been deleted.</p>
        <Link href="/company-hub">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Company Hub
          </Button>
        </Link>
      </div>
    );
  }
  
  // Get requirements from template response
  const templateRequirements = template.requirements || [];
  
  // Group requirements by category
  const requirementsByCategory = templateRequirements.reduce((acc, req) => {
    const category = req.item?.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(req);
    return acc;
  }, {} as Record<string, typeof templateRequirements>);
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/company-hub">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{template.name}</h1>
              <Badge variant={template.isGlobalDefault ? "secondary" : "default"}>
                {template.isGlobalDefault ? "Global" : "Custom"}
              </Badge>
            </div>
            <p className="text-muted-foreground">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowStartResponseDialog(true)}>
            <Play className="h-4 w-4 mr-2" />
            Start Response
          </Button>
          <Button variant="outline" onClick={() => {
            setCloneName(`${template.name} (Copy)`);
            setCloneDescription(template.description || "");
            setShowCloneDialog(true);
          }}>
            <Copy className="h-4 w-4 mr-2" />
            Clone Template
          </Button>
          {!template.isGlobalDefault && (
            <>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="outline" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{template.category}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateRequirements.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Version</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{template.version || "1.0"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default" className="text-lg">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Active
            </Badge>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="requirements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="companies">Companies Using</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="requirements" className="space-y-4">
          {Object.entries(requirementsByCategory).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Requirements Defined</h3>
                <p className="text-muted-foreground mb-4">
                  This template doesn't have any requirements yet.
                </p>
                <Link href="/diligence/requirements">
                  <Button>
                    Browse Requirement Catalog
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            Object.entries(requirementsByCategory).map(([category, requirements]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">{category.replace(/_/g, " ")}</CardTitle>
                  <CardDescription>{requirements.length} requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {requirements.map((req) => {
                      const item = req.item;
                      if (!item) return null;
                      return (
                        <div 
                          key={req.requirementItemId || item.id} 
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              item.itemType === "document" ? "bg-blue-500/10 text-blue-500" :
                              item.itemType === "field" ? "bg-green-500/10 text-green-500" :
                              item.itemType === "checklist" ? "bg-purple-500/10 text-purple-500" :
                              "bg-orange-500/10 text-orange-500"
                            }`}>
                              {item.itemType === "document" ? <FileText className="h-4 w-4" /> :
                               item.itemType === "field" ? <FileCheck className="h-4 w-4" /> :
                               item.itemType === "checklist" ? <CheckCircle2 className="h-4 w-4" /> :
                               <Shield className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.hasExpiry && (
                              <Badge variant="outline" className="text-orange-500">
                                <Clock className="h-3 w-3 mr-1" />
                                Expires
                              </Badge>
                            )}
                            {item.isSensitive && (
                              <Badge variant="outline" className="text-red-500">
                                <Shield className="h-3 w-3 mr-1" />
                                Sensitive
                              </Badge>
                            )}
                            <Badge variant="secondary" className="capitalize">
                              {item.itemType}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Companies Yet</h3>
              <p className="text-muted-foreground mb-4">
                No companies are currently using this template.
              </p>
              <Link href="/company-hub">
                <Button>
                  Go to Company Hub
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Version History</h3>
              <p className="text-muted-foreground mb-4">
                Current version: {template.version || "1.0"}
              </p>
              <div className="text-sm text-muted-foreground">
                Created: {new Date(template.createdAt).toLocaleDateString()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Clone Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Template</DialogTitle>
            <DialogDescription>
              Create a copy of this template that you can customize for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cloneName">Template Name</Label>
              <Input
                id="cloneName"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cloneDescription">Description</Label>
              <Textarea
                id="cloneDescription"
                value={cloneDescription}
                onChange={(e) => setCloneDescription(e.target.value)}
                placeholder="Enter template description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={cloneMutation.isPending}>
              {cloneMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Start Response Dialog */}
      <Dialog open={showStartResponseDialog} onOpenChange={setShowStartResponseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Response</DialogTitle>
            <DialogDescription>
              Select a company to begin filling in this diligence template.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company">Select Company</Label>
              <Select 
                value={selectedCompanyId?.toString() || ""}
                onValueChange={(value) => setSelectedCompanyId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!companies || companies.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No companies found. <Link href="/company/new" className="text-primary hover:underline">Add a company</Link> first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartResponseDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleStartResponse} 
              disabled={createResponseMutation.isPending || !selectedCompanyId}
            >
              {createResponseMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Response
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
}
