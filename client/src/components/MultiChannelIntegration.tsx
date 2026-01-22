import { useState } from 'react';
import { 
  MessageCircle, Mail, Key, Plus, Copy, Eye, EyeOff,
  Trash2, Settings, CheckCircle, AlertCircle, Loader2,
  Phone, FileText, Image, Music, Video, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════
// WhatsApp Feed Component
// ═══════════════════════════════════════════════════════════════

interface WhatsAppMessage {
  id: number;
  waMessageId: string | null;
  senderPhone: string | null;
  senderName?: string | null;
  messageType: string | null;
  messageContent?: string | null;
  mediaUrl?: string | null;
  receivedAt: Date | null;
  processingStatus: string | null;
}

interface WhatsAppFeedProps {
  projectId: number;
}

const MESSAGE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  text: MessageCircle,
  image: Image,
  audio: Music,
  video: Video,
  document: FileText,
};

export function WhatsAppFeed({ projectId }: WhatsAppFeedProps) {
  const messagesQuery = trpc.whatsapp.getMessages.useQuery({ projectId, limit: 50 });
  const configQuery = trpc.whatsapp.getConfig.useQuery({ projectId });
  
  const messages = messagesQuery.data || [];
  const config = configQuery.data;
  
  if (!config) {
    return (
      <div className="rounded-xl bg-card border border-border p-6 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold text-foreground mb-2">WhatsApp Not Configured</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set up WhatsApp integration to receive documents and updates via messaging.
        </p>
        <WhatsAppConfigDialog projectId={projectId} />
      </div>
    );
  }
  
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold text-foreground">WhatsApp Feed</h3>
          <Badge variant="outline" className="text-xs">
            {config.phoneNumber || 'Configured'}
          </Badge>
        </div>
        <WhatsAppConfigDialog projectId={projectId} config={config} />
      </div>
      
      {/* Messages */}
      <ScrollArea className="h-96">
        {messages.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Messages sent to your WhatsApp number will appear here
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {messages.map((message: WhatsAppMessage) => {
              const Icon = MESSAGE_TYPE_ICONS[message.messageType || 'text'] || MessageCircle;
              return (
                <div 
                  key={message.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Icon className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {message.senderName || message.senderPhone}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.receivedAt ? format(new Date(message.receivedAt), 'MMM d, h:mm a') : 'Unknown'}
                      </span>
                    </div>
                    {message.messageContent && (
                      <p className="text-sm text-foreground mt-1">
                        {message.messageContent}
                      </p>
                    )}
                    {message.mediaUrl && (
                      <a 
                        href={message.mediaUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View attachment
                      </a>
                    )}
                    <Badge 
                      variant="outline" 
                      className={`mt-2 text-xs ${
                        message.processingStatus === 'completed' 
                          ? 'text-success' 
                          : message.processingStatus === 'failed'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {message.processingStatus || 'pending'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// WhatsApp Config Dialog
function WhatsAppConfigDialog({ projectId, config }: { projectId: number; config?: any }) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(config?.phoneNumber || '');
  const [autoCategorize, setAutoCategorize] = useState(config?.autoCategorize ?? true);
  
  const createMutation = trpc.whatsapp.createConfig.useMutation({
    onSuccess: () => {
      toast.success('WhatsApp configured successfully');
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to configure WhatsApp');
    },
  });
  
  const handleSave = () => {
    createMutation.mutate({
      projectId,
      phoneNumber,
      autoCategorize,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Settings className="h-4 w-4" />
          {config ? 'Settings' : 'Configure'}
        </Button>
      </DialogTrigger>
      
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            WhatsApp Integration
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">WhatsApp Business Number</Label>
            <Input
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
            />
            <p className="text-xs text-muted-foreground">
              The WhatsApp Business number to receive messages
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-categorize Documents</Label>
              <p className="text-xs text-muted-foreground">
                Automatically categorize incoming documents using AI
              </p>
            </div>
            <Switch 
              checked={autoCategorize} 
              onCheckedChange={setAutoCategorize} 
            />
          </div>
          
          {config?.webhookSecret && (
            <div className="p-3 rounded-lg bg-muted">
              <Label className="text-xs">Webhook Secret</Label>
              <code className="block text-xs font-mono mt-1 text-muted-foreground">
                {config.webhookSecret}
              </code>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Email Integration Component
// ═══════════════════════════════════════════════════════════════

interface EmailIntegrationProps {
  projectId: number;
}

export function EmailIntegration({ projectId }: EmailIntegrationProps) {
  const configQuery = trpc.email.getConfig.useQuery({ projectId });
  const config = configQuery.data;
  
  const [open, setOpen] = useState(false);
  const [autoCategorize, setAutoCategorize] = useState(true);
  
  const createMutation = trpc.email.createConfig.useMutation({
    onSuccess: (data) => {
      toast.success('Email integration configured');
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to configure email');
    },
  });
  
  const handleCopyAddress = () => {
    if (config?.inboundAddress) {
      navigator.clipboard.writeText(config.inboundAddress);
      toast.success('Email address copied');
    }
  };
  
  return (
    <div className="rounded-xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Email Integration</h3>
        </div>
        {config && (
          <Badge variant="outline" className="text-xs text-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )}
      </div>
      
      {config ? (
        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-muted">
            <Label className="text-xs text-muted-foreground">Inbound Email Address</Label>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-mono text-foreground flex-1">
                {config.inboundAddress}
              </code>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyAddress}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Forward emails to this address to automatically ingest documents
          </p>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-3">
            Set up email forwarding to automatically ingest documents
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-1">
                <Plus className="h-4 w-4" />
                Configure Email
              </Button>
            </DialogTrigger>
            
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-accent" />
                  Email Integration
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  We'll generate a unique email address for this project. 
                  Forward emails to this address to automatically ingest attachments.
                </p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-categorize Documents</Label>
                    <p className="text-xs text-muted-foreground">
                      Use AI to categorize incoming documents
                    </p>
                  </div>
                  <Switch 
                    checked={autoCategorize} 
                    onCheckedChange={setAutoCategorize} 
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createMutation.mutate({ projectId, autoCategorize })}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Generate Email Address
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// API Keys Management Component
// ═══════════════════════════════════════════════════════════════

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string | null;
  scopes: string[] | null;
  rateLimitPerHour: number | null;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
}

interface ApiKeysManagerProps {
  organizationId?: number;
}

export function ApiKeysManager({ organizationId = 1 }: ApiKeysManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  
  const keysQuery = trpc.apiKeys.list.useQuery({ organizationId });
  const keys = keysQuery.data || [];
  
  const createMutation = trpc.apiKeys.create.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.apiKey);
      keysQuery.refetch();
    },
    onError: () => {
      toast.error('Failed to create API key');
    },
  });
  
  const revokeMutation = trpc.apiKeys.revoke.useMutation({
    onSuccess: () => {
      toast.success('API key revoked');
      keysQuery.refetch();
    },
    onError: () => {
      toast.error('Failed to revoke API key');
    },
  });
  
  const handleCreate = () => {
    createMutation.mutate({
      organizationId,
      name: newKeyName,
      scopes: newKeyScopes,
    });
  };
  
  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      toast.success('API key copied to clipboard');
    }
  };
  
  const handleCloseCreate = () => {
    setShowCreateDialog(false);
    setNewKeyName('');
    setCreatedKey(null);
    setShowKey(false);
  };
  
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">API Keys</h3>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-accent" />
                {createdKey ? 'API Key Created' : 'Create API Key'}
              </DialogTitle>
            </DialogHeader>
            
            {createdKey ? (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning font-medium mb-2">
                    Save this key now - you won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-muted p-2 rounded overflow-x-auto">
                      {showKey ? createdKey : '•'.repeat(40)}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCopyKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button onClick={handleCloseCreate}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Production API Key"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Scopes</Label>
                    <div className="flex flex-wrap gap-2">
                      {['read', 'write', 'admin'].map(scope => (
                        <Badge
                          key={scope}
                          variant={newKeyScopes.includes(scope) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setNewKeyScopes(prev => 
                              prev.includes(scope)
                                ? prev.filter(s => s !== scope)
                                : [...prev, scope]
                            );
                          }}
                        >
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCreate}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    disabled={!newKeyName || createMutation.isPending}
                  >
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Key
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Keys List */}
      <ScrollArea className="h-64">
        {keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No API keys yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create an API key to integrate with external systems
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {keys.map((key: ApiKey) => (
              <div 
                key={key.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${!key.revokedAt ? 'bg-success/10' : 'bg-muted'}`}>
                    <Key className={`h-4 w-4 ${!key.revokedAt ? 'text-success' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{key.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}...
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {key.scopes && (
                    <div className="flex gap-1">
                      {key.scopes.map(scope => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => revokeMutation.mutate({ id: key.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
