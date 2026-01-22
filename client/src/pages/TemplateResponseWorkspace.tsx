import { useState, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  FileText, 
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Building2,
  Calendar,
  FileCheck,
  Eye,
  MessageSquare,
  History,
  Download,
  Trash2,
  Plus,
  Send,
  Sparkles,
  File,
  Image,
  FileSpreadsheet,
  X,
  Loader2,
  ExternalLink,
  MoreVertical,
  Edit,
  Copy,
  Bot,
  Wand2,
  Lightbulb,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentPreview } from "@/components/DocumentPreview";
import { AutofillFormField, useAutofillForm } from "@/components/AutofillFormField";
import { AutofillSuggestions, AutofillSuggestion } from "@/components/AutofillSuggestions";

// Type definitions
interface SubmissionFile {
  id: number;
  name: string;
  url: string;
  fileKey: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface Extraction {
  id: number;
  fieldName: string;
  fieldValue: string;
  confidence: number;
  extractedAt: string;
}

interface Comment {
  id: number;
  content: string;
  authorId: number;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
}

interface HistoryEntry {
  id: number;
  action: string;
  description: string;
  userId: number;
  userName: string;
  createdAt: string;
}

interface Submission {
  id: number;
  requirementItemId: number;
  status: "pending" | "uploaded" | "reviewing" | "approved" | "rejected";
  files: SubmissionFile[];
  extractions: Extraction[];
  comments: Comment[];
  history: HistoryEntry[];
  notes?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: number;
  reviewNotes?: string;
}

interface RequirementItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  itemType: "document" | "field" | "checklist" | "attestation";
  hasExpiry: boolean;
  isSensitive: boolean;
  required: boolean;
  evidenceRequired: boolean;
}

