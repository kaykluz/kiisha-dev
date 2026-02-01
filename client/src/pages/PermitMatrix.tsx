import AppLayout from "@/components/AppLayout";
import { useState } from "react";
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
  FileCheck,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  X,
  Download,
  FileText,
} from "lucide-react";

interface Permit {
  id: string;
  type: string;
  jurisdiction: "federal" | "state" | "county" | "local";
  name: string;
  projectId: number;
  projectName: string;
  applicationDate: string;
  approvalDate: string;
  expirationDate: string;
  status: "not_applied" | "applied" | "under_review" | "approved" | "denied" | "expired";
  linkedDocuments: string[];
  notes: string;
}

const statusConfig = {
  not_applied: { label: "Not Applied", icon: Circle, color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]" },
  applied: { label: "Applied", icon: Clock, color: "text-[var(--color-semantic-info)]", bg: "bg-[var(--color-semantic-info)]/10" },
  under_review: { label: "Under Review", icon: Clock, color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10" },
  denied: { label: "Denied", icon: AlertCircle, color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
  expired: { label: "Expired", icon: AlertCircle, color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
};

const jurisdictionConfig = {
  federal: { label: "Federal AHJ", color: "text-purple-400" },
  state: { label: "State AHJ", color: "text-blue-400" },
  county: { label: "County AHJ", color: "text-teal-400" },
  local: { label: "Local AHJ", color: "text-green-400" },
};

const PERMIT_TYPES = [
  "Environmental Impact Assessment",
  "Building Permit",
  "Electrical Permit",
  "Land Use Permit",
  "Grid Connection Permit",
  "Generation License",
  "Water Use Permit",
  "Aviation Clearance",
  "Heritage Site Clearance",
  "Fire Safety Certificate",
];

const mockPermits: Permit[] = [
  { id: "PRM-001", type: "Environmental Impact Assessment", jurisdiction: "federal", name: "Federal EIA Approval", projectId: 1, projectName: "Lekki Solar Farm", applicationDate: "2025-08-01", approvalDate: "2025-12-15", expirationDate: "2028-12-15", status: "approved", linkedDocuments: ["EIA Report", "Ecological Survey"], notes: "" },
  { id: "PRM-002", type: "Grid Connection Permit", jurisdiction: "federal", name: "NERC Grid Connection", projectId: 1, projectName: "Lekki Solar Farm", applicationDate: "2025-09-15", approvalDate: "", expirationDate: "", status: "under_review", linkedDocuments: ["Interconnection Study"], notes: "Awaiting technical review" },
  { id: "PRM-003", type: "Building Permit", jurisdiction: "local", name: "Lekki LGA Building Permit", projectId: 1, projectName: "Lekki Solar Farm", applicationDate: "2025-10-01", approvalDate: "2025-11-20", expirationDate: "2027-11-20", status: "approved", linkedDocuments: ["Architectural Plans"], notes: "" },
  { id: "PRM-004", type: "Land Use Permit", jurisdiction: "state", name: "Lagos State Land Use Consent", projectId: 1, projectName: "Lekki Solar Farm", applicationDate: "2025-07-15", approvalDate: "2025-10-01", expirationDate: "", status: "approved", linkedDocuments: ["Survey Plan", "C of O"], notes: "" },
  { id: "PRM-005", type: "Generation License", jurisdiction: "federal", name: "NERC Generation License", projectId: 2, projectName: "Abuja BESS", applicationDate: "", approvalDate: "", expirationDate: "", status: "not_applied", linkedDocuments: [], notes: "Pending project milestone" },
  { id: "PRM-006", type: "Environmental Impact Assessment", jurisdiction: "federal", name: "Federal EIA Approval", projectId: 2, projectName: "Abuja BESS", applicationDate: "2025-11-01", approvalDate: "", expirationDate: "", status: "applied", linkedDocuments: ["EIA Report Draft"], notes: "" },
];

function PermitMatrixContent() {
  const [permits] = useState<Permit[]>(mockPermits);
  const [searchQuery, setSearchQuery] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: allProjects } = trpc.projects.list.useQuery();
  const projects = allProjects ?? [];

  const filtered = permits.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.type.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (jurisdictionFilter !== "all" && p.jurisdiction !== jurisdictionFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  // Group by project for matrix view
  const projectIds = [...new Set(permits.map(p => p.projectId))];
  const permitTypes = [...new Set(permits.map(p => p.type))];

  const getPermitStatus = (projectId: number, permitType: string) => {
    return permits.find(p => p.projectId === projectId && p.type === permitType);
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Permit Matrix</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Track permits and approvals across projects and jurisdictions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> Export</Button>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Permit</Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search permits..." className="pl-9" />
            </div>
            <Select value={jurisdictionFilter} onValueChange={setJurisdictionFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Jurisdiction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jurisdictions</SelectItem>
                {Object.entries(jurisdictionConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-6">
          {/* Matrix View */}
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[var(--color-bg-secondary)]">
                    <th className="sticky left-0 z-10 bg-[var(--color-bg-secondary)] text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-r border-[var(--color-border-primary)] min-w-[250px]">Permit Type</th>
                    {projectIds.map(pid => {
                      const pName = permits.find(p => p.projectId === pid)?.projectName || `Project ${pid}`;
                      return (
                        <th key={pid} className="text-center px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border-primary)] min-w-[140px]">
                          {pName}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {permitTypes.map(type => (
                    <tr key={type} className="hover:bg-[var(--color-bg-secondary)]/50">
                      <td className="sticky left-0 z-10 bg-[var(--color-bg-primary)] px-4 py-3 border-b border-r border-[var(--color-border-primary)]">
                        <span className="text-sm text-[var(--color-text-primary)]">{type}</span>
                      </td>
                      {projectIds.map(pid => {
                        const permit = getPermitStatus(pid, type);
                        if (!permit) {
                          return (
                            <td key={pid} className="text-center px-4 py-3 border-b border-[var(--color-border-primary)]">
                              <Circle className="w-4 h-4 text-[var(--color-text-tertiary)]/20 mx-auto" />
                            </td>
                          );
                        }
                        const sc = statusConfig[permit.status];
                        const Icon = sc.icon;
                        return (
                          <td key={pid} className="text-center px-4 py-3 border-b border-[var(--color-border-primary)]">
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.color} ${sc.bg}`}>
                              <Icon className="w-3 h-3" />
                              {sc.label}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </AppLayout>
  );
}

export default function PermitMatrix() {
  return <PermitMatrixContent />;
}
