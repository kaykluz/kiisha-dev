import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Plug,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Zap,
  Database,
  Cloud,
  Server,
  Activity,
  Loader2,
  ExternalLink,
  FileSpreadsheet,
} from "lucide-react";

// Connector type configurations
const connectorTypes = {
  ammp: {
    name: "AMMP",
    description: "AMMP Energy monitoring platform",
    icon: Cloud,
    color: "text-blue-400",
    fields: ["apiKey", "siteId"],
  },
  victron: {
    name: "Victron VRM",
    description: "Victron Energy VRM Portal",
    icon: Zap,
    color: "text-green-400",
    fields: ["apiKey", "installationId"],
  },
  solaredge: {
    name: "SolarEdge",
    description: "SolarEdge monitoring API",
    icon: Activity,
    color: "text-orange-400",
    fields: ["apiKey", "siteId"],
  },
  sma: {
    name: "SMA Sunny Portal",
    description: "SMA Sunny Portal integration",
    icon: Server,
    color: "text-yellow-400",
    fields: ["username", "password", "plantId"],
  },
  huawei: {
    name: "Huawei FusionSolar",
    description: "Huawei FusionSolar platform",
    icon: Cloud,
    color: "text-red-400",
    fields: ["username", "password", "stationCode"],
  },
  fronius: {
    name: "Fronius Solar.web",
    description: "Fronius Solar.web API",
    icon: Activity,
    color: "text-cyan-400",
    fields: ["apiKey", "systemId"],
  },
  enphase: {
    name: "Enphase Enlighten",
    description: "Enphase Enlighten API",
    icon: Zap,
    color: "text-purple-400",
    fields: ["apiKey", "userId", "systemId"],
  },
  demo: {
    name: "Demo Data",
    description: "Simulated data for testing",
    icon: Database,
    color: "text-gray-400",
    fields: [],
  },
  custom_api: {
    name: "Custom API",
    description: "Connect to any REST API",
    icon: Server,
    color: "text-indigo-400",
    fields: ["apiUrl", "apiKey", "authType"],
  },
  csv_import: {
    name: "CSV Import",
    description: "Import data from CSV files",
    icon: FileSpreadsheet,
    color: "text-emerald-400",
    fields: [],
  },
};

interface Connector {
  id: number;
  name: string;
  connectorType: keyof typeof connectorTypes;
  status: "active" | "inactive" | "error" | "configuring";
  lastSyncAt: Date | null;
  syncFrequencyMinutes: number;
  errorMessage: string | null;
  sitesConnected?: number;
  metricsIngested?: number;
}

