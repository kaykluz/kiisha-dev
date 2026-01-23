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
  Loader2,
} from "lucide-react";
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

// Status dot component
function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    resolved: "bg-[var(--color-success)]",
    closed: "bg-[var(--color-success)]",
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
  rfi: any;
  project: any;
  onClose: () => void;
  onDelete?: () => void;
  userRole?: "admin" | "editor" | "reviewer" | "investor_viewer";
}

function RfiDrawer({ rfi, project, onClose, onDelete, userRole = "admin" }: RfiDrawerProps) {
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

  const traceability: WorkspaceItemTraceability = {
    linkedDocuments: [],
    linkedChecklistItems: [],
    linkedScheduleItems: [],
    createdAt: rfi.createdAt || new Date().toISOString(),
    createdBy: "Unknown",
    lastModifiedAt: rfi.updatedAt || new Date().toISOString(),
    lastModifiedBy: "Unknown",
  };

  const activityHistory: any[] = [];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={rfi.title}
      subtitle={`${rfi.code} • ${project?.name || 'Unknown Project'}`}
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
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">
                  Priority
                </label>
                <div className="flex items-center gap-2 h-10">
                  <PriorityIndicator priority={rfi.priority} />
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">
                Due Date
              </label>
              <InlineDatePicker
                value={dueDate}
                onChange={handleDueDateChange}
                disabled={isInvestorViewer}
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 block">
                Description
              </label>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {rfi.description || "No description provided."}
              </p>
            </div>

            {/* Metadata */}
            <div className="pt-4 border-t border-[var(--color-border-subtle)]">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[var(--color-text-tertiary)]">Created:</span>
                  <span className="ml-2 text-[var(--color-text-secondary)]">
                    {new Date(traceability.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--color-text-tertiary)]">Last Modified:</span>
                  <span className="ml-2 text-[var(--color-text-secondary)]">
                    {new Date(traceability.lastModifiedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Links Tab */}
        <TabsContent value="links" className="flex-1 m-0 overflow-auto">
          <div className="p-6 space-y-6">
            {/* Linked Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Linked Documents
                </h3>
                {!isInvestorViewer && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Link
                  </Button>
                )}
              </div>
              {traceability.linkedDocuments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] italic">No linked documents</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{doc.name}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {doc.type} {doc.pageReference && `• Page ${doc.pageReference}`}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Checklist Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  Linked Checklist Items
                </h3>
                {!isInvestorViewer && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Link
                  </Button>
                )}
              </div>
              {traceability.linkedChecklistItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] italic">No linked checklist items</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedChecklistItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                      <div className="flex items-center gap-3">
                        <ListChecks className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <ChecklistStatus status={item.status} />
                            <span className="text-xs text-[var(--color-text-tertiary)]">Due {item.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Schedule Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                  <GanttChart className="w-4 h-4" />
                  Linked Schedule Items
                </h3>
                {!isInvestorViewer && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" />
                    Link
                  </Button>
                )}
              </div>
              {traceability.linkedScheduleItems.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] italic">No linked schedule items</p>
              ) : (
                <div className="space-y-2">
                  {traceability.linkedScheduleItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-surface-hover)]">
                      <div className="flex items-center gap-3">
                        <GanttChart className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</p>
                          <p className="text-xs text-[var(--color-text-tertiary)]">
                            {item.phase} • {item.startDate} - {item.endDate}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 m-0 overflow-auto">
          <div className="p-6">
            {activityHistory.length === 0 ? (
              <EmptyState
                type="tasks"
                title="No activity yet"
                description="Activity history will appear here as changes are made."
              />
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-border-subtle)]" />
                {activityHistory.map((entry: any, idx: number) => (
                  <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center z-10",
                      entry.action === "created" ? "bg-[var(--color-success)]/10" :
                      entry.action === "status_change" ? "bg-[var(--color-info)]/10" :
                      "bg-[var(--color-bg-surface-hover)]"
                    )}>
                      {entry.action === "created" && <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />}
                      {entry.action === "linked_document" && <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                      {entry.action === "linked_checklist" && <ListChecks className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                      {entry.action === "comment" && <MessageSquare className="w-4 h-4 text-[var(--color-text-tertiary)]" />}
                      {entry.action === "status_change" && <Clock className="w-4 h-4 text-[var(--color-info)]" />}
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
  const [selectedRfi, setSelectedRfi] = useState<any | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["Site & Real Estate", "Permits", "Technical", "Interconnection", "Other"])
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  
  // Fetch projects from API
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();
  
  // Fetch RFIs from database
  const { data: rfis = [], isLoading: rfisLoading, refetch: refetchRfis } = trpc.rfis.list.useQuery(
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

  const isLoading = projectsLoading || rfisLoading;

  const filteredRfis = (rfis as any[]).filter((rfi) => {
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
  const resolvedCount = filteredRfis.filter((r) => r.status === "resolved" || r.status === "closed").length;

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading workspace...</p>
          </div>
        </div>
      </div>
    );
  }

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
            {(Object.entries(rfisByCategory) as [string, any[]][]).map(([category, categoryRfis]) => (
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
                  <span className="text-xs text-[var(--color-text-tertiary)] ml-1">({categoryRfis.length})</span>
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
                      {categoryRfis.map((rfi: any) => {
                        const project = projects.find((p: any) => p.id === rfi.projectId);
                        
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
                              <span className="text-sm text-[var(--color-text-secondary)]">{project?.name || 'Unknown'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-[var(--color-text-primary)] truncate max-w-md">{rfi.title}</p>
                            </td>
                            <td className="px-4 py-3">
                              <PriorityIndicator priority={rfi.priority} />
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-[var(--color-text-secondary)]">{rfi.assignee || "—"}</span>
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
                              {/* Links indicator - will show when linked items exist */}
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
          project={projects.find((p: any) => p.id === selectedRfi.projectId)}
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
