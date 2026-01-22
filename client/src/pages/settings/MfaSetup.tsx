import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldOff, Copy, Download, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MfaSetup() {
  const [verificationCode, setVerificationCode] = useState("");
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);

  const utils = trpc.useUtils();
  const { data: mfaStatus, isLoading: statusLoading } = trpc.mfa.getStatus.useQuery();
  const setupMutation = trpc.mfa.startSetup.useMutation({
    onSuccess: () => {
      utils.mfa.getStatus.invalidate();
    },
  });
  const verifyMutation = trpc.mfa.completeSetup.useMutation({
    onSuccess: () => {
      utils.mfa.getStatus.invalidate();
      setVerificationCode("");
    },
  });
  const disableMutation = trpc.mfa.disable.useMutation({
    onSuccess: () => {
      utils.mfa.getStatus.invalidate();
      setShowDisableDialog(false);
      setDisableCode("");
    },
  });
  const regenerateBackupMutation = trpc.mfa.regenerateBackupCodes.useMutation({
    onSuccess: () => {
      utils.mfa.getStatus.invalidate();
    },
  });

  const handleSetup = () => {
    setupMutation.mutate();
  };

  const handleVerify = () => {
    if (verificationCode.length === 6) {
      verifyMutation.mutate({ code: verificationCode });
    }
  };

  const handleDisable = () => {
    if (disableCode.length === 6) {
      disableMutation.mutate({ code: disableCode });
    }
  };

  const handleRegenerateBackupCodes = () => {
    regenerateBackupMutation.mutate({ code: verificationCode });
  };

  const copyToClipboard = async (text: string, type: "secret" | "backup") => {
    await navigator.clipboard.writeText(text);
    if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedBackupCodes(true);
      setTimeout(() => setCopiedBackupCodes(false), 2000);
    }
  };

  const downloadBackupCodes = (codes: string[]) => {
    const content = `KIISHA Backup Codes\n${"=".repeat(30)}\n\nStore these codes in a safe place. Each code can only be used once.\n\n${codes.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nGenerated: ${new Date().toISOString()}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kiisha-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="text-muted-foreground">Add an extra layer of security to your account</p>
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {mfaStatus?.enabled ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  2FA Enabled
                </>
              ) : (
                <>
                  <ShieldOff className="h-5 w-5 text-yellow-500" />
                  2FA Not Enabled
                </>
              )}
            </CardTitle>
            <Badge variant={mfaStatus?.enabled ? "default" : "secondary"}>
              {mfaStatus?.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>
          <CardDescription>
            {mfaStatus?.enabled
              ? "Your account is protected with two-factor authentication."
              : "Enable two-factor authentication to secure your account."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Setup Flow - Not Enabled */}
      {!mfaStatus?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Set Up Two-Factor Authentication</CardTitle>
            <CardDescription>
              Use an authenticator app like Google Authenticator, Authy, or 1Password to generate verification codes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!setupMutation.data ? (
              <Button onClick={handleSetup} disabled={setupMutation.isPending}>
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Begin Setup"
                )}
              </Button>
            ) : (
              <>
                {/* QR Code */}
                <div className="space-y-4">
                  <div className="flex flex-col items-center p-6 bg-white rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupMutation.data.otpauthUrl)}`}
                      alt="QR Code for authenticator app"
                      className="w-48 h-48"
                    />
                    <p className="mt-4 text-sm text-gray-600 text-center">
                      Scan this QR code with your authenticator app
                    </p>
                  </div>

                  {/* Manual Entry */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Can't scan? Enter this code manually:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                        {setupMutation.data.secret}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(setupMutation.data!.secret, "secret")}
                      >
                        {copiedSecret ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Verification */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Enter verification code from your app:</label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          placeholder="000000"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                          className="font-mono text-center text-lg tracking-widest"
                        />
                        <Button
                          onClick={handleVerify}
                          disabled={verificationCode.length !== 6 || verifyMutation.isPending}
                        >
                          {verifyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Verify"
                          )}
                        </Button>
                      </div>
                    </div>

                    {verifyMutation.isError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Invalid code. Please try again with a new code from your authenticator app.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Backup Codes Preview - shown after verification */}
                  {verifyMutation.data?.backupCodes && (
                    <div className="space-y-4 pt-4 border-t">
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          Two-factor authentication enabled! Save your backup codes below.
                        </AlertDescription>
                      </Alert>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Backup Codes</h4>
                          <p className="text-sm text-muted-foreground">
                            Save these codes in case you lose access to your authenticator app
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBackupCodes(!showBackupCodes)}
                        >
                          {showBackupCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>

                      {showBackupCodes && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                            {verifyMutation.data.backupCodes.map((code: string, i: number) => (
                              <div key={i} className="p-2 bg-background rounded">
                                {code}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(verifyMutation.data!.backupCodes!.join("\n"), "backup")}
                            >
                              {copiedBackupCodes ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                              Copy
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadBackupCodes(verifyMutation.data!.backupCodes!)}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enabled State - Management Options */}
      {mfaStatus?.enabled && (
        <>
          {/* Backup Codes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Backup Codes</CardTitle>
              <CardDescription>
                {mfaStatus.backupCodesRemaining !== undefined
                  ? `You have ${mfaStatus.backupCodesRemaining} backup codes remaining.`
                  : "Backup codes can be used if you lose access to your authenticator app."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Regenerating backup codes will invalidate all existing codes.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter 2FA code to regenerate"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="font-mono max-w-[200px]"
                />
                <Button
                  variant="outline"
                  onClick={handleRegenerateBackupCodes}
                  disabled={verificationCode.length !== 6 || regenerateBackupMutation.isPending}
                >
                  {regenerateBackupMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Regenerate Codes
                </Button>
              </div>

              {regenerateBackupMutation.data && (
                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-medium text-green-600">New backup codes generated!</p>
                  <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                    {regenerateBackupMutation.data.backupCodes.map((code, i) => (
                      <div key={i} className="p-2 bg-background rounded">
                        {code}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(regenerateBackupMutation.data!.backupCodes.join("\n"), "backup")}
                    >
                      {copiedBackupCodes ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadBackupCodes(regenerateBackupMutation.data!.backupCodes)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disable 2FA */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Disable Two-Factor Authentication</CardTitle>
              <CardDescription>
                This will remove the extra security layer from your account. You can re-enable it at any time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
                Disable 2FA
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              This will remove the extra security layer from your account. Enter your current 2FA code to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              className="font-mono text-center text-lg tracking-widest"
            />
            {disableMutation.isError && (
              <p className="mt-2 text-sm text-destructive">Invalid code. Please try again.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || disableMutation.isPending}
            >
              {disableMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Disable 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
