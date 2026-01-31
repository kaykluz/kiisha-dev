import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, FileText, Send, Clock, CheckCircle, AlertCircle, Users, Eye, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

export default function RequestsDashboard() {
  
  const [activeTab, setActiveTab] = useState<"issued" | "incoming">("issued");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRequest, setNewRequest] = useState({
    title: "",
    instructions: "",
    deadlineAt: "",
    templateId: undefined as number | undefined,
  });

  // Queries
  const { data: issuedRequests = [], refetch: refetchIssued } = trpc.requests.list.useQuery({ type: "issued" });
  const { data: incomingRequests = [], refetch: refetchIncoming } = trpc.requests.list.useQuery({ type: "incoming" });
  const { data: templates = [] } = trpc.requests.templates.list.useQuery();

  // Mutations
  const createRequest = trpc.requests.create.useMutation({
    onSuccess: () => {
      toast.success("Request created - Your request has been created as a draft.");
      setShowCreateDialog(false);
      setNewRequest({ title: "", instructions: "", deadlineAt: "", templateId: undefined });
      refetchIssued();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const issueRequest = trpc.requests.issue.useMutation({
    onSuccess: () => {
      toast.success("Request issued - Recipients have been notified.");
      refetchIssued();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreateRequest = () => {
    if (!newRequest.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createRequest.mutate({
      title: newRequest.title,
      instructions: newRequest.instructions || undefined,
      deadlineAt: newRequest.deadlineAt ? new Date(newRequest.deadlineAt) : undefined,
      templateId: newRequest.templateId,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
      case "issued":
        return <Badge variant="default" className="bg-blue-500"><Send className="h-3 w-3 mr-1" />Issued</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-amber-500"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const requests = activeTab === "issued" ? issuedRequests : incomingRequests;

  // Stats
  const stats = {
    total: issuedRequests.length,
    draft: issuedRequests.filter((r: any) => r.status === "draft").length,
    issued: issuedRequests.filter((r: any) => r.status === "issued").length,
    completed: issuedRequests.filter((r: any) => r.status === "completed").length,
    incoming: incomingRequests.length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Requests</h1>
            <p className="text-muted-foreground">Manage RFIs, data requests, and submissions</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Request</DialogTitle>
                <DialogDescription>
                  Create a new data request to send to recipients.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Q4 2025 Financial Data Request"
                    value={newRequest.title}
                    onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template (optional)</Label>
                  <Select
                    value={newRequest.templateId?.toString() || ""}
                    onValueChange={(v) => setNewRequest({ ...newRequest, templateId: v ? parseInt(v) : undefined })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t: any) => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    placeholder="Provide any specific instructions for recipients..."
                    value={newRequest.instructions}
                    onChange={(e) => setNewRequest({ ...newRequest, instructions: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (optional)</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={newRequest.deadlineAt}
                    onChange={(e) => setNewRequest({ ...newRequest, deadlineAt: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRequest} disabled={createRequest.isPending}>
                  {createRequest.isPending ? "Creating..." : "Create Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Issued</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Drafts</CardDescription>
              <CardTitle className="text-2xl">{stats.draft}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-2xl">{stats.issued}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-2xl">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Incoming</CardDescription>
              <CardTitle className="text-2xl">{stats.incoming}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "issued" | "incoming")}>
          <TabsList>
            <TabsTrigger value="issued">
              <Send className="h-4 w-4 mr-2" />
              Issued by Me
            </TabsTrigger>
            <TabsTrigger value="incoming">
              <FileText className="h-4 w-4 mr-2" />
              Incoming Requests
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issued" className="mt-4">
            {issuedRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No requests yet</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first request to start collecting data from recipients.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Request
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {issuedRequests.map((request: any) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/requests/${request.id}`}>
                              <span className="font-medium hover:underline cursor-pointer">{request.title}</span>
                            </Link>
                            {getStatusBadge(request.status)}
                          </div>
                          {request.instructions && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{request.instructions}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Created {new Date(request.createdAt).toLocaleDateString()}</span>
                            {request.deadlineAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Due {new Date(request.deadlineAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {request.status === "draft" && (
                            <Button
                              size="sm"
                              onClick={() => issueRequest.mutate({ requestId: request.id })}
                              disabled={issueRequest.isPending}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Issue
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/requests/${request.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/requests/${request.id}/recipients`}>
                                  <Users className="h-4 w-4 mr-2" />
                                  Manage Recipients
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="incoming" className="mt-4">
            {incomingRequests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No incoming requests</h3>
                  <p className="text-muted-foreground text-center">
                    You haven't received any data requests yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((request: any) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link href={`/requests/${request.id}/respond`}>
                              <span className="font-medium hover:underline cursor-pointer">{request.title}</span>
                            </Link>
                            {getStatusBadge(request.status)}
                          </div>
                          {request.instructions && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{request.instructions}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Received {new Date(request.createdAt).toLocaleDateString()}</span>
                            {request.deadlineAt && (
                              <span className="flex items-center gap-1 text-amber-500">
                                <Clock className="h-3 w-3" />
                                Due {new Date(request.deadlineAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button asChild>
                          <Link href={`/requests/${request.id}/respond`}>
                            Respond
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
