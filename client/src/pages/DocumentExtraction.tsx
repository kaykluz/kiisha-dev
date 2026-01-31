import { useState } from "react";
import { useParams } from "wouter";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
  Link2,
  Clock,
  User,
  AlertCircle,
  Eye,
  History,
  ExternalLink,
} from "lucide-react";
import { PDFViewer, PDFViewerModal } from "@/components/PDFViewer";

// Traceability data for each extracted field
interface SourceReference {
  documentId: string;
  documentName: string;
  pageNumber: number;
  textSnippet: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface VerificationInfo {
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
}

// Mock extracted fields with full traceability
interface ExtractedField {
  id: string;
  category: string;
  subcategory: string;
  fieldName: string;
  extractedValue: string;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  // Traceability fields
  sourceReference: SourceReference;
  extractedAt: string;
  verification: VerificationInfo;
}

const mockExtractions: ExtractedField[] = [
  // Interconnection / Overview
  { 
    id: "1", 
    category: "Interconnection", 
    subcategory: "Overview", 
    fieldName: "Interconnection Type", 
    extractedValue: "Behind-the-Meter", 
    confidence: 0.96, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 1,
      textSnippet: "...Interconnection Type: Behind-the-Meter as defined in Section 2.1...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "2", 
    category: "Interconnection", 
    subcategory: "Overview", 
    fieldName: "Queue Position", 
    extractedValue: "Q-2024-1847", 
    confidence: 0.92, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 1,
      textSnippet: "...assigned Queue Position Q-2024-1847 in the interconnection queue...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "3", 
    category: "Interconnection", 
    subcategory: "Overview", 
    fieldName: "Application Date", 
    extractedValue: "March 15, 2025", 
    confidence: 0.94, 
    status: "accepted",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 1,
      textSnippet: "...entered into as of March 15, 2025, by and between...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: "Sarah Chen", verifiedAt: "2026-01-14T14:22:00Z", verificationNotes: "Confirmed against original application" },
  },
  // Interconnection / Grid Details
  { 
    id: "4", 
    category: "Interconnection", 
    subcategory: "Grid Details", 
    fieldName: "Point of Interconnection", 
    extractedValue: "Gillette Substation 115kV", 
    confidence: 0.91, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 2,
      textSnippet: "...Point of Interconnection: Gillette Substation 115kV bus...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "5", 
    category: "Interconnection", 
    subcategory: "Grid Details", 
    fieldName: "Voltage Level", 
    extractedValue: "34.5 kV", 
    confidence: 0.95, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 2,
      textSnippet: "...distribution voltage level of 34.5 kV...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "6", 
    category: "Interconnection", 
    subcategory: "Grid Details", 
    fieldName: "Utility", 
    extractedValue: "National Grid", 
    confidence: 0.98, 
    status: "accepted",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 1,
      textSnippet: "...by and between National Grid (\"Utility\") and...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: "Mike Johnson", verifiedAt: "2026-01-14T15:10:00Z", verificationNotes: null },
  },
  { 
    id: "7", 
    category: "Interconnection", 
    subcategory: "Grid Details", 
    fieldName: "RTO/ISO", 
    extractedValue: "ISO-NE", 
    confidence: 0.97, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 2,
      textSnippet: "...within the ISO-NE service territory...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  // Interconnection / Costs
  { 
    id: "8", 
    category: "Interconnection", 
    subcategory: "Costs", 
    fieldName: "Interconnection Cost", 
    extractedValue: "$1,245,000", 
    confidence: 0.89, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 3,
      textSnippet: "...Total Interconnection Cost: $1,245,000 USD...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "9", 
    category: "Interconnection", 
    subcategory: "Costs", 
    fieldName: "Network Upgrades", 
    extractedValue: "$450,000", 
    confidence: 0.85, 
    status: "pending",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 3,
      textSnippet: "...Network Upgrades estimated at $450,000...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "10", 
    category: "Interconnection", 
    subcategory: "Costs", 
    fieldName: "Deposit Required", 
    extractedValue: "$125,000", 
    confidence: 0.88, 
    status: "rejected",
    sourceReference: {
      documentId: "doc-001",
      documentName: "Interconnection_Agreement.pdf",
      pageNumber: 3,
      textSnippet: "...Required Deposit: $125,000 due upon execution...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: "Sarah Chen", verifiedAt: "2026-01-14T16:05:00Z", verificationNotes: "Incorrect - deposit was updated to $150,000 in amendment" },
  },
  // Valuation & Financing
  { 
    id: "11", 
    category: "Valuation & Financing", 
    subcategory: "Terms", 
    fieldName: "PPA Rate", 
    extractedValue: "$0.085/kWh", 
    confidence: 0.93, 
    status: "pending",
    sourceReference: {
      documentId: "doc-002",
      documentName: "PPA_Agreement.pdf",
      pageNumber: 4,
      textSnippet: "...initial rate of $0.085 per kilowatt-hour...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "12", 
    category: "Valuation & Financing", 
    subcategory: "Terms", 
    fieldName: "Escalation Rate", 
    extractedValue: "2.0% annually", 
    confidence: 0.91, 
    status: "pending",
    sourceReference: {
      documentId: "doc-002",
      documentName: "PPA_Agreement.pdf",
      pageNumber: 4,
      textSnippet: "...annual escalation of 2.0% per year...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
  { 
    id: "13", 
    category: "Valuation & Financing", 
    subcategory: "Terms", 
    fieldName: "Contract Term", 
    extractedValue: "20 years", 
    confidence: 0.94, 
    status: "pending",
    sourceReference: {
      documentId: "doc-002",
      documentName: "PPA_Agreement.pdf",
      pageNumber: 2,
      textSnippet: "...term of twenty (20) years from Commercial Operation Date...",
    },
    extractedAt: "2026-01-14T10:30:00Z",
    verification: { verifiedBy: null, verifiedAt: null, verificationNotes: null },
  },
];

// Mock extraction history
const mockExtractionHistory = [
  { id: "h1", action: "extracted", user: "AI System", timestamp: "2026-01-14T10:30:00Z", details: "Initial extraction from Interconnection_Agreement.pdf" },
  { id: "h2", action: "verified", user: "Sarah Chen", timestamp: "2026-01-14T14:22:00Z", details: "Verified Application Date field" },
  { id: "h3", action: "verified", user: "Mike Johnson", timestamp: "2026-01-14T15:10:00Z", details: "Verified Utility field" },
  { id: "h4", action: "rejected", user: "Sarah Chen", timestamp: "2026-01-14T16:05:00Z", details: "Rejected Deposit Required - value outdated" },
];

// Confidence indicator
function ConfidenceIndicator({ confidence }: { confidence: number }) {
  const dots = Math.round(confidence * 5);
  return (
    <div className="confidence-dots" title={`${Math.round(confidence * 100)}% confidence`}>
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className={cn(
            "confidence-dot",
            i < dots ? "confidence-dot-filled" : "confidence-dot-empty"
          )}
        />
      ))}
    </div>
  );
}

// Traceability panel for selected field
function TraceabilityPanel({ field, onClose }: { field: ExtractedField; onClose: () => void }) {
  return (
    <div className="border-t border-border bg-secondary/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          Source Traceability
        </h4>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="space-y-3 text-sm">
        {/* Source Document */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Source Document</p>
          <div className="flex items-center gap-2 p-2 bg-card rounded border border-border">
            <FileText className="w-4 h-4 text-primary" />
            <span className="flex-1">{field.sourceReference.documentName}</span>
            <Badge variant="outline" className="text-[10px]">
              Page {field.sourceReference.pageNumber}
            </Badge>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Text Snippet */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Extracted Text</p>
          <div className="p-2 bg-card rounded border border-border text-xs italic text-muted-foreground">
            "{field.sourceReference.textSnippet}"
          </div>
        </div>

        {/* Extraction Timestamp */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Extracted At</p>
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {new Date(field.extractedAt).toLocaleString()}
          </div>
        </div>

        {/* Verification Info */}
        {field.verification.verifiedBy && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Verification</p>
            <div className="p-2 bg-card rounded border border-border space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <User className="w-3 h-3 text-muted-foreground" />
                <span>Verified by {field.verification.verifiedBy}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {field.verification.verifiedAt && new Date(field.verification.verifiedAt).toLocaleString()}
              </div>
              {field.verification.verificationNotes && (
                <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">
                  Note: {field.verification.verificationNotes}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Unverified Warning */}
        {!field.verification.verifiedBy && field.status === "pending" && (
          <div className="flex items-center gap-2 p-2 bg-warning/10 border border-warning/30 rounded text-xs text-warning">
            <AlertCircle className="w-4 h-4" />
            <span>This extraction has not been verified by a human reviewer</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DocumentExtractionContent() {
  const params = useParams();
  const [extractions, setExtractions] = useState(mockExtractions);
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [showTraceability, setShowTraceability] = useState<string | null>(null);
  const totalPages = 5; // Mock

  const pendingCount = extractions.filter((e) => e.status === "pending").length;
  const unverifiedCount = extractions.filter((e) => !e.verification.verifiedBy).length;

  const acceptField = (id: string) => {
    setExtractions((fields) =>
      fields.map((f) => (f.id === id ? { 
        ...f, 
        status: "accepted" as const,
        verification: {
          verifiedBy: "Current User",
          verifiedAt: new Date().toISOString(),
          verificationNotes: null,
        }
      } : f))
    );
    toast.success("Field verified and accepted");
  };

  const rejectField = (id: string) => {
    setExtractions((fields) =>
      fields.map((f) => (f.id === id ? { 
        ...f, 
        status: "rejected" as const,
        verification: {
          verifiedBy: "Current User",
          verifiedAt: new Date().toISOString(),
          verificationNotes: "Rejected during review",
        }
      } : f))
    );
    toast.success("Field rejected");
  };

  // Group extractions by category and subcategory
  const groupedExtractions = extractions.reduce((acc, field) => {
    const key = `${field.category} / ${field.subcategory}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(field);
    return acc;
  }, {} as Record<string, ExtractedField[]>);

  const selectedFieldData = selectedField ? extractions.find(f => f.id === selectedField) : null;

  return (
    <div className="h-[calc(100vh-8rem)] flex">
      {/* Left Panel - Document Viewer */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Viewer Toolbar */}
        <div className="h-12 border-b border-border bg-card flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Interconnection_Agreement.pdf</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(Math.max(50, zoom - 10))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setZoom(Math.min(200, zoom + 10))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <RotateCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Document View - Real PDF Viewer */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer
            fileUrl="https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf"
            fileName="Interconnection_Agreement.pdf"
            fileType="pdf"
            initialPage={currentPage}
            highlightText={selectedFieldData?.sourceReference.textSnippet}
            onPageChange={(page) => setCurrentPage(page)}
            height="100%"
          />
        </div>

        {/* Page Navigation */}
        <div className="h-10 border-t border-border bg-card flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Right Panel - Extracted Details */}
      <div className="w-[480px] shrink-0 flex flex-col bg-card">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI Extracted Details</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                pendingCount > 0
                  ? "bg-warning/20 text-warning border-warning/30"
                  : "bg-success/20 text-success border-success/30"
              )}
            >
              {pendingCount} pending
            </Badge>
            <Badge
              variant="outline"
              className="bg-destructive/20 text-destructive border-destructive/30"
            >
              {unverifiedCount} unverified
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-3 h-3 mr-1" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 m-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {Object.entries(groupedExtractions).map(([group, fields]) => (
                  <div key={group}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                      {group}
                    </p>
                    <div className="space-y-2">
                      {fields.map((field) => (
                        <div key={field.id}>
                          <div
                            className={cn(
                              "p-3 rounded-lg border transition-colors cursor-pointer",
                              selectedField === field.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground",
                              field.status === "accepted" && "bg-success/5 border-success/30",
                              field.status === "rejected" && "bg-destructive/5 border-destructive/30 opacity-60"
                            )}
                            onClick={() => {
                              setSelectedField(field.id);
                              setShowTraceability(field.id);
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs text-muted-foreground">{field.fieldName}</p>
                                  {!field.verification.verifiedBy && field.status === "pending" && (
                                    <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/30">
                                      Unverified
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium mt-0.5">{field.extractedValue}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <ConfidenceIndicator confidence={field.confidence} />
                                  <span className="text-[10px] text-muted-foreground">
                                    {Math.round(field.confidence * 100)}%
                                  </span>
                                  <button 
                                    className="text-[10px] text-primary hover:underline flex items-center gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowTraceability(showTraceability === field.id ? null : field.id);
                                    }}
                                  >
                                    <Link2 className="w-3 h-3" />
                                    Source
                                  </button>
                                </div>
                              </div>
                              {field.status === "pending" && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-success hover:text-success hover:bg-success/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      acceptField(field.id);
                                    }}
                                    title="Verify & Accept"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rejectField(field.id);
                                    }}
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                              {field.status === "accepted" && (
                                <div className="flex items-center gap-1">
                                  <Check className="w-4 h-4 text-success shrink-0" />
                                  <span className="text-[10px] text-success">Verified</span>
                                </div>
                              )}
                              {field.status === "rejected" && (
                                <div className="flex items-center gap-1">
                                  <X className="w-4 h-4 text-destructive shrink-0" />
                                  <span className="text-[10px] text-destructive">Rejected</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Inline Traceability Panel */}
                          {showTraceability === field.id && (
                            <TraceabilityPanel 
                              field={field} 
                              onClose={() => setShowTraceability(null)} 
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 m-0">
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="p-4 space-y-3">
                {mockExtractionHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      entry.action === "extracted" && "bg-primary/20",
                      entry.action === "verified" && "bg-success/20",
                      entry.action === "rejected" && "bg-destructive/20"
                    )}>
                      {entry.action === "extracted" && <Sparkles className="w-4 h-4 text-primary" />}
                      {entry.action === "verified" && <Check className="w-4 h-4 text-success" />}
                      {entry.action === "rejected" && <X className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">{entry.details}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {entry.user}
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1">
            Re-extract
          </Button>
          <Button className="flex-1" disabled={pendingCount > 0}>
            {pendingCount > 0 ? `${pendingCount} Fields Need Review` : "Save All"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentExtraction() {
  return (
    <AppLayout>
      <DocumentExtractionContent />
    </AppLayout>
  );
}
