import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Github, Building2, Zap } from "lucide-react";
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

// Google icon component
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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
    <div className="min-h-screen flex bg-[var(--color-bg-base)]">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-orange-900/10 to-transparent" />

        {/* Artistic background image - similar to o11's style */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80')`,
            filter: 'sepia(30%) saturate(80%)'
          }}
        />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-bg-base)]" />
            </div>
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">KIISHA</span>
          </div>

          {/* Hero text */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-4 leading-tight">
              Intelligent Asset Management for Renewable Energy
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)]">
              Streamline your solar and energy portfolio with AI-powered diligence, compliance tracking, and document management.
            </p>
          </div>

          {/* Footer */}
          <div className="text-sm text-[var(--color-text-tertiary)]">
            © 2025 Kiisha. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-[var(--color-bg-base)]" />
            </div>
            <span className="text-2xl font-bold text-[var(--color-text-primary)]">KIISHA</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">
              {isRegistering ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {isRegistering
                ? "Start managing your renewable energy assets"
                : "Sign in to continue to your dashboard"}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="bg-[var(--color-semantic-error-muted)] border-[var(--color-semantic-error)]">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-[var(--color-semantic-success-muted)] border-[var(--color-semantic-success)]">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* OAuth Providers */}
          <div className="space-y-3">
            {/* Manus OAuth - Primary */}
            <Button
              variant="default"
              className="w-full h-12 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-[var(--color-bg-base)] font-medium rounded-xl"
              onClick={handleManusLogin}
              disabled={isLoading}
            >
              <Building2 className="mr-3 h-5 w-5" />
              Continue with Manus
            </Button>

            <div className="grid grid-cols-3 gap-3">
              {/* Google OAuth */}
              <Button
                variant="outline"
                className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] hover:border-[var(--color-border-default)] rounded-xl"
                onClick={() => handleOAuthLogin("google")}
                disabled={isLoading}
              >
                <GoogleIcon className="h-5 w-5" />
              </Button>

              {/* GitHub OAuth */}
              <Button
                variant="outline"
                className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] hover:border-[var(--color-border-default)] rounded-xl"
                onClick={() => handleOAuthLogin("github")}
                disabled={isLoading}
              >
                <Github className="h-5 w-5" />
              </Button>

              {/* Microsoft OAuth */}
              <Button
                variant="outline"
                className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] hover:border-[var(--color-border-default)] rounded-xl"
                onClick={() => handleOAuthLogin("microsoft")}
                disabled={isLoading}
              >
                <MicrosoftIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border-subtle)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[var(--color-bg-base)] text-[var(--color-text-tertiary)]">
                or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[var(--color-text-secondary)] text-sm">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] focus:border-[var(--color-brand-primary)] rounded-xl placeholder:text-[var(--color-text-tertiary)]"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--color-text-secondary)] text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] focus:border-[var(--color-brand-primary)] rounded-xl placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--color-text-secondary)] text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
                className="h-12 bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)] focus:border-[var(--color-brand-primary)] rounded-xl placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>

            {!isRegistering && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
                  />
                  <Label htmlFor="rememberMe" className="text-sm text-[var(--color-text-secondary)] font-normal cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm text-[var(--color-brand-primary)] hover:underline"
                  onClick={() => setLocation("/forgot-password")}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-[var(--color-text-primary)] hover:bg-[var(--color-text-secondary)] text-[var(--color-bg-base)] font-medium rounded-xl"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegistering ? "Create account" : "Sign in"}
            </Button>
          </form>

          {/* Toggle between sign in and register */}
          <div className="text-center text-sm text-[var(--color-text-secondary)]">
            {isRegistering ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="text-[var(--color-brand-primary)] hover:underline font-medium"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="text-[var(--color-brand-primary)] hover:underline font-medium"
                  onClick={() => {
                    setIsRegistering(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
