import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Upload,
  RefreshCw,
  FileText,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Filter,
  X,
  File,
  Loader2
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function RenewalWorkflow() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedExpiry, setSelectedExpiry] = useState<any>(null);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState<any>(null);
  
  // Renewal form state
  const [renewalForm, setRenewalForm] = useState({
    newIssuedAt: "",
    newExpiresAt: "",
    notes: ""
  });
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; key: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Review form state
  const [reviewForm, setReviewForm] = useState({
    approved: true,
    reviewNotes: "",
    rejectionReason: ""
  });
  
  const orgId = user?.activeOrgId || 1;
  
  // Fetch expiring items
  const { data: expiringItems, isLoading: loadingExpiring, refetch: refetchExpiring } = 
    trpc.diligence.listExpiryRecords.useQuery({
      organizationId: orgId,
      status: statusFilter !== "all" ? statusFilter as any : undefined
    });
  
  // Fetch pending renewals
  const { data: pendingRenewals, refetch: refetchRenewals } = 
    trpc.diligence.listRenewals.useQuery({
      status: "submitted"
    });
  
  // Submit renewal mutation
  const submitRenewalMutation = trpc.diligence.submitRenewal.useMutation({
    onSuccess: () => {
      toast.success("Renewal submitted for review");
      setShowRenewalDialog(false);
      setSelectedExpiry(null);
      setRenewalForm({ newIssuedAt: "", newExpiresAt: "", notes: "" });
      refetchExpiring();
      refetchRenewals();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // Review renewal mutation
  const reviewRenewalMutation = trpc.diligence.reviewRenewal.useMutation({
    onSuccess: () => {
      toast.success(reviewForm.approved ? "Renewal approved" : "Renewal rejected");
      setShowReviewDialog(false);
      setSelectedRenewal(null);
      setReviewForm({ approved: true, reviewNotes: "", rejectionReason: "" });
      refetchExpiring();
      refetchRenewals();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });
  
  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const newFiles: Array<{ name: string; url: string; key: string }> = [];
    
    try {
      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
          toast.error(`Invalid file type: ${file.name}. Allowed: PDF, images, Word docs`);
          continue;
        }
        
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File too large: ${file.name}. Max 10MB`);
          continue;
        }
        
        // Convert to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Upload via tRPC
        const result = await uploadFileMutation.mutateAsync({
          filename: file.name,
          mimeType: file.type,
          base64Data: base64
        });
        
        newFiles.push({
          name: file.name,
          url: result.url,
          key: result.fileKey
        });
      }
      
      setUploadedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} file(s) uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload files");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const removeUploadedFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Upload file mutation
  const uploadFileMutation = trpc.ingestion.upload.useMutation();
  
  const handleSubmitRenewal = () => {
    if (!selectedExpiry) return;
    submitRenewalMutation.mutate({
      expiryRecordId: selectedExpiry.id,
      newIssuedAt: renewalForm.newIssuedAt ? new Date(renewalForm.newIssuedAt) : undefined,
      newExpiresAt: renewalForm.newExpiresAt ? new Date(renewalForm.newExpiresAt) : undefined,
      documentUrls: uploadedFiles.map(f => f.url),
      documentKeys: uploadedFiles.map(f => f.key)
    });
  };
  
  const handleReviewRenewal = () => {
    if (!selectedRenewal) return;
    reviewRenewalMutation.mutate({
      renewalId: selectedRenewal.id,
      approved: reviewForm.approved,
      reviewNotes: reviewForm.reviewNotes,
      rejectionReason: reviewForm.rejectionReason
    });
  };
  
  const openRenewalDialog = (expiry: any) => {
    setSelectedExpiry(expiry);
    setShowRenewalDialog(true);
  };
  
  const openReviewDialog = (renewal: any) => {
    setSelectedRenewal(renewal);
    setShowReviewDialog(true);
  };
  
  // Group expiring items by status
  const overdueItems = expiringItems?.filter(e => e.status === "overdue") || [];
  const dueSoonItems = expiringItems?.filter(e => e.status === "due_soon" || e.status === "due_now") || [];
  const pendingReviewItems = expiringItems?.filter(e => e.status === "renewed_pending_review") || [];
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "due_now":
        return <Badge variant="destructive">Due Now</Badge>;
      case "due_soon":
        return <Badge className="bg-amber-500">Due Soon</Badge>;
      case "renewed_pending_review":
        return <Badge variant="outline" className="bg-blue-500/10">Pending Review</Badge>;
      case "renewed_approved":
        return <Badge className="bg-green-500">Renewed</Badge>;
      case "valid":
        return <Badge variant="outline" className="bg-green-500/10">Valid</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  if (loadingExpiring) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            Renewal Workflow
          </h1>
          <p className="text-muted-foreground">
            Manage document renewals and approvals
          </p>
        </div>
        <Button variant="outline" onClick={() => { refetchExpiring(); refetchRenewals(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-red-500">{overdueItems.length}</p>
              </div>
              <AlertTriangle className="h-10 w-10 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Soon</p>
                <p className="text-3xl font-bold text-amber-500">{dueSoonItems.length}</p>
              </div>
              <Clock className="h-10 w-10 text-amber-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-3xl font-bold text-blue-500">{pendingReviewItems.length}</p>
              </div>
              <Eye className="h-10 w-10 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expirable</p>
                <p className="text-3xl font-bold">{expiringItems?.length || 0}</p>
              </div>
              <FileText className="h-10 w-10 text-muted-foreground opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Renewals ({overdueItems.length + dueSoonItems.length})
            </TabsTrigger>
            <TabsTrigger value="review">
              Awaiting Review ({pendingRenewals?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="all">
              All Items
            </TabsTrigger>
          </TabsList>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="due_soon">Due Soon</SelectItem>
              <SelectItem value="due_now">Due Now</SelectItem>
              <SelectItem value="renewed_pending_review">Pending Review</SelectItem>
              <SelectItem value="valid">Valid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Pending Renewals Tab */}
        <TabsContent value="pending" className="space-y-4">
          {overdueItems.length === 0 && dueSoonItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No items requiring renewal at this time</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Overdue Section */}
              {overdueItems.length > 0 && (
                <Card className="border-red-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                      <AlertTriangle className="h-5 w-5" />
                      Overdue Items
                    </CardTitle>
                    <CardDescription>These items have passed their expiry date</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overdueItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-red-500/20 rounded-full">
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                            <div>
                              <p className="font-medium">{item.requirement?.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Expired: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "N/A"}
                              </p>
                            </div>
                          </div>
                          <Button onClick={() => openRenewalDialog(item)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Submit Renewal
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Due Soon Section */}
              {dueSoonItems.length > 0 && (
                <Card className="border-amber-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-500">
                      <Clock className="h-5 w-5" />
                      Due Soon
                    </CardTitle>
                    <CardDescription>These items will expire soon</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {dueSoonItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-4 bg-amber-500/5 rounded-lg border border-amber-500/20"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-amber-500/20 rounded-full">
                              <Clock className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="font-medium">{item.requirement?.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Expires: {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : "N/A"}
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" onClick={() => openRenewalDialog(item)}>
                            <Upload className="h-4 w-4 mr-2" />
                            Submit Renewal
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
        
        {/* Awaiting Review Tab */}
        <TabsContent value="review" className="space-y-4">
          {!pendingRenewals || pendingRenewals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No pending reviews</h3>
                <p className="text-muted-foreground">All renewals have been processed</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Renewals Awaiting Review
                </CardTitle>
                <CardDescription>Review and approve or reject submitted renewals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRenewals.map((renewal) => (
                    <div 
                      key={renewal.id} 
                      className="flex items-center justify-between p-4 bg-blue-500/5 rounded-lg border border-blue-500/20"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-blue-500/20 rounded-full">
                          <FileText className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium">Renewal #{renewal.id}</p>
                          <p className="text-sm text-muted-foreground">
                            Submitted: {renewal.submittedAt ? new Date(renewal.submittedAt).toLocaleDateString() : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-500/10">Pending Review</Badge>
                        <Button onClick={() => openReviewDialog(renewal)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Review
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* All Items Tab */}
        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Expiry Records</CardTitle>
              <CardDescription>Complete list of tracked expirable items</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringItems?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>No expiry records found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {expiringItems?.map((item) => (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-full">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{item.requirement?.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.expiresAt 
                              ? `Expires: ${new Date(item.expiresAt).toLocaleDateString()}`
                              : "No expiry date"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        {(item.status === "overdue" || item.status === "due_soon" || item.status === "due_now") && (
                          <Button size="sm" variant="outline" onClick={() => openRenewalDialog(item)}>
                            <Upload className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Submit Renewal Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Renewal</DialogTitle>
            <DialogDescription>
              Upload new documentation for: {selectedExpiry?.requirement?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>New Issue Date</Label>
              <Input
                type="date"
                value={renewalForm.newIssuedAt}
                onChange={(e) => setRenewalForm({ ...renewalForm, newIssuedAt: e.target.value })}
              />
            </div>
            <div>
              <Label>New Expiry Date</Label>
              <Input
                type="date"
                value={renewalForm.newExpiresAt}
                onChange={(e) => setRenewalForm({ ...renewalForm, newExpiresAt: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={renewalForm.notes}
                onChange={(e) => setRenewalForm({ ...renewalForm, notes: e.target.value })}
                placeholder="Any additional notes about this renewal..."
              />
            </div>
            {/* File Upload Section */}
            <div>
              <Label>Supporting Documents</Label>
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {isUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, images, Word docs (max 10MB each)
                    </p>
                  </>
                )}
              </div>
              
              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUploadedFile(index);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewalDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitRenewal}
              disabled={submitRenewalMutation.isPending}
            >
              {submitRenewalMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Submit for Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Review Renewal Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Renewal</DialogTitle>
            <DialogDescription>
              Review and approve or reject this renewal submission
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedRenewal && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Renewal ID</span>
                  <span className="font-medium">#{selectedRenewal.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Submitted</span>
                  <span className="font-medium">
                    {selectedRenewal.submittedAt 
                      ? new Date(selectedRenewal.submittedAt).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                {selectedRenewal.newExpiresAt && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">New Expiry</span>
                    <span className="font-medium">
                      {new Date(selectedRenewal.newExpiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-4">
              <Button
                variant={reviewForm.approved ? "default" : "outline"}
                className="flex-1"
                onClick={() => setReviewForm({ ...reviewForm, approved: true })}
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant={!reviewForm.approved ? "destructive" : "outline"}
                className="flex-1"
                onClick={() => setReviewForm({ ...reviewForm, approved: false })}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
            
            <div>
              <Label>Review Notes</Label>
              <Textarea
                value={reviewForm.reviewNotes}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })}
                placeholder="Add any notes about this review..."
              />
            </div>
            
            {!reviewForm.approved && (
              <div>
                <Label>Rejection Reason</Label>
                <Textarea
                  value={reviewForm.rejectionReason}
                  onChange={(e) => setReviewForm({ ...reviewForm, rejectionReason: e.target.value })}
                  placeholder="Explain why this renewal is being rejected..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReviewRenewal}
              disabled={reviewRenewalMutation.isPending}
              variant={reviewForm.approved ? "default" : "destructive"}
            >
              {reviewRenewalMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : reviewForm.approved ? (
                <ThumbsUp className="h-4 w-4 mr-2" />
              ) : (
                <ThumbsDown className="h-4 w-4 mr-2" />
              )}
              {reviewForm.approved ? "Approve Renewal" : "Reject Renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
}
