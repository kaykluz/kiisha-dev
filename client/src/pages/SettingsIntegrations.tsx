/**
 * Settings Integrations Page
 * 
 * Allows org admins to configure external service integrations.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Database, 
  Brain, 
  Mail, 
  MessageSquare, 
  Bell, 
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  ExternalLink,
  Copy,
  RefreshCw,
  Unplug,
  Loader2,
} from 'lucide-react';
import type { IntegrationType, ProviderOption } from '@shared/providers/types';

// Integration type metadata
const INTEGRATION_META: Record<IntegrationType, {
  icon: React.ElementType;
  title: string;
  description: string;
  category: 'core' | 'communication' | 'monitoring';
}> = {
  storage: {
    icon: Database,
    title: 'File Storage',
    description: 'Store and retrieve files, documents, and media',
    category: 'core',
  },
  llm: {
    icon: Brain,
    title: 'AI / LLM',
    description: 'AI-powered document parsing and analysis',
    category: 'core',
  },
  email_ingest: {
    icon: Mail,
    title: 'Email Ingestion',
    description: 'Receive documents via email forwarding',
    category: 'communication',
  },
  whatsapp: {
    icon: MessageSquare,
    title: 'WhatsApp',
    description: 'Receive documents and updates via WhatsApp',
    category: 'communication',
  },
  notify: {
    icon: Bell,
    title: 'Notifications',
    description: 'Send email notifications to users',
    category: 'communication',
  },
  observability: {
    icon: Activity,
    title: 'Observability',
    description: 'Error tracking and performance monitoring',
    category: 'monitoring',
  },
  maps: {
    icon: Settings,
    title: 'Maps',
    description: 'Location services and mapping',
    category: 'core',
  },
};

interface IntegrationCardProps {
  type: IntegrationType;
  status?: {
    configured: boolean;
    provider?: string;
    status?: string;
    lastTestAt?: Date | null;
    lastTestSuccess?: boolean | null;
  };
  onConfigure: () => void;
  onTest: () => void;
  onDisconnect: () => void;
  isLoading?: boolean;
}

function IntegrationCard({ type, status, onConfigure, onTest, onDisconnect, isLoading }: IntegrationCardProps) {
  const meta = INTEGRATION_META[type];
  const Icon = meta.icon;
  
  const getStatusBadge = () => {
    if (!status?.configured) {
      return <Badge variant="secondary">Not Configured</Badge>;
    }
    if (status.status === 'connected') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Connected</Badge>;
    }
    if (status.status === 'error') {
      return <Badge variant="destructive">Error</Badge>;
    }
    return <Badge variant="secondary">{status.status}</Badge>;
  };
  
  const getStatusIcon = () => {
    if (!status?.configured) {
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
    if (status.status === 'connected') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (status.status === 'error') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{meta.title}</CardTitle>
              <CardDescription className="text-sm">{meta.description}</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getStatusIcon()}
            {status?.provider && (
              <span className="capitalize">{status.provider}</span>
            )}
            {status?.lastTestAt && (
              <span className="text-xs">
                Last tested: {new Date(status.lastTestAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status?.configured && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onTest}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-1">Test</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onDisconnect}
                  className="text-destructive hover:text-destructive"
                >
                  <Unplug className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={onConfigure}>
              <Settings className="h-4 w-4 mr-1" />
              Configure
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConfigureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationType: IntegrationType | null;
  organizationId: number;
  currentProvider?: string;
}

function ConfigureDialog({ open, onOpenChange, integrationType, organizationId, currentProvider }: ConfigureDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>(currentProvider || '');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'provider' | 'config' | 'webhook'>('provider');
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; secret?: string; verifyToken?: string } | null>(null);
  
  const utils = trpc.useUtils();
  
  const { data: providerOptions } = trpc.integrations.getProviderOptions.useQuery(
    { integrationType: integrationType! },
    { enabled: !!integrationType }
  );
  
  const configureMutation = trpc.integrations.configure.useMutation({
    onSuccess: (result) => {
      if (result.webhookConfig) {
        setWebhookInfo(result.webhookConfig);
        setStep('webhook');
      } else {
        toast.success('Integration configured successfully');
        onOpenChange(false);
        utils.integrations.list.invalidate();
      }
    },
    onError: (error) => {
      toast.error(`Failed to configure: ${error.message}`);
    },
  });
  
  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    setConfig({});
    setSecrets({});
    setStep('config');
  };
  
  const handleConfigure = () => {
    if (!integrationType || !selectedProvider) return;
    
    configureMutation.mutate({
      organizationId,
      integrationType,
      provider: selectedProvider,
      config,
      secrets,
    });
  };
  
  const handleClose = () => {
    setStep('provider');
    setSelectedProvider(currentProvider || '');
    setConfig({});
    setSecrets({});
    setWebhookInfo(null);
    onOpenChange(false);
    utils.integrations.list.invalidate();
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };
  
  if (!integrationType) return null;
  
  const meta = INTEGRATION_META[integrationType];
  const selectedProviderInfo = providerOptions?.find(p => p.id === selectedProvider);
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.icon className="h-5 w-5" />
            Configure {meta.title}
          </DialogTitle>
          <DialogDescription>
            {step === 'provider' && 'Select a provider for this integration'}
            {step === 'config' && `Configure ${selectedProviderInfo?.name || selectedProvider}`}
            {step === 'webhook' && 'Complete webhook setup'}
          </DialogDescription>
        </DialogHeader>
        
        {step === 'provider' && (
          <div className="space-y-3">
            {providerOptions?.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={`w-full p-4 rounded-lg border text-left transition-colors hover:bg-accent ${
                  provider.isBuiltIn ? 'border-primary/50 bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{provider.name}</div>
                    <div className="text-sm text-muted-foreground">{provider.description}</div>
                  </div>
                  {provider.isBuiltIn && (
                    <Badge variant="secondary">Built-in</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {step === 'config' && selectedProviderInfo && (
          <div className="space-y-4">
            {selectedProviderInfo.isBuiltIn ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  This is a built-in provider. No additional configuration required.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {selectedProviderInfo.configFields?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type={field.type === 'password' ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={config[field.key] || ''}
                      onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                    />
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}
                
                {selectedProviderInfo.secretFields?.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={field.key}
                      type="password"
                      placeholder={field.placeholder}
                      value={secrets[field.key] || ''}
                      onChange={(e) => setSecrets({ ...secrets, [field.key]: e.target.value })}
                    />
                    {field.helpText && (
                      <p className="text-xs text-muted-foreground">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('provider')}>
                Back
              </Button>
              <Button 
                onClick={handleConfigure}
                disabled={configureMutation.isPending}
              >
                {configureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save & Test Connection
              </Button>
            </DialogFooter>
          </div>
        )}
        
        {step === 'webhook' && webhookInfo && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete the webhook setup in your provider's dashboard to start receiving data.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex items-center gap-2">
                  <Input value={webhookInfo.url} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookInfo.url)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {webhookInfo.verifyToken && (
                <div className="space-y-2">
                  <Label>Verify Token</Label>
                  <div className="flex items-center gap-2">
                    <Input value={webhookInfo.verifyToken} readOnly className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookInfo.verifyToken!)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsIntegrations() {
  const { user } = useAuth();
  const [configureType, setConfigureType] = useState<IntegrationType | null>(null);
  const [testingType, setTestingType] = useState<IntegrationType | null>(null);
  
  // For now, use a default org ID - in production, this would come from context
  const organizationId = 1;
  
  const { data, isLoading } = trpc.integrations.list.useQuery({ organizationId });
  const utils = trpc.useUtils();
  
  const testMutation = trpc.integrations.test.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      utils.integrations.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Test failed: ${error.message}`);
    },
    onSettled: () => {
      setTestingType(null);
    },
  });
  
  const disconnectMutation = trpc.integrations.disconnect.useMutation({
    onSuccess: () => {
      toast.success('Integration disconnected');
      utils.integrations.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });
  
  const handleTest = (type: IntegrationType) => {
    setTestingType(type);
    testMutation.mutate({ organizationId, integrationType: type });
  };
  
  const handleDisconnect = (type: IntegrationType) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      disconnectMutation.mutate({ organizationId, integrationType: type });
    }
  };
  
  const coreIntegrations: IntegrationType[] = ['storage', 'llm', 'maps'];
  const communicationIntegrations: IntegrationType[] = ['email_ingest', 'whatsapp', 'notify'];
  const monitoringIntegrations: IntegrationType[] = ['observability'];
  
  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="container py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to extend KIISHA's capabilities
        </p>
      </div>
      
      <Tabs defaultValue="core" className="space-y-6">
        <TabsList>
          <TabsTrigger value="core">Core Services</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>
        
        <TabsContent value="core" className="space-y-4">
          {coreIntegrations.map((type) => (
            <IntegrationCard
              key={type}
              type={type}
              status={data?.statusMap[type]}
              onConfigure={() => setConfigureType(type)}
              onTest={() => handleTest(type)}
              onDisconnect={() => handleDisconnect(type)}
              isLoading={testingType === type}
            />
          ))}
        </TabsContent>
        
        <TabsContent value="communication" className="space-y-4">
          {communicationIntegrations.map((type) => (
            <IntegrationCard
              key={type}
              type={type}
              status={data?.statusMap[type]}
              onConfigure={() => setConfigureType(type)}
              onTest={() => handleTest(type)}
              onDisconnect={() => handleDisconnect(type)}
              isLoading={testingType === type}
            />
          ))}
        </TabsContent>
        
        <TabsContent value="monitoring" className="space-y-4">
          {monitoringIntegrations.map((type) => (
            <IntegrationCard
              key={type}
              type={type}
              status={data?.statusMap[type]}
              onConfigure={() => setConfigureType(type)}
              onTest={() => handleTest(type)}
              onDisconnect={() => handleDisconnect(type)}
              isLoading={testingType === type}
            />
          ))}
        </TabsContent>
      </Tabs>
      
      <ConfigureDialog
        open={!!configureType}
        onOpenChange={(open) => !open && setConfigureType(null)}
        integrationType={configureType}
        organizationId={organizationId}
        currentProvider={configureType ? data?.statusMap[configureType]?.provider : undefined}
      />
    </div>
  );
}
