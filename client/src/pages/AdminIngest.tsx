import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  Upload, 
  Mail, 
  MessageSquare, 
  FileText, 
  Image, 
  Music, 
  Video,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Send
} from "lucide-react";

export default function AdminIngest() {
  return (
    <DashboardLayout>
      <AdminIngestContent />
    </DashboardLayout>
  );
}

function AdminIngestContent() {
  const [activeTab, setActiveTab] = useState("file");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentIngests, setRecentIngests] = useState<Array<{
    id: string;
    type: string;
    name: string;
    status: "pending" | "processing" | "completed" | "failed";
    timestamp: Date;
  }>>([]);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileProject, setFileProject] = useState<string>("");
  const [fileTags, setFileTags] = useState<string>("");

  // Email simulation state
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);

  // WhatsApp simulation state
  const [whatsappFrom, setWhatsappFrom] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappMedia, setWhatsappMedia] = useState<File | null>(null);

  // Text note state
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteProject, setNoteProject] = useState<string>("");

  const { data: projects = [] } = trpc.projects.list.useQuery();
  const uploadMutation = trpc.artifacts.upload.useMutation();
  const ingestEmailMutation = trpc.artifacts.ingestFromEmail.useMutation();

  const addToRecent = (type: string, name: string, status: "pending" | "processing" | "completed" | "failed") => {
    setRecentIngests(prev => [{
      id: Date.now().toString(),
      type,
      name,
      status,
      timestamp: new Date()
    }, ...prev.slice(0, 9)]);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setIsProcessing(true);
    addToRecent("file", selectedFile.name, "processing");

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // Calculate hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        await uploadMutation.mutateAsync({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          fileData: base64,
          fileHash: hash,
          artifactType: selectedFile.type.split('/')[0] || 'document',
          projectId: fileProject ? parseInt(fileProject) : undefined,
          tags: fileTags ? fileTags.split(',').map(t => t.trim()) : undefined,
        });

        setRecentIngests(prev => prev.map(item => 
          item.name === selectedFile.name && item.status === "processing" 
            ? { ...item, status: "completed" as const }
            : item
        ));
        
        toast.success(`File "${selectedFile.name}" ingested successfully`);
        setSelectedFile(null);
        setFileTags("");
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setRecentIngests(prev => prev.map(item => 
        item.name === selectedFile.name && item.status === "processing" 
          ? { ...item, status: "failed" as const }
          : item
      ));
      toast.error("Failed to ingest file");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmailIngest = async () => {
    if (!emailFrom || !emailSubject) {
      toast.error("Please fill in sender and subject");
      return;
    }

    setIsProcessing(true);
    addToRecent("email", emailSubject, "processing");

    try {
      // Process attachments
      const attachments = await Promise.all(emailAttachments.map(async (file) => {
        const reader = new FileReader();
        return new Promise<{ filename: string; mimeType: string; size: number; content: string }>((resolve) => {
          reader.onload = () => {
            resolve({
              filename: file.name,
              mimeType: file.type,
              size: file.size,
              content: (reader.result as string).split(',')[1]
            });
          };
          reader.readAsDataURL(file);
        });
      }));

      await ingestEmailMutation.mutateAsync({
        messageId: `email-${Date.now()}`,
        from: emailFrom,
        to: "ingest@kiisha.demo",
        subject: emailSubject,
        bodyText: emailBody,
        receivedAt: new Date().toISOString(),
        attachments,
        apiKey: "kiisha-email-ingest-key"
      });

      setRecentIngests(prev => prev.map(item => 
        item.name === emailSubject && item.status === "processing" 
          ? { ...item, status: "completed" as const }
          : item
      ));

      toast.success("Email ingested successfully");
      setEmailFrom("");
      setEmailSubject("");
      setEmailBody("");
      setEmailAttachments([]);
    } catch (error) {
      setRecentIngests(prev => prev.map(item => 
        item.name === emailSubject && item.status === "processing" 
          ? { ...item, status: "failed" as const }
          : item
      ));
      toast.error("Failed to ingest email");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppIngest = async () => {
    if (!whatsappFrom || !whatsappMessage) {
      toast.error("Please fill in sender and message");
      return;
    }

    setIsProcessing(true);
    const displayName = whatsappMessage.substring(0, 30) + (whatsappMessage.length > 30 ? "..." : "");
    addToRecent("whatsapp", displayName, "processing");

    try {
      // Simulate WhatsApp message as email for now
      let attachments: { filename: string; mimeType: string; size: number; content: string }[] = [];
      
      if (whatsappMedia) {
        const reader = new FileReader();
        const mediaContent = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(whatsappMedia);
        });
        attachments = [{
          filename: whatsappMedia.name,
          mimeType: whatsappMedia.type,
          size: whatsappMedia.size,
          content: mediaContent
        }];
      }

      await ingestEmailMutation.mutateAsync({
        messageId: `whatsapp-${Date.now()}`,
        from: whatsappFrom,
        to: "whatsapp@kiisha.demo",
        subject: `WhatsApp from ${whatsappFrom}`,
        bodyText: whatsappMessage,
        receivedAt: new Date().toISOString(),
        attachments,
        apiKey: "kiisha-email-ingest-key"
      });

      setRecentIngests(prev => prev.map(item => 
        item.name === displayName && item.status === "processing" 
          ? { ...item, status: "completed" as const }
          : item
      ));

      toast.success("WhatsApp message ingested successfully");
      setWhatsappFrom("");
      setWhatsappMessage("");
      setWhatsappMedia(null);
    } catch (error) {
      setRecentIngests(prev => prev.map(item => 
        item.name === displayName && item.status === "processing" 
          ? { ...item, status: "failed" as const }
          : item
      ));
      toast.error("Failed to ingest WhatsApp message");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNoteIngest = async () => {
    if (!noteTitle || !noteContent) {
      toast.error("Please fill in title and content");
      return;
    }

    setIsProcessing(true);
    addToRecent("note", noteTitle, "processing");

    try {
      // Create a text file from the note
      const content = `# ${noteTitle}\n\n${noteContent}`;
      const base64 = btoa(unescape(encodeURIComponent(content)));
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(base64));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      await uploadMutation.mutateAsync({
        fileName: `${noteTitle.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
        fileSize: content.length,
        mimeType: "text/markdown",
        fileData: base64,
        fileHash: hash,
        artifactType: 'document',
        projectId: noteProject ? parseInt(noteProject) : undefined,
      });

      setRecentIngests(prev => prev.map(item => 
        item.name === noteTitle && item.status === "processing" 
          ? { ...item, status: "completed" as const }
          : item
      ));

      toast.success("Note ingested successfully");
      setNoteTitle("");
      setNoteContent("");
    } catch (error) {
      setRecentIngests(prev => prev.map(item => 
        item.name === noteTitle && item.status === "processing" 
          ? { ...item, status: "failed" as const }
          : item
      ));
      toast.error("Failed to ingest note");
    } finally {
      setIsProcessing(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "file": return <FileText className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "whatsapp": return <MessageSquare className="h-4 w-4" />;
      case "note": return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-2">Ingest Simulator</h1>
        <p className="text-muted-foreground">
          Test the artifact ingestion pipeline by simulating different input channels
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Area */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Simulate Input</CardTitle>
              <CardDescription>
                Choose an input type and provide the data to ingest
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="file" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    File
                  </TabsTrigger>
                  <TabsTrigger value="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="note" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Note
                  </TabsTrigger>
                </TabsList>

                {/* File Upload Tab */}
                <TabsContent value="file" className="space-y-4 mt-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      id="file-upload"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2">
                          {selectedFile.type.startsWith('image/') ? <Image className="h-8 w-8" /> :
                           selectedFile.type.startsWith('audio/') ? <Music className="h-8 w-8" /> :
                           selectedFile.type.startsWith('video/') ? <Video className="h-8 w-8" /> :
                           <FileText className="h-8 w-8" />}
                          <div className="text-left">
                            <p className="font-medium">{selectedFile.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">
                            Click to select or drag and drop a file
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, Word, Excel, Images, Audio, Video
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Project (optional)</Label>
                      <Select value={fileProject} onValueChange={setFileProject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tags (comma-separated)</Label>
                      <Input 
                        value={fileTags}
                        onChange={(e) => setFileTags(e.target.value)}
                        placeholder="contract, legal, draft"
                      />
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleFileUpload}
                    disabled={!selectedFile || isProcessing}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Ingest File</>
                    )}
                  </Button>
                </TabsContent>

                {/* Email Tab */}
                <TabsContent value="email" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input 
                        value={emailFrom}
                        onChange={(e) => setEmailFrom(e.target.value)}
                        placeholder="sender@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input 
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="RE: Project Documents"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Body</Label>
                    <Textarea 
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Email content..."
                      rows={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attachments</Label>
                    <input
                      type="file"
                      id="email-attachments"
                      className="hidden"
                      multiple
                      onChange={(e) => setEmailAttachments(Array.from(e.target.files || []))}
                    />
                    <label htmlFor="email-attachments" className="block">
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50">
                        {emailAttachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2 justify-center">
                            {emailAttachments.map((file, i) => (
                              <Badge key={i} variant="secondary">
                                {file.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Click to add attachments
                          </p>
                        )}
                      </div>
                    </label>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleEmailIngest}
                    disabled={!emailFrom || !emailSubject || isProcessing}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><Send className="h-4 w-4 mr-2" /> Simulate Email</>
                    )}
                  </Button>
                </TabsContent>

                {/* WhatsApp Tab */}
                <TabsContent value="whatsapp" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>From (Phone Number)</Label>
                    <Input 
                      value={whatsappFrom}
                      onChange={(e) => setWhatsappFrom(e.target.value)}
                      placeholder="+1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea 
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      placeholder="WhatsApp message content..."
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Media (optional)</Label>
                    <input
                      type="file"
                      id="whatsapp-media"
                      className="hidden"
                      accept="image/*,video/*,audio/*"
                      onChange={(e) => setWhatsappMedia(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="whatsapp-media" className="block">
                      <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50">
                        {whatsappMedia ? (
                          <Badge variant="secondary">{whatsappMedia.name}</Badge>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Click to add image, video, or voice note
                          </p>
                        )}
                      </div>
                    </label>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleWhatsAppIngest}
                    disabled={!whatsappFrom || !whatsappMessage || isProcessing}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><MessageSquare className="h-4 w-4 mr-2" /> Simulate WhatsApp</>
                    )}
                  </Button>
                </TabsContent>

                {/* Note Tab */}
                <TabsContent value="note" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input 
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Meeting Notes - Site Visit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea 
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Note content (supports Markdown)..."
                      rows={8}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Project (optional)</Label>
                    <Select value={noteProject} onValueChange={setNoteProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id.toString()}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleNoteIngest}
                    disabled={!noteTitle || !noteContent || isProcessing}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" /> Create Note</>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Recent Ingests Sidebar */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Recent Ingests</CardTitle>
              <CardDescription>
                Last 10 items processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentIngests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent ingests
                </p>
              ) : (
                <div className="space-y-3">
                  {recentIngests.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div className="p-2 rounded bg-background">
                        {getFileIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      {getStatusIcon(item.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Quick Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Files are automatically categorized by AI</p>
              <p>• Emails can include multiple attachments</p>
              <p>• WhatsApp messages support media files</p>
              <p>• Notes are stored as Markdown files</p>
              <p>• All ingests appear in the Artifact Hub</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
