/**
 * Security Settings Page
 * 
 * Allows users to:
 * - Enable/disable two-factor authentication
 * - Generate and view backup codes
 * - Manage session settings
 * - View security audit log
 */

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Shield, 
  Smartphone, 
  Key, 
  Copy, 
  Check, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  EyeOff,
  Download,
  Clock,
  Lock,
  Unlock,
  History
} from "lucide-react";

export default function SecuritySettings() {
  const { user, refetch: refetchAuth } = useAuth();
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [backupCodesDialogOpen, setBackupCodesDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Queries
  const { data: securityStatus, refetch: refetchStatus } = trpc.security.getStatus.useQuery();
  const { data: sessions, refetch: refetchSessions } = trpc.security.listSessions.useQuery();
  const { data: auditLog } = trpc.security.getAuditLog.useQuery({ limit: 10 });
  
  // Mutations
  const initiate2FAMutation = trpc.security.initiate2FA.useMutation({
    onSuccess: () => {
      setSetupDialogOpen(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to initiate 2FA setup");
    },
  });
  
  const verify2FAMutation = trpc.security.verify2FA.useMutation({
    onSuccess: () => {
      toast.success("Two-factor authentication enabled successfully");
      setSetupDialogOpen(false);
      setVerificationCode("");
      refetchStatus();
      refetchAuth();
    },
    onError: (error) => {
      toast.error(error.message || "Invalid verification code");
    },
  });
  
  const disable2FAMutation = trpc.security.disable2FA.useMutation({
    onSuccess: () => {
      toast.success("Two-factor authentication disabled");
      setDisableDialogOpen(false);
      setVerificationCode("");
      refetchStatus();
      refetchAuth();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to disable 2FA");
    },
  });
  
  const regenerateBackupCodesMutation = trpc.security.regenerateBackupCodes.useMutation({
    onSuccess: () => {
      toast.success("Backup codes regenerated");
      refetchStatus();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate backup codes");
    },
  });
  
  const revokeSessionMutation = trpc.security.revokeSession.useMutation({
    onSuccess: () => {
      toast.success("Session revoked");
      refetchSessions();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke session");
    },
  });
  
  const revokeAllSessionsMutation = trpc.security.revokeAllSessions.useMutation({
    onSuccess: () => {
      toast.success("All other sessions revoked");
      refetchSessions();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke sessions");
    },
  });
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  
  const handleDownloadBackupCodes = () => {
    if (!securityStatus?.backupCodes) return;
    const content = `KIISHA Backup Codes\n\nGenerated: ${new Date().toISOString()}\n\nKeep these codes safe. Each code can only be used once.\n\n${securityStatus.backupCodes.join("\n")}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kiisha-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleString();
  };
  
  // Check if org requires 2FA
  const orgRequires2FA = user?.activeOrg?.securityPolicies?.require2FA || false;
  const is2FAEnabled = securityStatus?.twoFactorEnabled || false;
  
  return (
    <AppLayout>
      <div className="page-container max-w-4xl">
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Security Settings
            </h1>
            <p className="text-secondary mt-1">
              Manage your account security and authentication settings
            </p>
          </div>
        </div>
        
        {/* 2FA Required Alert */}
        {orgRequires2FA && !is2FAEnabled && (
          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Two-Factor Authentication Required</AlertTitle>
            <AlertDescription>
              Your organization requires two-factor authentication. Please enable 2FA to continue using the platform.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-6 mt-6">
          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </div>
                {is2FAEnabled ? (
                  <Badge className="bg-green-600">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Authenticator App</p>
                  <p className="text-sm text-muted-foreground">
                    Use an authenticator app like Google Authenticator, Authy, or 1Password
                  </p>
                </div>
                {is2FAEnabled ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setDisableDialogOpen(true)}
                    disabled={orgRequires2FA}
                  >
                    <Unlock className="h-4 w-4 mr-2" />
                    Disable
                  </Button>
                ) : (
                  <Button onClick={() => initiate2FAMutation.mutate()}>
                    <Lock className="h-4 w-4 mr-2" />
                    Enable
                  </Button>
                )}
              </div>
              
              {is2FAEnabled && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Backup Codes</p>
                      <p className="text-sm text-muted-foreground">
                        Use backup codes if you lose access to your authenticator
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setBackupCodesDialogOpen(true)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Codes
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => regenerateBackupCodesMutation.mutate()}
                        disabled={regenerateBackupCodesMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Active Sessions
                  </CardTitle>
                  <CardDescription>
                    Manage your active login sessions
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => revokeAllSessionsMutation.mutate()}
                  disabled={revokeAllSessionsMutation.isPending}
                >
                  Revoke All Others
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions?.map((session) => (
                  <div 
                    key={session.id} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${session.isCurrent ? "bg-green-500/10" : "bg-muted"}`}>
                        <Shield className={`h-4 w-4 ${session.isCurrent ? "text-green-500" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{session.deviceInfo || "Unknown Device"}</p>
                          {session.isCurrent && (
                            <Badge variant="outline" className="text-green-600">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {session.ipAddress} • Last active: {formatDate(session.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => revokeSessionMutation.mutate({ sessionId: session.id })}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
                
                {(!sessions || sessions.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active sessions found</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Security Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Recent Security Activity
              </CardTitle>
              <CardDescription>
                Recent security-related events for your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLog?.map((event, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-3 border rounded-lg"
                  >
                    <div className={`p-2 rounded-full ${
                      event.severity === "high" ? "bg-red-500/10" :
                      event.severity === "medium" ? "bg-yellow-500/10" :
                      "bg-muted"
                    }`}>
                      {event.type === "login" ? (
                        <Lock className={`h-4 w-4 ${
                          event.severity === "high" ? "text-red-500" :
                          event.severity === "medium" ? "text-yellow-500" :
                          "text-muted-foreground"
                        }`} />
                      ) : (
                        <Shield className={`h-4 w-4 ${
                          event.severity === "high" ? "text-red-500" :
                          event.severity === "medium" ? "text-yellow-500" :
                          "text-muted-foreground"
                        }`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(event.timestamp)} • {event.ipAddress || "Unknown IP"}
                      </p>
                    </div>
                  </div>
                ))}
                
                {(!auditLog || auditLog.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent security activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* 2FA Setup Dialog */}
        <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Scan the QR code with your authenticator app, then enter the verification code.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  {initiate2FAMutation.data?.qrCodeUrl ? (
                    <img 
                      src={initiate2FAMutation.data.qrCodeUrl} 
                      alt="2FA QR Code" 
                      className="w-48 h-48"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-muted animate-pulse rounded" />
                  )}
                </div>
              </div>
              
              {/* Manual Entry */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Can't scan? Enter this code manually:
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                    {initiate2FAMutation.data?.secret || "Loading..."}
                  </code>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleCopyCode(initiate2FAMutation.data?.secret || "")}
                  >
                    {copiedCode === initiate2FAMutation.data?.secret ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Verification Code Input */}
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => verify2FAMutation.mutate({ code: verificationCode })}
                disabled={verificationCode.length !== 6 || verify2FAMutation.isPending}
              >
                {verify2FAMutation.isPending ? "Verifying..." : "Verify & Enable"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Disable 2FA Dialog */}
        <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
              <DialogDescription>
                Enter your verification code to disable 2FA. This will make your account less secure.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Disabling 2FA will remove the extra layer of security from your account.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="disable-code">Verification Code</Label>
                <Input
                  id="disable-code"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => disable2FAMutation.mutate({ code: verificationCode })}
                disabled={verificationCode.length !== 6 || disable2FAMutation.isPending}
              >
                {disable2FAMutation.isPending ? "Disabling..." : "Disable 2FA"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Backup Codes Dialog */}
        <Dialog open={backupCodesDialogOpen} onOpenChange={setBackupCodesDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Backup Codes</DialogTitle>
              <DialogDescription>
                Save these codes in a secure place. Each code can only be used once.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertTitle>Keep these codes safe</AlertTitle>
                <AlertDescription>
                  If you lose access to your authenticator app, you can use these codes to log in.
                </AlertDescription>
              </Alert>
              
              <div className="relative">
                <div className={`grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg ${!showBackupCodes ? "blur-sm select-none" : ""}`}>
                  {securityStatus?.backupCodes?.map((code, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 bg-background rounded"
                    >
                      <code className="font-mono text-sm">{code}</code>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => handleCopyCode(code)}
                      >
                        {copiedCode === code ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                
                {!showBackupCodes && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Button onClick={() => setShowBackupCodes(true)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Show Codes
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleDownloadBackupCodes}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button onClick={() => {
                setBackupCodesDialogOpen(false);
                setShowBackupCodes(false);
              }}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
