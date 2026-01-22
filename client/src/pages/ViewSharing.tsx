/**
 * View Sharing Management Page
 * 
 * Allows org admins to:
 * - Create new view shares with other organizations
 * - View and manage active shares
 * - Revoke shares with immediate effect
 * - View shares received from other organizations
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Share2, Eye, Edit, Shield, Clock, Users, Building2, Trash2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ViewSharing() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("outgoing");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedShareId, setSelectedShareId] = useState<number | null>(null);
  
  // Form state for new share
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [targetOrgId, setTargetOrgId] = useState<string>("");
  const [permissionLevel, setPermissionLevel] = useState<string>("view_only");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  
  // Queries
  const { data: views, isLoading: viewsLoading } = trpc.viewSharing.listOrgViews.useQuery();
  const { data: outgoingShares, isLoading: outgoingLoading, refetch: refetchOutgoing } = trpc.viewSharing.listOutgoingShares.useQuery();
  const { data: incomingShares, isLoading: incomingLoading, refetch: refetchIncoming } = trpc.viewSharing.listIncomingShares.useQuery();
  const { data: organizations } = trpc.viewSharing.listShareableOrgs.useQuery();
  
  // Mutations
  const createShareMutation = trpc.viewSharing.createShare.useMutation({
    onSuccess: () => {
      toast.success("View shared successfully");
      setShareDialogOpen(false);
      resetForm();
      refetchOutgoing();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create share");
    },
  });
  
  const revokeShareMutation = trpc.viewSharing.revokeShare.useMutation({
    onSuccess: () => {
      toast.success("Share revoked - access removed immediately");
      setRevokeDialogOpen(false);
      setSelectedShareId(null);
      refetchOutgoing();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke share");
    },
  });
  
  const resetForm = () => {
    setSelectedViewId("");
    setTargetOrgId("");
    setPermissionLevel("view_only");
    setExpiresInDays("");
  };
  
  const handleCreateShare = () => {
    if (!selectedViewId || !targetOrgId) {
      toast.error("Please select a view and target organization");
      return;
    }
    
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000)
      : undefined;
    
    createShareMutation.mutate({
      viewId: parseInt(selectedViewId),
      targetOrgId: parseInt(targetOrgId),
      permissionLevel: permissionLevel as "view_only" | "edit" | "admin",
      expiresAt,
    });
  };
  
  const handleRevokeShare = () => {
    if (!selectedShareId) return;
    revokeShareMutation.mutate({ shareId: selectedShareId });
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  
  const getPermissionBadge = (level: string) => {
    switch (level) {
      case "admin":
        return <Badge variant="destructive" className="gap-1"><Shield className="h-3 w-3" />Admin</Badge>;
      case "edit":
        return <Badge variant="default" className="gap-1"><Edit className="h-3 w-3" />Edit</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />View Only</Badge>;
    }
  };
  
  const getStatusBadge = (share: { isActive: boolean; expiresAt: Date | string | null }) => {
    if (!share.isActive) {
      return <Badge variant="outline" className="text-muted-foreground">Revoked</Badge>;
    }
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return <Badge variant="outline" className="text-yellow-600">Expired</Badge>;
    }
    return <Badge variant="default" className="bg-green-600">Active</Badge>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Share2 className="h-6 w-6" />
            View Sharing
          </h1>
          <p className="text-secondary mt-1">
            Manage cross-organization view sharing with explicit grants and revocation
          </p>
        </div>
        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Share2 className="h-4 w-4" />
              Share a View
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Share View with Organization</DialogTitle>
              <DialogDescription>
                Create an explicit share grant. The recipient will only have access to the contents of this specific view.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="view">Select View</Label>
                <Select value={selectedViewId} onValueChange={setSelectedViewId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a view to share" />
                  </SelectTrigger>
                  <SelectContent>
                    {views?.map((view) => (
                      <SelectItem key={view.id} value={view.id.toString()}>
                        {view.name} ({view.viewType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="org">Target Organization</Label>
                <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id.toString()}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="permission">Permission Level</Label>
                <Select value={permissionLevel} onValueChange={setPermissionLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view_only">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        View Only - Can view but not modify
                      </div>
                    </SelectItem>
                    <SelectItem value="edit">
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4" />
                        Edit - Can view and export
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin - Full access to view contents
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="expires">Expires In (Days)</Label>
                <Input
                  id="expires"
                  type="number"
                  placeholder="Leave empty for no expiration"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Set an expiration date for automatic access removal.
                </p>
              </div>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-500">Important</p>
                  <p className="text-muted-foreground">
                    The recipient will only have access to the specific contents of this view. 
                    They cannot access any other data in your organization.
                  </p>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateShare}
                disabled={createShareMutation.isPending}
              >
                {createShareMutation.isPending ? "Creating..." : "Create Share"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="outgoing" className="gap-2">
            <Share2 className="h-4 w-4" />
            Outgoing Shares
          </TabsTrigger>
          <TabsTrigger value="incoming" className="gap-2">
            <Building2 className="h-4 w-4" />
            Received Shares
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="outgoing" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Views You've Shared</CardTitle>
                  <CardDescription>
                    Manage views shared with other organizations
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchOutgoing()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {outgoingLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : outgoingShares?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Share2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No outgoing shares yet</p>
                  <p className="text-sm">Share a view to collaborate with other organizations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>View</TableHead>
                      <TableHead>Shared With</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Shared On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outgoingShares?.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell className="font-medium">{share.viewName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {share.targetOrgName}
                          </div>
                        </TableCell>
                        <TableCell>{getPermissionBadge(share.permissionLevel)}</TableCell>
                        <TableCell>{getStatusBadge(share)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDate(share.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(share.sharedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {share.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setSelectedShareId(share.id);
                                setRevokeDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="incoming" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Views Shared With You</CardTitle>
                  <CardDescription>
                    Views that other organizations have shared with your organization
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchIncoming()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {incomingLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : incomingShares?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No incoming shares</p>
                  <p className="text-sm">Other organizations haven't shared any views with you yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>View</TableHead>
                      <TableHead>From Organization</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomingShares?.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell className="font-medium">{share.viewName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {share.sourceOrgName}
                          </div>
                        </TableCell>
                        <TableCell>{getPermissionBadge(share.permissionLevel)}</TableCell>
                        <TableCell>{getStatusBadge(share)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {formatDate(share.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {share.isActive && (
                            <Button variant="outline" size="sm" className="gap-1">
                              <Eye className="h-4 w-4" />
                              Open View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Revoke Share Access
            </DialogTitle>
            <DialogDescription>
              This will immediately remove the recipient's access to this view. 
              They will no longer be able to see any content from this share.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRevokeShare}
              disabled={revokeShareMutation.isPending}
            >
              {revokeShareMutation.isPending ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
