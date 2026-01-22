import { mysqlTable, int, varchar, text, boolean, timestamp, json, mysqlEnum, decimal } from "drizzle-orm/mysql-core";

// ============================================================================
// VIEW-BASED SHARING SYSTEM
// Cross-org sharing occurs ONLY through explicit View sharing
// A View is a permissioned "package" of information with defined scope
// ============================================================================

// Views - shareable packages of information
// A View is the ONLY supported cross-org artifact
export const views = mysqlTable("views", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // Owner org
  
  // Identity
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  viewType: mysqlEnum("viewType", [
    "dashboard",           // Analytics/metrics view
    "due_diligence_pack",  // DD pack for investors/lenders
    "lender_pack",         // Lender-specific package
    "report",              // Generated report
    "template_output",     // Filled template
    "data_room",           // Virtual data room
    "custom"               // Custom view
  ]).default("custom").notNull(),
  
  // Scope definition - what this view contains
  // This is the ONLY data accessible through this view
  scope: json("scope").$type<{
    projectIds?: number[];        // Projects included
    documentIds?: number[];       // Specific documents
    infoItemIds?: number[];       // Specific tracked fields
    factIds?: number[];           // Specific facts/evidence
    templateIds?: number[];       // Templates used
    includeEvidence?: boolean;    // Whether to include evidence pointers
    evidenceArtifactIds?: number[]; // Specific evidence artifacts
    excludeSensitive?: boolean;   // Exclude sensitive fields
  }>(),
  
  // View configuration
  config: json("config").$type<{
    layout?: string;
    filters?: Record<string, unknown>;
    sortOrder?: string;
    groupBy?: string;
    visibleColumns?: string[];
  }>(),
  
  // Access control
  isPublic: boolean("isPublic").default(false).notNull(), // Public within org
  canShare: boolean("canShare").default(true).notNull(),  // Can be shared externally
  
  // Status
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  
  // Audit
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type View = typeof views.$inferSelect;
export type InsertView = typeof views.$inferInsert;

// View shares - explicit grants for cross-org access
// This is the ONLY way to share data across organizations
export const viewShares = mysqlTable("viewShares", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  
  // Source (who is sharing)
  sourceOrgId: int("sourceOrgId").notNull(),
  sharedBy: int("sharedBy").notNull(), // User who created the share
  
  // Target (who receives access)
  targetOrgId: int("targetOrgId"),     // Target organization (null = specific user only)
  targetUserId: int("targetUserId"),   // Specific user (null = entire org)
  
  // Share constraints
  expiresAt: timestamp("expiresAt"),   // Optional expiry
  canExport: boolean("canExport").default(false).notNull(), // Can download/export
  canCopy: boolean("canCopy").default(false).notNull(),     // Can copy data
  maxAccesses: int("maxAccesses"),     // Optional access limit
  accessCount: int("accessCount").default(0).notNull(),
  
  // Scope restrictions (can further limit view scope)
  scopeRestrictions: json("scopeRestrictions").$type<{
    excludeDocumentIds?: number[];
    excludeInfoItemIds?: number[];
    onlyProjectIds?: number[];
    sensitiveFieldsHidden?: boolean;
  }>(),
  
  // Status
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokedReason: text("revokedReason"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ViewShare = typeof viewShares.$inferSelect;
export type InsertViewShare = typeof viewShares.$inferInsert;

// View access log - audit trail for all view accesses
export const viewAccessLog = mysqlTable("viewAccessLog", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  shareId: int("shareId"),             // If accessed via share
  
  // Who accessed
  userId: int("userId").notNull(),
  userOrgId: int("userOrgId").notNull(),
  
  // Access details
  accessType: mysqlEnum("accessType", [
    "view",      // Viewed the view
    "export",    // Exported/downloaded
    "copy",      // Copied data
    "api"        // API access
  ]).default("view").notNull(),
  
  // Context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // What was accessed
  accessedScope: json("accessedScope").$type<{
    projectIds?: number[];
    documentIds?: number[];
    infoItemIds?: number[];
  }>(),
  
  // Timestamp
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});

export type ViewAccessLog = typeof viewAccessLog.$inferSelect;
export type InsertViewAccessLog = typeof viewAccessLog.$inferInsert;

// ============================================================================
// AI POLICY CONTEXT
// All AI actions must execute under a Policy Context
// ============================================================================

// AI retrieval audit log - tracks all AI data access
export const aiRetrievalLog = mysqlTable("aiRetrievalLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Policy context at time of retrieval
  userId: int("userId").notNull(),
  activeOrgId: int("activeOrgId").notNull(),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // What was requested
  queryType: mysqlEnum("queryType", [
    "chat",           // Chat query
    "search",         // Search query
    "autofill",       // Template autofill
    "extraction",     // Document extraction
    "analysis"        // Analysis request
  ]).notNull(),
  queryText: text("queryText"),
  
  // Scope at time of query
  authorizedScope: json("authorizedScope").$type<{
    projectIds: number[];
    viewIds: number[];
    shareIds: number[];
    documentIds?: number[];
  }>(),
  
  // What was retrieved
  retrievedArtifacts: json("retrievedArtifacts").$type<{
    documentIds?: number[];
    factIds?: number[];
    infoItemIds?: number[];
    evidenceIds?: number[];
  }>(),
  
  // Response metadata
  responseTokens: int("responseTokens"),
  citedSources: json("citedSources").$type<{
    documentId: number;
    page?: number;
    paragraph?: string;
  }[]>(),
  
  // Validation
  scopeViolationAttempted: boolean("scopeViolationAttempted").default(false).notNull(),
  scopeViolationDetails: text("scopeViolationDetails"),
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AIRetrievalLog = typeof aiRetrievalLog.$inferSelect;
export type InsertAIRetrievalLog = typeof aiRetrievalLog.$inferInsert;

// ============================================================================
// TEMPLATE AUTOFILL SYSTEM
// Maps template fields to VATR predicates with confidence thresholds
// ============================================================================

// Template field mappings - how template fields map to VATR predicates
export const templateFieldMappings = mysqlTable("templateFieldMappings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(), // Tenant-scoped
  
  // Template reference
  templateId: int("templateId").notNull(),
  templateFieldId: varchar("templateFieldId", { length: 255 }).notNull(), // Field identifier in template
  templateFieldLabel: varchar("templateFieldLabel", { length: 255 }),     // Human-readable label
  
  // VATR mapping
  vatrPredicate: varchar("vatrPredicate", { length: 255 }).notNull(),     // e.g., "pv.capacity.dc"
  infoItemId: int("infoItemId"),                                          // Linked InfoItem if exists
  
  // Confidence settings
  confidenceThreshold: decimal("confidenceThreshold", { precision: 3, scale: 2 }).default("0.80"), // Default 80%
  
  // Sensitivity flags
  isSensitive: boolean("isSensitive").default(false).notNull(), // Never auto-fill
  sensitivityCategory: mysqlEnum("sensitivityCategory", [
    "bank_account",
    "personal_id",
    "personal_data",
    "financial_covenant",
    "legal_binding",
    "none"
  ]).default("none"),
  requiresExplicitConfirm: boolean("requiresExplicitConfirm").default(false).notNull(),
  
  // Mapping metadata
  mappingSource: mysqlEnum("mappingSource", ["manual", "ai_suggested", "ai_confirmed"]).default("manual"),
  aiConfidence: decimal("aiConfidence", { precision: 3, scale: 2 }),
  
  // Audit
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TemplateFieldMapping = typeof templateFieldMappings.$inferSelect;
export type InsertTemplateFieldMapping = typeof templateFieldMappings.$inferInsert;

// Autofill decisions - audit trail of all autofill actions
export const autofillDecisions = mysqlTable("autofillDecisions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Context
  userId: int("userId").notNull(),
  templateId: int("templateId").notNull(),
  templateFieldId: varchar("templateFieldId", { length: 255 }).notNull(),
  
  // What was proposed
  proposedValue: text("proposedValue"),
  proposedValueSource: json("proposedValueSource").$type<{
    infoItemId?: number;
    factId?: number;
    documentId?: number;
    page?: number;
    confidence: number;
  }>(),
  
  // Ambiguity resolution (if multiple matches)
  alternativeOptions: json("alternativeOptions").$type<{
    header: string;        // e.g., "Solar Capacity (DC)"
    vatrPredicate: string;
    confidence: number;
  }[]>(),
  
  // Decision
  decision: mysqlEnum("decision", [
    "auto_filled",         // Confidence met, auto-filled
    "user_selected",       // User chose from options
    "user_confirmed",      // User confirmed sensitive field
    "user_rejected",       // User rejected suggestion
    "skipped"              // Below threshold, no action
  ]).notNull(),
  
  // Final value
  finalValue: text("finalValue"),
  selectedOption: varchar("selectedOption", { length: 255 }), // Which header was selected
  
  // Timestamp
  decidedAt: timestamp("decidedAt").defaultNow().notNull(),
});

export type AutofillDecision = typeof autofillDecisions.$inferSelect;
export type InsertAutofillDecision = typeof autofillDecisions.$inferInsert;

// ============================================================================
// ORGANIZATION JOIN REQUESTS
// For users without pre-approved tokens
// ============================================================================

export const orgJoinRequests = mysqlTable("orgJoinRequests", {
  id: int("id").autoincrement().primaryKey(),
  
  // Request details
  organizationId: int("organizationId").notNull(),
  userId: int("userId"),                           // If user already exists
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  
  // Request context
  requestedRole: mysqlEnum("requestedRole", ["editor", "reviewer", "investor_viewer"]).default("editor"),
  requestReason: text("requestReason"),
  referralSource: varchar("referralSource", { length: 255 }), // How they found the org URL
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  
  // Admin decision
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  rejectionReason: text("rejectionReason"),
  
  // Rate limiting
  ipAddress: varchar("ipAddress", { length: 45 }),
  requestCount: int("requestCount").default(1).notNull(), // For rate limiting
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Request expires after X days
});

export type OrgJoinRequest = typeof orgJoinRequests.$inferSelect;
export type InsertOrgJoinRequest = typeof orgJoinRequests.$inferInsert;

// ============================================================================
// USER PINNED PROJECTS
// For sidebar ranking
// ============================================================================

export const userPinnedProjects = mysqlTable("userPinnedProjects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  organizationId: int("organizationId").notNull(), // Tenant-scoped
  pinnedAt: timestamp("pinnedAt").defaultNow().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type UserPinnedProject = typeof userPinnedProjects.$inferSelect;
export type InsertUserPinnedProject = typeof userPinnedProjects.$inferInsert;

// ============================================================================
// USER PROJECT ACTIVITY
// For sidebar ranking based on activity
// ============================================================================

export const userProjectActivity = mysqlTable("userProjectActivity", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  projectId: int("projectId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Activity metrics
  viewCount: int("viewCount").default(0).notNull(),
  editCount: int("editCount").default(0).notNull(),
  lastAccessedAt: timestamp("lastAccessedAt").defaultNow().notNull(),
  
  // Computed score for ranking
  activityScore: decimal("activityScore", { precision: 10, scale: 2 }).default("0"),
  
  // Audit
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserProjectActivity = typeof userProjectActivity.$inferSelect;
export type InsertUserProjectActivity = typeof userProjectActivity.$inferInsert;
