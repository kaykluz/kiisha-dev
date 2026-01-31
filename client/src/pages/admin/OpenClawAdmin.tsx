/**
 * OpenClaw Admin Page
 *
 * Configuration and management interface for OpenClaw AI Assistant integration.
 * Allows admins to:
 * - Enable/disable capabilities with usage limits
 * - Configure security policies
 * - View conversation analytics and history
 * - Manage approval workflows
 */

import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  MessageCircle,
  Shield,
  Settings,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Zap,
  Users,
  FileText,
  Activity,
  RefreshCw,
  Phone,
  MessageSquare,
  Hash,
  Save,
  Eye,
  Lock,
  Unlock,
  Info,
  Sparkles,
  TrendingUp,
  History,
} from "lucide-react";

// Risk level styling
const riskLevelConfig: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "text-green-700 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Low" },
  medium: { color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "Medium" },
  high: { color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "High" },
  critical: { color: "text-red-700 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Critical" },
};

// Category icons
const categoryIcons: Record<string, React.ReactNode> = {
  query: <Eye className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  operation: <Settings className="h-3.5 w-3.5" />,
  channel: <MessageCircle className="h-3.5 w-3.5" />,
};

// Default capabilities
const defaultCapabilities = [
  { id: "kiisha.portfolio.summary", name: "Portfolio Summary", category: "query", risk: "low", description: "View portfolio overview and aggregate metrics" },
  { id: "kiisha.project.list", name: "List Projects", category: "query", risk: "low", description: "List all projects in the organization" },
  { id: "kiisha.project.details", name: "Project Details", category: "query", risk: "low", description: "View detailed project information" },
  { id: "kiisha.documents.status", name: "Document Status", category: "query", risk: "low", description: "Check document verification status" },
  { id: "kiisha.documents.list", name: "List Documents", category: "query", risk: "low", description: "List and filter project documents" },
  { id: "kiisha.alerts.list", name: "List Alerts", category: "query", risk: "low", description: "View active alerts and notifications" },
  { id: "kiisha.tickets.list", name: "List Work Orders", category: "query", risk: "low", description: "View maintenance tickets and work orders" },
  { id: "kiisha.compliance.status", name: "Compliance Status", category: "query", risk: "low", description: "View compliance obligation status" },
  { id: "kiisha.document.upload", name: "Upload Document", category: "document", risk: "medium", description: "Upload documents via chat channels" },
  { id: "kiisha.alert.acknowledge", name: "Acknowledge Alert", category: "operation", risk: "medium", description: "Acknowledge and resolve alerts" },
  { id: "kiisha.ticket.create", name: "Create Work Order", category: "operation", risk: "medium", description: "Create maintenance work orders" },
  { id: "kiisha.rfi.respond", name: "Respond to RFI", category: "operation", risk: "medium", description: "Add responses to RFIs via chat" },
  { id: "kiisha.user.invite", name: "Invite User", category: "operation", risk: "high", description: "Send organization invitations via chat" },
  { id: "kiisha.data.export", name: "Export Data", category: "operation", risk: "medium", description: "Export data to CSV/JSON/XLSX" },
  { id: "kiisha.payment.initiate", name: "Initiate Payment", category: "payment", risk: "critical", description: "Create Stripe payment sessions" },
  { id: "channel.whatsapp", name: "WhatsApp Channel", category: "channel", risk: "low", description: "Access via WhatsApp messaging" },
  { id: "channel.telegram", name: "Telegram Channel", category: "channel", risk: "low", description: "Access via Telegram messaging" },
  { id: "channel.slack", name: "Slack Channel", category: "channel", risk: "low", description: "Access via Slack workspace" },
  { id: "channel.webchat", name: "Web Chat", category: "channel", risk: "low", description: "Access via embedded web chat" },
];

