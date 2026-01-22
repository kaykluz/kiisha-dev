import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, Clock, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-gray-500",
  validating: "bg-blue-500",
  validated: "bg-green-500",
  validation_failed: "bg-red-500",
  importing: "bg-blue-500",
  completed: "bg-green-500",
  failed: "bg-red-500",
  cancelled: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  validating: "Validating...",
  validated: "Validated",
  validation_failed: "Validation Failed",
  importing: "Importing...",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function AssetImport() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [targetAssetClass, setTargetAssetClass] = useState("solar");
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const { data: jobs, isLoading: jobsLoading } = trpc.assetImport.listJobs.useQuery();
  const { data: templates } = trpc.assetImport.listTemplates.useQuery();
  const { data: availableFields } = trpc.assetImport.getAvailableFields.useQuery({ assetClass: targetAssetClass });
  const { data: sampleCsv } = trpc.assetImport.getSampleCsv.useQuery({ assetClass: targetAssetClass });

  const createJobMutation = trpc.assetImport.createJob.useMutation({
    onSuccess: (data) => {
      toast.success("Import job created");
      setSelectedJob(data.jobId);
      setIsUploadOpen(false);
      setIsMappingOpen(true);
      utils.assetImport.listJobs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMappingMutation = trpc.assetImport.updateMapping.useMutation({
    onSuccess: () => {
      toast.success("Column mapping saved");
      utils.assetImport.listJobs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const startValidationMutation = trpc.assetImport.startValidation.useMutation({
    onSuccess: () => {
      toast.success("Validation started");
      setIsMappingOpen(false);
      utils.assetImport.listJobs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const startImportMutation = trpc.assetImport.startImport.useMutation({
    onSuccess: () => {
      toast.success("Import started");
      utils.assetImport.listJobs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelJobMutation = trpc.assetImport.cancelJob.useMutation({
    onSuccess: () => {
      toast.success("Import job cancelled");
      utils.assetImport.listJobs.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // Simulate detecting columns from file
      // In a real implementation, this would parse the file
      const mockColumns = ["Name", "Type", "Location", "Capacity", "Status", "Commission Date"];
      setDetectedColumns(mockColumns);
    }
  }, []);

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error("Please select a file");
      return;
    }

    // In a real implementation, this would upload to S3 first
    const fileType = uploadFile.name.endsWith(".xlsx") || uploadFile.name.endsWith(".xls")
      ? uploadFile.name.endsWith(".xlsx") ? "xlsx" : "xls"
      : "csv";

    createJobMutation.mutate({
      fileName: uploadFile.name,
      fileUrl: `https://storage.example.com/imports/${uploadFile.name}`,
      fileType: fileType as "csv" | "xlsx" | "xls",
      fileSize: uploadFile.size,
      targetAssetClass,
    });
  };

  const handleSaveMapping = () => {
    if (!selectedJob) return;
    updateMappingMutation.mutate({
      jobId: selectedJob,
      columnMapping,
      targetAssetClass,
    });
  };

  const handleStartValidation = () => {
    if (!selectedJob) return;
    startValidationMutation.mutate({ jobId: selectedJob });
  };

  const handleStartImport = (jobId: number) => {
    startImportMutation.mutate({ jobId });
  };

  const handleCancelJob = (jobId: number) => {
    if (confirm("Are you sure you want to cancel this import job?")) {
      cancelJobMutation.mutate({ jobId });
    }
  };

  const downloadSampleCsv = () => {
    if (!sampleCsv) return;
    const blob = new Blob([sampleCsv.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kiisha-asset-import-template-${targetAssetClass}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset Import</h1>
            <p className="text-muted-foreground">
              Bulk import assets from CSV or Excel files
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadSampleCsv}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            <Button onClick={() => setIsUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Assets
            </Button>
          </div>
        </div>

        {/* Import Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              View and manage your asset import jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : jobs && jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Asset Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{job.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{job.targetAssetClass || "All"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[job.status]}>
                          {statusLabels[job.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(job.status === "validating" || job.status === "importing") && (
                          <div className="flex items-center gap-2">
                            <Progress value={job.processedRows && job.totalRows ? (job.processedRows / job.totalRows) * 100 : 0} className="w-24" />
                            <span className="text-sm text-muted-foreground">
                              {job.processedRows || 0}/{job.totalRows || 0}
                            </span>
                          </div>
                        )}
                        {job.status === "completed" && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">{job.successCount || 0} imported</span>
                          </div>
                        )}
                        {job.status === "validation_failed" && (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">{job.errorCount || 0} errors</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {job.status === "validated" && (
                            <Button
                              size="sm"
                              onClick={() => handleStartImport(job.id)}
                            >
                              Start Import
                            </Button>
                          )}
                          {job.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedJob(job.id);
                                setColumnMapping(job.columnMapping as Record<string, string> || {});
                                setIsMappingOpen(true);
                              }}
                            >
                              Configure
                            </Button>
                          )}
                          {!["completed", "cancelled", "failed"].includes(job.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelJob(job.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Import Jobs</h3>
                <p className="text-muted-foreground mb-4">
                  Upload a CSV or Excel file to start importing assets
                </p>
                <Button onClick={() => setIsUploadOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import Assets
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Templates */}
        {templates && templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Saved Import Templates</CardTitle>
              <CardDescription>
                Reuse column mappings for consistent imports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <Card key={template.id} className="cursor-pointer hover:border-primary">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline">{template.targetAssetClass}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Assets</DialogTitle>
              <DialogDescription>
                Upload a CSV or Excel file containing asset data
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Asset Class</Label>
                <Select value={targetAssetClass} onValueChange={setTargetAssetClass}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solar">Solar</SelectItem>
                    <SelectItem value="wind">Wind</SelectItem>
                    <SelectItem value="bess">Battery Storage (BESS)</SelectItem>
                    <SelectItem value="hydro">Hydro</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>File</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploadFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-green-500" />
                        <span className="font-medium">{uploadFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          CSV, XLSX, or XLS files
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {detectedColumns.length > 0 && (
                <div className="space-y-2">
                  <Label>Detected Columns</Label>
                  <div className="flex flex-wrap gap-2">
                    {detectedColumns.map((col) => (
                      <Badge key={col} variant="secondary">{col}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!uploadFile || createJobMutation.isPending}>
                {createJobMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Continue to Mapping
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Column Mapping Dialog */}
        <Dialog open={isMappingOpen} onOpenChange={setIsMappingOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Configure Column Mapping</DialogTitle>
              <DialogDescription>
                Map your file columns to KIISHA asset fields
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Your Column</TableHead>
                    <TableHead>
                      <ArrowRight className="h-4 w-4" />
                    </TableHead>
                    <TableHead>KIISHA Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detectedColumns.map((col) => (
                    <TableRow key={col}>
                      <TableCell>{col}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={columnMapping[col] || ""}
                          onValueChange={(value) =>
                            setColumnMapping((prev) => ({ ...prev, [col]: value }))
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Skip this column</SelectItem>
                            {availableFields?.map((field) => (
                              <SelectItem key={field.key} value={field.key}>
                                {field.label}
                                {field.required && " *"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMappingOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleSaveMapping}>
                Save Mapping
              </Button>
              <Button onClick={handleStartValidation} disabled={startValidationMutation.isPending}>
                {startValidationMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validate & Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
