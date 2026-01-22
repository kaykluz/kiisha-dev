import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { 
  Eye, 
  FileText, 
  Target, 
  Layers, 
  Info,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';

// Evidence tier types
export type EvidenceTier = 1 | 2 | 3;

// Bounding box format for Tier 3 evidence
export interface BoundingBox {
  page: number;
  x: number;      // Percentage from left (0-100)
  y: number;      // Percentage from top (0-100)
  width: number;  // Percentage of page width
  height: number; // Percentage of page height
}

// Text anchor format for Tier 3 evidence
export interface TextAnchor {
  startOffset: number;
  endOffset: number;
  contextBefore?: string;
  contextAfter?: string;
}

// Evidence reference from database
export interface EvidenceRef {
  id: number;
  vatrFieldId: number;
  fieldName: string;
  fieldCluster: string;
  documentId: number;
  documentName: string;
  tier: EvidenceTier;
  sourcePage?: number;
  bbox?: BoundingBox;
  anchor?: TextAnchor;
  sourceSnippet?: string;
  confidence: number;
  selectionReason?: string;
  createdAt: Date;
}

// Props for the overlay component
interface EvidenceHighlightOverlayProps {
  evidenceRefs: EvidenceRef[];
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  onEvidenceClick?: (evidence: EvidenceRef) => void;
  onEvidenceHover?: (evidence: EvidenceRef | null) => void;
  selectedEvidenceId?: number;
  showTierBadges?: boolean;
  highlightColor?: string;
}

// Tier display configuration
const TIER_CONFIG = {
  1: {
    label: 'Document',
    color: 'bg-blue-500/20 border-blue-500',
    badgeColor: 'bg-blue-500',
    icon: FileText,
    description: 'Document-level evidence'
  },
  2: {
    label: 'Page',
    color: 'bg-amber-500/20 border-amber-500',
    badgeColor: 'bg-amber-500',
    icon: Layers,
    description: 'Page-level evidence'
  },
  3: {
    label: 'Exact',
    color: 'bg-green-500/20 border-green-500',
    badgeColor: 'bg-green-500',
    icon: Target,
    description: 'Exact location evidence'
  }
};

/**
 * EvidenceHighlightOverlay - Renders visual highlights for evidence references on a document page
 * 
 * Supports three tiers of evidence:
 * - Tier 1: Document-level (no visual highlight, just metadata)
 * - Tier 2: Page-level (page border highlight)
 * - Tier 3: Exact location (bbox overlay or text anchor highlight)
 */
export function EvidenceHighlightOverlay({
  evidenceRefs,
  currentPage,
  pageWidth,
  pageHeight,
  onEvidenceClick,
  onEvidenceHover,
  selectedEvidenceId,
  showTierBadges = true,
  highlightColor
}: EvidenceHighlightOverlayProps) {
  const [hoveredEvidence, setHoveredEvidence] = useState<EvidenceRef | null>(null);
  
  // Filter evidence for current page
  const pageEvidence = evidenceRefs.filter(e => {
    if (e.tier === 1) return true; // Document-level always shown
    if (e.tier === 2) return e.sourcePage === currentPage;
    if (e.tier === 3) return e.bbox?.page === currentPage || e.sourcePage === currentPage;
    return false;
  });
  
  // Group by tier for rendering order (Tier 3 on top)
  const tier3Evidence = pageEvidence.filter(e => e.tier === 3 && e.bbox);
  const tier2Evidence = pageEvidence.filter(e => e.tier === 2);
  
  const handleMouseEnter = useCallback((evidence: EvidenceRef) => {
    setHoveredEvidence(evidence);
    onEvidenceHover?.(evidence);
  }, [onEvidenceHover]);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredEvidence(null);
    onEvidenceHover?.(null);
  }, [onEvidenceHover]);
  
  const handleClick = useCallback((evidence: EvidenceRef) => {
    onEvidenceClick?.(evidence);
  }, [onEvidenceClick]);
  
  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ width: pageWidth, height: pageHeight }}
    >
      {/* Tier 2: Page-level highlight (border around page) */}
      {tier2Evidence.length > 0 && (
        <div 
          className={cn(
            "absolute inset-0 border-4 rounded-sm",
            TIER_CONFIG[2].color
          )}
          style={{ pointerEvents: 'none' }}
        />
      )}
      
      {/* Tier 3: Bbox highlights */}
      {tier3Evidence.map((evidence) => {
        if (!evidence.bbox) return null;
        
        const { x, y, width, height } = evidence.bbox;
        const isSelected = selectedEvidenceId === evidence.id;
        const isHovered = hoveredEvidence?.id === evidence.id;
        
        // Convert percentage to pixels
        const left = (x / 100) * pageWidth;
        const top = (y / 100) * pageHeight;
        const boxWidth = (width / 100) * pageWidth;
        const boxHeight = (height / 100) * pageHeight;
        
        return (
          <TooltipProvider key={evidence.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "absolute border-2 rounded-sm transition-all duration-200 cursor-pointer",
                    highlightColor || TIER_CONFIG[3].color,
                    isSelected && "ring-2 ring-accent ring-offset-2",
                    isHovered && "bg-green-500/30"
                  )}
                  style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${boxWidth}px`,
                    height: `${boxHeight}px`,
                    pointerEvents: 'auto'
                  }}
                  onMouseEnter={() => handleMouseEnter(evidence)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(evidence)}
                >
                  {/* Tier badge */}
                  {showTierBadges && (
                    <div className="absolute -top-6 left-0 flex items-center gap-1">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "text-[10px] px-1 py-0 text-white",
                          TIER_CONFIG[3].badgeColor
                        )}
                      >
                        <Target className="h-2.5 w-2.5 mr-0.5" />
                        T3
                      </Badge>
                      <span className="text-[10px] text-muted-foreground bg-background/80 px-1 rounded">
                        {evidence.fieldName}
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <EvidenceTooltip evidence={evidence} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

/**
 * EvidenceTooltip - Displays evidence details in a tooltip
 */
function EvidenceTooltip({ evidence }: { evidence: EvidenceRef }) {
  const tierConfig = TIER_CONFIG[evidence.tier];
  const TierIcon = tierConfig.icon;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TierIcon className="h-4 w-4" />
        <span className="font-medium">{evidence.fieldName}</span>
        <Badge variant="outline" className="text-[10px]">
          {tierConfig.label}
        </Badge>
      </div>
      
      {evidence.sourceSnippet && (
        <p className="text-xs text-muted-foreground italic">
          "{evidence.sourceSnippet}"
        </p>
      )}
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Confidence: {Math.round(evidence.confidence * 100)}%</span>
        {evidence.sourcePage && (
          <span>• Page {evidence.sourcePage}</span>
        )}
      </div>
      
      {evidence.selectionReason && (
        <p className="text-xs text-muted-foreground">
          {evidence.selectionReason}
        </p>
      )}
    </div>
  );
}

/**
 * EvidencePanel - Side panel showing all evidence for a field
 */
interface EvidencePanelProps {
  fieldName: string;
  fieldCluster: string;
  evidenceRefs: EvidenceRef[];
  onEvidenceSelect: (evidence: EvidenceRef) => void;
  selectedEvidenceId?: number;
  onClose: () => void;
}

export function EvidencePanel({
  fieldName,
  fieldCluster,
  evidenceRefs,
  onEvidenceSelect,
  selectedEvidenceId,
  onClose
}: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(true);
  
  // Sort by tier (highest first) then confidence
  const sortedEvidence = [...evidenceRefs].sort((a, b) => {
    if (a.tier !== b.tier) return b.tier - a.tier;
    return b.confidence - a.confidence;
  });
  
  // Get canonical (selected) evidence
  const canonicalEvidence = sortedEvidence[0];
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-accent" />
          <div>
            <h3 className="font-medium text-sm">{fieldName}</h3>
            <p className="text-xs text-muted-foreground">{fieldCluster}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Canonical evidence */}
      {canonicalEvidence && (
        <div className="p-3 border-b border-border bg-accent/5">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={cn("text-white", TIER_CONFIG[canonicalEvidence.tier].badgeColor)}>
              Canonical
            </Badge>
            <span className="text-xs text-muted-foreground">
              Tier {canonicalEvidence.tier} • {Math.round(canonicalEvidence.confidence * 100)}% confidence
            </span>
          </div>
          <p className="text-sm">{canonicalEvidence.documentName}</p>
          {canonicalEvidence.sourceSnippet && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              "{canonicalEvidence.sourceSnippet}"
            </p>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={() => onEvidenceSelect(canonicalEvidence)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Source
          </Button>
        </div>
      )}
      
      {/* All evidence list */}
      {sortedEvidence.length > 1 && (
        <div className="p-3">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {sortedEvidence.length - 1} other source{sortedEvidence.length > 2 ? 's' : ''}
          </button>
          
          {expanded && (
            <div className="space-y-2">
              {sortedEvidence.slice(1).map((evidence) => {
                const tierConfig = TIER_CONFIG[evidence.tier];
                const TierIcon = tierConfig.icon;
                const isSelected = selectedEvidenceId === evidence.id;
                
                return (
                  <div
                    key={evidence.id}
                    className={cn(
                      "p-2 rounded border cursor-pointer transition-colors",
                      isSelected 
                        ? "border-accent bg-accent/10" 
                        : "border-border hover:border-accent/50"
                    )}
                    onClick={() => onEvidenceSelect(evidence)}
                  >
                    <div className="flex items-center gap-2">
                      <TierIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{evidence.documentName}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        T{evidence.tier}
                      </Badge>
                    </div>
                    {evidence.sourcePage && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Page {evidence.sourcePage}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * EvidenceIndicator - Small inline indicator for evidence availability
 */
interface EvidenceIndicatorProps {
  tier: EvidenceTier;
  confidence: number;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function EvidenceIndicator({ 
  tier, 
  confidence, 
  onClick,
  size = 'sm'
}: EvidenceIndicatorProps) {
  const tierConfig = TIER_CONFIG[tier];
  const TierIcon = tierConfig.icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1 rounded-full transition-colors",
              "hover:bg-accent/20",
              size === 'sm' ? "px-1.5 py-0.5" : "px-2 py-1"
            )}
            onClick={onClick}
          >
            <TierIcon className={cn(
              "text-muted-foreground",
              size === 'sm' ? "h-3 w-3" : "h-4 w-4"
            )} />
            <span className={cn(
              "text-muted-foreground",
              size === 'sm' ? "text-[10px]" : "text-xs"
            )}>
              T{tier}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {tierConfig.description}
            <br />
            Confidence: {Math.round(confidence * 100)}%
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * EvidenceFieldBadge - Badge showing evidence status for a VATR field
 */
interface EvidenceFieldBadgeProps {
  hasEvidence: boolean;
  tier?: EvidenceTier;
  confidence?: number;
  onClick?: () => void;
}

export function EvidenceFieldBadge({
  hasEvidence,
  tier,
  confidence,
  onClick
}: EvidenceFieldBadgeProps) {
  if (!hasEvidence) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        No source
      </Badge>
    );
  }
  
  const tierConfig = tier ? TIER_CONFIG[tier] : null;
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "text-[10px] cursor-pointer hover:bg-accent/20",
        tierConfig && tierConfig.badgeColor,
        tierConfig && "text-white"
      )}
      onClick={onClick}
    >
      <Eye className="h-2.5 w-2.5 mr-0.5" />
      {tier ? `T${tier}` : 'Source'}
      {confidence && ` • ${Math.round(confidence * 100)}%`}
    </Badge>
  );
}
