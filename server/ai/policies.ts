/**
 * KIISHA AI Policies
 * 
 * Defines scope rules, confirmation requirements, and role-based access
 * for all AI tasks. This is the central policy enforcement point.
 */

import { KiishaTask, TaskPolicy } from "./types";

// ============================================================================
// KIISHA System Prompt - Enforces domain boundaries
// ============================================================================

export const KIISHA_SYSTEM_PROMPT = `You are KIISHA, an AI assistant specialized in renewable energy asset diligence and operations management.

IMPORTANT CONSTRAINTS:
1. You must ONLY operate within the KIISHA platform's domain and tools.
2. You can ONLY use the provided tools and access data that the current user is authorized to see.
3. If asked questions unrelated to renewable energy assets, diligence, or operations, respond briefly that KIISHA is limited to KIISHA workspace operations and offer to help with supported actions.
4. Never claim capabilities outside of your provided tools.
5. Always cite evidence when making claims about documents or data.
6. For any action that modifies data, clearly explain what will be changed and ask for confirmation.

SUPPORTED DOMAINS:
- Document management and categorization
- Asset data extraction and verification
- RFI/Request management
- Compliance tracking
- Operations monitoring
- Data room management
- Entity resolution and linking

You are helpful, precise, and always operate within your defined scope.`;

// ============================================================================
// Task Policies - Define requirements for each task type
// ============================================================================

export const TASK_POLICIES: Record<KiishaTask, TaskPolicy> = {
  INTENT_CLASSIFY: {
    task: "INTENT_CLASSIFY",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
    maxTokensPerCall: 500,
    rateLimit: { maxCallsPerMinute: 60, maxCallsPerHour: 1000 },
  },
  
  DOC_CLASSIFY: {
    task: "DOC_CLASSIFY",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer"],
    maxTokensPerCall: 1000,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 500 },
  },
  
  DOC_EXTRACT_FIELDS: {
    task: "DOC_EXTRACT_FIELDS",
    requiresConfirmation: false, // Extraction proposes, doesn't commit
    requiresApproval: false,
    allowedRoles: ["admin", "editor"],
    maxTokensPerCall: 4000,
    rateLimit: { maxCallsPerMinute: 20, maxCallsPerHour: 200 },
  },
  
  DOC_SUMMARIZE: {
    task: "DOC_SUMMARIZE",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
    maxTokensPerCall: 2000,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 300 },
  },
  
  DOC_COMPARE_VERSIONS: {
    task: "DOC_COMPARE_VERSIONS",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer"],
    maxTokensPerCall: 3000,
    rateLimit: { maxCallsPerMinute: 20, maxCallsPerHour: 200 },
  },
  
  LINK_SUGGEST_PRIMARY: {
    task: "LINK_SUGGEST_PRIMARY",
    requiresConfirmation: true, // Linking requires confirmation
    requiresApproval: false,
    allowedRoles: ["admin", "editor"],
    maxTokensPerCall: 1000,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 300 },
  },
  
  LINK_SUGGEST_SECONDARY: {
    task: "LINK_SUGGEST_SECONDARY",
    requiresConfirmation: true,
    requiresApproval: false,
    allowedRoles: ["admin", "editor"],
    maxTokensPerCall: 1000,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 300 },
  },
  
  RFI_DRAFT_RESPONSE: {
    task: "RFI_DRAFT_RESPONSE",
    requiresConfirmation: true, // Drafts require review before sending
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer"],
    maxTokensPerCall: 3000,
    rateLimit: { maxCallsPerMinute: 20, maxCallsPerHour: 200 },
  },
  
  REQUEST_TEMPLATE_ASSIST: {
    task: "REQUEST_TEMPLATE_ASSIST",
    requiresConfirmation: true,
    requiresApproval: false,
    allowedRoles: ["admin"], // Admin only
    maxTokensPerCall: 2000,
    rateLimit: { maxCallsPerMinute: 10, maxCallsPerHour: 100 },
  },
  
  QUALITY_SCORE: {
    task: "QUALITY_SCORE",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer"],
    maxTokensPerCall: 1500,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 300 },
  },
  
  VALIDATE_CONSISTENCY: {
    task: "VALIDATE_CONSISTENCY",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer"],
    maxTokensPerCall: 3000,
    rateLimit: { maxCallsPerMinute: 20, maxCallsPerHour: 200 },
  },
  
  CHAT_RESPONSE: {
    task: "CHAT_RESPONSE",
    requiresConfirmation: false, // Chat itself doesn't require confirmation
    requiresApproval: false,
    allowedRoles: ["admin", "editor", "reviewer", "investor_viewer"],
    maxTokensPerCall: 4000,
    rateLimit: { maxCallsPerMinute: 30, maxCallsPerHour: 500 },
  },
  
  OCR_EXTRACT: {
    task: "OCR_EXTRACT",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor"],
    maxTokensPerCall: 8000,
    rateLimit: { maxCallsPerMinute: 10, maxCallsPerHour: 100 },
  },
  
  GEO_PARSE: {
    task: "GEO_PARSE",
    requiresConfirmation: false,
    requiresApproval: false,
    allowedRoles: ["admin", "editor"],
    maxTokensPerCall: 2000,
    rateLimit: { maxCallsPerMinute: 20, maxCallsPerHour: 200 },
  },
};

