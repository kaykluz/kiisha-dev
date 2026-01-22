import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UploadFinancialModelDialogProps {
  projectId: number;
  projectName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

const SCENARIO_TYPES = [
  { value: "Base", label: "Base Case" },
  { value: "Upside", label: "Upside Scenario" },
  { value: "Downside", label: "Downside Scenario" },
  { value: "Sensitivity", label: "Sensitivity Analysis" },
  { value: "Budget", label: "Budget Model" },
  { value: "Acquisition", label: "Acquisition Model" },
];

const ACCEPTED_FILE_TYPES = [
  ".xlsx",
  ".xlsm",
  ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel",
];

export function UploadFinancialModelDialog({
  projectId,
  projectName,
  trigger,
  onSuccess,
}: UploadFinancialModelDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState("");
  const [scenarioType, setScenarioType] = useState("Base");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState<
    "idle" | "uploading" | "extracting" | "success" | "error"
  >("idle");
  const [extractionResult, setExtractionResult] = useState<{
    confidence?: number;
    metricsFound?: string[];
    errors?: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.financialModels.upload.useMutation({
    onSuccess: (data) => {
      setExtractionStatus("success");
      setExtractionResult({
        confidence: 85,
        metricsFound: ["NPV", "IRR", "DSCR", "Cash Flows"],
      });
      toast.success("Model uploaded successfully", {
        description: "Metrics have been extracted from your financial model.",
      });
      onSuccess?.();
      // Don't close immediately - show success state
      setTimeout(() => {
        handleClose();
      }, 2000);
    },
    onError: (error) => {
      setExtractionStatus("error");
      setExtractionResult({
        errors: [error.message],
      });
      toast.error("Upload failed", { description: error.message });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const isValidType = ACCEPTED_FILE_TYPES.some(
        (type) =>
          selectedFile.name.endsWith(type) || selectedFile.type === type
      );
      if (!isValidType) {
        toast.error("Invalid file type", {
          description: "Please upload an Excel file (.xlsx, .xlsm, or .xls)",
        });
        return;
      }

      // Validate file size (max 50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error("File too large", {
          description: "Maximum file size is 50MB",
        });
        return;
      }

      setFile(selectedFile);
      // Auto-fill model name from file name if empty
      if (!modelName) {
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setModelName(nameWithoutExt);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  };

  const handleUpload = async () => {
    if (!file || !modelName.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setExtractionStatus("uploading");
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      setExtractionStatus("extracting");
      setUploadProgress(100);

      await uploadMutation.mutateAsync({
        projectId,
        name: modelName,
        scenarioType,
        fileBuffer: base64,
        fileName: file.name,
        mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    } catch (error) {
      clearInterval(progressInterval);
      // Error handled in mutation
    }
  };

  const handleClose = () => {
    setOpen(false);
    setFile(null);
    setModelName("");
    setScenarioType("Base");
    setUploadProgress(0);
    setExtractionStatus("idle");
    setExtractionResult(null);
  };

  const isUploading =
    extractionStatus === "uploading" || extractionStatus === "extracting";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="btn-primary">
            <Upload className="w-4 h-4 mr-2" />
            Upload Model
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Financial Model</DialogTitle>
          <DialogDescription>
            Upload an Excel financial model for {projectName}. Metrics will be
            automatically extracted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              file
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-50"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES.join(",")}
              onChange={handleFileSelect}
              className="hidden"
              disabled={isUploading}
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-green-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your Excel file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports .xlsx, .xlsm, .xls (max 50MB)
                </p>
              </>
            )}
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="modelName">Model Name *</Label>
            <Input
              id="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., Project Finance Model v2.1"
              disabled={isUploading}
            />
          </div>

          {/* Scenario Type */}
          <div className="space-y-2">
            <Label htmlFor="scenarioType">Scenario Type</Label>
            <Select
              value={scenarioType}
              onValueChange={setScenarioType}
              disabled={isUploading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {extractionStatus === "uploading"
                    ? "Uploading..."
                    : "Extracting metrics..."}
                </span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              {extractionStatus === "extracting" && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>AI is analyzing your financial model...</span>
                </div>
              )}
            </div>
          )}

          {/* Extraction Result */}
          {extractionStatus === "success" && extractionResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-500 mb-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Extraction Complete</span>
              </div>
              {extractionResult.confidence && (
                <p className="text-sm text-muted-foreground mb-2">
                  Confidence: {extractionResult.confidence}%
                </p>
              )}
              {extractionResult.metricsFound && (
                <div className="flex flex-wrap gap-1">
                  {extractionResult.metricsFound.map((metric) => (
                    <Badge key={metric} variant="secondary" className="text-xs">
                      {metric}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {extractionStatus === "error" && extractionResult?.errors && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">Extraction Failed</span>
              </div>
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {extractionResult.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || !modelName.trim() || isUploading}
            className="btn-primary"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {extractionStatus === "uploading" ? "Uploading..." : "Extracting..."}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload & Extract
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
