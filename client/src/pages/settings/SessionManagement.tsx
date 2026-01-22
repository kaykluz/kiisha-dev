/**
 * Phase 37: Session Management Page
 * 
 * Allows users to view and manage their active sessions:
 * - List all active sessions with device info
 * - Show current session indicator
 * - Revoke individual sessions
 * - Revoke all other sessions
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Globe, 
  Clock, 
  Loader2, 
  LogOut, 
  Shield,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function getDeviceIcon(deviceType: string | null) {
  if (!deviceType) return Monitor;
  const dt = deviceType.toLowerCase();
  if (dt.includes("mobile") || dt.includes("phone")) {
    return Smartphone;
  }
  if (dt.includes("tablet")) {
    return Tablet;
  }
  return Monitor;
}

export default function SessionManagement() {
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.authSession.getSessions.useQuery();
  
  const revokeSessionMutation = trpc.authSession.revokeSession.useMutation({
    onSuccess: () => {
      toast.success("Session revoked successfully");
      utils.authSession.getSessions.invalidate();
      setSessionToRevoke(null);
    },
    onError: (error) => {
      toast.error("Failed to revoke session", { description: error.message });
    },
  });

  const revokeAllMutation = trpc.authSession.logoutAll.useMutation({
    onSuccess: (result) => {
      toast.success(`Revoked ${result.revokedCount} session(s)`);
      utils.authSession.getSessions.invalidate();
      setShowRevokeAllDialog(false);
    },
    onError: (error) => {
      toast.error("Failed to revoke sessions", { description: error.message });
    },
  });

  const handleRevokeSession = (sessionId: string) => {
    revokeSessionMutation.mutate({ sessionId });
  };

  const handleRevokeAll = () => {
    revokeAllMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeSessions = sessions || [];
  const otherSessions = activeSessions.filter(s => !s.isCurrent);

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Active Sessions</h1>
          <p className="text-muted-foreground">Manage devices where you're signed in</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                {activeSessions.length} Active Session{activeSessions.length !== 1 ? "s" : ""}
              </CardTitle>
              <CardDescription>
                You're currently signed in on {activeSessions.length} device{activeSessions.length !== 1 ? "s" : ""}.
              </CardDescription>
            </div>
            {otherSessions.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowRevokeAllDialog(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out all other devices
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Sessions List */}
      <div className="space-y-4">
        {activeSessions.map((session) => {
          const DeviceIcon = getDeviceIcon(session.deviceType);
          const browser = session.browserName || "Unknown browser";
          const os = session.osName || "Unknown OS";
          
          return (
            <Card key={session.id} className={session.isCurrent ? "border-primary" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${session.isCurrent ? "bg-primary/10" : "bg-muted"}`}>
                      <DeviceIcon className={`h-6 w-6 ${session.isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{browser} on {os}</span>
                        {session.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Current Session
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}
                        </span>
                      </div>
                      
                      {session.deviceType && (
                        <p className="text-xs text-muted-foreground/70">
                          {session.deviceType}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setSessionToRevoke(session.id)}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeSessions.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No active sessions found. This shouldn't happen if you're viewing this page.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Tips */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Security Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Sign out of sessions you don't recognize immediately</p>
          <p>• Use two-factor authentication for additional security</p>
          <p>• Avoid signing in on shared or public computers</p>
          <p>• Sessions automatically expire after 30 days of inactivity</p>
        </CardContent>
      </Card>

      {/* Revoke Single Session Dialog */}
      <Dialog open={!!sessionToRevoke} onOpenChange={() => setSessionToRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of this device?</DialogTitle>
            <DialogDescription>
              This will end the session on that device. The user will need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionToRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => sessionToRevoke && handleRevokeSession(sessionToRevoke)}
              disabled={revokeSessionMutation.isPending}
            >
              {revokeSessionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke All Dialog */}
      <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out of all other devices?</DialogTitle>
            <DialogDescription>
              This will end {otherSessions.length} session{otherSessions.length !== 1 ? "s" : ""} on other devices. 
              You'll stay signed in on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAll}
              disabled={revokeAllMutation.isPending}
            >
              {revokeAllMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign Out All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
