import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Classification options
const ASSET_CLASSIFICATIONS = [
  { value: "residential", label: "Residential" },
  { value: "small_commercial", label: "Small Commercial" },
  { value: "large_commercial", label: "Large Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "mini_grid", label: "Mini-Grid" },
  { value: "mesh_grid", label: "Mesh Grid" },
  { value: "interconnected_mini_grids", label: "Interconnected Mini-Grids" },
  { value: "grid_connected", label: "Grid Connected" },
];

const GRID_CONNECTION_TYPES = [
  { value: "off_grid", label: "Off-Grid" },
  { value: "grid_connected", label: "Grid Connected" },
  { value: "grid_tied_with_backup", label: "Grid-Tied with Backup" },
  { value: "mini_grid", label: "Mini-Grid" },
  { value: "interconnected_mini_grid", label: "Interconnected Mini-Grid" },
  { value: "mesh_grid", label: "Mesh Grid" },
];

const NETWORK_TOPOLOGIES = [
  { value: "radial", label: "Radial" },
  { value: "ring", label: "Ring" },
  { value: "mesh", label: "Mesh" },
  { value: "star", label: "Star" },
  { value: "unknown", label: "Unknown" },
];

const CONFIGURATION_PROFILES = [
  { value: "pv_only", label: "PV Only" },
  { value: "pv_bess", label: "PV + BESS" },
  { value: "pv_dg", label: "PV + Diesel Generator" },
  { value: "pv_bess_dg", label: "PV + BESS + DG" },
  { value: "bess_only", label: "BESS Only" },
  { value: "dg_only", label: "Diesel Generator Only" },
  { value: "minigrid_pv_bess", label: "Mini-Grid: PV + BESS" },
  { value: "minigrid_pv_bess_dg", label: "Mini-Grid: PV + BESS + DG" },
  { value: "mesh_pv_bess", label: "Mesh: PV + BESS" },
  { value: "mesh_pv_bess_dg", label: "Mesh: PV + BESS + DG" },
  { value: "hybrid_custom", label: "Hybrid / Custom" },
];

const ASSET_TYPES = [
  { value: "inverter", label: "Inverter" },
  { value: "panel", label: "Solar Panel" },
  { value: "battery", label: "Battery" },
  { value: "meter", label: "Meter" },
  { value: "transformer", label: "Transformer" },
  { value: "combiner_box", label: "Combiner Box" },
  { value: "monitoring", label: "Monitoring System" },
  { value: "genset", label: "Generator Set" },
  { value: "tracker", label: "Solar Tracker" },
  { value: "switchgear", label: "Switchgear" },
  { value: "cable", label: "Cable" },
  { value: "other", label: "Other" },
];

const ASSET_CATEGORIES = [
  { value: "generation", label: "Generation" },
  { value: "storage", label: "Storage" },
  { value: "distribution", label: "Distribution" },
  { value: "monitoring", label: "Monitoring" },
  { value: "auxiliary", label: "Auxiliary" },
];

interface AddAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: number;
  systemId?: number;
  projectId?: number;
  onSuccess?: () => void;
}

