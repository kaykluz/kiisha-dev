import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, Mail, Palette, FileText } from "lucide-react";

const templateTypes = [
  { value: "request_issued", label: "Request Issued", description: "Sent when a new request is issued to a recipient" },
  { value: "request_reminder", label: "Request Reminder", description: "Sent as a reminder before the due date" },
  { value: "request_submitted", label: "Request Submitted", description: "Sent when a submission is received" },
  { value: "request_clarification", label: "Clarification Needed", description: "Sent when clarification is requested" },
  { value: "request_completed", label: "Request Completed", description: "Sent when a request is marked complete" },
  { value: "request_overdue", label: "Request Overdue", description: "Sent when a request passes its due date" },
  { value: "password_reset", label: "Password Reset", description: "Sent for password reset requests" },
  { value: "welcome", label: "Welcome", description: "Sent to new users" },
  { value: "invitation", label: "Invitation", description: "Sent when inviting users to the organization" },
  { value: "custom", label: "Custom", description: "Custom template for other purposes" },
];

export default function EmailTemplates() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    templateType: "request_issued" as string,
    name: "",
    description: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
    headerLogoUrl: "",
    footerText: "",
    primaryColor: "#f97316",
    isDefault: false,
  });

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.emailTemplates.list.useQuery();
  const { data: variables } = trpc.emailTemplates.getVariables.useQuery(
    { templateType: formData.templateType as "request_issued" | "request_reminder" | "request_submitted" | "request_clarification" | "request_completed" | "request_overdue" | "password_reset" | "welcome" | "invitation" | "custom" },
    { enabled: !!formData.templateType }
  );
  const { data: defaultContent } = trpc.emailTemplates.getDefaultContent.useQuery(
    { templateType: formData.templateType as "request_issued" | "request_reminder" | "request_submitted" | "request_clarification" | "request_completed" | "request_overdue" | "password_reset" | "welcome" | "invitation" | "custom" },
    { enabled: !!formData.templateType }
  );

  const createMutation = trpc.emailTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Email template created");
      setIsCreateOpen(false);
      resetForm();
      utils.emailTemplates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.emailTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Email template updated");
      setSelectedTemplate(null);
      resetForm();
      utils.emailTemplates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.emailTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Email template deleted");
      utils.emailTemplates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const previewMutation = trpc.emailTemplates.preview.useMutation({
    onSuccess: (data) => {
      setPreviewSubject(data.subject);
      setPreviewHtml(data.bodyHtml);
      setIsPreviewOpen(true);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      templateType: "request_issued",
      name: "",
      description: "",
      subject: "",
      bodyHtml: "",
      bodyText: "",
      headerLogoUrl: "",
      footerText: "",
      primaryColor: "#f97316",
      isDefault: false,
    });
  };

  const loadDefaultContent = () => {
    if (defaultContent) {
      setFormData((prev) => ({
        ...prev,
        subject: defaultContent.subject,
        bodyHtml: defaultContent.bodyHtml,
      }));
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      templateType: formData.templateType as "request_issued" | "request_reminder" | "request_submitted" | "request_clarification" | "request_completed" | "request_overdue" | "password_reset" | "welcome" | "invitation" | "custom",
      name: formData.name,
      description: formData.description || undefined,
      subject: formData.subject,
      bodyHtml: formData.bodyHtml,
      bodyText: formData.bodyText || undefined,
      headerLogoUrl: formData.headerLogoUrl || undefined,
      footerText: formData.footerText || undefined,
      primaryColor: formData.primaryColor || undefined,
      isDefault: formData.isDefault,
    });
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate,
      name: formData.name,
      description: formData.description || undefined,
      subject: formData.subject,
      bodyHtml: formData.bodyHtml,
      bodyText: formData.bodyText || undefined,
      headerLogoUrl: formData.headerLogoUrl || undefined,
      footerText: formData.footerText || undefined,
      primaryColor: formData.primaryColor || undefined,
      isDefault: formData.isDefault,
    });
  };

  const handlePreview = () => {
    previewMutation.mutate({
      subject: formData.subject,
      bodyHtml: formData.bodyHtml,
      templateType: formData.templateType as "request_issued" | "request_reminder" | "request_submitted" | "request_clarification" | "request_completed" | "request_overdue" | "password_reset" | "welcome" | "invitation" | "custom",
    });
  };

  const editTemplate = (template: NonNullable<typeof templates>[0]) => {
    setSelectedTemplate(template.id);
    setFormData({
      templateType: template.templateType,
      name: template.name,
      description: template.description || "",
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || "",
      headerLogoUrl: template.headerLogoUrl || "",
      footerText: template.footerText || "",
      primaryColor: template.primaryColor || "#f97316",
      isDefault: template.isDefault || false,
    });
    setIsCreateOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Templates</h1>
            <p className="text-muted-foreground">
              Customize email notifications with your organization's branding
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setSelectedTemplate(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? "Edit Email Template" : "Create Email Template"}
                </DialogTitle>
                <DialogDescription>
                  Customize the email content and branding for your organization
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="content" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">
                    <FileText className="h-4 w-4 mr-2" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="branding">
                    <Palette className="h-4 w-4 mr-2" />
                    Branding
                  </TabsTrigger>
                  <TabsTrigger value="variables">
                    <Mail className="h-4 w-4 mr-2" />
                    Variables
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Template Type</Label>
                      <Select
                        value={formData.templateType}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, templateType: value }))}
                        disabled={!!selectedTemplate}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {templateTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Request Issued - Standard"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this template"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Subject Line</Label>
                      <Button variant="ghost" size="sm" onClick={loadDefaultContent}>
                        Load Default
                      </Button>
                    </div>
                    <Input
                      value={formData.subject}
                      onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Email subject with {{variables}}"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body (HTML)</Label>
                    <Textarea
                      value={formData.bodyHtml}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bodyHtml: e.target.value }))}
                      placeholder="<h2>Hello {{recipient_name}},</h2>..."
                      className="min-h-[200px] font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Plain Text Fallback (Optional)</Label>
                    <Textarea
                      value={formData.bodyText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, bodyText: e.target.value }))}
                      placeholder="Plain text version for email clients that don't support HTML"
                      className="min-h-[100px]"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="branding" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Header Logo URL</Label>
                    <Input
                      value={formData.headerLogoUrl}
                      onChange={(e) => setFormData((prev) => ({ ...prev, headerLogoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.primaryColor}
                        onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={formData.primaryColor}
                        onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#f97316"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Footer Text</Label>
                    <Textarea
                      value={formData.footerText}
                      onChange={(e) => setFormData((prev) => ({ ...prev, footerText: e.target.value }))}
                      placeholder="© 2026 Your Company. All rights reserved."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      checked={formData.isDefault}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isDefault: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="isDefault">Set as default template for this type</Label>
                  </div>
                </TabsContent>

                <TabsContent value="variables" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Use these variables in your subject and body. They will be replaced with actual values when the email is sent.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variables?.map((variable) => (
                      <Badge
                        key={variable}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(variable);
                          toast.success("Copied to clipboard");
                        }}
                      >
                        {variable}
                      </Badge>
                    ))}
                  </div>
                  {(!variables || variables.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No predefined variables for this template type.
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex justify-between">
                <Button variant="outline" onClick={handlePreview}>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={selectedTemplate ? handleUpdate : handleCreate}
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {selectedTemplate ? "Update" : "Create"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="text-center py-8">Loading templates...</div>
        ) : templates && templates.length > 0 ? (
          <div className="grid gap-4">
            {templateTypes.map((type) => {
              const typeTemplates = templates.filter((t) => t.templateType === type.value);
              if (typeTemplates.length === 0) return null;

              return (
                <Card key={type.value}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{type.label}</CardTitle>
                    <CardDescription>{type.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {typeTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">{template.subject}</p>
                            </div>
                            {template.isDefault && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => editTemplate(template)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this template?")) {
                                  deleteMutation.mutate({ id: template.id });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Email Templates</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create custom email templates to match your organization's branding.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Preview</DialogTitle>
              <DialogDescription>
                This is how your email will appear with sample data
              </DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg p-4 bg-white">
              <div className="border-b pb-2 mb-4">
                <p className="text-sm text-muted-foreground">Subject:</p>
                <p className="font-medium">{previewSubject}</p>
              </div>
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
