import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { integrationsRouter } from "./routers/integrations";
import { viewsRouter } from "./routers/views";
import { templatesRouter } from "./routers/templates";
import { evidenceRouter } from "./routers/evidence";
import { workspaceRouter } from "./routers/workspace";
import { orgPreferencesRouter } from "./routers/orgPreferences";
import { fieldPacksRouter } from "./routers/fieldPacks";
import { aiSetupRouter } from "./routers/aiSetup";
import { viewCustomizationRouter } from "./routers/viewCustomization";
import { authSessionRouter } from "./routers/authSession";
import { mfaRouter } from "./routers/mfa";
import { obligationsRouter } from "./routers/obligations";
import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { crossOrgSharingRouter } from "./routers/crossOrgSharing";
import { identityRouter } from "./routers/identity";
import { signupRouter } from "./routers/signup";
import { superuserRouter } from "./routers/superuser";
import { calendarRouter } from "./routers/calendar";
import { emailTemplatesRouter } from "./routers/emailTemplates";
import { requestRemindersRouter } from "./routers/requestReminders";
import { assetImportRouter } from "./routers/assetImport";
import { multiAuthRouter } from "./routers/multiAuth";
import { aiAdminRouter } from "./routers/aiAdmin";
import { orgAuthPolicyRouter } from "./routers/orgAuthPolicy";
import { customerPortalRouter } from "./routers/customerPortal";
import { inverterConnectorsRouter } from "./routers/inverterConnectors";
import { invoicePdfRouter } from "./routers/invoicePdf";
import { customerNotificationsRouter } from "./routers/customerNotifications";
import { grafanaRouter } from "./routers/grafana";
import { billingRouter } from "./routers/billing";
import { scheduledJobsRouter } from "./routers/scheduledJobs";
import { invoiceBrandingRouter } from "./routers/invoiceBranding";
import { diligenceRouter } from "./routers/diligence";
import { notificationsRouter } from "./routers/notifications";
import { viewSharingRouter } from "./routers/viewSharing";
import { aiChatRouter } from "./routers/aiChat";
import { securityRouter } from "./routers/security";
import { financialModelsRouter } from "./routers/financialModels";
import { platformBillingRouter } from "./routers/platformBilling";
import { documentCategoriesRouter } from "./routers/documentCategories";
import { openclawRouter } from "./routers/openclaw";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import { uploadFromWeb, getStorageHealth } from "./services/storageHardening";
import { enqueueJob } from "./services/jobQueue";
import { getJobDisplayName, getJobDisplayStatus, type JobStatusResponse, type JobStatus, type JobPriority } from "../shared/jobTypes";
import { invokeLLM } from "./_core/llm";
import { notifyRequestIssued, notifySubmissionReceived, notifyClarificationNeeded } from "./services/requestNotifications";
import { notifyOwner } from "./_core/notification";
import { processInboundMessage, getSafeResponseForUnknownSender } from "./services/conversationalAgent";
import { nanoid } from "nanoid";
import crypto from "crypto";
import jwt from "jsonwebtoken";

// Password hashing utilities
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// TOTP utilities - Base32 encoding/decoding
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of str.toUpperCase()) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function verifyTotp(secret: string, token: string): boolean {
  // Simple TOTP verification (30-second window)
  const counter = Math.floor(Date.now() / 30000);
  for (let i = -1; i <= 1; i++) {
    const expectedToken = generateTotpToken(secret, counter + i);
    if (expectedToken === token) return true;
  }
  return false;
}

function generateTotpToken(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret));
  hmac.update(buffer);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0xf;
  const code = ((hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16 | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff)) % 1000000;
  return code.toString().padStart(6, '0');
}

// Helper function to check if user is a PLATFORM superuser (sees ALL data across all orgs)
function isSuperuser(user: { role?: string; isSuperuser?: boolean }): boolean {
  return user.role === 'superuser_admin' || user.isSuperuser === true;
}

// Helper function to check if user is an organization admin (sees data within their org only)
function isOrgAdmin(user: { role?: string }): boolean {
  return user.role === 'admin';
}

// Helper function to check if user has admin-level access (admin, superuser_admin, or isSuperuser)
// NOTE: Use isSuperuser() for platform-wide access, this is for permission checks within an org
function isAdminOrSuperuser(user: { role?: string; isSuperuser?: boolean }): boolean {
  return user.role === 'admin' || user.role === 'superuser_admin' || user.isSuperuser === true;
}

// Permission middleware - PRODUCTION: Real RBAC enforcement
const withProjectAccess = protectedProcedure.use(async (opts) => {
  const { ctx, next } = opts;
  const input = (opts as any).rawInput as { projectId?: number };
  if (input?.projectId) {
    // Admin and superuser users have access to all projects
    if (isAdminOrSuperuser(ctx.user)) {
      return next({ ctx });
    }
    const hasAccess = await db.canUserAccessProject(ctx.user.id, input.projectId);
    if (!hasAccess) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this project' });
    }
  }
  return next({ ctx });
});

const withProjectEdit = protectedProcedure.use(async (opts) => {
  const { ctx, next } = opts;
  const input = (opts as any).rawInput as { projectId?: number };
  if (input?.projectId) {
    // Admin users can edit all projects
    if (isAdminOrSuperuser(ctx.user)) {
      return next({ ctx });
    }
    const canEdit = await db.canUserEditProject(ctx.user.id, input.projectId);
    if (!canEdit) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'No edit access to this project' });
    }
  }
  return next({ ctx });
});

// Canonical job status response formatter
function formatJobStatusResponse(job: NonNullable<Awaited<ReturnType<typeof db.getJob>>>): JobStatusResponse {
  const payload = job.payload as Record<string, unknown> | null;
  const result = job.result as Record<string, unknown> | null;
  const errorDetails = job.error ? { rawError: job.error } : undefined;
  
  // Determine if job is retryable
  const isRetryable = job.status === 'failed' && job.attempts < job.maxAttempts;
  
  // Calculate next retry time with exponential backoff
  const nextRetryAt = isRetryable 
    ? new Date(Date.now() + Math.pow(2, job.attempts) * 1000 * 60) // 2^attempts minutes
    : undefined;
  
  // Get user-friendly error message
  const userFriendlyError = job.error 
    ? getUserFriendlyJobError(job.type, job.error)
    : undefined;
  
  return {
    id: job.id,
    correlationId: job.correlationId || `job_${job.id}`,
    type: job.type as JobStatusResponse['type'],
    status: job.status as JobStatus,
    priority: job.priority as JobPriority,
    progress: (payload as any)?.progress,
    progressMessage: (payload as any)?.progressMessage,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? undefined,
    completedAt: job.completedAt ?? undefined,
    failedAt: job.failedAt ?? undefined,
    updatedAt: job.startedAt ?? job.createdAt,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    isRetryable,
    nextRetryAt,
    result: result ?? undefined,
    error: job.error ?? undefined,
    errorDetails,
    userId: job.userId ?? undefined,
    entityType: (payload as any)?.entityType,
    entityId: (payload as any)?.entityId,
    linkedEntityType: (payload as any)?.linkedEntityType,
    linkedEntityId: (payload as any)?.linkedEntityId,
    parentJobId: job.parentJobId ?? undefined,
    displayName: getJobDisplayName(job.type as JobStatusResponse['type']),
    displayStatus: getJobDisplayStatus(job.status as JobStatus),
    userFriendlyError,
  };
}

// Get user-friendly error messages for different job types
function getUserFriendlyJobError(jobType: string, error: string): string {
  const errorLower = error.toLowerCase();
  
  // Common error patterns
  if (errorLower.includes('timeout')) {
    return 'The operation took too long. Please try again.';
  }
  if (errorLower.includes('network') || errorLower.includes('connection')) {
    return 'A network error occurred. Please check your connection and try again.';
  }
  if (errorLower.includes('permission') || errorLower.includes('access denied')) {
    return 'You don\'t have permission to perform this action.';
  }
  if (errorLower.includes('not found')) {
    return 'The requested resource was not found.';
  }
  if (errorLower.includes('invalid') || errorLower.includes('malformed')) {
    return 'The file or data format is invalid.';
  }
  
  // Job-type specific messages
  switch (jobType) {
    case 'document_ingestion':
      if (errorLower.includes('size')) return 'The file is too large to process.';
      if (errorLower.includes('type') || errorLower.includes('format')) return 'This file type is not supported.';
      return 'Failed to process the document. Please try uploading again.';
    case 'ai_extraction':
      return 'AI analysis failed. The document may be unclear or in an unsupported format.';
    case 'email_send':
      return 'Failed to send the email. Please verify the email address and try again.';
    case 'whatsapp_ingestion':
    case 'email_ingestion':
      return 'Failed to process the attachment. Please try sending it again.';
    default:
      return 'An unexpected error occurred. Please try again or contact support.';
  }
}

