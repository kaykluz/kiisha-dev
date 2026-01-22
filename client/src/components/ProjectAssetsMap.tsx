/**
 * Project Assets Map
 * 
 * Displays project-level assets (investable units) on a map.
 * Supports filtering by classification, country, status, etc.
 */

import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRef, useCallback, useState, useEffect } from "react";
import { X, Zap, MapPin, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CLASSIFICATION_LABELS,
  CONFIG_LABELS,
  STATUS_LABELS,
  type ProjectClassificationFilters
} from "./ProjectClassificationCharts";

// Status colors for map markers
const STATUS_COLORS: Record<string, string> = {
  operational: "#10B981", // green
  construction: "#F59E0B", // amber
  development: "#3B82F6", // blue
  prospecting: "#8B5CF6", // purple
  decommissioned: "#6B7280", // gray
};

// Classification colors for markers
const CLASSIFICATION_COLORS: Record<string, string> = {
  residential: "#EC4899", // pink
  small_commercial: "#14B8A6", // teal
  large_commercial: "#3B82F6", // blue
  industrial: "#F97316", // orange
  mini_grid: "#10B981", // emerald
  mesh_grid: "#8B5CF6", // purple
  interconnected_mini_grids: "#6366F1", // indigo
  grid_connected: "#84CC16", // lime
};

interface ProjectAssetsMapProps {
  filters?: ProjectClassificationFilters;
  colorBy?: "status" | "classification";
  onProjectSelect?: (project: any) => void;
  className?: string;
  height?: string;
}

export function ProjectAssetsMap({ 
  filters, 
  colorBy = "status",
  onProjectSelect,
  className,
  height = "400px"
}: ProjectAssetsMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  
  const { data: projects, isLoading } = trpc.projects.listWithFilters.useQuery(
    filters && Object.keys(filters).length > 0 ? filters : undefined
  );
  
  // Filter to only projects with coordinates
  const mappableProjects = projects?.filter(
    (p: any) => p.latitude && p.longitude
  ) || [];

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);
  
  // Update markers when projects change
  useEffect(() => {
    if (!mapRef.current || !mappableProjects.length) return;
    
    const map = mapRef.current;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.map = null);
    markersRef.current = [];
    
    // Create bounds to fit all markers
    const bounds = new google.maps.LatLngBounds();
    
    // Add markers for each project
    mappableProjects.forEach((project: any) => {
      const position = { 
        lat: Number(project.latitude), 
        lng: Number(project.longitude) 
      };
      bounds.extend(position);
      
      // Get color based on colorBy setting
      const color = colorBy === "classification" 
        ? CLASSIFICATION_COLORS[project.assetClassification] || "#F97316"
        : STATUS_COLORS[project.status] || "#F97316";
      
      // Create custom marker element
      const markerContent = document.createElement('div');
      markerContent.className = 'project-marker';
      markerContent.innerHTML = `
        <div class="w-7 h-7 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110" 
             style="background: ${color};">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        </div>
      `;
      
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        content: markerContent,
        title: project.name,
      });
      
      marker.addListener('click', () => {
        setSelectedProject(project);
        onProjectSelect?.(project);
        map.panTo(position);
        map.setZoom(10);
      });
      
      markersRef.current.push(marker);
    });
    
    if (markersRef.current.length > 1) {
      map.fitBounds(bounds, 50);
    } else if (markersRef.current.length === 1 && mappableProjects[0]) {
      map.setCenter({
        lat: Number(mappableProjects[0].latitude),
        lng: Number(mappableProjects[0].longitude)
      });
      map.setZoom(8);
    }
  }, [mappableProjects, colorBy, onProjectSelect]);
  
  // Calculate center
  const centerLat = mappableProjects.length > 0 
    ? mappableProjects.reduce((sum: number, p: any) => sum + Number(p.latitude), 0) / mappableProjects.length 
    : 6.5244; // Default to Nigeria
  const centerLng = mappableProjects.length > 0 
    ? mappableProjects.reduce((sum: number, p: any) => sum + Number(p.longitude), 0) / mappableProjects.length 
    : 3.3792;
  
  if (isLoading) {
    return <Skeleton className={cn("rounded-lg", className)} style={{ height }} />;
  }
  
  return (
    <div className={cn("relative", className)} style={{ height }}>
      <MapView
        className="h-full rounded-lg"
        initialCenter={{ lat: centerLat, lng: centerLng }}
        initialZoom={5}
        onMapReady={handleMapReady}
      />
      
      {/* Map legend */}
      <div className="absolute top-3 right-3 bg-[var(--color-bg-surface)]/95 backdrop-blur border border-[var(--color-border-subtle)] rounded-lg p-2 shadow-lg">
        <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
          {colorBy === "status" ? "By Status" : "By Classification"}
        </div>
        <div className="space-y-1">
          {colorBy === "status" ? (
            <>
              <LegendItem color={STATUS_COLORS.operational} label="Operational" />
              <LegendItem color={STATUS_COLORS.construction} label="Construction" />
              <LegendItem color={STATUS_COLORS.development} label="Development" />
              <LegendItem color={STATUS_COLORS.prospecting} label="Prospecting" />
            </>
          ) : (
            <>
              <LegendItem color={CLASSIFICATION_COLORS.industrial} label="Industrial" />
              <LegendItem color={CLASSIFICATION_COLORS.large_commercial} label="Commercial" />
              <LegendItem color={CLASSIFICATION_COLORS.mini_grid} label="Mini-Grid" />
              <LegendItem color={CLASSIFICATION_COLORS.grid_connected} label="Grid Connected" />
            </>
          )}
        </div>
      </div>
      
      {/* Asset count badge */}
      <div className="absolute top-3 left-3 bg-[var(--color-bg-surface)]/95 backdrop-blur border border-[var(--color-border-subtle)] rounded-lg px-2.5 py-1.5 shadow-lg">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          {mappableProjects.length}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)] ml-1">
          assets on map
        </span>
      </div>
      
      {/* Selected project popup */}
      {selectedProject && (
        <div className="absolute bottom-3 left-3 right-3 bg-[var(--color-bg-surface)]/95 backdrop-blur border border-[var(--color-border-subtle)] rounded-lg p-3 shadow-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                {selectedProject.name}
              </h4>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {selectedProject.city && `${selectedProject.city}, `}
                {selectedProject.country}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {selectedProject.technology} • {selectedProject.capacityMw} MW
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs capitalize",
                    selectedProject.status === "operational" && "bg-green-500/10 text-green-400 border-green-500/30",
                    selectedProject.status === "construction" && "bg-amber-500/10 text-amber-400 border-amber-500/30",
                    selectedProject.status === "development" && "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  )}
                >
                  {STATUS_LABELS[selectedProject.status] || selectedProject.status}
                </Badge>
                {selectedProject.assetClassification && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {CLASSIFICATION_LABELS[selectedProject.assetClassification] || selectedProject.assetClassification}
                  </Badge>
                )}
              </div>
            </div>
            <button 
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] ml-2"
              onClick={() => setSelectedProject(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div 
        className="w-2.5 h-2.5 rounded-full" 
        style={{ backgroundColor: color }} 
      />
      <span className="text-[10px] text-[var(--color-text-tertiary)]">{label}</span>
    </div>
  );
}
