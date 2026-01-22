/**
 * Login Page with Anti-Enumeration Measures
 * 
 * Security features:
 * - No org autocomplete or discovery
 * - Generic error messages (don't reveal org existence)
 * - Only shows user's existing org memberships after auth
 * - Requires invite token for new org access
 * - Rate limiting on token attempts (server-side)
 */

import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, ArrowRight, Building2, AlertTriangle, Loader2, Shield } from "lucide-react";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  
  // Check for invite token in URL
  const inviteToken = searchParams.get("invite");
  const orgSlug = searchParams.get("org");
  
  const [tokenInput, setTokenInput] = useState(inviteToken || "");
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  
  // Query user's organizations after login
  const { data: userOrgs, isLoading: orgsLoading } = trpc.authFlow.me.useQuery(undefined, {
    enabled: !!user,
  });
  
  // Mutation to validate invite token
  const validateTokenMutation = trpc.signup.validateInviteToken.useMutation({
    onSuccess: (data) => {
      if (data.valid) {
        // Token is valid, proceed with login
        window.location.href = getLoginUrl() + `&invite=${tokenInput}`;
      } else {
        // Generic error - don't reveal if org exists
        setTokenError("Invalid or expired invitation");
      }
      setIsValidatingToken(false);
    },
    onError: () => {
      // Generic error - don't reveal details
      setTokenError("Invalid or expired invitation");
      setIsValidatingToken(false);
    },
  });

  useEffect(() => {
    if (user && !loading) {
      // If user has organizations, redirect to dashboard
      if (userOrgs?.organizations && userOrgs.organizations.length > 0) {
        setLocation("/dashboard");
      }
    }
  }, [user, loading, userOrgs, setLocation]);

  const handleTokenSubmit = () => {
    if (!tokenInput.trim()) {
      setTokenError("Please enter an invitation code");
      return;
    }
    
    setTokenError(null);
    setIsValidatingToken(true);
    validateTokenMutation.mutate({ token: tokenInput.trim() });
  };

  if (loading || orgsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // If user is logged in but has no organizations
  if (user && userOrgs?.organizations?.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">KIISHA</h1>
              <p className="text-xs text-muted-foreground">Energy Asset Intelligence</p>
            </div>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-yellow-500" />
              </div>
              <CardTitle className="text-xl">No Organization Access</CardTitle>
              <CardDescription>
                You don't have access to any organizations yet. Enter an invitation code to join an organization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-code">Invitation Code</Label>
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="Enter your invitation code"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setTokenError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTokenSubmit();
                  }}
                  // No autocomplete - anti-enumeration
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Contact your organization administrator to receive an invitation.
                </p>
              </div>

              {tokenError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{tokenError}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                onClick={handleTokenSubmit}
                disabled={isValidatingToken}
              >
                {isValidatingToken ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Join Organization
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Sign out and return to login
                  window.location.href = "/api/auth/logout";
                }}
              >
                Sign in with different account
              </Button>
            </CardContent>
          </Card>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Security Notice</p>
                <p>
                  For security, organizations are not discoverable. You must receive an invitation 
                  from an organization administrator to gain access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default login screen (not logged in)
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

        <Card className="border-border bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access your portfolio dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Show invite token input if provided in URL */}
            {(inviteToken || orgSlug) && (
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  You have an organization invitation. Sign in to accept it.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                // Include invite token if present
                const loginUrl = inviteToken 
                  ? getLoginUrl() + `&invite=${inviteToken}`
                  : getLoginUrl();
                window.location.href = loginUrl;
              }}
            >
              Continue with Manus
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">have an invitation?</span>
              </div>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter invitation code"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  setTokenError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tokenInput.trim()) {
                    // Redirect to login with token
                    window.location.href = getLoginUrl() + `&invite=${tokenInput.trim()}`;
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              {tokenError && (
                <p className="text-xs text-destructive">{tokenError}</p>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Secure Access</p>
              <p>
                Organizations are private and not discoverable. Contact your administrator 
                for an invitation code if you need access to a specific organization.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Manage your renewable energy assets with confidence
        </p>
      </div>
    </div>
  );
}
