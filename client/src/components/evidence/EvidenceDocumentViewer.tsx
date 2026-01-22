import { useState, useEffect, useCallback, useRef } from 'react';
import { Viewer, Worker, SpecialZoomLevel, PageChangeEvent, DocumentLoadEvent } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  AlertCircle, 
  Loader2, 
  Eye,
  EyeOff,
  Target,
  ChevronLeft,
  ChevronRight,
  X,
  Download
} from 'lucide-react';
import { 
  EvidenceRef, 
  EvidenceHighlightOverlay,
  EvidenceIndicator
} from './EvidenceHighlightOverlay';
import { trpc } from '@/lib/trpc';

// Worker URL for PDF.js
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// Map database evidence to component evidence format
interface DbEvidenceRef {
  id: number;
  fieldRecordId: number;
  fieldRecordType: 'ai_extraction' | 'vatr_source' | 'asset_attribute';
  documentId: number;
  pageNumber: number | null;
  tier: 'T1_TEXT' | 'T2_OCR' | 'T3_ANCHOR';
  snippet: string | null;
  bboxJson: {
    units: 'pdf_points' | 'page_normalized' | 'pixels';
    origin: 'top_left' | 'bottom_left';
    rotation: 0 | 90 | 180 | 270;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
  anchorJson: {
    matchType: 'exact' | 'regex' | 'semantic';
    query: string;
    contextBefore?: string;
    contextAfter?: string;
    occurrenceHint?: number;
  } | null;
  confidence: string;
  provenanceStatus: 'resolved' | 'unresolved' | 'needs_review' | null;
  createdAt: Date;
}

function mapDbEvidenceToComponent(dbEvidence: DbEvidenceRef, documentName: string = 'Document'): EvidenceRef {
  // Map tier string to number
  const tierMap: Record<string, 1 | 2 | 3> = {
    'T1_TEXT': 3, // T1 is highest precision = Tier 3 in UI
    'T2_OCR': 2,  // T2 is medium precision = Tier 2 in UI
    'T3_ANCHOR': 1, // T3 is lowest precision = Tier 1 in UI
  };
  
  return {
    id: dbEvidence.id,
    vatrFieldId: dbEvidence.fieldRecordId,
    fieldName: dbEvidence.fieldRecordType,
    fieldCluster: 'Evidence',
    documentId: dbEvidence.documentId,
    documentName,
    tier: tierMap[dbEvidence.tier] || 1,
    sourcePage: dbEvidence.pageNumber ?? undefined,
    bbox: dbEvidence.bboxJson ? {
      page: dbEvidence.pageNumber || 1,
      x: dbEvidence.bboxJson.x,
      y: dbEvidence.bboxJson.y,
      width: dbEvidence.bboxJson.w,
      height: dbEvidence.bboxJson.h,
    } : undefined,
    anchor: dbEvidence.anchorJson ? {
      startOffset: 0,
      endOffset: dbEvidence.anchorJson.query.length,
      contextBefore: dbEvidence.anchorJson.contextBefore,
      contextAfter: dbEvidence.anchorJson.contextAfter,
    } : undefined,
    sourceSnippet: dbEvidence.snippet ?? undefined,
    confidence: parseFloat(dbEvidence.confidence || '0.5'),
    selectionReason: dbEvidence.provenanceStatus ?? undefined,
    createdAt: dbEvidence.createdAt,
  };
}

interface EvidenceDocumentViewerProps {
  documentId: number;
  documentUrl: string;
  documentName?: string;
  fieldRecordId?: number;
  fieldRecordType?: 'ai_extraction' | 'vatr_source' | 'asset_attribute';
  initialPage?: number;
  initialEvidenceId?: number;
  height?: string;
  onClose?: () => void;
  showEvidencePanel?: boolean;
}

/**
 * EvidenceDocumentViewer - PDF viewer with integrated evidence highlighting
 * 
 * Features:
 * - Loads evidence refs for the document
 * - Renders bbox overlays for Tier 1/2 evidence
 * - Shows evidence panel with all sources
 * - Supports navigation to specific evidence locations
 * - Logs evidence view events for audit
 */
export function EvidenceDocumentViewer({
  documentId,
  documentUrl,
  documentName = 'Document',
  fieldRecordId,
  fieldRecordType = 'ai_extraction',
  initialPage = 1,
  initialEvidenceId,
  height = '600px',
  onClose,
  showEvidencePanel = true
}: EvidenceDocumentViewerProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showOverlays, setShowOverlays] = useState(true);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRef | null>(null);
  const [hoveredEvidence, setHoveredEvidence] = useState<EvidenceRef | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch evidence refs for this document page
  const { data: pageEvidenceRefs = [] } = trpc.evidence.getForDocumentPage.useQuery(
    { documentId, pageNumber: currentPage },
    { enabled: !!documentId && currentPage > 0 }
  );
  
