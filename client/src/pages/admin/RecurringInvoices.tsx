/**
 * Admin Recurring Invoices Management
 * 
 * Allows admins to create, view, edit, and manage recurring invoice schedules.
 * Features:
 * - List view with filters (status, customer)
 * - Create/edit schedule form with line items
 * - Generation history view
 * - Pause/resume/cancel actions
 * 
 * WHO USES THIS: Admin only
 * LOCATION: Admin Dashboard → Billing → Recurring Invoices
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Plus, 
  Pause, 
  Play, 
  X, 
  Calendar, 
  DollarSign, 
  RefreshCw,
  Trash2,
  Eye,
  Edit,
  Clock,
  AlertCircle,
  CheckCircle,
  History
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ScheduleFormData {
  customerId: number;
  name: string;
  description: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  dayOfMonth: number;
  dayOfWeek: number;
  startDate: string;
  endDate: string;
  currency: string;
  taxRate: number;
  paymentTermsDays: number;
  notes: string;
  lineItems: LineItem[];
}

const defaultFormData: ScheduleFormData = {
  customerId: 0,
  name: '',
  description: '',
  frequency: 'monthly',
  dayOfMonth: 1,
  dayOfWeek: 1,
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  currency: 'USD',
  taxRate: 0,
  paymentTermsDays: 30,
  notes: '',
  lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
};

export default function RecurringInvoices() {
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>(defaultFormData);

  // Fetch recurring schedules
  const { data: schedules, isLoading, refetch } = trpc.billing.listRecurringSchedules.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter as any,
    limit: 100,
  });

  // Fetch customers for dropdown
  const { data: customersData } = trpc.customerPortal.listCustomers.useQuery({ orgId: 1, limit: 1000 });

  // Fetch schedule details
  const { data: scheduleDetails } = trpc.billing.getRecurringScheduleDetails.useQuery(
    { scheduleId: selectedScheduleId! },
    { enabled: !!selectedScheduleId }
  );

  // Mutations
  const createSchedule = trpc.billing.createRecurringSchedule.useMutation({
    onSuccess: () => {
      toast.success("Recurring schedule created");
      setShowCreateDialog(false);
      setFormData(defaultFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const pauseSchedule = trpc.billing.pauseRecurringSchedule.useMutation({
    onSuccess: () => {
      toast.success("Schedule paused");
      refetch();
    },
  });

  const resumeSchedule = trpc.billing.resumeRecurringSchedule.useMutation({
    onSuccess: () => {
      toast.success("Schedule resumed");
      refetch();
    },
  });

  const cancelSchedule = trpc.billing.cancelRecurringSchedule.useMutation({
    onSuccess: () => {
      toast.success("Schedule cancelled");
      refetch();
    },
  });

  const triggerGeneration = trpc.billing.triggerRecurringInvoices.useMutation({
    onSuccess: (result) => {
      toast.success(`Processed ${result.processed} schedules, generated ${result.generated} invoices`);
      refetch();
    },
  });

  const handleAddLineItem = () => {
    setFormData({
      ...formData,
      lineItems: [...formData.lineItems, { description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setFormData({
      ...formData,
      lineItems: formData.lineItems.filter((_, i) => i !== index),
    });
  };

  const handleLineItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const newLineItems = [...formData.lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };
    setFormData({ ...formData, lineItems: newLineItems });
  };

  const handleCreateSchedule = () => {
    if (!formData.customerId || formData.lineItems.length === 0) {
      toast.error("Please select a customer and add at least one line item");
      return;
    }

    createSchedule.mutate({
      customerId: formData.customerId,
      name: formData.name,
      description: formData.description,
      frequency: formData.frequency,
      dayOfMonth: formData.dayOfMonth,
      dayOfWeek: formData.dayOfWeek,
      startDate: new Date(formData.startDate),
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      currency: formData.currency,
      taxRate: formData.taxRate,
      paymentTermsDays: formData.paymentTermsDays,
      notes: formData.notes,
      lineItems: formData.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Math.round(item.unitPrice * 100), // Convert to cents
      })),
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      active: { variant: "default", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      paused: { variant: "secondary", icon: <Pause className="h-3 w-3 mr-1" /> },
      cancelled: { variant: "destructive", icon: <X className="h-3 w-3 mr-1" /> },
      completed: { variant: "outline", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    };
    const { variant, icon } = variants[status] || { variant: "outline", icon: null };
    return (
      <Badge variant={variant} className="flex items-center">
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels: Record<string, string> = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      semi_annual: 'Semi-Annual',
      annual: 'Annual',
    };
    return labels[frequency] || frequency;
  };

  const calculateTotal = () => {
    return formData.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Recurring Invoices</h1>
            <p className="text-muted-foreground">Manage automatic invoice generation schedules</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => triggerGeneration.mutate()} disabled={triggerGeneration.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${triggerGeneration.isPending ? 'animate-spin' : ''}`} />
              Run Now
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Schedule
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Schedules</p>
                  <p className="text-2xl font-bold">
                    {schedules?.filter(s => s.status === 'active').length || 0}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paused</p>
                  <p className="text-2xl font-bold">
                    {schedules?.filter(s => s.status === 'paused').length || 0}
                  </p>
                </div>
                <Pause className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Schedules</p>
                  <p className="text-2xl font-bold">{schedules?.length || 0}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold">
                    ${((schedules?.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.amount || 0), 0) || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Schedules Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Next Generation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : schedules?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No recurring schedules found
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules?.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{schedule.customerName || `Customer #${schedule.customerId}`}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{schedule.name}</p>
                        {schedule.description && (
                          <p className="text-sm text-muted-foreground">{schedule.description}</p>
                        )}
                      </TableCell>
                      <TableCell>{getFrequencyLabel(schedule.frequency)}</TableCell>
                      <TableCell>${((schedule.amount || 0) / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {schedule.nextGenerationDate ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {new Date(schedule.nextGenerationDate).toLocaleDateString()}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedScheduleId(schedule.id);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {schedule.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => pauseSchedule.mutate({ scheduleId: schedule.id })}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          )}
                          {schedule.status === 'paused' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => resumeSchedule.mutate({ scheduleId: schedule.id })}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {(schedule.status === 'active' || schedule.status === 'paused') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this schedule?')) {
                                  cancelSchedule.mutate({ scheduleId: schedule.id });
                                }
                              }}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Schedule Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recurring Invoice Schedule</DialogTitle>
              <DialogDescription>
                Set up automatic invoice generation for a customer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select
                  value={formData.customerId.toString()}
                  onValueChange={(v) => setFormData({ ...formData, customerId: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customersData?.customers?.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.companyName || customer.name} ({customer.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Schedule Name */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Schedule Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Monthly Maintenance"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData({ ...formData, frequency: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="semi_annual">Semi-Annual</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this schedule"
                  rows={2}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Day of Month/Week */}
              <div className="grid grid-cols-2 gap-4">
                {(formData.frequency === 'monthly' || formData.frequency === 'quarterly' || formData.frequency === 'semi_annual' || formData.frequency === 'annual') && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <Select
                      value={formData.dayOfMonth.toString()}
                      onValueChange={(v) => setFormData({ ...formData, dayOfMonth: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>Day of Week</Label>
                    <Select
                      value={formData.dayOfWeek.toString()}
                      onValueChange={(v) => setFormData({ ...formData, dayOfWeek: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Payment Terms (Days)</Label>
                  <Input
                    type="number"
                    value={formData.paymentTermsDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermsDays: parseInt(e.target.value) || 30 })}
                    min={0}
                    max={90}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Line Items *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.lineItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20"
                        min={1}
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-28"
                        min={0}
                        step={0.01}
                      />
                      {formData.lineItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLineItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  Total: ${calculateTotal().toFixed(2)}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes (not shown on invoice)"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSchedule} disabled={createSchedule.isPending}>
                {createSchedule.isPending ? 'Creating...' : 'Create Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Details</DialogTitle>
            </DialogHeader>

            {scheduleDetails && (
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="items">Line Items</TabsTrigger>
                  <TabsTrigger value="history">Generation History</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{scheduleDetails.schedule.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <p>{getStatusBadge(scheduleDetails.schedule.status)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Frequency</Label>
                      <p>{getFrequencyLabel(scheduleDetails.schedule.frequency)}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Currency</Label>
                      <p>{scheduleDetails.schedule.currency}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Start Date</Label>
                      <p>{new Date(scheduleDetails.schedule.startDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Next Generation</Label>
                      <p>{scheduleDetails.schedule.nextGenerationDate ? new Date(scheduleDetails.schedule.nextGenerationDate).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Payment Terms</Label>
                      <p>{scheduleDetails.schedule.paymentTermsDays} days</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Generated</Label>
                      <p>{scheduleDetails.schedule.lastGeneratedAt ? new Date(scheduleDetails.schedule.lastGeneratedAt).toLocaleDateString() : 'Never'}</p>
                    </div>
                  </div>
                  {scheduleDetails.schedule.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p>{scheduleDetails.schedule.description}</p>
                    </div>
                  )}
                  {scheduleDetails.schedule.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p>{scheduleDetails.schedule.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="items">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleDetails.lineItems.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${(item.unitPrice / 100).toFixed(2)}</TableCell>
                          <TableCell className="text-right">${((item.quantity * item.unitPrice) / 100).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="history">
                  {scheduleDetails.generationHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2" />
                      <p>No invoices generated yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Generated</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduleDetails.generationHistory.map((gen: any) => (
                          <TableRow key={gen.id}>
                            <TableCell className="font-mono">{gen.invoiceNumber}</TableCell>
                            <TableCell>{new Date(gen.generatedAt).toLocaleDateString()}</TableCell>
                            <TableCell>
                              {new Date(gen.periodStart).toLocaleDateString()} - {new Date(gen.periodEnd).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">${(gen.total / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={gen.invoiceStatus === 'paid' ? 'default' : 'secondary'}>
                                {gen.invoiceStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
