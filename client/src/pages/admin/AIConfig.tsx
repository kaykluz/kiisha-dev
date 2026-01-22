import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Settings, 
  Key, 
  DollarSign, 
  Activity, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Play,
  Zap,
  TrendingUp,
  Clock,
  ArrowUpDown,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", icon: "🤖", description: "GPT-4, GPT-3.5 models" },
  { id: "anthropic", name: "Anthropic", icon: "🧠", description: "Claude 3 models" },
  { id: "gemini", name: "Google Gemini", icon: "✨", description: "Gemini Pro, Flash models" },
  { id: "deepseek", name: "DeepSeek", icon: "🔍", description: "DeepSeek Chat, Coder, Reasoner" },
  { id: "azure_openai", name: "Azure OpenAI", icon: "☁️", description: "Azure-hosted OpenAI models" },
] as const;

type ProviderType = typeof PROVIDERS[number]["id"];

const TASK_TYPES = [
  { id: "DOC_EXTRACT_FIELDS", name: "Document Field Extraction", description: "Extract structured data from documents" },
  { id: "DOC_CLASSIFY", name: "Document Classification", description: "Classify document types" },
  { id: "CHAT_RESPONSE", name: "Chat Response", description: "Generate conversational responses" },
  { id: "RFI_DRAFT_RESPONSE", name: "RFI Draft Response", description: "Draft responses to RFIs" },
  { id: "INTENT_CLASSIFY", name: "Intent Classification", description: "Classify user intent" },
  { id: "VATR_EXTRACT", name: "VATR Extraction", description: "Extract VATR asset data" },
  { id: "SUMMARIZE", name: "Summarization", description: "Summarize documents or text" },
  { id: "TRANSLATE", name: "Translation", description: "Translate content between languages" },
] as const;

