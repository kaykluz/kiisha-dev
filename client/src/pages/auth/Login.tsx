import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Github, Chrome, Building2 } from "lucide-react";
import { getLoginUrl } from "@/const";

// Microsoft icon component
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  // Email/password login mutation
  const loginMutation = trpc.multiAuth.loginWithEmail.useMutation({
    onSuccess: (data) => {
      if (data.success && data.sessionToken) {
        // Store session token with duration based on Remember Me
        const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60; // 30 days or 1 day
        document.cookie = `session=${data.sessionToken}; path=/; max-age=${maxAge}`;
        setLocation("/dashboard");
      }
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  // Email/password registration mutation
  const registerMutation = trpc.multiAuth.registerWithEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSuccess(data.message);
        setIsRegistering(false);
        setEmail("");
        setPassword("");
        setName("");
      }
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  // OAuth URL mutation
  const getAuthUrlMutation = trpc.multiAuth.getAuthUrl.useMutation({
    onSuccess: (data) => {
      // Store state in sessionStorage for verification
      sessionStorage.setItem("oauth_state", data.state);
      // Redirect to OAuth provider
      window.location.href = data.url;
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isRegistering) {
      registerMutation.mutate({ email, password, name: name || undefined });
    } else {
      loginMutation.mutate({ email, password, rememberMe });
    }
  };

  const handleOAuthLogin = (provider: "google" | "github" | "microsoft") => {
    setError(null);
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
    getAuthUrlMutation.mutate({
      provider,
      redirectUri,
      state: crypto.randomUUID()
    });
  };

  const handleManusLogin = () => {
    window.location.href = getLoginUrl();
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending || getAuthUrlMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isRegistering ? "Create an account" : "Welcome back"}
          </CardTitle>
          <CardDescription className="text-center">
            {isRegistering 
              ? "Enter your details to create your account" 
              : "Choose your preferred sign-in method"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* OAuth Providers - Always show all options */}
          <div className="grid gap-2">
            {/* Manus OAuth - Primary */}
            <Button
              variant="default"
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleManusLogin}
              disabled={isLoading}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Continue with Manus
            </Button>

            {/* Google OAuth */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthLogin("google")}
              disabled={isLoading}
            >
              <Chrome className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            {/* GitHub OAuth */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthLogin("github")}
              disabled={isLoading}
            >
              <Github className="mr-2 h-4 w-4" />
              Continue with GitHub
            </Button>

            {/* Microsoft OAuth */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthLogin("microsoft")}
              disabled={isLoading}
            >
              <MicrosoftIcon className="mr-2 h-4 w-4" />
              Continue with Microsoft
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
            
            {!isRegistering && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                  Remember me for 30 days
                </Label>
              </div>
            )}
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Mail className="mr-2 h-4 w-4" />
              {isRegistering ? "Create account" : "Sign in with Email"}
            </Button>
          </form>

          {!isRegistering && (
            <div className="text-center">
              <Button
                variant="link"
                className="text-sm text-muted-foreground"
                onClick={() => setLocation("/forgot-password")}
              >
                Forgot your password?
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <div className="w-full text-center text-sm">
            {isRegistering ? (
              <>
                Already have an account?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Sign in
                </Button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <Button
                  variant="link"
                  className="p-0 h-auto font-semibold"
                  onClick={() => {
                    setIsRegistering(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Create one
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
