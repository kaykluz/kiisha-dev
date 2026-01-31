/**
 * Template Autofill Service
 * 
 * Maps template fields to VATR predicates/InfoItems and proposes values
 * with confidence thresholds and safe ambiguity resolution.
 * 
 * RULES:
 * 1. Default autofill threshold: ≥80% confidence
 * 2. Threshold is configurable per template/field
 * 3. Sensitive fields NEVER auto-fill (bank accounts, IDs, personal data)
 * 4. Ambiguity resolution: show headers only, not values
 * 5. New evidence creates Facts, does not overwrite critical fields
 */

import type { OrgContext } from "./orgContext";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { templateFieldMappings, autofillDecisions } from "../../drizzle/schema";
import { createHash } from "crypto";

// Sensitivity categories that NEVER auto-fill
export const NEVER_AUTOFILL_CATEGORIES = [
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
] as const;

// Default confidence threshold (80%)
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.80;

// Template field definition
export interface TemplateField {
  fieldId: string;
  label: string;
  description?: string;
  dataType: "string" | "number" | "date" | "boolean" | "enum";
  required: boolean;
  sensitivityCategory?: typeof NEVER_AUTOFILL_CATEGORIES[number] | "none";
  confidenceThreshold?: number; // Override default threshold
}

// VATR predicate match
export interface VATRMatch {
  predicateId: string;
  predicateLabel: string; // e.g., "Solar Capacity (DC)"
  confidence: number;
  value?: unknown; // Only revealed after user selection
  sourceType: "infoItem" | "fact" | "document";
  sourceId: number;
  sourcePage?: number;
  sourceEvidence?: string;
}

// Autofill proposal for a single field
export interface AutofillProposal {
  fieldId: string;
  fieldLabel: string;
  
  // Proposal status
  status: "auto_filled" | "needs_selection" | "needs_confirmation" | "no_match" | "sensitive_blocked";
  
  // For auto_filled: the value that was filled
  autoFilledValue?: unknown;
  autoFilledSource?: VATRMatch;
  
  // For needs_selection: multiple options to choose from (headers only, no values)
  options?: Array<{
    header: string;           // e.g., "Solar Capacity (DC)"
    predicateId: string;
    confidence: number;
    tooltip?: string;         // Optional "why this?" explanation
  }>;
  
  // For needs_confirmation: sensitive field requiring explicit confirm
  pendingValue?: unknown;
  pendingSource?: VATRMatch;
  
  // Confidence info
  highestConfidence: number;
  threshold: number;
}

// Autofill decision record
export interface AutofillDecisionRecord {
  fieldId: string;
  decision: "auto_filled" | "user_selected" | "user_confirmed" | "user_rejected" | "skipped";
  selectedPredicateId?: string;
  finalValue?: unknown;
  timestamp: Date;
}

/**
 * Propose autofill values for a template
 */
export async function proposeAutofill(
  ctx: OrgContext,
  templateId: number,
  fields: TemplateField[],
  projectId: number
): Promise<AutofillProposal[]> {
  const proposals: AutofillProposal[] = [];
  
  for (const field of fields) {
    const proposal = await proposeFieldAutofill(ctx, templateId, field, projectId);
    proposals.push(proposal);
  }
  
  return proposals;
}

/**
 * Propose autofill for a single field
 */
async function proposeFieldAutofill(
  ctx: OrgContext,
  _templateId: number,
  field: TemplateField,
  projectId: number
): Promise<AutofillProposal> {
  // Check if field is sensitive - NEVER auto-fill
  if (field.sensitivityCategory && NEVER_AUTOFILL_CATEGORIES.includes(field.sensitivityCategory as any)) {
    return {
      fieldId: field.fieldId,
      fieldLabel: field.label,
      status: "sensitive_blocked",
      highestConfidence: 0,
      threshold: field.confidenceThreshold || DEFAULT_CONFIDENCE_THRESHOLD,
    };
  }
  
  // Get confidence threshold for this field
  const threshold = field.confidenceThreshold || DEFAULT_CONFIDENCE_THRESHOLD;
  
  // Find matching VATR predicates
  const matches = await findVATRMatches(ctx, field, projectId);
  
  if (matches.length === 0) {
    return {
      fieldId: field.fieldId,
      fieldLabel: field.label,
      status: "no_match",
      highestConfidence: 0,
      threshold,
    };
  }
  
  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);
  const highestConfidence = matches[0].confidence;
  
  // Single high-confidence match - auto-fill
  if (matches.length === 1 && highestConfidence >= threshold) {
    return {
      fieldId: field.fieldId,
      fieldLabel: field.label,
      status: "auto_filled",
      autoFilledValue: matches[0].value,
      autoFilledSource: matches[0],
      highestConfidence,
      threshold,
    };
  }
  
  // Multiple matches or below threshold - needs selection
  if (matches.length > 1 || highestConfidence < threshold) {
    // Only show headers, not values
    const options = matches.map(m => ({
      header: m.predicateLabel,
      predicateId: m.predicateId,
      confidence: m.confidence,
      tooltip: `Source: ${m.sourceType} (${Math.round(m.confidence * 100)}% confidence)`,
    }));
    
    return {
      fieldId: field.fieldId,
      fieldLabel: field.label,
      status: "needs_selection",
      options,
      highestConfidence,
      threshold,
    };
  }
  
  // Single match but below threshold
  return {
    fieldId: field.fieldId,
    fieldLabel: field.label,
    status: "needs_selection",
    options: [{
      header: matches[0].predicateLabel,
      predicateId: matches[0].predicateId,
      confidence: matches[0].confidence,
    }],
    highestConfidence,
    threshold,
  };
}

