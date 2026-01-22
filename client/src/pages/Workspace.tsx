import { useState } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Drawer, DrawerSection, DrawerField, DrawerFieldGrid } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { CommentsSection, CommentsCount } from "@/components/CommentsSection";
import { cn, formatDate, getDueDateStatus } from "@/lib/utils";
import { DueDateIndicator, DueDateDot } from "@/components/DueDateIndicator";
import { InlineDatePicker } from "@/components/DatePicker";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  Download,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  FileText,
  MessageSquare,
  Calendar,
  Link2,
  ExternalLink,
  ListChecks,
  GanttChart,
  History,
  Eye,
} from "lucide-react";
import { mockProjects, mockRfis } from "@shared/mockData";
import { CreateRfiDialog } from "@/components/CreateRfiDialog";
import { trpc } from "@/lib/trpc";
import { useFeatureFlag } from "@/contexts/FeatureFlagContext";
import { FeatureButton } from "@/components/FeatureButton";

// Traceability types
interface LinkedDocument {
  id: string;
  name: string;
  type: string;
  pageReference?: number;
  linkedAt: string;
  linkedBy: string;
}

interface LinkedChecklistItem {
  id: string;
  title: string;
  status: "pending" | "complete" | "blocked";
  dueDate: string;
  linkedAt: string;
}

interface LinkedScheduleItem {
  id: string;
  title: string;
  phase: string;
  startDate: string;
  endDate: string;
  linkedAt: string;
}

interface WorkspaceItemTraceability {
  linkedDocuments: LinkedDocument[];
  linkedChecklistItems: LinkedChecklistItem[];
  linkedScheduleItems: LinkedScheduleItem[];
  createdAt: string;
  createdBy: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

// Mock traceability data
const mockTraceability: Record<number, WorkspaceItemTraceability> = {
  1: {
    linkedDocuments: [
      { id: "doc-1", name: "Lease Agreement v2.pdf", type: "Lease", pageReference: 12, linkedAt: "2026-01-10T14:30:00Z", linkedBy: "Sarah Chen" },
      { id: "doc-2", name: "Payment Schedule.xlsx", type: "Financial", linkedAt: "2026-01-10T14:35:00Z", linkedBy: "Sarah Chen" },
    ],
    linkedChecklistItems: [
      { id: "cl-1", title: "Lease execution complete", status: "pending", dueDate: "2026-01-20", linkedAt: "2026-01-10T14:40:00Z" },
      { id: "cl-2", title: "Payment terms verified", status: "complete", dueDate: "2026-01-15", linkedAt: "2026-01-10T14:40:00Z" },
    ],
    linkedScheduleItems: [
      { id: "sch-1", title: "Site Lease Finalization", phase: "Development", startDate: "2026-01-15", endDate: "2026-02-01", linkedAt: "2026-01-10T14:45:00Z" },
    ],
    createdAt: "2026-01-08T09:00:00Z",
    createdBy: "Mike Johnson",
    lastModifiedAt: "2026-01-12T16:30:00Z",
    lastModifiedBy: "Sarah Chen",
  },
  2: {
    linkedDocuments: [
      { id: "doc-3", name: "Interconnection_Agreement.pdf", type: "Interconnection", pageReference: 5, linkedAt: "2026-01-09T10:00:00Z", linkedBy: "Emily Watson" },
    ],
    linkedChecklistItems: [
      { id: "cl-3", title: "IC agreement signed", status: "blocked", dueDate: "2026-01-25", linkedAt: "2026-01-09T10:05:00Z" },
    ],
    linkedScheduleItems: [
      { id: "sch-2", title: "Interconnection Study", phase: "Feasibility", startDate: "2026-01-01", endDate: "2026-02-15", linkedAt: "2026-01-09T10:10:00Z" },
    ],
    createdAt: "2026-01-05T11:00:00Z",
    createdBy: "Emily Watson",
    lastModifiedAt: "2026-01-11T14:00:00Z",
    lastModifiedBy: "Emily Watson",
  },
};

// Activity history
const mockActivityHistory: Record<number, Array<{ id: string; action: string; user: string; timestamp: string; details: string }>> = {
  1: [
    { id: "a1", action: "created", user: "Mike Johnson", timestamp: "2026-01-08T09:00:00Z", details: "Created RFI from document review" },
    { id: "a2", action: "linked_document", user: "Sarah Chen", timestamp: "2026-01-10T14:30:00Z", details: "Linked Lease Agreement v2.pdf" },
    { id: "a3", action: "linked_checklist", user: "Sarah Chen", timestamp: "2026-01-10T14:40:00Z", details: "Linked to closing checklist items" },
    { id: "a4", action: "comment", user: "Sarah Chen", timestamp: "2026-01-12T16:30:00Z", details: "Added comment about landowner response" },
  ],
  2: [
    { id: "a5", action: "created", user: "Emily Watson", timestamp: "2026-01-05T11:00:00Z", details: "Created RFI for IC study clarification" },
    { id: "a6", action: "linked_document", user: "Emily Watson", timestamp: "2026-01-09T10:00:00Z", details: "Linked Interconnection Agreement" },
    { id: "a7", action: "status_change", user: "Emily Watson", timestamp: "2026-01-11T14:00:00Z", details: "Changed status to In Progress" },
  ],
};

// Status dot component
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    resolved: "bg-[var(--color-success)]",
    in_progress: "bg-[var(--color-info)]",
    open: "bg-[var(--color-brand)]",
  };
  return <span className={cn("w-2 h-2 rounded-full", colors[status] || "bg-[var(--color-text-tertiary)]")} />;
}