// ============================================================================
// High-Impact Actions Requiring Confirmation
// ============================================================================

export const HIGH_IMPACT_ACTIONS = [
  "external_share",
  "export_data",
  "mark_verified",
  "change_access",
  "template_rollout",
  "vatr_update",
  "request_submit",
  "cross_org_share",
  "bulk_delete",
  "financial_field_change",
] as const;

export type HighImpactAction = typeof HIGH_IMPACT_ACTIONS[number];

// ============================================================================
// Role Permissions for Tools
// ============================================================================

export const ROLE_TOOL_PERMISSIONS: Record<string, {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
  canVerify: boolean;
  canSeeInternal: boolean;
  restrictedClusters: string[];
}> = {
  admin: {
    canRead: true,
    canWrite: true,
    canDelete: true,
    canShare: true,
    canVerify: true,
    canSeeInternal: true,
    restrictedClusters: [],
  },
  editor: {
    canRead: true,
    canWrite: true,
    canDelete: false,
    canShare: false,
    canVerify: false,
    canSeeInternal: true,
    restrictedClusters: [],
  },
  reviewer: {
    canRead: true,
    canWrite: false,
    canDelete: false,
    canShare: false,
    canVerify: true,
    canSeeInternal: true,
    restrictedClusters: [],
  },
  investor_viewer: {
    canRead: true,
    canWrite: false,
    canDelete: false,
    canShare: false,
    canVerify: false,
    canSeeInternal: false,
    restrictedClusters: ["financial", "compliance"],
  },
};

// ============================================================================
// Policy Helpers
// ============================================================================

export function getTaskPolicy(task: KiishaTask): TaskPolicy {
  return TASK_POLICIES[task];
}

export function isTaskAllowedForRole(task: KiishaTask, role: string): boolean {
  const policy = TASK_POLICIES[task];
  return policy.allowedRoles.includes(role);
}

export function requiresConfirmation(task: KiishaTask): boolean {
  return TASK_POLICIES[task].requiresConfirmation;
}

export function requiresApproval(task: KiishaTask): boolean {
  return TASK_POLICIES[task].requiresApproval;
}

export function isHighImpactAction(action: string): action is HighImpactAction {
  return HIGH_IMPACT_ACTIONS.includes(action as HighImpactAction);
}

export function getRolePermissions(role: string) {
  return ROLE_TOOL_PERMISSIONS[role] || ROLE_TOOL_PERMISSIONS.investor_viewer;
}
