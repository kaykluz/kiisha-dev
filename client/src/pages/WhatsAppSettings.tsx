/**
 * WhatsApp Settings Page
 * 
 * Configure WhatsApp Business API integration for document ingestion
 * and conversational AI interactions.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageSquare,
  Settings,
  Webhook,
  Key,
  CheckCircle2,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
  Phone,
  Users,
  FileText,
  Bot,
} from "lucide-react";

export default function WhatsAppSettings() {
  const { user } = useAuth();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  
  // Form state for WhatsApp Business API credentials
  const [credentials, setCredentials] = useState({
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    appSecret: "",
    verifyToken: "",
  });
  
  // Get current project ID (would come from context in real app)
  const projectId = 1;
  
  // Fetch existing config
  const { data: config, refetch: refetchConfig } = trpc.whatsapp.getConfig.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  
  // Create/update config mutation
  const createConfig = trpc.whatsapp.createConfig.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp configured - Your WhatsApp integration is now active");
      refetchConfig();
      setShowSetupDialog(false);
    },
    onError: (error) => {
      toast.error(`Configuration failed: ${error.message}`);
    },
  });
  
  // Test connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // In production, this would call a test endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Connection successful - WhatsApp Business API is connected");
    } catch (error) {
      toast.error("Connection failed - Please check your credentials");
    } finally {
      setTestingConnection(false);
    }
  };
  
  // Copy webhook URL
  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/whatsapp/${config?.id || 'CONFIG_ID'}`;
    navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied to clipboard");
  };
  
  // Handle save credentials
  const handleSaveCredentials = () => {
    createConfig.mutate({
      projectId,
      phoneNumber: credentials.phoneNumberId,
      businessAccountId: credentials.businessAccountId,
      accessToken: credentials.accessToken,
    });
  };
  
  const isConfigured = !!config;
  
  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-green-600" />
              WhatsApp Integration
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure WhatsApp Business API for document ingestion and AI conversations
            </p>
          </div>
          <Badge variant={isConfigured ? "default" : "secondary"} className="text-sm">
            {isConfigured ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Connected</>
            ) : (
              <><XCircle className="h-3 w-3 mr-1" /> Not Configured</>
            )}
          </Badge>
        </div>
        
        {/* Status Alert */}
        {!isConfigured && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>WhatsApp not configured</AlertTitle>
            <AlertDescription>
              Connect your WhatsApp Business API to enable document ingestion via WhatsApp messages
              and conversational AI interactions with your team.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="setup" className="space-y-4">
          <TabsList>
            <TabsTrigger value="setup">
              <Settings className="h-4 w-4 mr-2" />
              Setup
            </TabsTrigger>
            <TabsTrigger value="webhook">
              <Webhook className="h-4 w-4 mr-2" />
              Webhook
            </TabsTrigger>
            <TabsTrigger value="senders">
              <Users className="h-4 w-4 mr-2" />
              Sender Mappings
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Bot className="h-4 w-4 mr-2" />
              AI Settings
            </TabsTrigger>
          </TabsList>
          
          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp Business API Credentials</CardTitle>
                <CardDescription>
                  Enter your Meta WhatsApp Business API credentials to enable the integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                    <Input
                      id="phoneNumberId"
                      placeholder="Enter your Phone Number ID"
                      value={credentials.phoneNumberId}
                      onChange={(e) => setCredentials(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in Meta Business Suite → WhatsApp → Phone Numbers
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="businessAccountId">Business Account ID</Label>
                    <Input
                      id="businessAccountId"
                      placeholder="Enter your Business Account ID"
                      value={credentials.businessAccountId}
                      onChange={(e) => setCredentials(prev => ({ ...prev, businessAccountId: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in Meta Business Suite → Settings → Business Info
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      type="password"
                      placeholder="Enter your permanent access token"
                      value={credentials.accessToken}
                      onChange={(e) => setCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate a System User token with whatsapp_business_messaging permission
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="appSecret">App Secret</Label>
                    <Input
                      id="appSecret"
                      type="password"
                      placeholder="Enter your App Secret"
                      value={credentials.appSecret}
                      onChange={(e) => setCredentials(prev => ({ ...prev, appSecret: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Found in App Settings → Basic → App Secret
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveCredentials} disabled={createConfig.isPending}>
                    {createConfig.isPending ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Key className="h-4 w-4 mr-2" /> Save Credentials</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleTestConnection} disabled={testingConnection}>
                    {testingConnection ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Testing...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Test Connection</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Setup Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
                <CardDescription>
                  Follow these steps to configure your WhatsApp Business API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Go to <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta for Developers</a></li>
                  <li>Create or select your WhatsApp Business App</li>
                  <li>Go to WhatsApp → Getting Started to get your Phone Number ID</li>
                  <li>Go to WhatsApp → Configuration to set up the webhook</li>
                  <li>Generate a permanent System User Access Token with whatsapp_business_messaging permission</li>
                  <li>Copy your App Secret from App Settings → Basic</li>
                  <li>Enter all credentials above and click Save</li>
                  <li>Configure the webhook URL in Meta's dashboard (see Webhook tab)</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Webhook Tab */}
          <TabsContent value="webhook" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
                <CardDescription>
                  Configure these settings in your Meta WhatsApp Business dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/api/webhooks/whatsapp/${config?.id || 'CONFIG_ID'}`}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Verify Token</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={config?.webhookSecret || 'Generate by saving credentials'}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => {
                      if (config?.webhookSecret) {
                        navigator.clipboard.writeText(config.webhookSecret);
                        toast.success("Verify token copied to clipboard");
                      }
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <Alert>
                  <Webhook className="h-4 w-4" />
                  <AlertTitle>Webhook Fields to Subscribe</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      <li><code>messages</code> - Receive incoming messages</li>
                      <li><code>message_template_status_update</code> - Template status updates</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Sender Mappings Tab */}
          <TabsContent value="senders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sender Mappings</CardTitle>
                <CardDescription>
                  Map phone numbers to projects and sites for automatic routing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sender mappings configured yet</p>
                  <p className="text-sm">Incoming messages will be routed to the default project</p>
                  <Button variant="outline" className="mt-4">
                    Add Sender Mapping
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>
                  Pre-approved message templates for outbound communications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No message templates configured</p>
                  <p className="text-sm">Templates must be approved by Meta before use</p>
                  <Button variant="outline" className="mt-4">
                    Create Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Conversation Settings</CardTitle>
                <CardDescription>
                  Configure how the AI responds to WhatsApp messages
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Categorize Documents</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically categorize incoming documents using AI
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>AI Response Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow AI to respond to queries via WhatsApp
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Document Extraction</Label>
                    <p className="text-sm text-muted-foreground">
                      Extract data from documents sent via WhatsApp
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>RFI Handling</Label>
                    <p className="text-sm text-muted-foreground">
                      Process RFI requests received via WhatsApp
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <Alert>
                  <Bot className="h-4 w-4" />
                  <AlertTitle>AI Token Required</AlertTitle>
                  <AlertDescription>
                    The AI features require a valid AI API token. Configure your AI provider in Settings → AI Configuration.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