  // Fetch evidence refs for specific field if provided
  const { data: fieldEvidenceRefs = [] } = trpc.evidence.getForField.useQuery(
    { fieldRecordId: fieldRecordId!, fieldRecordType: fieldRecordType },
    { enabled: !!fieldRecordId }
  );
  
  // Map database evidence to component format
  const pageEvidence = pageEvidenceRefs.map((e: DbEvidenceRef) => mapDbEvidenceToComponent(e, documentName));
  const fieldEvidence = fieldEvidenceRefs.map((e: DbEvidenceRef) => mapDbEvidenceToComponent(e, documentName));
  
  // Combine evidence refs - prefer field-specific if available
  const allEvidence = fieldRecordId ? fieldEvidence : pageEvidence;
  
  // Log evidence view mutation
  const logViewMutation = trpc.evidence.logView.useMutation();
  
  // Default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => defaultTabs,
  });
  
  // Handle page change
  const handlePageChange = useCallback((e: PageChangeEvent) => {
    setCurrentPage(e.currentPage + 1);
  }, []);
  
  // Handle document load
  const handleDocumentLoad = useCallback((e: DocumentLoadEvent) => {
    setTotalPages(e.doc.numPages);
    setLoading(false);
    
    // Estimate page size based on container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPageSize({
        width: rect.width - 40, // Account for padding
        height: rect.height - 60
      });
    }
  }, []);
  
  // Navigate to evidence location
  const navigateToEvidence = useCallback((evidence: EvidenceRef) => {
    setSelectedEvidence(evidence);
    
    // Navigate to page
    const targetPage = evidence.bbox?.page || evidence.sourcePage || 1;
    setCurrentPage(targetPage);
    
    // Log the view event
    if (fieldRecordId) {
      logViewMutation.mutate({
        fieldRecordId,
        fieldRecordType,
        evidenceRefId: evidence.id,
        documentId: evidence.documentId,
        pageNumber: targetPage,
        tierUsed: evidence.tier === 3 ? 'T1_TEXT' : evidence.tier === 2 ? 'T2_OCR' : 'T3_ANCHOR',
      });
    }
  }, [logViewMutation, fieldRecordId, fieldRecordType]);
  
  // Handle initial evidence selection
  useEffect(() => {
    if (initialEvidenceId && allEvidence.length > 0) {
      const evidence = allEvidence.find((e: EvidenceRef) => e.id === initialEvidenceId);
      if (evidence) {
        navigateToEvidence(evidence);
      }
    }
  }, [initialEvidenceId, allEvidence, navigateToEvidence]);
  
  // Get evidence for current page
  const currentPageEvidence = allEvidence.filter((e: EvidenceRef) => {
    if (e.tier === 1) return false; // Don't show document-level on page
    return e.sourcePage === currentPage || e.bbox?.page === currentPage;
  });
  
  return (
    <div 
      ref={containerRef}
      className="flex flex-col bg-muted/30 rounded-lg overflow-hidden" 
      style={{ height }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium truncate max-w-48">
            {documentName}
          </span>
          {currentPageEvidence.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {currentPageEvidence.length} evidence on page
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Toggle overlays */}
          <Button
            variant={showOverlays ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowOverlays(!showOverlays)}
          >
            {showOverlays ? (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Overlays On
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                Overlays Off
              </>
            )}
          </Button>
          
          {/* Page navigation */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span>
              {currentPage} / {totalPages || '?'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Download */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => window.open(documentUrl, '_blank')}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          
          {/* Close */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 relative">
          <Worker workerUrl={WORKER_URL}>
            <Viewer
              fileUrl={documentUrl}
              plugins={[defaultLayoutPluginInstance]}
              defaultScale={SpecialZoomLevel.PageWidth}
              initialPage={initialPage - 1}
              onPageChange={handlePageChange}
              onDocumentLoad={handleDocumentLoad}
              renderError={(error) => (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-destructive font-medium">Failed to load document</p>
                  <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.open(documentUrl, '_blank')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Instead
                  </Button>
                </div>
              )}
              renderLoader={(percentages) => (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Loading document... {Math.round(percentages)}%
                  </p>
                </div>
              )}
            />
          </Worker>
          
          {/* Evidence overlays */}
          {showOverlays && !loading && pageSize.width > 0 && (
            <EvidenceHighlightOverlay
              evidenceRefs={allEvidence}
              currentPage={currentPage}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
              selectedEvidenceId={selectedEvidence?.id}
              onEvidenceClick={navigateToEvidence}
              onEvidenceHover={setHoveredEvidence}
            />
          )}
        </div>
        
        {/* Evidence panel */}
        {showEvidencePanel && allEvidence.length > 0 && (
          <div className="w-72 border-l border-border bg-card overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" />
                  Evidence Sources
                </h3>
                
                {/* Evidence list */}
                <div className="space-y-2">
                  {allEvidence.map((evidence: EvidenceRef) => {
                    const isSelected = selectedEvidence?.id === evidence.id;
                    
                    return (
                      <button
                        key={evidence.id}
                        className={cn(
                          "w-full text-left p-2 rounded text-xs transition-colors border",
                          isSelected 
                            ? "bg-accent/20 border-accent" 
                            : "hover:bg-muted/50 border-transparent"
                        )}
                        onClick={() => navigateToEvidence(evidence)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <EvidenceIndicator 
                            tier={evidence.tier} 
                            confidence={evidence.confidence}
                            size="sm"
                          />
                          <Badge variant="outline" className="text-[10px]">
                            {evidence.fieldName}
                          </Badge>
                        </div>
                        {evidence.sourceSnippet && (
                          <p className="text-muted-foreground truncate">
                            "{evidence.sourceSnippet}"
                          </p>
                        )}
                        {evidence.sourcePage && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Page {evidence.sourcePage}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      
      {/* Hovered evidence info bar */}
      {hoveredEvidence && (
        <div className="p-2 border-t border-border bg-accent/10 text-xs">
          <div className="flex items-center gap-2">
            <EvidenceIndicator tier={hoveredEvidence.tier} confidence={hoveredEvidence.confidence} />
            <span className="font-medium">{hoveredEvidence.fieldName}</span>
            {hoveredEvidence.sourceSnippet && (
              <span className="text-muted-foreground truncate">
                "{hoveredEvidence.sourceSnippet}"
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * EvidenceDocumentViewerModal - Modal wrapper for the evidence viewer
 */
interface EvidenceDocumentViewerModalProps extends EvidenceDocumentViewerProps {
  isOpen: boolean;
}

export function EvidenceDocumentViewerModal({
  isOpen,
  onClose,
  ...props
}: EvidenceDocumentViewerModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 z-50 flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden">
        <EvidenceDocumentViewer
          {...props}
          onClose={onClose}
          height="100%"
        />
      </div>
    </div>
  );
}
