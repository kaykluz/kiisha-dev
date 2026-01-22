/**
 * AutofillFormField Component
 * 
 * Wraps form input fields with autofill suggestion capabilities.
 * Integrates with the templateAutofill service to provide confidence-based suggestions.
 */

import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AutofillSuggestions, AutofillSuggestion } from "./AutofillSuggestions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AutofillFormFieldProps {
  // Field identification
  fieldId: string;
  fieldLabel: string;
  fieldDescription?: string;
  sensitivityCategory?: string;
  
  // Template context
  templateId: number;
  responseId?: number;
  organizationId: number;
  projectId?: number;
  
  // Form control
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  
  // Field configuration
  type?: "text" | "textarea" | "number" | "date" | "email";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  
  // Autofill options
  enableAutofill?: boolean;
  autoFetchSuggestions?: boolean;
}

export function AutofillFormField({
  fieldId,
  fieldLabel,
  fieldDescription,
  sensitivityCategory,
  templateId,
  responseId,
  organizationId,
  projectId,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  required = false,
  disabled = false,
  className,
  inputClassName,
  enableAutofill = true,
  autoFetchSuggestions = true,
}: AutofillFormFieldProps) {
  const [suggestions, setSuggestions] = useState<AutofillSuggestion[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  
  // Fetch suggestions query
  const { data: suggestionsData, refetch: refetchSuggestions } = trpc.templates.getAutofillSuggestions.useQuery(
    {
      templateId,
      fieldId,
      organizationId,
      projectId,
    },
    {
      enabled: enableAutofill && autoFetchSuggestions && !hasFetched,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );
  
  // Record decision mutation
  const recordDecisionMutation = trpc.templates.recordAutofillDecision.useMutation({
    onError: (error) => {
      console.error("Failed to record autofill decision:", error);
    },
  });
  
  // Update suggestions when data arrives
  useEffect(() => {
    if (suggestionsData?.proposals) {
      const mappedSuggestions: AutofillSuggestion[] = suggestionsData.proposals.map((proposal: any) => ({
        predicateId: proposal.predicateId,
        predicateLabel: proposal.predicateLabel,
        confidence: proposal.confidence,
        value: proposal.value,
        sourceType: proposal.sourceType,
        sourceId: proposal.sourceId,
        sourcePage: proposal.sourcePage,
        sourceLabel: proposal.sourceLabel,
      }));
      setSuggestions(mappedSuggestions);
      setHasFetched(true);
    }
  }, [suggestionsData]);
  
  // Handle accepting a suggestion
  const handleAccept = useCallback((suggestion: AutofillSuggestion) => {
    if (suggestion.value !== undefined) {
      onChange(String(suggestion.value));
      toast.success(`Applied: ${suggestion.predicateLabel}`);
      
      // Record the decision
      recordDecisionMutation.mutate({
        templateId,
        fieldId,
        decision: "accepted",
        predicateId: suggestion.predicateId,
        confidence: suggestion.confidence,
        organizationId,
      });
    }
  }, [onChange, templateId, fieldId, organizationId, recordDecisionMutation]);
  
  // Handle rejecting a suggestion
  const handleReject = useCallback((suggestion: AutofillSuggestion) => {
    // Remove from local suggestions
    setSuggestions(prev => prev.filter(s => s.predicateId !== suggestion.predicateId));
    toast.info(`Dismissed suggestion: ${suggestion.predicateLabel}`);
    
    // Record the decision
    recordDecisionMutation.mutate({
      templateId,
      fieldId,
      decision: "rejected",
      predicateId: suggestion.predicateId,
      confidence: suggestion.confidence,
      organizationId,
    });
  }, [templateId, fieldId, organizationId, recordDecisionMutation]);
  
  // Handle viewing source
  const handleViewSource = useCallback((suggestion: AutofillSuggestion) => {
    // This could open a modal or navigate to the source document
    toast.info(`Source: ${suggestion.sourceLabel || suggestion.sourceType} #${suggestion.sourceId}${suggestion.sourcePage ? `, Page ${suggestion.sourcePage}` : ""}`);
    
    // Record the view
    recordDecisionMutation.mutate({
      templateId,
      fieldId,
      decision: "viewed",
      predicateId: suggestion.predicateId,
      confidence: suggestion.confidence,
      organizationId,
    });
  }, [templateId, fieldId, organizationId, recordDecisionMutation]);
  
  // Render the appropriate input type
  const renderInput = () => {
    const commonProps = {
      id: fieldId,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
      onBlur,
      placeholder,
      disabled,
      className: cn("flex-1", inputClassName),
    };
    
    if (type === "textarea") {
      return <Textarea {...commonProps} rows={3} />;
    }
    
    return (
      <Input
        {...commonProps}
        type={type}
      />
    );
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={fieldId} className="flex items-center gap-1">
          {fieldLabel}
          {required && <span className="text-destructive">*</span>}
        </Label>
        
        {enableAutofill && suggestions.length > 0 && (
          <AutofillSuggestions
            fieldId={fieldId}
            fieldLabel={fieldLabel}
            fieldDescription={fieldDescription}
            sensitivityCategory={sensitivityCategory}
            currentValue={value}
            suggestions={suggestions}
            onAccept={handleAccept}
            onReject={handleReject}
            onViewSource={handleViewSource}
            disabled={disabled}
          />
        )}
      </div>
      
      {renderInput()}
      
      {fieldDescription && (
        <p className="text-xs text-muted-foreground">{fieldDescription}</p>
      )}
    </div>
  );
}

/**
 * Hook for managing autofill state across multiple fields
 */
export function useAutofillForm(
  templateId: number,
  organizationId: number,
  projectId?: number
) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pendingSuggestions, setPendingSuggestions] = useState<Record<string, AutofillSuggestion[]>>({});
  
  // Bulk fetch suggestions for all fields
  const { data: bulkSuggestions, refetch } = trpc.templates.getBulkAutofillSuggestions.useQuery(
    {
      templateId,
      organizationId,
      projectId,
    },
    {
      enabled: !!templateId && !!organizationId,
      staleTime: 5 * 60 * 1000,
    }
  );
  
  // Update pending suggestions when data arrives
  useEffect(() => {
    if (bulkSuggestions?.fieldSuggestions) {
      const mapped: Record<string, AutofillSuggestion[]> = {};
      for (const [fieldId, proposals] of Object.entries(bulkSuggestions.fieldSuggestions)) {
        mapped[fieldId] = (proposals as any[]).map((p: any) => ({
          predicateId: p.predicateId,
          predicateLabel: p.predicateLabel,
          confidence: p.confidence,
          value: p.value,
          sourceType: p.sourceType,
          sourceId: p.sourceId,
          sourcePage: p.sourcePage,
          sourceLabel: p.sourceLabel,
        }));
      }
      setPendingSuggestions(mapped);
    }
  }, [bulkSuggestions]);
  
  // Get value for a field
  const getValue = useCallback((fieldId: string) => fieldValues[fieldId] || "", [fieldValues]);
  
  // Set value for a field
  const setValue = useCallback((fieldId: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  }, []);
  
  // Get suggestions for a field
  const getSuggestions = useCallback((fieldId: string) => pendingSuggestions[fieldId] || [], [pendingSuggestions]);
  
  // Accept a suggestion for a field
  const acceptSuggestion = useCallback((fieldId: string, suggestion: AutofillSuggestion) => {
    if (suggestion.value !== undefined) {
      setValue(fieldId, String(suggestion.value));
    }
  }, [setValue]);
  
  // Reject a suggestion for a field
  const rejectSuggestion = useCallback((fieldId: string, suggestion: AutofillSuggestion) => {
    setPendingSuggestions(prev => ({
      ...prev,
      [fieldId]: (prev[fieldId] || []).filter(s => s.predicateId !== suggestion.predicateId),
    }));
  }, []);
  
  // Auto-fill all high-confidence fields
  const autoFillHighConfidence = useCallback(() => {
    let filled = 0;
    for (const [fieldId, suggestions] of Object.entries(pendingSuggestions)) {
      const best = suggestions.reduce((a, b) => a.confidence > b.confidence ? a : b, { confidence: 0 } as AutofillSuggestion);
      if (best.confidence >= 0.80 && best.value !== undefined && !fieldValues[fieldId]) {
        setValue(fieldId, String(best.value));
        filled++;
      }
    }
    return filled;
  }, [pendingSuggestions, fieldValues, setValue]);
  
  return {
    fieldValues,
    getValue,
    setValue,
    getSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    autoFillHighConfidence,
    refetchSuggestions: refetch,
  };
}

export default AutofillFormField;
