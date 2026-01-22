import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  X,
  FileText,
  Image as ImageIcon,
  Loader2
} from "lucide-react";

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl: string;
  documentName: string;
  mimeType?: string;
}

export function DocumentPreview({ 
  isOpen, 
  onClose, 
  documentUrl, 
  documentName,
  mimeType 
}: DocumentPreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPdf = mimeType?.includes('pdf') || documentUrl.toLowerCase().endsWith('.pdf');
  const isImage = mimeType?.startsWith('image/') || 
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(documentUrl);

  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setCurrentPage(1);
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, documentUrl]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = documentName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium">
              {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
              {documentName}
            </DialogTitle>
            <div className="flex items-center gap-1">
              {/* Zoom controls */}
              <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8">
                <ZoomIn className="h-4 w-4" />
              </Button>
              
              {/* Rotate */}
              <Button variant="ghost" size="icon" onClick={handleRotate} className="h-8 w-8">
                <RotateCw className="h-4 w-4" />
              </Button>
              
              {/* Download */}
              <Button variant="ghost" size="icon" onClick={handleDownload} className="h-8 w-8">
                <Download className="h-4 w-4" />
              </Button>
              
              {/* Close */}
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Document viewer */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
          {isLoading && (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Loading document...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <FileText className="h-12 w-12" />
              <span className="text-sm">{error}</span>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                Download instead
              </Button>
            </div>
          )}

          {isPdf && !error && (
            <iframe
              src={`${documentUrl}#page=${currentPage}`}
              className="w-full h-full border-0 rounded-lg bg-white"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('Failed to load PDF');
              }}
              title={documentName}
            />
          )}

          {isImage && !error && (
            <img
              src={documentUrl}
              alt={documentName}
              className={`max-w-full max-h-full object-contain rounded-lg shadow-lg ${isLoading ? 'hidden' : ''}`}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}

          {!isPdf && !isImage && !error && (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <span className="text-sm">Preview not available for this file type</span>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}
        </div>

        {/* Page navigation for PDFs */}
        {isPdf && totalPages > 1 && (
          <div className="px-4 py-2 border-t flex items-center justify-center gap-4 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DocumentPreview;
