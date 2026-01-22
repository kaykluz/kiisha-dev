import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileSpreadsheet, Check, AlertCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileEntry {
  id: string;
  file: File;
  name: string;
  scenarioType: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  modelId?: number;
}

interface BulkUploadDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const SCENARIO_TYPES = [
  { value: "Base", label: "Base Case" },
  { value: "Upside", label: "Upside" },
  { value: "Downside", label: "Downside" },
  { value: "Sensitivity", label: "Sensitivity Analysis" },
  { value: "Stress", label: "Stress Test" },
];

export function BulkUploadButton({ projectId, onSuccess }: { projectId: number; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        Bulk Upload
      </Button>
      <BulkUploadDialog
        projectId={projectId}
        open={open}
        onOpenChange={setOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}

export function BulkUploadDialog({ projectId, open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const bulkUploadMutation = trpc.financialModels.bulkUpload.useMutation({
    onSuccess: (data) => {
      const { summary, results } = data;
      
      // Update file statuses
      setFiles(prev => prev.map(f => {
        const result = results.find(r => r.fileName === f.file.name);
        if (result) {
          return {
            ...f,
            status: result.success ? 'success' : 'error',
            error: result.error,
            modelId: result.modelId,
          };
        }
        return f;
      }));

      if (summary.failed === 0) {
        toast.success(`Successfully uploaded ${summary.successful} financial model(s)`);
      } else {
        toast.warning(`Uploaded ${summary.successful} of ${summary.total} files. ${summary.failed} failed.`);
      }

      setIsUploading(false);
      setUploadProgress(100);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: error.message })));
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.name.match(/\.(xlsx|xlsm|xls)$/i)
    );
    
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.name.match(/\.(xlsx|xlsm|xls)$/i)
      );
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      name: file.name.replace(/\.(xlsx|xlsm|xls)$/i, ''),
      scenarioType: 'Base',
      status: 'pending',
    }));
    
    setFiles(prev => [...prev, ...entries]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Convert files to base64
    const filePromises = files.map(async (entry, index) => {
      const buffer = await entry.file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      setUploadProgress(((index + 1) / files.length) * 50); // First 50% for encoding

      return {
        name: entry.name,
        scenarioType: entry.scenarioType,
        fileBuffer: base64,
        fileName: entry.file.name,
        mimeType: entry.file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
    });

    const encodedFiles = await Promise.all(filePromises);
    setUploadProgress(50);

    // Update all files to uploading status
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })));

    // Upload all files
    bulkUploadMutation.mutate({
      projectId,
      files: encodedFiles,
    });
  };

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setUploadProgress(0);
      onOpenChange(false);
    }
  };

  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Upload Financial Models</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border",
              isUploading && "opacity-50 pointer-events-none"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop Excel files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supports .xlsx, .xlsm, .xls files
            </p>
            <Input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="bulk-file-input"
              disabled={isUploading}
            />
            <Button variant="outline" asChild disabled={isUploading}>
              <label htmlFor="bulk-file-input" className="cursor-pointer">
                Select Files
              </label>
            </Button>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{files.length} file(s) selected</span>
                {successCount > 0 && (
                  <span className="text-green-600">{successCount} uploaded</span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600">{errorCount} failed</span>
                )}
              </div>

              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {files.map((entry) => (
                  <div key={entry.id} className="p-3 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {entry.status === 'pending' && (
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      )}
                      {entry.status === 'uploading' && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {entry.status === 'success' && (
                        <Check className="h-5 w-5 text-green-600" />
                      )}
                      {entry.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={entry.name}
                        onChange={(e) => updateFile(entry.id, { name: e.target.value })}
                        placeholder="Model name"
                        className="h-8"
                        disabled={entry.status !== 'pending'}
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground truncate">
                          {entry.file.name}
                        </span>
                        {entry.error && (
                          <span className="text-xs text-red-600">{entry.error}</span>
                        )}
                      </div>
                    </div>

                    <Select
                      value={entry.scenarioType}
                      onValueChange={(value) => updateFile(entry.id, { scenarioType: value })}
                      disabled={entry.status !== 'pending'}
                    >
                      <SelectTrigger className="w-[140px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SCENARIO_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {entry.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(entry.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading and extracting metrics...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            {successCount > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={pendingCount === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
