import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Filter, X } from "lucide-react";

// Asset Classification Options
export const ASSET_CLASSIFICATIONS = [
  { value: "residential", label: "Residential", description: "Home solar systems" },
  { value: "small_commercial", label: "Small Commercial", description: "Small business installations" },
  { value: "large_commercial", label: "Large Commercial", description: "Large C&I projects" },
  { value: "industrial", label: "Industrial", description: "Industrial-scale installations" },
  { value: "mini_grid", label: "Mini-Grid", description: "Isolated mini-grid systems" },
  { value: "mesh_grid", label: "Mesh Grid", description: "Interconnected mesh topology" },
  { value: "interconnected_mini_grids", label: "Interconnected Mini-Grids", description: "Multiple connected mini-grids" },
  { value: "grid_connected", label: "Grid Connected", description: "Utility-scale grid-connected" },
] as const;

// Grid Connection Types
export const GRID_CONNECTION_TYPES = [
  { value: "off_grid", label: "Off-Grid", description: "No grid connection" },
  { value: "grid_connected", label: "Grid Connected", description: "Direct grid connection" },
  { value: "grid_tied_with_backup", label: "Grid-Tied + Backup", description: "Grid with battery backup" },
  { value: "mini_grid", label: "Mini-Grid", description: "Local mini-grid network" },
  { value: "interconnected_mini_grid", label: "Interconnected Mini-Grid", description: "Connected mini-grids" },
  { value: "mesh_grid", label: "Mesh Grid", description: "Mesh network topology" },
] as const;

// Configuration Profiles
export const CONFIGURATION_PROFILES = [
  { value: "PV_ONLY", label: "PV Only", description: "Solar PV without storage" },
  { value: "PV_BESS", label: "PV + BESS", description: "Solar with battery storage" },
  { value: "PV_DG", label: "PV + DG", description: "Solar with diesel generator" },
  { value: "PV_BESS_DG", label: "PV + BESS + DG", description: "Hybrid system" },
  { value: "BESS_ONLY", label: "BESS Only", description: "Standalone battery storage" },
  { value: "DG_ONLY", label: "DG Only", description: "Diesel generator only" },
  { value: "MINIGRID_PV_BESS", label: "Mini-Grid (PV+BESS)", description: "Mini-grid with solar and battery" },
  { value: "MINIGRID_PV_BESS_DG", label: "Mini-Grid (PV+BESS+DG)", description: "Full hybrid mini-grid" },
  { value: "WIND_ONLY", label: "Wind Only", description: "Wind turbine system" },
  { value: "WIND_BESS", label: "Wind + BESS", description: "Wind with battery storage" },
  { value: "HYBRID_WIND_PV", label: "Hybrid Wind+PV", description: "Combined wind and solar" },
] as const;

export interface AssetFilters {
  classifications: string[];
  gridConnectionTypes: string[];
  configurationProfiles: string[];
}

interface AssetClassificationFilterProps {
  filters: AssetFilters;
  onChange: (filters: AssetFilters) => void;
  compact?: boolean;
}

export function AssetClassificationFilter({
  filters,
  onChange,
  compact = false,
}: AssetClassificationFilterProps) {
  const [open, setOpen] = useState(false);

  const totalFilters =
    filters.classifications.length +
    filters.gridConnectionTypes.length +
    filters.configurationProfiles.length;

  const toggleFilter = (
    category: keyof AssetFilters,
    value: string
  ) => {
    const current = filters[category];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [category]: updated });
  };

  const clearAll = () => {
    onChange({
      classifications: [],
      gridConnectionTypes: [],
      configurationProfiles: [],
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {compact ? null : "Filter"}
          {totalFilters > 0 && (
            <Badge variant="secondary" className="ml-1">
              {totalFilters}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[500px] overflow-y-auto" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Asset Filters</h4>
            {totalFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-auto p-1 text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {/* Classification */}
          <div>
            <Label className="text-sm font-medium">Classification</Label>
            <div className="mt-2 space-y-2">
              {ASSET_CLASSIFICATIONS.map((item) => (
                <div key={item.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`class-${item.value}`}
                    checked={filters.classifications.includes(item.value)}
                    onCheckedChange={() =>
                      toggleFilter("classifications", item.value)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={`class-${item.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Grid Connection Type */}
          <div>
            <Label className="text-sm font-medium">Grid Connection</Label>
            <div className="mt-2 space-y-2">
              {GRID_CONNECTION_TYPES.map((item) => (
                <div key={item.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`grid-${item.value}`}
                    checked={filters.gridConnectionTypes.includes(item.value)}
                    onCheckedChange={() =>
                      toggleFilter("gridConnectionTypes", item.value)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={`grid-${item.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Configuration Profile */}
          <div>
            <Label className="text-sm font-medium">Configuration Profile</Label>
            <div className="mt-2 space-y-2">
              {CONFIGURATION_PROFILES.map((item) => (
                <div key={item.value} className="flex items-start space-x-2">
                  <Checkbox
                    id={`config-${item.value}`}
                    checked={filters.configurationProfiles.includes(item.value)}
                    onCheckedChange={() =>
                      toggleFilter("configurationProfiles", item.value)
                    }
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label
                      htmlFor={`config-${item.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Active filter badges component
export function ActiveFilterBadges({
  filters,
  onRemove,
}: {
  filters: AssetFilters;
  onRemove: (category: keyof AssetFilters, value: string) => void;
}) {
  const allFilters: { category: keyof AssetFilters; value: string; label: string }[] = [];

  filters.classifications.forEach((v) => {
    const item = ASSET_CLASSIFICATIONS.find((c) => c.value === v);
    if (item) allFilters.push({ category: "classifications", value: v, label: item.label });
  });

  filters.gridConnectionTypes.forEach((v) => {
    const item = GRID_CONNECTION_TYPES.find((c) => c.value === v);
    if (item) allFilters.push({ category: "gridConnectionTypes", value: v, label: item.label });
  });

  filters.configurationProfiles.forEach((v) => {
    const item = CONFIGURATION_PROFILES.find((c) => c.value === v);
    if (item) allFilters.push({ category: "configurationProfiles", value: v, label: item.label });
  });

  if (allFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {allFilters.map((filter) => (
        <Badge
          key={`${filter.category}-${filter.value}`}
          variant="secondary"
          className="gap-1 pr-1"
        >
          {filter.label}
          <button
            onClick={() => onRemove(filter.category, filter.value)}
            className="ml-1 rounded-full hover:bg-muted p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
