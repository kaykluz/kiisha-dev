import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  Bell,
  Plus,
  Settings,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Mail,
  MessageSquare,
  Webhook,
  Eye,
  EyeOff,
  Play,
  Pause,
  MoreHorizontal,
  ChevronRight,
  Activity,
  Zap,
  Battery,
  ThermometerSun,
} from "lucide-react";

// Mock alert rules
const mockAlertRules = [
  {
    id: 1,
    name: "Low Battery SOC",
    description: "Alert when battery state of charge drops below threshold",
    metricCode: "battery_soc",
    condition: "lt",
    threshold: 20,
    thresholdUnit: "%",
    severity: "high",
    enabled: true,
    notificationChannels: ["email", "slack"],
    cooldownMinutes: 60,
    lastTriggeredAt: new Date("2026-01-15T08:30:00"),
    triggerCount: 12,
  },
  {
    id: 2,
    name: "Inverter Offline",
    description: "Alert when inverter goes offline for more than 5 minutes",
    metricCode: "device_status",
    condition: "offline",
    threshold: null,
    thresholdUnit: null,
    severity: "critical",
    enabled: true,
    notificationChannels: ["email", "slack", "webhook"],
    cooldownMinutes: 30,
    lastTriggeredAt: new Date("2026-01-14T15:45:00"),
    triggerCount: 5,
  },
  {
    id: 3,
    name: "High Temperature",
    description: "Alert when equipment temperature exceeds safe operating range",
    metricCode: "temperature",
    condition: "gt",
    threshold: 65,
    thresholdUnit: "°C",
    severity: "medium",
    enabled: true,
    notificationChannels: ["email"],
    cooldownMinutes: 120,
    lastTriggeredAt: null,
    triggerCount: 0,
  },
  {
    id: 4,
    name: "Low Performance Ratio",
    description: "Alert when PR drops below expected value",
    metricCode: "performance_ratio",
    condition: "lt",
    threshold: 75,
    thresholdUnit: "%",
    severity: "low",
    enabled: false,
    notificationChannels: ["email"],
    cooldownMinutes: 1440,
    lastTriggeredAt: new Date("2026-01-10T12:00:00"),
    triggerCount: 3,
  },
];

// Mock alert events
const mockAlertEvents = [
  {
    id: 1,
    ruleId: 1,
    ruleName: "Low Battery SOC",
    site: "TX - Austin",
    device: "Battery-01",
    triggeredAt: new Date("2026-01-15T10:15:00"),
    triggerValue: 18.5,
    status: "open",
    severity: "high",
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    id: 2,
    ruleId: 2,
    ruleName: "Inverter Offline",
    site: "FL - Miami",
    device: "Inverter-03",
    triggeredAt: new Date("2026-01-15T09:45:00"),
    triggerValue: null,
    status: "acknowledged",
    severity: "critical",
    acknowledgedBy: "John Smith",
    acknowledgedAt: new Date("2026-01-15T09:50:00"),
    resolvedAt: null,
  },
  {
    id: 3,
    ruleId: 1,
    ruleName: "Low Battery SOC",
    site: "MA - Gillette",
    device: "Battery-02",
    triggeredAt: new Date("2026-01-15T08:30:00"),
    triggerValue: 15.2,
    status: "resolved",
    severity: "high",
    acknowledgedBy: "Jane Doe",
    acknowledgedAt: new Date("2026-01-15T08:35:00"),
    resolvedAt: new Date("2026-01-15T09:00:00"),
  },
  {
    id: 4,
    ruleId: 3,
    ruleName: "High Temperature",
    site: "AZ - Phoenix",
    device: "Inverter-01",
    triggeredAt: new Date("2026-01-14T14:20:00"),
    triggerValue: 68.3,
    status: "resolved",
    severity: "medium",
    acknowledgedBy: "Mike Johnson",
    acknowledgedAt: new Date("2026-01-14T14:25:00"),
    resolvedAt: new Date("2026-01-14T16:00:00"),
  },
];