// Skeleton for stats cards
function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function OpenClawAdmin() {
  const { state } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [capabilityDialogOpen, setCapabilityDialogOpen] = useState(false);
  const [capabilityForm, setCapabilityForm] = useState({
    approvalPolicy: "inherit",
    dailyLimit: "",
    monthlyLimit: "",
  });

  const organizationId = state?.activeOrganization?.id || 0;

  // Queries
  const { data: capabilities, refetch: refetchCapabilities, isLoading: capabilitiesLoading } =
    trpc.openclaw.getCapabilities.useQuery(
      { organizationId },
      { enabled: !!organizationId }
    );

  const { data: securityPolicy, refetch: refetchPolicy, isLoading: policyLoading } =
    trpc.openclaw.getSecurityPolicy.useQuery(
      { organizationId },
      { enabled: !!organizationId }
    );

  const { data: pendingApprovals, refetch: refetchApprovals, isLoading: approvalsLoading } =
    trpc.openclaw.getPendingApprovals.useQuery(
      { organizationId },
      { enabled: !!organizationId }
    );

  const { data: conversationStats, isLoading: statsLoading } =
    trpc.openclaw.getConversationStats.useQuery(
      { organizationId },
      { enabled: !!organizationId, refetchInterval: 30000 }
    );

  const { data: conversationHistory } = trpc.openclaw.getConversationHistory.useQuery(
    { organizationId, limit: 20 },
    { enabled: !!organizationId && activeTab === "conversations" }
  );

  // Mutations
  const initializeCapabilities = trpc.openclaw.initializeCapabilities.useMutation({
    onSuccess: () => {
      toast.success("Capabilities initialized for your organization.");
      refetchCapabilities();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateCapability = trpc.openclaw.updateOrgCapability.useMutation({
    onSuccess: () => {
      toast.success("Capability updated.");
      refetchCapabilities();
      setCapabilityDialogOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateSecurityPolicy = trpc.openclaw.updateSecurityPolicy.useMutation({
    onSuccess: () => {
      toast.success("Security policy saved.");
      refetchPolicy();
    },
    onError: (error) => toast.error(error.message),
  });

  const processApproval = trpc.openclaw.processApproval.useMutation({
    onSuccess: () => {
      toast.success("Approval processed.");
      refetchApprovals();
    },
    onError: (error) => toast.error(error.message),
  });

  // Handlers
  const handleCapabilityToggle = useCallback(
    (capabilityId: string, enabled: boolean) => {
      updateCapability.mutate({ organizationId, capabilityId, enabled });
    },
    [organizationId, updateCapability]
  );

  const handleApproval = useCallback(
    (requestId: string, action: "approve" | "reject") => {
      processApproval.mutate({ requestId, action });
    },
    [processApproval]
  );

  const openCapabilitySettings = useCallback((capId: string) => {
    setSelectedCapability(capId);
    setCapabilityForm({ approvalPolicy: "inherit", dailyLimit: "", monthlyLimit: "" });
    setCapabilityDialogOpen(true);
  }, []);

  const saveCapabilitySettings = useCallback(() => {
    if (!selectedCapability) return;
    updateCapability.mutate({
      organizationId,
      capabilityId: selectedCapability,
      enabled: true,
      approvalPolicy: capabilityForm.approvalPolicy,
      dailyLimit: capabilityForm.dailyLimit ? parseInt(capabilityForm.dailyLimit) : undefined,
      monthlyLimit: capabilityForm.monthlyLimit ? parseInt(capabilityForm.monthlyLimit) : undefined,
    });
  }, [selectedCapability, organizationId, capabilityForm, updateCapability]);

  // Risk badge
  const getRiskBadge = (risk: string) => {
    const config = riskLevelConfig[risk] || riskLevelConfig.low;
    return (
      <Badge variant="outline" className={`${config.bg} ${config.color} border text-[11px]`}>
        {config.label}
      </Badge>
    );
  };

  // Category badge
  const getCategoryBadge = (category: string) => (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {categoryIcons[category] || <Settings className="h-3.5 w-3.5" />}
      <span className="text-xs capitalize">{category}</span>
    </div>
  );

  const enabledCount = capabilities?.filter((c: any) => c.enabled).length || 0;
  const pendingCount = pendingApprovals?.length || 0;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-[1200px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">AI Assistant</h1>
              <p className="text-sm text-muted-foreground">
                OpenClaw multi-channel configuration
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetchCapabilities();
                refetchApprovals();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
            {(!capabilities || capabilities.length === 0) && (
              <Button
                size="sm"
                onClick={() => initializeCapabilities.mutate({ organizationId })}
                disabled={initializeCapabilities.isPending}
              >
                {initializeCapabilities.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-1.5" />
                )}
                Initialize
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        {statsLoading ? (
          <StatsSkeleton />
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Conversations
                  </CardTitle>
                  <MessageCircle className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {conversationStats?.totalConversations || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Users
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {conversationStats?.activeUsers || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Linked channels</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Approvals
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${pendingCount > 0 ? "text-orange-500" : ""}`}>
                  {pendingCount}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Awaiting review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Response
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">
                  {conversationStats?.avgResponseTime || 0}
                  <span className="text-sm font-normal text-muted-foreground ml-0.5">ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">AI latency</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-[600px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="capabilities">
              Capabilities
              {enabledCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                  {enabledCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approvals">
              Approvals
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-[10px] h-4 px-1">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="conversations">History</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Setup Checklist */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Setup Checklist</CardTitle>
                  <CardDescription>Complete these steps to activate OpenClaw</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    {
                      done: capabilities && capabilities.length > 0,
                      label: "Initialize Capabilities",
                      desc: "Set up default AI capabilities for your org",
                      action: (!capabilities || capabilities.length === 0) ? () => initializeCapabilities.mutate({ organizationId }) : undefined,
                    },
                    {
                      done: !!securityPolicy,
                      label: "Configure Security",
                      desc: "Set rate limits, audit level, and channel policies",
                      action: () => setActiveTab("security"),
                    },
                    {
                      done: false,
                      label: "Link Channels",
                      desc: "Users can link WhatsApp, Telegram, Slack",
                      href: "/settings/channels",
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 py-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.done
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-medium">{i + 1}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.desc}</p>
                      </div>
                      {step.action && !step.done && (
                        <Button size="sm" variant="outline" onClick={step.action}>
                          Setup
                        </Button>
                      )}
                      {step.href && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={step.href}>View</a>
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Channel Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Channel Status</CardTitle>
                  <CardDescription>Communication channels for AI Assistant</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: "Web Chat", icon: MessageCircle, status: "active", statusLabel: "Active", color: "text-green-500" },
                      { name: "WhatsApp", icon: Phone, status: "available", statusLabel: "Available", color: "text-muted-foreground" },
                      { name: "Telegram", icon: MessageSquare, status: "available", statusLabel: "Available", color: "text-muted-foreground" },
                      { name: "Slack", icon: Hash, status: "available", statusLabel: "Available", color: "text-muted-foreground" },
                    ].map((channel) => (
                      <div
                        key={channel.name}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <channel.icon className={`h-4 w-4 ${channel.color}`} />
                          <span className="text-sm font-medium">{channel.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              channel.status === "active" ? "bg-green-500" : "bg-muted-foreground/30"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">{channel.statusLabel}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Capabilities Tab */}
          <TabsContent value="capabilities" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Capability Management</CardTitle>
                    <CardDescription>
                      Enable or disable AI capabilities. Each capability controls what the assistant can do.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {capabilitiesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 py-3">
                        <Skeleton className="h-5 w-5 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-5 w-10 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : !capabilities || capabilities.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Zap className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium mb-1">No Capabilities Configured</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Initialize OpenClaw to set up default capabilities for your organization.
                    </p>
                    <Button
                      onClick={() => initializeCapabilities.mutate({ organizationId })}
                      disabled={initializeCapabilities.isPending}
                    >
                      {initializeCapabilities.isPending && (
                        <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                      )}
                      Initialize Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Group by category */}
                    {["query", "document", "operation", "channel"].map((category) => {
                      const categoryCaps = defaultCapabilities.filter((c) => c.category === category);
                      if (categoryCaps.length === 0) return null;

                      return (
                        <div key={category} className="mb-4">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            {categoryIcons[category]}
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              {category === "query" ? "Read-only Queries" :
                               category === "document" ? "Document Operations" :
                               category === "operation" ? "Write Operations" :
                               "Communication Channels"}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {categoryCaps.map((cap) => {
                              const orgCap = capabilities?.find((c: any) => c.capabilityId === cap.id);
                              const isEnabled = orgCap?.enabled ?? false;

                              return (
                                <div
                                  key={cap.id}
                                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                                >
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={(checked) =>
                                      handleCapabilityToggle(cap.id, checked)
                                    }
                                    aria-label={`Toggle ${cap.name}`}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{cap.name}</span>
                                      {getRiskBadge(cap.risk)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {cap.description}
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => openCapabilitySettings(cap.id)}
                                    aria-label={`Settings for ${cap.name}`}
                                  >
                                    <Settings className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                          <Separator className="mt-3" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Approvals</CardTitle>
                <CardDescription>
                  Review sensitive operations requested through AI Assistant channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                {approvalsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 py-3">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-40 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                ) : !pendingApprovals || pendingApprovals.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-medium mb-1">All Caught Up</h3>
                    <p className="text-sm text-muted-foreground">
                      No pending approval requests at this time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingApprovals.map((approval: any) => (
                      <div
                        key={approval.requestId}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{approval.capabilityId}</span>
                            {getRiskBadge(approval.riskLevel)}
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{approval.summary}</p>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            <span>User #{approval.requestedBy}</span>
                            {approval.expiresAt && (
                              <>
                                <span className="text-muted-foreground/30">|</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Expires {new Date(approval.expiresAt).toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8"
                            onClick={() => handleApproval(approval.requestId, "approve")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => handleApproval(approval.requestId, "reject")}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversation History</CardTitle>
                <CardDescription>
                  VATR-logged conversations across all channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!conversationHistory?.items || conversationHistory.items.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <History className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium mb-1">No Conversations Yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Conversations will appear here once users start chatting with the AI Assistant.
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {conversationHistory.items.map((conv: any) => (
                        <div
                          key={conv.id}
                          className="p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {conv.channelType}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                User #{conv.userId}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(conv.messageReceivedAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-10 flex-shrink-0">User:</span>
                              <p className="text-xs line-clamp-2">{conv.userMessage}</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-xs font-medium text-primary/70 w-10 flex-shrink-0">AI:</span>
                              <p className="text-xs text-muted-foreground line-clamp-2">{conv.aiResponse}</p>
                            </div>
                          </div>
                          {conv.processingTimeMs && (
                            <div className="flex items-center gap-1 mt-2">
                              <Activity className="h-3 w-3 text-muted-foreground/40" />
                              <span className="text-[10px] text-muted-foreground/60">
                                {conv.processingTimeMs}ms
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security Policy</CardTitle>
                <CardDescription>
                  Configure access controls, rate limits, and audit settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {policyLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-5 w-10 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Access Controls */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        Access Controls
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          {
                            label: "Require Channel Pairing",
                            desc: "Users must verify channel ownership via OTP",
                            key: "requirePairing",
                            default: true,
                          },
                          {
                            label: "Admin Approval for New Channels",
                            desc: "Admins must approve new channel links",
                            key: "requireAdminApprovalForNewChannels",
                            default: true,
                          },
                          {
                            label: "Allow Browser Automation",
                            desc: "Enable AI to automate browser tasks",
                            key: "browserAutomationAllowed",
                            default: false,
                          },
                          {
                            label: "Allow File Uploads",
                            desc: "Allow document uploads via chat channels",
                            key: "fileUploadAllowed",
                            default: true,
                          },
                        ].map((setting) => (
                          <div key={setting.key} className="flex items-start gap-3 p-3 rounded-lg border border-border/50">
                            <Switch
                              checked={(securityPolicy as any)?.[setting.key] ?? setting.default}
                              onCheckedChange={(checked) => {
                                updateSecurityPolicy.mutate({
                                  organizationId,
                                  [setting.key]: checked,
                                });
                              }}
                              className="mt-0.5"
                              aria-label={setting.label}
                            />
                            <div>
                              <Label className="text-sm font-medium">{setting.label}</Label>
                              <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Rate Limits & Audit */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Rate Limits & Audit
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-sm">Rate Limit (per minute)</Label>
                          <Input
                            type="number"
                            value={securityPolicy?.globalRateLimitPerMinute ?? 60}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                updateSecurityPolicy.mutate({
                                  organizationId,
                                  globalRateLimitPerMinute: val,
                                });
                              }
                            }}
                            className="h-9"
                          />
                          <p className="text-[11px] text-muted-foreground">Maximum messages per minute per user</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Daily Limit</Label>
                          <Input
                            type="number"
                            value={securityPolicy?.globalRateLimitPerDay ?? 1000}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                updateSecurityPolicy.mutate({
                                  organizationId,
                                  globalRateLimitPerDay: val,
                                });
                              }
                            }}
                            className="h-9"
                          />
                          <p className="text-[11px] text-muted-foreground">Maximum messages per day per org</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Audit Level</Label>
                          <Select
                            value={securityPolicy?.auditLevel ?? "standard"}
                            onValueChange={(value) => {
                              updateSecurityPolicy.mutate({
                                organizationId,
                                auditLevel: value,
                              });
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="minimal">Minimal — Metadata only</SelectItem>
                              <SelectItem value="standard">Standard — Messages + metadata</SelectItem>
                              <SelectItem value="detailed">Detailed — Full content logging</SelectItem>
                              <SelectItem value="full">Full VATR — Complete audit trail</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">How much conversation data to log</p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-sm">Retention Period (days)</Label>
                          <Input
                            type="number"
                            value={securityPolicy?.retainConversationsForDays ?? 365}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                updateSecurityPolicy.mutate({
                                  organizationId,
                                  retainConversationsForDays: val,
                                });
                              }
                            }}
                            className="h-9"
                          />
                          <p className="text-[11px] text-muted-foreground">How long to keep conversation logs</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Capability Settings Dialog */}
        <Dialog open={capabilityDialogOpen} onOpenChange={setCapabilityDialogOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Capability Settings</DialogTitle>
              <DialogDescription>
                Configure approval policy and usage limits for{" "}
                <span className="font-medium text-foreground">
                  {defaultCapabilities.find((c) => c.id === selectedCapability)?.name || selectedCapability}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Approval Policy</Label>
                <Select
                  value={capabilityForm.approvalPolicy}
                  onValueChange={(value) =>
                    setCapabilityForm((f) => ({ ...f, approvalPolicy: value }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit from Risk Level</SelectItem>
                    <SelectItem value="always">Always Require Approval</SelectItem>
                    <SelectItem value="never">Never Require Approval</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Controls whether admin approval is needed before execution
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Daily Usage Limit</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={capabilityForm.dailyLimit}
                  onChange={(e) =>
                    setCapabilityForm((f) => ({ ...f, dailyLimit: e.target.value }))
                  }
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Maximum times this capability can be used per day. Leave empty for unlimited.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Monthly Usage Limit</Label>
                <Input
                  type="number"
                  placeholder="Unlimited"
                  value={capabilityForm.monthlyLimit}
                  onChange={(e) =>
                    setCapabilityForm((f) => ({ ...f, monthlyLimit: e.target.value }))
                  }
                  className="h-9"
                />
                <p className="text-[11px] text-muted-foreground">
                  Maximum times this capability can be used per month. Leave empty for unlimited.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCapabilityDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveCapabilitySettings} disabled={updateCapability.isPending}>
                {updateCapability.isPending && (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
