import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ArtifactUploader } from "@/components/ArtifactUploader";
import { ExtractionReviewQueue } from "@/components/ExtractionReviewQueue";
import { LifecycleWizard } from "@/components/LifecycleWizard";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, Image, Mic, Video, MessageSquare, Users, FileSignature,
  Search, Filter, Upload, MoreHorizontal, CheckCircle2, Clock, AlertCircle,
  Sparkles, Eye, Edit, Trash2, ChevronRight, Tag, Calendar, Building2,
  MapPin, Cpu, RefreshCw, ArrowUpRight, FileCheck, Brain, Layers
} from "lucide-react";

// Artifact type icons
const artifactTypeIcons: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  image: <Image className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
  contract: <FileSignature className="h-4 w-4" />,
};

// Processing status badges
const processingStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  preprocessing: { label: "Preprocessing", variant: "outline", icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
  processed: { label: "Processed", variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
  ai_analyzing: { label: "AI Analyzing", variant: "outline", icon: <Brain className="h-3 w-3 animate-pulse" /> },
  ai_complete: { label: "AI Complete", variant: "default", icon: <Sparkles className="h-3 w-3" /> },
  failed: { label: "Failed", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
};

// Verification status badges
const verificationStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  unverified: { label: "Unverified", variant: "secondary" },
  ai_verified: { label: "AI Verified", variant: "outline" },
  human_verified: { label: "Verified", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

// Mock data for demonstration
const mockArtifacts = [
  {
    id: 1,
    artifactCode: "ART-2026-00001",
    artifactType: "contract",
    name: "PPA Agreement - Saratoga CDG 1",
    description: "Power Purchase Agreement with local utility",
    processingStatus: "ai_complete",
    verificationStatus: "human_verified",
    aiSuggestedCategory: "Commercial",
    confirmedCategory: "Commercial",
    confirmedSubcategory: "PPA",
    projectId: 2,
    projectName: "NY - Saratoga CDG 1",
    createdAt: new Date("2026-01-10"),
    tags: ["ppa", "utility", "commercial"],
  },
  {
    id: 2,
    artifactCode: "ART-2026-00002",
    artifactType: "image",
    name: "Site Survey Photos - Gillette BTM",
    description: "Drone captured site survey images",
    processingStatus: "ai_analyzing",
    verificationStatus: "unverified",
    aiSuggestedCategory: "Technical",
    projectId: 1,
    projectName: "MA - Gillette BTM",
    createdAt: new Date("2026-01-12"),
    tags: ["site-survey", "drone", "photos"],
  },
  {
    id: 3,
    artifactCode: "ART-2026-00003",
    artifactType: "meeting",
    name: "Due Diligence Kickoff Meeting",
    description: "Initial meeting with investor team",
    processingStatus: "processed",
    verificationStatus: "ai_verified",
    aiSuggestedCategory: "Due Diligence",
    projectId: 1,
    projectName: "MA - Gillette BTM",
    createdAt: new Date("2026-01-14"),
    tags: ["meeting", "due-diligence", "investor"],
  },
  {
    id: 4,
    artifactCode: "ART-2026-00004",
    artifactType: "document",
    name: "Environmental Impact Assessment",
    description: "Phase 1 environmental study report",
    processingStatus: "pending",
    verificationStatus: "unverified",
    projectId: 3,
    projectName: "CT - Hartford Solar",
    createdAt: new Date("2026-01-15"),
    tags: ["environmental", "compliance", "phase-1"],
  },
  {
    id: 5,
    artifactCode: "ART-2026-00005",
    artifactType: "audio",
    name: "Site Visit Voice Notes",
    description: "Field engineer observations during site inspection",
    processingStatus: "preprocessing",
    verificationStatus: "unverified",
    projectId: 2,
    projectName: "NY - Saratoga CDG 1",
    createdAt: new Date("2026-01-15"),
    tags: ["voice-note", "site-visit", "inspection"],
  },
];

// Mock stats
const mockStats = {
  total: 156,
  byType: {
    document: 78,
    image: 34,
    contract: 18,
    meeting: 12,
    audio: 8,
    video: 4,
    message: 2,
  },
  byProcessingStatus: {
    pending: 12,
    preprocessing: 3,
    processed: 45,
    ai_analyzing: 8,
    ai_complete: 85,
    failed: 3,
  },
  byVerificationStatus: {
    unverified: 28,
    ai_verified: 67,
    human_verified: 58,
    rejected: 3,
  },
  pendingReview: 28,
};

// Mock lifecycle stages
const mockLifecycleStages = [
  { stageKey: "origination", stageName: "Origination", stageOrder: 1, color: "bg-blue-500" },
  { stageKey: "development", stageName: "Development", stageOrder: 2, color: "bg-purple-500" },
  { stageKey: "due_diligence", stageName: "Due Diligence", stageOrder: 3, color: "bg-amber-500" },
  { stageKey: "construction", stageName: "Construction", stageOrder: 4, color: "bg-orange-500" },
  { stageKey: "commissioning", stageName: "Commissioning", stageOrder: 5, color: "bg-teal-500" },
  { stageKey: "operations", stageName: "Operations", stageOrder: 6, color: "bg-green-500" },
];

// Mock lifecycle tracking
const mockLifecycleTracking = [
  {
    id: 1,
    entityType: "project",
    entityName: "MA - Gillette BTM",
    currentStage: "due_diligence",
    stageCompleteness: 54,
    milestonesCompleted: 4,
    milestonesTotal: 8,
    attributesCompleted: 23,
    attributesRequired: 42,
    isBlocked: false,
    stageEnteredAt: new Date("2025-12-15"),
  },
  {
    id: 2,
    entityType: "project",
    entityName: "NY - Saratoga CDG 1",
    currentStage: "construction",
    stageCompleteness: 72,
    milestonesCompleted: 6,
    milestonesTotal: 10,
    attributesCompleted: 38,
    attributesRequired: 52,
    isBlocked: false,
    stageEnteredAt: new Date("2025-11-01"),
  },
  {
    id: 3,
    entityType: "project",
    entityName: "CT - Hartford Solar",
    currentStage: "development",
    stageCompleteness: 35,
    milestonesCompleted: 2,
    milestonesTotal: 6,
    attributesCompleted: 12,
    attributesRequired: 35,
    isBlocked: true,
    blockedReason: "Awaiting interconnection study results",
    stageEnteredAt: new Date("2026-01-02"),
  },
];

export default function ArtifactHub() {
  const [activeTab, setActiveTab] = useState("artifacts");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedArtifact, setSelectedArtifact] = useState<typeof mockArtifacts[0] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Filter artifacts
  const filteredArtifacts = mockArtifacts.filter(artifact => {
    const matchesSearch = searchQuery === "" || 
      artifact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artifact.artifactCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      artifact.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesType = typeFilter === "all" || artifact.artifactType === typeFilter;
    const matchesStatus = statusFilter === "all" || artifact.processingStatus === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const openArtifactDrawer = (artifact: typeof mockArtifacts[0]) => {
    setSelectedArtifact(artifact);
    setDrawerOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Artifact Hub</h1>
            <p className="text-muted-foreground">
              Universal artifact management with AI-powered processing
            </p>
          </div>
          <Button className="gap-2" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Artifact
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Artifacts</CardDescription>
              <CardTitle className="text-3xl">{mockStats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(mockStats.byType).slice(0, 4).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-xs gap-1">
                    {artifactTypeIcons[type]}
                    {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>AI Processing</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-amber-500" />
                {mockStats.byProcessingStatus.ai_complete}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {mockStats.byProcessingStatus.ai_analyzing} analyzing • {mockStats.byProcessingStatus.pending} pending
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Review</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Eye className="h-6 w-6 text-blue-500" />
                {mockStats.pendingReview}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                AI extractions awaiting human verification
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Verified</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <FileCheck className="h-6 w-6 text-green-500" />
                {mockStats.byVerificationStatus.human_verified}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress 
                value={(mockStats.byVerificationStatus.human_verified / mockStats.total) * 100} 
                className="h-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="artifacts" className="gap-2">
              <Layers className="h-4 w-4" />
              Artifacts
            </TabsTrigger>
            <TabsTrigger value="lifecycle" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Lifecycle Tracking
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Contracts
            </TabsTrigger>
            <TabsTrigger value="extractions" className="gap-2">
              <Brain className="h-4 w-4" />
              AI Extractions
            </TabsTrigger>
          </TabsList>

          {/* Artifacts Tab */}
          <TabsContent value="artifacts" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search artifacts by name, code, or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="contract">Contracts</SelectItem>
                  <SelectItem value="message">Messages</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preprocessing">Preprocessing</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="ai_analyzing">AI Analyzing</SelectItem>
                  <SelectItem value="ai_complete">AI Complete</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Artifact List */}
            <div className="space-y-2">
              {filteredArtifacts.map((artifact) => (
                <Card 
                  key={artifact.id} 
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => openArtifactDrawer(artifact)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Type Icon */}
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {artifactTypeIcons[artifact.artifactType]}
                      </div>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{artifact.name}</span>
                          <Badge variant="outline" className="text-xs font-mono">
                            {artifact.artifactCode}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{artifact.projectName}</span>
                          <span>•</span>
                          <Calendar className="h-3 w-3" />
                          <span>{artifact.createdAt.toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="hidden md:flex gap-1">
                        {artifact.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(artifact.tags?.length || 0) > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{artifact.tags!.length - 2}
                          </Badge>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={processingStatusConfig[artifact.processingStatus]?.variant || "secondary"}
                          className="gap-1"
                        >
                          {processingStatusConfig[artifact.processingStatus]?.icon}
                          {processingStatusConfig[artifact.processingStatus]?.label}
                        </Badge>
                        <Badge 
                          variant={verificationStatusConfig[artifact.verificationStatus]?.variant || "secondary"}
                        >
                          {verificationStatusConfig[artifact.verificationStatus]?.label}
                        </Badge>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredArtifacts.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No artifacts found matching your filters</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Lifecycle Tracking Tab */}
          <TabsContent value="lifecycle" className="space-y-4">
            <LifecycleWizard projectId={1} currentStageKey="development" />
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contract Management</CardTitle>
                <CardDescription>
                  Track contracts, obligations, and amendments across your portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Contract artifacts will appear here once uploaded</p>
                  <Button variant="outline" className="mt-4 gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Extractions Tab */}
          <TabsContent value="extractions" className="space-y-4">
            <ExtractionReviewQueue organizationId={1} />
          </TabsContent>
        </Tabs>

        {/* Artifact Detail Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent className="w-[500px] sm:max-w-[500px]">
            {selectedArtifact && (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      {artifactTypeIcons[selectedArtifact.artifactType]}
                    </div>
                    <div>
                      <SheetTitle>{selectedArtifact.name}</SheetTitle>
                      <SheetDescription className="font-mono">
                        {selectedArtifact.artifactCode}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <ScrollArea className="h-[calc(100vh-200px)] mt-6">
                  <div className="space-y-6">
                    {/* Status Section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Status</h4>
                      <div className="flex gap-2">
                        <Badge 
                          variant={processingStatusConfig[selectedArtifact.processingStatus]?.variant}
                          className="gap-1"
                        >
                          {processingStatusConfig[selectedArtifact.processingStatus]?.icon}
                          {processingStatusConfig[selectedArtifact.processingStatus]?.label}
                        </Badge>
                        <Badge 
                          variant={verificationStatusConfig[selectedArtifact.verificationStatus]?.variant}
                        >
                          {verificationStatusConfig[selectedArtifact.verificationStatus]?.label}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    {/* Details Section */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Details</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Type</span>
                          <p className="capitalize">{selectedArtifact.artifactType}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Project</span>
                          <p>{selectedArtifact.projectName}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created</span>
                          <p>{selectedArtifact.createdAt.toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Category</span>
                          <p>{selectedArtifact.confirmedCategory || selectedArtifact.aiSuggestedCategory || "—"}</p>
                        </div>
                      </div>
                      {selectedArtifact.description && (
                        <div>
                          <span className="text-muted-foreground text-sm">Description</span>
                          <p className="text-sm mt-1">{selectedArtifact.description}</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Tags Section */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Tags</h4>
                      <div className="flex gap-1 flex-wrap">
                        {selectedArtifact.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          + Add Tag
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* AI Analysis Section */}
                    {selectedArtifact.processingStatus === "ai_complete" && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          AI Analysis
                        </h4>
                        <Card className="bg-accent/50">
                          <CardContent className="p-3 text-sm">
                            <p className="text-muted-foreground">
                              AI has analyzed this artifact and extracted key information.
                              Review the extractions to verify accuracy.
                            </p>
                            <Button variant="outline" size="sm" className="mt-2 gap-1">
                              <Eye className="h-3 w-3" />
                              View Extractions
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="space-y-2 pt-4">
                      <Button className="w-full gap-2">
                        <Eye className="h-4 w-4" />
                        View Original File
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="gap-2">
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" className="gap-2 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Upload Dialog */}
        <ArtifactUploader
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          onUploadComplete={(artifactIds) => {
            console.log('Uploaded artifacts:', artifactIds);
            // In a real app, this would refresh the artifacts list
          }}
        />
      </div>
    </DashboardLayout>
  );
}
