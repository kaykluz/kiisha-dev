import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, decimal, boolean, date, bigint, uniqueIndex, index, unique } from "drizzle-orm/mysql-core";

// Core user table backing auth flow
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }), // For local auth
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "superuser_admin"]).default("user").notNull(),
  // Platform-level superuser (KIISHA staff) - can see all orgs, demo data, manage platform
  isSuperuser: boolean("isSuperuser").default(false).notNull(),
  userType: mysqlEnum("userType", ["operations_manager", "field_coordinator", "portfolio_manager", "investor", "technical_advisor"]).default("operations_manager"),
  organization: varchar("organization", { length: 255 }),
  avatarUrl: text("avatarUrl"),
  totpSecret: varchar("totpSecret", { length: 64 }), // For 2FA
  totpEnabled: boolean("totpEnabled").default(false),
  onboardingStatus: mysqlEnum("onboardingStatus", ["not_started", "in_progress", "completed", "skipped"]).default("not_started"),
  onboardingStep: int("onboardingStep").default(0),
  
  // Active organization context for session scoping
  activeOrgId: int("activeOrgId"), // Currently selected organization
  
  // Email verification
  emailVerified: boolean("emailVerified").default(false),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  emailVerificationToken: varchar("emailVerificationToken", { length: 64 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  notificationPreferences: json("notificationPreferences").$type<{
    emailDocuments: boolean;
    emailRfis: boolean;
    emailAlerts: boolean;
    emailReports: boolean;
    inAppDocuments: boolean;
    inAppRfis: boolean;
    inAppAlerts: boolean;
    digestFrequency: "realtime" | "daily" | "weekly";
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Organizations for multi-tenancy
// Hard tenant isolation - all data queries must be scoped by organizationId
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  
  // Subdomain slug for tenant routing (e.g., "acme" -> acme.kiisha.io)
  slug: varchar("slug", { length: 50 }).unique(),
  
  // Branding
  description: text("description"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 7 }), // Hex color
  
  // Security settings
  require2FA: boolean("require2FA").default(false).notNull(),
  allowedEmailDomains: json("allowedEmailDomains").$type<string[]>(), // Domain allowlist for signup
  signupMode: mysqlEnum("signupMode", ["invite_only", "domain_allowlist", "open"]).default("invite_only").notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "suspended", "archived"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// Organization memberships with roles
// Supports pre-approval: admin creates membership before user signs up
export const organizationMembers = mysqlTable("organizationMembers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId"), // Nullable for pre-approved memberships (linked after signup)
  
  // Pre-approval fields
  preApprovedEmail: varchar("preApprovedEmail", { length: 320 }), // Email pre-approved before signup
  preApprovedPhone: varchar("preApprovedPhone", { length: 20 }), // Phone pre-approved
  
  // Role and status
  role: mysqlEnum("role", ["admin", "editor", "reviewer", "investor_viewer"]).default("editor").notNull(),
  status: mysqlEnum("status", ["pending", "active", "suspended", "removed"]).default("pending").notNull(),
  
  // Invite tracking
  invitedBy: int("invitedBy"), // Admin who created the membership
  invitedAt: timestamp("invitedAt"),
  acceptedAt: timestamp("acceptedAt"), // When user completed signup
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = typeof organizationMembers.$inferInsert;

// Portfolios - collections of projects
export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  region: varchar("region", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

// Project memberships with roles
export const projectMembers = mysqlTable("projectMembers", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["admin", "editor", "reviewer", "investor_viewer"]).default("editor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = typeof projectMembers.$inferInsert;

// Projects - THE PRIMARY ASSET ENTITY (investable project-level units)
// Asset = Project/Site-level investable unit (e.g., "UMZA Oil Mill Solar+BESS")
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  
  // Location
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }).default("Nigeria"),
  city: varchar("city", { length: 100 }),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  address: text("address"),
  timezone: varchar("timezone", { length: 50 }).default("Africa/Lagos"),
  
  // Technology & Capacity
  technology: mysqlEnum("technology", ["PV", "BESS", "PV+BESS", "Wind", "Minigrid", "C&I"]).default("PV"),
  capacityMw: decimal("capacityMw", { precision: 10, scale: 2 }),
  capacityMwh: decimal("capacityMwh", { precision: 10, scale: 2 }),
  
  // Lifecycle Status
  status: mysqlEnum("status", ["prospecting", "development", "construction", "operational", "decommissioned"]).default("development"),
  stage: mysqlEnum("stage", [
    "origination", "feasibility", "development", "due_diligence", 
    "ntp", "construction", "commissioning", "cod", "operations"
  ]).default("feasibility"),
  
  // Asset Classification (project-level classification for filtering and requirements)
  assetClassification: mysqlEnum("assetClassification", [
    "residential", "small_commercial", "large_commercial", "industrial",
    "mini_grid", "mesh_grid", "interconnected_mini_grids", "grid_connected"
  ]),
  gridConnectionType: mysqlEnum("gridConnectionType", [
    "grid_tied", "islanded", "islandable", "weak_grid", "no_grid"
  ]),
  configurationProfile: mysqlEnum("configurationProfile", [
    "solar_only", "solar_bess", "solar_genset", "solar_bess_genset", 
    "bess_only", "genset_only", "hybrid"
  ]),
  // Coupling Topology: Electrical coupling architecture for hybrid assets
  // AC_COUPLED: AC bus coupling (inverters connect at AC side)
  // DC_COUPLED: DC bus coupling (components share DC bus before inversion)
  // HYBRID_COUPLED: Mixed AC and DC coupling
  couplingTopology: mysqlEnum("couplingTopology", [
    "AC_COUPLED", "DC_COUPLED", "HYBRID_COUPLED", "UNKNOWN", "NOT_APPLICABLE"
  ]),
  // Distribution Topology: Network shape for minigrids/mesh grids only
  // Only relevant for assetClassification: mini_grid, mesh_grid, interconnected_mini_grids
  distributionTopology: mysqlEnum("distributionTopology", [
    "RADIAL", "RING", "MESH", "STAR", "TREE", "UNKNOWN", "NOT_APPLICABLE"
  ]),
  // Legacy field - kept for backward compatibility, will be migrated
  networkTopology: mysqlEnum("networkTopology", ["radial", "ring", "mesh", "star", "unknown"]),
  
  // Off-taker / Customer
  offtakerName: varchar("offtakerName", { length: 255 }),
  offtakerType: mysqlEnum("offtakerType", [
    "industrial", "commercial", "utility", "community", "residential_aggregate"
  ]),
  contractType: mysqlEnum("contractType", ["ppa", "lease", "esco", "direct_sale", "captive"]),
  
  // Financial
  projectValueUsd: decimal("projectValueUsd", { precision: 14, scale: 2 }),
  tariffUsdKwh: decimal("tariffUsdKwh", { precision: 8, scale: 4 }),
  
  // Dates
  codDate: date("codDate"),
  ppaStartDate: date("ppaStartDate"),
  ppaEndDate: date("ppaEndDate"),
  
  // Demo/Seed data flag - only visible to superusers
  isDemo: boolean("isDemo").default(false).notNull(),
  createdBy: int("createdBy"), // User who created this project
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// Document categories - flexible and dynamic
export const documentCategories = mysqlTable("documentCategories", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"), // null = global default, otherwise org-specific
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // lucide icon name
  color: varchar("color", { length: 20 }), // hex or css color
  sortOrder: int("sortOrder").default(0),
  isSystem: boolean("isSystem").default(false), // true = cannot be deleted
  isActive: boolean("isActive").default(true),
  parentCategoryId: int("parentCategoryId"), // for nested categories
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentCategory = typeof documentCategories.$inferSelect;

// Document types within categories - flexible and AI-extensible
export const documentTypes = mysqlTable("documentTypes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"), // null = global default
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  description: text("description"),
  required: boolean("required").default(false),
  sortOrder: int("sortOrder").default(0),
  isSystem: boolean("isSystem").default(false), // true = cannot be deleted
  isActive: boolean("isActive").default(true),
  aiCreated: boolean("aiCreated").default(false), // true = created by AI
  aiCreatedReason: text("aiCreatedReason"), // why AI created this type
  // Extraction configuration for specialized document types
  extractionConfig: json("extractionConfig").$type<{
    type: "financial_model" | "energy_report" | "technical_design" | "standard";
    extractFields?: string[]; // fields to extract (e.g., ["npv", "irr", "payback"])
    fileTypes?: string[]; // allowed file types (e.g., [".xlsx", ".xlsm"])
    softwareSources?: string[]; // e.g., ["Homer Pro", "PVsyst", "SAM"]
  }>(),
  // Validation rules
  validationRules: json("validationRules").$type<{
    maxFileSize?: number; // in MB
    requiredFields?: string[];
    expirationDays?: number; // document expires after N days
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentType = typeof documentTypes.$inferSelect;

// Documents
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  documentTypeId: int("documentTypeId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  status: mysqlEnum("status", ["verified", "pending", "missing", "na", "rejected", "unverified"]).default("unverified"),
  version: int("version").default(1),
  uploadedById: int("uploadedById"),
  notes: text("notes"),
  tags: json("tags").$type<string[]>(),
  aiCategorySuggestion: varchar("aiCategorySuggestion", { length: 255 }),
  aiCategoryConfidence: decimal("aiCategoryConfidence", { precision: 3, scale: 2 }),
  isInternalOnly: boolean("isInternalOnly").default(false),
  
  // Soft-delete / immutability fields
  visibilityState: mysqlEnum("visibilityState", ["active", "archived", "superseded"]).default("active").notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  archiveReason: text("archiveReason"),
  supersededById: int("supersededById"), // Document that supersedes this one
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Document versions for tracking history
export const documentVersions = mysqlTable("documentVersions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId"), // For general documents
  submissionId: int("submissionId"), // For response submissions
  version: int("version").notNull().default(1),
  fileName: varchar("fileName", { length: 500 }),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  uploadedById: int("uploadedById"),
  uploadedByName: varchar("uploadedByName", { length: 255 }),
  notes: text("notes"), // Change notes for this version
  isCurrentVersion: boolean("isCurrentVersion").default(true),
  checksum: varchar("checksum", { length: 64 }), // For diff comparison
  metadata: json("metadata").$type<{
    extractedText?: string;
    pageCount?: number;
    dimensions?: { width: number; height: number };
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// FINANCIAL MODELS MODULE
// Specialized handling for Excel/XLSM financial models with
// automatic extraction of key metrics (NPV, IRR, Payback, etc.)
// ═══════════════════════════════════════════════════════════════

// Financial Models - specialized document type for financial analysis
export const financialModels = mysqlTable("financialModels", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  documentId: int("documentId"), // Link to documents table
  
  // Model identification
  name: varchar("name", { length: 255 }).notNull(),
  version: int("version").default(1).notNull(),
  modelType: mysqlEnum("modelType", [
    "project_finance", "acquisition", "development", "refinancing", 
    "valuation", "budget", "cashflow_forecast", "other"
  ]).default("project_finance"),
  
  // File info
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileName: varchar("fileName", { length: 500 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  
  // Model metadata
  modelDate: timestamp("modelDate"), // Date the model represents
  baseCase: boolean("baseCase").default(true), // Is this the base case?
  scenarioName: varchar("scenarioName", { length: 100 }), // e.g., "Base", "Upside", "Downside"
  
  // Status tracking
  status: mysqlEnum("status", ["draft", "review", "approved", "superseded", "archived"]).default("draft"),
  stage: mysqlEnum("stage", [
    "development", "ntp", "construction", "cod", "operations", "financial_close"
  ]),
  
  // Extraction status
  extractionStatus: mysqlEnum("extractionStatus", ["pending", "processing", "completed", "failed"]).default("pending"),
  extractionError: text("extractionError"),
  extractedAt: timestamp("extractedAt"),
  
  // Audit
  uploadedById: int("uploadedById"),
  notes: text("notes"),
  isCurrentVersion: boolean("isCurrentVersion").default(true),
  previousVersionId: int("previousVersionId"), // Link to previous version
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialModel = typeof financialModels.$inferSelect;
export type InsertFinancialModel = typeof financialModels.$inferInsert;

// Financial Model Extracted Metrics - key financial metrics extracted from models
export const financialModelMetrics = mysqlTable("financialModelMetrics", {
  id: int("id").autoincrement().primaryKey(),
  financialModelId: int("financialModelId").notNull(),
  
  // Core project economics
  npv: decimal("npv", { precision: 18, scale: 2 }), // Net Present Value
  irr: decimal("irr", { precision: 8, scale: 4 }), // Internal Rate of Return (as decimal, e.g., 0.12 = 12%)
  paybackYears: decimal("paybackYears", { precision: 6, scale: 2 }), // Simple payback period
  discountedPaybackYears: decimal("discountedPaybackYears", { precision: 6, scale: 2 }),
  moic: decimal("moic", { precision: 8, scale: 4 }), // Multiple on Invested Capital
  
  // Revenue metrics
  totalRevenue: decimal("totalRevenue", { precision: 18, scale: 2 }),
  avgAnnualRevenue: decimal("avgAnnualRevenue", { precision: 18, scale: 2 }),
  ppaRate: decimal("ppaRate", { precision: 10, scale: 4 }), // $/MWh or $/kWh
  escalationRate: decimal("escalationRate", { precision: 6, scale: 4 }), // Annual escalation %
  
  // Cost metrics
  totalCapex: decimal("totalCapex", { precision: 18, scale: 2 }),
  capexPerKw: decimal("capexPerKw", { precision: 10, scale: 2 }),
  totalOpex: decimal("totalOpex", { precision: 18, scale: 2 }),
  avgAnnualOpex: decimal("avgAnnualOpex", { precision: 18, scale: 2 }),
  opexPerKwYear: decimal("opexPerKwYear", { precision: 10, scale: 2 }),
  
  // EBITDA metrics
  year1Ebitda: decimal("year1Ebitda", { precision: 18, scale: 2 }),
  avgEbitda: decimal("avgEbitda", { precision: 18, scale: 2 }),
  ebitdaMargin: decimal("ebitdaMargin", { precision: 6, scale: 4 }), // As decimal
  
  // Debt metrics
  debtAmount: decimal("debtAmount", { precision: 18, scale: 2 }),
  equityAmount: decimal("equityAmount", { precision: 18, scale: 2 }),
  leverageRatio: decimal("leverageRatio", { precision: 6, scale: 4 }),
  dscr: decimal("dscr", { precision: 6, scale: 2 }), // Debt Service Coverage Ratio
  minDscr: decimal("minDscr", { precision: 6, scale: 2 }),
  avgDscr: decimal("avgDscr", { precision: 6, scale: 2 }),
  interestRate: decimal("interestRate", { precision: 6, scale: 4 }),
  debtTenorYears: int("debtTenorYears"),
  
  // Production metrics
  annualProductionMwh: decimal("annualProductionMwh", { precision: 14, scale: 2 }),
  capacityFactor: decimal("capacityFactor", { precision: 6, scale: 4 }),
  degradationRate: decimal("degradationRate", { precision: 6, scale: 4 }),
  p50Production: decimal("p50Production", { precision: 14, scale: 2 }),
  p90Production: decimal("p90Production", { precision: 14, scale: 2 }),
  
  // Project parameters
  projectLifeYears: int("projectLifeYears"),
  codDate: timestamp("codDate"),
  ppaTermYears: int("ppaTermYears"),
  
  // Currency and assumptions
  currency: varchar("currency", { length: 3 }).default("USD"),
  discountRate: decimal("discountRate", { precision: 6, scale: 4 }),
  inflationRate: decimal("inflationRate", { precision: 6, scale: 4 }),
  taxRate: decimal("taxRate", { precision: 6, scale: 4 }),
  
  // Extraction metadata
  extractionConfidence: decimal("extractionConfidence", { precision: 5, scale: 4 }),
  extractionNotes: text("extractionNotes"),
  manualOverrides: json("manualOverrides").$type<Record<string, boolean>>(), // Which fields were manually corrected
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialModelMetrics = typeof financialModelMetrics.$inferSelect;
export type InsertFinancialModelMetrics = typeof financialModelMetrics.$inferInsert;

// Financial Model Cash Flows - year-by-year cash flow data
export const financialModelCashFlows = mysqlTable("financialModelCashFlows", {
  id: int("id").autoincrement().primaryKey(),
  financialModelId: int("financialModelId").notNull(),
  
  // Time period
  year: int("year").notNull(), // Year number (1, 2, 3...) or calendar year
  calendarYear: int("calendarYear"), // Actual calendar year if known
  periodType: mysqlEnum("periodType", ["construction", "operations", "tail"]).default("operations"),
  
  // Revenue
  revenue: decimal("revenue", { precision: 18, scale: 2 }),
  energyRevenue: decimal("energyRevenue", { precision: 18, scale: 2 }),
  capacityRevenue: decimal("capacityRevenue", { precision: 18, scale: 2 }),
  ancillaryRevenue: decimal("ancillaryRevenue", { precision: 18, scale: 2 }),
  otherRevenue: decimal("otherRevenue", { precision: 18, scale: 2 }),
  
  // Operating costs
  opex: decimal("opex", { precision: 18, scale: 2 }),
  oAndM: decimal("oAndM", { precision: 18, scale: 2 }),
  insurance: decimal("insurance", { precision: 18, scale: 2 }),
  landLease: decimal("landLease", { precision: 18, scale: 2 }),
  propertyTax: decimal("propertyTax", { precision: 18, scale: 2 }),
  management: decimal("management", { precision: 18, scale: 2 }),
  otherOpex: decimal("otherOpex", { precision: 18, scale: 2 }),
  
  // EBITDA
  ebitda: decimal("ebitda", { precision: 18, scale: 2 }),
  
  // Capital items
  capex: decimal("capex", { precision: 18, scale: 2 }),
  majorMaintenance: decimal("majorMaintenance", { precision: 18, scale: 2 }),
  workingCapital: decimal("workingCapital", { precision: 18, scale: 2 }),
  
  // Debt service
  debtService: decimal("debtService", { precision: 18, scale: 2 }),
  interestPayment: decimal("interestPayment", { precision: 18, scale: 2 }),
  principalPayment: decimal("principalPayment", { precision: 18, scale: 2 }),
  debtBalance: decimal("debtBalance", { precision: 18, scale: 2 }),
  dscr: decimal("dscr", { precision: 6, scale: 2 }),
  
  // Tax
  taxableIncome: decimal("taxableIncome", { precision: 18, scale: 2 }),
  incomeTax: decimal("incomeTax", { precision: 18, scale: 2 }),
  taxCredits: decimal("taxCredits", { precision: 18, scale: 2 }), // ITC, PTC, etc.
  depreciation: decimal("depreciation", { precision: 18, scale: 2 }),
  
  // Cash flows
  cashFlowFromOperations: decimal("cashFlowFromOperations", { precision: 18, scale: 2 }),
  freeCashFlow: decimal("freeCashFlow", { precision: 18, scale: 2 }),
  cashFlowToEquity: decimal("cashFlowToEquity", { precision: 18, scale: 2 }),
  distributions: decimal("distributions", { precision: 18, scale: 2 }),
  
  // Production
  productionMwh: decimal("productionMwh", { precision: 14, scale: 2 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FinancialModelCashFlow = typeof financialModelCashFlows.$inferSelect;
export type InsertFinancialModelCashFlow = typeof financialModelCashFlows.$inferInsert;

// Financial Model Comparisons - track actual vs projected performance
export const financialModelComparisons = mysqlTable("financialModelComparisons", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  financialModelId: int("financialModelId").notNull(), // The model being compared against
  
  // Comparison period
  comparisonDate: timestamp("comparisonDate").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  periodType: mysqlEnum("periodType", ["monthly", "quarterly", "annual"]).default("monthly"),
  
  // Projected values (from model)
  projectedRevenue: decimal("projectedRevenue", { precision: 18, scale: 2 }),
  projectedOpex: decimal("projectedOpex", { precision: 18, scale: 2 }),
  projectedEbitda: decimal("projectedEbitda", { precision: 18, scale: 2 }),
  projectedProduction: decimal("projectedProduction", { precision: 14, scale: 2 }),
  
  // Actual values (from billing/operations)
  actualRevenue: decimal("actualRevenue", { precision: 18, scale: 2 }),
  actualOpex: decimal("actualOpex", { precision: 18, scale: 2 }),
  actualEbitda: decimal("actualEbitda", { precision: 18, scale: 2 }),
  actualProduction: decimal("actualProduction", { precision: 14, scale: 2 }),
  
  // Variance analysis
  revenueVariance: decimal("revenueVariance", { precision: 18, scale: 2 }),
  revenueVariancePercent: decimal("revenueVariancePercent", { precision: 8, scale: 4 }),
  opexVariance: decimal("opexVariance", { precision: 18, scale: 2 }),
  opexVariancePercent: decimal("opexVariancePercent", { precision: 8, scale: 4 }),
  ebitdaVariance: decimal("ebitdaVariance", { precision: 18, scale: 2 }),
  ebitdaVariancePercent: decimal("ebitdaVariancePercent", { precision: 8, scale: 4 }),
  productionVariance: decimal("productionVariance", { precision: 14, scale: 2 }),
  productionVariancePercent: decimal("productionVariancePercent", { precision: 8, scale: 4 }),
  
  // Notes and analysis
  varianceNotes: text("varianceNotes"),
  aiAnalysis: text("aiAnalysis"), // AI-generated variance explanation
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
});

export type FinancialModelComparison = typeof financialModelComparisons.$inferSelect;
export type InsertFinancialModelComparison = typeof financialModelComparisons.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// ENERGY REPORTS & TECHNICAL DOCUMENTS
// Specialized handling for energy reports (Homer Pro, PVsyst, etc.)
// ═══════════════════════════════════════════════════════════════

// Energy Reports - specialized document type for energy analysis reports
export const energyReports = mysqlTable("energyReports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  documentId: int("documentId"), // Link to documents table
  
  // Report identification
  name: varchar("name", { length: 255 }).notNull(),
  reportType: mysqlEnum("reportType", [
    "pvsyst", "homer_pro", "sam", "helioscope", "aurora", 
    "wind_resource", "solar_resource", "grid_study", "other"
  ]).notNull(),
  softwareVersion: varchar("softwareVersion", { length: 50 }),
  
  // File info
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileName: varchar("fileName", { length: 500 }),
  
  // Report date and version
  reportDate: timestamp("reportDate"),
  version: int("version").default(1),
  isCurrentVersion: boolean("isCurrentVersion").default(true),
  
  // Key extracted metrics (common across report types)
  annualProductionMwh: decimal("annualProductionMwh", { precision: 14, scale: 2 }),
  specificYield: decimal("specificYield", { precision: 10, scale: 2 }), // kWh/kWp
  performanceRatio: decimal("performanceRatio", { precision: 6, scale: 4 }),
  capacityFactor: decimal("capacityFactor", { precision: 6, scale: 4 }),
  systemLosses: decimal("systemLosses", { precision: 6, scale: 4 }),
  
  // P-values (probabilistic production estimates)
  p50Production: decimal("p50Production", { precision: 14, scale: 2 }),
  p75Production: decimal("p75Production", { precision: 14, scale: 2 }),
  p90Production: decimal("p90Production", { precision: 14, scale: 2 }),
  p99Production: decimal("p99Production", { precision: 14, scale: 2 }),
  
  // Resource data
  ghi: decimal("ghi", { precision: 10, scale: 2 }), // Global Horizontal Irradiance (kWh/m²/year)
  dni: decimal("dni", { precision: 10, scale: 2 }), // Direct Normal Irradiance
  dhi: decimal("dhi", { precision: 10, scale: 2 }), // Diffuse Horizontal Irradiance
  avgWindSpeed: decimal("avgWindSpeed", { precision: 6, scale: 2 }), // m/s
  avgTemperature: decimal("avgTemperature", { precision: 5, scale: 2 }), // °C
  
  // Extended metadata (JSON for flexibility)
  extractedData: json("extractedData").$type<{
    monthlyProduction?: number[];
    hourlyProfile?: number[];
    lossBreakdown?: Record<string, number>;
    systemConfig?: Record<string, unknown>;
    weatherSource?: string;
    simulationPeriod?: { start: string; end: string };
  }>(),
  
  // Extraction status
  extractionStatus: mysqlEnum("extractionStatus", ["pending", "processing", "completed", "failed"]).default("pending"),
  extractionConfidence: decimal("extractionConfidence", { precision: 5, scale: 4 }),
  
  // Audit
  uploadedById: int("uploadedById"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EnergyReport = typeof energyReports.$inferSelect;
export type InsertEnergyReport = typeof energyReports.$inferInsert;

// Technical Designs - SLDs, 3D designs, layouts, etc.
export const technicalDesigns = mysqlTable("technicalDesigns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  documentId: int("documentId"), // Link to documents table
  
  // Design identification
  name: varchar("name", { length: 255 }).notNull(),
  designType: mysqlEnum("designType", [
    "sld", "layout", "3d_model", "structural", "electrical", 
    "civil", "mechanical", "as_built", "other"
  ]).notNull(),
  
  // File info
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileName: varchar("fileName", { length: 500 }),
  
  // Design metadata
  designDate: timestamp("designDate"),
  revisionNumber: varchar("revisionNumber", { length: 20 }),
  version: int("version").default(1),
  isCurrentVersion: boolean("isCurrentVersion").default(true),
  
  // Design status
  status: mysqlEnum("status", ["draft", "for_review", "approved", "as_built", "superseded"]).default("draft"),
  approvedById: int("approvedById"),
  approvedAt: timestamp("approvedAt"),
  
  // Extracted metadata (if applicable)
  extractedData: json("extractedData").$type<{
    equipmentList?: Array<{ type: string; model: string; quantity: number }>;
    systemCapacity?: { dc: number; ac: number };
    voltageLevel?: string;
    interconnectionPoint?: string;
  }>(),
  
  // Audit
  uploadedById: int("uploadedById"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TechnicalDesign = typeof technicalDesigns.$inferSelect;
export type InsertTechnicalDesign = typeof technicalDesigns.$inferInsert;

// Reviewer groups for document approvals
export const reviewerGroups = mysqlTable("reviewerGroups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: mysqlEnum("code", ["legal", "technical", "finance"]).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0),
});

export type ReviewerGroup = typeof reviewerGroups.$inferSelect;

// Document reviewer assignments and approvals
export const documentReviews = mysqlTable("documentReviews", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  reviewerGroupId: int("reviewerGroupId").notNull(),
  reviewerId: int("reviewerId"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "needs_revision"]).default("pending").notNull(),
  notes: text("notes"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DocumentReview = typeof documentReviews.$inferSelect;
export type InsertDocumentReview = typeof documentReviews.$inferInsert;

// RFIs / Action Items
export const rfis = mysqlTable("rfis", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  code: varchar("code", { length: 50 }),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  category: varchar("category", { length: 100 }),
  tags: json("tags").$type<string[]>(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).default("medium"),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open"),
  itemType: mysqlEnum("itemType", ["rfi", "task", "risk", "issue"]).default("rfi"),
  assigneeId: int("assigneeId"),
  submittedById: int("submittedById"),
  dueDate: date("dueDate"),
  resolvedAt: timestamp("resolvedAt"),
  isInternalOnly: boolean("isInternalOnly").default(false),
  
  // Soft-delete / immutability fields
  visibilityState: mysqlEnum("visibilityState", ["active", "archived", "superseded"]).default("active").notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  archiveReason: text("archiveReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rfi = typeof rfis.$inferSelect;
export type InsertRfi = typeof rfis.$inferInsert;

// RFI Comments
export const rfiComments = mysqlTable("rfiComments", {
  id: int("id").autoincrement().primaryKey(),
  rfiId: int("rfiId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  isInternalOnly: boolean("isInternalOnly").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RfiComment = typeof rfiComments.$inferSelect;
export type InsertRfiComment = typeof rfiComments.$inferInsert;

// RFI linked documents
export const rfiDocuments = mysqlTable("rfiDocuments", {
  id: int("id").autoincrement().primaryKey(),
  rfiId: int("rfiId").notNull(),
  documentId: int("documentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  rfiDocumentUnique: uniqueIndex("rfi_document_unique").on(table.rfiId, table.documentId),
}));

export type RfiDocument = typeof rfiDocuments.$inferSelect;

// RFI linked checklist items
export const rfiChecklistLinks = mysqlTable("rfiChecklistLinks", {
  id: int("id").autoincrement().primaryKey(),
  rfiId: int("rfiId").notNull(),
  checklistItemId: int("checklistItemId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  rfiChecklistUnique: uniqueIndex("rfi_checklist_unique").on(table.rfiId, table.checklistItemId),
}));

export type RfiChecklistLink = typeof rfiChecklistLinks.$inferSelect;

// RFI linked schedule items
export const rfiScheduleLinks = mysqlTable("rfiScheduleLinks", {
  id: int("id").autoincrement().primaryKey(),
  rfiId: int("rfiId").notNull(),
  scheduleItemId: int("scheduleItemId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  rfiScheduleUnique: uniqueIndex("rfi_schedule_unique").on(table.rfiId, table.scheduleItemId),
}));

export type RfiScheduleLink = typeof rfiScheduleLinks.$inferSelect;

// Asset details - key-value store for project attributes
export const assetDetails = mysqlTable("assetDetails", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  fieldValue: text("fieldValue"),
  unit: varchar("unit", { length: 50 }),
  isAiExtracted: boolean("isAiExtracted").default(false),
  aiConfidence: decimal("aiConfidence", { precision: 3, scale: 2 }),
  sourceDocumentId: int("sourceDocumentId"),
  sourcePage: int("sourcePage"),
  sourceTextSnippet: text("sourceTextSnippet"),
  extractedAt: timestamp("extractedAt"),
  isVerified: boolean("isVerified").default(false),
  verifiedById: int("verifiedById"),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetDetail = typeof assetDetails.$inferSelect;
export type InsertAssetDetail = typeof assetDetails.$inferInsert;

// Schedule phases
export const schedulePhases = mysqlTable("schedulePhases", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  sortOrder: int("sortOrder").default(0),
});

export type SchedulePhase = typeof schedulePhases.$inferSelect;

// Schedule items
export const scheduleItems = mysqlTable("scheduleItems", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  phaseId: int("phaseId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  startDate: date("startDate"),
  endDate: date("endDate"),
  targetEndDate: date("targetEndDate"),
  duration: int("duration"),
  progress: int("progress").default(0),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed", "overdue", "blocked"]).default("not_started"),
  dependencies: json("dependencies").$type<number[]>(),
  assigneeId: int("assigneeId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type InsertScheduleItem = typeof scheduleItems.$inferInsert;

// AI Extractions - for document detail extraction with full traceability
export const aiExtractions = mysqlTable("aiExtractions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  extractedValue: text("extractedValue"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  sourcePage: int("sourcePage"),
  sourceTextSnippet: text("sourceTextSnippet"),
  boundingBox: json("boundingBox").$type<{ page: number; x: number; y: number; width: number; height: number }>(),
  status: mysqlEnum("status", ["unverified", "pending", "accepted", "rejected"]).default("unverified"),
  extractedAt: timestamp("extractedAt").defaultNow().notNull(),
  reviewedById: int("reviewedById"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiExtraction = typeof aiExtractions.$inferSelect;
export type InsertAiExtraction = typeof aiExtractions.$inferInsert;

// Transaction / Closing Checklist
export const closingChecklists = mysqlTable("closingChecklists", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  transactionType: mysqlEnum("transactionType", ["acquisition", "financing", "sale", "development"]).default("acquisition"),
  targetCloseDate: date("targetCloseDate"),
  status: mysqlEnum("status", ["draft", "active", "completed", "cancelled"]).default("draft"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClosingChecklist = typeof closingChecklists.$inferSelect;
export type InsertClosingChecklist = typeof closingChecklists.$inferInsert;

// Closing Checklist Items
export const closingChecklistItems = mysqlTable("closingChecklistItems", {
  id: int("id").autoincrement().primaryKey(),
  checklistId: int("checklistId").notNull(),
  category: varchar("category", { length: 100 }),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId"),
  status: mysqlEnum("status", ["not_started", "in_progress", "pending_review", "completed", "blocked", "na"]).default("not_started"),
  dueDate: date("dueDate"),
  completedAt: timestamp("completedAt"),
  comments: text("comments"),
  sortOrder: int("sortOrder").default(0),
  isRequired: boolean("isRequired").default(true),
  
  // Soft-delete / immutability fields
  visibilityState: mysqlEnum("visibilityState", ["active", "archived", "superseded"]).default("active").notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  archiveReason: text("archiveReason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ClosingChecklistItem = typeof closingChecklistItems.$inferSelect;
export type InsertClosingChecklistItem = typeof closingChecklistItems.$inferInsert;

// Checklist item linked documents
export const checklistItemDocuments = mysqlTable("checklistItemDocuments", {
  id: int("id").autoincrement().primaryKey(),
  checklistItemId: int("checklistItemId").notNull(),
  documentId: int("documentId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  checklistDocumentUnique: uniqueIndex("checklist_document_unique").on(table.checklistItemId, table.documentId),
}));

export type ChecklistItemDocument = typeof checklistItemDocuments.$inferSelect;

// Alerts / Notifications
export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  projectId: int("projectId"),
  type: mysqlEnum("type", ["document", "rfi", "schedule", "checklist", "approval", "system"]).default("system"),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  linkType: varchar("linkType", { length: 50 }),
  linkId: int("linkId"),
  isRead: boolean("isRead").default(false),
  isDismissed: boolean("isDismissed").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

// Diligence tracking
export const diligenceProgress = mysqlTable("diligenceProgress", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  category: mysqlEnum("category", ["technical", "commercial", "legal"]).notNull(),
  totalItems: int("totalItems").default(0),
  completedItems: int("completedItems").default(0),
  verifiedItems: int("verifiedItems").default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DiligenceProgress = typeof diligenceProgress.$inferSelect;

// Audit log for traceability
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId"),
  oldValue: json("oldValue"),
  newValue: json("newValue"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 1: INGEST ANYTHING (Universal Capture)
// ═══════════════════════════════════════════════════════════════

// Ingested files - universal file storage
export const ingestedFiles = mysqlTable("ingestedFiles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  siteId: int("siteId"),
  originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "docx", "xlsx", "image", "audio", "video", "email", "whatsapp", "other"]).notNull(),
  fileSizeBytes: int("fileSizeBytes"),
  mimeType: varchar("mimeType", { length: 100 }),
  storageUrl: text("storageUrl").notNull(),
  storageKey: varchar("storageKey", { length: 500 }),
  sourceChannel: mysqlEnum("sourceChannel", ["upload", "email", "whatsapp", "api"]).default("upload").notNull(),
  sourceMetadata: json("sourceMetadata").$type<{ sender?: string; timestamp?: string; threadId?: string; subject?: string }>(),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
  ingestedById: int("ingestedById"),
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "completed", "failed"]).default("pending"),
  processingError: text("processingError"),
  // Phase 4: PDF Viewer additions
  previewGenerated: boolean("previewGenerated").default(false),
  previewUrl: text("previewUrl"),
  pageCount: int("pageCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IngestedFile = typeof ingestedFiles.$inferSelect;
export type InsertIngestedFile = typeof ingestedFiles.$inferInsert;

// Extracted content from files
export const extractedContent = mysqlTable("extractedContent", {
  id: int("id").autoincrement().primaryKey(),
  fileId: int("fileId").notNull(),
  contentType: mysqlEnum("contentType", ["full_text", "page_text", "cell_data", "transcription", "ocr", "table_data"]).notNull(),
  pageNumber: int("pageNumber"),
  sheetName: varchar("sheetName", { length: 255 }),
  content: text("content"),
  structuredData: json("structuredData"),
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  extractionMethod: mysqlEnum("extractionMethod", ["native", "ocr", "transcription", "llm", "parser"]).default("native"),
  extractedAt: timestamp("extractedAt").defaultNow().notNull(),
  rawExtractionOutput: json("rawExtractionOutput"),
});

export type ExtractedContent = typeof extractedContent.$inferSelect;
export type InsertExtractedContent = typeof extractedContent.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 2: UNDERSTAND EVERYTHING (Parse & Extract & Connect)
// ═══════════════════════════════════════════════════════════════

// Canonical entities (the "truth" records)
export const entities = mysqlTable("entities", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  entityType: mysqlEnum("entityType", ["site", "company", "person", "equipment", "contract", "permit"]).notNull(),
  canonicalName: varchar("canonicalName", { length: 500 }).notNull(),
  attributes: json("attributes").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Entity = typeof entities.$inferSelect;
export type InsertEntity = typeof entities.$inferInsert;

// Entity mentions found in documents
export const entityMentions = mysqlTable("entityMentions", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId"), // NULL if unresolved
  fileId: int("fileId").notNull(),
  mentionText: varchar("mentionText", { length: 500 }).notNull(),
  mentionType: mysqlEnum("mentionType", ["name", "alias", "reference", "abbreviation"]).default("name"),
  sourcePage: int("sourcePage"),
  sourceLocation: varchar("sourceLocation", { length: 255 }),
  contextSnippet: text("contextSnippet"),
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  resolutionStatus: mysqlEnum("resolutionStatus", ["unresolved", "auto_resolved", "human_verified"]).default("unresolved"),
  resolvedById: int("resolvedById"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EntityMention = typeof entityMentions.$inferSelect;
export type InsertEntityMention = typeof entityMentions.$inferInsert;

// Entity aliases for fuzzy matching
export const entityAliases = mysqlTable("entityAliases", {
  id: int("id").autoincrement().primaryKey(),
  entityId: int("entityId").notNull(),
  alias: varchar("alias", { length: 500 }).notNull(),
  aliasType: mysqlEnum("aliasType", ["abbreviation", "nickname", "alternate_spelling", "typo", "translation"]).default("abbreviation"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EntityAlias = typeof entityAliases.$inferSelect;
export type InsertEntityAlias = typeof entityAliases.$inferInsert;

// Cross-reference checks (assumption vs actual)
export const crossReferences = mysqlTable("crossReferences", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  referenceType: mysqlEnum("referenceType", ["assumption_vs_actual", "duplicate_value", "covenant_check", "discrepancy"]).notNull(),
  sourceAFileId: int("sourceAFileId"),
  sourceAField: varchar("sourceAField", { length: 255 }),
  sourceAValue: text("sourceAValue"),
  sourceBFileId: int("sourceBFileId"),
  sourceBField: varchar("sourceBField", { length: 255 }),
  sourceBValue: text("sourceBValue"),
  discrepancyDetected: boolean("discrepancyDetected").default(false),
  discrepancyNote: text("discrepancyNote"),
  status: mysqlEnum("status", ["pending_review", "reviewed", "resolved", "ignored"]).default("pending_review"),
  reviewedById: int("reviewedById"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CrossReference = typeof crossReferences.$inferSelect;
export type InsertCrossReference = typeof crossReferences.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 3: ANCHOR & VERIFY (VATR - Verified Asset Technical Record)
// ═══════════════════════════════════════════════════════════════

// VATR: Core asset record with all 6 clusters
export const vatrAssets = mysqlTable("vatrAssets", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  siteId: int("siteId"),
  vatrVersion: int("vatrVersion").default(1),
  
  // CLASSIFICATION CLUSTER
  assetClassification: mysqlEnum("assetClassification", [
    "residential",
    "small_commercial",
    "large_commercial",
    "industrial",
    "mini_grid",
    "mesh_grid",
    "interconnected_mini_grids",
    "grid_connected"
  ]).default("grid_connected"),
  gridConnectionType: mysqlEnum("gridConnectionType", [
    "off_grid",
    "grid_connected",
    "grid_tied_with_backup",
    "mini_grid",
    "interconnected_mini_grid",
    "mesh_grid"
  ]).default("grid_connected"),
  networkTopology: mysqlEnum("networkTopology", [
    "radial",
    "ring",
    "mesh",
    "star",
    "unknown"
  ]).default("unknown"),
  
  // Component configuration (multi-select with specs)
  components: json("components").$type<{
    type: "solar_pv" | "bess" | "diesel_generator" | "gas_generator" | "wind" | "hydro" | "biomass" | "grid_metering" | "inverter" | "ems_controller";
    manufacturer?: string;
    model?: string;
    capacityKw?: number;
    quantity?: number;
    specs?: Record<string, unknown>;
  }[]>(),
  
  // Computed configuration profile
  configurationProfile: mysqlEnum("configurationProfile", [
    "PV_ONLY",
    "PV_BESS",
    "PV_DG",
    "PV_BESS_DG",
    "BESS_ONLY",
    "DG_ONLY",
    "WIND_ONLY",
    "WIND_BESS",
    "HYDRO_ONLY",
    "MINIGRID_PV_BESS",
    "MINIGRID_PV_BESS_DG",
    "HYBRID_MULTI",
    "OTHER"
  ]).default("OTHER"),
  
  // Template override (admin can override auto-matched template)
  requirementTemplateId: int("requirementTemplateId"),
  viewTemplateId: int("viewTemplateId"),
  
  // IDENTITY CLUSTER
  assetName: varchar("assetName", { length: 500 }).notNull(),
  assetType: mysqlEnum("assetType", ["solar_pv", "bess", "genset", "minigrid", "hybrid", "wind", "hydro"]).default("solar_pv"),
  ownerEntityId: int("ownerEntityId"),
  locationLat: decimal("locationLat", { precision: 10, scale: 6 }),
  locationLng: decimal("locationLng", { precision: 10, scale: 6 }),
  locationAddress: text("locationAddress"),
  capacityKw: decimal("capacityKw", { precision: 12, scale: 2 }),
  technology: varchar("technology", { length: 255 }),
  installer: varchar("installer", { length: 255 }),
  commissioningDate: date("commissioningDate"),
  
  // TECHNICAL CLUSTER
  equipmentSpecs: json("equipmentSpecs").$type<Record<string, unknown>>(),
  sldDocumentId: int("sldDocumentId"),
  performanceBaseline: json("performanceBaseline").$type<Record<string, unknown>>(),
  degradationCurve: json("degradationCurve").$type<Record<string, unknown>>(),
  
  // OPERATIONAL CLUSTER
  currentAvailabilityPct: decimal("currentAvailabilityPct", { precision: 5, scale: 2 }),
  lastMaintenanceDate: date("lastMaintenanceDate"),
  operationalStatus: mysqlEnum("operationalStatus", ["operational", "maintenance", "offline", "decommissioned"]).default("operational"),
  
  // FINANCIAL CLUSTER
  tariffStructure: json("tariffStructure").$type<Record<string, unknown>>(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // COMPLIANCE CLUSTER
  complianceStatus: mysqlEnum("complianceStatus", ["compliant", "at_risk", "non_compliant", "pending_review"]).default("pending_review"),
  nextAuditDate: date("nextAuditDate"),
  
  // COMMERCIAL CLUSTER
  offtakeType: mysqlEnum("offtakeType", ["ppa", "lease", "esco", "retail", "wholesale"]).default("ppa"),
  contractEndDate: date("contractEndDate"),
  counterpartyEntityId: int("counterpartyEntityId"),
  
  // VATR INTEGRITY
  contentHash: varchar("contentHash", { length: 64 }), // SHA-256
  previousVersionId: int("previousVersionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VatrAsset = typeof vatrAssets.$inferSelect;
export type InsertVatrAsset = typeof vatrAssets.$inferInsert;

// VATR linked documents (source provenance)
export const vatrSourceDocuments = mysqlTable("vatrSourceDocuments", {
  id: int("id").autoincrement().primaryKey(),
  vatrAssetId: int("vatrAssetId").notNull(),
  documentId: int("documentId").notNull(),
  cluster: mysqlEnum("cluster", ["identity", "technical", "operational", "financial", "compliance", "commercial"]).notNull(),
  fieldName: varchar("fieldName", { length: 255 }),
  extractedValue: text("extractedValue"),
  sourcePage: int("sourcePage"),
  sourceSnippet: text("sourceSnippet"),
  linkCreatedAt: timestamp("linkCreatedAt").defaultNow().notNull(),
});

export type VatrSourceDocument = typeof vatrSourceDocuments.$inferSelect;
export type InsertVatrSourceDocument = typeof vatrSourceDocuments.$inferInsert;

// Immutable VATR audit log - ALL changes are logged, including manual overrides
export const vatrAuditLog = mysqlTable("vatrAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  vatrAssetId: int("vatrAssetId").notNull(),
  action: mysqlEnum("action", ["created", "updated", "viewed", "exported", "verified", "manual_override", "ai_extracted", "bulk_import", "deleted", "restored"]).notNull(),
  actorId: int("actorId").notNull(),
  actorRole: varchar("actorRole", { length: 100 }),
  actionTimestamp: timestamp("actionTimestamp").defaultNow().notNull(),
  beforeHash: varchar("beforeHash", { length: 64 }),
  afterHash: varchar("afterHash", { length: 64 }),
  changesJson: json("changesJson"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Manual override tracking
  isManualOverride: boolean("isManualOverride").default(false).notNull(),
  overrideReason: text("overrideReason"),
  originalValue: json("originalValue"), // What was the value before manual change
  newValue: json("newValue"), // What was it changed to
  sourceType: mysqlEnum("sourceType", ["ai_extraction", "manual_entry", "bulk_import", "api", "system"]).default("manual_entry"),
});

export type VatrAuditLogEntry = typeof vatrAuditLog.$inferSelect;
export type InsertVatrAuditLogEntry = typeof vatrAuditLog.$inferInsert;

// VATR Verification records
export const vatrVerifications = mysqlTable("vatrVerifications", {
  id: int("id").autoincrement().primaryKey(),
  vatrAssetId: int("vatrAssetId").notNull(),
  verificationType: mysqlEnum("verificationType", ["hash_check", "human_review", "third_party_audit"]).notNull(),
  verifiedById: int("verifiedById"),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
  verificationResult: mysqlEnum("verificationResult", ["passed", "failed", "pending"]).default("pending"),
  notes: text("notes"),
  certificateUrl: text("certificateUrl"),
});

export type VatrVerification = typeof vatrVerifications.$inferSelect;
export type InsertVatrVerification = typeof vatrVerifications.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 4: ACTIVATE (Power Operations)
// ═══════════════════════════════════════════════════════════════

// Generated reports
export const generatedReports = mysqlTable("generatedReports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  reportType: mysqlEnum("reportType", ["investor_summary", "monthly_performance", "due_diligence", "compliance", "custom"]).notNull(),
  reportName: varchar("reportName", { length: 500 }).notNull(),
  templateId: int("templateId"),
  parameters: json("parameters").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating"),
  fileUrl: text("fileUrl"),
  generatedAt: timestamp("generatedAt"),
  generatedById: int("generatedById"),
  vatrAssetsIncluded: json("vatrAssetsIncluded").$type<number[]>(),
  dataSnapshotHash: varchar("dataSnapshotHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = typeof generatedReports.$inferInsert;

// Compliance tracking
export const complianceItems = mysqlTable("complianceItems", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  vatrAssetId: int("vatrAssetId"),
  itemType: mysqlEnum("itemType", ["permit", "contract", "obligation", "deadline", "license", "insurance"]).notNull(),
  itemName: varchar("itemName", { length: 500 }).notNull(),
  sourceDocumentId: int("sourceDocumentId"),
  dueDate: date("dueDate"),
  renewalDate: date("renewalDate"),
  alertDaysBefore: int("alertDaysBefore").default(30),
  status: mysqlEnum("status", ["active", "expiring_soon", "expired", "renewed", "na"]).default("active"),
  responsiblePartyId: int("responsiblePartyId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ComplianceItem = typeof complianceItems.$inferSelect;
export type InsertComplianceItem = typeof complianceItems.$inferInsert;

// Compliance alerts
export const complianceAlerts = mysqlTable("complianceAlerts", {
  id: int("id").autoincrement().primaryKey(),
  complianceItemId: int("complianceItemId").notNull(),
  alertType: mysqlEnum("alertType", ["expiring_soon", "expired", "missing_document", "renewal_due"]).notNull(),
  triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved"]).default("open"),
  acknowledgedById: int("acknowledgedById"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  resolutionNote: text("resolutionNote"),
});

export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type InsertComplianceAlert = typeof complianceAlerts.$inferInsert;

// Data rooms
export const dataRooms = mysqlTable("dataRooms", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  accessType: mysqlEnum("accessType", ["private", "link_only", "public"]).default("private"),
  accessToken: varchar("accessToken", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
});

export type DataRoom = typeof dataRooms.$inferSelect;
export type InsertDataRoom = typeof dataRooms.$inferInsert;

// Data room contents
export const dataRoomItems = mysqlTable("dataRoomItems", {
  id: int("id").autoincrement().primaryKey(),
  dataRoomId: int("dataRoomId").notNull(),
  category: mysqlEnum("category", ["corporate", "technical", "financial", "legal", "commercial", "operational"]).default("technical"),
  documentId: int("documentId"),
  vatrAssetId: int("vatrAssetId"),
  itemName: varchar("itemName", { length: 500 }),
  sortOrder: int("sortOrder").default(0),
  verificationStatus: mysqlEnum("verificationStatus", ["verified", "pending", "unverified"]).default("unverified"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type DataRoomItem = typeof dataRoomItems.$inferSelect;
export type InsertDataRoomItem = typeof dataRoomItems.$inferInsert;

// Data room access log
export const dataRoomAccessLog = mysqlTable("dataRoomAccessLog", {
  id: int("id").autoincrement().primaryKey(),
  dataRoomId: int("dataRoomId").notNull(),
  accessorEmail: varchar("accessorEmail", { length: 320 }),
  accessorIp: varchar("accessorIp", { length: 45 }),
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
  documentsViewed: json("documentsViewed").$type<number[]>(),
  downloadCount: int("downloadCount").default(0),
});

export type DataRoomAccessLogEntry = typeof dataRoomAccessLog.$inferSelect;
export type InsertDataRoomAccessLogEntry = typeof dataRoomAccessLog.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 5: MULTI-CHANNEL INTERFACE
// ═══════════════════════════════════════════════════════════════

// WhatsApp integration config
export const whatsappConfigs = mysqlTable("whatsappConfigs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  phoneNumber: varchar("phoneNumber", { length: 20 }),
  webhookSecret: varchar("webhookSecret", { length: 255 }),
  defaultSiteId: int("defaultSiteId"),
  autoCategorize: boolean("autoCategorize").default(true),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappConfig = typeof whatsappConfigs.$inferSelect;
export type InsertWhatsappConfig = typeof whatsappConfigs.$inferInsert;

// WhatsApp messages received
export const whatsappMessages = mysqlTable("whatsappMessages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  siteId: int("siteId"),
  configId: int("configId"),
  sessionId: int("sessionId"), // Link to conversationSessions
  waMessageId: varchar("waMessageId", { length: 100 }).unique(),
  senderPhone: varchar("senderPhone", { length: 20 }),
  senderName: varchar("senderName", { length: 255 }),
  recipientPhone: varchar("recipientPhone", { length: 20 }),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).default("inbound"),
  messageType: mysqlEnum("messageType", ["text", "image", "audio", "video", "document"]).default("text"),
  messageContent: text("messageContent"),
  mediaUrl: text("mediaUrl"),
  category: mysqlEnum("category", ["field_report", "issue", "document", "general"]).default("general"),
  ingestedFileId: int("ingestedFileId"),
  timestamp: timestamp("timestamp").defaultNow(), // Message timestamp for ordering
  receivedAt: timestamp("receivedAt"),
  processedAt: timestamp("processedAt"),
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "completed", "failed", "sent"]).default("pending"),
  linkedWorkspaceItemId: int("linkedWorkspaceItemId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

// Email integration config
export const emailConfigs = mysqlTable("emailConfigs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  inboundAddress: varchar("inboundAddress", { length: 320 }).unique(),
  forwardFromAddresses: json("forwardFromAddresses").$type<string[]>(),
  defaultSiteId: int("defaultSiteId"),
  autoCategorize: boolean("autoCategorize").default(true),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailConfig = typeof emailConfigs.$inferSelect;
export type InsertEmailConfig = typeof emailConfigs.$inferInsert;

// API keys for external access
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  keyHash: varchar("keyHash", { length: 255 }).notNull(),
  keyPrefix: varchar("keyPrefix", { length: 8 }),
  scopes: json("scopes").$type<string[]>(),
  rateLimitPerHour: int("rateLimitPerHour").default(1000),
  lastUsedAt: timestamp("lastUsedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  revokedAt: timestamp("revokedAt"),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// API request log
export const apiRequestLog = mysqlTable("apiRequestLog", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId"),
  endpoint: varchar("endpoint", { length: 500 }),
  method: varchar("method", { length: 10 }),
  statusCode: int("statusCode"),
  requestTimestamp: timestamp("requestTimestamp").defaultNow().notNull(),
  responseTimeMs: int("responseTimeMs"),
  ipAddress: varchar("ipAddress", { length: 45 }),
});

export type ApiRequestLogEntry = typeof apiRequestLog.$inferSelect;
export type InsertApiRequestLogEntry = typeof apiRequestLog.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// PHASE 4: PDF VIEWER & DOCUMENT ANALYTICS
// ═══════════════════════════════════════════════════════════════

// Document view events for analytics
export const documentViewEvents = mysqlTable("documentViewEvents", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  pageViewed: int("pageViewed"),
  viewDurationSeconds: int("viewDurationSeconds"),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
});

export type DocumentViewEvent = typeof documentViewEvents.$inferSelect;
export type InsertDocumentViewEvent = typeof documentViewEvents.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PHASE 4: BULK ENTITY RESOLUTION
// ═══════════════════════════════════════════════════════════════

// Entity resolution jobs for batch processing
export const entityResolutionJobs = mysqlTable("entityResolutionJobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
  totalMentions: int("totalMentions"),
  resolvedCount: int("resolvedCount").default(0),
  createdCount: int("createdCount").default(0),
  ignoredCount: int("ignoredCount").default(0),
  errorCount: int("errorCount").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdById: int("createdById"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EntityResolutionJob = typeof entityResolutionJobs.$inferSelect;
export type InsertEntityResolutionJob = typeof entityResolutionJobs.$inferInsert;

// Entity resolution history for audit trail
export const entityResolutionHistory = mysqlTable("entityResolutionHistory", {
  id: int("id").autoincrement().primaryKey(),
  mentionId: int("mentionId").notNull(),
  action: mysqlEnum("action", ["linked", "created", "ignored", "unlinked"]).notNull(),
  previousEntityId: int("previousEntityId"),
  newEntityId: int("newEntityId"),
  resolutionMethod: mysqlEnum("resolutionMethod", ["manual", "bulk", "auto_rule", "ai_suggested"]).default("manual"),
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  resolvedById: int("resolvedById"),
  resolvedAt: timestamp("resolvedAt").defaultNow().notNull(),
});

export type EntityResolutionHistoryEntry = typeof entityResolutionHistory.$inferSelect;
export type InsertEntityResolutionHistoryEntry = typeof entityResolutionHistory.$inferInsert;

// Auto-resolution rules
export const entityResolutionRules = mysqlTable("entityResolutionRules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  matchType: mysqlEnum("matchType", ["exact_alias", "fuzzy_name", "regex"]).notNull(),
  matchPattern: text("matchPattern"),
  targetEntityId: int("targetEntityId"),
  autoResolve: boolean("autoResolve").default(false),
  minConfidence: decimal("minConfidence", { precision: 3, scale: 2 }),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EntityResolutionRule = typeof entityResolutionRules.$inferSelect;
export type InsertEntityResolutionRule = typeof entityResolutionRules.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PHASE 4: WHATSAPP BUSINESS API ENHANCEMENTS
// ═══════════════════════════════════════════════════════════════

// WhatsApp sender mappings for auto-routing
export const whatsappSenderMappings = mysqlTable("whatsappSenderMappings", {
  id: int("id").autoincrement().primaryKey(),
  configId: int("configId").notNull(),
  senderPhone: varchar("senderPhone", { length: 20 }).notNull(),
  senderName: varchar("senderName", { length: 255 }),
  projectId: int("projectId"),
  siteId: int("siteId"),
  defaultCategory: mysqlEnum("defaultCategory", ["field_report", "issue", "document", "general"]).default("general"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappSenderMapping = typeof whatsappSenderMappings.$inferSelect;
export type InsertWhatsappSenderMapping = typeof whatsappSenderMappings.$inferInsert;

// WhatsApp message templates
export const whatsappTemplates = mysqlTable("whatsappTemplates", {
  id: int("id").autoincrement().primaryKey(),
  configId: int("configId").notNull(),
  templateName: varchar("templateName", { length: 255 }).notNull(),
  templateType: mysqlEnum("templateType", ["text", "media", "interactive"]).default("text"),
  content: json("content"),
  metaTemplateId: varchar("metaTemplateId", { length: 100 }),
  status: mysqlEnum("status", ["draft", "pending_approval", "approved", "rejected"]).default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// PHASE 4: OPERATIONS MONITORING OS
// ═══════════════════════════════════════════════════════════════

// Data connectors (AMMP, Victron, SolarEdge, etc.)
export const connectors = mysqlTable("connectors", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  connectorType: mysqlEnum("connectorType", ["ammp", "victron", "solaredge", "sma", "huawei", "fronius", "enphase", "demo", "custom_api", "csv_import"]).notNull(),
  status: mysqlEnum("status", ["active", "inactive", "error", "configuring"]).default("configuring"),
  lastSyncAt: timestamp("lastSyncAt"),
  syncFrequencyMinutes: int("syncFrequencyMinutes").default(15),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Connector = typeof connectors.$inferSelect;
export type InsertConnector = typeof connectors.$inferInsert;

// Connector credentials (encrypted)
export const connectorCredentials = mysqlTable("connectorCredentials", {
  id: int("id").autoincrement().primaryKey(),
  connectorId: int("connectorId").notNull(),
  credentialType: varchar("credentialType", { length: 50 }).notNull(), // api_key, oauth_token, username, password, etc.
  credentialValueEncrypted: text("credentialValueEncrypted").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConnectorCredential = typeof connectorCredentials.$inferSelect;
export type InsertConnectorCredential = typeof connectorCredentials.$inferInsert;

// Metric definitions (what metrics are tracked)
export const metricDefinitions = mysqlTable("metricDefinitions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull(), // e.g., "pv_power", "battery_soc", "grid_frequency"
  unit: varchar("unit", { length: 50 }), // kW, %, Hz, V, A, kWh
  dataType: mysqlEnum("dataType", ["number", "boolean", "string", "enum"]).default("number"),
  aggregationMethod: mysqlEnum("aggregationMethod", ["avg", "sum", "min", "max", "last", "count"]).default("avg"),
  description: text("description"),
  category: mysqlEnum("category", ["power", "energy", "voltage", "current", "frequency", "temperature", "soc", "status", "environmental", "financial"]).default("power"),
  isStandard: boolean("isStandard").default(false), // Standard metrics vs custom
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MetricDefinition = typeof metricDefinitions.$inferSelect;
export type InsertMetricDefinition = typeof metricDefinitions.$inferInsert;

// Devices (inverters, batteries, meters, etc.)
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull(),
  connectorId: int("connectorId"),
  externalId: varchar("externalId", { length: 255 }), // ID from the external system
  name: varchar("name", { length: 255 }).notNull(),
  deviceType: mysqlEnum("deviceType", ["inverter", "battery", "meter", "weather_station", "genset", "charge_controller", "combiner_box", "transformer", "other"]).notNull(),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  serialNumber: varchar("serialNumber", { length: 100 }),
  capacityKw: decimal("capacityKw", { precision: 10, scale: 2 }),
  capacityKwh: decimal("capacityKwh", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["online", "offline", "warning", "error", "maintenance"]).default("offline"),
  lastSeenAt: timestamp("lastSeenAt"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

// Raw measurements (time-series data - high volume)
export const rawMeasurements = mysqlTable("rawMeasurements", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  metricId: int("metricId").notNull(),
  timestamp: timestamp("timestamp").notNull(),
  valueNumeric: decimal("valueNumeric", { precision: 18, scale: 6 }),
  valueString: varchar("valueString", { length: 255 }),
  quality: mysqlEnum("quality", ["good", "uncertain", "bad", "interpolated"]).default("good"),
  sourceConnectorId: int("sourceConnectorId"),
  ingestedAt: timestamp("ingestedAt").defaultNow().notNull(),
});

export type RawMeasurement = typeof rawMeasurements.$inferSelect;
export type InsertRawMeasurement = typeof rawMeasurements.$inferInsert;

// Normalized measurements (aggregated/cleaned data)
export const normalizedMeasurements = mysqlTable("normalizedMeasurements", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull(),
  deviceId: int("deviceId"),
  metricId: int("metricId").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  periodType: mysqlEnum("periodType", ["minute", "hour", "day", "week", "month"]).notNull(),
  valueAvg: decimal("valueAvg", { precision: 18, scale: 6 }),
  valueMin: decimal("valueMin", { precision: 18, scale: 6 }),
  valueMax: decimal("valueMax", { precision: 18, scale: 6 }),
  valueSum: decimal("valueSum", { precision: 18, scale: 6 }),
  sampleCount: int("sampleCount"),
  dataQuality: decimal("dataQuality", { precision: 3, scale: 2 }), // 0-1 quality score
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type NormalizedMeasurement = typeof normalizedMeasurements.$inferSelect;
export type InsertNormalizedMeasurement = typeof normalizedMeasurements.$inferInsert;

// Derived metrics (calculated values like PR, availability, etc.)
export const derivedMetrics = mysqlTable("derivedMetrics", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull(),
  metricCode: varchar("metricCode", { length: 100 }).notNull(), // e.g., "performance_ratio", "availability"
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  periodType: mysqlEnum("periodType", ["hour", "day", "week", "month", "year"]).notNull(),
  value: decimal("value", { precision: 18, scale: 6 }),
  calculationMethod: varchar("calculationMethod", { length: 100 }),
  inputMetrics: json("inputMetrics").$type<{ metricId: number; value: number }[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DerivedMetric = typeof derivedMetrics.$inferSelect;
export type InsertDerivedMetric = typeof derivedMetrics.$inferInsert;

// Data lineage tracking
export const dataLineage = mysqlTable("dataLineage", {
  id: int("id").autoincrement().primaryKey(),
  targetTable: varchar("targetTable", { length: 100 }).notNull(),
  targetId: int("targetId").notNull(),
  sourceTable: varchar("sourceTable", { length: 100 }).notNull(),
  sourceId: int("sourceId").notNull(),
  transformationType: varchar("transformationType", { length: 100 }), // aggregation, calculation, normalization
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DataLineageEntry = typeof dataLineage.$inferSelect;
export type InsertDataLineageEntry = typeof dataLineage.$inferInsert;

// Alert rules
export const alertRules = mysqlTable("alertRules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  siteId: int("siteId"),
  deviceId: int("deviceId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  metricId: int("metricId"),
  condition: mysqlEnum("condition", ["gt", "gte", "lt", "lte", "eq", "neq", "offline", "change_rate"]).notNull(),
  threshold: decimal("threshold", { precision: 18, scale: 6 }),
  thresholdUnit: varchar("thresholdUnit", { length: 50 }),
  evaluationWindowMinutes: int("evaluationWindowMinutes").default(5),
  severity: mysqlEnum("severity", ["critical", "high", "medium", "low", "info"]).default("medium"),
  notificationChannels: json("notificationChannels").$type<string[]>(), // email, slack, webhook
  enabled: boolean("enabled").default(true),
  cooldownMinutes: int("cooldownMinutes").default(60),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

// Alert events (triggered alerts)
export const alertEvents = mysqlTable("alertEvents", {
  id: int("id").autoincrement().primaryKey(),
  alertRuleId: int("alertRuleId").notNull(),
  siteId: int("siteId"),
  deviceId: int("deviceId"),
  triggeredAt: timestamp("triggeredAt").notNull(),
  triggerValue: decimal("triggerValue", { precision: 18, scale: 6 }),
  status: mysqlEnum("status", ["open", "acknowledged", "resolved", "suppressed"]).default("open"),
  acknowledgedById: int("acknowledgedById"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNote: text("resolutionNote"),
  notificationsSent: json("notificationsSent").$type<{ channel: string; sentAt: string; status: string }[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = typeof alertEvents.$inferInsert;

// Stakeholder portals (read-only views for investors/clients)
export const stakeholderPortals = mysqlTable("stakeholderPortals", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  brandingConfig: json("brandingConfig").$type<{
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  }>(),
  allowedSiteIds: json("allowedSiteIds").$type<number[]>(),
  allowedMetrics: json("allowedMetrics").$type<string[]>(),
  accessType: mysqlEnum("accessType", ["password", "token", "sso"]).default("password"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  accessToken: varchar("accessToken", { length: 64 }),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StakeholderPortal = typeof stakeholderPortals.$inferSelect;
export type InsertStakeholderPortal = typeof stakeholderPortals.$inferInsert;

// Operations reports
export const operationsReports = mysqlTable("operationsReports", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  siteId: int("siteId"),
  reportType: mysqlEnum("reportType", ["daily_summary", "weekly_summary", "monthly_performance", "quarterly_review", "annual_report", "incident_report", "custom"]).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  title: varchar("title", { length: 500 }),
  status: mysqlEnum("status", ["generating", "completed", "failed"]).default("generating"),
  storageUrl: text("storageUrl"),
  generatedAt: timestamp("generatedAt"),
  generatedById: int("generatedById"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OperationsReport = typeof operationsReports.$inferSelect;
export type InsertOperationsReport = typeof operationsReports.$inferInsert;


// Search history for global search
export const searchHistory = mysqlTable("searchHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  query: varchar("query", { length: 500 }).notNull(),
  resultType: mysqlEnum("resultType", ["document", "project", "workspace_item", "all"]).default("all"),
  resultCount: int("resultCount").default(0),
  selectedResultId: int("selectedResultId"),
  selectedResultType: varchar("selectedResultType", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = typeof searchHistory.$inferInsert;

// Team invitations for onboarding
export const teamInvitations = mysqlTable("teamInvitations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["admin", "editor", "reviewer", "investor_viewer"]).default("editor").notNull(),
  invitedById: int("invitedById").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "cancelled"]).default("pending").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;

// Real-time events for WebSocket
export const realtimeEvents = mysqlTable("realtimeEvents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  eventType: mysqlEnum("eventType", [
    "document_uploaded", "document_verified", "document_rejected",
    "rfi_created", "rfi_updated", "rfi_resolved",
    "alert_triggered", "alert_acknowledged", "alert_resolved",
    "checklist_item_completed", "checklist_completed",
    "user_joined", "user_left"
  ]).notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  actorId: int("actorId"),
  targetId: int("targetId"),
  targetType: varchar("targetType", { length: 50 }),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RealtimeEvent = typeof realtimeEvents.$inferSelect;
export type InsertRealtimeEvent = typeof realtimeEvents.$inferInsert;

// User activity log for profile page
export const userActivityLog = mysqlTable("userActivityLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resourceType", { length: 50 }),
  resourceId: int("resourceId"),
  resourceName: varchar("resourceName", { length: 255 }),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserActivityLog = typeof userActivityLog.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLog.$inferInsert;


// Comments for team collaboration
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  /** Type of resource being commented on */
  resourceType: mysqlEnum("resourceType", ["document", "workspace_item", "checklist_item", "project"]).notNull(),
  /** ID of the resource being commented on */
  resourceId: int("resourceId").notNull(),
  /** User who created the comment */
  userId: int("userId").notNull(),
  /** Comment content (supports markdown) */
  content: text("content").notNull(),
  /** Parent comment ID for threaded replies */
  parentId: int("parentId"),
  /** Internal comments are hidden from investor_viewer role */
  isInternal: boolean("isInternal").default(false).notNull(),
  /** Whether the comment has been edited */
  isEdited: boolean("isEdited").default(false).notNull(),
  /** Whether the comment thread is resolved (only applies to top-level comments) */
  isResolved: boolean("isResolved").default(false).notNull(),
  /** Timestamp when the thread was resolved */
  resolvedAt: timestamp("resolvedAt"),
  /** User who resolved the thread */
  resolvedById: int("resolvedById"),
  /** Soft-delete: whether the comment has been deleted */
  isDeleted: boolean("isDeleted").default(false).notNull(),
  /** Timestamp when the comment was deleted */
  deletedAt: timestamp("deletedAt"),
  /** User who deleted the comment */
  deletedBy: int("deletedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// Mentions in comments for notifications
export const commentMentions = mysqlTable("commentMentions", {
  id: int("id").autoincrement().primaryKey(),
  /** Comment containing the mention */
  commentId: int("commentId").notNull(),
  /** User who was mentioned */
  mentionedUserId: int("mentionedUserId").notNull(),
  /** Whether the mentioned user has seen this */
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommentMention = typeof commentMentions.$inferSelect;
export type InsertCommentMention = typeof commentMentions.$inferInsert;


// ============ VATR HIERARCHICAL DATA MODEL ============

// Sites - physical locations within projects
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  portfolioId: int("portfolioId"),
  organizationId: int("organizationId"),
  
  // Identity
  name: varchar("name", { length: 255 }).notNull(),
  siteCode: varchar("siteCode", { length: 50 }), // e.g., "LGS-001"
  description: text("description"),
  
  // Location
  address: text("address"),
  city: varchar("city", { length: 100 }),
  stateProvince: varchar("stateProvince", { length: 100 }),
  country: varchar("country", { length: 100 }).notNull().default("Nigeria"),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  timezone: varchar("timezone", { length: 50 }).default("Africa/Lagos"),
  
  // Classification
  siteType: mysqlEnum("siteType", ["ground_mount", "rooftop", "carport", "floating", "minigrid"]).default("ground_mount"),
  landType: mysqlEnum("landType", ["owned", "leased", "easement"]).default("leased"),
  gridConnection: mysqlEnum("gridConnection", ["grid_tied", "off_grid", "hybrid"]).default("grid_tied"),
  
  // Capacity (aggregated from systems)
  capacityKw: decimal("capacityKw", { precision: 12, scale: 2 }),
  capacityKwh: decimal("capacityKwh", { precision: 12, scale: 2 }),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "decommissioned"]).default("active"),
  operationalStatus: mysqlEnum("operationalStatus", ["online", "offline", "maintenance", "commissioning"]).default("commissioning"),
  codDate: date("codDate"),
  
  // Profile completeness
  profileCompletenessPct: decimal("profileCompletenessPct", { precision: 5, scale: 2 }).default("0"),
  lastProfileUpdate: timestamp("lastProfileUpdate"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Site = typeof sites.$inferSelect;
export type InsertSite = typeof sites.$inferInsert;

// Systems - functional groupings within a site (PV, BESS, Genset, etc.)
export const systems = mysqlTable("systems", {
  id: int("id").autoincrement().primaryKey(),
  siteId: int("siteId").notNull(),
  organizationId: int("organizationId"),
  
  name: varchar("name", { length: 255 }).notNull(),
  systemType: mysqlEnum("systemType", ["pv", "bess", "genset", "hybrid", "wind", "hydro"]).notNull(),
  topology: mysqlEnum("topology", ["dc_coupled", "ac_coupled", "standalone"]).default("standalone"),
  
  // Capacity
  capacityKw: decimal("capacityKw", { precision: 12, scale: 2 }),
  capacityKwh: decimal("capacityKwh", { precision: 12, scale: 2 }),
  
  // Configuration
  configuration: json("configuration").$type<Record<string, unknown>>(),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "maintenance"]).default("active"),
  commissionedAt: timestamp("commissionedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type System = typeof systems.$inferSelect;
export type InsertSystem = typeof systems.$inferInsert;

// Equipment/Components - individual equipment units within a project (THE VATR ANCHOR)
// NOTE: In KIISHA terminology, "Asset" = Project-level investable unit (see projects table)
// This table contains equipment/components (inverters, batteries, panels, etc.) that belong to projects
export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  
  // Hierarchy links
  systemId: int("systemId").notNull(),
  siteId: int("siteId").notNull(),
  projectId: int("projectId"),
  organizationId: int("organizationId"),
  
  // VATR Identity
  vatrId: varchar("vatrId", { length: 100 }).unique(), // Human-readable: "VATR-LGS001-INV-001"
  assetType: mysqlEnum("assetType", [
    "inverter", "panel", "meter", "battery", "transformer", 
    "combiner_box", "tracker", "monitoring", "genset", "switchgear", "cable", "other"
  ]).notNull(),
  assetCategory: mysqlEnum("assetCategory", [
    "generation", "storage", "distribution", "monitoring", "auxiliary"
  ]).notNull(),
  
  // Asset Classification (for filtering and requirements matching)
  assetClassification: mysqlEnum("assetClassification", [
    "residential", "small_commercial", "large_commercial", "industrial",
    "mini_grid", "mesh_grid", "interconnected_mini_grids", "grid_connected"
  ]),
  gridConnectionType: mysqlEnum("gridConnectionType", [
    "off_grid", "grid_connected", "grid_tied_with_backup", "mini_grid", "interconnected_mini_grid", "mesh_grid"
  ]),
  networkTopology: mysqlEnum("networkTopology", ["radial", "ring", "mesh", "star", "unknown"]),
  configurationProfile: mysqlEnum("configurationProfile", [
    "pv_only", "pv_bess", "pv_dg", "pv_bess_dg", "bess_only", "dg_only",
    "minigrid_pv_bess", "minigrid_pv_bess_dg", "mesh_pv_bess", "mesh_pv_bess_dg", "hybrid_custom"
  ]),
  componentsJson: json("componentsJson"), // Array of component types with specs
  
  // Identification
  name: varchar("name", { length: 255 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  assetTag: varchar("assetTag", { length: 100 }), // internal tracking tag
  
  // Specifications
  nominalCapacityKw: decimal("nominalCapacityKw", { precision: 12, scale: 2 }),
  nominalCapacityKwh: decimal("nominalCapacityKwh", { precision: 12, scale: 2 }),
  voltageRating: decimal("voltageRating", { precision: 10, scale: 2 }),
  currentRating: decimal("currentRating", { precision: 10, scale: 2 }),
  efficiencyRating: decimal("efficiencyRating", { precision: 5, scale: 2 }),
  
  // Physical
  locationOnSite: varchar("locationOnSite", { length: 255 }), // "Array A, String 3"
  gpsLatitude: decimal("gpsLatitude", { precision: 10, scale: 6 }),
  gpsLongitude: decimal("gpsLongitude", { precision: 10, scale: 6 }),
  installationDate: date("installationDate"),
  
  // Lifecycle
  status: mysqlEnum("status", ["active", "inactive", "failed", "replaced", "decommissioned"]).default("active"),
  condition: mysqlEnum("condition", ["excellent", "good", "fair", "poor", "failed"]).default("good"),
  lastInspectionDate: date("lastInspectionDate"),
  nextMaintenanceDate: date("nextMaintenanceDate"),
  
  // Warranty
  warrantyStartDate: date("warrantyStartDate"),
  warrantyEndDate: date("warrantyEndDate"),
  warrantyProvider: varchar("warrantyProvider", { length: 255 }),
  warrantyDocumentId: int("warrantyDocumentId"),
  
  // Financial
  purchasePrice: decimal("purchasePrice", { precision: 12, scale: 2 }),
  purchaseCurrency: varchar("purchaseCurrency", { length: 3 }).default("USD"),
  purchaseDate: date("purchaseDate"),
  supplier: varchar("supplier", { length: 255 }),
  depreciationMethod: varchar("depreciationMethod", { length: 50 }),
  usefulLifeYears: int("usefulLifeYears"),
  
  // VATR Integrity
  currentVersion: int("currentVersion").default(1),
  contentHash: varchar("contentHash", { length: 64 }), // SHA-256
  previousVersionId: int("previousVersionId"),
  
  // Profile completeness
  profileCompletenessPct: decimal("profileCompletenessPct", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedById: int("updatedById"),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

// Asset components - sub-parts of assets
export const assetComponents = mysqlTable("assetComponents", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  organizationId: int("organizationId"),
  
  name: varchar("name", { length: 255 }).notNull(),
  componentType: mysqlEnum("componentType", [
    "fan", "capacitor", "fuse", "connector", "display", "sensor", "relay", "other"
  ]).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  serialNumber: varchar("serialNumber", { length: 255 }),
  
  status: mysqlEnum("status", ["active", "inactive", "failed", "replaced"]).default("active"),
  installationDate: date("installationDate"),
  replacementDate: date("replacementDate"),
  
  specifications: json("specifications").$type<Record<string, unknown>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetComponent = typeof assetComponents.$inferSelect;
export type InsertAssetComponent = typeof assetComponents.$inferInsert;

// Versioned asset attributes - every data point is versioned
export const assetAttributes = mysqlTable("assetAttributes", {
  id: int("id").autoincrement().primaryKey(),
  
  // What this attribute belongs to
  assetId: int("assetId").notNull(),
  componentId: int("componentId"), // optional, if component-level
  organizationId: int("organizationId"),
  
  // Attribute definition
  attributeKey: varchar("attributeKey", { length: 100 }).notNull(), // e.g., "efficiency_rating", "firmware_version"
  attributeCategory: mysqlEnum("attributeCategory", [
    "identity", "technical", "operational", "financial", "compliance"
  ]).notNull(),
  
  // Value (current)
  valueText: text("valueText"),
  valueNumeric: decimal("valueNumeric", { precision: 20, scale: 6 }),
  valueBoolean: boolean("valueBoolean"),
  valueDate: date("valueDate"),
  valueJson: json("valueJson").$type<Record<string, unknown>>(),
  unit: varchar("unit", { length: 20 }), // kW, %, V, A, etc.
  
  // Version control
  version: int("version").default(1),
  previousVersionId: int("previousVersionId"),
  isCurrent: boolean("isCurrent").default(true),
  
  // Provenance (WHERE did this come from?)
  sourceType: mysqlEnum("sourceType", [
    "document", "api", "manual", "ai_extraction", "iot", "work_order"
  ]).notNull(),
  sourceId: int("sourceId"), // reference to source (document_id, connector_id, etc.)
  sourcePage: int("sourcePage"),
  sourceSnippet: text("sourceSnippet"),
  sourceConfidence: decimal("sourceConfidence", { precision: 3, scale: 2 }), // 0-1
  
  // Verification
  verificationStatus: mysqlEnum("verificationStatus", [
    "unverified", "verified", "rejected"
  ]).default("unverified"),
  verifiedById: int("verifiedById"),
  verifiedAt: timestamp("verifiedAt"),
  rejectionReason: text("rejectionReason"),
  
  // Cryptographic proof
  contentHash: varchar("contentHash", { length: 64 }).notNull(), // SHA-256
  timestampAnchor: timestamp("timestampAnchor").defaultNow(),
  
  // AI assessment
  aiAssessed: boolean("aiAssessed").default(false),
  aiAssessmentResult: json("aiAssessmentResult").$type<Record<string, unknown>>(),
  aiRoutedFrom: varchar("aiRoutedFrom", { length: 100 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  supersededAt: timestamp("supersededAt"),
  supersededById: int("supersededById"),
  
  // Soft-delete / immutability fields
  visibilityState: mysqlEnum("visibilityState", ["active", "archived", "superseded"]).default("active").notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  archiveReason: text("archiveReason"),
});

export type AssetAttribute = typeof assetAttributes.$inferSelect;
export type InsertAssetAttribute = typeof assetAttributes.$inferInsert;

// Attribute change log - immutable audit trail
export const attributeChangeLog = mysqlTable("attributeChangeLog", {
  id: int("id").autoincrement().primaryKey(),
  attributeId: int("attributeId").notNull(),
  assetId: int("assetId").notNull(),
  
  changeType: mysqlEnum("changeType", ["created", "updated", "deleted", "verified", "rejected"]).notNull(),
  oldValueHash: varchar("oldValueHash", { length: 64 }),
  newValueHash: varchar("newValueHash", { length: 64 }),
  
  oldSnapshot: json("oldSnapshot").$type<Record<string, unknown>>(),
  newSnapshot: json("newSnapshot").$type<Record<string, unknown>>(),
  
  changedById: int("changedById"),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  changeReason: text("changeReason"),
});

export type AttributeChangeLog = typeof attributeChangeLog.$inferSelect;
export type InsertAttributeChangeLog = typeof attributeChangeLog.$inferInsert;


// ============ CMMS (Computerized Maintenance Management System) ============

// Maintenance schedules - recurring maintenance plans
export const maintenanceSchedules = mysqlTable("maintenanceSchedules", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Scope (can be site, system, or asset level)
  scopeType: mysqlEnum("scopeType", ["site", "system", "asset"]).notNull(),
  scopeId: int("scopeId").notNull(), // references sites/systems/assets
  
  // Schedule definition
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  maintenanceType: mysqlEnum("maintenanceType", [
    "preventive", "predictive", "condition_based"
  ]).notNull(),
  taskCategory: mysqlEnum("taskCategory", [
    "inspection", "cleaning", "calibration", "replacement", "testing", "repair"
  ]),
  
  // Frequency
  frequencyType: mysqlEnum("frequencyType", [
    "calendar", "runtime", "cycles", "condition"
  ]).notNull(),
  frequencyValue: int("frequencyValue"), // e.g., 30 for "every 30 days"
  frequencyUnit: mysqlEnum("frequencyUnit", [
    "days", "weeks", "months", "years", "hours", "cycles"
  ]),
  
  // Condition-based triggers
  triggerMetric: varchar("triggerMetric", { length: 100 }),
  triggerThreshold: decimal("triggerThreshold", { precision: 12, scale: 2 }),
  triggerOperator: mysqlEnum("triggerOperator", ["gt", "lt", "eq"]),
  
  // Task details
  estimatedDurationHours: decimal("estimatedDurationHours", { precision: 6, scale: 2 }),
  requiredSkills: json("requiredSkills").$type<string[]>(),
  requiredParts: json("requiredParts").$type<Array<{partNumber: string; quantity: number; description: string}>>(),
  safetyRequirements: json("safetyRequirements").$type<string[]>(),
  procedureDocumentId: int("procedureDocumentId"),
  
  // Assignment
  defaultAssigneeId: int("defaultAssigneeId"),
  defaultTeam: varchar("defaultTeam", { length: 100 }),
  
  // Status
  status: mysqlEnum("status", ["active", "paused", "archived"]).default("active"),
  lastGeneratedAt: timestamp("lastGeneratedAt"),
  nextDueDate: date("nextDueDate"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type InsertMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;

// Work orders - individual maintenance tasks
export const workOrders = mysqlTable("workOrders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Identity
  workOrderNumber: varchar("workOrderNumber", { length: 50 }).unique().notNull(), // WO-2026-00001
  
  // Source
  sourceType: mysqlEnum("sourceType", [
    "scheduled", "reactive", "inspection", "alert"
  ]).notNull(),
  scheduleId: int("scheduleId"),
  alertId: int("alertId"),
  
  // Scope
  siteId: int("siteId").notNull(),
  systemId: int("systemId"),
  assetId: int("assetId"),
  
  // Details
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  workType: mysqlEnum("workType", [
    "preventive", "corrective", "emergency", "inspection"
  ]).notNull(),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).notNull(),
  
  // Assignment
  assignedToId: int("assignedToId"),
  assignedTeam: varchar("assignedTeam", { length: 100 }),
  
  // Scheduling
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  
  // Effort
  estimatedHours: decimal("estimatedHours", { precision: 6, scale: 2 }),
  actualHours: decimal("actualHours", { precision: 6, scale: 2 }),
  
  // Status workflow
  status: mysqlEnum("status", [
    "open", "assigned", "in_progress", "on_hold", "completed", "cancelled"
  ]).default("open"),
  statusReason: text("statusReason"),
  
  // Completion
  completionNotes: text("completionNotes"),
  completionChecklist: json("completionChecklist").$type<Array<{item: string; completed: boolean; notes?: string}>>(),
  followUpRequired: boolean("followUpRequired").default(false),
  followUpWorkOrderId: int("followUpWorkOrderId"),
  
  // Cost tracking
  laborCost: decimal("laborCost", { precision: 12, scale: 2 }),
  partsCost: decimal("partsCost", { precision: 12, scale: 2 }),
  otherCost: decimal("otherCost", { precision: 12, scale: 2 }),
  
  // VATR integration
  assetAttributesUpdated: json("assetAttributesUpdated").$type<number[]>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;

// Work order tasks - sub-tasks within a work order
export const workOrderTasks = mysqlTable("workOrderTasks", {
  id: int("id").autoincrement().primaryKey(),
  workOrderId: int("workOrderId").notNull(),
  
  taskNumber: int("taskNumber").notNull(),
  description: text("description").notNull(),
  
  // Target
  assetId: int("assetId"),
  componentId: int("componentId"),
  
  // Status
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "skipped"]).default("pending"),
  completedAt: timestamp("completedAt"),
  completedById: int("completedById"),
  
  // Result
  result: mysqlEnum("result", ["pass", "fail", "na"]),
  resultNotes: text("resultNotes"),
  measurements: json("measurements").$type<Record<string, unknown>>(),
  
  // Attribute updates triggered
  attributeUpdates: json("attributeUpdates").$type<Array<{attributeKey: string; oldValue: unknown; newValue: unknown}>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkOrderTask = typeof workOrderTasks.$inferSelect;
export type InsertWorkOrderTask = typeof workOrderTasks.$inferInsert;

// Spare parts inventory
export const spareParts = mysqlTable("spareParts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Identity
  partNumber: varchar("partNumber", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "electrical", "mechanical", "consumable", "safety", "other"
  ]),
  
  // Compatibility
  compatibleAssetTypes: json("compatibleAssetTypes").$type<string[]>(),
  compatibleManufacturers: json("compatibleManufacturers").$type<string[]>(),
  compatibleModels: json("compatibleModels").$type<string[]>(),
  
  // Inventory
  quantityOnHand: int("quantityOnHand").default(0),
  minimumStock: int("minimumStock").default(0),
  reorderPoint: int("reorderPoint").default(0),
  reorderQuantity: int("reorderQuantity"),
  
  // Location
  storageLocation: varchar("storageLocation", { length: 255 }),
  siteId: int("siteId"), // if stored at a specific site
  
  // Cost
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Supplier
  preferredSupplier: varchar("preferredSupplier", { length: 255 }),
  leadTimeDays: int("leadTimeDays"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SparePart = typeof spareParts.$inferSelect;
export type InsertSparePart = typeof spareParts.$inferInsert;

// Parts usage - consumption tracking
export const partsUsage = mysqlTable("partsUsage", {
  id: int("id").autoincrement().primaryKey(),
  partId: int("partId").notNull(),
  workOrderId: int("workOrderId"),
  assetId: int("assetId"),
  
  quantity: int("quantity").notNull(),
  usageType: mysqlEnum("usageType", ["consumed", "returned", "damaged"]).default("consumed"),
  
  usedById: int("usedById"),
  usedAt: timestamp("usedAt").defaultNow().notNull(),
  notes: text("notes"),
});

export type PartsUsage = typeof partsUsage.$inferSelect;
export type InsertPartsUsage = typeof partsUsage.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// PHASE 9: UNIVERSAL ARTIFACT ARCHITECTURE
// ═══════════════════════════════════════════════════════════════

// Core artifacts table - universal container for ALL input types
export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  
  // Artifact identity
  artifactType: mysqlEnum("artifactType", [
    "document", "image", "audio", "video", "message", "meeting", "contract"
  ]).notNull(),
  artifactSubtype: varchar("artifactSubtype", { length: 100 }),
  artifactCode: varchar("artifactCode", { length: 50 }).unique(), // ART-2026-00001
  name: varchar("name", { length: 500 }).notNull(),
  description: text("description"),
  
  // Raw storage (immutable)
  originalFilename: varchar("originalFilename", { length: 500 }),
  originalFileUrl: text("originalFileUrl").notNull(),
  originalFileHash: varchar("originalFileHash", { length: 64 }).notNull(), // SHA-256
  originalFileSizeBytes: bigint("originalFileSizeBytes", { mode: "number" }),
  originalMimeType: varchar("originalMimeType", { length: 100 }),
  rawMetadata: json("rawMetadata").$type<Record<string, unknown>>(),
  
  // Ingestion context
  ingestionChannel: mysqlEnum("ingestionChannel", [
    "upload", "email", "whatsapp", "api", "meeting_bot", "iot", "manual"
  ]).notNull().default("upload"),
  ingestionSourceId: varchar("ingestionSourceId", { length: 255 }),
  ingestionSourceMetadata: json("ingestionSourceMetadata").$type<Record<string, unknown>>(),
  
  // Sender info
  senderType: mysqlEnum("senderType", ["user", "external_contact", "system", "api"]),
  senderId: int("senderId"),
  senderExternalContactId: int("senderExternalContactId"),
  senderIdentifier: varchar("senderIdentifier", { length: 255 }),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  
  // Context links (hierarchy)
  portfolioId: int("portfolioId"),
  projectId: int("projectId"),
  siteId: int("siteId"),
  systemId: int("systemId"),
  assetId: int("assetId"),
  
  // Lifecycle stage context
  lifecycleStage: mysqlEnum("lifecycleStage", [
    "origination", "development", "due_diligence", "construction", "commissioning", "operations"
  ]),
  
  // Processing status
  processingStatus: mysqlEnum("processingStatus", [
    "pending", "preprocessing", "processed", "ai_analyzing", "ai_complete", "failed"
  ]).default("pending"),
  preprocessingStatus: mysqlEnum("preprocessingStatus", [
    "pending", "cleaning", "transcribing", "complete", "failed"
  ]),
  preprocessingResultUrl: text("preprocessingResultUrl"),
  
  // AI analysis status
  aiAnalysisStatus: mysqlEnum("aiAnalysisStatus", [
    "pending", "queued", "analyzing", "complete", "failed"
  ]).default("pending"),
  aiAnalysisStartedAt: timestamp("aiAnalysisStartedAt"),
  aiAnalysisCompletedAt: timestamp("aiAnalysisCompletedAt"),
  aiAnalysisRunId: varchar("aiAnalysisRunId", { length: 36 }),
  
  // Categorization
  aiSuggestedCategory: varchar("aiSuggestedCategory", { length: 100 }),
  aiSuggestedSubcategory: varchar("aiSuggestedSubcategory", { length: 100 }),
  aiCategoryConfidence: decimal("aiCategoryConfidence", { precision: 5, scale: 4 }),
  confirmedCategory: varchar("confirmedCategory", { length: 100 }),
  confirmedSubcategory: varchar("confirmedSubcategory", { length: 100 }),
  categorizedBy: int("categorizedBy"),
  categorizedAt: timestamp("categorizedAt"),
  tags: json("tags").$type<string[]>(),
  
  // Verification status
  verificationStatus: mysqlEnum("verificationStatus", [
    "unverified", "ai_verified", "human_verified", "rejected"
  ]).default("unverified"),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  verificationNotes: text("verificationNotes"),
  
  // Versioning
  version: int("version").default(1),
  previousVersionId: int("previousVersionId"),
  isCurrentVersion: boolean("isCurrentVersion").default(true),
  supersededAt: timestamp("supersededAt"),
  supersededBy: int("supersededBy"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;

// Image-specific extension table
export const artifactImages = mysqlTable("artifactImages", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Image classification
  imageKind: mysqlEnum("imageKind", [
    "site_photo", "equipment_nameplate", "invoice_scan", "permit_scan", 
    "safety_issue", "progress_photo", "thermal_image", "drone_capture", 
    "screenshot", "drawing", "diagram", "other"
  ]).notNull(),
  
  // Capture metadata
  takenAt: timestamp("takenAt"),
  cameraMake: varchar("cameraMake", { length: 100 }),
  cameraModel: varchar("cameraModel", { length: 100 }),
  
  // Location
  gpsLatitude: decimal("gpsLatitude", { precision: 10, scale: 7 }),
  gpsLongitude: decimal("gpsLongitude", { precision: 10, scale: 7 }),
  gpsAltitude: decimal("gpsAltitude", { precision: 10, scale: 2 }),
  locationDescription: varchar("locationDescription", { length: 255 }),
  
  // Image properties
  widthPx: int("widthPx"),
  heightPx: int("heightPx"),
  orientation: varchar("orientation", { length: 50 }),
  
  // OCR for nameplates/documents
  containsText: boolean("containsText").default(false),
  ocrText: text("ocrText"),
  ocrConfidence: decimal("ocrConfidence", { precision: 5, scale: 4 }),
  
  // Equipment photos
  equipmentAssetId: int("equipmentAssetId"),
  equipmentCondition: mysqlEnum("equipmentCondition", ["good", "fair", "poor", "damaged"]),
  
  // Progress photos
  constructionPhase: varchar("constructionPhase", { length: 100 }),
  milestoneReference: varchar("milestoneReference", { length: 100 }),
  
  // Thermal images
  thermalMinTemp: decimal("thermalMinTemp", { precision: 6, scale: 2 }),
  thermalMaxTemp: decimal("thermalMaxTemp", { precision: 6, scale: 2 }),
  thermalAnomalyDetected: boolean("thermalAnomalyDetected"),
  
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactImage = typeof artifactImages.$inferSelect;
export type InsertArtifactImage = typeof artifactImages.$inferInsert;

// Audio-specific extension table
export const artifactAudio = mysqlTable("artifactAudio", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Audio metadata
  durationSeconds: int("durationSeconds"),
  sampleRate: int("sampleRate"),
  channels: int("channels"),
  bitrate: int("bitrate"),
  
  // Recording context
  recordedAt: timestamp("recordedAt"),
  recordingType: mysqlEnum("recordingType", ["voice_note", "call", "meeting", "site_ambient"]),
  
  // Participants
  participants: json("participants").$type<Array<{
    name: string;
    role?: string;
    speakerId?: string;
  }>>(),
  
  // Processing results
  audioPreprocessingStatus: mysqlEnum("audioPreprocessingStatus", [
    "pending", "noise_reduction", "diarization", "complete"
  ]).default("pending"),
  cleanedAudioUrl: text("cleanedAudioUrl"),
  noiseReductionApplied: boolean("noiseReductionApplied").default(false),
  diarizationApplied: boolean("diarizationApplied").default(false),
  speakerCount: int("speakerCount"),
  
  // Transcript
  transcriptStatus: mysqlEnum("transcriptStatus", ["pending", "processing", "complete", "failed"]).default("pending"),
  transcriptText: text("transcriptText"),
  transcriptSegments: json("transcriptSegments").$type<Array<{
    startS: number;
    endS: number;
    speaker?: string;
    text: string;
    confidence?: number;
  }>>(),
  transcriptLanguage: varchar("transcriptLanguage", { length: 10 }),
  transcriptConfidence: decimal("transcriptConfidence", { precision: 5, scale: 4 }),
  
  aiExtractionComplete: boolean("aiExtractionComplete").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactAudio = typeof artifactAudio.$inferSelect;
export type InsertArtifactAudio = typeof artifactAudio.$inferInsert;

// Video-specific extension table
export const artifactVideo = mysqlTable("artifactVideo", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Video metadata
  durationSeconds: int("durationSeconds"),
  widthPx: int("widthPx"),
  heightPx: int("heightPx"),
  frameRate: decimal("frameRate", { precision: 6, scale: 2 }),
  codec: varchar("codec", { length: 50 }),
  
  // Recording context
  recordedAt: timestamp("recordedAt"),
  videoType: mysqlEnum("videoType", [
    "site_walkthrough", "inspection", "meeting", "drone", "training", "other"
  ]),
  
  // Location
  gpsLatitude: decimal("gpsLatitude", { precision: 10, scale: 7 }),
  gpsLongitude: decimal("gpsLongitude", { precision: 10, scale: 7 }),
  
  // Processing
  thumbnailUrl: text("thumbnailUrl"),
  previewGifUrl: text("previewGifUrl"),
  
  // Transcript
  hasAudio: boolean("hasAudio").default(true),
  transcriptText: text("transcriptText"),
  transcriptSegments: json("transcriptSegments").$type<Array<{
    startS: number;
    endS: number;
    speaker?: string;
    text: string;
  }>>(),
  
  // Key frames
  keyFrames: json("keyFrames").$type<Array<{
    timestampS: number;
    frameUrl: string;
    description?: string;
  }>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactVideo = typeof artifactVideo.$inferSelect;
export type InsertArtifactVideo = typeof artifactVideo.$inferInsert;

// Message-specific extension table (WhatsApp, Email, etc.)
export const artifactMessages = mysqlTable("artifactMessages", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Message metadata
  messageType: mysqlEnum("messageType", ["whatsapp", "email", "telegram", "sms", "slack"]).notNull(),
  messageIdExternal: varchar("messageIdExternal", { length: 255 }),
  
  // Threading
  threadId: varchar("threadId", { length: 255 }),
  inReplyToId: varchar("inReplyToId", { length: 255 }),
  threadPosition: int("threadPosition"),
  
  // Sender/recipients
  fromAddress: varchar("fromAddress", { length: 255 }),
  fromName: varchar("fromName", { length: 255 }),
  toAddresses: json("toAddresses").$type<string[]>(),
  ccAddresses: json("ccAddresses").$type<string[]>(),
  
  // Content
  subject: varchar("subject", { length: 500 }),
  bodyText: text("bodyText"),
  bodyHtml: text("bodyHtml"),
  
  // Attachments
  hasAttachments: boolean("hasAttachments").default(false),
  attachmentCount: int("attachmentCount").default(0),
  attachmentArtifactIds: json("attachmentArtifactIds").$type<number[]>(),
  
  // Message-specific
  sentAt: timestamp("sentAt"),
  receivedAt: timestamp("receivedAt"),
  isInbound: boolean("isInbound").default(true),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactMessage = typeof artifactMessages.$inferSelect;
export type InsertArtifactMessage = typeof artifactMessages.$inferInsert;

// Meeting-specific extension table
export const artifactMeetings = mysqlTable("artifactMeetings", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Meeting metadata
  meetingType: mysqlEnum("meetingType", [
    "internal", "external", "site_visit", "due_diligence", "board", "investor", "other"
  ]).notNull(),
  meetingTitle: varchar("meetingTitle", { length: 500 }),
  
  // Timing
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  durationMinutes: int("durationMinutes"),
  
  // Location
  location: varchar("location", { length: 255 }),
  isVirtual: boolean("isVirtual").default(true),
  meetingPlatform: varchar("meetingPlatform", { length: 50 }),
  meetingLink: text("meetingLink"),
  
  // Participants
  participants: json("participants").$type<Array<{
    name: string;
    email?: string;
    role?: string;
    company?: string;
    attended: boolean;
    speakerId?: string;
  }>>(),
  organizerName: varchar("organizerName", { length: 255 }),
  organizerEmail: varchar("organizerEmail", { length: 255 }),
  
  // Content
  agenda: text("agenda"),
  transcriptText: text("transcriptText"),
  transcriptSegments: json("transcriptSegments").$type<Array<{
    startS: number;
    endS: number;
    speaker: string;
    text: string;
  }>>(),
  summary: text("summary"),
  
  // Extracted items
  actionItems: json("actionItems").$type<Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
    status?: string;
  }>>(),
  decisions: json("decisions").$type<Array<{
    description: string;
    madeBy?: string;
    timestamp?: number;
  }>>(),
  keyTopics: json("keyTopics").$type<string[]>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactMeeting = typeof artifactMeetings.$inferSelect;
export type InsertArtifactMeeting = typeof artifactMeetings.$inferInsert;

// Contract-specific extension table
export const artifactContracts = mysqlTable("artifactContracts", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  
  // Contract identity
  contractType: mysqlEnum("contractType", [
    "ppa", "lease", "epc", "om", "financing", "offtake", "interconnection", "insurance", "other"
  ]).notNull(),
  contractNumber: varchar("contractNumber", { length: 100 }),
  contractTitle: varchar("contractTitle", { length: 500 }),
  
  // Parties
  parties: json("parties").$type<Array<{
    name: string;
    role: string;
    type?: string;
    address?: string;
  }>>(),
  counterpartyName: varchar("counterpartyName", { length: 255 }),
  counterpartyType: varchar("counterpartyType", { length: 100 }),
  
  // Dates
  effectiveDate: date("effectiveDate"),
  expiryDate: date("expiryDate"),
  termYears: int("termYears"),
  renewalTerms: text("renewalTerms"),
  
  // Financial terms
  contractValue: decimal("contractValue", { precision: 18, scale: 2 }),
  currency: varchar("currency", { length: 3 }),
  paymentTerms: text("paymentTerms"),
  
  // PPA specific
  ppaCapacityKw: decimal("ppaCapacityKw", { precision: 12, scale: 2 }),
  ppaTariffRate: decimal("ppaTariffRate", { precision: 10, scale: 4 }),
  ppaTariffEscalation: decimal("ppaTariffEscalation", { precision: 5, scale: 2 }),
  
  // Lease specific
  leaseAreaSqm: decimal("leaseAreaSqm", { precision: 12, scale: 2 }),
  leaseAnnualRent: decimal("leaseAnnualRent", { precision: 18, scale: 2 }),
  leaseEscalationPct: decimal("leaseEscalationPct", { precision: 5, scale: 2 }),
  
  // Status
  contractStatus: mysqlEnum("contractStatus", [
    "draft", "negotiating", "executed", "active", "expired", "terminated"
  ]).default("draft"),
  executionDate: date("executionDate"),
  executedBy: varchar("executedBy", { length: 255 }),
  
  // Amendments
  amendmentCount: int("amendmentCount").default(0),
  latestAmendmentDate: date("latestAmendmentDate"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactContract = typeof artifactContracts.$inferSelect;
export type InsertArtifactContract = typeof artifactContracts.$inferInsert;

// Contract obligations/covenants
export const contractObligations = mysqlTable("contractObligations", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  artifactId: int("artifactId").notNull(),
  
  obligationType: mysqlEnum("obligationType", [
    "payment", "reporting", "insurance", "maintenance", "compliance", "notification", "other"
  ]).notNull(),
  
  obligor: varchar("obligor", { length: 255 }).notNull(),
  obligorRole: varchar("obligorRole", { length: 100 }),
  
  description: text("description").notNull(),
  
  // Timing
  frequency: mysqlEnum("frequency", ["one_time", "monthly", "quarterly", "annually", "ongoing"]),
  dueDate: date("dueDate"),
  dueDayOfPeriod: int("dueDayOfPeriod"),
  
  // Compliance tracking
  complianceStatus: mysqlEnum("complianceStatus", [
    "pending", "compliant", "non_compliant", "waived"
  ]).default("pending"),
  lastComplianceCheck: date("lastComplianceCheck"),
  nextDueDate: date("nextDueDate"),
  
  // Source in contract
  sourceSection: varchar("sourceSection", { length: 50 }),
  sourcePage: int("sourcePage"),
  sourceText: text("sourceText"),
  
  // Linked workspace item
  workspaceItemId: int("workspaceItemId"),
  
  // Alerts
  alertDaysBefore: int("alertDaysBefore").default(30),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractObligation = typeof contractObligations.$inferSelect;
export type InsertContractObligation = typeof contractObligations.$inferInsert;

// Contract amendments
export const contractAmendments = mysqlTable("contractAmendments", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  amendmentArtifactId: int("amendmentArtifactId").notNull(),
  
  amendmentNumber: int("amendmentNumber").notNull(),
  amendmentDate: date("amendmentDate").notNull(),
  effectiveDate: date("effectiveDate"),
  
  description: text("description"),
  changesSummary: json("changesSummary").$type<Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type InsertContractAmendment = typeof contractAmendments.$inferInsert;

// AI extraction outputs from artifacts
export const artifactExtractions = mysqlTable("artifactExtractions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source
  artifactId: int("artifactId").notNull(),
  artifactVersion: int("artifactVersion"),
  
  // Extraction run
  extractionRunId: varchar("extractionRunId", { length: 36 }).notNull(),
  extractionModel: varchar("extractionModel", { length: 50 }),
  extractionPromptVersion: varchar("extractionPromptVersion", { length: 20 }),
  extractedAt: timestamp("extractedAt").defaultNow().notNull(),
  
  // What was extracted
  fieldKey: varchar("fieldKey", { length: 100 }).notNull(),
  fieldCategory: mysqlEnum("fieldCategory", [
    "identity", "technical", "commercial", "legal", "financial", "operational", "compliance"
  ]).notNull(),
  
  // Value (polymorphic)
  extractedValueText: text("extractedValueText"),
  extractedValueNumeric: decimal("extractedValueNumeric", { precision: 18, scale: 4 }),
  extractedValueDate: date("extractedValueDate"),
  extractedValueBoolean: boolean("extractedValueBoolean"),
  extractedValueJson: json("extractedValueJson").$type<unknown>(),
  unit: varchar("unit", { length: 50 }),
  
  // Source location
  sourceType: mysqlEnum("sourceType", ["page", "timestamp", "segment", "cell"]),
  sourcePage: int("sourcePage"),
  sourceTimestampStart: decimal("sourceTimestampStart", { precision: 10, scale: 2 }),
  sourceTimestampEnd: decimal("sourceTimestampEnd", { precision: 10, scale: 2 }),
  sourceCellReference: varchar("sourceCellReference", { length: 20 }),
  sourceSnippet: text("sourceSnippet"),
  
  // Confidence
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  extractionNotes: text("extractionNotes"),
  
  // Verification
  verificationStatus: mysqlEnum("verificationStatus", [
    "unverified", "verified", "rejected", "corrected"
  ]).default("unverified"),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  verificationNotes: text("verificationNotes"),
  
  // Correction tracking
  wasCorrected: boolean("wasCorrected").default(false),
  originalValueIfCorrected: json("originalValueIfCorrected").$type<unknown>(),
  
  // Destination (where applied)
  appliedToEntityType: varchar("appliedToEntityType", { length: 50 }),
  appliedToEntityId: int("appliedToEntityId"),
  appliedToAttributeKey: varchar("appliedToAttributeKey", { length: 100 }),
  appliedAttributeId: int("appliedAttributeId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactExtraction = typeof artifactExtractions.$inferSelect;
export type InsertArtifactExtraction = typeof artifactExtractions.$inferInsert;

// Entity mentions found in artifacts
export const artifactEntityMentions = mysqlTable("artifactEntityMentions", {
  id: int("id").autoincrement().primaryKey(),
  artifactId: int("artifactId").notNull(),
  extractionRunId: varchar("extractionRunId", { length: 36 }),
  
  // What was mentioned
  mentionText: varchar("mentionText", { length: 500 }).notNull(),
  mentionType: mysqlEnum("mentionType", [
    "site", "asset", "company", "person", "location", "date", "amount", "other"
  ]).notNull(),
  
  // Source location
  sourcePage: int("sourcePage"),
  sourceTimestampStart: decimal("sourceTimestampStart", { precision: 10, scale: 2 }),
  sourceTimestampEnd: decimal("sourceTimestampEnd", { precision: 10, scale: 2 }),
  sourceSnippet: text("sourceSnippet"),
  
  // Resolution
  resolvedEntityType: varchar("resolvedEntityType", { length: 50 }),
  resolvedEntityId: int("resolvedEntityId"),
  resolutionConfidence: decimal("resolutionConfidence", { precision: 5, scale: 4 }),
  resolutionStatus: mysqlEnum("resolutionStatus", [
    "unresolved", "auto_resolved", "manual_resolved", "ignored"
  ]).default("unresolved"),
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ArtifactEntityMention = typeof artifactEntityMentions.$inferSelect;
export type InsertArtifactEntityMention = typeof artifactEntityMentions.$inferInsert;

// ═══════════════════════════════════════════════════════════════
// ASSET LIFECYCLE STAGES
// ═══════════════════════════════════════════════════════════════

// Lifecycle stage definitions
export const lifecycleStages = mysqlTable("lifecycleStages", {
  id: int("id").autoincrement().primaryKey(),
  
  stageKey: varchar("stageKey", { length: 50 }).notNull().unique(),
  stageName: varchar("stageName", { length: 100 }).notNull(),
  stageOrder: int("stageOrder").notNull(),
  description: text("description"),
  
  // Typical duration
  typicalDurationMonths: int("typicalDurationMonths"),
  
  // Required milestones for stage completion
  milestones: json("milestones").$type<Array<{
    milestone: string;
    description: string;
    required: boolean;
  }>>(),
  
  // Required attributes for stage exit
  requiredAttributes: json("requiredAttributes").$type<Array<{
    attributeKey: string;
    category: string;
    requiredForExit: boolean;
  }>>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LifecycleStage = typeof lifecycleStages.$inferSelect;
export type InsertLifecycleStage = typeof lifecycleStages.$inferInsert;

// Stage-specific attribute definitions
export const stageAttributeDefinitions = mysqlTable("stageAttributeDefinitions", {
  id: int("id").autoincrement().primaryKey(),
  
  lifecycleStage: varchar("lifecycleStage", { length: 50 }).notNull(),
  attributeKey: varchar("attributeKey", { length: 100 }).notNull(),
  attributeCategory: mysqlEnum("attributeCategory", [
    "identity", "technical", "commercial", "financial", "compliance", "operational"
  ]).notNull(),
  
  displayName: varchar("displayName", { length: 255 }).notNull(),
  description: text("description"),
  
  // Data type
  dataType: mysqlEnum("dataType", ["text", "number", "date", "boolean", "json", "file"]).notNull(),
  unit: varchar("unit", { length: 50 }),
  
  // Validation
  required: boolean("required").default(false),
  requiredForStageExit: boolean("requiredForStageExit").default(false),
  validationRules: json("validationRules").$type<{
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  }>(),
  
  // Display
  displayOrder: int("displayOrder"),
  displayGroup: varchar("displayGroup", { length: 100 }),
  
  // Source hints
  typicalSources: json("typicalSources").$type<string[]>(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageAttributeDefinition = typeof stageAttributeDefinitions.$inferSelect;
export type InsertStageAttributeDefinition = typeof stageAttributeDefinitions.$inferInsert;

// Asset lifecycle tracking (which stage an asset is in)
export const assetLifecycleTracking = mysqlTable("assetLifecycleTracking", {
  id: int("id").autoincrement().primaryKey(),
  
  // Can track at different levels
  projectId: int("projectId"),
  siteId: int("siteId"),
  assetId: int("assetId"),
  
  currentStage: varchar("currentStage", { length: 50 }).notNull(),
  stageEnteredAt: timestamp("stageEnteredAt").notNull(),
  expectedStageExitAt: timestamp("expectedStageExitAt"),
  
  // Completeness tracking
  stageCompleteness: decimal("stageCompleteness", { precision: 5, scale: 2 }).default("0"),
  milestonesCompleted: int("milestonesCompleted").default(0),
  milestonesTotal: int("milestonesTotal").default(0),
  attributesCompleted: int("attributesCompleted").default(0),
  attributesRequired: int("attributesRequired").default(0),
  
  // Status
  isBlocked: boolean("isBlocked").default(false),
  blockedReason: text("blockedReason"),
  
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});

export type AssetLifecycleTracking = typeof assetLifecycleTracking.$inferSelect;
export type InsertAssetLifecycleTracking = typeof assetLifecycleTracking.$inferInsert;

// Stage milestone completions
export const stageMilestoneCompletions = mysqlTable("stageMilestoneCompletions", {
  id: int("id").autoincrement().primaryKey(),
  
  lifecycleTrackingId: int("lifecycleTrackingId").notNull(),
  milestoneKey: varchar("milestoneKey", { length: 100 }).notNull(),
  
  completedAt: timestamp("completedAt").notNull(),
  completedBy: int("completedBy"),
  
  // Evidence
  evidenceArtifactIds: json("evidenceArtifactIds").$type<number[]>(),
  notes: text("notes"),
  
  // Verification
  verified: boolean("verified").default(false),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageMilestoneCompletion = typeof stageMilestoneCompletions.$inferSelect;
export type InsertStageMilestoneCompletion = typeof stageMilestoneCompletions.$inferInsert;

// Stage transition history
export const stageTransitionHistory = mysqlTable("stageTransitionHistory", {
  id: int("id").autoincrement().primaryKey(),
  
  lifecycleTrackingId: int("lifecycleTrackingId").notNull(),
  
  fromStage: varchar("fromStage", { length: 50 }),
  toStage: varchar("toStage", { length: 50 }).notNull(),
  
  transitionedAt: timestamp("transitionedAt").notNull(),
  transitionedBy: int("transitionedBy"),
  
  // Metrics at transition
  daysInPreviousStage: int("daysInPreviousStage"),
  completenessAtTransition: decimal("completenessAtTransition", { precision: 5, scale: 2 }),
  
  notes: text("notes"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageTransitionHistory = typeof stageTransitionHistory.$inferSelect;
export type InsertStageTransitionHistory = typeof stageTransitionHistory.$inferInsert;


// ============ PROVIDER INTEGRATIONS ============

// Organization integrations - stores provider configurations per org
export const orgIntegrations = mysqlTable("orgIntegrations", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  
  // Integration type and provider
  integrationType: mysqlEnum("integrationType", [
    "storage", "llm", "email_ingest", "whatsapp", "notify", "observability", "maps"
  ]).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // e.g., 's3', 'openai', 'sendgrid'
  
  // Status
  status: mysqlEnum("status", ["not_configured", "connected", "error", "disabled"]).default("not_configured").notNull(),
  
  // Non-secret configuration (JSON)
  config: json("config").$type<Record<string, unknown>>(),
  
  // Reference to encrypted secrets (stored separately)
  secretRef: varchar("secretRef", { length: 255 }),
  
  // Connection metadata
  connectedBy: int("connectedBy"),
  connectedAt: timestamp("connectedAt"),
  lastTestAt: timestamp("lastTestAt"),
  lastTestSuccess: boolean("lastTestSuccess"),
  lastError: text("lastError"),
  
  // Webhook configuration (for inbound integrations)
  webhookUrl: text("webhookUrl"),
  webhookSecret: varchar("webhookSecret", { length: 255 }),
  verifyToken: varchar("verifyToken", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrgIntegration = typeof orgIntegrations.$inferSelect;
export type InsertOrgIntegration = typeof orgIntegrations.$inferInsert;

// Integration events - audit log for integration activities
export const integrationEvents = mysqlTable("integrationEvents", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  integrationId: int("integrationId").notNull(),
  
  eventType: mysqlEnum("eventType", [
    "connected", "disconnected", "config_changed", "test_success", "test_failed",
    "webhook_received", "token_refreshed", "error", "secret_rotated"
  ]).notNull(),
  
  eventData: json("eventData").$type<Record<string, unknown>>(),
  
  userId: int("userId"), // Who triggered the event (null for system events)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type InsertIntegrationEvent = typeof integrationEvents.$inferInsert;

// Integration secrets - encrypted storage for API keys, tokens, etc.
export const integrationSecrets = mysqlTable("integrationSecrets", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  integrationId: int("integrationId").notNull(),
  
  // Secret identification
  secretKey: varchar("secretKey", { length: 100 }).notNull(), // e.g., 'apiKey', 'accessToken'
  
  // Encrypted value (using AES-256-GCM)
  encryptedValue: text("encryptedValue").notNull(),
  iv: varchar("iv", { length: 32 }).notNull(), // Initialization vector
  authTag: varchar("authTag", { length: 32 }).notNull(), // Authentication tag
  
  // Key versioning for rotation
  keyVersion: int("keyVersion").default(1).notNull(),
  
  // Metadata
  lastRotatedAt: timestamp("lastRotatedAt"),
  expiresAt: timestamp("expiresAt"), // For tokens with expiry
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationSecret = typeof integrationSecrets.$inferSelect;
export type InsertIntegrationSecret = typeof integrationSecrets.$inferInsert;

// Organization feature flags - org-level overrides for feature flags
export const orgFeatureFlags = mysqlTable("orgFeatureFlags", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  
  flagKey: varchar("flagKey", { length: 100 }).notNull(),
  enabled: boolean("enabled").notNull(),
  
  // Optional: project-level override
  projectId: int("projectId"),
  
  // Metadata
  enabledBy: int("enabledBy"),
  enabledAt: timestamp("enabledAt"),
  reason: text("reason"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrgFeatureFlag = typeof orgFeatureFlags.$inferSelect;
export type InsertOrgFeatureFlag = typeof orgFeatureFlags.$inferInsert;

// Webhook events log - for debugging and monitoring inbound webhooks
export const webhookEventsLog = mysqlTable("webhookEventsLog", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  integrationId: int("integrationId").notNull(),
  
  // Request details
  method: varchar("method", { length: 10 }).notNull(),
  path: text("path").notNull(),
  headers: json("headers").$type<Record<string, string>>(),
  body: text("body"), // Raw body (truncated if too large)
  
  // Processing result
  signatureValid: boolean("signatureValid"),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processedAt"),
  errorMessage: text("errorMessage"),
  
  // Idempotency
  idempotencyKey: varchar("idempotencyKey", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookEventLog = typeof webhookEventsLog.$inferSelect;
export type InsertWebhookEventLog = typeof webhookEventsLog.$inferInsert;


// ============ DATA IMMUTABILITY + VIEW SCOPING ============

// Visibility state enum for soft-delete
export const visibilityStateEnum = mysqlEnum("visibilityState", ["active", "archived", "superseded"]);

// View Scopes - defines a projection (Portfolio View, Data Room, Report Pack, Checklist, etc.)
export const viewScopes = mysqlTable("viewScopes", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  viewType: mysqlEnum("viewType", ["portfolio", "dataroom", "report", "checklist", "custom"]).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  ownerId: int("ownerId").notNull(),
  
  // Scope configuration
  projectId: int("projectId"), // Optional - if scoped to a specific project
  config: json("config").$type<{
    filters?: Record<string, unknown>;
    sortOrder?: string;
    columns?: string[];
  }>(),
  
  // Sharing
  isPublic: boolean("isPublic").default(false),
  sharedWith: json("sharedWith").$type<number[]>(), // User IDs
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ViewScope = typeof viewScopes.$inferSelect;
export type InsertViewScope = typeof viewScopes.$inferInsert;

// View Items - tracks which entities are included/excluded in a view
export const viewItems = mysqlTable("viewItems", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  
  // Entity reference
  entityType: mysqlEnum("entityType", ["asset", "project", "document", "field", "evidence", "task", "rfi", "checklist_item"]).notNull(),
  entityId: int("entityId").notNull(),
  
  // Inclusion state
  inclusionState: mysqlEnum("inclusionState", ["included", "excluded", "suggested"]).default("included").notNull(),
  
  // Audit
  reason: text("reason"),
  updatedBy: int("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  viewEntityUnique: uniqueIndex("view_entity_unique").on(table.viewId, table.entityType, table.entityId),
}));

export type ViewItem = typeof viewItems.$inferSelect;
export type InsertViewItem = typeof viewItems.$inferInsert;

// View Field Overrides - controls visibility of specific fields in a view
export const viewFieldOverrides = mysqlTable("viewFieldOverrides", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  
  // Field reference
  assetId: int("assetId").notNull(),
  fieldKey: varchar("fieldKey", { length: 255 }).notNull(), // or extracted_field_id
  
  // Override state
  state: mysqlEnum("state", ["show", "hide", "show_latest_only", "show_specific_version", "pin_version"]).default("show").notNull(),
  specificVersionId: int("specificVersionId"), // If show_specific_version
  
  // Audit
  reason: text("reason"),
  updatedBy: int("updatedBy").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  viewFieldUnique: uniqueIndex("view_field_unique").on(table.viewId, table.assetId, table.fieldKey),
}));

export type ViewFieldOverride = typeof viewFieldOverrides.$inferSelect;
export type InsertViewFieldOverride = typeof viewFieldOverrides.$inferInsert;

// Asset Field History Ledger - tracks all changes to asset data points
export const assetFieldHistory = mysqlTable("assetFieldHistory", {
  id: int("id").autoincrement().primaryKey(),
  
  // Reference
  assetId: int("assetId").notNull(),
  fieldKey: varchar("fieldKey", { length: 255 }).notNull(),
  
  // Values
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  
  // Change metadata
  changeType: mysqlEnum("changeType", [
    "ai_extracted",
    "manual_edit", 
    "verified",
    "suppressed_in_view",
    "restored_in_view",
    "superseded",
    "archived",
    "unarchived"
  ]).notNull(),
  
  // Source provenance (for AI/document-based changes)
  sourceFileId: int("sourceFileId"),
  sourcePage: int("sourcePage"),
  sourceSnippet: text("sourceSnippet"),
  confidence: decimal("confidence", { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  
  // Verification
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  
  // Audit
  changedBy: int("changedBy").notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  reason: text("reason"),
  
  // View context (if change was view-specific)
  viewId: int("viewId"),
});

export type AssetFieldHistory = typeof assetFieldHistory.$inferSelect;
export type InsertAssetFieldHistory = typeof assetFieldHistory.$inferInsert;

// Document Archive History - tracks document archival/restoration
export const documentArchiveHistory = mysqlTable("documentArchiveHistory", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  
  action: mysqlEnum("action", ["archived", "unarchived", "superseded"]).notNull(),
  reason: text("reason"),
  
  // Supersession
  supersededById: int("supersededById"), // New document that supersedes this one
  
  // Audit
  performedBy: int("performedBy").notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
});

export type DocumentArchiveHistory = typeof documentArchiveHistory.$inferSelect;
export type InsertDocumentArchiveHistory = typeof documentArchiveHistory.$inferInsert;

// Export Manifests - tracks what was exported and when
export const exportManifests = mysqlTable("exportManifests", {
  id: int("id").autoincrement().primaryKey(),
  
  // View reference
  viewId: int("viewId"),
  viewType: varchar("viewType", { length: 50 }),
  
  // Export details
  exportType: mysqlEnum("exportType", ["csv", "excel", "pdf", "due_diligence_pack", "json"]).notNull(),
  exportedBy: int("exportedBy").notNull(),
  exportedAt: timestamp("exportedAt").defaultNow().notNull(),
  includeHidden: boolean("includeHidden").default(false),
  filters: json("filters").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending"),
  
  // Content manifest
  itemsExported: json("itemsExported").$type<{
    entityType: string;
    entityId: number;
    version?: number;
  }[]>(),
  
  // VATR provenance references
  provenanceRefs: json("provenanceRefs").$type<{
    fieldKey: string;
    sourceDocId: number;
    sourcePage: number;
    confidence: number;
  }[]>(),
  
  // File reference
  fileUrl: text("fileUrl"),
  fileSize: int("fileSize"),
  
  // Signoff (for external exports)
  requiresSignoff: boolean("requiresSignoff").default(false),
  signedOffBy: int("signedOffBy"),
  signedOffAt: timestamp("signedOffAt"),
});

export type ExportManifest = typeof exportManifests.$inferSelect;
export type InsertExportManifest = typeof exportManifests.$inferInsert;


// ============================================
// ASSET REQUIREMENT TEMPLATES (Configuration-Driven)
// ============================================

// Asset Requirement Templates - defines required docs, fields, checklist items per classification/profile
export const assetRequirementTemplates = mysqlTable("assetRequirementTemplates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"), // null = global template
  
  // Matching criteria
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assetClassification: mysqlEnum("assetClassification", [
    "residential",
    "small_commercial",
    "large_commercial",
    "industrial",
    "mini_grid",
    "mesh_grid",
    "interconnected_mini_grids",
    "grid_connected"
  ]),
  configurationProfile: mysqlEnum("configurationProfile", [
    "PV_ONLY",
    "PV_BESS",
    "PV_DG",
    "PV_BESS_DG",
    "BESS_ONLY",
    "DG_ONLY",
    "WIND_ONLY",
    "WIND_BESS",
    "HYDRO_ONLY",
    "MINIGRID_PV_BESS",
    "MINIGRID_PV_BESS_DG",
    "HYBRID_MULTI",
    "OTHER"
  ]),
  stage: varchar("stage", { length: 100 }), // development, construction, operational, etc.
  
  // Required items
  requiredDocumentTypes: json("requiredDocumentTypes").$type<{
    typeCode: string;
    typeName: string;
    required: boolean;
    description?: string;
  }[]>(),
  
  requiredFields: json("requiredFields").$type<{
    fieldKey: string;
    fieldName: string;
    required: boolean;
    dataType: "string" | "number" | "date" | "boolean" | "json";
    description?: string;
  }[]>(),
  
  requiredChecklistItems: json("requiredChecklistItems").$type<{
    itemCode: string;
    itemName: string;
    required: boolean;
    category?: string;
    description?: string;
  }[]>(),
  
  requiredMonitoringDatapoints: json("requiredMonitoringDatapoints").$type<{
    metricCode: string;
    metricName: string;
    required: boolean;
    unit?: string;
    frequency?: string;
  }[]>(),
  
  // Scoring weights
  completenessWeights: json("completenessWeights").$type<{
    documents: number;
    fields: number;
    checklist: number;
    monitoring: number;
  }>(),
  
  // Metadata
  isActive: boolean("isActive").default(true),
  priority: int("priority").default(0), // higher = preferred match
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetRequirementTemplate = typeof assetRequirementTemplates.$inferSelect;
export type InsertAssetRequirementTemplate = typeof assetRequirementTemplates.$inferInsert;

// Asset View Templates - defines default UI columns, dashboards, diligence sections
export const assetViewTemplates = mysqlTable("assetViewTemplates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"), // null = global template
  
  // Matching criteria
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  assetClassification: mysqlEnum("assetClassification", [
    "residential",
    "small_commercial",
    "large_commercial",
    "industrial",
    "mini_grid",
    "mesh_grid",
    "interconnected_mini_grids",
    "grid_connected"
  ]),
  configurationProfile: mysqlEnum("configurationProfile", [
    "PV_ONLY",
    "PV_BESS",
    "PV_DG",
    "PV_BESS_DG",
    "BESS_ONLY",
    "DG_ONLY",
    "WIND_ONLY",
    "WIND_BESS",
    "HYDRO_ONLY",
    "MINIGRID_PV_BESS",
    "MINIGRID_PV_BESS_DG",
    "HYBRID_MULTI",
    "OTHER"
  ]),
  
  // View configuration
  detailsTableColumns: json("detailsTableColumns").$type<{
    fieldKey: string;
    label: string;
    width?: number;
    sortable?: boolean;
    visible?: boolean;
    order: number;
  }[]>(),
  
  dashboardWidgets: json("dashboardWidgets").$type<{
    widgetType: string;
    title: string;
    dataSource: string;
    position: { x: number; y: number; w: number; h: number };
    config?: Record<string, unknown>;
  }[]>(),
  
  diligenceSections: json("diligenceSections").$type<{
    sectionCode: string;
    sectionName: string;
    order: number;
    subsections?: {
      code: string;
      name: string;
      order: number;
    }[];
  }[]>(),
  
  dataRoomCategories: json("dataRoomCategories").$type<{
    categoryCode: string;
    categoryName: string;
    order: number;
    documentTypes?: string[];
  }[]>(),
  
  // Metadata
  isActive: boolean("isActive").default(true),
  priority: int("priority").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AssetViewTemplate = typeof assetViewTemplates.$inferSelect;
export type InsertAssetViewTemplate = typeof assetViewTemplates.$inferInsert;

// Asset Template Assignments - tracks which template is assigned to which asset
export const assetTemplateAssignments = mysqlTable("assetTemplateAssignments", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull(),
  
  // Template references
  requirementTemplateId: int("requirementTemplateId"),
  viewTemplateId: int("viewTemplateId"),
  
  // Assignment metadata
  assignmentType: mysqlEnum("assignmentType", ["auto_matched", "admin_override"]).default("auto_matched"),
  matchScore: decimal("matchScore", { precision: 5, scale: 2 }), // confidence of auto-match
  overrideReason: text("overrideReason"),
  
  assignedBy: int("assignedBy"),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type AssetTemplateAssignment = typeof assetTemplateAssignments.$inferSelect;
export type InsertAssetTemplateAssignment = typeof assetTemplateAssignments.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// VIEW SCOPING - Saved views for filtering assets
// ═══════════════════════════════════════════════════════════════

// Portfolio Views - saved filter configurations
export const portfolioViews = mysqlTable("portfolioViews", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"),
  portfolioId: int("portfolioId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Filter criteria (stored as JSON for flexibility)
  filterCriteria: json("filterCriteria").$type<{
    countries?: string[];
    statuses?: string[];
    assetClassifications?: string[];
    gridConnectionTypes?: string[];
    configurationProfiles?: string[];
    couplingTopologies?: string[];
    distributionTopologies?: string[];
    capacityMinMw?: number;
    capacityMaxMw?: number;
  }>(),
  
  // View type
  viewType: mysqlEnum("viewType", ["dynamic", "static"]).default("dynamic").notNull(),
  // dynamic = uses filterCriteria to query assets
  // static = uses viewAssets junction table for explicit asset list
  
  // Access control
  isPublic: boolean("isPublic").default(false),
  createdById: int("createdById"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PortfolioView = typeof portfolioViews.$inferSelect;
export type InsertPortfolioView = typeof portfolioViews.$inferInsert;

// View Assets - junction table for static views (explicit asset membership)
export const viewAssets = mysqlTable("viewAssets", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  projectId: int("projectId").notNull(), // References projects table (Asset)
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  addedById: int("addedById"),
});

export type ViewAsset = typeof viewAssets.$inferSelect;
export type InsertViewAsset = typeof viewAssets.$inferInsert;


// =============================================================================
// CONVERSATIONAL AGENT TABLES (WhatsApp + Email)
// =============================================================================

// User Identifiers - Unified identity model for all channels
// Replaces channel-specific tables (whatsappSenderMappings, emailSenderMappings)
// All channel identifiers resolve to the canonical User record
export const userIdentifiers = mysqlTable("userIdentifiers", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identity type and value
  type: mysqlEnum("type", ["whatsapp_phone", "email", "phone", "slack_id"]).notNull(),
  value: varchar("value", { length: 320 }).notNull(), // Email can be up to 320 chars
  
  // Link to canonical user
  userId: int("userId").notNull(), // FK to users table
  organizationId: int("organizationId"), // Optional org scope
  
  // Verification status
  status: mysqlEnum("status", ["pending", "verified", "revoked"]).default("pending").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy"), // Admin who verified
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokedReason: text("revokedReason"),
});

export type UserIdentifier = typeof userIdentifiers.$inferSelect;
export type InsertUserIdentifier = typeof userIdentifiers.$inferInsert;

// Unclaimed Inbound - Quarantine for unknown senders
// Stores messages from unrecognized identifiers for admin triage
export const unclaimedInbound = mysqlTable("unclaimedInbound", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source identification
  channel: mysqlEnum("channel", ["whatsapp", "email", "sms", "api"]).notNull(),
  senderIdentifier: varchar("senderIdentifier", { length: 320 }).notNull(), // Phone or email
  senderDisplayName: varchar("senderDisplayName", { length: 255 }), // If available
  
  // Message content
  messageType: mysqlEnum("messageType", ["text", "image", "document", "audio", "video", "location", "contact"]).default("text"),
  textContent: text("textContent"),
  mediaStorageKey: varchar("mediaStorageKey", { length: 500 }), // If we downloaded media
  mediaContentType: varchar("mediaContentType", { length: 100 }),
  mediaFilename: varchar("mediaFilename", { length: 255 }),
  
  // Raw payload for debugging
  rawPayload: json("rawPayload"),
  
  // Triage status
  status: mysqlEnum("status", ["pending", "claimed", "rejected", "expired"]).default("pending").notNull(),
  claimedByUserId: int("claimedByUserId"), // If admin links it to a user
  claimedAt: timestamp("claimedAt"),
  claimedByAdminId: int("claimedByAdminId"), // Admin who performed the claim
  rejectedReason: text("rejectedReason"),
  
  // Guessed organization (from email domain, etc.) - for admin notification
  guessedOrganizationId: int("guessedOrganizationId"),
  
  // Audit
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Auto-delete after N days if unclaimed
});

export type UnclaimedInbound = typeof unclaimedInbound.$inferSelect;
export type InsertUnclaimedInbound = typeof unclaimedInbound.$inferInsert;

// Conversation Sessions - Lightweight context pointers for conversational AI
// Per Patch B: Store ONLY pointers + timestamps, NOT full AI memory blobs
// LLM context is assembled from message history + these pointers
export const conversationSessions = mysqlTable("conversationSessions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Session identity
  userId: int("userId").notNull(), // FK to users table
  organizationId: int("organizationId"), // REQUIRED: Org scope for this session (Phase 33)
  channel: mysqlEnum("channel", ["whatsapp", "email", "web_chat"]).notNull(),
  channelIdentifier: varchar("channelIdentifier", { length: 320 }), // Phone/email for this session
  channelThreadId: varchar("channelThreadId", { length: 100 }), // WhatsApp conversation id / email thread id
  
  // Context pointers (lightweight - just IDs)
  lastReferencedProjectId: int("lastReferencedProjectId"),
  lastReferencedSiteId: int("lastReferencedSiteId"),
  lastReferencedAssetId: int("lastReferencedAssetId"),
  lastReferencedDocumentId: int("lastReferencedDocumentId"),
  activeDataroomId: int("activeDataroomId"),
  activeViewScopeId: int("activeViewScopeId"),
  
  // Pending confirmation state (for safety rails)
  pendingAction: mysqlEnum("pendingAction", [
    "none",
    "confirm_export",
    "confirm_share_dataroom",
    "confirm_delete",
    "confirm_verify",
    "confirm_permission_change",
    "confirm_link_attachment"
  ]).default("none"),
  pendingActionPayload: json("pendingActionPayload"), // Serialized action details
  pendingActionExpiresAt: timestamp("pendingActionExpiresAt"),
  
  // Activity tracking
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  messageCount: int("messageCount").default(0),
  
  // Session lifecycle
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConversationSession = typeof conversationSessions.$inferSelect;
export type InsertConversationSession = typeof conversationSessions.$inferInsert;

// Attachment Links - Primary and secondary links for inbound attachments (Patch D)
// Each attachment has ONE primary link (asset OR project OR site)
// May have multiple secondary links (dataroom row, checklist row, view scope)
export const attachmentLinks = mysqlTable("attachmentLinks", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source attachment (from ingestedFiles or artifacts)
  ingestedFileId: int("ingestedFileId"),
  artifactId: int("artifactId"),
  
  // Link type
  linkType: mysqlEnum("linkType", ["primary", "secondary"]).notNull(),
  
  // Target entity (only ONE of these should be set for primary links)
  projectId: int("projectId"),
  siteId: int("siteId"),
  assetId: int("assetId"), // Equipment/component
  
  // Secondary link targets
  dataroomId: int("dataroomId"),
  dataroomItemId: int("dataroomItemId"),
  checklistItemId: int("checklistItemId"),
  viewScopeId: int("viewScopeId"),
  
  // Link metadata
  linkedBy: mysqlEnum("linkedBy", ["ai_suggestion", "user_confirmed", "admin_assigned", "auto_rule"]).notNull(),
  aiConfidence: decimal("aiConfidence", { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  linkedByUserId: int("linkedByUserId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AttachmentLink = typeof attachmentLinks.$inferSelect;
export type InsertAttachmentLink = typeof attachmentLinks.$inferInsert;


// Email verification tokens for email change flow
export const emailVerifications = mysqlTable("emailVerifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  newEmail: varchar("newEmail", { length: 320 }).notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerification = typeof emailVerifications.$inferSelect;
export type InsertEmailVerification = typeof emailVerifications.$inferInsert;


// Background job queue for async processing
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", [
    "document_ingestion",
    "ai_extraction", 
    "email_send",
    "notification_send",
    "report_generation",
    "data_export",
    "file_processing",
    "webhook_delivery"
  ]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "completed", "failed", "cancelled"]).default("queued").notNull(),
  priority: mysqlEnum("priority", ["low", "normal", "high", "critical"]).default("normal").notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  result: json("result").$type<Record<string, unknown>>(),
  error: text("error"),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  // Correlation IDs for tracing
  correlationId: varchar("correlationId", { length: 64 }),
  parentJobId: int("parentJobId"),
  // User context
  userId: int("userId"),
  organizationId: int("organizationId"),
  // Timing
  scheduledFor: timestamp("scheduledFor"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  failedAt: timestamp("failedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// Job execution logs for debugging and auditing
export const jobLogs = mysqlTable("jobLogs", {
  id: int("id").autoincrement().primaryKey(),
  jobId: int("jobId").notNull(),
  level: mysqlEnum("level", ["debug", "info", "warn", "error"]).default("info").notNull(),
  message: text("message").notNull(),
  data: json("data").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JobLog = typeof jobLogs.$inferSelect;
export type InsertJobLog = typeof jobLogs.$inferInsert;

// File upload tracking for storage hardening
export const fileUploads = mysqlTable("fileUploads", {
  id: int("id").autoincrement().primaryKey(),
  // Source tracking
  source: mysqlEnum("source", ["web", "whatsapp", "email", "api"]).notNull(),
  sourceId: varchar("sourceId", { length: 255 }), // Message ID, email ID, etc.
  // File info
  originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
  mimeType: varchar("mimeType", { length: 255 }).notNull(),
  fileSize: int("fileSize").notNull(),
  fileExtension: varchar("fileExtension", { length: 50 }),
  // Storage info
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  storageUrl: text("storageUrl"),
  // Processing status
  status: mysqlEnum("status", ["uploading", "uploaded", "processing", "processed", "failed"]).default("uploading").notNull(),
  processingJobId: int("processingJobId"),
  // Validation
  isValidType: boolean("isValidType").default(true),
  isValidSize: boolean("isValidSize").default(true),
  validationErrors: json("validationErrors").$type<string[]>(),
  // Linking
  linkedEntityType: varchar("linkedEntityType", { length: 50 }), // document, asset, project, etc.
  linkedEntityId: int("linkedEntityId"),
  // Context
  userId: int("userId"),
  organizationId: int("organizationId"),
  projectId: int("projectId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = typeof fileUploads.$inferInsert;


// ============ VIEW PREFERENCES (VATR + Views Contract) ============
// Stores user's default view preferences with precedence support
// Precedence: user > team > department > organization default

export const userViewPreferences = mysqlTable("userViewPreferences", {
  id: int("id").autoincrement().primaryKey(),
  
  // Scope (determines precedence level)
  scopeType: mysqlEnum("scopeType", ["user", "team", "department", "organization"]).notNull(),
  scopeId: int("scopeId").notNull(), // userId, teamId, deptId, or orgId
  
  // Context (what area this preference applies to)
  context: mysqlEnum("context", ["dashboard", "portfolio", "dataroom", "checklist", "report"]).notNull(),
  
  // The default view for this scope+context
  defaultViewId: int("defaultViewId").notNull(), // References portfolioViews.id
  
  // Audit
  setBy: int("setBy").notNull(), // User who set this preference
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  scopeContextUnique: uniqueIndex("scope_context_unique").on(table.scopeType, table.scopeId, table.context),
}));

export type UserViewPreference = typeof userViewPreferences.$inferSelect;
export type InsertUserViewPreference = typeof userViewPreferences.$inferInsert;


// ============ VIEW MANAGEMENT SYSTEM ============
// Comprehensive view sharing, templates, analytics, and hierarchical access control

// Teams for organizational hierarchy
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  departmentId: int("departmentId"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  managerId: int("managerId"), // Team manager
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

// Departments for organizational hierarchy
export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  headId: int("headId"), // Department head
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = typeof departments.$inferInsert;

// Team memberships
export const teamMembers = mysqlTable("teamMembers", {
  id: int("id").autoincrement().primaryKey(),
  teamId: int("teamId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "lead", "superuser"]).default("member").notNull(),
  // R1 Tie-break fields
  isPrimary: boolean("isPrimary").default(false).notNull(), // Explicit primary team flag
  priority: int("priority").default(0).notNull(), // Higher number = higher priority
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // For most recent tie-break
}, (table) => ({
  teamUserUnique: uniqueIndex("team_user_unique").on(table.teamId, table.userId),
}));

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

// Department memberships
export const departmentMembers = mysqlTable("departmentMembers", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "lead", "superuser"]).default("member").notNull(),
  // R1 Tie-break fields
  isPrimary: boolean("isPrimary").default(false).notNull(), // Explicit primary department flag
  priority: int("priority").default(0).notNull(), // Higher number = higher priority
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // For most recent tie-break
}, (table) => ({
  deptUserUnique: uniqueIndex("dept_user_unique").on(table.departmentId, table.userId),
}));

export type DepartmentMember = typeof departmentMembers.$inferSelect;
export type InsertDepartmentMember = typeof departmentMembers.$inferInsert;

// Organization superuser assignments (separate from org membership role)
export const organizationSuperusers = mysqlTable("organizationSuperusers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  grantedBy: int("grantedBy").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
}, (table) => ({
  orgUserUnique: uniqueIndex("org_superuser_unique").on(table.organizationId, table.userId),
}));

export type OrganizationSuperuser = typeof organizationSuperusers.$inferSelect;
export type InsertOrganizationSuperuser = typeof organizationSuperusers.$inferInsert;

// View Shares - who has access to which views
export const viewShares = mysqlTable("viewShares", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(), // References portfolioViews.id
  
  // Who is this shared with
  sharedWithType: mysqlEnum("sharedWithType", ["user", "team", "department", "organization"]).notNull(),
  sharedWithId: int("sharedWithId").notNull(), // userId, teamId, deptId, or orgId
  
  // Permission level
  permissionLevel: mysqlEnum("permissionLevel", ["view_only", "edit", "admin"]).default("view_only").notNull(),
  
  // Audit
  sharedBy: int("sharedBy").notNull(),
  sharedAt: timestamp("sharedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Optional expiration
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  revokedBy: int("revokedBy"),
  revokedAt: timestamp("revokedAt"),
}, (table) => ({
  viewShareUnique: uniqueIndex("view_share_unique").on(table.viewId, table.sharedWithType, table.sharedWithId),
}));

export type ViewShare = typeof viewShares.$inferSelect;
export type InsertViewShare = typeof viewShares.$inferInsert;

// View Templates - pre-built view configurations
export const viewTemplates = mysqlTable("viewTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template metadata
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "due_diligence",
    "investor_reporting",
    "compliance",
    "operations",
    "financial",
    "custom"
  ]).notNull(),
  
  // Template configuration (same structure as portfolioViews.filterCriteria)
  filterCriteria: json("filterCriteria").$type<{
    countries?: string[];
    statuses?: string[];
    assetClassifications?: string[];
    gridConnectionTypes?: string[];
    configurationProfiles?: string[];
    couplingTopologies?: string[];
    distributionTopologies?: string[];
    capacityMinMw?: number;
    capacityMaxMw?: number;
  }>(),
  
  // Display settings
  defaultColumns: json("defaultColumns").$type<string[]>(),
  sortOrder: varchar("sortOrder", { length: 100 }),
  
  // System vs custom
  isSystem: boolean("isSystem").default(false).notNull(), // System templates cannot be deleted
  organizationId: int("organizationId"), // null = global template
  
  // Audit
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ViewTemplate = typeof viewTemplates.$inferSelect;
export type InsertViewTemplate = typeof viewTemplates.$inferInsert;

// View Analytics - track view usage
export const viewAnalytics = mysqlTable("viewAnalytics", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  userId: int("userId").notNull(),
  
  // Access tracking
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
  durationSeconds: int("durationSeconds"), // How long they spent on the view
  
  // Actions taken
  actionType: mysqlEnum("actionType", [
    "view",
    "filter_change",
    "export",
    "share",
    "edit",
    "apply_template"
  ]).default("view").notNull(),
  actionDetails: json("actionDetails").$type<Record<string, unknown>>(),
  
  // Context
  sessionId: varchar("sessionId", { length: 64 }),
  userAgent: text("userAgent"),
});

export type ViewAnalytic = typeof viewAnalytics.$inferSelect;
export type InsertViewAnalytic = typeof viewAnalytics.$inferInsert;

// View Pushes - views pushed by managers/superusers to subordinates
export const viewPushes = mysqlTable("viewPushes", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  
  // Who pushed it
  pushedBy: int("pushedBy").notNull(),
  pushedByRole: mysqlEnum("pushedByRole", [
    "manager",
    "team_superuser",
    "department_superuser",
    "organization_superuser",
    "admin"
  ]).notNull(),
  
  // Target scope
  targetScope: mysqlEnum("targetScope", ["user", "team", "department", "organization"]).notNull(),
  targetScopeId: int("targetScopeId").notNull(), // userId, teamId, deptId, or orgId
  
  // Push settings
  isPinned: boolean("isPinned").default(false).notNull(), // Appears at top of list
  isRequired: boolean("isRequired").default(false).notNull(), // Cannot be hidden by user
  displayOrder: int("displayOrder").default(0), // Order among pushed views
  
  // Message to recipients
  pushMessage: text("pushMessage"),
  
  // Audit
  pushedAt: timestamp("pushedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Optional expiration
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  deactivatedBy: int("deactivatedBy"),
  deactivatedAt: timestamp("deactivatedAt"),
}, (table) => ({
  viewPushUnique: uniqueIndex("view_push_unique").on(table.viewId, table.targetScope, table.targetScopeId),
}));

export type ViewPush = typeof viewPushes.$inferSelect;
export type InsertViewPush = typeof viewPushes.$inferInsert;

// View Hides - views hidden by users or superusers
export const viewHides = mysqlTable("viewHides", {
  id: int("id").autoincrement().primaryKey(),
  viewId: int("viewId").notNull(),
  
  // Who hid it
  hiddenBy: int("hiddenBy").notNull(),
  hiddenByRole: mysqlEnum("hiddenByRole", [
    "user",
    "team_superuser",
    "department_superuser",
    "organization_superuser",
    "admin"
  ]).notNull(),
  
  // Target scope (who is it hidden for)
  targetScope: mysqlEnum("targetScope", ["user", "team", "department", "organization"]).notNull(),
  targetScopeId: int("targetScopeId").notNull(),
  
  // Reason
  reason: text("reason"),
  
  // Audit
  hiddenAt: timestamp("hiddenAt").defaultNow().notNull(),
  
  // Can be unhidden
  unhiddenBy: int("unhiddenBy"),
  unhiddenAt: timestamp("unhiddenAt"),
  isActive: boolean("isActive").default(true).notNull(),
}, (table) => ({
  viewHideUnique: uniqueIndex("view_hide_unique").on(table.viewId, table.targetScope, table.targetScopeId),
}));

export type ViewHide = typeof viewHides.$inferSelect;
export type InsertViewHide = typeof viewHides.$inferInsert;

// View Management Audit Log - track all view management actions
export const viewManagementAuditLog = mysqlTable("viewManagementAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // What happened
  actionType: mysqlEnum("actionType", [
    "share",
    "unshare",
    "push",
    "unpush",
    "hide",
    "unhide",
    "delete",
    "permission_change"
  ]).notNull(),
  
  // Who did it
  actorId: int("actorId").notNull(),
  actorRole: varchar("actorRole", { length: 50 }).notNull(),
  
  // What view
  viewId: int("viewId").notNull(),
  
  // Target
  targetType: varchar("targetType", { length: 50 }),
  targetId: int("targetId"),
  
  // Details
  previousState: json("previousState").$type<Record<string, unknown>>(),
  newState: json("newState").$type<Record<string, unknown>>(),
  
  // Audit
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
});

export type ViewManagementAuditLogEntry = typeof viewManagementAuditLog.$inferSelect;
export type InsertViewManagementAuditLogEntry = typeof viewManagementAuditLog.$inferInsert;


// ============================================
// REQUESTS + SCOPED SUBMISSIONS SYSTEM
// ============================================

// Request Templates - reusable request definitions
export const requestTemplates = mysqlTable("request_templates", {
  id: int("id").primaryKey().autoincrement(),
  issuerOrgId: int("issuer_org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(), // Tender, Regulatory Return, Grant Report, Diligence, etc.
  description: text("description"),
  requirementsSchemaId: int("requirements_schema_id"),
  defaultWorkflowId: int("default_workflow_id"),
  defaultIssuerViewId: int("default_issuer_view_id"),
  createdByUserId: int("created_by_user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, active, archived
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});
export type RequestTemplate = typeof requestTemplates.$inferSelect;
export type InsertRequestTemplate = typeof requestTemplates.$inferInsert;

// Requirements Schemas - versioned field/doc requirements
export const requirementsSchemas = mysqlTable("requirements_schemas", {
  id: int("id").primaryKey().autoincrement(),
  templateId: int("template_id"),
  version: int("version").notNull().default(1),
  schemaJson: json("schema_json").notNull().$type<{
    items: Array<{
      type: "field" | "document" | "computed" | "attestation";
      key: string;
      label: string;
      description?: string;
      required: boolean;
      vatrPathHints?: string[];
      verificationPolicy: "human_required" | "auto_allowed_if_source_verified" | "issuer_must_verify";
      dataType?: "text" | "number" | "date" | "boolean" | "file" | "select";
      options?: string[];
    }>;
  }>(),
  isPublished: boolean("is_published").notNull().default(false),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RequirementsSchema = typeof requirementsSchemas.$inferSelect;
export type InsertRequirementsSchema = typeof requirementsSchemas.$inferInsert;

// Request Instances - launched requests
export const requests = mysqlTable("requests", {
  id: int("id").primaryKey().autoincrement(),
  templateId: int("template_id"),
  issuerOrgId: int("issuer_org_id").notNull(),
  issuerUserId: int("issuer_user_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"), // draft, issued, in_progress, collecting, closed, cancelled
  deadlineAt: timestamp("deadline_at"),
  instructions: text("instructions"),
  issuerPortfolioId: int("issuer_portfolio_id"),
  requirementsSchemaId: int("requirements_schema_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});
export type Request = typeof requests.$inferSelect;
export type InsertRequest = typeof requests.$inferInsert;

// Request Recipients - invited orgs/users
export const requestRecipients = mysqlTable("request_recipients", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id").notNull(),
  recipientOrgId: int("recipient_org_id"),
  recipientUserId: int("recipient_user_id"),
  recipientEmail: varchar("recipient_email", { length: 255 }),
  recipientPhone: varchar("recipient_phone", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("invited"), // invited, opened, responding, submitted, declined, expired
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  openedAt: timestamp("opened_at"),
  submittedAt: timestamp("submitted_at"),
  declinedAt: timestamp("declined_at"),
});
export type RequestRecipient = typeof requestRecipients.$inferSelect;
export type InsertRequestRecipient = typeof requestRecipients.$inferInsert;

// Response Workspaces - recipient working area
export const responseWorkspaces = mysqlTable("response_workspaces", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id").notNull(),
  recipientOrgId: int("recipient_org_id").notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("active"), // active, submitted, locked
  responseViewId: int("response_view_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});
export type ResponseWorkspace = typeof responseWorkspaces.$inferSelect;
export type InsertResponseWorkspace = typeof responseWorkspaces.$inferInsert;

// Workspace Assets - asset selection for response
export const workspaceAssets = mysqlTable("workspace_assets", {
  id: int("id").primaryKey().autoincrement(),
  workspaceId: int("workspace_id").notNull(),
  assetId: int("asset_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("included"), // included, removed
  addedAt: timestamp("added_at").defaultNow().notNull(),
  addedByUserId: int("added_by_user_id").notNull(),
});
export type WorkspaceAsset = typeof workspaceAssets.$inferSelect;
export type InsertWorkspaceAsset = typeof workspaceAssets.$inferInsert;

// Workspace Answers - field responses
export const workspaceAnswers = mysqlTable("workspace_answers", {
  id: int("id").primaryKey().autoincrement(),
  workspaceId: int("workspace_id").notNull(),
  requirementKey: varchar("requirement_key", { length: 255 }).notNull(),
  assetId: int("asset_id"),
  answerJson: json("answer_json").notNull(),
  vatrSourcePath: varchar("vatr_source_path", { length: 500 }),
  isVerified: boolean("is_verified").notNull().default(false),
  verifiedByUserId: int("verified_by_user_id"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().onUpdateNow(),
});
export type WorkspaceAnswer = typeof workspaceAnswers.$inferSelect;
export type InsertWorkspaceAnswer = typeof workspaceAnswers.$inferInsert;

// Workspace Documents - attached documents
export const workspaceDocuments = mysqlTable("workspace_documents", {
  id: int("id").primaryKey().autoincrement(),
  workspaceId: int("workspace_id").notNull(),
  requirementKey: varchar("requirement_key", { length: 255 }),
  assetId: int("asset_id"),
  documentId: int("document_id"),
  fileUrl: varchar("file_url", { length: 1000 }),
  fileName: varchar("file_name", { length: 255 }),
  fileType: varchar("file_type", { length: 100 }),
  uploadedByUserId: int("uploaded_by_user_id").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
export type WorkspaceDocument = typeof workspaceDocuments.$inferSelect;
export type InsertWorkspaceDocument = typeof workspaceDocuments.$inferInsert;

// Submissions - immutable snapshot packages
export const submissions = mysqlTable("submissions", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id").notNull(),
  workspaceId: int("workspace_id").notNull(),
  recipientOrgId: int("recipient_org_id").notNull(),
  submittedByUserId: int("submitted_by_user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("submitted"), // submitted, accepted, needs_clarification, rejected
  snapshotId: int("snapshot_id").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUserId: int("reviewed_by_user_id"),
  reviewNotes: text("review_notes"),
});
export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

// Snapshots - immutable content with integrity hash
export const snapshots = mysqlTable("snapshots", {
  id: int("id").primaryKey().autoincrement(),
  type: varchar("type", { length: 50 }).notNull().default("submission"),
  contentJson: json("content_json").notNull().$type<{
    assets: Array<{ id: number; name: string }>;
    answers: Array<{ key: string; value: unknown; assetId?: number }>;
    documents: Array<{ key: string; fileUrl: string; fileName: string; assetId?: number }>;
    attestations: Array<{ key: string; attestedBy: number; attestedAt: string }>;
    signOffs: Array<{ role: string; userId: number; signedAt: string; status: string }>;
  }>(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Snapshot = typeof snapshots.$inferSelect;
export type InsertSnapshot = typeof snapshots.$inferInsert;

// Scoped Grants - explicit minimal permission grants
export const scopedGrants = mysqlTable("scoped_grants", {
  id: int("id").primaryKey().autoincrement(),
  grantorOrgId: int("grantor_org_id").notNull(),
  granteeOrgId: int("grantee_org_id").notNull(),
  granteeUserId: int("grantee_user_id"),
  scopeType: varchar("scope_type", { length: 50 }).notNull(), // submission, field_set, document_set
  scopeId: int("scope_id").notNull(),
  expiresAt: timestamp("expires_at"),
  isRevoked: boolean("is_revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  revokedByUserId: int("revoked_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ScopedGrant = typeof scopedGrants.$inferSelect;
export type InsertScopedGrant = typeof scopedGrants.$inferInsert;

// Sign-off Requirements - workflow configuration
export const signOffRequirements = mysqlTable("sign_off_requirements", {
  id: int("id").primaryKey().autoincrement(),
  templateId: int("template_id"),
  requestId: int("request_id"),
  signerRole: varchar("signer_role", { length: 100 }),
  signerUserId: int("signer_user_id"),
  orderIndex: int("order_index").notNull().default(0),
  isParallel: boolean("is_parallel").notNull().default(false),
  conditionJson: json("condition_json").$type<{ field?: string; operator?: string; value?: unknown }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SignOffRequirement = typeof signOffRequirements.$inferSelect;
export type InsertSignOffRequirement = typeof signOffRequirements.$inferInsert;

// Sign-off Events - actual sign-offs
export const signOffEvents = mysqlTable("sign_off_events", {
  id: int("id").primaryKey().autoincrement(),
  workspaceId: int("workspace_id").notNull(),
  requirementId: int("requirement_id").notNull(),
  signedByUserId: int("signed_by_user_id").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // approved, rejected, delegated
  notes: text("notes"),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
});
export type SignOffEvent = typeof signOffEvents.$inferSelect;
export type InsertSignOffEvent = typeof signOffEvents.$inferInsert;

// Request Clarifications - clarification threads
export const requestClarifications = mysqlTable("request_clarifications", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id").notNull(),
  submissionId: int("submission_id"),
  fromOrgId: int("from_org_id").notNull(),
  fromUserId: int("from_user_id").notNull(),
  toOrgId: int("to_org_id").notNull(),
  subject: varchar("subject", { length: 500 }),
  message: text("message").notNull(),
  parentId: int("parent_id"),
  status: varchar("status", { length: 50 }).notNull().default("open"), // open, responded, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RequestClarification = typeof requestClarifications.$inferSelect;
export type InsertRequestClarification = typeof requestClarifications.$inferInsert;

// Request Audit Log - comprehensive audit trail
export const requestAuditLog = mysqlTable("request_audit_log", {
  id: int("id").primaryKey().autoincrement(),
  requestId: int("request_id"),
  workspaceId: int("workspace_id"),
  submissionId: int("submission_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  actorUserId: int("actor_user_id").notNull(),
  actorOrgId: int("actor_org_id"),
  targetType: varchar("target_type", { length: 100 }),
  targetId: int("target_id"),
  detailsJson: json("details_json").$type<Record<string, unknown>>(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RequestAuditLogEntry = typeof requestAuditLog.$inferSelect;
export type InsertRequestAuditLogEntry = typeof requestAuditLog.$inferInsert;


// ============================================================================
// VERSIONED VIEWS + SHARING + MANAGED UPDATES SYSTEM
// ============================================================================

// View Templates (versioned, shareable definitions)
export const viewTemplatesV2 = mysqlTable("view_templates_v2", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: int("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  currentVersionId: varchar("current_version_id", { length: 36 }),
  category: varchar("category", { length: 100 }), // e.g., "due_diligence", "compliance", "reporting"
  isPublic: boolean("is_public").default(false), // visible to all org members
  createdByUserId: int("created_by_user_id").notNull(),
  status: varchar("status", { length: 20 }).default("active").$type<"active" | "archived" | "draft">(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ViewTemplateV2 = typeof viewTemplatesV2.$inferSelect;
export type InsertViewTemplateV2 = typeof viewTemplatesV2.$inferInsert;

// View Template Versions (immutable version history)
export const viewTemplateVersions = mysqlTable("view_template_versions", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: varchar("template_id", { length: 36 }).notNull(),
  versionNumber: int("version_number").notNull(), // 1, 2, 3...
  definitionJson: json("definition_json").notNull().$type<{
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }>(),
  changelog: text("changelog"), // description of changes from previous version
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ViewTemplateVersion = typeof viewTemplateVersions.$inferSelect;
export type InsertViewTemplateVersion = typeof viewTemplateVersions.$inferInsert;

// View Instances (what users actually use - independent or managed)
export const viewInstances = mysqlTable("view_instances", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: int("org_id").notNull(),
  ownerUserId: int("owner_user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Where this instance lives (one of these should be set)
  workspaceId: varchar("workspace_id", { length: 36 }),
  boardId: varchar("board_id", { length: 36 }),
  requestId: int("request_id"),
  
  // Source tracking (for shared/managed views)
  sourceTemplateId: varchar("source_template_id", { length: 36 }),
  sourceVersionId: varchar("source_version_id", { length: 36 }),
  
  // The effective definition for this instance
  definitionJson: json("definition_json").notNull().$type<{
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }>(),
  
  // Update mode: independent (forked/cloned) or managed (linked to source)
  updateMode: varchar("update_mode", { length: 20 }).default("independent").$type<"independent" | "managed">(),
  hasLocalEdits: boolean("has_local_edits").default(false),
  localEditsSummary: text("local_edits_summary"), // description of what was changed locally
  
  // Status
  status: varchar("status", { length: 20 }).default("active").$type<"active" | "archived">(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ViewInstance = typeof viewInstances.$inferSelect;
export type InsertViewInstance = typeof viewInstances.$inferInsert;

// View Update Rollouts (batch updates from template to instances)
export const viewUpdateRollouts = mysqlTable("view_update_rollouts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: int("org_id").notNull(),
  templateId: varchar("template_id", { length: 36 }).notNull(),
  fromVersionId: varchar("from_version_id", { length: 36 }), // null for first rollout
  toVersionId: varchar("to_version_id", { length: 36 }).notNull(),
  
  // Rollout mode
  rolloutMode: varchar("rollout_mode", { length: 20 }).notNull().$type<"force" | "safe" | "opt_in">(),
  
  // Scope definition
  scope: varchar("scope", { length: 30 }).notNull().$type<"org_wide" | "selected_workspaces" | "selected_instances">(),
  scopeWorkspaceIds: json("scope_workspace_ids").$type<string[]>(),
  scopeInstanceIds: json("scope_instance_ids").$type<string[]>(),
  
  // Status
  status: varchar("status", { length: 20 }).default("draft").$type<
    "draft" | "pending_approval" | "approved" | "executing" | "completed" | "canceled"
  >(),
  
  // Approval tracking
  requiresApproval: boolean("requires_approval").default(true),
  createdByUserId: int("created_by_user_id").notNull(),
  approvedByUserId: int("approved_by_user_id"),
  approvalNotes: text("approval_notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
});
export type ViewUpdateRollout = typeof viewUpdateRollouts.$inferSelect;
export type InsertViewUpdateRollout = typeof viewUpdateRollouts.$inferInsert;

// View Instance Update Receipts (per-instance rollout results)
export const viewInstanceUpdateReceipts = mysqlTable("view_instance_update_receipts", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  rolloutId: varchar("rollout_id", { length: 36 }).notNull(),
  instanceId: varchar("instance_id", { length: 36 }).notNull(),
  
  // Status of this instance's update
  status: varchar("status", { length: 20 }).default("pending").$type<
    "pending" | "applied" | "skipped" | "conflict" | "rejected" | "opted_out"
  >(),
  
  // Conflict details (for safe mode)
  conflictDetailsJson: json("conflict_details_json").$type<{
    conflictingFields: string[];
    localValue: unknown;
    newValue: unknown;
    resolution?: "keep_local" | "apply_new" | "fork";
  }[]>(),
  
  // User action (for opt-in mode)
  userAction: varchar("user_action", { length: 20 }).$type<"accepted" | "rejected" | "deferred">(),
  userActionAt: timestamp("user_action_at"),
  userActionByUserId: int("user_action_by_user_id"),
  
  // Previous state (for rollback)
  previousDefinitionJson: json("previous_definition_json"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ViewInstanceUpdateReceipt = typeof viewInstanceUpdateReceipts.$inferSelect;
export type InsertViewInstanceUpdateReceipt = typeof viewInstanceUpdateReceipts.$inferInsert;

// View Version Audit Log (immutable audit trail)
export const viewVersionAuditLog = mysqlTable("view_version_audit_log", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: int("org_id").notNull(),
  
  // What was affected
  entityType: varchar("entity_type", { length: 50 }).notNull().$type<
    "template" | "version" | "instance" | "rollout" | "receipt"
  >(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  
  // What happened
  action: varchar("action", { length: 50 }).notNull().$type<
    "template_created" | "template_updated" | "template_archived" |
    "version_published" |
    "instance_created" | "instance_cloned" | "instance_forked" | "instance_updated" |
    "rollout_created" | "rollout_submitted" | "rollout_approved" | "rollout_rejected" | 
    "rollout_executed" | "rollout_completed" | "rollout_canceled" |
    "update_applied" | "update_skipped" | "update_conflict" | "conflict_resolved"
  >(),
  
  // Who did it
  userId: int("user_id").notNull(),
  
  // Details
  detailsJson: json("details_json").$type<Record<string, unknown>>(),
  
  // Related entities
  relatedTemplateId: varchar("related_template_id", { length: 36 }),
  relatedVersionId: varchar("related_version_id", { length: 36 }),
  relatedInstanceId: varchar("related_instance_id", { length: 36 }),
  relatedRolloutId: varchar("related_rollout_id", { length: 36 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ViewVersionAuditLogEntry = typeof viewVersionAuditLog.$inferSelect;
export type InsertViewVersionAuditLogEntry = typeof viewVersionAuditLog.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// EVIDENCE GROUNDING: 3-Tier Evidence References
// ═══════════════════════════════════════════════════════════════

// Evidence tiers for source highlighting
export const evidenceTierEnum = mysqlEnum("evidenceTier", ["T1_TEXT", "T2_OCR", "T3_ANCHOR"]);

// Canonical evidence references linking VATR fields to source documents
export const evidenceRefs = mysqlTable("evidenceRefs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link to the field record (can be aiExtraction, vatrSourceDocument, or assetAttribute)
  fieldRecordId: int("fieldRecordId").notNull(),
  fieldRecordType: mysqlEnum("fieldRecordType", ["ai_extraction", "vatr_source", "asset_attribute"]).notNull(),
  
  // Source document location
  documentId: int("documentId").notNull(),
  pageNumber: int("pageNumber"), // nullable only if truly unknown
  
  // Evidence tier (determines highlight behavior)
  tier: evidenceTierEnum.notNull(),
  
  // Snippet (max 240 chars enforced at write time)
  snippet: varchar("snippet", { length: 240 }),
  
  // Bounding box for Tier 1 (native PDF text) and Tier 2 (OCR)
  // Format: { units: "pdf_points"|"page_normalized"|"pixels", origin: "top_left"|"bottom_left", rotation: 0|90|180|270, x, y, w, h }
  bboxJson: json("bboxJson").$type<{
    units: "pdf_points" | "page_normalized" | "pixels";
    origin: "top_left" | "bottom_left";
    rotation: 0 | 90 | 180 | 270;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(),
  
  // Anchor for Tier 3 (fallback text matching)
  // Format: { matchType: "exact"|"regex"|"semantic", query: string, contextBefore?: string, contextAfter?: string, occurrenceHint?: number }
  anchorJson: json("anchorJson").$type<{
    matchType: "exact" | "regex" | "semantic";
    query: string;
    contextBefore?: string;
    contextAfter?: string;
    occurrenceHint?: number;
  } | null>(),
  
  // Confidence score (0..1) for selection tie-breaking
  confidence: decimal("confidence", { precision: 4, scale: 3 }).notNull().default("0.5"),
  
  // Provenance
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdById: int("createdById"),
  
  // Provenance status
  provenanceStatus: mysqlEnum("provenanceStatus", ["resolved", "unresolved", "needs_review"]).default("resolved"),
}, (table) => ({
  // Indices for efficient queries
  fieldRecordIdx: index("evidence_field_record_idx").on(table.fieldRecordId, table.fieldRecordType),
  documentPageIdx: index("evidence_document_page_idx").on(table.documentId, table.pageNumber),
  tierIdx: index("evidence_tier_idx").on(table.tier),
}));

export type EvidenceRef = typeof evidenceRefs.$inferSelect;
export type InsertEvidenceRef = typeof evidenceRefs.$inferInsert;

// Evidence open audit log (no snippet stored for security)
export const evidenceAuditLog = mysqlTable("evidenceAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Event type
  eventType: mysqlEnum("eventType", ["evidence_opened", "evidence_not_found", "access_denied"]).notNull(),
  
  // Who
  userId: int("userId").notNull(),
  organizationId: int("organizationId"),
  
  // What
  fieldRecordId: int("fieldRecordId").notNull(),
  fieldRecordType: varchar("fieldRecordType", { length: 50 }).notNull(),
  evidenceRefId: int("evidenceRefId"),
  documentId: int("documentId"),
  pageNumber: int("pageNumber"),
  tierUsed: varchar("tierUsed", { length: 20 }),
  
  // Context (no snippet for security)
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EvidenceAuditLogEntry = typeof evidenceAuditLog.$inferSelect;
export type InsertEvidenceAuditLogEntry = typeof evidenceAuditLog.$inferInsert;


// ============ PHASE 32: ORG ISOLATION + SECURE ONBOARDING ============

// Invite Tokens - Admin-generated tokens for controlled access
// Tokens bind: orgId, role, memberships, expiry, max uses
export const inviteTokens = mysqlTable("inviteTokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // Token identification (hashed at rest)
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(), // SHA-256 hash
  
  // Binding configuration
  organizationId: int("organizationId").notNull(),
  role: mysqlEnum("role", ["admin", "editor", "reviewer", "investor_viewer"]).default("editor").notNull(),
  
  // Optional pre-bound memberships
  teamIds: json("teamIds").$type<number[]>(),
  projectIds: json("projectIds").$type<number[]>(),
  defaultViewId: int("defaultViewId"), // Default view preference
  
  // Usage limits
  maxUses: int("maxUses").default(1).notNull(),
  usedCount: int("usedCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Optional restrictions
  restrictToEmail: varchar("restrictToEmail", { length: 320 }), // If set, only this email can use
  restrictToDomain: varchar("restrictToDomain", { length: 255 }), // If set, only this domain can use
  require2FA: boolean("require2FA").default(false).notNull(),
  
  // Audit
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokedReason: text("revokedReason"),
});

export type InviteToken = typeof inviteTokens.$inferSelect;
export type InsertInviteToken = typeof inviteTokens.$inferInsert;

// Invite Token Redemptions - Audit trail for token usage
export const inviteTokenRedemptions = mysqlTable("inviteTokenRedemptions", {
  id: int("id").autoincrement().primaryKey(),
  tokenId: int("tokenId").notNull(),
  userId: int("userId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
});

export type InviteTokenRedemption = typeof inviteTokenRedemptions.$inferSelect;
export type InsertInviteTokenRedemption = typeof inviteTokenRedemptions.$inferInsert;

// WhatsApp Binding Tokens - Proof-of-control for phone binding
export const whatsappBindingTokens = mysqlTable("whatsappBindingTokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // Token (6-digit code)
  code: varchar("code", { length: 10 }).notNull(),
  
  // User requesting binding
  userId: int("userId").notNull(),
  phoneNumber: varchar("phoneNumber", { length: 20 }).notNull(), // E.164 format
  
  // Status
  status: mysqlEnum("status", ["pending", "verified", "expired", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  maxAttempts: int("maxAttempts").default(3).notNull(),
  
  // Timing
  expiresAt: timestamp("expiresAt").notNull(),
  verifiedAt: timestamp("verifiedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WhatsappBindingToken = typeof whatsappBindingTokens.$inferSelect;
export type InsertWhatsappBindingToken = typeof whatsappBindingTokens.$inferInsert;

// Security Audit Log - All security-relevant events
// Immutable, append-only log for compliance and forensics
export const securityAuditLog = mysqlTable("securityAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Event classification
  eventType: mysqlEnum("eventType", [
    // Authentication
    "login_success", "login_failed", "logout", "session_expired",
    "2fa_enrolled", "2fa_verified", "2fa_failed",
    // Signup/Onboarding
    "signup_started", "email_verified", "signup_completed", "invite_redeemed",
    // Identity binding
    "whatsapp_binding_requested", "whatsapp_binding_verified", "whatsapp_binding_failed",
    "email_change_requested", "email_change_completed",
    "identifier_revoked",
    // Access control
    "org_access_granted", "org_access_revoked", "role_changed",
    "cross_org_access_attempted", "cross_org_access_denied",
    // Superuser
    "elevation_requested", "elevation_granted", "elevation_expired",
    "cross_tenant_read", "cross_tenant_write",
    // Sharing
    "share_token_created", "share_token_revoked", "share_token_accessed",
    // Data access
    "sensitive_data_accessed", "export_requested", "export_completed"
  ]).notNull(),
  
  // Actor
  userId: int("userId"), // May be null for failed logins
  userEmail: varchar("userEmail", { length: 320 }), // For failed logins
  
  // Context
  organizationId: int("organizationId"),
  targetUserId: int("targetUserId"), // If action affects another user
  targetOrganizationId: int("targetOrganizationId"), // For cross-org events
  
  // Details
  details: json("details").$type<Record<string, unknown>>(),
  
  // Request context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Elevation context (for superuser actions)
  elevationId: int("elevationId"),
  elevationReason: text("elevationReason"),
  
  // Timestamp (immutable)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SecurityAuditLogEntry = typeof securityAuditLog.$inferSelect;
export type InsertSecurityAuditLogEntry = typeof securityAuditLog.$inferInsert;

// Superuser Elevations - Time-bound elevated access for KIISHA staff
export const superuserElevations = mysqlTable("superuserElevations", {
  id: int("id").autoincrement().primaryKey(),
  
  // Superuser
  userId: int("userId").notNull(),
  
  // Scope
  targetOrganizationId: int("targetOrganizationId"), // If scoped to specific org
  scope: mysqlEnum("scope", ["global", "organization"]).default("organization").notNull(),
  
  // Permissions during elevation
  canRead: boolean("canRead").default(true).notNull(),
  canWrite: boolean("canWrite").default(false).notNull(),
  canExport: boolean("canExport").default(false).notNull(),
  canViewSecrets: boolean("canViewSecrets").default(false).notNull(),
  
  // Reason and approval
  reason: text("reason").notNull(),
  approvedBy: int("approvedBy"), // Another superuser or auto-approved
  customerApproval: boolean("customerApproval").default(false), // Customer explicitly approved
  
  // Time bounds
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  endedAt: timestamp("endedAt"), // Early termination
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "terminated"]).default("active").notNull(),
});

export type SuperuserElevation = typeof superuserElevations.$inferSelect;
export type InsertSuperuserElevation = typeof superuserElevations.$inferInsert;

// Cross-Org Share Tokens - Explicit sharing is the only cross-org window
export const crossOrgShareTokens = mysqlTable("crossOrgShareTokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // Token identification (hashed at rest)
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  
  // Source organization
  sourceOrganizationId: int("sourceOrganizationId").notNull(),
  createdBy: int("createdBy").notNull(),
  
  // Scope - what is being shared
  shareType: mysqlEnum("shareType", ["view", "assets", "documents", "dataroom"]).notNull(),
  
  // Scoped access (JSON for flexibility)
  scopeConfig: json("scopeConfig").$type<{
    viewId?: number;
    assetIds?: number[];
    documentIds?: number[];
    dataroomId?: number;
    allowedFields?: string[]; // RBAC-safe field list
    readOnly?: boolean;
  }>().notNull(),
  
  // Recipient constraints
  recipientOrganizationId: int("recipientOrganizationId"), // If scoped to specific org
  recipientEmail: varchar("recipientEmail", { length: 320 }), // If scoped to specific email
  
  // Usage limits
  maxUses: int("maxUses"),
  usedCount: int("usedCount").default(0).notNull(),
  
  // Time bounds
  expiresAt: timestamp("expiresAt"),
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokedReason: text("revokedReason"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CrossOrgShareToken = typeof crossOrgShareTokens.$inferSelect;
export type InsertCrossOrgShareToken = typeof crossOrgShareTokens.$inferInsert;

// Cross-Org Share Token Access Log
export const crossOrgShareAccessLog = mysqlTable("crossOrgShareAccessLog", {
  id: int("id").autoincrement().primaryKey(),
  tokenId: int("tokenId").notNull(),
  
  // Accessor
  userId: int("userId"),
  organizationId: int("organizationId"),
  
  // Access details
  accessType: mysqlEnum("accessType", ["view", "download", "export"]).notNull(),
  resourceType: varchar("resourceType", { length: 50 }),
  resourceId: int("resourceId"),
  
  // Request context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Timestamp
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});

export type CrossOrgShareAccessLogEntry = typeof crossOrgShareAccessLog.$inferSelect;
export type InsertCrossOrgShareAccessLogEntry = typeof crossOrgShareAccessLog.$inferInsert;

// KIISHA Lobby Organization - Sandbox for unapproved users
// This is a special system org with no customer data
export const kiishaLobbyConfig = mysqlTable("kiishaLobbyConfig", {
  id: int("id").autoincrement().primaryKey(),
  
  // The lobby org ID (should be org ID 1 or a designated system org)
  lobbyOrganizationId: int("lobbyOrganizationId").notNull().unique(),
  
  // Welcome message shown to lobby users
  welcomeMessage: text("welcomeMessage"),
  
  // Features available in lobby
  allowRequestAccess: boolean("allowRequestAccess").default(true).notNull(),
  allowViewDemo: boolean("allowViewDemo").default(true).notNull(),
  
  // Audit
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KiishaLobbyConfig = typeof kiishaLobbyConfig.$inferSelect;
export type InsertKiishaLobbyConfig = typeof kiishaLobbyConfig.$inferInsert;

// Access Requests - Users in lobby requesting org access
export const accessRequests = mysqlTable("accessRequests", {
  id: int("id").autoincrement().primaryKey(),
  
  // Requester
  userId: int("userId").notNull(),
  userEmail: varchar("userEmail", { length: 320 }).notNull(),
  
  // Target organization (if known)
  targetOrganizationId: int("targetOrganizationId"),
  targetOrganizationName: varchar("targetOrganizationName", { length: 255 }), // Free text if org unknown
  
  // Request details
  requestReason: text("requestReason"),
  requestedRole: mysqlEnum("requestedRole", ["admin", "editor", "reviewer", "investor_viewer"]).default("editor"),
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  
  // Resolution
  resolvedBy: int("resolvedBy"),
  resolvedAt: timestamp("resolvedAt"),
  resolutionNotes: text("resolutionNotes"),
  
  // If approved, the resulting membership
  resultingMembershipId: int("resultingMembershipId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // Auto-expire old requests
});

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

// User Sessions - Track active sessions for security
export const userSessions = mysqlTable("userSessions", {
  id: int("id").autoincrement().primaryKey(),
  
  // User
  userId: int("userId").notNull(),
  
  // Session identification
  sessionId: varchar("sessionId", { length: 64 }).notNull().unique(),
  
  // Active organization context
  activeOrganizationId: int("activeOrganizationId"),
  
  // Workspace selection required - set to true on fresh login, false after explicit selection
  workspaceSelectionRequired: boolean("workspaceSelectionRequired").default(true).notNull(),
  
  // Device/client info
  deviceFingerprint: varchar("deviceFingerprint", { length: 64 }),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  // Timing
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedReason: text("revokedReason"),
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;


// ============================================================================
// Phase 33: Multi-Org Workspace Switching + Zero-Leak Tenant Isolation
// ============================================================================

// User Workspace Preferences - per-user defaults and channel-specific org bindings
export const userWorkspacePreferences = mysqlTable("userWorkspacePreferences", {
  id: int("id").autoincrement().primaryKey(),
  
  // User
  userId: int("userId").notNull().unique(),
  
  // Default org (used when no channel-specific default exists)
  defaultOrgId: int("defaultOrgId"),
  
  // Primary org (explicit user preference for "main" workspace)
  primaryOrgId: int("primaryOrgId"),
  
  // Last active org on web (for session restoration)
  webLastActiveOrgId: int("webLastActiveOrgId"),
  
  // Channel-specific defaults
  whatsappDefaultOrgId: int("whatsappDefaultOrgId"),
  emailDefaultOrgId: int("emailDefaultOrgId"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserWorkspacePreference = typeof userWorkspacePreferences.$inferSelect;
export type InsertUserWorkspacePreference = typeof userWorkspacePreferences.$inferInsert;

// Workspace Binding Codes - short-lived codes for secure channel binding
// Used for WhatsApp/Email to bind chat to a specific workspace without revealing org names
export const workspaceBindingCodes = mysqlTable("workspaceBindingCodes", {
  id: int("id").autoincrement().primaryKey(),
  
  // Code (6-digit numeric for easy typing)
  code: varchar("code", { length: 10 }).notNull().unique(),
  
  // Target binding
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Channel this code is for (optional - if null, works for any channel)
  channel: mysqlEnum("channel", ["whatsapp", "email"]),
  
  // Validity
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Usage tracking
  usedAt: timestamp("usedAt"),
  usedFromChannel: mysqlEnum("usedFromChannel", ["whatsapp", "email"]),
  usedFromIdentifier: varchar("usedFromIdentifier", { length: 320 }),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkspaceBindingCode = typeof workspaceBindingCodes.$inferSelect;
export type InsertWorkspaceBindingCode = typeof workspaceBindingCodes.$inferInsert;

// Workspace Switch Audit Log - track all workspace switches for security
export const workspaceSwitchAuditLog = mysqlTable("workspaceSwitchAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Who switched
  userId: int("userId").notNull(),
  
  // Switch details
  fromOrganizationId: int("fromOrganizationId"),
  toOrganizationId: int("toOrganizationId").notNull(),
  
  // Channel and context
  channel: mysqlEnum("channel", ["web", "whatsapp", "email", "api"]).notNull(),
  switchMethod: mysqlEnum("switchMethod", [
    "login_auto",           // Auto-selected (single org)
    "login_selection",      // User selected at login
    "switcher",             // Used workspace switcher
    "binding_code",         // Used binding code
    "channel_default",      // Channel-specific default
    "session_restore"       // Restored from session
  ]).notNull(),
  
  // Client info
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Timestamp
  switchedAt: timestamp("switchedAt").defaultNow().notNull(),
});

export type WorkspaceSwitchAuditEntry = typeof workspaceSwitchAuditLog.$inferSelect;
export type InsertWorkspaceSwitchAuditEntry = typeof workspaceSwitchAuditLog.$inferInsert;


// ═══════════════════════════════════════════════════════════════
// PHASE 34: ORG PREFERENCES & FIELD PACKS
// ═══════════════════════════════════════════════════════════════

/**
 * Org Preferences - tenant-scoped defaults for views, fields, charts
 * One row per organization (or versioned via orgPreferenceVersions)
 */
export const orgPreferences = mysqlTable("orgPreferences", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  
  // Default asset classifications enabled for this org
  defaultAssetClassifications: json("defaultAssetClassifications").$type<string[]>(),
  
  // Default configuration profiles (e.g., Solar+BESS, Solar+Gen, Solar-only)
  defaultConfigurationProfiles: json("defaultConfigurationProfiles").$type<string[]>(),
  
  // Preferred field packs (array of fieldPack IDs)
  preferredFieldPacks: json("preferredFieldPacks").$type<number[]>(),
  
  // Default disclosure mode for views
  defaultDisclosureMode: mysqlEnum("defaultDisclosureMode", ["summary", "expanded", "full"]).default("summary"),
  
  // Default charts configuration
  defaultChartsConfig: json("defaultChartsConfig").$type<{
    allowedChartTypes: string[];
    defaultChartType: string;
    dashboardCharts: Array<{
      chartKey: string;
      chartType: string;
      position: number;
      dataBinding: string;
    }>;
  }>(),
  
  // Optional link to org-specific document hub schema
  defaultDocumentHubSchemaId: int("defaultDocumentHubSchemaId"),
  
  // AI setup status
  aiSetupCompleted: boolean("aiSetupCompleted").default(false),
  aiSetupCompletedAt: timestamp("aiSetupCompletedAt"),
  
  // Audit
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type OrgPreference = typeof orgPreferences.$inferSelect;
export type InsertOrgPreference = typeof orgPreferences.$inferInsert;

/**
 * Org Preference Versions - for push update safety
 */
export const orgPreferenceVersions = mysqlTable("orgPreferenceVersions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  version: int("version").notNull(),
  
  // Snapshot of preferences at this version
  snapshotJson: json("snapshotJson").$type<OrgPreference>(),
  
  // Change summary
  changeSummary: text("changeSummary"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
}, (table) => ({
  orgVersionUnique: uniqueIndex("org_version_unique").on(table.organizationId, table.version),
}));
export type OrgPreferenceVersion = typeof orgPreferenceVersions.$inferSelect;
export type InsertOrgPreferenceVersion = typeof orgPreferenceVersions.$inferInsert;

/**
 * Field Packs - reusable bundles of fields and doc requirements
 * organizationId = null means KIISHA global template (read-only)
 */
export const fieldPacks = mysqlTable("fieldPacks", {
  id: int("id").autoincrement().primaryKey(),
  
  // null = KIISHA global template (read-only), orgId = org-customized pack
  organizationId: int("organizationId"),
  
  // Metadata
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Scope of this pack
  scope: mysqlEnum("scope", ["asset", "project", "site", "portfolio", "dataroom", "rfi"]).notNull(),
  
  // Field definitions
  fields: json("fields").$type<Array<{
    fieldKey: string;
    required: boolean;
    displayLabel: string;
    group: string;
    order: number;
    validationRules?: {
      type: string;
      min?: number;
      max?: number;
      pattern?: string;
    };
    sensitivity?: "public" | "internal" | "confidential" | "restricted";
  }>>(),
  
  // Document requirements
  docRequirements: json("docRequirements").$type<Array<{
    docTypeKey: string;
    required: boolean;
    reviewerGroups: string[];
    allowedFileTypes: string[];
    statusLightsConfig?: {
      green: string;
      yellow: string;
      red: string;
    };
  }>>(),
  
  // Chart configurations
  charts: json("charts").$type<Array<{
    chartKey: string;
    defaultType: string;
    allowedTypes: string[];
    dataBinding: string;
  }>>(),
  
  // Status
  status: mysqlEnum("status", ["draft", "active", "archived"]).default("draft"),
  
  // If cloned from a template
  clonedFromId: int("clonedFromId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type FieldPack = typeof fieldPacks.$inferSelect;
export type InsertFieldPack = typeof fieldPacks.$inferInsert;

/**
 * AI Setup Proposals - stores AI recommendations for admin review
 */
export const aiSetupProposals = mysqlTable("aiSetupProposals", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "partially_approved"]).default("pending"),
  
  // Input documents used for generation
  inputDocumentIds: json("inputDocumentIds").$type<number[]>(),
  
  // Questionnaire responses (if provided)
  questionnaireResponses: json("questionnaireResponses").$type<{
    industry?: string;
    techStack?: string[];
    reportingStyle?: string;
    geographies?: string[];
    customResponses?: Record<string, string>;
  }>(),
  
  // AI-generated proposals
  proposedAssetClasses: json("proposedAssetClasses").$type<string[]>(),
  proposedConfigProfiles: json("proposedConfigProfiles").$type<string[]>(),
  proposedFieldPacks: json("proposedFieldPacks").$type<Array<{
    name: string;
    scope: string;
    fields: Array<{
      fieldKey: string;
      required: boolean;
      displayLabel: string;
      group: string;
    }>;
    confidence: number;
    reasoning: string;
  }>>(),
  proposedChartConfig: json("proposedChartConfig").$type<{
    charts: Array<{
      chartKey: string;
      chartType: string;
      dataBinding: string;
    }>;
    confidence: number;
    reasoning: string;
  }>(),
  proposedDocHubCategories: json("proposedDocHubCategories").$type<Array<{
    category: string;
    docTypes: string[];
    confidence: number;
    reasoning: string;
  }>>(),
  
  // Overall confidence and risks
  overallConfidence: decimal("overallConfidence", { precision: 5, scale: 2 }),
  risks: json("risks").$type<string[]>(),
  ambiguities: json("ambiguities").$type<string[]>(),
  
  // Admin review
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  
  // What was approved (subset of proposals)
  approvedItems: json("approvedItems").$type<{
    assetClasses: boolean;
    configProfiles: boolean;
    fieldPackIds: number[];
    chartConfig: boolean;
    docHubCategories: boolean;
  }>(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AiSetupProposal = typeof aiSetupProposals.$inferSelect;
export type InsertAiSetupProposal = typeof aiSetupProposals.$inferInsert;

/**
 * User View Customizations - per-user customizations within org defaults
 * Separate from userViewPreferences (which handles default view selection)
 */
export const userViewCustomizations = mysqlTable("userViewCustomizations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // View reference
  viewId: int("viewId").notNull(),
  
  // User's local customizations
  localChartOverrides: json("localChartOverrides").$type<Array<{
    chartKey: string;
    chartType: string;
  }>>(),
  localColumnOrder: json("localColumnOrder").$type<string[]>(),
  localHiddenFields: json("localHiddenFields").$type<string[]>(),
  
  // Push update handling
  lastOrgUpdateVersion: int("lastOrgUpdateVersion"),
  hasLocalChanges: boolean("hasLocalChanges").default(false),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userViewCustomUnique: uniqueIndex("user_view_custom_unique").on(table.userId, table.organizationId, table.viewId),
}));
export type UserViewCustomization = typeof userViewCustomizations.$inferSelect;
export type InsertUserViewCustomization = typeof userViewCustomizations.$inferInsert;

/**
 * Push Update Notifications - tracks update prompts for users
 */
export const pushUpdateNotifications = mysqlTable("pushUpdateNotifications", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // What was updated
  updateType: mysqlEnum("updateType", ["field_pack", "chart_config", "view_template", "doc_hub_schema"]).notNull(),
  updateSourceId: int("updateSourceId").notNull(),
  updateVersion: int("updateVersion").notNull(),
  
  // Update scope
  targetScope: mysqlEnum("targetScope", ["all_users", "team", "department", "specific_users"]).notNull(),
  targetIds: json("targetIds").$type<number[]>(),
  
  // Force update policy
  forceUpdate: boolean("forceUpdate").default(false),
  
  // Approval (if org policy requires)
  requiresApproval: boolean("requiresApproval").default(false),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  
  // Tracking
  notifiedUserIds: json("notifiedUserIds").$type<number[]>(),
  acceptedUserIds: json("acceptedUserIds").$type<number[]>(),
  
  // Audit
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PushUpdateNotification = typeof pushUpdateNotifications.$inferSelect;
export type InsertPushUpdateNotification = typeof pushUpdateNotifications.$inferInsert;


// ============================================================================
// PHASE 35: Authentication-First Access, Session Management, and Workspace Gating
// ============================================================================

/**
 * Server-side sessions table for secure session management
 * Replaces pure JWT-based sessions with server-tracked sessions
 */
export const serverSessions = mysqlTable("serverSessions", {
  id: varchar("id", { length: 64 }).primaryKey(), // Secure random session ID
  userId: int("userId").notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  
  // Revocation
  revokedAt: timestamp("revokedAt"),
  revokedReason: varchar("revokedReason", { length: 255 }),
  revokedBy: int("revokedBy"), // Admin who revoked, null if self or system
  
  // Security metadata (hashed for privacy)
  ipHash: varchar("ipHash", { length: 64 }),
  userAgentHash: varchar("userAgentHash", { length: 64 }),
  
  // MFA status
  mfaSatisfiedAt: timestamp("mfaSatisfiedAt"),
  
  // Token management
  refreshTokenHash: varchar("refreshTokenHash", { length: 64 }),
  csrfSecret: varchar("csrfSecret", { length: 64 }),
  
  // Active workspace context
  activeOrganizationId: int("activeOrganizationId"),
  
  // Workspace selection required - set to true on fresh login, false after explicit selection
  workspaceSelectionRequired: boolean("workspaceSelectionRequired").default(true).notNull(),
  
  // Device info (for session management UI)
  deviceType: varchar("deviceType", { length: 50 }), // desktop, mobile, tablet
  browserName: varchar("browserName", { length: 50 }),
  osName: varchar("osName", { length: 50 }),
}, (table) => [
  index("serverSessions_userId_idx").on(table.userId),
  index("serverSessions_expiresAt_idx").on(table.expiresAt),
  index("serverSessions_activeOrganizationId_idx").on(table.activeOrganizationId),
]);
export type ServerSession = typeof serverSessions.$inferSelect;
export type InsertServerSession = typeof serverSessions.$inferInsert;

/**
 * User last context for remembering workspace preferences
 */
export const userLastContext = mysqlTable("userLastContext", {
  userId: int("userId").primaryKey(),
  lastOrganizationId: int("lastOrganizationId"),
  lastViewId: int("lastViewId"),
  lastProjectId: int("lastProjectId"),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
});
export type UserLastContext = typeof userLastContext.$inferSelect;
export type InsertUserLastContext = typeof userLastContext.$inferInsert;

/**
 * MFA configuration for users
 */
export const userMfaConfig = mysqlTable("userMfaConfig", {
  userId: int("userId").primaryKey(),
  
  // TOTP configuration
  totpSecret: varchar("totpSecret", { length: 255 }), // Encrypted
  totpEnabled: boolean("totpEnabled").default(false).notNull(),
  totpVerifiedAt: timestamp("totpVerifiedAt"),
  
  // Backup codes (hashed)
  backupCodesHash: json("backupCodesHash").$type<string[]>(),
  backupCodesGeneratedAt: timestamp("backupCodesGeneratedAt"),
  backupCodesUsedCount: int("backupCodesUsedCount").default(0),
  
  // Recovery email (if different from primary)
  recoveryEmail: varchar("recoveryEmail", { length: 255 }),
  recoveryEmailVerified: boolean("recoveryEmailVerified").default(false),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type UserMfaConfig = typeof userMfaConfig.$inferSelect;
export type InsertUserMfaConfig = typeof userMfaConfig.$inferInsert;

/**
 * Auth audit log for security events
 */
export const authAuditLog = mysqlTable("authAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Event info
  eventType: mysqlEnum("eventType", [
    "login_success",
    "login_failed",
    "logout",
    "mfa_setup",
    "mfa_verified",
    "mfa_failed",
    "mfa_reset",
    "session_created",
    "session_revoked",
    "session_expired",
    "workspace_selected",
    "workspace_switched",
    "password_changed",
    "password_reset_requested",
    "password_reset_completed",
    "account_locked",
    "account_unlocked",
    "identifier_added",
    "identifier_revoked",
  ]).notNull(),
  
  // Actor
  userId: int("userId"),
  sessionId: varchar("sessionId", { length: 64 }),
  
  // Context
  organizationId: int("organizationId"),
  targetUserId: int("targetUserId"), // For admin actions on other users
  
  // Security metadata
  ipHash: varchar("ipHash", { length: 64 }),
  userAgentHash: varchar("userAgentHash", { length: 64 }),
  
  // Event details (no sensitive data)
  details: json("details").$type<Record<string, unknown>>(),
  
  // Result
  success: boolean("success").notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("authAuditLog_userId_idx").on(table.userId),
  index("authAuditLog_eventType_idx").on(table.eventType),
  index("authAuditLog_createdAt_idx").on(table.createdAt),
  index("authAuditLog_organizationId_idx").on(table.organizationId),
]);
export type AuthAuditLog = typeof authAuditLog.$inferSelect;
export type InsertAuthAuditLog = typeof authAuditLog.$inferInsert;

/**
 * Login attempt tracking for rate limiting
 */
export const loginAttempts = mysqlTable("loginAttempts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identifier (email hash for privacy)
  identifierHash: varchar("identifierHash", { length: 64 }).notNull(),
  ipHash: varchar("ipHash", { length: 64 }).notNull(),
  
  // Attempt info
  attemptedAt: timestamp("attemptedAt").defaultNow().notNull(),
  success: boolean("success").notNull(),
  
  // Lockout tracking
  failureCount: int("failureCount").default(0),
  lockedUntil: timestamp("lockedUntil"),
}, (table) => [
  index("loginAttempts_identifierHash_idx").on(table.identifierHash),
  index("loginAttempts_ipHash_idx").on(table.ipHash),
  index("loginAttempts_attemptedAt_idx").on(table.attemptedAt),
]);
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;


// ============================================================================
// PHASE 36: OBLIGATIONS + CALENDAR LENS + NOTIFICATIONS
// ============================================================================

/**
 * Obligation types enum
 */
export const obligationTypeEnum = mysqlEnum("obligationType", [
  "RFI_ITEM",
  "APPROVAL_GATE",
  "WORK_ORDER",
  "MAINTENANCE",
  "DOCUMENT_EXPIRY",
  "MILESTONE",
  "REPORT_DEADLINE",
  "COMPLIANCE_REQUIREMENT",
  "CUSTOM"
]);

/**
 * Obligation status enum
 */
export const obligationStatusEnum = mysqlEnum("obligationStatus", [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "WAITING_REVIEW",
  "APPROVED",
  "COMPLETED",
  "OVERDUE",
  "CANCELLED"
]);

/**
 * Obligation priority enum
 */
export const obligationPriorityEnum = mysqlEnum("obligationPriority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL"
]);

/**
 * Obligation visibility enum
 */
export const obligationVisibilityEnum = mysqlEnum("obligationVisibility", [
  "INTERNAL_ONLY",
  "ORG_SHARED",
  "EXTERNAL_GRANTED"
]);

/**
 * Obligation source type enum
 */
export const obligationSourceTypeEnum = mysqlEnum("obligationSourceType", [
  "MANUAL",
  "AI_SUGGESTED",
  "TEMPLATE",
  "INGESTED_DOC",
  "INTEGRATION"
]);

/**
 * Canonical obligations table - the single source of truth for all time-based items
 */
export const obligations = mysqlTable("obligations", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  
  // Core fields
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Type and status
  obligationType: obligationTypeEnum.notNull(),
  status: obligationStatusEnum.default("OPEN").notNull(),
  priority: obligationPriorityEnum.default("MEDIUM").notNull(),
  
  // Time fields
  startAt: timestamp("startAt"),
  dueAt: timestamp("dueAt"),
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  recurrenceRule: varchar("recurrenceRule", { length: 500 }), // RRULE format
  
  // Policy references
  reminderPolicyId: int("reminderPolicyId"),
  escalationPolicyId: int("escalationPolicyId"),
  
  // Visibility and access
  visibility: obligationVisibilityEnum.default("ORG_SHARED").notNull(),
  
  // Source tracking (provenance)
  sourceType: obligationSourceTypeEnum.default("MANUAL").notNull(),
  sourceRef: json("sourceRef").$type<{
    docId?: number;
    formId?: number;
    rfiId?: number;
    workOrderId?: number;
    clauseRef?: string;
    checklistItemId?: number;
    complianceItemId?: number;
  }>(),
  
  // VATR integration
  vatrFieldPointers: json("vatrFieldPointers").$type<{
    clusterId?: string;
    fieldIds?: string[];
    assetId?: number;
  }>(),
  
  // AI suggestion metadata
  aiConfidence: decimal("aiConfidence", { precision: 5, scale: 4 }),
  aiSuggestionAccepted: boolean("aiSuggestionAccepted"),
  aiSuggestionAcceptedAt: timestamp("aiSuggestionAcceptedAt"),
  aiSuggestionAcceptedBy: int("aiSuggestionAcceptedBy"),
  
  // Completion tracking
  completedAt: timestamp("completedAt"),
  completedByUserId: int("completedByUserId"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("obligations_organizationId_idx").on(table.organizationId),
  index("obligations_dueAt_idx").on(table.dueAt),
  index("obligations_status_idx").on(table.status),
  index("obligations_obligationType_idx").on(table.obligationType),
  index("obligations_createdByUserId_idx").on(table.createdByUserId),
  index("obligations_org_status_due_idx").on(table.organizationId, table.status, table.dueAt),
]);
export type Obligation = typeof obligations.$inferSelect;
export type InsertObligation = typeof obligations.$inferInsert;

/**
 * Obligation link entity type enum
 */
export const obligationLinkEntityTypeEnum = mysqlEnum("obligationLinkEntityType", [
  "ASSET",
  "PROJECT",
  "SITE",
  "DATAROOM",
  "RFI",
  "WORKSPACE_VIEW",
  "DOCUMENT",
  "PORTFOLIO"
]);

/**
 * Obligation link type enum
 */
export const obligationLinkTypeEnum = mysqlEnum("obligationLinkType", [
  "PRIMARY",
  "SECONDARY"
]);

/**
 * Obligation links - connects obligations to entities
 */
export const obligationLinks = mysqlTable("obligationLinks", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  obligationId: int("obligationId").notNull(),
  
  // Entity reference
  entityType: obligationLinkEntityTypeEnum.notNull(),
  entityId: int("entityId").notNull(),
  
  // Link type
  linkType: obligationLinkTypeEnum.default("SECONDARY").notNull(),
  
  // Audit
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("obligationLinks_obligationId_idx").on(table.obligationId),
  index("obligationLinks_entityType_entityId_idx").on(table.entityType, table.entityId),
  index("obligationLinks_organizationId_idx").on(table.organizationId),
  // Unique constraint for primary links per entity type
  unique("obligationLinks_primary_unique").on(table.obligationId, table.entityType, table.linkType),
]);
export type ObligationLink = typeof obligationLinks.$inferSelect;
export type InsertObligationLink = typeof obligationLinks.$inferInsert;

/**
 * Obligation assignment role enum
 */
export const obligationAssignmentRoleEnum = mysqlEnum("obligationAssignmentRole", [
  "OWNER",
  "CONTRIBUTOR",
  "REVIEWER",
  "APPROVER"
]);

/**
 * Obligation assignee type enum
 */
export const obligationAssigneeTypeEnum = mysqlEnum("obligationAssigneeType", [
  "USER",
  "TEAM"
]);

/**
 * Obligation assignments - who is responsible for obligations
 */
export const obligationAssignments = mysqlTable("obligationAssignments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  obligationId: int("obligationId").notNull(),
  
  // Assignee
  assigneeType: obligationAssigneeTypeEnum.notNull(),
  assigneeId: int("assigneeId").notNull(),
  
  // Role
  role: obligationAssignmentRoleEnum.default("CONTRIBUTOR").notNull(),
  
  // Audit
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("obligationAssignments_obligationId_idx").on(table.obligationId),
  index("obligationAssignments_assigneeId_idx").on(table.assigneeId),
  index("obligationAssignments_organizationId_idx").on(table.organizationId),
  unique("obligationAssignments_unique").on(table.obligationId, table.assigneeType, table.assigneeId),
]);
export type ObligationAssignment = typeof obligationAssignments.$inferSelect;
export type InsertObligationAssignment = typeof obligationAssignments.$inferInsert;

/**
 * Obligation audit log - immutable history of all changes
 */
export const obligationAuditLog = mysqlTable("obligationAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  obligationId: int("obligationId").notNull(),
  
  // Action type
  action: mysqlEnum("action", [
    "CREATED",
    "UPDATED",
    "STATUS_CHANGED",
    "ASSIGNED",
    "UNASSIGNED",
    "LINKED",
    "UNLINKED",
    "REMINDER_SENT",
    "ESCALATED",
    "COMPLETED",
    "CANCELLED",
    "AI_SUGGESTION_ACCEPTED",
    "AI_SUGGESTION_REJECTED",
    "EXPORTED",
    "SHARED"
  ]).notNull(),
  
  // Change details
  previousValue: json("previousValue").$type<Record<string, unknown>>(),
  newValue: json("newValue").$type<Record<string, unknown>>(),
  
  // Actor
  userId: int("userId"),
  systemGenerated: boolean("systemGenerated").default(false),
  
  // Context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: varchar("userAgent", { length: 500 }),
  
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("obligationAuditLog_obligationId_idx").on(table.obligationId),
  index("obligationAuditLog_organizationId_idx").on(table.organizationId),
  index("obligationAuditLog_createdAt_idx").on(table.createdAt),
  index("obligationAuditLog_action_idx").on(table.action),
]);
export type ObligationAuditLog = typeof obligationAuditLog.$inferSelect;
export type InsertObligationAuditLog = typeof obligationAuditLog.$inferInsert;

/**
 * Reminder policies - define when and how to send reminders
 */
export const reminderPolicies = mysqlTable("reminderPolicies", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Policy details
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true),
  
  // Channels to use
  channels: json("channels").$type<{
    inApp: boolean;
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  }>().notNull(),
  
  // Reminder rules (when to send)
  rules: json("rules").$type<{
    beforeDue?: { days: number; hours?: number }[];
    onDue?: boolean;
    afterDue?: { days: number; hours?: number }[];
  }>().notNull(),
  
  // Quiet hours (don't send during these times)
  quietHours: json("quietHours").$type<{
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
    excludeWeekends: boolean;
  }>(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("reminderPolicies_organizationId_idx").on(table.organizationId),
]);
export type ReminderPolicy = typeof reminderPolicies.$inferSelect;
export type InsertReminderPolicy = typeof reminderPolicies.$inferInsert;

/**
 * Escalation policies - define when and how to escalate overdue items
 */
export const escalationPolicies = mysqlTable("escalationPolicies", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Policy details
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true),
  
  // Escalation rules
  rules: json("rules").$type<{
    triggers: {
      daysOverdue: number;
      notifyRoles: string[];
      notifyUserIds?: number[];
      notifyTeamIds?: number[];
      escalationLevel: number;
    }[];
    maxEscalationLevel: number;
  }>().notNull(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("escalationPolicies_organizationId_idx").on(table.organizationId),
]);
export type EscalationPolicy = typeof escalationPolicies.$inferSelect;
export type InsertEscalationPolicy = typeof escalationPolicies.$inferInsert;

/**
 * Notification events - audit trail for all notifications sent
 */
export const notificationEvents = mysqlTable("notificationEvents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Reference to obligation
  obligationId: int("obligationId"),
  
  // Event type
  eventType: mysqlEnum("eventType", [
    "REMINDER",
    "ESCALATION",
    "STATUS_CHANGE",
    "ASSIGNMENT",
    "COMMENT",
    "DUE_TODAY",
    "OVERDUE"
  ]).notNull(),
  
  // Recipient
  recipientUserId: int("recipientUserId").notNull(),
  
  // Channel and delivery
  channel: mysqlEnum("channel", ["in_app", "email", "whatsapp", "sms"]).notNull(),
  templateId: varchar("templateId", { length: 100 }),
  
  // Delivery status
  status: mysqlEnum("status", ["queued", "sent", "delivered", "failed", "bounced"]).default("queued").notNull(),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  failedAt: timestamp("failedAt"),
  failureReason: text("failureReason"),
  
  // Content (for audit, not for rendering)
  contentSnapshot: json("contentSnapshot").$type<{
    subject?: string;
    body?: string;
    templateData?: Record<string, unknown>;
  }>(),
  
  // Correlation
  correlationId: varchar("correlationId", { length: 64 }),
  jobId: int("jobId"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("notificationEvents_organizationId_idx").on(table.organizationId),
  index("notificationEvents_obligationId_idx").on(table.obligationId),
  index("notificationEvents_recipientUserId_idx").on(table.recipientUserId),
  index("notificationEvents_createdAt_idx").on(table.createdAt),
  index("notificationEvents_status_idx").on(table.status),
]);
export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type InsertNotificationEvent = typeof notificationEvents.$inferInsert;

/**
 * External calendar provider enum
 */
export const calendarProviderEnum = mysqlEnum("calendarProvider", [
  "GOOGLE",
  "MICROSOFT",
  "APPLE"
]);

/**
 * External calendar bindings - user's connected calendars
 */
export const externalCalendarBindings = mysqlTable("externalCalendarBindings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  
  // Provider info
  provider: calendarProviderEnum.notNull(),
  
  // OAuth tokens (encrypted)
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  
  // Calendar selection
  calendarId: varchar("calendarId", { length: 500 }).notNull(),
  calendarName: varchar("calendarName", { length: 200 }),
  
  // Status
  status: mysqlEnum("status", ["active", "revoked", "expired", "error"]).default("active").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),
  
  // Sync preferences
  syncEnabled: boolean("syncEnabled").default(true),
  syncObligationTypes: json("syncObligationTypes").$type<string[]>(),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("externalCalendarBindings_userId_idx").on(table.userId),
  index("externalCalendarBindings_organizationId_idx").on(table.organizationId),
  unique("externalCalendarBindings_user_provider_unique").on(table.userId, table.provider),
]);
export type ExternalCalendarBinding = typeof externalCalendarBindings.$inferSelect;
export type InsertExternalCalendarBinding = typeof externalCalendarBindings.$inferInsert;

/**
 * External calendar events - tracks synced events
 */
export const externalCalendarEvents = mysqlTable("externalCalendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  obligationId: int("obligationId").notNull(),
  userId: int("userId").notNull(),
  bindingId: int("bindingId").notNull(),
  
  // External event reference
  provider: calendarProviderEnum.notNull(),
  externalEventId: varchar("externalEventId", { length: 500 }).notNull(),
  
  // Sync status
  syncStatus: mysqlEnum("syncStatus", ["synced", "pending", "failed", "deleted"]).default("pending").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  lastSyncError: text("lastSyncError"),
  
  // Version tracking for conflict detection
  localVersion: int("localVersion").default(1),
  externalVersion: varchar("externalVersion", { length: 100 }),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("externalCalendarEvents_obligationId_idx").on(table.obligationId),
  index("externalCalendarEvents_userId_idx").on(table.userId),
  index("externalCalendarEvents_organizationId_idx").on(table.organizationId),
  unique("externalCalendarEvents_obligation_user_unique").on(table.obligationId, table.userId, table.provider),
]);
export type ExternalCalendarEvent = typeof externalCalendarEvents.$inferSelect;
export type InsertExternalCalendarEvent = typeof externalCalendarEvents.$inferInsert;

/**
 * Obligation view overlays - tracks which obligations are visible in which views
 */
export const obligationViewOverlays = mysqlTable("obligationViewOverlays", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  viewId: int("viewId").notNull(),
  obligationId: int("obligationId").notNull(),
  
  // Visibility in this view
  isVisible: boolean("isVisible").default(true),
  removedAt: timestamp("removedAt"),
  removedByUserId: int("removedByUserId"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("obligationViewOverlays_viewId_idx").on(table.viewId),
  index("obligationViewOverlays_obligationId_idx").on(table.obligationId),
  index("obligationViewOverlays_organizationId_idx").on(table.organizationId),
  unique("obligationViewOverlays_view_obligation_unique").on(table.viewId, table.obligationId),
]);
export type ObligationViewOverlay = typeof obligationViewOverlays.$inferSelect;
export type InsertObligationViewOverlay = typeof obligationViewOverlays.$inferInsert;


/**
 * Password reset tokens - for forgot password flow
 */
export const passwordResetTokens = mysqlTable("passwordResetTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("passwordResetTokens_userId_idx").on(table.userId),
  index("passwordResetTokens_token_idx").on(table.token),
  index("passwordResetTokens_expiresAt_idx").on(table.expiresAt),
]);
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;


// ============================================================================
// PHASE 38: EMAIL TEMPLATES, REQUEST REMINDERS, BULK IMPORT
// ============================================================================

/**
 * Email template type enum
 */
export const emailTemplateTypeEnum = mysqlEnum("emailTemplateType", [
  "request_issued",
  "request_reminder",
  "request_submitted",
  "request_clarification",
  "request_completed",
  "request_overdue",
  "password_reset",
  "welcome",
  "invitation",
  "custom"
]);

/**
 * Organization email templates - customizable email templates per org
 */
export const emailTemplates = mysqlTable("emailTemplates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Template identification
  templateType: emailTemplateTypeEnum.notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Template content
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("bodyHtml").notNull(),
  bodyText: text("bodyText"), // Plain text fallback
  
  // Branding
  headerLogoUrl: varchar("headerLogoUrl", { length: 500 }),
  footerText: text("footerText"),
  primaryColor: varchar("primaryColor", { length: 7 }), // Hex color
  
  // Available variables for this template type
  availableVariables: json("availableVariables").$type<string[]>(),
  
  // Status
  isActive: boolean("isActive").default(true),
  isDefault: boolean("isDefault").default(false),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
}, (table) => [
  index("emailTemplates_organizationId_idx").on(table.organizationId),
  index("emailTemplates_templateType_idx").on(table.templateType),
  unique("emailTemplates_org_type_default").on(table.organizationId, table.templateType, table.isDefault),
]);
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

/**
 * Request reminder status enum
 */
export const reminderStatusEnum = mysqlEnum("reminderStatus", [
  "pending",
  "sent",
  "failed",
  "cancelled"
]);

/**
 * Request reminders - scheduled reminders for requests approaching deadline
 */
export const requestReminders = mysqlTable("requestReminders", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Request reference
  requestId: int("requestId").notNull(),
  recipientUserId: int("recipientUserId").notNull(),
  
  // Reminder timing
  reminderType: mysqlEnum("reminderType", ["3_days", "1_day", "overdue", "custom"]).notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  
  // Status
  status: reminderStatusEnum.default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  failedAt: timestamp("failedAt"),
  failureReason: text("failureReason"),
  
  // Email template used
  emailTemplateId: int("emailTemplateId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("requestReminders_organizationId_idx").on(table.organizationId),
  index("requestReminders_requestId_idx").on(table.requestId),
  index("requestReminders_scheduledFor_idx").on(table.scheduledFor),
  index("requestReminders_status_idx").on(table.status),
]);
export type RequestReminder = typeof requestReminders.$inferSelect;
export type InsertRequestReminder = typeof requestReminders.$inferInsert;

/**
 * Organization reminder settings - configurable reminder policies
 */
export const reminderSettings = mysqlTable("reminderSettings", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  
  // Enable/disable reminders
  remindersEnabled: boolean("remindersEnabled").default(true),
  
  // Reminder timing (days before due)
  firstReminderDays: int("firstReminderDays").default(3),
  secondReminderDays: int("secondReminderDays").default(1),
  overdueReminderEnabled: boolean("overdueReminderEnabled").default(true),
  
  // Custom reminder intervals (optional)
  customReminderDays: json("customReminderDays").$type<number[]>(),
  
  // Audit
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type ReminderSettings = typeof reminderSettings.$inferSelect;
export type InsertReminderSettings = typeof reminderSettings.$inferInsert;

/**
 * Asset import job status enum
 */
export const importJobStatusEnum = mysqlEnum("importJobStatus", [
  "pending",
  "validating",
  "validated",
  "validation_failed",
  "importing",
  "completed",
  "failed",
  "cancelled"
]);

/**
 * Asset import jobs - tracks bulk import operations
 */
export const assetImportJobs = mysqlTable("assetImportJobs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // File info
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
  fileType: mysqlEnum("fileType", ["csv", "xlsx", "xls"]).notNull(),
  fileSize: int("fileSize"),
  
  // Import configuration
  targetAssetClass: varchar("targetAssetClass", { length: 100 }),
  columnMapping: json("columnMapping").$type<Record<string, string>>(), // file column -> VATR field
  
  // Status
  status: importJobStatusEnum.default("pending").notNull(),
  
  // Progress tracking
  totalRows: int("totalRows"),
  processedRows: int("processedRows").default(0),
  successRows: int("successRows").default(0),
  errorRows: int("errorRows").default(0),
  
  // Validation results
  validationErrors: json("validationErrors").$type<Array<{
    row: number;
    column: string;
    error: string;
    value?: string;
  }>>(),
  
  // Import results
  importedAssetIds: json("importedAssetIds").$type<number[]>(),
  importErrors: json("importErrors").$type<Array<{
    row: number;
    error: string;
  }>>(),
  
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
}, (table) => [
  index("assetImportJobs_organizationId_idx").on(table.organizationId),
  index("assetImportJobs_status_idx").on(table.status),
  index("assetImportJobs_createdAt_idx").on(table.createdAt),
]);
export type AssetImportJob = typeof assetImportJobs.$inferSelect;
export type InsertAssetImportJob = typeof assetImportJobs.$inferInsert;

/**
 * Asset import templates - saved column mappings for reuse
 */
export const assetImportTemplates = mysqlTable("assetImportTemplates", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Template info
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Target asset class
  targetAssetClass: varchar("targetAssetClass", { length: 100 }).notNull(),
  
  // Column mapping
  columnMapping: json("columnMapping").$type<Record<string, string>>().notNull(),
  
  // Expected columns (for validation)
  expectedColumns: json("expectedColumns").$type<string[]>(),
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("assetImportTemplates_organizationId_idx").on(table.organizationId),
]);
export type AssetImportTemplate = typeof assetImportTemplates.$inferSelect;
export type InsertAssetImportTemplate = typeof assetImportTemplates.$inferInsert;


/**
 * OAuth Accounts - Links external OAuth providers to users
 * Supports multiple providers per user for account linking
 */
// OAuth provider values
const oauthProviderValues = ["manus", "google", "github", "microsoft", "email"] as const;

export const oauthAccounts = mysqlTable("oauthAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Provider info - using explicit column name
  oauthProvider: mysqlEnum("oauthProvider", oauthProviderValues).notNull(),
  providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(), // External ID from provider
  
  // OAuth tokens (encrypted at rest)
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  
  // Provider-specific data
  providerEmail: varchar("providerEmail", { length: 320 }),
  providerName: varchar("providerName", { length: 255 }),
  providerAvatarUrl: text("providerAvatarUrl"),
  providerData: json("providerData").$type<Record<string, unknown>>(),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("oauthAccounts_userId_idx").on(table.userId),
  index("oauthAccounts_provider_providerAccountId_idx").on(table.oauthProvider, table.providerAccountId),
]);

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type InsertOAuthAccount = typeof oauthAccounts.$inferInsert;

/**
 * OAuth Provider Configurations - Admin-managed provider settings per organization
 * Allows each org to configure their own OAuth app credentials
 */
export const oauthProviderConfigs = mysqlTable("oauthProviderConfigs", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId"), // Null for global/default config
  
  // Provider - using explicit column name to match DB
  oauthProvider: mysqlEnum("oauthProvider", oauthProviderValues).notNull(),

  // OAuth credentials (encrypted)
  clientId: varchar("clientId", { length: 255 }).notNull(),
  clientSecret: text("clientSecret").notNull(), // Encrypted
  
  // OAuth URLs (for custom/enterprise setups)
  authorizationUrl: text("authorizationUrl"),
  tokenUrl: text("tokenUrl"),
  userInfoUrl: text("userInfoUrl"),
  
  // Scopes
  scopes: json("scopes").$type<string[]>(),
  
  // Status
  isEnabled: boolean("isEnabled").default(true).notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("oauthProviderConfigs_organizationId_idx").on(table.organizationId),
  index("oauthProviderConfigs_provider_idx").on(table.oauthProvider),
]);

export type OAuthProviderConfig = typeof oauthProviderConfigs.$inferSelect;
export type InsertOAuthProviderConfig = typeof oauthProviderConfigs.$inferInsert;

/**
 * Email Verification Tokens - For email/password signup flow
 */
export const emailVerificationTokens = mysqlTable("emailVerificationTokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  
  token: varchar("token", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 320 }).notNull(),
  
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("emailVerificationTokens_userId_idx").on(table.userId),
  index("emailVerificationTokens_token_idx").on(table.token),
]);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;




// Login Activity tracking for security
export const loginActivity = mysqlTable("loginActivity", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // Can be null for failed attempts with unknown user
  
  provider: varchar("provider", { length: 50 }).notNull(), // email, google, github, microsoft, manus
  ipAddress: varchar("ipAddress", { length: 45 }), // IPv6 max length
  userAgent: text("userAgent"),
  
  success: boolean("success").notNull().default(true),
  failureReason: varchar("failureReason", { length: 255 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("loginActivity_userId_idx").on(table.userId),
  index("loginActivity_createdAt_idx").on(table.createdAt),
]);
export type LoginActivity = typeof loginActivity.$inferSelect;
export type InsertLoginActivity = typeof loginActivity.$inferInsert;


// ============ AI GATEWAY TABLES ============

/**
 * AI Global Config - Superuser-only settings for AI routing
 * Only KIISHA superuser can modify these settings
 */
export const aiGlobalConfig = mysqlTable("aiGlobalConfig", {
  id: int("id").autoincrement().primaryKey(),
  
  activePolicyVersion: int("activePolicyVersion").default(1).notNull(),
  defaultProvider: varchar("defaultProvider", { length: 50 }).default("forge").notNull(),
  defaultModel: varchar("defaultModel", { length: 100 }).default("forge-default").notNull(),
  
  // JSON configuration for routing rules
  routingRules: json("routingRules").$type<Record<string, unknown>>(),
  fallbackRules: json("fallbackRules").$type<Record<string, unknown>>(),
  enabledProviders: json("enabledProviders").$type<string[]>(),
  
  // Retry configuration
  maxRetries: int("maxRetries").default(3).notNull(),
  initialDelayMs: int("initialDelayMs").default(1000).notNull(),
  maxDelayMs: int("maxDelayMs").default(10000).notNull(),
  
  updatedBySuperuserId: int("updatedBySuperuserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AIGlobalConfig = typeof aiGlobalConfig.$inferSelect;
export type InsertAIGlobalConfig = typeof aiGlobalConfig.$inferInsert;

/**
 * AI Provider Secrets - Encrypted API keys for AI providers
 * Only KIISHA superuser can manage these
 */
export const aiProviderSecrets = mysqlTable("aiProviderSecrets", {
  id: int("id").autoincrement().primaryKey(),
  
  provider: varchar("provider", { length: 50 }).notNull(), // openai, anthropic, azure_openai
  
  // Encrypted credentials
  encryptedApiKey: text("encryptedApiKey"),
  iv: varchar("iv", { length: 32 }),
  authTag: varchar("authTag", { length: 32 }),
  
  // Status
  status: mysqlEnum("status", ["enabled", "disabled", "invalid"]).default("disabled").notNull(),
  lastValidatedAt: timestamp("lastValidatedAt"),
  lastError: text("lastError"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("aiProviderSecrets_provider_idx").on(table.provider),
]);
export type AIProviderSecret = typeof aiProviderSecrets.$inferSelect;
export type InsertAIProviderSecret = typeof aiProviderSecrets.$inferInsert;

/**
 * Org AI Budget - Token allocation and consumption per organization
 * Orgs cannot select models; they only have budget/tokens
 */
export const orgAiBudget = mysqlTable("orgAiBudget", {
  id: int("id").autoincrement().primaryKey(),
  
  organizationId: int("organizationId").notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  
  allocatedTokens: int("allocatedTokens").default(1000000).notNull(), // Default 1M
  consumedTokens: int("consumedTokens").default(0).notNull(),
  
  softLimitPercent: int("softLimitPercent").default(80).notNull(),
  overageAllowed: boolean("overageAllowed").default(false).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("orgAiBudget_org_period_idx").on(table.organizationId, table.period),
]);
export type OrgAiBudget = typeof orgAiBudget.$inferSelect;
export type InsertOrgAiBudget = typeof orgAiBudget.$inferInsert;

/**
 * AI Usage Log - Detailed token usage tracking
 */
export const aiUsageLog = mysqlTable("aiUsageLog", {
  id: int("id").autoincrement().primaryKey(),
  
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  
  task: varchar("task", { length: 50 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  
  inputTokens: int("inputTokens").notNull(),
  outputTokens: int("outputTokens").notNull(),
  totalTokens: int("totalTokens").notNull(),
  estimatedCost: decimal("estimatedCost", { precision: 10, scale: 6 }),
  
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("aiUsageLog_org_period_idx").on(table.orgId, table.period),
  index("aiUsageLog_user_idx").on(table.userId),
  index("aiUsageLog_task_idx").on(table.task),
]);
export type AIUsageLog = typeof aiUsageLog.$inferSelect;
export type InsertAIUsageLog = typeof aiUsageLog.$inferInsert;

/**
 * AI Audit Log - Immutable audit trail for all AI operations
 */
export const aiAuditLog = mysqlTable("aiAuditLog", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  
  task: varchar("task", { length: 50 }).notNull(),
  userId: int("userId").notNull(),
  orgId: int("orgId").notNull(),
  channel: mysqlEnum("channel", ["web", "whatsapp", "email", "api"]).notNull(),
  correlationId: varchar("correlationId", { length: 36 }).notNull(),
  
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptVersionHash: varchar("promptVersionHash", { length: 16 }).notNull(),
  
  inputTokens: int("inputTokens").notNull(),
  outputTokens: int("outputTokens").notNull(),
  latencyMs: int("latencyMs").notNull(),
  
  success: boolean("success").notNull(),
  toolCalls: json("toolCalls").$type<Array<{ name: string; arguments: string; result?: string }>>(),
  outputSummary: text("outputSummary"),
  errorMessage: text("errorMessage"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("aiAuditLog_org_idx").on(table.orgId),
  index("aiAuditLog_user_idx").on(table.userId),
  index("aiAuditLog_correlationId_idx").on(table.correlationId),
  index("aiAuditLog_createdAt_idx").on(table.createdAt),
]);
export type AIAuditLog = typeof aiAuditLog.$inferSelect;
export type InsertAIAuditLog = typeof aiAuditLog.$inferInsert;

/**
 * Pending Confirmations - High-impact actions awaiting user confirmation
 */
export const pendingConfirmations = mysqlTable("pendingConfirmations", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID
  
  userId: int("userId").notNull(),
  orgId: int("orgId").notNull(),
  channel: mysqlEnum("channel", ["web", "whatsapp", "email", "api"]).notNull(),
  correlationId: varchar("correlationId", { length: 36 }).notNull(),
  
  actionType: varchar("actionType", { length: 50 }).notNull(),
  actionDescription: text("actionDescription").notNull(),
  payload: json("payload").$type<Record<string, unknown>>(), // Encrypted at rest
  
  expiresAt: timestamp("expiresAt").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "declined", "expired"]).default("pending").notNull(),
  
  resolvedAt: timestamp("resolvedAt"),
  resolvedBy: int("resolvedBy"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("pendingConfirmations_user_idx").on(table.userId),
  index("pendingConfirmations_status_idx").on(table.status),
  index("pendingConfirmations_expiresAt_idx").on(table.expiresAt),
]);
export type PendingConfirmation = typeof pendingConfirmations.$inferSelect;
export type InsertPendingConfirmation = typeof pendingConfirmations.$inferInsert;

/**
 * AI Tool Registry - Registered tools for AI agents
 */
export const aiToolRegistry = mysqlTable("aiToolRegistry", {
  id: int("id").autoincrement().primaryKey(),
  
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  
  // Tool configuration
  inputSchema: json("inputSchema").$type<Record<string, unknown>>().notNull(),
  requiredPermission: varchar("requiredPermission", { length: 50 }).notNull(),
  requiresConfirmation: boolean("requiresConfirmation").default(false).notNull(),
  
  // Allowed roles
  allowedRoles: json("allowedRoles").$type<string[]>().notNull(),
  
  // Status
  isActive: boolean("isActive").default(true).notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("aiToolRegistry_name_idx").on(table.name),
]);
export type AIToolRegistry = typeof aiToolRegistry.$inferSelect;
export type InsertAIToolRegistry = typeof aiToolRegistry.$inferInsert;

/**
 * AI Eval Results - Evaluation harness results for regression testing
 */
export const aiEvalResults = mysqlTable("aiEvalResults", {
  id: int("id").autoincrement().primaryKey(),
  
  runId: varchar("runId", { length: 36 }).notNull(), // UUID for the eval run
  task: varchar("task", { length: 50 }).notNull(),
  fixtureId: varchar("fixtureId", { length: 100 }).notNull(),
  
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptVersionHash: varchar("promptVersionHash", { length: 16 }).notNull(),
  
  // Metrics
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
  hallucinationRate: decimal("hallucinationRate", { precision: 5, scale: 4 }),
  latencyMs: int("latencyMs"),
  tokenCount: int("tokenCount"),
  
  // Results
  passed: boolean("passed").notNull(),
  expectedOutput: json("expectedOutput").$type<Record<string, unknown>>(),
  actualOutput: json("actualOutput").$type<Record<string, unknown>>(),
  errorDetails: text("errorDetails"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("aiEvalResults_runId_idx").on(table.runId),
  index("aiEvalResults_task_idx").on(table.task),
]);
export type AIEvalResult = typeof aiEvalResults.$inferSelect;
export type InsertAIEvalResult = typeof aiEvalResults.$inferInsert;


/**
 * Organization Auth Policies - controls allowed authentication methods per org
 */
export const orgAuthPolicies = mysqlTable("orgAuthPolicies", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().unique(),
  
  // Allowed authentication providers (JSON array of provider names)
  allowedProviders: json("allowedProviders").$type<string[]>(),
  
  // Require company email domain for email auth
  requireCompanyEmail: boolean("requireCompanyEmail").default(false),
  allowedEmailDomains: json("allowedEmailDomains").$type<string[]>(),
  
  // Require phone verification
  requirePhoneVerification: boolean("requirePhoneVerification").default(false),
  allowedPhoneCountries: json("allowedPhoneCountries").$type<string[]>(),
  
  // Social account linking restrictions
  allowSocialAccountLinking: boolean("allowSocialAccountLinking").default(true),
  maxLinkedAccounts: int("maxLinkedAccounts").default(5),
  
  // MFA requirements
  requireMfa: boolean("requireMfa").default(false),
  mfaMethods: json("mfaMethods").$type<("totp" | "sms" | "email")[]>(),
  
  // Session policies
  maxSessionDurationHours: int("maxSessionDurationHours").default(720), // 30 days
  idleTimeoutMinutes: int("idleTimeoutMinutes").default(60),
  
  // Password policies (for email auth)
  minPasswordLength: int("minPasswordLength").default(8),
  requirePasswordComplexity: boolean("requirePasswordComplexity").default(true),
  passwordExpiryDays: int("passwordExpiryDays"),
  
  // IP restrictions
  allowedIpRanges: json("allowedIpRanges").$type<string[]>(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type OrgAuthPolicy = typeof orgAuthPolicies.$inferSelect;
export type InsertOrgAuthPolicy = typeof orgAuthPolicies.$inferInsert;


// ============================================
// CUSTOMER PORTAL & BILLING MODULE
// ============================================

/**
 * Customers - External customers/clients who own assets
 * Separate from internal users (operations team)
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Customer identification
  code: varchar("code", { length: 50 }).notNull(), // Customer code (e.g., CUST-001)
  name: varchar("name", { length: 255 }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  
  // Contact info
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  
  // Billing info
  billingEmail: varchar("billingEmail", { length: 320 }),
  billingAddress: text("billingAddress"),
  taxId: varchar("taxId", { length: 50 }), // VAT/GST number
  currency: varchar("currency", { length: 3 }).default("USD"),
  paymentTermsDays: int("paymentTermsDays").default(30),
  
  // Stripe integration
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Customer Users - Portal login accounts for customers
 */
export const customerUsers = mysqlTable("customerUsers", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  
  // Auth
  email: varchar("email", { length: 320 }).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  
  // Profile
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  role: mysqlEnum("role", ["owner", "admin", "viewer"]).default("viewer").notNull(),
  
  // Email verification
  emailVerified: boolean("emailVerified").default(false),
  emailVerificationToken: varchar("emailVerificationToken", { length: 64 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  
  // Password reset
  passwordResetToken: varchar("passwordResetToken", { length: 64 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  
  // Session management
  lastLoginAt: timestamp("lastLoginAt"),
  lastLoginIp: varchar("lastLoginIp", { length: 45 }),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  
  // Notification preferences
  notifyInvoices: boolean("notifyInvoices").default(true),
  notifyPayments: boolean("notifyPayments").default(true),
  notifyReports: boolean("notifyReports").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  invitedBy: int("invitedBy"),
});
export type CustomerUser = typeof customerUsers.$inferSelect;
export type InsertCustomerUser = typeof customerUsers.$inferInsert;

/**
 * Customer Projects - Links customers to their assets/projects
 */
export const customerProjects = mysqlTable("customerProjects", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  projectId: int("projectId").notNull(),
  
  // Access level
  accessLevel: mysqlEnum("accessLevel", ["full", "limited", "reports_only"]).default("full").notNull(),
  
  // Contract details
  contractStartDate: timestamp("contractStartDate"),
  contractEndDate: timestamp("contractEndDate"),
  contractValue: decimal("contractValue", { precision: 15, scale: 2 }),
  
  // Billing
  billingCycle: mysqlEnum("billingCycle", ["monthly", "quarterly", "annually", "one_time"]).default("monthly"),
  nextBillingDate: timestamp("nextBillingDate"),
  
  // Status
  status: mysqlEnum("status", ["active", "paused", "terminated"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustomerProject = typeof customerProjects.$inferSelect;
export type InsertCustomerProject = typeof customerProjects.$inferInsert;

/**
 * Invoices - Customer invoices for billing
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  
  // Invoice identification
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull(),
  
  // Dates
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  paidDate: timestamp("paidDate"),
  
  // Amounts (in cents to avoid floating point issues)
  subtotal: int("subtotal").notNull(), // In cents
  taxAmount: int("taxAmount").default(0),
  discountAmount: int("discountAmount").default(0),
  totalAmount: int("totalAmount").notNull(), // In cents
  paidAmount: int("paidAmount").default(0), // In cents
  balanceDue: int("balanceDue").notNull(), // In cents
  
  // Currency
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Status
  status: mysqlEnum("status", ["draft", "sent", "viewed", "partial", "paid", "overdue", "cancelled", "refunded"]).default("draft").notNull(),
  
  // Stripe
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeHostedInvoiceUrl: text("stripeHostedInvoiceUrl"),
  stripePdfUrl: text("stripePdfUrl"),
  
  // Notes
  notes: text("notes"),
  termsAndConditions: text("termsAndConditions"),
  
  // PDF storage
  pdfUrl: text("pdfUrl"),
  pdfGeneratedAt: timestamp("pdfGeneratedAt"),
  
  // Reminders
  remindersSent: int("remindersSent").default(0),
  lastReminderAt: timestamp("lastReminderAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

/**
 * Invoice Line Items - Individual items on an invoice
 */
export const invoiceLineItems = mysqlTable("invoiceLineItems", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  
  // Item details
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: int("unitPrice").notNull(), // In cents
  amount: int("amount").notNull(), // In cents (quantity * unitPrice)
  
  // Tax
  taxRate: decimal("taxRate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: int("taxAmount").default(0),
  
  // Reference
  projectId: int("projectId"), // Optional link to project
  serviceType: varchar("serviceType", { length: 100 }), // e.g., "O&M", "Monitoring", "Consulting"
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  
  // Sort order
  sortOrder: int("sortOrder").default(0),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

/**
 * Payments - Payment records for invoices
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  invoiceId: int("invoiceId"),
  customerId: int("customerId").notNull(),
  
  // Payment details
  amount: int("amount").notNull(), // In cents
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Payment method
  paymentMethod: mysqlEnum("paymentMethod", ["card", "bank_transfer", "check", "cash", "other"]).default("card"),
  
  // Reference
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  
  // Stripe
  stripePaymentId: varchar("stripePaymentId", { length: 255 }),
  stripeChargeId: varchar("stripeChargeId", { length: 255 }),
  
  // Status
  status: mysqlEnum("status", ["pending", "processing", "succeeded", "failed", "refunded", "cancelled"]).default("pending").notNull(),
  failureReason: text("failureReason"),
  
  // Dates
  paymentDate: timestamp("paymentDate"),
  processedAt: timestamp("processedAt"),
  
  // Notes
  notes: text("notes"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  recordedBy: int("recordedBy"),
});
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Receivables Aging - Snapshot of outstanding receivables
 */
export const receivablesAging = mysqlTable("receivablesAging", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  
  // Snapshot date
  snapshotDate: timestamp("snapshotDate").notNull(),
  
  // Aging buckets (in cents)
  current: int("current").default(0), // Not yet due
  days1to30: int("days1to30").default(0),
  days31to60: int("days31to60").default(0),
  days61to90: int("days61to90").default(0),
  days91Plus: int("days91Plus").default(0),
  totalOutstanding: int("totalOutstanding").default(0),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ReceivablesAging = typeof receivablesAging.$inferSelect;
export type InsertReceivablesAging = typeof receivablesAging.$inferInsert;

/**
 * Payment Reminders - Scheduled and sent reminders
 */
export const paymentReminders = mysqlTable("paymentReminders", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  
  // Reminder details
  reminderType: mysqlEnum("reminderType", ["upcoming", "due", "overdue_7", "overdue_14", "overdue_30", "overdue_60", "final_notice"]).notNull(),
  
  // Delivery
  channel: mysqlEnum("channel", ["email", "sms", "whatsapp"]).default("email"),
  sentTo: varchar("sentTo", { length: 320 }),
  
  // Status
  status: mysqlEnum("status", ["scheduled", "sent", "delivered", "failed"]).default("scheduled").notNull(),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  failureReason: text("failureReason"),
  
  // Scheduled
  scheduledFor: timestamp("scheduledFor"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PaymentReminder = typeof paymentReminders.$inferSelect;
export type InsertPaymentReminder = typeof paymentReminders.$inferInsert;

// ============================================
// INVERTER API CONNECTORS
// ============================================

/**
 * Inverter Vendors - Supported inverter manufacturers
 */
export const inverterVendors = mysqlTable("inverterVendors", {
  id: int("id").autoincrement().primaryKey(),
  
  // Vendor info
  code: varchar("code", { length: 50 }).notNull().unique(), // e.g., "huawei", "sungrow", "sma"
  name: varchar("name", { length: 100 }).notNull(),
  
  // API details
  apiBaseUrl: text("apiBaseUrl"),
  apiVersion: varchar("apiVersion", { length: 20 }),
  authMethod: mysqlEnum("authMethod", ["api_key", "oauth2", "basic", "custom"]).default("api_key"),
  
  // Documentation
  docsUrl: text("docsUrl"),
  
  // Status
  status: mysqlEnum("status", ["active", "beta", "deprecated"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InverterVendor = typeof inverterVendors.$inferSelect;
export type InsertInverterVendor = typeof inverterVendors.$inferInsert;

/**
 * Inverter Connections - Configured connections to vendor APIs
 */
export const inverterConnections = mysqlTable("inverterConnections", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  vendorId: int("vendorId").notNull(),
  
  // Connection name
  name: varchar("name", { length: 255 }).notNull(),
  
  // Credentials (encrypted)
  credentials: json("credentials").$type<{
    apiKey?: string;
    apiSecret?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: string;
    plantId?: string;
    stationCode?: string;
  }>(),
  
  // Polling configuration
  pollingIntervalMinutes: int("pollingIntervalMinutes").default(15),
  lastPolledAt: timestamp("lastPolledAt"),
  nextPollAt: timestamp("nextPollAt"),
  
  // Status
  status: mysqlEnum("status", ["active", "paused", "error", "disconnected"]).default("active").notNull(),
  lastError: text("lastError"),
  lastErrorAt: timestamp("lastErrorAt"),
  consecutiveErrors: int("consecutiveErrors").default(0),
  
  // Stats
  totalDataPoints: int("totalDataPoints").default(0),
  lastSuccessfulPoll: timestamp("lastSuccessfulPoll"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type InverterConnection = typeof inverterConnections.$inferSelect;
export type InsertInverterConnection = typeof inverterConnections.$inferInsert;

/**
 * Inverter Devices - Individual inverters/devices linked to connections
 */
export const inverterDevices = mysqlTable("inverterDevices", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  projectId: int("projectId"), // Link to KIISHA project/asset
  
  // Device identification
  vendorDeviceId: varchar("vendorDeviceId", { length: 255 }).notNull(), // ID from vendor API
  serialNumber: varchar("serialNumber", { length: 100 }),
  model: varchar("model", { length: 100 }),
  
  // Device info
  name: varchar("name", { length: 255 }),
  deviceType: mysqlEnum("deviceType", ["inverter", "meter", "battery", "weather_station", "combiner_box", "other"]).default("inverter"),
  
  // Capacity
  ratedPowerKw: decimal("ratedPowerKw", { precision: 10, scale: 2 }),
  
  // Location
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // Status
  status: mysqlEnum("status", ["online", "offline", "fault", "unknown"]).default("unknown").notNull(),
  lastStatusUpdate: timestamp("lastStatusUpdate"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type InverterDevice = typeof inverterDevices.$inferSelect;
export type InsertInverterDevice = typeof inverterDevices.$inferInsert;

/**
 * Inverter Telemetry - Raw telemetry data from inverters
 */
export const inverterTelemetry = mysqlTable("inverterTelemetry", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: int("deviceId").notNull(),
  connectionId: int("connectionId").notNull(),
  
  // Timestamp
  timestamp: timestamp("timestamp").notNull(),
  
  // Power metrics
  activePowerKw: decimal("activePowerKw", { precision: 10, scale: 3 }),
  reactivePowerKvar: decimal("reactivePowerKvar", { precision: 10, scale: 3 }),
  apparentPowerKva: decimal("apparentPowerKva", { precision: 10, scale: 3 }),
  powerFactor: decimal("powerFactor", { precision: 5, scale: 3 }),
  
  // Energy metrics
  dailyEnergyKwh: decimal("dailyEnergyKwh", { precision: 15, scale: 3 }),
  totalEnergyKwh: decimal("totalEnergyKwh", { precision: 15, scale: 3 }),
  
  // Voltage/Current
  dcVoltage: decimal("dcVoltage", { precision: 10, scale: 2 }),
  dcCurrent: decimal("dcCurrent", { precision: 10, scale: 2 }),
  acVoltage: decimal("acVoltage", { precision: 10, scale: 2 }),
  acCurrent: decimal("acCurrent", { precision: 10, scale: 2 }),
  frequency: decimal("frequency", { precision: 5, scale: 2 }),
  
  // Environmental
  irradiance: decimal("irradiance", { precision: 10, scale: 2 }), // W/m²
  moduleTemperature: decimal("moduleTemperature", { precision: 5, scale: 2 }),
  ambientTemperature: decimal("ambientTemperature", { precision: 5, scale: 2 }),
  
  // Status
  operatingStatus: varchar("operatingStatus", { length: 50 }),
  alarmCodes: json("alarmCodes").$type<string[]>(),
  
  // Raw data
  rawData: json("rawData").$type<Record<string, unknown>>(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type InverterTelemetry = typeof inverterTelemetry.$inferSelect;
export type InsertInverterTelemetry = typeof inverterTelemetry.$inferInsert;


// ============================================
// PRD CANONICAL MODEL - CUSTOMER PORTAL
// ============================================

/**
 * Client Accounts - Canonical entity for portal clients
 * Supports multi-org clients (can have scope grants across multiple organizations)
 * This is the security boundary for portal access
 */
export const clientAccounts = mysqlTable("clientAccounts", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identity
  code: varchar("code", { length: 50 }).notNull().unique(), // CLIENT-001
  name: varchar("name", { length: 255 }).notNull(), // Display name
  legalName: varchar("legalName", { length: 500 }), // Legal entity name
  
  // Contact
  primaryEmail: varchar("primaryEmail", { length: 320 }),
  billingEmail: varchar("billingEmail", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  
  // Address
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  
  // Billing
  taxId: varchar("taxId", { length: 50 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  paymentTermsDays: int("paymentTermsDays").default(30),
  
  // Stripe
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  
  // Portal branding (optional override)
  brandingConfig: json("brandingConfig").$type<{
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  }>(),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "suspended"]).default("active").notNull(),
  
  // Notes
  notes: text("notes"),
  
  // Legacy link (for migration)
  legacyCustomerId: int("legacyCustomerId"), // Links to old customers table
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type ClientAccount = typeof clientAccounts.$inferSelect;
export type InsertClientAccount = typeof clientAccounts.$inferInsert;

/**
 * Portal Users - Login accounts for client portal
 * Linked to client accounts via memberships (many-to-many)
 */
export const portalUsers = mysqlTable("portalUsers", {
  id: int("id").autoincrement().primaryKey(),
  
  // Auth
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  
  // Magic link auth
  magicLinkToken: varchar("magicLinkToken", { length: 64 }),
  magicLinkExpires: timestamp("magicLinkExpires"),
  
  // MFA
  mfaEnabled: boolean("mfaEnabled").default(false),
  mfaSecret: varchar("mfaSecret", { length: 255 }),
  mfaBackupCodes: json("mfaBackupCodes").$type<string[]>(),
  
  // Profile
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  avatarUrl: text("avatarUrl"),
  timezone: varchar("timezone", { length: 50 }),
  locale: varchar("locale", { length: 10 }).default("en"),
  
  // Email verification
  emailVerified: boolean("emailVerified").default(false),
  emailVerificationToken: varchar("emailVerificationToken", { length: 64 }),
  emailVerificationExpires: timestamp("emailVerificationExpires"),
  
  // Password reset
  passwordResetToken: varchar("passwordResetToken", { length: 64 }),
  passwordResetExpires: timestamp("passwordResetExpires"),
  
  // Session management
  lastLoginAt: timestamp("lastLoginAt"),
  lastLoginIp: varchar("lastLoginIp", { length: 45 }),
  failedLoginAttempts: int("failedLoginAttempts").default(0),
  lockedUntil: timestamp("lockedUntil"),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "suspended", "pending_verification"]).default("pending_verification").notNull(),
  
  // Notification preferences
  notifyInvoices: boolean("notifyInvoices").default(true),
  notifyPayments: boolean("notifyPayments").default(true),
  notifyReports: boolean("notifyReports").default(true),
  notifyAlerts: boolean("notifyAlerts").default(true),
  
  // Legacy link (for migration)
  legacyCustomerUserId: int("legacyCustomerUserId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  invitedBy: int("invitedBy"),
});
export type PortalUser = typeof portalUsers.$inferSelect;
export type InsertPortalUser = typeof portalUsers.$inferInsert;

/**
 * Client Account Memberships - Links portal users to client accounts with roles
 * Supports users belonging to multiple client accounts
 */
export const clientAccountMemberships = mysqlTable("clientAccountMemberships", {
  id: int("id").autoincrement().primaryKey(),
  clientAccountId: int("clientAccountId").notNull(),
  portalUserId: int("portalUserId").notNull(),
  
  // Role within this client account
  role: mysqlEnum("role", ["CLIENT_ADMIN", "FINANCE", "OPS", "VIEWER"]).default("VIEWER").notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  grantedBy: int("grantedBy"),
}, (table) => ({
  uniqueMembership: unique().on(table.clientAccountId, table.portalUserId),
}));
export type ClientAccountMembership = typeof clientAccountMemberships.$inferSelect;
export type InsertClientAccountMembership = typeof clientAccountMemberships.$inferInsert;

/**
 * Client Scope Grants - Defines what a client account can access
 * VIEW-first model: grants are explicit, not implicit
 */
export const clientScopeGrants = mysqlTable("clientScopeGrants", {
  id: int("id").autoincrement().primaryKey(),
  clientAccountId: int("clientAccountId").notNull(),
  
  // Grant type determines what targetId refers to
  grantType: mysqlEnum("grantType", ["VIEW", "PROJECT", "SITE", "ASSET"]).notNull(),
  
  // Organization context (required for all grants)
  orgId: int("orgId").notNull(),
  
  // Target ID (interpretation depends on grantType)
  // VIEW: targetId is a custom view ID
  // PROJECT: targetId is a project ID
  // SITE: targetId is a site ID
  // ASSET: targetId is an asset ID
  targetId: int("targetId").notNull(),
  
  // Access level for this grant
  accessLevel: mysqlEnum("accessLevel", ["full", "limited", "reports_only"]).default("full").notNull(),
  
  // Field policy (what fields are visible)
  fieldPolicyId: int("fieldPolicyId"),
  
  // Contract details
  contractStartDate: timestamp("contractStartDate"),
  contractEndDate: timestamp("contractEndDate"),
  contractValue: decimal("contractValue", { precision: 15, scale: 2 }),
  
  // Billing
  billingCycle: mysqlEnum("billingCycle", ["monthly", "quarterly", "annually", "one_time"]),
  nextBillingDate: timestamp("nextBillingDate"),
  
  // Status
  status: mysqlEnum("status", ["active", "paused", "terminated", "expired"]).default("active").notNull(),
  
  // Legacy link (for migration)
  legacyCustomerProjectId: int("legacyCustomerProjectId"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  grantedBy: int("grantedBy"),
}, (table) => ({
  uniqueGrant: unique("csg_unique_grant").on(table.clientAccountId, table.grantType, table.orgId, table.targetId),
  orgIdx: index("client_scope_grants_org_idx").on(table.orgId),
  clientIdx: index("client_scope_grants_client_idx").on(table.clientAccountId),
}));
export type ClientScopeGrant = typeof clientScopeGrants.$inferSelect;
export type InsertClientScopeGrant = typeof clientScopeGrants.$inferInsert;

/**
 * Portal Field Policies - Defines which fields are visible in portal views
 * Allowlist approach: only explicitly listed fields are shown
 */
export const portalFieldPolicies = mysqlTable("portalFieldPolicies", {
  id: int("id").autoincrement().primaryKey(),
  
  // Identity
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  
  // Scope (optional - if null, applies globally)
  orgId: int("orgId"),
  
  // Field allowlist by entity type
  allowedFields: json("allowedFields").$type<{
    invoice?: string[];      // e.g., ["invoiceNumber", "totalAmount", "status", "dueDate"]
    project?: string[];      // e.g., ["name", "capacity", "status"]
    site?: string[];         // e.g., ["name", "location", "capacity"]
    asset?: string[];        // e.g., ["name", "type", "status"]
    measurement?: string[];  // e.g., ["timestamp", "activePowerKw", "dailyEnergyKwh"]
    workOrder?: string[];    // e.g., ["title", "status", "priority", "dueDate"]
    document?: string[];     // e.g., ["name", "type", "uploadedAt"]
  }>().notNull(),
  
  // Metrics allowlist (for monitoring dashboard)
  allowedMetrics: json("allowedMetrics").$type<string[]>(), // e.g., ["production", "revenue", "uptime"]
  
  // Status
  isDefault: boolean("isDefault").default(false),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
});
export type PortalFieldPolicy = typeof portalFieldPolicies.$inferSelect;
export type InsertPortalFieldPolicy = typeof portalFieldPolicies.$inferInsert;

/**
 * Portal Notifications - Notifications sent to portal users
 */
export const portalNotifications = mysqlTable("portalNotifications", {
  id: int("id").autoincrement().primaryKey(),
  portalUserId: int("portalUserId").notNull(),
  clientAccountId: int("clientAccountId"),
  
  // Notification content
  type: mysqlEnum("type", [
    "invoice_created", "invoice_due", "invoice_overdue", "invoice_paid",
    "payment_received", "payment_failed",
    "report_available", "document_shared",
    "work_order_created", "work_order_updated", "work_order_completed",
    "alert_triggered", "alert_resolved",
    "system_announcement"
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  
  // Link to related entity
  entityType: varchar("entityType", { length: 50 }), // invoice, payment, report, etc.
  entityId: int("entityId"),
  
  // Delivery
  channel: mysqlEnum("channel", ["in_app", "email", "sms", "push"]).default("in_app").notNull(),
  sentAt: timestamp("sentAt"),
  deliveredAt: timestamp("deliveredAt"),
  
  // Status
  readAt: timestamp("readAt"),
  dismissedAt: timestamp("dismissedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("portal_notifications_user_idx").on(table.portalUserId),
  unreadIdx: index("portal_notifications_unread_idx").on(table.portalUserId, table.readAt),
}));
export type PortalNotification = typeof portalNotifications.$inferSelect;
export type InsertPortalNotification = typeof portalNotifications.$inferInsert;

/**
 * Portal Uploads - Files uploaded by portal users
 * Routes to Artifact pipeline for processing
 */
export const portalUploads = mysqlTable("portalUploads", {
  id: int("id").autoincrement().primaryKey(),
  portalUserId: int("portalUserId").notNull(),
  clientAccountId: int("clientAccountId").notNull(),
  
  // Upload context
  uploadType: mysqlEnum("uploadType", [
    "meter_photo", "meter_reading", "site_photo", "document",
    "work_order_attachment", "ticket_attachment", "other"
  ]).notNull(),
  
  // Related entity (optional)
  entityType: varchar("entityType", { length: 50 }), // work_order, ticket, site, etc.
  entityId: int("entityId"),
  
  // File info
  originalFilename: varchar("originalFilename", { length: 500 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  fileHash: varchar("fileHash", { length: 64 }), // SHA-256
  
  // Artifact pipeline integration
  artifactId: int("artifactId"), // Links to artifacts table after processing
  processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "processed", "failed"]).default("pending"),
  processingError: text("processingError"),
  
  // Metadata
  description: text("description"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("portal_uploads_user_idx").on(table.portalUserId),
  clientIdx: index("portal_uploads_client_idx").on(table.clientAccountId),
  artifactIdx: index("portal_uploads_artifact_idx").on(table.artifactId),
}));
export type PortalUpload = typeof portalUploads.$inferSelect;
export type InsertPortalUpload = typeof portalUploads.$inferInsert;

/**
 * Portal Work Orders - Work orders created by portal users
 * Sanitized version of internal work orders
 */
export const portalWorkOrders = mysqlTable("portalWorkOrders", {
  id: int("id").autoincrement().primaryKey(),
  clientAccountId: int("clientAccountId").notNull(),
  portalUserId: int("portalUserId").notNull(),
  
  // Scope grant context
  scopeGrantId: int("scopeGrantId").notNull(), // Which grant this relates to
  
  // Work order details (customer-visible)
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "maintenance_request", "issue_report", "meter_reading",
    "site_inspection", "documentation_request", "billing_inquiry", "other"
  ]).notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium"),
  
  // Status (customer-visible)
  status: mysqlEnum("status", [
    "submitted", "acknowledged", "in_progress", "pending_customer", "completed", "cancelled"
  ]).default("submitted").notNull(),
  
  // Internal work order link (created by operations team)
  internalWorkOrderId: int("internalWorkOrderId"),
  
  // Dates
  requestedDate: timestamp("requestedDate"),
  acknowledgedAt: timestamp("acknowledgedAt"),
  completedAt: timestamp("completedAt"),
  
  // Resolution (customer-visible summary)
  resolutionSummary: text("resolutionSummary"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  clientIdx: index("portal_work_orders_client_idx").on(table.clientAccountId),
  statusIdx: index("portal_work_orders_status_idx").on(table.status),
}));
export type PortalWorkOrder = typeof portalWorkOrders.$inferSelect;
export type InsertPortalWorkOrder = typeof portalWorkOrders.$inferInsert;

/**
 * Portal Work Order Comments - Customer comments on work orders
 * Sanitized: no internal notes visible
 */
export const portalWorkOrderComments = mysqlTable("portalWorkOrderComments", {
  id: int("id").autoincrement().primaryKey(),
  portalWorkOrderId: int("portalWorkOrderId").notNull(),
  
  // Author
  authorType: mysqlEnum("authorType", ["customer", "operator"]).notNull(),
  portalUserId: int("portalUserId"), // If customer
  operatorUserId: int("operatorUserId"), // If operator (internal user)
  authorName: varchar("authorName", { length: 255 }), // Display name
  
  // Comment content (sanitized - no internal notes)
  content: text("content").notNull(),
  
  // Attachments
  attachmentIds: json("attachmentIds").$type<number[]>(), // Links to portalUploads
  
  // Status
  isEdited: boolean("isEdited").default(false),
  editedAt: timestamp("editedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  workOrderIdx: index("portal_wo_comments_wo_idx").on(table.portalWorkOrderId),
}));
export type PortalWorkOrderComment = typeof portalWorkOrderComments.$inferSelect;
export type InsertPortalWorkOrderComment = typeof portalWorkOrderComments.$inferInsert;


// ============================================================================
// GRAFANA INTEGRATION TABLES
// Multi-tenant Grafana-as-a-Service for KIISHA
// ============================================================================

/**
 * Grafana Instances - Central Grafana deployment configuration
 * Supports single deployment with multiple Grafana orgs for isolation
 */
export const grafanaInstances = mysqlTable("grafanaInstances", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 500 }).notNull(),
  
  // Status
  status: mysqlEnum("status", ["active", "maintenance", "offline"]).default("active").notNull(),
  
  // Admin auth (encrypted service account token)
  adminTokenEncrypted: text("adminTokenEncrypted"),
  
  // Default Grafana org for bootstrap operations
  defaultGrafanaOrgId: int("defaultGrafanaOrgId"),
  
  // Health check
  lastHealthCheck: timestamp("lastHealthCheck"),
  healthStatus: mysqlEnum("healthStatus", ["healthy", "degraded", "unhealthy"]).default("healthy"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GrafanaInstance = typeof grafanaInstances.$inferSelect;
export type InsertGrafanaInstance = typeof grafanaInstances.$inferInsert;

/**
 * Grafana Orgs - One Grafana org per KIISHA organization
 * Provides strongest isolation within single Grafana deployment
 */
export const grafanaOrgs = mysqlTable("grafanaOrgs", {
  id: int("id").autoincrement().primaryKey(),
  grafanaInstanceId: int("grafanaInstanceId").notNull(),
  kiishaOrgId: int("kiishaOrgId").notNull(),
  
  // Grafana org details
  grafanaOrgId: int("grafanaOrgId").notNull(), // Grafana's internal org ID
  name: varchar("name", { length: 255 }).notNull(),
  
  // Per-org service account token (encrypted)
  serviceAccountTokenEncrypted: text("serviceAccountTokenEncrypted"),
  serviceAccountId: int("serviceAccountId"), // Grafana service account ID
  
  // Token rotation tracking
  tokenCreatedAt: timestamp("tokenCreatedAt"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  tokenRotationDue: timestamp("tokenRotationDue"),
  
  // Status
  status: mysqlEnum("status", ["active", "suspended", "archived"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  kiishaOrgIdx: index("grafana_orgs_kiisha_org_idx").on(table.kiishaOrgId),
  uniqueKiishaOrg: index("grafana_orgs_unique_kiisha").on(table.grafanaInstanceId, table.kiishaOrgId),
}));
export type GrafanaOrg = typeof grafanaOrgs.$inferSelect;
export type InsertGrafanaOrg = typeof grafanaOrgs.$inferInsert;

/**
 * Grafana Data Sources - Per-org datasource configuration
 * Each KIISHA org has its own datasource with scoped credentials
 */
export const grafanaDataSources = mysqlTable("grafanaDataSources", {
  id: int("id").autoincrement().primaryKey(),
  grafanaOrgsId: int("grafanaOrgsId").notNull(),
  
  // Grafana datasource details
  datasourceUid: varchar("datasourceUid", { length: 64 }).notNull(),
  datasourceId: int("datasourceId"), // Grafana's internal datasource ID
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["mysql", "prometheus", "influxdb", "timescale"]).default("mysql").notNull(),
  
  // Configuration
  isDefault: boolean("isDefault").default(false),
  isReadOnly: boolean("isReadOnly").default(true),
  
  // Connection details (encrypted if sensitive)
  connectionConfigEncrypted: text("connectionConfigEncrypted"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  grafanaOrgsIdx: index("grafana_ds_orgs_idx").on(table.grafanaOrgsId),
}));
export type GrafanaDataSource = typeof grafanaDataSources.$inferSelect;
export type InsertGrafanaDataSource = typeof grafanaDataSources.$inferInsert;

/**
 * Grafana Folders - Organize dashboards by org, project, or client
 */
export const grafanaFolders = mysqlTable("grafanaFolders", {
  id: int("id").autoincrement().primaryKey(),
  grafanaOrgsId: int("grafanaOrgsId").notNull(),
  
  // Optional scoping (one of these should be set)
  kiishaOrgId: int("kiishaOrgId"), // For internal org folders
  clientAccountId: int("clientAccountId"), // For portal client folders
  projectId: int("projectId"), // For project-specific folders
  
  // Grafana folder details
  folderUid: varchar("folderUid", { length: 64 }).notNull(),
  folderId: int("folderId"), // Grafana's internal folder ID
  name: varchar("name", { length: 255 }).notNull(),
  
  // Folder type
  folderType: mysqlEnum("folderType", ["org_root", "operations", "finance", "portal", "project"]).default("org_root").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  grafanaOrgsIdx: index("grafana_folders_orgs_idx").on(table.grafanaOrgsId),
  clientIdx: index("grafana_folders_client_idx").on(table.clientAccountId),
}));
export type GrafanaFolder = typeof grafanaFolders.$inferSelect;
export type InsertGrafanaFolder = typeof grafanaFolders.$inferInsert;

/**
 * Grafana Dashboards - Dashboard metadata and template tracking
 */
export const grafanaDashboards = mysqlTable("grafanaDashboards", {
  id: int("id").autoincrement().primaryKey(),
  grafanaFolderId: int("grafanaFolderId").notNull(),
  
  // Grafana dashboard details
  dashboardUid: varchar("dashboardUid", { length: 64 }).notNull(),
  dashboardId: int("dashboardId"), // Grafana's internal dashboard ID
  name: varchar("name", { length: 255 }).notNull(),
  
  // Dashboard classification
  dashboardType: mysqlEnum("dashboardType", [
    "portfolio_overview",
    "site_performance", 
    "device_health",
    "invoice_aging",
    "collections",
    "portal_summary",
    "portal_production",
    "noc_realtime",
    "custom"
  ]).notNull(),
  
  // Template tracking for versioned updates
  templateKey: varchar("templateKey", { length: 100 }), // Maps to /grafana/templates/*.json
  templateVersion: int("templateVersion").default(1),
  
  // Dashboard version in Grafana
  grafanaVersion: int("grafanaVersion").default(1),
  
  // Status
  status: mysqlEnum("status", ["active", "archived", "draft"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  folderIdx: index("grafana_dashboards_folder_idx").on(table.grafanaFolderId),
  uidIdx: index("grafana_dashboards_uid_idx").on(table.dashboardUid),
}));
export type GrafanaDashboard = typeof grafanaDashboards.$inferSelect;
export type InsertGrafanaDashboard = typeof grafanaDashboards.$inferInsert;

/**
 * Grafana Dashboard Bindings - Link dashboards to KIISHA entities
 * Controls what data a dashboard can access
 */
export const grafanaDashboardBindings = mysqlTable("grafanaDashboardBindings", {
  id: int("id").autoincrement().primaryKey(),
  grafanaDashboardId: int("grafanaDashboardId").notNull(),
  
  // Binding type and target
  bindingType: mysqlEnum("bindingType", [
    "org",
    "project", 
    "site",
    "asset",
    "client_account",
    "portal_view"
  ]).notNull(),
  bindingId: int("bindingId").notNull(), // ID of the bound entity
  
  // Scope payload for query filtering
  scopePayload: json("scopePayload").$type<{
    allowedOrgIds?: number[];
    allowedProjectIds?: number[];
    allowedSiteIds?: number[];
    allowedAssetIds?: number[];
    allowedMetrics?: string[];
    timezone?: string;
  }>(),
  
  // Field policy for portal-safe filtering
  fieldPolicyId: int("fieldPolicyId"), // Links to portalFieldPolicies
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  dashboardIdx: index("grafana_bindings_dashboard_idx").on(table.grafanaDashboardId),
  bindingIdx: index("grafana_bindings_binding_idx").on(table.bindingType, table.bindingId),
}));
export type GrafanaDashboardBinding = typeof grafanaDashboardBindings.$inferSelect;
export type InsertGrafanaDashboardBinding = typeof grafanaDashboardBindings.$inferInsert;

/**
 * Grafana Embed Tokens - Short-lived tokens for portal embedding
 * Tokens are stored hashed only for security
 */
export const grafanaEmbedTokens = mysqlTable("grafanaEmbedTokens", {
  id: int("id").autoincrement().primaryKey(),
  
  // Token (stored as hash only)
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  
  // Dashboard being accessed
  grafanaDashboardUid: varchar("grafanaDashboardUid", { length: 64 }).notNull(),
  
  // Subject (who requested the embed)
  subjectType: mysqlEnum("subjectType", ["user", "portal_user"]).notNull(),
  subjectId: int("subjectId").notNull(),
  
  // Scope payload injected into dashboard queries
  scopePayload: json("scopePayload").$type<{
    allowedOrgIds?: number[];
    allowedProjectIds?: number[];
    allowedSiteIds?: number[];
    allowedAssetIds?: number[];
    allowedMetrics?: string[];
    timezone?: string;
  }>(),
  
  // Token lifecycle
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"), // First use
  useCount: int("useCount").default(0),
  maxUses: int("maxUses").default(1), // Single-use by default
  
  // Status
  status: mysqlEnum("status", ["active", "used", "expired", "revoked"]).default("active").notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }), // Request IP
  userAgent: text("userAgent"), // Request user agent
}, (table) => ({
  tokenHashIdx: index("grafana_embed_token_hash_idx").on(table.tokenHash),
  subjectIdx: index("grafana_embed_subject_idx").on(table.subjectType, table.subjectId),
  expiresIdx: index("grafana_embed_expires_idx").on(table.expiresAt),
}));
export type GrafanaEmbedToken = typeof grafanaEmbedTokens.$inferSelect;
export type InsertGrafanaEmbedToken = typeof grafanaEmbedTokens.$inferInsert;

/**
 * Grafana Alert Ingestions - Append-only log of all received Grafana alerts
 * Supports idempotency via fingerprint + time window
 */
export const grafanaAlertIngestions = mysqlTable("grafanaAlertIngestions", {
  id: int("id").autoincrement().primaryKey(),
  
  // Source identification
  kiishaOrgId: int("kiishaOrgId").notNull(),
  grafanaOrgId: int("grafanaOrgId"),
  
  // Alert identification
  dashboardUid: varchar("dashboardUid", { length: 64 }),
  ruleUid: varchar("ruleUid", { length: 64 }),
  alertUid: varchar("alertUid", { length: 64 }),
  
  // Idempotency key (fingerprint from Grafana)
  fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
  
  // Raw payload (for audit and debugging)
  payloadJson: json("payloadJson").$type<Record<string, unknown>>(),
  
  // Processing status
  status: mysqlEnum("status", ["received", "deduped", "processed", "rejected"]).default("received").notNull(),
  rejectionReason: text("rejectionReason"),
  
  // Linked KIISHA entities created from this alert
  linkedAlertEventId: int("linkedAlertEventId"),
  linkedWorkOrderId: int("linkedWorkOrderId"),
  linkedObligationId: int("linkedObligationId"),
  
  // Timestamps
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
}, (table) => ({
  orgIdx: index("grafana_alert_ing_org_idx").on(table.kiishaOrgId),
  fingerprintIdx: index("grafana_alert_ing_fp_idx").on(table.fingerprint, table.receivedAt),
  statusIdx: index("grafana_alert_ing_status_idx").on(table.status),
}));
export type GrafanaAlertIngestion = typeof grafanaAlertIngestions.$inferSelect;
export type InsertGrafanaAlertIngestion = typeof grafanaAlertIngestions.$inferInsert;

/**
 * Grafana Alert Policies - Rules for processing Grafana alerts into KIISHA actions
 */
export const grafanaAlertPolicies = mysqlTable("grafanaAlertPolicies", {
  id: int("id").autoincrement().primaryKey(),
  kiishaOrgId: int("kiishaOrgId").notNull(),
  
  // Scope for this policy
  scopeType: mysqlEnum("scopeType", ["org", "project", "site", "asset", "tag"]).default("org").notNull(),
  scopeId: int("scopeId"), // ID of the scoped entity (null for org-wide)
  
  // Rule matching (labels/annotations from Grafana alert)
  ruleMatch: json("ruleMatch").$type<{
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    alertName?: string;
    severity?: string[];
  }>(),
  
  // Action to take when matched
  action: mysqlEnum("action", [
    "create_alert_event",
    "create_work_order", 
    "create_obligation",
    "notify_only",
    "ignore"
  ]).default("create_alert_event").notNull(),
  
  // Severity mapping
  severityMap: json("severityMap").$type<{
    critical?: string;
    high?: string;
    medium?: string;
    low?: string;
    info?: string;
  }>(),
  
  // Notification settings
  notifyChannels: json("notifyChannels").$type<{
    email?: string[];
    slack?: string[];
    webhook?: string[];
  }>(),
  
  // Priority for policy evaluation (higher = evaluated first)
  priority: int("priority").default(0),
  
  // Status
  enabled: boolean("enabled").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("grafana_alert_pol_org_idx").on(table.kiishaOrgId),
  scopeIdx: index("grafana_alert_pol_scope_idx").on(table.scopeType, table.scopeId),
}));
export type GrafanaAlertPolicy = typeof grafanaAlertPolicies.$inferSelect;
export type InsertGrafanaAlertPolicy = typeof grafanaAlertPolicies.$inferInsert;

/**
 * Grafana Provisioning Jobs - Track idempotent provisioning operations
 */
export const grafanaProvisioningJobs = mysqlTable("grafanaProvisioningJobs", {
  id: int("id").autoincrement().primaryKey(),
  
  // Job type
  jobType: mysqlEnum("jobType", [
    "org_bootstrap",
    "project_provision",
    "client_provision",
    "token_rotation",
    "dashboard_update"
  ]).notNull(),
  
  // Target entity
  targetType: mysqlEnum("targetType", ["org", "project", "client_account"]).notNull(),
  targetId: int("targetId").notNull(),
  
  // Idempotency key
  idempotencyKey: varchar("idempotencyKey", { length: 255 }).notNull(),
  
  // Status
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "skipped"]).default("pending").notNull(),
  
  // Results
  resultPayload: json("resultPayload").$type<{
    grafanaOrgId?: number;
    foldersCreated?: number;
    dashboardsCreated?: number;
    datasourcesCreated?: number;
    errors?: string[];
  }>(),
  errorMessage: text("errorMessage"),
  
  // Timing
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  
  // Retry tracking
  attemptCount: int("attemptCount").default(0),
  lastAttemptAt: timestamp("lastAttemptAt"),
  nextRetryAt: timestamp("nextRetryAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  triggeredBy: int("triggeredBy"), // User who triggered the job
}, (table) => ({
  idempotencyIdx: index("grafana_prov_idem_idx").on(table.idempotencyKey),
  targetIdx: index("grafana_prov_target_idx").on(table.targetType, table.targetId),
  statusIdx: index("grafana_prov_status_idx").on(table.status),
}));
export type GrafanaProvisioningJob = typeof grafanaProvisioningJobs.$inferSelect;
export type InsertGrafanaProvisioningJob = typeof grafanaProvisioningJobs.$inferInsert;

/**
 * Grafana Audit Log - Immutable log of all Grafana-related operations
 */
export const grafanaAuditLog = mysqlTable("grafanaAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // Event type
  eventType: mysqlEnum("eventType", [
    "dashboard_created",
    "dashboard_updated",
    "dashboard_deleted",
    "folder_created",
    "folder_deleted",
    "datasource_created",
    "embed_token_created",
    "embed_token_used",
    "embed_token_expired",
    "alert_received",
    "alert_processed",
    "org_provisioned",
    "token_rotated"
  ]).notNull(),
  
  // Actor
  actorType: mysqlEnum("actorType", ["user", "portal_user", "system", "webhook"]).notNull(),
  actorId: int("actorId"),
  
  // Target
  targetType: varchar("targetType", { length: 50 }), // e.g., "dashboard", "folder", "token"
  targetId: varchar("targetId", { length: 100 }), // UID or ID
  
  // Context
  kiishaOrgId: int("kiishaOrgId"),
  grafanaOrgId: int("grafanaOrgId"),
  
  // Event details
  details: json("details").$type<Record<string, unknown>>(),
  
  // Request context
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  correlationId: varchar("correlationId", { length: 64 }), // For tracing
  
  // Timestamp (immutable)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  eventTypeIdx: index("grafana_audit_event_idx").on(table.eventType),
  actorIdx: index("grafana_audit_actor_idx").on(table.actorType, table.actorId),
  orgIdx: index("grafana_audit_org_idx").on(table.kiishaOrgId),
  createdIdx: index("grafana_audit_created_idx").on(table.createdAt),
}));
export type GrafanaAuditLog = typeof grafanaAuditLog.$inferSelect;
export type InsertGrafanaAuditLog = typeof grafanaAuditLog.$inferInsert;


// ============================================================================
// INVOICE BRANDING SETTINGS
// Configurable branding for invoice PDFs
// ============================================================================

/**
 * Invoice Branding Settings - Company branding for invoice PDFs
 * One record per organization for multi-tenant support
 */
export const invoiceBrandingSettings = mysqlTable("invoiceBrandingSettings", {
  id: int("id").autoincrement().primaryKey(),
  
  // Organization scope (null = default/global settings)
  organizationId: int("organizationId"),
  
  // Company Information
  companyName: varchar("companyName", { length: 255 }),
  companyAddress: text("companyAddress"),
  companyCity: varchar("companyCity", { length: 100 }),
  companyState: varchar("companyState", { length: 100 }),
  companyPostalCode: varchar("companyPostalCode", { length: 20 }),
  companyCountry: varchar("companyCountry", { length: 100 }),
  companyEmail: varchar("companyEmail", { length: 320 }),
  companyPhone: varchar("companyPhone", { length: 50 }),
  companyWebsite: varchar("companyWebsite", { length: 255 }),
  taxId: varchar("taxId", { length: 100 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  
  // Logo & Branding
  logoUrl: text("logoUrl"),
  logoWidth: int("logoWidth").default(200), // px
  logoHeight: int("logoHeight").default(60), // px
  primaryColor: varchar("primaryColor", { length: 7 }).default("#f97316"), // Hex color
  secondaryColor: varchar("secondaryColor", { length: 7 }).default("#1e293b"),
  accentColor: varchar("accentColor", { length: 7 }).default("#3b82f6"),
  
  // Typography
  fontFamily: varchar("fontFamily", { length: 100 }).default("Inter"),
  headerFontSize: int("headerFontSize").default(24),
  bodyFontSize: int("bodyFontSize").default(10),
  
  // Bank Details
  bankName: varchar("bankName", { length: 255 }),
  bankAccountName: varchar("bankAccountName", { length: 255 }),
  bankAccountNumber: varchar("bankAccountNumber", { length: 50 }),
  bankRoutingNumber: varchar("bankRoutingNumber", { length: 50 }),
  bankSwiftCode: varchar("bankSwiftCode", { length: 20 }),
  bankIban: varchar("bankIban", { length: 50 }),
  bankBranch: varchar("bankBranch", { length: 255 }),
  bankAddress: text("bankAddress"),
  
  // Payment Instructions
  paymentInstructions: text("paymentInstructions"),
  acceptedPaymentMethods: json("acceptedPaymentMethods").$type<string[]>(), // e.g., ["bank_transfer", "credit_card", "check"]
  
  // Footer & Terms
  footerText: text("footerText"),
  termsAndConditions: text("termsAndConditions"),
  latePaymentPolicy: text("latePaymentPolicy"),
  
  // Invoice Numbering
  invoicePrefix: varchar("invoicePrefix", { length: 20 }).default("INV"),
  invoiceNumberFormat: varchar("invoiceNumberFormat", { length: 50 }).default("{{prefix}}-{{year}}-{{number}}"),
  nextInvoiceNumber: int("nextInvoiceNumber").default(1),
  
  // PDF Layout Options
  showLogo: boolean("showLogo").default(true),
  showBankDetails: boolean("showBankDetails").default(true),
  showPaymentInstructions: boolean("showPaymentInstructions").default(true),
  showTerms: boolean("showTerms").default(true),
  showTaxBreakdown: boolean("showTaxBreakdown").default(true),
  showLineItemTax: boolean("showLineItemTax").default(true),
  paperSize: mysqlEnum("paperSize", ["A4", "Letter", "Legal"]).default("A4"),
  
  // Currency & Locale
  defaultCurrency: varchar("defaultCurrency", { length: 3 }).default("USD"),
  currencySymbol: varchar("currencySymbol", { length: 5 }).default("$"),
  currencyPosition: mysqlEnum("currencyPosition", ["before", "after"]).default("before"),
  dateFormat: varchar("dateFormat", { length: 20 }).default("MMM DD, YYYY"),
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (table) => ({
  orgIdx: index("invoice_branding_org_idx").on(table.organizationId),
}));
export type InvoiceBrandingSettings = typeof invoiceBrandingSettings.$inferSelect;
export type InsertInvoiceBrandingSettings = typeof invoiceBrandingSettings.$inferInsert;


// ============================================================================
// DILIGENCE TEMPLATES & REQUIREMENT ITEMS SYSTEM
// Contract Addendum v2: Company VATR, Seed Templates, Expiry & Renewal Tracking
// ============================================================================

/**
 * Diligence Templates - Global KIISHA defaults + org-specific forks
 * Templates define what fields, documents, and validations are required
 */
export const diligenceTemplates = mysqlTable("diligenceTemplates", {
  id: int("id").autoincrement().primaryKey(),
  
  // Template identification
  code: varchar("code", { length: 50 }).notNull(), // e.g., "KYB_BASIC", "INVESTOR_DD"
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "kyb", "investor", "grant", "regulator", "vendor", 
    "bank", "hse_esg", "tax", "insurance", "governance",
    "procurement", "project_spv", "custom"
  ]).notNull(),
  
  // Ownership: null = global KIISHA default, otherwise org-specific fork
  organizationId: int("organizationId"),
  
  // Fork tracking
  parentTemplateId: int("parentTemplateId"), // If forked, points to original
  isGlobalDefault: boolean("isGlobalDefault").default(false),
  
  // Version control
  version: int("version").default(1).notNull(),
  versionNotes: text("versionNotes"),
  
  // Template configuration
  shareBoundary: json("shareBoundary").$type<{
    allowedFields: string[];
    allowedDocCategories: string[];
    excludedFields: string[];
    excludedDocCategories: string[];
  }>(),
  
  // Workflow settings
  requireSignOff: boolean("requireSignOff").default(false),
  signOffRoles: json("signOffRoles").$type<string[]>(),
  
  // Status
  status: mysqlEnum("status", ["draft", "active", "deprecated", "archived"]).default("draft"),
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (table) => ({
  codeIdx: index("diligence_template_code_idx").on(table.code),
  orgIdx: index("diligence_template_org_idx").on(table.organizationId),
  categoryIdx: index("diligence_template_category_idx").on(table.category),
}));
export type DiligenceTemplate = typeof diligenceTemplates.$inferSelect;
export type InsertDiligenceTemplate = typeof diligenceTemplates.$inferInsert;

/**
 * Diligence Template Versions - Track version history with diffs
 */
export const diligenceTemplateVersions = mysqlTable("diligenceTemplateVersions", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  version: int("version").notNull(),
  
  // Snapshot of template at this version
  templateSnapshot: json("templateSnapshot").$type<Record<string, any>>(),
  
  // Changes from previous version
  changeLog: text("changeLog"),
  diffSummary: json("diffSummary").$type<{
    added: string[];
    removed: string[];
    modified: string[];
  }>(),
  
  // Rollout tracking
  pushedToOrgs: json("pushedToOrgs").$type<number[]>(), // Org IDs that accepted this version
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy"),
}, (table) => ({
  templateVersionIdx: index("template_version_idx").on(table.templateId, table.version),
}));
export type DiligenceTemplateVersion = typeof diligenceTemplateVersions.$inferSelect;

/**
 * Requirement Items - Canonical catalog of diligence requirements
 * Each item represents a field, document, checklist, or attestation requirement
 */
export const requirementItems = mysqlTable("requirementItems", {
  id: int("id").autoincrement().primaryKey(),
  
  // Item identification
  code: varchar("code", { length: 100 }).notNull().unique(), // e.g., "CERT_OF_INCORPORATION"
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // Type classification
  requirementType: mysqlEnum("requirementType", [
    "field",           // Structured VATR key
    "document",        // Document category + metadata
    "checklist",       // Human-attested step
    "attestation",     // Sign-off or statement
    "external_verification" // API hook (future)
  ]).notNull(),
  
  // Scope - what entity this applies to
  appliesTo: mysqlEnum("appliesTo", [
    "company_profile", "asset", "site", "project", "person"
  ]).notNull(),
  
  // Category grouping
  category: mysqlEnum("category", [
    "corporate_identity", "ownership_governance", "licenses_permits",
    "finance", "banking", "people_capability", "hse_esg",
    "insurance", "legal", "custom"
  ]).notNull(),
  
  // Ownership: null = global KIISHA default
  organizationId: int("organizationId"),
  isGlobalDefault: boolean("isGlobalDefault").default(false),
  
  // Requirements
  required: boolean("required").default(true),
  evidenceRequired: boolean("evidenceRequired").default(true),
  
  // Expiry configuration
  expiryPolicy: mysqlEnum("expiryPolicy", [
    "none",              // Never expires
    "fixed_date",        // Has specific expiry date
    "duration_from_issue", // Expires X days after issue date
    "duration_from_upload", // Expires X days after upload
    "periodic"           // Recurring renewal (annual, etc.)
  ]).default("none"),
  
  expiryDurationDays: int("expiryDurationDays"), // For duration-based policies
  gracePeriodDays: int("gracePeriodDays").default(0),
  renewalWindowDays: int("renewalWindowDays").default(30), // Start warning this many days before
  
  // Renewal configuration
  renewalPolicy: mysqlEnum("renewalPolicy", [
    "none",           // No renewal needed
    "manual",         // User must manually upload renewal
    "recurring",      // System prompts for renewal
    "auto_obligation" // Auto-creates obligation when due
  ]).default("none"),
  
  // Validation rules
  validationRules: json("validationRules").$type<{
    required?: boolean;
    format?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    crossFieldRules?: Array<{
      field: string;
      condition: string;
      message: string;
    }>;
  }[]>(),
  
  // Access control
  rbacVisibility: json("rbacVisibility").$type<{
    canView: string[];   // Roles that can view
    canSubmit: string[]; // Roles that can submit
    canApprove: string[]; // Roles that can approve
  }>(),
  
  sensitivity: mysqlEnum("sensitivity", [
    "normal", "restricted", "highly_restricted"
  ]).default("normal"),
  
  // Document-specific settings
  defaultDocCategories: json("defaultDocCategories").$type<string[]>(),
  acceptedFileTypes: json("acceptedFileTypes").$type<string[]>(), // e.g., ["pdf", "jpg", "png"]
  maxFileSizeMb: int("maxFileSizeMb").default(10),
  
  // AI extraction hints for documents
  aiExtractionHints: json("aiExtractionHints").$type<{
    keywords: string[];
    dateFields: string[];
    numberFields: string[];
    textFields: string[];
  }>(),
  
  // Field-specific settings (for VATR fields)
  vatrFieldKey: varchar("vatrFieldKey", { length: 255 }), // e.g., "company.taxId"
  fieldType: mysqlEnum("fieldType", [
    "text", "number", "date", "boolean", "select", "multiselect", "file"
  ]),
  fieldOptions: json("fieldOptions").$type<string[]>(), // For select/multiselect
  
  // Display order
  sortOrder: int("sortOrder").default(0),
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (table) => ({
  codeIdx: index("requirement_item_code_idx").on(table.code),
  categoryIdx: index("requirement_item_category_idx").on(table.category),
  typeIdx: index("requirement_item_type_idx").on(table.requirementType),
  orgIdx: index("requirement_item_org_idx").on(table.organizationId),
}));
export type RequirementItem = typeof requirementItems.$inferSelect;
export type InsertRequirementItem = typeof requirementItems.$inferInsert;

/**
 * Template Requirements - Links templates to requirement items
 */
export const templateRequirements = mysqlTable("templateRequirements", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  requirementItemId: int("requirementItemId").notNull(),
  
  // Override settings for this template
  required: boolean("required").default(true), // Override item default
  sortOrder: int("sortOrder").default(0),
  
  // Custom validation for this template
  customValidation: json("customValidation").$type<Record<string, any>>(),
  
  // Custom expiry override
  customExpiryDays: int("customExpiryDays"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  templateReqIdx: index("template_req_idx").on(table.templateId, table.requirementItemId),
}));
export type TemplateRequirement = typeof templateRequirements.$inferSelect;

/**
 * Expiry Records - Track expirable items across entities
 */
export const expiryRecords = mysqlTable("expiryRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // What is expiring
  requirementItemId: int("requirementItemId").notNull(),
  
  // Entity context
  entityType: mysqlEnum("entityType", [
    "company_profile", "asset", "site", "project", "person"
  ]).notNull(),
  entityId: int("entityId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Document/evidence reference
  documentId: int("documentId"), // If linked to a document
  evidenceRefId: int("evidenceRefId"), // If linked to evidence
  vatrFieldKey: varchar("vatrFieldKey", { length: 255 }), // If linked to a field
  
  // Dates
  issuedAt: timestamp("issuedAt"),
  expiresAt: timestamp("expiresAt"),
  validForDays: int("validForDays"),
  gracePeriodEndsAt: timestamp("gracePeriodEndsAt"),
  
  // Status tracking
  status: mysqlEnum("status", [
    "valid",              // Currently valid
    "due_soon",           // Within renewal window
    "due_now",            // At or past expiry, in grace period
    "overdue",            // Past grace period
    "renewed_pending_review", // Renewal submitted, awaiting approval
    "renewed_approved",   // Renewal approved
    "archived"            // No longer active
  ]).default("valid"),
  
  // Verification
  verificationStatus: mysqlEnum("verificationStatus", [
    "unverified",   // AI extracted, not confirmed
    "verified",     // Human confirmed
    "rejected"      // Human rejected extraction
  ]).default("unverified"),
  
  // AI extraction data
  aiExtractedData: json("aiExtractedData").$type<{
    issuedAt?: string;
    expiresAt?: string;
    confidence: number;
    extractedFields: Record<string, any>;
  }>(),
  
  // Linked obligation (if auto-created)
  obligationId: int("obligationId"),
  
  // Notification tracking
  lastNotificationAt: timestamp("lastNotificationAt"),
  notificationCount: int("notificationCount").default(0),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
}, (table) => ({
  entityIdx: index("expiry_entity_idx").on(table.entityType, table.entityId),
  orgIdx: index("expiry_org_idx").on(table.organizationId),
  statusIdx: index("expiry_status_idx").on(table.status),
  expiresIdx: index("expiry_expires_idx").on(table.expiresAt),
}));
export type ExpiryRecord = typeof expiryRecords.$inferSelect;
export type InsertExpiryRecord = typeof expiryRecords.$inferInsert;

/**
 * Renewal Records - Track renewal history
 */
export const renewalRecords = mysqlTable("renewalRecords", {
  id: int("id").autoincrement().primaryKey(),
  
  // Link to expiry record
  expiryRecordId: int("expiryRecordId").notNull(),
  
  // Previous expiry record (for history chain)
  previousExpiryRecordId: int("previousExpiryRecordId"),
  
  // New document/evidence
  newDocumentId: int("newDocumentId"),
  newEvidenceRefId: int("newEvidenceRefId"),
  
  // New dates
  newIssuedAt: timestamp("newIssuedAt"),
  newExpiresAt: timestamp("newExpiresAt"),
  
  // Workflow status
  status: mysqlEnum("status", [
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "cancelled"
  ]).default("submitted"),
  
  // Review details
  reviewNotes: text("reviewNotes"),
  rejectionReason: text("rejectionReason"),
  
  // Audit trail
  submittedBy: int("submittedBy").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  expiryIdx: index("renewal_expiry_idx").on(table.expiryRecordId),
  statusIdx: index("renewal_status_idx").on(table.status),
}));
export type RenewalRecord = typeof renewalRecords.$inferSelect;
export type InsertRenewalRecord = typeof renewalRecords.$inferInsert;

/**
 * Diligence Readiness - Cached readiness scores per entity/template
 */
export const diligenceReadiness = mysqlTable("diligenceReadiness", {
  id: int("id").autoincrement().primaryKey(),
  
  // Entity context
  entityType: mysqlEnum("entityType", [
    "company_profile", "asset", "site", "project", "person"
  ]).notNull(),
  entityId: int("entityId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Template (null = overall readiness)
  templateId: int("templateId"),
  
  // Readiness metrics
  totalRequirements: int("totalRequirements").default(0),
  completedRequirements: int("completedRequirements").default(0),
  
  // Field completion
  totalFields: int("totalFields").default(0),
  completedFields: int("completedFields").default(0),
  
  // Document completion
  totalDocs: int("totalDocs").default(0),
  completedDocs: int("completedDocs").default(0),
  
  // Expiry status
  totalExpirable: int("totalExpirable").default(0),
  validExpirable: int("validExpirable").default(0),
  dueSoonCount: int("dueSoonCount").default(0),
  overdueCount: int("overdueCount").default(0),
  
  // Evidence status
  unresolvedEvidenceCount: int("unresolvedEvidenceCount").default(0),
  pendingApprovalCount: int("pendingApprovalCount").default(0),
  
  // Calculated scores (0-100)
  overallScore: decimal("overallScore", { precision: 5, scale: 2 }).default("0"),
  fieldScore: decimal("fieldScore", { precision: 5, scale: 2 }).default("0"),
  docScore: decimal("docScore", { precision: 5, scale: 2 }).default("0"),
  expiryScore: decimal("expiryScore", { precision: 5, scale: 2 }).default("0"),
  
  // Last calculation
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  entityIdx: index("readiness_entity_idx").on(table.entityType, table.entityId),
  orgIdx: index("readiness_org_idx").on(table.organizationId),
  templateIdx: index("readiness_template_idx").on(table.templateId),
}));
export type DiligenceReadiness = typeof diligenceReadiness.$inferSelect;
export type InsertDiligenceReadiness = typeof diligenceReadiness.$inferInsert;

/**
 * Diligence Audit Log - Track all changes to diligence data
 */
export const diligenceAuditLog = mysqlTable("diligenceAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  
  // What changed
  entityType: varchar("entityType", { length: 50 }).notNull(), // e.g., "template", "requirement", "expiry"
  entityId: int("entityId").notNull(),
  
  // Action
  action: mysqlEnum("action", [
    "created", "updated", "deleted", "cloned", "forked",
    "submitted", "approved", "rejected", "verified",
    "expired", "renewed", "archived"
  ]).notNull(),
  
  // Context
  organizationId: int("organizationId"),
  
  // Change details
  previousValue: json("previousValue").$type<Record<string, any>>(),
  newValue: json("newValue").$type<Record<string, any>>(),
  changeDescription: text("changeDescription"),
  
  // Actor
  performedBy: int("performedBy").notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
  
  // IP/Session tracking
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
}, (table) => ({
  entityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
  orgIdx: index("audit_org_idx").on(table.organizationId),
  actionIdx: index("audit_action_idx").on(table.action),
  performedAtIdx: index("audit_performed_at_idx").on(table.performedAt),
}));
export type DiligenceAuditLog = typeof diligenceAuditLog.$inferSelect;
export type InsertDiligenceAuditLog = typeof diligenceAuditLog.$inferInsert;

/**
 * Company Profiles - Extended company data for VATR
 */
export const companyProfiles = mysqlTable("companyProfiles", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  
  // Basic Info
  legalName: varchar("legalName", { length: 255 }).notNull(),
  tradingName: varchar("tradingName", { length: 255 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  taxId: varchar("taxId", { length: 100 }),
  vatNumber: varchar("vatNumber", { length: 100 }),
  
  // Incorporation
  incorporationDate: timestamp("incorporationDate"),
  incorporationCountry: varchar("incorporationCountry", { length: 100 }),
  incorporationState: varchar("incorporationState", { length: 100 }),
  companyType: varchar("companyType", { length: 100 }), // e.g., "LLC", "Ltd", "Corp"
  
  // Registered Address
  registeredAddress: text("registeredAddress"),
  registeredCity: varchar("registeredCity", { length: 100 }),
  registeredState: varchar("registeredState", { length: 100 }),
  registeredPostalCode: varchar("registeredPostalCode", { length: 20 }),
  registeredCountry: varchar("registeredCountry", { length: 100 }),
  
  // Operating Address (if different)
  operatingAddress: text("operatingAddress"),
  operatingCity: varchar("operatingCity", { length: 100 }),
  operatingState: varchar("operatingState", { length: 100 }),
  operatingPostalCode: varchar("operatingPostalCode", { length: 20 }),
  operatingCountry: varchar("operatingCountry", { length: 100 }),
  
  // Contact
  primaryEmail: varchar("primaryEmail", { length: 320 }),
  primaryPhone: varchar("primaryPhone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  
  // Industry & Sector
  industry: varchar("industry", { length: 255 }),
  sector: varchar("sector", { length: 255 }),
  naicsCode: varchar("naicsCode", { length: 10 }),
  sicCode: varchar("sicCode", { length: 10 }),
  
  // Size & Financials
  employeeCount: int("employeeCount"),
  annualRevenue: decimal("annualRevenue", { precision: 18, scale: 2 }),
  fiscalYearEnd: varchar("fiscalYearEnd", { length: 10 }), // e.g., "12-31"
  
  // VATR data (flexible JSON for additional fields)
  vatrData: json("vatrData").$type<Record<string, any>>(),
  
  // Status
  status: mysqlEnum("status", ["active", "inactive", "pending", "archived"]).default("active"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy"),
  updatedBy: int("updatedBy"),
}, (table) => ({
  orgIdx: index("company_profile_org_idx").on(table.organizationId),
  statusIdx: index("company_profile_status_idx").on(table.status),
}));
export type CompanyProfile = typeof companyProfiles.$inferSelect;
export type InsertCompanyProfile = typeof companyProfiles.$inferInsert;

/**
 * Company Shareholders - Ownership structure
 */
export const companyShareholders = mysqlTable("companyShareholders", {
  id: int("id").autoincrement().primaryKey(),
  companyProfileId: int("companyProfileId").notNull(),
  
  // Shareholder type
  shareholderType: mysqlEnum("shareholderType", ["individual", "company", "trust", "other"]).notNull(),
  
  // For individuals
  individualName: varchar("individualName", { length: 255 }),
  individualNationality: varchar("individualNationality", { length: 100 }),
  individualIdType: varchar("individualIdType", { length: 50 }),
  individualIdNumber: varchar("individualIdNumber", { length: 100 }),
  
  // For companies
  companyName: varchar("companyName", { length: 255 }),
  companyRegistrationNumber: varchar("companyRegistrationNumber", { length: 100 }),
  companyCountry: varchar("companyCountry", { length: 100 }),
  
  // Ownership details
  ownershipPercentage: decimal("ownershipPercentage", { precision: 5, scale: 2 }),
  votingPercentage: decimal("votingPercentage", { precision: 5, scale: 2 }),
  shareClass: varchar("shareClass", { length: 50 }),
  numberOfShares: int("numberOfShares"),
  
  // Beneficial ownership
  isBeneficialOwner: boolean("isBeneficialOwner").default(false),
  isPep: boolean("isPep").default(false), // Politically Exposed Person
  
  // Dates
  acquisitionDate: timestamp("acquisitionDate"),
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("shareholder_company_idx").on(table.companyProfileId),
}));
export type CompanyShareholder = typeof companyShareholders.$inferSelect;

/**
 * Company Directors - Board and key management
 */
export const companyDirectors = mysqlTable("companyDirectors", {
  id: int("id").autoincrement().primaryKey(),
  companyProfileId: int("companyProfileId").notNull(),
  
  // Personal info
  fullName: varchar("fullName", { length: 255 }).notNull(),
  nationality: varchar("nationality", { length: 100 }),
  dateOfBirth: timestamp("dateOfBirth"),
  idType: varchar("idType", { length: 50 }),
  idNumber: varchar("idNumber", { length: 100 }),
  
  // Role
  position: varchar("position", { length: 100 }).notNull(), // e.g., "Director", "CEO", "CFO"
  directorType: mysqlEnum("directorType", ["executive", "non_executive", "independent", "alternate"]),
  
  // Contact
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  
  // Dates
  appointmentDate: timestamp("appointmentDate"),
  resignationDate: timestamp("resignationDate"),
  
  // Compliance
  isPep: boolean("isPep").default(false),
  
  // Status
  isActive: boolean("isActive").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("director_company_idx").on(table.companyProfileId),
}));
export type CompanyDirector = typeof companyDirectors.$inferSelect;

/**
 * Company Bank Accounts - Banking information
 */
export const companyBankAccounts = mysqlTable("companyBankAccounts", {
  id: int("id").autoincrement().primaryKey(),
  companyProfileId: int("companyProfileId").notNull(),
  
  // Bank info
  bankName: varchar("bankName", { length: 255 }).notNull(),
  bankBranch: varchar("bankBranch", { length: 255 }),
  bankAddress: text("bankAddress"),
  bankCountry: varchar("bankCountry", { length: 100 }),
  
  // Account info
  accountName: varchar("accountName", { length: 255 }).notNull(),
  accountNumber: varchar("accountNumber", { length: 50 }).notNull(),
  accountType: varchar("accountType", { length: 50 }), // e.g., "Current", "Savings"
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Routing
  routingNumber: varchar("routingNumber", { length: 50 }),
  swiftCode: varchar("swiftCode", { length: 20 }),
  iban: varchar("iban", { length: 50 }),
  sortCode: varchar("sortCode", { length: 20 }),
  
  // Purpose
  isPrimary: boolean("isPrimary").default(false),
  purpose: varchar("purpose", { length: 100 }), // e.g., "Operations", "Payroll", "Collections"
  
  // Status
  isActive: boolean("isActive").default(true),
  verifiedAt: timestamp("verifiedAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("bank_account_company_idx").on(table.companyProfileId),
}));
export type CompanyBankAccount = typeof companyBankAccounts.$inferSelect;


// Template Responses - for filling in cloned templates
export const templateResponses = mysqlTable("template_responses", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("templateId").notNull(),
  companyProfileId: int("companyProfileId"),
  projectId: int("projectId"),
  organizationId: int("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "in_progress", "submitted", "under_review", "approved", "rejected"]).default("draft"),
  submittedAt: timestamp("submittedAt"),
  submittedBy: int("submittedBy"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  reviewNotes: text("reviewNotes"),
  completionPercentage: int("completionPercentage").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdBy: int("createdBy").notNull(),
});

export type TemplateResponse = typeof templateResponses.$inferSelect;
export type InsertTemplateResponse = typeof templateResponses.$inferInsert;

// Response Submissions - document uploads for each requirement
export const responseSubmissions = mysqlTable("response_submissions", {
  id: int("id").autoincrement().primaryKey(),
  responseId: int("responseId").notNull(),
  requirementItemId: int("requirementItemId").notNull(),
  status: mysqlEnum("status", ["missing", "pending", "uploaded", "verified", "rejected", "expired"]).default("missing"),
  documentUrl: text("documentUrl"),
  documentKey: varchar("documentKey", { length: 512 }),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedAt: timestamp("uploadedAt"),
  uploadedBy: int("uploadedBy"),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: int("verifiedBy"),
  rejectedAt: timestamp("rejectedAt"),
  rejectedBy: int("rejectedBy"),
  rejectionReason: text("rejectionReason"),
  expiryDate: date("expiryDate"),
  notes: text("notes"),
  isLocked: boolean("isLocked").default(false),
  lockedAt: timestamp("lockedAt"),
  lockedBy: int("lockedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ResponseSubmission = typeof responseSubmissions.$inferSelect;
export type InsertResponseSubmission = typeof responseSubmissions.$inferInsert;

// Submission Comments
export const submissionComments = mysqlTable("submission_comments", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  authorId: int("authorId").notNull(),
  content: text("content").notNull(),
  isInternal: boolean("isInternal").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubmissionComment = typeof submissionComments.$inferSelect;
export type InsertSubmissionComment = typeof submissionComments.$inferInsert;

// Submission History - version tracking
export const submissionHistory = mysqlTable("submission_history", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  version: int("version").notNull().default(1),
  documentUrl: text("documentUrl"),
  documentKey: varchar("documentKey", { length: 512 }),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedBy: int("uploadedBy").notNull(),
  changeNote: text("changeNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SubmissionHistory = typeof submissionHistory.$inferSelect;
export type InsertSubmissionHistory = typeof submissionHistory.$inferInsert;

// Submission Extractions - AI-extracted data
export const submissionExtractions = mysqlTable("submission_extractions", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull(),
  fieldName: varchar("fieldName", { length: 255 }).notNull(),
  extractedValue: text("extractedValue"),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  sourcePage: int("sourcePage"),
  sourceSnippet: text("sourceSnippet"),
  verified: boolean("verified").default(false),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SubmissionExtraction = typeof submissionExtractions.$inferSelect;
export type InsertSubmissionExtraction = typeof submissionExtractions.$inferInsert;


/**
 * Company Data Sources - VATR compliant source tracking
 * Every piece of company data should be traceable to its source document
 */
export const companyDataSources = mysqlTable("company_data_sources", {
  id: int("id").autoincrement().primaryKey(),
  companyProfileId: int("companyProfileId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Source document reference
  sourceType: mysqlEnum("sourceType", [
    "document", // Uploaded document
    "extraction", // AI extracted from document
    "manual_entry", // Manually entered
    "api_integration", // From external API
    "verification", // From verification service
    "submission" // From diligence submission
  ]).notNull(),
  
  // Document reference (if sourceType is document/extraction/submission)
  documentUrl: text("documentUrl"),
  documentKey: varchar("documentKey", { length: 512 }),
  documentName: varchar("documentName", { length: 255 }),
  submissionId: int("submissionId"), // Reference to responseSubmissions if from submission
  
  // Field tracking
  fieldName: varchar("fieldName", { length: 100 }).notNull(), // e.g., "legalName", "registrationNumber"
  fieldValue: text("fieldValue").notNull(),
  previousValue: text("previousValue"), // For tracking changes
  
  // Confidence and verification
  confidence: decimal("confidence", { precision: 5, scale: 4 }), // AI confidence score
  isVerified: boolean("isVerified").default(false),
  verifiedBy: int("verifiedBy"),
  verifiedAt: timestamp("verifiedAt"),
  
  // Effective dates
  effectiveFrom: timestamp("effectiveFrom").defaultNow(),
  effectiveTo: timestamp("effectiveTo"), // NULL means current
  
  // Version tracking
  version: int("version").default(1),
  isLatest: boolean("isLatest").default(true),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(),
  notes: text("notes"),
}, (table) => ({
  companyIdx: index("data_source_company_idx").on(table.companyProfileId),
  fieldIdx: index("data_source_field_idx").on(table.fieldName),
  latestIdx: index("data_source_latest_idx").on(table.isLatest),
}));

export type CompanyDataSource = typeof companyDataSources.$inferSelect;
export type InsertCompanyDataSource = typeof companyDataSources.$inferInsert;

/**
 * Shared Submissions - For tracking what data has been shared externally
 * Implements the "lock on submit" and "update push" requirements
 */
export const sharedSubmissions = mysqlTable("shared_submissions", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  companyProfileId: int("companyProfileId").notNull(),
  
  // What was shared
  responseId: int("responseId").notNull(), // Reference to templateResponses
  
  // Who it was shared with
  recipientType: mysqlEnum("recipientType", ["investor", "regulator", "partner", "customer", "other"]).notNull(),
  recipientName: varchar("recipientName", { length: 255 }).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }),
  recipientOrganizationId: int("recipientOrganizationId"), // If internal org
  
  // Sharing details
  shareMethod: mysqlEnum("shareMethod", ["data_room", "email", "portal", "api"]).notNull(),
  shareLink: text("shareLink"),
  accessToken: varchar("accessToken", { length: 255 }),
  
  // Status
  status: mysqlEnum("status", ["pending", "sent", "viewed", "accepted", "expired", "revoked"]).default("pending"),
  
  // Snapshot - locked copy of data at time of sharing
  snapshotData: json("snapshotData").$type<Record<string, any>>(),
  snapshotVersion: int("snapshotVersion").notNull(),
  
  // Timestamps
  sharedAt: timestamp("sharedAt").defaultNow().notNull(),
  viewedAt: timestamp("viewedAt"),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  
  // Audit
  sharedBy: int("sharedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  orgIdx: index("shared_submission_org_idx").on(table.organizationId),
  companyIdx: index("shared_submission_company_idx").on(table.companyProfileId),
  responseIdx: index("shared_submission_response_idx").on(table.responseId),
  statusIdx: index("shared_submission_status_idx").on(table.status),
}));

export type SharedSubmission = typeof sharedSubmissions.$inferSelect;
export type InsertSharedSubmission = typeof sharedSubmissions.$inferInsert;

/**
 * Update Notifications - For tracking updates to shared data
 * When sender updates data, recipients get notified
 */
export const updateNotifications = mysqlTable("update_notifications", {
  id: int("id").autoincrement().primaryKey(),
  sharedSubmissionId: int("sharedSubmissionId").notNull(),
  
  // What changed
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  oldValue: text("oldValue"),
  newValue: text("newValue").notNull(),
  changeReason: text("changeReason"),
  
  // Notification status
  status: mysqlEnum("status", ["pending", "sent", "viewed", "accepted", "rejected"]).default("pending"),
  
  // Recipient response
  acceptedAt: timestamp("acceptedAt"),
  acceptedBy: int("acceptedBy"),
  rejectedAt: timestamp("rejectedAt"),
  rejectedBy: int("rejectedBy"),
  rejectionReason: text("rejectionReason"),
  
  // Push request (if sender wants to push update)
  isPushRequested: boolean("isPushRequested").default(false),
  pushRequestedAt: timestamp("pushRequestedAt"),
  pushRequestedBy: int("pushRequestedBy"),
  pushApproved: boolean("pushApproved"),
  pushApprovedAt: timestamp("pushApprovedAt"),
  pushApprovedBy: int("pushApprovedBy"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  sharedIdx: index("update_notification_shared_idx").on(table.sharedSubmissionId),
  statusIdx: index("update_notification_status_idx").on(table.status),
}));

export type UpdateNotification = typeof updateNotifications.$inferSelect;
export type InsertUpdateNotification = typeof updateNotifications.$inferInsert;

/**
 * Sender Update Alerts - For notifying senders about stale data in submitted forms
 */
export const senderUpdateAlerts = mysqlTable("sender_update_alerts", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  companyProfileId: int("companyProfileId").notNull(),
  sharedSubmissionId: int("sharedSubmissionId").notNull(),
  
  // What changed
  fieldName: varchar("fieldName", { length: 100 }).notNull(),
  submittedValue: text("submittedValue"),
  currentValue: text("currentValue").notNull(),
  
  // Alert status
  status: mysqlEnum("status", ["active", "acknowledged", "push_requested", "push_sent", "dismissed"]).default("active"),
  
  // Can push update?
  canPushUpdate: boolean("canPushUpdate").default(true), // False if submission timeline closed
  submissionDeadline: timestamp("submissionDeadline"),
  
  // Push request
  pushRequestedAt: timestamp("pushRequestedAt"),
  pushRequestedBy: int("pushRequestedBy"),
  pushSentAt: timestamp("pushSentAt"),
  
  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
  acknowledgedBy: int("acknowledgedBy"),
}, (table) => ({
  orgIdx: index("sender_alert_org_idx").on(table.organizationId),
  statusIdx: index("sender_alert_status_idx").on(table.status),
}));

export type SenderUpdateAlert = typeof senderUpdateAlerts.$inferSelect;
export type InsertSenderUpdateAlert = typeof senderUpdateAlerts.$inferInsert;


// Real-time notifications table
export const notifications = mysqlTable("notifications", {
  id: int("id").primaryKey().autoincrement(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  userId: int("user_id").notNull(),
  organizationId: int("organization_id").notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: int("entity_id"),
  metadata: json("metadata"),
  read: boolean("read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


// ============================================================================
// MULTI-TENANT ISOLATION & VIEW SHARING TABLES
// ============================================================================

/**
 * Views - Permissioned packages of information for sharing
 * Cross-org sharing occurs ONLY through explicit View sharing
 */
export const views = mysqlTable("views", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organizationId").notNull(), // Owner org
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  viewType: mysqlEnum("viewType", ["project", "asset", "document_set", "custom"]).default("custom").notNull(),
  
  // Scope definition - what's included in this view
  scope: json("scope").$type<{
    projectIds?: number[];
    assetIds?: number[];
    documentIds?: number[];
    infoItemIds?: number[];
    predicateIds?: string[];
  }>(),
  
  // Access control
  isPublic: boolean("isPublic").default(false).notNull(), // Public within org
  createdBy: int("createdBy").notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type View = typeof views.$inferSelect;
export type InsertView = typeof views.$inferInsert;

/**
 * View Shares - Explicit cross-org sharing grants
 * HARD RULES:
 * 1. Share Unit = View
 * 2. Must be explicit, revocable, time-bounded (optional), audited
 * 3. Receiving org can ONLY access the View contents
 */
export const viewSharesV2 = mysqlTable("viewSharesV2", {
  id: int("id").primaryKey().autoincrement(),
  viewId: int("viewId").notNull(),
  sourceOrgId: int("sourceOrgId").notNull(), // Org that owns the view
  
  // Target (one of these must be set)
  targetOrgId: int("targetOrgId"), // Target organization
  targetUserId: int("targetUserId"), // Specific user (optional)
  
  // Share status
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  
  // Permissions
  canExport: boolean("canExport").default(false).notNull(),
  canCopy: boolean("canCopy").default(false).notNull(),
  sensitiveFieldsHidden: boolean("sensitiveFieldsHidden").default(true).notNull(),
  
  // Scope restrictions (further limit what's visible)
  scopeRestrictions: json("scopeRestrictions").$type<{
    excludeDocumentIds?: number[];
    excludeInfoItemIds?: number[];
    onlyProjectIds?: number[];
  }>(),
  
  // Access limits
  expiresAt: timestamp("expiresAt"),
  maxAccesses: int("maxAccesses"),
  accessCount: int("accessCount").default(0).notNull(),
  
  // Audit
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokedReason: text("revokedReason"),
});

export type ViewShareV2 = typeof viewSharesV2.$inferSelect;
export type InsertViewShareV2 = typeof viewSharesV2.$inferInsert;

/**
 * View Share Access Log - Track all accesses to shared views
 */
export const viewShareAccessLog = mysqlTable("viewShareAccessLog", {
  id: int("id").primaryKey().autoincrement(),
  shareId: int("shareId").notNull(),
  viewId: int("viewId").notNull(),
  accessedBy: int("accessedBy").notNull(), // User who accessed
  accessedOrgId: int("accessedOrgId").notNull(), // Org context of accessor
  
  // Access details
  action: mysqlEnum("action", ["view", "export", "copy"]).default("view").notNull(),
  resourceType: varchar("resourceType", { length: 50 }),
  resourceId: int("resourceId"),
  
  // Metadata
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  accessedAt: timestamp("accessedAt").defaultNow().notNull(),
});

export type ViewShareAccessLogEntry = typeof viewShareAccessLog.$inferSelect;
export type InsertViewShareAccessLogEntry = typeof viewShareAccessLog.$inferInsert;

/**
 * Template Field Mappings - Map template fields to VATR predicates
 * Tenant-scoped - each org has its own mappings
 */
export const templateFieldMappings = mysqlTable("templateFieldMappings", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organizationId").notNull(),
  templateId: int("templateId").notNull(),
  fieldId: varchar("fieldId", { length: 255 }).notNull(),
  
  // VATR mapping
  predicateId: varchar("predicateId", { length: 255 }).notNull(),
  confidenceThreshold: decimal("confidenceThreshold", { precision: 3, scale: 2 }).default("0.80"),
  
  // Sensitivity
  isSensitive: boolean("isSensitive").default(false).notNull(),
  neverAutofill: boolean("neverAutofill").default(false).notNull(),
  
  // Metadata
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TemplateFieldMapping = typeof templateFieldMappings.$inferSelect;
export type InsertTemplateFieldMapping = typeof templateFieldMappings.$inferInsert;

/**
 * Autofill Decisions - Track all autofill decisions for audit
 */
export const autofillDecisions = mysqlTable("autofillDecisions", {
  id: int("id").primaryKey().autoincrement(),
  organizationId: int("organizationId").notNull(),
  projectId: int("projectId").notNull(),
  templateId: int("templateId").notNull(),
  fieldId: varchar("fieldId", { length: 255 }).notNull(),
  
  // Decision
  decision: mysqlEnum("decision", [
    "auto_filled",
    "user_selected",
    "user_confirmed",
    "user_rejected",
    "skipped"
  ]).notNull(),
  
  // Selected predicate (if applicable)
  selectedPredicateId: varchar("selectedPredicateId", { length: 255 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  
  // Final value (redacted for sensitive fields)
  finalValueHash: varchar("finalValueHash", { length: 64 }), // SHA-256 hash for audit
  
  // Metadata
  userId: int("userId").notNull(),
  decidedAt: timestamp("decidedAt").defaultNow().notNull(),
});

export type AutofillDecision = typeof autofillDecisions.$inferSelect;
export type InsertAutofillDecision = typeof autofillDecisions.$inferInsert;

/**
 * AI Retrieval Scope Cache - Cache computed retrieval scopes
 * Invalidated on permission changes
 */
export const aiRetrievalScopeCache = mysqlTable("aiRetrievalScopeCache", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  organizationId: int("organizationId").notNull(),
  
  // Cached scope
  accessibleProjectIds: json("accessibleProjectIds").$type<number[]>(),
  accessibleViewIds: json("accessibleViewIds").$type<number[]>(),
  accessibleShareIds: json("accessibleShareIds").$type<number[]>(),
  
  // Cache metadata
  computedAt: timestamp("computedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  invalidatedAt: timestamp("invalidatedAt"),
});

export type AIRetrievalScopeCache = typeof aiRetrievalScopeCache.$inferSelect;
export type InsertAIRetrievalScopeCache = typeof aiRetrievalScopeCache.$inferInsert;

/**
 * Tenant Isolation Violations - Log all blocked cross-org access attempts
 */
export const tenantIsolationViolations = mysqlTable("tenantIsolationViolations", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  userOrgId: int("userOrgId"), // User's active org
  attemptedOrgId: int("attemptedOrgId"), // Org they tried to access
  
  // Violation details
  resourceType: varchar("resourceType", { length: 50 }).notNull(),
  resourceId: int("resourceId"),
  action: varchar("action", { length: 50 }).notNull(),
  
  // Context
  endpoint: varchar("endpoint", { length: 255 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  
  // Metadata
  blockedAt: timestamp("blockedAt").defaultNow().notNull(),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).default("medium").notNull(),
});

export type TenantIsolationViolation = typeof tenantIsolationViolations.$inferSelect;
export type InsertTenantIsolationViolation = typeof tenantIsolationViolations.$inferInsert;

/**
 * Organization Join Requests - Anti-enumeration compliant join flow
 */
export const orgJoinRequests = mysqlTable("orgJoinRequests", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("userId").notNull(),
  
  // Request details (hashed to prevent enumeration)
  orgIdentifierHash: varchar("orgIdentifierHash", { length: 64 }).notNull(), // SHA-256 of org identifier
  requestedRole: mysqlEnum("requestedRole", ["admin", "editor", "reviewer", "investor_viewer"]).default("reviewer"),
  
  // Status
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  
  // Processing
  processedBy: int("processedBy"),
  processedAt: timestamp("processedAt"),
  rejectionReason: text("rejectionReason"),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export type OrgJoinRequest = typeof orgJoinRequests.$inferSelect;
export type InsertOrgJoinRequest = typeof orgJoinRequests.$inferInsert;

/**
 * Rate Limit Tracking - Prevent enumeration attacks
 */
export const rateLimitTracking = mysqlTable("rateLimitTracking", {
  id: int("id").primaryKey().autoincrement(),
  identifier: varchar("identifier", { length: 255 }).notNull(), // IP or user ID
  action: varchar("action", { length: 50 }).notNull(), // login, join_request, token_check
  
  // Tracking
  attemptCount: int("attemptCount").default(1).notNull(),
  firstAttemptAt: timestamp("firstAttemptAt").defaultNow().notNull(),
  lastAttemptAt: timestamp("lastAttemptAt").defaultNow().notNull(),
  blockedUntil: timestamp("blockedUntil"),
});

export type RateLimitTracking = typeof rateLimitTracking.$inferSelect;
export type InsertRateLimitTracking = typeof rateLimitTracking.$inferInsert;
