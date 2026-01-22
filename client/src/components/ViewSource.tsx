import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, ExternalLink, Quote, MapPin, Copy, Check } from "lucide-react";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface EvidenceSource {
  /** Unique identifier for the evidence */
  id: string;
  /** The field this evidence supports */
  fieldName: string;
  /** The extracted/displayed value */
  value: string;
  /** Source document name */
  documentName: string;
  /** Source document ID */
  documentId?: string;
  /** Page number in the document */
  pageNumber?: number;
  /** Character offset in the document */
  charOffset?: number;
  /** The exact text snippet from the source */
  sourceText: string;
  /** Surrounding context (before and after) */
  context?: {
    before: string;
    after: string;
  };
  /** Confidence score (0-1) */
  confidence?: number;
  /** Extraction timestamp */
  extractedAt?: Date;
}

// ============================================================================
// View Source Button
// ============================================================================

interface ViewSourceButtonProps {
  evidence: EvidenceSource;
  variant?: "default" | "inline" | "icon";
  onNavigate?: (evidence: EvidenceSource) => void;
}

export function ViewSourceButton({ evidence, variant = "default", onNavigate }: ViewSourceButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(evidence.sourceText);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(evidence);
    }
    setOpen(false);
  };
  
  if (variant === "icon") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
              onClick={() => setOpen(true)}
            >
              <Quote className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>View source</p>
          </TooltipContent>
        </Tooltip>
        
        <ViewSourceDialog 
          evidence={evidence} 
          open={open} 
          onOpenChange={setOpen}
          onCopy={handleCopy}
          onNavigate={handleNavigate}
          copied={copied}
        />
      </TooltipProvider>
    );
  }
  
  if (variant === "inline") {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Quote className="h-3 w-3" />
          View source
        </button>
        
        <ViewSourceDialog 
          evidence={evidence} 
          open={open} 
          onOpenChange={setOpen}
          onCopy={handleCopy}
          onNavigate={handleNavigate}
          copied={copied}
        />
      </>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Quote className="h-4 w-4" />
          View Source
        </Button>
      </DialogTrigger>
      
      <ViewSourceDialog 
        evidence={evidence} 
        open={open} 
        onOpenChange={setOpen}
        onCopy={handleCopy}
        onNavigate={handleNavigate}
        copied={copied}
      />
    </Dialog>
  );
}

// ============================================================================
// View Source Dialog
// ============================================================================

interface ViewSourceDialogProps {
  evidence: EvidenceSource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
  onNavigate: () => void;
  copied: boolean;
}

