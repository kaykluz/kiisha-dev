import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OAuthCallback() {
  const [, setLocation] = useLocation();
  const params = useParams<{ provider: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCallbackMutation = trpc.multiAuth.handleCallback.useMutation({
    onSuccess: (data) => {
      if (data.success && data.sessionToken) {
        // Store session token
        document.cookie = `session=${data.sessionToken}; path=/; max-age=${365 * 24 * 60 * 60}`;
        setStatus("success");
        // Redirect to dashboard after short delay
        setTimeout(() => {
          setLocation("/dashboard");
        }, 1500);
      }
    },
    onError: (err) => {
      setStatus("error");
      setErrorMessage(err.message);
    }
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error);
      return;
    }

    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code received");
      return;
    }

    // Verify state if we stored one
    const storedState = sessionStorage.getItem("oauth_state");
    if (storedState && state !== storedState) {
      setStatus("error");
      setErrorMessage("Invalid state parameter - possible CSRF attack");
      return;
    }

    // Clear stored state
    sessionStorage.removeItem("oauth_state");

    // Exchange code for tokens
    const provider = params.provider as "google" | "github" | "microsoft";
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;

    handleCallbackMutation.mutate({
      provider,
      code,
      redirectUri,
      state: state || undefined
    });
  }, [params.provider]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {status === "loading" && "Signing you in..."}
            {status === "success" && "Welcome!"}
            {status === "error" && "Sign in failed"}
          </CardTitle>
          <CardDescription className="text-center">
            {status === "loading" && `Completing ${params.provider} authentication`}
            {status === "success" && "Redirecting to dashboard..."}
            {status === "error" && "There was a problem signing you in"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === "success" && (
            <CheckCircle className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              <Button onClick={() => setLocation("/login")} className="mt-4">
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