/**
 * Find VATR predicate matches for a field
 * Uses AI to map field labels to predicates with confidence scores
 */
async function findVATRMatches(
  ctx: OrgContext,
  field: TemplateField,
  projectId: number
): Promise<VATRMatch[]> {
  const matches: VATRMatch[] = [];

  // 1. Check existing field mappings first
  const existingMappings = await getFieldMappings(ctx, 0); // 0 = any template
  const existingMapping = existingMappings.find(m => m.fieldId === field.id);
  if (existingMapping) {
    matches.push({
      predicateId: existingMapping.predicateId,
      predicateLabel: existingMapping.predicateId.replace(/\./g, ' ').replace(/([A-Z])/g, ' $1').trim(),
      confidence: existingMapping.confidenceThreshold,
      value: undefined,
      sourceType: "mapping",
      sourceId: 0,
    });
    return matches;
  }

  // 2. Match field label against known VATR asset fields
  const label = field.label.toLowerCase();
  const vatrFieldMap: Record<string, { predicateId: string; predicateLabel: string }[]> = {
    "capacity": [
      { predicateId: "vatr.capacity.dc", predicateLabel: "DC Capacity (kWp)" },
      { predicateId: "vatr.capacity.ac", predicateLabel: "AC Capacity (kW)" },
    ],
    "solar capacity": [
      { predicateId: "vatr.capacity.dc", predicateLabel: "Solar DC Capacity" },
      { predicateId: "vatr.capacity.ac", predicateLabel: "Solar AC Capacity" },
    ],
    "location": [
      { predicateId: "vatr.site.latitude", predicateLabel: "Site Latitude" },
      { predicateId: "vatr.site.longitude", predicateLabel: "Site Longitude" },
    ],
    "classification": [
      { predicateId: "vatr.asset.classification", predicateLabel: "Asset Classification" },
    ],
    "grid": [
      { predicateId: "vatr.grid.connectionType", predicateLabel: "Grid Connection Type" },
    ],
    "tariff": [
      { predicateId: "vatr.tariff.rate", predicateLabel: "Tariff Rate" },
    ],
    "commissioning": [
      { predicateId: "vatr.dates.commissioning", predicateLabel: "Commissioning Date" },
    ],
    "cod": [
      { predicateId: "vatr.dates.cod", predicateLabel: "Commercial Operation Date" },
    ],
  };

  for (const [keyword, fieldDefs] of Object.entries(vatrFieldMap)) {
    if (label.includes(keyword)) {
      for (const fd of fieldDefs) {
        matches.push({
          ...fd,
          confidence: label === keyword ? 0.92 : 0.78,
          value: undefined,
          sourceType: "vatrAsset",
          sourceId: projectId,
        });
      }
    }
  }

  return matches;
}

/**
 * Resolve user selection and get the actual value
 */
