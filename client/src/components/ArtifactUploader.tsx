import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { 
  Upload, X, FileText, Image, Mic, Video, FileSignature, 
  CheckCircle2, AlertCircle, Loader2, Plus, Tag, Building2,
  File, FileSpreadsheet, FileCode, Archive, Copy, ExternalLink,
  AlertTriangle
} from "lucide-react";

// File type detection utilities
const ARTIFACT_TYPE_MAP: Record<string, { type: string; icon: React.ReactNode; label: string }> = {
  // Documents
  'application/pdf': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'PDF Document' },
  'application/msword': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'Word Document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'Word Document' },
  'application/vnd.ms-excel': { type: 'document', icon: <FileSpreadsheet className="h-5 w-5" />, label: 'Excel Spreadsheet' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { type: 'document', icon: <FileSpreadsheet className="h-5 w-5" />, label: 'Excel Spreadsheet' },
  'application/vnd.ms-powerpoint': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'PowerPoint' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'PowerPoint' },
  'text/plain': { type: 'document', icon: <FileText className="h-5 w-5" />, label: 'Text File' },
  'text/csv': { type: 'document', icon: <FileSpreadsheet className="h-5 w-5" />, label: 'CSV File' },
  'application/json': { type: 'document', icon: <FileCode className="h-5 w-5" />, label: 'JSON File' },
  
  // Images
  'image/jpeg': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'JPEG Image' },
  'image/png': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'PNG Image' },
  'image/gif': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'GIF Image' },
  'image/webp': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'WebP Image' },
  'image/svg+xml': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'SVG Image' },
  'image/tiff': { type: 'image', icon: <Image className="h-5 w-5" />, label: 'TIFF Image' },
  
  // Audio
  'audio/mpeg': { type: 'audio', icon: <Mic className="h-5 w-5" />, label: 'MP3 Audio' },
  'audio/wav': { type: 'audio', icon: <Mic className="h-5 w-5" />, label: 'WAV Audio' },
  'audio/ogg': { type: 'audio', icon: <Mic className="h-5 w-5" />, label: 'OGG Audio' },
  'audio/webm': { type: 'audio', icon: <Mic className="h-5 w-5" />, label: 'WebM Audio' },
  'audio/mp4': { type: 'audio', icon: <Mic className="h-5 w-5" />, label: 'M4A Audio' },
  
  // Video
  'video/mp4': { type: 'video', icon: <Video className="h-5 w-5" />, label: 'MP4 Video' },
  'video/webm': { type: 'video', icon: <Video className="h-5 w-5" />, label: 'WebM Video' },
  'video/quicktime': { type: 'video', icon: <Video className="h-5 w-5" />, label: 'QuickTime Video' },
  'video/x-msvideo': { type: 'video', icon: <Video className="h-5 w-5" />, label: 'AVI Video' },
  
  // Archives
  'application/zip': { type: 'document', icon: <Archive className="h-5 w-5" />, label: 'ZIP Archive' },
  'application/x-rar-compressed': { type: 'document', icon: <Archive className="h-5 w-5" />, label: 'RAR Archive' },
};

// Get artifact type info from MIME type
function getArtifactTypeInfo(mimeType: string, fileName: string) {
  if (ARTIFACT_TYPE_MAP[mimeType]) {
    return ARTIFACT_TYPE_MAP[mimeType];
  }
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext) {
    if (['pdf'].includes(ext)) return ARTIFACT_TYPE_MAP['application/pdf'];
    if (['doc', 'docx'].includes(ext)) return ARTIFACT_TYPE_MAP['application/msword'];
    if (['xls', 'xlsx'].includes(ext)) return ARTIFACT_TYPE_MAP['application/vnd.ms-excel'];
    if (['ppt', 'pptx'].includes(ext)) return ARTIFACT_TYPE_MAP['application/vnd.ms-powerpoint'];
    if (['jpg', 'jpeg'].includes(ext)) return ARTIFACT_TYPE_MAP['image/jpeg'];
    if (['png'].includes(ext)) return ARTIFACT_TYPE_MAP['image/png'];
    if (['gif'].includes(ext)) return ARTIFACT_TYPE_MAP['image/gif'];
    if (['mp3'].includes(ext)) return ARTIFACT_TYPE_MAP['audio/mpeg'];
    if (['wav'].includes(ext)) return ARTIFACT_TYPE_MAP['audio/wav'];
    if (['mp4', 'm4v'].includes(ext)) return ARTIFACT_TYPE_MAP['video/mp4'];
    if (['mov'].includes(ext)) return ARTIFACT_TYPE_MAP['video/quicktime'];
  }
  
  return { type: 'document', icon: <File className="h-5 w-5" />, label: 'File' };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface DuplicateInfo {
  artifactId: number;
  artifactCode: string;
  name: string;
}

