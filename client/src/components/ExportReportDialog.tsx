import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText, FileCode, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ExportReportDialogProps {
  modelId: number;
  modelName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'excel' | 'csv' | 'pdf';

export function ExportReportDialog({ modelId, modelName, open, onOpenChange }: ExportReportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [isExporting, setIsExporting] = useState(false);

  const exportExcelMutation = trpc.financialModels.exportExcel.useMutation();
  const exportCSVMutation = trpc.financialModels.exportCSV.useMutation();
  const exportHTMLMutation = trpc.financialModels.exportHTML.useMutation();

  const handleExport = async () => {
    setIsExporting(true);

    try {
      if (format === 'excel') {
        const result = await exportExcelMutation.mutateAsync({ modelId });
        
        // Convert base64 to blob and download
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: result.mimeType });
        downloadBlob(blob, result.filename);
        
        toast.success('Excel report downloaded');
      } else if (format === 'csv') {
        const result = await exportCSVMutation.mutateAsync({ modelId });
        
        const blob = new Blob([result.data], { type: result.mimeType });
        downloadBlob(blob, result.filename);
        
        toast.success('CSV report downloaded');
      } else if (format === 'pdf') {
        const result = await exportHTMLMutation.mutateAsync({ modelId });
        
        // Open HTML in new window for printing to PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.data);
          printWindow.document.close();
          
          // Add print button
          const printButton = printWindow.document.createElement('button');
          printButton.textContent = 'Print / Save as PDF';
          printButton.style.cssText = 'position: fixed; top: 10px; right: 10px; padding: 10px 20px; background: #f97316; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; z-index: 1000;';
          printButton.onclick = () => {
            printButton.style.display = 'none';
            printWindow.print();
            printButton.style.display = 'block';
          };
          printWindow.document.body.appendChild(printButton);
        }
        
        toast.success('Report opened in new window. Use Print → Save as PDF');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Comparison Report
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Export the actual vs projected comparison report for <strong>{modelName}</strong>
          </p>

          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="excel" id="excel" />
              <Label htmlFor="excel" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Excel (.xlsx)</p>
                    <p className="text-xs text-muted-foreground">
                      Full report with multiple sheets for analysis
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="csv" id="csv" />
              <Label htmlFor="csv" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileCode className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">CSV (.csv)</p>
                    <p className="text-xs text-muted-foreground">
                      Simple format for data import/export
                    </p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="pdf" id="pdf" />
              <Label htmlFor="pdf" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium">PDF (via Print)</p>
                    <p className="text-xs text-muted-foreground">
                      Formatted report for presentations
                    </p>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button component
export function ExportReportButton({ modelId, modelName }: { modelId: number; modelName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4 mr-2" />
        Export Report
      </Button>
      <ExportReportDialog
        modelId={modelId}
        modelName={modelName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
