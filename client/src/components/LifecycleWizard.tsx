import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle2, Circle, ChevronRight, AlertTriangle, Lock,
  ArrowRight, FileText, Calendar, DollarSign, MapPin, Zap,
  Building2, Users, Shield, Loader2, Sparkles, Clock
} from "lucide-react";

interface Milestone {
  key: string;
  label: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  required: boolean;
}

interface RequiredAttribute {
  key: string;
  label: string;
  category: string;
  filled: boolean;
  value?: string | number;
}

interface LifecycleStage {
  key: string;
  name: string;
  description: string;
  order: number;
  icon: React.ReactNode;
  color: string;
  milestones: Milestone[];
  requiredAttributes: RequiredAttribute[];
}

// Mock lifecycle stages data
const mockStages: LifecycleStage[] = [
  {
    key: 'origination',
    name: 'Origination',
    description: 'Initial project identification and preliminary assessment',
    order: 1,
    icon: <Sparkles className="h-5 w-5" />,
    color: 'text-purple-500 bg-purple-500/10',
    milestones: [
      { key: 'site_identified', label: 'Site Identified', description: 'Location and basic site info documented', completed: true, completedAt: new Date('2025-11-01'), completedBy: 'John Smith', required: true },
      { key: 'initial_assessment', label: 'Initial Assessment', description: 'Preliminary feasibility completed', completed: true, completedAt: new Date('2025-11-15'), completedBy: 'Jane Doe', required: true },
      { key: 'landowner_contact', label: 'Landowner Contact', description: 'Initial contact with landowner established', completed: true, completedAt: new Date('2025-11-20'), completedBy: 'John Smith', required: true },
    ],
    requiredAttributes: [
      { key: 'site_name', label: 'Site Name', category: 'identity', filled: true, value: 'Saratoga Solar' },
      { key: 'location', label: 'Location', category: 'location', filled: true, value: 'Saratoga, NY' },
      { key: 'estimated_capacity', label: 'Estimated Capacity', category: 'technical', filled: true, value: '12.5 MW' },
    ],
  },
  {
    key: 'development',
    name: 'Development',
    description: 'Site development, permitting, and interconnection',
    order: 2,
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-blue-500 bg-blue-500/10',
    milestones: [
      { key: 'site_control', label: 'Site Control', description: 'Land lease or purchase agreement signed', completed: true, completedAt: new Date('2025-12-01'), completedBy: 'Legal Team', required: true },
      { key: 'interconnection_app', label: 'Interconnection Application', description: 'Application submitted to utility', completed: true, completedAt: new Date('2025-12-15'), completedBy: 'Engineering', required: true },
      { key: 'permit_applications', label: 'Permit Applications', description: 'All required permits submitted', completed: false, required: true },
      { key: 'environmental_review', label: 'Environmental Review', description: 'Environmental impact assessment complete', completed: false, required: true },
    ],
    requiredAttributes: [
      { key: 'lease_terms', label: 'Lease Terms', category: 'financial', filled: true, value: '25 years' },
      { key: 'interconnection_capacity', label: 'Interconnection Capacity', category: 'technical', filled: true, value: '12.5 MW' },
      { key: 'permit_status', label: 'Permit Status', category: 'compliance', filled: false },
    ],
  },
  {
    key: 'due_diligence',
    name: 'Due Diligence',
    description: 'Technical, legal, and financial due diligence',
    order: 3,
    icon: <FileText className="h-5 w-5" />,
    color: 'text-amber-500 bg-amber-500/10',
    milestones: [
      { key: 'technical_dd', label: 'Technical Due Diligence', description: 'Engineering review and validation', completed: false, required: true },
      { key: 'legal_dd', label: 'Legal Due Diligence', description: 'Contract and title review', completed: false, required: true },
      { key: 'financial_model', label: 'Financial Model', description: 'Complete project pro forma', completed: false, required: true },
      { key: 'offtake_agreement', label: 'Offtake Agreement', description: 'PPA or other offtake secured', completed: false, required: true },
    ],
    requiredAttributes: [
      { key: 'ppa_rate', label: 'PPA Rate', category: 'financial', filled: false },
      { key: 'ppa_term', label: 'PPA Term', category: 'financial', filled: false },
      { key: 'irr_target', label: 'IRR Target', category: 'financial', filled: false },
    ],
  },
  {
    key: 'construction',
    name: 'Construction',
    description: 'EPC procurement and construction phase',
    order: 4,
    icon: <Zap className="h-5 w-5" />,
    color: 'text-orange-500 bg-orange-500/10',
    milestones: [
      { key: 'epc_contract', label: 'EPC Contract', description: 'EPC agreement executed', completed: false, required: true },
      { key: 'equipment_procurement', label: 'Equipment Procurement', description: 'Major equipment ordered', completed: false, required: true },
      { key: 'construction_start', label: 'Construction Start', description: 'Site work commenced', completed: false, required: true },
      { key: 'substantial_completion', label: 'Substantial Completion', description: 'Construction substantially complete', completed: false, required: true },
    ],
    requiredAttributes: [
      { key: 'epc_contractor', label: 'EPC Contractor', category: 'identity', filled: false },
      { key: 'construction_cost', label: 'Construction Cost', category: 'financial', filled: false },
      { key: 'cod_target', label: 'COD Target Date', category: 'schedule', filled: false },
    ],
  },
  {
    key: 'commissioning',
    name: 'Commissioning',
    description: 'Testing, commissioning, and commercial operation',
    order: 5,
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-green-500 bg-green-500/10',
    milestones: [
      { key: 'mechanical_completion', label: 'Mechanical Completion', description: 'All equipment installed', completed: false, required: true },
      { key: 'testing_complete', label: 'Testing Complete', description: 'Performance testing passed', completed: false, required: true },
      { key: 'utility_approval', label: 'Utility Approval', description: 'Permission to operate received', completed: false, required: true },
      { key: 'cod', label: 'Commercial Operation', description: 'COD achieved', completed: false, required: true },
    ],
    requiredAttributes: [
      { key: 'actual_capacity', label: 'Actual Capacity', category: 'technical', filled: false },
      { key: 'cod_date', label: 'COD Date', category: 'schedule', filled: false },
      { key: 'performance_ratio', label: 'Performance Ratio', category: 'technical', filled: false },
    ],
  },
  {
    key: 'operations',
    name: 'Operations',
    description: 'Ongoing operations and asset management',
    order: 6,
    icon: <Shield className="h-5 w-5" />,
    color: 'text-emerald-500 bg-emerald-500/10',
    milestones: [
      { key: 'om_contract', label: 'O&M Contract', description: 'O&M agreement in place', completed: false, required: true },
      { key: 'monitoring_active', label: 'Monitoring Active', description: 'SCADA/monitoring operational', completed: false, required: true },
      { key: 'first_revenue', label: 'First Revenue', description: 'First payment received', completed: false, required: false },
    ],
    requiredAttributes: [
      { key: 'om_provider', label: 'O&M Provider', category: 'identity', filled: false },
      { key: 'annual_production', label: 'Annual Production Target', category: 'technical', filled: false },
    ],
  },
];

