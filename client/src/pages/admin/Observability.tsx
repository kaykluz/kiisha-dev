import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Bell, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  FolderOpen, 
  LayoutDashboard, 
  RefreshCw, 
  Server, 
  Settings, 
  XCircle,
  Link,
  Key,
  Mail,
  MessageSquare,
  Webhook,
  Plus,
  Trash2,
  Save,
  TestTube
} from "lucide-react";
import { toast } from "sonner";

export default function Observability() {
  const { user } = useAuth();
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  
  // Grafana configuration state
  const [grafanaUrl, setGrafanaUrl] = useState("");
  const [grafanaToken, setGrafanaToken] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  
  // Alert notification channels state
  const [emailChannels, setEmailChannels] = useState<string[]>([]);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [customWebhooks, setCustomWebhooks] = useState<{ name: string; url: string }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  
  // Fetch Grafana instances
  const { data: instances, isLoading: instancesLoading, refetch: refetchInstances } = trpc.grafana.listInstances.useQuery();
  
  // Fetch dashboards
  const { data: dashboards, isLoading: dashboardsLoading } = trpc.grafana.listDashboards.useQuery({
    folderId: selectedFolder === "all" ? undefined : parseInt(selectedFolder),
  });
  
  // Fetch alert policies
  const { data: alertPolicies, isLoading: policiesLoading } = trpc.grafana.listAlertPolicies.useQuery();
  
  // Fetch recent alerts
  const { data: recentAlerts, isLoading: alertsLoading } = trpc.grafana.listRecentAlerts.useQuery({
    timeRange: selectedTimeRange,
  });
  
  // Fetch provisioning jobs
  const { data: provisioningJobs, isLoading: jobsLoading } = trpc.grafana.listProvisioningJobs.useQuery({
    limit: 10,
  });
  
  // Mutations
  const triggerOrgBootstrap = trpc.grafana.triggerOrgBootstrap.useMutation({
    onSuccess: () => {
      toast.success("Organization bootstrap job started");
    },
    onError: (error) => {
      toast.error(`Failed to start bootstrap: ${error.message}`);
    },
  });
  
  const togglePolicy = trpc.grafana.toggleAlertPolicy.useMutation({
    onSuccess: () => {
      toast.success("Alert policy updated");
    },
  });
  
  const saveGrafanaConfig = trpc.grafana.saveInstanceConfig.useMutation({
    onSuccess: () => {
      toast.success("Grafana configuration saved");
      refetchInstances();
    },
    onError: (error) => {
      toast.error(`Failed to save configuration: ${error.message}`);
    },
  });
  
  const testGrafanaConnection = async () => {
    if (!grafanaUrl) {
      toast.error("Please enter a Grafana URL");
      return;
    }
    
    setTestingConnection(true);
    try {
      // Simple connectivity test - try to reach the API
      const response = await fetch(`${grafanaUrl}/api/health`, {
        headers: grafanaToken ? { Authorization: `Bearer ${grafanaToken}` } : {},
      });
      
      if (response.ok) {
        toast.success("Connection successful! Grafana is reachable.");
      } else {
        toast.error(`Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      toast.error("Connection failed: Unable to reach Grafana server");
    } finally {
      setTestingConnection(false);
    }
  };
  
  const handleSaveGrafanaConfig = () => {
    if (!grafanaUrl) {
      toast.error("Grafana URL is required");
      return;
    }
    
    saveGrafanaConfig.mutate({
      url: grafanaUrl,
      adminToken: grafanaToken || undefined,
    });
  };
  
  const addEmailChannel = () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (emailChannels.includes(newEmail)) {
      toast.error("Email already added");
      return;
    }
    setEmailChannels([...emailChannels, newEmail]);
    setNewEmail("");
    toast.success("Email notification channel added");
  };
  
  const removeEmailChannel = (email: string) => {
    setEmailChannels(emailChannels.filter(e => e !== email));
    toast.success("Email channel removed");
  };
  
  const addCustomWebhook = () => {
    if (!newWebhookName || !newWebhookUrl) {
      toast.error("Please enter webhook name and URL");
      return;
    }
    if (!newWebhookUrl.startsWith("http")) {
      toast.error("Webhook URL must start with http:// or https://");
      return;
    }
    setCustomWebhooks([...customWebhooks, { name: newWebhookName, url: newWebhookUrl }]);
    setNewWebhookName("");
    setNewWebhookUrl("");
    toast.success("Custom webhook added");
  };
  
  const removeCustomWebhook = (name: string) => {
    setCustomWebhooks(customWebhooks.filter(w => w.name !== name));
    toast.success("Webhook removed");
  };

  // Allow admin, superuser_admin roles, or users with isSuperuser flag
  const isAuthorized = user && (user.role === 'admin' || user.role === 'superuser_admin' || user.isSuperuser);
  
  if (!isAuthorized) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Access denied. Admin role required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Observability</h1>
            <p className="text-muted-foreground">
              Manage Grafana dashboards, alerts, and monitoring infrastructure
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => triggerOrgBootstrap.mutate()}
            disabled={triggerOrgBootstrap.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${triggerOrgBootstrap.isPending ? 'animate-spin' : ''}`} />
            Bootstrap Org
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grafana Instances</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {instancesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{instances?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {instances?.filter(i => i.status === 'active').length || 0} active
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dashboards</CardTitle>
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboardsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{dashboards?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Across all folders
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {recentAlerts?.filter(a => a.status === 'firing').length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {recentAlerts?.filter(a => a.status === 'resolved').length || 0} resolved today
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alert Policies</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{alertPolicies?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {alertPolicies?.filter(p => p.enabled).length || 0} enabled
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="dashboards" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboards">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboards
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Settings className="h-4 w-4 mr-2" />
              Alert Policies
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Activity className="h-4 w-4 mr-2" />
              Provisioning Jobs
            </TabsTrigger>
            <TabsTrigger value="config">
              <Server className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Dashboards Tab */}
          <TabsContent value="dashboards" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Grafana Dashboards</CardTitle>
                    <CardDescription>
                      View and manage dashboards across all folders
                    </CardDescription>
                  </div>
                  <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by folder" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Folders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {dashboardsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : dashboards?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LayoutDashboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No dashboards found</p>
                    <p className="text-sm">Bootstrap your organization to create dashboards</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboards?.map((dashboard) => (
                      <div
                        key={dashboard.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{dashboard.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FolderOpen className="h-3 w-3" />
                              <span>{dashboard.folderName || 'General'}</span>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs">
                                {dashboard.templateKey}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={dashboard.grafanaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Alerts</CardTitle>
                    <CardDescription>
                      Alerts received from Grafana in the selected time range
                    </CardDescription>
                  </div>
                  <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Last hour</SelectItem>
                      <SelectItem value="24h">Last 24 hours</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {alertsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : recentAlerts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p>No alerts in the selected time range</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentAlerts?.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg ${
                            alert.status === 'firing' 
                              ? 'bg-red-100 text-red-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {alert.status === 'firing' ? (
                              <AlertTriangle className="h-5 w-5" />
                            ) : (
                              <CheckCircle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">{alert.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {alert.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(alert.createdAt).toLocaleString()}</span>
                              <span>•</span>
                              <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                                {alert.severity}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Badge variant={alert.status === 'firing' ? 'destructive' : 'outline'}>
                          {alert.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Alert Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alert Policies</CardTitle>
                <CardDescription>
                  Configure how alerts are routed and what actions are taken
                </CardDescription>
              </CardHeader>
              <CardContent>
                {policiesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : alertPolicies?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No alert policies configured</p>
                    <Button variant="outline" className="mt-4">
                      Create Policy
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alertPolicies?.map((policy) => (
                      <div
                        key={policy.id}
                        className="p-4 border rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={policy.enabled}
                              onCheckedChange={(checked) => 
                                togglePolicy.mutate({ policyId: policy.id, enabled: checked })
                              }
                            />
                            <div>
                              <h4 className="font-medium">
                                {policy.scopeType.charAt(0).toUpperCase() + policy.scopeType.slice(1)} Policy
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Action: {policy.action}
                              </p>
                            </div>
                          </div>
                          <Badge variant={policy.enabled ? 'default' : 'secondary'}>
                            {policy.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Priority:</span>
                            <Badge variant="outline">{policy.priority}</Badge>
                          </div>
                          {policy.notifyOwner && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Bell className="h-3 w-3" />
                              <span>Notify Owner</span>
                            </div>
                          )}
                          {policy.notifyClient && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Bell className="h-3 w-3" />
                              <span>Notify Client</span>
                            </div>
                          )}
                          {policy.autoCreateWorkOrder && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Activity className="h-3 w-3" />
                              <span>Auto Work Order</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Provisioning Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Provisioning Jobs</CardTitle>
                <CardDescription>
                  Track Grafana provisioning operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : provisioningJobs?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No provisioning jobs found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {provisioningJobs?.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${
                            job.status === 'completed' 
                              ? 'bg-green-100 text-green-600'
                              : job.status === 'failed'
                              ? 'bg-red-100 text-red-600'
                              : job.status === 'running'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {job.status === 'completed' ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : job.status === 'failed' ? (
                              <XCircle className="h-5 w-5" />
                            ) : job.status === 'running' ? (
                              <RefreshCw className="h-5 w-5 animate-spin" />
                            ) : (
                              <Clock className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium">
                              {job.jobType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{job.targetType}: {job.targetId}</span>
                              <span>•</span>
                              <span>Attempts: {job.attemptCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'failed' ? 'destructive' :
                            job.status === 'running' ? 'secondary' : 'outline'
                          }>
                            {job.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(job.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Grafana Server Configuration
                </CardTitle>
                <CardDescription>
                  Configure your Grafana server connection to enable dashboard provisioning and alert management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="grafana-url" className="flex items-center gap-2">
                      <Link className="h-4 w-4" />
                      Grafana Server URL
                    </Label>
                    <Input
                      id="grafana-url"
                      placeholder="https://grafana.example.com"
                      value={grafanaUrl}
                      onChange={(e) => setGrafanaUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The base URL of your Grafana instance (e.g., https://grafana.example.com)
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="grafana-token" className="flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Admin API Token
                    </Label>
                    <Input
                      id="grafana-token"
                      type="password"
                      placeholder="glsa_xxxxxxxxxxxxx"
                      value={grafanaToken}
                      onChange={(e) => setGrafanaToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      A Grafana service account token with Admin permissions. 
                      <a 
                        href="https://grafana.com/docs/grafana/latest/administration/service-accounts/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline ml-1"
                      >
                        Learn how to create one
                      </a>
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={testGrafanaConnection}
                    disabled={testingConnection}
                  >
                    {testingConnection ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    onClick={handleSaveGrafanaConfig}
                    disabled={saveGrafanaConfig.isPending}
                  >
                    {saveGrafanaConfig.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Configuration
                  </Button>
                </div>
                
                {/* Current instances */}
                {instances && instances.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3">Configured Instances</h4>
                    <div className="space-y-2">
                      {instances.map((instance) => (
                        <div 
                          key={instance.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full ${
                              instance.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <div>
                              <p className="font-medium">{instance.url}</p>
                              <p className="text-xs text-muted-foreground">
                                Added {new Date(instance.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant={instance.status === 'active' ? 'default' : 'secondary'}>
                            {instance.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Email Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Notifications
                  </CardTitle>
                  <CardDescription>
                    Configure email addresses to receive alert notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="email@example.com"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEmailChannel()}
                    />
                    <Button onClick={addEmailChannel}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {emailChannels.length > 0 ? (
                    <div className="space-y-2">
                      {emailChannels.map((email) => (
                        <div 
                          key={email}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{email}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeEmailChannel(email)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No email channels configured
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Slack Integration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Slack Integration
                  </CardTitle>
                  <CardDescription>
                    Send alerts to a Slack channel via webhook
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="slack-webhook">Webhook URL</Label>
                    <Input
                      id="slack-webhook"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      <a 
                        href="https://api.slack.com/messaging/webhooks" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Learn how to create a Slack webhook
                      </a>
                    </p>
                  </div>
                  
                  <Button 
                    className="w-full"
                    disabled={!slackWebhook}
                    onClick={() => toast.success("Slack webhook saved")}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Slack Webhook
                  </Button>
                </CardContent>
              </Card>

              {/* Custom Webhooks */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="h-5 w-5" />
                    Custom Webhooks
                  </CardTitle>
                  <CardDescription>
                    Configure custom webhook endpoints for alert notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        placeholder="My Webhook"
                        value={newWebhookName}
                        onChange={(e) => setNewWebhookName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>URL</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://api.example.com/webhook"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                        />
                        <Button onClick={addCustomWebhook}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {customWebhooks.length > 0 ? (
                    <div className="space-y-2">
                      {customWebhooks.map((webhook) => (
                        <div 
                          key={webhook.name}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Webhook className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{webhook.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-md">
                                {webhook.url}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => removeCustomWebhook(webhook.name)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No custom webhooks configured
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
