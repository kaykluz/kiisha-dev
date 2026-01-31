import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  CheckCircle2,
  Circle,
  AlertCircle,
  MinusCircle,
  Download,
  ChevronDown,
  ChevronRight,
  FileText,
  Grid3X3,
  X,
} from "lucide-react";
import { SkeletonTable } from "@/components/Skeleton";

type DocStatus = "verified" | "pending" | "missing" | "na" | "rejected" | "unverified";

const statusConfig: Record<DocStatus, { icon: typeof Circle; color: string; bg: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10", label: "Verified" },
  pending: { icon: Circle, color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10", label: "Pending" },
  missing: { icon: AlertCircle, color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10", label: "Missing" },
  na: { icon: MinusCircle, color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]", label: "N/A" },
  rejected: { icon: AlertCircle, color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10", label: "Rejected" },
  unverified: { icon: Circle, color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]", label: "Unverified" },
};

function StatusCell({ status }: { status: DocStatus | null }) {
  if (!status) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-[var(--color-bg-tertiary)]" />
      </div>
    );
  }
  const config = statusConfig[status] || statusConfig.unverified;
  const Icon = config.icon;
  return (
    <div className={`flex items-center justify-center p-1 rounded ${config.bg}`} title={config.label}>
      <Icon className={`w-4 h-4 ${config.color}`} />
    </div>
  );
}

function DocumentMatrixContent() {
  const { state: authState } = useAuth();
  const orgId = authState?.activeOrganization?.id ?? 1;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: portfolioList } = trpc.portfolioViews.list.useQuery();
  const { data: allProjects, isLoading } = trpc.projects.list.useQuery();
  const { data: matrixData } = trpc.documents.getMatrix.useQuery(
    { portfolioId: selectedPortfolioId !== "all" ? parseInt(selectedPortfolioId) : undefined, organizationId: orgId },
    { enabled: true }
  );

  const toggleCategory = (catId: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const expandAll = () => {
    if (matrixData?.categories) {
      setExpandedCategories(new Set(matrixData.categories.map((c: any) => c.id)));
    }
  };

  const collapseAll = () => setExpandedCategories(new Set());

  // Build matrix: rows = document types grouped by category, columns = projects
  const matrixProjects = matrixData?.projects ?? [];
  const categories = matrixData?.categories ?? [];
  const types = matrixData?.types ?? [];
  const docs = matrixData?.documents ?? [];

  // Filter types by search
  const filteredTypes = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter((t: any) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [types, searchQuery]);

  // Group types by category
  const categoryGroups = useMemo(() => {
    return categories.map((cat: any) => ({
      ...cat,
      types: filteredTypes.filter((t: any) => t.categoryId === cat.id),
    })).filter((g: any) => g.types.length > 0);
  }, [categories, filteredTypes]);

  // Get doc status for a (docType, project) pair
  const getStatus = (typeId: number, projectId: number): DocStatus | null => {
    const doc = docs.find((d: any) => d.documentTypeId === typeId && d.projectId === projectId);
    if (!doc) return null;
    return doc.status as DocStatus;
  };

  // Count stats
  const totalCells = matrixProjects.length * types.length;
  const verifiedCount = docs.filter((d: any) => d.status === "verified").length;
  const pendingCount = docs.filter((d: any) => d.status === "pending" || d.status === "unverified").length;
  const missingCount = Math.max(0, totalCells - docs.length);

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Grid3X3 className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Document Matrix</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Cross-project document status overview</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search document types..."
                className="pl-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                </button>
              )}
            </div>
            <Select value={selectedPortfolioId} onValueChange={setSelectedPortfolioId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Portfolios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Portfolios</SelectItem>
                {portfolioList?.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Summary badges */}
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="outline" className="text-[var(--color-semantic-success)]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {verifiedCount} Verified
              </Badge>
              <Badge variant="outline" className="text-[var(--color-semantic-warning)]">
                <Circle className="w-3 h-3 mr-1" /> {pendingCount} Pending
              </Badge>
              <Badge variant="outline" className="text-[var(--color-semantic-error)]">
                <AlertCircle className="w-3 h-3 mr-1" /> {missingCount} Missing
              </Badge>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="p-6">
          {isLoading ? (
            <SkeletonTable rows={10} cols={5} />
          ) : matrixProjects.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <Grid3X3 className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p className="text-lg font-medium">No projects found</p>
              <p className="text-sm mt-1">Create projects to see the document matrix</p>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-max">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-r border-[var(--color-border-primary)] min-w-[280px]">
                        Document Type
                      </th>
                      {matrixProjects.map((project: any) => (
                        <th
                          key={project.id}
                          className="bg-[var(--color-bg-secondary)] text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-primary)] min-w-[100px] max-w-[140px]"
                        >
                          <div className="truncate" title={project.name}>{project.name}</div>
                          <div className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{project.code || project.technology}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryGroups.map((cat: any) => (
                      <>
                        {/* Category header row */}
                        <tr key={`cat-${cat.id}`}>
                          <td
                            colSpan={matrixProjects.length + 1}
                            className="sticky left-0 z-10 bg-[var(--color-bg-tertiary)] px-4 py-2 cursor-pointer border-b border-[var(--color-border-primary)]"
                            onClick={() => toggleCategory(cat.id)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedCategories.has(cat.id) ? (
                                <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                              )}
                              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{cat.name}</span>
                              <Badge variant="secondary" className="text-[10px]">{cat.types.length}</Badge>
                            </div>
                          </td>
                        </tr>
                        {/* Type rows */}
                        {expandedCategories.has(cat.id) && cat.types.map((type: any) => (
                          <tr key={`type-${type.id}`} className="hover:bg-[var(--color-bg-secondary)]/50">
                            <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] px-4 py-2 border-b border-r border-[var(--color-border-primary)]">
                              <div className="flex items-center gap-2 pl-6">
                                <FileText className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
                                <span className="text-sm text-[var(--color-text-primary)]">{type.name}</span>
                                {type.required && <span className="text-[10px] text-[var(--color-semantic-error)]">*</span>}
                              </div>
                            </td>
                            {matrixProjects.map((project: any) => (
                              <td
                                key={`${type.id}-${project.id}`}
                                className="text-center px-3 py-2 border-b border-[var(--color-border-primary)]"
                              >
                                <StatusCell status={getStatus(type.id, project.id)} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default function DocumentMatrix() {
  return <DocumentMatrixContent />;
}
