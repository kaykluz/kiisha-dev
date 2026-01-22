import { useState, useEffect, useCallback, useRef } from 'react';
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { 
  FileText, Image, Download, AlertCircle, Loader2, 
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Search,
  Maximize2, FileSpreadsheet, FileType
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PDFViewerProps {
  fileUrl: string;
  initialPage?: number;
  highlightText?: string;
  onPageChange?: (page: number) => void;
  height?: string;
  fileName?: string;
  fileType?: string;
}

// Worker URL for PDF.js
const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

export function PDFViewer({ 
  fileUrl, 
  initialPage = 1, 
  highlightText,
  onPageChange,
  height = '600px',
  fileName,
  fileType
}: PDFViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Detect file type from URL or prop
  const detectedFileType = fileType || getFileTypeFromUrl(fileUrl);
  const isPdf = detectedFileType === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(detectedFileType);
  const isExcel = ['xlsx', 'xls', 'csv'].includes(detectedFileType);
  const isWord = ['docx', 'doc'].includes(detectedFileType);
  
  // Default layout plugin for PDF viewer
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: (defaultTabs) => defaultTabs,
    toolbarPlugin: {
      searchPlugin: {
        keyword: highlightText || '',
      },
    },
  });
  
  const handlePageChange = useCallback((e: { currentPage: number }) => {
    setCurrentPage(e.currentPage + 1);
    onPageChange?.(e.currentPage + 1);
  }, [onPageChange]);
  
  const handleDocumentLoad = useCallback((e: { doc: { numPages: number } }) => {
    setTotalPages(e.doc.numPages);
    setLoading(false);
  }, []);
  
  // If it's a PDF, render with react-pdf-viewer
  if (isPdf) {
    return (
      <div className="flex flex-col h-full bg-muted/30 rounded-lg overflow-hidden" style={{ height }}>
        <Worker workerUrl={WORKER_URL}>
          <div className="flex-1 overflow-hidden">
            <Viewer
              fileUrl={fileUrl}
              plugins={[defaultLayoutPluginInstance]}
              defaultScale={SpecialZoomLevel.PageWidth}
              initialPage={initialPage - 1}
              onPageChange={handlePageChange}
              onDocumentLoad={handleDocumentLoad}
              renderError={(error) => (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-destructive font-medium">Failed to load PDF</p>
                  <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.open(fileUrl, '_blank')}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Instead
                  </Button>
                </div>
              )}
              renderLoader={(percentages) => (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-accent mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Loading PDF... {Math.round(percentages)}%
                  </p>
                </div>
              )}
            />
          </div>
        </Worker>
      </div>
    );
  }
  
  // Image viewer
  if (isImage) {
    return (
      <ImageViewer 
        fileUrl={fileUrl} 
        fileName={fileName} 
        height={height}
      />
    );
  }
  
  // Excel/CSV viewer placeholder
  if (isExcel) {
    return (
      <ExcelViewer 
        fileUrl={fileUrl} 
        fileName={fileName} 
        height={height}
      />
    );
  }
  
  // Word document placeholder
  if (isWord) {
    return (
      <WordViewer 
        fileUrl={fileUrl} 
        fileName={fileName} 
        height={height}
      />
    );
  }
  
  // Unsupported file type
  return (
    <UnsupportedViewer 
      fileUrl={fileUrl} 
      fileName={fileName} 
      fileType={detectedFileType}
      height={height}
    />
  );
}

// Image Viewer Component
function ImageViewer({ fileUrl, fileName, height }: { fileUrl: string; fileName?: string; height: string }) {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  return (
    <div className="flex flex-col bg-muted/30 rounded-lg overflow-hidden" style={{ height }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Image className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-48">{fileName || 'Image'}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.min(4, z + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setZoom(1)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => window.open(fileUrl, '_blank')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Image */}
      <ScrollArea className="flex-1">
        <div className="flex items-center justify-center p-4 min-h-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
          )}
          {error ? (
            <div className="flex flex-col items-center justify-center p-8">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-medium">Failed to load image</p>
              <Button variant="outline" className="mt-4" onClick={() => window.open(fileUrl, '_blank')}>
                <Download className="h-4 w-4 mr-2" />
                Download Instead
              </Button>
            </div>
          ) : (
            <img 
              src={fileUrl} 
              alt={fileName || 'Document image'}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
              className="max-w-full transition-transform duration-200"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setError(true); }}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Excel/CSV Viewer Placeholder
function ExcelViewer({ fileUrl, fileName, height }: { fileUrl: string; fileName?: string; height: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
      <FileSpreadsheet className="h-16 w-16 text-success/50 mb-4" />
      <h3 className="font-semibold text-foreground mb-2">Excel/CSV Document</h3>
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
        {fileName || 'Spreadsheet file'}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Preview not available for spreadsheet files
      </p>
      <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')}>
        <Download className="h-4 w-4 mr-2" />
        Download to View
      </Button>
    </div>
  );
}

// Word Document Viewer Placeholder
function WordViewer({ fileUrl, fileName, height }: { fileUrl: string; fileName?: string; height: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
      <FileType className="h-16 w-16 text-blue-500/50 mb-4" />
      <h3 className="font-semibold text-foreground mb-2">Word Document</h3>
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
        {fileName || 'Word document'}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Preview not available for Word documents
      </p>
      <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')}>
        <Download className="h-4 w-4 mr-2" />
        Download to View
      </Button>
    </div>
  );
}

// Unsupported File Type Viewer
function UnsupportedViewer({ 
  fileUrl, 
  fileName, 
  fileType,
  height 
}: { 
  fileUrl: string; 
  fileName?: string; 
  fileType: string;
  height: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg" style={{ height }}>
      <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 className="font-semibold text-foreground mb-2">Preview Not Available</h3>
      <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
        {fileName || `${fileType.toUpperCase()} file`}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        This file type ({fileType}) cannot be previewed in the browser
      </p>
      <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')}>
        <Download className="h-4 w-4 mr-2" />
        Download to View
      </Button>
    </div>
  );
}

// Helper function to detect file type from URL
function getFileTypeFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase() || '';
    return extension;
  } catch {
    // If URL parsing fails, try to extract extension directly
    const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
    return extension;
  }
}

// Export a modal wrapper for the PDF viewer
export function PDFViewerModal({ 
  fileUrl, 
  fileName,
  fileType,
  initialPage,
  highlightText,
  isOpen,
  onClose
}: PDFViewerProps & { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 z-50 flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <span className="font-semibold">{fileName || 'Document Preview'}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        
        {/* Viewer */}
        <div className="flex-1 overflow-hidden">
          <PDFViewer
            fileUrl={fileUrl}
            fileName={fileName}
            fileType={fileType}
            initialPage={initialPage}
            highlightText={highlightText}
            height="100%"
          />
        </div>
      </div>
    </div>
  );
}
