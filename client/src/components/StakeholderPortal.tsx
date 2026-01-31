import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Users,
  Plus,
  Settings,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  Lock,
  Globe,
  Palette,
  BarChart3,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  Link2,
  Mail,
  Key,
  Shield,
} from "lucide-react";

// Mock stakeholder portals
const mockPortals = [
  {
    id: 1,
    name: "Investor Dashboard - Fund A",
    slug: "fund-a-investors",
    brandingConfig: {
      logo: "/logo.png",
      primaryColor: "#E87722",
      companyName: "Clean Energy Fund A",
    },
    allowedSiteIds: [1, 2, 3],
    allowedMetrics: ["energy_production", "performance_ratio", "availability"],
    accessType: "password",
    expiresAt: new Date("2026-12-31"),
    createdAt: new Date("2025-06-01"),
    lastAccessedAt: new Date("2026-01-15T09:30:00"),
    accessCount: 156,
    activeUsers: 12,
  },
  {
    id: 2,
    name: "Client Portal - ABC Corp",
    slug: "abc-corp-portal",
    brandingConfig: {
      logo: "/abc-logo.png",
      primaryColor: "#2563eb",
      companyName: "ABC Corporation",
    },
    allowedSiteIds: [4, 5],
    allowedMetrics: ["energy_production", "cost_savings", "carbon_offset"],
    accessType: "token",
    expiresAt: null,
    createdAt: new Date("2025-09-15"),
    lastAccessedAt: new Date("2026-01-14T16:45:00"),
    accessCount: 89,
    activeUsers: 5,
  },
  {
    id: 3,
    name: "Lender Reporting - Bank XYZ",
    slug: "bank-xyz-reports",
    brandingConfig: {
      logo: null,
      primaryColor: "#059669",
      companyName: "Bank XYZ",
    },
    allowedSiteIds: [1, 2, 3, 4, 5],
    allowedMetrics: ["energy_production", "revenue", "debt_service_coverage"],
    accessType: "sso",
    expiresAt: new Date("2027-06-30"),
    createdAt: new Date("2025-03-01"),
    lastAccessedAt: new Date("2026-01-10T11:00:00"),
    accessCount: 45,
    activeUsers: 3,
  },
];

// Mock access logs
const mockAccessLogs = [
  { id: 1, portalId: 1, userEmail: "investor1@fund-a.com", action: "view_dashboard", timestamp: new Date("2026-01-15T09:30:00"), ipAddress: "192.168.1.100" },
  { id: 2, portalId: 1, userEmail: "investor2@fund-a.com", action: "download_report", timestamp: new Date("2026-01-15T08:45:00"), ipAddress: "10.0.0.50" },
  { id: 3, portalId: 2, userEmail: "john@abc-corp.com", action: "view_dashboard", timestamp: new Date("2026-01-14T16:45:00"), ipAddress: "172.16.0.25" },
  { id: 4, portalId: 3, userEmail: "analyst@bank-xyz.com", action: "view_report", timestamp: new Date("2026-01-10T11:00:00"), ipAddress: "203.0.113.42" },
];

interface Portal {
  id: number;
  name: string;
  slug: string;
  brandingConfig: {
    logo: string | null;
    primaryColor: string;
    companyName: string;
  };
  allowedSiteIds: number[];
  allowedMetrics: string[];
  accessType: string;
  expiresAt: Date | null;
  createdAt: Date;
  lastAccessedAt: Date | null;
  accessCount: number;
  activeUsers: number;
}

