/**
 * Channel Settings Page
 *
 * Allows users to manage their linked communication channels for OpenClaw integration.
 * Supports WhatsApp, Telegram, Slack, Discord, MS Teams, and web chat.
 *
 * UX improvements:
 * - Loading skeletons for async data
 * - Step-by-step OTP verification with clear instructions
 * - Channel cards with status indicators + text labels
 * - Confirmation dialogs for destructive actions
 * - Empty state with clear CTA
 * - VATR compliance notice
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthProvider";
import { trpc } from "@/lib/trpc";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  Phone,
  MessageSquare,
  Hash,
  MessageCircle,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Bell,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";

// Channel type
type ChannelType = "whatsapp" | "telegram" | "slack" | "discord" | "msteams" | "webchat";

// Channel configuration
interface ChannelConfig {
  type: ChannelType;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  idLabel: string;
  idPlaceholder: string;
  idHelp: string;
}

const channelConfigs: ChannelConfig[] = [
  {
    type: "whatsapp",
    name: "WhatsApp",
    icon: <Phone className="h-5 w-5" />,
    color: "text-green-500",
    description: "Connect your WhatsApp number to chat with KIISHA",
    idLabel: "Phone Number",
    idPlaceholder: "+234 800 000 0000",
    idHelp: "Enter your WhatsApp phone number with country code",
  },
  {
    type: "telegram",
    name: "Telegram",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-blue-500",
    description: "Link your Telegram account for instant messaging",
    idLabel: "Username",
    idPlaceholder: "@username",
    idHelp: "Enter your Telegram username (without @)",
  },
  {
    type: "slack",
    name: "Slack",
    icon: <Hash className="h-5 w-5" />,
    color: "text-purple-500",
    description: "Connect Slack for team collaboration",
    idLabel: "Slack User ID",
    idPlaceholder: "U0123456789",
    idHelp: "Find your Slack User ID in your profile settings",
  },
  {
    type: "discord",
    name: "Discord",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "text-indigo-500",
    description: "Link your Discord account",
    idLabel: "Discord User ID",
    idPlaceholder: "123456789012345678",
    idHelp: "Enable Developer Mode in Discord to copy your User ID",
  },
  {
    type: "msteams",
    name: "Microsoft Teams",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-blue-600",
    description: "Connect Microsoft Teams for enterprise messaging",
    idLabel: "Teams User ID",
    idPlaceholder: "user@company.com",
    idHelp: "Use your Microsoft Teams email address",
  },
];

export default function ChannelSettings() {
  const { state } = useAuth();
  const organizationId = state?.activeOrganization?.id || 0;
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [externalId, setExternalId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState<{
    channelType: ChannelType;
    externalId: string;
  } | null>(null);

  // Get linked channels
  const { data: linkedChannels, refetch: refetchChannels, isLoading } =
    trpc.openclaw.getLinkedChannels.useQuery(
      { organizationId },
      { enabled: !!organizationId }
    );

  // Mutations
  const initiateLink = trpc.openclaw.initiateChannelLink.useMutation({
    onSuccess: (data) => {
      toast.success("Verification code sent to your channel.");
      setPendingVerification({
        channelType: selectedChannel!,
        externalId,
      });
      setLinkDialogOpen(false);
      setVerifyDialogOpen(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const verifyLink = trpc.openclaw.verifyChannelLink.useMutation({
    onSuccess: () => {
      toast.success("Channel linked successfully!");
      setVerifyDialogOpen(false);
      setPendingVerification(null);
      setVerificationCode("");
      setExternalId("");
      setSelectedChannel(null);
      refetchChannels();
    },
    onError: (error) => toast.error(error.message),
  });

  const revokeChannel = trpc.openclaw.revokeChannel.useMutation({
    onSuccess: () => {
      toast.success("Channel removed from your account.");
      refetchChannels();
    },
    onError: (error) => toast.error(error.message),
  });

  // Handlers
  const handleInitiateLink = () => {
    if (!selectedChannel || !externalId.trim()) return;
    initiateLink.mutate({
      channelType: selectedChannel,
      externalId: externalId.trim(),
      organizationId,
    });
  };

  const handleVerify = () => {
    if (!pendingVerification || !verificationCode.trim()) return;
    verifyLink.mutate({
      channelType: pendingVerification.channelType,
      externalId: pendingVerification.externalId,
      organizationId,
      code: verificationCode.trim(),
    });
  };

  const getChannelConfig = (type: string): ChannelConfig | undefined =>
    channelConfigs.find((c) => c.type === type);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[11px]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20 text-[11px]">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-[11px]">
            <XCircle className="h-3 w-3 mr-1" />
            Revoked
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

  const verifiedCount = linkedChannels?.filter((c) => c.verificationStatus === "verified").length || 0;

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-[900px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Connected Channels</h1>
              <p className="text-sm text-muted-foreground">
                {verifiedCount > 0
                  ? `${verifiedCount} channel${verifiedCount !== 1 ? "s" : ""} connected`
                  : "Link messaging channels to use KIISHA Assistant"}
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setSelectedChannel(null);
              setExternalId("");
              setLinkDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Link Channel
          </Button>
        </div>

        {/* Link Dialog */}
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Link a New Channel</DialogTitle>
              <DialogDescription>
                Connect a messaging platform to access KIISHA from anywhere.
                You'll verify ownership via a 6-digit code.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Channel <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedChannel || ""}
                  onValueChange={(value) => setSelectedChannel(value as ChannelType)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose a channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channelConfigs.map((config) => (
                      <SelectItem key={config.type} value={config.type}>
                        <div className="flex items-center gap-2">
                          <span className={config.color}>{config.icon}</span>
                          {config.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedChannel && (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    {getChannelConfig(selectedChannel)?.idLabel}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder={getChannelConfig(selectedChannel)?.idPlaceholder}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {getChannelConfig(selectedChannel)?.idHelp}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleInitiateLink}
                disabled={!selectedChannel || !externalId.trim() || initiateLink.isPending}
              >
                {initiateLink.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-1.5" />
                )}
                Send Verification Code
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Verification Dialog */}
        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Verify Your Channel</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code sent to your{" "}
                {pendingVerification ? getChannelConfig(pendingVerification.channelType)?.name : "channel"}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 bg-muted/50 rounded-lg border border-border/50 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Verifying channel identity for
                </p>
                <p className="font-mono text-sm font-medium">
                  {pendingVerification?.externalId}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Verification Code</Label>
                <Input
                  value={verificationCode}
                  onChange={(e) => {
                    // Only allow digits
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCode(val);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-12"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground text-center">
                  Code expires in 10 minutes
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verificationCode.length !== 6 || verifyLink.isPending}
              >
                {verifyLink.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                )}
                Verify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Channel Cards */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full mb-2" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : linkedChannels && linkedChannels.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {linkedChannels.map((channel) => {
              const config = getChannelConfig(channel.channelType);

              return (
                <Card key={channel.id} className="group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <span className={config?.color || "text-muted-foreground"}>
                            {config?.icon || <MessageCircle className="h-5 w-5" />}
                          </span>
                        </div>
                        <div>
                          <CardTitle className="text-sm">
                            {config?.name || channel.channelType}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-mono">
                            {channel.externalId}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(channel.verificationStatus)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      {channel.displayName && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Display Name</span>
                          <span>{channel.displayName}</span>
                        </div>
                      )}

                      {channel.lastUsedAt && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Last Used</span>
                          <span>{new Date(channel.lastUsedAt).toLocaleDateString()}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Bell className="h-3 w-3" />
                          Notifications
                        </span>
                        <Switch
                          checked={channel.notificationsEnabled}
                          disabled
                          className="scale-75"
                          aria-label="Toggle notifications"
                        />
                      </div>

                      <Separator />

                      <div className="flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Channel?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will unlink{" "}
                                <span className="font-medium">
                                  {config?.name || channel.channelType}
                                </span>{" "}
                                ({channel.externalId}) from your KIISHA account.
                                You won't be able to use KIISHA from this channel until you
                                re-link and verify it.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => revokeChannel.mutate({ channelId: channel.id, reason: "Removed by user" })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove Channel
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-base mb-1">No Channels Linked</h3>
              <p className="text-sm text-muted-foreground text-center mb-5 max-w-[340px]">
                Link a messaging channel to access KIISHA Assistant from WhatsApp,
                Telegram, Slack, and more.
              </p>
              <Button
                onClick={() => {
                  setSelectedChannel(null);
                  setExternalId("");
                  setLinkDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Link Your First Channel
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Security & Privacy Notice */}
        <Card className="border-primary/10 bg-primary/[0.02]">
          <CardContent className="flex items-start gap-3 py-4">
            <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Security & Privacy</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>All conversations are encrypted and VATR-logged for compliance</li>
                <li>Channel identities are verified via OTP before granting access</li>
                <li>You can revoke channel access at any time from this page</li>
                <li>Sensitive operations require additional admin approval</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
