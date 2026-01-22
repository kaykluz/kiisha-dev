/**
 * AutofillSuggestions Component
 * 
 * Shows confidence-based autofill suggestions for template fields.
 * 
 * Rules:
 * 1. ≥80% confidence: Auto-fill with visual indicator
 * 2. <80% confidence: Show suggestions, don't auto-fill
 * 3. Sensitive fields: NEVER auto-fill, show warning
 * 4. Ambiguous matches: Show headers only, not values
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  ChevronDown,
  Shield,
  FileText,
  Database,
  Lightbulb,
  X,
  Check,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

// Confidence thresholds
const HIGH_CONFIDENCE_THRESHOLD = 0.80;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.60;

// Sensitivity categories that never auto-fill
const NEVER_AUTOFILL_CATEGORIES = [
  "bank_account",
  "personal_id",
  "personal_data",
  "financial_covenant",
  "legal_binding",
  "tax_id",
  "password",
  "ssn",
  "api_key",
  "secret",
  "credit_card",
];

export interface AutofillSuggestion {
  predicateId: string;
  predicateLabel: string;
  confidence: number;
  value?: unknown;
  sourceType: "infoItem" | "fact" | "document";
  sourceId: number;
  sourcePage?: number;
  sourceLabel?: string;
}

interface AutofillSuggestionsProps {
  fieldId: string;
  fieldLabel: string;
  fieldDescription?: string;
  sensitivityCategory?: string;
  currentValue?: string;
  suggestions: AutofillSuggestion[];
  onAccept: (suggestion: AutofillSuggestion) => void;
  onReject: (suggestion: AutofillSuggestion) => void;
  onViewSource: (suggestion: AutofillSuggestion) => void;
  disabled?: boolean;
  className?: string;
}

export function AutofillSuggestions({
  fieldId,
  fieldLabel,
  fieldDescription,
  sensitivityCategory,
  currentValue,
  suggestions,
  onAccept,
  onReject,
  onViewSource,
  disabled = false,
  className,
}: AutofillSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutofillSuggestion | null>(null);
  
  // Check if this is a sensitive field
  const isSensitiveField = sensitivityCategory && NEVER_AUTOFILL_CATEGORIES.includes(sensitivityCategory);
  
  // Get the best suggestion
  const bestSuggestion = suggestions.length > 0 
    ? suggestions.reduce((best, current) => current.confidence > best.confidence ? current : best)
    : null;
  
  // Determine if we should auto-fill
  const shouldAutoFill = bestSuggestion 
    && bestSuggestion.confidence >= HIGH_CONFIDENCE_THRESHOLD 
    && !isSensitiveField
    && !currentValue;
  
  // Check for ambiguous matches (multiple high-confidence suggestions)
  const hasAmbiguousMatches = suggestions.filter(s => s.confidence >= MEDIUM_CONFIDENCE_THRESHOLD).length > 1;
  
  if (suggestions.length === 0) {
    return null;
  }
  
  // Sensitive field warning
  if (isSensitiveField) {
    return (
      <div className={cn("flex items-center gap-2 text-xs", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-amber-500">
                <Shield className="h-3 w-3" />
                <span>Manual entry required</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                This is a sensitive field ({sensitivityCategory}). 
                For security, it cannot be auto-filled and must be entered manually.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs gap-1",
              shouldAutoFill && "text-green-500 hover:text-green-600",
              hasAmbiguousMatches && "text-amber-500 hover:text-amber-600",
              !shouldAutoFill && !hasAmbiguousMatches && "text-blue-500 hover:text-blue-600"
            )}
            disabled={disabled}
          >
            <Sparkles className="h-3 w-3" />
            {shouldAutoFill ? (
              <>
                <span>Auto-fill available</span>
                <ConfidenceBadge confidence={bestSuggestion!.confidence} />
              </>
            ) : hasAmbiguousMatches ? (
              <>
                <span>Multiple matches</span>
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  {suggestions.length}
                </Badge>
              </>
            ) : (
              <>
                <span>Suggestions</span>
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  {suggestions.length}
                </Badge>
              </>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">AI Suggestions for {fieldLabel}</span>
            </div>
            {fieldDescription && (
              <p className="text-xs text-muted-foreground mt-1">{fieldDescription}</p>
            )}
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <SuggestionItem
                key={`${suggestion.predicateId}-${index}`}
                suggestion={suggestion}
                isSelected={selectedSuggestion?.predicateId === suggestion.predicateId}
                showValueOnlyIfHighConfidence={hasAmbiguousMatches}
                onSelect={() => setSelectedSuggestion(suggestion)}
                onAccept={() => {
                  onAccept(suggestion);
                  setIsOpen(false);
                }}
                onReject={() => onReject(suggestion)}
                onViewSource={() => onViewSource(suggestion)}
              />
            ))}
          </div>
          
          {hasAmbiguousMatches && (
            <div className="p-3 border-t bg-amber-50 dark:bg-amber-950/20">
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Multiple matches found</p>
                  <p className="text-muted-foreground">
                    Review the sources and select the correct value. 
                    Headers are shown to help identify the right match.
                  </p>
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
      
      {/* Quick accept button for high-confidence suggestions */}
      {shouldAutoFill && !hasAmbiguousMatches && bestSuggestion && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-50"
                onClick={() => onAccept(bestSuggestion)}
                disabled={disabled}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Accept suggestion: {String(bestSuggestion.value)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

interface SuggestionItemProps {
  suggestion: AutofillSuggestion;
  isSelected: boolean;
  showValueOnlyIfHighConfidence: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onViewSource: () => void;
}

function SuggestionItem({
  suggestion,
  isSelected,
  showValueOnlyIfHighConfidence,
  onSelect,
  onAccept,
  onReject,
  onViewSource,
}: SuggestionItemProps) {
  const isHighConfidence = suggestion.confidence >= HIGH_CONFIDENCE_THRESHOLD;
  const showValue = !showValueOnlyIfHighConfidence || isHighConfidence;
  
  return (
    <div
      className={cn(
        "p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-muted"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Predicate label (header) */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{suggestion.predicateLabel}</span>
            <ConfidenceBadge confidence={suggestion.confidence} />
          </div>
          
          {/* Value (only if high confidence or not ambiguous) */}
          {showValue && suggestion.value !== undefined && (
            <p className="text-sm text-foreground mt-1 truncate">
              {String(suggestion.value)}
            </p>
          )}
          
          {/* Source info */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <SourceIcon type={suggestion.sourceType} />
            <span>{suggestion.sourceLabel || `Source #${suggestion.sourceId}`}</span>
            {suggestion.sourcePage && <span>• Page {suggestion.sourcePage}</span>}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewSource();
                  }}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View source</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-green-500 hover:text-green-600 hover:bg-green-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept();
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Accept</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  
  let variant: "default" | "secondary" | "outline" = "outline";
  let className = "";
  
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    variant = "default";
    className = "bg-green-500 hover:bg-green-500";
  } else if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
    variant = "secondary";
    className = "bg-amber-500/20 text-amber-600";
  }
  
  return (
    <Badge variant={variant} className={cn("h-4 px-1 text-[10px]", className)}>
      {percentage}%
    </Badge>
  );
}

function SourceIcon({ type }: { type: "infoItem" | "fact" | "document" }) {
  switch (type) {
    case "document":
      return <FileText className="h-3 w-3" />;
    case "fact":
      return <CheckCircle2 className="h-3 w-3" />;
    case "infoItem":
      return <Database className="h-3 w-3" />;
    default:
      return <HelpCircle className="h-3 w-3" />;
  }
}

/**
 * Hook to get autofill suggestions for a template field
 */
export function useAutofillSuggestions(
  templateId: number | null,
  fieldId: string,
  projectId: number | null
) {
  const { data, isLoading, error } = trpc.templates.getAutofillSuggestions.useQuery(
    { templateId: templateId!, fieldId, projectId: projectId! },
    { enabled: !!templateId && !!projectId }
  );
  
  return {
    suggestions: data?.suggestions || [],
    isLoading,
    error,
  };
}

/**
 * Hook to record autofill decisions for learning
 */
export function useAutofillDecision() {
  const utils = trpc.useUtils();
  
  const recordDecision = trpc.templates.recordAutofillDecision.useMutation({
    onSuccess: () => {
      // Optionally invalidate suggestions cache
    },
  });
  
  return {
    accept: (templateId: number, fieldId: string, suggestion: AutofillSuggestion) => {
      recordDecision.mutate({
        templateId,
        fieldId,
        predicateId: suggestion.predicateId,
        decision: "accepted",
        confidence: suggestion.confidence,
      });
    },
    reject: (templateId: number, fieldId: string, suggestion: AutofillSuggestion) => {
      recordDecision.mutate({
        templateId,
        fieldId,
        predicateId: suggestion.predicateId,
        decision: "rejected",
        confidence: suggestion.confidence,
      });
    },
    isPending: recordDecision.isPending,
  };
}
