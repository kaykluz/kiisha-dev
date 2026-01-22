/**
 * Policy Violation Modal
 * 
 * Shows users why they're blocked and provides remediation steps.
 * 
 * Violation types:
 * - 2FA Required: Organization requires two-factor authentication
 * - Session Expired: Session has timed out per org policy
 * - IP Blocked: User's IP is not in the allowed list
 * - Password Change Required: Password must be changed
 * - Account Locked: Too many failed login attempts
 */

import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Shield, 
  Smartphone, 
  Clock, 
  MapPin, 
  Key, 
  Lock,
  AlertTriangle,
  ExternalLink,
  LogOut,
  Mail
} from "lucide-react";

export type PolicyViolationType = 
  | "2fa_required"
  | "session_expired"
  | "ip_blocked"
  | "password_change_required"
  | "account_locked";

interface PolicyViolationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  violationType: PolicyViolationType;
  organizationName?: string;
  additionalInfo?: string;
  onAction?: () => void;
}

const VIOLATION_CONFIG: Record<PolicyViolationType, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  severity: "warning" | "error";
  primaryAction: string;
  primaryActionPath?: string;
  secondaryAction?: string;
  steps: string[];
}> = {
  "2fa_required": {
    icon: Smartphone,
    title: "Two-Factor Authentication Required",
    description: "Your organization requires two-factor authentication to access this resource.",
    severity: "warning",
    primaryAction: "Set Up 2FA",
    primaryActionPath: "/settings/security",
    secondaryAction: "Log Out",
    steps: [
      "Go to Security Settings",
      "Enable Two-Factor Authentication",
      "Scan the QR code with your authenticator app",
      "Enter the verification code to complete setup",
      "Save your backup codes in a secure location"
    ]
  },
  "session_expired": {
    icon: Clock,
    title: "Session Expired",
    description: "Your session has expired due to inactivity. Please log in again to continue.",
    severity: "warning",
    primaryAction: "Log In Again",
    primaryActionPath: "/login",
    steps: [
      "Your session has timed out for security",
      "Click 'Log In Again' to re-authenticate",
      "You'll be returned to your previous page after login"
    ]
  },
  "ip_blocked": {
    icon: MapPin,
    title: "Access Denied - IP Restriction",
    description: "Your current IP address is not authorized to access this organization's resources.",
    severity: "error",
    primaryAction: "Contact Admin",
    secondaryAction: "Log Out",
    steps: [
      "Your organization has IP restrictions enabled",
      "Your current IP address is not in the allowed list",
      "Contact your organization administrator to:",
      "  - Add your IP to the allowed list, or",
      "  - Connect via an approved VPN or network"
    ]
  },
  "password_change_required": {
    icon: Key,
    title: "Password Change Required",
    description: "Your password has expired or must be changed per organization policy.",
    severity: "warning",
    primaryAction: "Change Password",
    primaryActionPath: "/settings/security",
    steps: [
      "Your organization requires periodic password changes",
      "Click 'Change Password' to update your password",
      "Choose a strong, unique password",
      "You'll be logged in automatically after the change"
    ]
  },
  "account_locked": {
    icon: Lock,
    title: "Account Locked",
    description: "Your account has been temporarily locked due to multiple failed login attempts.",
    severity: "error",
    primaryAction: "Contact Admin",
    secondaryAction: "Try Again Later",
    steps: [
      "Too many failed login attempts were detected",
      "Your account is temporarily locked for security",
      "Wait 30 minutes and try again, or",
      "Contact your administrator to unlock your account"
    ]
  }
};

export function PolicyViolationModal({
  open,
  onOpenChange,
  violationType,
  organizationName,
  additionalInfo,
  onAction,
}: PolicyViolationModalProps) {
  const [, navigate] = useLocation();
  const config = VIOLATION_CONFIG[violationType];
  const Icon = config.icon;
  
  const handlePrimaryAction = () => {
    if (config.primaryActionPath) {
      navigate(config.primaryActionPath);
      onOpenChange(false);
    }
    onAction?.();
  };
  
  const handleSecondaryAction = () => {
    if (config.secondaryAction === "Log Out") {
      // Trigger logout
      window.location.href = "/api/oauth/logout";
    }
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              config.severity === "error" ? "bg-red-500/10" : "bg-yellow-500/10"
            }`}>
              <Icon className={`h-6 w-6 ${
                config.severity === "error" ? "text-red-500" : "text-yellow-500"
              }`} />
            </div>
            <div>
              <DialogTitle>{config.title}</DialogTitle>
              {organizationName && (
                <p className="text-sm text-muted-foreground mt-1">
                  Organization: {organizationName}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Alert variant={config.severity === "error" ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Blocked</AlertTitle>
            <AlertDescription>{config.description}</AlertDescription>
          </Alert>
          
          {additionalInfo && (
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              {additionalInfo}
            </p>
          )}
          
          <div className="space-y-2">
            <h4 className="text-sm font-medium">How to resolve:</h4>
            <ol className="space-y-2">
              {config.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  {step.startsWith("  ") ? (
                    <span className="ml-6">{step.trim()}</span>
                  ) : (
                    <>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </div>
          
          {violationType === "ip_blocked" && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Need help? Contact your organization administrator
              </span>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {config.secondaryAction && (
            <Button variant="outline" onClick={handleSecondaryAction}>
              {config.secondaryAction === "Log Out" && <LogOut className="h-4 w-4 mr-2" />}
              {config.secondaryAction}
            </Button>
          )}
          <Button onClick={handlePrimaryAction}>
            {config.primaryActionPath && <ExternalLink className="h-4 w-4 mr-2" />}
            {config.primaryAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage policy violation state
 */
export function usePolicyViolation() {
  const [violation, setViolation] = useState<{
    type: PolicyViolationType;
    orgName?: string;
    info?: string;
  } | null>(null);
  
  const showViolation = (
    type: PolicyViolationType, 
    orgName?: string, 
    info?: string
  ) => {
    setViolation({ type, orgName, info });
  };
  
  const clearViolation = () => {
    setViolation(null);
  };
  
  return {
    violation,
    showViolation,
    clearViolation,
    isOpen: violation !== null,
  };
}

export default PolicyViolationModal;
