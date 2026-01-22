import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { AddAssetModal } from "@/components/AddAssetModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ClipboardList,
  Box,
  Calendar,
  Package,
  FileText,
  Plus,
  Building2 as SiteIcon,
  Search,
  Filter,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  MapPin,
  Zap,
  Battery,
  Gauge,
  Hash,
  User,
  Building2,
  History,
  Shield,
  DollarSign,
  ExternalLink,
  MoreVertical,
  Play,
  Pause,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { SitesProfileOverview } from "@/components/SiteProfileBuilder";

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    open: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
    assigned: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <User className="w-3 h-3" /> },
    in_progress: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", icon: <Play className="w-3 h-3" /> },
    on_hold: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: <Pause className="w-3 h-3" /> },
    completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
    active: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
    inactive: { color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: <XCircle className="w-3 h-3" /> },
    failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: <AlertTriangle className="w-3 h-3" /> },
  };
  
  const variant = variants[status] || variants.open;
  
  return (
    <Badge variant="outline" className={`${variant.color} gap-1 capitalize`}>
      {variant.icon}
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

// Priority badge component
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  
  return (
    <Badge variant="outline" className={`${colors[priority] || colors.medium} capitalize`}>
      {priority}
    </Badge>
  );
}

// O&M Dashboard Tab
function OmDashboardTab() {
  const { data: stats, isLoading } = trpc.omDashboard.getStats.useQuery({});
  
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.workOrders.open || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.workOrders.overdue || 0} overdue
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.workOrders.inProgress || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.workOrders.completed || 0} completed this month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.assets.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.assets.active || 0} active
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Assets</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{stats?.assets.failed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Asset Type Distribution */}
      {stats?.assets.byType && Object.keys(stats.assets.byType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Asset Distribution by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Object.entries(stats.assets.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium capitalize">{type.replace(/_/g, " ")}</p>
                    <p className="text-2xl font-bold">{count as number}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Upcoming Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Maintenance</CardTitle>
          <CardDescription>Scheduled maintenance in the next 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.upcomingMaintenance && stats.upcomingMaintenance.length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingMaintenance.map((schedule: any) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{schedule.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {schedule.maintenanceType} • {schedule.taskCategory}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {schedule.nextDueDate ? format(new Date(schedule.nextDueDate), "MMM d, yyyy") : "Not scheduled"}
                    </p>
                    <StatusBadge status={schedule.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No upcoming maintenance scheduled</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Work Orders Tab
function WorkOrdersTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  
  const { data: workOrders, isLoading, refetch } = trpc.workOrders.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : {}
  );
  const { data: sites } = trpc.sites.list.useQuery({});
  
  const createWorkOrder = trpc.workOrders.create.useMutation({
    onSuccess: () => {
      toast.success("Work order created successfully");
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create work order: ${error.message}`);
    },
  });
  
  const updateStatus = trpc.workOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      refetch();
    },
  });
  
  const filteredWorkOrders = workOrders?.filter((wo: any) =>
    wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wo.workOrderNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleCreateWorkOrder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createWorkOrder.mutate({
      siteId: Number(formData.get("siteId")),
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      workType: formData.get("workType") as any,
      priority: formData.get("priority") as any,
      sourceType: "reactive",
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Work Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Work Order</DialogTitle>
              <DialogDescription>Create a new maintenance work order</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateWorkOrder} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="siteId">Site</Label>
                <Select name="siteId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.map((site: any) => (
                      <SelectItem key={site.id} value={String(site.id)}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="Work order title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" placeholder="Describe the work to be done" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workType">Work Type</Label>
                  <Select name="workType" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="preventive">Preventive</SelectItem>
                      <SelectItem value="corrective">Corrective</SelectItem>
                      <SelectItem value="emergency">Emergency</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select name="priority" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createWorkOrder.isPending}>
                  {createWorkOrder.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Work Orders List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkOrders && filteredWorkOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredWorkOrders.map((wo: any) => (
            <Card 
              key={wo.id} 
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedWorkOrder(wo)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">{wo.workOrderNumber}</span>
                        <span className="font-medium">{wo.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="capitalize">{wo.workType}</span>
                        <span>•</span>
                        <span>
                          {wo.scheduledStart 
                            ? `Due ${format(new Date(wo.scheduledStart), "MMM d, yyyy")}`
                            : "Not scheduled"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={wo.priority} />
                    <StatusBadge status={wo.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No work orders found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try adjusting your search" : "Create your first work order to get started"}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Work Order
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Work Order Detail Sheet */}
      <Sheet open={!!selectedWorkOrder} onOpenChange={() => setSelectedWorkOrder(null)}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          {selectedWorkOrder && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{selectedWorkOrder.workOrderNumber}</span>
                </SheetTitle>
                <SheetDescription>{selectedWorkOrder.title}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-150px)] mt-6">
                <div className="space-y-6 pr-4">
                  {/* Status Actions */}
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedWorkOrder.status} />
                    <PriorityBadge priority={selectedWorkOrder.priority} />
                    {selectedWorkOrder.status === "open" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: selectedWorkOrder.id, status: "in_progress" })}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {selectedWorkOrder.status === "in_progress" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateStatus.mutate({ id: selectedWorkOrder.id, status: "completed" })}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="mt-1">{selectedWorkOrder.description || "No description provided"}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Work Type</Label>
                        <p className="mt-1 capitalize">{selectedWorkOrder.workType}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Source</Label>
                        <p className="mt-1 capitalize">{selectedWorkOrder.sourceType}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Scheduled Start</Label>
                        <p className="mt-1">
                          {selectedWorkOrder.scheduledStart 
                            ? format(new Date(selectedWorkOrder.scheduledStart), "MMM d, yyyy HH:mm")
                            : "Not scheduled"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Estimated Hours</Label>
                        <p className="mt-1">{selectedWorkOrder.estimatedHours || "—"}</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p className="mt-1">
                        {format(new Date(selectedWorkOrder.createdAt), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Assets Tab
function AssetsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [classificationFilter, setClassificationFilter] = useState<string>("all");
  const [configFilter, setConfigFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  
  const { data: assets, isLoading } = trpc.assets.list.useQuery(
    typeFilter !== "all" ? { assetType: typeFilter } : {}
  );
  
  const filteredAssets = assets?.filter((asset: any) => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.vatrId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClassification = classificationFilter === "all" || asset.assetClassification === classificationFilter;
    const matchesConfig = configFilter === "all" || asset.configurationProfile === configFilter;
    return matchesSearch && matchesClassification && matchesConfig;
  });
  
  const assetTypeIcons: Record<string, React.ReactNode> = {
    inverter: <Zap className="h-4 w-4" />,
    panel: <Box className="h-4 w-4" />,
    battery: <Battery className="h-4 w-4" />,
    meter: <Gauge className="h-4 w-4" />,
    transformer: <Building2 className="h-4 w-4" />,
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, VATR ID, or serial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="inverter">Inverter</SelectItem>
            <SelectItem value="panel">Panel</SelectItem>
            <SelectItem value="battery">Battery</SelectItem>
            <SelectItem value="meter">Meter</SelectItem>
            <SelectItem value="transformer">Transformer</SelectItem>
            <SelectItem value="combiner_box">Combiner Box</SelectItem>
            <SelectItem value="monitoring">Monitoring</SelectItem>
            <SelectItem value="genset">Genset</SelectItem>
          </SelectContent>
        </Select>
        <Select value={classificationFilter} onValueChange={setClassificationFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="small_commercial">Small Commercial</SelectItem>
            <SelectItem value="large_commercial">Large Commercial</SelectItem>
            <SelectItem value="industrial">Industrial</SelectItem>
            <SelectItem value="mini_grid">Mini-Grid</SelectItem>
            <SelectItem value="mesh_grid">Mesh Grid</SelectItem>
            <SelectItem value="interconnected_mini_grids">Interconnected Mini-Grids</SelectItem>
            <SelectItem value="grid_connected">Grid Connected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={configFilter} onValueChange={setConfigFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Configuration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Configs</SelectItem>
            <SelectItem value="pv_only">PV Only</SelectItem>
            <SelectItem value="pv_bess">PV+BESS</SelectItem>
            <SelectItem value="pv_dg">PV+DG</SelectItem>
            <SelectItem value="pv_bess_dg">PV+BESS+DG</SelectItem>
            <SelectItem value="bess_only">BESS Only</SelectItem>
            <SelectItem value="dg_only">DG Only</SelectItem>
            <SelectItem value="minigrid_pv_bess">Mini-Grid PV+BESS</SelectItem>
            <SelectItem value="minigrid_pv_bess_dg">Mini-Grid PV+BESS+DG</SelectItem>
            <SelectItem value="mesh_pv_bess">Mesh PV+BESS</SelectItem>
            <SelectItem value="mesh_pv_bess_dg">Mesh PV+BESS+DG</SelectItem>
            <SelectItem value="hybrid_custom">Hybrid/Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAddAssetModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Asset
        </Button>
      </div>
      
      {/* Add Asset Modal */}
      <AddAssetModal 
        open={showAddAssetModal} 
        onOpenChange={setShowAddAssetModal}
      />
      
      {/* Assets Grid */}
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
      ) : filteredAssets && filteredAssets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset: any) => (
            <Card 
              key={asset.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setSelectedAsset(asset)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    {assetTypeIcons[asset.assetType] || <Box className="h-4 w-4" />}
                  </div>
                  <StatusBadge status={asset.status} />
                </div>
                <h3 className="font-medium mb-1">{asset.name}</h3>
                <p className="text-sm text-muted-foreground font-mono">{asset.vatrId}</p>
                {/* Classification badges */}
                {(asset.assetClassification || asset.configurationProfile) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {asset.assetClassification && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {asset.assetClassification.replace(/_/g, " ")}
                      </Badge>
                    )}
                    {asset.configurationProfile && (
                      <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                        {asset.configurationProfile.replace(/_/g, "+").toUpperCase()}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Manufacturer</span>
                    <p className="font-medium">{asset.manufacturer || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model</span>
                    <p className="font-medium">{asset.model || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No assets found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "Try adjusting your search" : "No assets have been registered yet"}
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Asset Detail Sheet */}
      <Sheet open={!!selectedAsset} onOpenChange={() => setSelectedAsset(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px]">
          {selectedAsset && <AssetDetailPanel asset={selectedAsset} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Asset Detail Panel
function AssetDetailPanel({ asset }: { asset: any }) {
  const { data: attributes } = trpc.assets.getAttributes.useQuery({ assetId: asset.id });
  const { data: components } = trpc.assets.getComponents.useQuery({ assetId: asset.id });
  
  const [activeTab, setActiveTab] = useState("overview");
  
  // Group attributes by category
  const attributesByCategory = attributes?.reduce((acc: any, attr: any) => {
    const category = attr.attributeCategory;
    if (!acc[category]) acc[category] = [];
    acc[category].push(attr);
    return acc;
  }, {}) || {};
  
  const categoryIcons: Record<string, React.ReactNode> = {
    identity: <Hash className="h-4 w-4" />,
    technical: <Gauge className="h-4 w-4" />,
    operational: <Wrench className="h-4 w-4" />,
    financial: <DollarSign className="h-4 w-4" />,
    compliance: <Shield className="h-4 w-4" />,
  };
  
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          {asset.name}
        </SheetTitle>
        <SheetDescription className="font-mono">{asset.vatrId}</SheetDescription>
      </SheetHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
          <TabsTrigger value="attributes" className="flex-1">Attributes</TabsTrigger>
          <TabsTrigger value="components" className="flex-1">Components</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">History</TabsTrigger>
        </TabsList>
        
        <ScrollArea className="h-[calc(100vh-250px)] mt-4">
          <TabsContent value="overview" className="space-y-4 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={asset.status} />
              <Badge variant="outline" className="capitalize">{asset.condition}</Badge>
              <Badge variant="outline" className="capitalize">{asset.assetCategory}</Badge>
              {asset.assetClassification && (
                <Badge variant="outline" className="capitalize bg-purple-500/10 text-purple-400 border-purple-500/30">
                  {asset.assetClassification.replace(/_/g, " ")}
                </Badge>
              )}
              {asset.configurationProfile && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {asset.configurationProfile.replace(/_/g, "+").toUpperCase()}
                </Badge>
              )}
            </div>
            
            {/* Classification Details */}
            {(asset.assetClassification || asset.gridConnectionType || asset.networkTopology) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Classification
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Asset Class</span>
                    <p className="font-medium capitalize">{asset.assetClassification?.replace(/_/g, " ") || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Grid Connection</span>
                    <p className="font-medium capitalize">{asset.gridConnectionType?.replace(/_/g, " ") || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Network Topology</span>
                    <p className="font-medium capitalize">{asset.networkTopology || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Configuration</span>
                    <p className="font-medium">{asset.configurationProfile?.replace(/_/g, "+").toUpperCase() || "—"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Asset Type</Label>
                <p className="mt-1 capitalize">{asset.assetType.replace(/_/g, " ")}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Serial Number</Label>
                <p className="mt-1 font-mono">{asset.serialNumber || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Manufacturer</Label>
                <p className="mt-1">{asset.manufacturer || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Model</Label>
                <p className="mt-1">{asset.model || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Capacity (kW)</Label>
                <p className="mt-1">{asset.nominalCapacityKw || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Location on Site</Label>
                <p className="mt-1">{asset.locationOnSite || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Installation Date</Label>
                <p className="mt-1">
                  {asset.installationDate 
                    ? format(new Date(asset.installationDate), "MMM d, yyyy")
                    : "—"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Next Maintenance</Label>
                <p className="mt-1">
                  {asset.nextMaintenanceDate 
                    ? format(new Date(asset.nextMaintenanceDate), "MMM d, yyyy")
                    : "—"}
                </p>
              </div>
            </div>
            
            {/* Warranty Info */}
            {(asset.warrantyStartDate || asset.warrantyEndDate) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Warranty
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Start Date</span>
                    <p className="font-medium">
                      {asset.warrantyStartDate 
                        ? format(new Date(asset.warrantyStartDate), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">End Date</span>
                    <p className="font-medium">
                      {asset.warrantyEndDate 
                        ? format(new Date(asset.warrantyEndDate), "MMM d, yyyy")
                        : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Provider</span>
                    <p className="font-medium">{asset.warrantyProvider || "—"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* VATR Integrity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  VATR Integrity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">v{asset.currentVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Content Hash</span>
                  <span className="font-mono text-xs truncate max-w-[200px]">
                    {asset.contentHash || "Not computed"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profile Completeness</span>
                  <span>{asset.profileCompletenessPct || 0}%</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="attributes" className="space-y-4 pr-4">
            {Object.entries(attributesByCategory).length > 0 ? (
              Object.entries(attributesByCategory).map(([category, attrs]: [string, any]) => (
                <Card key={category}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 capitalize">
                      {categoryIcons[category]}
                      {category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {attrs.map((attr: any) => (
                      <div key={attr.id} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <div>
                          <p className="font-medium capitalize">{attr.attributeKey.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground">
                            v{attr.version} • {attr.sourceType} • {attr.verificationStatus}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">
                            {attr.valueText || attr.valueNumeric || attr.valueBoolean?.toString() || "—"}
                            {attr.unit && <span className="text-muted-foreground ml-1">{attr.unit}</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No attributes recorded for this asset
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="components" className="space-y-4 pr-4">
            {components && components.length > 0 ? (
              components.map((component: any) => (
                <Card key={component.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{component.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">
                          {component.componentType.replace(/_/g, " ")}
                        </p>
                      </div>
                      <StatusBadge status={component.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Manufacturer</span>
                        <p>{component.manufacturer || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Model</span>
                        <p>{component.model || "—"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No components registered for this asset
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="pr-4">
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2" />
              <p>Attribute version history will appear here</p>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </>
  );
}

// Main O&M Portal Page
export default function OmPortal() {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">O&M Portal</h1>
          <p className="text-muted-foreground">
            Operations & Maintenance management with VATR asset tracking
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Work Orders
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2">
              <Box className="w-4 h-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="schedules" className="gap-2">
              <Calendar className="w-4 h-4" />
              Schedules
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="w-4 h-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="sites" className="gap-2">
              <SiteIcon className="w-4 h-4" />
              Sites
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard">
            <OmDashboardTab />
          </TabsContent>
          
          <TabsContent value="work-orders">
            <WorkOrdersTab />
          </TabsContent>
          
          <TabsContent value="assets">
            <AssetsTab />
          </TabsContent>
          
          <TabsContent value="schedules">
            <MaintenanceSchedulesTab />
          </TabsContent>
          
          <TabsContent value="inventory">
            <SparePartsTab />
          </TabsContent>
          
          <TabsContent value="sites">
            <SitesProfileOverview />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// Maintenance Schedules Tab
function MaintenanceSchedulesTab() {
  const { data: schedules, isLoading } = trpc.maintenanceSchedules.list.useQuery({});
  
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Maintenance Schedules</h3>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>
      
      {schedules && schedules.length > 0 ? (
        <div className="space-y-3">
          {schedules.map((schedule: any) => (
            <Card key={schedule.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{schedule.name}</h4>
                      <p className="text-sm text-muted-foreground capitalize">
                        {schedule.maintenanceType} • {schedule.frequencyValue} {schedule.frequencyUnit}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Next Due</p>
                      <p className="font-medium">
                        {schedule.nextDueDate 
                          ? format(new Date(schedule.nextDueDate), "MMM d, yyyy")
                          : "Not scheduled"}
                      </p>
                    </div>
                    <StatusBadge status={schedule.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No maintenance schedules</h3>
            <p className="text-muted-foreground mb-4">
              Create recurring maintenance schedules to automate work order generation
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Schedule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Spare Parts Tab
function SparePartsTab() {
  const { data: parts, isLoading } = trpc.spareParts.list.useQuery({});
  
  if (isLoading) {
    return (
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
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Spare Parts Inventory</h3>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Part
        </Button>
      </div>
      
      {parts && parts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parts.map((part: any) => (
            <Card key={part.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Badge 
                    variant="outline" 
                    className={
                      (part.quantityOnHand || 0) <= (part.reorderPoint || 0)
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-green-500/20 text-green-400 border-green-500/30"
                    }
                  >
                    {part.quantityOnHand || 0} in stock
                  </Badge>
                </div>
                <h4 className="font-medium">{part.name}</h4>
                <p className="text-sm text-muted-foreground font-mono">{part.partNumber}</p>
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between text-sm">
                  <span className="text-muted-foreground">Unit Cost</span>
                  <span className="font-medium">
                    {part.currency || "$"}{part.unitCost || "—"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No spare parts</h3>
            <p className="text-muted-foreground mb-4">
              Add spare parts to track inventory and usage
            </p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Part
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