interface AlertRule {
  id: number;
  name: string;
  description: string;
  metricCode: string;
  condition: string;
  threshold: number | null;
  thresholdUnit: string | null;
  severity: string;
  enabled: boolean;
  notificationChannels: string[];
  cooldownMinutes: number;
  lastTriggeredAt: Date | null;
  triggerCount: number;
}

interface AlertEvent {
  id: number;
  ruleId: number;
  ruleName: string;
  site: string;
  device: string;
  triggeredAt: Date;
  triggerValue: number | null;
  status: string;
  severity: string;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}

export function AlertingSystem() {
  const [rules, setRules] = useState<AlertRule[]>(mockAlertRules);
  const [events, setEvents] = useState<AlertEvent[]>(mockAlertEvents);
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical":
        return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
      case "high":
        return { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" };
      case "medium":
        return { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" };
      case "low":
        return { color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/30" };
      default:
        return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "open":
        return { icon: AlertTriangle, color: "text-destructive", label: "Open" };
      case "acknowledged":
        return { icon: Eye, color: "text-warning", label: "Acknowledged" };
      case "resolved":
        return { icon: CheckCircle2, color: "text-success", label: "Resolved" };
      case "suppressed":
        return { icon: EyeOff, color: "text-muted-foreground", label: "Suppressed" };
      default:
        return { icon: Clock, color: "text-muted-foreground", label: status };
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case "gt": return ">";
      case "gte": return "≥";
      case "lt": return "<";
      case "lte": return "≤";
      case "eq": return "=";
      case "neq": return "≠";
      case "offline": return "Offline";
      case "change_rate": return "Change Rate";
      default: return condition;
    }
  };

  const filteredEvents = events.filter((event) => {
    if (statusFilter !== "all" && event.status !== statusFilter) return false;
    if (severityFilter !== "all" && event.severity !== severityFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.ruleName.toLowerCase().includes(query) ||
        event.site.toLowerCase().includes(query) ||
        event.device.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleAcknowledge = (eventId: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, status: "acknowledged", acknowledgedBy: "Current User", acknowledgedAt: new Date() }
          : e
      )
    );
    toast.success("Alert acknowledged");
  };

  const handleResolve = (eventId: number) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, status: "resolved", resolvedAt: new Date() } : e
      )
    );
    toast.success("Alert resolved");
  };

  const handleToggleRule = (ruleId: number, enabled: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r))
    );
    toast.success(enabled ? "Alert rule enabled" : "Alert rule disabled");
  };

  const handleEditRule = (ruleId: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      // Open dialog with rule data pre-filled (simplified - just show info)
      toast.info(`Editing rule: ${rule.name}. Rule editing dialog will open.`);
      setShowAddRuleDialog(true);
    }
  };

  const handleDeleteRule = (ruleId: number) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success("Alert rule deleted");
  };

  const openCount = events.filter((e) => e.status === "open").length;
  const acknowledgedCount = events.filter((e) => e.status === "acknowledged").length;
  const criticalCount = events.filter((e) => e.status === "open" && e.severity === "critical").length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open Alerts</p>
                <p className="text-2xl font-bold text-destructive">{openCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Acknowledged</p>
                <p className="text-2xl font-bold text-warning">{acknowledgedCount}</p>
              </div>
              <Eye className="w-8 h-8 text-warning/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold">{criticalCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{rules.filter((r) => r.enabled).length}</p>
              </div>
              <Bell className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Alert Events</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
        </TabsList>

        {/* Alert Events Tab */}
        <TabsContent value="events" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events List */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {filteredEvents.map((event) => {
                    const severityConfig = getSeverityConfig(event.severity);
                    const statusConfig = getStatusConfig(event.status);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "p-4 hover:bg-muted/20 cursor-pointer transition-colors",
                          event.status === "open" && severityConfig.bg
                        )}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className={cn("p-2 rounded-lg", severityConfig.bg)}>
                              <AlertTriangle className={cn("w-5 h-5", severityConfig.color)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{event.ruleName}</h3>
                                <Badge variant="outline" className={cn("text-xs", severityConfig.color, severityConfig.border)}>
                                  {event.severity}
                                </Badge>
                                <Badge variant="outline" className={cn("text-xs", statusConfig.color)}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {event.site} • {event.device}
                                {event.triggerValue !== null && ` • Value: ${event.triggerValue}`}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Triggered: {event.triggeredAt.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {event.status === "open" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledge(event.id);
                                }}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {event.status === "acknowledged" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(event.id);
                                }}
                              >
                                Resolve
                              </Button>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowAddRuleDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-border">
                  {rules.map((rule) => {
                    const severityConfig = getSeverityConfig(rule.severity);

                    return (
                      <div key={rule.id} className="p-4 hover:bg-muted/20">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className={cn("font-medium", !rule.enabled && "text-muted-foreground")}>
                                  {rule.name}
                                </h3>
                                <Badge variant="outline" className={cn("text-xs", severityConfig.color, severityConfig.border)}>
                                  {rule.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs bg-muted px-2 py-1 rounded">
                                  {rule.metricCode} {getConditionLabel(rule.condition)} {rule.threshold}{rule.thresholdUnit}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Cooldown: {rule.cooldownMinutes}m
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Triggered: {rule.triggerCount} times
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                {rule.notificationChannels.includes("email") && (
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                )}
                                {rule.notificationChannels.includes("slack") && (
                                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                )}
                                {rule.notificationChannels.includes("webhook") && (
                                  <Webhook className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditRule(rule.id)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-destructive"
                              onClick={() => handleDeleteRule(rule.id)}
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
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRuleDialog} onOpenChange={setShowAddRuleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Define conditions that trigger alerts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input placeholder="e.g., Low Battery SOC" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Describe when this alert should trigger" className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Metric</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="battery_soc">Battery SOC</SelectItem>
                    <SelectItem value="power">Power Output</SelectItem>
                    <SelectItem value="temperature">Temperature</SelectItem>
                    <SelectItem value="voltage">Voltage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condition</Label>
                <Select>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gt">Greater than</SelectItem>
                    <SelectItem value="lt">Less than</SelectItem>
                    <SelectItem value="eq">Equals</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Threshold</Label>
                <Input type="number" placeholder="Value" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Severity</Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notification Channels</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" defaultChecked />
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">Email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm">Slack</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded" />
                  <Webhook className="w-4 h-4" />
                  <span className="text-sm">Webhook</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Alert rule created");
              setShowAddRuleDialog(false);
            }}>
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Rule</Label>
                  <p className="font-medium">{selectedEvent.ruleName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <Badge variant="outline" className={cn("mt-1", getSeverityConfig(selectedEvent.severity).color)}>
                    {selectedEvent.severity}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Site</Label>
                  <p>{selectedEvent.site}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Device</Label>
                  <p>{selectedEvent.device}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Triggered At</Label>
                  <p>{selectedEvent.triggeredAt.toLocaleString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Trigger Value</Label>
                  <p>{selectedEvent.triggerValue ?? "N/A"}</p>
                </div>
                {selectedEvent.acknowledgedBy && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Acknowledged By</Label>
                      <p>{selectedEvent.acknowledgedBy}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Acknowledged At</Label>
                      <p>{selectedEvent.acknowledgedAt?.toLocaleString()}</p>
                    </div>
                  </>
                )}
                {selectedEvent.resolvedAt && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Resolved At</Label>
                    <p>{selectedEvent.resolvedAt.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {selectedEvent.status !== "resolved" && (
                <div>
                  <Label>Resolution Note</Label>
                  <Textarea placeholder="Add notes about how this was resolved..." className="mt-1" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>
            {selectedEvent?.status === "open" && (
              <Button onClick={() => {
                handleAcknowledge(selectedEvent.id);
                setSelectedEvent(null);
              }}>
                Acknowledge
              </Button>
            )}
            {selectedEvent?.status === "acknowledged" && (
              <Button onClick={() => {
                handleResolve(selectedEvent.id);
                setSelectedEvent(null);
              }}>
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AlertingSystem;
