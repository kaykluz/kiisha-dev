/**
 * Channel Settings Page
 * 
 * Allows users to manage their linked communication channels for OpenClaw integration.
 * Supports WhatsApp, Telegram, Slack, Discord, and other channels.
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
  Settings,
  Bell,
  Shield,
} from "lucide-react";

// Channel type
type ChannelType = "whatsapp" | "telegram" | "slack" | "discord" | "msteams" | "webchat";

// Channel configuration
interface ChannelConfig {
  type: ChannelType;
  name: string;
  icon: React.ReactNode;
  description: string;
  idLabel: string;
  idPlaceholder: string;
  idHelp: string;
}

const channelConfigs: ChannelConfig[] = [
  {
    type: "whatsapp",
    name: "WhatsApp",
    icon: <Phone className="h-5 w-5 text-green-500" />,
    description: "Connect your WhatsApp number to chat with KIISHA",
    idLabel: "Phone Number",
    idPlaceholder: "+234 800 000 0000",
    idHelp: "Enter your WhatsApp phone number with country code",
  },
  {
    type: "telegram",
    name: "Telegram",
    icon: <MessageSquare className="h-5 w-5 text-blue-500" />,
    description: "Link your Telegram account for instant messaging",
    idLabel: "Username",
    idPlaceholder: "@username",
    idHelp: "Enter your Telegram username (without @)",
  },
  {
    type: "slack",
    name: "Slack",
    icon: <Hash className="h-5 w-5 text-purple-500" />,
    description: "Connect Slack for team collaboration",
    idLabel: "Slack User ID",
    idPlaceholder: "U0123456789",
    idHelp: "Find your Slack User ID in your profile settings",
  },
  {
    type: "discord",
    name: "Discord",
    icon: <MessageCircle className="h-5 w-5 text-indigo-500" />,
    description: "Link your Discord account",
    idLabel: "Discord User ID",
    idPlaceholder: "123456789012345678",
    idHelp: "Enable Developer Mode in Discord to copy your User ID",
  },
  {
    type: "msteams",
    name: "Microsoft Teams",
    icon: <MessageSquare className="h-5 w-5 text-blue-600" />,
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
  const { data: linkedChannels, refetch: refetchChannels, isLoading } = trpc.openclaw.getLinkedChannels.useQuery(
    { organizationId },
    { enabled: !!organizationId }
  );
  
  // Initiate channel link mutation
  const initiateLink = trpc.openclaw.initiateChannelLink.useMutation({
    onSuccess: (data) => {
      toast.success("Verification Started", {
        description: data.message,
      });
      setPendingVerification({
        channelType: selectedChannel!,
        externalId,
      });
      setLinkDialogOpen(false);
      setVerifyDialogOpen(true);
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Verify channel link mutation
  const verifyLink = trpc.openclaw.verifyChannelLink.useMutation({
    onSuccess: () => {
      toast.success("Channel Linked", {
        description: "Your channel has been successfully linked!",
      });
      setVerifyDialogOpen(false);
      setPendingVerification(null);
      setVerificationCode("");
      refetchChannels();
    },
    onError: (error) => {
      toast.error("Verification Failed", {
        description: error.message,
      });
    },
  });
  
  // Revoke channel mutation
  const revokeChannel = trpc.openclaw.revokeChannel.useMutation({
    onSuccess: () => {
      toast.success("Channel Removed", {
        description: "The channel has been unlinked from your account.",
      });
      refetchChannels();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message,
      });
    },
  });
  
  // Handle initiate link
  const handleInitiateLink = () => {
    if (!selectedChannel || !externalId.trim()) return;
    
    initiateLink.mutate({
      channelType: selectedChannel,
      externalId: externalId.trim(),
      organizationId,
    });
  };
  
  // Handle verify
  const handleVerify = () => {
    if (!pendingVerification || !verificationCode.trim()) return;
    
    verifyLink.mutate({
      channelType: pendingVerification.channelType,
      externalId: pendingVerification.externalId,
      organizationId,
      code: verificationCode.trim(),
    });
  };
  
  // Handle revoke
  const handleRevoke = (channelId: number) => {
    revokeChannel.mutate({
      channelId,
      reason: "Removed by user",
    });
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Verified
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "revoked":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Revoked
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Get channel config
  const getChannelConfig = (type: string): ChannelConfig | undefined => {
    return channelConfigs.find((c) => c.type === type);
  };
  
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Connected Channels</h1>
            <p className="text-muted-foreground">
              Manage your communication channels for KIISHA Assistant
            </p>
          </div>
          
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Link Channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link a New Channel</DialogTitle>
                <DialogDescription>
                  Connect a messaging platform to access KIISHA from anywhere.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Channel</Label>
                  <Select
                    value={selectedChannel || ""}
                    onValueChange={(value) => setSelectedChannel(value as ChannelType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {channelConfigs.map((config) => (
                        <SelectItem key={config.type} value={config.type}>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            {config.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedChannel && (
                  <div className="space-y-2">
                    <Label>{getChannelConfig(selectedChannel)?.idLabel}</Label>
                    <Input
                      value={externalId}
                      onChange={(e) => setExternalId(e.target.value)}
                      placeholder={getChannelConfig(selectedChannel)?.idPlaceholder}
                    />
                    <p className="text-xs text-muted-foreground">
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
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Start Verification
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Verification Dialog */}
        <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Verify Your Channel</DialogTitle>
              <DialogDescription>
                Enter the 6-digit verification code to complete linking.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Send a message from your {pendingVerification?.channelType} account to KIISHA.
                  You'll receive a verification code.
                </p>
                <p className="font-mono text-lg">
                  {pendingVerification?.externalId}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                />
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
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Verify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Linked Channels */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {linkedChannels?.map((channel) => {
            const config = getChannelConfig(channel.channelType);
            
            return (
              <Card key={channel.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {config?.icon || <MessageCircle className="h-5 w-5" />}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {config?.name || channel.channelType}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {channel.externalId}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(channel.verificationStatus)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {channel.displayName && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Display Name:</span>{" "}
                        {channel.displayName}
                      </div>
                    )}
                    
                    {channel.lastUsedAt && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Last Used:</span>{" "}
                        {new Date(channel.lastUsedAt).toLocaleDateString()}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Notifications</span>
                      </div>
                      <Switch
                        checked={channel.notificationsEnabled}
                        disabled
                      />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="h-4 w-4 mr-1" />
                        Settings
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Channel?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will unlink {config?.name || channel.channelType} from your KIISHA account.
                              You won't be able to use KIISHA from this channel until you re-link it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRevoke(channel.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remove
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
          
          {/* Empty state */}
          {linkedChannels?.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">No Channels Linked</h3>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Link a messaging channel to access KIISHA from WhatsApp, Telegram, Slack, and more.
                </p>
                <Button onClick={() => setLinkDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Link Your First Channel
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Security Notice */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Security & Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• All conversations are encrypted and logged for compliance (VATR)</li>
              <li>• Channel identities are verified before granting access</li>
              <li>• You can revoke channel access at any time</li>
              <li>• Sensitive operations require additional approval</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
