/**
 * Phase 36: Schedules Page
 * 
 * Displays obligations in Table, Calendar, and Timeline views.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
  List,
  Clock,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2
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

// Format date for display
function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Format relative time
function formatRelativeTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const target = new Date(date);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDate(date);
}

// Table View Component
function TableView({ obligations, onSelect }: { 
  obligations: Obligation[];
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {obligations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No obligations found
              </TableCell>
            </TableRow>
          ) : (
            obligations.map((obligation) => (
              <TableRow 
                key={obligation.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(obligation.id)}
              >
                <TableCell>
                  <StatusIcon status={obligation.status} />
                </TableCell>
                <TableCell className="font-medium">{obligation.title}</TableCell>
                <TableCell>{typeLabels[obligation.obligationType]}</TableCell>
                <TableCell>
                  <Badge className={statusColors[obligation.status]} variant="secondary">
                    {obligation.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={priorityColors[obligation.priority]} variant="secondary">
                    {obligation.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={obligation.status === "OVERDUE" ? "text-red-600 font-medium" : ""}>
                    {formatRelativeTime(obligation.dueAt)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Calendar View Component
function CalendarView({ obligations, currentDate, onDateChange }: {
  obligations: Obligation[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  // Create calendar grid
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  
  // Group obligations by day
  const obligationsByDay = useMemo(() => {
    const map = new Map<number, Obligation[]>();
    obligations.forEach(o => {
      if (o.dueAt) {
        const due = new Date(o.dueAt);
        if (due.getFullYear() === year && due.getMonth() === month) {
          const day = due.getDate();
          if (!map.has(day)) map.set(day, []);
          map.get(day)!.push(o);
        }
      }
    });
    return map;
  }, [obligations, year, month]);
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const prevMonth = () => {
    onDateChange(new Date(year, month - 1, 1));
  };
  
  const nextMonth = () => {
    onDateChange(new Date(year, month + 1, 1));
  };
  
  const today = new Date();
  const isToday = (day: number) => 
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {monthNames[month]} {year}
        </h3>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
        
        {days.map((day, index) => (
          <div
            key={index}
            className={`min-h-24 p-1 border rounded-md ${
              day === null ? "bg-muted/30" : "bg-background"
            } ${isToday(day!) ? "ring-2 ring-primary" : ""}`}
          >
            {day !== null && (
              <>
                <div className={`text-sm font-medium mb-1 ${isToday(day) ? "text-primary" : ""}`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {obligationsByDay.get(day)?.slice(0, 3).map(o => (
                    <div
                      key={o.id}
                      className={`text-xs p-1 rounded truncate ${
                        o.status === "OVERDUE" ? "bg-red-100 text-red-800" :
                        o.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                        "bg-blue-100 text-blue-800"
                      }`}
                      title={o.title}
                    >
                      {o.title}
                    </div>
                  ))}
                  {(obligationsByDay.get(day)?.length || 0) > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{(obligationsByDay.get(day)?.length || 0) - 3} more
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Timeline View Component
function TimelineView({ obligations }: { obligations: Obligation[] }) {
  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Obligation[]>();
    
    // Sort by due date
    const sorted = [...obligations].sort((a, b) => {
      const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return aDate - bDate;
    });
    
    sorted.forEach(o => {
      const key = o.dueAt ? formatDate(o.dueAt) : "No Due Date";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });
    
    return Array.from(map.entries());
  }, [obligations]);
  
  if (obligations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No obligations to display
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {grouped.map(([date, items]) => (
        <div key={date} className="relative">
          <div className="sticky top-0 bg-background z-10 py-2">
            <h3 className="font-semibold text-sm text-muted-foreground">{date}</h3>
          </div>
          <div className="ml-4 border-l-2 border-muted pl-4 space-y-4">
            {items.map(o => (
              <Card key={o.id} className="relative">
                <div className="absolute -left-[1.35rem] top-4 w-3 h-3 rounded-full bg-background border-2 border-primary" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{o.title}</CardTitle>
                    <div className="flex gap-2">
                      <Badge className={priorityColors[o.priority]} variant="secondary">
                        {o.priority}
                      </Badge>
                      <Badge className={statusColors[o.status]} variant="secondary">
                        {o.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {typeLabels[o.obligationType]}
                  </p>
                  {o.description && (
                    <p className="text-sm mt-2 line-clamp-2">{o.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Create Obligation Dialog
function CreateObligationDialog({ onCreated }: { onCreated: () => void }) {
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
      dueAt: dueAt ? new Date(dueAt) : undefined
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Obligation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Obligation</DialogTitle>
          <DialogDescription>
            Add a new obligation to track deadlines and tasks.
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

// Main Schedules Page
export default function SchedulesPage() {
  const [view, setView] = useState<"table" | "calendar" | "timeline">("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  // Fetch obligations
  const { data: obligations, isLoading, refetch } = trpc.obligations.list.useQuery({
    status: statusFilter !== "all" ? [statusFilter as ObligationStatus] : undefined,
    obligationType: typeFilter !== "all" ? [typeFilter as ObligationType] : undefined,
    priority: priorityFilter !== "all" ? [priorityFilter as ObligationPriority] : undefined,
    limit: 100
  });
  
  // Fetch due soon and overdue counts
  const { data: dueSoon } = trpc.obligations.getDueSoon.useQuery({ daysAhead: 7 });
  const { data: overdue } = trpc.obligations.getOverdue.useQuery();
  
  const filteredObligations = obligations || [];
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedules</h1>
            <p className="text-muted-foreground">
              Track obligations, deadlines, and milestones
            </p>
          </div>
          <CreateObligationDialog onCreated={() => refetch()} />
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Due This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dueSoon?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdue?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredObligations.filter(o => 
                  !["COMPLETED", "CANCELLED"].includes(o.status)
                ).length}
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* View Tabs and Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="table">
                <List className="h-4 w-4 mr-2" />
                Table
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <Calendar className="h-4 w-4 mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="timeline">
                <Clock className="h-4 w-4 mr-2" />
                Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {view === "table" && (
              <TableView 
                obligations={filteredObligations} 
                onSelect={setSelectedId}
              />
            )}
            {view === "calendar" && (
              <CalendarView 
                obligations={filteredObligations}
                currentDate={calendarDate}
                onDateChange={setCalendarDate}
              />
            )}
            {view === "timeline" && (
              <TimelineView obligations={filteredObligations} />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