function ViewSourceDialog({ evidence, open, onOpenChange, onCopy, onNavigate, copied }: ViewSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Quote className="h-5 w-5 text-primary" />
            Source Evidence
          </DialogTitle>
          <DialogDescription>
            Extracted from document with AI assistance
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Field and Value */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Field</div>
              <div className="font-medium">{evidence.fieldName}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Extracted Value</div>
              <div className="font-mono text-primary">{evidence.value}</div>
            </div>
          </div>
          
          {/* Source Document */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{evidence.documentName}</div>
              {evidence.pageNumber && (
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Page {evidence.pageNumber}
                  {evidence.charOffset && `, Character ${evidence.charOffset}`}
                </div>
              )}
            </div>
            {evidence.confidence !== undefined && (
              <Badge variant={evidence.confidence > 0.8 ? "default" : evidence.confidence > 0.5 ? "secondary" : "outline"}>
                {(evidence.confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </div>
          
          {/* Source Text with Context */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Source Text</div>
            <ScrollArea className="h-40 rounded-lg border p-4 bg-muted/30">
              <div className="text-sm">
                {evidence.context?.before && (
                  <span className="text-muted-foreground">{evidence.context.before}</span>
                )}
                <mark className="bg-primary/20 px-1 rounded font-medium">
                  {evidence.sourceText}
                </mark>
                {evidence.context?.after && (
                  <span className="text-muted-foreground">{evidence.context.after}</span>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" size="sm" onClick={onCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Text
                </>
              )}
            </Button>
            
            {evidence.documentId && (
              <Button size="sm" onClick={onNavigate}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Document
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Evidence Field Display
// ============================================================================

interface EvidenceFieldProps {
  label: string;
  value: string | number | null | undefined;
  evidence?: EvidenceSource;
  onNavigate?: (evidence: EvidenceSource) => void;
}

export function EvidenceField({ label, value, evidence, onNavigate }: EvidenceFieldProps) {
  const displayValue = value ?? "—";
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {evidence && (
          <ViewSourceButton evidence={evidence} variant="icon" onNavigate={onNavigate} />
        )}
      </div>
      <div className="font-medium">{displayValue}</div>
    </div>
  );
}

// ============================================================================
// Evidence Summary Card
// ============================================================================

interface EvidenceSummaryProps {
  evidences: EvidenceSource[];
  onNavigate?: (evidence: EvidenceSource) => void;
}

export function EvidenceSummary({ evidences, onNavigate }: EvidenceSummaryProps) {
  if (evidences.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        No evidence sources available
      </div>
    );
  }
  
  const avgConfidence = evidences.reduce((sum, e) => sum + (e.confidence || 0), 0) / evidences.length;
  const documentCount = new Set(evidences.map(e => e.documentId)).size;
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{documentCount} document{documentCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Quote className="h-4 w-4 text-muted-foreground" />
          <span>{evidences.length} source{evidences.length !== 1 ? 's' : ''}</span>
        </div>
        <Badge variant={avgConfidence > 0.8 ? "default" : avgConfidence > 0.5 ? "secondary" : "outline"}>
          {(avgConfidence * 100).toFixed(0)}% avg confidence
        </Badge>
      </div>
      
      <div className="space-y-2">
        {evidences.slice(0, 3).map((evidence) => (
          <div 
            key={evidence.id}
            className="flex items-start justify-between p-2 rounded border bg-muted/30"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{evidence.fieldName}</div>
              <div className="text-xs text-muted-foreground truncate">
                {evidence.documentName}
                {evidence.pageNumber && ` • Page ${evidence.pageNumber}`}
              </div>
            </div>
            <ViewSourceButton evidence={evidence} variant="icon" onNavigate={onNavigate} />
          </div>
        ))}
        
        {evidences.length > 3 && (
          <div className="text-xs text-muted-foreground text-center">
            +{evidences.length - 3} more sources
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Highlighted Document Viewer
// ============================================================================

interface HighlightedDocumentProps {
  content: string;
  highlights: Array<{
    start: number;
    end: number;
    fieldName: string;
    value: string;
  }>;
  onHighlightClick?: (highlight: { fieldName: string; value: string }) => void;
}

export function HighlightedDocument({ content, highlights, onHighlightClick }: HighlightedDocumentProps) {
  // Sort highlights by start position
  const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);
  
  // Build segments with highlights
  const segments: Array<{ text: string; highlight?: typeof highlights[0] }> = [];
  let lastEnd = 0;
  
  for (const highlight of sortedHighlights) {
    // Add text before highlight
    if (highlight.start > lastEnd) {
      segments.push({ text: content.slice(lastEnd, highlight.start) });
    }
    
    // Add highlighted text
    segments.push({
      text: content.slice(highlight.start, highlight.end),
      highlight,
    });
    
    lastEnd = highlight.end;
  }
  
  // Add remaining text
  if (lastEnd < content.length) {
    segments.push({ text: content.slice(lastEnd) });
  }
  
  return (
    <div className="font-mono text-sm whitespace-pre-wrap">
      {segments.map((segment, index) => (
        segment.highlight ? (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <mark
                  className="bg-primary/20 px-0.5 rounded cursor-pointer hover:bg-primary/30 transition-colors"
                  onClick={() => onHighlightClick?.(segment.highlight!)}
                >
                  {segment.text}
                </mark>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-sans">
                  <span className="text-muted-foreground">{segment.highlight.fieldName}:</span>{" "}
                  <span className="font-medium">{segment.highlight.value}</span>
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      ))}
    </div>
  );
}