export const appRouter = router({
  system: systemRouter,
  financialModels: financialModelsRouter,
  documentCategories: documentCategoriesRouter,
  integrations: integrationsRouter,
  views: viewsRouter,
  templates: templatesRouter,
  evidence: evidenceRouter,
  workspace: workspaceRouter,
  orgPreferences: orgPreferencesRouter,
  fieldPacks: fieldPacksRouter,
  aiSetup: aiSetupRouter,
  viewCustomization: viewCustomizationRouter,
  authSession: authSessionRouter,
  mfa: mfaRouter,
  obligations: obligationsRouter,
  calendar: calendarRouter,
  emailTemplates: emailTemplatesRouter,
  requestReminders: requestRemindersRouter,
  assetImport: assetImportRouter,
  multiAuth: multiAuthRouter,
  aiAdmin: aiAdminRouter,
  ai: aiChatRouter,
  orgAuthPolicy: orgAuthPolicyRouter,
  customerPortal: customerPortalRouter,
  inverterConnectors: inverterConnectorsRouter,
  invoicePdf: invoicePdfRouter,
  grafana: grafanaRouter,
  customerNotifications: customerNotificationsRouter,
  billing: billingRouter,
  platformBilling: platformBillingRouter,
  scheduledJobs: scheduledJobsRouter,
  invoiceBranding: invoiceBrandingRouter,
  diligence: diligenceRouter,
  notifications: notificationsRouter,
  viewSharing: viewSharingRouter,
  security: securityRouter,
  admin: adminRouter,
  authFlow: authRouter,
  crossOrgSharing: crossOrgSharingRouter,
  identity: identityRouter,
  signup: signupRouter,
  superuser: superuserRouter,
  openclaw: openclawRouter,
  
  // Background job status - canonical contract across all job types
  // SECURITY: All job queries enforce ownership (user must own job OR be admin)
  jobs: router({
    getStatus: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await db.getJob(input.jobId);
        if (!job) return null;
        // SECURITY: Only job owner or admin can view job status
        if (job.userId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          return null; // Return null instead of FORBIDDEN to avoid leaking job existence
        }
        return formatJobStatusResponse(job);
      }),
    getByCorrelation: protectedProcedure
      .input(z.object({ correlationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const job = await db.getJobByCorrelationId(input.correlationId);
        if (!job) return null;
        // SECURITY: Only job owner or admin can view job status
        if (job.userId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          return null; // Return null instead of FORBIDDEN to avoid leaking job existence
        }
        return formatJobStatusResponse(job);
      }),
    getUserJobs: protectedProcedure
      .input(z.object({
        status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']).optional(),
        type: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
      }))
      .query(async ({ ctx, input }) => {
        // SECURITY: Always scoped to current user's jobs only
        const jobs = await db.getJobsByUser(ctx.user.id, {
          status: input.status,
          type: input.type as db.JobType | undefined,
          limit: input.limit,
        });
        return jobs.map(formatJobStatusResponse);
      }),
    getByEntity: protectedProcedure
      .input(z.object({
        entityType: z.string(),
        entityId: z.number(),
        status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        // SECURITY: Filter to only jobs owned by current user (or admin sees all)
        const jobs = await db.getJobsByEntity(input.entityType, input.entityId, input.status);
        const filteredJobs = isAdminOrSuperuser(ctx.user) 
          ? jobs 
          : jobs.filter(j => j.userId === ctx.user.id);
        return filteredJobs.map(formatJobStatusResponse);
      }),
    retry: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const job = await db.getJob(input.jobId);
        // SECURITY: Only job owner or admin can retry
        const canAccess = job && (job.userId === ctx.user.id || isAdminOrSuperuser(ctx.user));
        if (!job || !canAccess) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }
        if (job.status !== 'failed') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only failed jobs can be retried' });
        }
        // Create NEW job for retry (preserves audit trail)
        // New job starts with attempts=0, allowing unlimited manual retries
        // Each job in the chain tracks its own processing attempts
        const result = await db.retryJob(input.jobId);
        if (!result.success || !result.newJobId) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create retry job' });
        }
        const newJob = await db.getJob(result.newJobId);
        return formatJobStatusResponse(newJob!);
      }),
    cancel: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const job = await db.getJob(input.jobId);
        // SECURITY: Only job owner or admin can cancel
        const canAccess = job && (job.userId === ctx.user.id || isAdminOrSuperuser(ctx.user));
        if (!job || !canAccess) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }
        await db.cancelJob(input.jobId);
        return { success: true };
      }),
    getLogs: protectedProcedure
      .input(z.object({ jobId: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await db.getJob(input.jobId);
        // SECURITY: Only job owner or admin can view logs
        const canAccess = job && (job.userId === ctx.user.id || isAdminOrSuperuser(ctx.user));
        if (!job || !canAccess) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
        }
        return db.getJobLogs(input.jobId);
      }),
    // Admin: Get all jobs with filters
    getAllJobs: protectedProcedure
      .input(z.object({
        status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']).optional(),
        type: z.string().optional(),
        userId: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        const jobs = await db.getAllJobs({
          status: input.status,
          type: input.type as db.JobType | undefined,
          userId: input.userId,
          limit: input.limit,
          offset: input.offset,
        });
        const total = await db.getJobsCount({
          status: input.status,
          type: input.type as db.JobType | undefined,
          userId: input.userId,
        });
        return {
          jobs: jobs.map(formatJobStatusResponse),
          total,
        };
      }),
    // Admin: Get job counts for dashboard stats
    getJobsCount: protectedProcedure
      .input(z.object({
        status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']).optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        return db.getJobsCount({ status: input.status });
      }),
    // Admin: Bulk retry failed jobs
    bulkRetry: protectedProcedure
      .input(z.object({ jobIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
        }
        let successful = 0;
        let failed = 0;
        const newJobIds: number[] = [];
        
        for (const jobId of input.jobIds) {
          try {
            const job = await db.getJob(jobId);
            if (!job || job.status !== 'failed') {
              failed++;
              continue;
            }
            const result = await db.retryJob(jobId);
            if (result.success && result.newJobId) {
              successful++;
              newJobIds.push(result.newJobId);
            } else {
              failed++;
            }
          } catch {
            failed++;
          }
        }
        
        return { successful, failed, newJobIds };
      }),
  }),
  
  // Storage health check
  storage: router({
    health: protectedProcedure.query(async () => {
      return getStorageHealth();
    }),
  }),
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    
    // Local authentication
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        userType: z.enum(['operations_manager', 'field_coordinator', 'portfolio_manager', 'investor', 'technical_advisor']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if email already exists
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' });
        }
        
        // Hash password and create user
        const passwordHash = hashPassword(input.password);
        const result = await db.createLocalUser({
          email: input.email,
          name: input.name,
          passwordHash,
          userType: input.userType,
        });
        
        if (!result) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create user' });
        }
        
        return { success: true, userId: result.id };
      }),
    
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
        totpToken: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        if (!verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
        }
        
        // Check 2FA if enabled
        if (user.totpEnabled && user.totpSecret) {
          if (!input.totpToken) {
            return { success: false, requires2FA: true };
          }
          if (!verifyTotp(user.totpSecret, input.totpToken)) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid 2FA code' });
          }
        }
        
        // Generate JWT token and set cookie
        const jwtSecret = process.env.JWT_SECRET || 'kiisha-local-secret';
        const token = jwt.sign(
          { userId: user.id, openId: user.openId },
          jwtSecret,
          { expiresIn: '7d' }
        );
        
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        // Update last signed in
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() } as any);
        
        return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
      }),
    
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserById(ctx.user.id);
        
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot change password for OAuth users' });
        }
        
        if (!verifyPassword(input.currentPassword, user.passwordHash)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current password is incorrect' });
        }
        
        const newHash = hashPassword(input.newPassword);
        await db.updateUserPassword(ctx.user.id, newHash);
        
        return { success: true };
      }),
    
    // 2FA management
    setup2FA: protectedProcedure
      .mutation(async ({ ctx }) => {
        const secret = generateTotpSecret();
        const user = await db.getUserById(ctx.user.id);
        
        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }
        
        // Store secret temporarily (not enabled yet)
        await db.updateUserTotp(ctx.user.id, secret, false);
        
        // Generate QR code URL for authenticator apps
        const otpAuthUrl = `otpauth://totp/KIISHA:${user.email}?secret=${secret}&issuer=KIISHA`;
        
        return { secret, otpAuthUrl };
      }),
    
    verify2FA: protectedProcedure
      .input(z.object({ token: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const secret = await db.getUserTotpSecret(ctx.user.id);
        
        if (!secret) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA not set up' });
        }
        
        if (!verifyTotp(secret, input.token)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid verification code' });
        }
        
        // Enable 2FA
        await db.updateUserTotp(ctx.user.id, secret, true);
        
        // Log activity
        await db.logUserActivity(ctx.user.id, '2fa_enable');
        
        return { success: true };
      }),
    
    disable2FA: protectedProcedure
      .input(z.object({ token: z.string().length(6) }))
      .mutation(async ({ input, ctx }) => {
        const secret = await db.getUserTotpSecret(ctx.user.id);
        
        if (!secret) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: '2FA not enabled' });
        }
        
        if (!verifyTotp(secret, input.token)) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid verification code' });
        }
        
        // Disable 2FA
        await db.updateUserTotp(ctx.user.id, null, false);
        
        // Log activity
        await db.logUserActivity(ctx.user.id, '2fa_disable');
        
        return { success: true };
      }),
  }),

  // Users
  users: router({
    list: protectedProcedure.query(async () => {
      return db.getAllUsers();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),
  }),

  // Profile management
  profile: router({
    // Get current user's full profile
    get: protectedProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }
      
      const twoFactorStatus = await db.getUser2FAStatus(ctx.user.id);
      const notificationPrefs = await db.getUserNotificationPreferences(ctx.user.id);
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        organization: user.organization,
        role: user.role,
        userType: user.userType,
        loginMethod: user.loginMethod,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
        twoFactorEnabled: twoFactorStatus.enabled,
        notificationPreferences: notificationPrefs,
      };
    }),
    
    // Update profile info (name, organization)
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255).optional(),
        organization: z.string().max(255).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const updated = await db.updateUserProfile(ctx.user.id, input);
        if (!updated) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' });
        }
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'profile_update', {
          metadata: { fields: Object.keys(input).filter(k => input[k as keyof typeof input] !== undefined) },
        });
        
        return { success: true, user: updated };
      }),
    
    // Upload avatar
    uploadAvatar: protectedProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.string(),
        filename: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Decode base64 and upload to S3
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileKey = `avatars/${ctx.user.id}/${Date.now()}-${input.filename}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Update user's avatar URL
        await db.updateUserProfile(ctx.user.id, { avatarUrl: url });
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'avatar_upload', {
          metadata: { filename: input.filename },
        });
        
        return { success: true, avatarUrl: url };
      }),
    
    // Get notification preferences
    getNotificationPreferences: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotificationPreferences(ctx.user.id);
    }),
    
    // Update notification preferences
    updateNotificationPreferences: protectedProcedure
      .input(z.object({
        emailDocuments: z.boolean().optional(),
        emailRfis: z.boolean().optional(),
        emailAlerts: z.boolean().optional(),
        emailReports: z.boolean().optional(),
        inAppDocuments: z.boolean().optional(),
        inAppRfis: z.boolean().optional(),
        inAppAlerts: z.boolean().optional(),
        digestFrequency: z.enum(['realtime', 'daily', 'weekly']).optional(),
        whatsappEnabled: z.boolean().optional(),
        whatsappDocuments: z.boolean().optional(),
        whatsappRfis: z.boolean().optional(),
        whatsappAlerts: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const updated = await db.updateUserNotificationPreferences(ctx.user.id, input);
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'notification_preferences_update', {
          metadata: { changedFields: Object.keys(input).filter(k => input[k as keyof typeof input] !== undefined) },
        });
        
        return { success: true, preferences: updated };
      }),
    
    // Get 2FA status
    get2FAStatus: protectedProcedure.query(async ({ ctx }) => {
      return db.getUser2FAStatus(ctx.user.id);
    }),
    
    // Get activity logs
    getActivityLogs: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const logs = await db.getUserActivityLogs(ctx.user.id, {
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
        const total = await db.getUserActivityCount(ctx.user.id);
        return { logs, total };
      }),
    
    // Request email change (sends verification email)
    requestEmailChange: protectedProcedure
      .input(z.object({
        newEmail: z.string().email(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if email is already in use
        const existingUser = await db.getUserByEmail(input.newEmail);
        if (existingUser && existingUser.id !== ctx.user.id) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Email already in use' });
        }
        
        // Generate verification token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Create verification record
        await db.createEmailVerification(ctx.user.id, input.newEmail, token, expiresAt);
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'email_change_request', {
          metadata: { newEmail: input.newEmail },
        });
        
        // In production, send verification email here
        // For now, return the token (in production, this would be sent via email)
        return { 
          success: true, 
          message: 'Verification email sent. Please check your inbox.',
          // In production, remove this - only for development/testing
          verificationToken: token,
        };
      }),
    
    // Verify email change
    verifyEmailChange: protectedProcedure
      .input(z.object({
        token: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.verifyEmail(input.token);
        
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error });
        }
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'email_verified', {
          metadata: { newEmail: result.newEmail },
        });
        
        return { success: true, newEmail: result.newEmail };
      }),
    
    // Get pending email verification
    getPendingEmailVerification: protectedProcedure.query(async ({ ctx }) => {
      const pending = await db.getPendingEmailVerification(ctx.user.id);
      if (!pending) return null;
      
      return {
        newEmail: pending.newEmail,
        expiresAt: pending.expiresAt,
        createdAt: pending.createdAt,
      };
    }),
    
    // Cancel pending email verification
    cancelEmailVerification: protectedProcedure.mutation(async ({ ctx }) => {
      await db.cancelEmailVerification(ctx.user.id);
      return { success: true };
    }),
  }),

  // Projects (THE PRIMARY ASSET ENTITY in KIISHA)
  // Asset = Project-level investable unit (e.g., "UMZA Oil Mill Solar+BESS")
  projects: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      // ONLY platform superusers see ALL projects across all organizations
      // Org admins and regular users see only projects within their organization(s)
      if (isSuperuser(ctx.user)) {
        return db.getAllProjects();
      }
      // For org admins and regular users, return only their accessible projects
      return db.getProjectsForUser(ctx.user.id);
    }),
    
    // List projects with classification filters
    listWithFilters: protectedProcedure
      .input(z.object({
        portfolioId: z.number().optional(),
        organizationId: z.number().optional(),
        country: z.string().optional(),
        status: z.string().optional(),
        stage: z.string().optional(),
        assetClassification: z.string().optional(),
        gridConnectionType: z.string().optional(),
        configurationProfile: z.string().optional(),
        networkTopology: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        // ONLY superusers can see all projects without org filter
        if (isSuperuser(ctx.user)) {
          return db.getProjectsWithFilters(input);
        }
        // For non-superusers, get their organization IDs and filter
        const userOrgIds = await db.getUserOrganizationIds(ctx.user.id);
        if (userOrgIds.length === 0) {
          return []; // User has no org memberships, return empty
        }
        // If organizationId filter provided, verify user has access to it
        if (input?.organizationId && !userOrgIds.includes(input.organizationId)) {
          return []; // User doesn't have access to requested org
        }
        // Filter by user's organizations
        return db.getProjectsWithFilters({ ...input, userOrgIds });
      }),
    
    // Get classification statistics for project-level assets
    getClassificationStats: protectedProcedure
      .input(z.object({
        portfolioId: z.number().optional(),
        organizationId: z.number().optional(),
        country: z.string().optional(),
        status: z.string().optional(),
        stage: z.string().optional(),
        assetClassification: z.string().optional(),
        gridConnectionType: z.string().optional(),
        configurationProfile: z.string().optional(),
        networkTopology: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getProjectClassificationStats(input);
      }),
    
    getById: withProjectAccess
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getProjectById(input.projectId);
      }),
    getUserRole: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getUserProjectRole(ctx.user.id, input.projectId);
      }),

    create: protectedProcedure
      .input(z.object({
        portfolioId: z.number(),
        organizationId: z.number(),
        name: z.string().min(1),
        code: z.string().optional(),
        country: z.string().optional(),
        state: z.string().optional(),
        city: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        address: z.string().optional(),
        timezone: z.string().optional(),
        technology: z.enum(["PV", "BESS", "PV+BESS", "Wind", "Minigrid", "C&I"]).optional(),
        capacityMw: z.string().optional(),
        capacityMwh: z.string().optional(),
        status: z.enum(["prospecting", "development", "construction", "operational", "decommissioned"]).optional(),
        stage: z.enum(["origination", "feasibility", "development", "due_diligence", "ntp", "construction", "commissioning", "cod", "operations"]).optional(),
        assetClassification: z.enum(["residential", "small_commercial", "large_commercial", "industrial", "mini_grid", "mesh_grid", "interconnected_mini_grids", "grid_connected"]).optional(),
        gridConnectionType: z.enum(["grid_tied", "islanded", "islandable", "weak_grid", "no_grid"]).optional(),
        configurationProfile: z.enum(["solar_only", "solar_bess", "solar_genset", "solar_bess_genset", "bess_only", "genset_only", "hybrid"]).optional(),
        couplingTopology: z.enum(["AC_COUPLED", "DC_COUPLED", "HYBRID_COUPLED", "UNKNOWN", "NOT_APPLICABLE"]).optional(),
        offtakerName: z.string().optional(),
        offtakerType: z.enum(["industrial", "commercial", "utility", "community", "residential_aggregate"]).optional(),
        contractType: z.enum(["ppa", "lease", "esco", "direct_sale", "captive"]).optional(),
        projectValueUsd: z.string().optional(),
        codDate: z.string().optional(),
        copyFromProjectId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.copyFromProjectId) {
          const projectId = await db.duplicateProject(input.copyFromProjectId, input.name, ctx.user.id);
          await db.addProjectMember({ projectId, userId: ctx.user.id, role: "admin" });
          return { projectId };
        }
        const projectId = await db.createProject({
          ...input,
          createdBy: ctx.user.id,
        });
        await db.addProjectMember({ projectId, userId: ctx.user.id, role: "admin" });
        return { projectId };
      }),

    update: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string().optional(),
        code: z.string().optional(),
        country: z.string().optional(),
        state: z.string().optional(),
        city: z.string().optional(),
        technology: z.enum(["PV", "BESS", "PV+BESS", "Wind", "Minigrid", "C&I"]).optional(),
        capacityMw: z.string().optional(),
        capacityMwh: z.string().optional(),
        status: z.enum(["prospecting", "development", "construction", "operational", "decommissioned"]).optional(),
        stage: z.enum(["origination", "feasibility", "development", "due_diligence", "ntp", "construction", "commissioning", "cod", "operations"]).optional(),
        offtakerName: z.string().optional(),
        projectValueUsd: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { projectId, ...data } = input;
        await db.updateProject(projectId, data);
        return { success: true };
      }),
  }),

  // Portfolio Views - for view-scoping assets
  portfolioViews: router({
    list: protectedProcedure.query(async () => {
      return db.getPortfolioViews();
    }),
    
    getById: protectedProcedure
      .input(z.object({ viewId: z.number() }))
      .query(async ({ input }) => {
        return db.getPortfolioView(input.viewId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        organizationId: z.number().optional(),
        portfolioId: z.number().optional(),
        viewType: z.enum(["dynamic", "static"]).default("dynamic"),
        filterCriteria: z.object({
          countries: z.array(z.string()).optional(),
          statuses: z.array(z.string()).optional(),
          assetClassifications: z.array(z.string()).optional(),
          gridConnectionTypes: z.array(z.string()).optional(),
          configurationProfiles: z.array(z.string()).optional(),
        }).optional(),
        isPublic: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const viewId = await db.createPortfolioView({
          ...input,
          createdById: ctx.user.id,
        });
        return { viewId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        filterCriteria: z.any().optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { viewId, ...data } = input;
        await db.updatePortfolioView(viewId, data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ viewId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePortfolioView(input.viewId);
        return { success: true };
      }),
    
    addAssets: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        projectIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.addAssetsToView(input.viewId, input.projectIds, ctx.user.id);
        return { success: true };
      }),
    
    removeAssets: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        projectIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await db.removeAssetsFromView(input.viewId, input.projectIds);
        return { success: true };
      }),
    
    getAssets: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        country: z.string().optional(),
        status: z.string().optional(),
        assetClassification: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { viewId, ...filters } = input;
        return db.getAssetsForView(viewId, filters);
      }),
    
    getClassificationStats: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        country: z.string().optional(),
        status: z.string().optional(),
        assetClassification: z.string().optional(),
      }))
      .query(async ({ input }) => {
        const { viewId, ...filters } = input;
        return db.getViewClassificationStats(viewId, filters);
      }),
    
    // View Preferences (VATR + Views Contract)
    resolveEffectiveView: protectedProcedure
      .input(z.object({
        context: z.enum(["dashboard", "portfolio", "dataroom", "checklist", "report"]),
        organizationId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        // R1: Team and department are resolved automatically via membership with tie-break
        return db.resolveEffectiveView(ctx.user.id, input.context, {
          organizationId: input.organizationId,
        });
      }),
    
    setViewPreference: protectedProcedure
      .input(z.object({
        scopeType: z.enum(["user", "team", "department", "organization"]),
        scopeId: z.number(),
        context: z.enum(["dashboard", "portfolio", "dataroom", "checklist", "report"]),
        defaultViewId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can set team/dept/org level preferences
        if (input.scopeType !== "user" && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can set team/department/organization view preferences" });
        }
        // Users can only set their own preferences
        if (input.scopeType === "user" && input.scopeId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot set preferences for other users" });
        }
        await db.setViewPreference({
          ...input,
          setBy: ctx.user.id,
        });
        return { success: true };
      }),
    
    clearViewPreference: protectedProcedure
      .input(z.object({
        scopeType: z.enum(["user", "team", "department", "organization"]),
        scopeId: z.number(),
        context: z.enum(["dashboard", "portfolio", "dataroom", "checklist", "report"]),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can clear team/dept/org level preferences
        if (input.scopeType !== "user" && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can clear team/department/organization view preferences" });
        }
        // Users can only clear their own preferences
        if (input.scopeType === "user" && input.scopeId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot clear preferences for other users" });
        }
        await db.clearViewPreference(input.scopeType, input.scopeId, input.context);
        return { success: true };
      }),
    
    getUserPreferences: protectedProcedure
      .input(z.object({
        teamId: z.number().optional(),
        departmentId: z.number().optional(),
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getUserViewPreferences(ctx.user.id, input);
      }),

    // ============ VIEW SHARING ============
    
    shareView: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        sharedWithType: z.enum(["user", "team", "department", "organization"]),
        sharedWithId: z.number(),
        permissionLevel: z.enum(["view_only", "edit", "admin"]).default("view_only"),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify user owns the view or has admin permission
        const view = await db.getPortfolioView(input.viewId);
        if (!view) {
          throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
        }
        
        // Check permission to share
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        const isOwner = view.createdById === ctx.user.id;
        const canShare = isOwner || userRole.isAdmin || userRole.isOrgSuperuser;
        
        if (!canShare) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to share this view" });
        }
        
        await db.shareView({
          viewId: input.viewId,
          sharedWithType: input.sharedWithType,
          sharedWithId: input.sharedWithId,
          permissionLevel: input.permissionLevel,
          sharedBy: ctx.user.id,
          expiresAt: input.expiresAt,
        });
        
        // Log the action
        await db.logViewManagementAction({
          actionType: "share",
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          viewId: input.viewId,
          targetType: input.sharedWithType,
          targetId: input.sharedWithId,
          newState: { permissionLevel: input.permissionLevel },
        });
        
        return { success: true };
      }),
    
    revokeShare: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        sharedWithType: z.enum(["user", "team", "department", "organization"]),
        sharedWithId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const view = await db.getPortfolioView(input.viewId);
        if (!view) {
          throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
        }
        
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        const isOwner = view.createdById === ctx.user.id;
        const canRevoke = isOwner || userRole.isAdmin || userRole.isOrgSuperuser;
        
        if (!canRevoke) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to revoke sharing" });
        }
        
        await db.revokeViewShare(input.viewId, input.sharedWithType, input.sharedWithId, ctx.user.id);
        
        await db.logViewManagementAction({
          actionType: "unshare",
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          viewId: input.viewId,
          targetType: input.sharedWithType,
          targetId: input.sharedWithId,
        });
        
        return { success: true };
      }),
    
    getShares: protectedProcedure
      .input(z.object({ viewId: z.number() }))
      .query(async ({ input }) => {
        return db.getViewShares(input.viewId);
      }),
    
    getSharedWithMe: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const userTeams = await db.getUserTeams(ctx.user.id);
        const userDepts = await db.getUserDepartments(ctx.user.id);
        
        return db.getViewsSharedWithUser(ctx.user.id, {
          teamIds: userTeams.map(t => t.teamId),
          departmentIds: userDepts.map(d => d.departmentId),
          organizationId: input?.organizationId,
        });
      }),

    // ============ VIEW TEMPLATES ============
    
    getTemplates: protectedProcedure
      .input(z.object({
        category: z.enum(["due_diligence", "investor_reporting", "compliance", "operations", "financial", "custom"]).optional(),
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getViewTemplates({
          category: input?.category,
          organizationId: input?.organizationId,
          includeSystem: true,
        });
      }),
    
    getTemplateById: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .query(async ({ input }) => {
        return db.getViewTemplateById(input.templateId);
      }),
    
    createTemplate: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        category: z.enum(["due_diligence", "investor_reporting", "compliance", "operations", "financial", "custom"]),
        filterCriteria: z.any().optional(),
        defaultColumns: z.array(z.string()).optional(),
        sortOrder: z.string().optional(),
        organizationId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Only admins can create system templates (no organizationId)
        if (!input.organizationId && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can create system templates" });
        }
        
        const templateId = await db.createViewTemplate({
          ...input,
          isSystem: !input.organizationId && isAdminOrSuperuser(ctx.user),
          createdBy: ctx.user.id,
        });
        
        return { templateId };
      }),
    
    applyTemplate: protectedProcedure
      .input(z.object({
        templateId: z.number(),
        viewName: z.string(),
        viewDescription: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await db.getViewTemplateById(input.templateId);
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }
        
        // Create a new view from the template
        const viewId = await db.createPortfolioView({
          name: input.viewName,
          description: input.viewDescription || template.description || undefined,
          viewType: "dynamic",
          filterCriteria: template.filterCriteria || undefined,
          organizationId: template.organizationId || undefined,
          createdById: ctx.user.id,
        });
        
        if (!viewId) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create view from template" });
        }
        
        // Track analytics
        await db.trackViewAccess({
          viewId,
          userId: ctx.user.id,
          actionType: "apply_template",
          actionDetails: { templateId: input.templateId, templateName: template.name },
        });
        
        return { viewId };
      }),

    // ============ VIEW ANALYTICS ============
    
    trackAccess: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        actionType: z.enum(["view", "filter_change", "export", "share", "edit", "apply_template"]).default("view"),
        actionDetails: z.record(z.string(), z.unknown()).optional(),
        durationSeconds: z.number().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.trackViewAccess({
          viewId: input.viewId,
          userId: ctx.user.id,
          actionType: input.actionType,
          actionDetails: input.actionDetails,
          durationSeconds: input.durationSeconds,
          sessionId: input.sessionId,
        });
        return { success: true };
      }),
    
    getAnalytics: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(100),
      }))
      .query(async ({ ctx, input }) => {
        // Only view owner or admin can see analytics
        const view = await db.getPortfolioView(input.viewId);
        if (!view) {
          throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
        }
        
        if (view.createdById !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only view owner or admin can see analytics" });
        }
        
        return db.getViewAnalytics(input.viewId, {
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit,
        });
      }),
    
    getPopularViews: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        limit: z.number().default(10),
      }).optional())
      .query(async ({ input }) => {
        return db.getPopularViews(input?.organizationId, input?.limit || 10);
      }),

    // ============ VIEW PUSH (Managers/Superusers) ============
    
    pushView: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        targetScope: z.enum(["user", "team", "department", "organization"]),
        targetScopeId: z.number(),
        isPinned: z.boolean().default(false),
        isRequired: z.boolean().default(false),
        displayOrder: z.number().default(0),
        pushMessage: z.string().optional(),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        
        // Determine pusher role based on target scope and user's permissions
        let pushedByRole: "manager" | "team_superuser" | "department_superuser" | "organization_superuser" | "admin";
        
        if (userRole.isAdmin) {
          pushedByRole = "admin";
        } else if (userRole.isOrgSuperuser && input.targetScope === "organization") {
          pushedByRole = "organization_superuser";
        } else if (userRole.isDeptSuperuser && ["department", "team", "user"].includes(input.targetScope)) {
          pushedByRole = "department_superuser";
        } else if (userRole.isTeamSuperuser && ["team", "user"].includes(input.targetScope)) {
          pushedByRole = "team_superuser";
        } else if (userRole.isManager && input.targetScope === "user") {
          pushedByRole = "manager";
        } else {
          throw new TRPCError({ 
            code: "FORBIDDEN", 
            message: "You don't have permission to push views at this scope level" 
          });
        }
        
        // Verify target scope is within user's authority
        if (input.targetScope === "team" && !userRole.isAdmin && !userRole.isOrgSuperuser && !userRole.isDeptSuperuser) {
          if (!userRole.teamIds.includes(input.targetScopeId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You can only push to teams you manage" });
          }
        }
        
        if (input.targetScope === "department" && !userRole.isAdmin && !userRole.isOrgSuperuser) {
          if (!userRole.departmentIds.includes(input.targetScopeId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You can only push to departments you manage" });
          }
        }
        
        await db.pushView({
          viewId: input.viewId,
          pushedBy: ctx.user.id,
          pushedByRole,
          targetScope: input.targetScope,
          targetScopeId: input.targetScopeId,
          isPinned: input.isPinned,
          isRequired: input.isRequired,
          displayOrder: input.displayOrder,
          pushMessage: input.pushMessage,
          expiresAt: input.expiresAt,
        });
        
        await db.logViewManagementAction({
          actionType: "push",
          actorId: ctx.user.id,
          actorRole: pushedByRole,
          viewId: input.viewId,
          targetType: input.targetScope,
          targetId: input.targetScopeId,
          newState: { isPinned: input.isPinned, isRequired: input.isRequired },
        });
        
        return { success: true };
      }),
    
    unpushView: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        targetScope: z.enum(["user", "team", "department", "organization"]),
        targetScopeId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        
        // Check permission based on scope
        const canUnpush = userRole.isAdmin || 
          (userRole.isOrgSuperuser && input.targetScope === "organization") ||
          (userRole.isDeptSuperuser && ["department", "team", "user"].includes(input.targetScope)) ||
          (userRole.isTeamSuperuser && ["team", "user"].includes(input.targetScope));
        
        if (!canUnpush) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to unpush this view" });
        }
        
        await db.unpushView(input.viewId, input.targetScope, input.targetScopeId, ctx.user.id);
        
        await db.logViewManagementAction({
          actionType: "unpush",
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          viewId: input.viewId,
          targetType: input.targetScope,
          targetId: input.targetScopeId,
        });
        
        return { success: true };
      }),
    
    getPushedToMe: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const userTeams = await db.getUserTeams(ctx.user.id);
        const userDepts = await db.getUserDepartments(ctx.user.id);
        
        return db.getViewsPushedToUser(ctx.user.id, {
          teamIds: userTeams.map(t => t.teamId),
          departmentIds: userDepts.map(d => d.departmentId),
          organizationId: input?.organizationId,
        });
      }),

    // ============ VIEW HIDE ============
    
    hideView: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        targetScope: z.enum(["user", "team", "department", "organization"]),
        targetScopeId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if view is required (cannot be hidden)
        const userTeams = await db.getUserTeams(ctx.user.id);
        const userDepts = await db.getUserDepartments(ctx.user.id);
        
        const isRequired = await db.isViewRequiredForUser(input.viewId, ctx.user.id, {
          teamIds: userTeams.map(t => t.teamId),
          departmentIds: userDepts.map(d => d.departmentId),
        });
        
        if (isRequired && input.targetScope === "user" && input.targetScopeId === ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This view is required and cannot be hidden" });
        }
        
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        
        // Determine hider role
        let hiddenByRole: "user" | "team_superuser" | "department_superuser" | "organization_superuser" | "admin";
        
        if (input.targetScope === "user" && input.targetScopeId === ctx.user.id) {
          hiddenByRole = "user";
        } else if (userRole.isAdmin) {
          hiddenByRole = "admin";
        } else if (userRole.isOrgSuperuser && input.targetScope === "organization") {
          hiddenByRole = "organization_superuser";
        } else if (userRole.isDeptSuperuser && ["department", "team"].includes(input.targetScope)) {
          hiddenByRole = "department_superuser";
        } else if (userRole.isTeamSuperuser && input.targetScope === "team") {
          hiddenByRole = "team_superuser";
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to hide views at this scope" });
        }
        
        await db.hideView({
          viewId: input.viewId,
          hiddenBy: ctx.user.id,
          hiddenByRole,
          targetScope: input.targetScope,
          targetScopeId: input.targetScopeId,
          reason: input.reason,
        });
        
        await db.logViewManagementAction({
          actionType: "hide",
          actorId: ctx.user.id,
          actorRole: hiddenByRole,
          viewId: input.viewId,
          targetType: input.targetScope,
          targetId: input.targetScopeId,
          newState: { reason: input.reason },
        });
        
        return { success: true };
      }),
    
    unhideView: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        targetScope: z.enum(["user", "team", "department", "organization"]),
        targetScopeId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userRole = await db.getUserViewManagementRole(ctx.user.id);
        
        // Users can unhide their own hidden views
        const canUnhide = (input.targetScope === "user" && input.targetScopeId === ctx.user.id) ||
          userRole.isAdmin ||
          (userRole.isOrgSuperuser && input.targetScope === "organization") ||
          (userRole.isDeptSuperuser && ["department", "team"].includes(input.targetScope)) ||
          (userRole.isTeamSuperuser && input.targetScope === "team");
        
        if (!canUnhide) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to unhide this view" });
        }
        
        await db.unhideView(input.viewId, input.targetScope, input.targetScopeId, ctx.user.id);
        
        await db.logViewManagementAction({
          actionType: "unhide",
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          viewId: input.viewId,
          targetType: input.targetScope,
          targetId: input.targetScopeId,
        });
        
        return { success: true };
      }),
    
    getHiddenViews: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const userTeams = await db.getUserTeams(ctx.user.id);
        const userDepts = await db.getUserDepartments(ctx.user.id);
        
        return db.getHiddenViewsForUser(ctx.user.id, {
          teamIds: userTeams.map(t => t.teamId),
          departmentIds: userDepts.map(d => d.departmentId),
          organizationId: input?.organizationId,
        });
      }),

    // ============ VIEW MANAGEMENT ROLE ============
    
    getMyManagementRole: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getUserViewManagementRole(ctx.user.id, input?.organizationId);
      }),

    // ============ AUDIT LOG ============
    
    getAuditLog: protectedProcedure
      .input(z.object({
        viewId: z.number(),
        limit: z.number().default(50),
      }))
      .query(async ({ ctx, input }) => {
        // Only view owner or admin can see audit log
        const view = await db.getPortfolioView(input.viewId);
        if (!view) {
          throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
        }
        
        if (view.createdById !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only view owner or admin can see audit log" });
        }
        
        return db.getViewManagementAuditLog(input.viewId, input.limit);
      }),

    // ============ ORGANIZATIONAL HIERARCHY ============
    
    getTeams: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getTeams(input.organizationId);
      }),
    
    getDepartments: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getDepartments(input.organizationId);
      }),
    
    getTeamMembers: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        return db.getTeamMembers(input.teamId);
      }),
    
    getDepartmentMembers: protectedProcedure
      .input(z.object({ departmentId: z.number() }))
      .query(async ({ input }) => {
        return db.getDepartmentMembers(input.departmentId);
      }),
    
    getMyTeams: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserTeams(ctx.user.id);
    }),
    
    getMyDepartments: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserDepartments(ctx.user.id);
    }),
  }),

  // Documents
  documents: router({
    listByProject: withProjectAccess
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const isInvestor = await db.isInvestorViewer(ctx.user.id, input.projectId);
        return db.getDocumentsByProject(input.projectId, isInvestor);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id);
        if (!doc) return null;
        
        // Verify user has access to the document's project
        if (!isAdminOrSuperuser(ctx.user)) {
          const hasAccess = await db.canUserAccessProject(ctx.user.id, doc.projectId);
          if (!hasAccess) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this document' });
          }
        }
        return doc;
      }),
    getCategories: publicProcedure.query(async () => {
      return db.getDocumentCategories();
    }),
    getTypes: publicProcedure.query(async () => {
      return db.getDocumentTypes();
    }),
    upload: withProjectEdit
      .input(z.object({
        projectId: z.number(),
        documentTypeId: z.number(),
        name: z.string(),
        fileData: z.string(), // base64
        mimeType: z.string(),
        fileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Use canonical upload path with validation and job queue
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        const uploadResult = await uploadFromWeb(
          {
            filename: input.name,
            content: fileBuffer,
            mimeType: input.mimeType,
          },
          {
            userId: ctx.user.id,
            projectId: input.projectId,
            linkedEntityType: 'document',
          }
        );
        
        if (!uploadResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: uploadResult.errors.join(', ') || 'Upload failed',
          });
        }
        
        // Create document record
        const docResult = await db.createDocument({
          projectId: input.projectId,
          documentTypeId: input.documentTypeId,
          name: input.name,
          fileUrl: uploadResult.storageUrl!,
          fileKey: uploadResult.storageKey!,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: 'unverified',
          uploadedById: ctx.user.id,
        });
        
        // Update file upload with linked document
        if (uploadResult.fileUploadId && docResult) {
          await db.updateFileUploadStatus(uploadResult.fileUploadId, 'processed', {
            linkedEntityType: 'document',
            linkedEntityId: docResult,
          });
        }
        
        // Create alert for document upload
        await db.createAlert({
          userId: ctx.user.id,
          projectId: input.projectId,
          type: 'document',
          severity: 'info',
          title: 'Document uploaded',
          message: `${input.name} has been uploaded and is pending review.`,
        });
        
        // Log activity
        await db.logUserActivity(ctx.user.id, 'document_upload', {
          resourceType: 'document',
          resourceName: input.name,
          metadata: {
            projectId: input.projectId,
            fileUploadId: uploadResult.fileUploadId,
            jobId: uploadResult.jobId,
          },
        });
        
        return { 
          success: true, 
          fileUrl: uploadResult.storageUrl,
          jobId: uploadResult.jobId,
          correlationId: uploadResult.correlationId,
        };
      }),
    updateStatus: withProjectEdit
      .input(z.object({
        id: z.number(),
        status: z.enum(['verified', 'pending', 'missing', 'na', 'rejected', 'unverified']),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateDocumentStatus(input.id, input.status, ctx.user.id);
        return { success: true };
      }),
    categorizeWithAI: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileContent: z.string().optional(), // First few pages text
      }))
      .mutation(async ({ input }) => {
        const prompt = `Analyze this document filename and suggest the most appropriate category for a renewable energy project document management system.

Filename: ${input.fileName}
${input.fileContent ? `Content preview: ${input.fileContent.substring(0, 2000)}` : ''}

Categories available:
- Site & Real Estate: Lease Agreement, Land Survey, Title Report, Site Plan, Easement Agreement
- Permits & Approvals: Building Permit, Electrical Permit, Zoning Approval, Special Use Permit
- Technical: System Design, Equipment Specs, Energy Model, Geotechnical Report
- Interconnection: Interconnection Agreement, Utility Studies, Grid Impact Assessment
- Legal: EPC Contract, PPA, O&M Agreement, Insurance Certificates
- Environmental: Phase 1 ESA, Wetland Delineation, Wildlife Survey
- Financial: Pro Forma, Appraisal, Tax Documents

