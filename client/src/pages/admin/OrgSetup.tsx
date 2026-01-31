/**
 * Phase 34: Admin Setup Console
 * Organization preferences, field packs, and AI-assisted setup
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Package, Wand2, LayoutTemplate, ChevronRight, Plus, Copy, Archive, Check, AlertCircle, Loader2 } from "lucide-react";

// Asset classification options
const ASSET_CLASSIFICATIONS = [
  { value: "residential", label: "Residential" },
  { value: "small_commercial", label: "Small Commercial" },
  { value: "large_commercial", label: "Large Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "mini_grid", label: "Mini Grid" },
  { value: "mesh_grid", label: "Mesh Grid" },
  { value: "interconnected_mini_grids", label: "Interconnected Mini Grids" },
  { value: "grid_connected", label: "Grid Connected" },
];

// Configuration profile options
const CONFIG_PROFILES = [
  { value: "solar_only", label: "Solar Only" },
  { value: "solar_bess", label: "Solar + BESS" },
  { value: "solar_gen", label: "Solar + Generator" },
  { value: "solar_bess_gen", label: "Solar + BESS + Generator" },
  { value: "wind_only", label: "Wind Only" },
  { value: "hybrid", label: "Hybrid" },
];

// Chart type options
const CHART_TYPES = [
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "area", label: "Area Chart" },
  { value: "table", label: "Table" },
];

export default function OrgSetup() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("defaults");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [selectedPackToClone, setSelectedPackToClone] = useState<number | null>(null);
  const [newPackName, setNewPackName] = useState("");
  
  // Get organization ID from user context (simplified - in real app would come from workspace context)
  const organizationId = user?.activeOrgId || 1;
  
  // Fetch org preferences
  const { data: preferences, isLoading: prefsLoading, refetch: refetchPrefs } = trpc.orgPreferences.get.useQuery({
    organizationId,
  });
  
  // Fetch field packs
  const { data: fieldPacks, isLoading: packsLoading, refetch: refetchPacks } = trpc.fieldPacks.list.useQuery({
    organizationId,
    includeArchived: false,
  });
  
  // Fetch global templates
  const { data: globalTemplates } = trpc.fieldPacks.listGlobalTemplates.useQuery();
  
  // Mutations
  const updatePrefs = trpc.orgPreferences.update.useMutation({
    onSuccess: () => refetchPrefs(),
  });
  
  const setDisclosureMode = trpc.orgPreferences.setDisclosureMode.useMutation({
    onSuccess: () => refetchPrefs(),
  });
  
  const setAssetClassifications = trpc.orgPreferences.setAssetClassifications.useMutation({
    onSuccess: () => refetchPrefs(),
  });
  
  const setConfigProfiles = trpc.orgPreferences.setConfigurationProfiles.useMutation({
    onSuccess: () => refetchPrefs(),
  });
  
  const clonePack = trpc.fieldPacks.clone.useMutation({
    onSuccess: () => {
      refetchPacks();
      setCloneDialogOpen(false);
      setNewPackName("");
      setSelectedPackToClone(null);
    },
  });
  
  const activatePack = trpc.fieldPacks.activate.useMutation({
    onSuccess: () => refetchPacks(),
  });
  
  const archivePack = trpc.fieldPacks.archive.useMutation({
    onSuccess: () => refetchPacks(),
  });
  
  // Handlers
  const handleDisclosureModeChange = (mode: "summary" | "expanded" | "full") => {
    setDisclosureMode.mutate({ organizationId, mode });
  };
  
  const handleAssetClassificationToggle = (classification: string, enabled: boolean) => {
    const current = preferences?.defaultAssetClassifications || [];
    const updated = enabled
      ? [...current, classification]
      : current.filter(c => c !== classification);
    setAssetClassifications.mutate({ organizationId, classifications: updated });
  };
  
  const handleConfigProfileToggle = (profile: string, enabled: boolean) => {
    const current = preferences?.defaultConfigurationProfiles || [];
    const updated = enabled
      ? [...current, profile]
      : current.filter(p => p !== profile);
    setConfigProfiles.mutate({ organizationId, profiles: updated });
  };
  
  const handleClonePack = () => {
    if (!selectedPackToClone) return;
    clonePack.mutate({
      sourceId: selectedPackToClone,
      organizationId,
      newName: newPackName || undefined,
    });
  };
  
  if (prefsLoading || packsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  
  const orgPacks = fieldPacks?.filter(p => p.organizationId === organizationId) || [];
  const globalPacks = fieldPacks?.filter(p => !p.organizationId) || [];
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold">Organization Setup</h1>
          <p className="text-muted-foreground mt-1">
            Configure default views, field packs, and preferences for your organization
          </p>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="defaults" className="gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Defaults</span>
            </TabsTrigger>
            <TabsTrigger value="field-packs" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Field Packs</span>
            </TabsTrigger>
            <TabsTrigger value="views" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden sm:inline">Views</span>
            </TabsTrigger>
            <TabsTrigger value="ai-setup" className="gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">AI Setup</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Defaults Tab */}
          <TabsContent value="defaults" className="space-y-6 mt-6">
            {/* Disclosure Mode */}
            <Card>
              <CardHeader>
                <CardTitle>Default Disclosure Mode</CardTitle>
                <CardDescription>
                  Control how much detail is shown by default in views and reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={preferences?.defaultDisclosureMode || "summary"}
                  onValueChange={(v) => handleDisclosureModeChange(v as "summary" | "expanded" | "full")}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="expanded">Expanded</SelectItem>
                    <SelectItem value="full">Full (RBAC-filtered)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Note: "Full" mode still respects RBAC permissions - users only see fields they have access to.
                </p>
              </CardContent>
            </Card>
            
            {/* Asset Classifications */}
            <Card>
              <CardHeader>
                <CardTitle>Enabled Asset Classifications</CardTitle>
                <CardDescription>
                  Select which asset types are available in your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {ASSET_CLASSIFICATIONS.map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Switch
                        id={`class-${value}`}
                        checked={preferences?.defaultAssetClassifications?.includes(value) || false}
                        onCheckedChange={(checked) => handleAssetClassificationToggle(value, checked)}
                      />
                      <Label htmlFor={`class-${value}`} className="text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Configuration Profiles */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration Profiles</CardTitle>
                <CardDescription>
                  Select which system configurations are used in your portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {CONFIG_PROFILES.map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2">
                      <Switch
                        id={`profile-${value}`}
                        checked={preferences?.defaultConfigurationProfiles?.includes(value) || false}
                        onCheckedChange={(checked) => handleConfigProfileToggle(value, checked)}
                      />
                      <Label htmlFor={`profile-${value}`} className="text-sm">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Charts Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Default Chart Settings</CardTitle>
                <CardDescription>
                  Configure which chart types are available and the default chart style
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Default Chart Type</Label>
                    <Select defaultValue="bar">
                      <SelectTrigger className="w-[200px] mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHART_TYPES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Allowed Chart Types</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {CHART_TYPES.map(({ value, label }) => (
                        <Badge
                          key={value}
                          variant="outline"
                          className="cursor-pointer hover:bg-accent"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Field Packs Tab */}
          <TabsContent value="field-packs" className="space-y-6 mt-6">
            {/* Global Templates */}
            <Card>
              <CardHeader>
                <CardTitle>KIISHA Templates</CardTitle>
                <CardDescription>
                  Global templates provided by KIISHA. Clone to customize for your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {globalPacks.map(pack => (
                    <div
                      key={pack.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{pack.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {pack.description} • {pack.fields?.length || 0} fields • {pack.scope}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Global</Badge>
                        <Dialog open={cloneDialogOpen && selectedPackToClone === pack.id} onOpenChange={(open) => {
                          setCloneDialogOpen(open);
                          if (open) setSelectedPackToClone(pack.id);
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Copy className="h-4 w-4 mr-1" />
                              Clone
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Clone Field Pack</DialogTitle>
                              <DialogDescription>
                                Create a copy of "{pack.name}" for your organization
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <Label htmlFor="newPackName">New Pack Name (optional)</Label>
                              <Input
                                id="newPackName"
                                value={newPackName}
                                onChange={(e) => setNewPackName(e.target.value)}
                                placeholder={`${pack.name} (Copy)`}
                                className="mt-1"
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setCloneDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button onClick={handleClonePack} disabled={clonePack.isPending}>
                                {clonePack.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Copy className="h-4 w-4 mr-1" />
                                )}
                                Clone
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                  {globalPacks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No global templates available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Organization Packs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Organization Field Packs</CardTitle>
                  <CardDescription>
                    Custom field packs for your organization
                  </CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Create Pack
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orgPacks.map(pack => (
                    <div
                      key={pack.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{pack.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {pack.description} • {pack.fields?.length || 0} fields • {pack.scope}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pack.status === "active" ? "default" : "secondary"}>
                          {pack.status}
                        </Badge>
                        {pack.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activatePack.mutate({ id: pack.id })}
                            disabled={activatePack.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        {pack.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => archivePack.mutate({ id: pack.id })}
                            disabled={archivePack.isPending}
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Archive
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {orgPacks.length === 0 && (
                    <div className="text-center py-8">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No custom field packs yet. Clone a template or create a new pack.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Views Tab */}
          <TabsContent value="views" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>View Templates</CardTitle>
                <CardDescription>
                  Map field packs to default views for different use cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {["Operations Default", "Finance Default", "Investor Due Diligence", "Regulatory Pack"].map(viewName => (
                    <div key={viewName} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{viewName}</p>
                          <p className="text-sm text-muted-foreground">
                            No field pack assigned
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Push Updates</CardTitle>
                <CardDescription>
                  Manage updates to view templates across your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No pending updates. Changes to templates will appear here for approval.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* AI Setup Tab */}
          <TabsContent value="ai-setup" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  AI Setup Wizard
                </CardTitle>
                <CardDescription>
                  Let AI analyze your documents and recommend field packs, charts, and templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {preferences?.aiSetupCompleted ? (
                  <div className="text-center py-8">
                    <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="font-medium">AI Setup Complete</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Completed on {preferences.aiSetupCompletedAt ? new Date(preferences.aiSetupCompletedAt).toLocaleDateString() : "N/A"}
                    </p>
                    <Button variant="outline" className="mt-4">
                      Run Again
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Upload Key Documents</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload your standard templates (PPA, O&M contracts, compliance checklists) for AI analysis
                      </p>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center">
                        <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop files here, or click to browse
                        </p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Browse Files
                        </Button>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Quick Questionnaire (Optional)</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Help AI understand your organization better
                      </p>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="industry" className="text-sm">Primary Industry</Label>
                          <Select>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solar">Solar Energy</SelectItem>
                              <SelectItem value="wind">Wind Energy</SelectItem>
                              <SelectItem value="storage">Energy Storage</SelectItem>
                              <SelectItem value="hybrid">Hybrid/Multi-technology</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="geographies" className="text-sm">Operating Geographies</Label>
                          <Input
                            id="geographies"
                            placeholder="e.g., West Africa, East Africa, Southern Africa"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="reporting" className="text-sm">Reporting Style</Label>
                          <Select>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="detailed">Detailed (all fields)</SelectItem>
                              <SelectItem value="summary">Summary (key metrics)</SelectItem>
                              <SelectItem value="investor">Investor-focused</SelectItem>
                              <SelectItem value="regulatory">Regulatory compliance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    
                    <Button className="w-full">
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Recommendations
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center">
                      AI recommendations require admin approval before activation. No changes are made automatically.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