interface FileWithMetadata {
  file: File;
  id: string;
  name: string;
  size: number;
  mimeType: string;
  artifactType: string;
  typeLabel: string;
  icon: React.ReactNode;
  preview?: string;
  hash?: string;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'processing' | 'complete' | 'error' | 'duplicate';
  errorMessage?: string;
  artifactId?: number;
  description: string;
  tags: string[];
  duplicateInfo?: DuplicateInfo;
  skipDuplicate?: boolean;
}

interface ArtifactUploaderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: number;
  onUploadComplete?: (artifactIds: number[]) => void;
}

export function ArtifactUploader({ open, onOpenChange, projectId, onUploadComplete }: ArtifactUploaderProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'upload'>('select');
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId?.toString() || '');
  const [isDragging, setIsDragging] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch settings
  const [batchMode, setBatchMode] = useState(false);
  const [batchDescription, setBatchDescription] = useState('');
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [newBatchTag, setNewBatchTag] = useState('');

  const uploadMutation = trpc.artifacts.upload.useMutation();

  // Mock projects for selection
  const mockProjects = [
    { id: 1, name: 'MA - Gillette BTM' },
    { id: 2, name: 'NY - Saratoga CDG 1' },
    { id: 3, name: 'CT - Hartford Solar' },
  ];

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

  const addFiles = async (newFiles: File[]) => {
    const processedFiles: FileWithMetadata[] = await Promise.all(
      newFiles.map(async (file) => {
        const typeInfo = getArtifactTypeInfo(file.type, file.name);
        let preview: string | undefined;
        
        if (typeInfo.type === 'image') {
          preview = URL.createObjectURL(file);
        }
        
        // Generate hash for duplicate detection
        const hash = await generateFileHash(file);
        
        return {
          file,
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          artifactType: typeInfo.type,
          typeLabel: typeInfo.label,
          icon: typeInfo.icon,
          preview,
          hash,
          uploadProgress: 0,
          uploadStatus: 'pending' as const,
          description: '',
          tags: [],
        };
      })
    );
    
    setFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFileMetadata = (id: string, updates: Partial<FileWithMetadata>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addTagToFile = (fileId: string, tag: string) => {
    if (!tag.trim()) return;
    setFiles(prev => prev.map(f => {
      if (f.id === fileId && !f.tags.includes(tag.trim())) {
        return { ...f, tags: [...f.tags, tag.trim()] };
      }
      return f;
    }));
  };

  const removeTagFromFile = (fileId: string, tag: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id === fileId) {
        return { ...f, tags: f.tags.filter(t => t !== tag) };
      }
      return f;
    }));
  };

  const addBatchTag = (tag: string) => {
    if (!tag.trim() || batchTags.includes(tag.trim())) return;
    setBatchTags(prev => [...prev, tag.trim()]);
  };

  const removeBatchTag = (tag: string) => {
    setBatchTags(prev => prev.filter(t => t !== tag));
  };

  // Check for duplicates before proceeding to upload
  const checkDuplicates = async () => {
    setCheckingDuplicates(true);
    
    // Simulate duplicate check - in real app, this would call the backend
    // For now, we'll just mark files as checked
    for (const file of files) {
      if (file.hash) {
        // Mock duplicate detection - in production, call trpc.artifacts.checkDuplicate
        // For demo, randomly mark some files as duplicates
        const isDuplicate = Math.random() < 0.1; // 10% chance of duplicate for demo
        
        if (isDuplicate) {
          updateFileMetadata(file.id, {
            uploadStatus: 'duplicate',
            duplicateInfo: {
              artifactId: Math.floor(Math.random() * 1000),
              artifactCode: `ART-2026-${String(Math.floor(Math.random() * 10000)).padStart(5, '0')}`,
              name: file.name,
            },
          });
        }
      }
    }
    
    setCheckingDuplicates(false);
  };

  const proceedWithDuplicate = (fileId: string) => {
    updateFileMetadata(fileId, { uploadStatus: 'pending', skipDuplicate: true });
  };

  const startUpload = async () => {
    setStep('upload');
    const uploadedArtifactIds: number[] = [];

    // Apply batch settings if enabled
    const filesToUpload = files.filter(f => f.uploadStatus !== 'duplicate' || f.skipDuplicate);

    for (const fileData of filesToUpload) {
      try {
        updateFileMetadata(fileData.id, { uploadStatus: 'uploading', uploadProgress: 10 });

        const hash = fileData.hash || await generateFileHash(fileData.file);
        updateFileMetadata(fileData.id, { hash, uploadProgress: 20 });

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(fileData.file);
        
        const base64Data = await base64Promise;
        updateFileMetadata(fileData.id, { uploadProgress: 40 });

        updateFileMetadata(fileData.id, { uploadStatus: 'processing', uploadProgress: 60 });
        
        // Use batch settings if enabled, otherwise use individual file settings
        const description = batchMode ? batchDescription : fileData.description;
        const tags = batchMode ? batchTags : fileData.tags;
        
        const result = await uploadMutation.mutateAsync({
          fileName: fileData.name,
          fileData: base64Data,
          mimeType: fileData.mimeType,
          fileSize: fileData.size,
          fileHash: hash,
          artifactType: fileData.artifactType,
          projectId: selectedProjectId ? parseInt(selectedProjectId) : undefined,
          description: description || undefined,
          tags: tags.length > 0 ? tags : undefined,
        });

        updateFileMetadata(fileData.id, { 
          uploadStatus: 'complete', 
          uploadProgress: 100,
          artifactId: result.artifactId,
        });
        
        uploadedArtifactIds.push(result.artifactId);
      } catch (error) {
        updateFileMetadata(fileData.id, { 
          uploadStatus: 'error', 
          errorMessage: error instanceof Error ? error.message : 'Upload failed',
        });
      }
    }

    if (uploadedArtifactIds.length > 0 && onUploadComplete) {
      onUploadComplete(uploadedArtifactIds);
    }
  };

  const resetUploader = () => {
    files.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
    setStep('select');
    setSelectedProjectId(projectId?.toString() || '');
    setBatchMode(false);
    setBatchDescription('');
    setBatchTags([]);
  };

  const handleClose = () => {
    resetUploader();
    onOpenChange(false);
  };

  const handleContinue = async () => {
    await checkDuplicates();
    setStep('configure');
  };

  const completedCount = files.filter(f => f.uploadStatus === 'complete').length;
  const errorCount = files.filter(f => f.uploadStatus === 'error').length;
  const duplicateCount = files.filter(f => f.uploadStatus === 'duplicate' && !f.skipDuplicate).length;
  const isUploading = files.some(f => f.uploadStatus === 'uploading' || f.uploadStatus === 'processing');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Upload Artifacts'}
            {step === 'configure' && 'Configure Upload'}
            {step === 'upload' && 'Uploading...'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Drag and drop files or click to browse'}
            {step === 'configure' && 'Add metadata and assign to a project'}
            {step === 'upload' && `${completedCount} of ${files.length} files uploaded`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: File Selection */}
          {step === 'select' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="*/*"
                />
                <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-lg font-medium mb-1">
                  {isDragging ? 'Drop files here' : 'Drag & drop files'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or click to browse your computer
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supports documents, images, audio, and video files
                </p>
              </div>

              {files.length > 0 && (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {files.map((file) => (
                      <Card key={file.id} className="p-3">
                        <div className="flex items-center gap-3">
                          {file.preview ? (
                            <img 
                              src={file.preview} 
                              alt={file.name}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              {file.icon}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.typeLabel} • {formatFileSize(file.size)}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {file.artifactType}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {/* Duplicate Warning */}
                {duplicateCount > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Duplicate Files Detected</AlertTitle>
                    <AlertDescription>
                      {duplicateCount} file(s) already exist in the system. You can skip them or proceed anyway.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Project Selection */}
                <div className="space-y-2">
                  <Label>Assign to Project (Optional)</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No project</SelectItem>
                      {mockProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                {/* Batch Mode Toggle */}
                {files.length > 1 && (
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label className="text-base">Batch Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Apply the same tags and description to all files
                      </p>
                    </div>
                    <Switch checked={batchMode} onCheckedChange={setBatchMode} />
                  </div>
                )}

                {/* Batch Settings */}
                {batchMode && (
                  <Card className="p-4 border-primary/50">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Copy className="h-4 w-4" />
                        <span className="font-medium">Batch Settings (Applied to All Files)</span>
                      </div>

                      <div>
                        <Label className="text-xs">Description</Label>
                        <Textarea
                          placeholder="Add a description for all files..."
                          value={batchDescription}
                          onChange={(e) => setBatchDescription(e.target.value)}
                          className="mt-1 h-16 resize-none"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Tags</Label>
                        <div className="flex flex-wrap gap-1 mt-1 mb-2">
                          {batchTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="gap-1">
                              {tag}
                              <button
                                onClick={() => removeBatchTag(tag)}
                                className="hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add tag..."
                            value={newBatchTag}
                            onChange={(e) => setNewBatchTag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addBatchTag(newBatchTag);
                                setNewBatchTag('');
                              }
                            }}
                            className="h-8"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              addBatchTag(newBatchTag);
                              setNewBatchTag('');
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* File Metadata (Individual Mode) */}
                {!batchMode && (
                  <div className="space-y-4">
                    <Label>File Details</Label>
                    {files.map((file, index) => (
                      <Card 
                        key={file.id} 
                        className={`p-4 ${file.uploadStatus === 'duplicate' && !file.skipDuplicate ? 'border-amber-500 bg-amber-500/5' : ''}`}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          {file.preview ? (
                            <img 
                              src={file.preview} 
                              alt={file.name}
                              className="h-12 w-12 rounded object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-muted flex items-center justify-center text-muted-foreground">
                              {file.icon}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {file.typeLabel} • {formatFileSize(file.size)}
                            </p>
                          </div>
                          {file.uploadStatus === 'duplicate' && !file.skipDuplicate && (
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Duplicate
                            </Badge>
                          )}
                        </div>

                        {/* Duplicate Warning */}
                        {file.uploadStatus === 'duplicate' && !file.skipDuplicate && file.duplicateInfo && (
                          <Alert className="mb-3 border-amber-500/50 bg-amber-500/10">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <AlertDescription className="text-sm">
                              <p>This file already exists as <strong>{file.duplicateInfo.artifactCode}</strong></p>
                              <div className="flex gap-2 mt-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => proceedWithDuplicate(file.id)}
                                >
                                  Upload Anyway
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => removeFile(file.id)}
                                >
                                  Skip
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}

                        {(file.uploadStatus !== 'duplicate' || file.skipDuplicate) && (
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Textarea
                                placeholder="Add a description..."
                                value={file.description}
                                onChange={(e) => updateFileMetadata(file.id, { description: e.target.value })}
                                className="mt-1 h-16 resize-none"
                              />
                            </div>

                            <div>
                              <Label className="text-xs">Tags</Label>
                              <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                {file.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="gap-1">
                                    {tag}
                                    <button
                                      onClick={() => removeTagFromFile(file.id, tag)}
                                      className="hover:text-destructive"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Add tag..."
                                  value={index === 0 ? newTag : ''}
                                  onChange={(e) => setNewTag(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addTagToFile(file.id, newTag);
                                      setNewTag('');
                                    }
                                  }}
                                  className="h-8"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    addTagToFile(file.id, newTag);
                                    setNewTag('');
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* Step 3: Upload Progress */}
          {step === 'upload' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {files.map((file) => (
                  <Card key={file.id} className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      {file.preview ? (
                        <img 
                          src={file.preview} 
                          alt={file.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          {file.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.uploadStatus === 'pending' && 'Waiting...'}
                          {file.uploadStatus === 'uploading' && 'Uploading...'}
                          {file.uploadStatus === 'processing' && 'Processing...'}
                          {file.uploadStatus === 'complete' && 'Complete'}
                          {file.uploadStatus === 'error' && file.errorMessage}
                          {file.uploadStatus === 'duplicate' && !file.skipDuplicate && 'Skipped (duplicate)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.uploadStatus === 'pending' && (
                          <div className="h-5 w-5 rounded-full border-2 border-muted" />
                        )}
                        {(file.uploadStatus === 'uploading' || file.uploadStatus === 'processing') && (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        )}
                        {file.uploadStatus === 'complete' && (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        {file.uploadStatus === 'error' && (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        )}
                        {file.uploadStatus === 'duplicate' && !file.skipDuplicate && (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                    </div>
                    {(file.uploadStatus === 'uploading' || file.uploadStatus === 'processing') && (
                      <Progress value={file.uploadProgress} className="h-1" />
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleContinue}
                disabled={files.length === 0 || checkingDuplicates}
              >
                {checkingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  `Continue (${files.length} files)`
                )}
              </Button>
            </>
          )}
          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button 
                onClick={startUpload}
                disabled={files.filter(f => f.uploadStatus !== 'duplicate' || f.skipDuplicate).length === 0}
              >
                Upload {files.filter(f => f.uploadStatus !== 'duplicate' || f.skipDuplicate).length} {files.filter(f => f.uploadStatus !== 'duplicate' || f.skipDuplicate).length === 1 ? 'File' : 'Files'}
              </Button>
            </>
          )}
          {step === 'upload' && (
            <>
              {!isUploading && (
                <Button onClick={handleClose}>
                  {errorCount > 0 ? 'Close' : 'Done'}
                </Button>
              )}
              {isUploading && (
                <Button disabled>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArtifactUploader;
