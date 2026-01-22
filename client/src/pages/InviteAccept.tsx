/**
 * Invitation Acceptance Page
 * 
 * Public route at /invite/:token for accepting organization invitations.
 * Handles both logged-in and logged-out users.
 * 
 * Flow:
 * 1. Validate token (without revealing org existence on failure)
 * 2. Show invitation details if valid
 * 3. For logged-in users: Accept directly
 * 4. For logged-out users: Redirect to login with token preserved
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Zap, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  Shield,
  Clock,
  User,
  Loader2
} from "lucide-react";

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  
  // Validate the token
  const { 
    data: tokenInfo, 
    isLoading: tokenLoading, 
    error: tokenError 
  } = trpc.signup.validateInviteToken.useQuery(
    { token: token || "" },
    { 
      enabled: !!token,
      retry: false,
    }
  );
  
  // Accept invitation mutation
  const acceptMutation = trpc.signup.acceptInvitation.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        // Redirect to dashboard with the new org
        setLocation("/dashboard");
      }
    },
    onError: (error) => {
      setAcceptError(error.message || "Failed to accept invitation");
    },
  });
  
  const handleAccept = () => {
    if (!token) return;
    setAcceptError(null);
    acceptMutation.mutate({ token });
  };
  
  const handleLoginAndAccept = () => {
    // Redirect to login with the invite token preserved
    const loginUrl = getLoginUrl() + `&invite=${token}`;
    window.location.href = loginUrl;
  };
  
  // Loading state
  if (authLoading || tokenLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Invalid or expired token
  if (tokenError || !tokenInfo?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">KIISHA</h1>
              <p className="text-xs text-muted-foreground">Energy Asset Intelligence</p>
            </div>
          </div>
          
          <Card className="border-destructive/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Invalid Invitation</CardTitle>
              <CardDescription>
                This invitation link is invalid or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>What to do next</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Check if you have a newer invitation email</li>
                    <li>Contact your organization administrator for a new invitation</li>
                    <li>Make sure you're using the complete invitation link</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
          
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Security Notice</p>
                <p>
                  Invitation links expire after 7 days for security. 
                  Contact your administrator if you need a new invitation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Valid token - show invitation details
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-7 h-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">KIISHA</h1>
            <p className="text-xs text-muted-foreground">Energy Asset Intelligence</p>
          </div>
        </div>
        
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl">You're Invited!</CardTitle>
            <CardDescription>
              You've been invited to join an organization on KIISHA
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Invitation Details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="font-medium">{tokenInfo.organizationName}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="secondary">{tokenInfo.role}</Badge>
              </div>
              
              {tokenInfo.inviterName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Invited By</span>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{tokenInfo.inviterName}</span>
                  </div>
                </div>
              )}
              
              {tokenInfo.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {new Date(tokenInfo.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Error Alert */}
            {acceptError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{acceptError}</AlertDescription>
              </Alert>
            )}
            
            {/* Action based on auth state */}
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div className="text-sm">
                    <p className="font-medium">Signed in as {user.email || user.name}</p>
                    <p className="text-muted-foreground">Click below to accept the invitation</p>
                  </div>
                </div>
                
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAccept}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      Accept Invitation
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setLocation("/login")}
                >
                  Use a different account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert>
                  <User className="h-4 w-4" />
                  <AlertDescription>
                    Sign in or create an account to accept this invitation
                  </AlertDescription>
                </Alert>
                
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleLoginAndAccept}
                >
                  Continue with Manus
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Your invitation will be automatically applied after sign in
                </p>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex-col gap-2">
            <p className="text-xs text-center text-muted-foreground">
              By accepting, you agree to the organization's policies and KIISHA's Terms of Service
            </p>
          </CardFooter>
        </Card>
        
        {/* Role Description */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">About the {tokenInfo.role} role</h4>
          <p className="text-xs text-muted-foreground">
            {getRoleDescription(tokenInfo.role)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    admin: "Full access to manage organization settings, members, and all data. Can invite new members and manage permissions.",
    editor: "Can create, edit, and manage projects and documents. Cannot manage organization settings or members.",
    reviewer: "Can view and comment on projects and documents. Cannot make changes to data.",
    viewer: "Read-only access to view projects and documents assigned to them.",
    "investor_viewer": "Special read-only access for investors to view portfolio performance and reports.",
  };
  
  return descriptions[role?.toLowerCase()] || "Access level will be determined by the organization administrator.";
}
