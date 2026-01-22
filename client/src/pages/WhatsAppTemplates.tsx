/**
 * WhatsApp Templates Management
 * 
 * Manage pre-approved WhatsApp Business templates for:
 * - Document status updates
 * - RFI reminders
 * - Alert notifications
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Plus,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Send,
  Edit,
  Trash2,
  Copy,
  FileText,
  AlertTriangle,
  Bell
} from 'lucide-react';

const TEMPLATE_CATEGORIES = [
  { value: 'document_status', label: 'Document Status', icon: FileText },
  { value: 'rfi_reminder', label: 'RFI Reminder', icon: Clock },
  { value: 'alert_notification', label: 'Alert Notification', icon: AlertTriangle },
  { value: 'general_update', label: 'General Update', icon: Bell },
];

export default function WhatsAppTemplates() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: '',
    language: 'en',
    body: '',
    headerText: '',
    footerText: '',
  });

  // Fetch templates - using configId 1 as default for now
  const { data: templates, refetch: refetchTemplates } = trpc.whatsapp.getTemplates.useQuery({ configId: 1 });

  // Mutations
  const createTemplate = trpc.whatsapp.createTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template created');
      refetchTemplates();
      setCreateDialogOpen(false);
      setNewTemplate({ name: '', category: '', language: 'en', body: '', headerText: '', footerText: '' });
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const deleteTemplate = trpc.whatsapp.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template deleted');
      refetchTemplates();
    },
    onError: (err) => toast.error('Error', { description: err.message }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = TEMPLATE_CATEGORIES.find(c => c.value === category);
    if (cat) {
      const Icon = cat.icon;
      return <Icon className="w-4 h-4" />;
    }
    return <MessageSquare className="w-4 h-4" />;
  };

  const handleCreate = () => {
    if (!newTemplate.name || !newTemplate.category || !newTemplate.body) {
      toast.error('Please fill in all required fields');
      return;
    }
    createTemplate.mutate({
      configId: 1, // Default config ID
      templateName: newTemplate.name,
      templateType: 'text',
      content: {
        category: newTemplate.category,
        language: newTemplate.language,
        body: newTemplate.body,
        headerText: newTemplate.headerText || undefined,
        footerText: newTemplate.footerText || undefined,
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              WhatsApp Templates
            </h1>
            <p className="text-muted-foreground">
              Manage pre-approved WhatsApp Business message templates
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetchTemplates()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create WhatsApp Template</DialogTitle>
                  <DialogDescription>
                    Create a new message template. Templates must be approved by WhatsApp before use.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Template Name *</Label>
                      <Input
                        id="name"
                        placeholder="e.g., document_status_update"
                        value={newTemplate.name}
                        onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use lowercase with underscores
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={newTemplate.category}
                        onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <cat.icon className="w-4 h-4" />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={newTemplate.language}
                      onValueChange={(v) => setNewTemplate({ ...newTemplate, language: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="pt">Portuguese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="header">Header Text (optional)</Label>
                    <Input
                      id="header"
                      placeholder="e.g., KIISHA Document Update"
                      value={newTemplate.headerText}
                      onChange={(e) => setNewTemplate({ ...newTemplate, headerText: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="body">Message Body *</Label>
                    <Textarea
                      id="body"
                      placeholder="Hello {{1}}, your document {{2}} has been {{3}}."
                      value={newTemplate.body}
                      onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{{1}}'}, {'{{2}}'}, etc. for dynamic variables
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="footer">Footer Text (optional)</Label>
                    <Input
                      id="footer"
                      placeholder="e.g., Reply STOP to unsubscribe"
                      value={newTemplate.footerText}
                      onChange={(e) => setNewTemplate({ ...newTemplate, footerText: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={createTemplate.isPending}>
                    {createTemplate.isPending ? 'Creating...' : 'Create Template'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Template Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((template: any) => (
            <Card key={template.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(template.category)}
                    <CardTitle className="text-sm font-medium">
                      {template.name}
                    </CardTitle>
                  </div>
                  {getStatusBadge(template.status)}
                </div>
                <CardDescription className="text-xs">
                  {TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                  {' • '}{template.language.toUpperCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.headerText && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Header:</span> {template.headerText}
                  </div>
                )}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap">{template.body}</p>
                </div>
                {template.footerText && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Footer:</span> {template.footerText}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(template.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(template.body);
                        toast.success('Template body copied');
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm('Delete this template?')) {
                          deleteTemplate.mutate({ templateId: template.id });
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!templates || templates.length === 0) && (
            <Card className="col-span-full">
              <CardContent className="p-8 text-center text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No templates found</p>
                <p className="text-sm">Create your first WhatsApp template to get started</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Pre-built Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pre-built Templates</CardTitle>
            <CardDescription>
              Common templates for KIISHA workflows. Click to use as a starting point.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setNewTemplate({
                    name: 'document_status_update',
                    category: 'document_status',
                    language: 'en',
                    body: 'Hello {{1}},\n\nYour document "{{2}}" for project {{3}} has been {{4}}.\n\nView details: {{5}}',
                    headerText: 'KIISHA Document Update',
                    footerText: 'Reply HELP for assistance',
                  });
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span className="font-medium text-sm">Document Status Update</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Notify users when documents are verified, rejected, or need revision
                </p>
              </div>
              <div 
                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setNewTemplate({
                    name: 'rfi_reminder',
                    category: 'rfi_reminder',
                    language: 'en',
                    body: 'Hello {{1}},\n\nReminder: RFI "{{2}}" for {{3}} is due on {{4}}.\n\nPlease respond at your earliest convenience.\n\nView RFI: {{5}}',
                    headerText: 'KIISHA RFI Reminder',
                    footerText: '',
                  });
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium text-sm">RFI Reminder</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send reminders for pending RFIs with due dates
                </p>
              </div>
              <div 
                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setNewTemplate({
                    name: 'alert_notification',
                    category: 'alert_notification',
                    language: 'en',
                    body: '⚠️ Alert: {{1}}\n\nProject: {{2}}\nSeverity: {{3}}\nDetails: {{4}}\n\nAction required: {{5}}',
                    headerText: 'KIISHA Alert',
                    footerText: '',
                  });
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="font-medium text-sm">Alert Notification</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Critical alerts for compliance issues or system events
                </p>
              </div>
              <div 
                className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setNewTemplate({
                    name: 'weekly_summary',
                    category: 'general_update',
                    language: 'en',
                    body: 'Hello {{1}},\n\nHere is your weekly summary for {{2}}:\n\n📄 Documents: {{3}} pending review\n❓ RFIs: {{4}} open\n✅ Completed: {{5}} items\n\nView dashboard: {{6}}',
                    headerText: 'KIISHA Weekly Summary',
                    footerText: 'Reply STOP to unsubscribe',
                  });
                  setCreateDialogOpen(true);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-sm">Weekly Summary</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Weekly digest of project activity and pending items
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