interface LifecycleWizardProps {
  projectId?: number;
  currentStageKey?: string;
}

export function LifecycleWizard({ projectId = 1, currentStageKey = 'development' }: LifecycleWizardProps) {
  const [stages] = useState<LifecycleStage[]>(mockStages);
  const [selectedStageKey, setSelectedStageKey] = useState<string>(currentStageKey);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [transitionNotes, setTransitionNotes] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentStageIndex = stages.findIndex(s => s.key === currentStageKey);
  const selectedStage = stages.find(s => s.key === selectedStageKey);
  const nextStage = stages[currentStageIndex + 1];

  // Calculate stage completion
  const getStageCompletion = (stage: LifecycleStage) => {
    const requiredMilestones = stage.milestones.filter(m => m.required);
    const completedRequired = requiredMilestones.filter(m => m.completed).length;
    const milestoneProgress = requiredMilestones.length > 0 
      ? (completedRequired / requiredMilestones.length) * 100 
      : 100;

    const requiredAttrs = stage.requiredAttributes;
    const filledAttrs = requiredAttrs.filter(a => a.filled).length;
    const attrProgress = requiredAttrs.length > 0 
      ? (filledAttrs / requiredAttrs.length) * 100 
      : 100;

    return {
      milestoneProgress,
      attrProgress,
      overall: (milestoneProgress + attrProgress) / 2,
      canAdvance: milestoneProgress === 100 && attrProgress === 100,
    };
  };

  const currentStageCompletion = selectedStage ? getStageCompletion(selectedStage) : null;

  const handleTransition = async () => {
    setIsTransitioning(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsTransitioning(false);
    setShowTransitionDialog(false);
    setTransitionNotes('');
    // In real app, would update the current stage
  };

  return (
    <div className="space-y-6">
      {/* Stage Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Project Lifecycle</CardTitle>
          <CardDescription>Track progress through development stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {stages.map((stage, index) => {
              const completion = getStageCompletion(stage);
              const isPast = index < currentStageIndex;
              const isCurrent = stage.key === currentStageKey;
              const isFuture = index > currentStageIndex;
              const isSelected = stage.key === selectedStageKey;

              return (
                <div key={stage.key} className="flex items-center">
                  <button
                    onClick={() => setSelectedStageKey(stage.key)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all min-w-[100px] ${
                      isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      isPast ? 'bg-green-500 text-white' :
                      isCurrent ? stage.color :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isPast ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        stage.icon
                      )}
                    </div>
                    <span className={`text-xs font-medium text-center ${
                      isCurrent ? 'text-primary' : 
                      isPast ? 'text-green-600' : 
                      'text-muted-foreground'
                    }`}>
                      {stage.name}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        Current
                      </Badge>
                    )}
                    {isPast && (
                      <Badge variant="outline" className="text-[10px] h-5 border-green-500 text-green-600">
                        Complete
                      </Badge>
                    )}
                    {isFuture && (
                      <div className="h-5" />
                    )}
                  </button>
                  {index < stages.length - 1 && (
                    <ChevronRight className={`h-4 w-4 mx-1 flex-shrink-0 ${
                      index < currentStageIndex ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Stage Details */}
      {selectedStage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Milestones */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Milestones</CardTitle>
                  <CardDescription>
                    {selectedStage.milestones.filter(m => m.completed).length} of {selectedStage.milestones.length} completed
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(currentStageCompletion?.milestoneProgress || 0)}%</p>
                </div>
              </div>
              <Progress value={currentStageCompletion?.milestoneProgress || 0} className="h-2" />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {selectedStage.milestones.map((milestone) => (
                    <div 
                      key={milestone.key}
                      className={`p-3 rounded-lg border ${
                        milestone.completed 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${milestone.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {milestone.completed ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{milestone.label}</span>
                            {milestone.required && (
                              <Badge variant="outline" className="text-[10px] h-4">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {milestone.description}
                          </p>
                          {milestone.completed && milestone.completedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Completed {milestone.completedAt.toLocaleDateString()} by {milestone.completedBy}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Required Attributes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Required Attributes</CardTitle>
                  <CardDescription>
                    {selectedStage.requiredAttributes.filter(a => a.filled).length} of {selectedStage.requiredAttributes.length} filled
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{Math.round(currentStageCompletion?.attrProgress || 0)}%</p>
                </div>
              </div>
              <Progress value={currentStageCompletion?.attrProgress || 0} className="h-2" />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {selectedStage.requiredAttributes.map((attr) => (
                    <div 
                      key={attr.key}
                      className={`p-3 rounded-lg border ${
                        attr.filled 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={attr.filled ? 'text-green-500' : 'text-amber-500'}>
                            {attr.filled ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <AlertTriangle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium">{attr.label}</span>
                            <Badge variant="outline" className="ml-2 text-[10px] h-4 capitalize">
                              {attr.category}
                            </Badge>
                          </div>
                        </div>
                        {attr.filled && attr.value && (
                          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                            {attr.value}
                          </span>
                        )}
                        {!attr.filled && (
                          <Badge variant="outline" className="text-amber-500 border-amber-500">
                            Missing
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advance Stage Button */}
      {selectedStageKey === currentStageKey && nextStage && (
        <Card className={currentStageCompletion?.canAdvance ? 'border-green-500/50' : 'border-amber-500/50'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                  currentStageCompletion?.canAdvance 
                    ? 'bg-green-500/10 text-green-500' 
                    : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {currentStageCompletion?.canAdvance ? (
                    <ArrowRight className="h-6 w-6" />
                  ) : (
                    <Lock className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {currentStageCompletion?.canAdvance 
                      ? `Ready to advance to ${nextStage.name}` 
                      : `Complete requirements to advance`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {currentStageCompletion?.canAdvance 
                      ? 'All milestones and required attributes are complete'
                      : `${Math.round(currentStageCompletion?.overall || 0)}% complete - finish remaining items to proceed`
                    }
                  </p>
                </div>
              </div>
              <Button 
                size="lg"
                disabled={!currentStageCompletion?.canAdvance}
                onClick={() => setShowTransitionDialog(true)}
              >
                Advance Stage
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage Transition Dialog */}
      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advance to {nextStage?.name}</DialogTitle>
            <DialogDescription>
              Confirm stage transition for this project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>All Requirements Met</AlertTitle>
              <AlertDescription>
                All milestones and required attributes for the {selectedStage?.name} stage have been completed.
              </AlertDescription>
            </Alert>

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${selectedStage?.color}`}>
                  {selectedStage?.icon}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${nextStage?.color}`}>
                  {nextStage?.icon}
                </div>
                <div>
                  <p className="font-medium">{selectedStage?.name} → {nextStage?.name}</p>
                  <p className="text-sm text-muted-foreground">Stage transition</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Transition Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this stage transition..."
                value={transitionNotes}
                onChange={(e) => setTransitionNotes(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransitionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransition} disabled={isTransitioning}>
              {isTransitioning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm Transition
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LifecycleWizard;
