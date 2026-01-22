/**
 * Phase 36: Obligation Settings Admin Page
 * 
 * Manage reminder policies and calendar integrations.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bell,
  Calendar,
  Plus,
  Trash2,
  Settings,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink
} from "lucide-react";

// Types
type ObligationType = 
  | "RFI_ITEM"
  | "APPROVAL_GATE"
  | "WORK_ORDER"
  | "MAINTENANCE"
  | "DOCUMENT_EXPIRY"
  | "MILESTONE"
  | "REPORT_DEADLINE"
  | "COMPLIANCE_REQUIREMENT"
  | "CUSTOM";

type ReminderChannel = "EMAIL" | "WHATSAPP" | "IN_APP" | "PUSH";

interface ReminderPolicy {
  id: number;
  name: string;
  obligationType: ObligationType | null;
  isDefault: boolean;
  isActive: boolean;
  reminderOffsets: number[];
  escalationOffsets: number[];
  channels: ReminderChannel[];
}

// Type labels
const typeLabels: Record<ObligationType, string> = {
  RFI_ITEM: "RFI Item",
  APPROVAL_GATE: "Approval Gate",
  WORK_ORDER: "Work Order",
  MAINTENANCE: "Maintenance",
  DOCUMENT_EXPIRY: "Document Expiry",
  MILESTONE: "Milestone",
  REPORT_DEADLINE: "Report Deadline",
  COMPLIANCE_REQUIREMENT: "Compliance",
  CUSTOM: "Custom"
};

// Channel labels
const channelLabels: Record<ReminderChannel, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  IN_APP: "In-App",
  PUSH: "Push Notification"
};

// Format offset as human readable
function formatOffset(hours: number): string {
  if (hours < 0) return `${Math.abs(hours)}h after`;
  if (hours < 24) return `${hours}h before`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) return `${days}d before`;
  return `${days}d ${remainingHours}h before`;
}

// Create Policy Dialog
function CreatePolicyDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [obligationType, setObligationType] = useState<string>("all");
  const [isDefault, setIsDefault] = useState(false);
  const [reminderOffsets, setReminderOffsets] = useState("24,72,168"); // 1d, 3d, 7d in hours
  const [escalationOffsets, setEscalationOffsets] = useState("-24,-72"); // 1d, 3d after
  const [channels, setChannels] = useState<ReminderChannel[]>(["EMAIL", "IN_APP"]);
  
  const createMutation = trpc.obligations.createReminderPolicy.useMutation({
    onSuccess: () => {
      setOpen(false);
      setName("");
      setObligationType("all");
      setIsDefault(false);
      setReminderOffsets("24,72,168");
      setEscalationOffsets("-24,-72");
      setChannels(["EMAIL", "IN_APP"]);
      onCreated();
    }
  });
  
  const handleSubmit = () => {
    createMutation.mutate({
      name,
      obligationType: obligationType === "all" ? undefined : obligationType as ObligationType,
      isDefault,
      reminderOffsets: reminderOffsets.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
      escalationOffsets: escalationOffsets.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
      channels
    });
  };
  
  const toggleChannel = (channel: ReminderChannel) => {
    if (channels.includes(channel)) {
      setChannels(channels.filter(c => c !== channel));
    } else {
      setChannels([...channels, channel]);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Reminder Policy</DialogTitle>
          <DialogDescription>
            Configure when and how reminders are sent for obligations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Policy Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Reminders"
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Applies To</Label>
            <Select value={obligationType} onValueChange={setObligationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Obligation Types</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reminderOffsets">Reminder Times (hours before due)</Label>
            <Input
              id="reminderOffsets"
              value={reminderOffsets}
              onChange={(e) => setReminderOffsets(e.target.value)}
              placeholder="24,72,168"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated hours. e.g., 24 = 1 day before, 168 = 7 days before
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="escalationOffsets">Escalation Times (hours after due)</Label>
            <Input
              id="escalationOffsets"
              value={escalationOffsets}
              onChange={(e) => setEscalationOffsets(e.target.value)}
              placeholder="-24,-72"
            />
            <p className="text-xs text-muted-foreground">
              Use negative values for after due. e.g., -24 = 1 day after due
            </p>
          </div>
          
          <div className="grid gap-2">
            <Label>Notification Channels</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(channelLabels) as [ReminderChannel, string][]).map(([channel, label]) => (
                <Badge
                  key={channel}
                  variant={channels.includes(channel) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleChannel(channel)}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="isDefault">Set as default policy</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Reminder Policies Tab
function ReminderPoliciesTab() {
  const { data: policies, isLoading, refetch } = trpc.obligations.listReminderPolicies.useQuery();
  
  const toggleMutation = trpc.obligations.toggleReminderPolicy.useMutation({
    onSuccess: () => refetch()
  });
  
  const deleteMutation = trpc.obligations.deleteReminderPolicy.useMutation({
    onSuccess: () => refetch()
  });
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Reminder Policies</h3>
          <p className="text-sm text-muted-foreground">
            Configure when reminders and escalations are sent
          </p>
        </div>
        <CreatePolicyDialog onCreated={refetch} />
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Policy Name</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Reminders</TableHead>
              <TableHead>Escalations</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!policies || policies.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No reminder policies configured
                </TableCell>
              </TableRow>
            ) : (
              policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">
                    {policy.name}
                    {policy.isDefault && (
                      <Badge variant="secondary" className="ml-2">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {policy.obligationType ? typeLabels[policy.obligationType as ObligationType] : "All Types"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(policy.reminderOffsets as number[])?.map((offset, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {formatOffset(offset)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(policy.escalationOffsets as number[])?.map((offset, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-red-50">
                          {formatOffset(offset)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(policy.channels as ReminderChannel[])?.map((channel) => (
                        <Badge key={channel} variant="secondary" className="text-xs">
                          {channelLabels[channel]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={policy.isActive}
                      onCheckedChange={(checked) => 
                        toggleMutation.mutate({ id: policy.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate({ id: policy.id })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Calendar Integrations Tab
function CalendarIntegrationsTab() {
  const { data: integrations, isLoading, refetch } = trpc.obligations.listCalendarIntegrations.useQuery();
  
  const connectGoogle = () => {
    // TODO: Implement OAuth flow
    alert("Google Calendar OAuth integration coming soon");
  };
  
  const connectOutlook = () => {
    // TODO: Implement OAuth flow
    alert("Outlook Calendar OAuth integration coming soon");
  };
  
  const toggleMutation = trpc.obligations.toggleCalendarIntegration.useMutation({
    onSuccess: () => refetch()
  });
  
  // TODO: Add deleteCalendarIntegration to obligations router
  const deleteMutation = { mutate: (_: { id: number }) => alert("Delete coming soon"), isPending: false };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Calendar Integrations</h3>
        <p className="text-sm text-muted-foreground">
          Sync obligations with your external calendars
        </p>
      </div>
      
      {/* Available Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar
            </CardTitle>
            <CardDescription>
              Sync obligations to your Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connectGoogle}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Outlook Calendar
            </CardTitle>
            <CardDescription>
              Sync obligations to your Outlook Calendar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={connectOutlook}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect Outlook
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Connected Integrations */}
      {integrations && integrations.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Connected Calendars</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Calendar</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((integration) => (
                  <TableRow key={integration.id}>
                    <TableCell className="font-medium">
                      {integration.calendarName || "Primary Calendar"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {integration.provider}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {integration.lastSyncAt 
                        ? new Date(integration.lastSyncAt).toLocaleString()
                        : "Never"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={integration.syncEnabled}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: integration.id, syncEnabled: checked })
                          }
                        />
                        {integration.lastSyncError && (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate({ id: integration.id })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      {/* iCal Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            iCal Export
          </CardTitle>
          <CardDescription>
            Subscribe to your obligations in any calendar app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy this URL to subscribe to your obligations in any calendar application that supports iCal feeds.
          </p>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={`${window.location.origin}/api/calendar/ical/obligations.ics`}
              className="font-mono text-sm"
            />
            <Button 
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/api/calendar/ical/obligations.ics`);
              }}
            >
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main Page
export default function ObligationSettingsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Obligation Settings</h1>
          <p className="text-muted-foreground">
            Configure reminders, escalations, and calendar integrations
          </p>
        </div>
        
        <Tabs defaultValue="reminders">
          <TabsList>
            <TabsTrigger value="reminders">
              <Bell className="h-4 w-4 mr-2" />
              Reminder Policies
            </TabsTrigger>
            <TabsTrigger value="calendars">
              <Calendar className="h-4 w-4 mr-2" />
              Calendar Integrations
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="reminders" className="mt-6">
            <ReminderPoliciesTab />
          </TabsContent>
          
          <TabsContent value="calendars" className="mt-6">
            <CalendarIntegrationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
