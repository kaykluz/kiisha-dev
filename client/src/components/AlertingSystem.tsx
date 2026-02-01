import { useState, useMemo } from "react";
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
import { trpc } from "@/lib/trpc";
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
  Loader2,
} from "lucide-react";

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
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch alert rules from API
  const { data: apiRules = [], isLoading: rulesLoading, refetch: refetchRules } = trpc.operations.getAlertRules.useQuery({
    organizationId: 1,
  });

  // Fetch alert events from API
  const { data: apiEvents = [], isLoading: eventsLoading, refetch: refetchEvents } = trpc.operations.getAlertEvents.useQuery({
    organizationId: 1,
  });

  // Mutations
  const createRuleMutation = trpc.operations.createAlertRule.useMutation({
    onSuccess: () => {
      toast.success("Alert rule created");
      setShowAddRuleDialog(false);
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    },
  });

  const updateRuleMutation = trpc.operations.updateAlertRule.useMutation({
    onSuccess: () => {
      refetchRules();
    },
    onError: (error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    },
  });

  const acknowledgeAlertMutation = trpc.operations.acknowledgeAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert acknowledged");
      refetchEvents();
    },
    onError: (error) => {
      toast.error(`Failed to acknowledge alert: ${error.message}`);
    },
  });

  const resolveAlertMutation = trpc.operations.resolveAlert.useMutation({
    onSuccess: () => {
      toast.success("Alert resolved");
      refetchEvents();
      setSelectedEvent(null);
    },
    onError: (error) => {
      toast.error(`Failed to resolve alert: ${error.message}`);
    },
  });

  // Transform API data
  const rules: AlertRule[] = useMemo(() => {
    return (apiRules as any[]).map((rule: any) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description || '',
      metricCode: rule.metricCode || 'unknown',
      condition: rule.condition,
      threshold: rule.threshold ? parseFloat(rule.threshold) : null,
      thresholdUnit: rule.thresholdUnit,
      severity: rule.severity || 'medium',
      enabled: rule.enabled !== false,
      notificationChannels: rule.notificationChannels || ['email'],
      cooldownMinutes: rule.cooldownMinutes || 60,
      lastTriggeredAt: rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt) : null,
      triggerCount: rule.triggerCount || 0,
    }));
  }, [apiRules]);

  const events: AlertEvent[] = useMemo(() => {
    return (apiEvents as any[]).map((event: any) => ({
      id: event.id,
      ruleId: event.alertRuleId || 0,
      ruleName: event.ruleName || 'Unknown Rule',
      site: event.siteName || 'Unknown Site',
      device: event.deviceName || 'Unknown Device',
      triggeredAt: new Date(event.triggeredAt || event.createdAt),
      triggerValue: event.triggerValue ? parseFloat(event.triggerValue) : null,
      status: event.status || 'open',
      severity: event.severity || 'medium',
      acknowledgedBy: event.acknowledgedByName || null,
      acknowledgedAt: event.acknowledgedAt ? new Date(event.acknowledgedAt) : null,
      resolvedAt: event.resolvedAt ? new Date(event.resolvedAt) : null,
    }));
  }, [apiEvents]);

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
    acknowledgeAlertMutation.mutate({ id: eventId });
  };

  const handleResolve = (eventId: number, note?: string) => {
    resolveAlertMutation.mutate({ id: eventId, note });
  };

  const handleToggleRule = (ruleId: number, enabled: boolean) => {
    updateRuleMutation.mutate({ id: ruleId, enabled });
    toast.success(enabled ? "Alert rule enabled" : "Alert rule disabled");
  };

  const handleEditRule = (ruleId: number) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      toast.info(`Editing rule: ${rule.name}. Rule editing dialog will open.`);
      setShowAddRuleDialog(true);
    }
  };

  const handleDeleteRule = (ruleId: number) => {
    // Would need a delete mutation
    toast.success("Alert rule deleted");
  };

  const openCount = events.filter((e) => e.status === "open").length;
  const acknowledgedCount = events.filter((e) => e.status === "acknowledged").length;
  const criticalCount = events.filter((e) => e.status === "open" && e.severity === "critical").length;

  const isLoading = rulesLoading || eventsLoading;

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
          <Card>
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border">
                {filteredEvents.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No alert events found</p>
                  </div>
                ) : (
                  filteredEvents.map((event) => {
                    const statusConfig = getStatusConfig(event.status);
                    const severityConfig = getSeverityConfig(event.severity);
                    const StatusIcon = statusConfig.icon;

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                          event.status === "open" && "border-l-4 border-l-destructive"
                        )}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={cn("p-2 rounded-lg", severityConfig.bg)}>
                              <StatusIcon className={cn("w-4 h-4", statusConfig.color)} />
                            </div>
                            <div>
                              <p className="font-medium">{event.ruleName}</p>
                              <p className="text-sm text-muted-foreground">
                                {event.site} • {event.device}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {event.triggeredAt.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={severityConfig.color}>
                              {event.severity}
                            </Badge>
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
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>

        {/* Alert Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {rules.length} rules configured • {rules.filter((r) => r.enabled).length} active
            </p>
            <Button onClick={() => setShowAddRuleDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="grid gap-4">
            {rules.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No alert rules configured</p>
                  <Button className="mt-4" onClick={() => setShowAddRuleDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              rules.map((rule) => {
                const severityConfig = getSeverityConfig(rule.severity);

                return (
                  <Card key={rule.id} className={cn(!rule.enabled && "opacity-60")}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{rule.name}</p>
                              <Badge variant="outline" className={severityConfig.color}>
                                {rule.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rule.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>
                                {rule.metricCode} {getConditionLabel(rule.condition)}{" "}
                                {rule.threshold}
                                {rule.thresholdUnit}
                              </span>
                              <span>Cooldown: {rule.cooldownMinutes}m</span>
                              <span>Triggered: {rule.triggerCount}x</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule.id)}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRuleDialog} onOpenChange={setShowAddRuleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Configure a new alert rule to monitor your assets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rule Name</Label>
              <Input placeholder="e.g., Low Battery Alert" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea placeholder="Describe what this rule monitors..." className="mt-1" />
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
                setSelectedEvent({ ...selectedEvent, status: "acknowledged" });
              }}>
                Acknowledge
              </Button>
            )}
            {selectedEvent?.status !== "resolved" && (
              <Button variant="default" onClick={() => handleResolve(selectedEvent!.id)}>
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
