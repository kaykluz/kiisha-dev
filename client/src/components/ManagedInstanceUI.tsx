import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  AlertTriangle, Check, X, GitBranch, GitMerge, GitFork,
  RefreshCw, Clock, ArrowRight, Info
} from "lucide-react";

interface ManagedInstanceUIProps {
  instanceId: string;
  onUpdate?: () => void;
}

export function ManagedInstanceUI({ instanceId, onUpdate }: ManagedInstanceUIProps) {
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  
  const { data: instance, isLoading, refetch } = trpc.versionedViews.instances.get.useQuery(
    { instanceId }
  );
  
  const { data: pendingUpdates } = trpc.versionedViews.instances.pendingUpdates.useQuery();
  
  const acceptMutation = trpc.versionedViews.updates.accept.useMutation({
    onSuccess: () => {
      toast.success("Update applied successfully");
      refetch();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(`Failed to apply update: ${error.message}`);
    },
  });
  
  const rejectMutation = trpc.versionedViews.updates.reject.useMutation({
    onSuccess: () => {
      toast.success("Update rejected");
      refetch();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(`Failed to reject update: ${error.message}`);
    },
  });
  
  const resolveConflictMutation = trpc.versionedViews.updates.resolveConflict.useMutation({
    onSuccess: () => {
      toast.success("Conflict resolved");
      setShowConflictDialog(false);
      setSelectedReceipt(null);
      refetch();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(`Failed to resolve conflict: ${error.message}`);
    },
  });
  
  const forkMutation = trpc.versionedViews.instances.fork.useMutation({
    onSuccess: () => {
      toast.success("Instance forked - now independent");
      refetch();
      onUpdate?.();
    },
    onError: (error) => {
      toast.error(`Failed to fork instance: ${error.message}`);
    },
  });
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!instance) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Instance not found</p>
        </CardContent>
      </Card>
    );
  }
  
  const instancePendingUpdates = (pendingUpdates as any[])?.filter(
    (u: any) => u.instance?.id === instanceId || u.instanceId === instanceId
  ) || [];
  
  const hasConflicts = instancePendingUpdates.some(
    (u: any) => (u.receipt?.status || u.status) === "conflict"
  );
  const hasPendingOptIn = instancePendingUpdates.some(
    (u: any) => (u.receipt?.status || u.status) === "pending"
  );
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {instance.name}
              {instance.updateMode === "managed" ? (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <GitMerge className="h-3 w-3" />
                  Managed
                </Badge>
              ) : (
                <Badge variant="outline" className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  Independent
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {instance.sourceTemplateId ? (
                <>Based on template • Synced to v{(instance as any).syncedVersionNumber || 1}</>
              ) : (
                "Custom view instance"
              )}
            </CardDescription>
          </div>
          
          {instance.updateMode === "managed" && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => forkMutation.mutate({ instanceId })}
              disabled={forkMutation.isPending}
            >
              <GitFork className="h-4 w-4 mr-1" />
              Fork to Independent
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Update Notifications */}
        {hasConflicts && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Conflict Detected</AlertTitle>
            <AlertDescription>
              Your local changes conflict with a template update. Please resolve the conflict to continue receiving updates.
            </AlertDescription>
          </Alert>
        )}
        
        {hasPendingOptIn && !hasConflicts && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Update Available</AlertTitle>
            <AlertDescription>
              A new version of the template is available. Review and apply the update when ready.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Pending Updates List */}
        {instancePendingUpdates.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Pending Updates
            </h4>
            <ScrollArea className="h-48 rounded border">
              <div className="p-3 space-y-3">
                {instancePendingUpdates.map((update: any) => {
                const updateId = update.receipt?.id || update.id;
                const updateStatus = update.receipt?.status || update.status;
                const versionNum = update.newVersion?.versionNumber || update.toVersionNumber || 0;
                const changelogText = update.newVersion?.changelog || update.changelog;
                const createdDate = update.receipt?.createdAt || update.createdAt || new Date();
                
                return (
                  <div 
                    key={updateId} 
                    className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          updateStatus === "conflict" ? "destructive" :
                          updateStatus === "pending" ? "default" :
                          "secondary"
                        }>
                          {updateStatus}
                        </Badge>
                        <span className="text-sm font-medium">
                          v{versionNum}
                        </span>
                      </div>
                      {changelogText && (
                        <p className="text-sm text-muted-foreground">
                          {changelogText}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(createdDate).toLocaleString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      {updateStatus === "conflict" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedReceipt(updateId);
                            setShowConflictDialog(true);
                          }}
                        >
                          Resolve
                        </Button>
                      ) : updateStatus === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectMutation.mutate({ receiptId: updateId })}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => acceptMutation.mutate({ receiptId: updateId })}
                            disabled={acceptMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Apply
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              </div>
            </ScrollArea>
          </div>
        )}
        
        <Separator />
        
        {/* Instance Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Update Mode:</span>
            <span className="ml-2 font-medium">{instance.updateMode}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Has Local Edits:</span>
            <span className="ml-2 font-medium">
              {instance.hasLocalEdits ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Created:</span>
            <span className="ml-2 font-medium">
              {new Date(instance.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Last Updated:</span>
            <span className="ml-2 font-medium">
              {new Date(instance.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        
        {instance.localEditsSummary && (
          <div className="text-sm">
            <span className="text-muted-foreground">Local Changes:</span>
            <p className="mt-1 p-2 rounded bg-muted text-muted-foreground">
              {instance.localEditsSummary}
            </p>
          </div>
        )}
      </CardContent>
      
      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>
              Your local changes conflict with the template update. Choose how to resolve:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => selectedReceipt && resolveConflictMutation.mutate({
                receiptId: selectedReceipt,
                resolution: "keep_local",
              })}
              disabled={resolveConflictMutation.isPending}
            >
              <div className="text-left">
                <div className="font-medium flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Keep Local Changes
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Discard the template update and keep your current configuration
                </p>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => selectedReceipt && resolveConflictMutation.mutate({
                receiptId: selectedReceipt,
                resolution: "apply_new",
              })}
              disabled={resolveConflictMutation.isPending}
            >
              <div className="text-left">
                <div className="font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Apply Template Update
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Replace your local changes with the new template version
                </p>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => selectedReceipt && resolveConflictMutation.mutate({
                receiptId: selectedReceipt,
                resolution: "fork",
              })}
              disabled={resolveConflictMutation.isPending}
            >
              <div className="text-left">
                <div className="font-medium flex items-center gap-2">
                  <GitFork className="h-4 w-4" />
                  Fork to Independent
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep your changes and disconnect from template updates
                </p>
              </div>
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConflictDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ManagedInstanceUI;
