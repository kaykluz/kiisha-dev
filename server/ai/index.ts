/**
 * KIISHA AI Module
 * 
 * Central export point for all AI functionality.
 * Import from here to access the AI Gateway and related utilities.
 */

// Gateway - Main entry point for all AI operations
export { 
  initializeGateway,
  runTask,
  classifyIntent,
  extractDocumentFields,
  summarizeDocument,
  chatResponse,
} from "./gateway";

// Types
export type {
  KiishaTask,
  AIProvider,
  AIMessage,
  GatewayRequest,
  GatewayResponse,
  EvidenceRef,
  ExtractedField,
  OrgBudgetStatus,
  PendingConfirmation,
} from "./types";

export {
  KiishaTaskSchema,
  AIProviderSchema,
  GatewayRequestSchema,
  GatewayResponseSchema,
  EvidenceRefSchema,
  ExtractedFieldSchema,
} from "./types";

// Policies
export {
  KIISHA_SYSTEM_PROMPT,
  TASK_POLICIES,
  HIGH_IMPACT_ACTIONS,
  ROLE_TOOL_PERMISSIONS,
  getTaskPolicy,
  isTaskAllowedForRole,
  requiresConfirmation,
  requiresApproval,
  isHighImpactAction,
  getRolePermissions,
} from "./policies";

// Router
export {
  selectRoute,
  selectFallback,
  setRoutingConfig,
  getRoutingConfig,
  withRetry,
} from "./router";

// Budget
export {
  checkBudget,
  consumeBudget,
  setBudget,
  getBudgetHistory,
} from "./budget";

// Telemetry
export {
  recordAuditEntry,
  recordUsage,
  hashPrompt,
  calculateCost,
  getOrgUsageMetrics,
  getRealtimeMetrics,
} from "./telemetry";

// Confirmation
export {
  createConfirmation,
  confirmAction,
  declineAction,
  getPendingConfirmations,
  cleanupExpiredConfirmations,
  getConfirmationMessage,
} from "./confirmation";

// Tools
export {
  registerTool,
  getTool,
  getAllTools,
  getToolsForRole,
  executeTool,
  getOpenAITools,
} from "./tooling";

// Evaluation
export {
  registerFixture,
  getFixtures,
  getAllFixtures,
  runEvaluation,
  checkCIGate,
} from "./evals/runner";

// Adapter - Drop-in replacement for invokeLLM
export {
  invokeAI,
  classifyDocument,
  extractFields,
  draftRFIResponse,
  classifyIntent as classifyUserIntent,
} from "./adapter";
