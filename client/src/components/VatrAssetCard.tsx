import { useState, useCallback } from 'react';
import { 
  Building2, Cpu, Activity, DollarSign, Shield, Briefcase,
  MapPin, Calendar, Zap, CheckCircle, AlertCircle, Clock,
  FileText, ExternalLink, ChevronDown, ChevronRight, Hash,
  Eye, EyeOff, Maximize2, Minimize2, Link2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EvidenceDocumentViewer } from '@/components/evidence/EvidenceDocumentViewer';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface VatrAsset {
  id: number;
  assetName: string;
  assetType: string;
  capacityKw?: string;
  technology?: string;
  locationLat?: string;
  locationLng?: string;
  locationAddress?: string;
  operationalStatus?: string;
  complianceStatus?: string;
  contentHash?: string;
  vatrVersion?: number;
  createdAt: Date;
  // Cluster data completeness
  identityComplete?: number;
  technicalComplete?: number;
  operationalComplete?: number;
  financialComplete?: number;
  complianceComplete?: number;
  commercialComplete?: number;
  // Full VATR fields (optional - loaded on demand)
  fullVatrData?: {
    identity?: Record<string, unknown>;
    technical?: Record<string, unknown>;
    operational?: Record<string, unknown>;
    financial?: Record<string, unknown>;
    compliance?: Record<string, unknown>;
    commercial?: Record<string, unknown>;
  };
}

interface VatrAssetCardProps {
  asset: VatrAsset;
  onVerify?: (assetId: number) => void;
  onGenerateDataRoom?: (assetId: number) => void;
  onViewDetails?: (assetId: number) => void;
  onLoadFullVatr?: (assetId: number) => Promise<void>;
  compact?: boolean;
  // View-controlled field visibility
  visibleFields?: string[];
  showAllFields?: boolean;
  // Evidence viewing
  showEvidenceLinks?: boolean;
}

const CLUSTERS = [
  { key: 'identity', label: 'Identity', icon: Building2, color: 'text-blue-400' },
  { key: 'technical', label: 'Technical', icon: Cpu, color: 'text-purple-400' },
  { key: 'operational', label: 'Operational', icon: Activity, color: 'text-green-400' },
  { key: 'financial', label: 'Financial', icon: DollarSign, color: 'text-yellow-400' },
  { key: 'compliance', label: 'Compliance', icon: Shield, color: 'text-red-400' },
  { key: 'commercial', label: 'Commercial', icon: Briefcase, color: 'text-orange-400' },
];

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'operational': return 'bg-success/20 text-success';
    case 'maintenance': return 'bg-warning/20 text-warning';
    case 'offline': return 'bg-destructive/20 text-destructive';
    case 'compliant': return 'bg-success/20 text-success';
    case 'at_risk': return 'bg-warning/20 text-warning';
    case 'non_compliant': return 'bg-destructive/20 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
};

// View mode for progressive disclosure
type ViewMode = 'summary' | 'expanded' | 'full';