export default function AIConfig() {
  const [activeTab, setActiveTab] = useState("providers");
  
  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">Manage AI providers, routing, and budgets</p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="providers" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="routing" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Routing
          </TabsTrigger>
          <TabsTrigger value="budgets" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budgets
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Usage
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="providers">
          <ProvidersPanel />
        </TabsContent>
        
        <TabsContent value="routing">
          <RoutingPanel />
        </TabsContent>
        
        <TabsContent value="budgets">
          <BudgetsPanel />
        </TabsContent>
        
        <TabsContent value="usage">
          <UsagePanel />
        </TabsContent>
        
        <TabsContent value="audit">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Providers Panel - Enhanced with Testing
// ============================================================================

function ProvidersPanel() {
  const { data: providers, isLoading, refetch } = trpc.aiAdmin.listProviders.useQuery();
  const setSecret = trpc.aiAdmin.setProviderSecret.useMutation({
    onSuccess: () => {
      toast.success("API key saved successfully");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const validateProvider = trpc.aiAdmin.validateProvider.useMutation();
  const testCompletion = trpc.aiAdmin.testProviderCompletion.useMutation();
  const disableProvider = trpc.aiAdmin.disableProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider disabled");
      refetch();
    },
  });
  
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    provider: string;
    valid?: boolean;
    models?: string[];
    latencyMs?: number;
    error?: string;
    testResponse?: string;
    testTokens?: number;
    testLatency?: number;
  } | null>(null);
  const [testPrompt, setTestPrompt] = useState("Say 'Hello' in one word.");
  
  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey) return;
    await setSecret.mutateAsync({ provider: selectedProvider, apiKey });
    
    // Auto-validate after saving
    const result = await validateProvider.mutateAsync({ provider: selectedProvider });
    setTestResult({
      provider: selectedProvider,
      valid: result.valid,
      models: result.models,
      latencyMs: result.latencyMs,
      error: result.error,
    });
    
    if (result.valid) {
      toast.success(`${selectedProvider} validated successfully! ${result.models?.length || 0} models available.`);
    } else {
      toast.error(`Validation failed: ${result.error}`);
    }
    
    setApiKey("");
    setShowKey(false);
    refetch();
  };
  
  const handleTestCompletion = async (provider: ProviderType) => {
    const result = await testCompletion.mutateAsync({ provider, prompt: testPrompt });
    if (result.success) {
      setTestResult(prev => ({
        ...prev,
        provider,
        testResponse: result.response,
        testTokens: result.tokensUsed,
        testLatency: result.latencyMs,
      }));
      toast.success(`Test completed in ${result.latencyMs}ms`);
    } else {
      toast.error(`Test failed: ${result.error}`);
    }
  };
  
  const handleValidate = async (provider: ProviderType) => {
    const result = await validateProvider.mutateAsync({ provider });
    setTestResult({
      provider,
      valid: result.valid,
      models: result.models,
      latencyMs: result.latencyMs,
      error: result.error,
    });
    
    if (result.valid) {
      toast.success(`Validated! ${result.models?.length || 0} models available (${result.latencyMs}ms)`);
    } else {
      toast.error(`Validation failed: ${result.error}`);
    }
    refetch();
  };
  
  const getProviderStatus = (providerId: string) => {
    const provider = providers?.find(p => p.provider === providerId);
    if (!provider) return { status: "not_configured", hasKey: false };
    return { status: provider.status, hasKey: provider.hasApiKey };
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Providers</CardTitle>
          <CardDescription>
            Configure API keys for different AI providers. Test credentials before enabling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {PROVIDERS.map((provider) => {
              const status = getProviderStatus(provider.id);
              const isCurrentTest = testResult?.provider === provider.id;
              
              return (
                <div 
                  key={provider.id}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{provider.icon}</span>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-sm text-muted-foreground">{provider.description}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {status.status === "enabled" && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      )}
                      {status.status === "disabled" && (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                      {status.status === "invalid" && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Invalid
                        </Badge>
                      )}
                      {status.status === "not_configured" && (
                        <Badge variant="outline">Not Configured</Badge>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setShowKeyDialog(true);
                          setTestResult(null);
                        }}
                      >
                        <Key className="h-4 w-4 mr-1" />
                        {status.hasKey ? "Update Key" : "Add Key"}
                      </Button>
                      
                      {status.hasKey && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleValidate(provider.id)}
                            disabled={validateProvider.isPending}
                          >
                            {validateProvider.isPending && validateProvider.variables?.provider === provider.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestCompletion(provider.id)}
                            disabled={testCompletion.isPending}
                          >
                            {testCompletion.isPending && testCompletion.variables?.provider === provider.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          
                          {status.status === "enabled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disableProvider.mutate({ provider: provider.id })}
                            >
                              Disable
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Test Results */}
                  {isCurrentTest && testResult && (
                    <div className="mt-3 p-3 rounded-md bg-muted/50 space-y-2">
                      {testResult.valid !== undefined && (
                        <div className="flex items-center gap-2">
                          {testResult.valid ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {testResult.valid ? "Credentials valid" : `Invalid: ${testResult.error}`}
                          </span>
                          {testResult.latencyMs && (
                            <Badge variant="outline" className="ml-2">
                              <Clock className="h-3 w-3 mr-1" />
                              {testResult.latencyMs}ms
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {testResult.models && testResult.models.length > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Available models: </span>
                          <span className="font-mono text-xs">
                            {testResult.models.slice(0, 5).join(", ")}
                            {testResult.models.length > 5 && ` +${testResult.models.length - 5} more`}
                          </span>
                        </div>
                      )}
                      
                      {testResult.testResponse && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Test response: </span>
                          <span className="font-medium">"{testResult.testResponse}"</span>
                          {testResult.testTokens && (
                            <Badge variant="outline" className="ml-2">
                              {testResult.testTokens} tokens
                            </Badge>
                          )}
                          {testResult.testLatency && (
                            <Badge variant="outline" className="ml-1">
                              {testResult.testLatency}ms
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Add Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Configure {PROVIDERS.find(p => p.id === selectedProvider)?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your API key. It will be encrypted and stored securely. After saving, we'll automatically validate the credentials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="testPrompt">Test Prompt (optional)</Label>
              <Textarea
                id="testPrompt"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a test prompt..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Used to verify the API key works with a real completion request
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveKey} disabled={!apiKey || setSecret.isPending || validateProvider.isPending}>
              {(setSecret.isPending || validateProvider.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save & Validate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Routing Panel - Enhanced with Visual Editor
// ============================================================================

function RoutingPanel() {
  const { data: config, isLoading, refetch } = trpc.aiAdmin.getGlobalConfig.useQuery();
  const updateConfig = trpc.aiAdmin.updateGlobalConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuration updated");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const [defaultProvider, setDefaultProvider] = useState("forge");
  const [maxRetries, setMaxRetries] = useState(3);
  const [taskRoutes, setTaskRoutes] = useState<Array<{
    task: string;
    provider: string;
    model: string;
    priority: number;
  }>>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ task: "", provider: "forge", model: "", priority: 1 });
  
  useEffect(() => {
    if (config) {
      setDefaultProvider(config.defaultProvider || "forge");
      setMaxRetries(config.maxRetries || 3);
      // Parse existing routing rules
      const rules = Object.entries(config.routingRules || {}).map(([task, route]: [string, any]) => ({
        task,
        provider: route.provider || "forge",
        model: route.model || "",
        priority: route.priority || 1,
      }));
      setTaskRoutes(rules);
    }
  }, [config]);
  
  const handleSaveConfig = () => {
    const routingRules: Record<string, any> = {};
    taskRoutes.forEach(route => {
      routingRules[route.task] = {
        provider: route.provider,
        model: route.model,
        priority: route.priority,
      };
    });
    
    updateConfig.mutate({ 
      defaultProvider, 
      maxRetries,
      routingRules,
    });
  };
  
  const handleAddRule = () => {
    if (!newRule.task) return;
    setTaskRoutes([...taskRoutes, { ...newRule }]);
    setNewRule({ task: "", provider: "forge", model: "", priority: 1 });
    setShowAddRule(false);
  };
  
  const handleRemoveRule = (index: number) => {
    setTaskRoutes(taskRoutes.filter((_, i) => i !== index));
  };
  
  const handleUpdateRule = (index: number, field: string, value: any) => {
    const updated = [...taskRoutes];
    updated[index] = { ...updated[index], [field]: value };
    setTaskRoutes(updated);
  };
  
  const moveRule = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= taskRoutes.length) return;
    
    const updated = [...taskRoutes];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setTaskRoutes(updated);
  };
  
  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Default Routing</CardTitle>
          <CardDescription>
            Configure how AI requests are routed to providers when no task-specific rule matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Provider</Label>
              <Select value={defaultProvider} onValueChange={setDefaultProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forge">Forge (Manus Built-in)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used when no task-specific routing is configured
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Max Retries</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Number of retry attempts before failing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Task-Specific Routing Rules</CardTitle>
            <CardDescription>
              Override the default provider for specific task types. Rules are evaluated in order (higher priority first).
            </CardDescription>
          </div>
          <Button onClick={() => setShowAddRule(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {taskRoutes.length > 0 ? (
            <div className="space-y-2">
              {taskRoutes
                .sort((a, b) => b.priority - a.priority)
                .map((route, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => moveRule(index, "up")}
                        disabled={index === 0}
                      >
                        <ArrowUpDown className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <Select 
                        value={route.task} 
                        onValueChange={(v) => handleUpdateRule(index, "task", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select task" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_TYPES.map(task => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select 
                        value={route.provider} 
                        onValueChange={(v) => handleUpdateRule(index, "provider", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="forge">Forge</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="deepseek">DeepSeek</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Input
                        placeholder="Model (optional)"
                        value={route.model}
                        onChange={(e) => handleUpdateRule(index, "model", e.target.value)}
                      />
                      
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={route.priority}
                          onChange={(e) => handleUpdateRule(index, "priority", parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <span className="text-xs text-muted-foreground">Priority</span>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRule(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No custom routing rules. All tasks will use the default provider.
            </div>
          )}
          
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveConfig} disabled={updateConfig.isPending}>
              {updateConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save All Changes
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Rule Dialog */}
      <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Routing Rule</DialogTitle>
            <DialogDescription>
              Create a new task-specific routing rule.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Type</Label>
              <Select value={newRule.task} onValueChange={(v) => setNewRule({ ...newRule, task: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      <div>
                        <div>{task.name}</div>
                        <div className="text-xs text-muted-foreground">{task.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={newRule.provider} onValueChange={(v) => setNewRule({ ...newRule, provider: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forge">Forge (Manus Built-in)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Model (optional)</Label>
              <Input
                value={newRule.model}
                onChange={(e) => setNewRule({ ...newRule, model: e.target.value })}
                placeholder="e.g., gpt-4-turbo, claude-3-opus"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={newRule.priority}
                onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                Higher priority rules are evaluated first
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRule(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={!newRule.task}>
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Budgets Panel
// ============================================================================

function BudgetsPanel() {
  const { data: budgets, isLoading, refetch } = trpc.aiAdmin.listOrgBudgets.useQuery({});
  const setBudget = trpc.aiAdmin.setOrgBudget.useMutation({
    onSuccess: () => {
      toast.success("Budget updated");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [allocatedTokens, setAllocatedTokens] = useState(1000000);
  const [softLimitPercent, setSoftLimitPercent] = useState(80);
  const [overageAllowed, setOverageAllowed] = useState(false);
  
  const handleSaveBudget = () => {
    if (!selectedOrgId) return;
    setBudget.mutate({
      orgId: selectedOrgId,
      allocatedTokens,
      softLimitPercent,
      overageAllowed,
    });
    setShowBudgetDialog(false);
  };
  
  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Organization Budgets</CardTitle>
            <CardDescription>
              Manage token budgets for each organization.
            </CardDescription>
          </div>
          <Button onClick={() => {
            setSelectedOrgId(1);
            setShowBudgetDialog(true);
          }}>
            Add Budget
          </Button>
        </CardHeader>
        <CardContent>
          {budgets && budgets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Allocated</TableHead>
                  <TableHead>Consumed</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow key={budget.orgId}>
                    <TableCell>Org #{budget.orgId}</TableCell>
                    <TableCell>{budget.allocatedTokens.toLocaleString()}</TableCell>
                    <TableCell>{budget.consumedTokens.toLocaleString()}</TableCell>
                    <TableCell>{budget.remainingTokens.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={Math.min(budget.percentUsed, 100)} 
                          className={`w-24 ${budget.percentUsed > 80 ? '[&>div]:bg-red-500' : ''}`}
                        />
                        <span className="text-sm">{budget.percentUsed.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedOrgId(budget.orgId);
                          setAllocatedTokens(budget.allocatedTokens);
                          setSoftLimitPercent(budget.softLimitPercent || 80);
                          setOverageAllowed(budget.overageAllowed || false);
                          setShowBudgetDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No budgets configured. Organizations will use unlimited tokens.
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure Budget</DialogTitle>
            <DialogDescription>
              Set token budget for Organization #{selectedOrgId}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Allocated Tokens</Label>
              <Input
                type="number"
                value={allocatedTokens}
                onChange={(e) => setAllocatedTokens(parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Soft Limit (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={softLimitPercent}
                onChange={(e) => setSoftLimitPercent(parseInt(e.target.value) || 80)}
              />
              <p className="text-xs text-muted-foreground">
                Warning will be shown when usage exceeds this percentage
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Overage</Label>
                <p className="text-xs text-muted-foreground">
                  Allow requests after budget is exhausted
                </p>
              </div>
              <Switch
                checked={overageAllowed}
                onCheckedChange={setOverageAllowed}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBudget} disabled={setBudget.isPending}>
              {setBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Usage Panel - Enhanced with Real-time Dashboard
// ============================================================================

function UsagePanel() {
  const [groupBy, setGroupBy] = useState<"org" | "task" | "provider" | "model">("provider");
  const [timePeriod, setTimePeriod] = useState<"hour" | "day" | "week" | "month">("day");
  const { data: stats, isLoading } = trpc.aiAdmin.getUsageStats.useQuery({ groupBy });
  const { data: metrics, refetch: refetchMetrics } = trpc.aiAdmin.getRealtimeMetrics.useQuery(undefined, {
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });
  const { data: timeSeries } = trpc.aiAdmin.getTokenUsageTimeSeries.useQuery({ period: timePeriod });
  const { data: costData } = trpc.aiAdmin.getCostEstimation.useQuery({});
  
  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      refetchMetrics();
    }, 10000);
    return () => clearInterval(interval);
  }, [refetchMetrics]);
  
  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Realtime Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalRequests?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalTokens?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Input + Output</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.avgLatencyMs?.toFixed(0) || 0}ms</div>
            <p className="text-xs text-muted-foreground">Response time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              Est. Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${costData?.totalCost?.toFixed(2) || "0.00"}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Cost by Provider */}
      {costData && costData.byProvider && costData.byProvider.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cost by Provider
            </CardTitle>
            <CardDescription>Token usage and estimated costs per provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {costData.byProvider.map((provider) => (
                <div key={provider.provider} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{provider.provider}</span>
                      <Badge variant="outline">{provider.callCount} calls</Badge>
                    </div>
                    <span className="font-mono">${provider.estimatedCost.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Input: {provider.inputTokens.toLocaleString()} tokens</span>
                    <span>Output: {provider.outputTokens.toLocaleString()} tokens</span>
                  </div>
                  <Progress 
                    value={(provider.totalTokens / (costData.totalTokens || 1)) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Time Series Chart Placeholder */}
      {timeSeries && timeSeries.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usage Over Time</CardTitle>
              <CardDescription>Token consumption trends</CardDescription>
            </div>
            <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as typeof timePeriod)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Last Hour</SelectItem>
                <SelectItem value="day">Last 24h</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {timeSeries.slice(-24).map((point, i) => {
                const maxTokens = Math.max(...timeSeries.map(p => p.tokens));
                const height = maxTokens > 0 ? (point.tokens / maxTokens) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${point.timestamp}: ${point.tokens.toLocaleString()} tokens`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{timeSeries[0]?.timestamp}</span>
              <span>{timeSeries[timeSeries.length - 1]?.timestamp}</span>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Usage Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Usage Breakdown</CardTitle>
            <CardDescription>Token usage grouped by different dimensions</CardDescription>
          </div>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="org">By Organization</SelectItem>
              <SelectItem value="task">By Task</SelectItem>
              <SelectItem value="provider">By Provider</SelectItem>
              <SelectItem value="model">By Model</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {stats && stats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{groupBy === "org" ? "Organization" : groupBy === "task" ? "Task" : groupBy === "provider" ? "Provider" : "Model"}</TableHead>
                  <TableHead>Total Tokens</TableHead>
                  <TableHead>Estimated Cost</TableHead>
                  <TableHead>Call Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => (
                  <TableRow key={stat.key}>
                    <TableCell className="font-mono">{stat.key}</TableCell>
                    <TableCell>{stat.totalTokens.toLocaleString()}</TableCell>
                    <TableCell>${stat.totalCost.toFixed(4)}</TableCell>
                    <TableCell>{stat.callCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No usage data available for this period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Audit Panel
// ============================================================================

function AuditPanel() {
  const [limit, setLimit] = useState(100);
  const { data: logs, isLoading } = trpc.aiAdmin.getAuditLog.useQuery({ limit });
  
  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>
          Track all AI operations for compliance and debugging.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>User #{log.userId}</TableCell>
                  <TableCell className="font-mono text-xs">{log.task}</TableCell>
                  <TableCell>{log.provider}</TableCell>
                  <TableCell>{log.totalTokens?.toLocaleString()}</TableCell>
                  <TableCell>{log.latencyMs}ms</TableCell>
                  <TableCell>
                    {log.success ? (
                      <Badge variant="default" className="bg-green-500">Success</Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No audit logs available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
