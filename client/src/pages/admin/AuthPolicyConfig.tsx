import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Shield, 
  Users, 
  Link2, 
  Mail, 
  Lock, 
  Clock, 
  Globe,
  Loader2,
  CheckCircle,
  XCircle,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";

const PROVIDERS = [
  { id: "manus", name: "Manus", icon: "🏢", description: "Manus SSO" },
  { id: "google", name: "Google", icon: "🔵", description: "Google Workspace" },
  { id: "github", name: "GitHub", icon: "⚫", description: "GitHub OAuth" },
  { id: "microsoft", name: "Microsoft", icon: "🟦", description: "Microsoft Entra ID" },
  { id: "email", name: "Email", icon: "📧", description: "Email & Password" },
];

export default function AuthPolicyConfig() {
  const { user } = useAuth();
  const orgId = user?.activeOrgId || 1;
  
  const { data: policy, isLoading, refetch } = trpc.orgAuthPolicy.getPolicy.useQuery({ orgId });
  const updatePolicy = trpc.orgAuthPolicy.updatePolicy.useMutation({
    onSuccess: () => {
      toast.success("Auth policy updated successfully");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  // Local state for form
  const [allowedProviders, setAllowedProviders] = useState<string[]>([]);
  const [requireCompanyEmail, setRequireCompanyEmail] = useState(false);
  const [allowedEmailDomains, setAllowedEmailDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [allowSocialAccountLinking, setAllowSocialAccountLinking] = useState(true);
  const [maxLinkedAccounts, setMaxLinkedAccounts] = useState(5);
  const [requireMfa, setRequireMfa] = useState(false);
  const [mfaMethods, setMfaMethods] = useState<string[]>(["totp"]);
  const [maxSessionDurationHours, setMaxSessionDurationHours] = useState(720);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState(60);
  const [minPasswordLength, setMinPasswordLength] = useState(8);
  const [requirePasswordComplexity, setRequirePasswordComplexity] = useState(true);
  const [passwordExpiryDays, setPasswordExpiryDays] = useState<number | null>(null);
  const [allowedIpRanges, setAllowedIpRanges] = useState<string[]>([]);
  const [newIpRange, setNewIpRange] = useState("");
  
  // Sync state with fetched policy
  useEffect(() => {
    if (policy) {
      setAllowedProviders(policy.allowedProviders || ["manus", "google", "github", "microsoft", "email"]);
      setRequireCompanyEmail(policy.requireCompanyEmail || false);
      setAllowedEmailDomains(policy.allowedEmailDomains || []);
      setAllowSocialAccountLinking(policy.allowSocialAccountLinking ?? true);
      setMaxLinkedAccounts(policy.maxLinkedAccounts || 5);
      setRequireMfa(policy.requireMfa || false);
      setMfaMethods(policy.mfaMethods || ["totp"]);
      setMaxSessionDurationHours(policy.maxSessionDurationHours || 720);
      setIdleTimeoutMinutes(policy.idleTimeoutMinutes || 60);
      setMinPasswordLength(policy.minPasswordLength || 8);
      setRequirePasswordComplexity(policy.requirePasswordComplexity ?? true);
      setPasswordExpiryDays(policy.passwordExpiryDays || null);
      setAllowedIpRanges(policy.allowedIpRanges || []);
    }
  }, [policy]);
  
  const toggleProvider = (providerId: string) => {
    if (allowedProviders.includes(providerId)) {
      // Don't allow removing all providers
      if (allowedProviders.length === 1) {
        toast.error("At least one authentication provider must be enabled");
        return;
      }
      setAllowedProviders(allowedProviders.filter(p => p !== providerId));
    } else {
      setAllowedProviders([...allowedProviders, providerId]);
    }
  };
  
  const addEmailDomain = () => {
    if (!newDomain) return;
    const domain = newDomain.toLowerCase().replace(/^@/, "");
    if (allowedEmailDomains.includes(domain)) {
      toast.error("Domain already added");
      return;
    }
    setAllowedEmailDomains([...allowedEmailDomains, domain]);
    setNewDomain("");
  };
  
  const removeEmailDomain = (domain: string) => {
    setAllowedEmailDomains(allowedEmailDomains.filter(d => d !== domain));
  };
  
  const addIpRange = () => {
    if (!newIpRange) return;
    // Basic IP/CIDR validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(newIpRange)) {
      toast.error("Invalid IP address or CIDR range");
      return;
    }
    if (allowedIpRanges.includes(newIpRange)) {
      toast.error("IP range already added");
      return;
    }
    setAllowedIpRanges([...allowedIpRanges, newIpRange]);
    setNewIpRange("");
  };
  
  const removeIpRange = (ip: string) => {
    setAllowedIpRanges(allowedIpRanges.filter(i => i !== ip));
  };
  
  const handleSave = () => {
    updatePolicy.mutate({
      orgId,
      allowedProviders,
      requireCompanyEmail,
      allowedEmailDomains: allowedEmailDomains.length > 0 ? allowedEmailDomains : null,
      allowSocialAccountLinking,
      maxLinkedAccounts,
      requireMfa,
      mfaMethods: mfaMethods as ("totp" | "sms" | "email")[],
      maxSessionDurationHours,
      idleTimeoutMinutes,
      minPasswordLength,
      requirePasswordComplexity,
      passwordExpiryDays,
      allowedIpRanges: allowedIpRanges.length > 0 ? allowedIpRanges : null,
    });
  };
  
  if (isLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Authentication Policy</h1>
          <p className="text-muted-foreground">
            Control how users authenticate and link accounts in your organization
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="providers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="linking" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Account Linking
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="restrictions" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Restrictions
          </TabsTrigger>
        </TabsList>
        
        {/* Providers Tab */}
        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle>Allowed Authentication Providers</CardTitle>
              <CardDescription>
                Select which authentication methods users can use to sign in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-muted-foreground">{provider.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {allowedProviders.includes(provider.id) ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                    <Switch
                      checked={allowedProviders.includes(provider.id)}
                      onCheckedChange={() => toggleProvider(provider.id)}
                    />
                  </div>
                </div>
              ))}
              
              <Separator className="my-6" />
              
              {/* Company Email Requirement */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Require Company Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Only allow users with approved email domains to sign up
                    </p>
                  </div>
                  <Switch
                    checked={requireCompanyEmail}
                    onCheckedChange={setRequireCompanyEmail}
                  />
                </div>
                
                {requireCompanyEmail && (
                  <div className="pl-4 border-l-2 border-primary/20 space-y-3">
                    <Label>Allowed Email Domains</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="example.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addEmailDomain()}
                      />
                      <Button onClick={addEmailDomain} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allowedEmailDomains.map((domain) => (
                        <Badge key={domain} variant="secondary" className="gap-1">
                          @{domain}
                          <button onClick={() => removeEmailDomain(domain)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    {allowedEmailDomains.length === 0 && (
                      <p className="text-sm text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4" />
                        Add at least one domain to enforce this restriction
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Account Linking Tab */}
        <TabsContent value="linking">
          <Card>
            <CardHeader>
              <CardTitle>Social Account Linking</CardTitle>
              <CardDescription>
                Control whether users can link multiple authentication providers to their account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Allow Social Account Linking</Label>
                  <p className="text-sm text-muted-foreground">
                    Let users connect Google, GitHub, Microsoft accounts to their profile
                  </p>
                </div>
                <Switch
                  checked={allowSocialAccountLinking}
                  onCheckedChange={setAllowSocialAccountLinking}
                />
              </div>
              
              {allowSocialAccountLinking && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Maximum Linked Accounts</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxLinkedAccounts}
                      onChange={(e) => setMaxLinkedAccounts(parseInt(e.target.value) || 1)}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of social accounts a user can link (1-10)
                    </p>
                  </div>
                </div>
              )}
              
              {!allowSocialAccountLinking && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Users will only be able to sign in with their original authentication method
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Factor Authentication</CardTitle>
                <CardDescription>
                  Require additional verification for enhanced security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Require MFA</Label>
                    <p className="text-sm text-muted-foreground">
                      All users must set up two-factor authentication
                    </p>
                  </div>
                  <Switch
                    checked={requireMfa}
                    onCheckedChange={setRequireMfa}
                  />
                </div>
                
                {requireMfa && (
                  <div className="space-y-2">
                    <Label>Allowed MFA Methods</Label>
                    <div className="flex gap-4">
                      {[
                        { id: "totp", label: "Authenticator App" },
                        { id: "sms", label: "SMS" },
                        { id: "email", label: "Email" },
                      ].map((method) => (
                        <label key={method.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={mfaMethods.includes(method.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMfaMethods([...mfaMethods, method.id]);
                              } else {
                                if (mfaMethods.length === 1) {
                                  toast.error("At least one MFA method must be enabled");
                                  return;
                                }
                                setMfaMethods(mfaMethods.filter(m => m !== method.id));
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{method.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Password Policy</CardTitle>
                <CardDescription>
                  Set requirements for email/password authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Minimum Password Length</Label>
                    <Input
                      type="number"
                      min={6}
                      max={128}
                      value={minPasswordLength}
                      onChange={(e) => setMinPasswordLength(parseInt(e.target.value) || 8)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Password Expiry (days)</Label>
                    <Input
                      type="number"
                      min={30}
                      max={365}
                      value={passwordExpiryDays || ""}
                      onChange={(e) => setPasswordExpiryDays(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Never expires"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Require Password Complexity</Label>
                    <p className="text-sm text-muted-foreground">
                      Require uppercase, lowercase, numbers, and special characters
                    </p>
                  </div>
                  <Switch
                    checked={requirePasswordComplexity}
                    onCheckedChange={setRequirePasswordComplexity}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Session Policy</CardTitle>
                <CardDescription>
                  Control session duration and timeout settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Max Session Duration (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={8760}
                      value={maxSessionDurationHours}
                      onChange={(e) => setMaxSessionDurationHours(parseInt(e.target.value) || 720)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {maxSessionDurationHours} hours = {(maxSessionDurationHours / 24).toFixed(1)} days
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Idle Timeout (minutes)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={1440}
                      value={idleTimeoutMinutes}
                      onChange={(e) => setIdleTimeoutMinutes(parseInt(e.target.value) || 60)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Session expires after {idleTimeoutMinutes} minutes of inactivity
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Restrictions Tab */}
        <TabsContent value="restrictions">
          <Card>
            <CardHeader>
              <CardTitle>IP Address Restrictions</CardTitle>
              <CardDescription>
                Limit access to specific IP addresses or ranges (CIDR notation supported)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="192.168.1.0/24 or 10.0.0.1"
                  value={newIpRange}
                  onChange={(e) => setNewIpRange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addIpRange()}
                />
                <Button onClick={addIpRange} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {allowedIpRanges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allowedIpRanges.map((ip) => (
                    <Badge key={ip} variant="secondary" className="gap-1 font-mono">
                      {ip}
                      <button onClick={() => removeIpRange(ip)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No IP restrictions configured. Users can sign in from any IP address.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Save Button */}
      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} disabled={updatePolicy.isPending} size="lg">
          {updatePolicy.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Policy Changes
        </Button>
      </div>
    </div>
  );
}
