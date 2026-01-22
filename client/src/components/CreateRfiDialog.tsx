import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateRfiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
  onSuccess?: () => void;
}

const CATEGORIES = [
  "Site & Real Estate",
  "Permits",
  "Technical",
  "Interconnection",
  "Environmental",
  "Financial",
  "Legal",
  "Other",
];

const ITEM_TYPES = [
  { value: "rfi", label: "RFI (Request for Information)" },
  { value: "task", label: "Task" },
  { value: "risk", label: "Risk" },
  { value: "issue", label: "Issue" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function CreateRfiDialog({ open, onOpenChange, projectId, onSuccess }: CreateRfiDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [itemType, setItemType] = useState<"rfi" | "task" | "risk" | "issue">("rfi");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [dueDate, setDueDate] = useState("");
  const [isInternalOnly, setIsInternalOnly] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(projectId);

  const { data: projects } = trpc.projects.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();
  const [assigneeId, setAssigneeId] = useState<number | undefined>();

  const createMutation = trpc.rfis.create.useMutation({
    onSuccess: (data) => {
      toast.success(`${itemType.toUpperCase()} created successfully`, {
        description: `Code: ${data.code}`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Failed to create item", {
        description: error.message,
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setItemType("rfi");
    setPriority("medium");
    setDueDate("");
    setIsInternalOnly(false);
    setAssigneeId(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    createMutation.mutate({
      projectId: selectedProjectId,
      title: title.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      itemType,
      priority,
      assigneeId,
      dueDate: dueDate || undefined,
      isInternalOnly,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace Item</DialogTitle>
          <DialogDescription>
            Create an RFI, Task, Risk, or Issue to track in your workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Project *</Label>
              <Select
                value={selectedProjectId?.toString() || ""}
                onValueChange={(v) => setSelectedProjectId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemType">Type *</Label>
              <Select value={itemType} onValueChange={(v: any) => setItemType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional details..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              <Select
                value={assigneeId?.toString() || ""}
                onValueChange={(v) => setAssigneeId(v ? parseInt(v) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="internal">Internal Only</Label>
              <p className="text-xs text-muted-foreground">
                Hide from investor viewers
              </p>
            </div>
            <Switch
              id="internal"
              checked={isInternalOnly}
              onCheckedChange={setIsInternalOnly}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create {itemType.toUpperCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
