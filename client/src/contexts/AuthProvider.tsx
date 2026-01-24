/**
 * Phase 35: Auth Provider with Strict Auth-First Boot Sequence
 * 
 * This provider:
 * 1. Calls auth.getSession on mount (single source of truth)
 * 2. Blocks all rendering until auth state is known
 * 3. Redirects based on auth state (login, 2fa, workspace selection)
 * 4. Provides auth context to all children
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// Auth state from getSession
export interface AuthState {
  authenticated: boolean;
  mfaRequired: boolean;
  mfaSatisfied: boolean;
  workspaceRequired: boolean;
  workspaceSelectionRequired: boolean; // True on fresh login until user explicitly selects workspace
  user: {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    role: string;
    isSuperuser?: boolean;
  } | null;
  activeOrganizationId: number | null;
  activeOrganization: {
    id: number;
    name: string;
    slug: string | null;
    logoUrl: string | null;
  } | null;
  workspaceCount: number;
  sessionId: string | null;
}

interface AuthContextValue {
  // Auth state
  state: AuthState | null;
  isLoading: boolean;
  error: Error | null;
  
  // Computed helpers
  isAuthenticated: boolean;
  isReady: boolean; // Auth check complete and all gates passed
  user: AuthState["user"];
  activeOrganization: AuthState["activeOrganization"];
  
  // Actions
  refetch: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Routes that don't require auth
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/auth/login",
  "/auth/callback",
  "/auth/verify-email",
  "/data-room",
  "/invite",
];

// Routes that require auth but not full gate passage
const AUTH_ONLY_ROUTES = [
  "/2fa",
  "/select-workspace",
  "/pending-access",
];

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [location, setLocation] = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  // Single source of truth - getSession
  const {
    data: session,
    isLoading,
    error,
    refetch,
  } = trpc.authSession.getSession.useQuery(undefined, {
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Logout mutation
  const logoutMutation = trpc.authSession.logout.useMutation({
    onSuccess: () => {
      setLocation("/login");
      refetch();
    },
  });

  // Handle redirects based on auth state
  useEffect(() => {
    if (isLoading || hasRedirected) return;

    const isPublicRoute = PUBLIC_ROUTES.some(r => location === r || location.startsWith(r + "?"));
    const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some(r => location === r || location.startsWith(r + "?"));

    // Not authenticated
    if (!session?.authenticated) {
      if (!isPublicRoute) {
        // Redirect to login with return URL
        const returnUrl = encodeURIComponent(location);
        setLocation(`/login?returnUrl=${returnUrl}`);
        setHasRedirected(true);
      }
      return;
    }

    // Authenticated but MFA required
    if (session.mfaRequired && !session.mfaSatisfied) {
      if (location !== "/2fa") {
        setLocation("/2fa");
        setHasRedirected(true);
      }
      return;
    }

    // No workspaces available - user has no company access
    if (session.workspaceCount === 0) {
      if (location !== "/pending-access") {
        setLocation("/pending-access");
        setHasRedirected(true);
      }
      return;
    }

    // WORKSPACE SELECTION WALL: Fresh login requires workspace selection
    // workspaceSelectionRequired is true on fresh login, cleared after explicit selection
    if (session.workspaceSelectionRequired || !session.activeOrganizationId) {
      if (location !== "/select-workspace" && location !== "/pending-access" && !isPublicRoute) {
        setLocation("/select-workspace");
        setHasRedirected(true);
      }
      return;
    }

    // Fully authenticated with active organization AND workspace selection completed
    // Redirect away from auth pages to dashboard
    if (isPublicRoute || isAuthOnlyRoute) {
      if (location === "/login" || location === "/signup") {
        setLocation("/dashboard");
        setHasRedirected(true);
      } else if (location === "/2fa") {
        setLocation("/dashboard");
        setHasRedirected(true);
      } else if (location === "/select-workspace") {
        // Workspace selection completed, go to dashboard
        setLocation("/dashboard");
        setHasRedirected(true);
      }
    }
  }, [session, isLoading, location, hasRedirected]);

  // Reset redirect flag on location change
  useEffect(() => {
    setHasRedirected(false);
  }, [location]);

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  // Compute derived values
  const isAuthenticated = session?.authenticated ?? false;
  const isReady = isAuthenticated && 
    (!session?.mfaRequired || session.mfaSatisfied) && 
    !session?.workspaceRequired &&
    (session?.workspaceCount ?? 0) > 0;

  const value: AuthContextValue = {
    state: session ?? null,
    isLoading,
    error: error as Error | null,
    isAuthenticated,
    isReady,
    user: session?.user ?? null,
    activeOrganization: session?.activeOrganization ?? null,
    refetch,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Hook to require authentication
 * Returns null while loading, redirects if not authenticated
 */
export function useRequireAuth(): AuthContextValue & { isReady: true } | null {
  const auth = useAuth();
  
  if (auth.isLoading) {
    return null;
  }
  
  if (!auth.isReady) {
    return null;
  }
  
  return auth as AuthContextValue & { isReady: true };
}

/**
 * Component that renders children only when auth is ready
 */
export function RequireAuth({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return fallback ?? (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!auth.isReady) {
    // Redirect will happen via useEffect in AuthProvider
    return fallback ?? null;
  }

  return <>{children}</>;
}

export default AuthProvider;
