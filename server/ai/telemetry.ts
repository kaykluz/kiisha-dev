/**
 * AI Telemetry - Token usage, latency, and cost tracking
 * 
 * All AI calls are audited through this module.
 */

import { KiishaTask, AIProvider, AIAuditEntry } from "./types";
import { getDb } from "../db";
import { aiUsageLog, aiAuditLog } from "../../drizzle/schema";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

// ============================================================================
// Telemetry Types
// ============================================================================

export interface TelemetryEvent {
  task: KiishaTask;
  userId: number;
  orgId: number;
  channel: "web" | "whatsapp" | "email" | "api";
  correlationId: string;
  provider: AIProvider;
  model: string;
  promptVersionHash: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  toolCalls?: Array<{
    name: string;
    arguments: string;
    result?: string;
  }>;
  outputSummary?: string;
  errorMessage?: string;
}

// ============================================================================
// Prompt Version Hashing
// ============================================================================

export function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex").substring(0, 16);
}

// ============================================================================
// Cost Calculation
// ============================================================================

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.001, output: 0.005 },
  "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
  "forge-default": { input: 0, output: 0 }, // Included in platform
  "forge-fast": { input: 0, output: 0 },
};

export function calculateCost(
  model: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const costs = COST_PER_1K_TOKENS[model] || { input: 0.01, output: 0.03 };
  return (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
}

// ============================================================================
// Audit Logging
// ============================================================================

export async function recordAuditEntry(event: TelemetryEvent): Promise<string> {
  const auditId = uuidv4();
  
  try {
    const db = await getDb();
    await db.insert(aiAuditLog).values({
      id: auditId,
      task: event.task,
      userId: event.userId,
      orgId: event.orgId,
      channel: event.channel,
      correlationId: event.correlationId,
      provider: event.provider,
      model: event.model,
      promptVersionHash: event.promptVersionHash,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      latencyMs: event.latencyMs,
      success: event.success,
      toolCalls: event.toolCalls ? JSON.stringify(event.toolCalls) : null,
      outputSummary: event.outputSummary,
      errorMessage: event.errorMessage,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[AI Telemetry] Failed to record audit entry:", error);
    // Don't throw - audit failures shouldn't break the main flow
  }
  
  return auditId;
}

// ============================================================================
// Usage Logging (for budget tracking)
// ============================================================================

export async function recordUsage(event: TelemetryEvent): Promise<void> {
  const cost = calculateCost(event.model, event.inputTokens, event.outputTokens);
  const period = new Date().toISOString().substring(0, 7); // YYYY-MM
  
  try {
    const db = await getDb();
    await db.insert(aiUsageLog).values({
      orgId: event.orgId,
      userId: event.userId,
      task: event.task,
      provider: event.provider,
      model: event.model,
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
      totalTokens: event.inputTokens + event.outputTokens,
      estimatedCost: cost,
      period,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[AI Telemetry] Failed to record usage:", error);
  }
}

// ============================================================================
// Metrics Aggregation
// ============================================================================

export interface UsageMetrics {
  totalTokens: number;
  totalCost: number;
  callCount: number;
  avgLatencyMs: number;
  successRate: number;
  byTask: Record<string, {
    tokens: number;
    calls: number;
    avgLatency: number;
  }>;
  byProvider: Record<string, {
    tokens: number;
    calls: number;
    cost: number;
  }>;
}

export async function getOrgUsageMetrics(
  orgId: number, 
  period: string
): Promise<UsageMetrics> {
  // This would query the aiUsageLog table and aggregate
  // For now, return placeholder structure
  return {
    totalTokens: 0,
    totalCost: 0,
    callCount: 0,
    avgLatencyMs: 0,
    successRate: 1,
    byTask: {},
    byProvider: {},
  };
}

// ============================================================================
// Real-time Metrics (for monitoring)
// ============================================================================

interface RealtimeMetrics {
  callsInLastMinute: number;
  callsInLastHour: number;
  avgLatencyLastMinute: number;
  errorRateLastMinute: number;
}

const recentCalls: Array<{
  timestamp: number;
  latencyMs: number;
  success: boolean;
}> = [];

export function recordRealtimeMetric(latencyMs: number, success: boolean): void {
  const now = Date.now();
  recentCalls.push({ timestamp: now, latencyMs, success });
  
  // Keep only last hour of data
  const oneHourAgo = now - 60 * 60 * 1000;
  while (recentCalls.length > 0 && recentCalls[0].timestamp < oneHourAgo) {
    recentCalls.shift();
  }
}

export function getRealtimeMetrics(): RealtimeMetrics {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const lastMinute = recentCalls.filter(c => c.timestamp >= oneMinuteAgo);
  const lastHour = recentCalls.filter(c => c.timestamp >= oneHourAgo);
  
  const avgLatency = lastMinute.length > 0
    ? lastMinute.reduce((sum, c) => sum + c.latencyMs, 0) / lastMinute.length
    : 0;
  
  const errorRate = lastMinute.length > 0
    ? lastMinute.filter(c => !c.success).length / lastMinute.length
    : 0;
  
  return {
    callsInLastMinute: lastMinute.length,
    callsInLastHour: lastHour.length,
    avgLatencyLastMinute: Math.round(avgLatency),
    errorRateLastMinute: errorRate,
  };
}
