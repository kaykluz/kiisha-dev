/**
 * Billing Dashboard
 * 
 * Shows organization's subscription status, usage, and recent invoices
 * Location: /billing
 */

import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  FileText, 
  Settings, 
  TrendingUp, 
  Users, 
  HardDrive, 
  Package,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

function UsageCard({ 
  title, 
  current, 
  limit, 
  icon: Icon 
}: { 
  title: string; 
  current: number; 
  limit: number; 
  icon: React.ElementType;
}) {
  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
  
  const getStatusColor = (pct: number) => {
    if (pct >= 90) return "text-red-500";
    if (pct >= 75) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{title}</span>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(percentage)}`}>
            {percentage}%
          </span>
        </div>
        <Progress value={percentage} className="h-2 mb-2" />
        <div className="text-sm text-muted-foreground">
          {current.toLocaleString()} / {limit < 0 ? "Unlimited" : limit.toLocaleString()} used
        </div>
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes < 0) return 'Unlimited';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500">Active</Badge>;
    case "trialing":
      return <Badge className="bg-blue-500">Trial</Badge>;
    case "past_due":
      return <Badge className="bg-red-500">Past Due</Badge>;
    case "canceled":
      return <Badge variant="secondary">Canceled</Badge>;
    case "paused":
      return <Badge variant="outline">Paused</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

function getInvoiceStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
    case "open":
      return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Open</Badge>;
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "void":
      return <Badge variant="secondary">Void</Badge>;
    case "uncollectible":
      return <Badge className="bg-red-500">Uncollectible</Badge>;
    default:
      return <Badge variant="secondary">{status || "Unknown"}</Badge>;
  }
}

export default function BillingDashboard() {
  const [, setLocation] = useLocation();
  
  const { data: subscription, isLoading: subLoading } = trpc.platformBilling.getSubscription.useQuery();
  const { data: usage, isLoading: usageLoading } = trpc.platformBilling.getUsageSummary.useQuery();
  const { data: invoices, isLoading: invoicesLoading } = trpc.platformBilling.getInvoices.useQuery({ limit: 5 });
  const { data: payments, isLoading: paymentsLoading } = trpc.platformBilling.getPayments.useQuery({ limit: 5 });
  const { data: paymentMethods } = trpc.platformBilling.getPaymentMethods.useQuery();

  const isLoading = subLoading || usageLoading;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Billing</h1>
            <p className="text-muted-foreground">Manage your subscription and billing</p>
          </div>
          <Button onClick={() => setLocation("/billing/settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Billing Settings
          </Button>
        </div>

        {/* Subscription Overview */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">{subscription.planName || "Free Plan"}</h3>
                      <p className="text-muted-foreground">{subscription.planCode}</p>
                    </div>
                    {getStatusBadge(subscription.status)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Billing Cycle</span>
                      <p className="font-medium capitalize">{subscription.billingCycle || "Monthly"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Price</span>
                      <p className="font-medium">
                        ${subscription.pricePerPeriod || "0.00"}/{subscription.billingCycle === "annual" ? "year" : "month"}
                      </p>
                    </div>
                    {subscription.currentPeriodEnd && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Next Billing Date</span>
                        <p className="font-medium">
                          {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                        </p>
                      </div>
                    )}
                  </div>

                  <Button variant="outline" className="w-full">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Active Subscription</h3>
                  <p className="text-muted-foreground mb-4">
                    You're currently on the free tier. Upgrade to unlock more features.
                  </p>
                  <Button>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>Your default payment method</CardDescription>
            </CardHeader>
            <CardContent>
              {paymentMethods && paymentMethods.length > 0 ? (
                <div className="space-y-4">
                  {paymentMethods.filter(m => m.isDefault).map(method => (
                    <div key={method.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="h-10 w-16 bg-gradient-to-r from-gray-700 to-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">
                        {method.brand?.toUpperCase() || "CARD"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">•••• •••• •••• {method.last4}</p>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </p>
                      </div>
                      <Badge>Default</Badge>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => setLocation("/billing/settings")}>
                    Manage Payment Methods
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Payment Method</h3>
                  <p className="text-muted-foreground mb-4">
                    Add a payment method to enable automatic billing.
                  </p>
                  <Button onClick={() => setLocation("/billing/settings")}>
                    Add Payment Method
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>Your current resource usage against plan limits</CardDescription>
          </CardHeader>
          <CardContent>
            {usageLoading ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : usage ? (
              <div className="grid gap-4 md:grid-cols-4">
                <UsageCard
                  title="Users"
                  current={usage.users.current}
                  limit={usage.users.limit}
                  icon={Users}
                />
                <UsageCard
                  title="Assets"
                  current={usage.assets.current}
                  limit={usage.assets.limit}
                  icon={Package}
                />
                <UsageCard
                  title="Customers"
                  current={usage.customers.current}
                  limit={usage.customers.limit}
                  icon={Users}
                />
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">Storage</span>
                      </div>
                      <span className="text-sm font-medium text-green-500">
                        {usage.storage.limit > 0 ? Math.round((usage.storage.current / usage.storage.limit) * 100) : 0}%
                      </span>
                    </div>
                    <Progress value={usage.storage.limit > 0 ? (usage.storage.current / usage.storage.limit) * 100 : 0} className="h-2 mb-2" />
                    <div className="text-sm text-muted-foreground">
                      {formatBytes(usage.storage.current)} / {formatBytes(usage.storage.limit)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Recent Invoices & Payments */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recent Invoices
                  </CardTitle>
                  <CardDescription>Your platform invoices</CardDescription>
                </div>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : invoices && invoices.length > 0 ? (
                <div className="space-y-4">
                  {invoices.map(invoice => (
                    <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(invoice.invoiceDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${invoice.total}</p>
                        {getInvoiceStatusBadge(invoice.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invoices yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription>Recent payments</CardDescription>
                </div>
                <Button variant="ghost" size="sm">View All</Button>
              </div>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : payments && payments.length > 0 ? (
                <div className="space-y-4">
                  {payments.map(payment => (
                    <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {payment.paymentMethod === "card" && payment.last4 
                            ? `•••• ${payment.last4}` 
                            : payment.paymentMethod}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.paymentDate 
                            ? format(new Date(payment.paymentDate), "MMM d, yyyy")
                            : "Pending"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${payment.amount}</p>
                        <Badge className={payment.status === "succeeded" ? "bg-green-500" : "bg-yellow-500"}>
                          {payment.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No payments yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
