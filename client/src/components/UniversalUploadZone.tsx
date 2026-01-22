import { useState, useCallback } from 'react';
import { Upload, FileText, Image, Music, Video, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  extractedPreview?: string;
}

interface UniversalUploadZoneProps {
  projectId?: number;
  onUploadComplete?: (files: UploadedFile[]) => void;
  compact?: boolean;
}

const FILE_TYPE_MAP: Record<string, 'pdf' | 'docx' | 'xlsx' | 'image' | 'audio' | 'video' | 'other'> = {
  'application/pdf': 'pdf',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'audio/mpeg': 'audio',
  'audio/wav': 'audio',
  'audio/ogg': 'audio',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.startsWith('audio/')) return Music;
  if (type.startsWith('video/')) return Video;
  if (type.includes('pdf')) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function UniversalUploadZone({ projectId, onUploadComplete, compact = false }: UniversalUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  
  const uploadMutation = trpc.ingestion.upload.useMutation();
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const processFile = async (file: File, fileId: string) => {
    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'uploading' as const, progress: 10 } : f
    ));
    
    try {
      // Read file as base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data URL prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, progress: 50 } : f
      ));
      
      // Upload to server
      const fileType = FILE_TYPE_MAP[file.type] || 'other';
      await uploadMutation.mutateAsync({
        projectId,
        filename: file.name,
        fileType,
        mimeType: file.type,
        fileSize: file.size,
        base64Data,
      });
      
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'completed' as const, progress: 100 } : f
      ));
      
      toast.success(`${file.name} uploaded successfully`);
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'failed' as const, error: String(error) } : f
      ));
      toast.error(`Failed to upload ${file.name}`);
    }
  };
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = droppedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
      progress: 0,
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Process each file
    for (let i = 0; i < droppedFiles.length; i++) {
      await processFile(droppedFiles[i], newFiles[i].id);
    }
    
    onUploadComplete?.(newFiles);
  }, [projectId, onUploadComplete]);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selectedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'uploading' as const,
      progress: 0,
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Process each file
    for (let i = 0; i < selectedFiles.length; i++) {
      await processFile(selectedFiles[i], newFiles[i].id);
    }
    
    onUploadComplete?.(newFiles);
  };
  
  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  };
  
  if (compact) {
    return (
      <div className="relative">
        <label
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors ${
            isDragging 
              ? 'border-accent bg-accent/10' 
              : 'border-border/50 hover:border-accent/50 hover:bg-accent/5'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Drop files or click to upload</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4,.webm"
          />
        </label>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`relative rounded-xl border-2 border-dashed p-8 transition-all ${
          isDragging 
            ? 'border-accent bg-accent/10 scale-[1.02]' 
            : 'border-border/50 hover:border-accent/50 hover:bg-card/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-accent/20' : 'bg-muted'}`}>
            <Upload className={`h-8 w-8 ${isDragging ? 'text-accent' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Drop any file</h3>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, Word, Excel, Images, Audio, Video
            </p>
          </div>
          <label className="cursor-pointer">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Browse Files
              </span>
            </Button>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp3,.wav,.mp4,.webm"
            />
          </label>
        </div>
      </div>
      
      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
            {files.some(f => f.status === 'completed') && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                Clear completed
              </Button>
            )}
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map(file => {
              const FileIcon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
                >
                  <div className="p-2 rounded-lg bg-muted">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="h-1 mt-2" />
                    )}
                    
                    {file.status === 'processing' && (
                      <div className="flex items-center gap-2 mt-1">
                        <Loader2 className="h-3 w-3 animate-spin text-accent" />
                        <span className="text-xs text-muted-foreground">Processing...</span>
                      </div>
                    )}
                    
                    {file.status === 'failed' && file.error && (
                      <span className="text-xs text-destructive">{file.error}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                    {file.status === 'failed' && (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
