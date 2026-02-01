/**
 * Portal New Work Order Page
 * 
 * Form for submitting new service requests/work orders with file upload support.
 */

import { useState, useEffect, useRef } from 'react';
import { usePortalReadOnly } from './PortalLayout';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Send, Wrench, AlertTriangle, Upload, X, FileText, Image, File } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Maximum number of files
const MAX_FILES = 5;
// Allowed file types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

interface UploadedFile {
  file: File;
  preview?: string;
  uploading: boolean;
  uploadedUrl?: string;
  error?: string;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (type === 'application/pdf') return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalNewWorkOrder() {
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<string>('medium');
  const [preferredDate, setPreferredDate] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  
  // Get token from localStorage (matches the key used in PortalLogin)
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  
  const { isReadOnly } = usePortalReadOnly();
  
  // Redirect if not authenticated or if company user (read-only)
  useEffect(() => {
    if (!token) {
      navigate('/portal/login');
    }
    // Company users cannot create work orders
    if (isReadOnly) {
      navigate('/portal/work-orders');
    }
  }, [token, navigate, isReadOnly]);
  
  // Cleanup file previews on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  }, [files]);
  
  // File upload mutation
  const uploadMutation = trpc.customerPortal.uploadWorkOrderFile.useMutation();
  
  // Create work order mutation
  const createMutation = trpc.customerPortal.createWorkOrder.useMutation({
    onSuccess: (data) => {
      toast.success('Work order submitted successfully!');
      navigate(`/portal/work-orders/${data.workOrderId}`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to submit work order');
    },
  });
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate file count
    if (files.length + selectedFiles.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }
    
    // Process each file
    const newFiles: UploadedFile[] = [];
    
    for (const file of selectedFiles) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: File type not allowed`);
        continue;
      }
      
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      
      // Create preview for images
      let preview: string | undefined;
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file);
      }
      
      newFiles.push({
        file,
        preview,
        uploading: true,
      });
    }
    
    // Add files to state
    setFiles(prev => [...prev, ...newFiles]);
    
    // Upload each file
    for (let i = 0; i < newFiles.length; i++) {
      const fileData = newFiles[i];
      try {
        // Convert file to base64
        const base64 = await fileToBase64(fileData.file);
        
        // Upload via tRPC
        const result = await uploadMutation.mutateAsync({
          token: token || '',
          filename: fileData.file.name,
          mimeType: fileData.file.type,
          data: base64,
        });
        
        // Update file state with uploaded URL
        setFiles(prev => prev.map(f => 
          f.file === fileData.file 
            ? { ...f, uploading: false, uploadedUrl: result.url }
            : f
        ));
      } catch (error) {
        // Update file state with error
        setFiles(prev => prev.map(f => 
          f.file === fileData.file 
            ? { ...f, uploading: false, error: 'Upload failed' }
            : f
        ));
        toast.error(`Failed to upload ${fileData.file.name}`);
      }
    }
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const removeFile = (file: File) => {
    setFiles(prev => {
      const removed = prev.find(f => f.file === file);
      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter(f => f.file !== file);
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      toast.error('Please log in to submit a work order');
      return;
    }
    
    if (!title.trim() || title.length < 5) {
      toast.error('Title must be at least 5 characters');
      return;
    }
    
    if (!description.trim() || description.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    
    if (!category) {
      toast.error('Please select a category');
      return;
    }
    
    // Check if any files are still uploading
    if (files.some(f => f.uploading)) {
      toast.error('Please wait for file uploads to complete');
      return;
    }
    
    // Get successfully uploaded file URLs
    const attachmentUrls = files
      .filter(f => f.uploadedUrl && !f.error)
      .map(f => f.uploadedUrl!);
    
    createMutation.mutate({
      token,
      title: title.trim(),
      description: description.trim(),
      category: category as any,
      priority: priority as any,
      preferredDate: preferredDate || undefined,
      contactPhone: contactPhone || undefined,
      contactEmail: contactEmail || undefined,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
    });
  };
  
  if (!token) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4">
          <Button variant="ghost" onClick={() => navigate('/portal/work-orders')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Work Orders
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wrench className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">New Service Request</h1>
              <p className="text-muted-foreground">Submit a work order for maintenance, repairs, or support</p>
            </div>
          </div>
        </div>
      </header>
      
      <div className="container py-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>
                Provide details about your service request. Our team will review and respond promptly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief summary of your request"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">{title.length}/200 characters</p>
              </div>
              
              {/* Category & Priority */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="installation">Installation</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about your request, including any relevant context, symptoms, or specific requirements..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  maxLength={5000}
                />
                <p className="text-xs text-muted-foreground">{description.length}/5000 characters</p>
              </div>
              
              {/* File Upload */}
              <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Upload photos, documents, or other files related to your request (max {MAX_FILES} files, 10MB each)
                </p>
                
                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {files.map((f, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          f.error ? 'border-destructive bg-destructive/5' : 'bg-muted/50'
                        }`}
                      >
                        {f.preview ? (
                          <img 
                            src={f.preview} 
                            alt={f.file.name}
                            className="h-10 w-10 object-cover rounded"
                          />
                        ) : (
                          <div className="h-10 w-10 flex items-center justify-center bg-muted rounded">
                            {getFileIcon(f.file.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(f.file.size)}
                            {f.uploading && ' • Uploading...'}
                            {f.uploadedUrl && ' • Uploaded'}
                            {f.error && ` • ${f.error}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(f.file)}
                          disabled={f.uploading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload button */}
                {files.length < MAX_FILES && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ALLOWED_TYPES.join(',')}
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Files
                    </Button>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Supported: Images (JPG, PNG, GIF, WebP), PDF, Word documents, Text files
                </p>
              </div>
              
              {/* Preferred Date */}
              <div className="space-y-2">
                <Label htmlFor="preferredDate">Preferred Service Date (Optional)</Label>
                <Input
                  id="preferredDate"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Let us know your preferred date for the service visit
                </p>
              </div>
              
              {/* Contact Information */}
              <div className="space-y-4">
                <Label className="text-base">Contact Information (Optional)</Label>
                <p className="text-sm text-muted-foreground -mt-2">
                  Provide alternative contact details if different from your account
                </p>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="contact@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              {/* Urgent Warning */}
              {priority === 'urgent' && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Urgent Priority Selected</p>
                    <p className="text-sm text-muted-foreground">
                      Please only select urgent for critical issues that require immediate attention.
                      Our team will prioritize your request accordingly.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate('/portal/work-orders')}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={
                    createMutation.isPending || 
                    !title.trim() || 
                    !description.trim() || 
                    !category ||
                    files.some(f => f.uploading)
                  }
                >
                  <Send className="h-4 w-4 mr-2" />
                  {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}
