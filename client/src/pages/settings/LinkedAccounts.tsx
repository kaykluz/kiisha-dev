import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Github, 
  Chrome, 
  Building2, 
  Mail, 
  Link2, 
  Unlink, 
  Loader2,
  Shield,
  CheckCircle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const providerIcons: Record<string, React.ReactNode> = {
  manus: <Building2 className="h-5 w-5" />,
  google: <Chrome className="h-5 w-5" />,
  github: <Github className="h-5 w-5" />,
  microsoft: <Building2 className="h-5 w-5" />,
  email: <Mail className="h-5 w-5" />
};

const providerNames: Record<string, string> = {
  manus: "Manus",
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
  email: "Email"
};

export default function LinkedAccounts() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const utils = trpc.useUtils();
  
  // Get linked accounts
  const { data: linkedAccounts, isLoading } = trpc.multiAuth.getLinkedAccounts.useQuery();
  
  // Get available providers
  const { data: providers } = trpc.multiAuth.getProviders.useQuery();

  // Link account mutation
  const getAuthUrlMutation = trpc.multiAuth.getAuthUrl.useMutation({
    onSuccess: (data) => {
      sessionStorage.setItem("oauth_state", data.state);
      sessionStorage.setItem("oauth_action", "link");
      window.location.href = data.url;
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  // Unlink account mutation
  const unlinkMutation = trpc.multiAuth.unlinkAccount.useMutation({
    onSuccess: () => {
      setSuccess("Account unlinked successfully");
      utils.multiAuth.getLinkedAccounts.invalidate();
    },
    onError: (err) => {
      setError(err.message);
    }
  });

  const handleLinkAccount = (provider: "google" | "github" | "microsoft") => {
    setError(null);
    setSuccess(null);
    const redirectUri = `${window.location.origin}/auth/callback/${provider}`;
    getAuthUrlMutation.mutate({
      provider,
      redirectUri,
      state: crypto.randomUUID()
    });
  };

  const handleUnlinkAccount = (provider: "google" | "github" | "microsoft") => {
    setError(null);
    setSuccess(null);
    unlinkMutation.mutate({ provider });
  };

  // Get providers that are not yet linked
  const linkedProviders = new Set(linkedAccounts?.map(a => a.provider) || []);
  const availableToLink = providers?.filter(
    p => !linkedProviders.has(p.provider) && 
         p.enabled && 
         p.provider !== "email" && 
         p.provider !== "manus"
  ) || [];

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Linked Accounts</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected authentication providers
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Security Notice */}
        <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-start gap-4 pt-6">
            <Shield className="h-6 w-6 text-amber-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-500">Security Tip</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Link multiple accounts to ensure you can always access your data. 
                If you lose access to one provider, you can still sign in with another.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Linked Accounts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              These accounts can be used to sign in to your KIISHA account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : linkedAccounts && linkedAccounts.length > 0 ? (
              <div className="space-y-4">
                {linkedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-muted">
                        {providerIcons[account.provider]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {providerNames[account.provider]}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            Connected
                          </Badge>
                        </div>
                        {account.linkedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Linked: {new Date(account.linkedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={unlinkMutation.isPending}
                        >
                          <Unlink className="h-4 w-4 mr-2" />
                          Unlink
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlink {providerNames[account.provider]}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will no longer be able to sign in with this {providerNames[account.provider]} account.
                            Make sure you have another way to access your account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleUnlinkAccount(account.provider as "google" | "github" | "microsoft")}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Unlink
                        </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No linked accounts yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Available to Link */}
        {availableToLink.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Link More Accounts</CardTitle>
              <CardDescription>
                Connect additional accounts for easier sign-in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {availableToLink.map((provider) => (
                  <div
                    key={provider.provider}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-muted">
                        {providerIcons[provider.provider]}
                      </div>
                      <span className="font-medium">{provider.name}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkAccount(provider.provider as "google" | "github" | "microsoft")}
                      disabled={getAuthUrlMutation.isPending}
                    >
                      {getAuthUrlMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Link Account
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
