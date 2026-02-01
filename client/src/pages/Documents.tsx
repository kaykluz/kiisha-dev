import { useState } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  X,
  FileText,
  Upload,
  Clock,
  User,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Circle,
  Scale,
  Wrench,
  DollarSign,
  Eye,
  EyeOff,
  History,
  FileSearch,
  ChevronRight,
  FolderPlus,
  Sparkles,
  Loader2,
} from "lucide-react";
import { PDFViewer } from "@/components/PDFViewer";
import { Drawer } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import { CommentsSection, CommentsCount } from "@/components/CommentsSection";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { CreateCategoryDialog } from "@/components/CreateCategoryDialog";
import { trpc } from "@/lib/trpc";

// Reviewer groups
type ReviewerGroup = "legal" | "technical" | "finance";
type ReviewStatus = "pending" | "approved" | "rejected" | "not_required";
type DocumentStatus = "verified" | "pending" | "missing" | "na";

interface ReviewerApproval {
  group: ReviewerGroup;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
}

const reviewerGroupConfig: Record<ReviewerGroup, { label: string; icon: typeof Scale; color: string }> = {
  legal: { label: "Legal", icon: Scale, color: "text-[var(--color-semantic-info)]" },
  technical: { label: "Technical", icon: Wrench, color: "text-[var(--color-brand-primary)]" },
  finance: { label: "Finance", icon: DollarSign, color: "text-[var(--color-semantic-success)]" },
};

const reviewStatusConfig: Record<ReviewStatus, { label: string; icon: typeof Circle; dotClass: string }> = {
  pending: { label: "Pending", icon: Circle, dotClass: "bg-[var(--color-semantic-warning)]" },
  approved: { label: "Approved", icon: CheckCircle2, dotClass: "bg-[var(--color-semantic-success)]" },
  rejected: { label: "Rejected", icon: AlertCircle, dotClass: "bg-[var(--color-semantic-error)]" },
  not_required: { label: "N/A", icon: Circle, dotClass: "bg-[var(--color-muted)]" },
};

// Calculate aggregate document status from reviewer approvals
function getAggregateStatus(approvals: ReviewerApproval[]): DocumentStatus {
  const activeApprovals = approvals.filter(a => a.status !== "not_required");
  if (activeApprovals.length === 0) return "na";
  
  if (activeApprovals.some(a => a.status === "rejected")) return "missing";
  if (activeApprovals.every(a => a.status === "approved")) return "verified";
  return "pending";
}

// Status badge component - clean design
function StatusBadge({ status }: { status: DocumentStatus }) {
  const config = {
    verified: { label: "Verified", className: "status-badge status-badge-success" },
    pending: { label: "Pending", className: "status-badge status-badge-warning" },
    missing: { label: "Missing", className: "status-badge status-badge-error" },
    na: { label: "N/A", className: "status-badge status-badge-muted" },
  };
  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}

// Reviewer status dots
function ReviewerStatusDots({ approvals }: { approvals: ReviewerApproval[] }) {
  return (
    <div className="flex items-center gap-1 mt-1">
      {approvals.map((approval) => {
        const config = reviewStatusConfig[approval.status];
        const groupConfig = reviewerGroupConfig[approval.group];
        return (
          <div
            key={approval.group}
            className={cn("w-1.5 h-1.5 rounded-full", config.dotClass)}
            title={`${groupConfig.label}: ${config.label}`}
          />
        );
      })}
    </div>
  );
}

// Document drawer panel
interface DocumentDrawerProps {
  projectId: number;
  docTypeId: number;
  project: any;
  docType: any;
  category: any;
  onClose: () => void;
  userRole?: "admin" | "editor" | "reviewer" | "investor_viewer";
  onUpload?: () => void;
}

