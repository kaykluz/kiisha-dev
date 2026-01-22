/**
 * Inverter Credentials Configuration Page
 * 
 * Admin interface for managing inverter vendor API credentials
 * and monitoring connection status.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Settings, Trash2, RefreshCw, CheckCircle, XCircle, 
  AlertTriangle, Zap, Activity, Clock, Server, Key, Eye, EyeOff
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';

const VENDORS = [
  { id: 'huawei', name: 'Huawei FusionSolar', logo: '🔆' },
  { id: 'sungrow', name: 'Sungrow iSolarCloud', logo: '☀️' },
  { id: 'sma', name: 'SMA Sunny Portal', logo: '🌞' },
  { id: 'growatt', name: 'Growatt ShineServer', logo: '🌱' },
  { id: 'solaredge', name: 'SolarEdge Monitoring', logo: '⚡' },
  { id: 'enphase', name: 'Enphase Enlighten', logo: '💡' },
];

interface Credential {
  id: number;
  vendor: string;
  name: string;
  status: 'active' | 'error' | 'inactive';
  lastSync: string | null;
  connectedAssets: number;
  errorMessage?: string;
}

export default function InverterConfig() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  
  // Form state for new credential
  const [formData, setFormData] = useState({
    name: '',
    apiKey: '',
    apiSecret: '',
    username: '',
    password: '',
    baseUrl: '',
  });
  
  // Mock credentials data
  const credentials: Credential[] = [
    { id: 1, vendor: 'huawei', name: 'Main Huawei Account', status: 'active', lastSync: '2024-01-19T10:30:00Z', connectedAssets: 15 },
    { id: 2, vendor: 'sungrow', name: 'Sungrow Production', status: 'error', lastSync: '2024-01-18T15:45:00Z', connectedAssets: 8, errorMessage: 'API rate limit exceeded' },
    { id: 3, vendor: 'sma', name: 'SMA Europe', status: 'active', lastSync: '2024-01-19T10:25:00Z', connectedAssets: 12 },
  ];
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'inactive':
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20"><AlertTriangle className="w-3 h-3 mr-1" />Inactive</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getVendorInfo = (vendorId: string) => {
    return VENDORS.find(v => v.id === vendorId) || { id: vendorId, name: vendorId, logo: '🔌' };
  };
  
  const handleAddCredential = () => {
    toast.success('Credential added successfully');
    setIsAddDialogOpen(false);
    setFormData({ name: '', apiKey: '', apiSecret: '', username: '', password: '', baseUrl: '' });
    setSelectedVendor('');
  };
  
  const handleTestConnection = (id: number) => {
    toast.info('Testing connection...');
    setTimeout(() => {
      toast.success('Connection successful!');
    }, 2000);
  };
  
  const handleSyncNow = (id: number) => {
    toast.info('Starting sync...');
    setTimeout(() => {
      toast.success('Sync completed');
    }, 3000);
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Inverter Connections</h1>
            <p className="text-slate-400">Manage API credentials for inverter monitoring platforms</p>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                Add Connection
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-white">Add Inverter Connection</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Connect to an inverter monitoring platform to pull telemetry data.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Vendor Selection */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Platform</Label>
                  <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                    <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                      <SelectValue placeholder="Select inverter platform" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {VENDORS.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          <span className="flex items-center gap-2">
                            <span>{vendor.logo}</span>
                            <span>{vendor.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Connection Name */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Connection Name</Label>
                  <Input
                    placeholder="e.g., Main Production Account"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-900 border-slate-600 text-white"
                  />
                </div>
                
                {/* Credentials based on vendor */}
                {selectedVendor && (
                  <>
                    {['huawei', 'sungrow', 'growatt'].includes(selectedVendor) ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Username / Email</Label>
                          <Input
                            placeholder="Enter username or email"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="bg-slate-900 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Password</Label>
                          <Input
                            type="password"
                            placeholder="Enter password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="bg-slate-900 border-slate-600 text-white"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label className="text-slate-300">API Key</Label>
                          <Input
                            placeholder="Enter API key"
                            value={formData.apiKey}
                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                            className="bg-slate-900 border-slate-600 text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">API Secret</Label>
                          <Input
                            type="password"
                            placeholder="Enter API secret"
                            value={formData.apiSecret}
                            onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                            className="bg-slate-900 border-slate-600 text-white"
                          />
                        </div>
                      </>
                    )}
                    
                    {/* Custom Base URL (optional) */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        Custom API URL <span className="text-slate-500">(optional)</span>
                      </Label>
                      <Input
                        placeholder="Leave empty for default"
                        value={formData.baseUrl}
                        onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                        className="bg-slate-900 border-slate-600 text-white"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-slate-600">
                  Cancel
                </Button>
                <Button onClick={handleAddCredential} className="bg-orange-500 hover:bg-orange-600">
                  Add Connection
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total Connections</p>
                  <p className="text-2xl font-bold text-white">{credentials.length}</p>
                </div>
                <Server className="w-8 h-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Active</p>
                  <p className="text-2xl font-bold text-green-400">
                    {credentials.filter(c => c.status === 'active').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">With Errors</p>
                  <p className="text-2xl font-bold text-red-400">
                    {credentials.filter(c => c.status === 'error').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Connected Assets</p>
                  <p className="text-2xl font-bold text-white">
                    {credentials.reduce((sum, c) => sum + c.connectedAssets, 0)}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-orange-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Credentials List */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Configured Connections</CardTitle>
            <CardDescription className="text-slate-400">
              Manage your inverter platform API credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {credentials.map((cred) => {
                const vendor = getVendorInfo(cred.vendor);
                return (
                  <div 
                    key={cred.id}
                    className="p-4 bg-slate-900/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-2xl">
                          {vendor.logo}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-white">{cred.name}</h3>
                            {getStatusBadge(cred.status)}
                          </div>
                          <p className="text-sm text-slate-400">{vendor.name}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {cred.connectedAssets} assets
                            </span>
                            {cred.lastSync && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last sync: {new Date(cred.lastSync).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {cred.errorMessage && (
                            <p className="text-sm text-red-400 mt-2">
                              Error: {cred.errorMessage}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-slate-600"
                          onClick={() => handleTestConnection(cred.id)}
                        >
                          <Activity className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-slate-600"
                          onClick={() => handleSyncNow(cred.id)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Sync
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-slate-400 hover:text-white"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {credentials.length === 0 && (
                <div className="text-center py-12">
                  <Server className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No connections configured</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Add your first inverter connection to start monitoring
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Supported Platforms */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Supported Platforms</CardTitle>
            <CardDescription className="text-slate-400">
              Inverter monitoring platforms we can connect to
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {VENDORS.map((vendor) => (
                <div 
                  key={vendor.id}
                  className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-center hover:border-orange-500/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedVendor(vendor.id);
                    setIsAddDialogOpen(true);
                  }}
                >
                  <div className="text-3xl mb-2">{vendor.logo}</div>
                  <p className="text-sm text-white font-medium">{vendor.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
