import AppLayout, { useProject } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  FileText,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface Risk {
  id: string;
  title: string;
  description: string;
  category: string;
  probability: "low" | "medium" | "high" | "critical";
  impact: "low" | "medium" | "high" | "critical";
  status: "open" | "mitigating" | "accepted" | "resolved" | "closed";
  owner: string;
  mitigationPlan: string;
  dueDate: string;
  linkedDocuments: string[];
  createdAt: string;
}

const RISK_CATEGORIES = [
  "Technical", "Financial", "Regulatory", "Environmental", "Operational",
  "Legal", "Construction", "Supply Chain", "Political", "Reputational",
];

const probabilityConfig = {
  low: { label: "Low", color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10", score: 1 },
  medium: { label: "Medium", color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10", score: 2 },
  high: { label: "High", color: "text-orange-400", bg: "bg-orange-400/10", score: 3 },
  critical: { label: "Critical", color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10", score: 4 },
};

const statusConfig = {
  open: { label: "Open", color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
  mitigating: { label: "Mitigating", color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10" },
  accepted: { label: "Accepted", color: "text-[var(--color-semantic-info)]", bg: "bg-[var(--color-semantic-info)]/10" },
  resolved: { label: "Resolved", color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10" },
  closed: { label: "Closed", color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]" },
};

// Mock risks for initial UI (will be replaced with tRPC)
const mockRisks: Risk[] = [
  {
    id: "RSK-001",
    title: "Grid interconnection delay",
    description: "Utility approval for grid connection may be delayed due to capacity constraints",
    category: "Regulatory",
    probability: "high",
    impact: "critical",
    status: "mitigating",
    owner: "Project Manager",
    mitigationPlan: "Engage with utility early, prepare alternative connection points",
    dueDate: "2026-03-15",
    linkedDocuments: ["Interconnection Agreement", "Utility Study"],
    createdAt: "2026-01-10",
  },
  {
    id: "RSK-002",
    title: "Panel supply chain disruption",
    description: "Potential delays in PV module delivery from manufacturer",
    category: "Supply Chain",
    probability: "medium",
    impact: "high",
    status: "open",
    owner: "Procurement Lead",
    mitigationPlan: "Identify alternative suppliers, order buffer stock",
    dueDate: "2026-02-28",
    linkedDocuments: ["Procurement Agreement"],
    createdAt: "2026-01-12",
  },
  {
    id: "RSK-003",
    title: "Environmental permit rejection",
    description: "EIA may be rejected due to proximity to wetland area",
    category: "Environmental",
    probability: "low",
    impact: "critical",
    status: "mitigating",
    owner: "Environmental Consultant",
    mitigationPlan: "Commission supplementary ecological survey, propose offset measures",
    dueDate: "2026-04-01",
    linkedDocuments: ["EIA Report", "Ecological Survey"],
    createdAt: "2026-01-05",
  },
  {
    id: "RSK-004",
    title: "Currency fluctuation impact on project economics",
    description: "NGN/USD exchange rate volatility may affect project returns",
    category: "Financial",
    probability: "high",
    impact: "medium",
    status: "accepted",
    owner: "Finance Manager",
    mitigationPlan: "Hedge 60% of exposure, include FX adjustment clause in PPA",
    dueDate: "2026-06-01",
    linkedDocuments: ["Financial Model", "PPA Draft"],
    createdAt: "2026-01-08",
  },
  {
    id: "RSK-005",
    title: "Land acquisition dispute",
    description: "Community opposition to land use may delay site access",
    category: "Legal",
    probability: "medium",
    impact: "high",
    status: "open",
    owner: "Legal Counsel",
    mitigationPlan: "Engage community liaison, offer community benefit sharing",
    dueDate: "2026-02-15",
    linkedDocuments: ["Land Lease Agreement", "Community Engagement Plan"],
    createdAt: "2026-01-15",
  },
];

function RiskScoreCell({ probability, impact }: { probability: string; impact: string }) {
  const pScore = probabilityConfig[probability as keyof typeof probabilityConfig]?.score || 1;
  const iScore = probabilityConfig[impact as keyof typeof probabilityConfig]?.score || 1;
  const score = pScore * iScore;
  const color = score >= 12 ? "text-[var(--color-semantic-error)]" : score >= 6 ? "text-orange-400" : score >= 3 ? "text-[var(--color-semantic-warning)]" : "text-[var(--color-semantic-success)]";
  const bg = score >= 12 ? "bg-[var(--color-semantic-error)]/10" : score >= 6 ? "bg-orange-400/10" : score >= 3 ? "bg-[var(--color-semantic-warning)]/10" : "bg-[var(--color-semantic-success)]/10";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${color} ${bg}`}>
      {score}
    </span>
  );
}

function RiskRegisterContent() {
  const { state: authState } = useAuth();
  const [risks, setRisks] = useState<Risk[]>(mockRisks);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);

  const filteredRisks = risks.filter(r => {
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase()) && !r.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  // Summary stats
  const openCount = risks.filter(r => r.status === "open").length;
  const mitigatingCount = risks.filter(r => r.status === "mitigating").length;
  const criticalCount = risks.filter(r => r.probability === "critical" || r.impact === "critical").length;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        {/* Header */}
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Risk Register</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Track, assess, and mitigate project risks</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="w-4 h-4 mr-1" /> Add Risk
            </Button>
          </div>

          {/* Summary + Filters */}
          <div className="flex items-center gap-3 mt-4">
            <Badge variant="outline" className="text-[var(--color-semantic-error)]">
              <AlertTriangle className="w-3 h-3 mr-1" /> {openCount} Open
            </Badge>
            <Badge variant="outline" className="text-[var(--color-semantic-warning)]">
              <Clock className="w-3 h-3 mr-1" /> {mitigatingCount} Mitigating
            </Badge>
            <Badge variant="outline" className="text-[var(--color-semantic-error)]">
              {criticalCount} Critical
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search risks..." className="pl-9 w-48" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {RISK_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
        </div>

        {/* Risk Table */}
        <div className="p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Risk</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Category</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Probability</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Impact</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Score</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Status</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Owner</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Due</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.map((risk) => {
                const sConfig = statusConfig[risk.status];
                const pConfig = probabilityConfig[risk.probability];
                const iConfig = probabilityConfig[risk.impact];
                return (
                  <tr key={risk.id} className="hover:bg-[var(--color-bg-secondary)]/50 cursor-pointer" onClick={() => setSelectedRisk(risk)}>
                    <td className="px-4 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{risk.id}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--color-border-primary)] max-w-[300px]">
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{risk.title}</div>
                      <div className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">{risk.description}</div>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <Badge variant="outline" className="text-[10px]">{risk.category}</Badge>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      <span className={`text-xs font-medium ${pConfig.color}`}>{pConfig.label}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      <span className={`text-xs font-medium ${iConfig.color}`}>{iConfig.label}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      <RiskScoreCell probability={risk.probability} impact={risk.impact} />
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${sConfig.color} ${sConfig.bg}`}>
                        {sConfig.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs text-[var(--color-text-secondary)]">{risk.owner}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs text-[var(--color-text-secondary)]">{risk.dueDate}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRisks.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <Shield className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p>No risks found</p>
            </div>
          )}
        </div>

        {/* Risk Detail Slide-over */}
        {selectedRisk && (
          <div className="fixed inset-y-0 right-0 w-[480px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{selectedRisk.id}</span>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mt-1">{selectedRisk.title}</h2>
                </div>
                <button onClick={() => setSelectedRisk(null)}>
                  <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Description</label>
                  <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedRisk.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Probability</label>
                    <p className={`text-sm font-medium mt-1 ${probabilityConfig[selectedRisk.probability].color}`}>
                      {probabilityConfig[selectedRisk.probability].label}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Impact</label>
                    <p className={`text-sm font-medium mt-1 ${probabilityConfig[selectedRisk.impact].color}`}>
                      {probabilityConfig[selectedRisk.impact].label}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Mitigation Plan</label>
                  <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedRisk.mitigationPlan}</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Linked Documents</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRisk.linkedDocuments.map(doc => (
                      <Badge key={doc} variant="outline" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" /> {doc}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Owner</label>
                    <p className="text-sm text-[var(--color-text-primary)] mt-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {selectedRisk.owner}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Due Date</label>
                    <p className="text-sm text-[var(--color-text-primary)] mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {selectedRisk.dueDate}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function RiskRegister() {
  return <RiskRegisterContent />;
}
