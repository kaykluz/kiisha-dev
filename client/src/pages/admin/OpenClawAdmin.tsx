/**
 * OpenClaw Admin Page
 * 
 * Configuration and management interface for OpenClaw AI Assistant integration.
 * Allows admins to:
 * - Enable/disable capabilities
 * - Configure security policies
 * - View conversation analytics
 * - Manage approval workflows
 */

import { useState } from "react";
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
} from "lucide-react";

// Risk level colors
const riskLevelColors: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

// Risk level labels
const riskLevelLabels: Record<string, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
  critical: "Critical",
};

// Default capabilities for seeding
const defaultCapabilities = [
  { id: "kiisha.portfolio.summary", name: "Portfolio Summary", category: "query", risk: "low", description: "View portfolio overview" },
  { id: "kiisha.project.list", name: "List Projects", category: "query", risk: "low", description: "List all projects" },
  { id: "kiisha.project.details", name: "Project Details", category: "query", risk: "low", description: "View project details" },
  { id: "kiisha.documents.status", name: "Document Status", category: "query", risk: "low", description: "Check document status" },
  { id: "kiisha.documents.list", name: "List Documents", category: "query", risk: "low", description: "List project documents" },
  { id: "kiisha.alerts.list", name: "List Alerts", category: "query", risk: "low", description: "View active alerts" },
  { id: "kiisha.tickets.list", name: "List Work Orders", category: "query", risk: "low", description: "View work orders" },
  { id: "kiisha.compliance.status", name: "Compliance Status", category: "query", risk: "low", description: "View compliance status" },
  { id: "kiisha.document.upload", name: "Upload Document", category: "document", risk: "medium", description: "Upload documents" },
  { id: "kiisha.alert.acknowledge", name: "Acknowledge Alert", category: "operation", risk: "medium", description: "Acknowledge alerts" },
  { id: "kiisha.ticket.create", name: "Create Work Order", category: "operation", risk: "medium", description: "Create work orders" },
  { id: "channel.whatsapp", name: "WhatsApp Channel", category: "channel", risk: "low", description: "Access via WhatsApp" },
  { id: "channel.telegram", name: "Telegram Channel", category: "channel", risk: "low", description: "Access via Telegram" },
  { id: "channel.slack", name: "Slack Channel", category: "channel", risk: "low", description: "Access via Slack" },
  { id: "channel.webchat", name: "Web Chat", category: "channel", risk: "low", description: "Access via web chat" },
];

