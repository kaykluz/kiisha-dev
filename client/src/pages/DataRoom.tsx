import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FileText, 
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ChevronDown,
  Building2,
  Calendar,
  FileCheck,
  Eye,
  Download,
  Lock,
  Unlock,
  Bell,
  RefreshCw,
  ExternalLink,
  Loader2,
  Info
} from "lucide-react";

interface SharedSubmission {
  id: number;
  responseId: number;
  recipientType: string;
  recipientName: string;
  recipientEmail?: string;
  shareMethod: string;
  accessToken: string;
  status: string;
  snapshotData: any;
  snapshotVersion: number;
  sharedAt: string;
  expiresAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
}

interface UpdateNotification {
  id: number;
  sharedSubmissionId: number;
  fieldName: string;
  oldValue: string;
  newValue: string;
  status: string;
  pushedAt: string;
  respondedAt?: string;
  responseNotes?: string;
}

export default function DataRoom() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [selectedSubmission, setSelectedSubmission] = useState<number | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateNotification | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  
  // Fetch shared submission by access token
  const { data: sharedData, isLoading, refetch } = trpc.diligence.getDataRoomByToken.useQuery(
    { accessToken: token || "" },
    { enabled: !!token }
  );
  
  // Fetch update notifications
  const { data: updateNotifications, refetch: refetchUpdates } = trpc.diligence.getUpdateNotifications.useQuery(
    { sharedSubmissionId: sharedData?.id || 0 },
    { enabled: !!sharedData?.id }
  );
  
  // Respond to update mutation
  const respondToUpdateMutation = trpc.diligence.respondToUpdatePush.useMutation({
    onSuccess: () => {
      toast.success("Response recorded");
      setShowUpdateDialog(false);
      setSelectedUpdate(null);
      setResponseNotes("");
      refetch();
      refetchUpdates();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Mark as viewed on load
  useEffect(() => {
    if (sharedData && !sharedData.viewedAt) {
      // Could add a mutation to mark as viewed
    }
  }, [sharedData]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading data room...</p>
        </div>
      </div>
    );
  }
  
  if (!sharedData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This data room link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact the sender for a new access link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const snapshot = sharedData.snapshotData as any;
  const pendingUpdates = updateNotifications?.filter(u => u.status === "pending") || [];
  
  // Group submissions by category (from snapshot)
  const submissionsByCategory = (snapshot?.submissions || []).reduce((acc: any, sub: any) => {
    const category = sub.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(sub);
    return acc;
  }, {} as Record<string, any[]>);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Secure Data Room</h1>
                <p className="text-sm text-muted-foreground">
                  Shared by {sharedData.recipientName || "Organization"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                Snapshot v{sharedData.snapshotVersion}
              </Badge>
              {pendingUpdates.length > 0 && (
                <Badge className="bg-yellow-500 gap-1">
                  <Bell className="h-3 w-3" />
                  {pendingUpdates.length} Update{pendingUpdates.length > 1 ? "s" : ""} Pending
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Response Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Response Overview Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{snapshot?.response?.name || "Diligence Response"}</CardTitle>
                    <CardDescription>
                      Shared on {new Date(sharedData.sharedAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {snapshot?.response?.status || "Approved"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{snapshot?.response?.completionPercentage || 100}%</span>
                </div>
                <Progress value={snapshot?.response?.completionPercentage || 100} className="h-2" />
                
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span>{snapshot?.response?.submittedAt ? new Date(snapshot.response.submittedAt).toLocaleDateString() : "N/A"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Reviewed:</span>
                    <span>{snapshot?.response?.reviewedAt ? new Date(snapshot.response.reviewedAt).toLocaleDateString() : "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Pending Updates Alert */}
            {pendingUpdates.length > 0 && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-5 w-5 text-yellow-500" />
                    Pending Updates
                  </CardTitle>
                  <CardDescription>
                    The sender has pushed updates to this submission. Please review and accept or reject.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingUpdates.map((update) => (
                      <div 
                        key={update.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-card"
                      >
                        <div>
                          <p className="font-medium">{update.fieldName}</p>
                          <p className="text-sm text-muted-foreground">
                            <span className="line-through">{update.oldValue || "(empty)"}</span>
                            {" → "}
                            <span className="text-foreground">{update.newValue}</span>
                          </p>
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => {
                            setSelectedUpdate(update);
                            setShowUpdateDialog(true);
                          }}
                        >
                          Review
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Documents List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Submitted Documents</CardTitle>
                <CardDescription>
                  All documents in this submission are locked at the time of sharing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {Object.entries(submissionsByCategory).length > 0 ? (
                      Object.entries(submissionsByCategory).map(([category, submissions]) => (
                        <Collapsible key={category} defaultOpen>
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-muted/50">
                            <div className="flex items-center gap-2">
                              <ChevronDown className="h-4 w-4" />
                              <span className="font-medium capitalize">{category.replace(/_/g, " ")}</span>
                            </div>
                            <Badge variant="secondary">{(submissions as any[]).length}</Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 pl-6">
                            <div className="space-y-2">
                              {(submissions as any[]).map((sub) => (
                                <div 
                                  key={sub.id}
                                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                    selectedSubmission === sub.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                                  }`}
                                  onClick={() => setSelectedSubmission(sub.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="font-medium">{sub.fileName || `Document ${sub.id}`}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {sub.uploadedAt ? new Date(sub.uploadedAt).toLocaleDateString() : "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={sub.status === "uploaded" ? "default" : "secondary"}>
                                      {sub.status}
                                    </Badge>
                                    {sub.documentUrl && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(sub.documentUrl, "_blank");
                                        }}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No documents in this submission</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Access Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Access Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Recipient</Label>
                  <p className="font-medium">{sharedData.recipientName}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Recipient Type</Label>
                  <Badge variant="outline" className="capitalize">
                    {sharedData.recipientType}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Share Method</Label>
                  <p className="capitalize">{sharedData.shareMethod.replace(/_/g, " ")}</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Shared At</Label>
                  <p>{new Date(sharedData.sharedAt).toLocaleString()}</p>
                </div>
                {sharedData.expiresAt && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Expires At</Label>
                    <p>{new Date(sharedData.expiresAt).toLocaleString()}</p>
                  </div>
                )}
                {sharedData.viewedAt && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">First Viewed</Label>
                    <p>{new Date(sharedData.viewedAt).toLocaleString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Security Notice */}
            <Card className="border-blue-500/50 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Security Notice
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  This data room contains a locked snapshot of the submission at the time of sharing.
                </p>
                <p>
                  Any updates from the sender will be shown as pending notifications that require your approval.
                </p>
                <p>
                  All access is logged for audit purposes.
                </p>
              </CardContent>
            </Card>
            
            {/* Update History */}
            {updateNotifications && updateNotifications.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Update History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {updateNotifications.map((update) => (
                        <div key={update.id} className="p-3 border rounded-lg text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{update.fieldName}</span>
                            <Badge variant={
                              update.status === "accepted" ? "default" :
                              update.status === "rejected" ? "destructive" :
                              "secondary"
                            }>
                              {update.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {new Date(update.pushedAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      {/* Update Review Dialog */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Update</DialogTitle>
            <DialogDescription>
              The sender has pushed an update to this field. Please review and accept or reject.
            </DialogDescription>
          </DialogHeader>
          {selectedUpdate && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Field</Label>
                <p className="font-medium">{selectedUpdate.fieldName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Previous Value</Label>
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <p className="line-through">{selectedUpdate.oldValue || "(empty)"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">New Value</Label>
                  <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                    <p>{selectedUpdate.newValue}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea 
                  placeholder="Add any notes about your decision..."
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowUpdateDialog(false);
                setSelectedUpdate(null);
                setResponseNotes("");
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (selectedUpdate) {
                  respondToUpdateMutation.mutate({
                    notificationId: selectedUpdate.id,
                    accepted: false,
                    notes: responseNotes || undefined
                  });
                }
              }}
              disabled={respondToUpdateMutation.isPending}
            >
              {respondToUpdateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
            <Button 
              onClick={() => {
                if (selectedUpdate) {
                  respondToUpdateMutation.mutate({
                    notificationId: selectedUpdate.id,
                    accepted: true,
                    notes: responseNotes || undefined
                  });
                }
              }}
              disabled={respondToUpdateMutation.isPending}
            >
              {respondToUpdateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Accept Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
