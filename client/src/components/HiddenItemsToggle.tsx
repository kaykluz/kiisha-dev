/**
 * HiddenItemsToggle Component
 * 
 * Admin-only toggle to show/hide archived and excluded items in views.
 * When enabled, shows items that are normally hidden with visual indicators.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/_core/hooks/useAuth";

interface HiddenItemsToggleProps {
  showArchived: boolean;
  showExcluded: boolean;
  onShowArchivedChange: (show: boolean) => void;
  onShowExcludedChange: (show: boolean) => void;
  archivedCount?: number;
  excludedCount?: number;
  className?: string;
}

export function HiddenItemsToggle({
  showArchived,
  showExcluded,
  onShowArchivedChange,
  onShowExcludedChange,
  archivedCount = 0,
  excludedCount = 0,
  className,
}: HiddenItemsToggleProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  
  // Only admins can see hidden items
  if (user?.role !== "admin") {
    return null;
  }
  
  const totalHidden = archivedCount + excludedCount;
  const anyShowing = showArchived || showExcluded;
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2",
            anyShowing && "border-amber-500/50 bg-amber-500/10",
            className
          )}
        >
          {anyShowing ? (
            <Eye className="h-4 w-4 text-amber-500" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {totalHidden > 0 ? `${totalHidden} hidden` : "Hidden items"}
          </span>
          <Shield className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="space-y-1">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin View Controls
            </h4>
            <p className="text-xs text-muted-foreground">
              Show items that are normally hidden from this view.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-archived" className="text-sm">
                  Archived items
                </Label>
                <p className="text-xs text-muted-foreground">
                  {archivedCount} item{archivedCount !== 1 ? "s" : ""} archived
                </p>
              </div>
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={onShowArchivedChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-excluded" className="text-sm">
                  Excluded from view
                </Label>
                <p className="text-xs text-muted-foreground">
                  {excludedCount} item{excludedCount !== 1 ? "s" : ""} excluded
                </p>
              </div>
              <Switch
                id="show-excluded"
                checked={showExcluded}
                onCheckedChange={onShowExcludedChange}
              />
            </div>
          </div>
          
          {anyShowing && (
            <div className="pt-2 border-t">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Hidden items are shown with reduced opacity and special indicators.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hook for managing hidden items state
export function useHiddenItemsState() {
  const [showArchived, setShowArchived] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  
  return {
    showArchived,
    showExcluded,
    setShowArchived,
    setShowExcluded,
    // Filter function to apply to lists
    filterItems: <T extends { visibilityState?: string; id?: number }>(
      items: T[],
      excludedIds: Set<number> = new Set()
    ) => {
      return items.filter(item => {
        const isArchived = item.visibilityState === "archived" || item.visibilityState === "superseded";
        const isExcluded = item.id ? excludedIds.has(item.id) : false;
        
        if (isArchived && !showArchived) return false;
        if (isExcluded && !showExcluded) return false;
        
        return true;
      });
    },
    // Get item display props based on visibility
    getItemProps: (item: { visibilityState?: string; id?: number }, excludedIds: Set<number> = new Set()) => {
      const isArchived = item.visibilityState === "archived" || item.visibilityState === "superseded";
      const isExcluded = item.id ? excludedIds.has(item.id) : false;
      
      return {
        isHidden: isArchived || isExcluded,
        isArchived,
        isExcluded,
        className: cn(
          isArchived && "opacity-50 bg-gray-500/5",
          isExcluded && "opacity-50 border-dashed"
        ),
      };
    },
  };
}