export default function OpenClawAdmin() {
  const { state } = useAuth();
  // Using sonner toast
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null);
  const [capabilityDialogOpen, setCapabilityDialogOpen] = useState(false);
  
  const organizationId = state?.activeOrg?.id || 0;
  
  // Get capabilities
  const { data: capabilities, refetch: refetchCapabilities, isLoading: capabilitiesLoading } = trpc.openclaw.getCapabilities.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );
  
  // Get security policy
  const { data: securityPolicy, refetch: refetchPolicy } = trpc.openclaw.getSecurityPolicy.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );
  
  // Get pending approvals
  const { data: pendingApprovals, refetch: refetchApprovals } = trpc.openclaw.getPendingApprovals.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );
  
  // Get conversation stats
  const { data: conversationStats } = trpc.openclaw.getConversationStats.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );
  
  // Initialize capabilities mutation
  const initializeCapabilities = trpc.openclaw.initializeCapabilities.useMutation({
    onSuccess: () => {
      toast.success("Capabilities Initialized", {
        description: "Default capabilities have been set up for your organization.",
      });
      refetchCapabilities();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Update capability mutation
  const updateCapability = trpc.openclaw.updateOrgCapability.useMutation({
    onSuccess: () => {
      toast.success("Capability Updated", {
        description: "The capability settings have been saved.",
      });
      refetchCapabilities();
      setCapabilityDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Update security policy mutation
  const updateSecurityPolicy = trpc.openclaw.updateSecurityPolicy.useMutation({
    onSuccess: () => {
      toast.success("Security Policy Updated", {
        description: "Your security settings have been saved.",
      });
      refetchPolicy();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Process approval mutation
  const processApproval = trpc.openclaw.processApproval.useMutation({
    onSuccess: () => {
      toast.success("Approval Processed", {
        description: "The request has been processed.",
      });
      refetchApprovals();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Handle initialize
  const handleInitialize = () => {
    initializeCapabilities.mutate({ organizationId });
  };
  
  // Handle capability toggle
  const handleCapabilityToggle = (capabilityId: string, enabled: boolean) => {
    updateCapability.mutate({
      organizationId,
      capabilityId,
      enabled,
    });
  };
  
  // Handle approval
  const handleApproval = (requestId: string, action: "approve" | "reject") => {
    processApproval.mutate({
      requestId,
      action,
    });
  };
  
  // Get risk badge
  const getRiskBadge = (risk: string) => (
    <Badge className={`${riskLevelColors[risk]} text-white`}>
      {riskLevelLabels[risk]}
    </Badge>
  );
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI Assistant (OpenClaw)</h1>
              <p className="text-muted-foreground">
                Configure multi-channel AI assistant capabilities
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchCapabilities()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {(!capabilities || capabilities.length === 0) && (
              <Button onClick={handleInitialize} disabled={initializeCapabilities.isPending}>
                {initializeCapabilities.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Initialize OpenClaw
              </Button>
            )}
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversationStats?.totalConversations || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Last 30 days
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversationStats?.activeUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Linked channels
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {pendingApprovals?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting review
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {conversationStats?.avgResponseTime || 0}ms
              </div>
              <p className="text-xs text-muted-foreground">
                AI latency
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="capabilities">
              <Zap className="h-4 w-4 mr-2" />
              Capabilities
            </TabsTrigger>
            <TabsTrigger value="approvals">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approvals
              {(pendingApprovals?.length || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingApprovals?.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Quick Setup */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Setup</CardTitle>
                  <CardDescription>
                    Get started with OpenClaw AI Assistant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${capabilities && capabilities.length > 0 ? 'bg-green-500' : 'bg-muted'}`}>
                      {capabilities && capabilities.length > 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      ) : (
                        <span className="text-sm font-medium">1</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Initialize Capabilities</p>
                      <p className="text-sm text-muted-foreground">
                        Set up default AI capabilities
                      </p>
                    </div>
                    {(!capabilities || capabilities.length === 0) && (
                      <Button size="sm" onClick={handleInitialize}>
                        Initialize
                      </Button>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${securityPolicy ? 'bg-green-500' : 'bg-muted'}`}>
                      {securityPolicy ? (
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      ) : (
                        <span className="text-sm font-medium">2</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Configure Security</p>
                      <p className="text-sm text-muted-foreground">
                        Set up security policies
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setActiveTab("security")}>
                      Configure
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium">3</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Link Channels</p>
                      <p className="text-sm text-muted-foreground">
                        Users can link WhatsApp, Telegram, etc.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href="/settings/channels">View</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Channel Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Channel Status</CardTitle>
                  <CardDescription>
                    Available communication channels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "Web Chat", icon: MessageCircle, status: "active", color: "text-green-500" },
                      { name: "WhatsApp", icon: Phone, status: "available", color: "text-blue-500" },
                      { name: "Telegram", icon: MessageSquare, status: "available", color: "text-blue-500" },
                      { name: "Slack", icon: Hash, status: "available", color: "text-purple-500" },
                    ].map((channel) => (
                      <div key={channel.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <channel.icon className={`h-5 w-5 ${channel.color}`} />
                          <span className="font-medium">{channel.name}</span>
                        </div>
                        <Badge variant={channel.status === "active" ? "default" : "secondary"}>
                          {channel.status === "active" ? "Active" : "Available"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Capabilities Tab */}
          <TabsContent value="capabilities" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Capability Management</CardTitle>
                <CardDescription>
                  Enable or disable AI capabilities for your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(!capabilities || capabilities.length === 0) ? (
                  <div className="text-center py-8">
                    <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Capabilities Configured</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Initialize OpenClaw to set up default capabilities.
                    </p>
                    <Button onClick={handleInitialize} disabled={initializeCapabilities.isPending}>
                      Initialize Now
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Capability</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {defaultCapabilities.map((cap) => {
                        const orgCap = capabilities?.find((c: any) => c.capabilityId === cap.id);
                        const isEnabled = orgCap?.enabled ?? false;
                        
                        return (
                          <TableRow key={cap.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{cap.name}</p>
                                <p className="text-xs text-muted-foreground">{cap.description}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{cap.category}</Badge>
                            </TableCell>
                            <TableCell>
                              {getRiskBadge(cap.risk)}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(checked) => handleCapabilityToggle(cap.id, checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedCapability(cap.id);
                                  setCapabilityDialogOpen(true);
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Approvals Tab */}
          <TabsContent value="approvals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
                <CardDescription>
                  Review and approve sensitive operations requested via AI Assistant
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(!pendingApprovals || pendingApprovals.length === 0) ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <h3 className="font-semibold mb-2">All Caught Up!</h3>
                    <p className="text-sm text-muted-foreground">
                      No pending approvals at this time.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingApprovals.map((approval: any) => (
                        <TableRow key={approval.requestId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{approval.capabilityId}</p>
                              <p className="text-xs text-muted-foreground">{approval.summary}</p>
                            </div>
                          </TableCell>
                          <TableCell>User #{approval.requestedBy}</TableCell>
                          <TableCell>
                            {getRiskBadge(approval.riskLevel)}
                          </TableCell>
                          <TableCell>
                            {approval.expiresAt ? new Date(approval.expiresAt).toLocaleString() : "N/A"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApproval(approval.requestId, "approve")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleApproval(approval.requestId, "reject")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Policy</CardTitle>
                <CardDescription>
                  Configure security settings for AI Assistant access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Require Channel Pairing</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={securityPolicy?.requirePairing ?? true}
                        onCheckedChange={(checked) => {
                          updateSecurityPolicy.mutate({
                            organizationId,
                            requirePairing: checked,
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Users must verify channel ownership
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Admin Approval for New Channels</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={securityPolicy?.requireAdminApprovalForNewChannels ?? true}
                        onCheckedChange={(checked) => {
                          updateSecurityPolicy.mutate({
                            organizationId,
                            requireAdminApprovalForNewChannels: checked,
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Admins must approve new channel links
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Allow Browser Automation</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={securityPolicy?.browserAutomationAllowed ?? false}
                        onCheckedChange={(checked) => {
                          updateSecurityPolicy.mutate({
                            organizationId,
                            browserAutomationAllowed: checked,
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Enable AI to automate browser tasks
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Allow File Uploads</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={securityPolicy?.fileUploadAllowed ?? true}
                        onCheckedChange={(checked) => {
                          updateSecurityPolicy.mutate({
                            organizationId,
                            fileUploadAllowed: checked,
                          });
                        }}
                      />
                      <span className="text-sm text-muted-foreground">
                        Allow document uploads via chat
                      </span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Rate Limit (per minute)</Label>
                    <Input
                      type="number"
                      value={securityPolicy?.globalRateLimitPerMinute ?? 60}
                      onChange={(e) => {
                        updateSecurityPolicy.mutate({
                          organizationId,
                          globalRateLimitPerMinute: parseInt(e.target.value),
                        });
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Daily Limit</Label>
                    <Input
                      type="number"
                      value={securityPolicy?.globalRateLimitPerDay ?? 1000}
                      onChange={(e) => {
                        updateSecurityPolicy.mutate({
                          organizationId,
                          globalRateLimitPerDay: parseInt(e.target.value),
                        });
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Audit Level</Label>
                    <Select
                      value={securityPolicy?.auditLevel ?? "standard"}
                      onValueChange={(value) => {
                        updateSecurityPolicy.mutate({
                          organizationId,
                          auditLevel: value,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="full">Full (VATR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Conversation Retention (days)</Label>
                    <Input
                      type="number"
                      value={securityPolicy?.retainConversationsForDays ?? 365}
                      onChange={(e) => {
                        updateSecurityPolicy.mutate({
                          organizationId,
                          retainConversationsForDays: parseInt(e.target.value),
                        });
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Capability Settings Dialog */}
        <Dialog open={capabilityDialogOpen} onOpenChange={setCapabilityDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Capability Settings</DialogTitle>
              <DialogDescription>
                Configure settings for this capability
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Approval Policy</Label>
                <Select defaultValue="inherit">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Inherit from Risk Level</SelectItem>
                    <SelectItem value="always">Always Require Approval</SelectItem>
                    <SelectItem value="never">Never Require Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Daily Limit</Label>
                <Input type="number" placeholder="Unlimited" />
              </div>
              
              <div className="space-y-2">
                <Label>Monthly Limit</Label>
                <Input type="number" placeholder="Unlimited" />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setCapabilityDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setCapabilityDialogOpen(false)}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