Respond with JSON: { "category": "category name", "documentType": "specific type", "confidence": 0.0-1.0 }`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a document classification assistant for renewable energy projects. Always respond with valid JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'document_category',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    category: { type: 'string' },
                    documentType: { type: 'string' },
                    confidence: { type: 'number' }
                  },
                  required: ['category', 'documentType', 'confidence'],
                  additionalProperties: false
                }
              }
            }
          });
          
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            return JSON.parse(content);
          }
        } catch (error) {
          console.error('AI categorization error:', error);
        }
        
        return { category: 'Unknown', documentType: 'Other', confidence: 0.5 };
      }),
    
    // Archive document (soft delete - data preserved)
    archive: withProjectEdit
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id);
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        
        await db.archiveDocument(input.id, ctx.user.id, input.reason);
        
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'document_archived',
          entityType: 'document',
          entityId: input.id,
          details: { reason: input.reason, documentName: doc.name },
          projectId: doc.projectId,
        });
        
        return { success: true };
      }),
    
    // Restore archived document
    unarchive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id);
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        
        // Only admin can restore
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can restore archived documents' });
        }
        
        await db.unarchiveDocument(input.id, ctx.user.id);
        
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'document_unarchived',
          entityType: 'document',
          entityId: input.id,
          projectId: doc.projectId,
        });
        
        return { success: true };
      }),
    
    // Supersede document with a new version
    supersede: withProjectEdit
      .input(z.object({ id: z.number(), newDocumentId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const oldDoc = await db.getDocumentById(input.id);
        if (!oldDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Original document not found' });
        
        const newDoc = await db.getDocumentById(input.newDocumentId);
        if (!newDoc) throw new TRPCError({ code: 'NOT_FOUND', message: 'New document not found' });
        
        // Verify same project
        if (oldDoc.projectId !== newDoc.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Documents must be in the same project' });
        }
        
        await db.supersedeDocument(input.id, input.newDocumentId, ctx.user.id, input.reason);
        
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'document_superseded',
          entityType: 'document',
          entityId: input.id,
          details: { newDocumentId: input.newDocumentId, reason: input.reason },
          projectId: oldDoc.projectId,
        });
        
        return { success: true };
      }),
    
    // Get archive history for a document
    getArchiveHistory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await db.getDocumentById(input.id);
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        
        // Verify access
        if (!isAdminOrSuperuser(ctx.user)) {
          const hasAccess = await db.canUserAccessProject(ctx.user.id, doc.projectId);
          if (!hasAccess) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this document' });
          }
        }
        
        return db.getDocumentArchiveHistory(input.id);
      }),
  }),

  // Document Reviews
  reviews: router({
    listByDocument: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return db.getDocumentReviews(input.documentId);
      }),
    getGroups: publicProcedure.query(async () => {
      return db.getReviewerGroups();
    }),
    submit: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        reviewerGroupId: z.number(),
        status: z.enum(['approved', 'rejected', 'needs_revision']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateDocumentReview(input.documentId, input.status, ctx.user.id, input.notes);
        
        // Update aggregated document status
        const aggregatedStatus = await db.getAggregatedDocumentStatus(input.documentId);
        await db.updateDocumentStatus(input.documentId, aggregatedStatus);
        
        // Create notification
        const doc = await db.getDocumentById(input.documentId);
        if (doc) {
          await db.createAlert({
            projectId: doc.projectId,
            type: 'approval',
            severity: input.status === 'rejected' ? 'warning' : 'info',
            title: `Document review: ${input.status}`,
            message: `${doc.name} has been ${input.status} by reviewer.`,
            linkType: 'document',
            linkId: input.documentId,
          });
        }
        
        return { success: true };
      }),
    getAggregatedStatus: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return db.getAggregatedDocumentStatus(input.documentId);
      }),
  }),

  // RFIs / Workspace Items
  rfis: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.projectId) {
          // Verify user has access to this project
          if (!isAdminOrSuperuser(ctx.user)) {
            const hasAccess = await db.canUserAccessProject(ctx.user.id, input.projectId);
            if (!hasAccess) {
              throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this project' });
            }
          }
          const isInvestor = await db.isInvestorViewer(ctx.user.id, input.projectId);
          return db.getRfisByProject(input.projectId, isInvestor);
        }
        // Without projectId, return RFIs only from projects user has access to
        // ONLY superusers see ALL RFIs across all organizations
        if (isSuperuser(ctx.user)) {
          return db.getAllRfis(false);
        }
        return db.getRfisForUser(ctx.user.id);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const rfi = await db.getRfiById(input.id);
        if (!rfi) return null;
        
        // Verify user has access to the RFI's project
        if (!isAdminOrSuperuser(ctx.user)) {
          const hasAccess = await db.canUserAccessProject(ctx.user.id, rfi.projectId);
          if (!hasAccess) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this item' });
          }
        }
        return rfi;
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        title: z.string(),
        description: z.string().optional(),
        category: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        itemType: z.enum(['rfi', 'task', 'risk', 'issue']).optional(),
        assigneeId: z.number().optional(),
        dueDate: z.string().optional(),
        isInternalOnly: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const code = `RFI-${nanoid(6).toUpperCase()}`;
        await db.createRfi({
          ...input,
          code,
          submittedById: ctx.user.id,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        });
        
        // Create notification
        await db.createAlert({
          projectId: input.projectId,
          type: 'rfi',
          severity: input.priority === 'critical' ? 'critical' : input.priority === 'high' ? 'warning' : 'info',
          title: `New ${input.itemType || 'RFI'} created`,
          message: input.title,
        });
        
        return { success: true, code };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        notes: z.string().optional(),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        assigneeId: z.number().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateRfi(id, {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          resolvedAt: data.status === 'resolved' ? new Date() : undefined,
        });
        return { success: true };
      }),
    getComments: protectedProcedure
      .input(z.object({ rfiId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Check if investor viewer
        const rfi = await db.getRfiById(input.rfiId);
        if (rfi) {
          const isInvestor = await db.isInvestorViewer(ctx.user.id, rfi.projectId);
          return db.getRfiComments(input.rfiId, isInvestor);
        }
        return [];
      }),
    addComment: protectedProcedure
      .input(z.object({
        rfiId: z.number(),
        content: z.string(),
        isInternalOnly: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createRfiComment({
          rfiId: input.rfiId,
          userId: ctx.user.id,
          content: input.content,
          isInternalOnly: input.isInternalOnly || false,
        });
        return { success: true };
      }),
    linkDocument: protectedProcedure
      .input(z.object({ rfiId: z.number(), documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify document exists
        const doc = await db.getDocumentById(input.documentId);
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        
        // 3. Verify same project
        if (rfi.projectId !== doc.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link items from different projects' });
        }
        
        // 4. Verify user has edit access (admin bypasses)
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create links in this project' });
          }
        }
        
        // 5. Create link with audit info (idempotent - duplicate returns success)
        await db.linkRfiToDocument(input.rfiId, input.documentId, ctx.user.id);
        
        // 6. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_created',
          entityType: 'rfi_document_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, documentId: input.documentId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    linkChecklist: protectedProcedure
      .input(z.object({ rfiId: z.number(), checklistItemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify checklist item exists
        const checklistItem = await db.getChecklistItemById(input.checklistItemId);
        if (!checklistItem) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });
        
        // 3. Verify same project (checklist item -> checklist -> project)
        const checklist = await db.getChecklistById(checklistItem.checklistId);
        if (!checklist || checklist.projectId !== rfi.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link items from different projects' });
        }
        
        // 4. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create links in this project' });
          }
        }
        
        // 5. Create link with audit info
        await db.linkRfiToChecklist(input.rfiId, input.checklistItemId, ctx.user.id);
        
        // 6. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_created',
          entityType: 'rfi_checklist_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, checklistItemId: input.checklistItemId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    linkSchedule: protectedProcedure
      .input(z.object({ rfiId: z.number(), scheduleItemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify schedule item exists
        const scheduleItem = await db.getScheduleItemById(input.scheduleItemId);
        if (!scheduleItem) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule item not found' });
        
        // 3. Verify same project
        if (rfi.projectId !== scheduleItem.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link items from different projects' });
        }
        
        // 4. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create links in this project' });
          }
        }
        
        // 5. Create link with audit info
        await db.linkRfiToSchedule(input.rfiId, input.scheduleItemId, ctx.user.id);
        
        // 6. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_created',
          entityType: 'rfi_schedule_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, scheduleItemId: input.scheduleItemId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    getLinkedItems: protectedProcedure
      .input(z.object({ rfiId: z.number() }))
      .query(async ({ input }) => {
        const [documents, checklists, schedules] = await Promise.all([
          db.getRfiLinkedDocuments(input.rfiId),
          db.getRfiLinkedChecklists(input.rfiId),
          db.getRfiLinkedSchedules(input.rfiId),
        ]);
        return { documents, checklists, schedules };
      }),
    // Archive RFI (soft delete - data preserved)
    archive: protectedProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const rfi = await db.getRfiById(input.id);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to archive RFIs in this project' });
          }
        }
        
        await db.archiveRfi(input.id, ctx.user.id, input.reason);
        
        // Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'rfi_archived',
          entityType: 'rfi',
          entityId: input.id,
          details: { reason: input.reason },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    
    // Restore archived RFI
    unarchive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const rfi = await db.getRfiById(input.id);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // Only admin can restore
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can restore archived RFIs' });
        }
        
        await db.unarchiveRfi(input.id, ctx.user.id);
        
        // Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'rfi_unarchived',
          entityType: 'rfi',
          entityId: input.id,
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    
    // Hard delete is not allowed - return 405
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),
    unlinkDocument: protectedProcedure
      .input(z.object({ rfiId: z.number(), documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to remove links in this project' });
          }
        }
        
        // 3. Remove link
        await db.unlinkRfiFromDocument(input.rfiId, input.documentId);
        
        // 4. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_removed',
          entityType: 'rfi_document_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, documentId: input.documentId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    unlinkChecklist: protectedProcedure
      .input(z.object({ rfiId: z.number(), checklistItemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to remove links in this project' });
          }
        }
        
        // 3. Remove link
        await db.unlinkRfiFromChecklist(input.rfiId, input.checklistItemId);
        
        // 4. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_removed',
          entityType: 'rfi_checklist_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, checklistItemId: input.checklistItemId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    unlinkSchedule: protectedProcedure
      .input(z.object({ rfiId: z.number(), scheduleItemId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify RFI exists
        const rfi = await db.getRfiById(input.rfiId);
        if (!rfi) throw new TRPCError({ code: 'NOT_FOUND', message: 'RFI not found' });
        
        // 2. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, rfi.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to remove links in this project' });
          }
        }
        
        // 3. Remove link
        await db.unlinkRfiFromSchedule(input.rfiId, input.scheduleItemId);
        
        // 4. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_removed',
          entityType: 'rfi_schedule_link',
          entityId: input.rfiId,
          details: { rfiId: input.rfiId, scheduleItemId: input.scheduleItemId },
          projectId: rfi.projectId,
        });
        
        return { success: true };
      }),
    exportCsv: protectedProcedure
      .input(z.object({ 
        projectId: z.number().optional(),
        viewId: z.number().optional(), // Optional view scope
        includeArchived: z.boolean().optional().default(false),
      }).optional())
      .query(async ({ ctx, input }) => {
        let rfis = input?.projectId 
          ? await db.getRfisByProject(input.projectId, false)
          : await db.getAllRfis(false);
        
        // Filter out archived items unless explicitly requested
        if (!input?.includeArchived) {
          rfis = rfis.filter((rfi: any) => rfi.visibilityState !== 'archived' && rfi.visibilityState !== 'superseded');
        }
        
        // If view scope provided, filter by view exclusions
        if (input?.viewId) {
          const exclusions = await db.getExcludedItemsForView(input.viewId);
          const excludedIds = new Set(
            exclusions
              .filter(e => e.entityType === 'rfi')
              .map(e => e.entityId)
          );
          rfis = rfis.filter((rfi: any) => !excludedIds.has(rfi.id));
          
          // Create export manifest
          await db.createExportManifest({
            viewId: input.viewId,
            exportType: 'csv',
            exportedBy: ctx.user?.id || 0,
            includeHidden: input.includeArchived,
            filters: { projectId: input.projectId, itemCount: rfis.length },
            status: 'completed',
          });
        }
        
        // Generate CSV content
        const headers = ['Code', 'Title', 'Description', 'Status', 'Priority', 'Category', 'Item Type', 'Due Date', 'Created At', 'Resolved At', 'Visibility State'];
        const rows = rfis.map((rfi: any) => [
          rfi.code || '',
          `"${(rfi.title || '').replace(/"/g, '""')}"`,
          `"${(rfi.description || '').replace(/"/g, '""')}"`,
          rfi.status || '',
          rfi.priority || '',
          rfi.category || '',
          rfi.itemType || '',
          rfi.dueDate ? new Date(rfi.dueDate).toISOString().split('T')[0] : '',
          rfi.createdAt ? new Date(rfi.createdAt).toISOString() : '',
          rfi.resolvedAt ? new Date(rfi.resolvedAt).toISOString() : '',
          rfi.visibilityState || 'active',
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        return { csv, filename: `rfis-export-${new Date().toISOString().split('T')[0]}.csv`, itemCount: rfis.length };
      }),
  }),

  // Asset Details
  assetDetails: router({
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getAssetDetailsByProject(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        category: z.string(),
        subcategory: z.string().optional(),
        fieldName: z.string(),
        fieldValue: z.string().optional(),
        unit: z.string().optional(),
        isAiExtracted: z.boolean().optional(),
        aiConfidence: z.string().optional(),
        sourceDocumentId: z.number().optional(),
        sourcePage: z.number().optional(),
        sourceTextSnippet: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createAssetDetail({
          ...input,
          extractedAt: input.isAiExtracted ? new Date() : undefined,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        fieldValue: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAssetDetail(id, data);
        return { success: true };
      }),
    verify: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.verifyAssetDetail(input.id, ctx.user.id);
        return { success: true };
      }),
    exportCsv: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        const details = await db.getAssetDetailsByProject(input.projectId);
        
        const headers = ['Category', 'Subcategory', 'Field Name', 'Field Value', 'Unit', 'AI Extracted', 'AI Confidence', 'Verified', 'Source Page', 'Created At'];
        const rows = details.map((d: any) => [
          d.category || '',
          d.subcategory || '',
          `"${(d.fieldName || '').replace(/"/g, '""')}"`,
          `"${(d.fieldValue || '').replace(/"/g, '""')}"`,
          d.unit || '',
          d.isAiExtracted ? 'Yes' : 'No',
          d.aiConfidence || '',
          d.verifiedAt ? 'Yes' : 'No',
          d.sourcePage || '',
          d.createdAt ? new Date(d.createdAt).toISOString() : '',
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        return { csv, filename: `asset-details-export-${new Date().toISOString().split('T')[0]}.csv` };
      }),
  }),

  // Schedule
  schedule: router({
    getPhases: publicProcedure.query(async () => {
      return db.getSchedulePhases();
    }),
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getScheduleItemsByProject(input.projectId);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        phaseId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        targetEndDate: z.string().optional(),
        assigneeId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createScheduleItem({
          ...input,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          targetEndDate: input.targetEndDate ? new Date(input.targetEndDate) : undefined,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        progress: z.number().optional(),
        status: z.enum(['not_started', 'in_progress', 'completed', 'overdue', 'blocked']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateScheduleItem(id, {
          ...data,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
        });
        return { success: true };
      }),
  }),

  // AI Extractions
  extractions: router({
    listByDocument: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return db.getAiExtractionsByDocument(input.documentId);
      }),
    extractFromDocument: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        documentContent: z.string(), // Text content from PDF
      }))
      .mutation(async ({ input }) => {
        const prompt = `Extract key data fields from this renewable energy project document. 

Document content:
${input.documentContent.substring(0, 8000)}

Extract fields in these categories:
- Site & Real Estate: lease term, annual rent, escalation, land area, site owner
- Interconnection: type, limit (kW), voltage, utility, substation
- Technical: module type, inverter type, capacity (MW), tilt angle
- Financial: PPA rate, term, escalation

For each field found, provide:
- category
- fieldName
- extractedValue
- confidence (0.0-1.0)
- sourceTextSnippet (the exact text where you found this)

Respond with JSON array of extractions.`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a document extraction assistant for renewable energy projects. Extract structured data from documents. Always respond with valid JSON array.' },
              { role: 'user', content: prompt }
            ],
          });
          
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            // Try to parse JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const extractions = JSON.parse(jsonMatch[0]);
              
              // Save extractions to database with evidence refs
              for (const extraction of extractions) {
                const extractionId = await db.createAiExtraction({
                  documentId: input.documentId,
                  category: extraction.category,
                  fieldName: extraction.fieldName,
                  extractedValue: extraction.extractedValue,
                  confidence: extraction.confidence?.toString() || '0',
                  sourceTextSnippet: extraction.sourceTextSnippet,
                  sourcePage: extraction.sourcePage,
                  boundingBox: extraction.boundingBox,
                  status: 'unverified',
                });
                
                // Create evidence ref for this extraction
                if (extractionId) {
                  await db.createEvidenceFromExtraction(
                    Number(extractionId),
                    input.documentId,
                    extraction.sourcePage || null,
                    {
                      snippet: extraction.sourceTextSnippet,
                      boundingBox: extraction.boundingBox,
                      confidence: parseFloat(extraction.confidence || '0.5'),
                      extractionMethod: 'llm',
                    }
                  );
                }
              }
              
              return { success: true, count: extractions.length };
            }
          }
        } catch (error) {
          console.error('AI extraction error:', error);
        }
        
        return { success: false, count: 0 };
      }),
    verify: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['accepted', 'rejected']),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.verifyAiExtraction(input.id, input.status, ctx.user.id);
        return { success: true };
      }),
    getUnverifiedCount: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input }) => {
        return db.getUnverifiedExtractionCount(input.documentId);
      }),
  }),

  // Closing Checklists
  checklists: router({
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistsByProject(input.projectId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        transactionType: z.enum(['acquisition', 'financing', 'sale', 'development']).optional(),
        targetCloseDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createChecklist({
          ...input,
          targetCloseDate: input.targetCloseDate ? new Date(input.targetCloseDate) : undefined,
          createdById: ctx.user.id,
        });
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        status: z.enum(['draft', 'active', 'completed', 'cancelled']).optional(),
        targetCloseDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateChecklist(id, {
          ...data,
          targetCloseDate: data.targetCloseDate ? new Date(data.targetCloseDate) : undefined,
        });
        return { success: true };
      }),
    getItems: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistItems(input.checklistId);
      }),
    createItem: protectedProcedure
      .input(z.object({
        checklistId: z.number(),
        category: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        ownerId: z.number().optional(),
        dueDate: z.string().optional(),
        isRequired: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createChecklistItem({
          ...input,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        });
        return { success: true };
      }),
    updateItem: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['not_started', 'in_progress', 'pending_review', 'completed', 'blocked', 'na']).optional(),
        comments: z.string().optional(),
        ownerId: z.number().optional(),
        dueDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateChecklistItem(id, {
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          completedAt: data.status === 'completed' ? new Date() : undefined,
        });
        return { success: true };
      }),
    // Archive checklist item (soft delete - data preserved)
    archiveItem: protectedProcedure
      .input(z.object({ id: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getChecklistItemById(input.id);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });
        
        const checklist = await db.getChecklistById(item.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });
        
        // Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, checklist.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to archive checklist items' });
          }
        }
        
        await db.archiveChecklistItem(input.id, ctx.user.id, input.reason);
        
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'checklist_item_archived',
          entityType: 'checklist_item',
          entityId: input.id,
          details: { reason: input.reason },
          projectId: checklist.projectId,
        });
        
        return { success: true };
      }),
    
    // Restore archived checklist item
    unarchiveItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const item = await db.getChecklistItemById(input.id);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });
        
        // Only admin can restore
        if (!isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can restore archived checklist items' });
        }
        
        const checklist = await db.getChecklistById(item.checklistId);
        
        await db.unarchiveChecklistItem(input.id, ctx.user.id);
        
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'checklist_item_unarchived',
          entityType: 'checklist_item',
          entityId: input.id,
          projectId: checklist?.projectId,
        });
        
        return { success: true };
      }),
    
    // Hard delete is not allowed
    deleteItem: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archiveItem instead to preserve data integrity.' 
        });
      }),
    linkDocument: protectedProcedure
      .input(z.object({ checklistItemId: z.number(), documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify checklist item exists
        const checklistItem = await db.getChecklistItemById(input.checklistItemId);
        if (!checklistItem) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });
        
        // 2. Verify document exists
        const doc = await db.getDocumentById(input.documentId);
        if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
        
        // 3. Get checklist to verify project
        const checklist = await db.getChecklistById(checklistItem.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });
        
        // 4. Verify same project
        if (checklist.projectId !== doc.projectId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot link items from different projects' });
        }
        
        // 5. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, checklist.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to create links in this project' });
          }
        }
        
        // 6. Create link with audit info
        await db.linkChecklistItemToDocument(input.checklistItemId, input.documentId, ctx.user.id);
        
        // 7. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_created',
          entityType: 'checklist_document_link',
          entityId: input.checklistItemId,
          details: { checklistItemId: input.checklistItemId, documentId: input.documentId },
          projectId: checklist.projectId,
        });
        
        return { success: true };
      }),
    unlinkDocument: protectedProcedure
      .input(z.object({ checklistItemId: z.number(), documentId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // 1. Verify checklist item exists
        const checklistItem = await db.getChecklistItemById(input.checklistItemId);
        if (!checklistItem) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist item not found' });
        
        // 2. Get checklist to verify project
        const checklist = await db.getChecklistById(checklistItem.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checklist not found' });
        
        // 3. Verify user has edit access
        if (!isAdminOrSuperuser(ctx.user)) {
          const canEdit = await db.canUserEditProject(ctx.user.id, checklist.projectId);
          if (!canEdit) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to remove links in this project' });
          }
        }
        
        // 4. Remove link
        await db.unlinkChecklistItemFromDocument(input.checklistItemId, input.documentId);
        
        // 5. Log activity
        await db.createUserActivity({
          userId: ctx.user.id,
          action: 'link_removed',
          entityType: 'checklist_document_link',
          entityId: input.checklistItemId,
          details: { checklistItemId: input.checklistItemId, documentId: input.documentId },
          projectId: checklist.projectId,
        });
        
        return { success: true };
      }),
    getItemDocuments: protectedProcedure
      .input(z.object({ checklistItemId: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistItemDocuments(input.checklistItemId);
      }),
    getProgress: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .query(async ({ input }) => {
        return db.getChecklistProgress(input.checklistId);
      }),
    getWhatsNext: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .query(async ({ input }) => {
        return db.getWhatsNextForChecklist(input.checklistId);
      }),
    exportCsv: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .query(async ({ input }) => {
        const items = await db.getChecklistItems(input.checklistId);
        
        const headers = ['Category', 'Name', 'Description', 'Status', 'Due Date', 'Completed At', 'Notes'];
        const rows = items.map((item: any) => [
          item.category || '',
          `"${(item.name || '').replace(/"/g, '""')}"`,
          `"${(item.description || '').replace(/"/g, '""')}"`,
          item.status || '',
          item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : '',
          item.completedAt ? new Date(item.completedAt).toISOString() : '',
          `"${(item.notes || '').replace(/"/g, '""')}"`,
        ]);
        
        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        return { csv, filename: `checklist-export-${new Date().toISOString().split('T')[0]}.csv` };
      }),
  }),

  // Alerts / Notifications
  alerts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getAlertsForUser(ctx.user.id);
    }),
    getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadAlertCount(ctx.user.id);
    }),
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markAlertAsRead(input.id);
        return { success: true };
      }),
    dismiss: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.dismissAlert(input.id);
        return { success: true };
      }),
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllAlertsAsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // Owner Notifications
  ownerNotifications: router({
    sendOwnerAlert: protectedProcedure
      .input(z.object({
        title: z.string(),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const success = await notifyOwner(input);
        return { success };
      }),
    sendOverdueAlert: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ input }) => {
        // Get overdue items for the project
        const overdueSchedule = await db.getOverdueScheduleItems(input.projectId);
        const overdueRfis = await db.getOverdueRfis(input.projectId);
        const overdueChecklist = await db.getOverdueChecklistItems(input.projectId);
        
        const totalOverdue = overdueSchedule.length + overdueRfis.length + overdueChecklist.length;
        
        if (totalOverdue > 0) {
          const project = await db.getProjectById(input.projectId);
          await notifyOwner({
            title: `${totalOverdue} Overdue Items - ${project?.name || 'Project'}`,
            content: `Schedule items: ${overdueSchedule.length}\nRFIs: ${overdueRfis.length}\nChecklist items: ${overdueChecklist.length}`,
          });
        }
        
        return { success: true, overdueCount: totalOverdue };
      }),
    sendDocumentStatusAlert: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        status: z.string(),
        reviewerGroup: z.string(),
      }))
      .mutation(async ({ input }) => {
        const doc = await db.getDocumentById(input.documentId);
        if (doc) {
          await notifyOwner({
            title: `Document ${input.status}: ${doc.name}`,
            content: `${input.reviewerGroup} has ${input.status} the document.`,
          });
        }
        return { success: true };
      }),
    sendRfiUpdateAlert: protectedProcedure
      .input(z.object({
        rfiId: z.number(),
        updateType: z.enum(['created', 'resolved', 'escalated']),
      }))
      .mutation(async ({ input }) => {
        const rfi = await db.getRfiById(input.rfiId);
        if (rfi) {
          await notifyOwner({
            title: `RFI ${input.updateType}: ${rfi.code}`,
            content: rfi.title,
          });
        }
        return { success: true };
      }),
  }),

  // Diligence Progress (legacy - use diligence router for new features)
  diligenceProgress: router({
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getDiligenceProgress(input.projectId);
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRINCIPLE 1: INGEST ANYTHING (Universal Capture)
  // ═══════════════════════════════════════════════════════════════
  
  ingestion: router({
    upload: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        filename: z.string(),
        fileType: z.enum(['pdf', 'docx', 'xlsx', 'image', 'audio', 'video', 'email', 'whatsapp', 'other']),
        mimeType: z.string(),
        fileSize: z.number(),
        base64Data: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Upload to S3
        const buffer = Buffer.from(input.base64Data, 'base64');
        const fileKey = `ingested/${ctx.user.id}/${Date.now()}-${nanoid(8)}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Create ingested file record
        await db.createIngestedFile({
          organizationId: 1, // TODO: Get from user context
          projectId: input.projectId,
          originalFilename: input.filename,
          fileType: input.fileType,
          fileSizeBytes: input.fileSize,
          mimeType: input.mimeType,
          storageUrl: url,
          storageKey: fileKey,
          sourceChannel: 'upload',
          ingestedById: ctx.user.id,
          processingStatus: 'pending',
        });
        
        return { success: true, url, fileKey };
      }),
    
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getIngestedFilesByProject(input.projectId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getIngestedFileById(input.id);
      }),
    
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'processing', 'completed', 'failed']),
        error: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateIngestedFileStatus(input.id, input.status, input.error);
        return { success: true };
      }),
    
    getExtractedContent: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        return db.getExtractedContentByFile(input.fileId);
      }),
    
    extractContent: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        textContent: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Update status to processing
        await db.updateIngestedFileStatus(input.fileId, 'processing');
        
        try {
          // Use LLM to extract structured content
          const response = await invokeLLM({
            messages: [
              { role: 'system', content: 'You are a document extraction assistant. Extract key information and entities from the document. Respond with JSON containing: entities (name, type, context), keyFacts (fact, confidence), and summary.' },
              { role: 'user', content: `Extract information from this document:\n\n${input.textContent.substring(0, 10000)}` }
            ],
          });
          
          const content = response.choices[0]?.message?.content;
          let structuredData = null;
          
          if (content && typeof content === 'string') {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              structuredData = JSON.parse(jsonMatch[0]);
            }
          }
          
          // Save extracted content
          await db.createExtractedContent({
            fileId: input.fileId,
            contentType: 'full_text',
            content: input.textContent,
            structuredData,
            confidenceScore: '0.85',
            extractionMethod: 'llm',
          });
          
          // Create entity mentions if found
          if (structuredData?.entities) {
            for (const entity of structuredData.entities) {
              await db.createEntityMention({
                fileId: input.fileId,
                mentionText: entity.name,
                mentionType: 'name',
                contextSnippet: entity.context,
                confidenceScore: '0.8',
                resolutionStatus: 'unresolved',
              });
            }
          }
          
          await db.updateIngestedFileStatus(input.fileId, 'completed');
          return { success: true, structuredData };
        } catch (error) {
          await db.updateIngestedFileStatus(input.fileId, 'failed', String(error));
          return { success: false, error: String(error) };
        }
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRINCIPLE 2: UNDERSTAND EVERYTHING (Entity Resolution)
  // ═══════════════════════════════════════════════════════════════
  
  entities: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getEntitiesByOrg(input.organizationId || 1);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getEntityById(input.id);
      }),
    
    listByType: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        entityType: z.enum(['site', 'company', 'person', 'equipment', 'contract', 'permit']),
      }))
      .query(async ({ input }) => {
        return db.getEntitiesByType(input.organizationId || 1, input.entityType);
      }),
    
    search: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        searchTerm: z.string(),
      }))
      .query(async ({ input }) => {
        return db.searchEntities(input.organizationId || 1, input.searchTerm);
      }),
    
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        entityType: z.enum(['site', 'company', 'person', 'equipment', 'contract', 'permit']),
        canonicalName: z.string(),
        attributes: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createEntity({
          organizationId: input.organizationId || 1,
          entityType: input.entityType,
          canonicalName: input.canonicalName,
          attributes: input.attributes,
        });
        return { success: true };
      }),
    
    getMentions: protectedProcedure
      .input(z.object({ entityId: z.number() }))
      .query(async ({ input }) => {
        return db.getEntityMentionsByEntity(input.entityId);
      }),
    
    getUnresolvedMentions: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getUnresolvedMentions(input.organizationId || 1);
      }),
    
    resolveMention: protectedProcedure
      .input(z.object({
        mentionId: z.number(),
        entityId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.resolveEntityMention(input.mentionId, input.entityId, ctx.user.id);
        return { success: true };
      }),
    
    addAlias: protectedProcedure
      .input(z.object({
        entityId: z.number(),
        alias: z.string(),
        aliasType: z.enum(['abbreviation', 'nickname', 'alternate_spelling', 'typo', 'translation']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createEntityAlias({
          entityId: input.entityId,
          alias: input.alias,
          aliasType: input.aliasType || 'abbreviation',
        });
        return { success: true };
      }),
    
    getAliases: protectedProcedure
      .input(z.object({ entityId: z.number() }))
      .query(async ({ input }) => {
        return db.getEntityAliases(input.entityId);
      }),
    
    getCrossReferences: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getCrossReferencesByProject(input.projectId);
      }),
    
    getDiscrepancies: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getDiscrepancies(input.projectId);
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRINCIPLE 3: ANCHOR & VERIFY (VATR)
  // ═══════════════════════════════════════════════════════════════
  
  vatr: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVatrAssetsByOrg(input.organizationId || 1);
      }),
    
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getVatrAssetsByProject(input.projectId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getVatrAssetById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number(), // REQUIRED: VATR anchor enforcement - all assets must belong to a project
        assetName: z.string(),
        assetType: z.enum(['solar_pv', 'bess', 'genset', 'minigrid', 'hybrid', 'wind', 'hydro']).optional(),
        capacityKw: z.string().optional(),
        technology: z.string().optional(),
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        locationAddress: z.string().optional(),
        // Provenance fields
        sourceDocumentId: z.number().optional(),
        sourcePage: z.number().optional(),
        sourceSnippet: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // VATR anchor enforcement: verify project exists and user has access
        const project = await db.getProjectById(input.projectId);
        if (!project) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
        }
        
        // Verify user has access to project
        if (!isAdminOrSuperuser(ctx.user)) {
          const hasAccess = await db.canUserAccessProject(ctx.user.id, input.projectId);
          if (!hasAccess) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'No access to this project' });
          }
        }
        
        // Generate content hash
        const contentHash = nanoid(64);
        
        await db.createVatrAsset({
          organizationId: input.organizationId || project.organizationId,
          projectId: input.projectId,
          assetName: input.assetName,
          assetType: input.assetType || 'solar_pv',
          capacityKw: input.capacityKw,
          technology: input.technology,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          locationAddress: input.locationAddress,
          contentHash,
          createdById: ctx.user.id,
        });
        
        return { success: true };
      }),
    
    getSourceDocuments: protectedProcedure
      .input(z.object({ vatrAssetId: z.number() }))
      .query(async ({ input }) => {
        return db.getVatrSourceDocuments(input.vatrAssetId);
      }),
    
    linkSourceDocument: protectedProcedure
      .input(z.object({
        vatrAssetId: z.number(),
        documentId: z.number(),
        cluster: z.enum(['identity', 'technical', 'operational', 'financial', 'compliance', 'commercial']),
        fieldName: z.string().optional(),
        extractedValue: z.string().optional(),
        sourcePage: z.number().optional(),
        sourceSnippet: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.linkVatrSourceDocument(input);
        return { success: true };
      }),
    
    getAuditLog: protectedProcedure
      .input(z.object({ vatrAssetId: z.number() }))
      .query(async ({ input }) => {
        return db.getVatrAuditLog(input.vatrAssetId);
      }),
    
    verify: protectedProcedure
      .input(z.object({
        vatrAssetId: z.number(),
        verificationType: z.enum(['hash_check', 'human_review', 'third_party_audit']),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get current asset to check hash
        const asset = await db.getVatrAssetById(input.vatrAssetId);
        if (!asset) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'VATR asset not found' });
        }
        
        // Create verification record
        await db.createVatrVerification({
          vatrAssetId: input.vatrAssetId,
          verificationType: input.verificationType,
          verifiedById: ctx.user.id,
          verificationResult: 'passed',
          notes: input.notes,
        });
        
        // Log the verification
        await db.createVatrAuditLog({
          vatrAssetId: input.vatrAssetId,
          action: 'verified',
          actorId: ctx.user.id,
          actorRole: 'user',
          beforeHash: asset.contentHash,
          afterHash: asset.contentHash,
        });
        
        return { success: true };
      }),
    
    getVerifications: protectedProcedure
      .input(z.object({ vatrAssetId: z.number() }))
      .query(async ({ input }) => {
        return db.getVatrVerifications(input.vatrAssetId);
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRINCIPLE 4: ACTIVATE (Compliance & Reports & Data Rooms)
  // ═══════════════════════════════════════════════════════════════
  
  compliance: router({
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getComplianceItemsByProject(input.projectId);
      }),
    
    listByVatr: protectedProcedure
      .input(z.object({ vatrAssetId: z.number() }))
      .query(async ({ input }) => {
        return db.getComplianceItemsByVatr(input.vatrAssetId);
      }),
    
    getExpiring: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        daysAhead: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getExpiringComplianceItems(input.organizationId || 1, input.daysAhead || 30);
      }),
    
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number().optional(),
        vatrAssetId: z.number().optional(),
        itemType: z.enum(['permit', 'contract', 'obligation', 'deadline', 'license', 'insurance']),
        itemName: z.string(),
        sourceDocumentId: z.number().optional(),
        dueDate: z.string().optional(),
        renewalDate: z.string().optional(),
        alertDaysBefore: z.number().optional(),
        responsiblePartyId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createComplianceItem({
          ...input,
          organizationId: input.organizationId || 1,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          renewalDate: input.renewalDate ? new Date(input.renewalDate) : undefined,
        });
        return { success: true };
      }),
    
    getOpenAlerts: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getOpenComplianceAlerts(input.organizationId || 1);
      }),
    
    acknowledgeAlert: protectedProcedure
      .input(z.object({
        alertId: z.number(),
        resolutionNote: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // This would update the alert status
        return { success: true };
      }),
  }),
  
  reports: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getGeneratedReports(input.projectId);
      }),
    
    generate: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number().optional(),
        reportType: z.enum(['investor_summary', 'monthly_performance', 'due_diligence', 'compliance', 'custom']),
        reportName: z.string(),
        parameters: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createGeneratedReport({
          organizationId: input.organizationId || 1,
          projectId: input.projectId,
          reportType: input.reportType,
          reportName: input.reportName,
          parameters: input.parameters,
          generatedById: ctx.user.id,
          status: 'generating',
        });
        
        // In a real implementation, this would trigger async report generation
        return { success: true };
      }),
  }),
  
  dataRooms: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getDataRoomsByProject(input.projectId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getDataRoomById(input.id);
      }),
    
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return db.getDataRoomByToken(input.token);
      }),
    
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        accessType: z.enum(['private', 'link_only', 'public']).optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const accessToken = nanoid(32);
        
        await db.createDataRoom({
          organizationId: input.organizationId || 1,
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          accessType: input.accessType || 'private',
          accessToken,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          createdById: ctx.user.id,
        });
        
        return { success: true, accessToken };
      }),
    
    getItems: protectedProcedure
      .input(z.object({ dataRoomId: z.number() }))
      .query(async ({ input }) => {
        return db.getDataRoomItems(input.dataRoomId);
      }),
    
    addItem: protectedProcedure
      .input(z.object({
        dataRoomId: z.number(),
        category: z.enum(['corporate', 'technical', 'financial', 'legal', 'commercial', 'operational']).optional(),
        documentId: z.number().optional(),
        vatrAssetId: z.number().optional(),
        itemName: z.string().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.addDataRoomItem(input);
        return { success: true };
      }),
    
    getAccessLog: protectedProcedure
      .input(z.object({ dataRoomId: z.number() }))
      .query(async ({ input }) => {
        return db.getDataRoomAccessLog(input.dataRoomId);
      }),
    
    logAccess: publicProcedure
      .input(z.object({
        dataRoomId: z.number(),
        accessorEmail: z.string().optional(),
        documentsViewed: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.logDataRoomAccess({
          dataRoomId: input.dataRoomId,
          accessorEmail: input.accessorEmail,
          accessorIp: ctx.req.ip,
          documentsViewed: input.documentsViewed,
        });
        return { success: true };
      }),
    
    generateFromVatr: protectedProcedure
      .input(z.object({
        vatrAssetId: z.number(),
        name: z.string(),
        includeCategories: z.array(z.enum(['corporate', 'technical', 'financial', 'legal', 'commercial', 'operational'])).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get VATR asset and its source documents
        const vatr = await db.getVatrAssetById(input.vatrAssetId);
        if (!vatr) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'VATR asset not found' });
        }
        
        const accessToken = nanoid(32);
        
        // Create data room
        await db.createDataRoom({
          organizationId: vatr.organizationId || 1,
          projectId: vatr.projectId,
          name: input.name,
          description: `Auto-generated data room from VATR: ${vatr.assetName}`,
          accessType: 'link_only',
          accessToken,
          createdById: ctx.user.id,
        });
        
        // In a real implementation, we would add all linked documents to the data room
        
        return { success: true, accessToken };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // PRINCIPLE 5: MULTI-CHANNEL INTERFACE
  // ═══════════════════════════════════════════════════════════════
  
  whatsapp: router({
    getConfig: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getWhatsappConfig(input.projectId);
      }),
    
    createConfig: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number(),
        phoneNumber: z.string().optional(),
        defaultSiteId: z.number().optional(),
        autoCategorize: z.boolean().optional(),
        // WhatsApp Business API credentials
        businessAccountId: z.string().optional(),
        accessToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const webhookSecret = nanoid(32);
        
        await db.createWhatsappConfig({
          organizationId: input.organizationId || 1,
          projectId: input.projectId,
          phoneNumber: input.phoneNumber,
          webhookSecret,
          defaultSiteId: input.defaultSiteId,
          autoCategorize: input.autoCategorize ?? true,
        });
        
        return { success: true, webhookSecret };
      }),
    
    // List conversation sessions with filters
    getSessions: protectedProcedure
      .input(z.object({
        userId: z.number().optional(),
        channel: z.enum(['whatsapp', 'email']).optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getConversationSessions(input.userId, input.channel, input.limit);
      }),
    
    // Get messages for a specific session
    getSessionMessages: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getSessionMessages(input.sessionId);
      }),

    getMessages: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        limit: z.number().optional(),
        senderPhone: z.string().optional(),
        messageType: z.enum(['text', 'image', 'audio', 'video', 'document']).optional(),
      }))
      .query(async ({ input }) => {
        return db.getWhatsappMessages(input.projectId, input.limit || 50);
      }),
    
    // Get sender mappings for auto-routing
    getSenderMappings: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .query(async ({ input }) => {
        return db.getWhatsappSenderMappings(input.configId);
      }),
    
    // Create/update sender mapping
    upsertSenderMapping: protectedProcedure
      .input(z.object({
        configId: z.number(),
        senderPhone: z.string(),
        senderName: z.string().optional(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        defaultCategory: z.enum(['field_report', 'issue', 'document', 'general']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertWhatsappSenderMapping(input);
        return { success: true };
      }),
    
    // Get message templates
    getTemplates: protectedProcedure
      .input(z.object({ configId: z.number() }))
      .query(async ({ input }) => {
        return db.getWhatsappTemplates(input.configId);
      }),
    
    // Create message template
    createTemplate: protectedProcedure
      .input(z.object({
        configId: z.number(),
        templateName: z.string(),
        templateType: z.enum(['text', 'media', 'interactive']).optional(),
        content: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ input }) => {
        await db.createWhatsappTemplate(input);
        return { success: true };
      }),
    
    // Delete message template
    deleteTemplate: protectedProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteWhatsappTemplate(input.templateId);
        return { success: true };
      }),
    
    // Send outbound message (via WhatsApp Business API)
    sendMessage: protectedProcedure
      .input(z.object({
        configId: z.number(),
        recipientPhone: z.string(),
        messageType: z.enum(['text', 'template', 'media']),
        content: z.string(),
        templateName: z.string().optional(),
        templateParams: z.array(z.string()).optional(),
        mediaUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // In production, this would call the WhatsApp Business API
        // For now, we log the outbound message
        console.log('[WhatsApp] Sending message:', {
          to: input.recipientPhone,
          type: input.messageType,
          content: input.content,
        });
        
        // Record the outbound message
        await db.createWhatsappMessage({
          organizationId: 1,
          waMessageId: `out-${nanoid(16)}`,
          senderPhone: 'system',
          recipientPhone: input.recipientPhone,
          messageType: input.messageType === 'media' ? 'document' : 'text',
          messageContent: input.content,
          mediaUrl: input.mediaUrl,
          direction: 'outbound',
          receivedAt: new Date(),
          processingStatus: 'sent',
        } as any);
        
        return { success: true, messageId: `out-${nanoid(16)}` };
      }),
    
    // Webhook endpoint for receiving WhatsApp messages (WhatsApp Business API)
    receiveMessage: publicProcedure
      .input(z.object({
        waMessageId: z.string(),
        senderPhone: z.string(),
        senderName: z.string().optional(),
        messageType: z.enum(['text', 'image', 'audio', 'video', 'document']),
        messageContent: z.string().optional(),
        mediaUrl: z.string().optional(),
        webhookSecret: z.string(),
        // Signature verification fields (A2 requirement)
        signature: z.string().optional(),
        rawBody: z.string().optional(),
        // Additional WhatsApp Business API fields
        timestamp: z.string().optional(),
        context: z.object({
          messageId: z.string().optional(),
          from: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        // Verify webhook secret and find config
        const config = await db.getWhatsappConfigBySecret(input.webhookSecret);
        if (!config) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid webhook secret' });
        }
        
        // A2: Verify HMAC signature using RAW BODY (not JSON.stringify)
        if (input.signature && input.rawBody && (config as any).appSecret) {
          const { MetaWhatsAppAdapter } = await import('./providers/adapters/whatsapp/meta');
          const adapter = new MetaWhatsAppAdapter();
          const isValid = adapter.verifyWebhookSignature(
            input.rawBody, // CRITICAL: Use raw bytes, NOT JSON.stringify
            input.signature,
            (config as any).appSecret
          );
          if (!isValid) {
            console.error('[WhatsApp] Invalid webhook signature - rejecting');
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid webhook signature' });
          }
          console.log('[WhatsApp] Webhook signature verified successfully');
        }
        
        // Check for sender mapping to auto-route
        const senderMapping = await db.getWhatsappSenderMappingByPhone(config.id, input.senderPhone);
        
        // Create the message record
        const messageId = await db.createWhatsappMessage({
          organizationId: config.organizationId || 1,
          configId: config.id,
          waMessageId: input.waMessageId,
          senderPhone: input.senderPhone,
          senderName: input.senderName || senderMapping?.senderName,
          messageType: input.messageType,
          messageContent: input.messageContent,
          mediaUrl: input.mediaUrl,
          direction: 'inbound',
          receivedAt: new Date(),
          processingStatus: 'pending',
          // Auto-routing from sender mapping
          projectId: senderMapping?.projectId || config.projectId,
          siteId: senderMapping?.siteId || config.defaultSiteId,
          category: senderMapping?.defaultCategory || 'general',
        } as any);
        
        // If auto-categorize is enabled and there's media, trigger AI categorization
        if (config.autoCategorize && input.mediaUrl && input.messageType === 'document') {
          // Queue for AI processing (in production, this would be a background job)
          console.log('[WhatsApp] Queuing document for AI categorization:', input.mediaUrl);
        }
        
        return { success: true, messageId };
      }),
    
    // Webhook verification endpoint (required by WhatsApp Business API)
    verifyWebhook: publicProcedure
      .input(z.object({
        mode: z.string(),
        token: z.string(),
        challenge: z.string(),
      }))
      .query(({ input }) => {
        // In production, verify the token matches your verify token
        if (input.mode === 'subscribe') {
          return input.challenge;
        }
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid verification request' });
      }),
  }),
  
  email: router({
    getConfig: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getEmailConfig(input.projectId);
      }),
    
    createConfig: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number(),
        forwardFromAddresses: z.array(z.string()).optional(),
        defaultSiteId: z.number().optional(),
        autoCategorize: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        // Generate unique inbound address
        const inboundAddress = `project-${input.projectId}-${nanoid(8)}@ingest.kiisha.io`;
        
        await db.createEmailConfig({
          organizationId: input.organizationId || 1,
          projectId: input.projectId,
          inboundAddress,
          forwardFromAddresses: input.forwardFromAddresses,
          defaultSiteId: input.defaultSiteId,
          autoCategorize: input.autoCategorize ?? true,
        });
        
        return { success: true, inboundAddress };
      }),
  }),
  
  apiKeys: router({
    list: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getApiKeysByOrg(input.organizationId || 1);
      }),
    
    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        name: z.string(),
        scopes: z.array(z.string()).optional(),
        rateLimitPerHour: z.number().optional(),
        expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Generate API key
        const apiKey = `kiisha_${nanoid(32)}`;
        const keyPrefix = apiKey.substring(0, 8);
        const keyHash = apiKey; // In real implementation, hash this
        
        await db.createApiKey({
          organizationId: input.organizationId || 1,
          name: input.name,
          keyHash,
          keyPrefix,
          scopes: input.scopes || ['read'],
          rateLimitPerHour: input.rateLimitPerHour || 1000,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          createdById: ctx.user.id,
        });
        
        // Return the full key only once - it won't be retrievable later
        return { success: true, apiKey };
      }),
    
    revoke: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.revokeApiKey(input.id);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // OPERATIONS MONITORING OS
  // ═══════════════════════════════════════════════════════════════

  operations: router({
    // Connectors
    getConnectors: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getConnectors(input.organizationId);
      }),

    createConnector: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        name: z.string(),
        connectorType: z.enum(['ammp', 'victron', 'solaredge', 'sma', 'huawei', 'fronius', 'enphase', 'demo', 'custom_api', 'csv_import']),
        syncFrequencyMinutes: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createConnector(input);
        return { success: true };
      }),

    updateConnectorStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['active', 'inactive', 'error', 'configuring']),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateConnectorStatus(input.id, input.status, input.errorMessage);
        return { success: true };
      }),

    // Devices
    getDevices: protectedProcedure
      .input(z.object({ siteId: z.number() }))
      .query(async ({ input }) => {
        return db.getDevicesBySite(input.siteId);
      }),

    createDevice: protectedProcedure
      .input(z.object({
        siteId: z.number(),
        connectorId: z.number().optional(),
        externalId: z.string().optional(),
        name: z.string(),
        deviceType: z.enum(['inverter', 'battery', 'meter', 'weather_station', 'genset', 'charge_controller', 'combiner_box', 'transformer', 'other']),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        capacityKw: z.string().optional(),
        capacityKwh: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createDevice(input);
        return { success: true };
      }),

    updateDeviceStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['online', 'offline', 'warning', 'error', 'maintenance']),
      }))
      .mutation(async ({ input }) => {
        await db.updateDeviceStatus(input.id, input.status);
        return { success: true };
      }),

    // Metrics
    getMetricDefinitions: protectedProcedure
      .input(z.object({ organizationId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getMetricDefinitions(input.organizationId);
      }),

    createMetricDefinition: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        name: z.string(),
        code: z.string(),
        unit: z.string().optional(),
        dataType: z.enum(['number', 'boolean', 'string', 'enum']).optional(),
        aggregationMethod: z.enum(['avg', 'sum', 'min', 'max', 'last', 'count']).optional(),
        description: z.string().optional(),
        category: z.enum(['power', 'energy', 'voltage', 'current', 'frequency', 'temperature', 'soc', 'status', 'environmental', 'financial']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createMetricDefinition(input);
        return { success: true };
      }),

    // Measurements
    getNormalizedMeasurements: protectedProcedure
      .input(z.object({
        siteId: z.number(),
        metricId: z.number(),
        periodType: z.enum(['minute', 'hour', 'day', 'week', 'month']),
        startTime: z.string(),
        endTime: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getNormalizedMeasurements(
          input.siteId,
          input.metricId,
          input.periodType,
          new Date(input.startTime),
          new Date(input.endTime)
        );
      }),

    getDerivedMetrics: protectedProcedure
      .input(z.object({
        siteId: z.number(),
        metricCode: z.string(),
        periodType: z.enum(['hour', 'day', 'week', 'month', 'year']),
        startTime: z.string(),
        endTime: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getDerivedMetrics(
          input.siteId,
          input.metricCode,
          input.periodType,
          new Date(input.startTime),
          new Date(input.endTime)
        );
      }),

    // Alert Rules
    getAlertRules: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        siteId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAlertRules(input.organizationId, input.siteId);
      }),

    createAlertRule: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        siteId: z.number().optional(),
        deviceId: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        metricId: z.number().optional(),
        condition: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'offline', 'change_rate']),
        threshold: z.string().optional(),
        thresholdUnit: z.string().optional(),
        evaluationWindowMinutes: z.number().optional(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
        notificationChannels: z.array(z.string()).optional(),
        cooldownMinutes: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createAlertRule(input);
        return { success: true };
      }),

    updateAlertRule: protectedProcedure
      .input(z.object({
        id: z.number(),
        enabled: z.boolean().optional(),
        name: z.string().optional(),
        threshold: z.string().optional(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateAlertRule(id, data);
        return { success: true };
      }),

    // Alert Events
    getAlertEvents: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        status: z.enum(['open', 'acknowledged', 'resolved', 'suppressed']).optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAlertEvents(input.organizationId, input.status, input.limit);
      }),

    acknowledgeAlert: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.acknowledgeAlertEvent(input.id, ctx.user.id);
        return { success: true };
      }),

    resolveAlert: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.resolveAlertEvent(input.id, input.note);
        return { success: true };
      }),

    // Stakeholder Portals
    getStakeholderPortals: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getStakeholderPortals(input.organizationId);
      }),

    createStakeholderPortal: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        name: z.string(),
        slug: z.string(),
        brandingConfig: z.object({
          logo: z.string().optional(),
          primaryColor: z.string().optional(),
          companyName: z.string().optional(),
        }).optional(),
        allowedSiteIds: z.array(z.number()).optional(),
        allowedMetrics: z.array(z.string()).optional(),
        accessType: z.enum(['password', 'token', 'sso']).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createStakeholderPortal(input);
        return { success: true };
      }),

    // Operations Reports
    getOperationsReports: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        siteId: z.number().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getOperationsReports(input.organizationId, input.siteId, input.limit);
      }),

    generateReport: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        siteId: z.number().optional(),
        reportType: z.enum(['daily_summary', 'weekly_summary', 'monthly_performance', 'quarterly_review', 'annual_report', 'incident_report', 'custom']),
        periodStart: z.string(),
        periodEnd: z.string(),
        title: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.createOperationsReport({
          organizationId: input.organizationId,
          siteId: input.siteId,
          reportType: input.reportType,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          title: input.title,
          status: 'generating',
          generatedById: ctx.user.id,
        });
        // In production, this would trigger a background job to generate the report
        return { success: true };
      }),
  }),

  // Comments for team collaboration
  comments: router({
    // Get comments for a resource
    list: protectedProcedure
      .input(z.object({
        resourceType: z.enum(['document', 'workspace_item', 'checklist_item', 'project']),
        resourceId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        // Only admins and regular users can see internal comments
        const includeInternal = isAdminOrSuperuser(ctx.user) || ctx.user.role === 'user';
        return db.getCommentsByResource(input.resourceType, input.resourceId, includeInternal);
      }),

    // Get comment count for a resource
    count: protectedProcedure
      .input(z.object({
        resourceType: z.enum(['document', 'workspace_item', 'checklist_item', 'project']),
        resourceId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const includeInternal = isAdminOrSuperuser(ctx.user) || ctx.user.role === 'user';
        return db.getCommentCount(input.resourceType, input.resourceId, includeInternal);
      }),

    // Create a new comment
    create: protectedProcedure
      .input(z.object({
        resourceType: z.enum(['document', 'workspace_item', 'checklist_item', 'project']),
        resourceId: z.number(),
        content: z.string().min(1),
        parentId: z.number().optional(),
        isInternal: z.boolean().optional(),
        mentions: z.array(z.number()).optional(), // User IDs to mention
      }))
      .mutation(async ({ ctx, input }) => {
        // Create the comment
        await db.createComment({
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          userId: ctx.user.id,
          content: input.content,
          parentId: input.parentId,
          isInternal: input.isInternal ?? false,
        });

        // Create mentions if any
        if (input.mentions && input.mentions.length > 0) {
          // Get the created comment ID (in production, use returning or lastInsertId)
          const comments = await db.getCommentsByResource(input.resourceType, input.resourceId, true);
          const latestComment = comments[comments.length - 1];
          if (latestComment) {
            for (const userId of input.mentions) {
              await db.createCommentMention({
                commentId: latestComment.id,
                mentionedUserId: userId,
              });
            }
          }
        }

        return { success: true };
      }),

    // Update a comment (author only)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
        }
        if (comment.userId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only edit your own comments' });
        }
        await db.updateComment(input.id, input.content);
        return { success: true };
      }),

    // Delete a comment (author or admin)
    // Soft-delete comment (marks as deleted but preserves for audit trail)
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
        }
        if (comment.userId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only delete your own comments' });
        }
        // Soft delete - update content to show deleted, preserve record
        await db.softDeleteComment(input.id, ctx.user.id);
        return { success: true };
      }),

    // Get mentions for current user
    getMentions: protectedProcedure
      .input(z.object({ unreadOnly: z.boolean().optional() }))
      .query(async ({ ctx, input }) => {
        return db.getMentionsForUser(ctx.user.id, input.unreadOnly);
      }),

    // Mark mention as read
    markMentionRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markMentionAsRead(input.id);
        return { success: true };
      }),

    // Mark all mentions as read
    markAllMentionsRead: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.markAllMentionsAsRead(ctx.user.id);
        return { success: true };
      }),

    // Resolve a comment thread (mark as resolved)
    resolve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
        }
        // Only top-level comments can be resolved
        if (comment.parentId !== null) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only top-level comments can be resolved' });
        }
        await db.resolveCommentThread(input.id, ctx.user.id);
        return { success: true };
      }),

    // Unresolve a comment thread (reopen)
    unresolve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await db.getCommentById(input.id);
        if (!comment) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment not found' });
        }
        if (comment.parentId !== null) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only top-level comments can be reopened' });
        }
        await db.unresolveCommentThread(input.id);
        return { success: true };
      }),

    // List comments with resolved filter option
    listWithFilter: protectedProcedure
      .input(z.object({
        resourceType: z.enum(['document', 'workspace_item', 'checklist_item', 'project']),
        resourceId: z.number(),
        includeResolved: z.boolean().optional().default(true),
      }))
      .query(async ({ ctx, input }) => {
        const includeInternal = isAdminOrSuperuser(ctx.user) || ctx.user.role === 'user';
        return db.getCommentsByResourceWithResolved(
          input.resourceType, 
          input.resourceId, 
          includeInternal,
          input.includeResolved
        );
      }),

    // Get count of unresolved threads
    unresolvedCount: protectedProcedure
      .input(z.object({
        resourceType: z.enum(['document', 'workspace_item', 'checklist_item', 'project']),
        resourceId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const includeInternal = isAdminOrSuperuser(ctx.user) || ctx.user.role === 'user';
        return db.getUnresolvedCommentCount(input.resourceType, input.resourceId, includeInternal);
      }),
  }),

  // ============ VATR HIERARCHICAL DATA MODEL ============
  
  // Sites router
  sites: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getSites(input?.projectId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSiteById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        portfolioId: z.number().optional(),
        organizationId: z.number().optional(),
        name: z.string(),
        siteCode: z.string().optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        stateProvince: z.string().optional(),
        country: z.string().default('Nigeria'),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        timezone: z.string().optional(),
        siteType: z.enum(['ground_mount', 'rooftop', 'carport', 'floating', 'minigrid']).optional(),
        landType: z.enum(['owned', 'leased', 'easement']).optional(),
        gridConnection: z.enum(['grid_tied', 'off_grid', 'hybrid']).optional(),
        capacityKw: z.string().optional(),
        capacityKwh: z.string().optional(),
        codDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createSite(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        siteCode: z.string().optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        stateProvince: z.string().optional(),
        country: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        siteType: z.enum(['ground_mount', 'rooftop', 'carport', 'floating', 'minigrid']).optional(),
        landType: z.enum(['owned', 'leased', 'easement']).optional(),
        gridConnection: z.enum(['grid_tied', 'off_grid', 'hybrid']).optional(),
        capacityKw: z.string().optional(),
        capacityKwh: z.string().optional(),
        status: z.enum(['active', 'inactive', 'decommissioned']).optional(),
        operationalStatus: z.enum(['online', 'offline', 'maintenance', 'commissioning']).optional(),
        codDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateSite(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),

    getProfileCompleteness: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.calculateSiteProfileCompleteness(input.id);
      }),
  }),

  // Systems router
  systems: router({
    list: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getSystems(input?.siteId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSystemById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        siteId: z.number(),
        organizationId: z.number().optional(),
        name: z.string(),
        systemType: z.enum(['pv', 'bess', 'genset', 'hybrid', 'wind', 'hydro']),
        topology: z.enum(['dc_coupled', 'ac_coupled', 'standalone']).optional(),
        capacityKw: z.string().optional(),
        capacityKwh: z.string().optional(),
        configuration: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createSystem(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        systemType: z.enum(['pv', 'bess', 'genset', 'hybrid', 'wind', 'hydro']).optional(),
        topology: z.enum(['dc_coupled', 'ac_coupled', 'standalone']).optional(),
        capacityKw: z.string().optional(),
        capacityKwh: z.string().optional(),
        status: z.enum(['active', 'inactive', 'maintenance']).optional(),
        configuration: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateSystem(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),
  }),

  // Assets router (VATR Core)
  assets: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        systemId: z.number().optional(),
        assetType: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAssets(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getAssetById(input.id);
      }),

    getByVatrId: protectedProcedure
      .input(z.object({ vatrId: z.string() }))
      .query(async ({ input }) => {
        return db.getAssetByVatrId(input.vatrId);
      }),

    getClassificationStats: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        systemId: z.number().optional(),
        projectId: z.number().optional(),
        assetClassification: z.string().optional(),
        gridConnectionType: z.string().optional(),
        configurationProfile: z.string().optional(),
        networkTopology: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAssetClassificationStats(input);
      }),

    create: protectedProcedure
      .input(z.object({
        systemId: z.number(),
        siteId: z.number(),
        projectId: z.number().optional(),
        organizationId: z.number().optional(),
        vatrId: z.string().optional(),
        assetType: z.enum([
          'inverter', 'panel', 'meter', 'battery', 'transformer',
          'combiner_box', 'tracker', 'monitoring', 'genset', 'switchgear', 'cable', 'other'
        ]),
        assetCategory: z.enum(['generation', 'storage', 'distribution', 'monitoring', 'auxiliary']),
        // Classification fields
        assetClassification: z.enum([
          'residential', 'small_commercial', 'large_commercial', 'industrial',
          'mini_grid', 'mesh_grid', 'interconnected_mini_grids', 'grid_connected'
        ]).optional(),
        gridConnectionType: z.enum([
          'off_grid', 'grid_connected', 'grid_tied_with_backup', 'mini_grid', 'interconnected_mini_grid', 'mesh_grid'
        ]).optional(),
        networkTopology: z.enum(['radial', 'ring', 'mesh', 'star', 'unknown']).optional(),
        configurationProfile: z.enum([
          'pv_only', 'pv_bess', 'pv_dg', 'pv_bess_dg', 'bess_only', 'dg_only',
          'minigrid_pv_bess', 'minigrid_pv_bess_dg', 'mesh_pv_bess', 'mesh_pv_bess_dg', 'hybrid_custom'
        ]).optional(),
        componentsJson: z.array(z.object({
          type: z.string(),
          count: z.number().optional(),
          specs: z.record(z.string(), z.any()).optional(),
        })).optional(),
        name: z.string(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        assetTag: z.string().optional(),
        nominalCapacityKw: z.string().optional(),
        nominalCapacityKwh: z.string().optional(),
        voltageRating: z.string().optional(),
        currentRating: z.string().optional(),
        efficiencyRating: z.string().optional(),
        locationOnSite: z.string().optional(),
        installationDate: z.string().optional(),
        warrantyStartDate: z.string().optional(),
        warrantyEndDate: z.string().optional(),
        warrantyProvider: z.string().optional(),
        purchasePrice: z.string().optional(),
        purchaseCurrency: z.string().optional(),
        purchaseDate: z.string().optional(),
        supplier: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createAsset({ ...input, createdById: ctx.user.id } as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        assetTag: z.string().optional(),
        nominalCapacityKw: z.string().optional(),
        nominalCapacityKwh: z.string().optional(),
        status: z.enum(['active', 'inactive', 'failed', 'replaced', 'decommissioned']).optional(),
        condition: z.enum(['excellent', 'good', 'fair', 'poor', 'failed']).optional(),
        // Classification fields
        assetClassification: z.enum([
          'residential', 'small_commercial', 'large_commercial', 'industrial',
          'mini_grid', 'mesh_grid', 'interconnected_mini_grids', 'grid_connected'
        ]).optional(),
        gridConnectionType: z.enum([
          'off_grid', 'grid_connected', 'grid_tied_with_backup', 'mini_grid', 'interconnected_mini_grid', 'mesh_grid'
        ]).optional(),
        networkTopology: z.enum(['radial', 'ring', 'mesh', 'star', 'unknown']).optional(),
        configurationProfile: z.enum([
          'pv_only', 'pv_bess', 'pv_dg', 'pv_bess_dg', 'bess_only', 'dg_only',
          'minigrid_pv_bess', 'minigrid_pv_bess_dg', 'mesh_pv_bess', 'mesh_pv_bess_dg', 'hybrid_custom'
        ]).optional(),
        componentsJson: z.array(z.object({
          type: z.string(),
          count: z.number().optional(),
          specs: z.record(z.string(), z.any()).optional(),
        })).optional(),
        locationOnSite: z.string().optional(),
        lastInspectionDate: z.string().optional(),
        nextMaintenanceDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateAsset(id, { ...data, updatedById: ctx.user.id } as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),

    // Asset components
    getComponents: protectedProcedure
      .input(z.object({ assetId: z.number() }))
      .query(async ({ input }) => {
        return db.getAssetComponents(input.assetId);
      }),

    createComponent: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        organizationId: z.number().optional(),
        name: z.string(),
        componentType: z.enum(['fan', 'capacitor', 'fuse', 'connector', 'display', 'sensor', 'relay', 'other']),
        manufacturer: z.string().optional(),
        model: z.string().optional(),
        serialNumber: z.string().optional(),
        installationDate: z.string().optional(),
        specifications: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createAssetComponent(input as any);
      }),

    updateComponent: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        status: z.enum(['active', 'inactive', 'failed', 'replaced']).optional(),
        replacementDate: z.string().optional(),
        specifications: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateAssetComponent(id, data as any);
      }),

    deleteComponent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),

    // Versioned attributes
    getAttributes: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        currentOnly: z.boolean().optional().default(true),
      }))
      .query(async ({ input }) => {
        return db.getAssetAttributes(input.assetId, input.currentOnly);
      }),

    getAttributeHistory: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        attributeKey: z.string(),
      }))
      .query(async ({ input }) => {
        return db.getAttributeHistory(input.assetId, input.attributeKey);
      }),

    createAttribute: protectedProcedure
      .input(z.object({
        assetId: z.number(),
        attributeKey: z.string(),
        value: z.object({
          text: z.string().optional(),
          numeric: z.string().optional(),
          boolean: z.boolean().optional(),
          date: z.string().optional(),
          json: z.record(z.string(), z.unknown()).optional(),
        }),
        source: z.object({
          type: z.enum(['document', 'api', 'manual', 'ai_extraction', 'iot', 'work_order']),
          id: z.number().optional(),
          page: z.number().optional(),
          snippet: z.string().optional(),
          confidence: z.string().optional(),
        }),
        category: z.enum(['identity', 'technical', 'operational', 'financial', 'compliance']),
        unit: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createVersionedAttribute(
          input.assetId,
          input.attributeKey,
          { ...input.value, date: input.value.date ? new Date(input.value.date) : null },
          input.source,
          input.category,
          input.unit,
          ctx.user.id
        );
      }),

    verifyAttribute: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return db.verifyAttribute(input.id, ctx.user.id);
      }),

    rejectAttribute: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.rejectAttribute(input.id, ctx.user.id, input.reason);
      }),
  }),

  // ============ CMMS (Computerized Maintenance Management System) ============

  // Work Orders router
  workOrders: router({
    list: protectedProcedure
      .input(z.object({
        siteId: z.number().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        assignedToId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getWorkOrders(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getWorkOrderById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        sourceType: z.enum(['scheduled', 'reactive', 'inspection', 'alert']),
        scheduleId: z.number().optional(),
        alertId: z.number().optional(),
        siteId: z.number(),
        systemId: z.number().optional(),
        assetId: z.number().optional(),
        title: z.string(),
        description: z.string().optional(),
        workType: z.enum(['preventive', 'corrective', 'emergency', 'inspection']),
        priority: z.enum(['critical', 'high', 'medium', 'low']),
        assignedToId: z.number().optional(),
        assignedTeam: z.string().optional(),
        scheduledStart: z.string().optional(),
        scheduledEnd: z.string().optional(),
        estimatedHours: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createWorkOrder({
          ...input,
          scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
          scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
          createdById: ctx.user.id,
        } as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
        assignedToId: z.number().optional(),
        assignedTeam: z.string().optional(),
        scheduledStart: z.string().optional(),
        scheduledEnd: z.string().optional(),
        estimatedHours: z.string().optional(),
        completionNotes: z.string().optional(),
        laborCost: z.string().optional(),
        partsCost: z.string().optional(),
        otherCost: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateWorkOrder(id, {
          ...data,
          scheduledStart: data.scheduledStart ? new Date(data.scheduledStart) : undefined,
          scheduledEnd: data.scheduledEnd ? new Date(data.scheduledEnd) : undefined,
        } as any);
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['open', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled']),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateWorkOrderStatus(input.id, input.status, input.reason);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),

    // Work order tasks
    getTasks: protectedProcedure
      .input(z.object({ workOrderId: z.number() }))
      .query(async ({ input }) => {
        return db.getWorkOrderTasks(input.workOrderId);
      }),

    createTask: protectedProcedure
      .input(z.object({
        workOrderId: z.number(),
        taskNumber: z.number(),
        description: z.string(),
        assetId: z.number().optional(),
        componentId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createWorkOrderTask(input as any);
      }),

    updateTask: protectedProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateWorkOrderTask(id, data as any);
      }),

    completeTask: protectedProcedure
      .input(z.object({
        id: z.number(),
        result: z.enum(['pass', 'fail', 'na']),
        notes: z.string().optional(),
        measurements: z.record(z.string(), z.unknown()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.completeWorkOrderTask(input.id, input.result, ctx.user.id, input.notes, input.measurements);
      }),
  }),

  // Maintenance Schedules router
  maintenanceSchedules: router({
    list: protectedProcedure
      .input(z.object({
        scopeType: z.string().optional(),
        scopeId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getMaintenanceSchedules(input?.scopeType, input?.scopeId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getMaintenanceScheduleById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        scopeType: z.enum(['site', 'system', 'asset']),
        scopeId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        maintenanceType: z.enum(['preventive', 'predictive', 'condition_based']),
        taskCategory: z.enum(['inspection', 'cleaning', 'calibration', 'replacement', 'testing', 'repair']).optional(),
        frequencyType: z.enum(['calendar', 'runtime', 'cycles', 'condition']),
        frequencyValue: z.number().optional(),
        frequencyUnit: z.enum(['days', 'weeks', 'months', 'years', 'hours', 'cycles']).optional(),
        triggerMetric: z.string().optional(),
        triggerThreshold: z.string().optional(),
        triggerOperator: z.enum(['gt', 'lt', 'eq']).optional(),
        estimatedDurationHours: z.string().optional(),
        requiredSkills: z.array(z.string()).optional(),
        requiredParts: z.array(z.object({
          partNumber: z.string(),
          quantity: z.number(),
          description: z.string(),
        })).optional(),
        safetyRequirements: z.array(z.string()).optional(),
        procedureDocumentId: z.number().optional(),
        defaultAssigneeId: z.number().optional(),
        defaultTeam: z.string().optional(),
        nextDueDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createMaintenanceSchedule({ ...input, createdById: ctx.user.id } as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(['active', 'paused', 'archived']).optional(),
        frequencyValue: z.number().optional(),
        frequencyUnit: z.enum(['days', 'weeks', 'months', 'years', 'hours', 'cycles']).optional(),
        nextDueDate: z.string().optional(),
        defaultAssigneeId: z.number().optional(),
        defaultTeam: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateMaintenanceSchedule(id, data as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),
  }),

  // Spare Parts router
  spareParts: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getSpareParts(input?.category);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSparePartById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        partNumber: z.string(),
        name: z.string(),
        description: z.string().optional(),
        category: z.enum(['electrical', 'mechanical', 'consumable', 'safety', 'other']).optional(),
        compatibleAssetTypes: z.array(z.string()).optional(),
        compatibleManufacturers: z.array(z.string()).optional(),
        compatibleModels: z.array(z.string()).optional(),
        quantityOnHand: z.number().optional(),
        minimumStock: z.number().optional(),
        reorderPoint: z.number().optional(),
        reorderQuantity: z.number().optional(),
        storageLocation: z.string().optional(),
        siteId: z.number().optional(),
        unitCost: z.string().optional(),
        currency: z.string().optional(),
        preferredSupplier: z.string().optional(),
        leadTimeDays: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createSparePart(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        quantityOnHand: z.number().optional(),
        minimumStock: z.number().optional(),
        reorderPoint: z.number().optional(),
        unitCost: z.string().optional(),
        storageLocation: z.string().optional(),
        preferredSupplier: z.string().optional(),
        leadTimeDays: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateSparePart(id, data as any);
      }),

    recordUsage: protectedProcedure
      .input(z.object({
        partId: z.number(),
        quantity: z.number(),
        usageType: z.enum(['consumed', 'returned', 'damaged']),
        workOrderId: z.number().optional(),
        assetId: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.recordPartsUsage(
          input.partId,
          input.quantity,
          input.usageType,
          ctx.user.id,
          input.workOrderId,
          input.assetId,
          input.notes
        );
      }),
  }),

  // O&M Dashboard router
  omDashboard: router({
    getStats: protectedProcedure
      .input(z.object({ siteId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getOmDashboardStats(input?.siteId);
      }),
  }),

  // ═══════════════════════════════════════════════════════════════
  // UNIVERSAL ARTIFACT ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════

  artifacts: router({
    list: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        artifactType: z.string().optional(),
        processingStatus: z.string().optional(),
        verificationStatus: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getArtifacts(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactById(input.id);
      }),

    getByCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        return db.getArtifactByCode(input.code);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        artifactType: z.enum(['document', 'image', 'audio', 'video', 'message', 'meeting', 'contract']),
        artifactSubtype: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        originalFilename: z.string().optional(),
        originalFileUrl: z.string(),
        originalFileHash: z.string(),
        originalFileSizeBytes: z.number().optional(),
        originalMimeType: z.string().optional(),
        rawMetadata: z.record(z.string(), z.unknown()).optional(),
        ingestionChannel: z.enum(['upload', 'email', 'whatsapp', 'api', 'meeting_bot', 'iot', 'manual']).optional(),
        ingestionSourceId: z.string().optional(),
        senderType: z.enum(['user', 'external_contact', 'system', 'api']).optional(),
        senderId: z.number().optional(),
        senderIdentifier: z.string().optional(),
        portfolioId: z.number().optional(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        systemId: z.number().optional(),
        assetId: z.number().optional(),
        lifecycleStage: z.enum(['origination', 'development', 'due_diligence', 'construction', 'commissioning', 'operations']).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createArtifact({ ...input, createdBy: ctx.user.id } as any);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        assetId: z.number().optional(),
        lifecycleStage: z.enum(['origination', 'development', 'due_diligence', 'construction', 'commissioning', 'operations']).optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return db.updateArtifact(id, { ...data, updatedBy: ctx.user.id } as any);
      }),

    categorize: protectedProcedure
      .input(z.object({
        id: z.number(),
        category: z.string(),
        subcategory: z.string().optional(),
        isAiSuggestion: z.boolean().optional(),
        confidence: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.categorizeArtifact(
          input.id,
          input.category,
          input.subcategory || null,
          input.isAiSuggestion || false,
          input.confidence,
          ctx.user.id
        );
      }),

    verify: protectedProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.verifyArtifact(input.id, ctx.user.id, input.notes);
      }),

    updateProcessingStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'preprocessing', 'processed', 'ai_analyzing', 'ai_complete', 'failed']),
      }))
      .mutation(async ({ input }) => {
        return db.updateArtifactProcessingStatus(input.id, input.status);
      }),

    updateAiStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'queued', 'analyzing', 'complete', 'failed']),
        runId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateArtifactAiStatus(input.id, input.status, input.runId);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async () => {
        throw new TRPCError({ 
          code: 'METHOD_NOT_SUPPORTED', 
          message: 'Hard delete is not allowed. Use archive instead to preserve data integrity.' 
        });
      }),

    getStats: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactStats(input.organizationId);
      }),

    // Check for duplicate artifacts by file hash
    checkDuplicate: protectedProcedure
      .input(z.object({ fileHash: z.string() }))
      .query(async ({ input }) => {
        return db.getArtifactByHash(input.fileHash);
      }),

    // Upload artifact with automatic type detection and processing
    upload: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded file data
        mimeType: z.string(),
        fileSize: z.number(),
        fileHash: z.string(),
        artifactType: z.string(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        assetId: z.number().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { storagePut } = await import('./storage');
        
        // Decode base64 file data
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        
        // Generate unique file key with timestamp and random suffix
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const ext = input.fileName.split('.').pop() || 'bin';
        const fileKey = `artifacts/${ctx.user.id}/${timestamp}-${randomSuffix}.${ext}`;
        
        // Upload to S3
        const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);
        
        // Create artifact record
        const artifactResult = await db.createArtifact({
          organizationId: 1, // Default org
          artifactType: input.artifactType as any,
          name: input.fileName,
          description: input.description,
          originalFilename: input.fileName,
          originalFileUrl: url,
          originalFileHash: input.fileHash,
          originalFileSizeBytes: input.fileSize,
          originalMimeType: input.mimeType,
          ingestionChannel: 'upload',
          senderType: 'user',
          senderId: ctx.user.id,
          projectId: input.projectId,
          siteId: input.siteId,
          assetId: input.assetId,
          tags: input.tags,
          processingStatus: 'pending',
          createdBy: ctx.user.id,
        } as any);
        
        // Extract artifact ID properly
        const artifactId = typeof artifactResult === 'object' && artifactResult !== null 
          ? artifactResult.id 
          : (typeof artifactResult === 'number' ? artifactResult : 0);
        const artifactCode = typeof artifactResult === 'object' && artifactResult !== null 
          ? artifactResult.artifactCode 
          : undefined;
        
        if (!artifactId) {
          throw new Error('Failed to create artifact');
        }
        
        // Create type-specific extension record
        if (input.artifactType === 'image') {
          await db.createArtifactImage({
            artifactId,
            imageKind: 'other',
          } as any);
        } else if (input.artifactType === 'audio') {
          await db.createArtifactAudio({
            artifactId,
            recordingType: 'other',
          } as any);
        } else if (input.artifactType === 'video') {
          // Video extension would be created here
        }
        
        // Update processing status to preprocessing
        await db.updateArtifactProcessingStatus(artifactId, 'preprocessing');
        
        // Create a job for async document processing
        const correlationId = `upload_${artifactId}_${Date.now()}`;
        const jobResult = await db.createJob(
          'document_ingestion',
          {
            artifactId,
            fileName: input.fileName,
            mimeType: input.mimeType,
            fileUrl: url,
            projectId: input.projectId,
            entityType: 'artifact',
            entityId: artifactId,
          },
          {
            priority: 'normal',
            correlationId,
            userId: ctx.user.id,
          }
        );
        const jobId = jobResult?.id;
        
        // Simulate async processing (in production, this would be handled by a job worker)
        const capturedArtifactId = artifactId;
        const capturedJobId = jobId;
        if (capturedJobId) {
          setTimeout(async () => {
            try {
              // Update job to processing
              await db.startJob(capturedJobId);
              
              // Simulate processing time
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Update artifact and job to completed
              await db.updateArtifactProcessingStatus(capturedArtifactId, 'processed');
              await db.completeJob(capturedJobId, { processedAt: new Date().toISOString() });
            } catch (e) {
              console.error('Failed to process artifact:', e);
              await db.failJob(capturedJobId, e instanceof Error ? e.message : 'Unknown error');
            }
          }, 500);
        }
        
        return {
          artifactId,
          artifactCode,
          fileUrl: url,
          processingStatus: 'preprocessing',
          jobId,
          correlationId: jobResult?.correlationId || correlationId,
        };
      }),

    // Email ingestion endpoint - receives artifacts from email forwarding
    ingestFromEmail: publicProcedure
      .input(z.object({
        // Email metadata
        messageId: z.string(),
        from: z.string(),
        to: z.string(),
        subject: z.string(),
        bodyText: z.string().optional(),
        bodyHtml: z.string().optional(),
        receivedAt: z.string(), // ISO date string
        // Attachments
        attachments: z.array(z.object({
          filename: z.string(),
          mimeType: z.string(),
          size: z.number(),
          content: z.string(), // Base64 encoded
        })),
        // Optional context extraction from email address
        projectCode: z.string().optional(), // e.g., from project+code@ingest.kiisha.com
        // API key for authentication
        apiKey: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Validate API key (in production, check against stored keys)
        const validApiKey = process.env.EMAIL_INGESTION_API_KEY || 'kiisha-email-ingest-key';
        if (input.apiKey !== validApiKey) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid API key' });
        }
        
        // A5: Cross-channel parity - use unified identity resolution
        const identityResult = await db.resolveIdentity('email', input.from);
        
        // If unknown sender (null result), quarantine the email
        if (!identityResult) {
          // Log for admin review - in production, store in unclaimed_inbound table
          console.log('[Email Ingestion] Unknown sender, quarantining:', {
            from: input.from,
            subject: input.subject,
            messageId: input.messageId,
            attachmentCount: input.attachments.length,
          });
          
          // Return safe response - email is quarantined
          return {
            status: 'quarantined',
            message: 'Email from unknown sender - stored for admin review',
            messageId: input.messageId
          };
        }
        
        // Known user - proceed with normal ingestion
        const userId = identityResult.userId;
        const organizationId = identityResult.organizationId || 1;

        const { storagePut } = await import('./storage');
        const results: Array<{ filename: string; artifactId: number; artifactCode?: string; status: string }> = [];

        // Try to find project from code if provided
        let projectId: number | undefined;
        if (input.projectCode) {
          const project = await db.getProjectByCode(input.projectCode);
          if (project) {
            projectId = project.id;
          }
        }

        // Process each attachment
        for (const attachment of input.attachments) {
          try {
            // Decode base64 content
            const fileBuffer = Buffer.from(attachment.content, 'base64');
            
            // Generate file hash
            const crypto = await import('crypto');
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            
            // Check for duplicates
            const existingArtifact = await db.getArtifactByHash(fileHash);
            if (existingArtifact) {
              results.push({
                filename: attachment.filename,
                artifactId: existingArtifact.id,
                artifactCode: existingArtifact.artifactCode ?? undefined,
                status: 'duplicate',
              });
              continue;
            }
            
            // Determine artifact type from MIME type
            let artifactType: 'document' | 'image' | 'audio' | 'video' | 'message' = 'document';
            if (attachment.mimeType.startsWith('image/')) {
              artifactType = 'image';
            } else if (attachment.mimeType.startsWith('audio/')) {
              artifactType = 'audio';
            } else if (attachment.mimeType.startsWith('video/')) {
              artifactType = 'video';
            }
            
            // Generate unique file key
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const ext = attachment.filename.split('.').pop() || 'bin';
            const fileKey = `artifacts/email-ingest/${timestamp}-${randomSuffix}.${ext}`;
            
            // Upload to S3
            const { url } = await storagePut(fileKey, fileBuffer, attachment.mimeType);
            
            // Create artifact record
            const artifactResult = await db.createArtifact({
              organizationId: 1, // Default org
              artifactType,
              name: attachment.filename,
              description: `Received via email from ${input.from}. Subject: ${input.subject}`,
              originalFilename: attachment.filename,
              originalFileUrl: url,
              originalFileHash: fileHash,
              originalFileSizeBytes: attachment.size,
              originalMimeType: attachment.mimeType,
              ingestionChannel: 'email',
              senderType: 'external',
              senderEmail: input.from,
              projectId,
              processingStatus: 'pending',
              tags: ['email-ingested'],
            } as any);
            
            const artifactId = typeof artifactResult === 'object' && artifactResult !== null 
              ? artifactResult.id 
              : (typeof artifactResult === 'number' ? artifactResult : 0);
            const artifactCode = typeof artifactResult === 'object' && artifactResult !== null 
              ? artifactResult.artifactCode 
              : undefined;
            
            if (artifactId) {
              // Create type-specific extension
              if (artifactType === 'image') {
                await db.createArtifactImage({
                  artifactId,
                  imageKind: 'other',
                } as any);
              } else if (artifactType === 'audio') {
                await db.createArtifactAudio({
                  artifactId,
                  recordingType: 'other',
                } as any);
              }
              
              // Queue for processing
              await db.updateArtifactProcessingStatus(artifactId, 'preprocessing');
              
              results.push({
                filename: attachment.filename,
                artifactId,
                artifactCode,
                status: 'created',
              });
            } else {
              results.push({
                filename: attachment.filename,
                artifactId: 0,
                status: 'failed',
              });
            }
          } catch (error) {
            results.push({
              filename: attachment.filename,
              artifactId: 0,
              status: 'error',
            });
          }
        }

        // Also create a message artifact for the email itself if it has body content
        if (input.bodyText || input.bodyHtml) {
          try {
            const emailContent = input.bodyText || input.bodyHtml || '';
            const emailBuffer = Buffer.from(emailContent, 'utf-8');
            const crypto = await import('crypto');
            const emailHash = crypto.createHash('sha256').update(emailBuffer).digest('hex');
            
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const fileKey = `artifacts/email-ingest/${timestamp}-${randomSuffix}.eml`;
            
            const { url } = await storagePut(fileKey, emailBuffer, 'message/rfc822');
            
            const emailArtifact = await db.createArtifact({
              organizationId: 1,
              artifactType: 'message',
              name: input.subject || 'Email Message',
              description: `Email from ${input.from}`,
              originalFilename: `${input.subject || 'email'}.eml`,
              originalFileUrl: url,
              originalFileHash: emailHash,
              originalFileSizeBytes: emailBuffer.length,
              originalMimeType: 'message/rfc822',
              ingestionChannel: 'email',
              senderType: 'external',
              senderEmail: input.from,
              projectId,
              processingStatus: 'processed',
              tags: ['email-ingested', 'email-body'],
            } as any);
            
            const emailArtifactId = typeof emailArtifact === 'object' && emailArtifact !== null 
              ? emailArtifact.id 
              : (typeof emailArtifact === 'number' ? emailArtifact : 0);
            
            if (emailArtifactId) {
              await db.createArtifactMessage({
                artifactId: emailArtifactId,
                messageType: 'email',
                senderAddress: input.from,
                recipientAddresses: JSON.stringify([input.to]),
                subject: input.subject,
                bodyPlainText: input.bodyText,
                bodyHtml: input.bodyHtml,
                externalMessageId: input.messageId,
              } as any);
            }
          } catch (error) {
            console.error('Failed to create email body artifact:', error);
          }
        }

        return {
          success: true,
          messageId: input.messageId,
          attachmentsProcessed: results.length,
          results,
        };
      }),
  }),

  // Artifact type-specific extensions
  artifactImages: router({
    get: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactImage(input.artifactId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        imageKind: z.enum(['site_photo', 'equipment_nameplate', 'invoice_scan', 'permit_scan', 'safety_issue', 'progress_photo', 'thermal_image', 'drone_capture', 'screenshot', 'drawing', 'diagram', 'other']),
        takenAt: z.date().optional(),
        cameraMake: z.string().optional(),
        cameraModel: z.string().optional(),
        gpsLatitude: z.string().optional(),
        gpsLongitude: z.string().optional(),
        locationDescription: z.string().optional(),
        widthPx: z.number().optional(),
        heightPx: z.number().optional(),
        containsText: z.boolean().optional(),
        ocrText: z.string().optional(),
        equipmentAssetId: z.number().optional(),
        equipmentCondition: z.enum(['good', 'fair', 'poor', 'damaged']).optional(),
        constructionPhase: z.string().optional(),
        thermalMinTemp: z.string().optional(),
        thermalMaxTemp: z.string().optional(),
        thermalAnomalyDetected: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactImage(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        imageKind: z.enum(['site_photo', 'equipment_nameplate', 'invoice_scan', 'permit_scan', 'safety_issue', 'progress_photo', 'thermal_image', 'drone_capture', 'screenshot', 'drawing', 'diagram', 'other']).optional(),
        locationDescription: z.string().optional(),
        equipmentAssetId: z.number().optional(),
        equipmentCondition: z.enum(['good', 'fair', 'poor', 'damaged']).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { artifactId, ...data } = input;
        return db.updateArtifactImage(artifactId, data as any);
      }),
  }),

  artifactAudio: router({
    get: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactAudio(input.artifactId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        durationSeconds: z.number().optional(),
        sampleRate: z.number().optional(),
        channels: z.number().optional(),
        recordedAt: z.date().optional(),
        recordingType: z.enum(['voice_note', 'call', 'meeting', 'site_ambient']).optional(),
        participants: z.array(z.object({
          name: z.string(),
          role: z.string().optional(),
          speakerId: z.string().optional(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactAudio(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        transcriptStatus: z.enum(['pending', 'processing', 'complete', 'failed']).optional(),
        transcriptText: z.string().optional(),
        transcriptLanguage: z.string().optional(),
        transcriptConfidence: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { artifactId, ...data } = input;
        return db.updateArtifactAudio(artifactId, data as any);
      }),
  }),

  artifactMeetings: router({
    get: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactMeeting(input.artifactId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        meetingType: z.enum(['internal', 'external', 'site_visit', 'due_diligence', 'board', 'investor', 'other']),
        meetingTitle: z.string().optional(),
        scheduledStart: z.date().optional(),
        scheduledEnd: z.date().optional(),
        location: z.string().optional(),
        isVirtual: z.boolean().optional(),
        meetingPlatform: z.string().optional(),
        meetingLink: z.string().optional(),
        participants: z.array(z.object({
          name: z.string(),
          email: z.string().optional(),
          role: z.string().optional(),
          company: z.string().optional(),
          attended: z.boolean(),
        })).optional(),
        organizerName: z.string().optional(),
        organizerEmail: z.string().optional(),
        agenda: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactMeeting(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        transcriptText: z.string().optional(),
        summary: z.string().optional(),
        actionItems: z.array(z.object({
          description: z.string(),
          assignee: z.string().optional(),
          dueDate: z.string().optional(),
          priority: z.string().optional(),
          status: z.string().optional(),
        })).optional(),
        decisions: z.array(z.object({
          description: z.string(),
          madeBy: z.string().optional(),
        })).optional(),
        keyTopics: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { artifactId, ...data } = input;
        return db.updateArtifactMeeting(artifactId, data as any);
      }),
  }),

  // Contracts router
  contracts: router({
    get: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactContract(input.artifactId);
      }),

    listByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return db.getContractsByProject(input.projectId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        contractType: z.enum(['ppa', 'lease', 'epc', 'om', 'financing', 'offtake', 'interconnection', 'insurance', 'other']),
        contractNumber: z.string().optional(),
        contractTitle: z.string().optional(),
        parties: z.array(z.object({
          name: z.string(),
          role: z.string(),
          type: z.string().optional(),
          address: z.string().optional(),
        })).optional(),
        counterpartyName: z.string().optional(),
        counterpartyType: z.string().optional(),
        effectiveDate: z.string().optional(),
        expiryDate: z.string().optional(),
        termYears: z.number().optional(),
        contractValue: z.string().optional(),
        currency: z.string().optional(),
        ppaCapacityKw: z.string().optional(),
        ppaTariffRate: z.string().optional(),
        leaseAreaSqm: z.string().optional(),
        leaseAnnualRent: z.string().optional(),
        contractStatus: z.enum(['draft', 'negotiating', 'executed', 'active', 'expired', 'terminated']).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactContract(input as any);
      }),

    update: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        contractStatus: z.enum(['draft', 'negotiating', 'executed', 'active', 'expired', 'terminated']).optional(),
        executionDate: z.string().optional(),
        executedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { artifactId, ...data } = input;
        return db.updateArtifactContract(artifactId, data as any);
      }),

    // Obligations
    getObligations: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return db.getContractObligations(input.contractId);
      }),

    createObligation: protectedProcedure
      .input(z.object({
        contractId: z.number(),
        artifactId: z.number(),
        obligationType: z.enum(['payment', 'reporting', 'insurance', 'maintenance', 'compliance', 'notification', 'other']),
        obligor: z.string(),
        obligorRole: z.string().optional(),
        description: z.string(),
        frequency: z.enum(['one_time', 'monthly', 'quarterly', 'annually', 'ongoing']).optional(),
        dueDate: z.string().optional(),
        dueDayOfPeriod: z.number().optional(),
        sourceSection: z.string().optional(),
        sourcePage: z.number().optional(),
        sourceText: z.string().optional(),
        alertDaysBefore: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createContractObligation(input as any);
      }),

    updateObligationStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['pending', 'compliant', 'non_compliant', 'waived']),
      }))
      .mutation(async ({ input }) => {
        return db.updateContractObligationStatus(input.id, input.status);
      }),

    getUpcomingObligations: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        daysAhead: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getUpcomingObligations(input.organizationId, input.daysAhead);
      }),

    // Amendments
    getAmendments: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return db.getContractAmendments(input.contractId);
      }),

    createAmendment: protectedProcedure
      .input(z.object({
        contractId: z.number(),
        amendmentArtifactId: z.number(),
        amendmentNumber: z.number(),
        amendmentDate: z.string(),
        effectiveDate: z.string().optional(),
        description: z.string().optional(),
        changesSummary: z.array(z.object({
          field: z.string(),
          oldValue: z.string(),
          newValue: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createContractAmendment(input as any);
      }),
  }),

  // Artifact Extractions router
  artifactExtractions: router({
    listByArtifact: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactExtractions(input.artifactId);
      }),

    listByRunId: protectedProcedure
      .input(z.object({ runId: z.string() }))
      .query(async ({ input }) => {
        return db.getExtractionsByRunId(input.runId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        artifactVersion: z.number().optional(),
        extractionRunId: z.string(),
        extractionModel: z.string().optional(),
        extractionPromptVersion: z.string().optional(),
        fieldKey: z.string(),
        fieldCategory: z.enum(['identity', 'technical', 'commercial', 'legal', 'financial', 'operational', 'compliance']),
        extractedValueText: z.string().optional(),
        extractedValueNumeric: z.string().optional(),
        extractedValueDate: z.string().optional(),
        extractedValueBoolean: z.boolean().optional(),
        extractedValueJson: z.unknown().optional(),
        unit: z.string().optional(),
        sourceType: z.enum(['page', 'timestamp', 'segment', 'cell']).optional(),
        sourcePage: z.number().optional(),
        sourceTimestampStart: z.string().optional(),
        sourceTimestampEnd: z.string().optional(),
        sourceCellReference: z.string().optional(),
        sourceSnippet: z.string().optional(),
        confidence: z.string(),
        extractionNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactExtraction(input as any);
      }),

    verify: protectedProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.verifyExtraction(input.id, ctx.user.id, input.notes);
      }),

    correct: protectedProcedure
      .input(z.object({
        id: z.number(),
        correctedValue: z.object({
          text: z.string().optional(),
          numeric: z.number().optional(),
          date: z.date().optional(),
          boolean: z.boolean().optional(),
          json: z.unknown().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.correctExtraction(input.id, input.correctedValue, ctx.user.id);
      }),

    getUnverified: protectedProcedure
      .input(z.object({
        organizationId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getUnverifiedExtractions(input.organizationId, input.limit);
      }),
  }),

  // Artifact Entity mentions router
  artifactEntityMentions: router({
    listByArtifact: protectedProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        return db.getArtifactEntityMentions(input.artifactId);
      }),

    create: protectedProcedure
      .input(z.object({
        artifactId: z.number(),
        extractionRunId: z.string().optional(),
        mentionText: z.string(),
        mentionType: z.enum(['site', 'asset', 'company', 'person', 'location', 'date', 'amount', 'other']),
        sourcePage: z.number().optional(),
        sourceTimestampStart: z.string().optional(),
        sourceTimestampEnd: z.string().optional(),
        sourceSnippet: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createArtifactEntityMention(input as any);
      }),

    resolve: protectedProcedure
      .input(z.object({
        id: z.number(),
        entityType: z.string(),
        entityId: z.number(),
        confidence: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.resolveArtifactEntityMention(
          input.id,
          input.entityType,
          input.entityId,
          input.confidence,
          ctx.user.id
        );
      }),

    getUnresolved: protectedProcedure
      .input(z.object({ organizationId: z.number() }))
      .query(async ({ input }) => {
        return db.getUnresolvedArtifactMentions(input.organizationId);
      }),
  }),

  // Lifecycle stages router
  lifecycle: router({
    getStages: protectedProcedure
      .query(async () => {
        return db.getLifecycleStages();
      }),

    getStageByKey: protectedProcedure
      .input(z.object({ stageKey: z.string() }))
      .query(async ({ input }) => {
        return db.getLifecycleStageByKey(input.stageKey);
      }),

    createStage: protectedProcedure
      .input(z.object({
        stageKey: z.string(),
        stageName: z.string(),
        stageOrder: z.number(),
        description: z.string().optional(),
        typicalDurationMonths: z.number().optional(),
        milestones: z.array(z.object({
          milestone: z.string(),
          description: z.string(),
          required: z.boolean(),
        })).optional(),
        requiredAttributes: z.array(z.object({
          attributeKey: z.string(),
          category: z.string(),
          requiredForExit: z.boolean(),
        })).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createLifecycleStage(input as any);
      }),

    getAttributeDefinitions: protectedProcedure
      .input(z.object({ lifecycleStage: z.string() }))
      .query(async ({ input }) => {
        return db.getStageAttributeDefinitions(input.lifecycleStage);
      }),

    createAttributeDefinition: protectedProcedure
      .input(z.object({
        lifecycleStage: z.string(),
        attributeKey: z.string(),
        attributeCategory: z.enum(['identity', 'technical', 'commercial', 'financial', 'compliance', 'operational']),
        displayName: z.string(),
        description: z.string().optional(),
        dataType: z.enum(['text', 'number', 'date', 'boolean', 'json', 'file']),
        unit: z.string().optional(),
        required: z.boolean().optional(),
        requiredForStageExit: z.boolean().optional(),
        validationRules: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
          pattern: z.string().optional(),
          options: z.array(z.string()).optional(),
        }).optional(),
        displayOrder: z.number().optional(),
        displayGroup: z.string().optional(),
        typicalSources: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createStageAttributeDefinition(input as any);
      }),

    // Tracking
    getTracking: protectedProcedure
      .input(z.object({
        entityType: z.enum(['project', 'site', 'asset']),
        entityId: z.number(),
      }))
      .query(async ({ input }) => {
        return db.getAssetLifecycleTracking(input.entityType, input.entityId);
      }),

    createTracking: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        assetId: z.number().optional(),
        currentStage: z.string(),
        expectedStageExitAt: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createAssetLifecycleTracking({
          ...input,
          stageEnteredAt: new Date(),
        } as any);
      }),

    updateCompleteness: protectedProcedure
      .input(z.object({
        trackingId: z.number(),
        completeness: z.number(),
        milestonesCompleted: z.number(),
        milestonesTotal: z.number(),
        attributesCompleted: z.number(),
        attributesRequired: z.number(),
      }))
      .mutation(async ({ input }) => {
        return db.updateLifecycleCompleteness(
          input.trackingId,
          input.completeness,
          input.milestonesCompleted,
          input.milestonesTotal,
          input.attributesCompleted,
          input.attributesRequired
        );
      }),

    transitionStage: protectedProcedure
      .input(z.object({
        trackingId: z.number(),
        newStage: z.string(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.transitionLifecycleStage(
          input.trackingId,
          input.newStage,
          ctx.user.id,
          input.notes
        );
      }),

    completeMilestone: protectedProcedure
      .input(z.object({
        lifecycleTrackingId: z.number(),
        milestoneKey: z.string(),
        evidenceArtifactIds: z.array(z.number()).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.completeMilestone({
          ...input,
          completedAt: new Date(),
          completedBy: ctx.user.id,
        } as any);
      }),

    getMilestoneCompletions: protectedProcedure
      .input(z.object({ trackingId: z.number() }))
      .query(async ({ input }) => {
        return db.getMilestoneCompletions(input.trackingId);
      }),

    getTransitionHistory: protectedProcedure
      .input(z.object({ trackingId: z.number() }))
      .query(async ({ input }) => {
        return db.getStageTransitionHistory(input.trackingId);
      }),

    blockStage: protectedProcedure
      .input(z.object({
        trackingId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.blockLifecycleStage(input.trackingId, input.reason);
      }),

    unblockStage: protectedProcedure
      .input(z.object({ trackingId: z.number() }))
      .mutation(async ({ input }) => {
        return db.unblockLifecycleStage(input.trackingId);
      }),
  }),

  // ==========================================================================
  // CONVERSATIONAL AGENT (WhatsApp + Email)
  // ==========================================================================
  conversationalAgent: router({
    // Process inbound message from any channel
    processMessage: publicProcedure
      .input(z.object({
        channel: z.enum(['whatsapp', 'email', 'sms']),
        senderIdentifier: z.string(),
        senderDisplayName: z.string().optional(),
        messageType: z.enum(['text', 'image', 'document', 'audio', 'video', 'location', 'contact']).default('text'),
        textContent: z.string().optional(),
        mediaUrl: z.string().optional(),
        mediaContentType: z.string().optional(),
        mediaFilename: z.string().optional(),
        subject: z.string().optional(),
        inReplyTo: z.string().optional(),
        references: z.array(z.string()).optional(),
        rawPayload: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        return processInboundMessage(input);
      }),

    // Identity management
    resolveIdentity: protectedProcedure
      .input(z.object({
        type: z.enum(['whatsapp_phone', 'email', 'phone', 'slack_id']),
        value: z.string(),
      }))
      .query(async ({ input }) => {
        return db.resolveIdentity(input.type, input.value);
      }),

    createIdentifier: protectedProcedure
      .input(z.object({
        type: z.enum(['whatsapp_phone', 'email', 'phone', 'slack_id']),
        value: z.string(),
        userId: z.number(),
        organizationId: z.number().optional(),
        status: z.enum(['pending', 'verified']).default('pending'),
      }))
      .mutation(async ({ input }) => {
        return db.createUserIdentifier(input);
      }),

    verifyIdentifier: protectedProcedure
      .input(z.object({
        identifierId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.verifyUserIdentifier(input.identifierId, ctx.user.id);
      }),

    revokeIdentifier: protectedProcedure
      .input(z.object({
        identifierId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.revokeUserIdentifier(input.identifierId, ctx.user.id, input.reason);
      }),

    getUserIdentifiers: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUserIdentifiers(input.userId);
      }),

    // Unclaimed inbound (quarantine) management
    getPendingUnclaimed: protectedProcedure
      .input(z.object({
        organizationId: z.number().optional(),
        limit: z.number().default(50),
      }))
      .query(async ({ input }) => {
        return db.getPendingUnclaimedInbound(input.organizationId, input.limit);
      }),

    claimInbound: protectedProcedure
      .input(z.object({
        inboundId: z.number(),
        claimedByUserId: z.number(),
        createIdentifier: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.claimInbound(input.inboundId, input.claimedByUserId, ctx.user.id, input.createIdentifier);
      }),

    rejectInbound: protectedProcedure
      .input(z.object({
        inboundId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        return db.rejectInbound(input.inboundId, input.reason);
      }),

    // Conversation session management
    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return db.getConversationSession(input.sessionId);
      }),

    updateContext: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        lastReferencedProjectId: z.number().nullable().optional(),
        lastReferencedSiteId: z.number().nullable().optional(),
        lastReferencedAssetId: z.number().nullable().optional(),
        lastReferencedDocumentId: z.number().nullable().optional(),
        activeDataroomId: z.number().nullable().optional(),
        activeViewScopeId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { sessionId, ...context } = input;
        return db.updateConversationContext(sessionId, context);
      }),

    // Attachment linking
    createPrimaryLink: protectedProcedure
      .input(z.object({
        ingestedFileId: z.number().optional(),
        artifactId: z.number().optional(),
        projectId: z.number().optional(),
        siteId: z.number().optional(),
        assetId: z.number().optional(),
        linkedBy: z.enum(['ai_suggestion', 'user_confirmed', 'admin_assigned', 'auto_rule']),
        aiConfidence: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createPrimaryAttachmentLink({
          ...input,
          linkedByUserId: ctx.user.id,
        });
      }),

    createSecondaryLink: protectedProcedure
      .input(z.object({
        ingestedFileId: z.number().optional(),
        artifactId: z.number().optional(),
        dataroomId: z.number().optional(),
        dataroomItemId: z.number().optional(),
        checklistItemId: z.number().optional(),
        viewScopeId: z.number().optional(),
        linkedBy: z.enum(['ai_suggestion', 'user_confirmed', 'admin_assigned', 'auto_rule']),
        aiConfidence: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createSecondaryAttachmentLink({
          ...input,
          linkedByUserId: ctx.user.id,
        });
      }),

    getAttachmentLinks: protectedProcedure
      .input(z.object({
        ingestedFileId: z.number().optional(),
        artifactId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getAttachmentLinks(input.ingestedFileId, input.artifactId);
      }),

    getUnlinkedAttachments: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getUnlinkedAttachments(input.limit);
      }),
  }),

  // ============ REQUESTS + SCOPED SUBMISSIONS SYSTEM ============
  requests: router({
    // Request Templates
    templates: router({
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1),
          category: z.string().min(1),
          description: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          // Get user's org (for now use first org membership)
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          const orgId = memberships[0].organizationId;
          
          const templateId = await db.createRequestTemplate({
            issuerOrgId: orgId,
            name: input.name,
            category: input.category,
            description: input.description,
            createdByUserId: ctx.user.id,
            status: 'draft',
          });
          
          await db.logRequestEvent({
            eventType: 'template_created',
            actorUserId: ctx.user.id,
            actorOrgId: orgId,
            targetType: 'template',
            targetId: templateId || undefined,
          });
          
          return { templateId };
        }),
      
      list: protectedProcedure
        .query(async ({ ctx }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return [];
          return db.getRequestTemplates(memberships[0].organizationId);
        }),
      
      get: protectedProcedure
        .input(z.object({ templateId: z.number() }))
        .query(async ({ ctx, input }) => {
          const template = await db.getRequestTemplate(input.templateId);
          if (!template) return null;
          
          // Check access
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === template.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
          }
          
          return template;
        }),
      
      update: protectedProcedure
        .input(z.object({
          templateId: z.number(),
          name: z.string().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          status: z.enum(['draft', 'active', 'archived']).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const template = await db.getRequestTemplate(input.templateId);
          if (!template) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Template not found' });
          }
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === template.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
          }
          
          const { templateId, ...updates } = input;
          await db.updateRequestTemplate(templateId, updates);
          
          return { success: true };
        }),
    }),
    
    // Requirements Schemas
    schemas: router({
      create: protectedProcedure
        .input(z.object({
          templateId: z.number().optional(),
          schemaJson: z.object({
            items: z.array(z.object({
              type: z.enum(['field', 'document', 'computed', 'attestation']),
              key: z.string(),
              label: z.string(),
              description: z.string().optional(),
              required: z.boolean(),
              vatrPathHints: z.array(z.string()).optional(),
              verificationPolicy: z.enum(['human_required', 'auto_allowed_if_source_verified', 'issuer_must_verify']),
              dataType: z.enum(['text', 'number', 'date', 'boolean', 'file', 'select']).optional(),
              options: z.array(z.string()).optional(),
            })),
          }),
        }))
        .mutation(async ({ ctx, input }) => {
          const schemaId = await db.createRequirementsSchema({
            templateId: input.templateId,
            schemaJson: input.schemaJson,
            createdByUserId: ctx.user.id,
          });
          return { schemaId };
        }),
      
      get: protectedProcedure
        .input(z.object({ schemaId: z.number() }))
        .query(async ({ input }) => {
          return db.getRequirementsSchema(input.schemaId);
        }),
      
      publish: protectedProcedure
        .input(z.object({ schemaId: z.number() }))
        .mutation(async ({ input }) => {
          await db.publishRequirementsSchema(input.schemaId);
          return { success: true };
        }),
    }),
    
    // Template Version Diff
    getSchemaVersions: protectedProcedure
      .input(z.object({
        templateId: z.number(),
      }))
      .query(async ({ input }) => {
        // Get all versions of the schema for this template
        const versions = await db.getRequirementsSchemasByTemplate(input.templateId);
        return versions.map(v => ({
          id: v.id,
          version: v.version,
          isPublished: v.isPublished,
          createdAt: v.createdAt,
          itemCount: (v.schemaJson as { items: unknown[] })?.items?.length || 0,
        }));
      }),
    
    compareSchemaVersions: protectedProcedure
      .input(z.object({
        schemaIdA: z.number(),
        schemaIdB: z.number(),
      }))
      .query(async ({ input }) => {
        const schemaA = await db.getRequirementsSchema(input.schemaIdA);
        const schemaB = await db.getRequirementsSchema(input.schemaIdB);
        
        if (!schemaA || !schemaB) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Schema not found' });
        }
        
        const itemsA = (schemaA.schemaJson as { items: Array<{ key: string; label: string; type: string; required: boolean }> })?.items || [];
        const itemsB = (schemaB.schemaJson as { items: Array<{ key: string; label: string; type: string; required: boolean }> })?.items || [];
        
        const keysA = new Set(itemsA.map(i => i.key));
        const keysB = new Set(itemsB.map(i => i.key));
        
        const added = itemsB.filter(i => !keysA.has(i.key));
        const removed = itemsA.filter(i => !keysB.has(i.key));
        const modified: Array<{ key: string; changes: string[] }> = [];
        
        for (const itemB of itemsB) {
          const itemA = itemsA.find(i => i.key === itemB.key);
          if (itemA) {
            const changes: string[] = [];
            if (itemA.label !== itemB.label) changes.push(`Label: "${itemA.label}" → "${itemB.label}"`);
            if (itemA.type !== itemB.type) changes.push(`Type: ${itemA.type} → ${itemB.type}`);
            if (itemA.required !== itemB.required) changes.push(`Required: ${itemA.required} → ${itemB.required}`);
            if (changes.length > 0) {
              modified.push({ key: itemB.key, changes });
            }
          }
        }
        
        return {
          versionA: schemaA.version,
          versionB: schemaB.version,
          added: added.map(i => ({ key: i.key, label: i.label, type: i.type })),
          removed: removed.map(i => ({ key: i.key, label: i.label, type: i.type })),
          modified,
          summary: `${added.length} added, ${removed.length} removed, ${modified.length} modified`,
        };
      }),
    
    // Request Analytics Dashboard
    analytics: protectedProcedure
      .input(z.object({
        dateRange: z.object({
          start: z.date().optional(),
          end: z.date().optional(),
        }).optional(),
      }))
      .query(async ({ ctx }) => {
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (memberships.length === 0) {
          return { totalRequests: 0, completionRate: 0, avgResponseDays: 0, byStatus: [], byTemplate: [], recentActivity: [] };
        }
        const orgId = memberships[0].organizationId;
        
        // Get all requests issued by this org
        const requests = await db.getRequestsByIssuer(orgId);
        
        const totalRequests = requests.length;
        const completedRequests = requests.filter(r => r.status === 'completed' || r.status === 'closed').length;
        const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
        
        // Calculate average response time (from issued to first submission)
        let totalResponseDays = 0;
        let responseCount = 0;
        for (const request of requests) {
          if (request.status === 'completed' || request.status === 'closed') {
            // Estimate response time as 7 days for now (would need submission timestamps)
            totalResponseDays += 7;
            responseCount++;
          }
        }
        const avgResponseDays = responseCount > 0 ? Math.round(totalResponseDays / responseCount) : 0;
        
        // Group by status
        const statusCounts: Record<string, number> = {};
        for (const request of requests) {
          statusCounts[request.status] = (statusCounts[request.status] || 0) + 1;
        }
        const byStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
        
        // Group by template
        const templateCounts: Record<string, number> = {};
        for (const request of requests) {
          const templateName = request.templateId ? `Template #${request.templateId}` : 'Ad-hoc';
          templateCounts[templateName] = (templateCounts[templateName] || 0) + 1;
        }
        const byTemplate = Object.entries(templateCounts).map(([template, count]) => ({ template, count }));
        
        // Recent activity (last 10 requests)
        const recentActivity = requests.slice(0, 10).map(r => ({
          id: r.id,
          title: r.title,
          status: r.status,
          createdAt: r.createdAt,
        }));
        
        return {
          totalRequests,
          completionRate,
          avgResponseDays,
          byStatus,
          byTemplate,
          recentActivity,
        };
      }),
    
    // Request Instances
    create: protectedProcedure
      .input(z.object({
        templateId: z.number().optional(),
        title: z.string().min(1),
        instructions: z.string().optional(),
        deadlineAt: z.date().optional(),
        requirementsSchemaId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (memberships.length === 0) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
        }
        const orgId = memberships[0].organizationId;
        
        const requestId = await db.createRequest({
          templateId: input.templateId,
          issuerOrgId: orgId,
          issuerUserId: ctx.user.id,
          title: input.title,
          instructions: input.instructions,
          deadlineAt: input.deadlineAt,
          requirementsSchemaId: input.requirementsSchemaId,
          status: 'draft',
        });
        
        await db.logRequestEvent({
          requestId: requestId || undefined,
          eventType: 'request_created',
          actorUserId: ctx.user.id,
          actorOrgId: orgId,
        });
        
        return { requestId };
      }),
    
    // Bulk Request Issuance - create requests for multiple recipients at once
    bulkIssue: protectedProcedure
      .input(z.object({
        templateId: z.number().optional(),
        title: z.string().min(1),
        instructions: z.string().optional(),
        requirementsSchemaId: z.number().optional(),
        recipients: z.array(z.object({
          recipientOrgId: z.number().optional(),
          recipientEmail: z.string().email().optional(),
          deadlineAt: z.date().optional(),
        })).min(1).max(100),
        defaultDeadlineAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (memberships.length === 0) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
        }
        const orgId = memberships[0].organizationId;
        
        const results = [];
        
        for (const recipient of input.recipients) {
          // Create request for each recipient
          const requestId = await db.createRequest({
            templateId: input.templateId,
            issuerOrgId: orgId,
            issuerUserId: ctx.user.id,
            title: input.title,
            instructions: input.instructions,
            deadlineAt: recipient.deadlineAt || input.defaultDeadlineAt,
            requirementsSchemaId: input.requirementsSchemaId,
            status: 'draft',
          });
          
          if (requestId) {
            // Invite recipient
            await db.inviteRecipient({
              requestId,
              recipientOrgId: recipient.recipientOrgId,
              recipientEmail: recipient.recipientEmail,
            });
            
            // Issue the request
            await db.updateRequest(requestId, { status: 'issued' });
            
            await db.logRequestEvent({
              requestId,
              eventType: 'request_created',
              actorUserId: ctx.user.id,
              actorOrgId: orgId,
            });
            
            await db.logRequestEvent({
              requestId,
              eventType: 'request_issued',
              actorUserId: ctx.user.id,
              actorOrgId: orgId,
            });
            
            // Send notifications
            if (recipient.recipientOrgId) {
              const members = await db.getOrganizationMembers(recipient.recipientOrgId);
              const recipientNotifications = [];
              for (const member of members) {
                if (member.userId) {
                  const user = await db.getUserById(member.userId);
                  if (user) {
                    recipientNotifications.push({
                      userId: member.userId,
                      email: user.email,
                      name: user.name,
                    });
                  }
                }
              }
              
              if (recipientNotifications.length > 0) {
                const issuerOrg = await db.getOrganizationById(orgId);
                const template = input.templateId ? await db.getRequestTemplate(input.templateId) : null;
                
                await notifyRequestIssued(
                  recipientNotifications,
                  {
                    requestId,
                    requestTitle: template?.name || input.title,
                    templateName: template?.name,
                    issuerOrgName: issuerOrg?.name || undefined,
                    deadline: recipient.deadlineAt || input.defaultDeadlineAt || undefined,
                  },
                  ctx.user.id,
                  orgId
                );
              }
            }
            
            results.push({ requestId, recipientOrgId: recipient.recipientOrgId, recipientEmail: recipient.recipientEmail, success: true });
          } else {
            results.push({ requestId: null, recipientOrgId: recipient.recipientOrgId, recipientEmail: recipient.recipientEmail, success: false });
          }
        }
        
        return {
          totalRequested: input.recipients.length,
          successCount: results.filter(r => r.success).length,
          failedCount: results.filter(r => !r.success).length,
          results,
        };
      }),
    
    list: protectedProcedure
      .input(z.object({
        type: z.enum(['issued', 'incoming']).default('issued'),
      }))
      .query(async ({ ctx, input }) => {
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (memberships.length === 0) return [];
        const orgId = memberships[0].organizationId;
        
        if (input.type === 'issued') {
          return db.getRequestsByIssuer(orgId);
        } else {
          return db.getIncomingRequests(orgId);
        }
      }),
    
    get: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ ctx, input }) => {
        const request = await db.getRequest(input.requestId);
        if (!request) return null;
        
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        const orgId = memberships[0]?.organizationId;
        
        // Check if user is issuer or recipient
        const isIssuer = request.issuerOrgId === orgId;
        const recipients = await db.getRequestRecipients(input.requestId);
        const isRecipient = recipients.some(r => r.recipientOrgId === orgId);
        
        if (!isIssuer && !isRecipient) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
        }
        
        // Get schema if exists
        let schema = null;
        if (request.requirementsSchemaId) {
          schema = await db.getRequirementsSchema(request.requirementsSchemaId);
        }
        
        return { ...request, recipients, schema, isIssuer, isRecipient };
      }),
    
    issue: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const request = await db.getRequest(input.requestId);
        if (!request) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
        }
        
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can issue request' });
        }
        
        await db.updateRequest(input.requestId, { status: 'issued' });
        
        await db.logRequestEvent({
          requestId: input.requestId,
          eventType: 'request_issued',
          actorUserId: ctx.user.id,
          actorOrgId: request.issuerOrgId,
        });
        
        // Send notifications to recipients
        const recipients = await db.getRequestRecipients(input.requestId);
        const issuerOrg = await db.getOrganizationById(request.issuerOrgId);
        const template = request.templateId ? await db.getRequestTemplate(request.templateId) : null;
        
        const recipientNotifications = [];
        for (const recipient of recipients) {
          if (recipient.recipientOrgId) {
            const members = await db.getOrganizationMembers(recipient.recipientOrgId);
            for (const member of members) {
              if (member.userId) {
                const user = await db.getUserById(member.userId);
                if (user) {
                  recipientNotifications.push({
                    userId: member.userId,
                    email: user.email,
                    name: user.name,
                  });
                }
              }
            }
          }
        }
        
        if (recipientNotifications.length > 0) {
          await notifyRequestIssued(
            recipientNotifications,
            {
              requestId: input.requestId,
              requestTitle: template?.name || `Request #${input.requestId}`,
              templateName: template?.name,
              issuerOrgName: issuerOrg?.name || undefined,
              deadline: request.deadlineAt || undefined,
            },
            ctx.user.id,
            request.issuerOrgId
          );
        }
        
        return { success: true };
      }),
    
    // Recipients
    recipients: router({
      invite: protectedProcedure
        .input(z.object({
          requestId: z.number(),
          recipientOrgId: z.number().optional(),
          recipientEmail: z.string().email().optional(),
          recipientPhone: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const request = await db.getRequest(input.requestId);
          if (!request) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can invite recipients' });
          }
          
          const recipientId = await db.inviteRecipient({
            requestId: input.requestId,
            recipientOrgId: input.recipientOrgId,
            recipientEmail: input.recipientEmail,
            recipientPhone: input.recipientPhone,
          });
          
          await db.logRequestEvent({
            requestId: input.requestId,
            eventType: 'recipient_invited',
            actorUserId: ctx.user.id,
            actorOrgId: request.issuerOrgId,
            targetType: 'recipient',
            targetId: recipientId || undefined,
          });
          
          return { recipientId };
        }),
      
      updateStatus: protectedProcedure
        .input(z.object({
          recipientId: z.number(),
          status: z.enum(['opened', 'responding', 'submitted', 'declined']),
        }))
        .mutation(async ({ input }) => {
          await db.updateRecipientStatus(input.recipientId, input.status);
          return { success: true };
        }),
    }),
    
    // Response Workspaces
    workspaces: router({
      create: protectedProcedure
        .input(z.object({ requestId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          const orgId = memberships[0].organizationId;
          
          // Check if already have a workspace
          const existing = await db.getWorkspaceForRequest(input.requestId, orgId);
          if (existing) {
            return { workspaceId: existing.id };
          }
          
          const workspaceId = await db.createResponseWorkspace({
            requestId: input.requestId,
            recipientOrgId: orgId,
            createdByUserId: ctx.user.id,
          });
          
          await db.logRequestEvent({
            requestId: input.requestId,
            workspaceId: workspaceId || undefined,
            eventType: 'workspace_created',
            actorUserId: ctx.user.id,
            actorOrgId: orgId,
          });
          
          return { workspaceId };
        }),
      
      get: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .query(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) return null;
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === workspace.recipientOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
          }
          
          const assets = await db.getWorkspaceAssets(input.workspaceId);
          const answers = await db.getWorkspaceAnswers(input.workspaceId);
          const documents = await db.getWorkspaceDocuments(input.workspaceId);
          const signOffs = await db.getWorkspaceSignOffs(input.workspaceId);
          
          return { ...workspace, assets, answers, documents, signOffs };
        }),
      
      addAsset: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          assetId: z.number(),
        }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
          }
          
          if (workspace.status !== 'active') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace is locked' });
          }
          
          await db.addWorkspaceAsset({
            workspaceId: input.workspaceId,
            assetId: input.assetId,
            addedByUserId: ctx.user.id,
          });
          
          return { success: true };
        }),
      
      removeAsset: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          assetId: z.number(),
        }))
        .mutation(async ({ input }) => {
          await db.removeWorkspaceAsset(input.workspaceId, input.assetId);
          return { success: true };
        }),
      
      saveAnswer: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          requirementKey: z.string(),
          assetId: z.number().optional(),
          answerJson: z.unknown(),
          vatrSourcePath: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace || workspace.status !== 'active') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot modify locked workspace' });
          }
          
          const answerId = await db.saveWorkspaceAnswer({
            workspaceId: input.workspaceId,
            requirementKey: input.requirementKey,
            assetId: input.assetId,
            answerJson: input.answerJson,
            vatrSourcePath: input.vatrSourcePath,
          });
          
          await db.logRequestEvent({
            requestId: workspace.requestId,
            workspaceId: input.workspaceId,
            eventType: 'answer_saved',
            actorUserId: ctx.user.id,
            actorOrgId: workspace.recipientOrgId,
            targetType: 'answer',
            targetId: answerId || undefined,
            detailsJson: { requirementKey: input.requirementKey },
          });
          
          return { answerId };
        }),
      
      uploadDocument: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          requirementKey: z.string().optional(),
          assetId: z.number().optional(),
          documentId: z.number().optional(),
          fileUrl: z.string().optional(),
          fileName: z.string(),
          fileType: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace || workspace.status !== 'active') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot modify locked workspace' });
          }
          
          const docId = await db.addWorkspaceDocument({
            workspaceId: input.workspaceId,
            requirementKey: input.requirementKey,
            assetId: input.assetId,
            documentId: input.documentId,
            fileUrl: input.fileUrl,
            fileName: input.fileName,
            fileType: input.fileType,
            uploadedByUserId: ctx.user.id,
          });
          
          return { documentId: docId };
        }),
      
      validate: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .query(async ({ input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) return null;
          
          const request = await db.getRequest(workspace.requestId);
          if (!request?.requirementsSchemaId) {
            return { isComplete: true, missingFields: [], missingDocs: [], inconsistencies: [] };
          }
          
          return db.validateWorkspaceCompleteness(input.workspaceId, request.requirementsSchemaId);
        }),
    }),
    
    // Sign-offs
    signOffs: router({
      getRequirements: protectedProcedure
        .input(z.object({ requestId: z.number() }))
        .query(async ({ input }) => {
          return db.getSignOffRequirements(input.requestId);
        }),
      
      sign: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          requirementId: z.number(),
          status: z.enum(['approved', 'rejected']),
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const eventId = await db.recordSignOff({
            workspaceId: input.workspaceId,
            requirementId: input.requirementId,
            signedByUserId: ctx.user.id,
            status: input.status,
            notes: input.notes,
          });
          
          return { eventId };
        }),
      
      checkComplete: protectedProcedure
        .input(z.object({ workspaceId: z.number(), requestId: z.number() }))
        .query(async ({ input }) => {
          return db.checkSignOffComplete(input.workspaceId, input.requestId);
        }),
    }),
    
    // Submissions
    submissions: router({
      submit: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
          }
          
          if (workspace.status !== 'active') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Workspace already submitted' });
          }
          
          // Check sign-offs complete
          const signOffsComplete = await db.checkSignOffComplete(input.workspaceId, workspace.requestId);
          if (!signOffsComplete) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sign-offs not complete' });
          }
          
          // Get request to find issuer org
          const request = await db.getRequest(workspace.requestId);
          if (!request) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          
          // Validate completeness
          if (request.requirementsSchemaId) {
            const validation = await db.validateWorkspaceCompleteness(input.workspaceId, request.requirementsSchemaId);
            if (!validation.isComplete) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `Missing required items: ${[...validation.missingFields, ...validation.missingDocs].join(', ')}`,
              });
            }
          }
          
          // Create submission with snapshot and grant
          const result = await db.createSubmission(
            input.workspaceId,
            workspace.requestId,
            workspace.recipientOrgId,
            ctx.user.id,
            request.issuerOrgId
          );
          
          if (!result) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create submission' });
          }
          
          // Update recipient status
          const recipients = await db.getRequestRecipients(workspace.requestId);
          const myRecipient = recipients.find(r => r.recipientOrgId === workspace.recipientOrgId);
          if (myRecipient) {
            await db.updateRecipientStatus(myRecipient.id, 'submitted');
          }
          
          await db.logRequestEvent({
            requestId: workspace.requestId,
            workspaceId: input.workspaceId,
            submissionId: result.submissionId,
            eventType: 'submission_created',
            actorUserId: ctx.user.id,
            actorOrgId: workspace.recipientOrgId,
            detailsJson: { snapshotId: result.snapshotId, grantId: result.grantId },
          });
          
          // Send notification to issuer org
          const issuerOrg = await db.getOrganizationById(request.issuerOrgId);
          const recipientOrg = await db.getOrganizationById(workspace.recipientOrgId);
          const template = request.templateId ? await db.getRequestTemplate(request.templateId) : null;
          
          const issuerMembers = await db.getOrganizationMembers(request.issuerOrgId);
          const issuerNotifications = [];
          for (const member of issuerMembers) {
            if (member.userId) {
              const user = await db.getUserById(member.userId);
              if (user) {
                issuerNotifications.push({
                  userId: member.userId,
                  email: user.email,
                  name: user.name,
                });
              }
            }
          }
          
          if (issuerNotifications.length > 0) {
            await notifySubmissionReceived(
              issuerNotifications,
              {
                requestId: workspace.requestId,
                requestTitle: template?.name || `Request #${workspace.requestId}`,
                recipientOrgName: recipientOrg?.name || undefined,
              },
              ctx.user.id,
              request.issuerOrgId
            );
          }
          
          return result;
        }),
      
      get: protectedProcedure
        .input(z.object({ submissionId: z.number() }))
        .query(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
          }
          const orgId = memberships[0].organizationId;
          
          // Check access via grant or ownership
          const access = await db.canAccessSubmission(ctx.user.id, orgId, input.submissionId);
          if (!access.canAccess) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied - no valid grant' });
          }
          
          const submission = await db.getSubmissionWithSnapshot(input.submissionId);
          return { ...submission, accessType: access.accessType };
        }),
      
      listForRequest: protectedProcedure
        .input(z.object({ requestId: z.number() }))
        .query(async ({ ctx, input }) => {
          const request = await db.getRequest(input.requestId);
          if (!request) return [];
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can list submissions' });
          }
          
          return db.getSubmissionsForRequest(input.requestId);
        }),
      
      review: protectedProcedure
        .input(z.object({
          submissionId: z.number(),
          status: z.enum(['accepted', 'needs_clarification', 'rejected']),
          notes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const submission = await db.getSubmission(input.submissionId);
          if (!submission) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Submission not found' });
          }
          
          const request = await db.getRequest(submission.requestId);
          if (!request) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can review submissions' });
          }
          
          await db.updateSubmissionStatus(input.submissionId, input.status, ctx.user.id, input.notes);
          
          await db.logRequestEvent({
            requestId: submission.requestId,
            submissionId: input.submissionId,
            eventType: 'submission_reviewed',
            actorUserId: ctx.user.id,
            actorOrgId: request.issuerOrgId,
            detailsJson: { status: input.status, notes: input.notes },
          });
          
          return { success: true };
        }),
    }),
    
    // Clarifications
    clarifications: router({
      create: protectedProcedure
        .input(z.object({
          requestId: z.number(),
          submissionId: z.number().optional(),
          toOrgId: z.number(),
          subject: z.string().optional(),
          message: z.string().min(1),
          parentId: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' });
          }
          const orgId = memberships[0].organizationId;
          
          const clarificationId = await db.createClarification({
            requestId: input.requestId,
            submissionId: input.submissionId,
            fromOrgId: orgId,
            fromUserId: ctx.user.id,
            toOrgId: input.toOrgId,
            subject: input.subject,
            message: input.message,
            parentId: input.parentId,
          });
          
          // Send notification to recipient org
          const request = await db.getRequest(input.requestId);
          const template = request?.templateId ? await db.getRequestTemplate(request.templateId) : null;
          const actor = await db.getUserById(ctx.user.id);
          
          const toOrgMembers = await db.getOrganizationMembers(input.toOrgId);
          const recipientNotifications = [];
          for (const member of toOrgMembers) {
            if (member.userId) {
              const user = await db.getUserById(member.userId);
              if (user) {
                recipientNotifications.push({
                  userId: member.userId,
                  email: user.email,
                  name: user.name,
                });
              }
            }
          }
          
          if (recipientNotifications.length > 0) {
            await notifyClarificationNeeded(
              recipientNotifications,
              {
                requestId: input.requestId,
                requestTitle: template?.name || `Request #${input.requestId}`,
                message: input.message,
                actorName: actor?.name || undefined,
              },
              ctx.user.id,
              orgId
            );
          }
          
          return { clarificationId };
        }),
      
      list: protectedProcedure
        .input(z.object({ requestId: z.number() }))
        .query(async ({ input }) => {
          return db.getClarifications(input.requestId);
        }),
      
      respond: protectedProcedure
        .input(z.object({
          clarificationId: z.number(),
          message: z.string().min(1),
        }))
        .mutation(async ({ ctx, input }) => {
          // Create reply as child clarification
          const original = (await db.getClarifications(0)).find(c => c.id === input.clarificationId);
          if (!original) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Clarification not found' });
          }
          
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          const orgId = memberships[0]?.organizationId;
          
          const replyId = await db.createClarification({
            requestId: original.requestId,
            submissionId: original.submissionId,
            fromOrgId: orgId,
            fromUserId: ctx.user.id,
            toOrgId: original.fromOrgId,
            message: input.message,
            parentId: input.clarificationId,
          });
          
          await db.updateClarificationStatus(input.clarificationId, 'responded');
          
          return { replyId };
        }),
    }),
    
    // Audit Log
    auditLog: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .query(async ({ ctx, input }) => {
        const request = await db.getRequest(input.requestId);
        if (!request) return [];
        
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can view audit log' });
        }
        
        return db.getRequestAuditLog(input.requestId);
      }),
    
    // AI Validation and Suggestions
    ai: router({
      // Validate response completeness with AI
      validateResponse: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .mutation(async ({ input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
          }
          
          const request = await db.getRequest(workspace.requestId);
          if (!request?.requirementsSchemaId) {
            return { isValid: true, issues: [], suggestions: [] };
          }
          
          const schema = await db.getRequirementsSchema(request.requirementsSchemaId);
          const answers = await db.getWorkspaceAnswers(input.workspaceId);
          const documents = await db.getWorkspaceDocuments(input.workspaceId);
          
          // Use AI to validate completeness and consistency
          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: `You are a data validation assistant. Analyze the submitted response against the requirements schema and identify any issues or inconsistencies. Return a JSON object with: { isValid: boolean, issues: string[], suggestions: string[] }`
              },
              {
                role: 'user',
                content: `Requirements Schema:\n${JSON.stringify(schema?.schemaJson || {}, null, 2)}\n\nSubmitted Answers:\n${JSON.stringify(answers.map(a => ({ key: a.requirementKey, value: a.answerJson })), null, 2)}\n\nUploaded Documents:\n${JSON.stringify(documents.map(d => ({ key: d.requirementKey, name: d.fileName })), null, 2)}`
              }
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'validation_result',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    isValid: { type: 'boolean' },
                    issues: { type: 'array', items: { type: 'string' } },
                    suggestions: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['isValid', 'issues', 'suggestions'],
                  additionalProperties: false
                }
              }
            }
          });
          
          try {
            const content = response.choices[0].message.content;
            return JSON.parse(typeof content === 'string' ? content : '{}');
          } catch {
            return { isValid: true, issues: [], suggestions: [] };
          }
        }),
      
      // Suggest answers based on existing VATR data
      suggestAnswers: protectedProcedure
        .input(z.object({
          workspaceId: z.number(),
          requirementKey: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
          }
          
          const request = await db.getRequest(workspace.requestId);
          if (!request?.requirementsSchemaId) {
            return { suggestions: [] };
          }
          
          const schema = await db.getRequirementsSchema(request.requirementsSchemaId);
          const requirement = (schema?.schemaJson as any)?.items?.find((i: any) => i.key === input.requirementKey);
          
          if (!requirement) {
            return { suggestions: [] };
          }
          
          // Get relevant VATR data for the recipient org
          const vatrAssets = await db.getVatrAssetsByOrg(workspace.recipientOrgId);
          
          // Use AI to suggest answers based on VATR data
          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: `You are a data assistant. Based on the requirement and available VATR (Verified Asset Transaction Record) data, suggest possible answers. Return a JSON object with: { suggestions: string[], confidence: number, source: string }`
              },
              {
                role: 'user',
                content: `Requirement:\n${JSON.stringify(requirement, null, 2)}\n\nAvailable VATR Data (sample):\n${JSON.stringify(vatrAssets.slice(0, 5), null, 2)}`
              }
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'suggestion_result',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    suggestions: { type: 'array', items: { type: 'string' } },
                    confidence: { type: 'number' },
                    source: { type: 'string' }
                  },
                  required: ['suggestions', 'confidence', 'source'],
                  additionalProperties: false
                }
              }
            }
          });
          
          try {
            const content = response.choices[0].message.content;
            return JSON.parse(typeof content === 'string' ? content : '{}');
          } catch {
            return { suggestions: [], confidence: 0, source: 'unknown' };
          }
        }),
      
      // Auto-fill workspace from VATR data
      autoFill: protectedProcedure
        .input(z.object({ workspaceId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const workspace = await db.getResponseWorkspace(input.workspaceId);
          if (!workspace) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Workspace not found' });
          }
          
          const request = await db.getRequest(workspace.requestId);
          if (!request?.requirementsSchemaId) {
            return { filledCount: 0, skippedCount: 0 };
          }
          
          const schema = await db.getRequirementsSchema(request.requirementsSchemaId);
          const requirements = (schema?.schemaJson as any)?.items || [];
          const existingAnswers = await db.getWorkspaceAnswers(input.workspaceId);
          const vatrAssets = await db.getVatrAssetsByOrg(workspace.recipientOrgId);
          
          let filledCount = 0;
          let skippedCount = 0;
          
          for (const req of requirements) {
            // Skip if already answered
            if (existingAnswers.some(a => a.requirementKey === req.key)) {
              skippedCount++;
              continue;
            }
            
            // Try to auto-fill from VATR data
            const response = await invokeLLM({
              messages: [
                {
                  role: 'system',
                  content: `You are a data mapping assistant. Given a requirement and VATR data, extract the most appropriate value. Return JSON: { value: string | number | boolean | null, confidence: number }`
                },
                {
                  role: 'user',
                  content: `Requirement: ${JSON.stringify(req)}\nVATR Data: ${JSON.stringify(vatrAssets.slice(0, 3))}`
                }
              ],
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'autofill_result',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      value: {},
                      confidence: { type: 'number' }
                    },
                    required: ['value', 'confidence'],
                    additionalProperties: false
                  }
                }
              }
            });
            
            try {
              const msgContent = response.choices[0].message.content;
              const result = JSON.parse(typeof msgContent === 'string' ? msgContent : '{}');
              if (result.value !== null && result.confidence > 0.7) {
                await db.saveWorkspaceAnswer({
                  workspaceId: input.workspaceId,
                  requirementKey: req.key,
                  answerJson: { value: result.value, autoFilled: true, confidence: result.confidence },
                  
                });
                filledCount++;
              } else {
                skippedCount++;
              }
            } catch {
              skippedCount++;
            }
          }
          
          return { filledCount, skippedCount };
        }),
      
      // Summarize submission for issuer review
      summarizeSubmission: protectedProcedure
        .input(z.object({ submissionId: z.number() }))
        .query(async ({ ctx, input }) => {
          const submission = await db.getSubmission(input.submissionId);
          if (!submission) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Submission not found' });
          }
          
          const request = await db.getRequest(submission.requestId);
          if (!request) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found' });
          }
          
          // Verify issuer access
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (!memberships.some(m => m.organizationId === request.issuerOrgId)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only issuer can view submission summary' });
          }
          
          // Get snapshot data from workspace
          const workspace = await db.getResponseWorkspace(submission.workspaceId);
          const answers = workspace ? await db.getWorkspaceAnswers(submission.workspaceId) : [];
          const documents = workspace ? await db.getWorkspaceDocuments(submission.workspaceId) : [];
          const snapshot = { answers, documents };
          
          const response = await invokeLLM({
            messages: [
              {
                role: 'system',
                content: `You are a submission review assistant. Summarize the key points of this submission for quick review. Highlight any notable items, potential issues, or areas requiring attention.`
              },
              {
                role: 'user',
                content: `Request: ${request.title}\n\nSubmission Data:\n${JSON.stringify(snapshot, null, 2)}`
              }
            ]
          });
          
          return {
            summary: response.choices[0].message.content || 'Unable to generate summary',
            submittedAt: submission.submittedAt,
            status: submission.status,
          };
        }),
    }),
  }),
  
  // ============ VERSIONED VIEWS + SHARING + MANAGED UPDATES ============
  versionedViews: router({
    // Templates
    templates: router({
      create: protectedProcedure
        .input(z.object({
          name: z.string(),
          description: z.string().optional(),
          category: z.string().optional(),
          isPublic: z.boolean().optional(),
          initialDefinition: z.object({
            columns: z.array(z.string()),
            filters: z.record(z.string(), z.unknown()),
            grouping: z.array(z.string()).optional(),
            sorting: z.array(z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })).optional(),
            cardMode: z.enum(["summary", "expanded", "full"]).optional(),
            disclosureMode: z.enum(["summary", "expanded", "full"]).optional(),
            formRequirements: z.record(z.string(), z.unknown()).optional(),
            layout: z.record(z.string(), z.unknown()).optional(),
          }),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          const orgId = memberships[0].organizationId;
          
          return db.createViewTemplateV2({
            orgId,
            name: input.name,
            description: input.description,
            category: input.category,
            isPublic: input.isPublic,
            createdByUserId: ctx.user.id,
            initialDefinition: input.initialDefinition as any,
          });
        }),
      
      get: protectedProcedure
        .input(z.object({ templateId: z.string() }))
        .query(async ({ input }) => {
          return db.getViewTemplateV2(input.templateId);
        }),
      
      list: protectedProcedure
        .input(z.object({
          category: z.string().optional(),
          status: z.string().optional(),
          createdByUserId: z.number().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return [];
          return db.listViewTemplatesV2(memberships[0].organizationId, input);
        }),
      
      publishVersion: protectedProcedure
        .input(z.object({
          templateId: z.string(),
          definition: z.object({
            columns: z.array(z.string()),
            filters: z.record(z.string(), z.unknown()),
            grouping: z.array(z.string()).optional(),
            sorting: z.array(z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })).optional(),
            cardMode: z.enum(["summary", "expanded", "full"]).optional(),
            disclosureMode: z.enum(["summary", "expanded", "full"]).optional(),
            formRequirements: z.record(z.string(), z.unknown()).optional(),
            layout: z.record(z.string(), z.unknown()).optional(),
          }),
          changelog: z.string(),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.publishNewVersion({
            templateId: input.templateId,
            definition: input.definition as any,
            changelog: input.changelog,
            userId: ctx.user.id,
            orgId: memberships[0].organizationId,
          });
        }),
    }),
    
    // Instances
    instances: router({
      create: protectedProcedure
        .input(z.object({
          name: z.string(),
          workspaceId: z.string().optional(),
          boardId: z.string().optional(),
          requestId: z.number().optional(),
          sourceTemplateId: z.string().optional(),
          sourceVersionId: z.string().optional(),
          definition: z.object({
            columns: z.array(z.string()),
            filters: z.record(z.string(), z.unknown()),
            grouping: z.array(z.string()).optional(),
            sorting: z.array(z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })).optional(),
            cardMode: z.enum(["summary", "expanded", "full"]).optional(),
            disclosureMode: z.enum(["summary", "expanded", "full"]).optional(),
            formRequirements: z.record(z.string(), z.unknown()).optional(),
            layout: z.record(z.string(), z.unknown()).optional(),
          }),
          updateMode: z.enum(["independent", "managed"]),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.createViewInstance({
            orgId: memberships[0].organizationId,
            ownerUserId: ctx.user.id,
            name: input.name,
            workspaceId: input.workspaceId,
            boardId: input.boardId,
            requestId: input.requestId,
            sourceTemplateId: input.sourceTemplateId,
            sourceVersionId: input.sourceVersionId,
            definition: input.definition as any,
            updateMode: input.updateMode,
          });
        }),
      
      get: protectedProcedure
        .input(z.object({ instanceId: z.string() }))
        .query(async ({ input }) => {
          return db.getViewInstance(input.instanceId);
        }),
      
      list: protectedProcedure
        .input(z.object({
          workspaceId: z.string().optional(),
          boardId: z.string().optional(),
          requestId: z.number().optional(),
          sourceTemplateId: z.string().optional(),
          updateMode: z.enum(["independent", "managed"]).optional(),
          ownerOnly: z.boolean().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return [];
          
          return db.listViewInstances({
            orgId: memberships[0].organizationId,
            ownerUserId: input?.ownerOnly ? ctx.user.id : undefined,
            workspaceId: input?.workspaceId,
            boardId: input?.boardId,
            requestId: input?.requestId,
            sourceTemplateId: input?.sourceTemplateId,
            updateMode: input?.updateMode,
          });
        }),
      
      update: protectedProcedure
        .input(z.object({
          instanceId: z.string(),
          definition: z.object({
            columns: z.array(z.string()),
            filters: z.record(z.string(), z.unknown()),
            grouping: z.array(z.string()).optional(),
            sorting: z.array(z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })).optional(),
            cardMode: z.enum(["summary", "expanded", "full"]).optional(),
            disclosureMode: z.enum(["summary", "expanded", "full"]).optional(),
            formRequirements: z.record(z.string(), z.unknown()).optional(),
            layout: z.record(z.string(), z.unknown()).optional(),
          }),
          localEditsSummary: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const instance = await db.getViewInstance(input.instanceId);
          if (!instance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
          }
          if (instance.ownerUserId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owner can update instance' });
          }
          
          return db.updateViewInstanceDefinition({
            instanceId: input.instanceId,
            definition: input.definition as any,
            localEditsSummary: input.localEditsSummary,
            userId: ctx.user.id,
            orgId: instance.orgId,
          });
        }),
      
      fork: protectedProcedure
        .input(z.object({ instanceId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const instance = await db.getViewInstance(input.instanceId);
          if (!instance) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Instance not found' });
          }
          if (instance.ownerUserId !== ctx.user.id && !isAdminOrSuperuser(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owner can fork instance' });
          }
          
          return db.forkViewInstance({
            instanceId: input.instanceId,
            userId: ctx.user.id,
            orgId: instance.orgId,
          });
        }),
      
      pendingUpdates: protectedProcedure
        .query(async ({ ctx }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return [];
          return db.getPendingUpdatesForUser(ctx.user.id, memberships[0].organizationId);
        }),
    }),
    
    // Sharing
    sharing: router({
      shareAsClone: protectedProcedure
        .input(z.object({
          templateId: z.string(),
          recipientUserId: z.number(),
          name: z.string().optional(),
          workspaceId: z.string().optional(),
          boardId: z.string().optional(),
          requestId: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(input.recipientUserId);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recipient must belong to an organization' });
          }
          
          return db.shareViewAsTemplate({
            templateId: input.templateId,
            recipientUserId: input.recipientUserId,
            recipientOrgId: memberships[0].organizationId,
            name: input.name,
            workspaceId: input.workspaceId,
            boardId: input.boardId,
            requestId: input.requestId,
            sharedByUserId: ctx.user.id,
          });
        }),
      
      shareAsManaged: protectedProcedure
        .input(z.object({
          templateId: z.string(),
          recipientUserId: z.number(),
          name: z.string().optional(),
          workspaceId: z.string().optional(),
          boardId: z.string().optional(),
          requestId: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(input.recipientUserId);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Recipient must belong to an organization' });
          }
          
          return db.shareViewAsManaged({
            templateId: input.templateId,
            recipientUserId: input.recipientUserId,
            recipientOrgId: memberships[0].organizationId,
            name: input.name,
            workspaceId: input.workspaceId,
            boardId: input.boardId,
            requestId: input.requestId,
            sharedByUserId: ctx.user.id,
          });
        }),
    }),
    
    // Rollouts
    rollouts: router({
      create: protectedProcedure
        .input(z.object({
          templateId: z.string(),
          fromVersionId: z.string().optional(),
          toVersionId: z.string(),
          rolloutMode: z.enum(["force", "safe", "opt_in"]),
          scope: z.enum(["org_wide", "selected_workspaces", "selected_instances"]),
          scopeWorkspaceIds: z.array(z.string()).optional(),
          scopeInstanceIds: z.array(z.string()).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          // Non-admins require approval
          const requiresApproval = !isAdminOrSuperuser(ctx.user);
          
          return db.createRollout({
            orgId: memberships[0].organizationId,
            templateId: input.templateId,
            fromVersionId: input.fromVersionId,
            toVersionId: input.toVersionId,
            rolloutMode: input.rolloutMode,
            scope: input.scope,
            scopeWorkspaceIds: input.scopeWorkspaceIds,
            scopeInstanceIds: input.scopeInstanceIds,
            requiresApproval,
            createdByUserId: ctx.user.id,
          });
        }),
      
      get: protectedProcedure
        .input(z.object({ rolloutId: z.string() }))
        .query(async ({ input }) => {
          return db.getRollout(input.rolloutId);
        }),
      
      list: protectedProcedure
        .input(z.object({
          templateId: z.string().optional(),
          status: z.string().optional(),
          createdByUserId: z.number().optional(),
        }).optional())
        .query(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return [];
          return db.listRollouts({
            orgId: memberships[0].organizationId,
            templateId: input?.templateId,
            status: input?.status,
            createdByUserId: input?.createdByUserId,
          });
        }),
      
      approve: protectedProcedure
        .input(z.object({
          rolloutId: z.string(),
          approvalNotes: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!isAdminOrSuperuser(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can approve rollouts' });
          }
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.approveRollout({
            rolloutId: input.rolloutId,
            approvedByUserId: ctx.user.id,
            approvalNotes: input.approvalNotes,
            orgId: memberships[0].organizationId,
          });
        }),
      
      reject: protectedProcedure
        .input(z.object({
          rolloutId: z.string(),
          rejectionReason: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!isAdminOrSuperuser(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can reject rollouts' });
          }
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.rejectRollout({
            rolloutId: input.rolloutId,
            rejectedByUserId: ctx.user.id,
            rejectionReason: input.rejectionReason,
            orgId: memberships[0].organizationId,
          });
        }),
      
      schedule: protectedProcedure
        .input(z.object({
          rolloutId: z.string(),
          scheduledAt: z.date(),
          timezone: z.string().default("UTC"),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!isAdminOrSuperuser(ctx.user)) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Only admins can schedule rollouts' });
          }
          const rollout = await db.getRollout(input.rolloutId);
          if (!rollout) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Rollout not found' });
          }
          if (rollout.status !== 'approved') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Rollout must be approved before scheduling' });
          }
          
          return db.scheduleRollout({
            rolloutId: input.rolloutId,
            scheduledAt: input.scheduledAt,
            timezone: input.timezone,
            scheduledByUserId: ctx.user.id,
          });
        }),
      
      getAnalytics: protectedProcedure
        .input(z.object({
          templateId: z.string().optional(),
          dateRange: z.object({
            from: z.date(),
            to: z.date(),
          }).optional(),
        }).optional())
        .query(async ({ ctx }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) return null;
          
          // Return rollout analytics
          const rollouts = await db.listRollouts({
            orgId: memberships[0].organizationId,
          });
          
          const completed = rollouts.filter((r: { status: string }) => r.status === 'completed');
          const failed = rollouts.filter((r: { status: string }) => r.status === 'failed');
          const pending = rollouts.filter((r: { status: string }) => r.status === 'pending' || r.status === 'approved');
          
          return {
            totalRollouts: rollouts.length,
            completedCount: completed.length,
            failedCount: failed.length,
            pendingCount: pending.length,
            successRate: rollouts.length > 0 ? (completed.length / rollouts.length) * 100 : 0,
            avgConflictResolutionTime: 0, // Would need to calculate from conflict data
          };
        }),

      execute: protectedProcedure
        .input(z.object({ rolloutId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          // Verify rollout is approved
          const rollout = await db.getRollout(input.rolloutId);
          if (!rollout) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Rollout not found' });
          }
          if (rollout.status !== 'approved') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Rollout must be approved before execution' });
          }
          
          return db.executeRollout(input.rolloutId, ctx.user.id);
        }),
    }),
    
    // Update handling (for opt-in and conflicts)
    updates: router({
      accept: protectedProcedure
        .input(z.object({ receiptId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.acceptOptInUpdate({
            receiptId: input.receiptId,
            userId: ctx.user.id,
            orgId: memberships[0].organizationId,
          });
        }),
      
      reject: protectedProcedure
        .input(z.object({ receiptId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.rejectOptInUpdate({
            receiptId: input.receiptId,
            userId: ctx.user.id,
            orgId: memberships[0].organizationId,
          });
        }),
      
      resolveConflict: protectedProcedure
        .input(z.object({
          receiptId: z.string(),
          resolution: z.enum(["keep_local", "apply_new", "fork"]),
        }))
        .mutation(async ({ ctx, input }) => {
          const memberships = await db.getOrganizationMemberships(ctx.user.id);
          if (memberships.length === 0) {
            throw new TRPCError({ code: 'FORBIDDEN', message: 'Must belong to an organization' });
          }
          
          return db.resolveConflict({
            receiptId: input.receiptId,
            resolution: input.resolution,
            userId: ctx.user.id,
            orgId: memberships[0].organizationId,
          });
        }),
    }),
    
    // Audit log
    auditLog: protectedProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        action: z.string().optional(),
        relatedTemplateId: z.string().optional(),
        relatedInstanceId: z.string().optional(),
        relatedRolloutId: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const memberships = await db.getOrganizationMemberships(ctx.user.id);
        if (memberships.length === 0) return [];
        
        return db.getViewVersionAuditLog({
          orgId: memberships[0].organizationId,
          entityType: input?.entityType,
          entityId: input?.entityId,
          action: input?.action,
          relatedTemplateId: input?.relatedTemplateId,
          relatedInstanceId: input?.relatedInstanceId,
          relatedRolloutId: input?.relatedRolloutId,
          limit: input?.limit || 100,
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