export function AddAssetModal({ open, onOpenChange, siteId, systemId, projectId, onSuccess }: AddAssetModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    vatrId: "",
    assetType: "",
    assetCategory: "generation",
    manufacturer: "",
    model: "",
    serialNumber: "",
    nominalCapacityKw: "",
    assetClassification: "",
    gridConnectionType: "",
    networkTopology: "",
    configurationProfile: "",
    locationOnSite: "",
    selectedSiteId: siteId?.toString() || "",
    selectedSystemId: systemId?.toString() || "",
  });
  
  const utils = trpc.useUtils();
  
  // Fetch sites for selection
  const { data: sites } = trpc.sites.list.useQuery();
  
  // Fetch systems based on selected site
  const { data: systems } = trpc.systems.list.useQuery(
    formData.selectedSiteId ? { siteId: parseInt(formData.selectedSiteId) } : {},
    { enabled: !!formData.selectedSiteId }
  );
  
  // Reset system when site changes
  useEffect(() => {
    if (!siteId) {
      setFormData(prev => ({ ...prev, selectedSystemId: "" }));
    }
  }, [formData.selectedSiteId, siteId]);
  
  const createAsset = trpc.assets.create.useMutation({
    onSuccess: () => {
      toast.success("Asset created successfully");
      utils.assets.list.invalidate();
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to create asset: ${error.message}`);
    },
  });
  
  const resetForm = () => {
    setFormData({
      name: "",
      vatrId: "",
      assetType: "",
      assetCategory: "generation",
      manufacturer: "",
      model: "",
      serialNumber: "",
      nominalCapacityKw: "",
      assetClassification: "",
      gridConnectionType: "",
      networkTopology: "",
      configurationProfile: "",
      locationOnSite: "",
      selectedSiteId: siteId?.toString() || "",
      selectedSystemId: systemId?.toString() || "",
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.assetType) {
      toast.error("Name and Asset Type are required");
      return;
    }
    
    if (!formData.selectedSiteId || !formData.selectedSystemId) {
      toast.error("Site and System are required");
      return;
    }
    
    createAsset.mutate({
      name: formData.name,
      vatrId: formData.vatrId || undefined,
      assetType: formData.assetType as any,
      assetCategory: formData.assetCategory as any,
      manufacturer: formData.manufacturer || undefined,
      model: formData.model || undefined,
      serialNumber: formData.serialNumber || undefined,
      nominalCapacityKw: formData.nominalCapacityKw || undefined,
      assetClassification: formData.assetClassification as any || undefined,
      gridConnectionType: formData.gridConnectionType as any || undefined,
      networkTopology: formData.networkTopology as any || undefined,
      configurationProfile: formData.configurationProfile as any || undefined,
      locationOnSite: formData.locationOnSite || undefined,
      siteId: parseInt(formData.selectedSiteId),
      systemId: parseInt(formData.selectedSystemId),
      projectId: projectId,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Location</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site">Site *</Label>
                <Select 
                  value={formData.selectedSiteId} 
                  onValueChange={(v) => setFormData({ ...formData, selectedSiteId: v, selectedSystemId: "" })}
                  disabled={!!siteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.map((site: any) => (
                      <SelectItem key={site.id} value={site.id.toString()}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="system">System *</Label>
                <Select 
                  value={formData.selectedSystemId} 
                  onValueChange={(v) => setFormData({ ...formData, selectedSystemId: v })}
                  disabled={!formData.selectedSiteId || !!systemId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.selectedSiteId ? "Select system" : "Select site first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {systems?.map((system: any) => (
                      <SelectItem key={system.id} value={system.id.toString()}>{system.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Asset Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., INV-001"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="vatrId">VATR ID</Label>
                <Input
                  id="vatrId"
                  value={formData.vatrId}
                  onChange={(e) => setFormData({ ...formData, vatrId: e.target.value })}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetType">Asset Type *</Label>
                <Select value={formData.assetType} onValueChange={(v) => setFormData({ ...formData, assetType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assetCategory">Category *</Label>
                <Select value={formData.assetCategory} onValueChange={(v) => setFormData({ ...formData, assetCategory: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="e.g., SN-12345678"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nominalCapacityKw">Capacity (kW)</Label>
                <Input
                  id="nominalCapacityKw"
                  value={formData.nominalCapacityKw}
                  onChange={(e) => setFormData({ ...formData, nominalCapacityKw: e.target.value })}
                  placeholder="e.g., 25"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., SMA, Huawei, Tesla"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., Sunny Tripower 25000TL"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="locationOnSite">Location on Site</Label>
              <Input
                id="locationOnSite"
                value={formData.locationOnSite}
                onChange={(e) => setFormData({ ...formData, locationOnSite: e.target.value })}
                placeholder="e.g., Rooftop Array A, Building 2"
              />
            </div>
          </div>
          
          {/* Classification */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Classification</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assetClassification">Asset Classification</Label>
                <Select value={formData.assetClassification} onValueChange={(v) => setFormData({ ...formData, assetClassification: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_CLASSIFICATIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gridConnectionType">Grid Connection Type</Label>
                <Select value={formData.gridConnectionType} onValueChange={(v) => setFormData({ ...formData, gridConnectionType: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select connection type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRID_CONNECTION_TYPES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="networkTopology">Network Topology</Label>
                <Select value={formData.networkTopology} onValueChange={(v) => setFormData({ ...formData, networkTopology: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select topology" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_TOPOLOGIES.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="configurationProfile">Configuration Profile</Label>
                <Select value={formData.configurationProfile} onValueChange={(v) => setFormData({ ...formData, configurationProfile: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIGURATION_PROFILES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAsset.isPending}>
              {createAsset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
