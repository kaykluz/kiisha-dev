import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Key, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Shield,
  Copy,
  Check,
} from "lucide-react";

const OAUTH_PROVIDERS = [
  { 
    id: "google", 
    name: "Google", 
    icon: "🔵",
    description: "Sign in with Google accounts",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    callbackPath: "/api/auth/callback/google",
    scopes: ["openid", "profile", "email"],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", placeholder: "GOCSPX-xxxxx", secret: true },
    ],
  },
  { 
    id: "github", 
    name: "GitHub", 
    icon: "⚫",
    description: "Sign in with GitHub accounts",
    docsUrl: "https://github.com/settings/developers",
    callbackPath: "/api/auth/callback/github",
    scopes: ["read:user", "user:email"],
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "Iv1.xxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxx", secret: true },
    ],
  },
  { 
    id: "microsoft", 
    name: "Microsoft", 
    icon: "🟦",
    description: "Sign in with Microsoft/Azure AD accounts",
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    callbackPath: "/api/auth/callback/microsoft",
    scopes: ["openid", "profile", "email", "User.Read"],
    fields: [
      { key: "clientId", label: "Application (client) ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", placeholder: "xxxxx", secret: true },
      { key: "tenantId", label: "Directory (tenant) ID", placeholder: "common or tenant-id" },
    ],
  },
] as const;

type ProviderId = typeof OAUTH_PROVIDERS[number]["id"];

export default function OAuthConfig() {
  const { data: configs, isLoading, refetch } = trpc.multiAuth.getOAuthConfigs.useQuery();
  const saveConfig = trpc.multiAuth.saveOAuthConfig.useMutation({
    onSuccess: () => {
      toast.success("OAuth configuration saved");
      refetch();
      setShowConfigDialog(false);
      setConfigValues({});
    },
    onError: (error) => toast.error(error.message),
  });
  const testConfig = trpc.multiAuth.testOAuthConfig.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("OAuth configuration is valid");
      } else {
        toast.error(`Configuration test failed: ${result.error}`);
      }
      refetch();
    },
  });
  const toggleProvider = trpc.multiAuth.toggleOAuthProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider status updated");
      refetch();
    },
  });
  
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  
  const getProviderConfig = (providerId: string) => {
    return configs?.find(c => c.provider === providerId);
  };
  
  const handleOpenConfig = (providerId: ProviderId) => {
    setSelectedProvider(providerId);
    const existing = getProviderConfig(providerId);
    if (existing) {
      setConfigValues({
        clientId: existing.clientId || "",
        tenantId: existing.tenantId || "",
        // Don't pre-fill secrets
      });
    } else {
      setConfigValues({});
    }
    setShowConfigDialog(true);
  };
  
  const handleSaveConfig = () => {
    if (!selectedProvider) return;
    
    const provider = OAUTH_PROVIDERS.find(p => p.id === selectedProvider);
    if (!provider) return;
    
    // Validate required fields
    const missingFields = provider.fields
      .filter(f => !configValues[f.key])
      .map(f => f.label);
    
    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(", ")}`);
      return;
    }
    
    saveConfig.mutate({
      provider: selectedProvider,
      clientId: configValues.clientId,
      clientSecret: configValues.clientSecret,
      tenantId: configValues.tenantId,
    });
  };
  
  const copyCallbackUrl = (path: string) => {
    const baseUrl = window.location.origin;
    navigator.clipboard.writeText(`${baseUrl}${path}`);
    setCopied(true);
    toast.success("Callback URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  
  const selectedProviderData = OAUTH_PROVIDERS.find(p => p.id === selectedProvider);
  
  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">OAuth Configuration</h1>
          <p className="text-muted-foreground">Configure social login providers for your application</p>
        </div>
      </div>
      
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          OAuth credentials are encrypted and stored securely. You'll need to create OAuth apps in each provider's developer console.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-4">
        {OAUTH_PROVIDERS.map((provider) => {
          const config = getProviderConfig(provider.id);
          const isConfigured = !!config?.clientId;
          const isEnabled = config?.enabled ?? false;
          const isValid = config?.lastTestSuccess ?? false;
          
          return (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <CardDescription>{provider.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isConfigured && (
                      <>
                        {isValid ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Invalid
                          </Badge>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`enable-${provider.id}`} className="text-sm">
                            {isEnabled ? "Enabled" : "Disabled"}
                          </Label>
                          <Switch
                            id={`enable-${provider.id}`}
                            checked={isEnabled}
                            onCheckedChange={(checked) => 
                              toggleProvider.mutate({ provider: provider.id, enabled: checked })
                            }
                          />
                        </div>
                      </>
                    )}
                    
                    {!isConfigured && (
                      <Badge variant="outline">Not Configured</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {isConfigured ? (
                      <span className="font-mono">Client ID: {config.clientId?.substring(0, 20)}...</span>
                    ) : (
                      <span>No credentials configured</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(provider.docsUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Developer Console
                    </Button>
                    
                    {isConfigured && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConfig.mutate({ provider: provider.id })}
                        disabled={testConfig.isPending}
                      >
                        {testConfig.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Test
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      onClick={() => handleOpenConfig(provider.id)}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      {isConfigured ? "Update" : "Configure"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{selectedProviderData?.icon}</span>
              Configure {selectedProviderData?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your OAuth credentials from the {selectedProviderData?.name} developer console.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Callback URL */}
            <div className="space-y-2">
              <Label>Callback URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}${selectedProviderData?.callbackPath}`}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCallbackUrl(selectedProviderData?.callbackPath || "")}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Add this URL to your OAuth app's authorized redirect URIs
              </p>
            </div>
            
            {/* Credential Fields */}
            {selectedProviderData?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <div className="relative">
                  <Input
                    id={field.key}
                    type={field.secret && !showSecrets[field.key] ? "password" : "text"}
                    value={configValues[field.key] || ""}
                    onChange={(e) => setConfigValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="pr-10"
                  />
                  {field.secret && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowSecrets(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                    >
                      {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            
            {/* Scopes Info */}
            <div className="space-y-2">
              <Label>Required Scopes</Label>
              <div className="flex flex-wrap gap-1">
                {selectedProviderData?.scopes.map((scope) => (
                  <Badge key={scope} variant="secondary" className="font-mono text-xs">
                    {scope}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These scopes are automatically requested during authentication
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={saveConfig.isPending}>
              {saveConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
