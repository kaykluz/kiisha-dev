import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, LayoutGrid, BarChart3, Copy } from "lucide-react";

interface FieldPackPreviewProps {
  fieldPackId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClone?: (fieldPackId: number) => void;
  organizationId?: number;
}

export default function FieldPackPreview({ 
  fieldPackId, 
  open, 
  onOpenChange, 
  onClone,
  organizationId 
}: FieldPackPreviewProps) {
  const { data: preview, isLoading } = trpc.fieldPacks.preview.useQuery(
    { fieldPackId },
    { enabled: open }
  );
  
  const cloneMutation = trpc.fieldPacks.clone.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      onClone?.(fieldPackId);
    },
  });
  
  const handleClone = () => {
    if (organizationId) {
      cloneMutation.mutate({ 
        sourceId: fieldPackId, 
        organizationId: organizationId 
      });
    }
  };
  
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {preview?.packName}
            <Badge variant="outline">{preview?.scope}</Badge>
          </DialogTitle>
          <DialogDescription>
            Preview the fields, document requirements, and charts included in this field pack
          </DialogDescription>
        </DialogHeader>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 my-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Fields
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{preview?.fieldCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{preview?.docRequirementCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Charts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{preview?.chartCount || 0}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Detailed Tabs */}
        <Tabs defaultValue="fields" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields">Fields ({preview?.fieldCount})</TabsTrigger>
            <TabsTrigger value="docs">Documents ({preview?.docRequirementCount})</TabsTrigger>
            <TabsTrigger value="charts">Charts ({preview?.chartCount})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="fields" className="mt-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {preview?.fields?.map((field: { fieldKey: string; displayLabel: string; group: string; required: boolean; sensitivity?: string }, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{field.displayLabel}</p>
                    <p className="text-sm text-muted-foreground">{field.fieldKey} • {field.group}</p>
                  </div>
                  <div className="flex gap-2">
                    {field.required && <Badge variant="destructive">Required</Badge>}
                    {field.sensitivity && <Badge variant="outline">{field.sensitivity}</Badge>}
                  </div>
                </div>
              ))}
              {(!preview?.fields || preview.fields.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No fields defined</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="docs" className="mt-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {preview?.docRequirements?.map((doc: { docTypeKey: string; required: boolean; allowedFileTypes: string[] }, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{doc.docTypeKey}</p>
                    <p className="text-sm text-muted-foreground">
                      Allowed: {doc.allowedFileTypes?.join(", ") || "Any"}
                    </p>
                  </div>
                  {doc.required && <Badge variant="destructive">Required</Badge>}
                </div>
              ))}
              {(!preview?.docRequirements || preview.docRequirements.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No document requirements</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="charts" className="mt-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {preview?.charts?.map((chart: { chartKey: string; defaultType: string; allowedTypes: string[] }, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{chart.chartKey}</p>
                    <p className="text-sm text-muted-foreground">
                      Type: {chart.defaultType} • Options: {chart.allowedTypes?.join(", ")}
                    </p>
                  </div>
                </div>
              ))}
              {(!preview?.charts || preview.charts.length === 0) && (
                <p className="text-center text-muted-foreground py-4">No charts configured</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {organizationId && (
            <Button onClick={handleClone} disabled={cloneMutation.isPending}>
              <Copy className="w-4 h-4 mr-2" />
              {cloneMutation.isPending ? "Cloning..." : "Clone to My Organization"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
