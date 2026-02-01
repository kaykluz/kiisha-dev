import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  Plus,
  Search,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  FileText,
  Building2,
} from "lucide-react";

interface Contract {
  id: string;
  name: string;
  contractType: string;
  parties: string[];
  executionDate: string;
  expirationDate: string;
  status: "draft" | "under_review" | "executed" | "expired" | "terminated";
  value: string;
  obligations: { description: string; dueDate: string; status: string }[];
  linkedDocuments: string[];
}

const statusConfig = {
  draft: { label: "Draft", color: "text-[var(--color-text-tertiary)]", bg: "bg-[var(--color-bg-tertiary)]" },
  under_review: { label: "Under Review", color: "text-[var(--color-semantic-warning)]", bg: "bg-[var(--color-semantic-warning)]/10" },
  executed: { label: "Executed", color: "text-[var(--color-semantic-success)]", bg: "bg-[var(--color-semantic-success)]/10" },
  expired: { label: "Expired", color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
  terminated: { label: "Terminated", color: "text-[var(--color-semantic-error)]", bg: "bg-[var(--color-semantic-error)]/10" },
};

const mockContracts: Contract[] = [
  {
    id: "CTR-001",
    name: "Power Purchase Agreement - Lekki Solar",
    contractType: "PPA",
    parties: ["KIISHA Energy SPV", "Dangote Industries"],
    executionDate: "2025-06-15",
    expirationDate: "2045-06-15",
    status: "executed",
    value: "$2,400,000",
    obligations: [
      { description: "Quarterly performance report", dueDate: "2026-03-31", status: "pending" },
      { description: "Annual tariff escalation review", dueDate: "2026-06-15", status: "pending" },
    ],
    linkedDocuments: ["PPA Agreement", "Tariff Schedule", "Performance Guarantee"],
  },
  {
    id: "CTR-002",
    name: "EPC Contract - Abuja BESS",
    contractType: "EPC",
    parties: ["KIISHA Energy", "SolarTech Nigeria Ltd"],
    executionDate: "2025-11-01",
    expirationDate: "2027-05-01",
    status: "executed",
    value: "$5,800,000",
    obligations: [
      { description: "Phase 1 completion milestone", dueDate: "2026-03-01", status: "pending" },
      { description: "Performance testing", dueDate: "2026-08-01", status: "pending" },
    ],
    linkedDocuments: ["EPC Agreement", "Technical Specifications", "Performance Bond"],
  },
  {
    id: "CTR-003",
    name: "Land Lease Agreement - Kano Site",
    contractType: "Lease",
    parties: ["KIISHA Energy SPV", "Kano State Government"],
    executionDate: "2025-09-20",
    expirationDate: "2050-09-20",
    status: "executed",
    value: "$150,000/yr",
    obligations: [
      { description: "Annual rent payment", dueDate: "2026-09-20", status: "pending" },
      { description: "Environmental compliance report", dueDate: "2026-06-01", status: "pending" },
    ],
    linkedDocuments: ["Lease Agreement", "Survey Plan", "Environmental Permit"],
  },
  {
    id: "CTR-004",
    name: "O&M Agreement - Portfolio Wide",
    contractType: "O&M",
    parties: ["KIISHA Energy", "MaintenancePro Africa"],
    executionDate: "",
    expirationDate: "",
    status: "under_review",
    value: "$350,000/yr",
    obligations: [],
    linkedDocuments: ["O&M Draft", "SLA Document"],
  },
];

function ContractTrackerContent() {
  const [contracts] = useState<Contract[]>(mockContracts);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const filtered = contracts.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="min-h-screen bg-[var(--color-bg-primary)]">
        <div className="border-b border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSignature className="w-5 h-5 text-[var(--color-brand-primary)]" />
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Contract Tracker</h1>
                <p className="text-sm text-[var(--color-text-secondary)]">Track contracts, obligations, and key dates</p>
              </div>
            </div>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Contract</Button>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search contracts..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {filtered.map(contract => {
              const sc = statusConfig[contract.status];
              const pendingObligations = contract.obligations.filter(o => o.status === "pending").length;
              return (
                <div
                  key={contract.id}
                  onClick={() => setSelectedContract(contract)}
                  className="p-4 rounded-lg border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-secondary)] cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{contract.id}</span>
                        <Badge variant="outline" className="text-[10px]">{contract.contractType}</Badge>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${sc.color} ${sc.bg}`}>{sc.label}</span>
                      </div>
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{contract.name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
                        <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {contract.parties.join(" & ")}</span>
                        {contract.value && <span className="flex items-center gap-1">Value: {contract.value}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      {contract.executionDate && (
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {contract.executionDate} - {contract.expirationDate}
                        </div>
                      )}
                      {pendingObligations > 0 && (
                        <Badge variant="outline" className="mt-1 text-[var(--color-semantic-warning)]">
                          <Clock className="w-3 h-3 mr-1" /> {pendingObligations} pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <FileSignature className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
              <p>No contracts found</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedContract && (
          <div className="fixed inset-y-0 right-0 w-[480px] bg-[var(--color-bg-secondary)] border-l border-[var(--color-border-primary)] shadow-2xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{selectedContract.id}</span>
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mt-1">{selectedContract.name}</h2>
                </div>
                <button onClick={() => setSelectedContract(null)}>
                  <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Parties</label>
                  {selectedContract.parties.map(p => (
                    <p key={p} className="text-sm text-[var(--color-text-primary)] mt-1">{p}</p>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Key Obligations</label>
                  <div className="space-y-2 mt-2">
                    {selectedContract.obligations.map((ob, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded bg-[var(--color-bg-tertiary)]">
                        <span className="text-xs text-[var(--color-text-primary)]">{ob.description}</span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">{ob.dueDate}</span>
                      </div>
                    ))}
                    {selectedContract.obligations.length === 0 && (
                      <p className="text-xs text-[var(--color-text-tertiary)]">No obligations defined</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] uppercase">Linked Documents</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedContract.linkedDocuments.map(doc => (
                      <Badge key={doc} variant="outline" className="text-xs">
                        <FileText className="w-3 h-3 mr-1" /> {doc}
                      </Badge>
                    ))}
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

export default function ContractTracker() {
  return <ContractTrackerContent />;
}
