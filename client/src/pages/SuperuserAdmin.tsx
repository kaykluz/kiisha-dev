import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Building2, 
  Users, 
  Shield, 
  Plus, 
  Search, 
  MoreHorizontal,
  UserPlus,
  Settings,
  Eye,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Activity,
  Clock,
  LogIn,
  LogOut,
  Download,
  RefreshCw
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SuperuserAdmin() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("organizations");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
  const [showInviteUserDialog, setShowInviteUserDialog] = useState(false);
  const [showManageAccessDialog, setShowManageAccessDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{id: number; name: string; email: string} | null>(null);
  
  // New organization form state
  const [newOrg, setNewOrg] = useState({
    name: "",
    code: "",
    slug: "",
    description: "",
    require2FA: false,
    signupMode: "invite_only" as "invite_only" | "domain_allowlist" | "open",
    allowedEmailDomains: "",
  });
  
  // New user invite form state
  const [newUserInvite, setNewUserInvite] = useState({
    email: "",
    name: "",
    organizationId: "",
    role: "editor" as "admin" | "editor" | "reviewer" | "investor_viewer",
    personalMessage: "",
  });

  // Manage access form state
  const [manageAccess, setManageAccess] = useState({
    organizationId: "",
    action: "grant" as "grant" | "revoke",
    role: "editor" as "admin" | "editor" | "reviewer" | "investor_viewer",
    reason: "",
  });
  
  // Check if user is superuser
  const isSuperuser = user?.isSuperuser || user?.role === "superuser_admin";

  // API queries
  const { data: organizations, refetch: refetchOrgs, isLoading: orgsLoading } = 
    trpc.superuser.listAllOrganizations.useQuery(undefined, { enabled: isSuperuser });
  
  const { data: allUsers, refetch: refetchUsers, isLoading: usersLoading } = 
    trpc.superuser.listAllUsers.useQuery({ limit: 100 }, { enabled: isSuperuser });

  const { data: elevationStatus, refetch: refetchElevation } = 
    trpc.superuser.getElevationStatus.useQuery(undefined, { enabled: isSuperuser });

  const { data: auditLogs } = trpc.superuser.getElevationHistory.useQuery(
    { limit: 50 },
    { enabled: isSuperuser }
  );

  // Mutations
  const createOrg = trpc.superuser.createOrganization.useMutation({
    onSuccess: () => {
      toast.success(`${newOrg.name} has been created successfully.`);
      setShowCreateOrgDialog(false);
      setNewOrg({
        name: "",
        code: "",
        slug: "",
        description: "",
        require2FA: false,
        signupMode: "invite_only",
        allowedEmailDomains: "",
      });
      refetchOrgs();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateOrgStatus = trpc.superuser.updateOrganizationStatus.useMutation({
    onSuccess: () => {
      toast.success("Organization status updated");
      refetchOrgs();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendInvitation = trpc.admin.sendInvitation.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${newUserInvite.email}`);
      setShowInviteUserDialog(false);
      setNewUserInvite({
        email: "",
        name: "",
        organizationId: "",
        role: "editor",
        personalMessage: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const manageUserAccess = trpc.superuser.manageUserAccess.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
      setShowManageAccessDialog(false);
      setSelectedUser(null);
      setManageAccess({
        organizationId: "",
        action: "grant",
        role: "editor",
        reason: "",
      });
      refetchUsers();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const startElevation = trpc.superuser.startElevation.useMutation({
    onSuccess: () => {
      toast.success("Elevation started");
      refetchElevation();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const endElevation = trpc.superuser.endElevation.useMutation({
    onSuccess: () => {
      toast.success("Elevation ended");
      refetchElevation();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
  
  if (!isSuperuser) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Shield className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible to platform superusers. If you believe you should have access, please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  // Filter organizations based on search
  const filteredOrganizations = useMemo(() => {
    if (!organizations) return [];
    if (!searchQuery) return organizations;
    const query = searchQuery.toLowerCase();
    return organizations.filter(
      (org: { name: string; code: string }) => 
        org.name.toLowerCase().includes(query) || 
        org.code.toLowerCase().includes(query)
    );
  }, [organizations, searchQuery]);
  
  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!searchQuery) return allUsers;
    const query = searchQuery.toLowerCase();
    return allUsers.filter(
      (u: { name: string | null; email: string | null }) => 
        (u.name?.toLowerCase().includes(query)) || 
        (u.email?.toLowerCase().includes(query))
    );
  }, [allUsers, searchQuery]);
  
  const handleCreateOrganization = () => {
    createOrg.mutate({
      name: newOrg.name,
      code: newOrg.code,
      slug: newOrg.slug,
      description: newOrg.description || undefined,
      signupMode: newOrg.signupMode,
      allowedEmailDomains: newOrg.allowedEmailDomains || undefined,
      require2FA: newOrg.require2FA,
    });
  };
  
  const handleInviteUser = () => {
    if (!newUserInvite.organizationId) {
      toast.error("Please select an organization");
      return;
    }
    sendInvitation.mutate({
      organizationId: parseInt(newUserInvite.organizationId),
      email: newUserInvite.email,
      role: newUserInvite.role,
      personalMessage: newUserInvite.personalMessage || undefined,
    });
  };

  const handleManageAccess = () => {
    if (!selectedUser || !manageAccess.organizationId || !manageAccess.reason) {
      toast.error("Please fill in all required fields");
      return;
    }
    manageUserAccess.mutate({
      userId: selectedUser.id,
      organizationId: parseInt(manageAccess.organizationId),
      action: manageAccess.action,
      role: manageAccess.action === "grant" ? manageAccess.role : undefined,
      reason: manageAccess.reason,
    });
  };

  const handleUpdateOrgStatus = (orgId: number, status: "active" | "suspended" | "archived", reason: string) => {
    updateOrgStatus.mutate({ organizationId: orgId, status, reason });
  };
  
  return (
    <div className="container py-6 space-y-6">
      {/* Header with Elevation Status */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Platform Administration
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage organizations, users, and platform-wide settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Organization Switcher */}
          <OrganizationSwitcher variant="header" />
          
          {/* Elevation Status */}
          {elevationStatus?.isElevated && (
            <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div className="text-sm">
                <span className="font-medium text-destructive">Elevated</span>
                <span className="text-muted-foreground ml-2">
                  {elevationStatus.elevation?.remainingMinutes}m remaining
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => endElevation.mutate({})}
                disabled={endElevation.isPending}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{organizations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Organizations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{allUsers?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {organizations?.filter((o: { status: string }) => o.status === "active").length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Active Orgs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {elevationStatus?.isElevated ? "Active" : "Inactive"}
                </p>
                <p className="text-sm text-muted-foreground">Elevation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TabsList>
              <TabsTrigger value="organizations" className="gap-2">
                <Building2 className="h-4 w-4" />
                Organizations
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="audit" className="gap-2">
                <Database className="h-4 w-4" />
                Audit Log
              </TabsTrigger>
            </TabsList>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
          
          {activeTab === "organizations" && (
            <Dialog open={showCreateOrgDialog} onOpenChange={setShowCreateOrgDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                  <DialogDescription>
                    Add a new organization to the platform. Users can be invited after creation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={newOrg.name}
                        onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                        placeholder="Acme Energy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-code">Code</Label>
                      <Input
                        id="org-code"
                        value={newOrg.code}
                        onChange={(e) => setNewOrg({ ...newOrg, code: e.target.value.toUpperCase() })}
                        placeholder="ACME"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">URL Slug</Label>
                    <Input
                      id="org-slug"
                      value={newOrg.slug}
                      onChange={(e) => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      placeholder="acme-energy"
                    />
                    <p className="text-xs text-muted-foreground">
                      Will be accessible at: {newOrg.slug || "slug"}.kiisha.io
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="org-description">Description</Label>
                    <Textarea
                      id="org-description"
                      value={newOrg.description}
                      onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                      placeholder="Brief description of the organization..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-mode">Signup Mode</Label>
                    <Select
                      value={newOrg.signupMode}
                      onValueChange={(v) => setNewOrg({ ...newOrg, signupMode: v as typeof newOrg.signupMode })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invite_only">Invite Only</SelectItem>
                        <SelectItem value="domain_allowlist">Domain Allowlist</SelectItem>
                        <SelectItem value="open">Open Registration</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {newOrg.signupMode === "domain_allowlist" && (
                    <div className="space-y-2">
                      <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
                      <Input
                        id="allowed-domains"
                        value={newOrg.allowedEmailDomains}
                        onChange={(e) => setNewOrg({ ...newOrg, allowedEmailDomains: e.target.value })}
                        placeholder="acme.com, acme-energy.com"
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of allowed email domains
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require 2FA</Label>
                      <p className="text-xs text-muted-foreground">
                        All users must enable two-factor authentication
                      </p>
                    </div>
                    <Switch
                      checked={newOrg.require2FA}
                      onCheckedChange={(checked) => setNewOrg({ ...newOrg, require2FA: checked })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateOrgDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateOrganization} 
                    disabled={!newOrg.name || !newOrg.code || !newOrg.slug || createOrg.isPending}
                  >
                    {createOrg.isPending ? "Creating..." : "Create Organization"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {activeTab === "users" && (
            <Dialog open={showInviteUserDialog} onOpenChange={setShowInviteUserDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                  <DialogDescription>
                    Send an invitation to a new user to join an organization.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email Address</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={newUserInvite.email}
                      onChange={(e) => setNewUserInvite({ ...newUserInvite, email: e.target.value })}
                      placeholder="user@example.com"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="user-org">Organization</Label>
                    <Select
                      value={newUserInvite.organizationId}
                      onValueChange={(v) => setNewUserInvite({ ...newUserInvite, organizationId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations?.map((org: { id: number; name: string }) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="user-role">Role</Label>
                    <Select
                      value={newUserInvite.role}
                      onValueChange={(v) => setNewUserInvite({ ...newUserInvite, role: v as typeof newUserInvite.role })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="investor_viewer">Investor Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="personal-message">Personal Message (Optional)</Label>
                    <Textarea
                      id="personal-message"
                      value={newUserInvite.personalMessage}
                      onChange={(e) => setNewUserInvite({ ...newUserInvite, personalMessage: e.target.value })}
                      placeholder="Add a personal note to the invitation..."
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInviteUserDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleInviteUser} 
                    disabled={!newUserInvite.email || !newUserInvite.organizationId || sendInvitation.isPending}
                  >
                    {sendInvitation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {/* Organizations Tab */}
        <TabsContent value="organizations" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {orgsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading organizations...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrganizations.map((org: { 
                      id: number; 
                      name: string; 
                      code: string; 
                      slug: string | null; 
                      status: string; 
                      createdAt: Date 
                    }) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-xs text-muted-foreground">{org.slug}.kiisha.io</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{org.code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={org.status === "active" ? "default" : "destructive"}
                            className={org.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}
                          >
                            {org.status === "active" ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {org.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(org.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                startElevation.mutate({
                                  targetOrganizationId: org.id,
                                  scope: "organization",
                                  reason: `Admin access to ${org.name}`,
                                  durationHours: 1,
                                  canRead: true,
                                  canWrite: true,
                                  canExport: false,
                                });
                              }}>
                                <LogIn className="h-4 w-4 mr-2" />
                                Switch to Org
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Settings className="h-4 w-4 mr-2" />
                                Settings
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {org.status === "active" ? (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleUpdateOrgStatus(org.id, "suspended", "Suspended by superuser")}
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Suspend
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleUpdateOrgStatus(org.id, "active", "Reactivated by superuser")}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading users...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u: { 
                      id: number; 
                      name: string | null; 
                      email: string | null; 
                      role: string;
                      createdAt: Date;
                    }) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {u.name?.split(" ").map(n => n[0]).join("") || "?"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{u.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={u.role === "superuser_admin" ? "default" : "outline"}
                            className={u.role === "superuser_admin" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : ""}
                          >
                            {u.role === "superuser_admin" && <Shield className="h-3 w-3 mr-1" />}
                            {u.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedUser({ id: u.id, name: u.name || "Unknown", email: u.email || "" });
                                setShowManageAccessDialog(true);
                              }}>
                                <Settings className="h-4 w-4 mr-2" />
                                Manage Access
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Audit Log Tab */}
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Elevation Audit Trail</CardTitle>
              <CardDescription>
                Complete audit log of superuser elevation events
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs?.map((entry: {
                    id: number;
                    eventType: string;
                    userId: number;
                    organizationId: number | null;
                    createdAt: Date;
                    extra: Record<string, unknown> | null;
                  }) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.eventType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>User #{entry.userId}</TableCell>
                      <TableCell>
                        {entry.organizationId ? `Org #${entry.organizationId}` : "Global"}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm truncate">
                          {entry.extra ? JSON.stringify(entry.extra).slice(0, 50) + "..." : "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!auditLogs || auditLogs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Access Dialog */}
      <Dialog open={showManageAccessDialog} onOpenChange={setShowManageAccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User Access</DialogTitle>
            <DialogDescription>
              Grant or revoke organization access for {selectedUser?.name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={manageAccess.action}
                onValueChange={(v) => setManageAccess({ ...manageAccess, action: v as "grant" | "revoke" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grant">Grant Access</SelectItem>
                  <SelectItem value="revoke">Revoke Access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organization</Label>
              <Select
                value={manageAccess.organizationId}
                onValueChange={(v) => setManageAccess({ ...manageAccess, organizationId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations?.map((org: { id: number; name: string }) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {manageAccess.action === "grant" && (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={manageAccess.role}
                  onValueChange={(v) => setManageAccess({ ...manageAccess, role: v as typeof manageAccess.role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="investor_viewer">Investor Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (Required)</Label>
              <Textarea
                value={manageAccess.reason}
                onChange={(e) => setManageAccess({ ...manageAccess, reason: e.target.value })}
                placeholder="Explain why you are granting/revoking access..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This reason will be logged in the audit trail.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageAccessDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleManageAccess}
              disabled={!manageAccess.organizationId || !manageAccess.reason || manageAccess.reason.length < 10 || manageUserAccess.isPending}
              variant={manageAccess.action === "revoke" ? "destructive" : "default"}
            >
              {manageUserAccess.isPending ? "Processing..." : manageAccess.action === "grant" ? "Grant Access" : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