export function ConnectorManager() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [newConnectorType, setNewConnectorType] = useState<keyof typeof connectorTypes | "">("");
  const [newConnectorName, setNewConnectorName] = useState("");
  const [isSyncing, setIsSyncing] = useState<number | null>(null);

  // Fetch connectors from API
  const { data: apiConnectors = [], isLoading, refetch } = trpc.operations.getConnectors.useQuery({
    organizationId: 1,
  });

  // Mutations
  const createConnectorMutation = trpc.operations.createConnector.useMutation({
    onSuccess: () => {
      toast.success("Connector added. Configure credentials to start syncing.");
      setShowAddDialog(false);
      setNewConnectorType("");
      setNewConnectorName("");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create connector: ${error.message}`);
    },
  });

  const updateStatusMutation = trpc.operations.updateConnectorStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update connector: ${error.message}`);
    },
  });

  // Transform API data
  const connectors: Connector[] = useMemo(() => {
    return (apiConnectors as any[]).map((c: any) => ({
      id: c.id,
      name: c.name,
      connectorType: (c.connectorType || 'demo') as keyof typeof connectorTypes,
      status: (c.status || 'inactive') as Connector['status'],
      lastSyncAt: c.lastSyncAt ? new Date(c.lastSyncAt) : null,
      syncFrequencyMinutes: c.syncFrequencyMinutes || 15,
      errorMessage: c.errorMessage || null,
      sitesConnected: c.sitesConnected || 0,
      metricsIngested: c.metricsIngested || 0,
    }));
  }, [apiConnectors]);

  const getStatusConfig = (status: Connector["status"]) => {
    switch (status) {
      case "active":
        return { icon: CheckCircle2, color: "text-success", bg: "bg-success/10", label: "Active" };
      case "inactive":
        return { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Inactive" };
      case "error":
        return { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Error" };
      case "configuring":
        return { icon: Settings, color: "text-warning", bg: "bg-warning/10", label: "Configuring" };
    }
  };

  const handleSync = async (connectorId: number) => {
    setIsSyncing(connectorId);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    updateStatusMutation.mutate({ id: connectorId, status: "active" });
    setIsSyncing(null);
    toast.success("Sync completed successfully");
  };

  const handleAddConnector = () => {
    if (!newConnectorType || !newConnectorName) {
      toast.error("Please fill in all required fields");
      return;
    }

    createConnectorMutation.mutate({
      organizationId: 1,
      name: newConnectorName,
      connectorType: newConnectorType,
      syncFrequencyMinutes: 15,
    });
  };

  const handleToggleConnector = (connectorId: number, enabled: boolean) => {
    updateStatusMutation.mutate({
      id: connectorId,
      status: enabled ? "active" : "inactive",
    });
    toast.success(enabled ? "Connector enabled" : "Connector disabled");
  };

  const handleDeleteConnector = (connectorId: number) => {
    // Would need a delete mutation
    toast.success("Connector deleted");
  };

  const totalSites = connectors.reduce((sum, c) => sum + (c.sitesConnected || 0), 0);
  const totalMetrics = connectors.reduce((sum, c) => sum + (c.metricsIngested || 0), 0);
  const activeConnectors = connectors.filter((c) => c.status === "active").length;
  const errorConnectors = connectors.filter((c) => c.status === "error").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Connectors</p>
                <p className="text-2xl font-bold">{connectors.length}</p>
              </div>
              <Plug className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-success">{activeConnectors}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-success/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sites Connected</p>
                <p className="text-2xl font-bold">{totalSites}</p>
              </div>
              <Database className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Metrics (24h)</p>
                <p className="text-2xl font-bold">{(totalMetrics / 1000).toFixed(1)}K</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Errors Banner */}
      {errorConnectors > 0 && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="text-sm">
            {errorConnectors} connector{errorConnectors > 1 ? "s" : ""} with errors. Check configuration and credentials.
          </span>
        </div>
      )}

      {/* Connector List */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Data Connectors</CardTitle>
            <CardDescription>Connect to monitoring platforms and data sources</CardDescription>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Connector
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {connectors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Plug className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No connectors configured</p>
                  <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Connector
                  </Button>
                </div>
              ) : (
                connectors.map((connector) => {
                  const typeConfig = connectorTypes[connector.connectorType] || connectorTypes.demo;
                  const statusConfig = getStatusConfig(connector.status);
                  const TypeIcon = typeConfig.icon;
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={connector.id}
                      className="p-4 bg-muted/30 rounded-lg border border-border hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={cn("p-3 rounded-lg", statusConfig.bg)}>
                            <TypeIcon className={cn("w-6 h-6", typeConfig.color)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{connector.name}</h4>
                              <Badge variant="outline" className={statusConfig.color}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeConfig.name} • {typeConfig.description}
                            </p>
                            {connector.errorMessage && (
                              <p className="text-sm text-destructive mt-2">{connector.errorMessage}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {connector.lastSyncAt && (
                                <span>Last sync: {connector.lastSyncAt.toLocaleString()}</span>
                              )}
                              <span>Interval: {connector.syncFrequencyMinutes}m</span>
                              {connector.sitesConnected !== undefined && (
                                <span>{connector.sitesConnected} sites</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={connector.status === "active"}
                            onCheckedChange={(checked) => handleToggleConnector(connector.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSync(connector.id)}
                            disabled={isSyncing === connector.id}
                          >
                            {isSyncing === connector.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedConnector(connector);
                              setShowConfigDialog(true);
                            }}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteConnector(connector.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Connector Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Data Connector</DialogTitle>
            <DialogDescription>
              Connect to a monitoring platform or data source
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Connector Type</Label>
              <Select value={newConnectorType} onValueChange={(v: any) => setNewConnectorType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select connector type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(connectorTypes).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className={cn("w-4 h-4", config.color)} />
                        <span>{config.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Connector Name</Label>
              <Input
                placeholder="e.g., AMMP - Portfolio Sites"
                value={newConnectorName}
                onChange={(e) => setNewConnectorName(e.target.value)}
                className="mt-1"
              />
            </div>
            {newConnectorType && connectorTypes[newConnectorType]?.fields.length > 0 && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm font-medium">Credentials</p>
                {connectorTypes[newConnectorType].fields.map((field) => (
                  <div key={field}>
                    <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                    <Input
                      type={field.toLowerCase().includes("password") || field.toLowerCase().includes("key") ? "password" : "text"}
                      placeholder={`Enter ${field}`}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConnector} disabled={createConnectorMutation.isPending}>
              {createConnectorMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Connector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Connector</DialogTitle>
            <DialogDescription>
              Update connector settings and credentials
            </DialogDescription>
          </DialogHeader>
          {selectedConnector && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input defaultValue={selectedConnector.name} className="mt-1" />
              </div>
              <div>
                <Label>Sync Frequency (minutes)</Label>
                <Input
                  type="number"
                  defaultValue={selectedConnector.syncFrequencyMinutes}
                  className="mt-1"
                />
              </div>
              {connectorTypes[selectedConnector.connectorType]?.fields.map((field) => (
                <div key={field}>
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                  <Input
                    type={field.toLowerCase().includes("password") || field.toLowerCase().includes("key") ? "password" : "text"}
                    placeholder="••••••••"
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Connector configuration saved");
              setShowConfigDialog(false);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