// Priority indicator
function PriorityIndicator({ priority }: { priority: string }) {
  const config: Record<string, { label: string; color: string }> = {
    critical: { label: "Critical", color: "text-[var(--color-error)]" },
    high: { label: "High", color: "text-[var(--color-brand)]" },
    medium: { label: "Medium", color: "text-[var(--color-warning)]" },
    low: { label: "Low", color: "text-[var(--color-text-tertiary)]" },
  };
  const { label, color } = config[priority] || config.medium;
  return <span className={cn("text-xs font-medium", color)}>{label}</span>;
}

// Checklist status
function ChecklistStatus({ status }: { status: "pending" | "complete" | "blocked" }) {
  const config = {
    pending: { label: "Pending", color: "text-[var(--color-warning)]" },
    complete: { label: "Complete", color: "text-[var(--color-success)]" },
    blocked: { label: "Blocked", color: "text-[var(--color-error)]" },
  };
  const { label, color } = config[status];
  return <span className={cn("text-xs font-medium", color)}>{label}</span>;
}

// RFI Detail Drawer
interface RfiDrawerProps {
  rfi: (typeof mockRfis)[0];
  onClose: () => void;
  onDelete?: () => void;
  userRole?: "admin" | "editor" | "reviewer" | "investor_viewer";
}

