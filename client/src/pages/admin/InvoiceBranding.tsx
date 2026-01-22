import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import InvoicePreview from "@/components/InvoicePreview";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Palette, 
  CreditCard, 
  FileText, 
  Settings2, 
  Save, 
  Eye,
  Upload,
  RefreshCw,
  CheckCircle2
} from "lucide-react";

export default function InvoiceBranding() {
  const [activeTab, setActiveTab] = useState("company");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.6);

  // Fetch current settings
  const { data: settings, isLoading, refetch } = trpc.invoiceBranding.getSettings.useQuery({});
  const saveMutation = trpc.invoiceBranding.saveSettings.useMutation();
  const { data: previewData } = trpc.invoiceBranding.previewInvoice.useQuery({});

  // Form state
  const [formData, setFormData] = useState({
    // Company Info
    companyName: "",
    companyAddress: "",
    companyCity: "",
    companyState: "",
    companyPostalCode: "",
    companyCountry: "",
    companyEmail: "",
    companyPhone: "",
    companyWebsite: "",
    taxId: "",
    registrationNumber: "",
    // Branding
    logoUrl: "",
    logoWidth: 200,
    logoHeight: 60,
    primaryColor: "#f97316",
    secondaryColor: "#1e293b",
    accentColor: "#3b82f6",
    fontFamily: "Inter",
    headerFontSize: 24,
    bodyFontSize: 10,
    // Bank Details
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankRoutingNumber: "",
    bankSwiftCode: "",
    bankIban: "",
    bankBranch: "",
    bankAddress: "",
    // Payment & Terms
    paymentInstructions: "",
    acceptedPaymentMethods: [] as string[],
    footerText: "",
    termsAndConditions: "",
    latePaymentPolicy: "",
    // Invoice Settings
    invoicePrefix: "INV",
    invoiceNumberFormat: "{{prefix}}-{{year}}-{{number}}",
    nextInvoiceNumber: 1,
    // Display Options
    showLogo: true,
    showBankDetails: true,
    showPaymentInstructions: true,
    showTerms: true,
    showTaxBreakdown: true,
    showLineItemTax: true,
    paperSize: "A4" as "A4" | "Letter" | "Legal",
    // Currency & Locale
    defaultCurrency: "USD",
    currencySymbol: "$",
    currencyPosition: "before" as "before" | "after",
    dateFormat: "MMM DD, YYYY",
  });

  // Load settings into form
  useEffect(() => {
    if (settings) {
      setFormData({
        companyName: settings.companyName || "",
        companyAddress: settings.companyAddress || "",
        companyCity: settings.companyCity || "",
        companyState: settings.companyState || "",
        companyPostalCode: settings.companyPostalCode || "",
        companyCountry: settings.companyCountry || "",
        companyEmail: settings.companyEmail || "",
        companyPhone: settings.companyPhone || "",
        companyWebsite: settings.companyWebsite || "",
        taxId: settings.taxId || "",
        registrationNumber: settings.registrationNumber || "",
        logoUrl: settings.logoUrl || "",
        logoWidth: settings.logoWidth || 200,
        logoHeight: settings.logoHeight || 60,
        primaryColor: settings.primaryColor || "#f97316",
        secondaryColor: settings.secondaryColor || "#1e293b",
        accentColor: settings.accentColor || "#3b82f6",
        fontFamily: settings.fontFamily || "Inter",
        headerFontSize: settings.headerFontSize || 24,
        bodyFontSize: settings.bodyFontSize || 10,
        bankName: settings.bankName || "",
        bankAccountName: settings.bankAccountName || "",
        bankAccountNumber: settings.bankAccountNumber || "",
        bankRoutingNumber: settings.bankRoutingNumber || "",
        bankSwiftCode: settings.bankSwiftCode || "",
        bankIban: settings.bankIban || "",
        bankBranch: settings.bankBranch || "",
        bankAddress: settings.bankAddress || "",
        paymentInstructions: settings.paymentInstructions || "",
        acceptedPaymentMethods: settings.acceptedPaymentMethods || [],
        footerText: settings.footerText || "",
        termsAndConditions: settings.termsAndConditions || "",
        latePaymentPolicy: settings.latePaymentPolicy || "",
        invoicePrefix: settings.invoicePrefix || "INV",
        invoiceNumberFormat: settings.invoiceNumberFormat || "{{prefix}}-{{year}}-{{number}}",
        nextInvoiceNumber: settings.nextInvoiceNumber || 1,
        showLogo: settings.showLogo ?? true,
        showBankDetails: settings.showBankDetails ?? true,
        showPaymentInstructions: settings.showPaymentInstructions ?? true,
        showTerms: settings.showTerms ?? true,
        showTaxBreakdown: settings.showTaxBreakdown ?? true,
        showLineItemTax: settings.showLineItemTax ?? true,
        paperSize: (settings.paperSize as "A4" | "Letter" | "Legal") || "A4",
        defaultCurrency: settings.defaultCurrency || "USD",
        currencySymbol: settings.currencySymbol || "$",
        currencyPosition: (settings.currencyPosition as "before" | "after") || "before",
        dateFormat: settings.dateFormat || "MMM DD, YYYY",
      });
    }
  }, [settings]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(formData);
      toast.success("Invoice branding settings saved successfully");
      setHasChanges(false);
      refetch();
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const uploadMutation = trpc.invoiceBranding.uploadLogo.useMutation();
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          fileBase64: base64,
        });
        updateField("logoUrl", result.url);
        toast.success("Logo uploaded successfully");
      } catch (error) {
        toast.error("Failed to upload logo");
      }
    };
    reader.readAsDataURL(file);
  };

  const formatCurrency = (amount: number) => {
    const formatted = amount.toLocaleString("en-US", { minimumFractionDigits: 2 });
    return formData.currencyPosition === "before" 
      ? `${formData.currencySymbol}${formatted}`
      : `${formatted}${formData.currencySymbol}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Branding</h1>
          <p className="text-muted-foreground">
            Customize the appearance of your invoices and PDFs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="text-amber-500 border-amber-500">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Bank Details
          </TabsTrigger>
          <TabsTrigger value="terms" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Terms & Footer
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Company Information Tab */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                This information will appear on all your invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => updateField("companyName", e.target.value)}
                    placeholder="KIISHA Energy"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyEmail">Email</Label>
                  <Input
                    id="companyEmail"
                    type="email"
                    value={formData.companyEmail}
                    onChange={(e) => updateField("companyEmail", e.target.value)}
                    placeholder="billing@company.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => updateField("companyAddress", e.target.value)}
                  placeholder="123 Business Street"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyCity">City</Label>
                  <Input
                    id="companyCity"
                    value={formData.companyCity}
                    onChange={(e) => updateField("companyCity", e.target.value)}
                    placeholder="Lagos"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyState">State/Province</Label>
                  <Input
                    id="companyState"
                    value={formData.companyState}
                    onChange={(e) => updateField("companyState", e.target.value)}
                    placeholder="Lagos State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPostalCode">Postal Code</Label>
                  <Input
                    id="companyPostalCode"
                    value={formData.companyPostalCode}
                    onChange={(e) => updateField("companyPostalCode", e.target.value)}
                    placeholder="100001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCountry">Country</Label>
                  <Input
                    id="companyCountry"
                    value={formData.companyCountry}
                    onChange={(e) => updateField("companyCountry", e.target.value)}
                    placeholder="Nigeria"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    value={formData.companyPhone}
                    onChange={(e) => updateField("companyPhone", e.target.value)}
                    placeholder="+234 800 000 0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyWebsite">Website</Label>
                  <Input
                    id="companyWebsite"
                    value={formData.companyWebsite}
                    onChange={(e) => updateField("companyWebsite", e.target.value)}
                    placeholder="https://company.com"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                  <Input
                    id="taxId"
                    value={formData.taxId}
                    onChange={(e) => updateField("taxId", e.target.value)}
                    placeholder="NG-12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={(e) => updateField("registrationNumber", e.target.value)}
                    placeholder="RC-123456"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
                <CardDescription>
                  Upload your company logo for invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  {formData.logoUrl ? (
                    <div className="space-y-4">
                      <img 
                        src={formData.logoUrl} 
                        alt="Company Logo" 
                        className="max-h-20 mx-auto"
                        style={{ maxWidth: formData.logoWidth }}
                      />
                      <Button variant="outline" size="sm" onClick={() => updateField("logoUrl", "")}>
                        Remove Logo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Drag and drop or click to upload
                      </p>
                      <Input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="logo-upload"
                        onChange={handleLogoUpload}
                      />
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="logo-upload" className="cursor-pointer">
                          Choose File
                        </label>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Or enter logo URL</Label>
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl}
                    onChange={(e) => updateField("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="logoWidth">Width (px)</Label>
                    <Input
                      id="logoWidth"
                      type="number"
                      value={formData.logoWidth}
                      onChange={(e) => updateField("logoWidth", parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoHeight">Height (px)</Label>
                    <Input
                      id="logoHeight"
                      type="number"
                      value={formData.logoHeight}
                      onChange={(e) => updateField("logoHeight", parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colors</CardTitle>
                <CardDescription>
                  Choose colors for your invoice theme
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => updateField("primaryColor", e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => updateField("primaryColor", e.target.value)}
                      placeholder="#f97316"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for headers and accents</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => updateField("secondaryColor", e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.secondaryColor}
                      onChange={(e) => updateField("secondaryColor", e.target.value)}
                      placeholder="#1e293b"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for text and borders</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => updateField("accentColor", e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.accentColor}
                      onChange={(e) => updateField("accentColor", e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Used for links and highlights</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Select value={formData.fontFamily} onValueChange={(v) => updateField("fontFamily", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Color Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="p-6 rounded-lg border"
                style={{ fontFamily: formData.fontFamily }}
              >
                <div 
                  className="text-2xl font-bold mb-4"
                  style={{ color: formData.primaryColor }}
                >
                  {formData.companyName || "Your Company Name"}
                </div>
                <div 
                  className="text-sm mb-2"
                  style={{ color: formData.secondaryColor }}
                >
                  Invoice #INV-2026-0001
                </div>
                <a 
                  href="#" 
                  className="text-sm underline"
                  style={{ color: formData.accentColor }}
                >
                  View online
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bank Account Details</CardTitle>
              <CardDescription>
                Payment information displayed on invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => updateField("bankName", e.target.value)}
                    placeholder="First Bank of Nigeria"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankBranch">Branch</Label>
                  <Input
                    id="bankBranch"
                    value={formData.bankBranch}
                    onChange={(e) => updateField("bankBranch", e.target.value)}
                    placeholder="Victoria Island Branch"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccountName">Account Name</Label>
                <Input
                  id="bankAccountName"
                  value={formData.bankAccountName}
                  onChange={(e) => updateField("bankAccountName", e.target.value)}
                  placeholder="KIISHA Energy Ltd"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={(e) => updateField("bankAccountNumber", e.target.value)}
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankRoutingNumber">Routing Number / Sort Code</Label>
                  <Input
                    id="bankRoutingNumber"
                    value={formData.bankRoutingNumber}
                    onChange={(e) => updateField("bankRoutingNumber", e.target.value)}
                    placeholder="011"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankSwiftCode">SWIFT/BIC Code</Label>
                  <Input
                    id="bankSwiftCode"
                    value={formData.bankSwiftCode}
                    onChange={(e) => updateField("bankSwiftCode", e.target.value)}
                    placeholder="FBNINGLA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankIban">IBAN</Label>
                  <Input
                    id="bankIban"
                    value={formData.bankIban}
                    onChange={(e) => updateField("bankIban", e.target.value)}
                    placeholder="NG12FBNI0000001234567890"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAddress">Bank Address</Label>
                <Textarea
                  id="bankAddress"
                  value={formData.bankAddress}
                  onChange={(e) => updateField("bankAddress", e.target.value)}
                  placeholder="Bank address for international transfers"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Instructions</CardTitle>
              <CardDescription>
                Additional instructions for customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                <Textarea
                  id="paymentInstructions"
                  value={formData.paymentInstructions}
                  onChange={(e) => updateField("paymentInstructions", e.target.value)}
                  placeholder="Please include invoice number as payment reference..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Accepted Payment Methods</Label>
                <div className="flex flex-wrap gap-2">
                  {["bank_transfer", "credit_card", "check", "cash", "mobile_money", "crypto"].map((method) => (
                    <Button
                      key={method}
                      variant={formData.acceptedPaymentMethods.includes(method) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        const methods = formData.acceptedPaymentMethods.includes(method)
                          ? formData.acceptedPaymentMethods.filter(m => m !== method)
                          : [...formData.acceptedPaymentMethods, method];
                        updateField("acceptedPaymentMethods", methods);
                      }}
                    >
                      {formData.acceptedPaymentMethods.includes(method) && (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      {method.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Terms & Footer Tab */}
        <TabsContent value="terms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Footer Text</CardTitle>
              <CardDescription>
                Text displayed at the bottom of invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.footerText}
                onChange={(e) => updateField("footerText", e.target.value)}
                placeholder="Thank you for your business!"
                rows={2}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
              <CardDescription>
                Legal terms displayed on invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.termsAndConditions}
                onChange={(e) => updateField("termsAndConditions", e.target.value)}
                placeholder="Enter your terms and conditions..."
                rows={6}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Late Payment Policy</CardTitle>
              <CardDescription>
                Policy for overdue invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.latePaymentPolicy}
                onChange={(e) => updateField("latePaymentPolicy", e.target.value)}
                placeholder="A late fee of 1.5% per month will be applied to overdue invoices..."
                rows={3}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Numbering</CardTitle>
                <CardDescription>
                  Configure how invoice numbers are generated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invoicePrefix">Prefix</Label>
                  <Input
                    id="invoicePrefix"
                    value={formData.invoicePrefix}
                    onChange={(e) => updateField("invoicePrefix", e.target.value)}
                    placeholder="INV"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceNumberFormat">Format</Label>
                  <Input
                    id="invoiceNumberFormat"
                    value={formData.invoiceNumberFormat}
                    onChange={(e) => updateField("invoiceNumberFormat", e.target.value)}
                    placeholder="{{prefix}}-{{year}}-{{number}}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{{prefix}}"}, {"{{year}}"}, {"{{month}}"}, {"{{number}}"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nextInvoiceNumber">Next Invoice Number</Label>
                  <Input
                    id="nextInvoiceNumber"
                    type="number"
                    value={formData.nextInvoiceNumber}
                    onChange={(e) => updateField("nextInvoiceNumber", parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Currency & Locale</CardTitle>
                <CardDescription>
                  Regional settings for invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="defaultCurrency">Currency Code</Label>
                    <Input
                      id="defaultCurrency"
                      value={formData.defaultCurrency}
                      onChange={(e) => updateField("defaultCurrency", e.target.value)}
                      placeholder="USD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currencySymbol">Symbol</Label>
                    <Input
                      id="currencySymbol"
                      value={formData.currencySymbol}
                      onChange={(e) => updateField("currencySymbol", e.target.value)}
                      placeholder="$"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currencyPosition">Symbol Position</Label>
                  <Select value={formData.currencyPosition} onValueChange={(v: "before" | "after") => updateField("currencyPosition", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before amount ({formData.currencySymbol}100.00)</SelectItem>
                      <SelectItem value="after">After amount (100.00{formData.currencySymbol})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={formData.dateFormat} onValueChange={(v) => updateField("dateFormat", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MMM DD, YYYY">Jan 20, 2026</SelectItem>
                      <SelectItem value="DD/MM/YYYY">20/01/2026</SelectItem>
                      <SelectItem value="MM/DD/YYYY">01/20/2026</SelectItem>
                      <SelectItem value="YYYY-MM-DD">2026-01-20</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paperSize">Paper Size</Label>
                  <Select value={formData.paperSize} onValueChange={(v: "A4" | "Letter" | "Legal") => updateField("paperSize", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                      <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                      <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Display Options</CardTitle>
              <CardDescription>
                Choose what to show on invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Logo</Label>
                    <p className="text-sm text-muted-foreground">Display company logo on invoices</p>
                  </div>
                  <Switch
                    checked={formData.showLogo}
                    onCheckedChange={(v) => updateField("showLogo", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Bank Details</Label>
                    <p className="text-sm text-muted-foreground">Display bank account information</p>
                  </div>
                  <Switch
                    checked={formData.showBankDetails}
                    onCheckedChange={(v) => updateField("showBankDetails", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Payment Instructions</Label>
                    <p className="text-sm text-muted-foreground">Display payment instructions</p>
                  </div>
                  <Switch
                    checked={formData.showPaymentInstructions}
                    onCheckedChange={(v) => updateField("showPaymentInstructions", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Terms & Conditions</Label>
                    <p className="text-sm text-muted-foreground">Display terms on invoices</p>
                  </div>
                  <Switch
                    checked={formData.showTerms}
                    onCheckedChange={(v) => updateField("showTerms", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Tax Breakdown</Label>
                    <p className="text-sm text-muted-foreground">Show detailed tax summary</p>
                  </div>
                  <Switch
                    checked={formData.showTaxBreakdown}
                    onCheckedChange={(v) => updateField("showTaxBreakdown", v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Line Item Tax</Label>
                    <p className="text-sm text-muted-foreground">Show tax on each line item</p>
                  </div>
                  <Switch
                    checked={formData.showLineItemTax}
                    onCheckedChange={(v) => updateField("showLineItemTax", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-4 border-b bg-background sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle>Invoice Preview</DialogTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Zoom:</span>
                  <Slider
                    value={[previewScale * 100]}
                    onValueChange={([v]) => setPreviewScale(v / 100)}
                    min={30}
                    max={100}
                    step={5}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground w-12">{Math.round(previewScale * 100)}%</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Invoice Preview</title>
                            <link href="https://fonts.googleapis.com/css2?family=${formData.fontFamily.replace(' ', '+')}&display=swap" rel="stylesheet">
                            <style>
                              body { margin: 0; padding: 20px; font-family: '${formData.fontFamily}', sans-serif; }
                              @media print { body { padding: 0; } }
                            </style>
                          </head>
                          <body>
                            <div id="preview"></div>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                >
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="overflow-auto p-6 bg-gray-100" style={{ maxHeight: 'calc(90vh - 80px)' }}>
            <div className="mx-auto" style={{ width: 'fit-content' }}>
              <InvoicePreview
                data={{
                  companyName: formData.companyName,
                  companyAddress: formData.companyAddress,
                  companyCity: formData.companyCity,
                  companyState: formData.companyState,
                  companyPostalCode: formData.companyPostalCode,
                  companyCountry: formData.companyCountry,
                  companyEmail: formData.companyEmail,
                  companyPhone: formData.companyPhone,
                  companyWebsite: formData.companyWebsite,
                  taxId: formData.taxId,
                  registrationNumber: formData.registrationNumber,
                  logoUrl: formData.logoUrl,
                  logoWidth: formData.logoWidth,
                  logoHeight: formData.logoHeight,
                  primaryColor: formData.primaryColor,
                  secondaryColor: formData.secondaryColor,
                  accentColor: formData.accentColor,
                  fontFamily: formData.fontFamily,
                  bankName: formData.bankName,
                  bankAccountName: formData.bankAccountName,
                  bankAccountNumber: formData.bankAccountNumber,
                  bankRoutingNumber: formData.bankRoutingNumber,
                  bankSwiftCode: formData.bankSwiftCode,
                  bankIban: formData.bankIban,
                  bankBranch: formData.bankBranch,
                  bankAddress: formData.bankAddress,
                  paymentInstructions: formData.paymentInstructions,
                  acceptedPaymentMethods: formData.acceptedPaymentMethods,
                  footerText: formData.footerText,
                  termsAndConditions: formData.termsAndConditions,
                  latePaymentPolicy: formData.latePaymentPolicy,
                  showLogo: formData.showLogo,
                  showBankDetails: formData.showBankDetails,
                  showPaymentInstructions: formData.showPaymentInstructions,
                  showTerms: formData.showTerms,
                  showTaxBreakdown: formData.showTaxBreakdown,
                  showLineItemTax: formData.showLineItemTax,
                  currencySymbol: formData.currencySymbol,
                  currencyPosition: formData.currencyPosition,
                  dateFormat: formData.dateFormat,
                  invoicePrefix: formData.invoicePrefix,
                }}
                scale={previewScale}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