export async function resolveSelection(
  _ctx: OrgContext,
  _templateId: number,
  _fieldId: string,
  selectedPredicateId: string,
  _projectId: number
): Promise<{
  value: unknown;
  source: VATRMatch;
}> {
  // Query value from VATR asset for the given project
  const { vatrAssets } = await import("../../drizzle/schema");
  const db = await getDb();
  let resolvedValue: unknown = null;

  if (db) {
    const { eq: eqOp } = await import("drizzle-orm");
    const [asset] = await db.select().from(vatrAssets)
      .where(eqOp(vatrAssets.projectId, _projectId))
      .limit(1);

    if (asset) {
      // Map predicateId to actual asset field
      const fieldMap: Record<string, unknown> = {
        "vatr.capacity.dc": (asset as any).dcCapacityKwp,
        "vatr.capacity.ac": (asset as any).acCapacityKw,
        "vatr.asset.classification": asset.assetClassification,
        "vatr.grid.connectionType": asset.gridConnectionType,
        "vatr.site.latitude": (asset as any).latitude,
        "vatr.site.longitude": (asset as any).longitude,
        "vatr.tariff.rate": (asset as any).tariffRate,
        "vatr.dates.commissioning": (asset as any).commissioningDate,
        "vatr.dates.cod": (asset as any).codDate,
      };
      resolvedValue = fieldMap[selectedPredicateId] ?? null;
    }
  }

  return {
    value: resolvedValue,
    source: {
      predicateId: selectedPredicateId,
      predicateLabel: selectedPredicateId.replace(/\./g, " ").replace(/([A-Z])/g, " $1").trim(),
      confidence: 0.85,
      value: resolvedValue,
      sourceType: "vatrAsset",
      sourceId: _projectId,
    },
  };
}

/**
 * Confirm a sensitive field value
 * Required for fields that never auto-fill
 */
export async function confirmSensitiveField(
  ctx: OrgContext,
  templateId: number,
  fieldId: string,
  confirmedValue: unknown,
  projectId: number
): Promise<AutofillDecisionRecord> {
  // Log the explicit confirmation
  console.log("[AUDIT] Sensitive field confirmed:", {
    userId: ctx.user.id,
    orgId: ctx.organizationId,
    templateId,
    fieldId,
    projectId,
    timestamp: new Date(),
  });
  
  return {
    fieldId,
    decision: "user_confirmed",
    finalValue: confirmedValue,
    timestamp: new Date(),
  };
}

/**
 * Save field mapping preference for future use
 * Tenant-scoped - only applies to this org's templates
 */
export async function saveFieldMapping(
  ctx: OrgContext,
  templateId: number,
  fieldId: string,
  predicateId: string,
  confidenceThreshold?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Upsert: check if mapping already exists
  const existing = await db.select().from(templateFieldMappings)
    .where(and(
      eq(templateFieldMappings.organizationId, ctx.organizationId),
      eq(templateFieldMappings.templateId, templateId),
      eq(templateFieldMappings.fieldId, fieldId),
    )).limit(1);

  if (existing.length > 0) {
    await db.update(templateFieldMappings)
      .set({ predicateId, confidenceThreshold: (confidenceThreshold ?? 0.8).toString() })
      .where(eq(templateFieldMappings.id, existing[0].id));
  } else {
    await db.insert(templateFieldMappings).values({
      organizationId: ctx.organizationId,
      templateId,
      fieldId,
      predicateId,
      confidenceThreshold: (confidenceThreshold ?? 0.8).toString(),
      createdBy: ctx.user.id,
    });
  }

  console.log("[AUDIT] Field mapping saved:", { userId: ctx.user.id, orgId: ctx.organizationId, templateId, fieldId, predicateId });
}

/**
 * Record an autofill decision for audit
 */
export async function recordAutofillDecision(
  ctx: OrgContext,
  templateId: number,
  projectId: number,
  decision: AutofillDecisionRecord
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const finalValueHash = decision.finalValue != null
    ? createHash('sha256').update(String(decision.finalValue)).digest('hex')
    : null;

  await db.insert(autofillDecisions).values({
    organizationId: ctx.organizationId,
    projectId,
    templateId,
    fieldId: decision.fieldId,
    decision: decision.decision as any,
    selectedPredicateId: (decision as any).selectedPredicateId || null,
    confidence: (decision as any).confidence?.toString() || null,
    finalValueHash,
    userId: ctx.user.id,
  });

  console.log("[AUDIT] Autofill decision recorded:", { userId: ctx.user.id, orgId: ctx.organizationId, templateId, projectId, fieldId: decision.fieldId });
}

/**
 * Get existing field mappings for a template
 */
export async function getFieldMappings(
  ctx: OrgContext,
  _templateId: number
): Promise<Array<{
  fieldId: string;
  predicateId: string;
  confidenceThreshold: number;
  isSensitive: boolean;
}>> {
  const db = await getDb();
  if (!db) return [];

  const mappings = await db.select().from(templateFieldMappings)
    .where(and(
      eq(templateFieldMappings.organizationId, ctx.organizationId),
      eq(templateFieldMappings.templateId, _templateId),
    ));

  return mappings.map(m => ({
    fieldId: m.fieldId,
    predicateId: m.predicateId,
    confidenceThreshold: parseFloat(m.confidenceThreshold?.toString() || '0.8'),
    isSensitive: m.isSensitive,
  }));
}
