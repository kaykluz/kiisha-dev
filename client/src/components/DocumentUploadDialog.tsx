import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Upload, FileText, X, CheckCircle2, Clock } from "lucide-react";
import { JobStatusBadge } from "@/components/JobStatus";
import { cn } from "@/lib/utils";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
  documentTypeId?: number;
  onSuccess?: () => void;
}

const DOCUMENT_CATEGORIES = [
  { value: "site_real_estate", label: "Site & Real Estate" },
  { value: "permits", label: "Permits & Approvals" },
  { value: "interconnection", label: "Interconnection" },
  { value: "technical", label: "Technical" },
  { value: "environmental", label: "Environmental" },
  { value: "financial", label: "Financial" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
];

interface FileWithPreview {
  file: File;
  preview?: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
  jobId?: number;
  correlationId?: string;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  projectId,
  documentTypeId,
  onSuccess,
}: DocumentUploadDialogProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(projectId);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: projects } = trpc.projects.list.useQuery();

  const uploadMutation = trpc.artifacts.upload.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully");
    },
    onError: (error) => {
      toast.error("Failed to upload document", {
        description: error.message,
      });
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const fileWithPreviews: FileWithPreview[] = newFiles.map((file) => ({
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      uploading: false,
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...fileWithPreviews]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const resetForm = () => {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setCategory("");
    setNotes("");
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const fileItem = files[i];
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, uploading: true } : f))
        );

        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(fileItem.file);
        });

        // Calculate file hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', await fileItem.file.arrayBuffer());
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Determine artifact type from MIME type
        let artifactType = 'document';
        if (fileItem.file.type.startsWith('image/')) artifactType = 'image';
        else if (fileItem.file.type.startsWith('audio/')) artifactType = 'audio';
        else if (fileItem.file.type.startsWith('video/')) artifactType = 'video';
        else if (fileItem.file.type === 'application/pdf') artifactType = 'document';
        else if (fileItem.file.type.includes('spreadsheet') || fileItem.file.type.includes('excel')) artifactType = 'spreadsheet';

        const result = await uploadMutation.mutateAsync({
          fileName: fileItem.file.name,
          fileData: base64,
          mimeType: fileItem.file.type,
          fileSize: fileItem.file.size,
          fileHash,
          artifactType,
          projectId: selectedProjectId,
          description: notes || undefined,
          tags: category ? [category] : [],
        });

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { 
              ...f, 
              uploading: false, 
              uploaded: true,
              jobId: result.jobId ?? undefined,
              correlationId: result.correlationId,
            } : f
          )
        );
      }

      toast.success(`${files.length} document(s) uploaded successfully`);
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return "🖼️";
    if (file.type === "application/pdf") return "📄";
    if (file.type.includes("spreadsheet") || file.type.includes("excel")) return "📊";
    if (file.type.includes("document") || file.type.includes("word")) return "📝";
    return "📎";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload one or more documents to the project repository.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Project *</Label>
            <Select
              value={selectedProjectId?.toString() || ""}
              onValueChange={(v) => setSelectedProjectId(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragging
                ? "border-[var(--color-brand)] bg-[var(--color-brand-muted)]"
                : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-tertiary)]" />
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              Drag and drop files here, or{" "}
              <label className="text-[var(--color-brand)] cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                />
              </label>
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Supports PDF, Word, Excel, and images up to 50MB
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((fileItem, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    fileItem.uploaded
                      ? "bg-[var(--color-success-muted)] border-[var(--color-success)]"
                      : "bg-[var(--color-bg-surface)] border-[var(--color-border-subtle)]"
                  )}
                >
                  <span className="text-2xl">{getFileIcon(fileItem.file)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {fileItem.file.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {formatFileSize(fileItem.file.size)}
                    </p>
                  </div>
                  {fileItem.uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-brand)]" />
                  ) : fileItem.uploaded ? (
                    <div className="flex items-center gap-2">
                      {fileItem.jobId ? (
                        <JobStatusBadge jobId={fileItem.jobId} />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-[var(--color-success)]" />
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Category & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about these documents..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
          >
            {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Upload {files.length > 0 ? `(${files.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
