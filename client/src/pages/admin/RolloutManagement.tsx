import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Plus, Play, Check, X, Clock, AlertTriangle, Users,
  GitBranch, Send, Eye, FileText, RefreshCw
} from "lucide-react";

export default function RolloutManagement() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("pending");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [selectedRollout, setSelectedRollout] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Create rollout form state
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [rolloutMode, setRolloutMode] = useState<"force" | "safe" | "opt_in">("safe");
  const [scope, setScope] = useState<"org_wide" | "selected_workspaces" | "selected_instances">("org_wide");
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  
  const { data: templates } = trpc.versionedViews.templates.list.useQuery();
  const { data: rollouts, refetch: refetchRollouts } = trpc.versionedViews.rollouts.list.useQuery({
    status: selectedTab === "all" ? undefined : selectedTab,
  });
  const { data: instances } = trpc.versionedViews.instances.list.useQuery();
  
  const createMutation = trpc.versionedViews.rollouts.create.useMutation({
    onSuccess: () => {
      toast.success("Rollout created successfully");
      setShowCreateDialog(false);
      resetCreateForm();
      refetchRollouts();
    },
    onError: (error) => {
      toast.error(`Failed to create rollout: ${error.message}`);
    },
  });
  
  const approveMutation = trpc.versionedViews.rollouts.approve.useMutation({
    onSuccess: () => {
      toast.success("Rollout approved");
      setShowApproveDialog(false);
      setApprovalNotes("");
      refetchRollouts();
    },
    onError: (error) => {
      toast.error(`Failed to approve rollout: ${error.message}`);
    },
  });
  
  const rejectMutation = trpc.versionedViews.rollouts.reject.useMutation({
    onSuccess: () => {
      toast.success("Rollout rejected");
      setShowApproveDialog(false);
      setRejectionReason("");
      refetchRollouts();
    },
    onError: (error) => {
      toast.error(`Failed to reject rollout: ${error.message}`);
    },
  });
  
  const executeMutation = trpc.versionedViews.rollouts.execute.useMutation({
    onSuccess: () => {
      toast.success("Rollout executed successfully");
      refetchRollouts();
    },
    onError: (error) => {
      toast.error(`Failed to execute rollout: ${error.message}`);
    },
  });
  
  const resetCreateForm = () => {
    setSelectedTemplateId("");
    setSelectedVersionId("");
    setRolloutMode("safe");
    setScope("org_wide");
    setSelectedWorkspaces([]);
    setSelectedInstances([]);
  };
  
  const handleCreateRollout = () => {
    if (!selectedTemplateId || !selectedVersionId) {
      toast.error("Please select a template and version");
      return;
    }
    
    createMutation.mutate({
      templateId: selectedTemplateId,
      toVersionId: selectedVersionId,
      rolloutMode,
      scope,
      scopeWorkspaceIds: scope === "selected_workspaces" ? selectedWorkspaces : undefined,
      scopeInstanceIds: scope === "selected_instances" ? selectedInstances : undefined,
    });
  };
  
  const selectedTemplate = templates?.find((t: { id: string }) => t.id === selectedTemplateId);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_approval":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending Approval</Badge>;
      case "approved":
        return <Badge variant="default"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "executing":
        return <Badge variant="default" className="animate-pulse"><RefreshCw className="h-3 w-3 mr-1" />Executing</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-green-600"><Check className="h-3 w-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getRolloutModeBadge = (mode: string) => {
    switch (mode) {
      case "force":
        return <Badge variant="destructive">Force</Badge>;
      case "safe":
        return <Badge variant="secondary">Safe</Badge>;
      case "opt_in":
        return <Badge variant="outline">Opt-in</Badge>;
      default:
        return <Badge variant="outline">{mode}</Badge>;
    }
  };
  
  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Rollout Management</h1>
            <p className="text-muted-foreground">
              Manage view template updates and rollouts to managed instances
            </p>
          </div>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Create Rollout
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Rollout</DialogTitle>
                <DialogDescription>
                  Push a template version update to managed instances
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Template Selection */}
                <div className="space-y-2">
                  <Label>Select Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((template: { id: string; name: string; category: string | null }) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.category || "uncategorized"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Version Selection */}
                {selectedTemplate && (
                  <div className="space-y-2">
                    <Label>Target Version</Label>
                    <Select value={selectedVersionId} onValueChange={setSelectedVersionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose version..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedTemplate as any).versions?.map((version: { id: string; versionNumber: number; changelog: string | null }) => (
                          <SelectItem key={version.id} value={version.id}>
                            v{version.versionNumber} - {version.changelog || "No changelog"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Rollout Mode */}
                <div className="space-y-2">
                  <Label>Rollout Mode</Label>
                  <Select value={rolloutMode} onValueChange={(v: "force" | "safe" | "opt_in") => setRolloutMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="force">
                        Force - Apply immediately, overwrite local changes
                      </SelectItem>
                      <SelectItem value="safe">
                        Safe - Skip instances with local edits (create conflicts)
                      </SelectItem>
                      <SelectItem value="opt_in">
                        Opt-in - Notify users, let them choose to apply
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Scope Selection */}
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={scope} onValueChange={(v: "org_wide" | "selected_workspaces" | "selected_instances") => setScope(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org_wide">Organization-wide</SelectItem>
                      <SelectItem value="selected_workspaces">Selected Workspaces</SelectItem>
                      <SelectItem value="selected_instances">Selected Instances</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Instance Selection (if scope is selected_instances) */}
                {scope === "selected_instances" && instances && instances.length > 0 && (
                  <div className="space-y-2">
                    <Label>Select Instances</Label>
                    <ScrollArea className="h-32 rounded border p-2">
                      {instances
                        .filter((i: { sourceTemplateId: string | null }) => i.sourceTemplateId === selectedTemplateId)
                        .map((instance: { id: string; name: string; ownerUserId: number }) => (
                          <div key={instance.id} className="flex items-center gap-2 py-1">
                            <Checkbox
                              checked={selectedInstances.includes(instance.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedInstances([...selectedInstances, instance.id]);
                                } else {
                                  setSelectedInstances(selectedInstances.filter(id => id !== instance.id));
                                }
                              }}
                            />
                            <span className="text-sm">{instance.name}</span>
                          </div>
                        ))}
                    </ScrollArea>
                  </div>
                )}
                
                {user?.role !== "admin" && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    This rollout will require admin approval before execution.
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateRollout}
                  disabled={!selectedTemplateId || !selectedVersionId || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Rollout"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Rollouts Table */}
        <Card>
          <CardHeader>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList>
                <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>
                <TabsTrigger value="approved">Ready to Execute</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollouts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No rollouts found
                    </TableCell>
                  </TableRow>
                ) : (
                  rollouts?.map((rollout: any) => {
                    const versionNum = rollout.toVersionNumber || rollout.toVersion?.versionNumber || 0;
                    return (
                    <TableRow key={rollout.id}>
                      <TableCell className="font-medium">
                        {templates?.find((t: { id: string }) => t.id === rollout.templateId)?.name || rollout.templateId}
                      </TableCell>
                      <TableCell>v{versionNum}</TableCell>
                      <TableCell>{getRolloutModeBadge(rollout.rolloutMode)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Users className="h-3 w-3" />
                          {rollout.scope.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(rollout.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(rollout.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {rollout.status === "pending_approval" && user?.role === "admin" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedRollout(rollout.id);
                                  setShowApproveDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {rollout.status === "approved" && (
                            <Button
                              size="sm"
                              onClick={() => executeMutation.mutate({ rolloutId: rollout.id })}
                              disabled={executeMutation.isPending}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Execute
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Approval Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review Rollout</DialogTitle>
              <DialogDescription>
                Approve or reject this rollout request
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Approval Notes (optional)</Label>
                <Textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes for the requester..."
                  rows={2}
                />
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this rollout is being rejected..."
                  rows={2}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedRollout) {
                    rejectMutation.mutate({
                      rolloutId: selectedRollout,
                      rejectionReason,
                    });
                  }
                }}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  if (selectedRollout) {
                    approveMutation.mutate({
                      rolloutId: selectedRollout,
                      approvalNotes,
                    });
                  }
                }}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
