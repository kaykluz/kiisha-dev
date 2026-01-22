import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Bell, Clock, AlertTriangle, Plus, X } from "lucide-react";

export default function RequestReminders() {
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [newCustomDay, setNewCustomDay] = useState("");

  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.requestReminders.getSettings.useQuery();

  const updateMutation = trpc.requestReminders.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Reminder settings updated");
      utils.requestReminders.getSettings.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleToggleReminders = (enabled: boolean) => {
    updateMutation.mutate({ remindersEnabled: enabled });
  };

  const handleUpdateFirstReminder = (days: number) => {
    updateMutation.mutate({ firstReminderDays: days });
  };

  const handleUpdateSecondReminder = (days: number) => {
    updateMutation.mutate({ secondReminderDays: days });
  };

  const handleToggleOverdue = (enabled: boolean) => {
    updateMutation.mutate({ overdueReminderEnabled: enabled });
  };

  const handleAddCustomDay = () => {
    const day = parseInt(newCustomDay);
    if (isNaN(day) || day < 1 || day > 90) {
      toast.error("Please enter a valid number between 1 and 90");
      return;
    }
    const currentDays = settings?.customReminderDays || [];
    if (currentDays.includes(day)) {
      toast.error("This reminder day already exists");
      return;
    }
    updateMutation.mutate({ customReminderDays: [...currentDays, day].sort((a, b) => b - a) });
    setNewCustomDay("");
  };

  const handleRemoveCustomDay = (day: number) => {
    const currentDays = settings?.customReminderDays || [];
    updateMutation.mutate({ customReminderDays: currentDays.filter((d) => d !== day) });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading settings...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Request Reminders</h1>
          <p className="text-muted-foreground">
            Configure automated reminder emails for requests approaching their deadline
          </p>
        </div>

        {/* Master Toggle */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-500" />
                <div>
                  <CardTitle>Automated Reminders</CardTitle>
                  <CardDescription>
                    Send automatic email reminders to request recipients
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings?.remindersEnabled ?? true}
                onCheckedChange={handleToggleReminders}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Standard Reminders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Standard Reminders
            </CardTitle>
            <CardDescription>
              Configure when to send reminders before the due date
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">First Reminder</Label>
                <p className="text-sm text-muted-foreground">
                  Sent before the due date
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={settings?.firstReminderDays ?? 3}
                  onChange={(e) => handleUpdateFirstReminder(parseInt(e.target.value) || 3)}
                  className="w-20"
                />
                <span className="text-muted-foreground">days before</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Second Reminder</Label>
                <p className="text-sm text-muted-foreground">
                  Final reminder before due date
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={settings?.secondReminderDays ?? 1}
                  onChange={(e) => handleUpdateSecondReminder(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-muted-foreground">days before</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overdue Reminder */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <CardTitle>Overdue Reminder</CardTitle>
                  <CardDescription>
                    Send a reminder when a request passes its due date
                  </CardDescription>
                </div>
              </div>
              <Switch
                checked={settings?.overdueReminderEnabled ?? true}
                onCheckedChange={handleToggleOverdue}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Custom Reminders */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Reminder Days</CardTitle>
            <CardDescription>
              Add additional reminder days for specific workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={90}
                value={newCustomDay}
                onChange={(e) => setNewCustomDay(e.target.value)}
                placeholder="Days before due date"
                className="w-48"
              />
              <Button onClick={handleAddCustomDay} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>

            {settings?.customReminderDays && settings.customReminderDays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {settings.customReminderDays.map((day) => (
                  <Badge key={day} variant="secondary" className="px-3 py-1">
                    {day} days before
                    <button
                      onClick={() => handleRemoveCustomDay(day)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No custom reminder days configured
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Reminder Schedule Preview</CardTitle>
            <CardDescription>
              Example timeline for a request due in 7 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {/* Custom reminders */}
                {settings?.customReminderDays?.filter((d) => d <= 7).sort((a, b) => b - a).map((day) => (
                  <div key={day} className="flex items-center gap-4 pl-8 relative">
                    <div className="absolute left-2.5 w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <p className="font-medium">Custom Reminder</p>
                      <p className="text-sm text-muted-foreground">{day} days before due date</p>
                    </div>
                  </div>
                ))}
                
                {/* First reminder */}
                {(settings?.firstReminderDays ?? 3) <= 7 && (
                  <div className="flex items-center gap-4 pl-8 relative">
                    <div className="absolute left-2.5 w-3 h-3 rounded-full bg-orange-500" />
                    <div>
                      <p className="font-medium">First Reminder</p>
                      <p className="text-sm text-muted-foreground">
                        {settings?.firstReminderDays ?? 3} days before due date
                      </p>
                    </div>
                  </div>
                )}

                {/* Second reminder */}
                <div className="flex items-center gap-4 pl-8 relative">
                  <div className="absolute left-2.5 w-3 h-3 rounded-full bg-yellow-500" />
                  <div>
                    <p className="font-medium">Second Reminder</p>
                    <p className="text-sm text-muted-foreground">
                      {settings?.secondReminderDays ?? 1} day before due date
                    </p>
                  </div>
                </div>

                {/* Due date */}
                <div className="flex items-center gap-4 pl-8 relative">
                  <div className="absolute left-2.5 w-3 h-3 rounded-full bg-green-500" />
                  <div>
                    <p className="font-medium">Due Date</p>
                    <p className="text-sm text-muted-foreground">Request deadline</p>
                  </div>
                </div>

                {/* Overdue */}
                {settings?.overdueReminderEnabled && (
                  <div className="flex items-center gap-4 pl-8 relative">
                    <div className="absolute left-2.5 w-3 h-3 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium">Overdue Reminder</p>
                      <p className="text-sm text-muted-foreground">1 day after due date</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