function RfiDrawer({ rfi, onClose, onDelete, userRole = "admin" }: RfiDrawerProps) {
  const project = mockProjects.find((p) => p.id === rfi.projectId);
  const [status, setStatus] = useState<string>(rfi.status);
  const [dueDate, setDueDate] = useState<Date | null>(() => {
    if (!rfi.dueDate) return null;
    const date = rfi.dueDate instanceof Date ? rfi.dueDate : new Date(rfi.dueDate);
    return isNaN(date.getTime()) ? null : date;
  });
  const [activeTab, setActiveTab] = useState("details");
  const isInvestorViewer = userRole === "investor_viewer";
  
  // Update RFI mutation for due date changes
  const updateRfiMutation = trpc.rfis.update.useMutation({
    onSuccess: () => {
      toast.success("Due date updated");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update due date");
    },
  });
  
  const handleDueDateChange = (newDate: Date | null) => {
    setDueDate(newDate);
    // Only update if this is a database RFI (has numeric id)
    if (typeof rfi.id === 'number') {
      updateRfiMutation.mutate({
        id: rfi.id,
        dueDate: newDate ? newDate.toISOString().split('T')[0] : undefined,
      });
    }
  };

  const traceability = mockTraceability[rfi.id] || {
    linkedDocuments: [],
    linkedChecklistItems: [],
    linkedScheduleItems: [],
    createdAt: new Date().toISOString(),
    createdBy: "Unknown",
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: "Unknown",
  };

  const activityHistory = mockActivityHistory[rfi.id] || [];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={rfi.title}
      subtitle={`${rfi.code} • ${project?.name}`}
      size="lg"
      footer={
        !isInvestorViewer ? (
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={() => {
              if (onDelete) {
                if (confirm(`Are you sure you want to delete "${rfi.title}"? This action cannot be undone.`)) {
                  onDelete();
                }
              }
            }}>
              Delete
            </Button>
            <Button className="flex-1 btn-primary" onClick={() => toast.success("Changes saved")}>
              Save Changes
            </Button>
          </div>
        ) : undefined
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <TabsList className="mx-6 mt-2 grid w-auto grid-cols-4 bg-[var(--color-bg-surface)]">
          <TabsTrigger value="details" className="text-sm">Details</TabsTrigger>
          <TabsTrigger value="links" className="text-sm">Links</TabsTrigger>
          <TabsTrigger value="history" className="text-sm">History</TabsTrigger>
          <TabsTrigger value="comments" className="text-sm flex items-center gap-1">
            Comments
            <CommentsCount resourceType="workspace_item" resourceId={rfi.id} />
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="flex-1 m-0 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Status & Priority */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">
                  Status
                </label>
                <Select value={status} onValueChange={setStatus} disabled={isInvestorViewer}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <div className="flex items-center gap-2">
                        <StatusDot status="open" />
                        Open
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <StatusDot status="in_progress" />
                        In Progress
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <StatusDot status="resolved" />
                        Resolved
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">
                  Priority
                </label>
                <div className="h-10 flex items-center">
                  <PriorityIndicator priority={rfi.priority} />
                </div>
              </div>
            </div>

            {/* Description */}
            <DrawerSection title="Description">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {rfi.description || "No description provided."}
              </p>
            </DrawerSection>

            {/* Metadata */}
            <DrawerSection title="Details">
              <DrawerFieldGrid>
                <DrawerField label="Category" value={rfi.category} />
                <DrawerField label="Assignee" value={(rfi as any).assignee || "Unassigned"} />
                <div>
                  <dt className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Due Date
                  </dt>
                  <dd className="text-sm">
                    {isInvestorViewer ? (
                      <DueDateIndicator date={dueDate} showRelativeTime={true} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <InlineDatePicker
                          value={dueDate}
                          onChange={handleDueDateChange}
                          disabled={isInvestorViewer}
                        />
                        {dueDate && getDueDateStatus(dueDate) !== 'normal' && getDueDateStatus(dueDate) !== 'none' && (
                          <DueDateDot date={dueDate} />
                        )}
                      </div>
                    )}
                  </dd>
                </div>
                <DrawerField label="Created" value={formatDate(traceability.createdAt)} />
              </DrawerFieldGrid>
            </DrawerSection>

            {/* Quick Comments Link */}
            <DrawerSection title="Discussion">
              <button
                onClick={() => setActiveTab("comments")}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">View all comments</span>
                </div>
                <CommentsCount resourceType="workspace_item" resourceId={rfi.id} />
              </button>
            </DrawerSection>
          </div>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links" className="flex-1 m-0 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Linked Documents */}
            <DrawerSection title={`Linked Documents (${traceability.linkedDocuments.length})`}>
              {traceability.linkedDocuments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] py-4 text-center">No linked documents</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] cursor-pointer transition-colors"
                    >
                      <FileText className="w-4 h-4 text-[var(--color-info)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {doc.type} {doc.pageReference && `• Page ${doc.pageReference}`}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    </div>
                  ))}
                </div>
              )}
              {!isInvestorViewer && (
                <FeatureButton 
                  featureFlag="LINKING_ENGINE" 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 w-full"
                  disabledTooltip="Document linking is being configured for your organization"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Link Document
                </FeatureButton>
              )}
            </DrawerSection>

            {/* Linked Checklist Items */}
            <DrawerSection title={`Linked Checklist Items (${traceability.linkedChecklistItems.length})`}>
              {traceability.linkedChecklistItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] py-4 text-center">No linked checklist items</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedChecklistItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] cursor-pointer transition-colors"
                    >
                      <ListChecks className="w-4 h-4 text-[var(--color-success)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.title}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">Due: {item.dueDate}</p>
                      </div>
                      <ChecklistStatus status={item.status} />
                    </div>
                  ))}
                </div>
              )}
              {!isInvestorViewer && (
                <FeatureButton 
                  featureFlag="LINKING_ENGINE" 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 w-full"
                  disabledTooltip="Checklist linking is being configured for your organization"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Link Checklist Item
                </FeatureButton>
              )}
            </DrawerSection>

            {/* Linked Schedule Items */}
            <DrawerSection title={`Linked Schedule Items (${traceability.linkedScheduleItems.length})`}>
              {traceability.linkedScheduleItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] py-4 text-center">No linked schedule items</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedScheduleItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)] cursor-pointer transition-colors"
                    >
                      <GanttChart className="w-4 h-4 text-[var(--color-brand)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.title}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {item.phase} • {item.startDate} → {item.endDate}
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                    </div>
                  ))}
                </div>
              )}
              {!isInvestorViewer && (
                <FeatureButton 
                  featureFlag="LINKING_ENGINE" 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 w-full"
                  disabledTooltip="Schedule linking is being configured for your organization"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Link Schedule Item
                </FeatureButton>
              )}
            </DrawerSection>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 m-0 overflow-auto">
          <div className="p-6">
            {activityHistory.length === 0 ? (
              <p className="text-sm text-[var(--color-text-tertiary)] py-8 text-center">No activity history</p>
            ) : (
              <div className="space-y-4">
                {activityHistory.map((entry, index) => (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        entry.action === "created" && "bg-[var(--color-brand-muted)]",
                        entry.action === "linked_document" && "bg-[var(--color-info-muted)]",
                        entry.action === "linked_checklist" && "bg-[var(--color-success-muted)]",
                        entry.action === "comment" && "bg-[var(--color-warning-muted)]",
                        entry.action === "status_change" && "bg-purple-500/20"
                      )}>
                        {entry.action === "created" && <Plus className="w-4 h-4 text-[var(--color-brand)]" />}
                        {entry.action === "linked_document" && <FileText className="w-4 h-4 text-[var(--color-info)]" />}
                        {entry.action === "linked_checklist" && <ListChecks className="w-4 h-4 text-[var(--color-success)]" />}
                        {entry.action === "comment" && <MessageSquare className="w-4 h-4 text-[var(--color-warning)]" />}
                        {entry.action === "status_change" && <Clock className="w-4 h-4 text-purple-500" />}
                      </div>
                      {index < activityHistory.length - 1 && (
                        <div className="w-px h-full bg-[var(--color-border-subtle)] my-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] capitalize">
                        {entry.action.replace("_", " ")}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)]">{entry.details}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-tertiary)]">
                        <User className="w-3 h-3" />
                        {entry.user}
                        <span>•</span>
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="flex-1 m-0 overflow-auto">
          <div className="p-6">
            <CommentsSection
              resourceType="workspace_item"
              resourceId={rfi.id}
            />
          </div>
        </TabsContent>
      </Tabs>
    </Drawer>
  );
}

function WorkspaceContent() {
  const { selectedProjectId } = useProject();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRfi, setSelectedRfi] = useState<(typeof mockRfis)[0] | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Site & Real Estate", "Permits", "Technical", "Interconnection"])
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Fetch RFIs from database
  const { data: dbRfis, refetch: refetchRfis } = trpc.rfis.list.useQuery(
    selectedProjectId ? { projectId: selectedProjectId } : undefined
  );
  
  // Delete RFI mutation
  const deleteRfiMutation = trpc.rfis.delete.useMutation({
    onSuccess: () => {
      toast.success("RFI deleted successfully");
      setSelectedRfi(null);
      refetchRfis();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete RFI");
    },
  });
  
  const handleDeleteRfi = (rfiId: number) => {
    deleteRfiMutation.mutate({ id: rfiId });
  };
  
  // Combine database RFIs with mock data for demo
  const allRfis = [...((dbRfis || []) as any[]), ...mockRfis];

  const filteredRfis = allRfis.filter((rfi) => {
    if (selectedProjectId && rfi.projectId !== selectedProjectId) return false;
    if (statusFilter !== "all" && rfi.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        rfi.title.toLowerCase().includes(query) ||
        rfi.description?.toLowerCase().includes(query) ||
        rfi.code?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const rfisByCategory = filteredRfis.reduce((acc, rfi: any) => {
    const cat = rfi.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rfi);
    return acc;
  }, {} as Record<string, any[]>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const openCount = filteredRfis.filter((r) => r.status === "open").length;
  const inProgressCount = filteredRfis.filter((r) => r.status === "in_progress").length;
  const resolvedCount = filteredRfis.filter((r) => r.status === "resolved").length;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Workspace</h1>
          <p className="page-subtitle">RFIs, Tasks, Risks & Issues with full traceability</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm" className="btn-primary" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Item
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <Input
            placeholder="Search RFIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 mr-2" />
          More Filters
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <StatusDot status="open" />
          <span className="text-[var(--color-text-secondary)]">Open:</span>
          <span className="font-semibold text-[var(--color-text-primary)]">{openCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="in_progress" />
          <span className="text-[var(--color-text-secondary)]">In Progress:</span>
          <span className="font-semibold text-[var(--color-text-primary)]">{inProgressCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status="resolved" />
          <span className="text-[var(--color-text-secondary)]">Resolved:</span>
          <span className="font-semibold text-[var(--color-text-primary)]">{resolvedCount}</span>
        </div>
      </div>

      {/* RFI List */}
      {filteredRfis.length === 0 ? (
        <EmptyState
          type="tasks"
          title="No RFIs found"
          description={searchQuery ? `No results for "${searchQuery}"` : "Create your first RFI to start tracking requests."}
          actionLabel="Create RFI"
          onAction={() => setCreateDialogOpen(true)}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
          <ScrollArea className="h-[600px]">
            {(Object.entries(rfisByCategory) as [string, any[]][]).map(([category, rfis]) => (
              <Collapsible
                key={category}
                open={expandedCategories.has(category)}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] border-b border-[var(--color-border-subtle)] transition-colors">
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  )}
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{category}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)] ml-1">({rfis.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-base)]">
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-24">ID</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-32">Project</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2">Description</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-24">Priority</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-32">Assignee</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-28">Due Date</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-24">Status</th>
                        <th className="text-left text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider px-4 py-2 w-16">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rfis.map((rfi: any) => {
                        const project = mockProjects.find((p) => p.id === rfi.projectId);
                        const trace = mockTraceability[rfi.id];
                        const hasLinks = trace && (trace.linkedDocuments.length > 0 || trace.linkedChecklistItems.length > 0 || trace.linkedScheduleItems.length > 0);
                        
                        return (
                          <tr
                            key={rfi.id}
                            className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] cursor-pointer transition-colors"
                            onClick={() => setSelectedRfi(rfi)}
                          >
                            <td className="px-4 py-3">
                              <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{rfi.code}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-[var(--color-text-secondary)]">{project?.name}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-[var(--color-text-primary)] truncate max-w-md">{rfi.title}</p>
                            </td>
                            <td className="px-4 py-3">
                              <PriorityIndicator priority={rfi.priority} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-[var(--color-text-secondary)]">{(rfi as any).assignee || "—"}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <DueDateDot date={rfi.dueDate} />
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                  {formatDate(rfi.dueDate)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <StatusDot status={rfi.status} />
                                <span className="text-sm text-[var(--color-text-secondary)] capitalize">
                                  {rfi.status.replace("_", " ")}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {hasLinks && (
                                <Link2 className="w-4 h-4 text-[var(--color-info)]" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </ScrollArea>
        </div>
      )}

      {/* RFI Detail Drawer */}
      {selectedRfi && (
        <RfiDrawer 
          rfi={selectedRfi} 
          onClose={() => setSelectedRfi(null)} 
          onDelete={() => handleDeleteRfi(selectedRfi.id)}
        />
      )}
      
      {/* Create RFI Dialog */}
      <CreateRfiDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={selectedProjectId || undefined}
        onSuccess={() => refetchRfis()}
      />
    </div>
  );
}

export default function Workspace() {
  return (
    <AppLayout>
      <WorkspaceContent />
    </AppLayout>
  );
}
