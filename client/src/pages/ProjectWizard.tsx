import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sun,
  Battery,
  Wind,
  Zap,
  Grid3X3,
  MapPin,
  Building2,
  Gauge,
  GitBranch,
  DollarSign,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Loader2,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Project Type", icon: Zap },
  { id: 2, label: "Mounting & Scale", icon: Grid3X3 },
  { id: 3, label: "Project Info", icon: Building2 },
  { id: 4, label: "Location", icon: MapPin },
  { id: 5, label: "Capacity", icon: Gauge },
  { id: 6, label: "Grid & Config", icon: GitBranch },
  { id: 7, label: "Off-taker", icon: DollarSign },
  { id: 8, label: "Stages", icon: GitBranch },
  { id: 9, label: "Review & Create", icon: CheckCircle2 },
];

const TECH_OPTIONS = [
  { value: "PV", label: "Solar PV", icon: Sun, desc: "Photovoltaic solar generation" },
  { value: "BESS", label: "Battery Storage", icon: Battery, desc: "Battery energy storage system" },
  { value: "PV+BESS", label: "Solar + Battery", icon: Zap, desc: "Hybrid solar and battery" },
  { value: "Wind", label: "Wind", icon: Wind, desc: "Wind energy generation" },
  { value: "Minigrid", label: "Mini-Grid", icon: Grid3X3, desc: "Decentralized mini-grid system" },
  { value: "C&I", label: "C&I", icon: Building2, desc: "Commercial & Industrial" },
];

