import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Building2, Users, Shield, Palette, Mail, Trash2, 
  UserPlus, Settings, Key, Globe, Clock, CheckCircle2,
  XCircle, AlertTriangle, MoreHorizontal, Send, RefreshCw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";

// Role permissions matrix
const ROLE_PERMISSIONS = {
  admin: {
    label: "Admin",
    description: "Full access to all features including member management",
    permissions: ["view", "edit", "delete", "manage_members", "manage_settings"],
  },
  editor: {
    label: "Editor",
    description: "Can view and edit projects, documents, and models",
    permissions: ["view", "edit"],
  },
  reviewer: {
    label: "Reviewer",
    description: "Can view and comment on projects and documents",
    permissions: ["view", "comment"],
  },
  investor_viewer: {
    label: "Investor Viewer",
    description: "Read-only access to approved investor materials",
    permissions: ["view_investor_materials"],
  },
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  editor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  reviewer: "bg-green-500/20 text-green-400 border-green-500/30",
  investor_viewer: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  pending: "bg-yellow-500/20 text-yellow-400",
  suspended: "bg-red-500/20 text-red-400",
  removed: "bg-gray-500/20 text-gray-400",
};

// Feature access matrix for permissions tab
const FEATURE_ACCESS = [
  { feature: "View Projects", admin: true, editor: true, reviewer: true, investor: false },
  { feature: "Edit Projects", admin: true, editor: true, reviewer: false, investor: false },
  { feature: "Delete Projects", admin: true, editor: false, reviewer: false, investor: false },
  { feature: "View Documents", admin: true, editor: true, reviewer: true, investor: false },
  { feature: "Upload Documents", admin: true, editor: true, reviewer: false, investor: false },
  { feature: "View Financial Models", admin: true, editor: true, reviewer: true, investor: false },
  { feature: "Edit Financial Models", admin: true, editor: true, reviewer: false, investor: false },
  { feature: "View Investor Materials", admin: true, editor: true, reviewer: true, investor: true },
  { feature: "Manage Members", admin: true, editor: false, reviewer: false, investor: false },
  { feature: "Organization Settings", admin: true, editor: false, reviewer: false, investor: false },
  { feature: "View Audit Log", admin: true, editor: false, reviewer: false, investor: false },
];