function DocumentDrawer({ projectId, docTypeId, project, docType, category, onClose, userRole = "admin", onUpload }: DocumentDrawerProps) {
  const [activeTab, setActiveTab] = useState<"details" | "preview" | "extractions" | "history" | "comments">("details");
  
  // Default approvals (will be replaced with real data when available)
  const approvals: ReviewerApproval[] = [
    { group: "legal", status: "pending", reviewedBy: null, reviewedAt: null, notes: null },
    { group: "technical", status: "pending", reviewedBy: null, reviewedAt: null, notes: null },
    { group: "finance", status: "pending", reviewedBy: null, reviewedAt: null, notes: null },
  ];
  
  const aggregateStatus = getAggregateStatus(approvals);
  const isInvestorViewer = userRole === "investor_viewer";
  const documentPreviewUrl = null; // Document URL loaded from API when available

  const versions: any[] = [];
  const internalComments: any[] = [];

  const handleApprovalAction = (group: ReviewerGroup, action: "approve" | "reject") => {
    toast.success(`${reviewerGroupConfig[group].label} review ${action === "approve" ? "approved" : "rejected"}`);
  };

  const tabs = [
    { id: "details", label: "Details" },
    { id: "preview", label: "Preview" },
    { id: "extractions", label: "Extractions" },
    { id: "history", label: "History" },
    { id: "comments", label: "Comments", count: true },
  ];

  return (
    <Drawer
      open={true}
      onClose={onClose}
      title={docType?.name || "Document"}
      subtitle={`${category?.name || 'Uncategorized'} · ${project?.name || 'Unknown Project'}`}
      size="md"
      footer={
        <div className="flex gap-3 w-full">
          <Button variant="outline" className="flex-1">Download</Button>
          {!isInvestorViewer && (
            <Button className="btn-primary flex-1" onClick={onUpload}>
              <Upload className="w-4 h-4 mr-2" />
              Upload New Version
            </Button>
          )}
        </div>
      }
    >
      {/* Tab Navigation */}
      <div className="tab-nav mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn("tab-item", activeTab === tab.id && "tab-item-active")}
          >
            {tab.label}
            {tab.count && <CommentsCount resourceType="document" resourceId={docTypeId} />}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="space-y-6">
          {/* Status Overview */}
          <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Document Status</span>
              <StatusBadge status={aggregateStatus} />
            </div>
            
            {/* Reviewer Approvals */}
            <div className="space-y-3">
              {approvals.map((approval) => {
                const groupConfig = reviewerGroupConfig[approval.group];
                const statusConfig = reviewStatusConfig[approval.status];
                const Icon = groupConfig.icon;
                
                return (
                  <div key={approval.group} className="flex items-center justify-between py-2 border-b border-[var(--color-border-subtle)] last:border-0">
                    <div className="flex items-center gap-3">
                      <Icon className={cn("w-4 h-4", groupConfig.color)} />
                      <span className="text-sm">{groupConfig.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", statusConfig.dotClass)} />
                        <span className="text-sm text-[var(--color-text-secondary)]">{statusConfig.label}</span>
                      </div>
                      {!isInvestorViewer && approval.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleApprovalAction(approval.group, "approve")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-[var(--color-semantic-error)]" onClick={() => handleApprovalAction(approval.group, "reject")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Document Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Category</p>
                <p className="text-sm">{category?.name || 'Uncategorized'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Required</p>
                <p className="text-sm">{docType?.required ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Last Updated</p>
                <p className="text-sm">-</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Version</p>
                <p className="text-sm">-</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {activeTab === "preview" && (
        <div>
          <EmptyState
            type="documents"
            title="No document uploaded"
            description="Upload a document to preview it here"
            actionLabel={!isInvestorViewer ? "Upload Document" : undefined}
            onAction={!isInvestorViewer ? onUpload : undefined}
          />
        </div>
      )}

      {/* Extractions Tab */}
      {activeTab === "extractions" && (
        <div className="space-y-4">
          <EmptyState
            type="documents"
            title="No extractions yet"
            description="Upload a document to extract data using AI"
          />
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-3">
          <EmptyState
            type="documents"
            title="No version history"
            description="Upload a document to start tracking versions"
          />
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === "comments" && (
        <CommentsSection
          resourceType="document"
          resourceId={docTypeId}
        />
      )}
    </Drawer>
  );
}

function DocumentsContent() {
  const { selectedProjectId } = useProject();
  const [viewMode, setViewMode] = useState<"matrix" | "table">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCell, setSelectedCell] = useState<{ projectId: number; docTypeId: number } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Fetch real data from API
  const { data: projects = [], isLoading: projectsLoading } = trpc.projects.list.useQuery();
  const { data: documentCategories = [], isLoading: categoriesLoading } = trpc.documents.getCategories.useQuery();
  const { data: documentTypes = [], isLoading: typesLoading } = trpc.documents.getTypes.useQuery();

  const isLoading = projectsLoading || categoriesLoading || typesLoading;

  const filteredProjects = selectedProjectId
    ? projects.filter((p: any) => p.id === selectedProjectId)
    : projects;

  const filteredDocTypes =
    categoryFilter === "all"
      ? documentTypes
      : documentTypes.filter((d: any) => d.categoryId === parseInt(categoryFilter));

  const docTypesByCategory = documentCategories.map((cat: any) => ({
    ...cat,
    types: filteredDocTypes.filter((d: any) => d.categoryId === cat.id),
  }));

  // Get document status (simplified - will be enhanced with real document data)
  const getDocumentStatus = (projectId: number, docTypeId: number): DocumentStatus => {
    // For now, return "missing" as default since we don't have documents yet
    return "missing";
  };

  const getStatusWithApprovals = (projectId: number, docTypeId: number) => {
    return { status: getDocumentStatus(projectId, docTypeId), approvals: null };
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading documents...</p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no projects
  if (projects.length === 0) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Document Hub</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Document status aggregated from Legal, Technical, and Finance reviewer approvals
            </p>
          </div>
        </div>
        <EmptyState
          type="documents"
          title="No projects yet"
          description="Create a project first to start managing documents"
        />
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Document Hub</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Document status aggregated from Legal, Technical, and Finance reviewer approvals
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="btn-secondary">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <CreateCategoryDialog
            trigger={
              <Button variant="outline" className="btn-secondary">
                <Sparkles className="w-4 h-4 mr-2" />
                AI Category
              </Button>
            }
            onCategoryCreated={(category) => {
              toast.success(`Category "${category.name}" created`);
            }}
          />
          <Button className="btn-primary" onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>

      {/* Reviewer Legend */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <span className="text-[var(--color-text-tertiary)]">Reviewer Groups:</span>
        {Object.entries(reviewerGroupConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4", config.color)} />
              <span className="text-[var(--color-text-secondary)]">{config.label}</span>
            </div>
          );
        })}
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="carta-input pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48 carta-select">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {documentCategories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center border border-[var(--color-border-default)] rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("matrix")}
            className={cn(
              "px-3 py-2 transition-colors",
              viewMode === "matrix"
                ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
            )}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-3 py-2 transition-colors",
              viewMode === "table"
                ? "bg-[var(--color-bg-surface-hover)] text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-hover)]"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Matrix View */}
      {viewMode === "matrix" && (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
          {filteredProjects.length === 0 || documentTypes.length === 0 ? (
            <div className="p-8">
              <EmptyState
                type="documents"
                title={filteredProjects.length === 0 ? "No projects available" : "No document types defined"}
                description={filteredProjects.length === 0 ? "Create a project to start tracking documents" : "Define document types to track"}
              />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                {/* Header Row */}
                <div className="flex border-b border-[var(--color-border-subtle)]">
                  <div className="w-64 shrink-0 p-4 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]">
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                      Document Type
                    </span>
                  </div>
                  {filteredProjects.map((project: any) => (
                    <div
                      key={project.id}
                      className="w-32 shrink-0 p-4 border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-center"
                    >
                      <span className="text-xs font-medium truncate block" title={project.name}>
                        {project.code || project.name.split(" - ")[1] || project.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Document Type Rows grouped by Category */}
                {docTypesByCategory
                  .filter((cat: any) => cat.types.length > 0)
                  .map((category: any) => (
                    <div key={category.id}>
                      {/* Category Header */}
                      <div className="flex border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-hover)]">
                        <div className="w-64 shrink-0 p-3 border-r border-[var(--color-border-subtle)]">
                          <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                            {category.name}
                          </span>
                        </div>
                        {filteredProjects.map((project: any) => (
                          <div key={project.id} className="w-32 shrink-0 border-r border-[var(--color-border-subtle)]" />
                        ))}
                      </div>

                      {/* Document Type Rows */}
                      {category.types.map((docType: any) => (
                        <div key={docType.id} className="flex border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                          <div className="w-64 shrink-0 p-4 border-r border-[var(--color-border-subtle)] flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                            <span className="text-sm truncate">{docType.name}</span>
                            {docType.required && (
                              <span className="text-[10px] text-[var(--color-semantic-error)]">*</span>
                            )}
                          </div>
                          {filteredProjects.map((project: any) => {
                            const { status, approvals } = getStatusWithApprovals(project.id, docType.id);
                            return (
                              <div
                                key={project.id}
                                className="w-32 shrink-0 p-3 border-r border-[var(--color-border-subtle)] cursor-pointer hover:bg-[var(--color-bg-surface-active)] transition-colors flex flex-col items-center justify-center"
                                onClick={() => setSelectedCell({ projectId: project.id, docTypeId: docType.id })}
                              >
                                <StatusBadge status={status} />
                                {approvals && <ReviewerStatusDots approvals={approvals} />}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-hidden">
          {filteredProjects.length === 0 || filteredDocTypes.length === 0 ? (
            <div className="p-8">
              <EmptyState
                type="documents"
                title="No documents to display"
                description="Create projects and define document types to get started"
              />
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <table className="data-table w-full">
                <thead className="sticky top-0 bg-[var(--color-bg-surface)] z-10">
                  <tr>
                    <th className="text-left p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Document Type</th>
                    <th className="text-left p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Category</th>
                    <th className="text-left p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Project</th>
                    <th className="text-left p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Status</th>
                    <th className="text-left p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Reviewers</th>
                    <th className="text-right p-4 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider border-b border-[var(--color-border-subtle)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocTypes.flatMap((docType: any) =>
                    filteredProjects.map((project: any) => {
                      const { status, approvals } = getStatusWithApprovals(project.id, docType.id);
                      const category = documentCategories.find((c: any) => c.id === docType.categoryId);
                      return (
                        <tr
                          key={`${project.id}-${docType.id}`}
                          className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-surface-hover)] transition-colors cursor-pointer"
                          onClick={() => setSelectedCell({ projectId: project.id, docTypeId: docType.id })}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                              <span className="text-sm">{docType.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-[var(--color-text-secondary)]">{category?.name}</td>
                          <td className="p-4 text-sm">{project.name}</td>
                          <td className="p-4"><StatusBadge status={status} /></td>
                          <td className="p-4">
                            {approvals && <ReviewerStatusDots approvals={approvals} />}
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="sm" className="h-8">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Document Drawer */}
      {selectedCell && (
        <DocumentDrawer
          projectId={selectedCell.projectId}
          docTypeId={selectedCell.docTypeId}
          project={projects.find((p: any) => p.id === selectedCell.projectId)}
          docType={documentTypes.find((d: any) => d.id === selectedCell.docTypeId)}
          category={documentCategories.find((c: any) => c.id === documentTypes.find((d: any) => d.id === selectedCell.docTypeId)?.categoryId)}
          onClose={() => setSelectedCell(null)}
          onUpload={() => setShowUploadDialog(true)}
        />
      )}

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        projectId={selectedProjectId || undefined}
        onSuccess={() => {
          // Refresh documents list
          toast.success("Documents uploaded successfully");
        }}
      />
    </div>
  );
}

export default function Documents() {
  return (
    <AppLayout>
      <DocumentsContent />
    </AppLayout>
  );
}