const CLASSIFICATION_OPTIONS = [
  { value: "residential", label: "Residential" },
  { value: "small_commercial", label: "Small Commercial" },
  { value: "large_commercial", label: "Large Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "mini_grid", label: "Mini-Grid" },
  { value: "mesh_grid", label: "Mesh Grid" },
  { value: "interconnected_mini_grids", label: "Interconnected Mini-Grids" },
  { value: "grid_connected", label: "Grid Connected" },
];

const GRID_OPTIONS = [
  { value: "grid_tied", label: "Grid-Tied" },
  { value: "islanded", label: "Islanded" },
  { value: "islandable", label: "Islandable" },
  { value: "weak_grid", label: "Weak Grid" },
  { value: "no_grid", label: "No Grid" },
];

const CONFIG_OPTIONS = [
  { value: "solar_only", label: "Solar Only" },
  { value: "solar_bess", label: "Solar + BESS" },
  { value: "solar_genset", label: "Solar + Genset" },
  { value: "solar_bess_genset", label: "Solar + BESS + Genset" },
  { value: "bess_only", label: "BESS Only" },
  { value: "genset_only", label: "Genset Only" },
  { value: "hybrid", label: "Hybrid" },
];

const COUPLING_OPTIONS = [
  { value: "AC_COUPLED", label: "AC Coupled" },
  { value: "DC_COUPLED", label: "DC Coupled" },
  { value: "HYBRID_COUPLED", label: "Hybrid Coupled" },
  { value: "NOT_APPLICABLE", label: "N/A" },
];

const PROJECT_STAGES = [
  { value: "origination", label: "Origination" },
  { value: "feasibility", label: "Feasibility" },
  { value: "development", label: "Development" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "ntp", label: "Notice to Proceed" },
  { value: "construction", label: "Construction" },
  { value: "commissioning", label: "Commissioning" },
  { value: "cod", label: "COD" },
  { value: "operations", label: "Operations" },
];

const STATUS_OPTIONS = [
  { value: "prospecting", label: "Prospecting" },
  { value: "development", label: "Development" },
  { value: "construction", label: "Construction" },
  { value: "operational", label: "Operational" },
];

const OFFTAKER_TYPES = [
  { value: "industrial", label: "Industrial" },
  { value: "commercial", label: "Commercial" },
  { value: "utility", label: "Utility" },
  { value: "community", label: "Community" },
  { value: "residential_aggregate", label: "Residential Aggregate" },
];

const CONTRACT_TYPES = [
  { value: "ppa", label: "PPA" },
  { value: "lease", label: "Lease" },
  { value: "esco", label: "ESCO" },
  { value: "direct_sale", label: "Direct Sale" },
  { value: "captive", label: "Captive" },
];

const COUNTRIES = [
  "Nigeria", "Kenya", "Ghana", "South Africa", "Tanzania", "Senegal",
  "Côte d'Ivoire", "Uganda", "Rwanda", "Ethiopia", "Mozambique", "Zambia",
  "United States", "United Kingdom", "Germany", "India", "Australia",
];

interface WizardData {
  technology: string;
  assetClassification: string;
  gridConnectionType: string;
  configurationProfile: string;
  couplingTopology: string;
  name: string;
  code: string;
  portfolioId: string;
  country: string;
  state: string;
  city: string;
  latitude: string;
  longitude: string;
  address: string;
  timezone: string;
  capacityMw: string;
  capacityMwh: string;
  offtakerName: string;
  offtakerType: string;
  contractType: string;
  projectValueUsd: string;
  stage: string;
  status: string;
  codDate: string;
  copyFromProjectId: string;
}

const defaultData: WizardData = {
  technology: "",
  assetClassification: "",
  gridConnectionType: "",
  configurationProfile: "",
  couplingTopology: "",
  name: "",
  code: "",
  portfolioId: "",
  country: "Nigeria",
  state: "",
  city: "",
  latitude: "",
  longitude: "",
  address: "",
  timezone: "Africa/Lagos",
  capacityMw: "",
  capacityMwh: "",
  offtakerName: "",
  offtakerType: "",
  contractType: "",
  projectValueUsd: "",
  stage: "feasibility",
  status: "development",
  codDate: "",
  copyFromProjectId: "",
};

function ProjectWizardContent() {
  const { state: authState } = useAuth();
  const orgId = authState?.activeOrganization?.id ?? 1;
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(defaultData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: existingProjects } = trpc.projects.list.useQuery();
  const { data: portfolioList } = trpc.portfolioViews.list.useQuery();

  const createProjectMutation = trpc.projects.create.useMutation({
    onSuccess: (result) => {
      toast.success("Project created successfully!");
      navigate("/");
    },
    onError: (err) => {
      toast.error(`Failed to create project: ${err.message}`);
      setIsSubmitting(false);
    },
  });

  const update = (field: keyof WizardData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!data.technology;
      case 2: return true; // optional
      case 3: return !!data.name;
      case 4: return !!data.country;
      case 5: return true; // optional
      case 6: return true;
      case 7: return true;
      case 8: return !!data.stage && !!data.status;
      case 9: return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    createProjectMutation.mutate({
      portfolioId: data.portfolioId ? parseInt(data.portfolioId) : 1,
      organizationId: orgId,
      name: data.name,
      code: data.code || undefined,
      country: data.country,
      state: data.state || undefined,
      city: data.city || undefined,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined,
      address: data.address || undefined,
      timezone: data.timezone || undefined,
      technology: data.technology as any,
      capacityMw: data.capacityMw || undefined,
      capacityMwh: data.capacityMwh || undefined,
      status: data.status as any,
      stage: data.stage as any,
      assetClassification: data.assetClassification as any || undefined,
      gridConnectionType: data.gridConnectionType as any || undefined,
      configurationProfile: data.configurationProfile as any || undefined,
      couplingTopology: data.couplingTopology as any || undefined,
      offtakerName: data.offtakerName || undefined,
      offtakerType: data.offtakerType as any || undefined,
      contractType: data.contractType as any || undefined,
      projectValueUsd: data.projectValueUsd || undefined,
      codDate: data.codDate || undefined,
      copyFromProjectId: data.copyFromProjectId ? parseInt(data.copyFromProjectId) : undefined,
    });
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Create New Project</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Step {step} of {STEPS.length}: {STEPS[step - 1].label}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")}>
              Cancel
            </Button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = s.id === step;
              const isComplete = s.id < step;
              return (
                <button
                  key={s.id}
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-[var(--color-brand-primary)] text-white"
                      : isComplete
                      ? "bg-[var(--color-semantic-success)]/10 text-[var(--color-semantic-success)] cursor-pointer hover:bg-[var(--color-semantic-success)]/20"
                      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Step 1: Technology */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Select Project Type</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Choose the primary energy technology for this project</p>
              </div>

              {/* Copy from existing */}
              {existingProjects && existingProjects.length > 0 && (
                <div className="p-4 rounded-lg border border-dashed border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Copy className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">Copy from existing project</span>
                  </div>
                  <Select value={data.copyFromProjectId} onValueChange={(v) => update("copyFromProjectId", v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a project to copy..." />
                    </SelectTrigger>
                    <SelectContent>
                      {existingProjects.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {TECH_OPTIONS.map((tech) => {
                  const Icon = tech.icon;
                  const selected = data.technology === tech.value;
                  return (
                    <button
                      key={tech.value}
                      onClick={() => update("technology", tech.value)}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                        selected
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5"
                          : "border-[var(--color-border-primary)] hover:border-[var(--color-border-secondary)] bg-[var(--color-bg-secondary)]"
                      }`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 ${selected ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-secondary)]"}`} />
                      <div>
                        <div className={`font-medium text-sm ${selected ? "text-[var(--color-brand-primary)]" : "text-[var(--color-text-primary)]"}`}>
                          {tech.label}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{tech.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Classification & Scale */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Mounting Type & Scale</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Classify the project type and grid connection</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Asset Classification</Label>
                  <Select value={data.assetClassification} onValueChange={(v) => update("assetClassification", v)}>
                    <SelectTrigger><SelectValue placeholder="Select classification..." /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grid Connection Type</Label>
                  <Select value={data.gridConnectionType} onValueChange={(v) => update("gridConnectionType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select grid type..." /></SelectTrigger>
                    <SelectContent>
                      {GRID_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Configuration Profile</Label>
                  <Select value={data.configurationProfile} onValueChange={(v) => update("configurationProfile", v)}>
                    <SelectTrigger><SelectValue placeholder="Select config..." /></SelectTrigger>
                    <SelectContent>
                      {CONFIG_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Coupling Topology</Label>
                  <Select value={data.couplingTopology} onValueChange={(v) => update("couplingTopology", v)}>
                    <SelectTrigger><SelectValue placeholder="Select coupling..." /></SelectTrigger>
                    <SelectContent>
                      {COUPLING_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Project Info */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Project Information</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Name and identify your project</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Project Name *</Label>
                  <Input value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Lekki Solar Farm" />
                </div>
                <div>
                  <Label>Project Code</Label>
                  <Input value={data.code} onChange={(e) => update("code", e.target.value)} placeholder="e.g. LSF-001" />
                </div>
                <div>
                  <Label>Portfolio</Label>
                  <Select value={data.portfolioId} onValueChange={(v) => update("portfolioId", v)}>
                    <SelectTrigger><SelectValue placeholder="Select portfolio..." /></SelectTrigger>
                    <SelectContent>
                      {portfolioList?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Location */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Project Location</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Where is this project located?</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Country *</Label>
                  <Select value={data.country} onValueChange={(v) => update("country", v)}>
                    <SelectTrigger><SelectValue placeholder="Select country..." /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>State / Region</Label>
                    <Input value={data.state} onChange={(e) => update("state", e.target.value)} placeholder="e.g. Lagos" />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input value={data.city} onChange={(e) => update("city", e.target.value)} placeholder="e.g. Lekki" />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={data.address} onChange={(e) => update("address", e.target.value)} placeholder="Site address..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Latitude</Label>
                    <Input value={data.latitude} onChange={(e) => update("latitude", e.target.value)} placeholder="e.g. 6.4541" />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input value={data.longitude} onChange={(e) => update("longitude", e.target.value)} placeholder="e.g. 3.4205" />
                  </div>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input value={data.timezone} onChange={(e) => update("timezone", e.target.value)} placeholder="Africa/Lagos" />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Capacity */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Project Capacity</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Define the generation and storage capacity</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Generation Capacity (MW DC)</Label>
                  <Input type="number" step="0.01" value={data.capacityMw} onChange={(e) => update("capacityMw", e.target.value)} placeholder="e.g. 5.00" />
                </div>
                {(data.technology === "BESS" || data.technology === "PV+BESS") && (
                  <div>
                    <Label>Storage Capacity (MWh)</Label>
                    <Input type="number" step="0.01" value={data.capacityMwh} onChange={(e) => update("capacityMwh", e.target.value)} placeholder="e.g. 10.00" />
                  </div>
                )}
                <div>
                  <Label>Estimated Project Value (USD)</Label>
                  <Input type="number" step="0.01" value={data.projectValueUsd} onChange={(e) => update("projectValueUsd", e.target.value)} placeholder="e.g. 5000000" />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Grid & Config */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Grid Connection & Configuration</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Technical configuration details</p>
              </div>
              <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Grid and configuration settings were set in Step 2. You can go back to modify them, or proceed to the next step.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {data.assetClassification && <Badge variant="outline">{data.assetClassification}</Badge>}
                  {data.gridConnectionType && <Badge variant="outline">{data.gridConnectionType}</Badge>}
                  {data.configurationProfile && <Badge variant="outline">{data.configurationProfile}</Badge>}
                  {data.couplingTopology && <Badge variant="outline">{data.couplingTopology}</Badge>}
                  {!data.assetClassification && !data.gridConnectionType && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">No configuration set yet</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Off-taker */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Off-taker Information</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Who is the energy buyer?</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Off-taker Name</Label>
                  <Input value={data.offtakerName} onChange={(e) => update("offtakerName", e.target.value)} placeholder="e.g. Dangote Industries" />
                </div>
                <div>
                  <Label>Off-taker Type</Label>
                  <Select value={data.offtakerType} onValueChange={(v) => update("offtakerType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {OFFTAKER_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Contract Type</Label>
                  <Select value={data.contractType} onValueChange={(v) => update("contractType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select contract type..." /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 8: Stages */}
          {step === 8 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Project & Transaction Stage</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Set the current lifecycle and transaction stage</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>Project Stage *</Label>
                  <Select value={data.stage} onValueChange={(v) => update("stage", v)}>
                    <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STAGES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Project Status *</Label>
                  <Select value={data.status} onValueChange={(v) => update("status", v)}>
                    <SelectTrigger><SelectValue placeholder="Select status..." /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target COD Date</Label>
                  <Input type="date" value={data.codDate} onChange={(e) => update("codDate", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 9: Review */}
          {step === 9 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Review & Create</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">Confirm project details before creating</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Technology", value: TECH_OPTIONS.find(t => t.value === data.technology)?.label },
                  { label: "Project Name", value: data.name },
                  { label: "Project Code", value: data.code },
                  { label: "Location", value: [data.city, data.state, data.country].filter(Boolean).join(", ") },
                  { label: "Capacity", value: data.capacityMw ? `${data.capacityMw} MW` : undefined },
                  { label: "Storage", value: data.capacityMwh ? `${data.capacityMwh} MWh` : undefined },
                  { label: "Classification", value: CLASSIFICATION_OPTIONS.find(c => c.value === data.assetClassification)?.label },
                  { label: "Grid", value: GRID_OPTIONS.find(g => g.value === data.gridConnectionType)?.label },
                  { label: "Off-taker", value: data.offtakerName },
                  { label: "Contract", value: CONTRACT_TYPES.find(c => c.value === data.contractType)?.label },
                  { label: "Stage", value: PROJECT_STAGES.find(s => s.value === data.stage)?.label },
                  { label: "Status", value: STATUS_OPTIONS.find(s => s.value === data.status)?.label },
                  { label: "Project Value", value: data.projectValueUsd ? `$${Number(data.projectValueUsd).toLocaleString()}` : undefined },
                  { label: "COD Date", value: data.codDate },
                ].filter(item => item.value).map((item) => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-[var(--color-border-primary)]">
                    <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-[var(--color-border-primary)]">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            {step < 9 ? (
              <Button
                onClick={() => setStep(s => Math.min(9, s + 1))}
                disabled={!canAdvance()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting || !data.name || !data.technology}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function ProjectWizard() {
  return <ProjectWizardContent />;
}
