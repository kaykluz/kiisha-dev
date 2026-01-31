import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Link2,
  Plus,
  Check,
  X,
  Sparkles,
  Filter,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
  User,
  FileText,
  Wrench,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Settings,
} from "lucide-react";

// Types
interface EntityMention {
  id: string;
  mentionText: string;
  documentName: string;
  documentId: string;
  pageNumber: number;
  context: string;
  entityType: "site" | "company" | "person" | "equipment" | "contract" | "permit";
  status: "unlinked" | "linked" | "ignored" | "pending_review";
  linkedEntityId: string | null;
  linkedEntityName: string | null;
  aiSuggestion: {
    entityId: string;
    entityName: string;
    confidence: number;
    reason: string;
  } | null;
  createdAt: string;
}

interface CanonicalEntity {
  id: string;
  name: string;
  type: "site" | "company" | "person" | "equipment" | "contract" | "permit";
  aliases: string[];
  mentionCount: number;
}

interface ResolutionRule {
  id: string;
  name: string;
  matchType: "exact_alias" | "fuzzy_name" | "regex";
  pattern: string;
  targetEntityId: string;
  targetEntityName: string;
  autoResolve: boolean;
  enabled: boolean;
}

// Mock data
const mockMentions: EntityMention[] = [
  {
    id: "m1",
    mentionText: "Cloudbreak Energy",
    documentName: "Interconnection_Agreement.pdf",
    documentId: "doc-001",
    pageNumber: 1,
    context: "...entered into by Cloudbreak Energy LLC and National Grid...",
    entityType: "company",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "e1",
      entityName: "Cloudbreak Energy LLC",
      confidence: 0.95,
      reason: "Exact name match with registered alias",
    },
    createdAt: "2026-01-14T10:30:00Z",
  },
  {
    id: "m2",
    mentionText: "CBE",
    documentName: "Site_Survey_Report.pdf",
    documentId: "doc-003",
    pageNumber: 2,
    context: "...CBE has completed the preliminary site assessment...",
    entityType: "company",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "e1",
      entityName: "Cloudbreak Energy LLC",
      confidence: 0.82,
      reason: "Common abbreviation pattern detected",
    },
    createdAt: "2026-01-14T11:15:00Z",
  },
  {
    id: "m3",
    mentionText: "Gillette Solar Farm",
    documentName: "PPA_Agreement.pdf",
    documentId: "doc-002",
    pageNumber: 1,
    context: "...for the Gillette Solar Farm located in Massachusetts...",
    entityType: "site",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "s1",
      entityName: "MA - Gillette BTM Solar",
      confidence: 0.88,
      reason: "Location and project type match",
    },
    createdAt: "2026-01-14T10:30:00Z",
  },
  {
    id: "m4",
    mentionText: "National Grid",
    documentName: "Interconnection_Agreement.pdf",
    documentId: "doc-001",
    pageNumber: 1,
    context: "...by and between National Grid (\"Utility\") and...",
    entityType: "company",
    status: "linked",
    linkedEntityId: "e2",
    linkedEntityName: "National Grid USA",
    aiSuggestion: null,
    createdAt: "2026-01-14T10:30:00Z",
  },
  {
    id: "m5",
    mentionText: "SunPower 400W Module",
    documentName: "Equipment_Spec.pdf",
    documentId: "doc-004",
    pageNumber: 3,
    context: "...utilizing SunPower 400W Module panels with...",
    entityType: "equipment",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "eq1",
      entityName: "SunPower SPR-MAX3-400",
      confidence: 0.78,
      reason: "Product specification match",
    },
    createdAt: "2026-01-14T12:00:00Z",
  },
  {
    id: "m6",
    mentionText: "Sarah Chen",
    documentName: "Site_Survey_Report.pdf",
    documentId: "doc-003",
    pageNumber: 1,
    context: "...Site survey conducted by Sarah Chen on...",
    entityType: "person",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "p1",
      entityName: "Sarah Chen (Field Engineer)",
      confidence: 0.92,
      reason: "Name and role match from org directory",
    },
    createdAt: "2026-01-14T11:15:00Z",
  },
  {
    id: "m7",
    mentionText: "MA DEP Permit #2024-1234",
    documentName: "Environmental_Assessment.pdf",
    documentId: "doc-005",
    pageNumber: 5,
    context: "...approved under MA DEP Permit #2024-1234 dated...",
    entityType: "permit",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: null,
    createdAt: "2026-01-14T13:00:00Z",
  },
  {
    id: "m8",
    mentionText: "PPA-2025-001",
    documentName: "Financial_Model.xlsx",
    documentId: "doc-006",
    pageNumber: 1,
    context: "...revenue projections based on PPA-2025-001 terms...",
    entityType: "contract",
    status: "unlinked",
    linkedEntityId: null,
    linkedEntityName: null,
    aiSuggestion: {
      entityId: "c1",
      entityName: "Gillette PPA Agreement",
      confidence: 0.85,
      reason: "Contract ID pattern match",
    },
    createdAt: "2026-01-14T14:00:00Z",
  },
];

