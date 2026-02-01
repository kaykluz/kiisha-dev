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
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  FileText,
  Download,
  Link2,
  X,
} from "lucide-react";

interface ComplianceItem {
  id: string;
  requirement: string;
  category: string;
  regulation: string;
  status: "compliant" | "partially_compliant" | "non_compliant" | "not_assessed" | "exempt";
  linkedDocuments: string[];
  dueDate: string;
  lastAssessed: string;
  notes: string;
  projectId?: number;
}

const statusConfig = {
  compliant: { label: "Compliant", icon: CheckCircle2, color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10" },
  partially_compliant: { label: "Partial", icon: Clock, color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10" },
  non_compliant: { label: "Non-Compliant", icon: AlertCircle, color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
  not_assessed: { label: "Not Assessed", icon: Circle, color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]" },
  exempt: { label: "Exempt", icon: Circle, color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]" },
};

const CATEGORIES = [
  "Environmental", "Health & Safety", "Electrical", "Grid Code",
  "Land Use", "Labor", "Tax", "Insurance", "Data Protection",
];

const mockItems: ComplianceItem[] = [
  { id: "CMP-001", requirement: "Environmental Impact Assessment", category: "Environmental", regulation: "NESREA Act 2007", status: "compliant", linkedDocuments: ["EIA Report", "EIA Certificate"], dueDate: "", lastAssessed: "2026-01-15", notes: "", projectId: 1 },
  { id: "CMP-002", requirement: "Grid Code Compliance", category: "Grid Code", regulation: "Nigerian Grid Code 2014", status: "partially_compliant", linkedDocuments: ["Grid Compliance Study"], dueDate: "2026-03-01", lastAssessed: "2026-01-10", notes: "Awaiting frequency response test" },
  { id: "CMP-003", requirement: "Worker Safety Training", category: "Health & Safety", regulation: "Factories Act", status: "compliant", linkedDocuments: ["Safety Training Records"], dueDate: "", lastAssessed: "2026-01-20", notes: "" },
  { id: "CMP-004", requirement: "Fire Safety Certificate", category: "Health & Safety", regulation: "Federal Fire Service Act", status: "non_compliant", linkedDocuments: [], dueDate: "2026-02-15", lastAssessed: "2025-12-01", notes: "Certificate expired, renewal in progress" },
  { id: "CMP-005", requirement: "Land Use Consent", category: "Land Use", regulation: "Land Use Act 1978", status: "compliant", linkedDocuments: ["C of O", "Land Survey"], dueDate: "", lastAssessed: "2026-01-05", notes: "" },
  { id: "CMP-006", requirement: "Tax Compliance Certificate", category: "Tax", regulation: "FIRS Guidelines", status: "compliant", linkedDocuments: ["TCC"], dueDate: "2026-12-31", lastAssessed: "2026-01-01", notes: "" },
  { id: "CMP-007", requirement: "Insurance Coverage", category: "Insurance", regulation: "Insurance Act 2003", status: "partially_compliant", linkedDocuments: ["Insurance Policy"], dueDate: "2026-06-01", lastAssessed: "2026-01-10", notes: "Need to add professional indemnity cover" },
];

function ComplianceMatrixContent() {
  const [items] = useState<ComplianceItem[]>(mockItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);

  const filtered = items.filter(item => {
    if (searchQuery && !item.requirement.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const compliantCount = items.filter(i => i.status === "compliant").length;
  const nonCompliantCount = items.filter(i => i.status === "non_compliant").length;
  const partialCount = items.filter(i => i.status === "partially_compliant").length;

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Compliance Matrix</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Track regulatory compliance with document linking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> Export</Button>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Requirement</Button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Badge variant="outline" className="text-[var(--color-semantic-success)]"><CheckCircle2 className="w-3 h-3 mr-1" /> {compliantCount} Compliant</Badge>
            <Badge variant="outline" className="text-[var(--color-semantic-warning)]"><Clock className="w-3 h-3 mr-1" /> {partialCount} Partial</Badge>
            <Badge variant="outline" className="text-[var(--color-semantic-error)]"><AlertCircle className="w-3 h-3 mr-1" /> {nonCompliantCount} Non-Compliant</Badge>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-9 w-48" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[var(--color-bg-secondary)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Requirement</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Category</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Regulation</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Status</th>
                <th className="text-center px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Documents</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase border-b border-[var(--color-border-primary)]">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const sc = statusConfig[item.status];
                const Icon = sc.icon;
                return (
                  <tr key={item.id} className="hover:bg-[var(--color-bg-secondary)]/50 cursor-pointer" onClick={() => setSelectedItem(item)}>
                    <td className="px-4 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{item.id}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{item.requirement}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs text-[var(--color-text-secondary)]">{item.regulation}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${sc.color} ${sc.bg}`}>
                        <Icon className="w-3 h-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)] text-center">
                      {item.linkedDocuments.length > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          <Link2 className="w-3 h-3 mr-1" /> {item.linkedDocuments.length}
                        </Badge>
                      ) : (
                        <span className="text-xs text-[var(--color-text-tertiary)]">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--color-border-primary)]">
                      <span className="text-xs text-[var(--color-text-secondary)]">{item.dueDate || "-"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p>No compliance items found</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedItem && (
          <div className="fixed inset-y-0 right-0 w-[480px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{selectedItem.id}</span>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mt-1">{selectedItem.requirement}</h2>
                </div>
                <button onClick={() => setSelectedItem(null)}>
                  <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Regulation</label>
                  <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedItem.regulation}</p>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Linked Documents</label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedItem.linkedDocuments.map(doc => (
                      <Badge key={doc} variant="outline" className="text-xs"><FileText className="w-3 h-3 mr-1" /> {doc}</Badge>
                    ))}
                    {selectedItem.linkedDocuments.length === 0 && <p className="text-xs text-[var(--color-text-tertiary)]">No documents linked</p>}
                  </div>
                </div>
                {selectedItem.notes && (
                  <div>
                    <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Notes</label>
                    <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedItem.notes}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Last Assessed</label>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{selectedItem.lastAssessed}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default function ComplianceMatrix() {
  return <ComplianceMatrixContent />;
}
