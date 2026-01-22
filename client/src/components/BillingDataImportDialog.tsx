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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  CalendarIcon,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

interface BillingDataImportDialogProps {
  modelId: number;
  modelName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

interface BillingEntry {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  actualRevenue: number;
  actualProduction: number | null;
  actualOpex: number | null;
  notes: string;
}

export function BillingDataImportDialog({
  modelId,
  modelName,
  trigger,
  onSuccess,
}: BillingDataImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [entries, setEntries] = useState<BillingEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single entry form state
  const [periodStart, setPeriodStart] = useState<Date | undefined>();
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>();
  const [actualRevenue, setActualRevenue] = useState("");
  const [actualProduction, setActualProduction] = useState("");
  const [actualOpex, setActualOpex] = useState("");
  const [notes, setNotes] = useState("");

  const createComparisonMutation = trpc.financialModels.createComparison.useMutation({
    onSuccess: () => {
      toast.success("Billing data imported", {
        description: "Actual vs projected comparison has been updated.",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("Import failed", { description: error.message });
    },
  });

  const addEntry = () => {
    if (!periodStart || !periodEnd || !actualRevenue) {
      toast.error("Please fill in required fields");
      return;
    }

    const newEntry: BillingEntry = {
      id: crypto.randomUUID(),
      periodStart,
      periodEnd,
      actualRevenue: parseFloat(actualRevenue),
      actualProduction: actualProduction ? parseFloat(actualProduction) : null,
      actualOpex: actualOpex ? parseFloat(actualOpex) : null,
      notes,
    };

    setEntries([...entries, newEntry]);
    
    // Reset form
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setActualRevenue("");
    setActualProduction("");
    setActualOpex("");
    setNotes("");
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, show a placeholder - actual CSV parsing would go here
    toast.info("CSV import coming soon", {
      description: "Please use manual entry for now.",
    });
  };

  const handleSubmit = async () => {
    if (entries.length === 0) {
      toast.error("Please add at least one billing entry");
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit each entry
      for (const entry of entries) {
        await createComparisonMutation.mutateAsync({
          modelId,
          periodStart: format(entry.periodStart, "yyyy-MM-dd"),
          periodEnd: format(entry.periodEnd, "yyyy-MM-dd"),
          actualRevenue: entry.actualRevenue,
          actualProduction: entry.actualProduction ?? undefined,
          actualOpex: entry.actualOpex ?? undefined,
          notes: entry.notes || undefined,
        });
      }

      handleClose();
    } catch (error) {
      // Error handled in mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEntries([]);
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setActualRevenue("");
    setActualProduction("");
    setActualOpex("");
    setNotes("");
  };

  const downloadTemplate = () => {
    const csvContent = `Period Start,Period End,Actual Revenue,Actual Production (MWh),Actual OpEx,Notes
2024-01-01,2024-01-31,125000,1250,15000,January billing
2024-02-01,2024-02-29,118000,1180,14500,February billing`;
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "billing_data_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Import Billing Data
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Billing Data</DialogTitle>
          <DialogDescription>
            Add actual billing and revenue data for {modelName} to compare against
            projected values.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "import")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4 mt-4">
            {/* Entry Form */}
            <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
              <div className="space-y-2">
                <Label>Period Start *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !periodStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodStart ? format(periodStart, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodStart}
                      onSelect={setPeriodStart}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Period End *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !periodEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodEnd ? format(periodEnd, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={periodEnd}
                      onSelect={setPeriodEnd}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Actual Revenue ($) *</Label>
                <Input
                  type="number"
                  value={actualRevenue}
                  onChange={(e) => setActualRevenue(e.target.value)}
                  placeholder="125000"
                />
              </div>

              <div className="space-y-2">
                <Label>Actual Production (MWh)</Label>
                <Input
                  type="number"
                  value={actualProduction}
                  onChange={(e) => setActualProduction(e.target.value)}
                  placeholder="1250"
                />
              </div>

              <div className="space-y-2">
                <Label>Actual OpEx ($)</Label>
                <Input
                  type="number"
                  value={actualOpex}
                  onChange={(e) => setActualOpex(e.target.value)}
                  placeholder="15000"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>

              <div className="col-span-2">
                <Button onClick={addEntry} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </div>
            </div>

            {/* Entries Table */}
            {entries.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Production</TableHead>
                      <TableHead className="text-right">OpEx</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(entry.periodStart, "MMM d")} -{" "}
                          {format(entry.periodEnd, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.actualRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.actualProduction
                            ? `${entry.actualProduction.toLocaleString()} MWh`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.actualOpex
                            ? formatCurrency(entry.actualOpex)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEntry(entry.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileImport}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Upload a CSV file with your billing data
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </Button>
                <Button variant="ghost" onClick={downloadTemplate}>
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="font-medium mb-2">CSV Format Requirements</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• First row should contain column headers</li>
                <li>• Required columns: Period Start, Period End, Actual Revenue</li>
                <li>• Optional columns: Actual Production, Actual OpEx, Notes</li>
                <li>• Dates should be in YYYY-MM-DD format</li>
                <li>• Numbers should not include currency symbols</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={entries.length === 0 || isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Import {entries.length} {entries.length === 1 ? "Entry" : "Entries"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
