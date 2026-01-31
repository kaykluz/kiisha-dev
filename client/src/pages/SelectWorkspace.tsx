/**
 * Phase 35: Workspace Selection Page
 * 
 * Shown when user has multiple workspaces and needs to select one.
 * Also handles:
 * - 0 workspaces: Show pending access message
 * - 1 workspace: Auto-select and redirect
 * - 2+ workspaces: Show selection UI
 */

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, ChevronRight, Clock, AlertCircle } from "lucide-react";

export default function SelectWorkspace() {
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Get session state
  const { data: session, isLoading: sessionLoading } = trpc.authSession.getSession.useQuery();
  
  // Get available workspaces
  const { data: workspaces, isLoading: workspacesLoading } = trpc.authSession.listWorkspaces.useQuery(
    undefined,
    { enabled: session?.authenticated }
  );

  // Select workspace mutation
  const selectMutation = trpc.authSession.selectWorkspace.useMutation({
    onSuccess: () => {
      // Redirect to app after selection
      setLocation("/app");
    },
  });

  // Handle auto-selection for single workspace
  useEffect(() => {
    if (!sessionLoading && !workspacesLoading && workspaces) {
      if (workspaces.length === 1) {
        // Auto-select single workspace
        selectMutation.mutate({ organizationId: workspaces[0]!.id });
      } else if (workspaces.length === 0) {
        // No workspaces - redirect to pending access
        setLocation("/pending-access");
      }
    }
  }, [sessionLoading, workspacesLoading, workspaces]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!sessionLoading && !session?.authenticated) {
      setLocation("/login");
    }
  }, [sessionLoading, session]);

  // Redirect if already has active workspace
  useEffect(() => {
    if (session?.activeOrganizationId) {
      setLocation("/app");
    }
  }, [session]);

  const handleSelect = (organizationId: number) => {
    setSelectedId(organizationId);
    selectMutation.mutate({ organizationId });
  };

  if (sessionLoading || workspacesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading while auto-selecting single workspace
  if (workspaces?.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Entering workspace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select Workspace</CardTitle>
          <CardDescription>
            Choose which organization you want to work in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectMutation.error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              {selectMutation.error.message}
            </div>
          )}

          <div className="space-y-3">
            {workspaces?.filter(Boolean).map((workspace) => (
              <button
                key={workspace!.id}
                onClick={() => handleSelect(workspace!.id)}
                disabled={selectMutation.isPending}
                className={`w-full p-4 rounded-lg border transition-all text-left flex items-center gap-4 ${
                  selectedId === workspace!.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                } ${selectMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {workspace!.logoUrl ? (
                  <img
                    src={workspace!.logoUrl}
                    alt={workspace!.name}
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{workspace!.name}</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {workspace!.role}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>

          {session?.user && (
            <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
              Signed in as {session.user.email || session.user.name}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Pending Access Page
 * Shown when user has no workspace memberships
 */
export function PendingAccess() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading } = trpc.authSession.getSession.useQuery();
  const logoutMutation = trpc.authSession.logout.useMutation({
    onSuccess: () => setLocation("/login"),
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !session?.authenticated) {
      setLocation("/login");
    }
  }, [isLoading, session]);

  // Redirect if has workspaces
  useEffect(() => {
    if (session?.workspaceCount && session.workspaceCount > 0) {
      setLocation("/select-workspace");
    }
  }, [session]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Access Pending</CardTitle>
          <CardDescription>
            Your account has been created, but you don't have access to any workspaces yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Please contact your organization administrator to request access, or wait for an invitation.
          </p>
          
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              Sign out
            </Button>
          </div>

          {session?.user && (
            <div className="text-sm text-muted-foreground">
              Signed in as {session.user.email || session.user.name}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
