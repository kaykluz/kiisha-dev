/**
 * AdminGuard Component
 * 
 * Protects admin-only routes by checking user role.
 * Shows "Not authorized" page for non-admin users (per security spec).
 */

import { useAuth } from "@/contexts/AuthProvider";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null; // DashboardLayout will handle unauthenticated state
  }

  // Allow admin, superuser_admin roles, or users with isSuperuser flag
  const isAuthorized = user.role === 'admin' || user.role === 'superuser_admin' || user.isSuperuser;
  
  if (!isAuthorized) {
    // Show "Not authorized" page instead of redirect (per security spec)
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Not Authorized</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page. This area is restricted to administrators only.
            </p>
          </div>
          <Button onClick={() => setLocation("/")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default AdminGuard;
