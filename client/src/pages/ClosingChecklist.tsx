import { useState, useMemo } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Drawer, DrawerSection, DrawerField, DrawerFieldGrid } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Calendar,
  User,
  Link2,
  ArrowRight,
  Target,
  XCircle,
  ClipboardList,
  Download,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";

type ChecklistItemStatus = "not_started" | "in_progress" | "pending_review" | "completed" | "blocked" | "na";

const statusConfig: Record<ChecklistItemStatus, { label: string; icon: typeof Circle; color: string; bg: string }> = {
  not_started: { label: "Not Started", icon: Circle, color: "var(--color-text-tertiary)", bg: "var(--color-bg-surface)" },
  in_progress: { label: "In Progress", icon: Clock, color: "var(--color-info)", bg: "var(--color-info-muted)" },
  pending_review: { label: "Pending Review", icon: AlertCircle, color: "var(--color-warning)", bg: "var(--color-warning-muted)" },
  completed: { label: "Completed", icon: CheckCircle2, color: "var(--color-success)", bg: "var(--color-success-muted)" },
  blocked: { label: "Blocked", icon: XCircle, color: "var(--color-error)", bg: "var(--color-error-muted)" },
  na: { label: "N/A", icon: Circle, color: "var(--color-text-tertiary)", bg: "var(--color-bg-surface)" },
};

// Status badge component
function StatusBadge({ status }: { status: ChecklistItemStatus }) {
  const config = statusConfig[status];
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}

