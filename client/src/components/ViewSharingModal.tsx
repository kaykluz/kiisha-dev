import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Users, Building2, Briefcase, Globe, X, Share2, Eye, Edit, Shield, Clock, Trash2 } from "lucide-react";

interface ViewSharingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewId: number;
  viewName: string;
  organizationId?: number;
}

type ShareScope = "user" | "team" | "department" | "organization";
type PermissionLevel = "view_only" | "edit" | "admin";

const scopeIcons = {
  user: Users,
  team: Briefcase,
  department: Building2,
  organization: Globe,
};

const scopeLabels = {
  user: "User",
  team: "Team",
  department: "Department",
  organization: "Organization",
};

const permissionLabels = {
  view_only: "View Only",
  edit: "Can Edit",
  admin: "Admin",
};

const permissionIcons = {
  view_only: Eye,
  edit: Edit,
  admin: Shield,
};

export function ViewSharingModal({ open, onOpenChange, viewId, viewName, organizationId }: ViewSharingModalProps) {

  const [shareScope, setShareScope] = useState<ShareScope>("user");
  const [selectedId, setSelectedId] = useState<string>("");
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>("view_only");
  const [hasExpiration, setHasExpiration] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  
  const utils = trpc.useUtils();
  
  // Fetch current shares
  const { data: shares, isLoading: sharesLoading } = trpc.portfolioViews.getShares.useQuery({ viewId });
  
  // Fetch teams and departments for selection
  const { data: teams } = trpc.portfolioViews.getTeams.useQuery(
    { organizationId: organizationId || 1 },
    { enabled: !!organizationId || shareScope === "team" }
  );
  
  const { data: departments } = trpc.portfolioViews.getDepartments.useQuery(
    { organizationId: organizationId || 1 },
    { enabled: !!organizationId || shareScope === "department" }
  );
  
  // Share mutation
  const shareMutation = trpc.portfolioViews.shareView.useMutation({
    onSuccess: () => {
      toast.success("View shared successfully");
      utils.portfolioViews.getShares.invalidate({ viewId });
      setSelectedId("");
    },
    onError: (error) => {
      toast.error("Failed to share view", { description: error.message });
    },
  });
  
  // Revoke mutation
  const revokeMutation = trpc.portfolioViews.revokeShare.useMutation({
    onSuccess: () => {
      toast.success("Access revoked");
      utils.portfolioViews.getShares.invalidate({ viewId });
    },
    onError: (error) => {
      toast.error("Failed to revoke access", { description: error.message });
    },
  });
  
  const handleShare = () => {
    if (!selectedId) {
      toast.error("Please select who to share with");
      return;
    }
    
    shareMutation.mutate({
      viewId,
      sharedWithType: shareScope,
      sharedWithId: parseInt(selectedId),
      permissionLevel,
      expiresAt: hasExpiration && expirationDate ? new Date(expirationDate) : undefined,
    });
  };
  
  const handleRevoke = (sharedWithType: string, sharedWithId: number) => {
    revokeMutation.mutate({
      viewId,
      sharedWithType: sharedWithType as ShareScope,
      sharedWithId,
    });
  };
  
  const getSelectionOptions = () => {
    switch (shareScope) {
      case "team":
        return teams?.map(t => ({ id: t.id.toString(), name: t.name })) || [];
      case "department":
        return departments?.map(d => ({ id: d.id.toString(), name: d.name })) || [];
      case "organization":
        return [{ id: (organizationId || 1).toString(), name: "Entire Organization" }];
      default:
        return [];
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share View
          </DialogTitle>
          <DialogDescription>
            Share "{viewName}" with team members, departments, or your entire organization.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="share" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share">Share</TabsTrigger>
            <TabsTrigger value="access">
              Current Access
              {shares && shares.length > 0 && (
                <Badge variant="secondary" className="ml-2">{shares.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="share" className="space-y-4 mt-4">
            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Share with</Label>
              <div className="grid grid-cols-4 gap-2">
                {(["user", "team", "department", "organization"] as ShareScope[]).map((scope) => {
                  const Icon = scopeIcons[scope];
                  return (
                    <Button
                      key={scope}
                      variant={shareScope === scope ? "default" : "outline"}
                      className="flex flex-col h-auto py-3"
                      onClick={() => {
                        setShareScope(scope);
                        setSelectedId("");
                      }}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{scopeLabels[scope]}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            
            {/* Selection */}
            {shareScope === "user" ? (
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  type="number"
                  placeholder="Enter user ID"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the user ID of the person you want to share with.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select {scopeLabels[shareScope]}</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${scopeLabels[shareScope].toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {getSelectionOptions().map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Permission Level */}
            <div className="space-y-2">
              <Label>Permission Level</Label>
              <Select value={permissionLevel} onValueChange={(v) => setPermissionLevel(v as PermissionLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["view_only", "edit", "admin"] as PermissionLevel[]).map((level) => {
                    const Icon = permissionIcons[level];
                    return (
                      <SelectItem key={level} value={level}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {permissionLabels[level]}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {permissionLevel === "view_only" && "Can view the view and its assets, but cannot make changes."}
                {permissionLevel === "edit" && "Can modify filters and settings, but cannot share or delete."}
                {permissionLevel === "admin" && "Full control including sharing and deletion."}
              </p>
            </div>
            
            {/* Expiration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="expiration" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Set Expiration
                </Label>
                <Switch
                  id="expiration"
                  checked={hasExpiration}
                  onCheckedChange={setHasExpiration}
                />
              </div>
              {hasExpiration && (
                <Input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              )}
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleShare}
              disabled={!selectedId || shareMutation.isPending}
            >
              {shareMutation.isPending ? "Sharing..." : "Share View"}
            </Button>
          </TabsContent>
          
          <TabsContent value="access" className="mt-4">
            <ScrollArea className="h-[300px]">
              {sharesLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Loading...
                </div>
              ) : shares && shares.length > 0 ? (
                <div className="space-y-2">
                  {shares.map((share) => {
                    const ScopeIcon = scopeIcons[share.sharedWithType as ShareScope];
                    const PermIcon = permissionIcons[share.permissionLevel as PermissionLevel];
                    return (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-muted">
                            <ScopeIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {scopeLabels[share.sharedWithType as ShareScope]} #{share.sharedWithId}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <PermIcon className="h-3 w-3" />
                              {permissionLabels[share.permissionLevel as PermissionLevel]}
                              {share.expiresAt && (
                                <>
                                  <Separator orientation="vertical" className="h-3" />
                                  <Clock className="h-3 w-3" />
                                  Expires {new Date(share.expiresAt).toLocaleDateString()}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(share.sharedWithType, share.sharedWithId)}
                          disabled={revokeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Share2 className="h-8 w-8 mb-2 opacity-50" />
                  <p>This view hasn't been shared yet</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