export default function TemplateResponseWorkspace() {
  const { id } = useParams<{ id: string }>();
  const responseId = id;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI State
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState("preview");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddRequirementDialog, setShowAddRequirementDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareRecipientName, setShareRecipientName] = useState("");
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [shareRecipientType, setShareRecipientType] = useState<"investor" | "regulator" | "partner" | "customer" | "other">("investor");
  const [shareMethod, setShareMethod] = useState<"data_room" | "email" | "portal" | "api">("data_room");
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [bulkUploadMappings, setBulkUploadMappings] = useState<Record<string, number>>({});
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState(0);
  const [aiChatMessage, setAiChatMessage] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  
  const orgId = user?.activeOrgId || 1;
  const parsedResponseId = parseInt(responseId || "0");
  
  // Autofill state management
  const [autofillValues, setAutofillValues] = useState<Record<string, string>>({});
  const [showAutofillPanel, setShowAutofillPanel] = useState(false);
  
  // Fetch template response data
  const { data: response, isLoading, refetch } = trpc.diligence.getTemplateResponse.useQuery(
    { id: parsedResponseId },
    { enabled: parsedResponseId > 0 }
  );
  
  // Fetch available requirement items for adding
  const { data: availableRequirements } = trpc.diligence.listRequirementItems.useQuery({
    organizationId: orgId,
    includeGlobal: true
  });
  
  // Mutations
  const uploadSubmissionMutation = trpc.diligence.uploadSubmission.useMutation({
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      setShowUploadDialog(false);
      setUploadedFiles([]);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const addCommentMutation = trpc.diligence.addSubmissionComment.useMutation({
    onSuccess: () => {
      toast.success("Comment added");
      setNewComment("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const reviewSubmissionMutation = trpc.diligence.reviewSubmission.useMutation({
    onSuccess: () => {
      toast.success("Submission reviewed");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const addCustomSectionMutation = trpc.diligence.addCustomSection.useMutation({
    onSuccess: () => {
      toast.success("Section added");
      setShowAddSectionDialog(false);
      setNewSectionName("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const addRequirementToResponseMutation = trpc.diligence.addRequirementToResponse.useMutation({
    onSuccess: () => {
      toast.success("Requirement added");
      setShowAddRequirementDialog(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const submitResponseMutation = trpc.diligence.submitResponse.useMutation({
    onSuccess: () => {
      toast.success("Response submitted for review");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const reviewResponseMutation = trpc.diligence.reviewResponse.useMutation({
    onSuccess: (data) => {
      toast.success(`Response ${data.status}`);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  const requestRevisionMutation = trpc.diligence.requestRevision.useMutation({
    onSuccess: () => {
      toast.success("Revision requested");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Sharing mutations
  const shareResponseMutation = trpc.diligence.shareResponse.useMutation({
    onSuccess: (data) => {
      toast.success("Response shared successfully");
      setShowShareDialog(false);
      setShareRecipientName("");
      setShareRecipientEmail("");
      refetchSharedSubmissions();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Fetch shared submissions
  const { data: sharedSubmissions, refetch: refetchSharedSubmissions } = trpc.diligence.getSharedSubmissions.useQuery(
    { responseId: parsedResponseId },
    { enabled: parsedResponseId > 0 }
  );
  
  // AI mutations
  const aiChatMutation = trpc.diligence.aiChat.useMutation();
  const aiSuggestMutation = trpc.diligence.aiSuggestCompletion.useMutation();
  const aiAnalyzeMutation = trpc.diligence.aiAnalyzeDocument.useMutation();
  
  // Toggle item expansion
  const toggleItem = (itemId: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };
  
  // Handle file upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };
  
  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const uploadFileMutation = trpc.diligence.uploadFile.useMutation();
  
  const handleUploadSubmit = async () => {
    if (!uploadingItemId || uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      // Upload each file to S3 first
      const uploadedFileData = [];
      
      for (const file of uploadedFiles) {
        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        
        // Upload to S3 via backend
        const result = await uploadFileMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: file.type,
          folder: 'diligence-submissions'
        });
        
        uploadedFileData.push({
          name: result.fileName,
          url: result.url,
          fileKey: result.fileKey,
          mimeType: result.mimeType,
          size: result.size
        });
      }
      
      // Update submission with uploaded file info
      await uploadSubmissionMutation.mutateAsync({
        responseId: parsedResponseId,
        requirementItemId: uploadingItemId,
        files: uploadedFileData
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleAddComment = () => {
    if (!selectedItem || !newComment.trim()) return;
    
    addCommentMutation.mutate({
      responseId: parsedResponseId,
      requirementItemId: selectedItem,
      content: newComment
    });
  };
  
  const handleReview = (approved: boolean, notes?: string) => {
    if (!selectedItem) return;
    
    reviewSubmissionMutation.mutate({
      responseId: parsedResponseId,
      requirementItemId: selectedItem,
      approved,
      notes
    });
  };
  
  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="h-4 w-4" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };
  
  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-500"><Eye className="h-3 w-3 mr-1" />Reviewing</Badge>;
      case "uploaded":
        return <Badge className="bg-yellow-500"><Upload className="h-3 w-3 mr-1" />Uploaded</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };
  
  // Calculate completion percentage
  const calculateCompletion = () => {
    if (!response?.submissions) return 0;
    const total = response.submissions.length;
    const completed = response.submissions.filter(s => s.status === "approved").length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  
  if (!response) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-yellow-500" />
          <h2 className="text-xl font-semibold">Response Not Found</h2>
          <p className="text-muted-foreground">The template response you're looking for doesn't exist.</p>
          <Link href="/company-hub">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Company Hub
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }
  
  // Group submissions by category
  const submissionsByCategory = (response.submissions || []).reduce((acc, sub) => {
    const category = sub.requirement?.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(sub);
    return acc;
  }, {} as Record<string, any[]>);
  
  // Get selected submission details
  const selectedSubmission = selectedItem 
    ? response.submissions?.find(s => s.requirementItemId === selectedItem)
    : null;
  
  const completionPercentage = calculateCompletion();
  
  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Left Panel - Requirements List */}
        <div className="w-1/2 border-r flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/company-hub">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex-1">
                <h1 className="text-xl font-bold">{response.template?.name || "Template Response"}</h1>
                <p className="text-sm text-muted-foreground">
                  {response.company?.legalName || "Company"}
                </p>
              </div>
              <Badge variant={response.status === "submitted" ? "default" : "outline"}>
                {response.status}
              </Badge>
            </div>
            
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2" />
            </div>
          </div>
          
          {/* Actions Bar */}
          <div className="p-3 border-b flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddSectionDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddRequirementDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Requirement
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowBulkUploadDialog(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Bulk Upload
            </Button>
            <div className="flex-1" />
            {response.status === "draft" && (
              <Button 
                size="sm" 
                disabled={completionPercentage < 100 || submitResponseMutation.isPending}
                onClick={() => submitResponseMutation.mutate({ responseId: parsedResponseId })}
              >
                {submitResponseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Submit Response
              </Button>
            )}
            {(response.status === "submitted" || response.status === "under_review") && user?.role === "admin" && (
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => requestRevisionMutation.mutate({ responseId: parsedResponseId, notes: "Please review and update" })}
                  disabled={requestRevisionMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Request Revision
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => reviewResponseMutation.mutate({ responseId: parsedResponseId, approved: false })}
                  disabled={reviewResponseMutation.isPending}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button 
                  size="sm"
                  onClick={() => reviewResponseMutation.mutate({ responseId: parsedResponseId, approved: true })}
                  disabled={reviewResponseMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            )}
            {response.status === "approved" && (
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Approved
                </Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowShareDialog(true)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            )}
            {response.status === "rejected" && (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Rejected
              </Badge>
            )}
          </div>
          
          {/* Requirements List */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {Object.entries(submissionsByCategory).map(([category, submissions]) => (
                <Card key={category}>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="h-4 w-4" />
                            <CardTitle className="text-base capitalize">
                              {category.replace(/_/g, " ")}
                            </CardTitle>
                          </div>
                          <Badge variant="secondary">{submissions.length}</Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {submissions.map((sub) => {
                            const req = sub.requirement;
                            const isExpanded = expandedItems.has(sub.requirementItemId);
                            const isSelected = selectedItem === sub.requirementItemId;
                            
                            return (
                              <div key={sub.requirementItemId}>
                                <div 
                                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                                  }`}
                                  onClick={() => {
                                    setSelectedItem(sub.requirementItemId);
                                    toggleItem(sub.requirementItemId);
                                  }}
                                >
                                  <div className={`p-2 rounded-lg ${
                                    req?.itemType === "document" ? "bg-blue-500/10 text-blue-500" :
                                    req?.itemType === "field" ? "bg-green-500/10 text-green-500" :
                                    req?.itemType === "checklist" ? "bg-purple-500/10 text-purple-500" :
                                    "bg-orange-500/10 text-orange-500"
                                  }`}>
                                    {req?.itemType === "document" ? <FileText className="h-4 w-4" /> :
                                     req?.itemType === "field" ? <FileCheck className="h-4 w-4" /> :
                                     req?.itemType === "checklist" ? <CheckCircle2 className="h-4 w-4" /> :
                                     <Shield className="h-4 w-4" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{req?.name || "Requirement"}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {req?.code}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(sub.status)}
                                    <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                  </div>
                                </div>
                                
                                {/* Expanded Content */}
                                {isExpanded && (
                                  <div className="ml-12 mt-2 p-3 bg-muted/30 rounded-lg space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                      {req?.description || "No description"}
                                    </p>
                                    
                                    {/* Files */}
                                    {sub.files?.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground">Uploaded Files</p>
                                        {sub.files.map((file: any) => (
                                          <div key={file.id} className="flex items-center gap-2 text-sm">
                                            {getFileIcon(file.mimeType)}
                                            <span className="truncate">{file.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    
                                    {/* Upload Button */}
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUploadingItemId(sub.requirementItemId);
                                        setShowUploadDialog(true);
                                      }}
                                    >
                                      <Upload className="h-3 w-3 mr-1" />
                                      {sub.files?.length > 0 ? "Upload More" : "Upload Document"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
              
              {Object.keys(submissionsByCategory).length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Requirements</h3>
                    <p className="text-muted-foreground mb-4">
                      Add requirements to start building your response.
                    </p>
                    <Button onClick={() => setShowAddRequirementDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Requirement
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Right Panel - Detail View */}
        <div className="w-1/2 flex flex-col">
          {selectedSubmission ? (
            <>
              {/* Detail Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">
                    {selectedSubmission.requirement?.name || "Requirement Details"}
                  </h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleReview(true)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleReview(false)}>
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Reject
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Notes
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedSubmission.status)}
                  {selectedSubmission.requirement?.hasExpiry && (
                    <Badge variant="outline" className="text-orange-500">
                      <Clock className="h-3 w-3 mr-1" />
                      Expires
                    </Badge>
                  )}
                  {selectedSubmission.requirement?.isSensitive && (
                    <Badge variant="outline" className="text-red-500">
                      <Shield className="h-3 w-3 mr-1" />
                      Sensitive
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Detail Tabs */}
              <Tabs value={activeDetailTab} onValueChange={setActiveDetailTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-4">
                  <TabsTrigger value="preview">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="extractions">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Extractions
                  </TabsTrigger>
                  <TabsTrigger value="ai-assist">
                    <Bot className="h-4 w-4 mr-1" />
                    AI Assist
                  </TabsTrigger>
                  <TabsTrigger value="comments">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    Comments
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History className="h-4 w-4 mr-1" />
                    History
                  </TabsTrigger>
                </TabsList>
                
                <ScrollArea className="flex-1">
                  {/* Preview Tab */}
                  <TabsContent value="preview" className="p-4 space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Description</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedSubmission.requirement?.description || "No description provided"}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Uploaded Documents</h3>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setUploadingItemId(selectedSubmission.requirementItemId);
                            setShowUploadDialog(true);
                          }}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          Upload
                        </Button>
                      </div>
                      
                      {selectedSubmission.files?.length > 0 ? (
                        <div className="space-y-2">
                          {selectedSubmission.files.map((file: any) => (
                            <div 
                              key={file.id} 
                              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="p-2 bg-muted rounded">
                                {getFileIcon(file.mimeType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB • {new Date(file.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    setPreviewDocument({
                                      url: file.url,
                                      name: file.name,
                                      mimeType: file.mimeType
                                    });
                                    setShowPreviewDialog(true);
                                  }}
                                  title="Preview"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" asChild>
                                  <a href={file.url} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="icon" asChild title="Download">
                                  <a href={file.url} download={file.name}>
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive" title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                          <Button 
                            variant="link" 
                            size="sm"
                            onClick={() => {
                              setUploadingItemId(selectedSubmission.requirementItemId);
                              setShowUploadDialog(true);
                            }}
                          >
                            Upload now
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Document Preview */}
                    {selectedSubmission.files?.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h3 className="font-medium">Document Preview</h3>
                          <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">
                                Preview not available
                              </p>
                              <Button variant="link" size="sm" asChild>
                                <a href={selectedSubmission.files[0]?.url} target="_blank" rel="noopener noreferrer">
                                  Open in new tab
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>
                  
                  {/* Extractions Tab with Autofill */}
                  <TabsContent value="extractions" className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">AI Extractions & Autofill</h3>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            // Auto-accept all high confidence extractions
                            const highConfidence = selectedSubmission.extractions?.filter(
                              (e: any) => e.confidence >= 0.80
                            ) || [];
                            highConfidence.forEach((e: any) => {
                              setAutofillValues(prev => ({
                                ...prev,
                                [e.fieldName]: e.fieldValue
                              }));
                            });
                            if (highConfidence.length > 0) {
                              toast.success(`Auto-filled ${highConfidence.length} high-confidence fields`);
                            } else {
                              toast.info("No high-confidence extractions to auto-fill");
                            }
                          }}
                        >
                          <Wand2 className="h-3 w-3 mr-1" />
                          Auto-fill High Confidence
                        </Button>
                        <Button size="sm" variant="outline" disabled>
                          <Sparkles className="h-3 w-3 mr-1" />
                          Re-extract
                        </Button>
                      </div>
                    </div>
                    
                    {selectedSubmission.extractions?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedSubmission.extractions.map((extraction: any) => {
                          const isAccepted = autofillValues[extraction.fieldName] === extraction.fieldValue;
                          const confidenceColor = extraction.confidence >= 0.80 
                            ? "bg-green-500/10 text-green-600 border-green-500/20" 
                            : extraction.confidence >= 0.60 
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : "bg-gray-500/10 text-gray-600 border-gray-500/20";
                          
                          return (
                            <div 
                              key={extraction.id} 
                              className={`p-3 border rounded-lg transition-colors ${
                                isAccepted ? "bg-green-500/5 border-green-500/30" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{extraction.fieldName}</span>
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-xs ${confidenceColor}`}>
                                    {Math.round(extraction.confidence * 100)}%
                                  </Badge>
                                  {isAccepted && (
                                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Accepted
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm mb-3 p-2 bg-muted/50 rounded">{extraction.fieldValue}</p>
                              
                              {!isAccepted && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-green-600 hover:bg-green-500/10"
                                    onClick={() => {
                                      setAutofillValues(prev => ({
                                        ...prev,
                                        [extraction.fieldName]: extraction.fieldValue
                                      }));
                                      toast.success(`Accepted: ${extraction.fieldName}`);
                                    }}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => {
                                      toast.info(`Dismissed: ${extraction.fieldName}`);
                                    }}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground"
                                    onClick={() => {
                                      toast.info(`Source: Document extraction`);
                                    }}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          No extractions available
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload a document to enable AI extraction
                        </p>
                      </div>
                    )}
                    
                    {/* Accepted Values Summary */}
                    {Object.keys(autofillValues).length > 0 && (
                      <div className="mt-4 p-3 border rounded-lg bg-green-500/5 border-green-500/20">
                        <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Accepted Values ({Object.keys(autofillValues).length})
                        </h4>
                        <div className="space-y-1">
                          {Object.entries(autofillValues).map(([field, value]) => (
                            <div key={field} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{field}:</span>
                              <span className="font-medium truncate max-w-[200px]">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* AI Assist Tab */}
                  <TabsContent value="ai-assist" className="p-4 space-y-4">
                    {/* Quick Actions */}
                    <div className="space-y-3">
                      <h3 className="font-medium flex items-center gap-2">
                        <Wand2 className="h-4 w-4" />
                        Quick Actions
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start"
                          disabled={aiSuggestMutation.isPending || !selectedSubmission.requirement}
                          onClick={async () => {
                            setIsAiLoading(true);
                            try {
                              const result = await aiSuggestMutation.mutateAsync({
                                requirementTitle: selectedSubmission.requirement?.title || "",
                                requirementDescription: selectedSubmission.requirement?.description || "",
                                companyName: response?.company?.legalName || "Company",
                                existingDocuments: selectedSubmission.files?.map((f: any) => ({ name: f.name, type: f.mimeType })) || []
                              });
                              setAiSuggestions(result);
                            } catch (e) {
                              toast.error("Failed to get suggestions");
                            }
                            setIsAiLoading(false);
                          }}
                        >
                          {aiSuggestMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Lightbulb className="h-4 w-4 mr-2" />
                          )}
                          Get Suggestions
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="justify-start"
                          disabled={aiAnalyzeMutation.isPending || !selectedSubmission.files?.length}
                          onClick={async () => {
                            if (!selectedSubmission.files?.length) return;
                            setIsAiLoading(true);
                            try {
                              const file = selectedSubmission.files[0];
                              const result = await aiAnalyzeMutation.mutateAsync({
                                documentUrl: file.url,
                                fileName: file.name,
                                mimeType: file.mimeType,
                                requirementTitle: selectedSubmission.requirement?.title || "",
                                requirementDescription: selectedSubmission.requirement?.description || ""
                              });
                              setAiAnalysis(result);
                            } catch (e) {
                              toast.error("Failed to analyze document");
                            }
                            setIsAiLoading(false);
                          }}
                        >
                          {aiAnalyzeMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <FileCheck className="h-4 w-4 mr-2" />
                          )}
                          Analyze Document
                        </Button>
                      </div>
                    </div>
                    
                    {/* AI Suggestions */}
                    {aiSuggestions && (
                      <div className="space-y-3 p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
                        <h4 className="font-medium flex items-center gap-2 text-blue-600">
                          <Lightbulb className="h-4 w-4" />
                          AI Suggestions
                        </h4>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Documents</p>
                            <ul className="text-sm space-y-1">
                              {aiSuggestions.suggestedDocuments?.map((doc: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <FileText className="h-3 w-3 mt-1 text-muted-foreground" />
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Preparation Steps</p>
                            <ol className="text-sm space-y-1 list-decimal list-inside">
                              {aiSuggestions.preparationSteps?.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Estimated time: {aiSuggestions.estimatedTime}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setAiSuggestions(null)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                    
                    {/* AI Analysis */}
                    {aiAnalysis && (
                      <div className={`space-y-3 p-4 border rounded-lg ${aiAnalysis.isCompliant ? 'bg-green-500/5 border-green-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                        <h4 className={`font-medium flex items-center gap-2 ${aiAnalysis.isCompliant ? 'text-green-600' : 'text-yellow-600'}`}>
                          {aiAnalysis.isCompliant ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          Document Analysis ({aiAnalysis.confidence}% confidence)
                        </h4>
                        {aiAnalysis.issues?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Issues Found</p>
                            <ul className="text-sm space-y-1">
                              {aiAnalysis.issues.map((issue: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-yellow-700">
                                  <AlertTriangle className="h-3 w-3 mt-1" />
                                  {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {aiAnalysis.suggestions?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Suggestions</p>
                            <ul className="text-sm space-y-1">
                              {aiAnalysis.suggestions.map((sug: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Lightbulb className="h-3 w-3 mt-1 text-muted-foreground" />
                                  {sug}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setAiAnalysis(null)}
                        >
                          <X className="h-3 w-3 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                    
                    <Separator />
                    
                    {/* AI Chat */}
                    <div className="space-y-3">
                      <h3 className="font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Ask KIISHA AI
                      </h3>
                      
                      {/* Chat History */}
                      {aiChatHistory.length > 0 && (
                        <ScrollArea className="h-48 border rounded-lg p-3">
                          <div className="space-y-3">
                            {aiChatHistory.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                      
                      {/* Chat Input */}
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Ask about this requirement..."
                          value={aiChatMessage}
                          onChange={(e) => setAiChatMessage(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && aiChatMessage.trim() && !aiChatMutation.isPending) {
                              const message = aiChatMessage.trim();
                              setAiChatMessage("");
                              setAiChatHistory(prev => [...prev, { role: 'user', content: message }]);
                              
                              try {
                                const result = await aiChatMutation.mutateAsync({
                                  message,
                                  context: {
                                    templateName: response?.template?.name,
                                    companyName: response?.company?.legalName,
                                    currentRequirement: selectedSubmission.requirement?.title,
                                    submissionStatus: selectedSubmission.status
                                  },
                                  conversationHistory: aiChatHistory
                                });
                                setAiChatHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
                              } catch (e) {
                                toast.error("Failed to get response");
                              }
                            }
                          }}
                        />
                        <Button 
                          size="icon"
                          disabled={!aiChatMessage.trim() || aiChatMutation.isPending}
                          onClick={async () => {
                            if (!aiChatMessage.trim()) return;
                            const message = aiChatMessage.trim();
                            setAiChatMessage("");
                            setAiChatHistory(prev => [...prev, { role: 'user', content: message }]);
                            
                            try {
                              const result = await aiChatMutation.mutateAsync({
                                message,
                                context: {
                                  templateName: response?.template?.name,
                                  companyName: response?.company?.legalName,
                                  currentRequirement: selectedSubmission.requirement?.title,
                                  submissionStatus: selectedSubmission.status
                                },
                                conversationHistory: aiChatHistory
                              });
                              setAiChatHistory(prev => [...prev, { role: 'assistant', content: result.response }]);
                            } catch (e) {
                              toast.error("Failed to get response");
                            }
                          }}
                        >
                          {aiChatMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      
                      {aiChatHistory.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setAiChatHistory([])}
                        >
                          Clear conversation
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                  
                  {/* Comments Tab */}
                  <TabsContent value="comments" className="p-4 space-y-4">
                    <div className="space-y-3">
                      {selectedSubmission.comments?.length > 0 ? (
                        selectedSubmission.comments.map((comment: any) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {comment.authorName?.charAt(0) || "U"}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{comment.authorName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          No comments yet
                        </div>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                      />
                      <Button 
                        size="icon" 
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>
                  
                  {/* History Tab */}
                  <TabsContent value="history" className="p-4 space-y-4">
                    {selectedSubmission.history?.length > 0 ? (
                      <div className="space-y-3">
                        {selectedSubmission.history.map((entry: any) => (
                          <div key={entry.id} className="flex gap-3">
                            <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">{entry.action}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{entry.description}</p>
                              <p className="text-xs text-muted-foreground">by {entry.userName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        No history available
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Requirement</h3>
                <p className="text-muted-foreground">
                  Click on a requirement to view details, upload documents, and manage submissions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload supporting documents for this requirement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, images, Word, Excel (max 10MB each)
              </p>
            </div>
            
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                    <div className="flex items-center gap-2">
                      <File className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowUploadDialog(false);
              setUploadedFiles([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUploadSubmit}
              disabled={uploadedFiles.length === 0 || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Section</DialogTitle>
            <DialogDescription>
              Create a new section to organize additional requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Section Name</Label>
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Additional Documents, Custom Requirements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                addCustomSectionMutation.mutate({
                  responseId: parsedResponseId,
                  sectionName: newSectionName
                });
              }}
              disabled={!newSectionName.trim() || addCustomSectionMutation.isPending}
            >
              {addCustomSectionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Add Requirement Dialog */}
      <Dialog open={showAddRequirementDialog} onOpenChange={setShowAddRequirementDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Requirement</DialogTitle>
            <DialogDescription>
              Select a requirement from the catalog to add to this response.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory || ""} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(availableRequirements?.map(r => r.category) || [])).map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedCategory && (
              <ScrollArea className="h-64 border rounded-lg p-2">
                <div className="space-y-2">
                  {availableRequirements
                    ?.filter(r => r.category === selectedCategory)
                    .map(req => (
                      <div 
                        key={req.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          addRequirementToResponseMutation.mutate({
                            responseId: parsedResponseId,
                            requirementItemId: req.id
                          });
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            req.requirementType === "document" ? "bg-blue-500/10 text-blue-500" :
                            req.requirementType === "field" ? "bg-green-500/10 text-green-500" :
                            "bg-purple-500/10 text-purple-500"
                          }`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium">{req.title}</p>
                            <p className="text-xs text-muted-foreground">{req.code}</p>
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRequirementDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Response Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Response</DialogTitle>
            <DialogDescription>
              Share this approved response with external parties. A snapshot of the current data will be locked and shared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient Type</Label>
              <Select value={shareRecipientType} onValueChange={(v) => setShareRecipientType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investor">Investor</SelectItem>
                  <SelectItem value="regulator">Regulator</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient Name</Label>
              <Input 
                placeholder="Enter recipient name"
                value={shareRecipientName}
                onChange={(e) => setShareRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Recipient Email (optional)</Label>
              <Input 
                type="email"
                placeholder="Enter recipient email"
                value={shareRecipientEmail}
                onChange={(e) => setShareRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Share Method</Label>
              <Select value={shareMethod} onValueChange={(v) => setShareMethod(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="data_room">Data Room</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="portal">Portal</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Shared Submissions List */}
            {sharedSubmissions && sharedSubmissions.length > 0 && (
              <div className="space-y-2">
                <Label>Previously Shared With</Label>
                <div className="border rounded-lg divide-y max-h-32 overflow-auto">
                  {sharedSubmissions.map((share: any) => (
                    <div key={share.id} className="p-2 text-sm flex items-center justify-between">
                      <div>
                        <span className="font-medium">{share.recipientName}</span>
                        <span className="text-muted-foreground ml-2">({share.recipientType})</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {share.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                shareResponseMutation.mutate({
                  responseId: parsedResponseId,
                  recipientType: shareRecipientType,
                  recipientName: shareRecipientName,
                  recipientEmail: shareRecipientEmail || undefined,
                  shareMethod: shareMethod
                });
              }}
              disabled={!shareRecipientName.trim() || shareResponseMutation.isPending}
            >
              {shareResponseMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Share Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Upload Dialog */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Document Upload</DialogTitle>
            <DialogDescription>
              Upload multiple documents at once. Files will be auto-matched to requirements based on filename.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 py-4">
            {/* Drop Zone */}
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg';
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  setBulkUploadFiles(prev => [...prev, ...files]);
                  
                  // Auto-match files to requirements
                  const newMappings = { ...bulkUploadMappings };
                  files.forEach(file => {
                    const fileName = file.name.toLowerCase();
                    const matchedSubmission = response?.submissions?.find(sub => {
                      const reqName = sub.requirement?.title?.toLowerCase() || '';
                      const reqCode = sub.requirement?.code?.toLowerCase() || '';
                      return fileName.includes(reqName.split(' ')[0]) || 
                             fileName.includes(reqCode.replace(/_/g, ''));
                    });
                    if (matchedSubmission) {
                      newMappings[file.name] = matchedSubmission.requirementItemId;
                    }
                  });
                  setBulkUploadMappings(newMappings);
                };
                input.click();
              }}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drop files here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports PDF, Word, Excel, and image files (max 10MB each)
              </p>
            </div>
            
            {/* File List with Mappings */}
            {bulkUploadFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Files to Upload ({bulkUploadFiles.length})</Label>
                <ScrollArea className="h-64 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {bulkUploadFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <div className="w-48">
                          <Select 
                            value={bulkUploadMappings[file.name]?.toString() || ""}
                            onValueChange={(v) => setBulkUploadMappings(prev => ({ ...prev, [file.name]: parseInt(v) }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select requirement" />
                            </SelectTrigger>
                            <SelectContent>
                              {response?.submissions?.map(sub => (
                                <SelectItem key={sub.requirementItemId} value={sub.requirementItemId.toString()}>
                                  {sub.requirement?.title || `Requirement ${sub.requirementItemId}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setBulkUploadFiles(prev => prev.filter((_, i) => i !== index));
                            const newMappings = { ...bulkUploadMappings };
                            delete newMappings[file.name];
                            setBulkUploadMappings(newMappings);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Upload Progress */}
            {isBulkUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{bulkUploadProgress}%</span>
                </div>
                <Progress value={bulkUploadProgress} className="h-2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkUploadDialog(false);
                setBulkUploadFiles([]);
                setBulkUploadMappings({});
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (bulkUploadFiles.length === 0) return;
                
                setIsBulkUploading(true);
                setBulkUploadProgress(0);
                
                const totalFiles = bulkUploadFiles.length;
                let uploadedCount = 0;
                
                for (const file of bulkUploadFiles) {
                  const requirementItemId = bulkUploadMappings[file.name];
                  if (!requirementItemId) continue;
                  
                  try {
                    // Convert file to base64
                    const reader = new FileReader();
                    const base64 = await new Promise<string>((resolve) => {
                      reader.onload = () => resolve((reader.result as string).split(',')[1]);
                      reader.readAsDataURL(file);
                    });
                    
                    // Upload to S3
                    const uploadResult = await uploadFileMutation.mutateAsync({
                      fileName: file.name,
                      fileData: base64,
                      mimeType: file.type || 'application/octet-stream'
                    });
                    
                    // Link to submission
                    await uploadSubmissionMutation.mutateAsync({
                      submissionId: response?.submissions?.find(s => s.requirementItemId === requirementItemId)?.id || 0,
                      documentUrl: uploadResult.url,
                      fileName: file.name,
                      fileSize: file.size,
                      mimeType: file.type
                    });
                    
                    uploadedCount++;
                    setBulkUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
                  } catch (error) {
                    console.error(`Failed to upload ${file.name}:`, error);
                  }
                }
                
                setIsBulkUploading(false);
                setShowBulkUploadDialog(false);
                setBulkUploadFiles([]);
                setBulkUploadMappings({});
                toast.success(`Uploaded ${uploadedCount} of ${totalFiles} files`);
                refetch();
              }}
              disabled={bulkUploadFiles.length === 0 || Object.keys(bulkUploadMappings).length === 0 || isBulkUploading}
            >
              {isBulkUploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Upload {Object.keys(bulkUploadMappings).length} Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Dialog */}
      <DocumentPreview
        isOpen={showPreviewDialog}
        onClose={() => {
          setShowPreviewDialog(false);
          setPreviewDocument(null);
        }}
        documentUrl={previewDocument?.url || ""}
        documentName={previewDocument?.name || ""}
        mimeType={previewDocument?.mimeType}
      />
    </AppLayout>
  );
}
