import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  User,
  Bell,
  Shield,
  Clock,
  Upload,
  Save,
  Mail,
  FileText,
  AlertTriangle,
  Smartphone,
  ArrowLeft,
  Key,
  CheckCircle,
  XCircle,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Profile() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState("personal");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile data
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });

  // Personal info state
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // 2FA state
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");

  // Email change state
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailVerificationToken, setEmailVerificationToken] = useState("");

  // Notification preferences state
  const [notifications, setNotifications] = useState({
    emailDocuments: true,
    emailRfis: true,
    emailAlerts: true,
    emailReports: false,
    inAppDocuments: true,
    inAppRfis: true,
    inAppAlerts: true,
    digestFrequency: "realtime" as "realtime" | "daily" | "weekly",
    whatsappEnabled: false,
    whatsappDocuments: false,
    whatsappRfis: false,
    whatsappAlerts: false,
  });

  // Initialize form state from profile data
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setOrganization(profile.organization || "");
      if (profile.notificationPreferences) {
        setNotifications(prev => ({
          ...prev,
          ...profile.notificationPreferences,
        }));
      }
    }
  }, [profile]);

  // Mutations
  const updateProfileMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const uploadAvatarMutation = trpc.profile.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar uploaded successfully");
      utils.profile.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload avatar");
    },
  });

  const updateNotificationsMutation = trpc.profile.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to change password");
    },
  });

  const setup2FAMutation = trpc.auth.setup2FA.useMutation({
    onSuccess: (data) => {
      setTotpSecret(data.secret);
      setShow2FADialog(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to setup 2FA");
    },
  });

  const enable2FAMutation = trpc.auth.verify2FA.useMutation({
    onSuccess: () => {
      toast.success("Two-factor authentication enabled");
      setShow2FADialog(false);
      setTotpCode("");
      setTotpSecret("");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Invalid verification code");
    },
  });

  const disable2FAMutation = trpc.auth.disable2FA.useMutation({
    onSuccess: () => {
      toast.success("Two-factor authentication disabled");
      utils.profile.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to disable 2FA");
    },
  });

  // Email change mutations
  const requestEmailChangeMutation = trpc.profile.requestEmailChange.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      // In development, show the token for testing
      if (data.verificationToken) {
        setEmailVerificationToken(data.verificationToken);
      }
      utils.profile.getPendingEmailVerification.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to request email change");
    },
  });

  const verifyEmailChangeMutation = trpc.profile.verifyEmailChange.useMutation({
    onSuccess: (data) => {
      toast.success(`Email changed to ${data.newEmail}`);
      setShowEmailChangeDialog(false);
      setNewEmail("");
      setEmailVerificationToken("");
      utils.profile.get.invalidate();
      utils.profile.getPendingEmailVerification.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to verify email");
    },
  });

  const cancelEmailVerificationMutation = trpc.profile.cancelEmailVerification.useMutation({
    onSuccess: () => {
      toast.success("Email verification cancelled");
      setEmailVerificationToken("");
      utils.profile.getPendingEmailVerification.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to cancel verification");
    },
  });

  // Fetch pending email verification
  const { data: pendingEmailVerification } = trpc.profile.getPendingEmailVerification.useQuery(
    undefined,
    { enabled: !!user }
  );

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({ name, organization });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadAvatarMutation.mutate({
        base64Data: base64,
        mimeType: file.type,
        filename: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNotifications = () => {
    updateNotificationsMutation.mutate(notifications);
  };

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleSetup2FA = () => {
    setup2FAMutation.mutate();
  };

  const handleEnable2FA = () => {
    if (!totpCode || totpCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    enable2FAMutation.mutate({ token: totpCode });
  };

  const handleDisable2FA = () => {
    toast.info("To disable 2FA, please contact support or use your authenticator app to verify.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const strengthColors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-emerald-500"];

  // Fetch activity logs
  const { data: activityData, isLoading: activityLoading } = trpc.profile.getActivityLogs.useQuery(
    { limit: 50, offset: 0 },
    { enabled: !!user }
  );

  // Format activity action for display
  const formatActivityAction = (action: string): string => {
    const actionLabels: Record<string, string> = {
      login: "Signed in",
      logout: "Signed out",
      profile_update: "Updated profile",
      avatar_upload: "Uploaded avatar",
      password_change: "Changed password",
      "2fa_enable": "Enabled two-factor authentication",
      "2fa_disable": "Disabled two-factor authentication",
      document_upload: "Uploaded document",
      document_view: "Viewed document",
      document_download: "Downloaded document",
      settings_change: "Changed settings",
      email_change_request: "Requested email change",
      email_verified: "Verified email address",
      notification_preferences_update: "Updated notification preferences",
      project_create: "Created project",
      project_update: "Updated project",
      rfi_create: "Created RFI",
      rfi_update: "Updated RFI",
      checklist_update: "Updated checklist",
    };
    return actionLabels[action] || action.replace(/_/g, " ");
  };

  // Get icon for activity action
  const getActivityIcon = (action: string) => {
    if (action.includes("document")) return <FileText className="w-4 h-4 text-[var(--color-brand-primary)]" />;
    if (action.includes("2fa") || action.includes("password")) return <Shield className="w-4 h-4 text-[var(--color-brand-primary)]" />;
    if (action.includes("email")) return <Mail className="w-4 h-4 text-[var(--color-brand-primary)]" />;
    if (action.includes("notification")) return <Bell className="w-4 h-4 text-[var(--color-brand-primary)]" />;
    return <Clock className="w-4 h-4 text-[var(--color-brand-primary)]" />;
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      {/* Hidden file input for avatar upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleAvatarUpload}
      />

      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile?.avatarUrl || undefined} />
              <AvatarFallback className="bg-[var(--color-brand-primary)] text-white text-lg">
                {getInitials(profile?.name || user?.name || "User")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {profile?.name || user?.name || "User"}
              </h1>
              <p className="text-[var(--color-text-secondary)]">{profile?.email || user?.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">
                  {profile?.role === "admin" ? "Administrator" : "Team Member"}
                </Badge>
                {profile?.twoFactorEnabled && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30">
                    <Shield className="w-3 h-3 mr-1" />
                    2FA Enabled
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="personal" className="gap-2">
              <User className="w-4 h-4" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-2">
              <Clock className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* Personal Info Tab */}
          <TabsContent value="personal">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-6">
                Personal Information
              </h2>

              <div className="space-y-6">
                {/* Avatar Upload */}
                <div>
                  <Label className="text-sm font-medium">Profile Photo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={profile?.avatarUrl || undefined} />
                      <AvatarFallback className="bg-[var(--color-brand-primary)] text-white text-xl">
                        {getInitials(profile?.name || user?.name || "User")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadAvatarMutation.isPending}
                      >
                        {uploadAvatarMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Upload Photo
                      </Button>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        JPG, PNG up to 2MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="flex gap-2 mt-1.5">
                      <Input
                        id="email"
                        type="email"
                        value={profile?.email || ""}
                        disabled
                        className="bg-[var(--color-bg-surface-hover)]"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEmailChangeDialog(true)}
                        className="whitespace-nowrap"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Change
                      </Button>
                    </div>
                    {pendingEmailVerification && (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                        <Clock className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs text-yellow-600">
                          Pending verification for {pendingEmailVerification.newEmail}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => cancelEmailVerificationMutation.mutate()}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Role & Organization */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Role</Label>
                    <Input
                      value={profile?.role === "admin" ? "Administrator" : "Team Member"}
                      disabled
                      className="mt-1.5 bg-[var(--color-bg-surface-hover)]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="organization">Organization</Label>
                    <Input
                      id="organization"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="mt-1.5"
                      placeholder="Enter your organization"
                    />
                  </div>
                </div>

                {/* Account Info */}
                <div className="pt-4 border-t border-[var(--color-border-subtle)]">
                  <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Account Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-text-tertiary)]">Login Method:</span>
                      <span className="ml-2 text-[var(--color-text-primary)]">
                        {profile?.loginMethod === 'local' ? 'Email & Password' : 'OAuth (Manus)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-tertiary)]">Last Sign In:</span>
                      <span className="ml-2 text-[var(--color-text-primary)]">
                        {profile?.lastSignedIn ? formatDistanceToNow(new Date(profile.lastSignedIn), { addSuffix: true }) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4 border-t border-[var(--color-border-subtle)]">
                  <Button 
                    className="btn-primary" 
                    onClick={handleSaveProfile} 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <div className="space-y-6">
              {/* Email Notifications */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary-muted)] flex items-center justify-center">
                    <Mail className="w-5 h-5 text-[var(--color-brand-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      Email Notifications
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Choose what updates you receive via email
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <NotificationToggle
                    icon={<FileText className="w-4 h-4" />}
                    title="Document Updates"
                    description="New uploads, verifications, and rejections"
                    checked={notifications.emailDocuments}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailDocuments: checked })
                    }
                  />
                  <NotificationToggle
                    icon={<AlertTriangle className="w-4 h-4" />}
                    title="RFI & Action Items"
                    description="New RFIs, assignments, and status changes"
                    checked={notifications.emailRfis}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailRfis: checked })
                    }
                  />
                  <NotificationToggle
                    icon={<Bell className="w-4 h-4" />}
                    title="System Alerts"
                    description="Deadline reminders and critical updates"
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailAlerts: checked })
                    }
                  />
                  <NotificationToggle
                    icon={<FileText className="w-4 h-4" />}
                    title="Reports"
                    description="Weekly summaries and analytics reports"
                    checked={notifications.emailReports}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, emailReports: checked })
                    }
                  />
                </div>
              </div>

              {/* In-App Notifications */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary-muted)] flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-[var(--color-brand-primary)]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      In-App Notifications
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Control notifications within the application
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <NotificationToggle
                    icon={<FileText className="w-4 h-4" />}
                    title="Document Updates"
                    description="Show notifications for document changes"
                    checked={notifications.inAppDocuments}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, inAppDocuments: checked })
                    }
                  />
                  <NotificationToggle
                    icon={<AlertTriangle className="w-4 h-4" />}
                    title="RFI & Action Items"
                    description="Show notifications for RFI changes"
                    checked={notifications.inAppRfis}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, inAppRfis: checked })
                    }
                  />
                  <NotificationToggle
                    icon={<Bell className="w-4 h-4" />}
                    title="Alerts"
                    description="Show notifications for system alerts"
                    checked={notifications.inAppAlerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, inAppAlerts: checked })
                    }
                  />
                </div>
              </div>

              {/* WhatsApp Notifications */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      WhatsApp Notifications
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Receive updates via WhatsApp (requires linked number)
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <NotificationToggle
                    icon={<MessageSquare className="w-4 h-4" />}
                    title="Enable WhatsApp"
                    description="Turn on WhatsApp notifications"
                    checked={notifications.whatsappEnabled}
                    onCheckedChange={(checked) =>
                      setNotifications({ 
                        ...notifications, 
                        whatsappEnabled: checked,
                        whatsappDocuments: checked ? notifications.whatsappDocuments : false,
                        whatsappRfis: checked ? notifications.whatsappRfis : false,
                        whatsappAlerts: checked ? notifications.whatsappAlerts : false,
                      })
                    }
                  />
                  {notifications.whatsappEnabled && (
                    <>
                      <NotificationToggle
                        icon={<FileText className="w-4 h-4" />}
                        title="Document Updates"
                        description="Receive document notifications via WhatsApp"
                        checked={notifications.whatsappDocuments}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, whatsappDocuments: checked })
                        }
                      />
                      <NotificationToggle
                        icon={<AlertTriangle className="w-4 h-4" />}
                        title="RFI & Action Items"
                        description="Receive RFI notifications via WhatsApp"
                        checked={notifications.whatsappRfis}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, whatsappRfis: checked })
                        }
                      />
                      <NotificationToggle
                        icon={<Bell className="w-4 h-4" />}
                        title="Critical Alerts"
                        description="Receive urgent alerts via WhatsApp"
                        checked={notifications.whatsappAlerts}
                        onCheckedChange={(checked) =>
                          setNotifications({ ...notifications, whatsappAlerts: checked })
                        }
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Digest Frequency */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  Email Digest Frequency
                </h2>
                <Select
                  value={notifications.digestFrequency}
                  onValueChange={(value: "realtime" | "daily" | "weekly") =>
                    setNotifications({ ...notifications, digestFrequency: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time (as they happen)</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button 
                  className="btn-primary" 
                  onClick={handleSaveNotifications} 
                  disabled={updateNotificationsMutation.isPending}
                >
                  {updateNotificationsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {updateNotificationsMutation.isPending ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Password - Only show for local auth users */}
              {profile?.loginMethod === 'local' && (
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary-muted)] flex items-center justify-center">
                      <Key className="w-5 h-5 text-[var(--color-brand-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Change Password
                      </h2>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Update your password regularly for better security
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative mt-1.5">
                        <Input
                          id="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {newPassword && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${strengthColors[passwordStrength - 1] || "bg-muted"} transition-all`}
                                style={{ width: `${(passwordStrength / 6) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {strengthLabels[passwordStrength - 1] || "Too Short"}
                            </span>
                          </div>
                          <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                            <li className="flex items-center gap-1">
                              {newPassword.length >= 8 ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              At least 8 characters
                            </li>
                            <li className="flex items-center gap-1">
                              {/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              Upper and lowercase letters
                            </li>
                            <li className="flex items-center gap-1">
                              {/[0-9]/.test(newPassword) ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              At least one number
                            </li>
                            <li className="flex items-center gap-1">
                              {/[^A-Za-z0-9]/.test(newPassword) ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                              At least one special character
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="mt-1.5"
                      />
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Passwords do not match
                        </p>
                      )}
                      {confirmPassword && newPassword === confirmPassword && (
                        <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Passwords match
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={handleChangePassword}
                      disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || newPassword !== confirmPassword}
                    >
                      {changePasswordMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </div>
              )}

              {/* OAuth Info for OAuth users */}
              {profile?.loginMethod !== 'local' && (
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary-muted)] flex items-center justify-center">
                      <Key className="w-5 h-5 text-[var(--color-brand-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Password Management
                      </h2>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Your account uses OAuth authentication
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-surface-hover)] rounded-lg">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      You signed in using Manus OAuth. Password management is handled by your identity provider.
                      To change your password, please visit your Manus account settings.
                    </p>
                  </div>
                </div>
              )}

              {/* Two-Factor Authentication */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-primary-muted)] flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-[var(--color-brand-primary)]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        Two-Factor Authentication
                      </h2>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Add an extra layer of security using an authenticator app
                      </p>
                    </div>
                  </div>
                  {profile?.twoFactorEnabled ? (
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Enabled
                      </Badge>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleDisable2FA}
                        disabled={disable2FAMutation.isPending}
                      >
                        {disable2FAMutation.isPending ? "Disabling..." : "Disable"}
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={handleSetup2FA}
                      disabled={setup2FAMutation.isPending}
                    >
                      {setup2FAMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {setup2FAMutation.isPending ? "Setting up..." : "Enable 2FA"}
                    </Button>
                  )}
                </div>

                {!profile?.twoFactorEnabled && (
                  <div className="mt-4 p-4 bg-[var(--color-bg-surface-hover)] rounded-lg">
                    <h3 className="font-medium text-sm mb-2">How it works:</h3>
                    <ol className="text-sm text-[var(--color-text-secondary)] space-y-1 list-decimal list-inside">
                      <li>Click "Enable 2FA" to generate a secret key</li>
                      <li>Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)</li>
                      <li>Enter the 6-digit code from your app to verify</li>
                      <li>Save your backup codes in a safe place</li>
                    </ol>
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  Active Sessions
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[var(--color-semantic-success)]" />
                      <div>
                        <p className="text-sm font-medium">Current Session</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {navigator.userAgent.includes("Chrome") ? "Chrome" : 
                           navigator.userAgent.includes("Firefox") ? "Firefox" : 
                           navigator.userAgent.includes("Safari") ? "Safari" : "Browser"} 
                          {" "}on {navigator.platform}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[var(--color-semantic-success)]">
                      Active
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Recent Activity
                </h2>
                {activityData && (
                  <span className="text-sm text-[var(--color-text-tertiary)]">
                    {activityData.total} total activities
                  </span>
                )}
              </div>
              <ScrollArea className="h-96">
                {activityLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-brand-primary)]" />
                  </div>
                ) : activityData?.logs && activityData.logs.length > 0 ? (
                  <div className="space-y-4">
                    {activityData.logs.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--color-brand-primary-muted)] flex items-center justify-center flex-shrink-0">
                          {getActivityIcon(activity.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {formatActivityAction(activity.action)}
                          </p>
                          {activity.resourceName && (
                            <p className="text-sm text-[var(--color-text-secondary)] truncate">
                              {activity.resourceName}
                            </p>
                          )}
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Clock className="w-8 h-8 text-[var(--color-text-tertiary)] mb-2" />
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      No activity recorded yet
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                      Your actions will appear here as you use the platform
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Email Change Dialog */}
      <Dialog open={showEmailChangeDialog} onOpenChange={setShowEmailChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              Enter your new email address. We'll send a verification link to confirm the change.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="currentEmail">Current Email</Label>
              <Input
                id="currentEmail"
                type="email"
                value={profile?.email || ""}
                disabled
                className="mt-1.5 bg-[var(--color-bg-surface-hover)]"
              />
            </div>

            <div>
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email address"
                className="mt-1.5"
              />
            </div>

            {emailVerificationToken && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-600 mb-2">
                  Verification email sent!
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                  In production, check your inbox. For testing, use this token:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                    {emailVerificationToken}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(emailVerificationToken)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <Button
                    className="w-full"
                    onClick={() => verifyEmailChangeMutation.mutate({ token: emailVerificationToken })}
                    disabled={verifyEmailChangeMutation.isPending}
                  >
                    {verifyEmailChangeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Verify Email
                  </Button>
                </div>
              </div>
            )}

            {!emailVerificationToken && (
              <Button
                className="w-full"
                onClick={() => requestEmailChangeMutation.mutate({ newEmail })}
                disabled={requestEmailChangeMutation.isPending || !newEmail || newEmail === profile?.email}
              >
                {requestEmailChangeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {requestEmailChangeMutation.isPending ? "Sending..." : "Send Verification Email"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Setup Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code below with your authenticator app, then enter the verification code.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* QR Code placeholder - in production, generate actual QR code */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48 bg-white p-4 rounded-lg flex items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <Smartphone className="w-12 h-12 mx-auto mb-2 text-muted-foreground/50" />
                  <p>QR Code would appear here</p>
                  <p className="text-xs mt-1">Use the secret key below</p>
                </div>
              </div>

              {/* Secret Key */}
              <div className="w-full">
                <Label className="text-sm text-muted-foreground">Secret Key (manual entry)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                    {totpSecret || "Loading..."}
                  </code>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(totpSecret)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Verification Code Input */}
            <div>
              <Label htmlFor="totpCode">Verification Code</Label>
              <Input
                id="totpCode"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="mt-1.5 text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
            </div>

            <Button 
              className="w-full"
              onClick={handleEnable2FA}
              disabled={enable2FAMutation.isPending || totpCode.length !== 6}
            >
              {enable2FAMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {enable2FAMutation.isPending ? "Verifying..." : "Verify and Enable"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Notification Toggle Component
function NotificationToggle({
  icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface-hover)] flex items-center justify-center text-[var(--color-text-secondary)]">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
          <p className="text-xs text-[var(--color-text-tertiary)]">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