export function VatrAssetCard({ 
  asset, 
  onVerify, 
  onGenerateDataRoom, 
  onViewDetails,
  onLoadFullVatr,
  compact = false,
  visibleFields,
  showAllFields = false,
  showEvidenceLinks = true
}: VatrAssetCardProps) {
  // Progressive disclosure state
  const [viewMode, setViewMode] = useState<ViewMode>(compact ? 'summary' : 'expanded');
  const [loadingFullVatr, setLoadingFullVatr] = useState(false);
  
  // Evidence viewer state
  const [evidenceViewerOpen, setEvidenceViewerOpen] = useState(false);
  const [selectedFieldForEvidence, setSelectedFieldForEvidence] = useState<{
    fieldRecordId: number;
    fieldRecordType: 'ai_extraction' | 'vatr_source' | 'asset_attribute';
    documentId: number;
    documentUrl: string;
    documentName: string;
    pageNumber?: number;
  } | null>(null);
  
  // Fetch best evidence for the asset (for showing View Source buttons)
  const { data: assetEvidence } = trpc.evidence.getBestBatch.useQuery(
    { fieldRecords: [{ id: asset.id, type: 'asset_attribute' }] },
    { enabled: showEvidenceLinks && !compact }
  );
  
  // Calculate overall completeness
  const clusterCompleteness = {
    identity: asset.identityComplete ?? 75,
    technical: asset.technicalComplete ?? 60,
    operational: asset.operationalComplete ?? 80,
    financial: asset.financialComplete ?? 45,
    compliance: asset.complianceComplete ?? 90,
    commercial: asset.commercialComplete ?? 55,
  };
  
  const overallCompleteness = Math.round(
    Object.values(clusterCompleteness).reduce((a, b) => a + b, 0) / 6
  );

  // Handle loading full VATR data
  const handleLoadFullVatr = async () => {
    if (viewMode === 'full') {
      setViewMode('expanded');
      return;
    }
    
    if (onLoadFullVatr) {
      setLoadingFullVatr(true);
      try {
        await onLoadFullVatr(asset.id);
        setViewMode('full');
      } finally {
        setLoadingFullVatr(false);
      }
    } else {
      setViewMode('full');
    }
  };

  // Cycle through view modes
  const cycleViewMode = () => {
    if (viewMode === 'summary') setViewMode('expanded');
    else if (viewMode === 'expanded') setViewMode('summary');
    else setViewMode('expanded');
  };
  
  if (compact) {
    return (
      <div 
        className="p-4 rounded-lg bg-card border border-border hover:border-accent/50 transition-colors cursor-pointer"
        onClick={() => onViewDetails?.(asset.id)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Zap className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">{asset.assetName}</h4>
              <p className="text-xs text-muted-foreground">
                {asset.assetType?.replace('_', ' ').toUpperCase()} • {asset.capacityKw} kW
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(asset.operationalStatus)}>
              {asset.operationalStatus || 'Unknown'}
            </Badge>
            <span className="text-sm font-medium text-foreground">{overallCompleteness}%</span>
          </div>
        </div>
        
        {/* Mini cluster indicators */}
        <div className="flex gap-1 mt-3">
          {CLUSTERS.map(cluster => {
            const completeness = clusterCompleteness[cluster.key as keyof typeof clusterCompleteness];
            return (
              <Tooltip key={cluster.key}>
                <TooltipTrigger asChild>
                  <div 
                    className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"
                  >
                    <div 
                      className={`h-full rounded-full ${
                        completeness >= 80 ? 'bg-success' : 
                        completeness >= 50 ? 'bg-warning' : 'bg-destructive'
                      }`}
                      style={{ width: `${completeness}%` }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{cluster.label}: {completeness}%</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }
  
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-accent/10">
              <Zap className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{asset.assetName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {asset.assetType?.replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {asset.capacityKw} kW
                </span>
                {asset.locationAddress && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {asset.locationAddress}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 mr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={cycleViewMode}
                  >
                    {viewMode === 'summary' ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {viewMode === 'summary' ? 'Show More' : 'Show Less'}
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={viewMode === 'full' ? 'secondary' : 'ghost'}
                    size="sm" 
                    className="h-7 w-7 p-0"
                    onClick={handleLoadFullVatr}
                    disabled={loadingFullVatr}
                  >
                    {viewMode === 'full' ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {viewMode === 'full' ? 'Exit Full VATR' : 'Full VATR View'}
                </TooltipContent>
              </Tooltip>
            </div>
            
            <Badge className={getStatusColor(asset.operationalStatus)}>
              {asset.operationalStatus || 'Unknown'}
            </Badge>
            <Badge className={getStatusColor(asset.complianceStatus)}>
              {asset.complianceStatus?.replace('_', ' ') || 'Pending'}
            </Badge>
          </div>
        </div>
        
        {/* Overall Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Data Completeness</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground capitalize">
                {viewMode} view
              </span>
              <span className="text-sm font-medium text-foreground">{overallCompleteness}%</span>
            </div>
          </div>
          <Progress value={overallCompleteness} className="h-2" />
        </div>
      </div>
      
      {/* Cluster Sections - Progressive Disclosure */}
      <div className="p-4">
        {viewMode === 'summary' && (
          <button
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setViewMode('expanded')}
          >
            <ChevronRight className="h-4 w-4" />
            Show 6 Data Clusters
          </button>
        )}
        
        {viewMode === 'expanded' && (
          <>
            <button
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
              onClick={() => setViewMode('summary')}
            >
              <ChevronDown className="h-4 w-4" />
              6 Data Clusters
            </button>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {CLUSTERS.map(cluster => {
                const Icon = cluster.icon;
                const completeness = clusterCompleteness[cluster.key as keyof typeof clusterCompleteness];
                return (
                  <div 
                    key={cluster.key}
                    className="p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`h-4 w-4 ${cluster.color}`} />
                      <span className="text-sm font-medium text-foreground">{cluster.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={completeness} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{completeness}%</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {completeness >= 80 ? (
                        <CheckCircle className="h-3 w-3 text-success" />
                      ) : completeness >= 50 ? (
                        <Clock className="h-3 w-3 text-warning" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {completeness >= 80 ? 'Complete' : completeness >= 50 ? 'In Progress' : 'Needs Data'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        
        {viewMode === 'full' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-accent" />
                <span className="text-sm font-medium text-foreground">Full VATR View</span>
              </div>
              <Badge variant="outline" className="text-xs">
                All RBAC-allowed fields
              </Badge>
            </div>
            
            {/* Full VATR - All 6 Clusters with Details */}
            <div className="space-y-4">
              {CLUSTERS.map(cluster => {
                const Icon = cluster.icon;
                const completeness = clusterCompleteness[cluster.key as keyof typeof clusterCompleteness];
                const clusterData = asset.fullVatrData?.[cluster.key as keyof typeof asset.fullVatrData];
                
                return (
                  <div 
                    key={cluster.key}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-5 w-5 ${cluster.color}`} />
                        <span className="font-medium text-foreground">{cluster.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={completeness} className="h-1.5 w-20" />
                        <span className="text-xs text-muted-foreground">{completeness}%</span>
                      </div>
                    </div>
                    
                    {/* Cluster Fields */}
                    {clusterData ? (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(clusterData).map(([key, value]) => {
                          // Filter by visibleFields if provided
                          if (visibleFields && !showAllFields && !visibleFields.includes(`${cluster.key}.${key}`)) {
                            return null;
                          }
                          return (
                            <div key={key} className="flex justify-between py-1 border-b border-border/30">
                              <span className="text-muted-foreground capitalize">
                                {key.replace(/_/g, ' ')}
                              </span>
                              <span className="text-foreground font-medium">
                                {value !== null && value !== undefined ? String(value) : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        {loadingFullVatr ? 'Loading...' : 'No detailed data available'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      
      {/* Footer with Hash & Actions */}
      <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Hash className="h-3 w-3" />
          <span className="font-mono">{asset.contentHash?.substring(0, 16)}...</span>
          <span>•</span>
          <span>v{asset.vatrVersion || 1}</span>
          {/* View Source indicator if evidence exists */}
          {showEvidenceLinks && assetEvidence && Object.keys(assetEvidence).length > 0 && (
            <>
              <span>•</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="flex items-center gap-1 text-accent hover:text-accent/80 transition-colors"
                    onClick={() => {
                      const firstEvidence = Object.values(assetEvidence)[0] as any;
                      if (firstEvidence) {
                        setSelectedFieldForEvidence({
                          fieldRecordId: asset.id,
                          fieldRecordType: 'asset_attribute',
                          documentId: firstEvidence.documentId,
                          documentUrl: firstEvidence.documentUrl || '',
                          documentName: firstEvidence.documentName || 'Source Document',
                          pageNumber: firstEvidence.pageNumber,
                        });
                        setEvidenceViewerOpen(true);
                      }
                    }}
                  >
                    <Link2 className="h-3 w-3" />
                    <span>View Source</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View source document with evidence highlighting</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onVerify?.(asset.id)}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Verify
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onGenerateDataRoom?.(asset.id)}
          >
            <FileText className="h-4 w-4 mr-1" />
            Data Room
          </Button>
          <Button 
            variant="default" 
            size="sm"
            onClick={() => onViewDetails?.(asset.id)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Details
          </Button>
        </div>
      </div>
      
      {/* Evidence Document Viewer Dialog */}
      <Dialog open={evidenceViewerOpen} onOpenChange={setEvidenceViewerOpen}>
        <DialogContent className="max-w-5xl h-[80vh] p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-accent" />
              Source Evidence - {asset.assetName}
            </DialogTitle>
          </DialogHeader>
          {selectedFieldForEvidence && (
            <EvidenceDocumentViewer
              documentId={selectedFieldForEvidence.documentId}
              documentUrl={selectedFieldForEvidence.documentUrl}
              documentName={selectedFieldForEvidence.documentName}
              fieldRecordId={selectedFieldForEvidence.fieldRecordId}
              fieldRecordType={selectedFieldForEvidence.fieldRecordType}
              initialPage={selectedFieldForEvidence.pageNumber}
              height="calc(80vh - 60px)"
              onClose={() => setEvidenceViewerOpen(false)}
              showEvidencePanel={true}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
