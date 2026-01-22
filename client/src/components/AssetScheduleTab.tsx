/**
 * Phase 36: Asset Schedule Tab
 * 
 * Shows obligations linked to an asset in the asset drawer.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Link as LinkIcon
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

type ObligationStatus = 
  | "OPEN"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "WAITING_REVIEW"
  | "APPROVED"
  | "COMPLETED"
  | "OVERDUE"
  | "CANCELLED";

type ObligationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface Obligation {
  id: number;
  title: string;
  description: string | null;
  obligationType: ObligationType;
  status: ObligationStatus;
  priority: ObligationPriority;
  dueAt: Date | null;
  startAt: Date | null;
  createdAt: Date;
}

// Status badge colors
const statusColors: Record<ObligationStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  BLOCKED: "bg-red-100 text-red-800",
  WAITING_REVIEW: "bg-purple-100 text-purple-800",
  APPROVED: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800"
};

// Priority badge colors
const priorityColors: Record<ObligationPriority, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800"
};

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

// Status icons
function StatusIcon({ status }: { status: ObligationStatus }) {
  switch (status) {
    case "COMPLETED":
    case "APPROVED":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "OVERDUE":
    case "BLOCKED":
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
}

// Format relative time
function formatRelativeTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return `${diffDays}d`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Obligation Card
function ObligationCard({ 
  obligation, 
  onStatusChange 
}: { 
  obligation: Obligation;
  onStatusChange: (id: number, status: ObligationStatus) => void;
}) {
  return (
    <Card className="mb-2">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <StatusIcon status={obligation.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{obligation.title}</h4>
              {obligation.dueAt && (
                <span className={`text-xs whitespace-nowrap ${
                  obligation.status === "OVERDUE" ? "text-red-600 font-medium" : "text-muted-foreground"
                }`}>
                  {formatRelativeTime(obligation.dueAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={priorityColors[obligation.priority]} variant="secondary">
                {obligation.priority}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {typeLabels[obligation.obligationType]}
              </span>
            </div>
          </div>
        </div>
        {obligation.status !== "COMPLETED" && obligation.status !== "CANCELLED" && (
          <div className="flex gap-1 mt-2 pt-2 border-t">
            {obligation.status === "OPEN" && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs"
                onClick={() => onStatusChange(obligation.id, "IN_PROGRESS")}
              >
                Start
              </Button>
            )}
            {obligation.status === "IN_PROGRESS" && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs"
                onClick={() => onStatusChange(obligation.id, "COMPLETED")}
              >
                Complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Link Existing Obligation Dialog
function LinkObligationDialog({ 
  assetId, 
  onLinked 
}: { 
  assetId: number;
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  
  // Fetch all obligations
  const { data: obligations } = trpc.obligations.list.useQuery({
    limit: 100
  });
  
  const linkMutation = trpc.obligations.link.useMutation({
    onSuccess: () => {
      setOpen(false);
      setSelectedId("");
      onLinked();
    }
  });
  
  const handleLink = () => {
    if (!selectedId) return;
    linkMutation.mutate({
      obligationId: parseInt(selectedId),
      entityType: "ASSET",
      entityId: assetId,
      linkType: "SECONDARY"
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="h-4 w-4 mr-1" />
          Link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Existing Obligation</DialogTitle>
          <DialogDescription>
            Link an existing obligation to this asset.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label>Select Obligation</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose an obligation" />
            </SelectTrigger>
            <SelectContent>
              {obligations?.map(o => (
                <SelectItem key={o.id} value={String(o.id)}>
                  {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedId || linkMutation.isPending}>
            {linkMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Obligation for Asset Dialog
function CreateObligationDialog({ 
  assetId, 
  onCreated 
}: { 
  assetId: number;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [obligationType, setObligationType] = useState<ObligationType>("CUSTOM");
  const [priority, setPriority] = useState<ObligationPriority>("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  
  const createMutation = trpc.obligations.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      setTitle("");
      setDescription("");
      setObligationType("CUSTOM");
      setPriority("MEDIUM");
      setDueAt("");
      onCreated();
    }
  });
  
  const handleSubmit = () => {
    createMutation.mutate({
      title,
      description: description || undefined,
      obligationType,
      priority,
      dueAt: dueAt ? new Date(dueAt) : undefined,
      linkedEntity: {
        entityType: "ASSET",
        entityId: assetId,
        linkType: "PRIMARY"
      }
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Obligation</DialogTitle>
          <DialogDescription>
            Create a new obligation linked to this asset.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter obligation title"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={obligationType} onValueChange={(v) => setObligationType(v as ObligationType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as ObligationPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dueAt">Due Date</Label>
            <Input
              id="dueAt"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export default function AssetScheduleTab({ assetId }: { assetId: number }) {
  const utils = trpc.useUtils();
  
  // Fetch obligations for this asset
  const { data: obligations, isLoading, refetch } = trpc.obligations.getForEntity.useQuery({
    entityType: "ASSET",
    entityId: assetId
  });
  
  // Status update mutation
  const updateStatusMutation = trpc.obligations.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    }
  });
  
  const handleStatusChange = (id: number, status: ObligationStatus) => {
    updateStatusMutation.mutate({ id, status });
  };
  
  // Group by status
  const activeObligations = obligations?.filter(o => 
    !["COMPLETED", "CANCELLED"].includes(o.status)
  ) || [];
  
  const completedObligations = obligations?.filter(o => 
    ["COMPLETED", "CANCELLED"].includes(o.status)
  ) || [];
  
  const overdueCount = activeObligations.filter(o => o.status === "OVERDUE").length;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Schedule</span>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <LinkObligationDialog assetId={assetId} onLinked={refetch} />
          <CreateObligationDialog assetId={assetId} onCreated={refetch} />
        </div>
      </div>
      
      {/* Active Obligations */}
      {activeObligations.length === 0 && completedObligations.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No obligations linked to this asset</p>
          <p className="text-sm">Create or link an obligation to track deadlines</p>
        </div>
      ) : (
        <>
          {activeObligations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Active ({activeObligations.length})
              </h4>
              {activeObligations.map(o => (
                <ObligationCard 
                  key={o.id} 
                  obligation={o} 
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
          
          {completedObligations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Completed ({completedObligations.length})
              </h4>
              {completedObligations.slice(0, 3).map(o => (
                <ObligationCard 
                  key={o.id} 
                  obligation={o} 
                  onStatusChange={handleStatusChange}
                />
              ))}
              {completedObligations.length > 3 && (
                <Button variant="ghost" size="sm" className="w-full text-xs">
                  Show {completedObligations.length - 3} more
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
