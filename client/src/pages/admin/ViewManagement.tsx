import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ViewSharingModal } from "@/components/ViewSharingModal";
import { 
  LayoutGrid, 
  Share2, 
  Eye, 
  EyeOff, 
  ArrowUpFromLine, 
  FileText, 
  BarChart3,
  Users,
  Building2,
  Briefcase,
  Globe,
  Search,
  Plus,
  Settings,
  Clock,
  TrendingUp,
  Shield,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Edit,
  Copy
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ViewScope = "user" | "team" | "department" | "organization";

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

export default function ViewManagement() {
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] = useState<number | null>(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  
  const utils = trpc.useUtils();
  
  // Fetch data
  const { data: myRole } = trpc.portfolioViews.getMyManagementRole.useQuery();
  const { data: views, isLoading: viewsLoading } = trpc.portfolioViews.list.useQuery();
  const { data: templates } = trpc.portfolioViews.getTemplates.useQuery();
  const { data: popularViews } = trpc.portfolioViews.getPopularViews.useQuery({ limit: 5 });
  const { data: sharedWithMe } = trpc.portfolioViews.getSharedWithMe.useQuery();
  const { data: pushedToMe } = trpc.portfolioViews.getPushedToMe.useQuery();
  const { data: hiddenViews } = trpc.portfolioViews.getHiddenViews.useQuery();
  
  // Mutations
  const hideViewMutation = trpc.portfolioViews.hideView.useMutation({
    onSuccess: () => {
      toast.success("View hidden successfully");
      utils.portfolioViews.getHiddenViews.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to hide view", { description: error.message });
    },
  });
  
  const unhideViewMutation = trpc.portfolioViews.unhideView.useMutation({
    onSuccess: () => {
      toast.success("View unhidden successfully");
      utils.portfolioViews.getHiddenViews.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to unhide view", { description: error.message });
    },
  });
  
  const applyTemplateMutation = trpc.portfolioViews.applyTemplate.useMutation({
    onSuccess: (data) => {
      toast.success("View created from template");
      utils.portfolioViews.list.invalidate();
      setTemplateModalOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to create view", { description: error.message });
    },
  });
  
  const filteredViews = views?.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const canManageViews = myRole?.isAdmin || myRole?.isOrgSuperuser || myRole?.isDeptSuperuser || myRole?.isTeamSuperuser || myRole?.isManager;
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">View Management</h1>
            <p className="text-muted-foreground">
              Manage, share, and organize portfolio views across your organization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setTemplateModalOpen(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create View
            </Button>
          </div>
        </div>
        
        {/* Role Badge */}
        {myRole && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {myRole.isAdmin ? "Admin" : 
               myRole.isOrgSuperuser ? "Org Superuser" :
               myRole.isDeptSuperuser ? "Dept Superuser" :
               myRole.isTeamSuperuser ? "Team Superuser" :
               myRole.isManager ? "Manager" : "User"}
            </Badge>
            {canManageViews && (
              <span className="text-sm text-muted-foreground">
                You can push and manage views for your scope
              </span>
            )}
          </div>
        )}
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">My Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{views?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Shared With Me</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sharedWithMe?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pushed Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pushedToMe?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hidden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hiddenViews?.length || 0}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Main Content */}
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Views</TabsTrigger>
              <TabsTrigger value="shared">Shared With Me</TabsTrigger>
              <TabsTrigger value="pushed">Pushed Views</TabsTrigger>
              <TabsTrigger value="hidden">Hidden</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search views..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[250px]"
              />
            </div>
          </div>
          
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Views</CardTitle>
                <CardDescription>Views you've created or have access to</CardDescription>
              </CardHeader>
              <CardContent>
                {viewsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredViews && filteredViews.length > 0 ? (
                  <div className="space-y-2">
                    {filteredViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <LayoutGrid className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{view.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {view.description || "No description"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={view.viewType === "dynamic" ? "default" : "secondary"}>
                            {view.viewType}
                          </Badge>
                          {view.isPublic && (
                            <Badge variant="outline">
                              <Globe className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedView(view.id);
                                setSharingModalOpen(true);
                              }}>
                                <Share2 className="h-4 w-4 mr-2" />
                                Share
                              </DropdownMenuItem>
                              {canManageViews && (
                                <DropdownMenuItem onClick={() => {
                                  setSelectedView(view.id);
                                  setPushModalOpen(true);
                                }}>
                                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                                  Push to Team
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  hideViewMutation.mutate({
                                    viewId: view.id,
                                    targetScope: "user",
                                    targetScopeId: user?.id || 0,
                                  });
                                }}
                              >
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <LayoutGrid className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No views found</p>
                    <Button variant="outline" className="mt-4" onClick={() => setTemplateModalOpen(true)}>
                      Create from Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="shared">
            <Card>
              <CardHeader>
                <CardTitle>Shared With Me</CardTitle>
                <CardDescription>Views that others have shared with you</CardDescription>
              </CardHeader>
              <CardContent>
                {sharedWithMe && sharedWithMe.length > 0 ? (
                  <div className="space-y-2">
                    {sharedWithMe.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <Share2 className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <div className="font-medium">View #{share.viewId}</div>
                            <div className="text-sm text-muted-foreground">
                              Shared by User #{share.sharedBy} • {share.permissionLevel.replace("_", " ")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {share.expiresAt && (
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              Expires {new Date(share.expiresAt).toLocaleDateString()}
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">
                            Open
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No views have been shared with you yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="pushed">
            <Card>
              <CardHeader>
                <CardTitle>Pushed Views</CardTitle>
                <CardDescription>Views pushed to you by managers or administrators</CardDescription>
              </CardHeader>
              <CardContent>
                {pushedToMe && pushedToMe.length > 0 ? (
                  <div className="space-y-2">
                    {pushedToMe.map((push) => (
                      <div
                        key={push.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-orange-500/10">
                            <ArrowUpFromLine className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              View #{push.viewId}
                              {push.isRequired && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                              {push.isPinned && (
                                <Badge variant="secondary" className="text-xs">Pinned</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Pushed by {push.pushedByRole.replace("_", " ")}
                              {push.pushMessage && ` • "${push.pushMessage}"`}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Open
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ArrowUpFromLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No views have been pushed to you</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="hidden">
            <Card>
              <CardHeader>
                <CardTitle>Hidden Views</CardTitle>
                <CardDescription>Views you've hidden from your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                {hiddenViews && hiddenViews.length > 0 ? (
                  <div className="space-y-2">
                    {hiddenViews.map((hidden) => (
                      <div
                        key={hidden.id}
                        className="flex items-center justify-between p-4 rounded-lg border opacity-60"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-muted">
                            <EyeOff className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">View #{hidden.viewId}</div>
                            <div className="text-sm text-muted-foreground">
                              {hidden.reason || "No reason provided"}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            unhideViewMutation.mutate({
                              viewId: hidden.viewId,
                              targetScope: hidden.targetScope as ViewScope,
                              targetScopeId: hidden.targetScopeId,
                            });
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Unhide
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hidden views</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>View Analytics</CardTitle>
                <CardDescription>Most popular views in your organization</CardDescription>
              </CardHeader>
              <CardContent>
                {popularViews && popularViews.length > 0 ? (
                  <div className="space-y-4">
                    {popularViews.map((view, index) => (
                      <div
                        key={view.viewId}
                        className="flex items-center gap-4"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">View #{view.viewId}</div>
                          <div className="text-sm text-muted-foreground">
                            {view.accessCount} views in the last 30 days
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm">{view.uniqueUsers} users</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No analytics data available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Sharing Modal */}
      {selectedView && (
        <ViewSharingModal
          open={sharingModalOpen}
          onOpenChange={setSharingModalOpen}
          viewId={selectedView}
          viewName={views?.find(v => v.id === selectedView)?.name || "View"}
        />
      )}
      
      {/* Push Modal */}
      <PushViewModal
        open={pushModalOpen}
        onOpenChange={setPushModalOpen}
        viewId={selectedView}
        viewName={views?.find(v => v.id === selectedView)?.name || "View"}
        myRole={myRole}
      />
      
      {/* Template Modal */}
      <TemplateModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        templates={templates || []}
        onApply={(templateId, name) => {
          applyTemplateMutation.mutate({ templateId, viewName: name });
        }}
        isApplying={applyTemplateMutation.isPending}
      />
    </DashboardLayout>
  );
}

// Push View Modal Component
function PushViewModal({ 
  open, 
  onOpenChange, 
  viewId, 
  viewName,
  myRole 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  viewId: number | null;
  viewName: string;
  myRole?: {
    isAdmin: boolean;
    isOrgSuperuser: boolean;
    isDeptSuperuser: boolean;
    isTeamSuperuser: boolean;
    isManager: boolean;
    teamIds: number[];
    departmentIds: number[];
  };
}) {

  const [targetScope, setTargetScope] = useState<ViewScope>("team");
  const [targetId, setTargetId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  
  const utils = trpc.useUtils();
  
  const pushMutation = trpc.portfolioViews.pushView.useMutation({
    onSuccess: () => {
      toast.success("View pushed successfully");
      utils.portfolioViews.getPushedToMe.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to push view", { description: error.message });
    },
  });
  
  const availableScopes: ViewScope[] = [];
  if (myRole?.isAdmin || myRole?.isOrgSuperuser) {
    availableScopes.push("organization", "department", "team", "user");
  } else if (myRole?.isDeptSuperuser) {
    availableScopes.push("department", "team", "user");
  } else if (myRole?.isTeamSuperuser) {
    availableScopes.push("team", "user");
  } else if (myRole?.isManager) {
    availableScopes.push("user");
  }
  
  const handlePush = () => {
    if (!viewId || !targetId) return;
    
    pushMutation.mutate({
      viewId,
      targetScope,
      targetScopeId: parseInt(targetId),
      isPinned,
      isRequired,
      pushMessage: pushMessage || undefined,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5" />
            Push View
          </DialogTitle>
          <DialogDescription>
            Push "{viewName}" to team members or departments. They will see this view in their workspace.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Push to</Label>
            <Select value={targetScope} onValueChange={(v) => setTargetScope(v as ViewScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableScopes.map((scope) => {
                  const Icon = scopeIcons[scope];
                  return (
                    <SelectItem key={scope} value={scope}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {scopeLabels[scope]}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>{scopeLabels[targetScope]} ID</Label>
            <Input
              type="number"
              placeholder={`Enter ${scopeLabels[targetScope].toLowerCase()} ID`}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Add a message explaining why this view is being pushed..."
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="pinned">Pin to top</Label>
              <p className="text-xs text-muted-foreground">Show this view at the top of the list</p>
            </div>
            <Switch id="pinned" checked={isPinned} onCheckedChange={setIsPinned} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="required">Mark as required</Label>
              <p className="text-xs text-muted-foreground">Users cannot hide this view</p>
            </div>
            <Switch id="required" checked={isRequired} onCheckedChange={setIsRequired} />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handlePush} disabled={!targetId || pushMutation.isPending}>
            {pushMutation.isPending ? "Pushing..." : "Push View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Template Modal Component
function TemplateModal({
  open,
  onOpenChange,
  templates,
  onApply,
  isApplying,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: Array<{
    id: number;
    name: string;
    description?: string | null;
    category: string;
    isSystem: boolean;
  }>;
  onApply: (templateId: number, name: string) => void;
  isApplying: boolean;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [viewName, setViewName] = useState("");
  
  const categories = Array.from(new Set(templates.map(t => t.category)));
  
  const handleApply = () => {
    if (!selectedTemplate || !viewName) return;
    onApply(selectedTemplate, viewName);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            View Templates
          </DialogTitle>
          <DialogDescription>
            Start with a pre-built template for common workflows
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {categories.map((category) => (
              <div key={category}>
                <h3 className="font-semibold mb-3 capitalize">{category.replace("_", " ")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {templates
                    .filter(t => t.category === category)
                    .map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          selectedTemplate === template.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => {
                          setSelectedTemplate(template.id);
                          setViewName(template.name);
                        }}
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">
                          {template.description}
                        </div>
                        {template.isSystem && (
                          <Badge variant="secondary" className="mt-2 text-xs">System</Badge>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {selectedTemplate && (
          <div className="space-y-2 pt-4 border-t">
            <Label>View Name</Label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Enter a name for your new view"
            />
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleApply} 
            disabled={!selectedTemplate || !viewName || isApplying}
          >
            {isApplying ? "Creating..." : "Create View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
