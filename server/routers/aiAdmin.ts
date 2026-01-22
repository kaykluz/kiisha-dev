/**
 * AI Admin Router - Superuser-only AI configuration
 * 
 * Only KIISHA superusers can:
 * - Configure AI providers
 * - Set model routing rules
 * - Manage org budgets
 * - View global AI metrics
 * 
 * Orgs CANNOT select models - they only consume their allocated budget.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { 
  aiGlobalConfig, 
  aiProviderSecrets, 
  orgAiBudget,
  aiUsageLog,
  aiAuditLog,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { 
  setRoutingConfig, 
  getRoutingConfig,
  GlobalRoutingConfig,
} from "../ai/router";
import { setBudget, getBudgetHistory, checkBudget } from "../ai/budget";
import { getRealtimeMetrics } from "../ai/telemetry";
import crypto from "crypto";

// ============================================================================
// Encryption Helpers
// ============================================================================

const ENCRYPTION_KEY = process.env.AI_SECRETS_KEY || process.env.JWT_SECRET || "default-key-change-me";

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    crypto.scryptSync(ENCRYPTION_KEY, "salt", 32),
    iv
  );
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    crypto.scryptSync(ENCRYPTION_KEY, "salt", 32),
    Buffer.from(iv, "hex")
  );
  
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// ============================================================================
// Superuser Check Middleware
// ============================================================================

const superuserProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Check if user is a KIISHA superuser
  // For now, check if user role is 'admin' and has superuser flag
  const isSuperuser = ctx.user.role === "admin"; // Would check superuser table in production
  
  if (!isSuperuser) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires KIISHA superuser privileges",
    });
  }
  
  return next({ ctx });
});

// ============================================================================
// AI Admin Router
// ============================================================================

export const aiAdminRouter = router({
  // ========== Global Configuration ==========
  
  getGlobalConfig: superuserProcedure.query(async () => {
    const db = await getDb();
    const config = await db.query.aiGlobalConfig.findFirst({
      orderBy: [desc(aiGlobalConfig.id)],
    });
    
    if (!config) {
      return {
        defaultProvider: "forge",
        defaultModel: "forge-default",
        routingRules: {},
        fallbackRules: {},
        enabledProviders: ["forge"],
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      };
    }
    
    return {
      defaultProvider: config.defaultProvider,
      defaultModel: config.defaultModel,
      routingRules: config.routingRules || {},
      fallbackRules: config.fallbackRules || {},
      enabledProviders: config.enabledProviders || ["forge"],
      maxRetries: config.maxRetries,
      initialDelayMs: config.initialDelayMs,
      maxDelayMs: config.maxDelayMs,
    };
  }),
  
  updateGlobalConfig: superuserProcedure
    .input(z.object({
      defaultProvider: z.string().optional(),
      defaultModel: z.string().optional(),
      routingRules: z.record(z.unknown()).optional(),
      fallbackRules: z.record(z.unknown()).optional(),
      enabledProviders: z.array(z.string()).optional(),
      maxRetries: z.number().min(0).max(10).optional(),
      initialDelayMs: z.number().min(100).max(10000).optional(),
      maxDelayMs: z.number().min(1000).max(60000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const existing = await db.query.aiGlobalConfig.findFirst({
        orderBy: [desc(aiGlobalConfig.id)],
      });
      
      if (existing) {
        await db.update(aiGlobalConfig)
          .set({
            ...input,
            updatedBySuperuserId: ctx.user.id,
            updatedAt: new Date(),
          })
          .where(eq(aiGlobalConfig.id, existing.id));
      } else {
        await db.insert(aiGlobalConfig).values({
          defaultProvider: input.defaultProvider || "forge",
          defaultModel: input.defaultModel || "forge-default",
          routingRules: input.routingRules || {},
          fallbackRules: input.fallbackRules || {},
          enabledProviders: input.enabledProviders || ["forge"],
          maxRetries: input.maxRetries || 3,
          initialDelayMs: input.initialDelayMs || 1000,
          maxDelayMs: input.maxDelayMs || 10000,
          updatedBySuperuserId: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      // Update in-memory routing config
      const newConfig = await db.query.aiGlobalConfig.findFirst({
        orderBy: [desc(aiGlobalConfig.id)],
      });
      
      if (newConfig) {
        setRoutingConfig({
          defaultProvider: newConfig.defaultProvider as any,
          defaultModel: newConfig.defaultModel,
          taskRoutes: newConfig.routingRules as any || {},
          fallbackChain: newConfig.enabledProviders as any || ["forge"],
          retryConfig: {
            maxRetries: newConfig.maxRetries,
            initialDelayMs: newConfig.initialDelayMs,
            maxDelayMs: newConfig.maxDelayMs,
            backoffMultiplier: 2,
          },
        });
      }
      
      return { success: true };
    }),
  
  // ========== Provider Secrets ==========
  
  listProviders: superuserProcedure.query(async () => {
    const db = await getDb();
    const providers = await db.query.aiProviderSecrets.findMany({
      orderBy: [desc(aiProviderSecrets.id)],
    });
    
    return providers.map(p => ({
      id: p.id,
      provider: p.provider,
      status: p.status,
      lastValidatedAt: p.lastValidatedAt,
      lastError: p.lastError,
      hasApiKey: !!p.encryptedApiKey,
    }));
  }),
  
  setProviderSecret: superuserProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "azure_openai", "gemini", "deepseek"]),
      apiKey: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { encrypted, iv, authTag } = encrypt(input.apiKey);
      
      const existing = await db.query.aiProviderSecrets.findFirst({
        where: eq(aiProviderSecrets.provider, input.provider),
      });
      
      if (existing) {
        await db.update(aiProviderSecrets)
          .set({
            encryptedApiKey: encrypted,
            iv,
            authTag,
            status: "enabled",
            updatedAt: new Date(),
          })
          .where(eq(aiProviderSecrets.id, existing.id));
      } else {
        await db.insert(aiProviderSecrets).values({
          provider: input.provider,
          encryptedApiKey: encrypted,
          iv,
          authTag,
          status: "enabled",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      return { success: true };
    }),
  
  validateProvider: superuserProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "azure_openai", "gemini", "deepseek"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const secret = await db.query.aiProviderSecrets.findFirst({
        where: eq(aiProviderSecrets.provider, input.provider),
      });
      
      if (!secret || !secret.encryptedApiKey) {
        return { valid: false, error: "No API key configured", models: [] };
      }
      
      try {
        const apiKey = decrypt(secret.encryptedApiKey, secret.iv!, secret.authTag!);
        
        // Validate based on provider
        let valid = false;
        let error: string | undefined;
        let models: string[] = [];
        let latencyMs: number | undefined;
        
        const startTime = Date.now();
        
        if (input.provider === "openai") {
          const response = await fetch("https://api.openai.com/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` },
          });
          latencyMs = Date.now() - startTime;
          valid = response.ok;
          if (valid) {
            const data = await response.json();
            models = data.data
              ?.filter((m: any) => m.id.includes("gpt"))
              ?.map((m: any) => m.id)
              ?.slice(0, 10) || [];
          } else {
            error = `API returned ${response.status}`;
          }
        } else if (input.provider === "anthropic") {
          // Test with a minimal completion request
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 1,
              messages: [{ role: "user", content: "Hi" }],
            }),
          });
          latencyMs = Date.now() - startTime;
          valid = response.ok || response.status === 400; // 400 means key is valid but request was bad
          if (valid) {
            models = ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"];
          } else {
            const errData = await response.json().catch(() => ({}));
            error = errData.error?.message || `API returned ${response.status}`;
          }
        } else if (input.provider === "gemini") {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          latencyMs = Date.now() - startTime;
          valid = response.ok;
          if (valid) {
            const data = await response.json();
            models = data.models
              ?.filter((m: any) => m.name.includes("gemini"))
              ?.map((m: any) => m.name.replace("models/", ""))
              ?.slice(0, 10) || [];
          } else {
            error = `API returned ${response.status}`;
          }
        } else if (input.provider === "deepseek") {
          const response = await fetch("https://api.deepseek.com/v1/models", {
            headers: { "Authorization": `Bearer ${apiKey}` },
          });
          latencyMs = Date.now() - startTime;
          valid = response.ok;
          if (valid) {
            const data = await response.json();
            models = data.data?.map((m: any) => m.id)?.slice(0, 10) || ["deepseek-chat", "deepseek-coder"];
          } else {
            error = `API returned ${response.status}`;
          }
        } else if (input.provider === "azure_openai") {
          // Azure requires endpoint configuration
          valid = apiKey.length > 20;
          models = ["gpt-4", "gpt-4-turbo", "gpt-35-turbo"];
          latencyMs = 0;
        }
        
        await db.update(aiProviderSecrets)
          .set({
            status: valid ? "enabled" : "invalid",
            lastValidatedAt: new Date(),
            lastError: error || null,
          })
          .where(eq(aiProviderSecrets.id, secret.id));
        
        return { valid, error, models, latencyMs };
      } catch (e) {
        const error = e instanceof Error ? e.message : "Validation failed";
        
        await db.update(aiProviderSecrets)
          .set({
            status: "invalid",
            lastValidatedAt: new Date(),
            lastError: error,
          })
          .where(eq(aiProviderSecrets.id, secret.id));
        
        return { valid: false, error, models: [] };
      }
    }),

  // Test provider with a simple completion
  testProviderCompletion: superuserProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "azure_openai", "gemini", "deepseek"]),
      prompt: z.string().default("Say 'Hello' in one word."),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const secret = await db.query.aiProviderSecrets.findFirst({
        where: eq(aiProviderSecrets.provider, input.provider),
      });
      
      if (!secret || !secret.encryptedApiKey) {
        return { success: false, error: "No API key configured" };
      }
      
      try {
        const apiKey = decrypt(secret.encryptedApiKey, secret.iv!, secret.authTag!);
        const startTime = Date.now();
        let response: string | undefined;
        let tokensUsed: number | undefined;
        
        if (input.provider === "openai") {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [{ role: "user", content: input.prompt }],
              max_tokens: 10,
            }),
          });
          const data = await res.json();
          response = data.choices?.[0]?.message?.content;
          tokensUsed = data.usage?.total_tokens;
        } else if (input.provider === "anthropic") {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-haiku-20240307",
              max_tokens: 10,
              messages: [{ role: "user", content: input.prompt }],
            }),
          });
          const data = await res.json();
          response = data.content?.[0]?.text;
          tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        } else if (input.provider === "gemini") {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: input.prompt }] }],
            }),
          });
          const data = await res.json();
          response = data.candidates?.[0]?.content?.parts?.[0]?.text;
          tokensUsed = data.usageMetadata?.totalTokenCount;
        } else if (input.provider === "deepseek") {
          const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ role: "user", content: input.prompt }],
              max_tokens: 10,
            }),
          });
          const data = await res.json();
          response = data.choices?.[0]?.message?.content;
          tokensUsed = data.usage?.total_tokens;
        }
        
        const latencyMs = Date.now() - startTime;
        
        return {
          success: true,
          response,
          tokensUsed,
          latencyMs,
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : "Test failed",
        };
      }
    }),
  
  disableProvider: superuserProcedure
    .input(z.object({
      provider: z.enum(["openai", "anthropic", "azure_openai", "gemini", "deepseek"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      await db.update(aiProviderSecrets)
        .set({ status: "disabled" })
        .where(eq(aiProviderSecrets.provider, input.provider));
      
      return { success: true };
    }),
  
  // ========== Org Budget Management ==========
  
  listOrgBudgets: superuserProcedure
    .input(z.object({
      period: z.string().optional(), // YYYY-MM
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const period = input.period || new Date().toISOString().substring(0, 7);
      
      const budgets = await db.query.orgAiBudget.findMany({
        where: eq(orgAiBudget.period, period),
        orderBy: [desc(orgAiBudget.consumedTokens)],
      });
      
      return budgets.map(b => ({
        orgId: b.organizationId,
        period: b.period,
        allocatedTokens: b.allocatedTokens,
        consumedTokens: b.consumedTokens,
        remainingTokens: b.allocatedTokens - b.consumedTokens,
        percentUsed: (b.consumedTokens / b.allocatedTokens) * 100,
        softLimitPercent: b.softLimitPercent,
        overageAllowed: b.overageAllowed,
      }));
    }),
  
  setOrgBudget: superuserProcedure
    .input(z.object({
      orgId: z.number(),
      allocatedTokens: z.number().min(0),
      softLimitPercent: z.number().min(0).max(100).default(80),
      overageAllowed: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      await setBudget(
        input.orgId,
        input.allocatedTokens,
        input.softLimitPercent,
        input.overageAllowed
      );
      
      return { success: true };
    }),
  
  getOrgBudgetHistory: superuserProcedure
    .input(z.object({
      orgId: z.number(),
      periods: z.number().min(1).max(24).default(6),
    }))
    .query(async ({ input }) => {
      return getBudgetHistory(input.orgId, input.periods);
    }),
  
  // ========== Usage Analytics ==========
  
  getUsageStats: superuserProcedure
    .input(z.object({
      period: z.string().optional(),
      groupBy: z.enum(["org", "task", "provider", "model"]).default("org"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const period = input.period || new Date().toISOString().substring(0, 7);
      
      // Aggregate usage by grouping
      const usage = await db.query.aiUsageLog.findMany({
        where: eq(aiUsageLog.period, period),
      });
      
      const grouped = new Map<string, {
        key: string;
        totalTokens: number;
        totalCost: number;
        callCount: number;
      }>();
      
      for (const log of usage) {
        const key = input.groupBy === "org" ? String(log.orgId)
          : input.groupBy === "task" ? log.task
          : input.groupBy === "provider" ? log.provider
          : log.model;
        
        const existing = grouped.get(key) || {
          key,
          totalTokens: 0,
          totalCost: 0,
          callCount: 0,
        };
        
        existing.totalTokens += log.totalTokens;
        existing.totalCost += Number(log.estimatedCost) || 0;
        existing.callCount += 1;
        
        grouped.set(key, existing);
      }
      
      return Array.from(grouped.values())
        .sort((a, b) => b.totalTokens - a.totalTokens);
    }),
  
  getRealtimeMetrics: superuserProcedure.query(async () => {
    return getRealtimeMetrics();
  }),

  // Real-time token usage by provider with time series
  getTokenUsageTimeSeries: superuserProcedure
    .input(z.object({
      period: z.enum(["hour", "day", "week", "month"]).default("day"),
      provider: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      
      // Calculate time range
      const now = new Date();
      let startDate: Date;
      let interval: string;
      
      switch (input.period) {
        case "hour":
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          interval = "minute";
          break;
        case "day":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          interval = "hour";
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          interval = "day";
          break;
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          interval = "day";
          break;
      }
      
      const conditions = [sql`${aiUsageLog.createdAt} >= ${startDate}`];
      if (input.provider) {
        conditions.push(eq(aiUsageLog.provider, input.provider));
      }
      
      const logs = await db.select()
        .from(aiUsageLog)
        .where(and(...conditions))
        .orderBy(asc(aiUsageLog.createdAt));
      
      // Group by time interval
      const timeSeries = new Map<string, {
        timestamp: string;
        tokens: number;
        cost: number;
        calls: number;
        byProvider: Record<string, number>;
      }>();
      
      for (const log of logs) {
        const date = new Date(log.createdAt);
        let key: string;
        
        if (interval === "minute") {
          key = date.toISOString().substring(0, 16);
        } else if (interval === "hour") {
          key = date.toISOString().substring(0, 13);
        } else {
          key = date.toISOString().substring(0, 10);
        }
        
        const existing = timeSeries.get(key) || {
          timestamp: key,
          tokens: 0,
          cost: 0,
          calls: 0,
          byProvider: {},
        };
        
        existing.tokens += log.totalTokens;
        existing.cost += Number(log.estimatedCost) || 0;
        existing.calls += 1;
        existing.byProvider[log.provider] = (existing.byProvider[log.provider] || 0) + log.totalTokens;
        
        timeSeries.set(key, existing);
      }
      
      return Array.from(timeSeries.values());
    }),

  // Get cost estimation by provider
  getCostEstimation: superuserProcedure
    .input(z.object({
      period: z.string().optional(), // YYYY-MM
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const period = input.period || new Date().toISOString().substring(0, 7);
      
      const logs = await db.select()
        .from(aiUsageLog)
        .where(eq(aiUsageLog.period, period));
      
      // Cost per 1K tokens (approximate)
      const costRates: Record<string, { input: number; output: number }> = {
        openai: { input: 0.0015, output: 0.002 },
        anthropic: { input: 0.003, output: 0.015 },
        gemini: { input: 0.00025, output: 0.0005 },
        deepseek: { input: 0.0001, output: 0.0002 },
        forge: { input: 0, output: 0 }, // Free tier
      };
      
      const byProvider: Record<string, {
        provider: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        estimatedCost: number;
        callCount: number;
      }> = {};
      
      for (const log of logs) {
        const provider = log.provider;
        const rates = costRates[provider] || { input: 0.001, output: 0.002 };
        
        if (!byProvider[provider]) {
          byProvider[provider] = {
            provider,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            estimatedCost: 0,
            callCount: 0,
          };
        }
        
        byProvider[provider].inputTokens += log.inputTokens;
        byProvider[provider].outputTokens += log.outputTokens;
        byProvider[provider].totalTokens += log.totalTokens;
        byProvider[provider].estimatedCost += 
          (log.inputTokens / 1000) * rates.input + 
          (log.outputTokens / 1000) * rates.output;
        byProvider[provider].callCount += 1;
      }
      
      const providers = Object.values(byProvider);
      const totalCost = providers.reduce((sum, p) => sum + p.estimatedCost, 0);
      const totalTokens = providers.reduce((sum, p) => sum + p.totalTokens, 0);
      
      return {
        period,
        totalCost,
        totalTokens,
        byProvider: providers,
      };
    }),
  
  // ========== Audit Log ==========
  
  getAuditLog: superuserProcedure
    .input(z.object({
      orgId: z.number().optional(),
      userId: z.number().optional(),
      task: z.string().optional(),
      limit: z.number().min(1).max(1000).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions = [];
      
      if (input.orgId) {
        conditions.push(eq(aiAuditLog.orgId, input.orgId));
      }
      if (input.userId) {
        conditions.push(eq(aiAuditLog.userId, input.userId));
      }
      if (input.task) {
        conditions.push(eq(aiAuditLog.task, input.task));
      }
      
      const logs = await db.query.aiAuditLog.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(aiAuditLog.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
      
      return logs;
    }),
});

export type AIAdminRouter = typeof aiAdminRouter;