export function StakeholderPortalManager() {
  const [portals, setPortals] = useState<Portal[]>(mockPortals);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<Portal | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const getAccessTypeConfig = (type: string) => {
    switch (type) {
      case "password":
        return { icon: Lock, label: "Password", color: "text-blue-400" };
      case "token":
        return { icon: Key, label: "Token", color: "text-purple-400" };
      case "sso":
        return { icon: Shield, label: "SSO", color: "text-green-400" };
      default:
        return { icon: Globe, label: type, color: "text-muted-foreground" };
    }
  };

  const copyPortalLink = (slug: string) => {
    const url = `https://portal.kiisha.io/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Portal link copied to clipboard");
  };

  const totalActiveUsers = portals.reduce((sum, p) => sum + p.activeUsers, 0);
  const totalAccessCount = portals.reduce((sum, p) => sum + p.accessCount, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Portals</p>
                <p className="text-2xl font-bold">{portals.length}</p>
              </div>
              <Globe className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold">{totalActiveUsers}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">{totalAccessCount}</p>
              </div>
              <Eye className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Reports Shared</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Portal List */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Stakeholder Portals</CardTitle>
            <CardDescription>Branded read-only dashboards for investors and clients</CardDescription>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Portal
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {portals.map((portal) => {
                const accessConfig = getAccessTypeConfig(portal.accessType);
                const AccessIcon = accessConfig.icon;

                return (
                  <div
                    key={portal.id}
                    className="p-4 bg-muted/30 rounded-lg border border-border hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: portal.brandingConfig.primaryColor }}
                        >
                          {portal.brandingConfig.companyName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{portal.name}</h3>
                            <Badge variant="outline" className={cn("text-xs", accessConfig.color)}>
                              <AccessIcon className="w-3 h-3 mr-1" />
                              {accessConfig.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {portal.brandingConfig.companyName} • {portal.allowedSiteIds.length} sites • {portal.allowedMetrics.length} metrics
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {portal.activeUsers} users
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {portal.accessCount} views
                            </span>
                            {portal.lastAccessedAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last access: {portal.lastAccessedAt.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              portal.kiisha.io/{portal.slug}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyPortalLink(portal.slug)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://portal.kiisha.io/${portal.slug}`, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPortal(portal);
                            setShowConfigDialog(true);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete the portal "${portal.name}"?`)) {
                              setPortals(prev => prev.filter(p => p.id !== portal.id));
                              toast.success("Portal deleted");
                            }
                          }}
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

      {/* Recent Access Logs */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Access</CardTitle>
          <CardDescription>Portal access activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Portal</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Time</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {mockAccessLogs.map((log) => {
                  const portal = portals.find((p) => p.id === log.portalId);
                  return (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2 px-3 text-sm">{portal?.name || "Unknown"}</td>
                      <td className="py-2 px-3 text-sm">{log.userEmail}</td>
                      <td className="py-2 px-3 text-sm">
                        <Badge variant="outline" className="text-xs">
                          {log.action.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">
                        {log.timestamp.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-sm text-muted-foreground">{log.ipAddress}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Portal Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Stakeholder Portal</DialogTitle>
            <DialogDescription>
              Set up a branded read-only dashboard for stakeholders
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Portal Name</Label>
              <Input placeholder="e.g., Investor Dashboard - Fund A" className="mt-1" />
            </div>
            <div>
              <Label>URL Slug</Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">portal.kiisha.io/</span>
                <Input placeholder="fund-a-investors" className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Company Name</Label>
              <Input placeholder="e.g., Clean Energy Fund A" className="mt-1" />
            </div>
            <div>
              <Label>Brand Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="color" defaultValue="#E87722" className="w-12 h-10 p-1" />
                <Input placeholder="#E87722" className="flex-1" />
              </div>
            </div>
            <div>
              <Label>Access Type</Label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select access method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password Protected</SelectItem>
                  <SelectItem value="token">Access Token</SelectItem>
                  <SelectItem value="sso">SSO Integration</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Expiration Date (Optional)</Label>
              <Input type="date" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Portal created successfully");
              setShowCreateDialog(false);
            }}>
              Create Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configure Portal Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure Portal</DialogTitle>
            <DialogDescription>
              {selectedPortal?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedPortal && (
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="access">Access Control</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-4 mt-4">
                <div>
                  <Label>Portal Name</Label>
                  <Input defaultValue={selectedPortal.name} className="mt-1" />
                </div>
                <div>
                  <Label>URL Slug</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">portal.kiisha.io/</span>
                    <Input defaultValue={selectedPortal.slug} className="flex-1" />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-4">
                <div>
                  <Label>Company Name</Label>
                  <Input defaultValue={selectedPortal.brandingConfig.companyName} className="mt-1" />
                </div>
                <div>
                  <Label>Brand Color</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="color"
                      defaultValue={selectedPortal.brandingConfig.primaryColor}
                      className="w-12 h-10 p-1"
                    />
                    <Input defaultValue={selectedPortal.brandingConfig.primaryColor} className="flex-1" />
                  </div>
                </div>
                <div>
                  <Label>Logo</Label>
                  <div className="mt-1 p-4 border border-dashed border-border rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      Drag and drop a logo or click to upload
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="access" className="space-y-4 mt-4">
                <div>
                  <Label>Access Type</Label>
                  <Select defaultValue={selectedPortal.accessType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="password">Password Protected</SelectItem>
                      <SelectItem value="token">Access Token</SelectItem>
                      <SelectItem value="sso">SSO Integration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedPortal.accessType === "password" && (
                  <div>
                    <Label>Portal Password</Label>
                    <Input type="password" placeholder="Enter new password" className="mt-1" />
                  </div>
                )}
                <div>
                  <Label>Expiration Date</Label>
                  <Input
                    type="date"
                    defaultValue={selectedPortal.expiresAt?.toISOString().split("T")[0]}
                    className="mt-1"
                  />
                </div>
              </TabsContent>
              <TabsContent value="content" className="space-y-4 mt-4">
                <div>
                  <Label>Allowed Sites</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedPortal.allowedSiteIds.length} sites selected
                  </p>
                </div>
                <div>
                  <Label>Visible Metrics</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedPortal.allowedMetrics.map((metric) => (
                      <Badge key={metric} variant="outline">
                        {metric.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Portal configuration saved");
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

export default StakeholderPortalManager;
