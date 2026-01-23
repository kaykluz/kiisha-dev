import { eq, and, desc, asc, sql, inArray, isNull, isNotNull, or, like, lt, gt, gte, lte, ne, notInArray, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema";
import { 
  InsertUser, users, 
  organizations, organizationMembers, InsertOrganizationMember,
  portfolios, projects, projectMembers, InsertProjectMember,
  documents, documentVersions, documentCategories, documentTypes,
  documentReviews, reviewerGroups, InsertDocumentReview,
  rfis, rfiComments, rfiDocuments, rfiChecklistLinks, rfiScheduleLinks, InsertRfi, InsertRfiComment,
  assetDetails, InsertAssetDetail,
  schedulePhases, scheduleItems, InsertScheduleItem,
  aiExtractions, InsertAiExtraction,
  closingChecklists, closingChecklistItems, checklistItemDocuments, InsertClosingChecklist, InsertClosingChecklistItem,
  alerts, InsertAlert,
  diligenceProgress,
  auditLog, InsertAuditLog,
  InsertDocument,
  // New tables for audit & patch
  ingestedFiles, extractedContent, InsertIngestedFile, InsertExtractedContent,
  entities, entityMentions, entityAliases, InsertEntity, InsertEntityMention, InsertEntityAlias,
  crossReferences, InsertCrossReference,
  vatrAssets, vatrSourceDocuments, vatrAuditLog, vatrVerifications,
  InsertVatrAsset, InsertVatrSourceDocument, InsertVatrAuditLogEntry, InsertVatrVerification,
  generatedReports, complianceItems, complianceAlerts, InsertGeneratedReport, InsertComplianceItem, InsertComplianceAlert,
  dataRooms, dataRoomItems, dataRoomAccessLog, InsertDataRoom, InsertDataRoomItem, InsertDataRoomAccessLogEntry,
  whatsappConfigs, whatsappMessages, whatsappSenderMappings, whatsappTemplates,
  emailConfigs, apiKeys, apiRequestLog,
  InsertWhatsappConfig, InsertWhatsappMessage, InsertWhatsappSenderMapping, InsertWhatsappTemplate,
  InsertEmailConfig, InsertApiKey, InsertApiRequestLogEntry,
  // Comments
  comments, commentMentions, InsertComment, InsertCommentMention,
  // User Activity Log
  userActivityLog, InsertUserActivityLog,
  // VATR Hierarchical Model & CMMS
  sites, systems, assets, assetComponents, assetAttributes, attributeChangeLog,
  maintenanceSchedules, workOrders, workOrderTasks, spareParts, partsUsage,
  InsertSite, InsertSystem, InsertAsset, InsertAssetComponent, InsertAssetAttribute,
  InsertMaintenanceSchedule, InsertWorkOrder, InsertWorkOrderTask, InsertSparePart,
  // Universal Artifact Architecture
  artifacts, artifactImages, artifactAudio, artifactVideo, artifactMessages, artifactMeetings,
  artifactContracts, contractObligations, contractAmendments,
  artifactExtractions, artifactEntityMentions,
  lifecycleStages, stageAttributeDefinitions, assetLifecycleTracking, stageMilestoneCompletions, stageTransitionHistory,
  InsertArtifact, InsertArtifactImage, InsertArtifactAudio, InsertArtifactVideo, InsertArtifactMessage,
  InsertArtifactMeeting, InsertArtifactContract, InsertContractObligation, InsertContractAmendment,
  InsertArtifactExtraction, InsertArtifactEntityMention,
  InsertLifecycleStage, InsertStageAttributeDefinition, InsertAssetLifecycleTracking, InsertStageMilestoneCompletion, InsertStageTransitionHistory,
  // Data Immutability + View Scoping
  viewScopes, viewItems, viewFieldOverrides, assetFieldHistory, documentArchiveHistory, exportManifests,
  InsertViewScope, InsertViewItem, InsertViewFieldOverride, InsertAssetFieldHistory, InsertDocumentArchiveHistory, InsertExportManifest,
  // Portfolio Views for view-scoping
  portfolioViews, viewAssets, InsertPortfolioView, InsertViewAsset,
  // Conversational Agent tables
  userIdentifiers, unclaimedInbound, conversationSessions, attachmentLinks,
  InsertUserIdentifier, InsertUnclaimedInbound, InsertConversationSession, InsertAttachmentLink,
  // Email Verification
  emailVerifications, InsertEmailVerification,
  // Background Jobs
  jobs, jobLogs, fileUploads, Job,
  InsertJob, InsertJobLog, InsertFileUpload,
  // View Preferences
  userViewPreferences, InsertUserViewPreference,
  // View Management System
  teams, departments, teamMembers, departmentMembers, organizationSuperusers,
  viewShares, viewTemplates, viewAnalytics, viewPushes, viewHides, viewManagementAuditLog,
  InsertTeam, InsertDepartment, InsertTeamMember, InsertDepartmentMember, InsertOrganizationSuperuser,
  InsertViewShare, InsertViewTemplate, InsertViewAnalytic, InsertViewPush, InsertViewHide, InsertViewManagementAuditLogEntry,
  // Requests + Scoped Submissions System
  requestTemplates, requirementsSchemas, requests, requestRecipients,
  responseWorkspaces, workspaceAssets, workspaceAnswers, workspaceDocuments,
  submissions, snapshots, scopedGrants, signOffRequirements, signOffEvents,
  requestClarifications, requestAuditLog,
  InsertRequestTemplate, InsertRequirementsSchema, InsertRequest, InsertRequestRecipient,
  InsertResponseWorkspace, InsertWorkspaceAsset, InsertWorkspaceAnswer, InsertWorkspaceDocument,
  InsertSubmission, InsertSnapshot, InsertScopedGrant, InsertSignOffRequirement, InsertSignOffEvent,
  InsertRequestClarification, InsertRequestAuditLogEntry,
  // Versioned Views + Sharing + Managed Updates
  viewTemplatesV2, viewTemplateVersions, viewInstances, viewUpdateRollouts, viewInstanceUpdateReceipts, viewVersionAuditLog,
  InsertViewTemplateV2, InsertViewTemplateVersion, InsertViewInstance, InsertViewUpdateRollout, InsertViewInstanceUpdateReceipt, InsertViewVersionAuditLogEntry,
  // Evidence Grounding
  evidenceRefs, evidenceAuditLog, InsertEvidenceRef, InsertEvidenceAuditLogEntry, EvidenceRef,
  // Phase 32: Org Isolation + Secure Onboarding
  inviteTokens, inviteTokenRedemptions, whatsappBindingTokens,
  securityAuditLog, superuserElevations, crossOrgShareTokens, crossOrgShareAccessLog,
  kiishaLobbyConfig, accessRequests, userSessions,
  InsertInviteToken, InsertInviteTokenRedemption, InsertWhatsappBindingToken,
  InsertSecurityAuditLogEntry, InsertSuperuserElevation, InsertCrossOrgShareToken, InsertCrossOrgShareAccessLogEntry,
  InsertKiishaLobbyConfig, InsertAccessRequest, InsertUserSession,
  // Phase 33: Multi-Org Workspace Switching
  userWorkspacePreferences, workspaceBindingCodes, workspaceSwitchAuditLog,
  InsertUserWorkspacePreference, InsertWorkspaceBindingCode, InsertWorkspaceSwitchAuditEntry,
  // Phase 34: Org Preferences & Field Packs
  orgPreferences, orgPreferenceVersions, fieldPacks, aiSetupProposals, userViewCustomizations, pushUpdateNotifications,
  InsertOrgPreference, InsertOrgPreferenceVersion, InsertFieldPack, InsertAiSetupProposal, InsertUserViewCustomization, InsertPushUpdateNotification,
  OrgPreference, FieldPack, AiSetupProposal,
  // Phase 35: Authentication-First Access
  serverSessions, userLastContext, userMfaConfig, authAuditLog, loginAttempts,
  InsertServerSession, InsertUserLastContext, InsertUserMfaConfig, InsertAuthAuditLog, InsertLoginAttempt,
  ServerSession, UserMfaConfig, AuthAuditLog,
  // Phase 36: Obligations + Calendar Lens + Notifications
  obligations, obligationLinks, obligationAssignments, obligationAuditLog,
  reminderPolicies, escalationPolicies, notificationEvents,
  externalCalendarBindings, externalCalendarEvents, obligationViewOverlays,
  InsertObligation, InsertObligationLink, InsertObligationAssignment, InsertObligationAuditLog,
  InsertReminderPolicy, InsertEscalationPolicy, InsertNotificationEvent,
  InsertExternalCalendarBinding, InsertExternalCalendarEvent, InsertObligationViewOverlay,
  Obligation, ObligationLink, ObligationAssignment, ReminderPolicy, EscalationPolicy, NotificationEvent,
  ExternalCalendarBinding, ExternalCalendarEvent,
  // Password Reset
  passwordResetTokens, InsertPasswordResetToken, PasswordResetToken,
  // Phase 38: Email Templates, Reminders, Bulk Import
  emailTemplates, requestReminders, reminderSettings, assetImportJobs, assetImportTemplates,
  InsertEmailTemplate, InsertRequestReminder, InsertReminderSettings, InsertAssetImportJob, InsertAssetImportTemplate,
  EmailTemplate, RequestReminder, ReminderSettings, AssetImportJob, AssetImportTemplate,
  // Phase 39: Multi-Provider OAuth
  oauthAccounts, oauthProviderConfigs, emailVerificationTokens,
  InsertOAuthAccount, InsertOAuthProviderConfig, InsertEmailVerificationToken,
  OAuthAccount, OAuthProviderConfig, EmailVerificationToken,
  // Login Activity
  loginActivity, InsertLoginActivity, LoginActivity
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, { schema, mode: "default" });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER MANAGEMENT ============
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(users.name);
}

// ============ LOCAL AUTHENTICATION ============
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role?: 'user' | 'admin';
  userType?: 'operations_manager' | 'field_coordinator' | 'portfolio_manager' | 'investor' | 'technical_advisor';
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Generate a unique openId for local users
  const openId = `local_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const result = await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: 'local',
    role: data.role || 'user',
    userType: data.userType || 'operations_manager',
  });
  
  return { id: Number(result[0].insertId), openId };
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
  
  return true;
}

export async function updateUserTotp(userId: number, totpSecret: string | null, enabled: boolean) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ totpSecret, totpEnabled: enabled })
    .where(eq(users.id, userId));
  
  return true;
}

export async function getUserTotpSecret(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ totpSecret: users.totpSecret })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result.length > 0 ? result[0].totpSecret : null;
}

// ============ PERMISSIONS ============
export type UserRole = 'admin' | 'editor' | 'reviewer' | 'investor_viewer';

export async function getUserProjectRole(userId: number, projectId: number): Promise<UserRole | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check project-level membership first
  const projectMember = await db.select()
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);
  
  if (projectMember.length > 0) {
    return projectMember[0].role as UserRole;
  }
  
  // Check organization-level membership
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (project.length > 0 && project[0].organizationId) {
    const orgMember = await db.select()
      .from(organizationMembers)
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.organizationId, project[0].organizationId)))
      .limit(1);
    
    if (orgMember.length > 0) {
      return orgMember[0].role as UserRole;
    }
  }
  
  return null;
}

export async function canUserAccessProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role !== null;
}

export async function canUserEditProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'admin' || role === 'editor';
}

export async function canUserReviewProject(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'admin' || role === 'editor' || role === 'reviewer';
}

export async function isInvestorViewer(userId: number, projectId: number): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === 'investor_viewer';
}

// ============ R2/R3: RBAC FIELD POLICY (Contract Enforcement) ============

/**
 * VATR cluster definitions with sensitivity levels
 * R2: Views are a lens, RBAC determines what's allowed
 * R3: full mode = RBAC-allowed fields, not VATR superset
 */
const VATR_CLUSTERS = {
  identity: { sensitivity: 'public', fields: ['name', 'assetType', 'location', 'coordinates', 'capacity', 'status'] },
  technical: { sensitivity: 'internal', fields: ['specifications', 'equipment', 'performance', 'efficiency', 'degradation'] },
  operational: { sensitivity: 'internal', fields: ['operationalStatus', 'availability', 'maintenanceSchedule', 'incidents'] },
  financial: { sensitivity: 'confidential', fields: ['revenue', 'costs', 'margins', 'projections', 'valuations', 'contracts'] },
  compliance: { sensitivity: 'restricted', fields: ['permits', 'certifications', 'audits', 'violations', 'remediation'] },
  commercial: { sensitivity: 'confidential', fields: ['customers', 'contracts', 'pricing', 'negotiations', 'pipeline'] },
} as const;

type VatrCluster = keyof typeof VATR_CLUSTERS;
type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Role-based sensitivity access matrix
 * R3: investor_viewer cannot see financial/commercial even in full mode
 */
const ROLE_SENSITIVITY_ACCESS: Record<UserRole, SensitivityLevel[]> = {
  admin: ['public', 'internal', 'confidential', 'restricted'],
  editor: ['public', 'internal', 'confidential', 'restricted'],
  reviewer: ['public', 'internal', 'confidential'],
  investor_viewer: ['public', 'internal'], // Cannot see financial/commercial
};

/**
 * R2: Get RBAC-allowed fields for a user on a project
 * This is computed AFTER view selection, not before
 * View only affects display layout, not access
 */
export async function getRbacAllowedFields(
  userId: number,
  projectId: number
): Promise<{ cluster: VatrCluster; fields: string[] }[]> {
  const role = await getUserProjectRole(userId, projectId);
  if (!role) return [];
  
  const allowedSensitivities = ROLE_SENSITIVITY_ACCESS[role];
  const result: { cluster: VatrCluster; fields: string[] }[] = [];
  
  for (const [cluster, config] of Object.entries(VATR_CLUSTERS)) {
    if (allowedSensitivities.includes(config.sensitivity as SensitivityLevel)) {
      result.push({
        cluster: cluster as VatrCluster,
        fields: config.fields as unknown as string[],
      });
    }
  }
  
  return result;
}

/**
 * R2: Apply RBAC filtering to VATR data AFTER view selection
 * Pipeline: (1) select view → (2) compute RBAC → (3) filter/redact → (4) render
 * 
 * @param data - Raw VATR data from database
 * @param allowedFields - RBAC-computed allowed fields
 * @param redactMode - 'omit' (preferred for safety) or 'redact' (preferred for explainability)
 */
export function applyRbacToVatrData<T extends Record<string, unknown>>(
  data: T,
  allowedFields: { cluster: VatrCluster; fields: string[] }[],
  redactMode: 'omit' | 'redact' = 'omit'
): T | { _rbacRedacted: true; _message: string } {
  const allowedFieldSet = new Set<string>();
  for (const { cluster, fields } of allowedFields) {
    for (const field of fields) {
      allowedFieldSet.add(`${cluster}.${field}`);
    }
  }
  
  // Check if ALL fields are forbidden
  const dataFields = Object.keys(data).filter(k => !k.startsWith('_'));
  const hasAnyAllowed = dataFields.some(field => {
    const [cluster, fieldName] = field.split('.');
    return allowedFieldSet.has(`${cluster}.${fieldName}`) || 
           // Also allow non-cluster fields (id, timestamps, etc.)
           !Object.keys(VATR_CLUSTERS).includes(cluster);
  });
  
  if (!hasAnyAllowed && dataFields.length > 0) {
    // R2: "No authorized fields in this view" case
    return { _rbacRedacted: true, _message: 'No authorized fields in this view' } as unknown as T;
  }
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Always include non-cluster fields (id, timestamps, metadata)
    if (!key.includes('.')) {
      result[key] = value;
      continue;
    }
    
    const [cluster, fieldName] = key.split('.');
    const fieldKey = `${cluster}.${fieldName}`;
    
    if (allowedFieldSet.has(fieldKey)) {
      result[key] = value;
    } else if (redactMode === 'redact') {
      result[key] = { _redacted: true, _reason: 'insufficient_permissions' };
    }
    // If 'omit' mode, field is simply not included
  }
  
  return result as T;
}

/**
 * R3: Get all fields allowed by RBAC for "full" mode
 * full = RBAC-allowed set, NOT VATR superset
 */
export async function getFullModeFields(
  userId: number,
  projectId: number
): Promise<string[]> {
  const allowedClusters = await getRbacAllowedFields(userId, projectId);
  const fields: string[] = [];
  
  for (const { cluster, fields: clusterFields } of allowedClusters) {
    for (const field of clusterFields) {
      fields.push(`${cluster}.${field}`);
    }
  }
  
  return fields;
}

/**
 * R3: Progressive disclosure mode field sets
 * summary = minimal safe subset (always public)
 * expanded = more operational context (public + internal if allowed)
 * full = all RBAC-allowed fields
 */
export async function getFieldsForDisclosureMode(
  userId: number,
  projectId: number,
  mode: 'summary' | 'expanded' | 'full'
): Promise<string[]> {
  const role = await getUserProjectRole(userId, projectId);
  if (!role) return [];
  
  const allowedSensitivities = ROLE_SENSITIVITY_ACCESS[role];
  const fields: string[] = [];
  
  // Summary: only public fields
  const summaryLevels: SensitivityLevel[] = ['public'];
  // Expanded: public + internal (if allowed)
  const expandedLevels: SensitivityLevel[] = allowedSensitivities.includes('internal') 
    ? ['public', 'internal'] 
    : ['public'];
  // Full: all RBAC-allowed
  const fullLevels = allowedSensitivities;
  
  const targetLevels = mode === 'summary' ? summaryLevels 
    : mode === 'expanded' ? expandedLevels 
    : fullLevels;
  
  for (const [cluster, config] of Object.entries(VATR_CLUSTERS)) {
    if (targetLevels.includes(config.sensitivity as SensitivityLevel)) {
      for (const field of config.fields) {
        fields.push(`${cluster}.${field}`);
      }
    }
  }
  
  return fields;
}

export async function addProjectMember(data: InsertProjectMember) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(projectMembers).values(data);
  return result;
}

export async function addOrganizationMember(data: InsertOrganizationMember) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(organizationMembers).values(data);
  return result;
}

export async function getOrganizationMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
}

// ============ PROJECTS ============

// Get all organization IDs a user belongs to
export async function getUserOrganizationIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  const memberships = await db.select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  
  return memberships.map(m => m.organizationId);
}

export async function getProjectsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all projects user has access to via project or org membership
  const projectMemberships = await db.select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  
  const orgMemberships = await db.select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  
  const projectIds = projectMemberships.map(p => p.projectId);
  const orgIds = orgMemberships.map(o => o.organizationId);
  
  // PRODUCTION: Return empty array if user has no memberships
  // Admin users should be handled at the router level before calling this
  if (projectIds.length === 0 && orgIds.length === 0) {
    return [];
  }
  
  return db.select().from(projects)
    .where(or(
      projectIds.length > 0 ? inArray(projects.id, projectIds) : undefined,
      orgIds.length > 0 ? inArray(projects.organizationId, orgIds) : undefined
    ))
    .orderBy(projects.name);
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProjectByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.code, code)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(projects.name);
}

// ============ DOCUMENTS ============
export async function getDocumentsByProject(projectId: number, isInvestorViewer: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(documents).where(eq(documents.projectId, projectId));
  
  if (isInvestorViewer) {
    query = db.select().from(documents).where(
      and(eq(documents.projectId, projectId), eq(documents.isInternalOnly, false))
    );
  }
  
  return query.orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentDocuments(projectId: number | undefined, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  if (projectId) {
    return db.select().from(documents)
      .where(eq(documents.projectId, projectId))
      .orderBy(desc(documents.createdAt))
      .limit(limit);
  }
  
  return db.select().from(documents)
    .orderBy(desc(documents.createdAt))
    .limit(limit);
}

export async function createDocument(data: InsertDocument): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(documents).values(data);
  return result[0]?.insertId || null;
}

export async function updateDocumentStatus(id: number, status: string, verifiedById?: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(documents)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(documents.id, id));
}

export async function getAllDocumentCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentCategories).orderBy(documentCategories.sortOrder);
}

export async function getAllDocumentTypes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentTypes).orderBy(documentTypes.sortOrder);
}

// ============ DOCUMENT REVIEWS ============
export async function getDocumentReviews(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentReviews).where(eq(documentReviews.documentId, documentId));
}

export async function createDocumentReview(data: InsertDocumentReview) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(documentReviews).values(data);
}

export async function updateDocumentReview(id: number, status: string, reviewerId: number, notes?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(documentReviews)
    .set({ 
      status: status as any, 
      reviewerId, 
      notes: notes || null,
      reviewedAt: new Date(),
      updatedAt: new Date() 
    })
    .where(eq(documentReviews.id, id));
}

export async function getReviewerGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewerGroups).orderBy(reviewerGroups.sortOrder);
}

export async function getAggregatedDocumentStatus(documentId: number): Promise<string> {
  const db = await getDb();
  if (!db) return 'pending';
  
  const reviews = await db.select().from(documentReviews).where(eq(documentReviews.documentId, documentId));
  
  if (reviews.length === 0) return 'unverified';
  
  const statuses = reviews.map(r => r.status);
  
  if (statuses.every(s => s === 'approved')) return 'verified';
  if (statuses.some(s => s === 'rejected')) return 'rejected';
  if (statuses.some(s => s === 'needs_revision')) return 'pending';
  
  return 'pending';
}

// ============ RFIS / WORKSPACE ITEMS ============
export async function getRfisByProject(projectId: number, isInvestorViewer: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  if (isInvestorViewer) {
    return db.select().from(rfis)
      .where(and(eq(rfis.projectId, projectId), eq(rfis.isInternalOnly, false)))
      .orderBy(desc(rfis.createdAt));
  }
  
  return db.select().from(rfis)
    .where(eq(rfis.projectId, projectId))
    .orderBy(desc(rfis.createdAt));
}

export async function getAllRfis(isInvestorViewer: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  if (isInvestorViewer) {
    return db.select().from(rfis)
      .where(eq(rfis.isInternalOnly, false))
      .orderBy(desc(rfis.createdAt));
  }
  
  return db.select().from(rfis).orderBy(desc(rfis.createdAt));
}

export async function getRfisForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get projects user has access to
  const userProjects = await getProjectsForUser(userId);
  const projectIds = userProjects.map(p => p.id);
  
  if (projectIds.length === 0) return [];
  
  return db.select().from(rfis)
    .where(inArray(rfis.projectId, projectIds))
    .orderBy(desc(rfis.createdAt));
}

export async function getRfiById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(rfis).where(eq(rfis.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentRfis(projectId: number | undefined, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  if (projectId) {
    return db.select().from(rfis)
      .where(eq(rfis.projectId, projectId))
      .orderBy(desc(rfis.createdAt))
      .limit(limit);
  }
  
  return db.select().from(rfis)
    .orderBy(desc(rfis.createdAt))
    .limit(limit);
}

export async function createRfi(data: InsertRfi) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(rfis).values(data);
}

export async function updateRfi(id: number, data: Partial<InsertRfi>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(rfis).set({ ...data, updatedAt: new Date() }).where(eq(rfis.id, id));
}

export async function getRfiComments(rfiId: number, isInvestorViewer: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  if (isInvestorViewer) {
    return db.select().from(rfiComments)
      .where(and(eq(rfiComments.rfiId, rfiId), eq(rfiComments.isInternalOnly, false)))
      .orderBy(rfiComments.createdAt);
  }
  
  return db.select().from(rfiComments)
    .where(eq(rfiComments.rfiId, rfiId))
    .orderBy(rfiComments.createdAt);
}

export async function createRfiComment(data: InsertRfiComment) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(rfiComments).values(data);
}

export async function linkRfiToDocument(rfiId: number, documentId: number, createdBy?: number) {
  const db = await getDb();
  if (!db) return null;
  // Use onConflictDoNothing for idempotent duplicate handling
  return db.insert(rfiDocuments).values({ rfiId, documentId, createdBy }).onDuplicateKeyUpdate({ set: { rfiId } });
}

export async function linkRfiToChecklist(rfiId: number, checklistItemId: number, createdBy?: number) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(rfiChecklistLinks).values({ rfiId, checklistItemId, createdBy }).onDuplicateKeyUpdate({ set: { rfiId } });
}

export async function linkRfiToSchedule(rfiId: number, scheduleItemId: number, createdBy?: number) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(rfiScheduleLinks).values({ rfiId, scheduleItemId, createdBy }).onDuplicateKeyUpdate({ set: { rfiId } });
}

export async function getRfiLinkedDocuments(rfiId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ documentId: rfiDocuments.documentId })
    .from(rfiDocuments)
    .where(eq(rfiDocuments.rfiId, rfiId));
}

export async function getRfiLinkedChecklists(rfiId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ checklistItemId: rfiChecklistLinks.checklistItemId })
    .from(rfiChecklistLinks)
    .where(eq(rfiChecklistLinks.rfiId, rfiId));
}

export async function getRfiLinkedSchedules(rfiId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ scheduleItemId: rfiScheduleLinks.scheduleItemId })
    .from(rfiScheduleLinks)
    .where(eq(rfiScheduleLinks.rfiId, rfiId));
}

export async function deleteRfi(id: number) {
  const db = await getDb();
  if (!db) return null;
  // Delete linked items first
  await db.delete(rfiDocuments).where(eq(rfiDocuments.rfiId, id));
  await db.delete(rfiChecklistLinks).where(eq(rfiChecklistLinks.rfiId, id));
  await db.delete(rfiScheduleLinks).where(eq(rfiScheduleLinks.rfiId, id));
  await db.delete(rfiComments).where(eq(rfiComments.rfiId, id));
  // Delete the RFI
  return db.delete(rfis).where(eq(rfis.id, id));
}

export async function unlinkRfiFromDocument(rfiId: number, documentId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(rfiDocuments).where(
    and(eq(rfiDocuments.rfiId, rfiId), eq(rfiDocuments.documentId, documentId))
  );
}

export async function unlinkRfiFromChecklist(rfiId: number, checklistItemId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(rfiChecklistLinks).where(
    and(eq(rfiChecklistLinks.rfiId, rfiId), eq(rfiChecklistLinks.checklistItemId, checklistItemId))
  );
}

export async function unlinkRfiFromSchedule(rfiId: number, scheduleItemId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(rfiScheduleLinks).where(
    and(eq(rfiScheduleLinks.rfiId, rfiId), eq(rfiScheduleLinks.scheduleItemId, scheduleItemId))
  );
}

// ============ ASSET DETAILS ============
export async function getAssetDetailsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assetDetails)
    .where(eq(assetDetails.projectId, projectId))
    .orderBy(assetDetails.category, assetDetails.subcategory, assetDetails.fieldName);
}

export async function createAssetDetail(data: InsertAssetDetail) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(assetDetails).values(data);
}

export async function updateAssetDetail(id: number, data: Partial<InsertAssetDetail>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(assetDetails).set({ ...data, updatedAt: new Date() }).where(eq(assetDetails.id, id));
}

export async function verifyAssetDetail(id: number, verifiedById: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(assetDetails)
    .set({ isVerified: true, verifiedById, verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(assetDetails.id, id));
}

// ============ SCHEDULE ============
export async function getSchedulePhases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schedulePhases).orderBy(schedulePhases.sortOrder);
}

export async function getScheduleItemsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduleItems)
    .where(eq(scheduleItems.projectId, projectId))
    .orderBy(scheduleItems.startDate);
}

export async function getScheduleItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(scheduleItems).where(eq(scheduleItems.id, id));
  return results[0] || null;
}

export async function createScheduleItem(data: InsertScheduleItem) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(scheduleItems).values(data);
}

export async function updateScheduleItem(id: number, data: Partial<InsertScheduleItem>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(scheduleItems).set({ ...data, updatedAt: new Date() }).where(eq(scheduleItems.id, id));
}

// ============ AI EXTRACTIONS ============
export async function getAiExtractionsByDocument(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiExtractions)
    .where(eq(aiExtractions.documentId, documentId))
    .orderBy(aiExtractions.category, aiExtractions.fieldName);
}

export async function createAiExtraction(data: InsertAiExtraction): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiExtractions).values(data);
  return result[0]?.insertId || null;
}

export async function verifyAiExtraction(id: number, status: 'accepted' | 'rejected', reviewedById: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(aiExtractions)
    .set({ status, reviewedById, reviewedAt: new Date() })
    .where(eq(aiExtractions.id, id));
}

export async function getUnverifiedExtractionCount(documentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(aiExtractions)
    .where(and(eq(aiExtractions.documentId, documentId), eq(aiExtractions.status, 'unverified')));
  return result[0]?.count || 0;
}

// ============ CLOSING CHECKLISTS ============
export async function getChecklistsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(closingChecklists)
    .where(eq(closingChecklists.projectId, projectId))
    .orderBy(desc(closingChecklists.createdAt));
}

export async function getChecklistById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(closingChecklists).where(eq(closingChecklists.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createChecklist(data: InsertClosingChecklist) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(closingChecklists).values(data);
}

export async function updateChecklist(id: number, data: Partial<InsertClosingChecklist>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(closingChecklists).set({ ...data, updatedAt: new Date() }).where(eq(closingChecklists.id, id));
}

export async function getChecklistItems(checklistId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(closingChecklistItems)
    .where(eq(closingChecklistItems.checklistId, checklistId))
    .orderBy(closingChecklistItems.sortOrder);
}

export async function getChecklistItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(closingChecklistItems).where(eq(closingChecklistItems.id, id));
  return results[0] || null;
}

export async function createChecklistItem(data: InsertClosingChecklistItem) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(closingChecklistItems).values(data);
}

export async function updateChecklistItem(id: number, data: Partial<InsertClosingChecklistItem>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(closingChecklistItems).set({ ...data, updatedAt: new Date() }).where(eq(closingChecklistItems.id, id));
}

export async function deleteChecklistItem(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(closingChecklistItems).where(eq(closingChecklistItems.id, id));
}

export async function linkChecklistItemToDocument(checklistItemId: number, documentId: number, createdBy?: number) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(checklistItemDocuments).values({ checklistItemId, documentId, createdBy }).onDuplicateKeyUpdate({ set: { checklistItemId } });
}

export async function unlinkChecklistItemFromDocument(checklistItemId: number, documentId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(checklistItemDocuments).where(
    and(eq(checklistItemDocuments.checklistItemId, checklistItemId), eq(checklistItemDocuments.documentId, documentId))
  );
}

export async function getChecklistItemDocuments(checklistItemId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ documentId: checklistItemDocuments.documentId })
    .from(checklistItemDocuments)
    .where(eq(checklistItemDocuments.checklistItemId, checklistItemId));
}

export async function getChecklistProgress(checklistId: number) {
  const db = await getDb();
  if (!db) return { total: 0, completed: 0, missing: 0, blocked: 0 };
  
  const items = await db.select().from(closingChecklistItems)
    .where(eq(closingChecklistItems.checklistId, checklistId));
  
  const total = items.filter(i => i.isRequired).length;
  const completed = items.filter(i => i.status === 'completed').length;
  const missing = items.filter(i => i.status === 'not_started' && i.isRequired).length;
  const blocked = items.filter(i => i.status === 'blocked').length;
  
  return { total, completed, missing, blocked };
}

export async function getWhatsNextForChecklist(checklistId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(closingChecklistItems)
    .where(and(
      eq(closingChecklistItems.checklistId, checklistId),
      inArray(closingChecklistItems.status, ['not_started', 'in_progress', 'pending_review'])
    ))
    .orderBy(closingChecklistItems.dueDate, closingChecklistItems.sortOrder)
    .limit(10);
}

// ============ ALERTS / NOTIFICATIONS ============
export async function getAlertsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isDismissed, false)))
    .orderBy(desc(alerts.createdAt))
    .limit(50);
}

export async function getUnreadAlertCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false), eq(alerts.isDismissed, false)));
  return result[0]?.count || 0;
}

export async function createAlert(data: InsertAlert) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(alerts).values(data);
}

export async function markAlertAsRead(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alerts).set({ isRead: true }).where(eq(alerts.id, id));
}

export async function dismissAlert(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alerts).set({ isDismissed: true }).where(eq(alerts.id, id));
}

export async function markAllAlertsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alerts).set({ isRead: true }).where(eq(alerts.userId, userId));
}

// ============ AUDIT LOG ============
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(auditLog).values(data);
}

export async function getAuditLogForEntity(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog)
    .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt));
}

// ============ DILIGENCE PROGRESS ============
export async function getDiligenceProgress(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(diligenceProgress).where(eq(diligenceProgress.projectId, projectId));
}

export async function updateDiligenceProgress(projectId: number, category: 'technical' | 'commercial' | 'legal', totalItems: number, completedItems: number, verifiedItems: number) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db.select().from(diligenceProgress)
    .where(and(eq(diligenceProgress.projectId, projectId), eq(diligenceProgress.category, category)))
    .limit(1);
  
  if (existing.length > 0) {
    return db.update(diligenceProgress)
      .set({ totalItems, completedItems, verifiedItems, updatedAt: new Date() })
      .where(eq(diligenceProgress.id, existing[0].id));
  } else {
    return db.insert(diligenceProgress).values({ projectId, category, totalItems, completedItems, verifiedItems });
  }
}


// ============ OVERDUE ITEMS ============
export async function getOverdueScheduleItems(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(scheduleItems)
    .where(and(
      eq(scheduleItems.projectId, projectId),
      lt(scheduleItems.targetEndDate, now),
      inArray(scheduleItems.status, ['not_started', 'in_progress'])
    ));
}

export async function getOverdueRfis(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(rfis)
    .where(and(
      eq(rfis.projectId, projectId),
      lt(rfis.dueDate, now),
      inArray(rfis.status, ['open', 'in_progress'])
    ));
}

export async function getOverdueChecklistItems(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  
  // Get all checklists for this project
  const projectChecklists = await db.select({ id: closingChecklists.id })
    .from(closingChecklists)
    .where(eq(closingChecklists.projectId, projectId));
  
  if (projectChecklists.length === 0) return [];
  
  const checklistIds = projectChecklists.map(c => c.id);
  
  return db.select().from(closingChecklistItems)
    .where(and(
      inArray(closingChecklistItems.checklistId, checklistIds),
      lt(closingChecklistItems.dueDate, now),
      inArray(closingChecklistItems.status, ['not_started', 'in_progress', 'pending_review'])
    ));
}


// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 1: INGEST ANYTHING (Universal Capture)
// ═══════════════════════════════════════════════════════════════

export async function createIngestedFile(data: InsertIngestedFile) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(ingestedFiles).values(data);
  return result;
}

export async function getIngestedFileById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ingestedFiles).where(eq(ingestedFiles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getIngestedFilesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ingestedFiles)
    .where(eq(ingestedFiles.projectId, projectId))
    .orderBy(desc(ingestedFiles.ingestedAt));
}

export async function updateIngestedFileStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'failed', error?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(ingestedFiles)
    .set({ processingStatus: status, processingError: error })
    .where(eq(ingestedFiles.id, id));
}

export async function createExtractedContent(data: InsertExtractedContent) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(extractedContent).values(data);
}

export async function getExtractedContentByFile(fileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(extractedContent)
    .where(eq(extractedContent.fileId, fileId))
    .orderBy(extractedContent.pageNumber);
}

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 2: UNDERSTAND EVERYTHING (Entity Resolution)
// ═══════════════════════════════════════════════════════════════

export async function createEntity(data: InsertEntity) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(entities).values(data);
}

export async function getEntityById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getEntitiesByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entities)
    .where(eq(entities.organizationId, organizationId))
    .orderBy(entities.canonicalName);
}

export async function getEntitiesByType(organizationId: number, entityType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entities)
    .where(and(eq(entities.organizationId, organizationId), eq(entities.entityType, entityType as any)))
    .orderBy(entities.canonicalName);
}

export async function searchEntities(organizationId: number, searchTerm: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entities)
    .where(and(
      eq(entities.organizationId, organizationId),
      like(entities.canonicalName, `%${searchTerm}%`)
    ))
    .limit(20);
}

export async function createEntityMention(data: InsertEntityMention) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(entityMentions).values(data);
}

export async function getEntityMentionsByFile(fileId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entityMentions)
    .where(eq(entityMentions.fileId, fileId))
    .orderBy(entityMentions.sourcePage);
}

export async function getEntityMentionsByEntity(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entityMentions)
    .where(eq(entityMentions.entityId, entityId))
    .orderBy(desc(entityMentions.createdAt));
}

export async function resolveEntityMention(mentionId: number, entityId: number, resolvedById: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(entityMentions)
    .set({ 
      entityId, 
      resolutionStatus: 'human_verified', 
      resolvedById, 
      resolvedAt: new Date() 
    })
    .where(eq(entityMentions.id, mentionId));
}

export async function getUnresolvedMentions(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get files for this org
  const orgFiles = await db.select({ id: ingestedFiles.id })
    .from(ingestedFiles)
    .where(eq(ingestedFiles.organizationId, organizationId));
  
  if (orgFiles.length === 0) return [];
  const fileIds = orgFiles.map(f => f.id);
  
  return db.select().from(entityMentions)
    .where(and(
      inArray(entityMentions.fileId, fileIds),
      eq(entityMentions.resolutionStatus, 'unresolved')
    ))
    .orderBy(desc(entityMentions.createdAt))
    .limit(100);
}

export async function createEntityAlias(data: InsertEntityAlias) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(entityAliases).values(data);
}

export async function getEntityAliases(entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entityAliases)
    .where(eq(entityAliases.entityId, entityId));
}

export async function createCrossReference(data: InsertCrossReference) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(crossReferences).values(data);
}

export async function getCrossReferencesByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crossReferences)
    .where(eq(crossReferences.projectId, projectId))
    .orderBy(desc(crossReferences.createdAt));
}

export async function getDiscrepancies(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crossReferences)
    .where(and(
      eq(crossReferences.projectId, projectId),
      eq(crossReferences.discrepancyDetected, true),
      eq(crossReferences.status, 'pending_review')
    ));
}

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 3: ANCHOR & VERIFY (VATR)
// ═══════════════════════════════════════════════════════════════

export async function createVatrAsset(data: InsertVatrAsset) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vatrAssets).values(data);
}

export async function getVatrAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vatrAssets).where(eq(vatrAssets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getVatrAssetsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatrAssets)
    .where(eq(vatrAssets.projectId, projectId))
    .orderBy(vatrAssets.assetName);
}

export async function getVatrAssetsByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatrAssets)
    .where(eq(vatrAssets.organizationId, organizationId))
    .orderBy(vatrAssets.assetName);
}

export async function updateVatrAsset(id: number, data: Partial<InsertVatrAsset>, previousHash: string, newHash: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current version
  const current = await getVatrAssetById(id);
  if (!current) return null;
  
  // Update with new version
  return db.update(vatrAssets)
    .set({ 
      ...data, 
      vatrVersion: (current.vatrVersion || 1) + 1,
      contentHash: newHash,
      previousVersionId: id,
      updatedAt: new Date()
    })
    .where(eq(vatrAssets.id, id));
}

export async function linkVatrSourceDocument(data: InsertVatrSourceDocument) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vatrSourceDocuments).values(data);
}

export async function getVatrSourceDocuments(vatrAssetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatrSourceDocuments)
    .where(eq(vatrSourceDocuments.vatrAssetId, vatrAssetId))
    .orderBy(vatrSourceDocuments.cluster, vatrSourceDocuments.fieldName);
}

export async function createVatrAuditLog(data: InsertVatrAuditLogEntry) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vatrAuditLog).values(data);
}

export async function getVatrAuditLog(vatrAssetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatrAuditLog)
    .where(eq(vatrAuditLog.vatrAssetId, vatrAssetId))
    .orderBy(desc(vatrAuditLog.actionTimestamp));
}

export async function createVatrVerification(data: InsertVatrVerification) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(vatrVerifications).values(data);
}

export async function getVatrVerifications(vatrAssetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vatrVerifications)
    .where(eq(vatrVerifications.vatrAssetId, vatrAssetId))
    .orderBy(desc(vatrVerifications.verifiedAt));
}

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 4: ACTIVATE (Compliance & Reports & Data Rooms)
// ═══════════════════════════════════════════════════════════════

export async function createGeneratedReport(data: InsertGeneratedReport) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(generatedReports).values(data);
}

export async function getGeneratedReports(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(generatedReports)
    .where(eq(generatedReports.projectId, projectId))
    .orderBy(desc(generatedReports.createdAt));
}

export async function updateReportStatus(id: number, status: 'generating' | 'completed' | 'failed', fileUrl?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(generatedReports)
    .set({ status, fileUrl, generatedAt: status === 'completed' ? new Date() : undefined })
    .where(eq(generatedReports.id, id));
}

export async function createComplianceItem(data: InsertComplianceItem) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(complianceItems).values(data);
}

export async function getComplianceItemsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(complianceItems)
    .where(eq(complianceItems.projectId, projectId))
    .orderBy(complianceItems.dueDate);
}

export async function getComplianceItemsByVatr(vatrAssetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(complianceItems)
    .where(eq(complianceItems.vatrAssetId, vatrAssetId))
    .orderBy(complianceItems.dueDate);
}

export async function getExpiringComplianceItems(organizationId: number, daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  return db.select().from(complianceItems)
    .where(and(
      eq(complianceItems.organizationId, organizationId),
      lt(complianceItems.dueDate, futureDate),
      inArray(complianceItems.status, ['active', 'expiring_soon'])
    ))
    .orderBy(complianceItems.dueDate);
}

export async function createComplianceAlert(data: InsertComplianceAlert) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(complianceAlerts).values(data);
}

export async function getOpenComplianceAlerts(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const orgItems = await db.select({ id: complianceItems.id })
    .from(complianceItems)
    .where(eq(complianceItems.organizationId, organizationId));
  
  if (orgItems.length === 0) return [];
  const itemIds = orgItems.map(i => i.id);
  
  return db.select().from(complianceAlerts)
    .where(and(
      inArray(complianceAlerts.complianceItemId, itemIds),
      eq(complianceAlerts.status, 'open')
    ))
    .orderBy(desc(complianceAlerts.triggeredAt));
}

export async function createDataRoom(data: InsertDataRoom) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(dataRooms).values(data);
}

export async function getDataRoomById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dataRooms).where(eq(dataRooms.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDataRoomByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(dataRooms).where(eq(dataRooms.accessToken, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDataRoomsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataRooms)
    .where(eq(dataRooms.projectId, projectId))
    .orderBy(desc(dataRooms.createdAt));
}

export async function addDataRoomItem(data: InsertDataRoomItem) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(dataRoomItems).values(data);
}

export async function getDataRoomItems(dataRoomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataRoomItems)
    .where(eq(dataRoomItems.dataRoomId, dataRoomId))
    .orderBy(dataRoomItems.category, dataRoomItems.sortOrder);
}

export async function logDataRoomAccess(data: InsertDataRoomAccessLogEntry) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(dataRoomAccessLog).values(data);
}

export async function getDataRoomAccessLog(dataRoomId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dataRoomAccessLog)
    .where(eq(dataRoomAccessLog.dataRoomId, dataRoomId))
    .orderBy(desc(dataRoomAccessLog.accessedAt));
}

// ═══════════════════════════════════════════════════════════════
// PRINCIPLE 5: MULTI-CHANNEL INTERFACE
// ═══════════════════════════════════════════════════════════════

export async function createWhatsappConfig(data: InsertWhatsappConfig) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(whatsappConfigs).values(data);
}

export async function getWhatsappConfig(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whatsappConfigs)
    .where(and(eq(whatsappConfigs.projectId, projectId), eq(whatsappConfigs.active, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createWhatsappMessage(data: InsertWhatsappMessage) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(whatsappMessages).values(data);
}

export async function getWhatsappMessages(projectId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappMessages)
    .where(eq(whatsappMessages.projectId, projectId))
    .orderBy(desc(whatsappMessages.receivedAt))
    .limit(limit);
}

export async function createEmailConfig(data: InsertEmailConfig) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(emailConfigs).values(data);
}

export async function getEmailConfig(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailConfigs)
    .where(and(eq(emailConfigs.projectId, projectId), eq(emailConfigs.active, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createApiKey(data: InsertApiKey) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(apiKeys).values(data);
}

export async function getApiKeyByPrefix(prefix: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getApiKeysByOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apiKeys)
    .where(and(eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

export async function logApiRequest(data: InsertApiRequestLogEntry) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(apiRequestLog).values(data);
}

export async function updateApiKeyLastUsed(id: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}


// ============ WHATSAPP BUSINESS API HELPERS ============

export async function getWhatsappConfigBySecret(webhookSecret: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whatsappConfigs)
    .where(and(eq(whatsappConfigs.webhookSecret, webhookSecret), eq(whatsappConfigs.active, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getWhatsappSenderMappings(configId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappSenderMappings)
    .where(eq(whatsappSenderMappings.configId, configId))
    .orderBy(desc(whatsappSenderMappings.createdAt));
}

export async function getWhatsappSenderMappingByPhone(configId: number, senderPhone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(whatsappSenderMappings)
    .where(and(
      eq(whatsappSenderMappings.configId, configId),
      eq(whatsappSenderMappings.senderPhone, senderPhone)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertWhatsappSenderMapping(data: InsertWhatsappSenderMapping) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if mapping exists
  const existing = await getWhatsappSenderMappingByPhone(data.configId, data.senderPhone);
  
  if (existing) {
    return db.update(whatsappSenderMappings)
      .set({
        senderName: data.senderName,
        projectId: data.projectId,
        siteId: data.siteId,
        defaultCategory: data.defaultCategory,
      })
      .where(eq(whatsappSenderMappings.id, existing.id));
  } else {
    return db.insert(whatsappSenderMappings).values(data);
  }
}

export async function getWhatsappTemplates(configId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(whatsappTemplates)
    .where(eq(whatsappTemplates.configId, configId))
    .orderBy(desc(whatsappTemplates.createdAt));
}

export async function createWhatsappTemplate(data: InsertWhatsappTemplate) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(whatsappTemplates).values(data);
}

export async function deleteWhatsappTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, templateId));
}


// ============ OPERATIONS MONITORING HELPERS ============

import {
  connectors, connectorCredentials, metricDefinitions, devices,
  rawMeasurements, normalizedMeasurements, derivedMetrics, dataLineage,
  alertRules, alertEvents, stakeholderPortals, operationsReports,
  InsertConnector, InsertConnectorCredential, InsertMetricDefinition, InsertDevice,
  InsertRawMeasurement, InsertNormalizedMeasurement, InsertDerivedMetric, InsertDataLineageEntry,
  InsertAlertRule, InsertAlertEvent, InsertStakeholderPortal, InsertOperationsReport
} from "../drizzle/schema";

// Connectors
export async function getConnectors(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectors)
    .where(eq(connectors.organizationId, organizationId))
    .orderBy(desc(connectors.createdAt));
}

export async function getConnectorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(connectors)
    .where(eq(connectors.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createConnector(data: InsertConnector) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(connectors).values(data);
  return result;
}

export async function updateConnectorStatus(id: number, status: string, errorMessage?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(connectors)
    .set({ 
      status: status as any,
      errorMessage,
      lastSyncAt: status === 'active' ? new Date() : undefined,
    })
    .where(eq(connectors.id, id));
}

// Devices
export async function getDevicesBySite(siteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(devices)
    .where(eq(devices.siteId, siteId))
    .orderBy(devices.name);
}

export async function getDeviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices)
    .where(eq(devices.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(devices).values(data);
}

export async function updateDeviceStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(devices)
    .set({ 
      status: status as any,
      lastSeenAt: new Date(),
    })
    .where(eq(devices.id, id));
}

// Metric Definitions
export async function getMetricDefinitions(organizationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId) {
    return db.select().from(metricDefinitions)
      .where(or(
        eq(metricDefinitions.organizationId, organizationId),
        eq(metricDefinitions.isStandard, true)
      ))
      .orderBy(metricDefinitions.category, metricDefinitions.name);
  }
  return db.select().from(metricDefinitions)
    .where(eq(metricDefinitions.isStandard, true))
    .orderBy(metricDefinitions.category, metricDefinitions.name);
}

export async function createMetricDefinition(data: InsertMetricDefinition) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(metricDefinitions).values(data);
}

// Raw Measurements
export async function insertRawMeasurements(data: InsertRawMeasurement[]) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(rawMeasurements).values(data);
}

export async function getRawMeasurements(deviceId: number, metricId: number, startTime: Date, endTime: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rawMeasurements)
    .where(and(
      eq(rawMeasurements.deviceId, deviceId),
      eq(rawMeasurements.metricId, metricId),
      gte(rawMeasurements.timestamp, startTime),
      lte(rawMeasurements.timestamp, endTime)
    ))
    .orderBy(rawMeasurements.timestamp);
}

// Normalized Measurements
export async function insertNormalizedMeasurement(data: InsertNormalizedMeasurement) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(normalizedMeasurements).values(data);
}

export async function getNormalizedMeasurements(
  siteId: number,
  metricId: number,
  periodType: string,
  startTime: Date,
  endTime: Date
) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(normalizedMeasurements)
    .where(and(
      eq(normalizedMeasurements.siteId, siteId),
      eq(normalizedMeasurements.metricId, metricId),
      eq(normalizedMeasurements.periodType, periodType as any),
      gte(normalizedMeasurements.periodStart, startTime),
      lte(normalizedMeasurements.periodEnd, endTime)
    ))
    .orderBy(normalizedMeasurements.periodStart);
}

// Derived Metrics
export async function insertDerivedMetric(data: InsertDerivedMetric) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(derivedMetrics).values(data);
}

export async function getDerivedMetrics(siteId: number, metricCode: string, periodType: string, startTime: Date, endTime: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(derivedMetrics)
    .where(and(
      eq(derivedMetrics.siteId, siteId),
      eq(derivedMetrics.metricCode, metricCode),
      eq(derivedMetrics.periodType, periodType as any),
      gte(derivedMetrics.periodStart, startTime),
      lte(derivedMetrics.periodEnd, endTime)
    ))
    .orderBy(derivedMetrics.periodStart);
}

// Alert Rules
export async function getAlertRules(organizationId: number, siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (siteId) {
    return db.select().from(alertRules)
      .where(and(
        eq(alertRules.organizationId, organizationId),
        eq(alertRules.siteId, siteId)
      ))
      .orderBy(alertRules.severity, alertRules.name);
  }
  return db.select().from(alertRules)
    .where(eq(alertRules.organizationId, organizationId))
    .orderBy(alertRules.severity, alertRules.name);
}

export async function createAlertRule(data: InsertAlertRule) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(alertRules).values(data);
}

export async function updateAlertRule(id: number, data: Partial<InsertAlertRule>) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alertRules)
    .set(data)
    .where(eq(alertRules.id, id));
}

// Alert Events
export async function getAlertEvents(organizationId: number, status?: string, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  // Join with alert rules to get organization filter
  const rules = await getAlertRules(organizationId);
  const ruleIds = rules.map(r => r.id);
  if (ruleIds.length === 0) return [];
  
  let query = db.select().from(alertEvents)
    .where(inArray(alertEvents.alertRuleId, ruleIds));
  
  if (status) {
    query = db.select().from(alertEvents)
      .where(and(
        inArray(alertEvents.alertRuleId, ruleIds),
        eq(alertEvents.status, status as any)
      ));
  }
  
  return query.orderBy(desc(alertEvents.triggeredAt)).limit(limit);
}

export async function createAlertEvent(data: InsertAlertEvent) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(alertEvents).values(data);
}

export async function acknowledgeAlertEvent(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alertEvents)
    .set({ 
      status: 'acknowledged',
      acknowledgedById: userId,
      acknowledgedAt: new Date(),
    })
    .where(eq(alertEvents.id, id));
}

export async function resolveAlertEvent(id: number, note?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(alertEvents)
    .set({ 
      status: 'resolved',
      resolvedAt: new Date(),
      resolutionNote: note,
    })
    .where(eq(alertEvents.id, id));
}

// Stakeholder Portals
export async function getStakeholderPortals(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stakeholderPortals)
    .where(eq(stakeholderPortals.organizationId, organizationId))
    .orderBy(stakeholderPortals.name);
}

export async function getStakeholderPortalBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stakeholderPortals)
    .where(eq(stakeholderPortals.slug, slug))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createStakeholderPortal(data: InsertStakeholderPortal) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(stakeholderPortals).values(data);
}

// Operations Reports
export async function getOperationsReports(organizationId: number, siteId?: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  if (siteId) {
    return db.select().from(operationsReports)
      .where(and(
        eq(operationsReports.organizationId, organizationId),
        eq(operationsReports.siteId, siteId)
      ))
      .orderBy(desc(operationsReports.createdAt))
      .limit(limit);
  }
  return db.select().from(operationsReports)
    .where(eq(operationsReports.organizationId, organizationId))
    .orderBy(desc(operationsReports.createdAt))
    .limit(limit);
}

export async function createOperationsReport(data: InsertOperationsReport) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(operationsReports).values(data);
}

export async function updateOperationsReportStatus(id: number, status: string, storageUrl?: string) {
  const db = await getDb();
  if (!db) return null;
  return db.update(operationsReports)
    .set({ 
      status: status as any,
      storageUrl,
      generatedAt: status === 'completed' ? new Date() : undefined,
    })
    .where(eq(operationsReports.id, id));
}


// ============ COMMENTS ============

export async function getCommentsByResource(
  resourceType: 'document' | 'workspace_item' | 'checklist_item' | 'project',
  resourceId: number,
  includeInternal: boolean = true
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(comments.resourceType, resourceType),
    eq(comments.resourceId, resourceId)
  ];
  
  if (!includeInternal) {
    conditions.push(eq(comments.isInternal, false));
  }
  
  return db.select().from(comments)
    .where(and(...conditions))
    .orderBy(asc(comments.createdAt));
}

export async function getCommentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  
  return result[0] || null;
}

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(comments).values(data);
  return result;
}

export async function updateComment(id: number, content: string) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(comments)
    .set({ content, isEdited: true })
    .where(eq(comments.id, id));
}

export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  // First delete any mentions
  await db.delete(commentMentions).where(eq(commentMentions.commentId, id));
  // Then delete replies
  await db.delete(comments).where(eq(comments.parentId, id));
  // Finally delete the comment
  return db.delete(comments).where(eq(comments.id, id));
}

export async function getCommentCount(
  resourceType: 'document' | 'workspace_item' | 'checklist_item' | 'project',
  resourceId: number,
  includeInternal: boolean = true
) {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [
    eq(comments.resourceType, resourceType),
    eq(comments.resourceId, resourceId)
  ];
  
  if (!includeInternal) {
    conditions.push(eq(comments.isInternal, false));
  }
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(...conditions));
  
  return result[0]?.count || 0;
}

// Comment mentions
export async function createCommentMention(data: InsertCommentMention) {
  const db = await getDb();
  if (!db) return null;
  
  return db.insert(commentMentions).values(data);
}

export async function getMentionsForUser(userId: number, unreadOnly: boolean = false) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(commentMentions.mentionedUserId, userId)];
  if (unreadOnly) {
    conditions.push(eq(commentMentions.isRead, false));
  }
  
  return db.select().from(commentMentions)
    .where(and(...conditions))
    .orderBy(desc(commentMentions.createdAt));
}

export async function markMentionAsRead(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(commentMentions)
    .set({ isRead: true })
    .where(eq(commentMentions.id, id));
}

export async function markAllMentionsAsRead(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(commentMentions)
    .set({ isRead: true })
    .where(eq(commentMentions.mentionedUserId, userId));
}

// Resolve/unresolve comment threads
export async function resolveCommentThread(commentId: number, resolvedById: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(comments)
    .set({ 
      isResolved: true, 
      resolvedAt: new Date(),
      resolvedById 
    })
    .where(eq(comments.id, commentId));
}

export async function unresolveCommentThread(commentId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(comments)
    .set({ 
      isResolved: false, 
      resolvedAt: null,
      resolvedById: null 
    })
    .where(eq(comments.id, commentId));
}

export async function getCommentsByResourceWithResolved(
  resourceType: 'document' | 'workspace_item' | 'checklist_item' | 'project',
  resourceId: number,
  includeInternal: boolean = true,
  includeResolved: boolean = true
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(comments.resourceType, resourceType),
    eq(comments.resourceId, resourceId)
  ];
  
  if (!includeInternal) {
    conditions.push(eq(comments.isInternal, false));
  }
  
  if (!includeResolved) {
    conditions.push(eq(comments.isResolved, false));
  }
  
  return db.select().from(comments)
    .where(and(...conditions))
    .orderBy(asc(comments.createdAt));
}

export async function getUnresolvedCommentCount(
  resourceType: 'document' | 'workspace_item' | 'checklist_item' | 'project',
  resourceId: number,
  includeInternal: boolean = true
) {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [
    eq(comments.resourceType, resourceType),
    eq(comments.resourceId, resourceId),
    eq(comments.isResolved, false),
    sql`${comments.parentId} IS NULL` // Only count top-level comments
  ];
  
  if (!includeInternal) {
    conditions.push(eq(comments.isInternal, false));
  }
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(comments)
    .where(and(...conditions));
  
  return result[0]?.count || 0;
}


// ============ VATR HIERARCHICAL DATA MODEL ============
import crypto from "crypto";

// ============ SITES ============
export async function getSites(projectId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (projectId) {
    return db.select().from(sites).where(eq(sites.projectId, projectId)).orderBy(asc(sites.name));
  }
  return db.select().from(sites).orderBy(asc(sites.name));
}

export async function getSiteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(sites).where(eq(sites.id, id));
  return result[0] || null;
}

export async function createSite(site: InsertSite) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(sites).values(site);
  return { id: result[0].insertId, ...site };
}

export async function updateSite(id: number, data: Partial<InsertSite>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(sites).set(data).where(eq(sites.id, id));
  return getSiteById(id);
}

export async function deleteSite(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(sites).where(eq(sites.id, id));
  return true;
}

// ============ SYSTEMS ============
export async function getSystems(siteId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (siteId) {
    return db.select().from(systems).where(eq(systems.siteId, siteId)).orderBy(asc(systems.name));
  }
  return db.select().from(systems).orderBy(asc(systems.name));
}

export async function getSystemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(systems).where(eq(systems.id, id));
  return result[0] || null;
}

export async function createSystem(system: InsertSystem) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(systems).values(system);
  return { id: result[0].insertId, ...system };
}

export async function updateSystem(id: number, data: Partial<InsertSystem>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(systems).set(data).where(eq(systems.id, id));
  return getSystemById(id);
}

export async function deleteSystem(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(systems).where(eq(systems.id, id));
  return true;
}

// ============ ASSETS ============
export async function getAssets(filters?: { siteId?: number; systemId?: number; assetType?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.systemId) conditions.push(eq(assets.systemId, filters.systemId));
  if (filters?.assetType) conditions.push(eq(assets.assetType, filters.assetType as any));
  
  if (conditions.length > 0) {
    return db.select().from(assets).where(and(...conditions)).orderBy(asc(assets.name));
  }
  return db.select().from(assets).orderBy(asc(assets.name));
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(assets).where(eq(assets.id, id));
  return result[0] || null;
}

export async function getAssetByVatrId(vatrId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(assets).where(eq(assets.vatrId, vatrId));
  return result[0] || null;
}

function generateVatrId(siteCode: string, assetType: string, sequence: number): string {
  const typeCode = assetType.substring(0, 3).toUpperCase();
  return `VATR-${siteCode}-${typeCode}-${String(sequence).padStart(3, '0')}`;
}

export async function createAsset(asset: InsertAsset) {
  const db = await getDb();
  if (!db) return null;
  
  // Generate VATR ID if not provided
  if (!asset.vatrId) {
    const site = await getSiteById(asset.siteId);
    const siteCode = site?.siteCode || `S${asset.siteId}`;
    const existingAssets = await getAssets({ siteId: asset.siteId, assetType: asset.assetType });
    asset.vatrId = generateVatrId(siteCode, asset.assetType, existingAssets.length + 1);
  }
  
  // Compute content hash
  asset.contentHash = computeAssetHash(asset);
  
  const result = await db.insert(assets).values(asset);
  return { id: result[0].insertId, ...asset };
}

export async function updateAsset(id: number, data: Partial<InsertAsset>) {
  const db = await getDb();
  if (!db) return null;
  
  // Update content hash
  const existing = await getAssetById(id);
  if (existing) {
    const updated = { ...existing, ...data };
    data.contentHash = computeAssetHash(updated as InsertAsset);
    data.currentVersion = (existing.currentVersion || 1) + 1;
  }
  
  await db.update(assets).set(data).where(eq(assets.id, id));
  return getAssetById(id);
}

export async function deleteAsset(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(assets).where(eq(assets.id, id));
  return true;
}

function computeAssetHash(asset: InsertAsset): string {
  const canonical = JSON.stringify({
    vatrId: asset.vatrId,
    assetType: asset.assetType,
    name: asset.name,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    nominalCapacityKw: asset.nominalCapacityKw,
    timestamp: new Date().toISOString()
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ============ ASSET COMPONENTS ============
export async function getAssetComponents(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(assetComponents).where(eq(assetComponents.assetId, assetId)).orderBy(asc(assetComponents.name));
}

export async function createAssetComponent(component: InsertAssetComponent) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(assetComponents).values(component);
  return { id: result[0].insertId, ...component };
}

export async function updateAssetComponent(id: number, data: Partial<InsertAssetComponent>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(assetComponents).set(data).where(eq(assetComponents.id, id));
  const result = await db.select().from(assetComponents).where(eq(assetComponents.id, id));
  return result[0] || null;
}

export async function deleteAssetComponent(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(assetComponents).where(eq(assetComponents.id, id));
  return true;
}

// ============ ASSET ATTRIBUTES (VERSIONED) ============
export async function getAssetAttributes(assetId: number, currentOnly: boolean = true) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(assetAttributes.assetId, assetId)];
  if (currentOnly) {
    conditions.push(eq(assetAttributes.isCurrent, true));
  }
  
  return db.select().from(assetAttributes).where(and(...conditions)).orderBy(asc(assetAttributes.attributeKey));
}

export async function getAttributeHistory(assetId: number, attributeKey: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(assetAttributes)
    .where(and(
      eq(assetAttributes.assetId, assetId),
      eq(assetAttributes.attributeKey, attributeKey)
    ))
    .orderBy(desc(assetAttributes.version));
}

function computeAttributeHash(data: {
  assetId: number;
  attributeKey: string;
  value: unknown;
  sourceType: string;
  timestamp: Date;
}): string {
  const canonical = JSON.stringify({
    assetId: data.assetId,
    attributeKey: data.attributeKey,
    value: data.value,
    sourceType: data.sourceType,
    timestamp: data.timestamp.toISOString()
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function createVersionedAttribute(
  assetId: number,
  attributeKey: string,
  value: { text?: string; numeric?: string; boolean?: boolean; date?: Date | null; json?: Record<string, unknown> },
  source: {
    type: 'document' | 'api' | 'manual' | 'ai_extraction' | 'iot' | 'work_order';
    id?: number;
    page?: number;
    snippet?: string;
    confidence?: string;
  },
  category: 'identity' | 'technical' | 'operational' | 'financial' | 'compliance',
  unit: string | undefined,
  createdById: number
) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current version if exists
  const currentAttrs = await db.select().from(assetAttributes)
    .where(and(
      eq(assetAttributes.assetId, assetId),
      eq(assetAttributes.attributeKey, attributeKey),
      eq(assetAttributes.isCurrent, true)
    ));
  const currentAttr = currentAttrs[0];
  
  const timestamp = new Date();
  const newVersion = currentAttr ? (currentAttr.version || 1) + 1 : 1;
  
  // Determine value for hash
  const valueForHash = value.text || value.numeric || value.boolean || value.date || value.json;
  const contentHash = computeAttributeHash({
    assetId,
    attributeKey,
    value: valueForHash,
    sourceType: source.type,
    timestamp
  });
  
  // Create new attribute
  const newAttr: InsertAssetAttribute = {
    assetId,
    attributeKey,
    attributeCategory: category,
    valueText: value.text,
    valueNumeric: value.numeric,
    valueBoolean: value.boolean,
    valueDate: value.date,
    valueJson: value.json,
    unit,
    version: newVersion,
    previousVersionId: currentAttr?.id,
    isCurrent: true,
    sourceType: source.type,
    sourceId: source.id,
    sourcePage: source.page,
    sourceSnippet: source.snippet,
    sourceConfidence: source.confidence,
    verificationStatus: 'unverified',
    contentHash,
    timestampAnchor: timestamp,
    createdById
  };
  
  const result = await db.insert(assetAttributes).values(newAttr);
  const newAttrId = result[0].insertId;
  
  // Mark previous version as not current
  if (currentAttr) {
    await db.update(assetAttributes)
      .set({ 
        isCurrent: false, 
        supersededAt: timestamp,
        supersededById: newAttrId
      })
      .where(eq(assetAttributes.id, currentAttr.id));
  }
  
  // Log the change
  await db.insert(attributeChangeLog).values({
    attributeId: newAttrId,
    assetId,
    changeType: currentAttr ? 'updated' : 'created',
    oldValueHash: currentAttr?.contentHash,
    newValueHash: contentHash,
    changedById: createdById,
    changedAt: timestamp,
    oldSnapshot: currentAttr ? { value: valueForHash, version: currentAttr.version } : null,
    newSnapshot: { value: valueForHash, version: newVersion }
  });
  
  return { id: newAttrId, ...newAttr };
}

export async function verifyAttribute(attributeId: number, verifiedById: number) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(assetAttributes)
    .set({ 
      verificationStatus: 'verified',
      verifiedById,
      verifiedAt: new Date()
    })
    .where(eq(assetAttributes.id, attributeId));
  
  const result = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  return result[0] || null;
}

export async function rejectAttribute(attributeId: number, verifiedById: number, reason: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(assetAttributes)
    .set({ 
      verificationStatus: 'rejected',
      verifiedById,
      verifiedAt: new Date(),
      rejectionReason: reason
    })
    .where(eq(assetAttributes.id, attributeId));
  
  const result = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  return result[0] || null;
}

// ============ WORK ORDERS ============
export async function getWorkOrders(filters?: { 
  siteId?: number; 
  status?: string; 
  priority?: string;
  assignedToId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.siteId) conditions.push(eq(workOrders.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(workOrders.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(workOrders.priority, filters.priority as any));
  if (filters?.assignedToId) conditions.push(eq(workOrders.assignedToId, filters.assignedToId));
  
  if (conditions.length > 0) {
    return db.select().from(workOrders).where(and(...conditions)).orderBy(desc(workOrders.createdAt));
  }
  return db.select().from(workOrders).orderBy(desc(workOrders.createdAt));
}

export async function getWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(workOrders).where(eq(workOrders.id, id));
  return result[0] || null;
}

async function generateWorkOrderNumber(): Promise<string> {
  const db = await getDb();
  if (!db) return `WO-${Date.now()}`;
  
  const year = new Date().getFullYear();
  const result = await db.select({ count: sql<number>`count(*)` }).from(workOrders);
  const count = (result[0]?.count || 0) + 1;
  return `WO-${year}-${String(count).padStart(5, '0')}`;
}

export async function createWorkOrder(workOrder: Omit<InsertWorkOrder, 'workOrderNumber'>) {
  const db = await getDb();
  if (!db) return null;
  
  const workOrderNumber = await generateWorkOrderNumber();
  const fullWorkOrder = { ...workOrder, workOrderNumber };
  
  const result = await db.insert(workOrders).values(fullWorkOrder);
  return { id: result[0].insertId, ...fullWorkOrder };
}

export async function updateWorkOrder(id: number, data: Partial<InsertWorkOrder>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(workOrders).set(data).where(eq(workOrders.id, id));
  return getWorkOrderById(id);
}

export async function updateWorkOrderStatus(
  id: number, 
  status: 'open' | 'assigned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled',
  reason?: string
) {
  const db = await getDb();
  if (!db) return null;
  
  const updates: Partial<InsertWorkOrder> = { status, statusReason: reason };
  
  // Set timestamps based on status
  if (status === 'in_progress') {
    updates.actualStart = new Date();
  } else if (status === 'completed' || status === 'cancelled') {
    updates.actualEnd = new Date();
  }
  
  await db.update(workOrders).set(updates).where(eq(workOrders.id, id));
  return getWorkOrderById(id);
}

export async function deleteWorkOrder(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  // Delete tasks first
  await db.delete(workOrderTasks).where(eq(workOrderTasks.workOrderId, id));
  await db.delete(workOrders).where(eq(workOrders.id, id));
  return true;
}

// ============ WORK ORDER TASKS ============
export async function getWorkOrderTasks(workOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(workOrderTasks)
    .where(eq(workOrderTasks.workOrderId, workOrderId))
    .orderBy(asc(workOrderTasks.taskNumber));
}

export async function createWorkOrderTask(task: InsertWorkOrderTask) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(workOrderTasks).values(task);
  return { id: result[0].insertId, ...task };
}

export async function updateWorkOrderTask(id: number, data: Partial<InsertWorkOrderTask>) {
  const db = await getDb();
  if (!db) return null;
  
  if (data.status === 'completed') {
    data.completedAt = new Date();
  }
  
  await db.update(workOrderTasks).set(data).where(eq(workOrderTasks.id, id));
  const result = await db.select().from(workOrderTasks).where(eq(workOrderTasks.id, id));
  return result[0] || null;
}

export async function completeWorkOrderTask(
  id: number, 
  result: 'pass' | 'fail' | 'na',
  completedById: number,
  notes?: string,
  measurements?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(workOrderTasks)
    .set({ 
      status: 'completed',
      completedAt: new Date(),
      completedById,
      result,
      resultNotes: notes,
      measurements
    })
    .where(eq(workOrderTasks.id, id));
  
  const taskResult = await db.select().from(workOrderTasks).where(eq(workOrderTasks.id, id));
  return taskResult[0] || null;
}

// ============ MAINTENANCE SCHEDULES ============
export async function getMaintenanceSchedules(scopeType?: string, scopeId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (scopeType) conditions.push(eq(maintenanceSchedules.scopeType, scopeType as any));
  if (scopeId) conditions.push(eq(maintenanceSchedules.scopeId, scopeId));
  
  if (conditions.length > 0) {
    return db.select().from(maintenanceSchedules).where(and(...conditions)).orderBy(asc(maintenanceSchedules.name));
  }
  return db.select().from(maintenanceSchedules).orderBy(asc(maintenanceSchedules.name));
}

export async function getMaintenanceScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
  return result[0] || null;
}

export async function createMaintenanceSchedule(schedule: InsertMaintenanceSchedule) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(maintenanceSchedules).values(schedule);
  return { id: result[0].insertId, ...schedule };
}

export async function updateMaintenanceSchedule(id: number, data: Partial<InsertMaintenanceSchedule>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(maintenanceSchedules).set(data).where(eq(maintenanceSchedules.id, id));
  return getMaintenanceScheduleById(id);
}

export async function deleteMaintenanceSchedule(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));
  return true;
}

// ============ SPARE PARTS ============
export async function getSpareParts(category?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (category) {
    return db.select().from(spareParts).where(eq(spareParts.category, category as any)).orderBy(asc(spareParts.name));
  }
  return db.select().from(spareParts).orderBy(asc(spareParts.name));
}

export async function getSparePartById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(spareParts).where(eq(spareParts.id, id));
  return result[0] || null;
}

export async function createSparePart(part: InsertSparePart) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(spareParts).values(part);
  return { id: result[0].insertId, ...part };
}

export async function updateSparePart(id: number, data: Partial<InsertSparePart>) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(spareParts).set(data).where(eq(spareParts.id, id));
  return getSparePartById(id);
}

export async function recordPartsUsage(
  partId: number,
  quantity: number,
  usageType: 'consumed' | 'returned' | 'damaged',
  usedById: number,
  workOrderId?: number,
  assetId?: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // Record usage
  const result = await db.insert(partsUsage).values({
    partId,
    workOrderId,
    assetId,
    quantity,
    usageType,
    usedById,
    notes
  });
  
  // Update inventory
  const part = await getSparePartById(partId);
  if (part) {
    const adjustment = usageType === 'returned' ? quantity : -quantity;
    await db.update(spareParts)
      .set({ quantityOnHand: (part.quantityOnHand || 0) + adjustment })
      .where(eq(spareParts.id, partId));
  }
  
  return { id: result[0].insertId };
}

// ============ SITE PROFILE COMPLETENESS ============
export async function calculateSiteProfileCompleteness(siteId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const site = await getSiteById(siteId);
  if (!site) return null;
  
  const siteAssets = await getAssets({ siteId });
  
  // Calculate completeness for each category
  const requiredSiteFields = {
    identity: ['name', 'siteCode', 'address', 'country', 'latitude', 'longitude'],
    technical: ['capacityKw', 'siteType', 'gridConnection'],
    operational: ['status', 'operationalStatus', 'codDate'],
    compliance: [], // Would check linked documents
    financial: [] // Would check linked financial data
  };
  
  const completeness: Record<string, number> = {};
  let totalFields = 0;
  let completedFields = 0;
  
  for (const [category, fields] of Object.entries(requiredSiteFields)) {
    const categoryTotal = fields.length;
    const categoryCompleted = fields.filter(f => (site as any)[f] !== null && (site as any)[f] !== undefined).length;
    completeness[category] = categoryTotal > 0 ? Math.round((categoryCompleted / categoryTotal) * 100) : 100;
    totalFields += categoryTotal;
    completedFields += categoryCompleted;
  }
  
  const overallPct = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  
  // Update site profile completeness
  await db.update(sites)
    .set({ 
      profileCompletenessPct: String(overallPct),
      lastProfileUpdate: new Date()
    })
    .where(eq(sites.id, siteId));
  
  return {
    siteId,
    overallPct,
    completeness,
    assetCount: siteAssets.length,
    missingData: {
      critical: requiredSiteFields.identity.filter(f => !(site as any)[f]),
      recommended: [...requiredSiteFields.technical, ...requiredSiteFields.operational].filter(f => !(site as any)[f])
    }
  };
}

// ============ DASHBOARD STATS ============
export async function getOmDashboardStats(siteId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const woConditions = siteId ? [eq(workOrders.siteId, siteId)] : [];
  
  // Work order stats
  const allWos = await db.select().from(workOrders).where(woConditions.length > 0 ? and(...woConditions) : undefined);
  
  const openWos = allWos.filter(wo => wo.status === 'open' || wo.status === 'assigned');
  const inProgressWos = allWos.filter(wo => wo.status === 'in_progress');
  const completedWos = allWos.filter(wo => wo.status === 'completed');
  const overdueWos = allWos.filter(wo => 
    (wo.status === 'open' || wo.status === 'assigned' || wo.status === 'in_progress') &&
    wo.scheduledEnd && new Date(wo.scheduledEnd) < new Date()
  );
  
  // Asset stats
  const assetConditions = siteId ? [eq(assets.siteId, siteId)] : [];
  const allAssets = await db.select().from(assets).where(assetConditions.length > 0 ? and(...assetConditions) : undefined);
  
  const activeAssets = allAssets.filter(a => a.status === 'active');
  const failedAssets = allAssets.filter(a => a.status === 'failed' || a.condition === 'failed');
  
  // Upcoming maintenance
  const upcomingSchedules = await db.select().from(maintenanceSchedules)
    .where(and(
      eq(maintenanceSchedules.status, 'active'),
      sql`${maintenanceSchedules.nextDueDate} <= DATE_ADD(NOW(), INTERVAL 30 DAY)`
    ))
    .orderBy(asc(maintenanceSchedules.nextDueDate))
    .limit(5);
  
  return {
    workOrders: {
      total: allWos.length,
      open: openWos.length,
      inProgress: inProgressWos.length,
      completed: completedWos.length,
      overdue: overdueWos.length
    },
    assets: {
      total: allAssets.length,
      active: activeAssets.length,
      failed: failedAssets.length,
      byType: allAssets.reduce((acc, a) => {
        acc[a.assetType] = (acc[a.assetType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    },
    upcomingMaintenance: upcomingSchedules
  };
}


// ═══════════════════════════════════════════════════════════════
// UNIVERSAL ARTIFACT ARCHITECTURE
// ═══════════════════════════════════════════════════════════════

// ============ ARTIFACTS ============

export async function getArtifacts(filters?: {
  organizationId?: number;
  projectId?: number;
  siteId?: number;
  artifactType?: string;
  processingStatus?: string;
  verificationStatus?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filters?.organizationId) conditions.push(eq(artifacts.organizationId, filters.organizationId));
  if (filters?.projectId) conditions.push(eq(artifacts.projectId, filters.projectId));
  if (filters?.siteId) conditions.push(eq(artifacts.siteId, filters.siteId));
  if (filters?.artifactType) conditions.push(eq(artifacts.artifactType, filters.artifactType as any));
  if (filters?.processingStatus) conditions.push(eq(artifacts.processingStatus, filters.processingStatus as any));
  if (filters?.verificationStatus) conditions.push(eq(artifacts.verificationStatus, filters.verificationStatus as any));
  conditions.push(eq(artifacts.isCurrentVersion, true));
  
  return db.select().from(artifacts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(artifacts.createdAt))
    .limit(filters?.limit || 100);
}

export async function getArtifactById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifacts).where(eq(artifacts.id, id)).limit(1);
  return result[0] || null;
}

export async function getArtifactByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifacts).where(eq(artifacts.artifactCode, code)).limit(1);
  return result[0] || null;
}

export async function getArtifactByHash(hash: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifacts).where(eq(artifacts.originalFileHash, hash)).limit(1);
  return result[0] || null;
}

export async function createArtifact(artifact: InsertArtifact) {
  const db = await getDb();
  if (!db) return null;
  
  // Generate artifact code
  const year = new Date().getFullYear();
  const countResult = await db.select({ count: sql<number>`COUNT(*)` }).from(artifacts);
  const count = (countResult[0]?.count || 0) + 1;
  const artifactCode = `ART-${year}-${String(count).padStart(5, '0')}`;
  
  const result = await db.insert(artifacts).values({ ...artifact, artifactCode });
  return { id: result[0].insertId, artifactCode };
}

export async function updateArtifact(id: number, data: Partial<InsertArtifact>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifacts).set({ ...data, updatedAt: new Date() }).where(eq(artifacts.id, id));
}

export async function updateArtifactProcessingStatus(
  id: number, 
  status: 'pending' | 'preprocessing' | 'processed' | 'ai_analyzing' | 'ai_complete' | 'failed'
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifacts).set({ processingStatus: status, updatedAt: new Date() }).where(eq(artifacts.id, id));
}

export async function updateArtifactAiStatus(
  id: number,
  status: 'pending' | 'queued' | 'analyzing' | 'complete' | 'failed',
  runId?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const updates: Partial<InsertArtifact> = { aiAnalysisStatus: status };
  if (status === 'analyzing') updates.aiAnalysisStartedAt = new Date();
  if (status === 'complete' || status === 'failed') updates.aiAnalysisCompletedAt = new Date();
  if (runId) updates.aiAnalysisRunId = runId;
  
  await db.update(artifacts).set(updates).where(eq(artifacts.id, id));
}

export async function categorizeArtifact(
  id: number,
  category: string,
  subcategory: string | null,
  isAiSuggestion: boolean,
  confidence?: number,
  categorizedBy?: number
) {
  const db = await getDb();
  if (!db) return;
  
  if (isAiSuggestion) {
    await db.update(artifacts).set({
      aiSuggestedCategory: category,
      aiSuggestedSubcategory: subcategory,
      aiCategoryConfidence: confidence?.toString()
    }).where(eq(artifacts.id, id));
  } else {
    await db.update(artifacts).set({
      confirmedCategory: category,
      confirmedSubcategory: subcategory,
      categorizedBy,
      categorizedAt: new Date()
    }).where(eq(artifacts.id, id));
  }
}

export async function verifyArtifact(id: number, verifiedBy: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifacts).set({
    verificationStatus: 'human_verified',
    verifiedBy,
    verifiedAt: new Date(),
    verificationNotes: notes
  }).where(eq(artifacts.id, id));
}

export async function deleteArtifact(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(artifacts).where(eq(artifacts.id, id));
}

// ============ ARTIFACT TYPE EXTENSIONS ============

export async function createArtifactImage(data: InsertArtifactImage) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactImages).values(data);
  return result[0].insertId;
}

export async function getArtifactImage(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactImages).where(eq(artifactImages.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function updateArtifactImage(artifactId: number, data: Partial<InsertArtifactImage>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactImages).set(data).where(eq(artifactImages.artifactId, artifactId));
}

export async function createArtifactAudio(data: InsertArtifactAudio) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactAudio).values(data);
  return result[0].insertId;
}

export async function getArtifactAudio(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactAudio).where(eq(artifactAudio.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function updateArtifactAudio(artifactId: number, data: Partial<InsertArtifactAudio>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactAudio).set(data).where(eq(artifactAudio.artifactId, artifactId));
}

export async function createArtifactVideo(data: InsertArtifactVideo) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactVideo).values(data);
  return result[0].insertId;
}

export async function getArtifactVideo(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactVideo).where(eq(artifactVideo.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function updateArtifactVideo(artifactId: number, data: Partial<InsertArtifactVideo>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactVideo).set(data).where(eq(artifactVideo.artifactId, artifactId));
}

export async function createArtifactMessage(data: InsertArtifactMessage) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactMessages).values(data);
  return result[0].insertId;
}

export async function getArtifactMessage(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactMessages).where(eq(artifactMessages.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function createArtifactMeeting(data: InsertArtifactMeeting) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactMeetings).values(data);
  return result[0].insertId;
}

export async function getArtifactMeeting(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactMeetings).where(eq(artifactMeetings.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function updateArtifactMeeting(artifactId: number, data: Partial<InsertArtifactMeeting>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactMeetings).set(data).where(eq(artifactMeetings.artifactId, artifactId));
}

// ============ CONTRACTS ============

export async function createArtifactContract(data: InsertArtifactContract) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactContracts).values(data);
  return result[0].insertId;
}

export async function getArtifactContract(artifactId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(artifactContracts).where(eq(artifactContracts.artifactId, artifactId)).limit(1);
  return result[0] || null;
}

export async function updateArtifactContract(artifactId: number, data: Partial<InsertArtifactContract>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactContracts).set(data).where(eq(artifactContracts.artifactId, artifactId));
}

export async function getContractsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    artifact: artifacts,
    contract: artifactContracts
  })
    .from(artifacts)
    .innerJoin(artifactContracts, eq(artifacts.id, artifactContracts.artifactId))
    .where(and(
      eq(artifacts.projectId, projectId),
      eq(artifacts.artifactType, 'contract'),
      eq(artifacts.isCurrentVersion, true)
    ))
    .orderBy(desc(artifacts.createdAt));
}

export async function createContractObligation(data: InsertContractObligation) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(contractObligations).values(data);
  return result[0].insertId;
}

export async function getContractObligations(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(contractObligations).where(eq(contractObligations.contractId, contractId));
}

export async function updateContractObligationStatus(id: number, status: 'pending' | 'compliant' | 'non_compliant' | 'waived') {
  const db = await getDb();
  if (!db) return;
  
  await db.update(contractObligations).set({
    complianceStatus: status,
    lastComplianceCheck: new Date()
  }).where(eq(contractObligations.id, id));
}

export async function getUpcomingObligations(organizationId: number, daysAhead: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    obligation: contractObligations,
    artifact: artifacts,
    contract: artifactContracts
  })
    .from(contractObligations)
    .innerJoin(artifactContracts, eq(contractObligations.contractId, artifactContracts.id))
    .innerJoin(artifacts, eq(artifactContracts.artifactId, artifacts.id))
    .where(and(
      eq(artifacts.organizationId, organizationId),
      sql`${contractObligations.nextDueDate} <= DATE_ADD(NOW(), INTERVAL ${daysAhead} DAY)`,
      sql`${contractObligations.nextDueDate} >= NOW()`
    ))
    .orderBy(asc(contractObligations.nextDueDate));
}

export async function createContractAmendment(data: InsertContractAmendment) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(contractAmendments).values(data);
  
  // Update amendment count on contract
  await db.update(artifactContracts).set({
    amendmentCount: sql`${artifactContracts.amendmentCount} + 1`,
    latestAmendmentDate: data.amendmentDate
  }).where(eq(artifactContracts.id, data.contractId));
  
  return result[0].insertId;
}

export async function getContractAmendments(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(contractAmendments)
    .where(eq(contractAmendments.contractId, contractId))
    .orderBy(asc(contractAmendments.amendmentNumber));
}

// ============ EXTRACTIONS ============

export async function createArtifactExtraction(data: InsertArtifactExtraction) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactExtractions).values(data);
  return result[0].insertId;
}

export async function getArtifactExtractions(artifactId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(artifactExtractions)
    .where(eq(artifactExtractions.artifactId, artifactId))
    .orderBy(asc(artifactExtractions.fieldCategory), asc(artifactExtractions.fieldKey));
}

export async function getExtractionsByRunId(runId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(artifactExtractions).where(eq(artifactExtractions.extractionRunId, runId));
}

export async function verifyExtraction(id: number, verifiedBy: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactExtractions).set({
    verificationStatus: 'verified',
    verifiedBy,
    verifiedAt: new Date(),
    verificationNotes: notes
  }).where(eq(artifactExtractions.id, id));
}

export async function correctExtraction(
  id: number,
  correctedValue: { text?: string; numeric?: number; date?: Date; boolean?: boolean; json?: unknown },
  correctedBy: number
) {
  const db = await getDb();
  if (!db) return;
  
  // Get original value first
  const original = await db.select().from(artifactExtractions).where(eq(artifactExtractions.id, id)).limit(1);
  if (!original[0]) return;
  
  const originalValue = {
    text: original[0].extractedValueText,
    numeric: original[0].extractedValueNumeric,
    date: original[0].extractedValueDate,
    boolean: original[0].extractedValueBoolean,
    json: original[0].extractedValueJson
  };
  
  await db.update(artifactExtractions).set({
    extractedValueText: correctedValue.text ?? null,
    extractedValueNumeric: correctedValue.numeric?.toString() ?? null,
    extractedValueDate: correctedValue.date ?? null,
    extractedValueBoolean: correctedValue.boolean ?? null,
    extractedValueJson: correctedValue.json ?? null,
    verificationStatus: 'corrected',
    verifiedBy: correctedBy,
    verifiedAt: new Date(),
    wasCorrected: true,
    originalValueIfCorrected: originalValue
  }).where(eq(artifactExtractions.id, id));
}

export async function getUnverifiedExtractions(organizationId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    extraction: artifactExtractions,
    artifact: artifacts
  })
    .from(artifactExtractions)
    .innerJoin(artifacts, eq(artifactExtractions.artifactId, artifacts.id))
    .where(and(
      eq(artifacts.organizationId, organizationId),
      eq(artifactExtractions.verificationStatus, 'unverified')
    ))
    .orderBy(desc(artifactExtractions.extractedAt))
    .limit(limit);
}

// ============ ENTITY MENTIONS ============

export async function createArtifactEntityMention(data: InsertArtifactEntityMention) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(artifactEntityMentions).values(data);
  return result[0].insertId;
}

export async function getArtifactEntityMentions(artifactId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(artifactEntityMentions).where(eq(artifactEntityMentions.artifactId, artifactId));
}

export async function resolveArtifactEntityMention(
  id: number,
  entityType: string,
  entityId: number,
  confidence: number,
  resolvedBy?: number
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(artifactEntityMentions).set({
    resolvedEntityType: entityType,
    resolvedEntityId: entityId,
    resolutionConfidence: confidence.toString(),
    resolutionStatus: resolvedBy ? 'manual_resolved' : 'auto_resolved',
    resolvedBy,
    resolvedAt: new Date()
  }).where(eq(artifactEntityMentions.id, id));
}

export async function getUnresolvedArtifactMentions(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    mention: artifactEntityMentions,
    artifact: artifacts
  })
    .from(artifactEntityMentions)
    .innerJoin(artifacts, eq(artifactEntityMentions.artifactId, artifacts.id))
    .where(and(
      eq(artifacts.organizationId, organizationId),
      eq(artifactEntityMentions.resolutionStatus, 'unresolved')
    ))
    .orderBy(desc(artifactEntityMentions.createdAt));
}

// ═══════════════════════════════════════════════════════════════
// ASSET LIFECYCLE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

export async function getLifecycleStages() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(lifecycleStages).orderBy(asc(lifecycleStages.stageOrder));
}

export async function getLifecycleStageByKey(stageKey: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(lifecycleStages).where(eq(lifecycleStages.stageKey, stageKey)).limit(1);
  return result[0] || null;
}

export async function createLifecycleStage(data: InsertLifecycleStage) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(lifecycleStages).values(data);
  return result[0].insertId;
}

export async function getStageAttributeDefinitions(lifecycleStage: string) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(stageAttributeDefinitions)
    .where(eq(stageAttributeDefinitions.lifecycleStage, lifecycleStage))
    .orderBy(asc(stageAttributeDefinitions.displayOrder));
}

export async function createStageAttributeDefinition(data: InsertStageAttributeDefinition) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(stageAttributeDefinitions).values(data);
  return result[0].insertId;
}

export async function getAssetLifecycleTracking(entityType: 'project' | 'site' | 'asset', entityId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const condition = entityType === 'project' 
    ? eq(assetLifecycleTracking.projectId, entityId)
    : entityType === 'site'
    ? eq(assetLifecycleTracking.siteId, entityId)
    : eq(assetLifecycleTracking.assetId, entityId);
  
  const result = await db.select().from(assetLifecycleTracking).where(condition).limit(1);
  return result[0] || null;
}

export async function createAssetLifecycleTracking(data: InsertAssetLifecycleTracking) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(assetLifecycleTracking).values(data);
  return result[0].insertId;
}

export async function updateLifecycleCompleteness(
  trackingId: number,
  completeness: number,
  milestonesCompleted: number,
  milestonesTotal: number,
  attributesCompleted: number,
  attributesRequired: number
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetLifecycleTracking).set({
    stageCompleteness: completeness.toString(),
    milestonesCompleted,
    milestonesTotal,
    attributesCompleted,
    attributesRequired,
    updatedAt: new Date()
  }).where(eq(assetLifecycleTracking.id, trackingId));
}

export async function transitionLifecycleStage(
  trackingId: number,
  newStage: string,
  transitionedBy: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) return;
  
  // Get current tracking
  const current = await db.select().from(assetLifecycleTracking).where(eq(assetLifecycleTracking.id, trackingId)).limit(1);
  if (!current[0]) return;
  
  const previousStage = current[0].currentStage;
  const stageEnteredAt = current[0].stageEnteredAt;
  const daysInPreviousStage = stageEnteredAt 
    ? Math.floor((Date.now() - new Date(stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Create transition history
  await db.insert(stageTransitionHistory).values({
    lifecycleTrackingId: trackingId,
    fromStage: previousStage,
    toStage: newStage,
    transitionedAt: new Date(),
    transitionedBy,
    daysInPreviousStage,
    completenessAtTransition: current[0].stageCompleteness,
    notes
  });
  
  // Update tracking
  await db.update(assetLifecycleTracking).set({
    currentStage: newStage,
    stageEnteredAt: new Date(),
    stageCompleteness: '0',
    milestonesCompleted: 0,
    attributesCompleted: 0,
    isBlocked: false,
    blockedReason: null,
    updatedAt: new Date(),
    updatedBy: transitionedBy
  }).where(eq(assetLifecycleTracking.id, trackingId));
}

export async function completeMilestone(data: InsertStageMilestoneCompletion) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(stageMilestoneCompletions).values(data);
  return result[0].insertId;
}

export async function getMilestoneCompletions(trackingId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(stageMilestoneCompletions)
    .where(eq(stageMilestoneCompletions.lifecycleTrackingId, trackingId))
    .orderBy(asc(stageMilestoneCompletions.completedAt));
}

export async function getStageTransitionHistory(trackingId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(stageTransitionHistory)
    .where(eq(stageTransitionHistory.lifecycleTrackingId, trackingId))
    .orderBy(desc(stageTransitionHistory.transitionedAt));
}

export async function blockLifecycleStage(trackingId: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetLifecycleTracking).set({
    isBlocked: true,
    blockedReason: reason,
    updatedAt: new Date()
  }).where(eq(assetLifecycleTracking.id, trackingId));
}

export async function unblockLifecycleStage(trackingId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetLifecycleTracking).set({
    isBlocked: false,
    blockedReason: null,
    updatedAt: new Date()
  }).where(eq(assetLifecycleTracking.id, trackingId));
}

// ============ ARTIFACT STATS ============

export async function getArtifactStats(organizationId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const allArtifacts = await db.select().from(artifacts)
    .where(and(
      eq(artifacts.organizationId, organizationId),
      eq(artifacts.isCurrentVersion, true)
    ));
  
  const byType = allArtifacts.reduce((acc, a) => {
    acc[a.artifactType] = (acc[a.artifactType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byProcessingStatus = allArtifacts.reduce((acc, a) => {
    const status = a.processingStatus || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const byVerificationStatus = allArtifacts.reduce((acc, a) => {
    const status = a.verificationStatus || 'unverified';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const pendingReview = allArtifacts.filter(a => 
    a.aiAnalysisStatus === 'complete' && a.verificationStatus === 'unverified'
  ).length;
  
  return {
    total: allArtifacts.length,
    byType,
    byProcessingStatus,
    byVerificationStatus,
    pendingReview
  };
}


// ============ USER ACTIVITY LOG ============
export async function createUserActivity(data: {
  userId: number;
  action: string;
  entityType: string;
  entityId: number;
  details?: Record<string, unknown>;
  projectId?: number;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  return db.insert(userActivityLog).values({
    userId: data.userId,
    action: data.action,
    resourceType: data.entityType,
    resourceId: data.entityId,
    metadata: { ...data.details, projectId: data.projectId },
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });
}

export async function getUserActivityLog(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userActivityLog)
    .where(eq(userActivityLog.userId, userId))
    .orderBy(userActivityLog.createdAt)
    .limit(limit);
}

export async function getProjectActivityLog(projectId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Query activities where projectId is in metadata
  const activities = await db.select().from(userActivityLog)
    .orderBy(userActivityLog.createdAt)
    .limit(limit * 2); // Get more to filter
  
  return activities.filter(a => 
    a.metadata && (a.metadata as Record<string, unknown>).projectId === projectId
  ).slice(0, limit);
}


// ============ ASSET FIELD HISTORY LEDGER ============

export async function createFieldHistoryEntry(data: InsertAssetFieldHistory) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(assetFieldHistory).values(data);
  return result;
}

export async function getFieldHistory(assetId: number, fieldKey?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(assetFieldHistory)
    .where(eq(assetFieldHistory.assetId, assetId))
    .orderBy(assetFieldHistory.changedAt)
    .limit(limit);
  
  if (fieldKey) {
    query = db.select().from(assetFieldHistory)
      .where(and(
        eq(assetFieldHistory.assetId, assetId),
        eq(assetFieldHistory.fieldKey, fieldKey)
      ))
      .orderBy(assetFieldHistory.changedAt)
      .limit(limit);
  }
  
  return query;
}

export async function getFieldHistoryForView(viewId: number, assetId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(assetFieldHistory)
    .where(and(
      eq(assetFieldHistory.assetId, assetId),
      eq(assetFieldHistory.viewId, viewId)
    ))
    .orderBy(assetFieldHistory.changedAt)
    .limit(limit);
}

// ============ VIEW SCOPES ============

export async function createViewScope(data: InsertViewScope) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(viewScopes).values(data);
  return { id: result.insertId, ...data };
}

export async function getViewScopeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(viewScopes).where(eq(viewScopes.id, id));
  return result || null;
}

export async function getViewScopesForOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(viewScopes)
    .where(eq(viewScopes.organizationId, organizationId))
    .orderBy(viewScopes.createdAt);
}

export async function getViewScopesByType(organizationId: number, viewType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(viewScopes)
    .where(and(
      eq(viewScopes.organizationId, organizationId),
      eq(viewScopes.viewType, viewType as any)
    ))
    .orderBy(viewScopes.createdAt);
}

export async function updateViewScope(id: number, data: Partial<InsertViewScope>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(viewScopes).set(data).where(eq(viewScopes.id, id));
  return getViewScopeById(id);
}

export async function deleteViewScope(id: number) {
  const db = await getDb();
  if (!db) return false;
  // Also delete related view items and field overrides
  await db.delete(viewItems).where(eq(viewItems.viewId, id));
  await db.delete(viewFieldOverrides).where(eq(viewFieldOverrides.viewId, id));
  await db.delete(viewScopes).where(eq(viewScopes.id, id));
  return true;
}

// ============ VIEW ITEMS (INCLUSION/EXCLUSION) ============

export async function setViewItemState(data: InsertViewItem) {
  const db = await getDb();
  if (!db) return null;
  
  // Upsert - update if exists, insert if not
  const [result] = await db.insert(viewItems)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        inclusionState: data.inclusionState,
        reason: data.reason,
        updatedBy: data.updatedBy,
      }
    });
  
  return result;
}

export async function getViewItems(viewId: number, entityType?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (entityType) {
    return db.select().from(viewItems)
      .where(and(
        eq(viewItems.viewId, viewId),
        eq(viewItems.entityType, entityType as any)
      ));
  }
  
  return db.select().from(viewItems).where(eq(viewItems.viewId, viewId));
}

export async function getExcludedItemsForView(viewId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(viewItems)
    .where(and(
      eq(viewItems.viewId, viewId),
      eq(viewItems.inclusionState, "excluded")
    ));
}

export async function removeFromView(viewId: number, entityType: string, entityId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  return setViewItemState({
    viewId,
    entityType: entityType as any,
    entityId,
    inclusionState: "excluded",
    reason,
    updatedBy: userId,
  });
}

export async function restoreToView(viewId: number, entityType: string, entityId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  return setViewItemState({
    viewId,
    entityType: entityType as any,
    entityId,
    inclusionState: "included",
    reason,
    updatedBy: userId,
  });
}

// ============ VIEW FIELD OVERRIDES ============

export async function setFieldOverride(data: InsertViewFieldOverride) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(viewFieldOverrides)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        state: data.state,
        specificVersionId: data.specificVersionId,
        reason: data.reason,
        updatedBy: data.updatedBy,
      }
    });
  
  return result;
}

export async function getFieldOverridesForView(viewId: number, assetId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (assetId) {
    return db.select().from(viewFieldOverrides)
      .where(and(
        eq(viewFieldOverrides.viewId, viewId),
        eq(viewFieldOverrides.assetId, assetId)
      ));
  }
  
  return db.select().from(viewFieldOverrides).where(eq(viewFieldOverrides.viewId, viewId));
}

export async function getHiddenFieldsForView(viewId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(viewFieldOverrides)
    .where(and(
      eq(viewFieldOverrides.viewId, viewId),
      eq(viewFieldOverrides.state, "hide")
    ));
}

// ============ DOCUMENT ARCHIVE OPERATIONS ============

export async function archiveDocument(documentId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Update document visibility state
  await db.update(documents).set({
    visibilityState: "archived",
    archivedAt: new Date(),
    archivedBy: userId,
    archiveReason: reason,
  }).where(eq(documents.id, documentId));
  
  // Create archive history entry
  await db.insert(documentArchiveHistory).values({
    documentId,
    action: "archived",
    reason,
    performedBy: userId,
  });
  
  return getDocumentById(documentId);
}

export async function unarchiveDocument(documentId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Update document visibility state
  await db.update(documents).set({
    visibilityState: "active",
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
  }).where(eq(documents.id, documentId));
  
  // Create archive history entry
  await db.insert(documentArchiveHistory).values({
    documentId,
    action: "unarchived",
    reason,
    performedBy: userId,
  });
  
  return getDocumentById(documentId);
}

export async function supersedeDocument(documentId: number, newDocumentId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Update old document
  await db.update(documents).set({
    visibilityState: "superseded",
    supersededById: newDocumentId,
  }).where(eq(documents.id, documentId));
  
  // Create archive history entry
  await db.insert(documentArchiveHistory).values({
    documentId,
    action: "superseded",
    reason,
    supersededById: newDocumentId,
    performedBy: userId,
  });
  
  return getDocumentById(documentId);
}

export async function getDocumentArchiveHistory(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentArchiveHistory)
    .where(eq(documentArchiveHistory.documentId, documentId))
    .orderBy(documentArchiveHistory.performedAt);
}

// ============ RFI ARCHIVE OPERATIONS ============

export async function archiveRfi(rfiId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(rfis).set({
    visibilityState: "archived",
    archivedAt: new Date(),
    archivedBy: userId,
    archiveReason: reason,
  }).where(eq(rfis.id, rfiId));
  
  return getRfiById(rfiId);
}

export async function unarchiveRfi(rfiId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(rfis).set({
    visibilityState: "active",
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
  }).where(eq(rfis.id, rfiId));
  
  return getRfiById(rfiId);
}

// ============ CHECKLIST ITEM ARCHIVE OPERATIONS ============

export async function archiveChecklistItem(itemId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(closingChecklistItems).set({
    visibilityState: "archived",
    archivedAt: new Date(),
    archivedBy: userId,
    archiveReason: reason,
  }).where(eq(closingChecklistItems.id, itemId));
  
  const [result] = await db.select().from(closingChecklistItems).where(eq(closingChecklistItems.id, itemId));
  return result || null;
}

export async function unarchiveChecklistItem(itemId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(closingChecklistItems).set({
    visibilityState: "active",
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
  }).where(eq(closingChecklistItems.id, itemId));
  
  const [result] = await db.select().from(closingChecklistItems).where(eq(closingChecklistItems.id, itemId));
  return result || null;
}

// ============ ASSET ATTRIBUTE ARCHIVE OPERATIONS ============

export async function archiveAssetAttribute(attributeId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current attribute for history
  const [current] = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  if (!current) return null;
  
  // Update attribute
  await db.update(assetAttributes).set({
    visibilityState: "archived",
    archivedAt: new Date(),
    archivedBy: userId,
    archiveReason: reason,
  }).where(eq(assetAttributes.id, attributeId));
  
  // Create field history entry
  await createFieldHistoryEntry({
    assetId: current.assetId,
    fieldKey: current.attributeKey,
    oldValue: current.valueText || String(current.valueNumeric) || String(current.valueBoolean) || current.valueDate?.toString() || null,
    newValue: null,
    changeType: "archived",
    changedBy: userId,
    reason,
  });
  
  const [result] = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  return result || null;
}

export async function unarchiveAssetAttribute(attributeId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current attribute for history
  const [current] = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  if (!current) return null;
  
  // Update attribute
  await db.update(assetAttributes).set({
    visibilityState: "active",
    archivedAt: null,
    archivedBy: null,
    archiveReason: null,
  }).where(eq(assetAttributes.id, attributeId));
  
  // Create field history entry
  await createFieldHistoryEntry({
    assetId: current.assetId,
    fieldKey: current.attributeKey,
    oldValue: null,
    newValue: current.valueText || String(current.valueNumeric) || String(current.valueBoolean) || current.valueDate?.toString() || null,
    changeType: "unarchived",
    changedBy: userId,
  });
  
  const [result] = await db.select().from(assetAttributes).where(eq(assetAttributes.id, attributeId));
  return result || null;
}

// ============ EXPORT MANIFESTS ============

export async function createExportManifest(data: InsertExportManifest) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(exportManifests).values(data);
  return { id: result.insertId, ...data };
}

export async function getExportManifestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(exportManifests).where(eq(exportManifests.id, id));
  return result || null;
}

export async function getExportManifestsForView(viewId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(exportManifests)
    .where(eq(exportManifests.viewId, viewId))
    .orderBy(exportManifests.exportedAt);
}

// ============ VIEW-SCOPED QUERIES ============

// Get documents with view overlay applied
export async function getDocumentsForView(viewId: number, projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all documents for project (active only)
  const allDocs = await db.select().from(documents)
    .where(and(
      eq(documents.projectId, projectId),
      eq(documents.visibilityState, "active")
    ));
  
  // Get exclusions for this view
  const exclusions = await getExcludedItemsForView(viewId);
  const excludedDocIds = new Set(
    exclusions
      .filter(e => e.entityType === "document")
      .map(e => e.entityId)
  );
  
  // Filter out excluded documents
  return allDocs.filter(doc => !excludedDocIds.has(doc.id));
}

// Get asset attributes with view overlay applied
export async function getAssetAttributesForView(viewId: number, assetId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all active attributes for asset
  const allAttrs = await db.select().from(assetAttributes)
    .where(and(
      eq(assetAttributes.assetId, assetId),
      eq(assetAttributes.visibilityState, "active"),
      eq(assetAttributes.isCurrent, true)
    ));
  
  // Get field overrides for this view
  const overrides = await getFieldOverridesForView(viewId, assetId);
  const hiddenFields = new Set(
    overrides
      .filter(o => o.state === "hide")
      .map(o => o.fieldKey)
  );
  
  // Filter out hidden fields
  return allAttrs.filter(attr => !hiddenFields.has(attr.attributeKey));
}


// Soft delete comment - preserves record but marks as deleted
export async function softDeleteComment(commentId: number, deletedByUserId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(comments)
    .set({
      content: '[This comment has been deleted]',
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: deletedByUserId,
    })
    .where(eq(comments.id, commentId));
}


// ============================================
// ASSET CLASSIFICATION FILTERS
// ============================================

export interface AssetFilterParams {
  viewId?: number;
  projectId?: number;
  organizationId?: number;
  assetClassification?: string[];
  configurationProfile?: string[];
  gridConnectionType?: string[];
  componentIncludes?: string[];
  limit?: number;
  offset?: number;
}

export async function getAssetsWithFilters(params: AssetFilterParams) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  
  // Filter by project
  if (params.projectId) {
    conditions.push(eq(vatrAssets.projectId, params.projectId));
  }
  
  // Filter by organization (via project)
  // Note: Would need to join with projects table for org filtering
  
  // Filter by classification
  if (params.assetClassification && params.assetClassification.length > 0) {
    conditions.push(
      inArray(vatrAssets.assetClassification, params.assetClassification as any)
    );
  }
  
  // Filter by configuration profile
  if (params.configurationProfile && params.configurationProfile.length > 0) {
    conditions.push(
      inArray(vatrAssets.configurationProfile, params.configurationProfile as any)
    );
  }
  
  // Filter by grid connection type
  if (params.gridConnectionType && params.gridConnectionType.length > 0) {
    conditions.push(
      inArray(vatrAssets.gridConnectionType, params.gridConnectionType as any)
    );
  }
  
  // Base query (vatrAssets doesn't have archivedAt - use operationalStatus if needed)
  let query = db
    .select()
    .from(vatrAssets)
    .where(and(...conditions))
    .limit(params.limit || 50)
    .offset(params.offset || 0);
  
  const assets = await query;
  
  // If viewId is provided, filter out excluded items
  if (params.viewId) {
    const excludedItems = await db
      .select({ entityId: viewItems.entityId })
      .from(viewItems)
      .where(
        and(
          eq(viewItems.viewId, params.viewId),
          eq(viewItems.entityType, "asset"),
          eq(viewItems.inclusionState, "excluded")
        )
      );
    
    const excludedIds = new Set(excludedItems.map((i: any) => i.entityId));
    return assets.filter((a: any) => !excludedIds.has(a.id));
  }
  
  return assets;
}

// Get assets count with filters (for pagination)
export async function getAssetsCountWithFilters(params: Omit<AssetFilterParams, 'limit' | 'offset'>) {
  const db = await getDb();
  if (!db) return 0;
  const conditions: ReturnType<typeof eq>[] = [];
  
  if (params.projectId) {
    conditions.push(eq(vatrAssets.projectId, params.projectId));
  }
  
  if (params.assetClassification && params.assetClassification.length > 0) {
    conditions.push(
      inArray(vatrAssets.assetClassification, params.assetClassification as any)
    );
  }
  
  if (params.configurationProfile && params.configurationProfile.length > 0) {
    conditions.push(
      inArray(vatrAssets.configurationProfile, params.configurationProfile as any)
    );
  }
  
  if (params.gridConnectionType && params.gridConnectionType.length > 0) {
    conditions.push(
      inArray(vatrAssets.gridConnectionType, params.gridConnectionType as any)
    );
  }
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(vatrAssets)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result[0]?.count || 0;
}


// ============ ASSET CLASSIFICATION STATS ============
export interface ClassificationStatsFilters {
  siteId?: number;
  systemId?: number;
  projectId?: number;
  assetClassification?: string;
  gridConnectionType?: string;
  configurationProfile?: string;
  networkTopology?: string;
}

export async function getAssetClassificationStats(filters?: ClassificationStatsFilters) {
  const db = await getDb();
  if (!db) return {
    byClassification: [],
    byGridConnection: [],
    byConfiguration: [],
    byTopology: [],
    byAssetType: [],
    byAssetCategory: [],
    total: 0
  };
  
  // Build base conditions from filters
  const baseConditions: ReturnType<typeof eq>[] = [];
  if (filters?.siteId) baseConditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.systemId) baseConditions.push(eq(assets.systemId, filters.systemId));
  if (filters?.projectId) baseConditions.push(eq(assets.projectId, filters.projectId));
  if (filters?.assetClassification) baseConditions.push(eq(assets.assetClassification, filters.assetClassification as any));
  if (filters?.gridConnectionType) baseConditions.push(eq(assets.gridConnectionType, filters.gridConnectionType as any));
  if (filters?.configurationProfile) baseConditions.push(eq(assets.configurationProfile, filters.configurationProfile as any));
  if (filters?.networkTopology) baseConditions.push(eq(assets.networkTopology, filters.networkTopology as any));
  
  // Helper to combine base conditions with additional condition
  const withBaseConditions = (additionalCondition: ReturnType<typeof isNotNull>) => {
    return baseConditions.length > 0 
      ? and(additionalCondition, ...baseConditions)
      : additionalCondition;
  };
  
  // Get counts by classification
  const classificationCounts = await db.select({
    classification: assets.assetClassification,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(withBaseConditions(isNotNull(assets.assetClassification)))
  .groupBy(assets.assetClassification);
  
  // Get counts by grid connection type
  const gridConnectionCounts = await db.select({
    gridConnection: assets.gridConnectionType,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(withBaseConditions(isNotNull(assets.gridConnectionType)))
  .groupBy(assets.gridConnectionType);
  
  // Get counts by configuration profile
  const configurationCounts = await db.select({
    configuration: assets.configurationProfile,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(withBaseConditions(isNotNull(assets.configurationProfile)))
  .groupBy(assets.configurationProfile);
  
  // Get counts by network topology
  const topologyCounts = await db.select({
    topology: assets.networkTopology,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(withBaseConditions(isNotNull(assets.networkTopology)))
  .groupBy(assets.networkTopology);
  
  // Get counts by asset type
  const assetTypeCounts = await db.select({
    assetType: assets.assetType,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
  .groupBy(assets.assetType);
  
  // Get counts by asset category
  const assetCategoryCounts = await db.select({
    assetCategory: assets.assetCategory,
    count: sql<number>`count(*)`
  })
  .from(assets)
  .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
  .groupBy(assets.assetCategory);
  
  // Get total count with filters
  const totalQuery = db.select({ count: sql<number>`count(*)` }).from(assets);
  const totalResult = baseConditions.length > 0 
    ? await totalQuery.where(and(...baseConditions))
    : await totalQuery;
  
  return {
    byClassification: classificationCounts.map(r => ({ 
      name: r.classification || 'Unknown', 
      value: Number(r.count) 
    })),
    byGridConnection: gridConnectionCounts.map(r => ({ 
      name: r.gridConnection || 'Unknown', 
      value: Number(r.count) 
    })),
    byConfiguration: configurationCounts.map(r => ({ 
      name: r.configuration || 'Unknown', 
      value: Number(r.count) 
    })),
    byTopology: topologyCounts.map(r => ({ 
      name: r.topology || 'Unknown', 
      value: Number(r.count) 
    })),
    byAssetType: assetTypeCounts.map(r => ({ 
      name: r.assetType || 'Unknown', 
      value: Number(r.count) 
    })),
    byAssetCategory: assetCategoryCounts.map(r => ({ 
      name: r.assetCategory || 'Unknown', 
      value: Number(r.count) 
    })),
    total: Number(totalResult[0]?.count || 0)
  };
}


// ============ PROJECT-LEVEL ASSET CLASSIFICATION STATS ============
// In KIISHA, "Asset" = Project-level investable unit
export interface ProjectClassificationFilters {
  portfolioId?: number;
  organizationId?: number;
  country?: string;
  status?: string;
  stage?: string;
  assetClassification?: string;
  gridConnectionType?: string;
  configurationProfile?: string;
  networkTopology?: string;
  userOrgIds?: number[]; // For filtering by user's organizations (non-superusers)
}

export async function getProjectClassificationStats(filters?: ProjectClassificationFilters) {
  const db = await getDb();
  if (!db) return {
    byClassification: [],
    byGridConnection: [],
    byConfiguration: [],
    byTopology: [],
    byCountry: [],
    byStatus: [],
    byStage: [],
    byTechnology: [],
    total: 0,
    totalCapacityMw: 0,
    totalValueUsd: 0
  };
  
  // Build base conditions from filters
  const baseConditions: ReturnType<typeof eq>[] = [];
  if (filters?.portfolioId) baseConditions.push(eq(projects.portfolioId, filters.portfolioId));
  if (filters?.organizationId) baseConditions.push(eq(projects.organizationId, filters.organizationId));
  if (filters?.country) baseConditions.push(eq(projects.country, filters.country));
  if (filters?.status) baseConditions.push(eq(projects.status, filters.status as any));
  if (filters?.stage) baseConditions.push(eq(projects.stage, filters.stage as any));
  if (filters?.assetClassification) baseConditions.push(eq(projects.assetClassification, filters.assetClassification as any));
  if (filters?.gridConnectionType) baseConditions.push(eq(projects.gridConnectionType, filters.gridConnectionType as any));
  if (filters?.configurationProfile) baseConditions.push(eq(projects.configurationProfile, filters.configurationProfile as any));
  if (filters?.networkTopology) baseConditions.push(eq(projects.networkTopology, filters.networkTopology as any));
  
  const withBaseConditions = (additionalCondition?: ReturnType<typeof isNotNull>) => {
    const conditions = additionalCondition 
      ? [additionalCondition, ...baseConditions]
      : baseConditions;
    return conditions.length > 0 ? and(...conditions) : undefined;
  };
  
  // Get counts by classification
  const classificationCounts = await db.select({
    classification: projects.assetClassification,
    count: sql<number>`count(*)`,
    capacityMw: sql<number>`SUM(capacityMw)`
  })
  .from(projects)
  .where(withBaseConditions(isNotNull(projects.assetClassification)))
  .groupBy(projects.assetClassification);
  
  // Get counts by grid connection type
  const gridConnectionCounts = await db.select({
    gridConnection: projects.gridConnectionType,
    count: sql<number>`count(*)`
  })
  .from(projects)
  .where(withBaseConditions(isNotNull(projects.gridConnectionType)))
  .groupBy(projects.gridConnectionType);
  
  // Get counts by configuration profile
  const configurationCounts = await db.select({
    configuration: projects.configurationProfile,
    count: sql<number>`count(*)`
  })
  .from(projects)
  .where(withBaseConditions(isNotNull(projects.configurationProfile)))
  .groupBy(projects.configurationProfile);
  
  // Get counts by network topology
  const topologyCounts = await db.select({
    topology: projects.networkTopology,
    count: sql<number>`count(*)`
  })
  .from(projects)
  .where(withBaseConditions(isNotNull(projects.networkTopology)))
  .groupBy(projects.networkTopology);
  
  // Get counts by country
  const countryCounts = await db.select({
    country: projects.country,
    count: sql<number>`count(*)`,
    capacityMw: sql<number>`SUM(capacityMw)`
  })
  .from(projects)
  .where(withBaseConditions(isNotNull(projects.country)))
  .groupBy(projects.country);
  
  // Get counts by status
  const statusCounts = await db.select({
    status: projects.status,
    count: sql<number>`count(*)`
  })
  .from(projects)
  .where(withBaseConditions())
  .groupBy(projects.status);
  
  // Get counts by stage
  const stageCounts = await db.select({
    stage: projects.stage,
    count: sql<number>`count(*)`
  })
  .from(projects)
  .where(withBaseConditions())
  .groupBy(projects.stage);
  
  // Get counts by technology
  const technologyCounts = await db.select({
    technology: projects.technology,
    count: sql<number>`count(*)`,
    capacityMw: sql<number>`SUM(capacityMw)`
  })
  .from(projects)
  .where(withBaseConditions())
  .groupBy(projects.technology);
  
  // Get totals
  const totalsResult = await db.select({ 
    count: sql<number>`count(*)`,
    capacityMw: sql<number>`SUM(capacityMw)`,
    valueUsd: sql<number>`SUM(projectValueUsd)`
  })
  .from(projects)
  .where(withBaseConditions());
  
  return {
    byClassification: classificationCounts.map(r => ({ 
      name: r.classification || 'Unknown', 
      value: Number(r.count),
      capacityMw: Number(r.capacityMw) || 0
    })),
    byGridConnection: gridConnectionCounts.map(r => ({ 
      name: r.gridConnection || 'Unknown', 
      value: Number(r.count) 
    })),
    byConfiguration: configurationCounts.map(r => ({ 
      name: r.configuration || 'Unknown', 
      value: Number(r.count) 
    })),
    byTopology: topologyCounts.map(r => ({ 
      name: r.topology || 'Unknown', 
      value: Number(r.count) 
    })),
    byCountry: countryCounts.map(r => ({ 
      name: r.country || 'Unknown', 
      value: Number(r.count),
      capacityMw: Number(r.capacityMw) || 0
    })),
    byStatus: statusCounts.map(r => ({ 
      name: r.status || 'Unknown', 
      value: Number(r.count) 
    })),
    byStage: stageCounts.map(r => ({ 
      name: r.stage || 'Unknown', 
      value: Number(r.count) 
    })),
    byTechnology: technologyCounts.map(r => ({ 
      name: r.technology || 'Unknown', 
      value: Number(r.count),
      capacityMw: Number(r.capacityMw) || 0
    })),
    total: Number(totalsResult[0]?.count || 0),
    totalCapacityMw: Number(totalsResult[0]?.capacityMw || 0),
    totalValueUsd: Number(totalsResult[0]?.valueUsd || 0)
  };
}

// Get all projects with classification filters
export async function getProjectsWithFilters(filters?: ProjectClassificationFilters) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof inArray>)[] = [];
  
  // CRITICAL: If userOrgIds is provided, filter by user's organizations
  // This ensures non-superusers only see projects in their organizations
  if (filters?.userOrgIds && filters.userOrgIds.length > 0) {
    conditions.push(inArray(projects.organizationId, filters.userOrgIds));
  }
  
  if (filters?.portfolioId) conditions.push(eq(projects.portfolioId, filters.portfolioId));
  if (filters?.organizationId) conditions.push(eq(projects.organizationId, filters.organizationId));
  if (filters?.country) conditions.push(eq(projects.country, filters.country));
  if (filters?.status) conditions.push(eq(projects.status, filters.status as any));
  if (filters?.stage) conditions.push(eq(projects.stage, filters.stage as any));
  if (filters?.assetClassification) conditions.push(eq(projects.assetClassification, filters.assetClassification as any));
  if (filters?.gridConnectionType) conditions.push(eq(projects.gridConnectionType, filters.gridConnectionType as any));
  if (filters?.configurationProfile) conditions.push(eq(projects.configurationProfile, filters.configurationProfile as any));
  if (filters?.networkTopology) conditions.push(eq(projects.networkTopology, filters.networkTopology as any));
  
  const query = db.select().from(projects);
  
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(projects.capacityMw));
  }
  
  return query.orderBy(desc(projects.capacityMw));
}


// ═══════════════════════════════════════════════════════════════
// VIEW SCOPING - Functions for managing portfolio views
// ═══════════════════════════════════════════════════════════════

/**
 * Create a new portfolio view
 */
export async function createPortfolioView(data: {
  organizationId?: number;
  portfolioId?: number;
  name: string;
  description?: string;
  filterCriteria?: {
    countries?: string[];
    statuses?: string[];
    assetClassifications?: string[];
    gridConnectionTypes?: string[];
    configurationProfiles?: string[];
    couplingTopologies?: string[];
    distributionTopologies?: string[];
    capacityMinMw?: number;
    capacityMaxMw?: number;
  };
  viewType?: "dynamic" | "static";
  isPublic?: boolean;
  createdById?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(portfolioViews).values({
    organizationId: data.organizationId,
    portfolioId: data.portfolioId,
    name: data.name,
    description: data.description,
    filterCriteria: data.filterCriteria,
    viewType: data.viewType || "dynamic",
    isPublic: data.isPublic || false,
    createdById: data.createdById,
  });
  return result.insertId;
}

/**
 * Get a portfolio view by ID
 */
export async function getPortfolioView(viewId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(portfolioViews)
    .where(eq(portfolioViews.id, viewId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all portfolio views for an organization
 */
export async function getPortfolioViews(organizationId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  if (organizationId) {
    return db
      .select()
      .from(portfolioViews)
      .where(eq(portfolioViews.organizationId, organizationId))
      .orderBy(portfolioViews.name);
  }
  return db.select().from(portfolioViews).orderBy(portfolioViews.name);
}

/**
 * Add assets to a static view
 */
export async function addAssetsToView(viewId: number, projectIds: number[], addedById?: number) {
  const db = await getDb();
  if (!db) return;
  
  const values = projectIds.map(projectId => ({
    viewId,
    projectId,
    addedById,
  }));
  await db.insert(viewAssets).values(values);
}

/**
 * Remove assets from a static view
 */
export async function removeAssetsFromView(viewId: number, projectIds: number[]) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .delete(viewAssets)
    .where(
      and(
        eq(viewAssets.viewId, viewId),
        inArray(viewAssets.projectId, projectIds)
      )
    );
}

/**
 * Get assets for a view (supports both dynamic and static views)
 * This is the CANONICAL query path for view-scoped data
 */
export async function getAssetsForView(
  viewId: number,
  additionalFilters?: {
    country?: string;
    status?: string;
    assetClassification?: string;
    gridConnectionType?: string;
    configurationProfile?: string;
  }
) {
  const db = await getDb();
  if (!db) return [];
  
  const view = await getPortfolioView(viewId);
  if (!view) {
    throw new Error(`View not found: ${viewId}`);
  }

  if (view.viewType === "static") {
    // Static view: get explicit asset list from junction table
    const assetIds = await db
      .select({ projectId: viewAssets.projectId })
      .from(viewAssets)
      .where(eq(viewAssets.viewId, viewId));
    
    if (assetIds.length === 0) {
      return [];
    }

    const conditions: ReturnType<typeof eq>[] = [];
    conditions.push(inArray(projects.id, assetIds.map(a => a.projectId)));

    // Apply additional filters
    if (additionalFilters?.country) {
      conditions.push(eq(projects.country, additionalFilters.country));
    }
    if (additionalFilters?.status) {
      conditions.push(eq(projects.status, additionalFilters.status as any));
    }
    if (additionalFilters?.assetClassification) {
      conditions.push(eq(projects.assetClassification, additionalFilters.assetClassification as any));
    }

    return db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(projects.name);
  } else {
    // Dynamic view: apply filter criteria
    const criteria = view.filterCriteria as any || {};
    const conditions: ReturnType<typeof eq>[] = [];

    // Apply view's filter criteria
    if (criteria.countries?.length) {
      conditions.push(inArray(projects.country, criteria.countries));
    }
    if (criteria.statuses?.length) {
      conditions.push(inArray(projects.status, criteria.statuses));
    }
    if (criteria.assetClassifications?.length) {
      conditions.push(inArray(projects.assetClassification, criteria.assetClassifications));
    }
    if (criteria.gridConnectionTypes?.length) {
      conditions.push(inArray(projects.gridConnectionType, criteria.gridConnectionTypes));
    }
    if (criteria.configurationProfiles?.length) {
      conditions.push(inArray(projects.configurationProfile, criteria.configurationProfiles));
    }

    // Apply additional filters (override view criteria)
    if (additionalFilters?.country) {
      conditions.push(eq(projects.country, additionalFilters.country));
    }
    if (additionalFilters?.status) {
      conditions.push(eq(projects.status, additionalFilters.status as any));
    }
    if (additionalFilters?.assetClassification) {
      conditions.push(eq(projects.assetClassification, additionalFilters.assetClassification as any));
    }

    if (conditions.length === 0) {
      return db.select().from(projects).orderBy(projects.name);
    }

    return db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(projects.name);
  }
}

/**
 * Get classification stats for a specific view
 * This ensures charts only show data for the current view scope
 */
export async function getViewClassificationStats(
  viewId: number,
  additionalFilters?: {
    country?: string;
    status?: string;
    assetClassification?: string;
  }
) {
  const assets = await getAssetsForView(viewId, additionalFilters);
  
  // Aggregate stats from the filtered assets
  const byClassification: Record<string, { count: number; capacityMw: number }> = {};
  const byGridConnection: Record<string, number> = {};
  const byConfigProfile: Record<string, number> = {};
  const byCountry: Record<string, { count: number; capacityMw: number }> = {};
  const byStatus: Record<string, number> = {};
  
  let totalCapacityMw = 0;
  let totalInvestment = 0;

  for (const asset of assets) {
    const capacityMw = parseFloat(asset.capacityMw?.toString() || "0");
    totalCapacityMw += capacityMw;
    // totalInvestment field doesn't exist on assets - using 0 as placeholder
    totalInvestment += 0;

    // By classification
    const classification = asset.assetClassification || "unknown";
    if (!byClassification[classification]) {
      byClassification[classification] = { count: 0, capacityMw: 0 };
    }
    byClassification[classification].count++;
    byClassification[classification].capacityMw += capacityMw;

    // By grid connection
    const gridConnection = asset.gridConnectionType || "unknown";
    byGridConnection[gridConnection] = (byGridConnection[gridConnection] || 0) + 1;

    // By config profile
    const configProfile = asset.configurationProfile || "unknown";
    byConfigProfile[configProfile] = (byConfigProfile[configProfile] || 0) + 1;

    // By country
    const country = asset.country || "unknown";
    if (!byCountry[country]) {
      byCountry[country] = { count: 0, capacityMw: 0 };
    }
    byCountry[country].count++;
    byCountry[country].capacityMw += capacityMw;

    // By status
    const status = asset.status || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  return {
    total: assets.length,
    totalCapacityMw,
    totalInvestment,
    byClassification: Object.entries(byClassification).map(([name, data]) => ({
      name,
      value: data.count,
      capacityMw: data.capacityMw,
    })),
    byGridConnection: Object.entries(byGridConnection).map(([name, value]) => ({
      name,
      value,
    })),
    byConfigProfile: Object.entries(byConfigProfile).map(([name, value]) => ({
      name,
      value,
    })),
    byCountry: Object.entries(byCountry).map(([name, data]) => ({
      name,
      value: data.count,
      capacityMw: data.capacityMw,
    })),
    byStatus: Object.entries(byStatus).map(([name, value]) => ({
      name,
      value,
    })),
  };
}

/**
 * Delete a portfolio view
 */
export async function deletePortfolioView(viewId: number) {
  const db = await getDb();
  if (!db) return;
  
  // First delete all asset associations
  await db.delete(viewAssets).where(eq(viewAssets.viewId, viewId));
  
  // Then delete the view
  await db.delete(portfolioViews).where(eq(portfolioViews.id, viewId));
}

/**
 * Update a portfolio view
 */
export async function updatePortfolioView(viewId: number, data: {
  name?: string;
  description?: string;
  filterCriteria?: any;
  isPublic?: boolean;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(portfolioViews)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(portfolioViews.id, viewId));
}


// =============================================================================
// CONVERSATIONAL AGENT - IDENTITY RESOLUTION
// =============================================================================

/**
 * Resolve identity from channel identifier (phone, email, etc.)
 * Per Patch C: EXACT MATCH ONLY on verified identifiers
 * Never infer identity from email domain unless explicitly configured
 * If ambiguous → returns null (caller should quarantine)
 */
export async function resolveIdentity(
  type: 'whatsapp_phone' | 'email' | 'phone' | 'slack_id',
  value: string
): Promise<{
  userId: number;
  organizationId: number | null;
  status: 'pending' | 'verified' | 'revoked';
} | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Normalize the identifier value
  const normalizedValue = normalizeIdentifier(type, value);
  
  // EXACT MATCH ONLY - no fuzzy matching, no domain inference
  const results = await db.select({
    userId: userIdentifiers.userId,
    organizationId: userIdentifiers.organizationId,
    status: userIdentifiers.status,
  })
  .from(userIdentifiers)
  .where(
    and(
      eq(userIdentifiers.type, type),
      eq(userIdentifiers.value, normalizedValue),
      ne(userIdentifiers.status, 'revoked') // Exclude revoked identifiers
    )
  )
  .limit(2); // Get 2 to detect ambiguity
  
  // If no match or multiple matches (ambiguous) → return null
  if (results.length !== 1) {
    return null;
  }
  
  return results[0];
}

/**
 * Normalize identifier value based on type
 */
function normalizeIdentifier(type: string, value: string): string {
  switch (type) {
    case 'whatsapp_phone':
    case 'phone':
      // Remove all non-digit characters except leading +
      return value.replace(/[^\d+]/g, '').replace(/^\+/, '+');
    case 'email':
      // Lowercase email
      return value.toLowerCase().trim();
    case 'slack_id':
      return value.trim();
    default:
      return value.trim();
  }
}

/**
 * Create a new user identifier
 */
export async function createUserIdentifier(data: InsertUserIdentifier) {
  const db = await getDb();
  if (!db) return null;
  
  // Normalize the value before storing
  const normalizedValue = normalizeIdentifier(data.type, data.value);
  
  const result = await db.insert(userIdentifiers).values({
    ...data,
    value: normalizedValue,
  });
  
  return result[0]?.insertId;
}

/**
 * Verify a user identifier (admin action)
 */
export async function verifyUserIdentifier(identifierId: number, verifiedByUserId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userIdentifiers)
    .set({
      status: 'verified',
      verifiedAt: new Date(),
      verifiedBy: verifiedByUserId,
    })
    .where(eq(userIdentifiers.id, identifierId));
}

/**
 * Revoke a user identifier
 */
export async function revokeUserIdentifier(identifierId: number, revokedByUserId: number, reason?: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userIdentifiers)
    .set({
      status: 'revoked',
      revokedAt: new Date(),
      revokedBy: revokedByUserId,
      revokedReason: reason || null,
    })
    .where(eq(userIdentifiers.id, identifierId));
}

/**
 * Get all identifiers for a user
 */
export async function getUserIdentifiers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(userIdentifiers)
    .where(eq(userIdentifiers.userId, userId))
    .orderBy(desc(userIdentifiers.createdAt));
}

// =============================================================================
// CONVERSATIONAL AGENT - UNCLAIMED INBOUND (QUARANTINE)
// =============================================================================

/**
 * Quarantine an inbound message from unknown sender
 */
export async function quarantineInbound(data: InsertUnclaimedInbound) {
  const db = await getDb();
  if (!db) return null;
  
  // Set expiry to 30 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  const result = await db.insert(unclaimedInbound).values({
    ...data,
    expiresAt,
  });
  
  return result[0]?.insertId;
}

/**
 * Get pending unclaimed inbound messages for admin triage
 */
export async function getPendingUnclaimedInbound(organizationId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(unclaimedInbound.status, 'pending')];
  
  if (organizationId) {
    conditions.push(eq(unclaimedInbound.guessedOrganizationId, organizationId));
  }
  
  return db.select()
    .from(unclaimedInbound)
    .where(and(...conditions))
    .orderBy(desc(unclaimedInbound.receivedAt))
    .limit(limit);
}

/**
 * Claim an unclaimed inbound message (link to user)
 */
export async function claimInbound(
  inboundId: number,
  claimedByUserId: number,
  adminId: number,
  createIdentifier: boolean = true
) {
  const db = await getDb();
  if (!db) return null;
  
  // Get the inbound record
  const [inbound] = await db.select()
    .from(unclaimedInbound)
    .where(eq(unclaimedInbound.id, inboundId))
    .limit(1);
  
  if (!inbound || inbound.status !== 'pending') {
    return null;
  }
  
  // Update the inbound record
  await db.update(unclaimedInbound)
    .set({
      status: 'claimed',
      claimedByUserId,
      claimedAt: new Date(),
      claimedByAdminId: adminId,
    })
    .where(eq(unclaimedInbound.id, inboundId));
  
  // Optionally create a verified identifier for future messages
  if (createIdentifier) {
    const type = inbound.channel === 'whatsapp' ? 'whatsapp_phone' : 
                 inbound.channel === 'email' ? 'email' : 'phone';
    
    await createUserIdentifier({
      type,
      value: inbound.senderIdentifier,
      userId: claimedByUserId,
      organizationId: inbound.guessedOrganizationId,
      status: 'verified',
      verifiedAt: new Date(),
      verifiedBy: adminId,
    });
  }
  
  return inbound;
}

/**
 * Reject an unclaimed inbound message
 */
export async function rejectInbound(inboundId: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(unclaimedInbound)
    .set({
      status: 'rejected',
      rejectedReason: reason,
    })
    .where(eq(unclaimedInbound.id, inboundId));
}

// =============================================================================
// CONVERSATIONAL AGENT - CONVERSATION SESSIONS
// =============================================================================

/**
 * Get or create a conversation session for a user+channel
 */
export async function getOrCreateConversationSession(
  userId: number,
  channel: 'whatsapp' | 'email' | 'web_chat',
  channelIdentifier?: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  // Try to find existing session
  const conditions = [
    eq(conversationSessions.userId, userId),
    eq(conversationSessions.channel, channel),
  ];
  
  if (channelIdentifier) {
    conditions.push(eq(conversationSessions.channelIdentifier, channelIdentifier));
  }
  
  const [existing] = await db.select()
    .from(conversationSessions)
    .where(and(...conditions))
    .limit(1);
  
  if (existing) {
    // Update last activity
    await db.update(conversationSessions)
      .set({
        lastActivityAt: new Date(),
        messageCount: (existing.messageCount || 0) + 1,
      })
      .where(eq(conversationSessions.id, existing.id));
    
    return existing.id;
  }
  
  // Create new session
  const result = await db.insert(conversationSessions).values({
    userId,
    channel,
    channelIdentifier,
    lastActivityAt: new Date(),
    messageCount: 1,
  });
  
  return result[0]?.insertId || 0;
}

/**
 * Get conversation session by ID
 */
export async function getConversationSession(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [session] = await db.select()
    .from(conversationSessions)
    .where(eq(conversationSessions.id, sessionId))
    .limit(1);
  
  return session || null;
}

/**
 * Update conversation context pointers
 */
export async function updateConversationContext(
  sessionId: number,
  context: {
    lastReferencedProjectId?: number | null;
    lastReferencedSiteId?: number | null;
    lastReferencedAssetId?: number | null;
    lastReferencedDocumentId?: number | null;
    activeDataroomId?: number | null;
    activeViewScopeId?: number | null;
  }
) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(conversationSessions)
    .set({
      ...context,
      lastActivityAt: new Date(),
    })
    .where(eq(conversationSessions.id, sessionId));
}

/**
 * Set pending action for confirmation (safety rails)
 */
export async function setPendingAction(
  sessionId: number,
  action: 'confirm_export' | 'confirm_share_dataroom' | 'confirm_delete' | 'confirm_verify' | 'confirm_permission_change' | 'confirm_link_attachment',
  payload: any,
  expiresInMinutes: number = 5
) {
  const db = await getDb();
  if (!db) return;
  
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
  
  await db.update(conversationSessions)
    .set({
      pendingAction: action,
      pendingActionPayload: payload,
      pendingActionExpiresAt: expiresAt,
      lastActivityAt: new Date(),
    })
    .where(eq(conversationSessions.id, sessionId));
}

/**
 * Clear pending action (after confirmation or expiry)
 */
export async function clearPendingAction(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(conversationSessions)
    .set({
      pendingAction: 'none',
      pendingActionPayload: null,
      pendingActionExpiresAt: null,
    })
    .where(eq(conversationSessions.id, sessionId));
}

// =============================================================================
// CONVERSATIONAL AGENT - ATTACHMENT LINKING (Patch D)
// =============================================================================

/**
 * Create primary link for an attachment
 * Each attachment has ONE primary link (asset OR project OR site)
 */
export async function createPrimaryAttachmentLink(data: {
  ingestedFileId?: number;
  artifactId?: number;
  projectId?: number;
  siteId?: number;
  assetId?: number;
  linkedBy: 'ai_suggestion' | 'user_confirmed' | 'admin_assigned' | 'auto_rule';
  aiConfidence?: number;
  linkedByUserId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Validate: exactly one primary target must be set
  const targets = [data.projectId, data.siteId, data.assetId].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error('Primary link must have exactly one target (project, site, or asset)');
  }
  
  const result = await db.insert(attachmentLinks).values({
    ingestedFileId: data.ingestedFileId,
    artifactId: data.artifactId,
    linkType: 'primary',
    projectId: data.projectId,
    siteId: data.siteId,
    assetId: data.assetId,
    linkedBy: data.linkedBy,
    aiConfidence: data.aiConfidence?.toString(),
    linkedByUserId: data.linkedByUserId,
  });
  
  return result[0]?.insertId;
}

/**
 * Create secondary link for an attachment
 * May have multiple secondary links (dataroom row, checklist row, view scope)
 */
export async function createSecondaryAttachmentLink(data: {
  ingestedFileId?: number;
  artifactId?: number;
  dataroomId?: number;
  dataroomItemId?: number;
  checklistItemId?: number;
  viewScopeId?: number;
  linkedBy: 'ai_suggestion' | 'user_confirmed' | 'admin_assigned' | 'auto_rule';
  aiConfidence?: number;
  linkedByUserId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(attachmentLinks).values({
    ingestedFileId: data.ingestedFileId,
    artifactId: data.artifactId,
    linkType: 'secondary',
    dataroomId: data.dataroomId,
    dataroomItemId: data.dataroomItemId,
    checklistItemId: data.checklistItemId,
    viewScopeId: data.viewScopeId,
    linkedBy: data.linkedBy,
    aiConfidence: data.aiConfidence?.toString(),
    linkedByUserId: data.linkedByUserId,
  });
  
  return result[0]?.insertId;
}

/**
 * Get all links for an attachment
 */
export async function getAttachmentLinks(ingestedFileId?: number, artifactId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (ingestedFileId) conditions.push(eq(attachmentLinks.ingestedFileId, ingestedFileId));
  if (artifactId) conditions.push(eq(attachmentLinks.artifactId, artifactId));
  
  if (conditions.length === 0) return [];
  
  return db.select()
    .from(attachmentLinks)
    .where(or(...conditions))
    .orderBy(attachmentLinks.linkType, desc(attachmentLinks.createdAt));
}

/**
 * Get unlinked attachments (no primary link) for human triage
 */
export async function getUnlinkedAttachments(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  // Get ingested files that have no primary link
  const linkedFileIds = db.select({ id: attachmentLinks.ingestedFileId })
    .from(attachmentLinks)
    .where(
      and(
        eq(attachmentLinks.linkType, 'primary'),
        isNotNull(attachmentLinks.ingestedFileId)
      )
    );
  
  return db.select()
    .from(ingestedFiles)
    .where(notInArray(ingestedFiles.id, linkedFileIds))
    .orderBy(desc(ingestedFiles.createdAt))
    .limit(limit);
}


// ============ IDENTITY MANAGEMENT (Admin UI) ============

/**
 * Get all user identifiers with user and org info (admin function)
 */
export async function getAllUserIdentifiers() {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db
    .select({
      id: userIdentifiers.id,
      identifierType: userIdentifiers.type,
      identifierValue: userIdentifiers.value,
      userId: userIdentifiers.userId,
      organizationId: userIdentifiers.organizationId,
      status: userIdentifiers.status,
      createdAt: userIdentifiers.createdAt,
      userName: users.name,
      organizationName: organizations.name,
    })
    .from(userIdentifiers)
    .leftJoin(users, eq(userIdentifiers.userId, users.id))
    .leftJoin(organizations, eq(userIdentifiers.organizationId, organizations.id))
    .orderBy(desc(userIdentifiers.createdAt));
  
  return results;
}


/**
 * Get conversation sessions with optional filters
 */
export async function getConversationSessions(
  userId?: number,
  channel?: 'whatsapp' | 'email',
  limit: number = 50
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (userId) conditions.push(eq(conversationSessions.userId, userId));
  if (channel) conditions.push(eq(conversationSessions.channel, channel));
  
  const results = await db
    .select({
      id: conversationSessions.id,
      userId: conversationSessions.userId,
      channel: conversationSessions.channel,
      lastReferencedProjectId: conversationSessions.lastReferencedProjectId,
      lastReferencedSiteId: conversationSessions.lastReferencedSiteId,
      lastReferencedAssetId: conversationSessions.lastReferencedAssetId,
      lastReferencedDocumentId: conversationSessions.lastReferencedDocumentId,
      activeDataroomId: conversationSessions.activeDataroomId,
      activeViewScopeId: conversationSessions.activeViewScopeId,
      lastActivityAt: conversationSessions.lastActivityAt,
      userName: users.name,
    })
    .from(conversationSessions)
    .leftJoin(users, eq(conversationSessions.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(conversationSessions.lastActivityAt))
    .limit(limit);
  
  return results;
}


// Get messages for a specific conversation session
export async function getSessionMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get WhatsApp messages linked to this session
  const results = await db.select()
    .from(whatsappMessages)
    .where(eq(whatsappMessages.sessionId, sessionId))
    .orderBy(asc(whatsappMessages.timestamp));
  
  return results;
}

// ============ PROFILE MANAGEMENT ============

export async function updateUserProfile(userId: number, data: {
  name?: string;
  avatarUrl?: string;
  organization?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
  if (data.organization !== undefined) updateData.organization = data.organization;
  if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;
  if (data.emailVerifiedAt !== undefined) updateData.emailVerifiedAt = data.emailVerifiedAt;
  
  if (Object.keys(updateData).length === 0) return null;
  
  await db.update(users)
    .set(updateData)
    .where(eq(users.id, userId));
  
  // Return updated user
  const result = await db.select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result[0] || null;
}

export async function updateUserNotificationPreferences(userId: number, preferences: {
  emailDocuments?: boolean;
  emailRfis?: boolean;
  emailAlerts?: boolean;
  emailReports?: boolean;
  inAppDocuments?: boolean;
  inAppRfis?: boolean;
  inAppAlerts?: boolean;
  digestFrequency?: "realtime" | "daily" | "weekly";
  whatsappEnabled?: boolean;
  whatsappDocuments?: boolean;
  whatsappRfis?: boolean;
  whatsappAlerts?: boolean;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current preferences
  const currentUser = await db.select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  const currentPrefs = currentUser[0]?.notificationPreferences || {
    emailDocuments: true,
    emailRfis: true,
    emailAlerts: true,
    emailReports: true,
    inAppDocuments: true,
    inAppRfis: true,
    inAppAlerts: true,
    digestFrequency: "realtime" as const,
  };
  
  // Merge with new preferences
  const updatedPrefs = {
    ...currentPrefs,
    ...preferences,
  };
  
  await db.update(users)
    .set({ notificationPreferences: updatedPrefs })
    .where(eq(users.id, userId));
  
  return updatedPrefs;
}

export async function getUserNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({ notificationPreferences: users.notificationPreferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return result[0]?.notificationPreferences || {
    emailDocuments: true,
    emailRfis: true,
    emailAlerts: true,
    emailReports: true,
    inAppDocuments: true,
    inAppRfis: true,
    inAppAlerts: true,
    digestFrequency: "realtime" as const,
  };
}

export async function enable2FA(userId: number, totpSecret: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ totpSecret, totpEnabled: true })
    .where(eq(users.id, userId));
  
  return true;
}

export async function disable2FA(userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ totpSecret: null, totpEnabled: false })
    .where(eq(users.id, userId));
  
  return true;
}

export async function getUser2FAStatus(userId: number) {
  const db = await getDb();
  if (!db) return { enabled: false, hasSecret: false };
  
  const result = await db.select({ 
    totpEnabled: users.totpEnabled,
    totpSecret: users.totpSecret 
  })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!result[0]) return { enabled: false, hasSecret: false };
  
  return {
    enabled: result[0].totpEnabled || false,
    hasSecret: !!result[0].totpSecret,
  };
}


// ============ USER ACTIVITY LOG ============

export type ActivityAction = 
  | "login"
  | "logout"
  | "profile_update"
  | "avatar_upload"
  | "password_change"
  | "2fa_enable"
  | "2fa_disable"
  | "document_upload"
  | "document_view"
  | "document_download"
  | "settings_change"
  | "email_change_request"
  | "email_verified"
  | "notification_preferences_update"
  | "project_create"
  | "project_update"
  | "rfi_create"
  | "rfi_update"
  | "checklist_update";

export async function logUserActivity(
  userId: number,
  action: ActivityAction,
  options?: {
    resourceType?: string;
    resourceId?: number;
    resourceName?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.insert(userActivityLog).values({
      userId,
      action,
      resourceType: options?.resourceType || null,
      resourceId: options?.resourceId || null,
      resourceName: options?.resourceName || null,
      metadata: options?.metadata || null,
      ipAddress: options?.ipAddress || null,
      userAgent: options?.userAgent || null,
    });
    
    return result[0]?.insertId || null;
  } catch (error) {
    console.error("[Activity Log] Failed to log activity:", error);
    return null;
  }
}

export async function getUserActivityLogs(
  userId: number,
  options?: {
    limit?: number;
    offset?: number;
    actions?: ActivityAction[];
  }
) {
  const db = await getDb();
  if (!db) return [];
  
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  
  let query = db.select()
    .from(userActivityLog)
    .where(eq(userActivityLog.userId, userId))
    .orderBy(desc(userActivityLog.createdAt))
    .limit(limit)
    .offset(offset);
  
  if (options?.actions && options.actions.length > 0) {
    query = db.select()
      .from(userActivityLog)
      .where(and(
        eq(userActivityLog.userId, userId),
        inArray(userActivityLog.action, options.actions)
      ))
      .orderBy(desc(userActivityLog.createdAt))
      .limit(limit)
      .offset(offset);
  }
  
  return query;
}

export async function getUserActivityCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(userActivityLog)
    .where(eq(userActivityLog.userId, userId));
  
  return result[0]?.count || 0;
}

// ============ EMAIL VERIFICATION ============

export async function createEmailVerification(
  userId: number,
  newEmail: string,
  token: string,
  expiresAt: Date
) {
  const db = await getDb();
  if (!db) return null;
  
  // Cancel any existing pending verifications for this user
  await db.delete(emailVerifications)
    .where(and(
      eq(emailVerifications.userId, userId),
      isNull(emailVerifications.verifiedAt)
    ));
  
  const result = await db.insert(emailVerifications).values({
    userId,
    newEmail,
    token,
    expiresAt,
  });
  
  return result[0]?.insertId || null;
}

export async function getEmailVerificationByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(emailVerifications)
    .where(eq(emailVerifications.token, token))
    .limit(1);
  
  return result[0] || null;
}

export async function getPendingEmailVerification(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(emailVerifications)
    .where(and(
      eq(emailVerifications.userId, userId),
      isNull(emailVerifications.verifiedAt),
      gt(emailVerifications.expiresAt, new Date())
    ))
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);
  
  return result[0] || null;
}

export async function verifyEmail(token: string) {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };
  
  const verification = await getEmailVerificationByToken(token);
  
  if (!verification) {
    return { success: false, error: "Invalid verification token" };
  }
  
  if (verification.verifiedAt) {
    return { success: false, error: "Email already verified" };
  }
  
  if (verification.expiresAt < new Date()) {
    return { success: false, error: "Verification token expired" };
  }
  
  // Update user email
  await db.update(users)
    .set({ email: verification.newEmail })
    .where(eq(users.id, verification.userId));
  
  // Mark verification as complete
  await db.update(emailVerifications)
    .set({ verifiedAt: new Date() })
    .where(eq(emailVerifications.id, verification.id));
  
  return { success: true, userId: verification.userId, newEmail: verification.newEmail };
}

export async function cancelEmailVerification(userId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(emailVerifications)
    .where(and(
      eq(emailVerifications.userId, userId),
      isNull(emailVerifications.verifiedAt)
    ));
  
  return true;
}

export async function updateUserEmail(userId: number, email: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ email })
    .where(eq(users.id, userId));
  
  return true;
}


// ============ BACKGROUND JOB QUEUE ============

// Re-export Job type from schema
export type { Job } from "../drizzle/schema";

export type JobType = 
  | "document_ingestion"
  | "ai_extraction"
  | "email_send"
  | "notification_send"
  | "report_generation"
  | "data_export"
  | "file_processing"
  | "webhook_delivery";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type JobPriority = "low" | "normal" | "high" | "critical";

export async function createJob(
  type: JobType,
  payload: Record<string, unknown>,
  options?: {
    priority?: JobPriority;
    userId?: number;
    organizationId?: number;
    correlationId?: string;
    parentJobId?: number;
    scheduledFor?: Date;
    maxAttempts?: number;
  }
): Promise<{ id: number; correlationId: string } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const correlationId = options?.correlationId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const result = await db.insert(jobs).values({
    type,
    status: "queued",
    priority: options?.priority || "normal",
    payload: payload,
    userId: options?.userId,
    organizationId: options?.organizationId,
    correlationId,
    parentJobId: options?.parentJobId,
    scheduledFor: options?.scheduledFor,
    maxAttempts: options?.maxAttempts || 3,
    attempts: 0,
  });
  
  const insertId = result[0]?.insertId;
  if (!insertId) return null;
  
  return { id: insertId, correlationId };
}

export async function getJob(jobId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result[0] || null;
}

export async function getJobByCorrelationId(correlationId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(jobs).where(eq(jobs.correlationId, correlationId)).limit(1);
  return result[0] || null;
}

export async function getQueuedJobs(options?: {
  type?: JobType;
  limit?: number;
  priority?: JobPriority;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(jobs.status, "queued"),
    or(isNull(jobs.scheduledFor), sql`${jobs.scheduledFor} <= NOW()`)
  ];
  
  if (options?.type) {
    conditions.push(eq(jobs.type, options.type));
  }
  if (options?.priority) {
    conditions.push(eq(jobs.priority, options.priority));
  }
  
  return db.select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(
      desc(sql`FIELD(${jobs.priority}, 'critical', 'high', 'normal', 'low')`),
      asc(jobs.createdAt)
    )
    .limit(options?.limit || 10);
}

export async function startJob(jobId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(jobs)
    .set({
      status: "processing",
      startedAt: new Date(),
      attempts: sql`${jobs.attempts} + 1`,
    })
    .where(eq(jobs.id, jobId));
  
  return true;
}

export async function completeJob(jobId: number, result?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(jobs)
    .set({
      status: "completed",
      result: result || {},
      completedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
  
  return true;
}

export async function failJob(jobId: number, error: string) {
  const db = await getDb();
  if (!db) return false;
  
  const job = await getJob(jobId);
  if (!job) return false;
  
  const shouldRetry = job.attempts < job.maxAttempts;
  
  await db.update(jobs)
    .set({
      status: shouldRetry ? "queued" : "failed",
      error,
      failedAt: shouldRetry ? null : new Date(),
    })
    .where(eq(jobs.id, jobId));
  
  return shouldRetry;
}

export async function cancelJob(jobId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(jobs)
    .set({ status: "cancelled" })
    .where(and(
      eq(jobs.id, jobId),
      inArray(jobs.status, ["queued", "processing"])
    ));
  
  return true;
}

export async function getJobsByUser(userId: number, options?: {
  status?: JobStatus;
  type?: JobType;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(jobs.userId, userId)];
  
  if (options?.status) {
    conditions.push(eq(jobs.status, options.status));
  }
  if (options?.type) {
    conditions.push(eq(jobs.type, options.type));
  }
  
  return db.select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

export async function getAllJobs(options?: {
  status?: JobStatus;
  type?: JobType;
  userId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  
  if (options?.status) {
    conditions.push(eq(jobs.status, options.status));
  }
  if (options?.type) {
    conditions.push(eq(jobs.type, options.type));
  }
  if (options?.userId) {
    conditions.push(eq(jobs.userId, options.userId));
  }
  
  const query = db.select().from(jobs);
  
  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);
  }
  
  return query
    .orderBy(desc(jobs.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

export async function getJobsCount(options?: {
  status?: JobStatus;
  type?: JobType;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions: SQL[] = [];
  
  if (options?.status) {
    conditions.push(eq(jobs.status, options.status));
  }
  if (options?.type) {
    conditions.push(eq(jobs.type, options.type));
  }
  if (options?.userId) {
    conditions.push(eq(jobs.userId, options.userId));
  }
  
  const query = db.select({ count: sql<number>`count(*)` }).from(jobs);
  
  if (conditions.length > 0) {
    const result = await query.where(and(...conditions));
    return result[0]?.count || 0;
  }
  
  const result = await query;
  return result[0]?.count || 0;
}

export async function logJobMessage(
  jobId: number,
  level: "debug" | "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(jobLogs).values({
    jobId,
    level,
    message,
    data,
  });
  
  return result[0]?.insertId || null;
}

export async function getJobLogs(jobId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(jobLogs)
    .where(eq(jobLogs.jobId, jobId))
    .orderBy(asc(jobLogs.createdAt));
}

export async function getJobsByEntity(
  entityType: string,
  entityId: number,
  status?: JobStatus
) {
  const db = await getDb();
  if (!db) return [];
  
  // Jobs store entity info in payload, so we need to filter in application
  const allJobs = await db.select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(100);
  
  return allJobs.filter(job => {
    const payload = job.payload as Record<string, unknown> | null;
    if (!payload) return false;
    
    const jobEntityType = payload.entityType ?? payload.linkedEntityType;
    const jobEntityId = payload.entityId ?? payload.linkedEntityId;
    
    const matchesEntity = jobEntityType === entityType && jobEntityId === entityId;
    const matchesStatus = !status || job.status === status;
    
    return matchesEntity && matchesStatus;
  });
}

export async function retryJob(jobId: number): Promise<{ success: boolean; newJobId?: number }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  const originalJob = await getJob(jobId);
  if (!originalJob || originalJob.status !== 'failed') return { success: false };
  
  // Keep original job as failed (preserve audit trail)
  // Create a NEW job with same parameters - fresh start with attempts=0
  // This allows unlimited manual retries while each job tracks its own processing attempts
  const retryCount = await getRetryChainCount(jobId);
  
  const newJobResult = await db.insert(jobs).values({
    type: originalJob.type,
    status: 'queued',
    priority: originalJob.priority,
    payload: originalJob.payload,
    attempts: 0, // Fresh start - each new job gets its own attempt counter
    maxAttempts: originalJob.maxAttempts,
    correlationId: originalJob.correlationId, // Keep same correlation ID for tracing
    parentJobId: originalJob.id, // Link to original job
    userId: originalJob.userId,
    organizationId: originalJob.organizationId,
  });
  
  const newJobId = Number(newJobResult[0].insertId);
  
  // Log the retry on the original job
  await logJobMessage(jobId, 'info', `Job retry initiated - new job created with ID ${newJobId}`);
  
  // Log on the new job
  await logJobMessage(newJobId, 'info', `Retry #${retryCount + 1} of original job chain (starting from job ${originalJob.parentJobId || originalJob.id})`);
  
  return { success: true, newJobId };
}

// Helper to count how many times a job chain has been retried
export async function getRetryChainCount(jobId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const job = await getJob(jobId);
  if (!job) return 0;
  
  // Find the root job (one without parentJobId)
  let rootJobId = job.parentJobId || job.id;
  let currentJob = job;
  
  // Walk up the chain to find root
  while (currentJob.parentJobId) {
    const parentJob = await getJob(currentJob.parentJobId);
    if (!parentJob) break;
    rootJobId = parentJob.parentJobId || parentJob.id;
    currentJob = parentJob;
  }
  
  // Count all jobs in this chain (jobs with this rootJobId as ancestor)
  const chainJobs = await db.select().from(jobs).where(
    or(
      eq(jobs.id, rootJobId),
      eq(jobs.parentJobId, rootJobId)
    )
  );
  
  // Count retries (chain length - 1, since first job isn't a retry)
  return Math.max(0, chainJobs.length - 1);
}

export async function updateJobProgress(
  jobId: number,
  progress: number,
  progressMessage?: string
) {
  const db = await getDb();
  if (!db) return false;
  
  const job = await getJob(jobId);
  if (!job) return false;
  
  const payload = (job.payload as Record<string, unknown>) ?? {};
  payload.progress = progress;
  if (progressMessage) {
    payload.progressMessage = progressMessage;
  }
  
  await db.update(jobs)
    .set({ payload })
    .where(eq(jobs.id, jobId));
  
  return true;
}

// ============ FILE UPLOADS ============

export type FileUploadSource = "web" | "whatsapp" | "email" | "api";
export type FileUploadStatus = "uploading" | "uploaded" | "processing" | "processed" | "failed";

// Allowed file types for validation
const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

// Max file sizes by type (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  "application/pdf": 100 * 1024 * 1024, // 100MB
  "image/": 20 * 1024 * 1024, // 20MB
  "audio/": 50 * 1024 * 1024, // 50MB
  "video/": 500 * 1024 * 1024, // 500MB
  "default": 50 * 1024 * 1024, // 50MB default
};

export function validateFileUpload(
  mimeType: string,
  fileSize: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check mime type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    errors.push(`File type '${mimeType}' is not allowed`);
  }
  
  // Check file size
  let maxSize = MAX_FILE_SIZES.default;
  for (const [prefix, size] of Object.entries(MAX_FILE_SIZES)) {
    if (mimeType.startsWith(prefix)) {
      maxSize = size;
      break;
    }
  }
  
  if (fileSize > maxSize) {
    errors.push(`File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function createFileUpload(data: {
  source: FileUploadSource;
  sourceId?: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storageKey: string;
  storageUrl?: string;
  userId?: number;
  organizationId?: number;
  projectId?: number;
}): Promise<{ id: number | null; valid: boolean; errors: string[] }> {
  const db = await getDb();
  if (!db) return { id: null, valid: false, errors: ["Database not available"] };
  
  // Validate file
  const validation = validateFileUpload(data.mimeType, data.fileSize);
  
  // Extract file extension
  const fileExtension = data.originalFilename.split(".").pop()?.toLowerCase() || null;
  
  const result = await db.insert(fileUploads).values({
    source: data.source,
    sourceId: data.sourceId,
    originalFilename: data.originalFilename,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    fileExtension,
    storageKey: data.storageKey,
    storageUrl: data.storageUrl,
    status: validation.valid ? "uploaded" : "failed",
    isValidType: ALLOWED_MIME_TYPES.has(data.mimeType),
    isValidSize: validation.errors.filter(e => e.includes("size")).length === 0,
    validationErrors: validation.errors.length > 0 ? validation.errors : null,
    userId: data.userId,
    organizationId: data.organizationId,
    projectId: data.projectId,
  });
  
  return {
    id: result[0]?.insertId || null,
    valid: validation.valid,
    errors: validation.errors,
  };
}

export async function getFileUpload(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(fileUploads).where(eq(fileUploads.id, id)).limit(1);
  return result[0] || null;
}

export async function updateFileUploadStatus(
  id: number,
  status: FileUploadStatus,
  options?: {
    processingJobId?: number;
    linkedEntityType?: string;
    linkedEntityId?: number;
    storageUrl?: string;
  }
) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(fileUploads)
    .set({
      status,
      processingJobId: options?.processingJobId,
      linkedEntityType: options?.linkedEntityType,
      linkedEntityId: options?.linkedEntityId,
      storageUrl: options?.storageUrl,
    })
    .where(eq(fileUploads.id, id));
  
  return true;
}

export async function getFileUploadsByUser(userId: number, options?: {
  status?: FileUploadStatus;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(fileUploads.userId, userId)];
  
  if (options?.status) {
    conditions.push(eq(fileUploads.status, options.status));
  }
  
  return db.select()
    .from(fileUploads)
    .where(and(...conditions))
    .orderBy(desc(fileUploads.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

export async function getRecentFileUploads(options?: {
  source?: FileUploadSource;
  status?: FileUploadStatus;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: any[] = [];
  
  if (options?.source) {
    conditions.push(eq(fileUploads.source, options.source));
  }
  if (options?.status) {
    conditions.push(eq(fileUploads.status, options.status));
  }
  
  const query = conditions.length > 0
    ? db.select().from(fileUploads).where(and(...conditions))
    : db.select().from(fileUploads);
  
  return query.orderBy(desc(fileUploads.createdAt)).limit(options?.limit || 50);
}

// Generate canonical storage key for consistent file organization
export function generateStorageKey(
  source: FileUploadSource,
  filename: string,
  options?: {
    userId?: number;
    projectId?: number;
    organizationId?: number;
  }
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substr(2, 8);
  const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  
  // Organize by source and date
  const datePath = new Date().toISOString().split("T")[0].replace(/-/g, "/");
  
  let prefix = `uploads/${source}/${datePath}`;
  
  if (options?.organizationId) {
    prefix = `org_${options.organizationId}/${prefix}`;
  }
  if (options?.projectId) {
    prefix = `${prefix}/project_${options.projectId}`;
  }
  if (options?.userId) {
    prefix = `${prefix}/user_${options.userId}`;
  }
  
  return `${prefix}/${timestamp}_${randomSuffix}_${safeFilename}`;
}


// ============ VIEW PREFERENCES (VATR + Views Contract) ============

type ViewContext = "dashboard" | "portfolio" | "dataroom" | "checklist" | "report";

/**
 * R1: Resolve the effective view for a user with precedence:
 * Tier order: user > team > department > organization
 * 
 * Tie-break within same tier:
 * 1. isPrimary flag (explicit primary team/dept)
 * 2. Most recent membership (updatedAt)
 * 3. Highest priority (numeric, higher wins)
 * 4. Deterministic fallback: lowest ID (stable across runs)
 * 
 * Returns the viewId or null if no default is set
 */
export async function resolveEffectiveView(
  userId: number,
  context: ViewContext,
  options?: {
    organizationId?: number;
  }
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // TIER 1: Check user-level preference (highest priority)
  const [userPref] = await db
    .select()
    .from(userViewPreferences)
    .where(
      and(
        eq(userViewPreferences.scopeType, "user"),
        eq(userViewPreferences.scopeId, userId),
        eq(userViewPreferences.context, context)
      )
    )
    .limit(1);
  
  if (userPref) {
    return userPref.defaultViewId;
  }

  // TIER 2: Check team-level preferences with tie-break
  // Get all user's team memberships
  const userTeams = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  
  if (userTeams.length > 0) {
    // Apply tie-break: isPrimary > mostRecent > highestPriority > lowestId
    const sortedTeams = [...userTeams].sort((a, b) => {
      // 1. isPrimary wins
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      // 2. Most recent updatedAt wins
      const aTime = a.updatedAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      // 3. Highest priority wins
      if (a.priority !== b.priority) return b.priority - a.priority;
      // 4. Deterministic fallback: lowest teamId
      return a.teamId - b.teamId;
    });

    // Check each team in order for a view preference
    for (const team of sortedTeams) {
      const [teamPref] = await db
        .select()
        .from(userViewPreferences)
        .where(
          and(
            eq(userViewPreferences.scopeType, "team"),
            eq(userViewPreferences.scopeId, team.teamId),
            eq(userViewPreferences.context, context)
          )
        )
        .limit(1);
      
      if (teamPref) {
        return teamPref.defaultViewId;
      }
    }
  }

  // TIER 3: Check department-level preferences with tie-break
  const userDepts = await db
    .select()
    .from(departmentMembers)
    .where(eq(departmentMembers.userId, userId));
  
  if (userDepts.length > 0) {
    // Apply tie-break: isPrimary > mostRecent > highestPriority > lowestId
    const sortedDepts = [...userDepts].sort((a, b) => {
      // 1. isPrimary wins
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      // 2. Most recent updatedAt wins
      const aTime = a.updatedAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? 0;
      if (aTime !== bTime) return bTime - aTime;
      // 3. Highest priority wins
      if (a.priority !== b.priority) return b.priority - a.priority;
      // 4. Deterministic fallback: lowest departmentId
      return a.departmentId - b.departmentId;
    });

    // Check each department in order for a view preference
    for (const dept of sortedDepts) {
      const [deptPref] = await db
        .select()
        .from(userViewPreferences)
        .where(
          and(
            eq(userViewPreferences.scopeType, "department"),
            eq(userViewPreferences.scopeId, dept.departmentId),
            eq(userViewPreferences.context, context)
          )
        )
        .limit(1);
      
      if (deptPref) {
        return deptPref.defaultViewId;
      }
    }
  }

  // TIER 4: Check organization-level preference (lowest priority)
  if (options?.organizationId) {
    const [orgPref] = await db
      .select()
      .from(userViewPreferences)
      .where(
        and(
          eq(userViewPreferences.scopeType, "organization"),
          eq(userViewPreferences.scopeId, options.organizationId),
          eq(userViewPreferences.context, context)
        )
      )
      .limit(1);
    
    if (orgPref) {
      return orgPref.defaultViewId;
    }
  }

  // No default view set at any level
  return null;
}

/**
 * Set a view preference at a specific scope level
 */
export async function setViewPreference(data: {
  scopeType: "user" | "team" | "department" | "organization";
  scopeId: number;
  context: ViewContext;
  defaultViewId: number;
  setBy: number;
}) {
  const db = await getDb();
  if (!db) return null;

  // Upsert - update if exists, insert if not
  const [result] = await db
    .insert(userViewPreferences)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        defaultViewId: data.defaultViewId,
        setBy: data.setBy,
      },
    });

  return result;
}

/**
 * Get all view preferences for a user (including inherited)
 */
export async function getUserViewPreferences(
  userId: number,
  options?: {
    teamId?: number;
    departmentId?: number;
    organizationId?: number;
  }
) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    and(
      eq(userViewPreferences.scopeType, "user"),
      eq(userViewPreferences.scopeId, userId)
    ),
  ];

  if (options?.teamId) {
    conditions.push(
      and(
        eq(userViewPreferences.scopeType, "team"),
        eq(userViewPreferences.scopeId, options.teamId)
      )
    );
  }

  if (options?.departmentId) {
    conditions.push(
      and(
        eq(userViewPreferences.scopeType, "department"),
        eq(userViewPreferences.scopeId, options.departmentId)
      )
    );
  }

  if (options?.organizationId) {
    conditions.push(
      and(
        eq(userViewPreferences.scopeType, "organization"),
        eq(userViewPreferences.scopeId, options.organizationId)
      )
    );
  }

  return db
    .select()
    .from(userViewPreferences)
    .where(or(...conditions))
    .orderBy(userViewPreferences.context);
}

/**
 * Clear a view preference
 */
export async function clearViewPreference(
  scopeType: "user" | "team" | "department" | "organization",
  scopeId: number,
  context: ViewContext
) {
  const db = await getDb();
  if (!db) return false;

  await db
    .delete(userViewPreferences)
    .where(
      and(
        eq(userViewPreferences.scopeType, scopeType),
        eq(userViewPreferences.scopeId, scopeId),
        eq(userViewPreferences.context, context)
      )
    );

  return true;
}


// ============ VIEW MANAGEMENT SYSTEM ============

// ---- Organizational Hierarchy ----

export async function getTeams(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teams).where(eq(teams.organizationId, organizationId));
}

export async function getDepartments(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(departments).where(eq(departments.organizationId, organizationId));
}

export async function getTeamMembers(teamId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      role: teamMembers.role,
      userName: users.name,
      userEmail: users.email,
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));
}

export async function getDepartmentMembers(departmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: departmentMembers.id,
      departmentId: departmentMembers.departmentId,
      userId: departmentMembers.userId,
      role: departmentMembers.role,
      userName: users.name,
      userEmail: users.email,
    })
    .from(departmentMembers)
    .leftJoin(users, eq(departmentMembers.userId, users.id))
    .where(eq(departmentMembers.departmentId, departmentId));
}

export async function getUserTeams(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      teamId: teamMembers.teamId,
      teamName: teams.name,
      role: teamMembers.role,
      organizationId: teams.organizationId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId));
}

export async function getUserDepartments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      departmentId: departmentMembers.departmentId,
      departmentName: departments.name,
      role: departmentMembers.role,
      organizationId: departments.organizationId,
    })
    .from(departmentMembers)
    .innerJoin(departments, eq(departmentMembers.departmentId, departments.id))
    .where(eq(departmentMembers.userId, userId));
}

/**
 * Get user's hierarchical role for view management
 * Returns the highest privilege level the user has
 */
export async function getUserViewManagementRole(userId: number, organizationId?: number): Promise<{
  isAdmin: boolean;
  isOrgSuperuser: boolean;
  isDeptSuperuser: boolean;
  isTeamSuperuser: boolean;
  isManager: boolean;
  teamIds: number[];
  departmentIds: number[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      isAdmin: false,
      isOrgSuperuser: false,
      isDeptSuperuser: false,
      isTeamSuperuser: false,
      isManager: false,
      teamIds: [],
      departmentIds: [],
    };
  }

  // Check if admin
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const isAdmin = user?.role === "admin";

  // Check if org superuser
  let isOrgSuperuser = false;
  if (organizationId) {
    const [orgSuperuser] = await db
      .select()
      .from(organizationSuperusers)
      .where(and(
        eq(organizationSuperusers.userId, userId),
        eq(organizationSuperusers.organizationId, organizationId)
      ))
      .limit(1);
    isOrgSuperuser = !!orgSuperuser;
  }

  // Get team memberships with superuser role
  const userTeams = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  
  const teamIds = userTeams.map(t => t.teamId);
  const isTeamSuperuser = userTeams.some(t => t.role === "superuser");
  const isManager = userTeams.some(t => t.role === "lead");

  // Get department memberships with superuser role
  const userDepts = await db
    .select()
    .from(departmentMembers)
    .where(eq(departmentMembers.userId, userId));
  
  const departmentIds = userDepts.map(d => d.departmentId);
  const isDeptSuperuser = userDepts.some(d => d.role === "superuser");

  return {
    isAdmin,
    isOrgSuperuser,
    isDeptSuperuser,
    isTeamSuperuser,
    isManager,
    teamIds,
    departmentIds,
  };
}

// ---- View Sharing ----

export async function shareView(data: {
  viewId: number;
  sharedWithType: "user" | "team" | "department" | "organization";
  sharedWithId: number;
  permissionLevel: "view_only" | "edit" | "admin";
  sharedBy: number;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db
    .insert(viewShares)
    .values({
      ...data,
      isActive: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        permissionLevel: data.permissionLevel,
        sharedBy: data.sharedBy,
        sharedAt: new Date(),
        expiresAt: data.expiresAt,
        isActive: true,
        revokedBy: null,
        revokedAt: null,
      },
    });

  return result;
}

export async function revokeViewShare(viewId: number, sharedWithType: string, sharedWithId: number, revokedBy: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(viewShares)
    .set({
      isActive: false,
      revokedBy,
      revokedAt: new Date(),
    })
    .where(and(
      eq(viewShares.viewId, viewId),
      eq(viewShares.sharedWithType, sharedWithType as any),
      eq(viewShares.sharedWithId, sharedWithId)
    ));

  return true;
}

export async function getViewShares(viewId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(viewShares)
    .where(and(
      eq(viewShares.viewId, viewId),
      eq(viewShares.isActive, true)
    ));
}

export async function getViewsSharedWithUser(userId: number, options?: {
  teamIds?: number[];
  departmentIds?: number[];
  organizationId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [
    eq(viewShares.isActive, true),
  ];

  // Build OR conditions for all scopes the user belongs to
  const scopeConditions: any[] = [
    and(
      eq(viewShares.sharedWithType, "user"),
      eq(viewShares.sharedWithId, userId)
    ),
  ];

  if (options?.teamIds?.length) {
    scopeConditions.push(
      and(
        eq(viewShares.sharedWithType, "team"),
        inArray(viewShares.sharedWithId, options.teamIds)
      )
    );
  }

  if (options?.departmentIds?.length) {
    scopeConditions.push(
      and(
        eq(viewShares.sharedWithType, "department"),
        inArray(viewShares.sharedWithId, options.departmentIds)
      )
    );
  }

  if (options?.organizationId) {
    scopeConditions.push(
      and(
        eq(viewShares.sharedWithType, "organization"),
        eq(viewShares.sharedWithId, options.organizationId)
      )
    );
  }

  return db
    .select()
    .from(viewShares)
    .where(and(
      eq(viewShares.isActive, true),
      or(...scopeConditions)
    ));
}

// ---- View Templates ----

export async function getViewTemplates(options?: {
  category?: string;
  organizationId?: number;
  includeSystem?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [];

  if (options?.category) {
    conditions.push(eq(viewTemplates.category, options.category as any));
  }

  // Include system templates and org-specific templates
  const orgConditions: any[] = [];
  if (options?.includeSystem !== false) {
    orgConditions.push(eq(viewTemplates.isSystem, true));
  }
  if (options?.organizationId) {
    orgConditions.push(eq(viewTemplates.organizationId, options.organizationId));
  }
  orgConditions.push(isNull(viewTemplates.organizationId)); // Global templates

  if (orgConditions.length > 0) {
    conditions.push(or(...orgConditions));
  }

  const query = conditions.length > 0
    ? db.select().from(viewTemplates).where(and(...conditions))
    : db.select().from(viewTemplates);

  return query.orderBy(viewTemplates.category, viewTemplates.name);
}

export async function createViewTemplate(data: InsertViewTemplate) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.insert(viewTemplates).values(data);
  return result.insertId;
}

export async function getViewTemplateById(templateId: number) {
  const db = await getDb();
  if (!db) return null;

  const [template] = await db
    .select()
    .from(viewTemplates)
    .where(eq(viewTemplates.id, templateId))
    .limit(1);

  return template || null;
}

// ---- View Analytics ----

export async function trackViewAccess(data: {
  viewId: number;
  userId: number;
  actionType?: "view" | "filter_change" | "export" | "share" | "edit" | "apply_template";
  actionDetails?: Record<string, unknown>;
  durationSeconds?: number;
  sessionId?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.insert(viewAnalytics).values({
    viewId: data.viewId,
    userId: data.userId,
    actionType: data.actionType || "view",
    actionDetails: data.actionDetails,
    durationSeconds: data.durationSeconds,
    sessionId: data.sessionId,
    userAgent: data.userAgent,
  });

  return result.insertId;
}

export async function getViewAnalytics(viewId: number, options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions: any[] = [eq(viewAnalytics.viewId, viewId)];

  if (options?.startDate) {
    conditions.push(gte(viewAnalytics.accessedAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(viewAnalytics.accessedAt, options.endDate));
  }

  return db
    .select()
    .from(viewAnalytics)
    .where(and(...conditions))
    .orderBy(desc(viewAnalytics.accessedAt))
    .limit(options?.limit || 100);
}

export async function getPopularViews(organizationId?: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  // Get view access counts in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .select({
      viewId: viewAnalytics.viewId,
      accessCount: sql<number>`COUNT(*)`.as("accessCount"),
      uniqueUsers: sql<number>`COUNT(DISTINCT ${viewAnalytics.userId})`.as("uniqueUsers"),
    })
    .from(viewAnalytics)
    .where(gte(viewAnalytics.accessedAt, thirtyDaysAgo))
    .groupBy(viewAnalytics.viewId)
    .orderBy(desc(sql`accessCount`))
    .limit(limit);

  return result;
}

// ---- View Pushes ----

export async function pushView(data: {
  viewId: number;
  pushedBy: number;
  pushedByRole: "manager" | "team_superuser" | "department_superuser" | "organization_superuser" | "admin";
  targetScope: "user" | "team" | "department" | "organization";
  targetScopeId: number;
  isPinned?: boolean;
  isRequired?: boolean;
  displayOrder?: number;
  pushMessage?: string;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db
    .insert(viewPushes)
    .values({
      ...data,
      isActive: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        pushedBy: data.pushedBy,
        pushedByRole: data.pushedByRole,
        isPinned: data.isPinned ?? false,
        isRequired: data.isRequired ?? false,
        displayOrder: data.displayOrder ?? 0,
        pushMessage: data.pushMessage,
        pushedAt: new Date(),
        expiresAt: data.expiresAt,
        isActive: true,
        deactivatedBy: null,
        deactivatedAt: null,
      },
    });

  return result;
}

export async function unpushView(viewId: number, targetScope: string, targetScopeId: number, deactivatedBy: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(viewPushes)
    .set({
      isActive: false,
      deactivatedBy,
      deactivatedAt: new Date(),
    })
    .where(and(
      eq(viewPushes.viewId, viewId),
      eq(viewPushes.targetScope, targetScope as any),
      eq(viewPushes.targetScopeId, targetScopeId)
    ));

  return true;
}

export async function getViewsPushedToUser(userId: number, options?: {
  teamIds?: number[];
  departmentIds?: number[];
  organizationId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  // Build OR conditions for all scopes the user belongs to
  const scopeConditions: any[] = [
    and(
      eq(viewPushes.targetScope, "user"),
      eq(viewPushes.targetScopeId, userId)
    ),
  ];

  if (options?.teamIds?.length) {
    scopeConditions.push(
      and(
        eq(viewPushes.targetScope, "team"),
        inArray(viewPushes.targetScopeId, options.teamIds)
      )
    );
  }

  if (options?.departmentIds?.length) {
    scopeConditions.push(
      and(
        eq(viewPushes.targetScope, "department"),
        inArray(viewPushes.targetScopeId, options.departmentIds)
      )
    );
  }

  if (options?.organizationId) {
    scopeConditions.push(
      and(
        eq(viewPushes.targetScope, "organization"),
        eq(viewPushes.targetScopeId, options.organizationId)
      )
    );
  }

  return db
    .select()
    .from(viewPushes)
    .where(and(
      eq(viewPushes.isActive, true),
      or(...scopeConditions)
    ))
    .orderBy(desc(viewPushes.isPinned), viewPushes.displayOrder);
}

// ---- View Hides ----

export async function hideView(data: {
  viewId: number;
  hiddenBy: number;
  hiddenByRole: "user" | "team_superuser" | "department_superuser" | "organization_superuser" | "admin";
  targetScope: "user" | "team" | "department" | "organization";
  targetScopeId: number;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db
    .insert(viewHides)
    .values({
      ...data,
      isActive: true,
    })
    .onDuplicateKeyUpdate({
      set: {
        hiddenBy: data.hiddenBy,
        hiddenByRole: data.hiddenByRole,
        reason: data.reason,
        hiddenAt: new Date(),
        isActive: true,
        unhiddenBy: null,
        unhiddenAt: null,
      },
    });

  return result;
}

export async function unhideView(viewId: number, targetScope: string, targetScopeId: number, unhiddenBy: number) {
  const db = await getDb();
  if (!db) return false;

  await db
    .update(viewHides)
    .set({
      isActive: false,
      unhiddenBy,
      unhiddenAt: new Date(),
    })
    .where(and(
      eq(viewHides.viewId, viewId),
      eq(viewHides.targetScope, targetScope as any),
      eq(viewHides.targetScopeId, targetScopeId)
    ));

  return true;
}

export async function getHiddenViewsForUser(userId: number, options?: {
  teamIds?: number[];
  departmentIds?: number[];
  organizationId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  // Build OR conditions for all scopes the user belongs to
  const scopeConditions: any[] = [
    and(
      eq(viewHides.targetScope, "user"),
      eq(viewHides.targetScopeId, userId)
    ),
  ];

  if (options?.teamIds?.length) {
    scopeConditions.push(
      and(
        eq(viewHides.targetScope, "team"),
        inArray(viewHides.targetScopeId, options.teamIds)
      )
    );
  }

  if (options?.departmentIds?.length) {
    scopeConditions.push(
      and(
        eq(viewHides.targetScope, "department"),
        inArray(viewHides.targetScopeId, options.departmentIds)
      )
    );
  }

  if (options?.organizationId) {
    scopeConditions.push(
      and(
        eq(viewHides.targetScope, "organization"),
        eq(viewHides.targetScopeId, options.organizationId)
      )
    );
  }

  return db
    .select()
    .from(viewHides)
    .where(and(
      eq(viewHides.isActive, true),
      or(...scopeConditions)
    ));
}

/**
 * Check if a view is hidden for a user (considering hierarchy)
 */
export async function isViewHiddenForUser(viewId: number, userId: number, options?: {
  teamIds?: number[];
  departmentIds?: number[];
  organizationId?: number;
}): Promise<boolean> {
  const hiddenViews = await getHiddenViewsForUser(userId, options);
  return hiddenViews.some(h => h.viewId === viewId);
}

/**
 * Check if a view is required (cannot be hidden) for a user
 */
export async function isViewRequiredForUser(viewId: number, userId: number, options?: {
  teamIds?: number[];
  departmentIds?: number[];
  organizationId?: number;
}): Promise<boolean> {
  const pushedViews = await getViewsPushedToUser(userId, options);
  return pushedViews.some(p => p.viewId === viewId && p.isRequired);
}

// ---- View Management Audit Log ----

export async function logViewManagementAction(data: {
  actionType: "share" | "unshare" | "push" | "unpush" | "hide" | "unhide" | "delete" | "permission_change";
  actorId: number;
  actorRole: string;
  viewId: number;
  targetType?: string;
  targetId?: number;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const [result] = await db.insert(viewManagementAuditLog).values(data);
  return result.insertId;
}

export async function getViewManagementAuditLog(viewId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(viewManagementAuditLog)
    .where(eq(viewManagementAuditLog.viewId, viewId))
    .orderBy(desc(viewManagementAuditLog.timestamp))
    .limit(limit);
}

// ---- Team/Department Management ----

export async function createTeam(data: InsertTeam) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(teams).values(data);
  return result.insertId;
}

export async function createDepartment(data: InsertDepartment) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(departments).values(data);
  return result.insertId;
}

export async function addTeamMember(data: InsertTeamMember) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(teamMembers).values(data);
  return result.insertId;
}

export async function addDepartmentMember(data: InsertDepartmentMember) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(departmentMembers).values(data);
  return result.insertId;
}

export async function addOrganizationSuperuser(data: InsertOrganizationSuperuser) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(organizationSuperusers).values(data);
  return result.insertId;
}

export async function removeOrganizationSuperuser(organizationId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(organizationSuperusers).where(and(
    eq(organizationSuperusers.organizationId, organizationId),
    eq(organizationSuperusers.userId, userId)
  ));
  return true;
}


// ============ REQUESTS + SCOPED SUBMISSIONS SYSTEM ============

// Grant Enforcement - Core RBAC + Grant Layer
export async function checkScopedGrant(
  granteeOrgId: number,
  granteeUserId: number | null,
  scopeType: string,
  scopeId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const conditions = [
    eq(scopedGrants.granteeOrgId, granteeOrgId),
    eq(scopedGrants.scopeType, scopeType),
    eq(scopedGrants.scopeId, scopeId),
    eq(scopedGrants.isRevoked, false),
  ];
  
  // Check expiration
  const now = new Date();
  
  const grants = await db.select().from(scopedGrants).where(and(...conditions));
  
  for (const grant of grants) {
    // Check if expired
    if (grant.expiresAt && grant.expiresAt < now) continue;
    
    // If grant is for specific user, check match
    if (grant.granteeUserId && granteeUserId && grant.granteeUserId !== granteeUserId) continue;
    
    // Grant is valid
    return true;
  }
  
  return false;
}

// Check if user has access to a submission (issuer via grant OR recipient org member)
export async function canAccessSubmission(
  userId: number,
  userOrgId: number,
  submissionId: number
): Promise<{ canAccess: boolean; accessType: "owner" | "grant" | "none" }> {
  const db = await getDb();
  if (!db) return { canAccess: false, accessType: "none" };
  
  // Get submission
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, submissionId));
  if (!submission) return { canAccess: false, accessType: "none" };
  
  // Check if user is from recipient org (owner)
  if (submission.recipientOrgId === userOrgId) {
    return { canAccess: true, accessType: "owner" };
  }
  
  // Check if user has grant (issuer)
  const hasGrant = await checkScopedGrant(userOrgId, userId, "submission", submissionId);
  if (hasGrant) {
    return { canAccess: true, accessType: "grant" };
  }
  
  return { canAccess: false, accessType: "none" };
}

// Create scoped grant when submission is made
export async function createSubmissionGrant(
  grantorOrgId: number,
  granteeOrgId: number,
  submissionId: number,
  expiresAt?: Date
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(scopedGrants).values({
    grantorOrgId,
    granteeOrgId,
    scopeType: "submission",
    scopeId: submissionId,
    expiresAt,
  });
  
  return result.insertId;
}

// Revoke a grant
export async function revokeGrant(grantId: number, revokedByUserId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(scopedGrants).set({
    isRevoked: true,
    revokedAt: new Date(),
    revokedByUserId,
  }).where(eq(scopedGrants.id, grantId));
  
  return true;
}

// Request Templates
export async function createRequestTemplate(data: InsertRequestTemplate): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requestTemplates).values(data);
  return result.insertId;
}

export async function getRequestTemplates(issuerOrgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requestTemplates).where(eq(requestTemplates.issuerOrgId, issuerOrgId));
}

export async function getRequestTemplate(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [template] = await db.select().from(requestTemplates).where(eq(requestTemplates.id, id));
  return template || null;
}

export async function updateRequestTemplate(id: number, data: Partial<InsertRequestTemplate>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(requestTemplates).set(data).where(eq(requestTemplates.id, id));
  return true;
}

// Requirements Schemas
export async function createRequirementsSchema(data: InsertRequirementsSchema): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requirementsSchemas).values(data);
  return result.insertId;
}

export async function getRequirementsSchema(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [schema] = await db.select().from(requirementsSchemas).where(eq(requirementsSchemas.id, id));
  return schema || null;
}

export async function publishRequirementsSchema(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(requirementsSchemas).set({ isPublished: true }).where(eq(requirementsSchemas.id, id));
  return true;
}

// Requests
export async function createRequest(data: InsertRequest): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requests).values(data);
  return result.insertId;
}

export async function getRequest(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [request] = await db.select().from(requests).where(eq(requests.id, id));
  return request || null;
}

export async function getRequestsByIssuer(issuerOrgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requests).where(eq(requests.issuerOrgId, issuerOrgId)).orderBy(desc(requests.createdAt));
}

export async function updateRequest(id: number, data: Partial<InsertRequest>): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(requests).set(data).where(eq(requests.id, id));
  return true;
}

// Request Recipients
export async function inviteRecipient(data: InsertRequestRecipient): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requestRecipients).values(data);
  return result.insertId;
}

export async function getRequestRecipients(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requestRecipients).where(eq(requestRecipients.requestId, requestId));
}

export async function updateRecipientStatus(id: number, status: string, timestamp?: Date): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const updates: Record<string, unknown> = { status };
  if (status === "opened") updates.openedAt = timestamp || new Date();
  if (status === "submitted") updates.submittedAt = timestamp || new Date();
  if (status === "declined") updates.declinedAt = timestamp || new Date();
  
  await db.update(requestRecipients).set(updates).where(eq(requestRecipients.id, id));
  return true;
}

// Get requests where user's org is a recipient
export async function getIncomingRequests(recipientOrgId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const recipients = await db.select().from(requestRecipients).where(eq(requestRecipients.recipientOrgId, recipientOrgId));
  if (recipients.length === 0) return [];
  
  const requestIds = recipients.map(r => r.requestId);
  const requestList = await db.select().from(requests).where(inArray(requests.id, requestIds));
  
  return requestList.map(req => ({
    ...req,
    recipientStatus: recipients.find(r => r.requestId === req.id)?.status,
    recipientId: recipients.find(r => r.requestId === req.id)?.id,
  }));
}

// Response Workspaces
export async function createResponseWorkspace(data: InsertResponseWorkspace): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(responseWorkspaces).values(data);
  return result.insertId;
}

export async function getResponseWorkspace(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [workspace] = await db.select().from(responseWorkspaces).where(eq(responseWorkspaces.id, id));
  return workspace || null;
}

export async function getWorkspaceForRequest(requestId: number, recipientOrgId: number) {
  const db = await getDb();
  if (!db) return null;
  const [workspace] = await db.select().from(responseWorkspaces).where(and(
    eq(responseWorkspaces.requestId, requestId),
    eq(responseWorkspaces.recipientOrgId, recipientOrgId)
  ));
  return workspace || null;
}

export async function updateWorkspaceStatus(id: number, status: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(responseWorkspaces).set({ status }).where(eq(responseWorkspaces.id, id));
  return true;
}

// Workspace Assets
export async function addWorkspaceAsset(data: InsertWorkspaceAsset): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(workspaceAssets).values(data);
  return result.insertId;
}

export async function getWorkspaceAssets(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceAssets).where(and(
    eq(workspaceAssets.workspaceId, workspaceId),
    eq(workspaceAssets.status, "included")
  ));
}

export async function removeWorkspaceAsset(workspaceId: number, assetId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(workspaceAssets).set({ status: "removed" }).where(and(
    eq(workspaceAssets.workspaceId, workspaceId),
    eq(workspaceAssets.assetId, assetId)
  ));
  return true;
}

// Workspace Answers
export async function saveWorkspaceAnswer(data: InsertWorkspaceAnswer): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Check if answer already exists
  const existing = await db.select().from(workspaceAnswers).where(and(
    eq(workspaceAnswers.workspaceId, data.workspaceId),
    eq(workspaceAnswers.requirementKey, data.requirementKey),
    data.assetId ? eq(workspaceAnswers.assetId, data.assetId) : isNull(workspaceAnswers.assetId)
  ));
  
  if (existing.length > 0) {
    await db.update(workspaceAnswers).set({
      answerJson: data.answerJson,
      vatrSourcePath: data.vatrSourcePath,
      isVerified: data.isVerified,
      verifiedByUserId: data.verifiedByUserId,
      verifiedAt: data.verifiedAt,
    }).where(eq(workspaceAnswers.id, existing[0].id));
    return existing[0].id;
  }
  
  const [result] = await db.insert(workspaceAnswers).values(data);
  return result.insertId;
}

export async function getWorkspaceAnswers(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceAnswers).where(eq(workspaceAnswers.workspaceId, workspaceId));
}

// Workspace Documents
export async function addWorkspaceDocument(data: InsertWorkspaceDocument): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(workspaceDocuments).values(data);
  return result.insertId;
}

export async function getWorkspaceDocuments(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceDocuments).where(eq(workspaceDocuments.workspaceId, workspaceId));
}

// Submissions

export async function createSubmission(
  workspaceId: number,
  requestId: number,
  recipientOrgId: number,
  submittedByUserId: number,
  issuerOrgId: number
): Promise<{ submissionId: number; snapshotId: number; grantId: number } | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Gather workspace data for snapshot
  const assets = await getWorkspaceAssets(workspaceId);
  const answers = await getWorkspaceAnswers(workspaceId);
  const docs = await getWorkspaceDocuments(workspaceId);
  const signOffs = await getWorkspaceSignOffs(workspaceId);
  
  // Create snapshot content
  const snapshotContent = {
    assets: assets.map(a => ({ id: a.assetId, name: `Asset ${a.assetId}` })),
    answers: answers.map(a => ({ key: a.requirementKey, value: a.answerJson, assetId: a.assetId || undefined })),
    documents: docs.map(d => ({ key: d.requirementKey || "", fileUrl: d.fileUrl || "", fileName: d.fileName || "", assetId: d.assetId || undefined })),
    attestations: [],
    signOffs: signOffs.map(s => ({ role: "", userId: s.signedByUserId, signedAt: s.signedAt?.toISOString() || "", status: s.status })),
  };
  
  // Calculate content hash
  const contentHash = crypto.createHash("sha256").update(JSON.stringify(snapshotContent)).digest("hex");
  
  // Create snapshot
  const [snapshotResult] = await db.insert(snapshots).values({
    type: "submission",
    contentJson: snapshotContent,
    contentHash,
    createdByUserId: submittedByUserId,
  });
  const snapshotId = snapshotResult.insertId;
  
  // Create submission
  const [submissionResult] = await db.insert(submissions).values({
    requestId,
    workspaceId,
    recipientOrgId,
    submittedByUserId,
    snapshotId,
    status: "submitted",
  });
  const submissionId = submissionResult.insertId;
  
  // Create scoped grant for issuer
  const grantId = await createSubmissionGrant(recipientOrgId, issuerOrgId, submissionId);
  
  // Lock workspace
  await updateWorkspaceStatus(workspaceId, "submitted");
  
  return { submissionId, snapshotId, grantId: grantId || 0 };
}

export async function getSubmission(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
  return submission || null;
}

export async function getSubmissionsForRequest(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions).where(eq(submissions.requestId, requestId));
}

export async function getSubmissionWithSnapshot(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
  if (!submission) return null;
  
  const [snapshot] = await db.select().from(snapshots).where(eq(snapshots.id, submission.snapshotId));
  
  return { ...submission, snapshot };
}

export async function updateSubmissionStatus(id: number, status: string, reviewedByUserId?: number, reviewNotes?: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(submissions).set({
    status,
    reviewedAt: new Date(),
    reviewedByUserId,
    reviewNotes,
  }).where(eq(submissions.id, id));
  
  return true;
}

// Sign-off Requirements
export async function createSignOffRequirement(data: InsertSignOffRequirement): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(signOffRequirements).values(data);
  return result.insertId;
}

export async function getSignOffRequirements(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signOffRequirements).where(eq(signOffRequirements.requestId, requestId)).orderBy(signOffRequirements.orderIndex);
}

// Sign-off Events
export async function recordSignOff(data: InsertSignOffEvent): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(signOffEvents).values(data);
  return result.insertId;
}

export async function getWorkspaceSignOffs(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signOffEvents).where(eq(signOffEvents.workspaceId, workspaceId));
}

export async function checkSignOffComplete(workspaceId: number, requestId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const requirements = await getSignOffRequirements(requestId);
  if (requirements.length === 0) return true; // No sign-offs required
  
  const events = await getWorkspaceSignOffs(workspaceId);
  const approvedRequirementIds = events.filter(e => e.status === "approved").map(e => e.requirementId);
  
  // Check all requirements are approved
  return requirements.every(r => approvedRequirementIds.includes(r.id));
}

// Request Clarifications
export async function createClarification(data: InsertRequestClarification): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requestClarifications).values(data);
  return result.insertId;
}

export async function getClarifications(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requestClarifications).where(eq(requestClarifications.requestId, requestId)).orderBy(requestClarifications.createdAt);
}

export async function updateClarificationStatus(id: number, status: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  await db.update(requestClarifications).set({ status }).where(eq(requestClarifications.id, id));
  return true;
}

// Request Audit Log
export async function logRequestEvent(data: InsertRequestAuditLogEntry): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(requestAuditLog).values(data);
  return result.insertId;
}

export async function getRequestAuditLog(requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(requestAuditLog).where(eq(requestAuditLog.requestId, requestId)).orderBy(desc(requestAuditLog.createdAt));
}

// AI Validation - Check for missing/inconsistent items
export async function validateWorkspaceCompleteness(workspaceId: number, schemaId: number): Promise<{
  isComplete: boolean;
  missingFields: string[];
  missingDocs: string[];
  inconsistencies: Array<{ key: string; message: string }>;
}> {
  const db = await getDb();
  if (!db) return { isComplete: false, missingFields: [], missingDocs: [], inconsistencies: [] };
  
  const schema = await getRequirementsSchema(schemaId);
  if (!schema || !schema.schemaJson) return { isComplete: false, missingFields: [], missingDocs: [], inconsistencies: [] };
  
  const answers = await getWorkspaceAnswers(workspaceId);
  const docs = await getWorkspaceDocuments(workspaceId);
  
  const missingFields: string[] = [];
  const missingDocs: string[] = [];
  const inconsistencies: Array<{ key: string; message: string }> = [];
  
  const schemaItems = (schema.schemaJson as { items: Array<{ type: string; key: string; label: string; required: boolean }> }).items || [];
  
  for (const item of schemaItems) {
    if (!item.required) continue;
    
    if (item.type === "field") {
      const answer = answers.find(a => a.requirementKey === item.key);
      if (!answer || !answer.answerJson) {
        missingFields.push(item.key);
      }
    } else if (item.type === "document") {
      const doc = docs.find(d => d.requirementKey === item.key);
      if (!doc) {
        missingDocs.push(item.key);
      }
    }
  }
  
  return {
    isComplete: missingFields.length === 0 && missingDocs.length === 0,
    missingFields,
    missingDocs,
    inconsistencies,
  };
}


// ============================================================================
// VERSIONED VIEWS + SHARING + MANAGED UPDATES FUNCTIONS
// ============================================================================

// ============ VIEW TEMPLATES V2 ============

export async function createViewTemplateV2(data: {
  orgId: number;
  name: string;
  description?: string;
  category?: string;
  isPublic?: boolean;
  createdByUserId: number;
  initialDefinition: {
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  };
}) {
  const db = await getDb();
  if (!db) return null;
  
  const templateId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  
  // Create template
  await db.insert(viewTemplatesV2).values({
    id: templateId,
    orgId: data.orgId,
    name: data.name,
    description: data.description,
    category: data.category,
    isPublic: data.isPublic ?? false,
    createdByUserId: data.createdByUserId,
    currentVersionId: versionId,
    status: "active",
  });
  
  // Create initial version (v1)
  await db.insert(viewTemplateVersions).values({
    id: versionId,
    templateId,
    versionNumber: 1,
    definitionJson: data.initialDefinition,
    changelog: "Initial version",
    createdByUserId: data.createdByUserId,
  });
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "template",
    entityId: templateId,
    action: "template_created",
    userId: data.createdByUserId,
    detailsJson: { name: data.name, versionId },
    relatedTemplateId: templateId,
    relatedVersionId: versionId,
  });
  
  return { templateId, versionId };
}

export async function getViewTemplateV2(templateId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [template] = await db.select().from(viewTemplatesV2).where(eq(viewTemplatesV2.id, templateId));
  if (!template) return null;
  
  // Get current version
  const [currentVersion] = template.currentVersionId
    ? await db.select().from(viewTemplateVersions).where(eq(viewTemplateVersions.id, template.currentVersionId))
    : [null];
  
  // Get all versions
  const versions = await db.select().from(viewTemplateVersions)
    .where(eq(viewTemplateVersions.templateId, templateId))
    .orderBy(desc(viewTemplateVersions.versionNumber));
  
  return { ...template, currentVersion, versions };
}

export async function listViewTemplatesV2(orgId: number, options?: { category?: string; status?: string; createdByUserId?: number }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(viewTemplatesV2.orgId, orgId)];
  if (options?.category) conditions.push(eq(viewTemplatesV2.category, options.category));
  if (options?.status) conditions.push(eq(viewTemplatesV2.status, options.status as "active" | "archived" | "draft"));
  if (options?.createdByUserId) conditions.push(eq(viewTemplatesV2.createdByUserId, options.createdByUserId));
  
  return db.select().from(viewTemplatesV2).where(and(...conditions)).orderBy(desc(viewTemplatesV2.updatedAt));
}

export async function publishNewVersion(data: {
  templateId: string;
  definition: {
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  };
  changelog: string;
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current max version number
  const [maxVersion] = await db.select({ max: sql<number>`MAX(version_number)` })
    .from(viewTemplateVersions)
    .where(eq(viewTemplateVersions.templateId, data.templateId));
  
  const newVersionNumber = (maxVersion?.max || 0) + 1;
  const versionId = crypto.randomUUID();
  
  // Create new version
  await db.insert(viewTemplateVersions).values({
    id: versionId,
    templateId: data.templateId,
    versionNumber: newVersionNumber,
    definitionJson: data.definition,
    changelog: data.changelog,
    createdByUserId: data.userId,
  });
  
  // Update template's current version
  await db.update(viewTemplatesV2)
    .set({ currentVersionId: versionId, updatedAt: new Date() })
    .where(eq(viewTemplatesV2.id, data.templateId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "version",
    entityId: versionId,
    action: "version_published",
    userId: data.userId,
    detailsJson: { versionNumber: newVersionNumber, changelog: data.changelog },
    relatedTemplateId: data.templateId,
    relatedVersionId: versionId,
  });
  
  return { versionId, versionNumber: newVersionNumber };
}

// ============ VIEW INSTANCES ============

export async function createViewInstance(data: {
  orgId: number;
  ownerUserId: number;
  name: string;
  workspaceId?: string;
  boardId?: string;
  requestId?: number;
  sourceTemplateId?: string;
  sourceVersionId?: string;
  definition: {
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  };
  updateMode: "independent" | "managed";
}) {
  const db = await getDb();
  if (!db) return null;
  
  const instanceId = crypto.randomUUID();
  
  await db.insert(viewInstances).values({
    id: instanceId,
    orgId: data.orgId,
    ownerUserId: data.ownerUserId,
    name: data.name,
    workspaceId: data.workspaceId,
    boardId: data.boardId,
    requestId: data.requestId,
    sourceTemplateId: data.sourceTemplateId,
    sourceVersionId: data.sourceVersionId,
    definitionJson: data.definition,
    updateMode: data.updateMode,
    hasLocalEdits: false,
    status: "active",
  });
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "instance",
    entityId: instanceId,
    action: data.sourceTemplateId ? "instance_cloned" : "instance_created",
    userId: data.ownerUserId,
    detailsJson: { name: data.name, updateMode: data.updateMode },
    relatedTemplateId: data.sourceTemplateId,
    relatedVersionId: data.sourceVersionId,
    relatedInstanceId: instanceId,
  });
  
  return instanceId;
}

export async function getViewInstance(instanceId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [instance] = await db.select().from(viewInstances).where(eq(viewInstances.id, instanceId));
  if (!instance) return null;
  
  // If managed, check for available updates
  let availableUpdate = null;
  if (instance.updateMode === "managed" && instance.sourceTemplateId) {
    const [template] = await db.select().from(viewTemplatesV2)
      .where(eq(viewTemplatesV2.id, instance.sourceTemplateId));
    
    if (template && template.currentVersionId !== instance.sourceVersionId) {
      const [newVersion] = await db.select().from(viewTemplateVersions)
        .where(eq(viewTemplateVersions.id, template.currentVersionId!));
      
      availableUpdate = {
        currentVersionId: template.currentVersionId,
        versionNumber: newVersion?.versionNumber,
        changelog: newVersion?.changelog,
      };
    }
  }
  
  return { ...instance, availableUpdate };
}

export async function listViewInstances(options: {
  orgId?: number;
  ownerUserId?: number;
  workspaceId?: string;
  boardId?: string;
  requestId?: number;
  sourceTemplateId?: string;
  updateMode?: "independent" | "managed";
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (options.orgId) conditions.push(eq(viewInstances.orgId, options.orgId));
  if (options.ownerUserId) conditions.push(eq(viewInstances.ownerUserId, options.ownerUserId));
  if (options.workspaceId) conditions.push(eq(viewInstances.workspaceId, options.workspaceId));
  if (options.boardId) conditions.push(eq(viewInstances.boardId, options.boardId));
  if (options.requestId) conditions.push(eq(viewInstances.requestId, options.requestId));
  if (options.sourceTemplateId) conditions.push(eq(viewInstances.sourceTemplateId, options.sourceTemplateId));
  if (options.updateMode) conditions.push(eq(viewInstances.updateMode, options.updateMode));
  
  conditions.push(eq(viewInstances.status, "active"));
  
  return db.select().from(viewInstances).where(and(...conditions)).orderBy(desc(viewInstances.updatedAt));
}

export async function updateViewInstanceDefinition(data: {
  instanceId: string;
  definition: {
    columns: string[];
    filters: Record<string, unknown>;
    grouping?: string[];
    sorting?: { field: string; direction: "asc" | "desc" }[];
    cardMode?: "summary" | "expanded" | "full";
    disclosureMode?: "summary" | "expanded" | "full";
    formRequirements?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  };
  localEditsSummary?: string;
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(viewInstances)
    .set({
      definitionJson: data.definition,
      hasLocalEdits: true,
      localEditsSummary: data.localEditsSummary,
      updatedAt: new Date(),
    })
    .where(eq(viewInstances.id, data.instanceId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "instance",
    entityId: data.instanceId,
    action: "instance_updated",
    userId: data.userId,
    detailsJson: { localEditsSummary: data.localEditsSummary },
    relatedInstanceId: data.instanceId,
  });
  
  return true;
}

export async function forkViewInstance(data: {
  instanceId: string;
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  // Update instance to be independent
  await db.update(viewInstances)
    .set({
      updateMode: "independent",
      hasLocalEdits: true,
      localEditsSummary: "Forked from managed instance",
      updatedAt: new Date(),
    })
    .where(eq(viewInstances.id, data.instanceId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "instance",
    entityId: data.instanceId,
    action: "instance_forked",
    userId: data.userId,
    detailsJson: { reason: "User chose to fork from managed instance" },
    relatedInstanceId: data.instanceId,
  });
  
  return true;
}

// ============ SHARE MODES ============

export async function shareViewAsTemplate(data: {
  templateId: string;
  recipientUserId: number;
  recipientOrgId: number;
  name?: string;
  workspaceId?: string;
  boardId?: string;
  requestId?: number;
  sharedByUserId: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Get template and current version
  const template = await getViewTemplateV2(data.templateId);
  if (!template || !template.currentVersion) return null;
  
  // Create independent instance (clone)
  const instanceId = await createViewInstance({
    orgId: data.recipientOrgId,
    ownerUserId: data.recipientUserId,
    name: data.name || template.name,
    workspaceId: data.workspaceId,
    boardId: data.boardId,
    requestId: data.requestId,
    sourceTemplateId: data.templateId,
    sourceVersionId: template.currentVersionId!,
    definition: template.currentVersion.definitionJson as any,
    updateMode: "independent", // Clone = independent
  });
  
  return instanceId;
}

export async function shareViewAsManaged(data: {
  templateId: string;
  recipientUserId: number;
  recipientOrgId: number;
  name?: string;
  workspaceId?: string;
  boardId?: string;
  requestId?: number;
  sharedByUserId: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Get template and current version
  const template = await getViewTemplateV2(data.templateId);
  if (!template || !template.currentVersion) return null;
  
  // Create managed instance (linked to source)
  const instanceId = await createViewInstance({
    orgId: data.recipientOrgId,
    ownerUserId: data.recipientUserId,
    name: data.name || template.name,
    workspaceId: data.workspaceId,
    boardId: data.boardId,
    requestId: data.requestId,
    sourceTemplateId: data.templateId,
    sourceVersionId: template.currentVersionId!,
    definition: template.currentVersion.definitionJson as any,
    updateMode: "managed", // Managed = linked to source
  });
  
  return instanceId;
}

// ============ UPDATE ROLLOUTS ============

export async function createRollout(data: {
  orgId: number;
  templateId: string;
  fromVersionId?: string;
  toVersionId: string;
  rolloutMode: "force" | "safe" | "opt_in";
  scope: "org_wide" | "selected_workspaces" | "selected_instances";
  scopeWorkspaceIds?: string[];
  scopeInstanceIds?: string[];
  requiresApproval: boolean;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const rolloutId = crypto.randomUUID();
  
  await db.insert(viewUpdateRollouts).values({
    id: rolloutId,
    orgId: data.orgId,
    templateId: data.templateId,
    fromVersionId: data.fromVersionId,
    toVersionId: data.toVersionId,
    rolloutMode: data.rolloutMode,
    scope: data.scope,
    scopeWorkspaceIds: data.scopeWorkspaceIds,
    scopeInstanceIds: data.scopeInstanceIds,
    requiresApproval: data.requiresApproval,
    createdByUserId: data.createdByUserId,
    status: data.requiresApproval ? "pending_approval" : "approved",
  });
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "rollout",
    entityId: rolloutId,
    action: "rollout_created",
    userId: data.createdByUserId,
    detailsJson: { rolloutMode: data.rolloutMode, scope: data.scope },
    relatedTemplateId: data.templateId,
    relatedVersionId: data.toVersionId,
    relatedRolloutId: rolloutId,
  });
  
  return rolloutId;
}

export async function approveRollout(data: {
  rolloutId: string;
  approvedByUserId: number;
  approvalNotes?: string;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(viewUpdateRollouts)
    .set({
      status: "approved",
      approvedByUserId: data.approvedByUserId,
      approvalNotes: data.approvalNotes,
      approvedAt: new Date(),
    })
    .where(eq(viewUpdateRollouts.id, data.rolloutId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "rollout",
    entityId: data.rolloutId,
    action: "rollout_approved",
    userId: data.approvedByUserId,
    detailsJson: { approvalNotes: data.approvalNotes },
    relatedRolloutId: data.rolloutId,
  });
  
  return true;
}

export async function rejectRollout(data: {
  rolloutId: string;
  rejectedByUserId: number;
  rejectionReason?: string;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(viewUpdateRollouts)
    .set({
      status: "canceled",
      approvalNotes: data.rejectionReason,
    })
    .where(eq(viewUpdateRollouts.id, data.rolloutId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "rollout",
    entityId: data.rolloutId,
    action: "rollout_rejected",
    userId: data.rejectedByUserId,
    detailsJson: { rejectionReason: data.rejectionReason },
    relatedRolloutId: data.rolloutId,
  });
  
  return true;
}

export async function executeRollout(rolloutId: string, executedByUserId: number) {
  const db = await getDb();
  if (!db) return { success: false, results: [] };
  
  // Get rollout details
  const [rollout] = await db.select().from(viewUpdateRollouts).where(eq(viewUpdateRollouts.id, rolloutId));
  if (!rollout || rollout.status !== "approved") {
    return { success: false, results: [], error: "Rollout not approved" };
  }
  
  // Get new version definition
  const [newVersion] = await db.select().from(viewTemplateVersions)
    .where(eq(viewTemplateVersions.id, rollout.toVersionId));
  if (!newVersion) {
    return { success: false, results: [], error: "Version not found" };
  }
  
  // Update rollout status to executing
  await db.update(viewUpdateRollouts)
    .set({ status: "executing", executedAt: new Date() })
    .where(eq(viewUpdateRollouts.id, rolloutId));
  
  // Find affected instances
  let instances: typeof viewInstances.$inferSelect[] = [];
  
  if (rollout.scope === "org_wide") {
    instances = await db.select().from(viewInstances)
      .where(and(
        eq(viewInstances.sourceTemplateId, rollout.templateId),
        eq(viewInstances.updateMode, "managed"),
        eq(viewInstances.status, "active")
      ));
  } else if (rollout.scope === "selected_workspaces" && rollout.scopeWorkspaceIds) {
    instances = await db.select().from(viewInstances)
      .where(and(
        eq(viewInstances.sourceTemplateId, rollout.templateId),
        eq(viewInstances.updateMode, "managed"),
        eq(viewInstances.status, "active"),
        inArray(viewInstances.workspaceId, rollout.scopeWorkspaceIds)
      ));
  } else if (rollout.scope === "selected_instances" && rollout.scopeInstanceIds) {
    instances = await db.select().from(viewInstances)
      .where(and(
        eq(viewInstances.sourceTemplateId, rollout.templateId),
        eq(viewInstances.updateMode, "managed"),
        eq(viewInstances.status, "active"),
        inArray(viewInstances.id, rollout.scopeInstanceIds)
      ));
  }
  
  const results: Array<{ instanceId: string; status: string; conflicts?: unknown[] }> = [];
  
  for (const instance of instances) {
    // Create receipt
    const receiptId = crypto.randomUUID();
    
    if (rollout.rolloutMode === "opt_in") {
      // For opt-in, just create pending receipt
      await db.insert(viewInstanceUpdateReceipts).values({
        id: receiptId,
        rolloutId,
        instanceId: instance.id,
        status: "pending",
        previousDefinitionJson: instance.definitionJson,
      });
      
      results.push({ instanceId: instance.id, status: "pending" });
      
    } else if (rollout.rolloutMode === "force") {
      // Force update - overwrite regardless of local edits
      await db.update(viewInstances)
        .set({
          definitionJson: newVersion.definitionJson,
          sourceVersionId: rollout.toVersionId,
          hasLocalEdits: false,
          localEditsSummary: null,
          updatedAt: new Date(),
        })
        .where(eq(viewInstances.id, instance.id));
      
      await db.insert(viewInstanceUpdateReceipts).values({
        id: receiptId,
        rolloutId,
        instanceId: instance.id,
        status: "applied",
        previousDefinitionJson: instance.definitionJson,
      });
      
      // Log to audit
      await db.insert(viewVersionAuditLog).values({
        orgId: rollout.orgId,
        entityType: "receipt",
        entityId: receiptId,
        action: "update_applied",
        userId: executedByUserId,
        detailsJson: { rolloutMode: "force", hadLocalEdits: instance.hasLocalEdits },
        relatedInstanceId: instance.id,
        relatedRolloutId: rolloutId,
      });
      
      results.push({ instanceId: instance.id, status: "applied" });
      
    } else if (rollout.rolloutMode === "safe") {
      // Safe update - check for conflicts
      const conflicts = detectConflicts(
        instance.definitionJson as Record<string, unknown>,
        newVersion.definitionJson as Record<string, unknown>,
        instance.hasLocalEdits || false
      );
      
      if (conflicts.length > 0) {
        await db.insert(viewInstanceUpdateReceipts).values({
          id: receiptId,
          rolloutId,
          instanceId: instance.id,
          status: "conflict",
          conflictDetailsJson: conflicts,
          previousDefinitionJson: instance.definitionJson,
        });
        
        // Log to audit
        await db.insert(viewVersionAuditLog).values({
          orgId: rollout.orgId,
          entityType: "receipt",
          entityId: receiptId,
          action: "update_conflict",
          userId: executedByUserId,
          detailsJson: { conflictCount: conflicts.length },
          relatedInstanceId: instance.id,
          relatedRolloutId: rolloutId,
        });
        
        results.push({ instanceId: instance.id, status: "conflict", conflicts });
      } else {
        // No conflicts - apply update
        await db.update(viewInstances)
          .set({
            definitionJson: newVersion.definitionJson,
            sourceVersionId: rollout.toVersionId,
            hasLocalEdits: false,
            localEditsSummary: null,
            updatedAt: new Date(),
          })
          .where(eq(viewInstances.id, instance.id));
        
        await db.insert(viewInstanceUpdateReceipts).values({
          id: receiptId,
          rolloutId,
          instanceId: instance.id,
          status: "applied",
          previousDefinitionJson: instance.definitionJson,
        });
        
        results.push({ instanceId: instance.id, status: "applied" });
      }
    }
  }
  
  // Update rollout status to completed
  await db.update(viewUpdateRollouts)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(viewUpdateRollouts.id, rolloutId));
  
  // Log completion
  await db.insert(viewVersionAuditLog).values({
    orgId: rollout.orgId,
    entityType: "rollout",
    entityId: rolloutId,
    action: "rollout_completed",
    userId: executedByUserId,
    detailsJson: { 
      totalInstances: instances.length,
      applied: results.filter(r => r.status === "applied").length,
      conflicts: results.filter(r => r.status === "conflict").length,
      pending: results.filter(r => r.status === "pending").length,
    },
    relatedRolloutId: rolloutId,
  });
  
  return { success: true, results };
}

// Helper function to detect conflicts between local and new definitions
function detectConflicts(
  localDef: Record<string, unknown>,
  newDef: Record<string, unknown>,
  hasLocalEdits: boolean
): Array<{ conflictingFields: string[]; localValue: unknown; newValue: unknown }> {
  if (!hasLocalEdits) return []; // No local edits = no conflicts
  
  const conflicts: Array<{ conflictingFields: string[]; localValue: unknown; newValue: unknown }> = [];
  
  // Check columns
  const localColumns = (localDef.columns as string[]) || [];
  const newColumns = (newDef.columns as string[]) || [];
  if (JSON.stringify(localColumns) !== JSON.stringify(newColumns)) {
    conflicts.push({
      conflictingFields: ["columns"],
      localValue: localColumns,
      newValue: newColumns,
    });
  }
  
  // Check filters
  const localFilters = localDef.filters || {};
  const newFilters = newDef.filters || {};
  if (JSON.stringify(localFilters) !== JSON.stringify(newFilters)) {
    conflicts.push({
      conflictingFields: ["filters"],
      localValue: localFilters,
      newValue: newFilters,
    });
  }
  
  // Check sorting
  const localSorting = localDef.sorting || [];
  const newSorting = newDef.sorting || [];
  if (JSON.stringify(localSorting) !== JSON.stringify(newSorting)) {
    conflicts.push({
      conflictingFields: ["sorting"],
      localValue: localSorting,
      newValue: newSorting,
    });
  }
  
  return conflicts;
}

// ============ OPT-IN UPDATE HANDLING ============

export async function acceptOptInUpdate(data: {
  receiptId: string;
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  // Get receipt and rollout
  const [receipt] = await db.select().from(viewInstanceUpdateReceipts)
    .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  if (!receipt || receipt.status !== "pending") return false;
  
  const [rollout] = await db.select().from(viewUpdateRollouts)
    .where(eq(viewUpdateRollouts.id, receipt.rolloutId));
  if (!rollout) return false;
  
  // Get new version
  const [newVersion] = await db.select().from(viewTemplateVersions)
    .where(eq(viewTemplateVersions.id, rollout.toVersionId));
  if (!newVersion) return false;
  
  // Apply update
  await db.update(viewInstances)
    .set({
      definitionJson: newVersion.definitionJson,
      sourceVersionId: rollout.toVersionId,
      hasLocalEdits: false,
      localEditsSummary: null,
      updatedAt: new Date(),
    })
    .where(eq(viewInstances.id, receipt.instanceId));
  
  // Update receipt
  await db.update(viewInstanceUpdateReceipts)
    .set({
      status: "applied",
      userAction: "accepted",
      userActionAt: new Date(),
      userActionByUserId: data.userId,
      updatedAt: new Date(),
    })
    .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "receipt",
    entityId: data.receiptId,
    action: "update_applied",
    userId: data.userId,
    detailsJson: { userAction: "accepted" },
    relatedInstanceId: receipt.instanceId,
    relatedRolloutId: receipt.rolloutId,
  });
  
  return true;
}

export async function rejectOptInUpdate(data: {
  receiptId: string;
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  // Get receipt
  const [receipt] = await db.select().from(viewInstanceUpdateReceipts)
    .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  if (!receipt || receipt.status !== "pending") return false;
  
  // Update receipt
  await db.update(viewInstanceUpdateReceipts)
    .set({
      status: "rejected",
      userAction: "rejected",
      userActionAt: new Date(),
      userActionByUserId: data.userId,
      updatedAt: new Date(),
    })
    .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "receipt",
    entityId: data.receiptId,
    action: "update_skipped",
    userId: data.userId,
    detailsJson: { userAction: "rejected" },
    relatedInstanceId: receipt.instanceId,
    relatedRolloutId: receipt.rolloutId,
  });
  
  return true;
}

// ============ CONFLICT RESOLUTION ============

export async function resolveConflict(data: {
  receiptId: string;
  resolution: "keep_local" | "apply_new" | "fork";
  userId: number;
  orgId: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  // Get receipt and rollout
  const [receipt] = await db.select().from(viewInstanceUpdateReceipts)
    .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  if (!receipt || receipt.status !== "conflict") return false;
  
  const [rollout] = await db.select().from(viewUpdateRollouts)
    .where(eq(viewUpdateRollouts.id, receipt.rolloutId));
  if (!rollout) return false;
  
  if (data.resolution === "keep_local") {
    // Keep local - mark as skipped
    await db.update(viewInstanceUpdateReceipts)
      .set({
        status: "skipped",
        userAction: "rejected",
        userActionAt: new Date(),
        userActionByUserId: data.userId,
        updatedAt: new Date(),
      })
      .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
      
  } else if (data.resolution === "apply_new") {
    // Apply new - overwrite local
    const [newVersion] = await db.select().from(viewTemplateVersions)
      .where(eq(viewTemplateVersions.id, rollout.toVersionId));
    if (!newVersion) return false;
    
    await db.update(viewInstances)
      .set({
        definitionJson: newVersion.definitionJson,
        sourceVersionId: rollout.toVersionId,
        hasLocalEdits: false,
        localEditsSummary: null,
        updatedAt: new Date(),
      })
      .where(eq(viewInstances.id, receipt.instanceId));
    
    await db.update(viewInstanceUpdateReceipts)
      .set({
        status: "applied",
        userAction: "accepted",
        userActionAt: new Date(),
        userActionByUserId: data.userId,
        updatedAt: new Date(),
      })
      .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
      
  } else if (data.resolution === "fork") {
    // Fork - make independent
    await forkViewInstance({
      instanceId: receipt.instanceId,
      userId: data.userId,
      orgId: data.orgId,
    });
    
    await db.update(viewInstanceUpdateReceipts)
      .set({
        status: "skipped",
        userAction: "deferred",
        userActionAt: new Date(),
        userActionByUserId: data.userId,
        updatedAt: new Date(),
      })
      .where(eq(viewInstanceUpdateReceipts.id, data.receiptId));
  }
  
  // Log to audit
  await db.insert(viewVersionAuditLog).values({
    orgId: data.orgId,
    entityType: "receipt",
    entityId: data.receiptId,
    action: "conflict_resolved",
    userId: data.userId,
    detailsJson: { resolution: data.resolution },
    relatedInstanceId: receipt.instanceId,
    relatedRolloutId: receipt.rolloutId,
  });
  
  return true;
}

// ============ ROLLOUT QUERIES ============

export async function getRollout(rolloutId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [rollout] = await db.select().from(viewUpdateRollouts)
    .where(eq(viewUpdateRollouts.id, rolloutId));
  if (!rollout) return null;
  
  // Get receipts
  const receipts = await db.select().from(viewInstanceUpdateReceipts)
    .where(eq(viewInstanceUpdateReceipts.rolloutId, rolloutId));
  
  // Get template and version info
  const [template] = await db.select().from(viewTemplatesV2)
    .where(eq(viewTemplatesV2.id, rollout.templateId));
  const [toVersion] = await db.select().from(viewTemplateVersions)
    .where(eq(viewTemplateVersions.id, rollout.toVersionId));
  
  return { ...rollout, receipts, template, toVersion };
}

export async function listRollouts(options: {
  orgId?: number;
  templateId?: string;
  status?: string;
  createdByUserId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (options.orgId) conditions.push(eq(viewUpdateRollouts.orgId, options.orgId));
  if (options.templateId) conditions.push(eq(viewUpdateRollouts.templateId, options.templateId));
  if (options.status) conditions.push(eq(viewUpdateRollouts.status, options.status as any));
  if (options.createdByUserId) conditions.push(eq(viewUpdateRollouts.createdByUserId, options.createdByUserId));
  
  return db.select().from(viewUpdateRollouts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(viewUpdateRollouts.createdAt));
}

export async function getPendingUpdatesForUser(userId: number, orgId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get user's managed instances
  const instances = await db.select().from(viewInstances)
    .where(and(
      eq(viewInstances.ownerUserId, userId),
      eq(viewInstances.orgId, orgId),
      eq(viewInstances.updateMode, "managed"),
      eq(viewInstances.status, "active")
    ));
  
  const pendingUpdates: Array<{
    instance: typeof viewInstances.$inferSelect;
    receipt?: typeof viewInstanceUpdateReceipts.$inferSelect;
    newVersion?: typeof viewTemplateVersions.$inferSelect;
  }> = [];
  
  for (const instance of instances) {
    if (!instance.sourceTemplateId) continue;
    
    // Check for pending receipts (opt-in updates)
    const [pendingReceipt] = await db.select().from(viewInstanceUpdateReceipts)
      .where(and(
        eq(viewInstanceUpdateReceipts.instanceId, instance.id),
        eq(viewInstanceUpdateReceipts.status, "pending")
      ));
    
    if (pendingReceipt) {
      const [rollout] = await db.select().from(viewUpdateRollouts)
        .where(eq(viewUpdateRollouts.id, pendingReceipt.rolloutId));
      if (rollout) {
        const [newVersion] = await db.select().from(viewTemplateVersions)
          .where(eq(viewTemplateVersions.id, rollout.toVersionId));
        pendingUpdates.push({ instance, receipt: pendingReceipt, newVersion: newVersion || undefined });
      }
    } else {
      // Check if template has newer version
      const [template] = await db.select().from(viewTemplatesV2)
        .where(eq(viewTemplatesV2.id, instance.sourceTemplateId));
      
      if (template && template.currentVersionId !== instance.sourceVersionId) {
        const [newVersion] = await db.select().from(viewTemplateVersions)
          .where(eq(viewTemplateVersions.id, template.currentVersionId!));
        pendingUpdates.push({ instance, newVersion: newVersion || undefined });
      }
    }
  }
  
  return pendingUpdates;
}

// ============ AUDIT LOG QUERIES ============

export async function getViewVersionAuditLog(options: {
  orgId?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  userId?: number;
  relatedTemplateId?: string;
  relatedInstanceId?: string;
  relatedRolloutId?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (options.orgId) conditions.push(eq(viewVersionAuditLog.orgId, options.orgId));
  if (options.entityType) conditions.push(eq(viewVersionAuditLog.entityType, options.entityType as any));
  if (options.entityId) conditions.push(eq(viewVersionAuditLog.entityId, options.entityId));
  if (options.action) conditions.push(eq(viewVersionAuditLog.action, options.action as any));
  if (options.userId) conditions.push(eq(viewVersionAuditLog.userId, options.userId));
  if (options.relatedTemplateId) conditions.push(eq(viewVersionAuditLog.relatedTemplateId, options.relatedTemplateId));
  if (options.relatedInstanceId) conditions.push(eq(viewVersionAuditLog.relatedInstanceId, options.relatedInstanceId));
  if (options.relatedRolloutId) conditions.push(eq(viewVersionAuditLog.relatedRolloutId, options.relatedRolloutId));
  
  const query = db.select().from(viewVersionAuditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(viewVersionAuditLog.createdAt));
  
  if (options.limit) {
    return query.limit(options.limit);
  }
  
  return query;
}


// ═══════════════════════════════════════════════════════════════
// EVIDENCE GROUNDING: 3-Tier Evidence Selection Service
// ═══════════════════════════════════════════════════════════════

// Create an evidence reference
export async function createEvidenceRef(data: InsertEvidenceRef) {
  const db = await getDb();
  if (!db) return null;
  
  // Enforce snippet max length
  const snippet = data.snippet ? data.snippet.slice(0, 240) : null;
  
  const result = await db.insert(evidenceRefs).values({
    ...data,
    snippet,
  });
  return result[0]?.insertId || null;
}

// Get evidence refs for a field record
export async function getEvidenceRefsForField(fieldRecordId: number, fieldRecordType: "ai_extraction" | "vatr_source" | "asset_attribute") {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(evidenceRefs)
    .where(and(
      eq(evidenceRefs.fieldRecordId, fieldRecordId),
      eq(evidenceRefs.fieldRecordType, fieldRecordType)
    ))
    .orderBy(
      // Order by tier (T1 > T2 > T3) then by confidence desc
      asc(evidenceRefs.tier),
      desc(evidenceRefs.confidence)
    );
}

// Get evidence refs for a document page
export async function getEvidenceRefsForDocumentPage(documentId: number, pageNumber: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(evidenceRefs)
    .where(and(
      eq(evidenceRefs.documentId, documentId),
      eq(evidenceRefs.pageNumber, pageNumber)
    ))
    .orderBy(desc(evidenceRefs.confidence));
}

/**
 * Evidence Selection Service - Deterministic tier preference with tie-breaks
 * 
 * Selection order:
 * 1. T1_TEXT (native PDF text with bbox) - highest priority
 * 2. T2_OCR (OCR-derived with bbox) - medium priority  
 * 3. T3_ANCHOR (text anchor fallback) - lowest priority
 * 
 * Tie-break within same tier:
 * 1. Higher confidence score
 * 2. Lower evidenceRef ID (deterministic)
 */
export async function selectBestEvidence(
  fieldRecordId: number, 
  fieldRecordType: "ai_extraction" | "vatr_source" | "asset_attribute"
): Promise<EvidenceRef | null> {
  const db = await getDb();
  if (!db) return null;
  
  const refs = await db.select().from(evidenceRefs)
    .where(and(
      eq(evidenceRefs.fieldRecordId, fieldRecordId),
      eq(evidenceRefs.fieldRecordType, fieldRecordType)
    ));
  
  if (refs.length === 0) return null;
  
  // Tier priority map
  const tierPriority: Record<string, number> = {
    'T1_TEXT': 1,
    'T2_OCR': 2,
    'T3_ANCHOR': 3,
  };
  
  // Sort by tier priority, then confidence desc, then ID asc (deterministic)
  refs.sort((a, b) => {
    // First: tier priority
    const tierDiff = tierPriority[a.tier] - tierPriority[b.tier];
    if (tierDiff !== 0) return tierDiff;
    
    // Second: confidence (higher is better)
    const confA = parseFloat(a.confidence || '0.5');
    const confB = parseFloat(b.confidence || '0.5');
    const confDiff = confB - confA;
    if (Math.abs(confDiff) > 0.001) return confDiff;
    
    // Third: deterministic tie-break by ID (lower wins)
    return a.id - b.id;
  });
  
  return refs[0];
}

/**
 * Batch select best evidence for multiple field records
 */
export async function selectBestEvidenceBatch(
  fieldRecords: Array<{ id: number; type: "ai_extraction" | "vatr_source" | "asset_attribute" }>
): Promise<Map<string, EvidenceRef | null>> {
  const results = new Map<string, EvidenceRef | null>();
  
  // Process in parallel for efficiency
  await Promise.all(
    fieldRecords.map(async ({ id, type }) => {
      const key = `${type}:${id}`;
      const evidence = await selectBestEvidence(id, type);
      results.set(key, evidence);
    })
  );
  
  return results;
}

// Log evidence open event
export async function logEvidenceOpen(data: InsertEvidenceAuditLogEntry) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(evidenceAuditLog).values(data);
  return result[0]?.insertId || null;
}

// Get evidence audit log for a user
export async function getEvidenceAuditLogForUser(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(evidenceAuditLog)
    .where(eq(evidenceAuditLog.userId, userId))
    .orderBy(desc(evidenceAuditLog.createdAt))
    .limit(limit);
}

// Get evidence audit log for an organization
export async function getEvidenceAuditLogForOrg(orgId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(evidenceAuditLog)
    .where(eq(evidenceAuditLog.organizationId, orgId))
    .orderBy(desc(evidenceAuditLog.createdAt))
    .limit(limit);
}

/**
 * Create evidence refs from AI extraction output
 * Automatically determines tier based on available data
 */
export async function createEvidenceFromExtraction(
  extractionId: number,
  documentId: number,
  pageNumber: number | null,
  options: {
    snippet?: string;
    boundingBox?: { x: number; y: number; w: number; h: number; units?: string; origin?: string; rotation?: number };
    confidence?: number;
    extractionMethod?: "native" | "ocr" | "llm";
    createdById?: number;
  }
) {
  // Determine tier based on extraction method and bbox availability
  let tier: "T1_TEXT" | "T2_OCR" | "T3_ANCHOR";
  
  if (options.boundingBox) {
    // Has bbox - either T1 or T2
    tier = options.extractionMethod === "ocr" ? "T2_OCR" : "T1_TEXT";
  } else {
    // No bbox - T3 anchor
    tier = "T3_ANCHOR";
  }
  
  const bboxJson = options.boundingBox ? {
    units: (options.boundingBox.units as any) || "pdf_points",
    origin: (options.boundingBox.origin as any) || "bottom_left",
    rotation: (options.boundingBox.rotation as any) || 0,
    x: options.boundingBox.x,
    y: options.boundingBox.y,
    w: options.boundingBox.w,
    h: options.boundingBox.h,
  } : null;
  
  const anchorJson = tier === "T3_ANCHOR" && options.snippet ? {
    matchType: "exact" as const,
    query: options.snippet.slice(0, 100),
    contextBefore: undefined,
    contextAfter: undefined,
    occurrenceHint: 1,
  } : null;
  
  return createEvidenceRef({
    fieldRecordId: extractionId,
    fieldRecordType: "ai_extraction",
    documentId,
    pageNumber,
    tier,
    snippet: options.snippet,
    bboxJson,
    anchorJson,
    confidence: String(options.confidence || 0.5),
    createdById: options.createdById,
    provenanceStatus: "resolved",
  });
}

/**
 * Create evidence refs from VATR source document link
 */
export async function createEvidenceFromVatrSource(
  vatrSourceId: number,
  documentId: number,
  pageNumber: number | null,
  options: {
    snippet?: string;
    confidence?: number;
    createdById?: number;
  }
) {
  // VATR sources typically don't have bbox, so use T3 anchor
  const anchorJson = options.snippet ? {
    matchType: "exact" as const,
    query: options.snippet.slice(0, 100),
    contextBefore: undefined,
    contextAfter: undefined,
    occurrenceHint: 1,
  } : null;
  
  return createEvidenceRef({
    fieldRecordId: vatrSourceId,
    fieldRecordType: "vatr_source",
    documentId,
    pageNumber,
    tier: "T3_ANCHOR",
    snippet: options.snippet,
    bboxJson: null,
    anchorJson,
    confidence: String(options.confidence || 0.5),
    createdById: options.createdById,
    provenanceStatus: options.snippet ? "resolved" : "unresolved",
  });
}

/**
 * Update evidence ref provenance status
 */
export async function updateEvidenceProvenanceStatus(
  evidenceRefId: number,
  status: "resolved" | "unresolved" | "needs_review"
) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(evidenceRefs)
    .set({ provenanceStatus: status })
    .where(eq(evidenceRefs.id, evidenceRefId));
}

/**
 * Get unresolved evidence refs for review
 */
export async function getUnresolvedEvidenceRefs(documentId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [
    or(
      eq(evidenceRefs.provenanceStatus, "unresolved"),
      eq(evidenceRefs.provenanceStatus, "needs_review")
    )!
  ];
  
  if (documentId) {
    conditions.push(eq(evidenceRefs.documentId, documentId));
  }
  
  return db.select().from(evidenceRefs)
    .where(and(...conditions))
    .orderBy(desc(evidenceRefs.createdAt))
    .limit(limit);
}

// ============ PHASE 32: ORG ISOLATION + SECURE ONBOARDING ============

// Organization functions
export async function getOrganizationBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return org || null;
}

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return org || null;
}

export async function getUserOrganizationMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .orderBy(organizationMembers.createdAt);
}

export async function getKiishaLobbyOrg() {
  const db = await getDb();
  if (!db) return null;
  const [config] = await db.select().from(kiishaLobbyConfig).limit(1);
  if (!config) return null;
  return getOrganizationById(config.lobbyOrganizationId);
}

// Security Audit Log
export async function createSecurityAuditLogEntry(data: InsertSecurityAuditLogEntry) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(securityAuditLog).values(data);
  return result?.insertId;
}

export async function getSecurityAuditLog(filters: {
  userId?: number;
  organizationId?: number;
  eventType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  if (filters.userId) conditions.push(eq(securityAuditLog.userId, filters.userId));
  if (filters.organizationId) conditions.push(eq(securityAuditLog.organizationId, filters.organizationId));
  if (filters.eventType) conditions.push(eq(securityAuditLog.eventType, filters.eventType as any));
  if (filters.startDate) conditions.push(gte(securityAuditLog.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(securityAuditLog.createdAt, filters.endDate));
  
  return db.select().from(securityAuditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(securityAuditLog.createdAt))
    .limit(filters.limit || 100);
}

// Superuser Elevations
export async function createSuperuserElevation(data: InsertSuperuserElevation) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(superuserElevations).values(data);
  return result?.insertId;
}

export async function getActiveSuperuserElevation(userId: number, targetOrgId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const now = new Date();
  const conditions: SQL[] = [
    eq(superuserElevations.userId, userId),
    eq(superuserElevations.status, "active"),
    gte(superuserElevations.expiresAt, now),
  ];
  
  if (targetOrgId) {
    conditions.push(
      or(
        eq(superuserElevations.scope, "global"),
        eq(superuserElevations.targetOrganizationId, targetOrgId)
      )!
    );
  }
  
  const [elevation] = await db.select().from(superuserElevations)
    .where(and(...conditions))
    .orderBy(desc(superuserElevations.startedAt))
    .limit(1);
  
  return elevation || null;
}

export async function endSuperuserElevation(elevationId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(superuserElevations)
    .set({ status: "terminated", endedAt: new Date() })
    .where(eq(superuserElevations.id, elevationId));
  return true;
}

// Invite Tokens
export async function createInviteToken(data: InsertInviteToken) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(inviteTokens).values(data);
  return result?.insertId;
}

export async function getInviteTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const [token] = await db.select().from(inviteTokens)
    .where(eq(inviteTokens.tokenHash, tokenHash))
    .limit(1);
  return token || null;
}

export async function redeemInviteToken(tokenId: number, userId: number, email: string, ipAddress?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) return false;
  
  // Increment usage count
  await db.update(inviteTokens)
    .set({ usedCount: sql`${inviteTokens.usedCount} + 1` })
    .where(eq(inviteTokens.id, tokenId));
  
  // Record redemption
  await db.insert(inviteTokenRedemptions).values({
    tokenId,
    userId,
    email,
    ipAddress,
    userAgent,
  });
  
  return true;
}

export async function revokeInviteToken(tokenId: number, revokedBy: number, reason?: string) {
  const db = await getDb();
  if (!db) return false;
  await db.update(inviteTokens)
    .set({ revokedAt: new Date(), revokedBy, revokedReason: reason })
    .where(eq(inviteTokens.id, tokenId));
  return true;
}

export async function getInviteTokensForOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inviteTokens)
    .where(eq(inviteTokens.organizationId, organizationId))
    .orderBy(desc(inviteTokens.createdAt));
}

// Pre-approved memberships
export async function getPreApprovedMembershipByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const [membership] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.preApprovedEmail, email.toLowerCase()),
      eq(organizationMembers.status, "pending"),
      isNull(organizationMembers.userId)
    ))
    .limit(1);
  return membership || null;
}

export async function activatePreApprovedMembership(membershipId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(organizationMembers)
    .set({ 
      userId, 
      status: "active", 
      acceptedAt: new Date() 
    })
    .where(eq(organizationMembers.id, membershipId));
  return true;
}

export async function createPreApprovedMembership(data: {
  organizationId: number;
  email: string;
  role?: "admin" | "editor" | "reviewer" | "investor_viewer";
  invitedBy: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(organizationMembers).values({
    organizationId: data.organizationId,
    preApprovedEmail: data.email.toLowerCase(),
    role: data.role || "editor",
    status: "pending",
    invitedBy: data.invitedBy,
    invitedAt: new Date(),
  });
  return result?.insertId;
}

// WhatsApp Binding
export async function createWhatsappBindingToken(data: InsertWhatsappBindingToken) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(whatsappBindingTokens).values(data);
  return result?.insertId;
}

export async function getWhatsappBindingToken(userId: number, phoneNumber: string) {
  const db = await getDb();
  if (!db) return null;
  const [token] = await db.select().from(whatsappBindingTokens)
    .where(and(
      eq(whatsappBindingTokens.userId, userId),
      eq(whatsappBindingTokens.phoneNumber, phoneNumber),
      eq(whatsappBindingTokens.status, "pending")
    ))
    .orderBy(desc(whatsappBindingTokens.createdAt))
    .limit(1);
  return token || null;
}

export async function verifyWhatsappBindingToken(tokenId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(whatsappBindingTokens)
    .set({ status: "verified", verifiedAt: new Date() })
    .where(eq(whatsappBindingTokens.id, tokenId));
  return true;
}

export async function incrementWhatsappBindingAttempts(tokenId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(whatsappBindingTokens)
    .set({ attempts: sql`${whatsappBindingTokens.attempts} + 1` })
    .where(eq(whatsappBindingTokens.id, tokenId));
  return true;
}

// Cross-Org Share Tokens
export async function createCrossOrgShareToken(data: InsertCrossOrgShareToken) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(crossOrgShareTokens).values(data);
  return result?.insertId;
}

export async function getCrossOrgShareTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return null;
  const [token] = await db.select().from(crossOrgShareTokens)
    .where(eq(crossOrgShareTokens.tokenHash, tokenHash))
    .limit(1);
  return token || null;
}

export async function revokeCrossOrgShareToken(tokenId: number, revokedBy: number, reason?: string) {
  const db = await getDb();
  if (!db) return false;
  await db.update(crossOrgShareTokens)
    .set({ status: "revoked", revokedAt: new Date(), revokedBy, revokedReason: reason })
    .where(eq(crossOrgShareTokens.id, tokenId));
  return true;
}

export async function logCrossOrgShareAccess(data: InsertCrossOrgShareAccessLogEntry) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(crossOrgShareAccessLog).values(data);
  return result?.insertId;
}

// Access Requests
export async function createAccessRequest(data: InsertAccessRequest) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(accessRequests).values(data);
  return result?.insertId;
}

export async function getPendingAccessRequests(organizationId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [eq(accessRequests.status, "pending")];
  if (organizationId) {
    conditions.push(eq(accessRequests.targetOrganizationId, organizationId));
  }
  
  return db.select().from(accessRequests)
    .where(and(...conditions))
    .orderBy(desc(accessRequests.createdAt));
}

export async function resolveAccessRequest(
  requestId: number, 
  status: "approved" | "rejected", 
  resolvedBy: number,
  notes?: string,
  resultingMembershipId?: number
) {
  const db = await getDb();
  if (!db) return false;
  await db.update(accessRequests)
    .set({ 
      status, 
      resolvedBy, 
      resolvedAt: new Date(), 
      resolutionNotes: notes,
      resultingMembershipId 
    })
    .where(eq(accessRequests.id, requestId));
  return true;
}

// User Sessions
export async function createUserSession(data: InsertUserSession) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(userSessions).values(data);
  return result?.insertId;
}

export async function getUserSession(sessionId: string) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db.select().from(userSessions)
    .where(eq(userSessions.sessionId, sessionId))
    .limit(1);
  return session || null;
}

export async function updateUserSessionActivity(sessionId: string, activeOrgId?: number) {
  const db = await getDb();
  if (!db) return false;
  const updates: Record<string, unknown> = { lastActivityAt: new Date() };
  if (activeOrgId !== undefined) {
    updates.activeOrganizationId = activeOrgId;
  }
  await db.update(userSessions)
    .set(updates)
    .where(eq(userSessions.sessionId, sessionId));
  return true;
}

export async function revokeUserSession(sessionId: string, reason?: string) {
  const db = await getDb();
  if (!db) return false;
  await db.update(userSessions)
    .set({ status: "revoked", revokedAt: new Date(), revokedReason: reason })
    .where(eq(userSessions.sessionId, sessionId));
  return true;
}

export async function revokeAllUserSessions(userId: number, exceptSessionId?: string) {
  const db = await getDb();
  if (!db) return false;
  
  const conditions: SQL[] = [
    eq(userSessions.userId, userId),
    eq(userSessions.status, "active")
  ];
  
  if (exceptSessionId) {
    conditions.push(ne(userSessions.sessionId, exceptSessionId));
  }
  
  await db.update(userSessions)
    .set({ status: "revoked", revokedAt: new Date(), revokedReason: "All sessions revoked" })
    .where(and(...conditions));
  return true;
}

// Update user's active org
export async function updateUserActiveOrg(userId: number, activeOrgId: number | null) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users)
    .set({ activeOrgId })
    .where(eq(users.id, userId));
  return true;
}

// Email verification
export async function setEmailVerificationToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users)
    .set({ 
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt 
    })
    .where(eq(users.id, userId));
  return true;
}

export async function verifyUserEmail(userId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(users)
    .set({ 
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpires: null
    })
    .where(eq(users.id, userId));
  return true;
}

export async function getUserByEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users)
    .where(and(
      eq(users.emailVerificationToken, token),
      gte(users.emailVerificationExpires, new Date())
    ))
    .limit(1);
  return user || null;
}

// Get all organization superusers (KIISHA staff)
export async function getAllOrganizationSuperusers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizationSuperusers);
}


// Cross-Org Share Token functions
export async function getCrossOrgShareTokenById(tokenId: number) {
  const db = await getDb();
  if (!db) return null;
  const [token] = await db.select().from(crossOrgShareTokens)
    .where(eq(crossOrgShareTokens.id, tokenId))
    .limit(1);
  return token || null;
}

export async function getCrossOrgShareTokensForOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crossOrgShareTokens)
    .where(eq(crossOrgShareTokens.sourceOrganizationId, organizationId))
    .orderBy(desc(crossOrgShareTokens.createdAt));
}

export async function getCrossOrgShareAccessLog(tokenId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crossOrgShareAccessLog)
    .where(eq(crossOrgShareAccessLog.tokenId, tokenId))
    .orderBy(desc(crossOrgShareAccessLog.accessedAt))
    .limit(limit);
}


// ============================================================================
// Phase 33: Multi-Org Workspace Switching Functions
// ============================================================================

// User Workspace Preferences
export async function getUserWorkspacePreferences(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [prefs] = await db.select().from(userWorkspacePreferences)
    .where(eq(userWorkspacePreferences.userId, userId))
    .limit(1);
  return prefs || null;
}

export async function upsertUserWorkspacePreferences(
  userId: number,
  updates: Partial<InsertUserWorkspacePreference>
) {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await getUserWorkspacePreferences(userId);
  
  if (existing) {
    await db.update(userWorkspacePreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userWorkspacePreferences.userId, userId));
    return { ...existing, ...updates };
  } else {
    const [result] = await db.insert(userWorkspacePreferences)
      .values({ userId, ...updates });
    return { id: result.insertId, userId, ...updates };
  }
}

// Workspace Binding Codes
export async function createWorkspaceBindingCode(data: InsertWorkspaceBindingCode) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(workspaceBindingCodes).values(data);
  return result.insertId;
}

export async function getWorkspaceBindingCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  const [binding] = await db.select().from(workspaceBindingCodes)
    .where(eq(workspaceBindingCodes.code, code))
    .limit(1);
  return binding || null;
}

export async function markWorkspaceBindingCodeUsed(
  code: string,
  channel: "whatsapp" | "email",
  identifier: string
) {
  const db = await getDb();
  if (!db) return false;
  await db.update(workspaceBindingCodes)
    .set({
      usedAt: new Date(),
      usedFromChannel: channel,
      usedFromIdentifier: identifier,
    })
    .where(eq(workspaceBindingCodes.code, code));
  return true;
}

export async function getActiveBindingCodesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceBindingCodes)
    .where(and(
      eq(workspaceBindingCodes.userId, userId),
      isNull(workspaceBindingCodes.usedAt),
      gt(workspaceBindingCodes.expiresAt, new Date())
    ))
    .orderBy(desc(workspaceBindingCodes.createdAt));
}

// Workspace Switch Audit Log
export async function logWorkspaceSwitch(data: InsertWorkspaceSwitchAuditEntry) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(workspaceSwitchAuditLog).values(data);
  return result.insertId;
}

export async function getWorkspaceSwitchHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaceSwitchAuditLog)
    .where(eq(workspaceSwitchAuditLog.userId, userId))
    .orderBy(desc(workspaceSwitchAuditLog.switchedAt))
    .limit(limit);
}

// Conversation Sessions with Org Scope
export async function getConversationSessionByThread(
  userId: number,
  channel: "whatsapp" | "email" | "web_chat",
  channelThreadId: string
) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db.select().from(conversationSessions)
    .where(and(
      eq(conversationSessions.userId, userId),
      eq(conversationSessions.channel, channel),
      eq(conversationSessions.channelThreadId, channelThreadId)
    ))
    .limit(1);
  return session || null;
}

export async function getConversationSessionByOrgAndChannel(
  userId: number,
  organizationId: number,
  channel: "whatsapp" | "email" | "web_chat"
) {
  const db = await getDb();
  if (!db) return null;
  const [session] = await db.select().from(conversationSessions)
    .where(and(
      eq(conversationSessions.userId, userId),
      eq(conversationSessions.organizationId, organizationId),
      eq(conversationSessions.channel, channel)
    ))
    .orderBy(desc(conversationSessions.lastActivityAt))
    .limit(1);
  return session || null;
}

export async function updateConversationSessionOrg(
  sessionId: number,
  organizationId: number
) {
  const db = await getDb();
  if (!db) return false;
  await db.update(conversationSessions)
    .set({ organizationId, updatedAt: new Date() })
    .where(eq(conversationSessions.id, sessionId));
  return true;
}

export async function clearConversationSessionPointers(sessionId: number) {
  const db = await getDb();
  if (!db) return false;
  await db.update(conversationSessions)
    .set({
      lastReferencedProjectId: null,
      lastReferencedSiteId: null,
      lastReferencedAssetId: null,
      lastReferencedDocumentId: null,
      activeDataroomId: null,
      activeViewScopeId: null,
      updatedAt: new Date(),
    })
    .where(eq(conversationSessions.id, sessionId));
  return true;
}

// Organization membership helpers for workspace resolution
export async function getActiveOrgMembershipsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    membershipId: organizationMembers.id,
    organizationId: organizationMembers.organizationId,
    role: organizationMembers.role,
    status: organizationMembers.status,
    organizationName: organizations.name,
    organizationSlug: organizations.slug,
    organizationStatus: organizations.status,
  })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, "active"),
      eq(organizations.status, "active")
    ))
    .orderBy(organizations.name);
}

export async function isUserMemberOfOrg(userId: number, organizationId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [membership] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active")
    ))
    .limit(1);
  return !!membership;
}

export async function getUserOrgRole(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return null;
  const [membership] = await db.select().from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active")
    ))
    .limit(1);
  return membership?.role || null;
}



// ============ PHASE 34: ORG PREFERENCES & FIELD PACKS ============

// --- Org Preferences ---
export async function getOrgPreferences(organizationId: number): Promise<OrgPreference | null> {
  const db = await getDb();
  if (!db) return null;
  const [prefs] = await db.select().from(orgPreferences)
    .where(eq(orgPreferences.organizationId, organizationId))
    .limit(1);
  return prefs || null;
}

export async function upsertOrgPreferences(data: InsertOrgPreference): Promise<OrgPreference | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.insert(orgPreferences)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        defaultAssetClassifications: data.defaultAssetClassifications,
        defaultConfigurationProfiles: data.defaultConfigurationProfiles,
        preferredFieldPacks: data.preferredFieldPacks,
        defaultDisclosureMode: data.defaultDisclosureMode,
        defaultChartsConfig: data.defaultChartsConfig,
        defaultDocumentHubSchemaId: data.defaultDocumentHubSchemaId,
        updatedBy: data.updatedBy,
      }
    });
  
  return getOrgPreferences(data.organizationId);
}

export async function createOrgPreferenceVersion(
  organizationId: number,
  version: number,
  snapshot: OrgPreference,
  changeSummary: string,
  createdBy: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(orgPreferenceVersions).values({
    organizationId,
    version,
    snapshotJson: snapshot,
    changeSummary,
    createdBy,
  });
  
  return result.insertId;
}

export async function getOrgPreferenceVersions(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(orgPreferenceVersions)
    .where(eq(orgPreferenceVersions.organizationId, organizationId))
    .orderBy(desc(orgPreferenceVersions.version));
}

export async function getLatestOrgPreferenceVersion(organizationId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [latest] = await db.select({ version: orgPreferenceVersions.version })
    .from(orgPreferenceVersions)
    .where(eq(orgPreferenceVersions.organizationId, organizationId))
    .orderBy(desc(orgPreferenceVersions.version))
    .limit(1);
  
  return latest?.version || 0;
}

// --- Field Packs ---
export async function getFieldPack(id: number): Promise<FieldPack | null> {
  const db = await getDb();
  if (!db) return null;
  const [pack] = await db.select().from(fieldPacks)
    .where(eq(fieldPacks.id, id))
    .limit(1);
  return pack || null;
}

export async function getFieldPacksForOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get org-specific packs and global templates
  return db.select().from(fieldPacks)
    .where(or(
      eq(fieldPacks.organizationId, organizationId),
      isNull(fieldPacks.organizationId)
    ))
    .orderBy(fieldPacks.name);
}

export async function getGlobalFieldPacks() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(fieldPacks)
    .where(isNull(fieldPacks.organizationId))
    .orderBy(fieldPacks.name);
}

export async function getActiveFieldPacksForOrg(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(fieldPacks)
    .where(and(
      or(
        eq(fieldPacks.organizationId, organizationId),
        isNull(fieldPacks.organizationId)
      ),
      eq(fieldPacks.status, "active")
    ))
    .orderBy(fieldPacks.name);
}

export async function createFieldPack(data: InsertFieldPack): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(fieldPacks).values(data);
  return result.insertId;
}

export async function updateFieldPack(id: number, data: Partial<InsertFieldPack>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fieldPacks)
    .set(data)
    .where(eq(fieldPacks.id, id));
}

export async function cloneFieldPack(
  sourceId: number,
  organizationId: number,
  createdBy: number,
  newName?: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const source = await getFieldPack(sourceId);
  if (!source) throw new Error("Source field pack not found");
  
  const [result] = await db.insert(fieldPacks).values({
    organizationId,
    name: newName || `${source.name} (Copy)`,
    description: source.description,
    scope: source.scope,
    fields: source.fields,
    docRequirements: source.docRequirements,
    charts: source.charts,
    status: "draft",
    clonedFromId: sourceId,
    createdBy,
  });
  
  return result.insertId;
}

export async function activateFieldPack(id: number, updatedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fieldPacks)
    .set({ status: "active", updatedBy })
    .where(eq(fieldPacks.id, id));
}

export async function archiveFieldPack(id: number, updatedBy: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(fieldPacks)
    .set({ status: "archived", updatedBy })
    .where(eq(fieldPacks.id, id));
}

// --- AI Setup Proposals ---
export async function createAiSetupProposal(data: InsertAiSetupProposal): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(aiSetupProposals).values(data);
  return result.insertId;
}

export async function getAiSetupProposal(id: number): Promise<AiSetupProposal | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [proposal] = await db.select().from(aiSetupProposals)
    .where(eq(aiSetupProposals.id, id))
    .limit(1);
  return proposal || null;
}

export async function getPendingAiSetupProposals(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(aiSetupProposals)
    .where(and(
      eq(aiSetupProposals.organizationId, organizationId),
      eq(aiSetupProposals.status, "pending")
    ))
    .orderBy(desc(aiSetupProposals.createdAt));
}

export async function getLatestAiSetupProposal(organizationId: number): Promise<AiSetupProposal | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [proposal] = await db.select().from(aiSetupProposals)
    .where(eq(aiSetupProposals.organizationId, organizationId))
    .orderBy(desc(aiSetupProposals.createdAt))
    .limit(1);
  return proposal || null;
}

export async function updateAiSetupProposalStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "partially_approved",
  reviewedBy: number,
  reviewNotes?: string,
  approvedItems?: {
    assetClasses: boolean;
    configProfiles: boolean;
    fieldPackIds: number[];
    chartConfig: boolean;
    docHubCategories: boolean;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(aiSetupProposals)
    .set({
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes,
      approvedItems,
    })
    .where(eq(aiSetupProposals.id, id));
}

// --- User View Customizations ---
export async function getUserViewCustomization(
  userId: number,
  organizationId: number,
  viewId: number
) {
  const db = await getDb();
  if (!db) return null;
  
  const [custom] = await db.select().from(userViewCustomizations)
    .where(and(
      eq(userViewCustomizations.userId, userId),
      eq(userViewCustomizations.organizationId, organizationId),
      eq(userViewCustomizations.viewId, viewId)
    ))
    .limit(1);
  return custom || null;
}

export async function upsertUserViewCustomization(data: InsertUserViewCustomization): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(userViewCustomizations)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        localChartOverrides: data.localChartOverrides,
        localColumnOrder: data.localColumnOrder,
        localHiddenFields: data.localHiddenFields,
        hasLocalChanges: true,
      }
    });
}

export async function resetUserViewCustomization(
  userId: number,
  organizationId: number,
  viewId: number,
  orgUpdateVersion: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(userViewCustomizations)
    .set({
      localChartOverrides: null,
      localColumnOrder: null,
      localHiddenFields: null,
      hasLocalChanges: false,
      lastOrgUpdateVersion: orgUpdateVersion,
    })
    .where(and(
      eq(userViewCustomizations.userId, userId),
      eq(userViewCustomizations.organizationId, organizationId),
      eq(userViewCustomizations.viewId, viewId)
    ));
}

// --- Push Update Notifications ---
export async function createPushUpdateNotification(data: InsertPushUpdateNotification): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(pushUpdateNotifications).values(data);
  return result.insertId;
}

export async function getPendingPushUpdatesForUser(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get updates where user hasn't accepted yet
  const updates = await db.select().from(pushUpdateNotifications)
    .where(eq(pushUpdateNotifications.organizationId, organizationId))
    .orderBy(desc(pushUpdateNotifications.createdAt));
  
  // Filter to updates targeting this user that haven't been accepted
  return updates.filter(update => {
    const notified = update.notifiedUserIds || [];
    const accepted = update.acceptedUserIds || [];
    const targets = update.targetIds || [];
    
    // Check if user is in target scope
    const isTargeted = update.targetScope === "all_users" || targets.includes(userId);
    
    // Check if user has been notified but not accepted
    return isTargeted && notified.includes(userId) && !accepted.includes(userId);
  });
}

export async function markPushUpdateAccepted(notificationId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const [notification] = await db.select().from(pushUpdateNotifications)
    .where(eq(pushUpdateNotifications.id, notificationId))
    .limit(1);
  
  if (!notification) return;
  
  const acceptedUserIds = notification.acceptedUserIds || [];
  if (!acceptedUserIds.includes(userId)) {
    acceptedUserIds.push(userId);
    await db.update(pushUpdateNotifications)
      .set({ acceptedUserIds })
      .where(eq(pushUpdateNotifications.id, notificationId));
  }
}

// --- KIISHA Default Field Packs (Global Templates) ---
export async function ensureDefaultFieldPacksExist(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Check if default packs already exist
  const existing = await getGlobalFieldPacks();
  if (existing.length > 0) return;
  
  // Create default KIISHA field packs
  const defaultPacks: InsertFieldPack[] = [
    {
      organizationId: null,
      name: "Solar Asset Basics",
      description: "Essential fields for solar asset tracking",
      scope: "asset",
      fields: [
        { fieldKey: "assetClassification", required: true, displayLabel: "Asset Classification", group: "Identity", order: 1 },
        { fieldKey: "configurationProfile", required: true, displayLabel: "Configuration Profile", group: "Identity", order: 2 },
        { fieldKey: "capacityMW", required: true, displayLabel: "Capacity (MW)", group: "Technical", order: 3 },
        { fieldKey: "commissioningDate", required: false, displayLabel: "Commissioning Date", group: "Technical", order: 4 },
        { fieldKey: "latitude", required: false, displayLabel: "Latitude", group: "Location", order: 5 },
        { fieldKey: "longitude", required: false, displayLabel: "Longitude", group: "Location", order: 6 },
      ],
      docRequirements: [
        { docTypeKey: "ppa", required: true, reviewerGroups: ["legal"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "interconnection_agreement", required: true, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "capacity_by_status", defaultType: "bar", allowedTypes: ["bar", "pie"], dataBinding: "assetStatus" },
        { chartKey: "generation_trend", defaultType: "line", allowedTypes: ["line", "area"], dataBinding: "monthlyGeneration" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Due Diligence Pack",
      description: "Comprehensive fields for investor due diligence",
      scope: "dataroom",
      fields: [
        { fieldKey: "projectName", required: true, displayLabel: "Project Name", group: "Overview", order: 1 },
        { fieldKey: "totalCapacityMW", required: true, displayLabel: "Total Capacity (MW)", group: "Overview", order: 2 },
        { fieldKey: "ppaCounterparty", required: true, displayLabel: "PPA Counterparty", group: "Commercial", order: 3, sensitivity: "confidential" },
        { fieldKey: "ppaTermYears", required: true, displayLabel: "PPA Term (Years)", group: "Commercial", order: 4 },
        { fieldKey: "ppaRate", required: false, displayLabel: "PPA Rate", group: "Commercial", order: 5, sensitivity: "restricted" },
        { fieldKey: "epcContractor", required: false, displayLabel: "EPC Contractor", group: "Technical", order: 6 },
        { fieldKey: "oAndMProvider", required: false, displayLabel: "O&M Provider", group: "Technical", order: 7 },
      ],
      docRequirements: [
        { docTypeKey: "ppa", required: true, reviewerGroups: ["legal", "commercial"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "land_lease", required: true, reviewerGroups: ["legal"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "environmental_permit", required: true, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "financial_model", required: true, reviewerGroups: ["finance"], allowedFileTypes: ["xlsx", "pdf"] },
      ],
      charts: [
        { chartKey: "document_status", defaultType: "pie", allowedTypes: ["pie", "bar"], dataBinding: "docStatus" },
        { chartKey: "diligence_progress", defaultType: "bar", allowedTypes: ["bar", "line"], dataBinding: "diligenceProgress" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Operations Pack",
      description: "Fields for operational monitoring and reporting",
      scope: "asset",
      fields: [
        { fieldKey: "operationalStatus", required: true, displayLabel: "Operational Status", group: "Status", order: 1 },
        { fieldKey: "lastMaintenanceDate", required: false, displayLabel: "Last Maintenance", group: "Maintenance", order: 2 },
        { fieldKey: "nextScheduledMaintenance", required: false, displayLabel: "Next Scheduled Maintenance", group: "Maintenance", order: 3 },
        { fieldKey: "availabilityPercent", required: false, displayLabel: "Availability %", group: "Performance", order: 4 },
        { fieldKey: "performanceRatio", required: false, displayLabel: "Performance Ratio", group: "Performance", order: 5 },
        { fieldKey: "monthlyGenerationMWh", required: false, displayLabel: "Monthly Generation (MWh)", group: "Performance", order: 6 },
      ],
      docRequirements: [
        { docTypeKey: "maintenance_report", required: false, reviewerGroups: ["operations"], allowedFileTypes: ["pdf", "xlsx"] },
        { docTypeKey: "performance_report", required: false, reviewerGroups: ["operations"], allowedFileTypes: ["pdf", "xlsx"] },
      ],
      charts: [
        { chartKey: "availability_trend", defaultType: "line", allowedTypes: ["line", "area"], dataBinding: "availability" },
        { chartKey: "generation_vs_target", defaultType: "bar", allowedTypes: ["bar", "line"], dataBinding: "generationVsTarget" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "RFI Response Pack",
      description: "Standard fields for RFI responses",
      scope: "rfi",
      fields: [
        { fieldKey: "rfiQuestion", required: true, displayLabel: "Question", group: "Request", order: 1 },
        { fieldKey: "rfiResponse", required: true, displayLabel: "Response", group: "Response", order: 2 },
        { fieldKey: "respondedBy", required: true, displayLabel: "Responded By", group: "Response", order: 3 },
        { fieldKey: "responseDate", required: true, displayLabel: "Response Date", group: "Response", order: 4 },
        { fieldKey: "supportingDocuments", required: false, displayLabel: "Supporting Documents", group: "Response", order: 5 },
      ],
      docRequirements: [],
      charts: [],
      status: "active",
    },
    // Phase 37: Additional comprehensive field packs
    {
      organizationId: null,
      name: "Wind Asset Basics",
      description: "Essential fields for wind asset tracking",
      scope: "asset",
      fields: [
        { fieldKey: "assetClassification", required: true, displayLabel: "Asset Classification", group: "Identity", order: 1 },
        { fieldKey: "turbineManufacturer", required: true, displayLabel: "Turbine Manufacturer", group: "Technical", order: 2 },
        { fieldKey: "turbineModel", required: true, displayLabel: "Turbine Model", group: "Technical", order: 3 },
        { fieldKey: "hubHeight", required: false, displayLabel: "Hub Height (m)", group: "Technical", order: 4, validationRules: { type: "number", min: 0, max: 200 } },
        { fieldKey: "rotorDiameter", required: false, displayLabel: "Rotor Diameter (m)", group: "Technical", order: 5, validationRules: { type: "number", min: 0, max: 250 } },
        { fieldKey: "numberOfTurbines", required: true, displayLabel: "Number of Turbines", group: "Technical", order: 6, validationRules: { type: "number", min: 1 } },
        { fieldKey: "capacityMW", required: true, displayLabel: "Capacity (MW)", group: "Technical", order: 7 },
        { fieldKey: "commissioningDate", required: false, displayLabel: "Commissioning Date", group: "Technical", order: 8 },
        { fieldKey: "latitude", required: false, displayLabel: "Latitude", group: "Location", order: 9 },
        { fieldKey: "longitude", required: false, displayLabel: "Longitude", group: "Location", order: 10 },
        { fieldKey: "windZone", required: false, displayLabel: "Wind Zone", group: "Location", order: 11 },
      ],
      docRequirements: [
        { docTypeKey: "ppa", required: true, reviewerGroups: ["legal"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "interconnection_agreement", required: true, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "turbine_supply_agreement", required: false, reviewerGroups: ["technical", "legal"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "capacity_by_status", defaultType: "bar", allowedTypes: ["bar", "pie"], dataBinding: "assetStatus" },
        { chartKey: "generation_trend", defaultType: "line", allowedTypes: ["line", "area"], dataBinding: "monthlyGeneration" },
        { chartKey: "wind_speed_distribution", defaultType: "histogram", allowedTypes: ["histogram", "bar"], dataBinding: "windSpeed" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "BESS Asset Pack",
      description: "Battery Energy Storage System tracking fields",
      scope: "asset",
      fields: [
        { fieldKey: "assetClassification", required: true, displayLabel: "Asset Classification", group: "Identity", order: 1 },
        { fieldKey: "batteryManufacturer", required: true, displayLabel: "Battery Manufacturer", group: "Technical", order: 2 },
        { fieldKey: "batteryChemistry", required: true, displayLabel: "Battery Chemistry", group: "Technical", order: 3 },
        { fieldKey: "capacityMW", required: true, displayLabel: "Power Capacity (MW)", group: "Technical", order: 4 },
        { fieldKey: "energyCapacityMWh", required: true, displayLabel: "Energy Capacity (MWh)", group: "Technical", order: 5 },
        { fieldKey: "durationHours", required: false, displayLabel: "Duration (Hours)", group: "Technical", order: 6 },
        { fieldKey: "roundTripEfficiency", required: false, displayLabel: "Round Trip Efficiency %", group: "Performance", order: 7, validationRules: { type: "number", min: 0, max: 100 } },
        { fieldKey: "cycleLife", required: false, displayLabel: "Cycle Life", group: "Technical", order: 8 },
        { fieldKey: "warrantyEndDate", required: false, displayLabel: "Warranty End Date", group: "Commercial", order: 9 },
        { fieldKey: "commissioningDate", required: false, displayLabel: "Commissioning Date", group: "Technical", order: 10 },
        { fieldKey: "latitude", required: false, displayLabel: "Latitude", group: "Location", order: 11 },
        { fieldKey: "longitude", required: false, displayLabel: "Longitude", group: "Location", order: 12 },
      ],
      docRequirements: [
        { docTypeKey: "capacity_agreement", required: true, reviewerGroups: ["legal", "commercial"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "battery_warranty", required: true, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "interconnection_agreement", required: true, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "safety_certification", required: false, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "soc_trend", defaultType: "line", allowedTypes: ["line", "area"], dataBinding: "stateOfCharge" },
        { chartKey: "cycle_count", defaultType: "bar", allowedTypes: ["bar", "line"], dataBinding: "cycleCount" },
        { chartKey: "degradation_curve", defaultType: "line", allowedTypes: ["line"], dataBinding: "capacityDegradation" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Compliance & Regulatory Pack",
      description: "Regulatory compliance tracking for renewable assets",
      scope: "asset",
      fields: [
        { fieldKey: "regulatoryJurisdiction", required: true, displayLabel: "Regulatory Jurisdiction", group: "Regulatory", order: 1 },
        { fieldKey: "gridOperator", required: true, displayLabel: "Grid Operator", group: "Regulatory", order: 2 },
        { fieldKey: "interconnectionStatus", required: true, displayLabel: "Interconnection Status", group: "Grid", order: 3 },
        { fieldKey: "environmentalPermitStatus", required: true, displayLabel: "Environmental Permit Status", group: "Environmental", order: 4 },
        { fieldKey: "environmentalPermitExpiry", required: false, displayLabel: "Environmental Permit Expiry", group: "Environmental", order: 5 },
        { fieldKey: "landUsePermitStatus", required: false, displayLabel: "Land Use Permit Status", group: "Land", order: 6 },
        { fieldKey: "aviationClearance", required: false, displayLabel: "Aviation Clearance", group: "Aviation", order: 7 },
        { fieldKey: "noiseCompliance", required: false, displayLabel: "Noise Compliance Status", group: "Environmental", order: 8 },
        { fieldKey: "lastAuditDate", required: false, displayLabel: "Last Audit Date", group: "Audit", order: 9 },
        { fieldKey: "nextAuditDate", required: false, displayLabel: "Next Audit Date", group: "Audit", order: 10 },
      ],
      docRequirements: [
        { docTypeKey: "environmental_permit", required: true, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"], statusLightsConfig: { green: "Valid", yellow: "Expiring Soon", red: "Expired" } },
        { docTypeKey: "interconnection_agreement", required: true, reviewerGroups: ["technical", "compliance"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "grid_compliance_certificate", required: false, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "audit_report", required: false, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "compliance_status", defaultType: "pie", allowedTypes: ["pie", "bar"], dataBinding: "complianceStatus" },
        { chartKey: "permit_expiry_timeline", defaultType: "timeline", allowedTypes: ["timeline", "bar"], dataBinding: "permitExpiry" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Financial Performance Pack",
      description: "Financial metrics and revenue tracking",
      scope: "asset",
      fields: [
        { fieldKey: "ppaCounterparty", required: true, displayLabel: "PPA Counterparty", group: "Commercial", order: 1, sensitivity: "confidential" },
        { fieldKey: "ppaTermYears", required: true, displayLabel: "PPA Term (Years)", group: "Commercial", order: 2 },
        { fieldKey: "ppaStartDate", required: false, displayLabel: "PPA Start Date", group: "Commercial", order: 3 },
        { fieldKey: "ppaEndDate", required: false, displayLabel: "PPA End Date", group: "Commercial", order: 4 },
        { fieldKey: "ppaRate", required: false, displayLabel: "PPA Rate ($/MWh)", group: "Commercial", order: 5, sensitivity: "restricted" },
        { fieldKey: "escalationRate", required: false, displayLabel: "Escalation Rate %", group: "Commercial", order: 6, sensitivity: "confidential" },
        { fieldKey: "merchantExposure", required: false, displayLabel: "Merchant Exposure %", group: "Commercial", order: 7 },
        { fieldKey: "monthlyRevenue", required: false, displayLabel: "Monthly Revenue", group: "Financial", order: 8, sensitivity: "restricted" },
        { fieldKey: "ytdRevenue", required: false, displayLabel: "YTD Revenue", group: "Financial", order: 9, sensitivity: "restricted" },
        { fieldKey: "opex", required: false, displayLabel: "OPEX ($/kW/yr)", group: "Financial", order: 10, sensitivity: "confidential" },
        { fieldKey: "ebitda", required: false, displayLabel: "EBITDA", group: "Financial", order: 11, sensitivity: "restricted" },
      ],
      docRequirements: [
        { docTypeKey: "ppa", required: true, reviewerGroups: ["legal", "commercial"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "financial_model", required: false, reviewerGroups: ["finance"], allowedFileTypes: ["xlsx", "pdf"] },
        { docTypeKey: "revenue_report", required: false, reviewerGroups: ["finance"], allowedFileTypes: ["xlsx", "pdf"] },
      ],
      charts: [
        { chartKey: "revenue_trend", defaultType: "line", allowedTypes: ["line", "area", "bar"], dataBinding: "monthlyRevenue" },
        { chartKey: "revenue_vs_budget", defaultType: "bar", allowedTypes: ["bar", "line"], dataBinding: "revenueVsBudget" },
        { chartKey: "ppa_expiry_timeline", defaultType: "timeline", allowedTypes: ["timeline", "bar"], dataBinding: "ppaExpiry" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Portfolio Overview Pack",
      description: "Aggregated portfolio-level metrics and tracking",
      scope: "portfolio",
      fields: [
        { fieldKey: "portfolioName", required: true, displayLabel: "Portfolio Name", group: "Identity", order: 1 },
        { fieldKey: "totalCapacityMW", required: true, displayLabel: "Total Capacity (MW)", group: "Overview", order: 2 },
        { fieldKey: "assetCount", required: true, displayLabel: "Asset Count", group: "Overview", order: 3 },
        { fieldKey: "technologyMix", required: false, displayLabel: "Technology Mix", group: "Overview", order: 4 },
        { fieldKey: "geographicSpread", required: false, displayLabel: "Geographic Spread", group: "Overview", order: 5 },
        { fieldKey: "weightedAvgPpaRemaining", required: false, displayLabel: "Weighted Avg PPA Remaining (Years)", group: "Commercial", order: 6 },
        { fieldKey: "totalAnnualGeneration", required: false, displayLabel: "Total Annual Generation (GWh)", group: "Performance", order: 7 },
        { fieldKey: "portfolioAvailability", required: false, displayLabel: "Portfolio Availability %", group: "Performance", order: 8 },
        { fieldKey: "annualRevenue", required: false, displayLabel: "Annual Revenue", group: "Financial", order: 9, sensitivity: "restricted" },
        { fieldKey: "portfolioEbitda", required: false, displayLabel: "Portfolio EBITDA", group: "Financial", order: 10, sensitivity: "restricted" },
      ],
      docRequirements: [
        { docTypeKey: "portfolio_summary", required: false, reviewerGroups: ["management"], allowedFileTypes: ["pdf", "pptx"] },
        { docTypeKey: "investor_report", required: false, reviewerGroups: ["finance", "management"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "capacity_by_technology", defaultType: "pie", allowedTypes: ["pie", "bar"], dataBinding: "technologyMix" },
        { chartKey: "capacity_by_region", defaultType: "map", allowedTypes: ["map", "bar"], dataBinding: "geographicDistribution" },
        { chartKey: "portfolio_performance", defaultType: "line", allowedTypes: ["line", "area"], dataBinding: "portfolioPerformance" },
      ],
      status: "active",
    },
    {
      organizationId: null,
      name: "Site Development Pack",
      description: "Pre-construction and development phase tracking",
      scope: "site",
      fields: [
        { fieldKey: "siteName", required: true, displayLabel: "Site Name", group: "Identity", order: 1 },
        { fieldKey: "developmentStage", required: true, displayLabel: "Development Stage", group: "Status", order: 2 },
        { fieldKey: "targetCapacityMW", required: true, displayLabel: "Target Capacity (MW)", group: "Technical", order: 3 },
        { fieldKey: "technology", required: true, displayLabel: "Technology", group: "Technical", order: 4 },
        { fieldKey: "landSecured", required: true, displayLabel: "Land Secured", group: "Land", order: 5 },
        { fieldKey: "landArea", required: false, displayLabel: "Land Area (acres)", group: "Land", order: 6 },
        { fieldKey: "resourceAssessmentComplete", required: false, displayLabel: "Resource Assessment Complete", group: "Technical", order: 7 },
        { fieldKey: "interconnectionQueuePosition", required: false, displayLabel: "Interconnection Queue Position", group: "Grid", order: 8 },
        { fieldKey: "expectedCOD", required: false, displayLabel: "Expected COD", group: "Timeline", order: 9 },
        { fieldKey: "estimatedCapex", required: false, displayLabel: "Estimated CAPEX", group: "Financial", order: 10, sensitivity: "confidential" },
        { fieldKey: "latitude", required: false, displayLabel: "Latitude", group: "Location", order: 11 },
        { fieldKey: "longitude", required: false, displayLabel: "Longitude", group: "Location", order: 12 },
      ],
      docRequirements: [
        { docTypeKey: "land_option_agreement", required: false, reviewerGroups: ["legal"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "resource_assessment", required: false, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "interconnection_application", required: false, reviewerGroups: ["technical"], allowedFileTypes: ["pdf"] },
        { docTypeKey: "environmental_study", required: false, reviewerGroups: ["compliance"], allowedFileTypes: ["pdf"] },
      ],
      charts: [
        { chartKey: "development_pipeline", defaultType: "funnel", allowedTypes: ["funnel", "bar"], dataBinding: "developmentStage" },
        { chartKey: "cod_timeline", defaultType: "timeline", allowedTypes: ["timeline", "gantt"], dataBinding: "expectedCOD" },
      ],
      status: "active",
    },
  ];
  
  for (const pack of defaultPacks) {
    await db.insert(fieldPacks).values(pack);
  }
}


// ============================================================================
// PHASE 35: Authentication-First Access, Session Management
// ============================================================================

// ============ SERVER SESSION MANAGEMENT ============

/**
 * Create a new server session
 */
export async function createServerSession(session: InsertServerSession): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(serverSessions).values(session);
  return session.id;
}

/**
 * Get session by ID (validates not expired and not revoked)
 */
export async function getValidSession(sessionId: string): Promise<ServerSession | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [session] = await db
    .select()
    .from(serverSessions)
    .where(
      and(
        eq(serverSessions.id, sessionId),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.expiresAt, new Date())
      )
    )
    .limit(1);
  
  return session || null;
}

/**
 * Get session by ID (without validation, for admin purposes)
 */
export async function getSessionById(sessionId: string): Promise<ServerSession | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [session] = await db
    .select()
    .from(serverSessions)
    .where(eq(serverSessions.id, sessionId))
    .limit(1);
  
  return session || null;
}

/**
 * Update session last seen timestamp
 */
export async function touchSession(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(serverSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(serverSessions.id, sessionId));
}

/**
 * Update session active organization
 */
export async function updateSessionActiveOrg(sessionId: string, organizationId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(serverSessions)
    .set({ 
      activeOrganizationId: organizationId,
      lastSeenAt: new Date()
    })
    .where(eq(serverSessions.id, sessionId));
}

/**
 * Mark MFA as satisfied for session
 */
export async function markSessionMfaSatisfied(sessionId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(serverSessions)
    .set({ 
      mfaSatisfiedAt: new Date(),
      lastSeenAt: new Date()
    })
    .where(eq(serverSessions.id, sessionId));
}

/**
 * Revoke a single session
 */
export async function revokeSession(sessionId: string, reason: string, revokedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(serverSessions)
    .set({ 
      revokedAt: new Date(),
      revokedReason: reason,
      revokedBy: revokedBy ?? null
    })
    .where(eq(serverSessions.id, sessionId));
}

/**
 * Revoke all server sessions for a user (new session system)
 */
export async function revokeAllServerSessions(userId: number, reason: string, revokedBy?: number, exceptSessionId?: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const conditions = [
    eq(serverSessions.userId, userId),
    isNull(serverSessions.revokedAt)
  ];
  
  if (exceptSessionId) {
    conditions.push(ne(serverSessions.id, exceptSessionId));
  }
  
  const result = await db
    .update(serverSessions)
    .set({ 
      revokedAt: new Date(),
      revokedReason: reason,
      revokedBy: revokedBy ?? null
    })
    .where(and(...conditions));
  
  return result[0]?.affectedRows ?? 0;
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: number): Promise<ServerSession[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(serverSessions)
    .where(
      and(
        eq(serverSessions.userId, userId),
        isNull(serverSessions.revokedAt),
        gt(serverSessions.expiresAt, new Date())
      )
    )
    .orderBy(desc(serverSessions.lastSeenAt));
}

/**
 * Clean up expired sessions (for maintenance job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .delete(serverSessions)
    .where(lt(serverSessions.expiresAt, new Date()));
  
  return result[0]?.affectedRows ?? 0;
}

// ============ USER LAST CONTEXT ============

/**
 * Get user's last context
 */
export async function getUserLastContext(userId: number): Promise<typeof userLastContext.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [context] = await db
    .select()
    .from(userLastContext)
    .where(eq(userLastContext.userId, userId))
    .limit(1);
  
  return context || null;
}

/**
 * Update user's last context
 */
export async function updateUserLastContext(userId: number, context: Partial<InsertUserLastContext>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .insert(userLastContext)
    .values({
      userId,
      ...context,
      lastActivityAt: new Date()
    })
    .onDuplicateKeyUpdate({
      set: {
        ...context,
        lastActivityAt: new Date()
      }
    });
}

// ============ MFA CONFIGURATION ============

/**
 * Get user's MFA configuration
 */
export async function getUserMfaConfig(userId: number): Promise<UserMfaConfig | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [config] = await db
    .select()
    .from(userMfaConfig)
    .where(eq(userMfaConfig.userId, userId))
    .limit(1);
  
  return config || null;
}

/**
 * Create or update user's MFA configuration
 */
export async function upsertUserMfaConfig(config: InsertUserMfaConfig): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .insert(userMfaConfig)
    .values({
      ...config,
      updatedAt: new Date()
    })
    .onDuplicateKeyUpdate({
      set: {
        ...config,
        updatedAt: new Date()
      }
    });
}

/**
 * Enable TOTP for user
 */
export async function enableUserTotp(userId: number, secret: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .insert(userMfaConfig)
    .values({
      userId,
      totpSecret: secret,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      updatedAt: new Date()
    })
    .onDuplicateKeyUpdate({
      set: {
        totpSecret: secret,
        totpEnabled: true,
        totpVerifiedAt: new Date(),
        updatedAt: new Date()
      }
    });
}

/**
 * Disable TOTP for user
 */
export async function disableUserTotp(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(userMfaConfig)
    .set({
      totpEnabled: false,
      totpSecret: null,
      totpVerifiedAt: null,
      updatedAt: new Date()
    })
    .where(eq(userMfaConfig.userId, userId));
}

/**
 * Store backup codes for user
 */
export async function storeUserBackupCodes(userId: number, hashedCodes: string[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(userMfaConfig)
    .set({
      backupCodesHash: hashedCodes,
      backupCodesGeneratedAt: new Date(),
      backupCodesUsedCount: 0,
      updatedAt: new Date()
    })
    .where(eq(userMfaConfig.userId, userId));
}

/**
 * Increment backup code used count
 */
export async function incrementBackupCodeUsed(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(userMfaConfig)
    .set({
      backupCodesUsedCount: sql`${userMfaConfig.backupCodesUsedCount} + 1`,
      updatedAt: new Date()
    })
    .where(eq(userMfaConfig.userId, userId));
}

// ============ AUTH AUDIT LOG ============

/**
 * Log an auth event
 */
export async function logAuthEvent(event: InsertAuthAuditLog): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db.insert(authAuditLog).values(event);
  return result[0]?.insertId ?? 0;
}

/**
 * Get auth events for user
 */
export async function getUserAuthEvents(userId: number, limit: number = 50): Promise<AuthAuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(authAuditLog)
    .where(eq(authAuditLog.userId, userId))
    .orderBy(desc(authAuditLog.createdAt))
    .limit(limit);
}

/**
 * Get recent auth events for organization
 */
export async function getOrgAuthEvents(organizationId: number, limit: number = 100): Promise<AuthAuditLog[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(authAuditLog)
    .where(eq(authAuditLog.organizationId, organizationId))
    .orderBy(desc(authAuditLog.createdAt))
    .limit(limit);
}

// ============ LOGIN ATTEMPT TRACKING ============

/**
 * Record a login attempt
 */
export async function recordLoginAttempt(identifierHash: string, ipHash: string, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(loginAttempts).values({
    identifierHash,
    ipHash,
    success,
    failureCount: success ? 0 : 1
  });
}

/**
 * Get recent failed login attempts for rate limiting
 */
export async function getRecentFailedAttempts(identifierHash: string, ipHash: string, windowMinutes: number = 15): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loginAttempts)
    .where(
      and(
        or(
          eq(loginAttempts.identifierHash, identifierHash),
          eq(loginAttempts.ipHash, ipHash)
        ),
        eq(loginAttempts.success, false),
        gt(loginAttempts.attemptedAt, windowStart)
      )
    );
  
  return result?.count ?? 0;
}

/**
 * Check if login is locked
 */
export async function isLoginLocked(identifierHash: string, ipHash: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .select()
    .from(loginAttempts)
    .where(
      and(
        or(
          eq(loginAttempts.identifierHash, identifierHash),
          eq(loginAttempts.ipHash, ipHash)
        ),
        isNotNull(loginAttempts.lockedUntil),
        gt(loginAttempts.lockedUntil, new Date())
      )
    )
    .limit(1);
  
  return !!result;
}

/**
 * Lock login for identifier/IP
 */
export async function lockLogin(identifierHash: string, ipHash: string, lockMinutes: number = 30): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  
  await db.insert(loginAttempts).values({
    identifierHash,
    ipHash,
    success: false,
    lockedUntil
  });
}

/**
 * Clear login lock
 */
export async function clearLoginLock(identifierHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(loginAttempts)
    .set({ lockedUntil: null })
    .where(eq(loginAttempts.identifierHash, identifierHash));
}

// ============ HELPER: Check if user requires MFA ============

/**
 * Check if user requires MFA based on their config and org policy
 */
export async function userRequiresMfa(userId: number, organizationId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Check user's MFA config
  const mfaConfig = await getUserMfaConfig(userId);
  if (mfaConfig?.totpEnabled) {
    return true;
  }
  
  // Check org policy if org provided
  if (organizationId) {
    const [org] = await db
      .select({ require2FA: organizations.require2FA })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    if (org?.require2FA) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if user has MFA enabled
 */
export async function userHasMfaEnabled(userId: number): Promise<boolean> {
  const mfaConfig = await getUserMfaConfig(userId);
  return mfaConfig?.totpEnabled ?? false;
}


// ============================================================================
// PHASE 36: OBLIGATIONS + CALENDAR LENS + NOTIFICATIONS
// ============================================================================

// ============ OBLIGATIONS ============

/**
 * Create a new obligation
 */
export async function createObligation(data: InsertObligation): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(obligations).values(data);
  return result.insertId;
}

/**
 * Get obligation by ID with org isolation
 */
export async function getObligationById(id: number, organizationId: number): Promise<Obligation | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [obligation] = await db
    .select()
    .from(obligations)
    .where(and(
      eq(obligations.id, id),
      eq(obligations.organizationId, organizationId)
    ))
    .limit(1);
  
  return obligation ?? null;
}

/**
 * List obligations for an organization with filters
 */
export async function listObligations(
  organizationId: number,
  filters?: {
    status?: string[];
    obligationType?: string[];
    priority?: string[];
    assigneeUserId?: number;
    entityType?: string;
    entityId?: number;
    dueBefore?: Date;
    dueAfter?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(obligations.organizationId, organizationId)];
  
  if (filters?.status?.length) {
    conditions.push(inArray(obligations.status, filters.status as any));
  }
  if (filters?.obligationType?.length) {
    conditions.push(inArray(obligations.obligationType, filters.obligationType as any));
  }
  if (filters?.priority?.length) {
    conditions.push(inArray(obligations.priority, filters.priority as any));
  }
  if (filters?.dueBefore) {
    conditions.push(lte(obligations.dueAt, filters.dueBefore));
  }
  if (filters?.dueAfter) {
    conditions.push(gte(obligations.dueAt, filters.dueAfter));
  }
  
  let query = db
    .select()
    .from(obligations)
    .where(and(...conditions))
    .orderBy(asc(obligations.dueAt));
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  return await query;
}

/**
 * Update obligation fields
 */
export async function updateObligation(
  id: number,
  organizationId: number,
  updates: Partial<InsertObligation>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(obligations)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(obligations.id, id),
      eq(obligations.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

/**
 * Update obligation status
 */
export async function updateObligationStatus(
  id: number,
  organizationId: number,
  status: string,
  completedByUserId?: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const updates: Partial<InsertObligation> = {
    status: status as any,
    updatedAt: new Date()
  };
  
  if (status === "COMPLETED" && completedByUserId) {
    updates.completedAt = new Date();
    updates.completedByUserId = completedByUserId;
  }
  
  const result = await db
    .update(obligations)
    .set(updates)
    .where(and(
      eq(obligations.id, id),
      eq(obligations.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

/**
 * Get obligations due soon (for reminders)
 */
export async function getObligationsDueSoon(
  organizationId: number,
  daysAhead: number = 7
): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  return await db
    .select()
    .from(obligations)
    .where(and(
      eq(obligations.organizationId, organizationId),
      inArray(obligations.status, ["OPEN", "IN_PROGRESS", "BLOCKED", "WAITING_REVIEW"]),
      gte(obligations.dueAt, now),
      lte(obligations.dueAt, futureDate)
    ))
    .orderBy(asc(obligations.dueAt));
}

/**
 * Get overdue obligations
 */
export async function getOverdueObligations(organizationId: number): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  return await db
    .select()
    .from(obligations)
    .where(and(
      eq(obligations.organizationId, organizationId),
      inArray(obligations.status, ["OPEN", "IN_PROGRESS", "BLOCKED", "WAITING_REVIEW"]),
      lt(obligations.dueAt, now)
    ))
    .orderBy(asc(obligations.dueAt));
}

// ============ OBLIGATION LINKS ============

/**
 * Create obligation link
 */
export async function createObligationLink(data: InsertObligationLink): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // If PRIMARY link, check if one already exists for this entity type
  if (data.linkType === "PRIMARY") {
    const existing = await db
      .select()
      .from(obligationLinks)
      .where(and(
        eq(obligationLinks.obligationId, data.obligationId),
        eq(obligationLinks.entityType, data.entityType as any),
        eq(obligationLinks.linkType, "PRIMARY")
      ))
      .limit(1);
    
    if (existing.length > 0) {
      throw new Error(`Obligation already has a PRIMARY link for entity type ${data.entityType}`);
    }
  }
  
  const [result] = await db.insert(obligationLinks).values(data);
  return result.insertId;
}

/**
 * Get links for an obligation
 */
export async function getObligationLinks(
  obligationId: number,
  organizationId: number
): Promise<ObligationLink[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(obligationLinks)
    .where(and(
      eq(obligationLinks.obligationId, obligationId),
      eq(obligationLinks.organizationId, organizationId)
    ));
}

/**
 * Get obligations linked to an entity
 */
export async function getObligationsForEntity(
  entityType: string,
  entityId: number,
  organizationId: number
): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const links = await db
    .select({ obligationId: obligationLinks.obligationId })
    .from(obligationLinks)
    .where(and(
      eq(obligationLinks.entityType, entityType as any),
      eq(obligationLinks.entityId, entityId),
      eq(obligationLinks.organizationId, organizationId)
    ));
  
  if (links.length === 0) return [];
  
  const obligationIds = links.map(l => l.obligationId);
  
  return await db
    .select()
    .from(obligations)
    .where(and(
      inArray(obligations.id, obligationIds),
      eq(obligations.organizationId, organizationId)
    ))
    .orderBy(asc(obligations.dueAt));
}

/**
 * Remove obligation link
 */
export async function removeObligationLink(
  obligationId: number,
  entityType: string,
  entityId: number,
  organizationId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .delete(obligationLinks)
    .where(and(
      eq(obligationLinks.obligationId, obligationId),
      eq(obligationLinks.entityType, entityType as any),
      eq(obligationLinks.entityId, entityId),
      eq(obligationLinks.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

// ============ OBLIGATION ASSIGNMENTS ============

/**
 * Assign user/team to obligation
 */
export async function assignObligation(data: InsertObligationAssignment): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(obligationAssignments).values(data);
  return result.insertId;
}

/**
 * Get assignments for an obligation
 */
export async function getObligationAssignments(
  obligationId: number,
  organizationId: number
): Promise<ObligationAssignment[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(obligationAssignments)
    .where(and(
      eq(obligationAssignments.obligationId, obligationId),
      eq(obligationAssignments.organizationId, organizationId)
    ));
}

/**
 * Get obligations assigned to a user
 */
export async function getObligationsAssignedToUser(
  userId: number,
  organizationId: number,
  filters?: {
    status?: string[];
    role?: string;
  }
): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const assignmentConditions = [
    eq(obligationAssignments.assigneeType, "USER"),
    eq(obligationAssignments.assigneeId, userId),
    eq(obligationAssignments.organizationId, organizationId)
  ];
  
  if (filters?.role) {
    assignmentConditions.push(eq(obligationAssignments.role, filters.role as any));
  }
  
  const assignments = await db
    .select({ obligationId: obligationAssignments.obligationId })
    .from(obligationAssignments)
    .where(and(...assignmentConditions));
  
  if (assignments.length === 0) return [];
  
  const obligationIds = assignments.map(a => a.obligationId);
  
  const obligationConditions = [
    inArray(obligations.id, obligationIds),
    eq(obligations.organizationId, organizationId)
  ];
  
  if (filters?.status?.length) {
    obligationConditions.push(inArray(obligations.status, filters.status as any));
  }
  
  return await db
    .select()
    .from(obligations)
    .where(and(...obligationConditions))
    .orderBy(asc(obligations.dueAt));
}

/**
 * Unassign user/team from obligation
 */
export async function unassignObligation(
  obligationId: number,
  assigneeType: string,
  assigneeId: number,
  organizationId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .delete(obligationAssignments)
    .where(and(
      eq(obligationAssignments.obligationId, obligationId),
      eq(obligationAssignments.assigneeType, assigneeType as any),
      eq(obligationAssignments.assigneeId, assigneeId),
      eq(obligationAssignments.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

// ============ OBLIGATION AUDIT LOG ============

/**
 * Log obligation action
 */
export async function logObligationAction(data: InsertObligationAuditLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(obligationAuditLog).values(data);
  return result.insertId;
}

/**
 * Get audit log for an obligation
 */
export async function getObligationAuditLog(
  obligationId: number,
  organizationId: number,
  limit: number = 50
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(obligationAuditLog)
    .where(and(
      eq(obligationAuditLog.obligationId, obligationId),
      eq(obligationAuditLog.organizationId, organizationId)
    ))
    .orderBy(desc(obligationAuditLog.createdAt))
    .limit(limit);
}

// ============ REMINDER POLICIES ============

/**
 * Create reminder policy
 */
export async function createReminderPolicy(data: InsertReminderPolicy): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(reminderPolicies).values(data);
  return result.insertId;
}

/**
 * Get reminder policy by ID
 */
export async function getReminderPolicyById(
  id: number,
  organizationId: number
): Promise<ReminderPolicy | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [policy] = await db
    .select()
    .from(reminderPolicies)
    .where(and(
      eq(reminderPolicies.id, id),
      eq(reminderPolicies.organizationId, organizationId)
    ))
    .limit(1);
  
  return policy ?? null;
}

/**
 * List reminder policies for an organization
 */
export async function listReminderPolicies(organizationId: number): Promise<ReminderPolicy[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(reminderPolicies)
    .where(eq(reminderPolicies.organizationId, organizationId))
    .orderBy(desc(reminderPolicies.isDefault), asc(reminderPolicies.name));
}

/**
 * Update reminder policy
 */
export async function updateReminderPolicy(
  id: number,
  organizationId: number,
  updates: Partial<InsertReminderPolicy>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(reminderPolicies)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(reminderPolicies.id, id),
      eq(reminderPolicies.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

/**
 * Get default reminder policy for an organization
 */
export async function getDefaultReminderPolicy(organizationId: number): Promise<ReminderPolicy | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [policy] = await db
    .select()
    .from(reminderPolicies)
    .where(and(
      eq(reminderPolicies.organizationId, organizationId),
      eq(reminderPolicies.isDefault, true),
      eq(reminderPolicies.isActive, true)
    ))
    .limit(1);
  
  return policy ?? null;
}

// ============ ESCALATION POLICIES ============

/**
 * Create escalation policy
 */
export async function createEscalationPolicy(data: InsertEscalationPolicy): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(escalationPolicies).values(data);
  return result.insertId;
}

/**
 * Get escalation policy by ID
 */
export async function getEscalationPolicyById(
  id: number,
  organizationId: number
): Promise<EscalationPolicy | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [policy] = await db
    .select()
    .from(escalationPolicies)
    .where(and(
      eq(escalationPolicies.id, id),
      eq(escalationPolicies.organizationId, organizationId)
    ))
    .limit(1);
  
  return policy ?? null;
}

/**
 * List escalation policies for an organization
 */
export async function listEscalationPolicies(organizationId: number): Promise<EscalationPolicy[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(escalationPolicies)
    .where(eq(escalationPolicies.organizationId, organizationId))
    .orderBy(desc(escalationPolicies.isDefault), asc(escalationPolicies.name));
}

/**
 * Update escalation policy
 */
export async function updateEscalationPolicy(
  id: number,
  organizationId: number,
  updates: Partial<InsertEscalationPolicy>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(escalationPolicies)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(escalationPolicies.id, id),
      eq(escalationPolicies.organizationId, organizationId)
    ));
  
  return result[0].affectedRows > 0;
}

// ============ NOTIFICATION EVENTS ============

/**
 * Create notification event
 */
export async function createNotificationEvent(data: InsertNotificationEvent): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(notificationEvents).values(data);
  return result.insertId;
}

/**
 * Update notification event status
 */
export async function updateNotificationEventStatus(
  id: number,
  status: string,
  error?: string
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const updates: any = { status };
  
  if (status === "sent") {
    updates.sentAt = new Date();
  } else if (status === "delivered") {
    updates.deliveredAt = new Date();
  } else if (status === "failed") {
    updates.failedAt = new Date();
    updates.failureReason = error;
  }
  
  const result = await db
    .update(notificationEvents)
    .set(updates)
    .where(eq(notificationEvents.id, id));
  
  return result[0].affectedRows > 0;
}

/**
 * Get notification events for a user
 */
export async function getNotificationEventsForUser(
  userId: number,
  organizationId: number,
  limit: number = 50
): Promise<NotificationEvent[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(notificationEvents)
    .where(and(
      eq(notificationEvents.recipientUserId, userId),
      eq(notificationEvents.organizationId, organizationId)
    ))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(limit);
}

// ============ EXTERNAL CALENDAR BINDINGS ============

/**
 * Create external calendar binding
 */
export async function createExternalCalendarBinding(data: InsertExternalCalendarBinding): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(externalCalendarBindings).values(data);
  return result.insertId;
}

/**
 * Get calendar binding for user and provider
 */
export async function getCalendarBindingByUserAndProvider(
  userId: number,
  provider: string,
  organizationId: number
): Promise<ExternalCalendarBinding | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [binding] = await db
    .select()
    .from(externalCalendarBindings)
    .where(and(
      eq(externalCalendarBindings.userId, userId),
      eq(externalCalendarBindings.provider, provider as any),
      eq(externalCalendarBindings.organizationId, organizationId)
    ))
    .limit(1);
  
  return binding ?? null;
}

/**
 * Get all calendar bindings for a user
 */
export async function getCalendarBindingsForUser(
  userId: number,
  organizationId: number
): Promise<ExternalCalendarBinding[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(externalCalendarBindings)
    .where(and(
      eq(externalCalendarBindings.userId, userId),
      eq(externalCalendarBindings.organizationId, organizationId)
    ));
}

/**
 * Update calendar binding
 */
export async function updateCalendarBinding(
  id: number,
  updates: Partial<InsertExternalCalendarBinding>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(externalCalendarBindings)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(externalCalendarBindings.id, id));
  
  return result[0].affectedRows > 0;
}

/**
 * Revoke calendar binding
 */
export async function revokeCalendarBinding(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(externalCalendarBindings)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(externalCalendarBindings.id, id));
  
  return result[0].affectedRows > 0;
}

// ============ EXTERNAL CALENDAR EVENTS ============

/**
 * Create or update external calendar event
 */
export async function upsertExternalCalendarEvent(data: InsertExternalCalendarEvent): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(externalCalendarEvents)
    .where(and(
      eq(externalCalendarEvents.obligationId, data.obligationId),
      eq(externalCalendarEvents.userId, data.userId),
      eq(externalCalendarEvents.provider, data.provider as any)
    ))
    .limit(1);
  
  if (existing) {
    await db
      .update(externalCalendarEvents)
      .set({
        externalEventId: data.externalEventId,
        syncStatus: data.syncStatus as any,
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(externalCalendarEvents.id, existing.id));
    return existing.id;
  }
  
  const [result] = await db.insert(externalCalendarEvents).values(data);
  return result.insertId;
}

/**
 * Get external calendar event
 */
export async function getExternalCalendarEvent(
  obligationId: number,
  userId: number,
  provider: string
): Promise<ExternalCalendarEvent | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [event] = await db
    .select()
    .from(externalCalendarEvents)
    .where(and(
      eq(externalCalendarEvents.obligationId, obligationId),
      eq(externalCalendarEvents.userId, userId),
      eq(externalCalendarEvents.provider, provider as any)
    ))
    .limit(1);
  
  return event ?? null;
}

/**
 * Get pending sync events for a user
 */
export async function getPendingSyncEvents(
  userId: number,
  organizationId: number
): Promise<ExternalCalendarEvent[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(externalCalendarEvents)
    .where(and(
      eq(externalCalendarEvents.userId, userId),
      eq(externalCalendarEvents.organizationId, organizationId),
      eq(externalCalendarEvents.syncStatus, "pending")
    ));
}

// ============ OBLIGATION VIEW OVERLAYS ============

/**
 * Add obligation to view overlay
 */
export async function addObligationToView(
  viewId: number,
  obligationId: number,
  organizationId: number
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if exists
  const [existing] = await db
    .select()
    .from(obligationViewOverlays)
    .where(and(
      eq(obligationViewOverlays.viewId, viewId),
      eq(obligationViewOverlays.obligationId, obligationId)
    ))
    .limit(1);
  
  if (existing) {
    // Re-enable if was removed
    if (!existing.isVisible) {
      await db
        .update(obligationViewOverlays)
        .set({ isVisible: true, removedAt: null, removedByUserId: null })
        .where(eq(obligationViewOverlays.id, existing.id));
    }
    return existing.id;
  }
  
  const [result] = await db.insert(obligationViewOverlays).values({
    viewId,
    obligationId,
    organizationId,
    isVisible: true
  });
  return result.insertId;
}

/**
 * Remove obligation from view overlay (soft delete)
 */
export async function removeObligationFromView(
  viewId: number,
  obligationId: number,
  removedByUserId: number
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(obligationViewOverlays)
    .set({
      isVisible: false,
      removedAt: new Date(),
      removedByUserId
    })
    .where(and(
      eq(obligationViewOverlays.viewId, viewId),
      eq(obligationViewOverlays.obligationId, obligationId)
    ));
  
  return result[0].affectedRows > 0;
}

/**
 * Get visible obligations for a view
 */
export async function getObligationsForView(
  viewId: number,
  organizationId: number
): Promise<Obligation[]> {
  const db = await getDb();
  if (!db) return [];
  
  const overlays = await db
    .select({ obligationId: obligationViewOverlays.obligationId })
    .from(obligationViewOverlays)
    .where(and(
      eq(obligationViewOverlays.viewId, viewId),
      eq(obligationViewOverlays.organizationId, organizationId),
      eq(obligationViewOverlays.isVisible, true)
    ));
  
  if (overlays.length === 0) return [];
  
  const obligationIds = overlays.map(o => o.obligationId);
  
  return await db
    .select()
    .from(obligations)
    .where(and(
      inArray(obligations.id, obligationIds),
      eq(obligations.organizationId, organizationId)
    ))
    .orderBy(asc(obligations.dueAt));
}

/**
 * Get all members of an organization with user details
 */
export async function getOrganizationMembers(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: organizationMembers.id,
    userId: organizationMembers.userId,
    userName: users.name,
    userEmail: users.email,
    role: organizationMembers.role,
    status: organizationMembers.status,
    createdAt: organizationMembers.createdAt,
    invitedBy: organizationMembers.invitedBy,
  })
    .from(organizationMembers)
    .leftJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));
}


/**
 * Create a password reset token
 */
export async function createPasswordResetToken(data: InsertPasswordResetToken): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(passwordResetTokens).values(data);
  return result[0].insertId;
}

/**
 * Get password reset token by token string
 */
export async function getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  
  return result || null;
}

/**
 * Mark password reset token as used
 */
export async function markPasswordResetTokenUsed(tokenId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenId));
}


// Get all requirements schema versions for a template
export async function getRequirementsSchemasByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(requirementsSchemas)
    .where(eq(requirementsSchemas.templateId, templateId))
    .orderBy(desc(requirementsSchemas.version));
}


// ============ PHASE 38: EMAIL TEMPLATES ============

/**
 * Create an email template
 */
export async function createEmailTemplate(data: InsertEmailTemplate): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(emailTemplates).values(data);
  return result.insertId;
}

/**
 * Get email template by ID
 */
export async function getEmailTemplateById(id: number): Promise<EmailTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, id))
    .limit(1);
  
  return result || null;
}

/**
 * Get email templates for an organization
 */
export async function getEmailTemplatesByOrg(organizationId: number): Promise<EmailTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(emailTemplates)
    .where(eq(emailTemplates.organizationId, organizationId))
    .orderBy(emailTemplates.templateType, emailTemplates.name);
}

/**
 * Get default email template by type for an organization
 */
export async function getDefaultEmailTemplate(
  organizationId: number, 
  templateType: string
): Promise<EmailTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(emailTemplates)
    .where(and(
      eq(emailTemplates.organizationId, organizationId),
      eq(emailTemplates.templateType, templateType as EmailTemplate["templateType"]),
      eq(emailTemplates.isDefault, true),
      eq(emailTemplates.isActive, true)
    ))
    .limit(1);
  
  return result || null;
}

/**
 * Update email template
 */
export async function updateEmailTemplate(
  id: number, 
  data: Partial<InsertEmailTemplate>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emailTemplates)
    .set(data)
    .where(eq(emailTemplates.id, id));
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(emailTemplates)
    .where(eq(emailTemplates.id, id));
}

// ============ PHASE 38: REQUEST REMINDERS ============

/**
 * Create a request reminder
 */
export async function createRequestReminder(data: InsertRequestReminder): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(requestReminders).values(data);
  return result.insertId;
}

/**
 * Get pending reminders that are due
 */
export async function getPendingReminders(beforeDate: Date): Promise<RequestReminder[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(requestReminders)
    .where(and(
      eq(requestReminders.status, "pending"),
      lte(requestReminders.scheduledFor, beforeDate)
    ))
    .orderBy(requestReminders.scheduledFor);
}

/**
 * Update reminder status
 */
export async function updateReminderStatus(
  id: number, 
  status: "sent" | "failed" | "cancelled",
  failureReason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Partial<RequestReminder> = { status };
  if (status === "sent") {
    updateData.sentAt = new Date();
  } else if (status === "failed") {
    updateData.failedAt = new Date();
    updateData.failureReason = failureReason;
  }
  
  await db.update(requestReminders)
    .set(updateData)
    .where(eq(requestReminders.id, id));
}

/**
 * Get reminders for a request
 */
export async function getRemindersForRequest(requestId: number): Promise<RequestReminder[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(requestReminders)
    .where(eq(requestReminders.requestId, requestId))
    .orderBy(desc(requestReminders.scheduledFor));
}

/**
 * Cancel pending reminders for a request
 */
export async function cancelPendingReminders(requestId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(requestReminders)
    .set({ status: "cancelled" })
    .where(and(
      eq(requestReminders.requestId, requestId),
      eq(requestReminders.status, "pending")
    ));
}

// ============ PHASE 38: REMINDER SETTINGS ============

/**
 * Get reminder settings for an organization
 */
export async function getReminderSettings(organizationId: number): Promise<ReminderSettings | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(reminderSettings)
    .where(eq(reminderSettings.organizationId, organizationId))
    .limit(1);
  
  return result || null;
}

/**
 * Upsert reminder settings
 */
export async function upsertReminderSettings(data: InsertReminderSettings): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(reminderSettings)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        remindersEnabled: data.remindersEnabled,
        firstReminderDays: data.firstReminderDays,
        secondReminderDays: data.secondReminderDays,
        overdueReminderEnabled: data.overdueReminderEnabled,
        customReminderDays: data.customReminderDays,
        updatedBy: data.updatedBy,
      }
    });
}

// ============ PHASE 38: ASSET IMPORT JOBS ============

/**
 * Create an asset import job
 */
export async function createAssetImportJob(data: InsertAssetImportJob): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(assetImportJobs).values(data);
  return result.insertId;
}

/**
 * Get asset import job by ID
 */
export async function getAssetImportJobById(id: number): Promise<AssetImportJob | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(assetImportJobs)
    .where(eq(assetImportJobs.id, id))
    .limit(1);
  
  return result || null;
}

/**
 * Get asset import jobs for an organization
 */
export async function getAssetImportJobsByOrg(organizationId: number): Promise<AssetImportJob[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(assetImportJobs)
    .where(eq(assetImportJobs.organizationId, organizationId))
    .orderBy(desc(assetImportJobs.createdAt));
}

/**
 * Update asset import job
 */
export async function updateAssetImportJob(
  id: number, 
  data: Partial<InsertAssetImportJob>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetImportJobs)
    .set(data)
    .where(eq(assetImportJobs.id, id));
}

/**
 * Update import job progress
 */
export async function updateImportJobProgress(
  id: number,
  processedRows: number,
  successRows: number,
  errorRows: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetImportJobs)
    .set({ processedRows, successRows, errorRows })
    .where(eq(assetImportJobs.id, id));
}

// ============ PHASE 38: ASSET IMPORT TEMPLATES ============

/**
 * Create an asset import template
 */
export async function createAssetImportTemplate(data: InsertAssetImportTemplate): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(assetImportTemplates).values(data);
  return result.insertId;
}

/**
 * Get asset import templates for an organization
 */
export async function getAssetImportTemplatesByOrg(organizationId: number): Promise<AssetImportTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(assetImportTemplates)
    .where(and(
      eq(assetImportTemplates.organizationId, organizationId),
      eq(assetImportTemplates.isActive, true)
    ))
    .orderBy(assetImportTemplates.name);
}

/**
 * Get asset import template by ID
 */
export async function getAssetImportTemplateById(id: number): Promise<AssetImportTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(assetImportTemplates)
    .where(eq(assetImportTemplates.id, id))
    .limit(1);
  
  return result || null;
}

/**
 * Update asset import template
 */
export async function updateAssetImportTemplate(
  id: number, 
  data: Partial<InsertAssetImportTemplate>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(assetImportTemplates)
    .set(data)
    .where(eq(assetImportTemplates.id, id));
}


// ============================================================================
// Phase 39: Multi-Provider OAuth Functions
// ============================================================================

/**
 * Create OAuth account link
 */
export async function createOAuthAccount(data: InsertOAuthAccount): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db.insert(oauthAccounts).values(data);
  return result.insertId;
}

/**
 * Get OAuth accounts for a user
 */
export async function getOAuthAccountsByUser(userId: number): Promise<OAuthAccount[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(oauthAccounts)
    .where(and(
      eq(oauthAccounts.userId, userId),
      eq(oauthAccounts.isActive, true)
    ));
}

/**
 * Get OAuth account by provider and provider account ID
 */
export async function getOAuthAccountByProvider(
  provider: "manus" | "google" | "github" | "microsoft" | "email",
  providerAccountId: string
): Promise<OAuthAccount | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(oauthAccounts)
    .where(and(
      eq(oauthAccounts.oauthProvider, provider),
      eq(oauthAccounts.providerAccountId, providerAccountId),
      eq(oauthAccounts.isActive, true)
    ))
    .limit(1);
  
  return result || null;
}

/**
 * Update OAuth account tokens
 */
export async function updateOAuthAccountTokens(
  id: number,
  accessToken: string,
  refreshToken?: string,
  tokenExpiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(oauthAccounts)
    .set({
      accessToken,
      refreshToken,
      tokenExpiresAt,
      lastUsedAt: new Date()
    })
    .where(eq(oauthAccounts.id, id));
}

/**
 * Deactivate OAuth account
 */
export async function deactivateOAuthAccount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(oauthAccounts)
    .set({ isActive: false })
    .where(eq(oauthAccounts.id, id));
}

/**
 * Get OAuth provider config
 */
export async function getOAuthProviderConfig(
  provider: "manus" | "google" | "github" | "microsoft" | "email",
  organizationId?: number
): Promise<OAuthProviderConfig | null> {
  const db = await getDb();
  if (!db) return null;
  
  // First try org-specific config, then fall back to global
  if (organizationId) {
    const [orgConfig] = await db.select()
      .from(oauthProviderConfigs)
      .where(and(
        eq(oauthProviderConfigs.oauthProvider, provider),
        eq(oauthProviderConfigs.organizationId, organizationId),
        eq(oauthProviderConfigs.isEnabled, true)
      ))
      .limit(1);
    
    if (orgConfig) return orgConfig;
  }
  
  // Fall back to global config
  const [globalConfig] = await db.select()
    .from(oauthProviderConfigs)
    .where(and(
      eq(oauthProviderConfigs.oauthProvider, provider),
      sql`${oauthProviderConfigs.organizationId} IS NULL`,
      eq(oauthProviderConfigs.isEnabled, true)
    ))
    .limit(1);
  
  return globalConfig || null;
}

/**
 * Create or update OAuth provider config
 */
export async function upsertOAuthProviderConfig(data: InsertOAuthProviderConfig): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Check if config exists
  const existing = await getOAuthProviderConfig(data.oauthProvider, data.organizationId ?? undefined);
  
  if (existing) {
    await db.update(oauthProviderConfigs)
      .set(data)
      .where(eq(oauthProviderConfigs.id, existing.id));
    return existing.id;
  }
  
  const [result] = await db.insert(oauthProviderConfigs).values(data);
  return result.insertId;
}

/**
 * Get all enabled OAuth providers for an organization
 */
export async function getEnabledOAuthProviders(organizationId?: number): Promise<OAuthProviderConfig[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get global configs
  const globalConfigs = await db.select()
    .from(oauthProviderConfigs)
    .where(and(
      sql`${oauthProviderConfigs.organizationId} IS NULL`,
      eq(oauthProviderConfigs.isEnabled, true)
    ));
  
  if (!organizationId) return globalConfigs;
  
  // Get org-specific configs
  const orgConfigs = await db.select()
    .from(oauthProviderConfigs)
    .where(and(
      eq(oauthProviderConfigs.organizationId, organizationId),
      eq(oauthProviderConfigs.isEnabled, true)
    ));
  
  // Merge: org configs override global
  const configMap = new Map<string, OAuthProviderConfig>();
  for (const config of globalConfigs) {
    configMap.set(config.provider, config);
  }
  for (const config of orgConfigs) {
    configMap.set(config.provider, config);
  }
  
  return Array.from(configMap.values());
}

/**
 * Create email verification token
 */
export async function createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<string> {
  const db = await getDb();
  if (!db) return "";
  
  await db.insert(emailVerificationTokens).values(data);
  return data.token;
}

/**
 * Get email verification token
 */
export async function getEmailVerificationToken(token: string): Promise<EmailVerificationToken | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(emailVerificationTokens)
    .where(and(
      eq(emailVerificationTokens.token, token),
      sql`${emailVerificationTokens.usedAt} IS NULL`,
      sql`${emailVerificationTokens.expiresAt} > NOW()`
    ))
    .limit(1);
  
  return result || null;
}

/**
 * Mark email verification token as used
 */
export async function markEmailVerificationTokenUsed(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokens.token, token));
}

/**
 * Get user by email (for email/password auth)
 */
export async function getUserByEmailForAuth(email: string): Promise<(typeof users.$inferSelect) | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return result || null;
}

/**
 * Update user password hash
 */
export async function updateUserPasswordHash(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
}

/**
 * Mark user email as verified
 */
export async function markUserEmailVerified(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users)
    .set({ 
      emailVerified: true,
      emailVerifiedAt: new Date()
    })
    .where(eq(users.id, userId));
}

/**
 * Create user with email/password
 */
export async function createUserWithEmail(data: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Generate a unique openId for email users
  const openId = `email_${crypto.randomUUID()}`;
  
  const [result] = await db.insert(users).values({
    openId,
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name || null,
    loginMethod: "email",
    emailVerified: false
  });
  
  return result.insertId;
}

/**
 * Link OAuth account to existing user
 */
export async function linkOAuthAccountToUser(
  userId: number,
  provider: "manus" | "google" | "github" | "microsoft" | "email",
  providerAccountId: string,
  providerData: {
    email?: string;
    name?: string;
    avatarUrl?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
  }
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  // Check if this provider account is already linked to another user
  const existing = await getOAuthAccountByProvider(provider, providerAccountId);
  if (existing && existing.userId !== userId) {
    throw new Error("This account is already linked to another user");
  }
  
  if (existing) {
    // Update existing link
    await updateOAuthAccountTokens(
      existing.id,
      providerData.accessToken || "",
      providerData.refreshToken,
      providerData.tokenExpiresAt
    );
    return existing.id;
  }
  
  // Create new link
  return await createOAuthAccount({
    userId,
    oauthProvider: provider,
    providerAccountId,
    providerEmail: providerData.email,
    providerName: providerData.name,
    providerAvatarUrl: providerData.avatarUrl,
    accessToken: providerData.accessToken,
    refreshToken: providerData.refreshToken,
    tokenExpiresAt: providerData.tokenExpiresAt,
    isActive: true
  });
}


// ============ LOGIN ACTIVITY ============
export async function createLoginActivity(data: {
  userId?: number | null;
  provider: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  failureReason?: string | null;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(loginActivity).values({
    userId: data.userId || null,
    provider: data.provider,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    success: data.success,
    failureReason: data.failureReason || null
  });
  
  return Number(result[0].insertId);
}

export async function getLoginActivityByUserId(userId: number, limit: number = 20): Promise<LoginActivity[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(loginActivity)
    .where(eq(loginActivity.userId, userId))
    .orderBy(desc(loginActivity.createdAt))
    .limit(limit);
}

export async function deleteOAuthAccount(userId: number, provider: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(oauthAccounts)
    .where(and(
      eq(oauthAccounts.userId, userId),
      eq(oauthAccounts.oauthProvider, provider)
    ));
}

/**
 * Create user via OAuth (no password required)
 */
export async function createUserWithOAuth(data: {
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "google" | "github" | "microsoft" | "manus";
}): Promise<{ id: number; openId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate a unique openId for OAuth users
  const openId = `oauth_${data.provider}_${crypto.randomUUID()}`;
  
  const [result] = await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    avatarUrl: data.avatarUrl || null,
    loginMethod: data.provider,
    emailVerified: true // OAuth emails are verified
  });
  
  return { id: Number(result.insertId), openId };
}


/**
 * Get all OAuth provider configurations (for admin UI)
 */
export async function getOAuthProviderConfigs(): Promise<OAuthProviderConfig[]> {
  const db = await getDb();
  if (!db) return [];
  
  const configs = await db.select()
    .from(oauthProviderConfigs)
    .where(sql`${oauthProviderConfigs.organizationId} IS NULL`)
    .orderBy(oauthProviderConfigs.oauthProvider);
  
  return configs;
}

/**
 * Toggle OAuth provider enabled status
 */
export async function toggleOAuthProvider(provider: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(oauthProviderConfigs)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(and(
      eq(oauthProviderConfigs.oauthProvider, provider),
      sql`${oauthProviderConfigs.organizationId} IS NULL`
    ));
}

/**
 * Update OAuth provider test result
 */
export async function updateOAuthProviderTestResult(provider: string, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(oauthProviderConfigs)
    .set({ 
      lastTestSuccess: success, 
      lastTestAt: new Date(),
      updatedAt: new Date() 
    })
    .where(and(
      eq(oauthProviderConfigs.oauthProvider, provider),
      sql`${oauthProviderConfigs.organizationId} IS NULL`
    ));
}


/**
 * Get recent login activity for a user
 */
export async function getRecentLoginActivity(userId: number, limit: number = 10): Promise<LoginActivity[]> {
  const db = await getDb();
  if (!db) return [];
  
  const results = await db.select()
    .from(loginActivity)
    .where(eq(loginActivity.userId, userId))
    .orderBy(sql`${loginActivity.createdAt} DESC`)
    .limit(limit);
  
  return results;
}

/**
 * Check if login is from a new IP address for the user
 */
export async function isNewIpAddress(userId: number, ipAddress: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  
  const [existing] = await db.select()
    .from(loginActivity)
    .where(and(
      eq(loginActivity.userId, userId),
      eq(loginActivity.ipAddress, ipAddress),
      eq(loginActivity.success, true)
    ))
    .limit(1);
  
  return !existing;
}

/**
 * Check if login is from a new user agent for the user
 */
export async function isNewUserAgent(userId: number, userAgent: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  
  // Extract browser/OS signature from user agent for comparison
  const [existing] = await db.select()
    .from(loginActivity)
    .where(and(
      eq(loginActivity.userId, userId),
      eq(loginActivity.userAgent, userAgent),
      eq(loginActivity.success, true)
    ))
    .limit(1);
  
  return !existing;
}

/**
 * Get failed login attempts for a user in the last N hours
 */
export async function getRecentFailedLoginAttempts(userId: number, hours: number = 24): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(loginActivity)
    .where(and(
      eq(loginActivity.userId, userId),
      eq(loginActivity.success, false),
      sql`${loginActivity.createdAt} > ${cutoff}`
    ));
  
  return result?.count || 0;
}

/**
 * Get failed login attempts from an IP address in the last N hours
 */
export async function getRecentFailedAttemptsFromIp(ipAddress: string, hours: number = 1): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const [result] = await db.select({ count: sql<number>`count(*)` })
    .from(loginActivity)
    .where(and(
      eq(loginActivity.ipAddress, ipAddress),
      eq(loginActivity.success, false),
      sql`${loginActivity.createdAt} > ${cutoff}`
    ));
  
  return result?.count || 0;
}


/**
 * Update OAuth account info (name, email, avatar from provider)
 */
export async function updateOAuthAccountInfo(accountId: number, data: {
  providerName?: string;
  providerEmail?: string;
  providerAvatarUrl?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Record<string, unknown> = {};
  if (data.providerName !== undefined) updateData.providerName = data.providerName;
  if (data.providerEmail !== undefined) updateData.providerEmail = data.providerEmail;
  if (data.providerAvatarUrl !== undefined) updateData.providerAvatarUrl = data.providerAvatarUrl;
  
  if (Object.keys(updateData).length === 0) return;
  
  await db.update(oauthAccounts)
    .set(updateData)
    .where(eq(oauthAccounts.id, accountId));
}


// ============ AUTO-FILING HELPERS ============

export async function linkIngestedFileToProject(fileId: number, projectId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(ingestedFiles)
    .set({ 
      primaryProjectId: projectId,
      processingStatus: 'processed'
    })
    .where(eq(ingestedFiles.id, fileId));
}

export async function linkIngestedFileToAsset(fileId: number, assetId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(ingestedFiles)
    .set({ 
      primaryAssetId: assetId,
      processingStatus: 'processed'
    })
    .where(eq(ingestedFiles.id, fileId));
}

export async function getProjectsByOrganization(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(projects)
    .where(eq(projects.organizationId, orgId))
    .orderBy(desc(projects.updatedAt))
    .limit(100);
}

export async function getSitesByOrganization(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(sites)
    .where(eq(sites.organizationId, orgId))
    .orderBy(desc(sites.updatedAt))
    .limit(100);
}

export async function getAssetsByOrganization(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(assets)
    .where(eq(assets.organizationId, orgId))
    .orderBy(desc(assets.updatedAt))
    .limit(200);
}


// ============ RFI TO TRACKER HELPERS ============

export async function getRfiChecklistItems(rfiId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get checklist items linked to this RFI
  const links = await db.select()
    .from(rfiChecklistLinks)
    .where(eq(rfiChecklistLinks.rfiId, rfiId));
  
  if (links.length === 0) return [];
  
  const itemIds = links.map(l => l.checklistItemId);
  return db.select()
    .from(closingChecklistItems)
    .where(inArray(closingChecklistItems.id, itemIds));
}

export async function createRfiChecklistLink(data: {
  rfiId: number;
  checklistItemId: number;
  rfiQuestionId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return db.insert(rfiChecklistLinks).values({
    rfiId: data.rfiId,
    checklistItemId: data.checklistItemId,
  });
}

export async function getRfiChecklistLinks(rfiId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(rfiChecklistLinks)
    .where(eq(rfiChecklistLinks.rfiId, rfiId));
}

export async function getClosingChecklistItem(itemId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(closingChecklistItems)
    .where(eq(closingChecklistItems.id, itemId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateRfiProgress(rfiId: number, progress: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(rfis)
    .set({ 
      progress,
      updatedAt: new Date()
    })
    .where(eq(rfis.id, rfiId));
}

export async function getAssetsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(assets.name);
}


// ============ STRIPE INTEGRATION HELPERS ============

export async function getCustomerById(customerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateCustomerStripeId(customerId: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(customers)
    .set({ 
      stripeCustomerId,
      updatedAt: new Date()
    })
    .where(eq(customers.id, customerId));
}

export async function getInvoiceById(invoiceId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getInvoiceLineItems(invoiceId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(invoiceLineItems.lineNumber);
}

export async function recordInvoicePayment(data: {
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  stripePaymentIntentId?: string | null;
  stripeSessionId?: string;
  status: string;
  paidAt: Date;
  paidBy?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return db.insert(payments).values({
    invoiceId: data.invoiceId,
    amount: data.amount.toString(),
    paymentMethod: data.paymentMethod,
    stripePaymentIntentId: data.stripePaymentIntentId || null,
    status: data.status as any,
    paymentDate: data.paidAt,
    recordedBy: data.paidBy || null,
  });
}

export async function updateInvoicePaymentStatus(invoiceId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get invoice and all payments
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return null;
  
  const invoicePayments = await db.select()
    .from(payments)
    .where(and(
      eq(payments.invoiceId, invoiceId),
      eq(payments.status, 'completed')
    ));
  
  const totalPaid = invoicePayments.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
  const totalDue = parseFloat(invoice.totalAmount || '0');
  
  let status: 'paid' | 'partial' | 'pending' | 'overdue' = 'pending';
  if (totalPaid >= totalDue) {
    status = 'paid';
  } else if (totalPaid > 0) {
    status = 'partial';
  } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
    status = 'overdue';
  }
  
  return db.update(invoices)
    .set({ 
      status,
      paidAmount: totalPaid.toString(),
      updatedAt: new Date()
    })
    .where(eq(invoices.id, invoiceId));
}

export async function updatePaymentByStripeId(stripePaymentIntentId: string, data: {
  status?: string;
  paidAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(payments)
    .set({ 
      status: data.status as any,
      paymentDate: data.paidAt,
    })
    .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId));
}

export async function getCustomerInvoices(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(invoices)
    .where(eq(invoices.customerId, customerId))
    .orderBy(desc(invoices.createdAt));
}

export async function getCustomerPayments(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all invoices for this customer
  const customerInvoices = await getCustomerInvoices(customerId);
  if (customerInvoices.length === 0) return [];
  
  const invoiceIds = customerInvoices.map(i => i.id);
  
  return db.select()
    .from(payments)
    .where(inArray(payments.invoiceId, invoiceIds))
    .orderBy(desc(payments.paymentDate));
}

export async function getCustomerProjects(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get customer-project links
  const links = await db.select()
    .from(customerProjects)
    .where(eq(customerProjects.customerId, customerId));
  
  if (links.length === 0) return [];
  
  const projectIds = links.map(l => l.projectId);
  
  return db.select()
    .from(projects)
    .where(inArray(projects.id, projectIds))
    .orderBy(desc(projects.createdAt));
}


// ============ CUSTOMER USER HELPERS ============

export async function getCustomerUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(customerUsers)
    .where(eq(customerUsers.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function getCustomerUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(customerUsers)
    .where(eq(customerUsers.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateCustomerUserLastLogin(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(customerUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(customerUsers.id, userId));
}

export async function setCustomerUserResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return null;
  
  return db.update(customerUsers)
    .set({ 
      passwordResetToken: token,
      passwordResetExpires: expiresAt
    })
    .where(eq(customerUsers.id, userId));
}

export async function getCustomerSharedDocuments(customerId: number, projectIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  
  if (projectIds.length === 0) return [];
  
  // Get documents for these projects that are marked as customer-visible
  return db.select()
    .from(documents)
    .where(and(
      inArray(documents.projectId, projectIds),
      // Add customer visibility filter if such field exists
    ))
    .orderBy(desc(documents.createdAt))
    .limit(100);
}


// ============================================
// Financial Models Functions
// ============================================

export async function createFinancialModel(data: {
  projectId: number;
  name: string;
  scenarioType: string;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  uploadedBy: number;
  status: string;
  version: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(schema.financialModels).values({
    projectId: data.projectId,
    name: data.name,
    scenarioName: data.scenarioType,
    fileUrl: data.fileUrl,
    fileKey: data.fileKey,
    fileName: data.fileName,
    mimeType: data.mimeType,
    uploadedById: data.uploadedBy,
    status: data.status as 'draft' | 'review' | 'approved' | 'superseded' | 'archived',
    version: data.version,
    extractionStatus: 'pending',
  });
  
  return { id: Number(result[0].insertId), ...data };
}

export async function getFinancialModelById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(schema.financialModels)
    .where(eq(schema.financialModels.id, id))
    .limit(1);
  
  return results[0] || null;
}

export async function getFinancialModels(filters?: {
  projectId?: number;
  projectIds?: number[];
  status?: string;
  scenarioType?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (filters?.projectId) {
    conditions.push(eq(schema.financialModels.projectId, filters.projectId));
  }
  if (filters?.projectIds && filters.projectIds.length > 0) {
    conditions.push(inArray(schema.financialModels.projectId, filters.projectIds));
  }
  if (filters?.status) {
    conditions.push(eq(schema.financialModels.status, filters.status));
  }
  if (filters?.scenarioType) {
    conditions.push(eq(schema.financialModels.scenarioName, filters.scenarioType));
  }
  
  return db.select()
    .from(schema.financialModels)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.financialModels.updatedAt));
}

export async function updateFinancialModel(id: number, data: Partial<{
  name: string;
  status: 'draft' | 'review' | 'approved' | 'superseded' | 'archived';
  scenarioName: string;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
}>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(schema.financialModels)
    .set(data)
    .where(eq(schema.financialModels.id, id));
}

export async function getFinancialModelVersions(modelId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get the model to find its parent or siblings
  const model = await getFinancialModelById(modelId);
  if (!model) return [];
  
  // Return all versions of this model (same name, different versions)
  return db.select()
    .from(schema.financialModels)
    .where(and(
      eq(schema.financialModels.projectId, model.projectId),
      eq(schema.financialModels.name, model.name)
    ))
    .orderBy(desc(schema.financialModels.version));
}

export async function saveFinancialModelMetrics(modelId: number, metrics: {
  npv?: number;
  irr?: number;
  paybackPeriod?: number;
  moic?: number;
  totalCapex?: number;
  debt?: number;
  equity?: number;
  leverage?: number;
  avgDscr?: number;
  minDscr?: number;
  avgEbitda?: number;
  annualProduction?: number;
  capacityFactor?: number;
  ppaRate?: number;
  escalation?: number;
  projectLife?: number;
  totalRevenue?: number;
  codDate?: Date;
  confidence: number;
  extractionNotes?: string[];
}) {
  const db = await getDb();
  if (!db) return;
  
  await db.insert(schema.financialModelMetrics).values({
    financialModelId: modelId,
    npv: metrics.npv?.toString(),
    irr: metrics.irr?.toString(),
    paybackYears: metrics.paybackPeriod?.toString(),
    moic: metrics.moic?.toString(),
    totalCapex: metrics.totalCapex?.toString(),
    debtAmount: metrics.debt?.toString(),
    equityAmount: metrics.equity?.toString(),
    leverageRatio: metrics.leverage?.toString(),
    avgDscr: metrics.avgDscr?.toString(),
    minDscr: metrics.minDscr?.toString(),
    avgEbitda: metrics.avgEbitda?.toString(),
    annualProductionMwh: metrics.annualProduction?.toString(),
    capacityFactor: metrics.capacityFactor?.toString(),
    ppaRate: metrics.ppaRate?.toString(),
    escalationRate: metrics.escalation?.toString(),
    projectLifeYears: metrics.projectLife,
    totalRevenue: metrics.totalRevenue?.toString(),
    codDate: metrics.codDate,
    extractionConfidence: metrics.confidence?.toString(),
    extractionNotes: metrics.extractionNotes?.join('\n'),
  });
}

export async function getFinancialModelMetrics(modelId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(schema.financialModelMetrics)
    .where(eq(schema.financialModelMetrics.financialModelId, modelId))
    .orderBy(desc(schema.financialModelMetrics.createdAt))
    .limit(1);
  
  return results[0] || null;
}

export async function deleteFinancialModelMetrics(modelId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(schema.financialModelMetrics)
    .where(eq(schema.financialModelMetrics.financialModelId, modelId));
}

export async function saveFinancialModelCashFlows(modelId: number, cashFlows: Array<{
  year: number;
  revenue: number;
  opex: number;
  ebitda: number;
  debtService: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
  dscr?: number;
}>) {
  const db = await getDb();
  if (!db) return;
  
  for (const cf of cashFlows) {
    await db.insert(schema.financialModelCashFlows).values({
      financialModelId: modelId,
      year: cf.year,
      revenue: cf.revenue?.toString(),
      opex: cf.opex?.toString(),
      ebitda: cf.ebitda?.toString(),
      debtService: cf.debtService?.toString(),
      freeCashFlow: cf.netCashFlow?.toString(),
      dscr: cf.dscr?.toString(),
    });
  }
}

export async function getFinancialModelCashFlows(modelId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(schema.financialModelCashFlows)
    .where(eq(schema.financialModelCashFlows.financialModelId, modelId))
    .orderBy(schema.financialModelCashFlows.year);
}

export async function getFinancialModelCashFlowCount(modelId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const results = await db.select({ count: sql<number>`count(*)` })
    .from(schema.financialModelCashFlows)
    .where(eq(schema.financialModelCashFlows.financialModelId, modelId));
  
  return results[0]?.count || 0;
}

export async function deleteFinancialModelCashFlows(modelId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(schema.financialModelCashFlows)
    .where(eq(schema.financialModelCashFlows.financialModelId, modelId));
}

export async function createFinancialModelComparison(data: {
  modelId: number;
  projectId: number;
  periodStart: Date;
  periodEnd: Date;
  projectedRevenue: number;
  actualRevenue: number;
  projectedProduction?: number;
  actualProduction?: number;
  projectedOpex?: number;
  actualOpex?: number;
  notes?: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(schema.financialModelComparisons).values({
    financialModelId: data.modelId,
    projectId: data.projectId,
    comparisonDate: new Date(),
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    projectedRevenue: data.projectedRevenue?.toString(),
    actualRevenue: data.actualRevenue?.toString(),
    projectedProduction: data.projectedProduction?.toString(),
    actualProduction: data.actualProduction?.toString(),
    projectedOpex: data.projectedOpex?.toString(),
    actualOpex: data.actualOpex?.toString(),
    varianceNotes: data.notes,
    createdBy: data.createdBy,
  });
  
  return { id: Number(result[0].insertId), ...data };
}

export async function getFinancialModelComparisons(modelId: number, filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(schema.financialModelComparisons.financialModelId, modelId)];
  
  if (filters?.startDate) {
    conditions.push(gte(schema.financialModelComparisons.periodStart, new Date(filters.startDate)));
  }
  if (filters?.endDate) {
    conditions.push(lte(schema.financialModelComparisons.periodEnd, new Date(filters.endDate)));
  }
  
  return db.select()
    .from(schema.financialModelComparisons)
    .where(and(...conditions))
    .orderBy(schema.financialModelComparisons.periodStart);
}



// ============================================
// Document Categories Functions
// ============================================

export async function createDocumentCategory(data: {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  organizationId?: number;
  isSystem?: boolean;
  parentCategoryId?: number;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(schema.documentCategories).values({
    name: data.name,
    code: data.code,
    description: data.description,
    icon: data.icon,
    color: data.color,
    organizationId: data.organizationId,
    isSystem: data.isSystem ?? false,
    parentCategoryId: data.parentCategoryId,
  });
  
  return { id: Number(result[0].insertId), ...data };
}

export async function getDocumentCategoryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select()
    .from(schema.documentCategories)
    .where(eq(schema.documentCategories.id, id))
    .limit(1);
  
  return results[0] || null;
}

export async function getDocumentCategories(filters?: {
  organizationId?: number;
  includeSystem?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: SQL[] = [];
  
  if (filters?.organizationId) {
    conditions.push(
      or(
        eq(schema.documentCategories.organizationId, filters.organizationId),
        eq(schema.documentCategories.isSystem, true)
      )!
    );
  }
  
  if (filters?.includeSystem === false) {
    conditions.push(eq(schema.documentCategories.isSystem, false));
  }
  
  return db.select()
    .from(schema.documentCategories)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(schema.documentCategories.name);
}

export async function updateDocumentCategory(id: number, data: Partial<{
  name: string;
  description: string;
  icon: string;
  color: string;
}>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(schema.documentCategories)
    .set(data)
    .where(eq(schema.documentCategories.id, id));
}

export async function deleteDocumentCategory(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(schema.documentCategories)
    .where(eq(schema.documentCategories.id, id));
}

export async function categoryHasDocuments(categoryId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Check if any document types in this category have documents
  const types = await db.select({ id: schema.documentTypes.id })
    .from(schema.documentTypes)
    .where(eq(schema.documentTypes.categoryId, categoryId));
  
  if (types.length === 0) return false;
  
  const typeIds = types.map(t => t.id);
  const docs = await db.select({ count: sql`count(*)` })
    .from(schema.documents)
    .where(inArray(schema.documents.typeId, typeIds));
  
  return (docs[0]?.count || 0) > 0;
}


// ============ ORGANIZATION MEMBER MANAGEMENT ============

/**
 * Update organization member role
 */
export async function updateOrganizationMemberRole(
  membershipId: number,
  newRole: "admin" | "editor" | "reviewer" | "investor_viewer"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(organizationMembers)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(organizationMembers.id, membershipId));
}

/**
 * Remove organization member
 */
export async function removeOrganizationMember(membershipId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(organizationMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(eq(organizationMembers.id, membershipId));
}

/**
 * Get organization member by ID
 */
export async function getOrganizationMemberById(membershipId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.select()
    .from(organizationMembers)
    .where(eq(organizationMembers.id, membershipId))
    .limit(1);
  
  return result || null;
}


// ============ ORGANIZATION MANAGEMENT (SUPERUSER) ============

/**
 * Get all organizations
 */
export async function getAllOrganizations() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select()
    .from(organizations)
    .orderBy(asc(organizations.name));
}

/**
 * Get organization by code
 */
export async function getOrganizationByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [org] = await db.select()
    .from(organizations)
    .where(eq(organizations.code, code))
    .limit(1);
  
  return org || null;
}

/**
 * Create new organization
 */
export async function createOrganization(data: {
  name: string;
  code: string;
  slug: string;
  description?: string;
  signupMode: "invite_only" | "domain_allowlist" | "open";
  allowedEmailDomains?: string[];
  require2FA: boolean;
  status: "active" | "suspended" | "archived";
  createdBy: number;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(organizations).values({
    name: data.name,
    code: data.code,
    slug: data.slug,
    description: data.description,
    signupMode: data.signupMode,
    allowedEmailDomains: data.allowedEmailDomains ? JSON.stringify(data.allowedEmailDomains) : null,
    require2FA: data.require2FA,
    status: data.status,
    createdBy: data.createdBy,
    createdAt: new Date(),
  });
  
  return result?.insertId || null;
}

/**
 * Update organization status
 */
export async function updateOrganizationStatus(
  organizationId: number,
  status: "active" | "suspended" | "archived"
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(organizations)
    .set({ status, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));
}

/**
 * Get all users with optional filters (for superuser admin)
 */
export async function getAllUsersFiltered(filters: {
  organizationId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  // If filtering by organization, join with memberships
  if (filters.organizationId) {
    const results = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      membershipRole: organizationMembers.role,
      membershipStatus: organizationMembers.status,
    })
      .from(users)
      .innerJoin(organizationMembers, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, filters.organizationId),
          filters.search 
            ? or(
                like(users.name, `%${filters.search}%`),
                like(users.email, `%${filters.search}%`)
              )
            : undefined
        )
      )
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);
    
    return results;
  }
  
  // Otherwise, get all users
  const conditions: SQL[] = [];
  if (filters.search) {
    conditions.push(
      or(
        like(users.name, `%${filters.search}%`),
        like(users.email, `%${filters.search}%`)
      )!
    );
  }
  
  return db.select()
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(filters.limit || 100)
    .offset(filters.offset || 0);
}

/**
 * Create organization membership
 */
export async function createOrganizationMembership(data: {
  userId: number;
  organizationId: number;
  role: "admin" | "editor" | "reviewer" | "investor_viewer";
  status: "active" | "pending" | "suspended" | "removed";
  invitedBy: number;
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(organizationMembers).values({
    userId: data.userId,
    organizationId: data.organizationId,
    role: data.role,
    status: data.status,
    invitedBy: data.invitedBy,
    createdAt: new Date(),
  });
  
  return result?.insertId || null;
}


// ============ CUSTOM VIEW BUILDER & COLLABORATIVE SHARING ============

/**
 * Create a custom user view with data sources and columns
 */
export async function createCustomView(data: {
  organizationId: number;
  createdById: number;
  name: string;
  description?: string;
  viewType: 'personal' | 'project' | 'team' | 'organization';
  scopeId?: number; // projectId, teamId, or null for personal/org
  dataSources: Array<{
    sourceType: string;
    sourceId?: number;
    filters?: Record<string, unknown>;
  }>;
  columns: Array<{
    key: string;
    label: string;
    sourceType: string;
    fieldPath: string;
    width?: number;
    sortable?: boolean;
    filterable?: boolean;
  }>;
  layout?: Record<string, unknown>;
  refreshInterval?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(viewScopes).values({
    organizationId: data.organizationId,
    name: data.name,
    description: data.description,
    scope: data.viewType,
    config: {
      dataSources: data.dataSources,
      columns: data.columns,
      layout: data.layout,
      refreshInterval: data.refreshInterval,
    },
    createdById: data.createdById,
    isActive: true,
  });
  
  return result?.insertId || null;
}

/**
 * Get user's custom views (personal + shared with them)
 */
export async function getUserCustomViews(userId: number, organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get views created by user
  const ownViews = await db.select()
    .from(viewScopes)
    .where(and(
      eq(viewScopes.organizationId, organizationId),
      eq(viewScopes.createdById, userId),
      eq(viewScopes.isActive, true)
    ));
  
  // Get views shared with user
  const sharedWithUser = await db.select({
    view: viewScopes,
    share: viewShares,
  })
    .from(viewShares)
    .innerJoin(viewScopes, eq(viewShares.viewId, viewScopes.id))
    .where(and(
      eq(viewShares.sharedWithType, 'user'),
      eq(viewShares.sharedWithId, userId),
      eq(viewShares.isActive, true),
      eq(viewScopes.isActive, true)
    ));
  
  // Get org-wide views
  const orgViews = await db.select()
    .from(viewScopes)
    .where(and(
      eq(viewScopes.organizationId, organizationId),
      eq(viewScopes.scope, 'organization'),
      eq(viewScopes.isActive, true)
    ));
  
  // Combine and dedupe
  const allViews = [...ownViews];
  for (const sv of sharedWithUser) {
    if (!allViews.find(v => v.id === sv.view.id)) {
      allViews.push(sv.view);
    }
  }
  for (const ov of orgViews) {
    if (!allViews.find(v => v.id === ov.id)) {
      allViews.push(ov);
    }
  }
  
  return allViews;
}

/**
 * Update custom view configuration
 */
export async function updateCustomView(viewId: number, userId: number, updates: {
  name?: string;
  description?: string;
  dataSources?: Array<{
    sourceType: string;
    sourceId?: number;
    filters?: Record<string, unknown>;
  }>;
  columns?: Array<{
    key: string;
    label: string;
    sourceType: string;
    fieldPath: string;
    width?: number;
    sortable?: boolean;
    filterable?: boolean;
  }>;
  layout?: Record<string, unknown>;
  refreshInterval?: number;
}) {
  const db = await getDb();
  if (!db) return false;
  
  // Get current view
  const [view] = await db.select().from(viewScopes).where(eq(viewScopes.id, viewId));
  if (!view) return false;
  
  // Check ownership
  if (view.createdById !== userId) return false;
  
  const currentConfig = (view.config || {}) as Record<string, unknown>;
  const newConfig = { ...currentConfig };
  
  if (updates.dataSources) newConfig.dataSources = updates.dataSources;
  if (updates.columns) newConfig.columns = updates.columns;
  if (updates.layout) newConfig.layout = updates.layout;
  if (updates.refreshInterval !== undefined) newConfig.refreshInterval = updates.refreshInterval;
  
  await db.update(viewScopes)
    .set({
      name: updates.name || view.name,
      description: updates.description !== undefined ? updates.description : view.description,
      config: newConfig,
      updatedAt: new Date(),
    })
    .where(eq(viewScopes.id, viewId));
  
  return true;
}

/**
 * Share view externally with frozen snapshot option
 */
export async function createExternalViewShare(data: {
  viewId: number;
  sharedByUserId: number;
  targetOrganizationId: number;
  targetUserId?: number;
  permissions: ('view' | 'comment')[];
  isCollaborative: boolean; // true = live updates, false = frozen snapshot
  expiresAt?: Date;
  message?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current view state for snapshot
  const [view] = await db.select().from(viewScopes).where(eq(viewScopes.id, data.viewId));
  if (!view) return null;
  
  // Create frozen snapshot if not collaborative
  let snapshotData = null;
  if (!data.isCollaborative) {
    snapshotData = {
      frozenAt: new Date().toISOString(),
      config: view.config,
      name: view.name,
      description: view.description,
    };
  }
  
  const [result] = await db.insert(viewShares).values({
    viewId: data.viewId,
    sharedWithType: data.targetUserId ? 'user' : 'organization',
    sharedWithId: data.targetUserId || data.targetOrganizationId,
    sharedByUserId: data.sharedByUserId,
    permissions: data.permissions,
    isActive: true,
    expiresAt: data.expiresAt,
    metadata: {
      isExternal: true,
      isCollaborative: data.isCollaborative,
      targetOrganizationId: data.targetOrganizationId,
      message: data.message,
      snapshot: snapshotData,
    },
  });
  
  return result?.insertId || null;
}

/**
 * Toggle collaborative mode on external share
 */
export async function toggleExternalShareCollaborative(
  shareId: number,
  userId: number,
  isCollaborative: boolean
) {
  const db = await getDb();
  if (!db) return false;
  
  // Get share and view
  const [share] = await db.select().from(viewShares).where(eq(viewShares.id, shareId));
  if (!share) return false;
  
  const [view] = await db.select().from(viewScopes).where(eq(viewScopes.id, share.viewId));
  if (!view) return false;
  
  // Verify user owns the view
  if (view.createdById !== userId) return false;
  
  const currentMetadata = (share.metadata || {}) as Record<string, unknown>;
  
  // If switching to frozen, capture current state
  let snapshotData = null;
  if (!isCollaborative) {
    snapshotData = {
      frozenAt: new Date().toISOString(),
      config: view.config,
      name: view.name,
      description: view.description,
    };
  }
  
  await db.update(viewShares)
    .set({
      metadata: {
        ...currentMetadata,
        isCollaborative,
        snapshot: snapshotData,
        lastToggleAt: new Date().toISOString(),
        lastToggleByUserId: userId,
      },
    })
    .where(eq(viewShares.id, shareId));
  
  return true;
}

/**
 * Get external shares for a view (outgoing)
 */
export async function getExternalViewShares(viewId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const shares = await db.select()
    .from(viewShares)
    .where(and(
      eq(viewShares.viewId, viewId),
      eq(viewShares.isActive, true)
    ));
  
  // Filter to external shares only
  return shares.filter(s => {
    const meta = s.metadata as Record<string, unknown> | null;
    return meta?.isExternal === true;
  });
}

/**
 * Get views shared with organization (incoming)
 */
export async function getIncomingExternalShares(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const shares = await db.select({
    share: viewShares,
    view: viewScopes,
  })
    .from(viewShares)
    .innerJoin(viewScopes, eq(viewShares.viewId, viewScopes.id))
    .where(and(
      eq(viewShares.sharedWithType, 'organization'),
      eq(viewShares.sharedWithId, organizationId),
      eq(viewShares.isActive, true)
    ));
  
  // Filter to external shares and include snapshot data for frozen views
  return shares.filter(s => {
    const meta = s.share.metadata as Record<string, unknown> | null;
    return meta?.isExternal === true;
  }).map(s => {
    const meta = s.share.metadata as Record<string, unknown> | null;
    const isCollaborative = meta?.isCollaborative === true;
    
    // If frozen, use snapshot data instead of live view
    if (!isCollaborative && meta?.snapshot) {
      const snapshot = meta.snapshot as Record<string, unknown>;
      return {
        ...s,
        view: {
          ...s.view,
          name: snapshot.name || s.view.name,
          description: snapshot.description || s.view.description,
          config: snapshot.config || s.view.config,
        },
        isFrozen: true,
        frozenAt: snapshot.frozenAt,
      };
    }
    
    return { ...s, isFrozen: false };
  });
}

/**
 * Check if user can access a view
 */
export async function canUserAccessView(userId: number, viewId: number, organizationId: number): Promise<{
  canAccess: boolean;
  accessType: 'owner' | 'admin' | 'shared' | 'org_member' | 'none';
  permissions: string[];
}> {
  const db = await getDb();
  if (!db) return { canAccess: false, accessType: 'none', permissions: [] };
  
  // Get the view
  const [view] = await db.select().from(viewScopes).where(eq(viewScopes.id, viewId));
  if (!view || !view.isActive) return { canAccess: false, accessType: 'none', permissions: [] };
  
  // Check if owner
  if (view.createdById === userId) {
    return { canAccess: true, accessType: 'owner', permissions: ['view', 'edit', 'delete', 'share'] };
  }
  
  // Check if org admin
  const [membership] = await db.select()
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, 'active')
    ));
  
  if (membership?.role === 'admin') {
    return { canAccess: true, accessType: 'admin', permissions: ['view', 'edit', 'delete', 'share'] };
  }
  
  // Check if directly shared with user
  const [userShare] = await db.select()
    .from(viewShares)
    .where(and(
      eq(viewShares.viewId, viewId),
      eq(viewShares.sharedWithType, 'user'),
      eq(viewShares.sharedWithId, userId),
      eq(viewShares.isActive, true)
    ));
  
  if (userShare) {
    const perms = (userShare.permissions || ['view']) as string[];
    return { canAccess: true, accessType: 'shared', permissions: perms };
  }
  
  // Check if org-wide view
  if (view.scope === 'organization' && view.organizationId === organizationId) {
    return { canAccess: true, accessType: 'org_member', permissions: ['view'] };
  }
  
  // Check if shared with org
  const [orgShare] = await db.select()
    .from(viewShares)
    .where(and(
      eq(viewShares.viewId, viewId),
      eq(viewShares.sharedWithType, 'organization'),
      eq(viewShares.sharedWithId, organizationId),
      eq(viewShares.isActive, true)
    ));
  
  if (orgShare) {
    const perms = (orgShare.permissions || ['view']) as string[];
    return { canAccess: true, accessType: 'shared', permissions: perms };
  }
  
  return { canAccess: false, accessType: 'none', permissions: [] };
}
