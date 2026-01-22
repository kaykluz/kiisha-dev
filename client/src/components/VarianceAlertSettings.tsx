import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Bell, AlertTriangle, TrendingDown, DollarSign, Zap, Settings } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface VarianceAlertSettingsProps {
  projectId?: number;
  modelId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VarianceAlertSettings({ projectId, modelId, open, onOpenChange }: VarianceAlertSettingsProps) {
  const [enabled, setEnabled] = useState(true);
  const [revenueThreshold, setRevenueThreshold] = useState(10);
  const [productionThreshold, setProductionThreshold] = useState(10);
  const [opexThreshold, setOpexThreshold] = useState(15);
  const [ebitdaThreshold, setEbitdaThreshold] = useState(10);
  const [notifyOnWarning, setNotifyOnWarning] = useState(true);
  const [notifyOnCritical, setNotifyOnCritical] = useState(true);

  const { data: settings } = trpc.financialModels.getVarianceAlertSettings.useQuery(
    { projectId, modelId },
    { enabled: open }
  );

  const updateSettingsMutation = trpc.financialModels.updateVarianceAlertSettings.useMutation({
    onSuccess: () => {
      toast.success("Alert settings saved");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      projectId,
      modelId,
      revenueThreshold,
      productionThreshold,
      opexThreshold,
      ebitdaThreshold,
      enabled,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Variance Alert Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications when variance exceeds thresholds
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className={enabled ? "" : "opacity-50 pointer-events-none"}>
            {/* Threshold Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Variance Thresholds
              </h4>

              {/* Revenue Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    Revenue
                  </Label>
                  <span className="text-sm font-medium">±{revenueThreshold}%</span>
                </div>
                <Slider
                  value={[revenueThreshold]}
                  onValueChange={([v]) => setRevenueThreshold(v)}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* Production Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    Production
                  </Label>
                  <span className="text-sm font-medium">±{productionThreshold}%</span>
                </div>
                <Slider
                  value={[productionThreshold]}
                  onValueChange={([v]) => setProductionThreshold(v)}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* OpEx Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Operating Expenses
                  </Label>
                  <span className="text-sm font-medium">±{opexThreshold}%</span>
                </div>
                <Slider
                  value={[opexThreshold]}
                  onValueChange={([v]) => setOpexThreshold(v)}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* EBITDA Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    EBITDA
                  </Label>
                  <span className="text-sm font-medium">±{ebitdaThreshold}%</span>
                </div>
                <Slider
                  value={[ebitdaThreshold]}
                  onValueChange={([v]) => setEbitdaThreshold(v)}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Notification Preferences
              </h4>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Warning Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Variance exceeds threshold
                  </p>
                </div>
                <Switch checked={notifyOnWarning} onCheckedChange={setNotifyOnWarning} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Critical Alerts</Label>
                  <p className="text-xs text-muted-foreground">
                    Variance exceeds 2x threshold
                  </p>
                </div>
                <Switch checked={notifyOnCritical} onCheckedChange={setNotifyOnCritical} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateSettingsMutation.isPending}>
            {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button component
export function VarianceAlertSettingsButton({ projectId, modelId }: { projectId?: number; modelId?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4 mr-2" />
        Alert Settings
      </Button>
      <VarianceAlertSettings
        projectId={projectId}
        modelId={modelId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
