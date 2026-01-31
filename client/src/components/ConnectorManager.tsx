import { useState } from "react";
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
    color: "text-pink-400",
    fields: ["baseUrl", "apiKey", "authType"],
  },
  csv_import: {
    name: "CSV Import",
    description: "Import data from CSV files",
    icon: FileSpreadsheet,
    color: "text-emerald-400",
    fields: [],
  },
};

// Mock connectors data
const mockConnectors = [
  {
    id: 1,
    name: "AMMP - Portfolio Sites",
    connectorType: "ammp" as const,
    status: "active" as const,
    lastSyncAt: new Date("2026-01-15T10:30:00"),
    syncFrequencyMinutes: 15,
    errorMessage: null,
    sitesConnected: 12,
    metricsIngested: 45000,
  },
  {
    id: 2,
    name: "Victron - Nigeria Minigrids",
    connectorType: "victron" as const,
    status: "active" as const,
    lastSyncAt: new Date("2026-01-15T10:28:00"),
    syncFrequencyMinutes: 5,
    errorMessage: null,
    sitesConnected: 8,
    metricsIngested: 28000,
  },
  {
    id: 3,
    name: "SolarEdge - US Commercial",
    connectorType: "solaredge" as const,
    status: "error" as const,
    lastSyncAt: new Date("2026-01-14T18:00:00"),
    syncFrequencyMinutes: 15,
    errorMessage: "API rate limit exceeded. Retry in 2 hours.",
    sitesConnected: 5,
    metricsIngested: 12000,
  },
  {
    id: 4,
    name: "Demo Data Generator",
    connectorType: "demo" as const,
    status: "active" as const,
    lastSyncAt: new Date("2026-01-15T10:30:00"),
    syncFrequencyMinutes: 1,
    errorMessage: null,
    sitesConnected: 3,
    metricsIngested: 5000,
  },
];

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
  const [connectors, setConnectors] = useState<Connector[]>(mockConnectors);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [newConnectorType, setNewConnectorType] = useState<keyof typeof connectorTypes | "">("");
  const [newConnectorName, setNewConnectorName] = useState("");
  const [isSyncing, setIsSyncing] = useState<number | null>(null);

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
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === connectorId ? { ...c, lastSyncAt: new Date(), status: "active" as const } : c
      )
    );
    setIsSyncing(null);
    toast.success("Sync completed successfully");
  };

  const handleAddConnector = () => {
    if (!newConnectorType || !newConnectorName) {
      toast.error("Please fill in all required fields");
      return;
    }

    const newConnector: Connector = {
      id: Math.max(...connectors.map((c) => c.id)) + 1,
      name: newConnectorName,
      connectorType: newConnectorType,
      status: "configuring",
      lastSyncAt: null,
      syncFrequencyMinutes: 15,
      errorMessage: null,
      sitesConnected: 0,
      metricsIngested: 0,
    };

    setConnectors((prev) => [...prev, newConnector]);
    setShowAddDialog(false);
    setNewConnectorType("");
    setNewConnectorName("");
    toast.success("Connector added. Configure credentials to start syncing.");
  };

  const handleToggleConnector = (connectorId: number, enabled: boolean) => {
    setConnectors((prev) =>
      prev.map((c) =>
        c.id === connectorId ? { ...c, status: enabled ? ("active" as const) : ("inactive" as const) } : c
      )
    );
    toast.success(enabled ? "Connector enabled" : "Connector disabled");
  };

  const handleDeleteConnector = (connectorId: number) => {
    setConnectors((prev) => prev.filter((c) => c.id !== connectorId));
    toast.success("Connector deleted");
  };

  const totalSites = connectors.reduce((sum, c) => sum + (c.sitesConnected || 0), 0);
  const totalMetrics = connectors.reduce((sum, c) => sum + (c.metricsIngested || 0), 0);
  const activeConnectors = connectors.filter((c) => c.status === "active").length;
  const errorConnectors = connectors.filter((c) => c.status === "error").length;

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
              {connectors.map((connector) => {
                const typeConfig = connectorTypes[connector.connectorType];
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
                            <h3 className="font-semibold">{connector.name}</h3>
                            <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {typeConfig.name} • {connector.sitesConnected || 0} sites • {((connector.metricsIngested || 0) / 1000).toFixed(1)}K metrics
                          </p>
                          {connector.lastSyncAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last sync: {new Date(connector.lastSyncAt).toLocaleString()} • Every {connector.syncFrequencyMinutes}m
                            </p>
                          )}
                          {connector.errorMessage && (
                            <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {connector.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={connector.status === "active"}
                          onCheckedChange={(checked) => handleToggleConnector(connector.id, checked)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(connector.id)}
                          disabled={isSyncing === connector.id || connector.status === "inactive"}
                        >
                          {isSyncing === connector.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedConnector(connector);
                            setShowConfigDialog(true);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteConnector(connector.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add Connector Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Data Connector</DialogTitle>
            <DialogDescription>
              Connect to a monitoring platform or data source
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Connector Name</Label>
              <Input
                value={newConnectorName}
                onChange={(e) => setNewConnectorName(e.target.value)}
                placeholder="e.g., AMMP - Portfolio Sites"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Connector Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {Object.entries(connectorTypes).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-colors",
                        newConnectorType === type
                          ? "border-accent bg-accent/10"
                          : "border-border hover:border-border/80 bg-muted/30"
                      )}
                      onClick={() => setNewConnectorType(type as keyof typeof connectorTypes)}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("w-5 h-5", config.color)} />
                        <div>
                          <p className="font-medium">{config.name}</p>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConnector}>
              Add Connector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Connector Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Connector</DialogTitle>
            <DialogDescription>
              {selectedConnector && connectorTypes[selectedConnector.connectorType].name} settings
            </DialogDescription>
          </DialogHeader>
          {selectedConnector && (
            <div className="space-y-4">
              <div>
                <Label>Connector Name</Label>
                <Input defaultValue={selectedConnector.name} className="mt-1" />
              </div>
              <div>
                <Label>Sync Frequency (minutes)</Label>
                <Select defaultValue={String(selectedConnector.syncFrequencyMinutes)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Every 1 minute</SelectItem>
                    <SelectItem value="5">Every 5 minutes</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {connectorTypes[selectedConnector.connectorType].fields.map((field) => (
                <div key={field}>
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1").trim()}</Label>
                  <Input
                    type={field.toLowerCase().includes("password") || field.toLowerCase().includes("key") ? "password" : "text"}
                    placeholder={`Enter ${field}`}
                    className="mt-1"
                  />
                </div>
              ))}
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <ExternalLink className="w-3 h-3 inline mr-1" />
                  Need help? View the{" "}
                  <a href="#" className="text-accent hover:underline">
                    {connectorTypes[selectedConnector.connectorType].name} integration guide
                  </a>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Configuration saved");
              setShowConfigDialog(false);
            }}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ConnectorManager;