export default function OrganizationSettings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("general");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("editor");
  const [inviteMessage, setInviteMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // Get current organization from auth
  const { data: authData } = trpc.authFlow.me.useQuery();
  const activeOrg = authData?.activeOrg;
  const isOrgAdmin = activeOrg?.role === "admin";
  
  // Fetch organization members
  const { data: members = [], refetch: refetchMembers, isLoading: membersLoading } = 
    trpc.admin.getOrganizationMembers.useQuery(
      { organizationId: activeOrg?.id || 0 },
      { enabled: !!activeOrg?.id && isOrgAdmin }
    );
  
  // Fetch pending invitations
  const { data: invitations = [], refetch: refetchInvitations } = 
    trpc.admin.getPendingInvitations.useQuery(
      { organizationId: activeOrg?.id || 0 },
      { enabled: !!activeOrg?.id && isOrgAdmin }
    );
  
  // Form state for general settings
  const [formData, setFormData] = useState({
    name: activeOrg?.name || "",
    description: "",
    primaryColor: "#F97316",
  });
  
  // Form state for security settings
  const [securitySettings, setSecuritySettings] = useState({
    require2FA: false,
    signupMode: "invite_only" as const,
    allowedEmailDomains: "",
  });
  
  // Mutations
  const sendInvitation = trpc.admin.sendInvitation.useMutation({
    onSuccess: () => {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("editor");
      setInviteMessage("");
      refetchInvitations();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const resendInvitationMutation = trpc.admin.resendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const revokeInvitationMutation = trpc.admin.revokeInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled");
      refetchInvitations();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const updateMemberRole = trpc.admin.updateMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated");
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const removeMember = trpc.admin.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed from organization");
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const handleSaveGeneral = async () => {
    setIsSaving(true);
    // TODO: Implement actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Organization settings saved");
    setIsSaving(false);
  };
  
  const handleSaveSecurity = async () => {
    setIsSaving(true);
    // TODO: Implement actual API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Security settings saved");
    setIsSaving(false);
  };
  
  const handleInviteMember = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    if (!activeOrg?.id) {
      toast.error("No organization selected");
      return;
    }
    sendInvitation.mutate({
      organizationId: activeOrg.id,
      email: inviteEmail,
      role: inviteRole as "admin" | "editor" | "reviewer" | "investor_viewer",
      personalMessage: inviteMessage || undefined,
    });
  };
  
  const handleResendInvitation = (invitationId: number) => {
    resendInvitationMutation.mutate({ tokenId: invitationId });
  };
  
  const handleCancelInvitation = (invitationId: number) => {
    revokeInvitationMutation.mutate({ invitationId });
  };
  
  const handleRemoveMember = (membershipId: number) => {
    if (!activeOrg?.id) return;
    removeMember.mutate({ organizationId: activeOrg.id, membershipId });
  };
  
  const handleChangeRole = (membershipId: number, newRole: string) => {
    if (!activeOrg?.id) return;
    updateMemberRole.mutate({
      organizationId: activeOrg.id,
      membershipId,
      newRole: newRole as "admin" | "editor" | "reviewer" | "investor_viewer",
    });
  };
  
  // Mutation to select org
  const selectOrg = trpc.authFlow.selectOrg.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Show loading or no org state
  if (!activeOrg) {
    const organizations = authData?.organizations || [];
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {organizations.length > 0 ? "Select Organization" : "No Organization Selected"}
            </CardTitle>
            <CardDescription>
              {organizations.length > 0 
                ? "Please select an organization to manage its settings."
                : "You don't have access to any organizations yet."}
            </CardDescription>
          </CardHeader>
          {organizations.length > 0 && (
            <CardContent>
              <div className="space-y-2">
                {organizations.map((org) => (
                  <Button
                    key={org.id}
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => selectOrg.mutate({ organizationId: org.id })}
                  >
                    <Building2 className="h-4 w-4" />
                    {org.name}
                    <Badge variant="secondary" className="ml-auto">{org.role}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Building2 className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{activeOrg.name}</h1>
              <p className="text-sm text-muted-foreground">Organization Settings</p>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Key className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
          </TabsList>
          
          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic information about your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Organization Code</Label>
                    <Input id="code" value={activeOrg.code || ""} disabled />
                    <p className="text-xs text-muted-foreground">Code cannot be changed</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slug">Organization URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">https://</span>
                    <Input id="slug" value={activeOrg.slug || ""} className="max-w-[200px]" disabled />
                    <span className="text-muted-foreground">.kiisha.io</span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSaveGeneral} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Members Tab */}
          <TabsContent value="members">
            <div className="space-y-6">
              {/* Invitations Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>Manage pending member invitations</CardDescription>
                  </div>
                  <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2">
                        <UserPlus className="h-4 w-4" />
                        Invite Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                          Send an invitation to join {activeOrg.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role">Role</Label>
                          <Select value={inviteRole} onValueChange={setInviteRole}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin - Full access</SelectItem>
                              <SelectItem value="editor">Editor - Create and edit</SelectItem>
                              <SelectItem value="reviewer">Reviewer - Review and approve</SelectItem>
                              <SelectItem value="investor_viewer">Investor Viewer - Read only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInviteMember} className="gap-2">
                          <Send className="h-4 w-4" />
                          Send Invitation
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {invitations.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No pending invitations</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Invited</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell className="font-medium">{invitation.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={roleColors[invitation.role]}>
                                {invitation.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invitation.createdAt)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(invitation.expiresAt)}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleResendInvitation(invitation.id)}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Resend
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleCancelInvitation(invitation.id)}
                                    className="text-red-500"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Cancel
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
              
              {/* Members Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Organization Members</CardTitle>
                  <CardDescription>{members.length} members in this organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Active</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{(member.userName || "?").charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.userName || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">{member.userEmail}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={member.role} 
                              onValueChange={(value) => handleChangeRole(member.id, value)}
                              disabled={member.userId === user?.id}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="reviewer">Reviewer</SelectItem>
                                <SelectItem value="investor_viewer">Investor Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColors[member.status]}>
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(member.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(member.createdAt)}
                          </TableCell>
                          <TableCell>
                            {member.userId !== user?.id && isOrgAdmin && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleRemoveMember(member.id)}
                                className="text-red-500 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Authentication Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Authentication
                  </CardTitle>
                  <CardDescription>Configure authentication requirements for your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Require Two-Factor Authentication</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        All members must enable 2FA to access the organization. Members without 2FA will be prompted to set it up.
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.require2FA}
                      onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, require2FA: checked })}
                    />
                  </div>
                  
                  {securitySettings.require2FA && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-amber-600">2FA Enforcement Active</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Members without 2FA enabled will see a setup prompt when they next log in. 
                            They won't be able to access organization resources until 2FA is configured.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Session Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Session Management
                  </CardTitle>
                  <CardDescription>Control session duration and timeout policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Session Timeout</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically log out inactive users after this period
                      </p>
                    </div>
                    <Select 
                      value={securitySettings.sessionTimeout?.toString() || "480"}
                      onValueChange={(value) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(value) })}
                    >
                      <SelectTrigger className="max-w-[300px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="480">8 hours (default)</SelectItem>
                        <SelectItem value="1440">24 hours</SelectItem>
                        <SelectItem value="10080">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Force Re-authentication for Sensitive Actions</Label>
                      <p className="text-sm text-muted-foreground">
                        Require password confirmation for actions like changing settings or deleting data
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.forceReauth || false}
                      onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, forceReauth: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* IP Restrictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    IP Restrictions
                  </CardTitle>
                  <CardDescription>Limit access to specific IP addresses or ranges</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Enable IP Allowlist</Label>
                      <p className="text-sm text-muted-foreground">
                        Only allow access from specified IP addresses or CIDR ranges
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.ipRestrictionEnabled || false}
                      onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, ipRestrictionEnabled: checked })}
                    />
                  </div>
                  
                  {securitySettings.ipRestrictionEnabled && (
                    <div className="space-y-2 p-4 rounded-lg border">
                      <Label className="font-medium">Allowed IP Addresses</Label>
                      <Textarea
                        placeholder="192.168.1.0/24&#10;10.0.0.1&#10;203.0.113.0/28"
                        value={securitySettings.allowedIPs || ""}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, allowedIPs: e.target.value })}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter one IP address or CIDR range per line. Supports IPv4 and IPv6.
                      </p>
                    </div>
                  )}
                  
                  {securitySettings.ipRestrictionEnabled && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-600">Warning: IP Restrictions Active</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Users connecting from IPs not in the allowlist will be blocked. Make sure to include your current IP address.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Password Policy */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Password Policy
                  </CardTitle>
                  <CardDescription>Configure password requirements and rotation policies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Password Expiration</Label>
                      <p className="text-sm text-muted-foreground">
                        Require users to change their password periodically
                      </p>
                    </div>
                    <Select 
                      value={securitySettings.passwordExpiration?.toString() || "0"}
                      onValueChange={(value) => setSecuritySettings({ ...securitySettings, passwordExpiration: parseInt(value) })}
                    >
                      <SelectTrigger className="max-w-[300px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Never expire</SelectItem>
                        <SelectItem value="30">Every 30 days</SelectItem>
                        <SelectItem value="60">Every 60 days</SelectItem>
                        <SelectItem value="90">Every 90 days</SelectItem>
                        <SelectItem value="180">Every 180 days</SelectItem>
                        <SelectItem value="365">Every year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Account Lockout</Label>
                      <p className="text-sm text-muted-foreground">
                        Lock accounts after 5 failed login attempts for 30 minutes
                      </p>
                    </div>
                    <Switch
                      checked={securitySettings.accountLockout !== false}
                      onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, accountLockout: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Signup Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Member Signup
                  </CardTitle>
                  <CardDescription>Control how new members can join your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4 p-4 rounded-lg border">
                    <div className="space-y-1">
                      <Label className="font-medium">Signup Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Control how new members can join your organization
                      </p>
                    </div>
                    <Select 
                      value={securitySettings.signupMode} 
                      onValueChange={(value) => setSecuritySettings({ ...securitySettings, signupMode: value as any })}
                    >
                      <SelectTrigger className="max-w-[300px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invite_only">Invite Only - Members must be invited by an admin</SelectItem>
                        <SelectItem value="domain_allowlist">Domain Allowlist - Auto-approve from allowed domains</SelectItem>
                        <SelectItem value="open">Open - Anyone can request to join</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {securitySettings.signupMode === "domain_allowlist" && (
                    <div className="space-y-2 p-4 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Allowed Email Domains</Label>
                      </div>
                      <Input
                        placeholder="kiisha.io, kiisha.com"
                        value={securitySettings.allowedEmailDomains}
                        onChange={(e) => setSecuritySettings({ ...securitySettings, allowedEmailDomains: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Comma-separated list of domains. Users with these email domains can auto-join.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveSecurity} disabled={isSaving} size="lg">
                  {isSaving ? "Saving..." : "Save All Security Settings"}
                </Button>
              </div>
            </div>
          </TabsContent>
          
          {/* Permissions Tab */}
          <TabsContent value="permissions">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Role Permissions Matrix</CardTitle>
                  <CardDescription>Overview of what each role can do within the organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {Object.entries(ROLE_PERMISSIONS).map(([key, value]) => (
                      <div key={key} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{value.label}</h4>
                            <p className="text-sm text-muted-foreground">{value.description}</p>
                          </div>
                          <Badge variant="outline" className={roleColors[key]}>{key}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {value.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                              {perm.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feature Access by Role</CardTitle>
                  <CardDescription>Detailed breakdown of feature access for each role</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-center">Admin</TableHead>
                        <TableHead className="text-center">Editor</TableHead>
                        <TableHead className="text-center">Reviewer</TableHead>
                        <TableHead className="text-center">Investor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FEATURE_ACCESS.map((row) => (
                        <TableRow key={row.feature}>
                          <TableCell className="font-medium">{row.feature}</TableCell>
                          <TableCell className="text-center">
                            {row.admin ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.editor ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.reviewer ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.investor ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle>Branding</CardTitle>
                <CardDescription>Customize your organization's appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <Button variant="outline" size="sm">Upload Logo</Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                        className="max-w-[120px]"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for buttons, links, and accent elements
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <p className="text-sm font-medium mb-2">Preview</p>
                    <div className="flex items-center gap-3">
                      <Button style={{ backgroundColor: formData.primaryColor }}>
                        Primary Button
                      </Button>
                      <span style={{ color: formData.primaryColor }} className="font-medium">
                        Accent Text
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handleSaveGeneral} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Branding"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
