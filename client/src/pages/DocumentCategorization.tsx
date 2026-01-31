import { useState, useCallback, useRef } from "react";
import AppLayout, { useProject } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Upload,
  FileText,
  Check,
  X,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { mockDocumentCategories, mockDocumentTypes } from "@shared/mockData";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  file: File;
  aiSuggestions: {
    category: string;
    documentType: string;
    confidence: number;
  }[];
  selectedType: number | null;
  status: "uploading" | "categorizing" | "pending" | "categorized" | "rejected" | "error";
  errorMessage?: string;
}

function DocumentCategorizationContent() {
  const { selectedProjectId } = useProject();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categorizeMutation = trpc.documents.categorizeWithAI.useMutation();
  const uploadMutation = trpc.documents.upload.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add file to list with uploading status
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        file,
        aiSuggestions: [],
        selectedType: null,
        status: "categorizing",
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
      setSelectedFile(fileId);

      try {
        // Get AI categorization suggestion
        const suggestion = await categorizeMutation.mutateAsync({
          fileName: file.name,
        });

        // Update file with AI suggestions
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId 
            ? {
                ...f,
                aiSuggestions: [{
                  category: suggestion.category,
                  documentType: suggestion.documentType,
                  confidence: suggestion.confidence,
                }],
                status: "pending" as const,
              }
            : f
        ));
      } catch (error) {
        console.error("AI categorization error:", error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, status: "pending" as const, aiSuggestions: [] }
            : f
        ));
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const confirmCategorization = async (fileId: string, documentTypeId: number) => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file || !selectedProjectId) {
      toast.error("Please select a project first");
      return;
    }

    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: "uploading" as const } : f
    ));

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        try {
          await uploadMutation.mutateAsync({
            projectId: selectedProjectId,
            documentTypeId,
            name: file.name,
            fileData: base64,
            mimeType: file.file.type || 'application/pdf',
            fileSize: file.size,
          });

          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, selectedType: documentTypeId, status: "categorized" as const }
              : f
          ));

          toast.success(`${file.name} uploaded and categorized`);
        } catch (error) {
          console.error("Upload error:", error);
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { ...f, status: "error" as const, errorMessage: "Upload failed" }
              : f
          ));
          toast.error("Failed to upload document");
        }
      };
      reader.readAsDataURL(file.file);
    } catch (error) {
      console.error("File read error:", error);
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId 
          ? { ...f, status: "error" as const, errorMessage: "Failed to read file" }
          : f
      ));
    }
  };

  const selectSuggestion = (fileId: string, typeId: number) => {
    confirmCategorization(fileId, typeId);
  };

  const selectOther = (fileId: string, typeId: string) => {
    confirmCategorization(fileId, parseInt(typeId));
  };

  const rejectFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile === fileId) {
      setSelectedFile(uploadedFiles.find(f => f.id !== fileId)?.id || null);
    }
  };

  const currentFile = uploadedFiles.find((f) => f.id === selectedFile);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pendingCount = uploadedFiles.filter((f) => f.status === "pending").length;
  const categorizedCount = uploadedFiles.filter((f) => f.status === "categorized").length;
  const processingCount = uploadedFiles.filter((f) => f.status === "uploading" || f.status === "categorizing").length;

  // Find matching document type from AI suggestion
  const findMatchingType = (suggestion: { category: string; documentType: string }) => {
    const category = mockDocumentCategories.find(c => 
      c.name.toLowerCase().includes(suggestion.category.toLowerCase()) ||
      suggestion.category.toLowerCase().includes(c.name.toLowerCase())
    );
    
    if (category) {
      const docType = mockDocumentTypes.find(t => 
        t.categoryId === category.id && (
          t.name.toLowerCase().includes(suggestion.documentType.toLowerCase()) ||
          suggestion.documentType.toLowerCase().includes(t.name.toLowerCase())
        )
      );
      return docType;
    }
    return null;
  };

  return (
    <div className="p-6 h-full">
      <div className="flex gap-6 h-full">
        {/* Left Panel - Upload Zone and File List */}
        <div className="w-96 shrink-0 flex flex-col gap-4">
          {/* Upload Zone */}
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
              />
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Drop files here</p>
                <p className="text-xs text-muted-foreground mb-3">or click to browse</p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, Images
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          <Card className="bg-card border-border flex-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Uploaded Files</CardTitle>
                <div className="flex items-center gap-2 text-xs">
                  {processingCount > 0 && (
                    <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {processingCount}
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                    {pendingCount} pending
                  </Badge>
                  <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                    {categorizedCount} done
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {uploadedFiles.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No files uploaded yet</p>
                    <p className="text-xs mt-1">Drop files above to get started</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedFile === file.id
                            ? "bg-secondary"
                            : "hover:bg-secondary/50"
                        )}
                        onClick={() => setSelectedFile(file.id)}
                      >
                        {file.status === "uploading" || file.status === "categorizing" ? (
                          <Loader2 className="w-5 h-5 shrink-0 text-primary animate-spin" />
                        ) : (
                          <FileText
                            className={cn(
                              "w-5 h-5 shrink-0",
                              file.status === "categorized"
                                ? "text-success"
                                : file.status === "error"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            )}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                            {file.status === "categorizing" && " • Analyzing..."}
                            {file.status === "uploading" && " • Uploading..."}
                          </p>
                        </div>
                        {file.status === "categorized" && (
                          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        )}
                        {file.status === "pending" && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        {file.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Categorization Interface */}
        <Card className="bg-card border-border flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              AI-Assisted Categorization
              <Badge variant="outline" className="ml-2 text-xs">
                Human QA Required
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentFile ? (
              <div className="space-y-6">
                {/* File Info */}
                <div className="bg-secondary/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-10 h-10 text-primary" />
                    <div>
                      <p className="font-medium">{currentFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(currentFile.size)}
                      </p>
                    </div>
                    {currentFile.status === "categorized" && (
                      <Badge className="ml-auto bg-success/20 text-success border-success/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified & Uploaded
                      </Badge>
                    )}
                  </div>
                </div>

                {currentFile.status === "categorizing" && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Analyzing document...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        AI is determining the document category
                      </p>
                    </div>
                  </div>
                )}

                {currentFile.status === "uploading" && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Uploading document...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Saving to secure storage
                      </p>
                    </div>
                  </div>
                )}

                {currentFile.status === "pending" && (
                  <>
                    {/* AI Suggestions */}
                    {currentFile.aiSuggestions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Sparkles className="w-3 h-3" />
                          AI Suggestion
                          <span className="text-warning">• Requires confirmation</span>
                        </p>
                        <div className="space-y-2">
                          {currentFile.aiSuggestions.map((suggestion, idx) => {
                            const matchedType = findMatchingType(suggestion);
                            
                            return (
                              <button
                                key={idx}
                                className={cn(
                                  "w-full text-left p-4 rounded-lg border transition-colors",
                                  "border-primary/50 bg-primary/5 hover:bg-primary/10"
                                )}
                                onClick={() => matchedType && selectSuggestion(currentFile.id, matchedType.id)}
                                disabled={!matchedType}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {suggestion.category} - {suggestion.documentType}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {Math.round(suggestion.confidence * 100)}% confidence
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      Click to confirm
                                    </Badge>
                                    <Check className="w-5 h-5 text-primary" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Select Other */}
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Or Select Different Category
                      </p>
                      <Select
                        onValueChange={(value) => selectOther(currentFile.id, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a document type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {mockDocumentCategories.map((category) => (
                            <div key={category.id}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                {category.name}
                              </div>
                              {mockDocumentTypes
                                .filter((t) => t.categoryId === category.id)
                                .map((docType) => (
                                  <SelectItem key={docType.id} value={docType.id.toString()}>
                                    {docType.name}
                                  </SelectItem>
                                ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-4 border-t border-border">
                      <Button
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => rejectFile(currentFile.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Remove File
                      </Button>
                    </div>
                  </>
                )}

                {currentFile.status === "categorized" && (
                  <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Document verified and uploaded</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      This document has been categorized and saved to the project.
                      It is now available in the Documents Hub.
                    </p>
                  </div>
                )}

                {currentFile.status === "error" && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Upload failed</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {currentFile.errorMessage || "An error occurred while uploading the document."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setUploadedFiles(prev => prev.map(f => 
                        f.id === currentFile.id ? { ...f, status: "pending" as const } : f
                      ))}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No file selected</p>
                  <p className="text-xs mt-1">Upload files to start categorizing</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DocumentCategorization() {
  return (
    <AppLayout>
      <DocumentCategorizationContent />
    </AppLayout>
  );
}
