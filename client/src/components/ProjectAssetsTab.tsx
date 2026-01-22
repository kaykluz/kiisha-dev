/**
 * Project Assets Tab
 * 
 * Displays project-level assets (investable units) with classification filters.
 * In KIISHA terminology: Asset = Project-level investable unit
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Search, Filter, MapPin, Zap, Battery, Building2, Globe, 
  Calendar, DollarSign, Users, FileText, ChevronRight,
  Sun, Wind, Grid3X3, Network, Activity
} from "lucide-react";
import { format } from "date-fns";
import { 
  ProjectClassificationCharts, 
  CLASSIFICATION_LABELS, 
  GRID_CONNECTION_LABELS, 
  CONFIG_LABELS,
  STATUS_LABELS,
  STAGE_LABELS,
  TECHNOLOGY_LABELS,
  type ProjectClassificationFilters
} from "./ProjectClassificationCharts";

// Coupling Topology labels and descriptions
const COUPLING_LABELS: Record<string, string> = {
  AC_COUPLED: "AC Coupled",
  DC_COUPLED: "DC Coupled",
  HYBRID_COUPLED: "Hybrid Coupled",
  UNKNOWN: "Unknown",
  NOT_APPLICABLE: "N/A",
};

const COUPLING_DESCRIPTIONS: Record<string, string> = {
  AC_COUPLED: "Components connect at the AC bus after individual inverters",
  DC_COUPLED: "Components share a common DC bus before a single inverter",
  HYBRID_COUPLED: "Mixed AC and DC coupling within the same system",
};

// Distribution Topology labels and descriptions (for minigrids only)
const DISTRIBUTION_LABELS: Record<string, string> = {
  RADIAL: "Radial",
  RING: "Ring",
  MESH: "Mesh",
  STAR: "Star",
  TREE: "Tree",
  UNKNOWN: "Unknown",
  NOT_APPLICABLE: "N/A",
};

const DISTRIBUTION_DESCRIPTIONS: Record<string, string> = {
  RADIAL: "Single path from source to loads, tree-like structure",
  RING: "Closed loop allowing power flow from either direction",
  MESH: "Multiple interconnected paths between nodes",
  STAR: "Central hub with spokes to each load",
  TREE: "Hierarchical branching structure",
};

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    prospecting: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    development: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    construction: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    operational: "bg-green-500/20 text-green-400 border-green-500/30",
    decommissioned: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  
  return (
    <Badge variant="outline" className={`${colors[status] || colors.development} capitalize`}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

// Stage badge component
function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    origination: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    feasibility: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    development: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    due_diligence: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    ntp: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    construction: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    commissioning: "bg-lime-500/20 text-lime-400 border-lime-500/30",
    cod: "bg-green-500/20 text-green-400 border-green-500/30",
    operations: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  
  return (
    <Badge variant="outline" className={`${colors[stage] || colors.development} capitalize`}>
      {STAGE_LABELS[stage] || stage?.replace(/_/g, " ")}
    </Badge>
  );
}

// Technology icon
function TechnologyIcon({ technology }: { technology: string }) {
  const icons: Record<string, React.ReactNode> = {
    PV: <Sun className="h-4 w-4" />,
    BESS: <Battery className="h-4 w-4" />,
    "PV+BESS": <Zap className="h-4 w-4" />,
    Wind: <Wind className="h-4 w-4" />,
    Minigrid: <Grid3X3 className="h-4 w-4" />,
    "C&I": <Building2 className="h-4 w-4" />,
  };
  return icons[technology] || <Zap className="h-4 w-4" />;
}

// Project Detail Panel
function ProjectDetailPanel({ project }: { project: any }) {
  const [activeTab, setActiveTab] = useState("overview");
  
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <TechnologyIcon technology={project.technology} />
          {project.name}
        </SheetTitle>
        <SheetDescription className="flex items-center gap-2">
          <MapPin className="h-3 w-3" />
          {project.city && `${project.city}, `}{project.state && `${project.state}, `}{project.country}
        </SheetDescription>
      </SheetHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="classification" className="flex-1">Classification</TabsTrigger>
          <TabsTrigger value="financial" className="flex-1">Financial</TabsTrigger>
        </TabsList>
        
        <ScrollArea className="h-[calc(100vh-250px)] mt-4">
          <TabsContent value="overview" className="space-y-4 pr-4">
            {/* Status & Stage */}
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={project.status} />
              <StageBadge stage={project.stage} />
              <Badge variant="outline" className="capitalize">
                {TECHNOLOGY_LABELS[project.technology] || project.technology}
              </Badge>
            </div>
            
            {/* Capacity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Capacity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Power Capacity</span>
                  <p className="font-medium">{project.capacityMw ? `${project.capacityMw} MW` : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Storage Capacity</span>
                  <p className="font-medium">{project.capacityMwh ? `${project.capacityMwh} MWh` : "—"}</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Location */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Country</span>
                  <p className="font-medium">{project.country || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">State/Region</span>
                  <p className="font-medium">{project.state || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">City</span>
                  <p className="font-medium">{project.city || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Coordinates</span>
                  <p className="font-medium">
                    {project.latitude && project.longitude 
                      ? `${Number(project.latitude).toFixed(4)}, ${Number(project.longitude).toFixed(4)}`
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Off-taker */}
            {project.offtakerName && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Off-taker
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{project.offtakerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium capitalize">{project.offtakerType?.replace(/_/g, " ") || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contract Type</span>
                    <p className="font-medium uppercase">{project.contractType || "—"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="classification" className="space-y-4 pr-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Asset Classification
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Classification</span>
                  <p className="font-medium capitalize">
                    {CLASSIFICATION_LABELS[project.assetClassification] || project.assetClassification?.replace(/_/g, " ") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Grid Connection</span>
                  <p className="font-medium capitalize">
                    {GRID_CONNECTION_LABELS[project.gridConnectionType] || project.gridConnectionType?.replace(/_/g, " ") || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Configuration</span>
                  <p className="font-medium">
                    {CONFIG_LABELS[project.configurationProfile] || project.configurationProfile?.replace(/_/g, " ") || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Topology Section */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Technical Topology
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Coupling Topology - Always visible */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Coupling Topology</span>
                    <span className="text-xs text-muted-foreground/60" title="How generation and storage components are electrically connected">
                      (?)
                    </span>
                  </div>
                  <p className="font-medium">
                    {COUPLING_LABELS[project.couplingTopology] || project.couplingTopology?.replace(/_/g, " ") || "—"}
                  </p>
                  {project.couplingTopology && project.couplingTopology !== 'NOT_APPLICABLE' && project.couplingTopology !== 'UNKNOWN' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {COUPLING_DESCRIPTIONS[project.couplingTopology]}
                    </p>
                  )}
                </div>
                
                {/* Distribution Topology - Only for minigrids */}
                {['mini_grid', 'mesh_grid', 'interconnected_mini_grids'].includes(project.assetClassification) && (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Distribution Topology</span>
                      <span className="text-xs text-muted-foreground/60" title="Network architecture for minigrid distribution">
                        (?)
                      </span>
                    </div>
                    <p className="font-medium">
                      {DISTRIBUTION_LABELS[project.distributionTopology] || project.distributionTopology?.replace(/_/g, " ") || "—"}
                    </p>
                    {project.distributionTopology && project.distributionTopology !== 'NOT_APPLICABLE' && project.distributionTopology !== 'UNKNOWN' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {DISTRIBUTION_DESCRIPTIONS[project.distributionTopology]}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Classification badges */}
            <div className="flex flex-wrap gap-2">
              {project.assetClassification && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  {CLASSIFICATION_LABELS[project.assetClassification] || project.assetClassification}
                </Badge>
              )}
              {project.gridConnectionType && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {GRID_CONNECTION_LABELS[project.gridConnectionType] || project.gridConnectionType}
                </Badge>
              )}
              {project.configurationProfile && (
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                  {CONFIG_LABELS[project.configurationProfile] || project.configurationProfile}
                </Badge>
              )}
              {project.couplingTopology && project.couplingTopology !== 'NOT_APPLICABLE' && (
                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                  {COUPLING_LABELS[project.couplingTopology] || project.couplingTopology}
                </Badge>
              )}
              {['mini_grid', 'mesh_grid', 'interconnected_mini_grids'].includes(project.assetClassification) && 
               project.distributionTopology && project.distributionTopology !== 'NOT_APPLICABLE' && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                  {DISTRIBUTION_LABELS[project.distributionTopology] || project.distributionTopology}
                </Badge>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="financial" className="space-y-4 pr-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Project Value</span>
                  <p className="font-medium">
                    {project.projectValueUsd 
                      ? `$${Number(project.projectValueUsd).toLocaleString()}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tariff</span>
                  <p className="font-medium">
                    {project.tariffUsdKwh 
                      ? `$${Number(project.tariffUsdKwh).toFixed(4)}/kWh`
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Key Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">COD Date</span>
                  <p className="font-medium">
                    {project.codDate ? format(new Date(project.codDate), "MMM d, yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">PPA Start</span>
                  <p className="font-medium">
                    {project.ppaStartDate ? format(new Date(project.ppaStartDate), "MMM d, yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">PPA End</span>
                  <p className="font-medium">
                    {project.ppaEndDate ? format(new Date(project.ppaEndDate), "MMM d, yyyy") : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </>
  );
}

// Main component
export function ProjectAssetsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ProjectClassificationFilters>({});
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showCharts, setShowCharts] = useState(true);
  
  const { data: projects, isLoading } = trpc.projects.listWithFilters.useQuery(
    Object.keys(filters).length > 0 ? filters : undefined
  );
  
  // Filter by search query
  const filteredProjects = projects?.filter((project: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.name?.toLowerCase().includes(query) ||
      project.code?.toLowerCase().includes(query) ||
      project.country?.toLowerCase().includes(query) ||
      project.city?.toLowerCase().includes(query) ||
      project.offtakerName?.toLowerCase().includes(query)
    );
  });
  
  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v => v).length;
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select 
          value={filters.assetClassification || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, assetClassification: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            {Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.gridConnectionType || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, gridConnectionType: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Grid Connection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Connections</SelectItem>
            {Object.entries(GRID_CONNECTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.configurationProfile || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, configurationProfile: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Configuration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Configs</SelectItem>
            {Object.entries(CONFIG_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select 
          value={filters.status || "all"} 
          onValueChange={(v) => setFilters(f => ({ ...f, status: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {activeFilterCount > 0 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setFilters({})}
          >
            Clear filters ({activeFilterCount})
          </Button>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCharts(!showCharts)}
        >
          {showCharts ? "Hide Charts" : "Show Charts"}
        </Button>
      </div>
      
      {/* Classification Charts */}
      {showCharts && (
        <div className="mb-6">
          <ProjectClassificationCharts filters={filters} />
        </div>
      )}
      
      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project: any) => (
            <Card 
              key={project.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedProject(project)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <TechnologyIcon technology={project.technology} />
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                
                <h3 className="font-medium mb-1 line-clamp-1">{project.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {project.country}
                  {project.city && ` • ${project.city}`}
                </p>
                
                {/* Classification badges */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {project.assetClassification && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {CLASSIFICATION_LABELS[project.assetClassification] || project.assetClassification.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {project.configurationProfile && (
                    <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                      {CONFIG_LABELS[project.configurationProfile] || project.configurationProfile}
                    </Badge>
                  )}
                </div>
                
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Capacity</span>
                    <p className="font-medium">{project.capacityMw ? `${project.capacityMw} MW` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stage</span>
                    <p className="font-medium capitalize">{STAGE_LABELS[project.stage] || project.stage?.replace(/_/g, " ") || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No assets found</h3>
            <p className="text-muted-foreground">
              {searchQuery || activeFilterCount > 0 
                ? "Try adjusting your search or filters" 
                : "No project-level assets have been created yet"}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Project Detail Sheet */}
      <Sheet open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          {selectedProject && <ProjectDetailPanel project={selectedProject} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