const mockEntities: CanonicalEntity[] = [
  { id: "e1", name: "Cloudbreak Energy LLC", type: "company", aliases: ["Cloudbreak", "CBE", "Cloudbreak Energy"], mentionCount: 45 },
  { id: "e2", name: "National Grid USA", type: "company", aliases: ["National Grid", "NGrid", "NG"], mentionCount: 32 },
  { id: "s1", name: "MA - Gillette BTM Solar", type: "site", aliases: ["Gillette Solar", "Gillette Solar Farm", "Gillette Project"], mentionCount: 28 },
  { id: "s2", name: "TX - Austin Community Solar", type: "site", aliases: ["Austin Solar", "Austin CS"], mentionCount: 15 },
  { id: "eq1", name: "SunPower SPR-MAX3-400", type: "equipment", aliases: ["SunPower 400W", "SPR-MAX3"], mentionCount: 12 },
  { id: "p1", name: "Sarah Chen (Field Engineer)", type: "person", aliases: ["S. Chen", "Sarah C."], mentionCount: 8 },
  { id: "c1", name: "Gillette PPA Agreement", type: "contract", aliases: ["PPA-2025-001", "Gillette PPA"], mentionCount: 6 },
];

const mockRules: ResolutionRule[] = [
  { id: "r1", name: "Cloudbreak Abbreviations", matchType: "exact_alias", pattern: "CBE", targetEntityId: "e1", targetEntityName: "Cloudbreak Energy LLC", autoResolve: true, enabled: true },
  { id: "r2", name: "National Grid Variants", matchType: "fuzzy_name", pattern: "National Grid*", targetEntityId: "e2", targetEntityName: "National Grid USA", autoResolve: false, enabled: true },
];

const entityTypeConfig: Record<string, { icon: typeof Building2; color: string; label: string }> = {
  site: { icon: MapPin, color: "text-blue-400", label: "Site" },
  company: { icon: Building2, color: "text-purple-400", label: "Company" },
  person: { icon: User, color: "text-green-400", label: "Person" },
  equipment: { icon: Wrench, color: "text-orange-400", label: "Equipment" },
  contract: { icon: ScrollText, color: "text-cyan-400", label: "Contract" },
  permit: { icon: FileText, color: "text-yellow-400", label: "Permit" },
};

