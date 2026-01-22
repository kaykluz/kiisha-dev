import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  FileText, 
  Info, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  User,
  Calendar,
  FileSearch,
  Bot,
  Edit,
  Link2
} from "lucide-react";

interface SourceInfo {
  sourceType: "document" | "api" | "manual" | "ai_extraction" | "import";
  sourceId?: number;
  sourceName?: string;
  sourceLocation?: string; // Page number, timestamp, cell reference
  extractedAt?: Date;
  extractedBy?: string;
  confidence?: number;
  verificationStatus: "unverified" | "verified" | "corrected" | "rejected";
  verifiedBy?: string;
  verifiedAt?: Date;
  originalValue?: string; // If corrected, what was the original
  correctedValue?: string;
  correctionNote?: string;
  aiModel?: string;
  aiPromptVersion?: string;
}

interface SourceTraceabilityProps {
  fieldName: string;
  currentValue: string | number | boolean | null;
  source?: SourceInfo;
  onViewSource?: () => void;
  onVerify?: () => void;
  onCorrect?: (newValue: string, note: string) => void;
  compact?: boolean;
}

export function SourceTraceability({
  fieldName,
  currentValue,
  source,
  onViewSource,
  onVerify,
  onCorrect,
  compact = false,
}: SourceTraceabilityProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionNote, setCorrectionNote] = useState("");

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case "document": return <FileText className="h-3 w-3" />;
      case "api": return <Link2 className="h-3 w-3" />;
      case "manual": return <Edit className="h-3 w-3" />;
      case "ai_extraction": return <Bot className="h-3 w-3" />;
      case "import": return <FileSearch className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "verified": return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "corrected": return <Edit className="h-3 w-3 text-blue-500" />;
      case "rejected": return <AlertCircle className="h-3 w-3 text-red-500" />;
      default: return <Clock className="h-3 w-3 text-yellow-500" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "verified": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "corrected": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    }
  };

  const formatConfidence = (confidence?: number) => {
    if (confidence === undefined) return "N/A";
    return `${(confidence * 100).toFixed(0)}%`;
  };

  const formatDate = (date?: Date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Compact mode - just show an icon button
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={() => setIsDialogOpen(true)}
          >
            {getSourceIcon(source?.sourceType)}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>View source: {source?.sourceName || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">
            {source?.verificationStatus || "Unverified"}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
        >
          {getSourceIcon(source?.sourceType)}
          {getStatusIcon(source?.verificationStatus)}
          <span className="hidden sm:inline">Source</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Data Provenance</DialogTitle>
          <DialogDescription>
            Traceability information for "{fieldName}"
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="source" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="verification">Verification</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="source" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getSourceIcon(source?.sourceType)}
                  Source Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">Type</div>
                  <div className="capitalize">{source?.sourceType?.replace("_", " ") || "Unknown"}</div>
                  
                  <div className="text-muted-foreground">Source</div>
                  <div>{source?.sourceName || "N/A"}</div>
                  
                  <div className="text-muted-foreground">Location</div>
                  <div>{source?.sourceLocation || "N/A"}</div>
                  
                  <div className="text-muted-foreground">Extracted</div>
                  <div>{formatDate(source?.extractedAt)}</div>
                  
                  {source?.sourceType === "ai_extraction" && (
                    <>
                      <div className="text-muted-foreground">AI Model</div>
                      <div>{source?.aiModel || "N/A"}</div>
                      
                      <div className="text-muted-foreground">Confidence</div>
                      <div className="flex items-center gap-2">
                        {formatConfidence(source?.confidence)}
                        {source?.confidence && (
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${source.confidence * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {onViewSource && source?.sourceId && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-2"
                    onClick={onViewSource}
                  >
                    <FileSearch className="h-4 w-4 mr-2" />
                    View Source Document
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                  {String(currentValue) || "(empty)"}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {getStatusIcon(source?.verificationStatus)}
                  Verification Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Badge className={getStatusColor(source?.verificationStatus)}>
                  {source?.verificationStatus || "Unverified"}
                </Badge>

                {source?.verifiedBy && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" /> Verified By
                    </div>
                    <div>{source.verifiedBy}</div>
                    
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Verified At
                    </div>
                    <div>{formatDate(source.verifiedAt)}</div>
                  </div>
                )}

                {source?.verificationStatus === "corrected" && (
                  <div className="mt-3 p-3 bg-blue-500/10 rounded-lg">
                    <p className="text-sm font-medium text-blue-500 mb-2">Correction Applied</p>
                    <div className="text-sm space-y-1">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Original:</span>
                        <span className="line-through">{source.originalValue}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Corrected:</span>
                        <span>{source.correctedValue}</span>
                      </div>
                      {source.correctionNote && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">Note:</span>
                          <span>{source.correctionNote}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {source?.verificationStatus === "unverified" && onVerify && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={onVerify}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Verified
                  </Button>
                )}
              </CardContent>
            </Card>

            {onCorrect && source?.verificationStatus !== "corrected" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Submit Correction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Corrected Value</label>
                    <input
                      type="text"
                      className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                      value={correctionValue}
                      onChange={(e) => setCorrectionValue(e.target.value)}
                      placeholder="Enter correct value"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Correction Note</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 border rounded-md bg-background resize-none"
                      rows={2}
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      placeholder="Why is this correction needed?"
                    />
                  </div>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      onCorrect(correctionValue, correctionNote);
                      setCorrectionValue("");
                      setCorrectionNote("");
                    }}
                    disabled={!correctionValue}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Submit Correction
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Value History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Current value */}
                  <div className="flex items-start gap-3 p-2 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Current Value</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {String(currentValue) || "(empty)"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(source?.verifiedAt || source?.extractedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Original value if corrected */}
                  {source?.originalValue && (
                    <div className="flex items-start gap-3 p-2 rounded-lg">
                      <div className="w-2 h-2 mt-2 rounded-full bg-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">Original Value</p>
                        <p className="text-sm text-muted-foreground font-mono line-through">
                          {source.originalValue}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(source?.extractedAt)}
                        </p>
                      </div>
                    </div>
                  )}

                  {!source?.originalValue && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No previous values recorded
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Compact inline indicator for use in tables/lists
export function SourceIndicator({ source }: { source?: SourceInfo }) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "verified": return "text-green-500";
      case "corrected": return "text-blue-500";
      case "rejected": return "text-red-500";
      default: return "text-yellow-500";
    }
  };

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case "document": return <FileText className="h-3 w-3" />;
      case "api": return <Link2 className="h-3 w-3" />;
      case "manual": return <Edit className="h-3 w-3" />;
      case "ai_extraction": return <Bot className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-0.5 ${getStatusColor(source?.verificationStatus)}`}>
          {getSourceIcon(source?.sourceType)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p>Source: {source?.sourceName || "Unknown"}</p>
          <p>Status: {source?.verificationStatus || "Unverified"}</p>
          {source?.confidence && <p>Confidence: {(source.confidence * 100).toFixed(0)}%</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default SourceTraceability;
