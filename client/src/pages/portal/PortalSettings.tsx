/**
 * Customer Portal Settings Page
 * 
 * Allows customers to manage their notification preferences and account settings.
 * 
 * WHO USES THIS:
 * - Customer: Manages their own notification preferences
 * - Located at: /portal/settings
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Bell, Mail, FileText, Wrench, AlertTriangle, 
  BarChart3, Settings, Save, ArrowLeft, Clock,
  Shield, User, CreditCard
} from 'lucide-react';
import PortalLayout from './PortalLayout';

interface NotificationPreferences {
  emailNewInvoice: boolean;
  emailPaymentConfirmation: boolean;
  emailPaymentReminder: boolean;
  emailWorkOrderStatusChange: boolean;
  emailWorkOrderComment: boolean;
  emailProductionReport: boolean;
  emailMaintenanceAlert: boolean;
  emailFrequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  digestTime: string;
  digestDayOfWeek: number;
}

const defaultPreferences: NotificationPreferences = {
  emailNewInvoice: true,
  emailPaymentConfirmation: true,
  emailPaymentReminder: true,
  emailWorkOrderStatusChange: true,
  emailWorkOrderComment: true,
  emailProductionReport: false,
  emailMaintenanceAlert: true,
  emailFrequency: 'immediate',
  digestTime: '09:00',
  digestDayOfWeek: 1,
};

export default function PortalSettings() {
  const [, navigate] = useLocation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current preferences
  const { data: currentPrefs, isLoading } = trpc.customerPortal.getNotificationPreferences.useQuery();
  
  // Save mutation
  const saveMutation = trpc.customerPortal.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success('Settings saved successfully');
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    }
  });

  useEffect(() => {
    if (currentPrefs) {
      setPreferences({
        emailNewInvoice: currentPrefs.emailNewInvoice ?? true,
        emailPaymentConfirmation: currentPrefs.emailPaymentConfirmation ?? true,
        emailPaymentReminder: currentPrefs.emailPaymentReminder ?? true,
        emailWorkOrderStatusChange: currentPrefs.emailWorkOrderStatusChange ?? true,
        emailWorkOrderComment: currentPrefs.emailWorkOrderComment ?? true,
        emailProductionReport: currentPrefs.emailProductionReport ?? false,
        emailMaintenanceAlert: currentPrefs.emailMaintenanceAlert ?? true,
        emailFrequency: currentPrefs.emailFrequency ?? 'immediate',
        digestTime: currentPrefs.digestTime ?? '09:00',
        digestDayOfWeek: currentPrefs.digestDayOfWeek ?? 1,
      });
    }
  }, [currentPrefs]);

  const updatePreference = (key: keyof NotificationPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync(preferences);
    } finally {
      setIsSaving(false);
    }
  };

  const notificationCategories = [
    {
      title: 'Billing & Payments',
      icon: CreditCard,
      items: [
        {
          key: 'emailNewInvoice' as const,
          label: 'New Invoice',
          description: 'Receive an email when a new invoice is generated for your account'
        },
        {
          key: 'emailPaymentConfirmation' as const,
          label: 'Payment Confirmation',
          description: 'Receive confirmation when your payment is processed'
        },
        {
          key: 'emailPaymentReminder' as const,
          label: 'Payment Reminders',
          description: 'Receive reminders for upcoming or overdue invoices'
        }
      ]
    },
    {
      title: 'Work Orders & Support',
      icon: Wrench,
      items: [
        {
          key: 'emailWorkOrderStatusChange' as const,
          label: 'Status Updates',
          description: 'Get notified when your work order status changes'
        },
        {
          key: 'emailWorkOrderComment' as const,
          label: 'New Comments',
          description: 'Receive notifications when someone comments on your work order'
        }
      ]
    },
    {
      title: 'Monitoring & Alerts',
      icon: AlertTriangle,
      items: [
        {
          key: 'emailMaintenanceAlert' as const,
          label: 'Maintenance Alerts',
          description: 'Get notified about scheduled or emergency maintenance'
        },
        {
          key: 'emailProductionReport' as const,
          label: 'Production Reports',
          description: 'Receive periodic reports about your energy production'
        }
      ]
    }
  ];

  const dayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/portal')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Manage your account and notification preferences</p>
            </div>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            {/* Email Frequency */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Email Delivery
                </CardTitle>
                <CardDescription>
                  Choose how you want to receive email notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Delivery Frequency</Label>
                  <Select
                    value={preferences.emailFrequency}
                    onValueChange={(value) => updatePreference('emailFrequency', value)}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate (as they happen)</SelectItem>
                      <SelectItem value="daily_digest">Daily Digest</SelectItem>
                      <SelectItem value="weekly_digest">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {preferences.emailFrequency === 'immediate' 
                      ? 'You will receive emails as soon as events occur'
                      : preferences.emailFrequency === 'daily_digest'
                      ? 'You will receive a summary email once per day'
                      : 'You will receive a summary email once per week'}
                  </p>
                </div>

                {preferences.emailFrequency !== 'immediate' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Delivery Time</Label>
                      <Select
                        value={preferences.digestTime}
                        onValueChange={(value) => updatePreference('digestTime', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => {
                            const hour = i.toString().padStart(2, '0');
                            return (
                              <SelectItem key={hour} value={`${hour}:00`}>
                                {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {preferences.emailFrequency === 'weekly_digest' && (
                      <div className="space-y-2">
                        <Label>Day of Week</Label>
                        <Select
                          value={preferences.digestDayOfWeek.toString()}
                          onValueChange={(value) => updatePreference('digestDayOfWeek', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dayOptions.map(day => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Categories */}
            {notificationCategories.map((category) => (
              <Card key={category.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <category.icon className="h-5 w-5" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {category.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor={item.key} className="text-base font-medium">
                          {item.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <Switch
                        id={item.key}
                        checked={preferences[item.key]}
                        onCheckedChange={(checked) => updatePreference(item.key, checked)}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Your account details and contact information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <p className="text-sm text-muted-foreground">
                      Contact support to update your email address
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <p className="text-sm text-muted-foreground">
                      Your company information is managed by your account administrator
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>
                  Change your account password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate('/portal/change-password')}>
                  Change Password
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Two-factor authentication is not yet enabled for your account.
                </p>
                <Button variant="outline" disabled>
                  Enable 2FA (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PortalLayout>
  );
}