// Bulk Entity Resolution Component
export function BulkEntityResolution() {
  const [mentions, setMentions] = useState<EntityMention[]>(mockMentions);
  const [selectedMentions, setSelectedMentions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("unlinked");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [showCreateEntityDialog, setShowCreateEntityDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["company", "site"]));

  // Filter mentions
  const filteredMentions = useMemo(() => {
    return mentions.filter((m) => {
      if (typeFilter !== "all" && m.entityType !== typeFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (searchQuery && !m.mentionText.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [mentions, typeFilter, statusFilter, searchQuery]);

  // Group mentions by entity type
  const groupedMentions = useMemo(() => {
    const groups: Record<string, EntityMention[]> = {};
    filteredMentions.forEach((m) => {
      if (!groups[m.entityType]) groups[m.entityType] = [];
      groups[m.entityType].push(m);
    });
    return groups;
  }, [filteredMentions]);

  // Stats
  const stats = useMemo(() => {
    const total = mentions.length;
    const unlinked = mentions.filter((m) => m.status === "unlinked").length;
    const linked = mentions.filter((m) => m.status === "linked").length;
    const withSuggestions = mentions.filter((m) => m.status === "unlinked" && m.aiSuggestion).length;
    const highConfidence = mentions.filter((m) => m.aiSuggestion && m.aiSuggestion.confidence >= 0.85).length;
    return { total, unlinked, linked, withSuggestions, highConfidence };
  }, [mentions]);

  // Toggle selection
  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedMentions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMentions(newSelection);
  };

  // Select all in view
  const selectAllInView = () => {
    const allIds = filteredMentions.filter((m) => m.status === "unlinked").map((m) => m.id);
    setSelectedMentions(new Set(allIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedMentions(new Set());
  };

  // Accept AI suggestion for a mention
  const acceptSuggestion = (mentionId: string) => {
    setMentions((prev) =>
      prev.map((m) => {
        if (m.id === mentionId && m.aiSuggestion) {
          return {
            ...m,
            status: "linked" as const,
            linkedEntityId: m.aiSuggestion.entityId,
            linkedEntityName: m.aiSuggestion.entityName,
          };
        }
        return m;
      })
    );
    toast.success("Entity linked successfully");
  };

  // Ignore mention
  const ignoreMention = (mentionId: string) => {
    setMentions((prev) =>
      prev.map((m) => (m.id === mentionId ? { ...m, status: "ignored" as const } : m))
    );
    toast.success("Mention ignored");
  };

  // Bulk accept all selected with high-confidence suggestions
  const bulkAcceptHighConfidence = async () => {
    const toProcess = Array.from(selectedMentions).filter((id) => {
      const mention = mentions.find((m) => m.id === id);
      return mention?.aiSuggestion && mention.aiSuggestion.confidence >= 0.85;
    });

    if (toProcess.length === 0) {
      toast.error("No high-confidence suggestions in selection");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);

    for (let i = 0; i < toProcess.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      acceptSuggestion(toProcess[i]);
      setProcessingProgress(((i + 1) / toProcess.length) * 100);
    }

    setIsProcessing(false);
    setSelectedMentions(new Set());
    toast.success(`Linked ${toProcess.length} entities`);
  };

  // Bulk ignore selected
  const bulkIgnore = () => {
    setMentions((prev) =>
      prev.map((m) => (selectedMentions.has(m.id) ? { ...m, status: "ignored" as const } : m))
    );
    setSelectedMentions(new Set());
    toast.success(`Ignored ${selectedMentions.size} mentions`);
  };

  // Toggle group expansion
  const toggleGroup = (type: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Mentions</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Unlinked</p>
                <p className="text-2xl font-bold text-warning">{stats.unlinked}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Linked</p>
                <p className="text-2xl font-bold text-success">{stats.linked}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-success/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">AI Suggestions</p>
                <p className="text-2xl font-bold text-primary">{stats.withSuggestions}</p>
              </div>
              <Sparkles className="w-8 h-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">High Confidence</p>
                <p className="text-2xl font-bold text-accent">{stats.highConfidence}</p>
              </div>
              <Zap className="w-8 h-8 text-accent/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search mentions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(entityTypeConfig).map(([type, config]) => (
                <SelectItem key={type} value={type}>
                  <div className="flex items-center gap-2">
                    <config.icon className={cn("w-4 h-4", config.color)} />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="unlinked">Unlinked</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRulesDialog(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Rules
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateEntityDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Entity
          </Button>
        </div>
      </div>

      {/* Selection Actions */}
      {selectedMentions.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/30 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedMentions.size} mention{selectedMentions.size > 1 ? "s" : ""} selected
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <div className="flex items-center gap-3 min-w-[200px]">
                <Progress value={processingProgress} className="flex-1" />
                <span className="text-xs text-muted-foreground">{Math.round(processingProgress)}%</span>
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30"
                  onClick={bulkIgnore}
                >
                  <X className="w-4 h-4 mr-2" />
                  Ignore Selected
                </Button>
                <Button size="sm" onClick={bulkAcceptHighConfidence}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Accept High-Confidence ({stats.highConfidence})
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mention Groups */}
      <div className="space-y-2">
        {Object.entries(groupedMentions).map(([type, typeMentions]) => {
          const config = entityTypeConfig[type];
          const Icon = config.icon;
          const isExpanded = expandedGroups.has(type);
          const unlinkedCount = typeMentions.filter((m) => m.status === "unlinked").length;

          return (
            <Card key={type} className="bg-card border-border overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                onClick={() => toggleGroup(type)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <Icon className={cn("w-5 h-5", config.color)} />
                  <span className="font-medium">{config.label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {typeMentions.length}
                  </Badge>
                  {unlinkedCount > 0 && (
                    <Badge variant="outline" className="text-warning border-warning/30">
                      {unlinkedCount} unlinked
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const ids = typeMentions.filter((m) => m.status === "unlinked").map((m) => m.id);
                    setSelectedMentions(new Set([...Array.from(selectedMentions), ...ids]));
                  }}
                >
                  Select All
                </Button>
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  <ScrollArea className="max-h-[400px]">
                    <div className="divide-y divide-border">
                      {typeMentions.map((mention) => (
                        <MentionRow
                          key={mention.id}
                          mention={mention}
                          isSelected={selectedMentions.has(mention.id)}
                          onToggleSelect={() => toggleSelection(mention.id)}
                          onAccept={() => acceptSuggestion(mention.id)}
                          onIgnore={() => ignoreMention(mention.id)}
                          entities={mockEntities.filter((e) => e.type === mention.entityType)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Rules Dialog */}
      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Auto-Resolution Rules</DialogTitle>
            <DialogDescription>
              Configure rules to automatically resolve entity mentions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-auto">
            {mockRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={rule.enabled} />
                  <div>
                    <p className="font-medium text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.matchType === "exact_alias" && `Exact match: "${rule.pattern}"`}
                      {rule.matchType === "fuzzy_name" && `Fuzzy match: ${rule.pattern}`}
                      {rule.matchType === "regex" && `Regex: ${rule.pattern}`}
                      {" → "}
                      {rule.targetEntityName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rule.autoResolve && (
                    <Badge variant="outline" className="text-success border-success/30">
                      Auto
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRulesDialog(false)}>
              Close
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Entity Dialog */}
      <Dialog open={showCreateEntityDialog} onOpenChange={setShowCreateEntityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Entity</DialogTitle>
            <DialogDescription>
              Create a new canonical entity to link mentions to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Entity Name</label>
              <Input placeholder="Enter entity name..." className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <Select>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(entityTypeConfig).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <config.icon className={cn("w-4 h-4", config.color)} />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Aliases (comma-separated)</label>
              <Input placeholder="Alias 1, Alias 2, ..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEntityDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success("Entity created successfully");
              setShowCreateEntityDialog(false);
            }}>
              Create Entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mention Row Component
function MentionRow({
  mention,
  isSelected,
  onToggleSelect,
  onAccept,
  onIgnore,
  entities,
}: {
  mention: EntityMention;
  isSelected: boolean;
  onToggleSelect: () => void;
  onAccept: () => void;
  onIgnore: () => void;
  entities: CanonicalEntity[];
}) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const config = entityTypeConfig[mention.entityType];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors",
        isSelected && "bg-accent/5"
      )}
    >
      {mention.status === "unlinked" && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="mt-1"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{mention.mentionText}</span>
          {mention.status === "linked" && (
            <Badge variant="outline" className="text-success border-success/30">
              <Link2 className="w-3 h-3 mr-1" />
              {mention.linkedEntityName}
            </Badge>
          )}
          {mention.status === "ignored" && (
            <Badge variant="outline" className="text-muted-foreground">
              Ignored
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {mention.documentName} • Page {mention.pageNumber}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 italic truncate">
          "{mention.context}"
        </p>

        {/* AI Suggestion */}
        {mention.status === "unlinked" && mention.aiSuggestion && (
          <div className="mt-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm">
                  Suggested: <strong>{mention.aiSuggestion.entityName}</strong>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    mention.aiSuggestion.confidence >= 0.85
                      ? "text-success border-success/30"
                      : mention.aiSuggestion.confidence >= 0.7
                      ? "text-warning border-warning/30"
                      : "text-muted-foreground"
                  )}
                >
                  {Math.round(mention.aiSuggestion.confidence * 100)}%
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-success" onClick={onAccept}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={onIgnore}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{mention.aiSuggestion.reason}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {mention.status === "unlinked" && !mention.aiSuggestion && (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="w-4 h-4 mr-1" />
            Link
          </Button>
          <Button size="sm" variant="ghost" onClick={onIgnore}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Manual Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link to Entity</DialogTitle>
            <DialogDescription>
              Select an existing entity or create a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {entities.map((entity) => (
              <button
                key={entity.id}
                className="w-full p-3 text-left bg-muted/30 hover:bg-muted/50 rounded-lg border border-border transition-colors"
                onClick={() => {
                  toast.success(`Linked to ${entity.name}`);
                  setShowLinkDialog(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{entity.name}</span>
                  <Badge variant="secondary">{entity.mentionCount} mentions</Badge>
                </div>
                {entity.aliases.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aliases: {entity.aliases.join(", ")}
                  </p>
                )}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default BulkEntityResolution;
