/**
 * Seed Data for Diligence Templates and Requirement Items
 * Contract Addendum v2: Company VATR, Seed Templates, Expiry & Renewal Tracking
 */

import { getDb } from "../db";
import { 
  diligenceTemplates, 
  requirementItems, 
  templateRequirements,
  InsertDiligenceTemplate,
  InsertRequirementItem
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================================
// SEED REQUIREMENT ITEMS CATALOG
// ============================================================================

export const seedRequirementItems: Omit<InsertRequirementItem, "id" | "createdAt" | "updatedAt">[] = [
  // -------------------------------------------------------------------------
  // CORPORATE IDENTITY
  // -------------------------------------------------------------------------
  {
    code: "CERT_OF_INCORPORATION",
    title: "Certificate of Incorporation",
    description: "Official certificate proving the company's legal incorporation",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "corporate_identity",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    defaultDocCategories: ["corporate", "legal"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    aiExtractionHints: {
      keywords: ["certificate", "incorporation", "registered"],
      dateFields: ["incorporation_date"],
      textFields: ["company_name", "registration_number"]
    },
    sortOrder: 1
  },
  {
    code: "CAC_SEARCH_REPORT",
    title: "Company Registration Extract / CAC Search Report",
    description: "Official extract from the corporate affairs registry",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "corporate_identity",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 90,
    renewalWindowDays: 14,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["corporate", "legal"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 2
  },
  {
    code: "MEMORANDUM_ARTICLES",
    title: "Memorandum & Articles of Association",
    description: "Company's constitutional documents",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "corporate_identity",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    defaultDocCategories: ["corporate", "legal"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 3
  },
  {
    code: "REGISTERED_ADDRESS_PROOF",
    title: "Registered Address Proof",
    description: "Document proving the company's registered address",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "corporate_identity",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 180,
    renewalWindowDays: 30,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["corporate"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    sortOrder: 4
  },
  {
    code: "COMPANY_PROFILE_SUMMARY",
    title: "Company Profile Summary",
    description: "Structured company information fields",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "corporate_identity",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: false,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    vatrFieldKey: "company.profile",
    fieldType: "text",
    sortOrder: 5
  },

  // -------------------------------------------------------------------------
  // OWNERSHIP & GOVERNANCE
  // -------------------------------------------------------------------------
  {
    code: "SHAREHOLDING_STRUCTURE",
    title: "Shareholding Structure",
    description: "Details of company ownership and share distribution",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "ownership_governance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "restricted",
    vatrFieldKey: "company.shareholders",
    fieldType: "text",
    sortOrder: 10
  },
  {
    code: "BENEFICIAL_OWNERSHIP_DECLARATION",
    title: "Beneficial Ownership Declaration",
    description: "Declaration of ultimate beneficial owners",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "ownership_governance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 30,
    renewalPolicy: "recurring",
    sensitivity: "restricted",
    defaultDocCategories: ["corporate", "compliance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 11
  },
  {
    code: "DIRECTORS_LIST",
    title: "Directors List",
    description: "List of company directors with details",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "ownership_governance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: false,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    vatrFieldKey: "company.directors",
    fieldType: "text",
    sortOrder: 12
  },
  {
    code: "BOARD_RESOLUTION",
    title: "Board Resolution Authorizing Submission",
    description: "Board resolution authorizing the diligence submission",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "ownership_governance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    renewalWindowDays: 14,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["corporate", "legal"],
    acceptedFileTypes: ["pdf"],
    aiExtractionHints: {
      keywords: ["resolution", "board", "authorized"],
      dateFields: ["resolution_date", "expiry_date"]
    },
    sortOrder: 13
  },
  {
    code: "ORGANIZATIONAL_CHART",
    title: "Signed Organizational Chart",
    description: "Company organizational structure chart",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "ownership_governance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 30,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["corporate"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    sortOrder: 14
  },

  // -------------------------------------------------------------------------
  // LICENSES & PERMITS (EXPIRABLE)
  // -------------------------------------------------------------------------
  {
    code: "BUSINESS_LICENSE",
    title: "Business Operating License",
    description: "General business operating license",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "licenses_permits",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 30,
    renewalWindowDays: 60,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["licenses", "compliance"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    aiExtractionHints: {
      keywords: ["license", "permit", "business", "operating"],
      dateFields: ["issue_date", "expiry_date", "valid_until"]
    },
    sortOrder: 20
  },
  {
    code: "SECTOR_LICENSE",
    title: "Sector-specific License",
    description: "Industry or sector-specific operating license",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "licenses_permits",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 30,
    renewalWindowDays: 60,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["licenses", "compliance"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    aiExtractionHints: {
      keywords: ["license", "permit", "sector"],
      dateFields: ["issue_date", "expiry_date"]
    },
    sortOrder: 21
  },
  {
    code: "ENVIRONMENTAL_PERMIT",
    title: "Environmental Permit",
    description: "Environmental compliance permit",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "licenses_permits",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 30,
    renewalWindowDays: 90,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["licenses", "environmental"],
    acceptedFileTypes: ["pdf"],
    aiExtractionHints: {
      keywords: ["environmental", "permit", "EPA"],
      dateFields: ["issue_date", "expiry_date"]
    },
    sortOrder: 22
  },
  {
    code: "LOCAL_GOVERNMENT_PERMIT",
    title: "Local Government Permit",
    description: "Local government operating permit",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "licenses_permits",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 14,
    renewalWindowDays: 30,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["licenses"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    sortOrder: 23
  },

  // -------------------------------------------------------------------------
  // FINANCE (EXPIRABLE)
  // -------------------------------------------------------------------------
  {
    code: "AUDITED_FINANCIALS",
    title: "Audited Financial Statements",
    description: "Most recent audited financial statements",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "finance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "duration_from_issue",
    expiryDurationDays: 365,
    gracePeriodDays: 90,
    renewalWindowDays: 60,
    renewalPolicy: "recurring",
    sensitivity: "restricted",
    defaultDocCategories: ["financial"],
    acceptedFileTypes: ["pdf"],
    aiExtractionHints: {
      keywords: ["audited", "financial", "statements", "annual report"],
      dateFields: ["fiscal_year_end", "audit_date"]
    },
    sortOrder: 30
  },
  {
    code: "MANAGEMENT_ACCOUNTS",
    title: "Management Accounts",
    description: "Recent management accounts (within 90 days)",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "finance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 90,
    renewalWindowDays: 14,
    renewalPolicy: "recurring",
    sensitivity: "restricted",
    defaultDocCategories: ["financial"],
    acceptedFileTypes: ["pdf", "xlsx"],
    sortOrder: 31
  },
  {
    code: "TAX_CLEARANCE",
    title: "Tax Clearance Certificate",
    description: "Certificate confirming tax compliance",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "finance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 30,
    renewalWindowDays: 60,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["tax", "compliance"],
    acceptedFileTypes: ["pdf"],
    aiExtractionHints: {
      keywords: ["tax", "clearance", "certificate"],
      dateFields: ["issue_date", "expiry_date", "valid_until"]
    },
    sortOrder: 32
  },
  {
    code: "VAT_REGISTRATION",
    title: "VAT Registration Certificate",
    description: "VAT/GST registration certificate",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "finance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    defaultDocCategories: ["tax"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    sortOrder: 33
  },
  {
    code: "BANK_REFERENCE_LETTER",
    title: "Bank Reference Letter",
    description: "Reference letter from the company's bank",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "finance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 90,
    renewalWindowDays: 14,
    renewalPolicy: "manual",
    sensitivity: "restricted",
    defaultDocCategories: ["financial", "banking"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 34
  },

  // -------------------------------------------------------------------------
  // BANKING (SENSITIVE)
  // -------------------------------------------------------------------------
  {
    code: "BANK_ACCOUNT_DETAILS",
    title: "Bank Account Details",
    description: "Company bank account information",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "banking",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: false,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "highly_restricted",
    vatrFieldKey: "company.bankAccounts",
    fieldType: "text",
    rbacVisibility: {
      canView: ["admin", "finance"],
      canSubmit: ["admin", "finance"],
      canApprove: ["admin"]
    },
    sortOrder: 40
  },
  {
    code: "SIGNATORY_LIST",
    title: "Signatory List",
    description: "List of authorized bank signatories",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "banking",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "highly_restricted",
    vatrFieldKey: "company.signatories",
    fieldType: "text",
    rbacVisibility: {
      canView: ["admin", "finance"],
      canSubmit: ["admin", "finance"],
      canApprove: ["admin"]
    },
    sortOrder: 41
  },
  {
    code: "SETTLEMENT_INSTRUCTION",
    title: "Settlement Instruction Letter",
    description: "Bank settlement instruction letter",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "banking",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "highly_restricted",
    defaultDocCategories: ["banking"],
    acceptedFileTypes: ["pdf"],
    rbacVisibility: {
      canView: ["admin", "finance"],
      canSubmit: ["admin", "finance"],
      canApprove: ["admin"]
    },
    sortOrder: 42
  },
  {
    code: "BANK_MANDATE",
    title: "Bank Mandate",
    description: "Bank mandate document",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "banking",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "highly_restricted",
    defaultDocCategories: ["banking"],
    acceptedFileTypes: ["pdf"],
    rbacVisibility: {
      canView: ["admin", "finance"],
      canSubmit: ["admin", "finance"],
      canApprove: ["admin"]
    },
    sortOrder: 43
  },

  // -------------------------------------------------------------------------
  // PEOPLE & CAPABILITY
  // -------------------------------------------------------------------------
  {
    code: "KEY_STAFF_CVS",
    title: "CVs of Key Staff",
    description: "Curriculum vitae of key personnel",
    requirementType: "document",
    appliesTo: "person",
    category: "people_capability",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 30,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["hr", "personnel"],
    acceptedFileTypes: ["pdf", "doc", "docx"],
    sortOrder: 50
  },
  {
    code: "PROFESSIONAL_CERTIFICATIONS",
    title: "Professional Certifications",
    description: "Professional certifications and qualifications",
    requirementType: "document",
    appliesTo: "person",
    category: "people_capability",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 30,
    renewalWindowDays: 60,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["hr", "certifications"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    aiExtractionHints: {
      keywords: ["certificate", "certification", "qualified"],
      dateFields: ["issue_date", "expiry_date"]
    },
    sortOrder: 51
  },
  {
    code: "STAFF_IDS",
    title: "Staff Identification Documents",
    description: "ID documents for key staff",
    requirementType: "document",
    appliesTo: "person",
    category: "people_capability",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 0,
    renewalWindowDays: 90,
    renewalPolicy: "manual",
    sensitivity: "highly_restricted",
    defaultDocCategories: ["hr", "identity"],
    acceptedFileTypes: ["pdf", "jpg", "png"],
    rbacVisibility: {
      canView: ["admin", "hr"],
      canSubmit: ["admin", "hr"],
      canApprove: ["admin"]
    },
    sortOrder: 52
  },
  {
    code: "STAFF_TRAINING_RECORDS",
    title: "Staff Training Records",
    description: "Training records and certifications",
    requirementType: "document",
    appliesTo: "person",
    category: "people_capability",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 30,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["hr", "training"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 53
  },

  // -------------------------------------------------------------------------
  // HSE & ESG (EXPIRABLE)
  // -------------------------------------------------------------------------
  {
    code: "HSE_POLICY",
    title: "HSE Policy",
    description: "Health, Safety and Environment policy document",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "hse_esg",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 60,
    renewalPolicy: "recurring",
    sensitivity: "normal",
    defaultDocCategories: ["hse", "compliance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 60
  },
  {
    code: "HSE_PLAN",
    title: "HSE Plan",
    description: "Health, Safety and Environment plan",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "hse_esg",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 60,
    renewalPolicy: "recurring",
    sensitivity: "normal",
    defaultDocCategories: ["hse"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 61
  },
  {
    code: "EMERGENCY_RESPONSE_PLAN",
    title: "Emergency Response Plan",
    description: "Emergency response and evacuation plan",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "hse_esg",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 60,
    renewalPolicy: "manual",
    sensitivity: "normal",
    defaultDocCategories: ["hse"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 62
  },
  {
    code: "ESG_POLICY",
    title: "ESG Policy",
    description: "Environmental, Social and Governance policy",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "hse_esg",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 60,
    renewalPolicy: "recurring",
    sensitivity: "normal",
    defaultDocCategories: ["esg", "compliance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 63
  },
  {
    code: "MODERN_SLAVERY_STATEMENT",
    title: "Modern Slavery Statement",
    description: "Annual modern slavery statement",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "hse_esg",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "periodic",
    expiryDurationDays: 365,
    renewalWindowDays: 60,
    renewalPolicy: "recurring",
    sensitivity: "normal",
    defaultDocCategories: ["esg", "compliance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 64
  },

  // -------------------------------------------------------------------------
  // INSURANCE (EXPIRABLE)
  // -------------------------------------------------------------------------
  {
    code: "INSURANCE_CERTIFICATE",
    title: "Insurance Certificate(s)",
    description: "Current insurance certificates",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "insurance",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 14,
    renewalWindowDays: 60,
    renewalPolicy: "auto_obligation",
    sensitivity: "normal",
    defaultDocCategories: ["insurance"],
    acceptedFileTypes: ["pdf"],
    aiExtractionHints: {
      keywords: ["insurance", "certificate", "policy", "coverage"],
      dateFields: ["effective_date", "expiry_date"]
    },
    sortOrder: 70
  },
  {
    code: "INSURANCE_POLICY_SCHEDULE",
    title: "Policy Schedule",
    description: "Insurance policy schedule document",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "insurance",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "fixed_date",
    gracePeriodDays: 14,
    renewalWindowDays: 60,
    renewalPolicy: "manual",
    sensitivity: "restricted",
    defaultDocCategories: ["insurance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 71
  },

  // -------------------------------------------------------------------------
  // LEGAL
  // -------------------------------------------------------------------------
  {
    code: "MATERIAL_CONTRACTS_REGISTER",
    title: "Material Contracts Register",
    description: "Register of material contracts",
    requirementType: "field",
    appliesTo: "company_profile",
    category: "legal",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "restricted",
    vatrFieldKey: "company.materialContracts",
    fieldType: "text",
    sortOrder: 80
  },
  {
    code: "LITIGATION_DECLARATION",
    title: "Litigation / Dispute Declaration",
    description: "Declaration of any ongoing litigation or disputes",
    requirementType: "attestation",
    appliesTo: "company_profile",
    category: "legal",
    isGlobalDefault: true,
    required: true,
    evidenceRequired: false,
    expiryPolicy: "duration_from_upload",
    expiryDurationDays: 365,
    renewalWindowDays: 30,
    renewalPolicy: "recurring",
    sensitivity: "restricted",
    sortOrder: 81
  },
  {
    code: "NDA_COMPLIANCE_STATEMENT",
    title: "NDA / Compliance Statement",
    description: "Non-disclosure agreement or compliance statement",
    requirementType: "document",
    appliesTo: "company_profile",
    category: "legal",
    isGlobalDefault: true,
    required: false,
    evidenceRequired: true,
    expiryPolicy: "none",
    renewalPolicy: "none",
    sensitivity: "normal",
    defaultDocCategories: ["legal", "compliance"],
    acceptedFileTypes: ["pdf"],
    sortOrder: 82
  }
];

// ============================================================================
// SEED DILIGENCE TEMPLATES
// ============================================================================

export const seedDiligenceTemplates: Omit<InsertDiligenceTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    code: "KYB_BASIC",
    name: "KYB Basic Pack",
    description: "Basic Know Your Business pack for standard company verification",
    category: "kyb",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "INVESTOR_DD",
    name: "Investor Due Diligence Pack",
    description: "Comprehensive due diligence pack for investor review",
    category: "investor",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin", "finance"]
  },
  {
    code: "GRANT_DONOR",
    name: "Grant / Donor Compliance Pack",
    description: "Compliance pack for grant applications and donor requirements",
    category: "grant",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin"]
  },
  {
    code: "REGULATOR_SUBMISSION",
    name: "Regulator Submission Pack",
    description: "Pack for regulatory submissions and compliance filings",
    category: "regulator",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin", "legal"]
  },
  {
    code: "VENDOR_QUALIFICATION",
    name: "Vendor/Subcontractor Qualification Pack",
    description: "Qualification pack for vendors and subcontractors",
    category: "vendor",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "BANK_KYC",
    name: "Bank / Lender KYC + Facility Pack",
    description: "KYC pack for banking relationships and credit facilities",
    category: "bank",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin", "finance"]
  },
  {
    code: "HSE_ESG_ASSURANCE",
    name: "HSE + ESG Assurance Pack",
    description: "Health, Safety, Environment and ESG assurance pack",
    category: "hse_esg",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "TAX_STATUTORY",
    name: "Tax + Statutory Compliance Pack",
    description: "Tax and statutory compliance documentation pack",
    category: "tax",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "INSURANCE_RISK",
    name: "Insurance & Risk Pack",
    description: "Insurance coverage and risk management pack",
    category: "insurance",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "CORPORATE_GOVERNANCE",
    name: "Corporate Governance Pack",
    description: "Corporate governance and board documentation pack",
    category: "governance",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin"]
  },
  {
    code: "PROCUREMENT_TENDER",
    name: "Procurement / Tender Eligibility Pack",
    description: "Pack for procurement and tender eligibility submissions",
    category: "procurement",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: false
  },
  {
    code: "PROJECT_SPV",
    name: "Project SPV Pack",
    description: "Pack for asset-specific Special Purpose Vehicles",
    category: "project_spv",
    isGlobalDefault: true,
    status: "active",
    requireSignOff: true,
    signOffRoles: ["admin", "legal"]
  }
];

// ============================================================================
// TEMPLATE-REQUIREMENT MAPPINGS
// ============================================================================

export const templateRequirementMappings: Record<string, string[]> = {
  "KYB_BASIC": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "REGISTERED_ADDRESS_PROOF",
    "COMPANY_PROFILE_SUMMARY",
    "DIRECTORS_LIST",
    "TAX_CLEARANCE"
  ],
  "INVESTOR_DD": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "COMPANY_PROFILE_SUMMARY",
    "SHAREHOLDING_STRUCTURE",
    "BENEFICIAL_OWNERSHIP_DECLARATION",
    "DIRECTORS_LIST",
    "BOARD_RESOLUTION",
    "ORGANIZATIONAL_CHART",
    "AUDITED_FINANCIALS",
    "MANAGEMENT_ACCOUNTS",
    "TAX_CLEARANCE",
    "BANK_REFERENCE_LETTER",
    "INSURANCE_CERTIFICATE",
    "MATERIAL_CONTRACTS_REGISTER",
    "LITIGATION_DECLARATION"
  ],
  "GRANT_DONOR": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "COMPANY_PROFILE_SUMMARY",
    "SHAREHOLDING_STRUCTURE",
    "DIRECTORS_LIST",
    "AUDITED_FINANCIALS",
    "TAX_CLEARANCE",
    "BANK_ACCOUNT_DETAILS",
    "ESG_POLICY",
    "MODERN_SLAVERY_STATEMENT"
  ],
  "REGULATOR_SUBMISSION": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "REGISTERED_ADDRESS_PROOF",
    "COMPANY_PROFILE_SUMMARY",
    "SHAREHOLDING_STRUCTURE",
    "BENEFICIAL_OWNERSHIP_DECLARATION",
    "DIRECTORS_LIST",
    "BUSINESS_LICENSE",
    "SECTOR_LICENSE",
    "AUDITED_FINANCIALS",
    "TAX_CLEARANCE",
    "VAT_REGISTRATION"
  ],
  "VENDOR_QUALIFICATION": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "COMPANY_PROFILE_SUMMARY",
    "BUSINESS_LICENSE",
    "TAX_CLEARANCE",
    "INSURANCE_CERTIFICATE",
    "HSE_POLICY",
    "KEY_STAFF_CVS",
    "PROFESSIONAL_CERTIFICATIONS"
  ],
  "BANK_KYC": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "COMPANY_PROFILE_SUMMARY",
    "SHAREHOLDING_STRUCTURE",
    "BENEFICIAL_OWNERSHIP_DECLARATION",
    "DIRECTORS_LIST",
    "BOARD_RESOLUTION",
    "AUDITED_FINANCIALS",
    "MANAGEMENT_ACCOUNTS",
    "TAX_CLEARANCE",
    "BANK_ACCOUNT_DETAILS",
    "SIGNATORY_LIST",
    "SETTLEMENT_INSTRUCTION",
    "BANK_MANDATE"
  ],
  "HSE_ESG_ASSURANCE": [
    "HSE_POLICY",
    "HSE_PLAN",
    "EMERGENCY_RESPONSE_PLAN",
    "ESG_POLICY",
    "MODERN_SLAVERY_STATEMENT",
    "ENVIRONMENTAL_PERMIT",
    "STAFF_TRAINING_RECORDS"
  ],
  "TAX_STATUTORY": [
    "CERT_OF_INCORPORATION",
    "TAX_CLEARANCE",
    "VAT_REGISTRATION",
    "AUDITED_FINANCIALS",
    "MANAGEMENT_ACCOUNTS"
  ],
  "INSURANCE_RISK": [
    "INSURANCE_CERTIFICATE",
    "INSURANCE_POLICY_SCHEDULE",
    "HSE_POLICY"
  ],
  "CORPORATE_GOVERNANCE": [
    "CERT_OF_INCORPORATION",
    "MEMORANDUM_ARTICLES",
    "SHAREHOLDING_STRUCTURE",
    "BENEFICIAL_OWNERSHIP_DECLARATION",
    "DIRECTORS_LIST",
    "BOARD_RESOLUTION",
    "ORGANIZATIONAL_CHART"
  ],
  "PROCUREMENT_TENDER": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "COMPANY_PROFILE_SUMMARY",
    "BUSINESS_LICENSE",
    "TAX_CLEARANCE",
    "AUDITED_FINANCIALS",
    "INSURANCE_CERTIFICATE",
    "HSE_POLICY",
    "KEY_STAFF_CVS",
    "PROFESSIONAL_CERTIFICATIONS"
  ],
  "PROJECT_SPV": [
    "CERT_OF_INCORPORATION",
    "CAC_SEARCH_REPORT",
    "MEMORANDUM_ARTICLES",
    "SHAREHOLDING_STRUCTURE",
    "BENEFICIAL_OWNERSHIP_DECLARATION",
    "DIRECTORS_LIST",
    "BOARD_RESOLUTION",
    "BUSINESS_LICENSE",
    "ENVIRONMENTAL_PERMIT",
    "AUDITED_FINANCIALS",
    "TAX_CLEARANCE",
    "BANK_ACCOUNT_DETAILS",
    "INSURANCE_CERTIFICATE"
  ]
};

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

/**
 * Seed all requirement items
 */
export async function seedRequirementItemsData(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  let insertedCount = 0;
  
  for (const item of seedRequirementItems) {
    // Check if item already exists
    const [existing] = await db.select().from(requirementItems).where(eq(requirementItems.code, item.code)).limit(1);
    
    if (!existing) {
      await db.insert(requirementItems).values(item as any);
      insertedCount++;
    }
  }
  
  return insertedCount;
}

/**
 * Seed all diligence templates
 */
export async function seedDiligenceTemplatesData(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  let insertedCount = 0;
  
  for (const template of seedDiligenceTemplates) {
    // Check if template already exists
    const [existing] = await db.select().from(diligenceTemplates).where(eq(diligenceTemplates.code, template.code)).limit(1);
    
    if (!existing) {
      await db.insert(diligenceTemplates).values(template as any);
      insertedCount++;
    }
  }
  
  return insertedCount;
}

/**
 * Seed template-requirement mappings
 */
export async function seedTemplateRequirementMappings(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  let insertedCount = 0;
  
  for (const [templateCode, requirementCodes] of Object.entries(templateRequirementMappings)) {
    // Get template ID
    const [template] = await db.select().from(diligenceTemplates).where(eq(diligenceTemplates.code, templateCode)).limit(1);
    
    if (!template) continue;
    
    for (let i = 0; i < requirementCodes.length; i++) {
      const reqCode = requirementCodes[i];
      
      // Get requirement item ID
      const [reqItem] = await db.select().from(requirementItems).where(eq(requirementItems.code, reqCode)).limit(1);
      
      if (!reqItem) continue;
      
      // Check if mapping already exists
      const [existing] = await db.select().from(templateRequirements).where(
        and(
          eq(templateRequirements.templateId, template.id),
          eq(templateRequirements.requirementItemId, reqItem.id)
        )
      ).limit(1);
      
      if (!existing) {
        await db.insert(templateRequirements).values({
          templateId: template.id,
          requirementItemId: reqItem.id,
          required: reqItem.required ?? true,
          sortOrder: i + 1
        });
        insertedCount++;
      }
    }
  }
  
  return insertedCount;
}

/**
 * Run all seed operations
 */
export async function runAllSeeds(): Promise<{
  requirementItems: number;
  templates: number;
  mappings: number;
}> {
  const requirementItemsCount = await seedRequirementItemsData();
  const templatesCount = await seedDiligenceTemplatesData();
  const mappingsCount = await seedTemplateRequirementMappings();
  
  return {
    requirementItems: requirementItemsCount,
    templates: templatesCount,
    mappings: mappingsCount
  };
}
