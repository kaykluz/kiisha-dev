/**
 * Superuser Billing
 * 
 * Platform-wide billing management for superusers
 * Monitor organization subscriptions, usage, and platform revenue
 * Location: /superuser/billing
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DollarSign, 
  TrendingUp, 
  Users, 
  Building2,
  CreditCard,
  FileText,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  BarChart3
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon,
  trend 
}: { 
  title: string; 
  value: string; 
  change?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change && (
              <p className={`text-sm ${
                trend === "up" ? "text-green-500" : 
                trend === "down" ? "text-red-500" : 
                "text-muted-foreground"
              }`}>
                {change}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
    case "trialing":
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
    case "past_due":
      return <Badge className="bg-red-500"><AlertCircle className="h-3 w-3 mr-1" />Past Due</Badge>;
    case "canceled":
      return <Badge variant="secondary">Canceled</Badge>;
    case "paused":
      return <Badge variant="outline">Paused</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default function SuperuserBilling() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrg, setSelectedOrg] = useState<number | null>(null);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [newPlan, setNewPlan] = useState("");

  const { data: stats, isLoading: statsLoading } = trpc.platformBilling.getPlatformStats.useQuery();
  const { data: subscriptions, isLoading: subsLoading } = trpc.platformBilling.getAllSubscriptions.useQuery({
    search: searchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const { data: plans } = trpc.platformBilling.getPlans.useQuery();
  const { data: recentInvoices, isLoading: invoicesLoading } = trpc.platformBilling.getAllPlatformInvoices.useQuery({ limit: 10 });

  const updateSubscription = trpc.platformBilling.updateOrgSubscription.useMutation({
    onSuccess: () => {
      toast({ title: "Subscription updated successfully" });
      setShowPlanDialog(false);
      setSelectedOrg(null);
      utils.platformBilling.getAllSubscriptions.invalidate();
    },
    onError: (error) => {
      toast({ title: "Failed to update subscription", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdatePlan = () => {
    if (selectedOrg && newPlan) {
      updateSubscription.mutate({
        organizationId: selectedOrg,
        planId: parseInt(newPlan),
      });
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Platform Billing</h1>
          <p className="text-muted-foreground">Monitor and manage organization subscriptions and revenue</p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          {statsLoading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-32" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                title="Monthly Revenue"
                value={`$${stats?.monthlyRevenue?.toLocaleString() || "0"}`}
                change={stats?.revenueChange ? `${stats.revenueChange > 0 ? "+" : ""}${stats.revenueChange}% from last month` : undefined}
                trend={stats?.revenueChange ? (stats.revenueChange > 0 ? "up" : stats.revenueChange < 0 ? "down" : "neutral") : undefined}
                icon={DollarSign}
              />
              <StatCard
                title="Active Subscriptions"
                value={stats?.activeSubscriptions?.toString() || "0"}
                change={stats?.newSubscriptions ? `+${stats.newSubscriptions} this month` : undefined}
                trend="up"
                icon={Package}
              />
              <StatCard
                title="Total Organizations"
                value={stats?.totalOrganizations?.toString() || "0"}
                icon={Building2}
              />
              <StatCard
                title="Past Due"
                value={stats?.pastDueCount?.toString() || "0"}
                change={stats?.pastDueAmount ? `$${stats.pastDueAmount.toLocaleString()} outstanding` : undefined}
                trend={stats?.pastDueCount && stats.pastDueCount > 0 ? "down" : "neutral"}
                icon={AlertCircle}
              />
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="subscriptions">
          <TabsList>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
          </TabsList>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Organization Subscriptions</CardTitle>
                    <CardDescription>Manage subscription plans for all organizations</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search organizations..."
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="trialing">Trial</SelectItem>
                        <SelectItem value="past_due">Past Due</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {subsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : subscriptions && subscriptions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organization</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Next Billing</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.organizationId}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{sub.organizationName}</p>
                              <p className="text-sm text-muted-foreground">{sub.organizationCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>{sub.planName || "Free"}</TableCell>
                          <TableCell>{getStatusBadge(sub.status || "active")}</TableCell>
                          <TableCell>
                            ${sub.pricePerPeriod || "0"}/{sub.billingCycle === "annual" ? "yr" : "mo"}
                          </TableCell>
                          <TableCell>
                            {sub.currentPeriodEnd 
                              ? format(new Date(sub.currentPeriodEnd), "MMM d, yyyy")
                              : "-"}
                          </TableCell>
                          <TableCell>{sub.userCount || 0}</TableCell>
                          <TableCell className="text-right">
                            <Dialog open={showPlanDialog && selectedOrg === sub.organizationId} onOpenChange={(open) => {
                              setShowPlanDialog(open);
                              if (!open) setSelectedOrg(null);
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrg(sub.organizationId);
                                    setNewPlan(sub.planId?.toString() || "");
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Update Subscription</DialogTitle>
                                  <DialogDescription>
                                    Change the subscription plan for {sub.organizationName}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <Select value={newPlan} onValueChange={setNewPlan}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a plan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {plans?.map(plan => (
                                        <SelectItem key={plan.id} value={plan.id.toString()}>
                                          {plan.name} - ${plan.monthlyPrice}/mo
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setShowPlanDialog(false)}>
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={handleUpdatePlan}
                                    disabled={updateSubscription.isPending}
                                  >
                                    {updateSubscription.isPending ? "Updating..." : "Update Plan"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No subscriptions found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Invoices</CardTitle>
                <CardDescription>All invoices generated for organization subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : recentInvoices && recentInvoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.organizationName}</TableCell>
                          <TableCell>{format(new Date(invoice.invoiceDate), "MMM d, yyyy")}</TableCell>
                          <TableCell>${invoice.total}</TableCell>
                          <TableCell>
                            <Badge className={
                              invoice.status === "paid" ? "bg-green-500" :
                              invoice.status === "open" ? "bg-yellow-500" :
                              "bg-gray-500"
                            }>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Subscription Plans</CardTitle>
                    <CardDescription>Available plans for organizations</CardDescription>
                  </div>
                  <Button>
                    <Package className="h-4 w-4 mr-2" />
                    Add Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {plans && plans.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {plans.map(plan => (
                      <Card key={plan.id}>
                        <CardHeader>
                          <CardTitle>{plan.name}</CardTitle>
                          <CardDescription>{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <p className="text-3xl font-bold">${plan.monthlyPrice}</p>
                              <p className="text-sm text-muted-foreground">per month</p>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Users</span>
                                <span className="font-medium">{plan.maxUsers === -1 ? "Unlimited" : plan.maxUsers}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Assets</span>
                                <span className="font-medium">{plan.maxAssets === -1 ? "Unlimited" : plan.maxAssets}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Customers</span>
                                <span className="font-medium">{plan.maxCustomers === -1 ? "Unlimited" : plan.maxCustomers}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Storage</span>
                                <span className="font-medium">{plan.maxStorageGB === -1 ? "Unlimited" : `${plan.maxStorageGB} GB`}</span>
                              </div>
                            </div>
                            <Button variant="outline" className="w-full">
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Plan
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No plans configured yet</p>
                    <Button className="mt-4">Create First Plan</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
