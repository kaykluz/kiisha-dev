/**
 * Billing Settings
 * 
 * Manage payment methods, billing address, and invoice preferences
 * Location: /billing/settings
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  ArrowLeft,
  Building2,
  Mail,
  FileText,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

export default function BillingSettings() {
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();

  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({
    cardNumber: "",
    expiryMonth: "",
    expiryYear: "",
    cvc: "",
    name: "",
  });

  const [billingAddress, setBillingAddress] = useState({
    companyName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  const [invoicePrefs, setInvoicePrefs] = useState({
    emailInvoices: true,
    invoiceEmail: "",
    autoPay: true,
  });

  const { data: paymentMethods, isLoading: methodsLoading } = trpc.platformBilling.getPaymentMethods.useQuery();
  const { data: settings, isLoading: settingsLoading } = trpc.platformBilling.getBillingSettings.useQuery();

  // Update state when settings data is loaded
  useEffect(() => {
    if (settings) {
      setBillingAddress({
        companyName: settings.companyName || "",
        addressLine1: settings.addressLine1 || "",
        addressLine2: settings.addressLine2 || "",
        city: settings.city || "",
        state: settings.state || "",
        postalCode: settings.postalCode || "",
        country: settings.country || "US",
      });
      setInvoicePrefs({
        emailInvoices: settings.emailInvoices ?? true,
        invoiceEmail: settings.invoiceEmail || "",
        autoPay: settings.autoPay ?? true,
      });
    }
  }, [settings]);

  const addPaymentMethod = trpc.platformBilling.addPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Payment method added successfully");
      setShowAddCard(false);
      setNewCard({ cardNumber: "", expiryMonth: "", expiryYear: "", cvc: "", name: "" });
      utils.platformBilling.getPaymentMethods.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to add payment method", { description: error.message });
    },
  });

  const removePaymentMethod = trpc.platformBilling.removePaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Payment method removed");
      utils.platformBilling.getPaymentMethods.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to remove payment method", { description: error.message });
    },
  });

  const setDefaultPaymentMethod = trpc.platformBilling.setDefaultPaymentMethod.useMutation({
    onSuccess: () => {
      toast.success("Default payment method updated");
      utils.platformBilling.getPaymentMethods.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update default", { description: error.message });
    },
  });

  const updateBillingSettings = trpc.platformBilling.updateBillingSettings.useMutation({
    onSuccess: () => {
      toast.success("Billing settings updated");
      utils.platformBilling.getBillingSettings.invalidate();
    },
    onError: (error) => {
      toast.error("Failed to update settings", { description: error.message });
    },
  });

  const handleAddCard = () => {
    addPaymentMethod.mutate({
      type: "card",
      cardNumber: newCard.cardNumber.replace(/\s/g, ""),
      expiryMonth: parseInt(newCard.expiryMonth),
      expiryYear: parseInt(newCard.expiryYear),
      cvc: newCard.cvc,
      name: newCard.name,
    });
  };

  const handleSaveBillingAddress = () => {
    updateBillingSettings.mutate({
      ...billingAddress,
      ...invoicePrefs,
    });
  };

  const handleSaveInvoicePrefs = () => {
    updateBillingSettings.mutate({
      ...billingAddress,
      ...invoicePrefs,
    });
  };

  const isLoading = methodsLoading || settingsLoading;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/billing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Billing Settings</h1>
            <p className="text-muted-foreground">Manage your payment methods and billing preferences</p>
          </div>
        </div>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Manage your saved payment methods</CardDescription>
              </div>
              <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Card
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Payment Method</DialogTitle>
                    <DialogDescription>
                      Add a new credit or debit card for billing
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardName">Name on Card</Label>
                      <Input
                        id="cardName"
                        placeholder="John Doe"
                        value={newCard.name}
                        onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="4242 4242 4242 4242"
                        value={newCard.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
                          setNewCard({ ...newCard, cardNumber: value });
                        }}
                        maxLength={19}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiryMonth">Month</Label>
                        <Select
                          value={newCard.expiryMonth}
                          onValueChange={(v) => setNewCard({ ...newCard, expiryMonth: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="MM" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1).padStart(2, "0")}>
                                {String(i + 1).padStart(2, "0")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expiryYear">Year</Label>
                        <Select
                          value={newCard.expiryYear}
                          onValueChange={(v) => setNewCard({ ...newCard, expiryYear: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="YY" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = new Date().getFullYear() + i;
                              return (
                                <SelectItem key={year} value={String(year)}>
                                  {year}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvc">CVC</Label>
                        <Input
                          id="cvc"
                          placeholder="123"
                          value={newCard.cvc}
                          onChange={(e) => setNewCard({ ...newCard, cvc: e.target.value.replace(/\D/g, "") })}
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAddCard(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddCard}
                      disabled={addPaymentMethod.isPending || !newCard.cardNumber || !newCard.expiryMonth || !newCard.expiryYear || !newCard.cvc}
                    >
                      {addPaymentMethod.isPending ? "Adding..." : "Add Card"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {methodsLoading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : paymentMethods && paymentMethods.length > 0 ? (
              <div className="space-y-4">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">
                        {method.brand?.toUpperCase() || "CARD"}
                      </div>
                      <div>
                        <p className="font-medium">•••• •••• •••• {method.last4}</p>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault ? (
                        <Badge>Default</Badge>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setDefaultPaymentMethod.mutate({ paymentMethodId: method.id })}
                          disabled={setDefaultPaymentMethod.isPending}
                        >
                          Set Default
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this payment method? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removePaymentMethod.mutate({ paymentMethodId: method.id })}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">No payment methods added yet</p>
                <Button onClick={() => setShowAddCard(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Card
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Billing Address
            </CardTitle>
            <CardDescription>Address shown on invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={billingAddress.companyName}
                    onChange={(e) => setBillingAddress({ ...billingAddress, companyName: e.target.value })}
                    placeholder="Your Company, Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input
                    id="addressLine1"
                    value={billingAddress.addressLine1}
                    onChange={(e) => setBillingAddress({ ...billingAddress, addressLine1: e.target.value })}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    value={billingAddress.addressLine2}
                    onChange={(e) => setBillingAddress({ ...billingAddress, addressLine2: e.target.value })}
                    placeholder="Suite 100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={billingAddress.city}
                      onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                      placeholder="New York"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      value={billingAddress.state}
                      onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value })}
                      placeholder="NY"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={billingAddress.postalCode}
                      onChange={(e) => setBillingAddress({ ...billingAddress, postalCode: e.target.value })}
                      placeholder="10001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={billingAddress.country}
                      onValueChange={(v) => setBillingAddress({ ...billingAddress, country: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                        <SelectItem value="GB">United Kingdom</SelectItem>
                        <SelectItem value="AU">Australia</SelectItem>
                        <SelectItem value="DE">Germany</SelectItem>
                        <SelectItem value="FR">France</SelectItem>
                        <SelectItem value="NG">Nigeria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleSaveBillingAddress}
                  disabled={updateBillingSettings.isPending}
                >
                  {updateBillingSettings.isPending ? "Saving..." : "Save Address"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Preferences
            </CardTitle>
            <CardDescription>Configure how you receive invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {settingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Invoices</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive invoices via email when generated
                    </p>
                  </div>
                  <Switch
                    checked={invoicePrefs.emailInvoices}
                    onCheckedChange={(checked) => setInvoicePrefs({ ...invoicePrefs, emailInvoices: checked })}
                  />
                </div>

                {invoicePrefs.emailInvoices && (
                  <div className="space-y-2">
                    <Label htmlFor="invoiceEmail">Invoice Email</Label>
                    <Input
                      id="invoiceEmail"
                      type="email"
                      value={invoicePrefs.invoiceEmail}
                      onChange={(e) => setInvoicePrefs({ ...invoicePrefs, invoiceEmail: e.target.value })}
                      placeholder="billing@yourcompany.com"
                    />
                    <p className="text-sm text-muted-foreground">
                      Leave blank to use your account email
                    </p>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Pay</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically charge your default payment method
                    </p>
                  </div>
                  <Switch
                    checked={invoicePrefs.autoPay}
                    onCheckedChange={(checked) => setInvoicePrefs({ ...invoicePrefs, autoPay: checked })}
                  />
                </div>

                <Button 
                  onClick={handleSaveInvoicePrefs}
                  disabled={updateBillingSettings.isPending}
                >
                  {updateBillingSettings.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
