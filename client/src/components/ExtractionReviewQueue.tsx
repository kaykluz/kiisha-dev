import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  CheckCircle2, XCircle, Edit3, AlertTriangle, FileText, 
  ChevronRight, Filter, RefreshCw, Sparkles, Eye, Clock,
  ThumbsUp, ThumbsDown, MoreHorizontal, Loader2
} from "lucide-react";

interface Extraction {
  id: number;
  artifactId: number;
  artifactName: string;
  artifactCode: string;
  fieldKey: string;
  fieldLabel: string;
  category: string;
  extractedValue: string | number | boolean | null;
  valueType: 'text' | 'numeric' | 'boolean' | 'date' | 'json';
  confidence: number;
  sourceLocation?: string;
  verificationStatus: 'unverified' | 'verified' | 'corrected' | 'rejected';
  extractedAt: Date;
}

// Mock data for demonstration
const mockExtractions: Extraction[] = [
  {
    id: 1,
    artifactId: 101,
    artifactName: 'PPA Agreement - Saratoga.pdf',
    artifactCode: 'ART-2026-00042',
    fieldKey: 'contract_value',
    fieldLabel: 'Contract Value',
    category: 'financial',
    extractedValue: 2500000,
    valueType: 'numeric',
    confidence: 0.92,
    sourceLocation: 'Page 3, Section 4.1',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T10:30:00'),
  },
  {
    id: 2,
    artifactId: 101,
    artifactName: 'PPA Agreement - Saratoga.pdf',
    artifactCode: 'ART-2026-00042',
    fieldKey: 'contract_start_date',
    fieldLabel: 'Contract Start Date',
    category: 'terms',
    extractedValue: '2026-03-01',
    valueType: 'date',
    confidence: 0.98,
    sourceLocation: 'Page 1, Section 1.2',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T10:30:00'),
  },
  {
    id: 3,
    artifactId: 101,
    artifactName: 'PPA Agreement - Saratoga.pdf',
    artifactCode: 'ART-2026-00042',
    fieldKey: 'ppa_rate',
    fieldLabel: 'PPA Rate ($/kWh)',
    category: 'financial',
    extractedValue: 0.085,
    valueType: 'numeric',
    confidence: 0.88,
    sourceLocation: 'Page 5, Exhibit A',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T10:30:00'),
  },
  {
    id: 4,
    artifactId: 102,
    artifactName: 'Site Survey Report.pdf',
    artifactCode: 'ART-2026-00043',
    fieldKey: 'site_area_acres',
    fieldLabel: 'Site Area (Acres)',
    category: 'technical',
    extractedValue: 45.2,
    valueType: 'numeric',
    confidence: 0.95,
    sourceLocation: 'Page 2, Table 1',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T11:00:00'),
  },
  {
    id: 5,
    artifactId: 102,
    artifactName: 'Site Survey Report.pdf',
    artifactCode: 'ART-2026-00043',
    fieldKey: 'solar_irradiance',
    fieldLabel: 'Annual Solar Irradiance (kWh/m²)',
    category: 'technical',
    extractedValue: 1650,
    valueType: 'numeric',
    confidence: 0.72,
    sourceLocation: 'Page 4, Section 3.2',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T11:00:00'),
  },
  {
    id: 6,
    artifactId: 103,
    artifactName: 'Equipment Spec Sheet.pdf',
    artifactCode: 'ART-2026-00044',
    fieldKey: 'panel_efficiency',
    fieldLabel: 'Panel Efficiency (%)',
    category: 'technical',
    extractedValue: 21.5,
    valueType: 'numeric',
    confidence: 0.99,
    sourceLocation: 'Page 1, Specifications',
    verificationStatus: 'verified',
    extractedAt: new Date('2026-01-13T14:00:00'),
  },
  {
    id: 7,
    artifactId: 103,
    artifactName: 'Equipment Spec Sheet.pdf',
    artifactCode: 'ART-2026-00044',
    fieldKey: 'warranty_years',
    fieldLabel: 'Warranty Period (Years)',
    category: 'terms',
    extractedValue: 25,
    valueType: 'numeric',
    confidence: 0.97,
    sourceLocation: 'Page 2, Warranty Section',
    verificationStatus: 'verified',
    extractedAt: new Date('2026-01-13T14:00:00'),
  },
  {
    id: 8,
    artifactId: 104,
    artifactName: 'Interconnection Agreement.pdf',
    artifactCode: 'ART-2026-00045',
    fieldKey: 'interconnection_capacity',
    fieldLabel: 'Interconnection Capacity (MW)',
    category: 'technical',
    extractedValue: 12.5,
    valueType: 'numeric',
    confidence: 0.65,
    sourceLocation: 'Page 8, Exhibit B',
    verificationStatus: 'unverified',
    extractedAt: new Date('2026-01-14T09:00:00'),
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  financial: 'bg-green-500/10 text-green-500 border-green-500/20',
  technical: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  terms: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  identity: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  compliance: 'bg-red-500/10 text-red-500 border-red-500/20',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-500';
  if (confidence >= 0.7) return 'text-amber-500';
  return 'text-red-500';
}

function formatValue(value: string | number | boolean | null, valueType: string): string {
  if (value === null) return '—';
  if (valueType === 'numeric' && typeof value === 'number') {
    return value.toLocaleString();
  }
  if (valueType === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

interface ExtractionReviewQueueProps {
  organizationId?: number;
}

export function ExtractionReviewQueue({ organizationId = 1 }: ExtractionReviewQueueProps) {
  const [extractions, setExtractions] = useState<Extraction[]>(mockExtractions);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('unverified');
  const [editingExtraction, setEditingExtraction] = useState<Extraction | null>(null);
  const [correctedValue, setCorrectedValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter extractions
  const filteredExtractions = extractions.filter(e => {
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (filterStatus !== 'all' && e.verificationStatus !== filterStatus) return false;
    if (filterConfidence === 'high' && e.confidence < 0.9) return false;
    if (filterConfidence === 'medium' && (e.confidence < 0.7 || e.confidence >= 0.9)) return false;
    if (filterConfidence === 'low' && e.confidence >= 0.7) return false;
    return true;
  });

  // Group by artifact
  const groupedByArtifact = filteredExtractions.reduce((acc, extraction) => {
    const key = extraction.artifactId;
    if (!acc[key]) {
      acc[key] = {
        artifactId: extraction.artifactId,
        artifactName: extraction.artifactName,
        artifactCode: extraction.artifactCode,
        extractions: [],
      };
    }
    acc[key].extractions.push(extraction);
    return acc;
  }, {} as Record<number, { artifactId: number; artifactName: string; artifactCode: string; extractions: Extraction[] }>);

  // Stats
  const stats = {
    total: extractions.length,
    unverified: extractions.filter(e => e.verificationStatus === 'unverified').length,
    verified: extractions.filter(e => e.verificationStatus === 'verified').length,
    corrected: extractions.filter(e => e.verificationStatus === 'corrected').length,
    rejected: extractions.filter(e => e.verificationStatus === 'rejected').length,
    highConfidence: extractions.filter(e => e.confidence >= 0.9).length,
    lowConfidence: extractions.filter(e => e.confidence < 0.7).length,
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const unverifiedIds = filteredExtractions
      .filter(e => e.verificationStatus === 'unverified')
      .map(e => e.id);
    setSelectedIds(new Set(unverifiedIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const verifyExtraction = (id: number) => {
    setExtractions(prev => prev.map(e => 
      e.id === id ? { ...e, verificationStatus: 'verified' as const } : e
    ));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const rejectExtraction = (id: number) => {
    setExtractions(prev => prev.map(e => 
      e.id === id ? { ...e, verificationStatus: 'rejected' as const } : e
    ));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const openCorrectDialog = (extraction: Extraction) => {
    setEditingExtraction(extraction);
    setCorrectedValue(String(extraction.extractedValue));
  };

  const submitCorrection = () => {
    if (!editingExtraction) return;
    
    let parsedValue: string | number | boolean = correctedValue;
    if (editingExtraction.valueType === 'numeric') {
      parsedValue = parseFloat(correctedValue);
    } else if (editingExtraction.valueType === 'boolean') {
      parsedValue = correctedValue.toLowerCase() === 'true' || correctedValue === '1';
    }
    
    setExtractions(prev => prev.map(e => 
      e.id === editingExtraction.id 
        ? { ...e, extractedValue: parsedValue, verificationStatus: 'corrected' as const } 
        : e
    ));
    setEditingExtraction(null);
    setCorrectedValue('');
  };

  const bulkVerify = async () => {
    setIsProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setExtractions(prev => prev.map(e => 
      selectedIds.has(e.id) ? { ...e, verificationStatus: 'verified' as const } : e
    ));
    setSelectedIds(new Set());
    setIsProcessing(false);
  };

  const bulkReject = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setExtractions(prev => prev.map(e => 
      selectedIds.has(e.id) ? { ...e, verificationStatus: 'rejected' as const } : e
    ));
    setSelectedIds(new Set());
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.unverified}</p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.verified}</p>
              <p className="text-xs text-muted-foreground">Verified</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Edit3 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.corrected}</p>
              <p className="text-xs text-muted-foreground">Corrected</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.lowConfidence}</p>
              <p className="text-xs text-muted-foreground">Low Confidence</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters and Bulk Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Extraction Review Queue</CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={bulkVerify}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-1" />
                    )}
                    Verify ({selectedIds.size})
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={bulkReject}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 mr-1" />
                    )}
                    Reject ({selectedIds.size})
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="corrected">Corrected</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="terms">Terms</SelectItem>
                <SelectItem value="identity">Identity</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterConfidence} onValueChange={setFilterConfidence}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High (≥90%)</SelectItem>
                <SelectItem value="medium">Medium (70-90%)</SelectItem>
                <SelectItem value="low">Low (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>

            {filterStatus === 'unverified' && filteredExtractions.length > 0 && (
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All Unverified
              </Button>
            )}
          </div>

          {/* Extraction List */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {Object.values(groupedByArtifact).map((group) => (
                <Card key={group.artifactId} className="overflow-hidden">
                  <div className="p-3 bg-muted/50 border-b flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{group.artifactName}</p>
                      <p className="text-xs text-muted-foreground">{group.artifactCode}</p>
                    </div>
                    <Badge variant="outline">{group.extractions.length} extractions</Badge>
                  </div>
                  <div className="divide-y">
                    {group.extractions.map((extraction) => (
                      <div 
                        key={extraction.id} 
                        className={`p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors ${
                          extraction.verificationStatus === 'unverified' ? '' : 'opacity-60'
                        }`}
                      >
                        {extraction.verificationStatus === 'unverified' && (
                          <Checkbox
                            checked={selectedIds.has(extraction.id)}
                            onCheckedChange={() => toggleSelect(extraction.id)}
                            className="mt-1"
                          />
                        )}
                        {extraction.verificationStatus !== 'unverified' && (
                          <div className="w-4 h-4 mt-1">
                            {extraction.verificationStatus === 'verified' && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            {extraction.verificationStatus === 'corrected' && (
                              <Edit3 className="h-4 w-4 text-blue-500" />
                            )}
                            {extraction.verificationStatus === 'rejected' && (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{extraction.fieldLabel}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${CATEGORY_COLORS[extraction.category] || ''}`}
                            >
                              {extraction.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-mono bg-muted px-2 py-0.5 rounded">
                              {formatValue(extraction.extractedValue, extraction.valueType)}
                            </span>
                            <span className={`text-xs ${getConfidenceColor(extraction.confidence)}`}>
                              {Math.round(extraction.confidence * 100)}% confidence
                            </span>
                            {extraction.sourceLocation && (
                              <span className="text-xs text-muted-foreground">
                                {extraction.sourceLocation}
                              </span>
                            )}
                          </div>
                        </div>

                        {extraction.verificationStatus === 'unverified' && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                              onClick={() => verifyExtraction(extraction.id)}
                              title="Verify"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              onClick={() => openCorrectDialog(extraction)}
                              title="Correct"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => rejectExtraction(extraction.id)}
                              title="Reject"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              {filteredExtractions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No extractions to review</p>
                  <p className="text-sm">All extractions matching your filters have been processed</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Correction Dialog */}
      <Dialog open={!!editingExtraction} onOpenChange={() => setEditingExtraction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Extraction</DialogTitle>
            <DialogDescription>
              Update the extracted value with the correct information
            </DialogDescription>
          </DialogHeader>
          
          {editingExtraction && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">{editingExtraction.fieldLabel}</p>
                <p className="text-xs text-muted-foreground mb-3">
                  From: {editingExtraction.artifactName}
                </p>
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Original Value</p>
                <p className="font-mono">
                  {formatValue(editingExtraction.extractedValue, editingExtraction.valueType)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Confidence: {Math.round(editingExtraction.confidence * 100)}%
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Corrected Value</p>
                <Input
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  type={editingExtraction.valueType === 'numeric' ? 'number' : 'text'}
                  placeholder="Enter correct value..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExtraction(null)}>
              Cancel
            </Button>
            <Button onClick={submitCorrection}>
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ExtractionReviewQueue;