function ClosingChecklistContent() {
  const { selectedProjectId } = useProject();
  const { data: projects = [] } = trpc.projects.list.useQuery();
  const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Legal", "Technical", "Financial", "Regulatory"]));
  const [showNewChecklistDialog, setShowNewChecklistDialog] = useState(false);
  const [showNewItemDialog, setShowNewItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newComment, setNewComment] = useState("");

  // Form states
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newChecklistType, setNewChecklistType] = useState("");
  const [newChecklistDate, setNewChecklistDate] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemOwner, setNewItemOwner] = useState("");
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");

  // Queries
  const { data: checklists = [], isLoading: checklistsLoading, refetch: refetchChecklists } = trpc.checklists.listByProject.useQuery(
    { projectId: selectedProjectId || 0 },
    { enabled: !!selectedProjectId }
  );
  
  const { data: checklistItems = [], refetch: refetchItems } = trpc.checklists.getItems.useQuery(
    { checklistId: selectedChecklistId || 0 },
    { enabled: !!selectedChecklistId }
  );

  const { data: users = [] } = trpc.users.list.useQuery();

  // Mutations
  const createChecklist = trpc.checklists.create.useMutation({
    onSuccess: () => {
      toast.success("Checklist created");
      setShowNewChecklistDialog(false);
      setNewChecklistName("");
      setNewChecklistType("");
      setNewChecklistDate("");
      refetchChecklists();
    },
    onError: (err) => toast.error(err.message),
  });

  const createItem = trpc.checklists.createItem.useMutation({
    onSuccess: () => {
      toast.success("Item added");
      setShowNewItemDialog(false);
      setNewItemName("");
      setNewItemCategory("");
      setNewItemOwner("");
      setNewItemDueDate("");
      setNewItemDescription("");
      refetchItems();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateItem = trpc.checklists.updateItem.useMutation({
    onSuccess: () => {
      toast.success("Item updated");
      setShowEditItemDialog(false);
      refetchItems();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteItemMutation = trpc.checklists.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Item deleted");
      setShowDeleteDialog(false);
      setSelectedItemId(null);
      refetchItems();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-select first checklist
  useMemo(() => {
    if (checklists.length > 0 && !selectedChecklistId) {
      setSelectedChecklistId(checklists[0].id);
    }
  }, [checklists, selectedChecklistId]);

  const currentChecklist = checklists.find((c: any) => c.id === selectedChecklistId);
  const selectedItem = checklistItems.find((i: any) => i.id === selectedItemId);

  const itemsByCategory = useMemo(() => {
    return checklistItems.reduce((acc: Record<string, any[]>, item: any) => {
      const cat = item.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [checklistItems]);

  const totalItems = checklistItems.length;
  const completedItems = checklistItems.filter((i: any) => i.status === "completed").length;
  const blockedItems = checklistItems.filter((i: any) => i.status === "blocked").length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const whatsNext = useMemo(() => {
    return checklistItems
      .filter((i: any) => ["not_started", "in_progress", "pending_review"].includes(i.status))
      .sort((a: any, b: any) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 5);
  }, [checklistItems]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const getOwnerName = (ownerId: number | null) => {
    if (!ownerId) return "Unassigned";
    const user = users.find((u: any) => u.id === ownerId);
    return user?.name || "Unknown";
  };

  const getDaysUntilDue = (dueDate: string | Date | null) => {
    if (!dueDate) return 999;
    const due = new Date(dueDate);
    const today = new Date();
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const utils = trpc.useUtils();
  
  const handleExportCsv = async () => {
    if (!selectedChecklistId) return;
    try {
      const result = await utils.checklists.exportCsv.fetch({ checklistId: selectedChecklistId });
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  const handleToggleComplete = () => {
    if (!selectedItem) return;
    const newStatus = selectedItem.status === "completed" ? "not_started" : "completed";
    updateItem.mutate({
      id: selectedItem.id,
      status: newStatus,
    });
  };

  const handleStatusChange = (status: string) => {
    if (!selectedItem) return;
    updateItem.mutate({
      id: selectedItem.id,
      status: status as any,
    });
  };

  if (!selectedProjectId) {
    return (
      <div className="page-container h-full flex items-center justify-center">
        <EmptyState
          title="Select a project"
          description="Choose a project from the sidebar to view its closing checklists"
          icon={<ClipboardList className="w-12 h-12 stroke-1" />}
        />
      </div>
    );
  }

  return (
    <div className="page-container h-full">
      <div className="flex gap-6 h-full">
        {/* Left Panel - Checklist Selection and What's Next */}
        <div className="w-80 shrink-0 flex flex-col gap-4">
          {/* Checklist Selection */}
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
            <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Transaction Checklists</h3>
              <Dialog open={showNewChecklistDialog} onOpenChange={setShowNewChecklistDialog}>
                <DialogTrigger asChild>
                  <button className="p-1 rounded hover:bg-[var(--color-bg-surface-hover)] text-[var(--color-text-tertiary)]">
                    <Plus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Checklist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input 
                        placeholder="e.g., Series A Financing" 
                        className="mt-1"
                        value={newChecklistName}
                        onChange={(e) => setNewChecklistName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Transaction Type</label>
                      <Select value={newChecklistType} onValueChange={setNewChecklistType}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acquisition">Acquisition</SelectItem>
                          <SelectItem value="financing">Financing</SelectItem>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Target Close Date</label>
                      <Input 
                        type="date" 
                        className="mt-1"
                        value={newChecklistDate}
                        onChange={(e) => setNewChecklistDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={() => {
                        if (!newChecklistName || !selectedProjectId) return;
                        createChecklist.mutate({
                          projectId: selectedProjectId,
                          name: newChecklistName,
                          transactionType: (newChecklistType || undefined) as "development" | "acquisition" | "financing" | "sale" | undefined,
                          targetCloseDate: newChecklistDate || undefined,
                        });
                      }}
                      disabled={!newChecklistName || createChecklist.isPending}
                    >
                      {createChecklist.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Checklist
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="p-2 space-y-1">
              {checklistsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
                </div>
              ) : checklists.length === 0 ? (
                <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                  No checklists for this project
                </p>
              ) : (
                checklists.map((checklist: any) => {
                  const project = projects.find((p: any) => p.id === checklist.projectId);
                  return (
                    <button
                      key={checklist.id}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-colors",
                        selectedChecklistId === checklist.id
                          ? "bg-[var(--color-brand-muted)]"
                          : "hover:bg-[var(--color-bg-surface-hover)]"
                      )}
                      onClick={() => {
                        setSelectedChecklistId(checklist.id);
                        setSelectedItemId(null);
                      }}
                    >
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{checklist.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                        {project?.name} • {checklist.transactionType || "General"}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] capitalize">
                          {checklist.status}
                        </span>
                        {checklist.targetCloseDate && (
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            Close: {new Date(checklist.targetCloseDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* What's Next */}
          {currentChecklist && (
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex-1">
              <div className="p-4 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-brand)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">What's Next</h3>
              </div>
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-1">
                  {whatsNext.map((item: any) => {
                    const daysUntil = getDaysUntilDue(item.dueDate);
                    const StatusIcon = statusConfig[item.status as ChecklistItemStatus]?.icon || Circle;
                    const statusColor = statusConfig[item.status as ChecklistItemStatus]?.color || "var(--color-text-tertiary)";
                    return (
                      <button
                        key={item.id}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition-colors",
                          selectedItemId === item.id
                            ? "bg-[var(--color-brand-muted)]"
                            : "hover:bg-[var(--color-bg-surface-hover)]"
                        )}
                        onClick={() => setSelectedItemId(item.id)}
                      >
                        <div className="flex items-start gap-2">
                          <StatusIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: statusColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                {getOwnerName(item.ownerId)}
                              </span>
                              {item.dueDate && (
                                <span className={cn(
                                  "text-[10px]",
                                  daysUntil < 0 ? "text-[var(--color-error)]" :
                                  daysUntil <= 7 ? "text-[var(--color-warning)]" : "text-[var(--color-text-tertiary)]"
                                )}>
                                  {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` :
                                   daysUntil === 0 ? "Due today" :
                                   `${daysUntil}d left`}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                  {whatsNext.length === 0 && (
                    <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">
                      All items completed or blocked
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Center Panel - Checklist Items */}
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] flex-1 flex flex-col">
          {currentChecklist ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{currentChecklist.name}</h2>
                    <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">
                      {currentChecklist.targetCloseDate 
                        ? `Target Close: ${new Date(currentChecklist.targetCloseDate).toLocaleDateString()}`
                        : "No target close date"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={handleExportCsv}>
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-[var(--color-text-primary)] tabular-nums">{progressPercent}%</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {completedItems} of {totalItems} complete
                      </p>
                    </div>
                    <div className="w-32">
                      <div className="h-2 bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all bg-[var(--color-success)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      {blockedItems > 0 && (
                        <p className="text-[10px] text-[var(--color-error)] mt-1">
                          {blockedItems} blocked
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {Object.entries(itemsByCategory).map(([category, items]) => (
                    <div key={category} className="rounded-lg border border-[var(--color-border-subtle)] overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 bg-[var(--color-bg-base)] hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                          )}
                          <span className="font-medium text-sm text-[var(--color-text-primary)]">{category}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]">
                            {(items as any[]).filter((i: any) => i.status === "completed").length}/{(items as any[]).length}
                          </span>
                        </div>
                      </button>
                      {expandedCategories.has(category) && (
                        <div className="divide-y divide-[var(--color-border-subtle)]">
                          {(items as any[]).map((item: any) => {
                            const StatusIcon = statusConfig[item.status as ChecklistItemStatus]?.icon || Circle;
                            const statusColor = statusConfig[item.status as ChecklistItemStatus]?.color || "var(--color-text-tertiary)";
                            const daysUntil = getDaysUntilDue(item.dueDate);
                            return (
                              <button
                                key={item.id}
                                className={cn(
                                  "w-full text-left p-3 transition-colors",
                                  selectedItemId === item.id
                                    ? "bg-[var(--color-brand-muted)]"
                                    : "hover:bg-[var(--color-bg-surface-hover)]"
                                )}
                                onClick={() => setSelectedItemId(item.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <StatusIcon className="w-5 h-5 shrink-0" style={{ color: statusColor }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.name}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {getOwnerName(item.ownerId)}
                                      </span>
                                      {item.dueDate && (
                                        <span className={cn(
                                          "text-xs flex items-center gap-1",
                                          daysUntil < 0 ? "text-[var(--color-error)]" :
                                          daysUntil <= 7 ? "text-[var(--color-warning)]" : "text-[var(--color-text-tertiary)]"
                                        )}>
                                          <Calendar className="w-3 h-3" />
                                          {new Date(item.dueDate).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <StatusBadge status={item.status as ChecklistItemStatus} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* Add Item Button */}
                  <Dialog open={showNewItemDialog} onOpenChange={setShowNewItemDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-2">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Checklist Item
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Checklist Item</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="text-sm font-medium">Item Name</label>
                          <Input 
                            placeholder="e.g., Execute Purchase Agreement" 
                            className="mt-1"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Description</label>
                          <Textarea 
                            placeholder="Optional description..." 
                            className="mt-1"
                            value={newItemDescription}
                            onChange={(e) => setNewItemDescription(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Legal">Legal</SelectItem>
                              <SelectItem value="Technical">Technical</SelectItem>
                              <SelectItem value="Financial">Financial</SelectItem>
                              <SelectItem value="Regulatory">Regulatory</SelectItem>
                              <SelectItem value="Operations">Operations</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Owner</label>
                          <Select value={newItemOwner} onValueChange={setNewItemOwner}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select owner" />
                            </SelectTrigger>
                            <SelectContent>
                              {users.map((user: any) => (
                                <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Due Date</label>
                          <Input 
                            type="date" 
                            className="mt-1"
                            value={newItemDueDate}
                            onChange={(e) => setNewItemDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          onClick={() => {
                            if (!newItemName || !selectedChecklistId) return;
                            createItem.mutate({
                              checklistId: selectedChecklistId,
                              name: newItemName,
                              description: newItemDescription || undefined,
                              category: newItemCategory || undefined,
                              ownerId: newItemOwner ? parseInt(newItemOwner) : undefined,
                              dueDate: newItemDueDate || undefined,
                            });
                          }}
                          disabled={!newItemName || createItem.isPending}
                        >
                          {createItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Add Item
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No checklist selected"
                description="Select a checklist from the left panel or create a new one"
                icon={<ClipboardList className="w-12 h-12 stroke-1" />}
              />
            </div>
          )}
        </div>

        {/* Right Panel - Item Details */}
        {selectedItem && (
          <Drawer
            open={true}
            onClose={() => setSelectedItemId(null)}
            title={selectedItem.name}
            subtitle={`${selectedItem.category || "Uncategorized"} • ${currentChecklist?.name}`}
            footer={
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setShowDeleteDialog(true);
                  }}
                  className="text-[var(--color-error)]"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowEditItemDialog(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleToggleComplete}
                  disabled={updateItem.isPending}
                >
                  {updateItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {selectedItem.status === "completed" ? "Reopen" : "Mark Complete"}
                </Button>
              </div>
            }
          >
            {/* Status */}
            <DrawerSection title="Status">
              <Select 
                value={selectedItem.status || "not_started"} 
                onValueChange={handleStatusChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="na">N/A</SelectItem>
                </SelectContent>
              </Select>
            </DrawerSection>

            {/* Details */}
            <DrawerSection title="Details">
              <DrawerFieldGrid>
                <DrawerField label="Owner" value={getOwnerName(selectedItem.ownerId)} />
                <DrawerField 
                  label="Due Date" 
                  value={selectedItem.dueDate ? new Date(selectedItem.dueDate).toLocaleDateString() : "Not set"} 
                />
                <DrawerField 
                  label="Days Until Due" 
                  value={
                    selectedItem.dueDate ? (
                      <span className={cn(
                        getDaysUntilDue(selectedItem.dueDate) < 0 ? "text-[var(--color-error)]" :
                        getDaysUntilDue(selectedItem.dueDate) <= 7 ? "text-[var(--color-warning)]" : ""
                      )}>
                        {getDaysUntilDue(selectedItem.dueDate) < 0 
                          ? `${Math.abs(getDaysUntilDue(selectedItem.dueDate))} days overdue`
                          : `${getDaysUntilDue(selectedItem.dueDate)} days`}
                      </span>
                    ) : "N/A"
                  } 
                />
                <DrawerField 
                  label="Completed" 
                  value={selectedItem.completedAt ? new Date(selectedItem.completedAt).toLocaleDateString() : "Not completed"} 
                />
              </DrawerFieldGrid>
            </DrawerSection>

            {/* Description */}
            {selectedItem.description && (
              <DrawerSection title="Description">
                <p className="text-sm text-[var(--color-text-primary)]">{selectedItem.description}</p>
              </DrawerSection>
            )}

            {/* Notes */}
            <DrawerSection title="Notes">
              <Textarea 
                placeholder="Add notes..." 
                className="mt-1"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                Notes are saved with the item description when you click Edit.
              </p>
            </DrawerSection>

            {/* Linked Documents */}
            <DrawerSection title="Linked Documents">
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full">
                  <Link2 className="w-4 h-4 mr-2" />
                  Link Document
                </Button>
              </div>
            </DrawerSection>
          </Drawer>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Checklist Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedItem) {
                    deleteItemMutation.mutate({ id: selectedItem.id });
                  }
                }}
                className="bg-[var(--color-error)] hover:bg-[var(--color-error)]/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Item Dialog */}
        <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Checklist Item</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <EditItemForm 
                item={selectedItem} 
                users={users}
                onSave={(data) => {
                  updateItem.mutate({
                    id: selectedItem.id,
                    ...data,
                  });
                }}
                isPending={updateItem.isPending}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function EditItemForm({ 
  item, 
  users, 
  onSave, 
  isPending 
}: { 
  item: any; 
  users: any[]; 
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(item.name || "");
  const [description, setDescription] = useState(item.description || "");
  const [category, setCategory] = useState(item.category || "");
  const [ownerId, setOwnerId] = useState(item.ownerId?.toString() || "");
  const [dueDate, setDueDate] = useState(
    item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : ""
  );

  return (
    <div className="space-y-4 py-4">
      <div>
        <label className="text-sm font-medium">Item Name</label>
        <Input 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Category</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Legal">Legal</SelectItem>
            <SelectItem value="Technical">Technical</SelectItem>
            <SelectItem value="Financial">Financial</SelectItem>
            <SelectItem value="Regulatory">Regulatory</SelectItem>
            <SelectItem value="Operations">Operations</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Owner</label>
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select owner" />
          </SelectTrigger>
          <SelectContent>
            {users.map((user: any) => (
              <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium">Due Date</label>
        <Input 
          type="date" 
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1"
        />
      </div>
      <DialogFooter>
        <Button 
          onClick={() => {
            onSave({
              name,
              description: description || undefined,
              category: category || undefined,
              ownerId: ownerId ? parseInt(ownerId) : undefined,
              dueDate: dueDate || undefined,
            });
          }}
          disabled={!name || isPending}
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function ClosingChecklist() {
  return (
    <AppLayout>
      <ClosingChecklistContent />
    </AppLayout>
  );
}
