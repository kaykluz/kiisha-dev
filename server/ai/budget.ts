/**
 * AI Budget Management
 * 
 * Handles org-level token budgets and enforcement.
 * Only KIISHA superuser can set budgets; orgs can only consume.
 */

import { OrgBudgetStatus } from "./types";
import { getDb } from "../db";
import { orgAiBudget } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ============================================================================
// Budget Check
// ============================================================================

export async function checkBudget(orgId: number): Promise<OrgBudgetStatus> {
  const period = getCurrentPeriod();
  
  try {
    const db = await getDb();
    const budget = await db.query.orgAiBudget.findFirst({
      where: and(
        eq(orgAiBudget.organizationId, orgId),
        eq(orgAiBudget.period, period)
      ),
    });
    
    if (!budget) {
      // No budget set - use default unlimited
      return {
        orgId,
        period,
        allocatedTokens: Number.MAX_SAFE_INTEGER,
        consumedTokens: 0,
        remainingTokens: Number.MAX_SAFE_INTEGER,
        percentUsed: 0,
        softLimitReached: false,
        hardLimitReached: false,
      };
    }
    
    const remainingTokens = budget.allocatedTokens - budget.consumedTokens;
    const percentUsed = (budget.consumedTokens / budget.allocatedTokens) * 100;
    
    return {
      orgId,
      period,
      allocatedTokens: budget.allocatedTokens,
      consumedTokens: budget.consumedTokens,
      remainingTokens: Math.max(0, remainingTokens),
      percentUsed,
      softLimitReached: percentUsed >= (budget.softLimitPercent || 80),
      hardLimitReached: remainingTokens <= 0 && !budget.overageAllowed,
    };
  } catch (error) {
    console.error("[AI Budget] Failed to check budget:", error);
    // On error, allow the request but log it
    return {
      orgId,
      period,
      allocatedTokens: Number.MAX_SAFE_INTEGER,
      consumedTokens: 0,
      remainingTokens: Number.MAX_SAFE_INTEGER,
      percentUsed: 0,
      softLimitReached: false,
      hardLimitReached: false,
    };
  }
}

// ============================================================================
// Budget Consumption
// ============================================================================

export async function consumeBudget(orgId: number, tokens: number): Promise<void> {
  const period = getCurrentPeriod();
  
  try {
    const db = await getDb();
    // Upsert budget record
    const existing = await db.query.orgAiBudget.findFirst({
      where: and(
        eq(orgAiBudget.organizationId, orgId),
        eq(orgAiBudget.period, period)
      ),
    });
    
    if (existing) {
      await db.update(orgAiBudget)
        .set({
          consumedTokens: existing.consumedTokens + tokens,
          updatedAt: new Date(),
        })
        .where(eq(orgAiBudget.id, existing.id));
    } else {
      // Create new budget record with default allocation
      await db.insert(orgAiBudget).values({
        organizationId: orgId,
        period,
        allocatedTokens: 1000000, // Default 1M tokens
        consumedTokens: tokens,
        softLimitPercent: 80,
        overageAllowed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error("[AI Budget] Failed to consume budget:", error);
    // Don't throw - budget tracking failures shouldn't break the main flow
  }
}

// ============================================================================
// Budget Management (Superuser Only)
// ============================================================================

export async function setBudget(
  orgId: number,
  allocatedTokens: number,
  softLimitPercent: number = 80,
  overageAllowed: boolean = false
): Promise<void> {
  const period = getCurrentPeriod();
  const db = await getDb();
  
  const existing = await db.query.orgAiBudget.findFirst({
    where: and(
      eq(orgAiBudget.organizationId, orgId),
      eq(orgAiBudget.period, period)
    ),
  });
  
  if (existing) {
    await db.update(orgAiBudget)
      .set({
        allocatedTokens,
        softLimitPercent,
        overageAllowed,
        updatedAt: new Date(),
      })
      .where(eq(orgAiBudget.id, existing.id));
  } else {
    await db.insert(orgAiBudget).values({
      organizationId: orgId,
      period,
      allocatedTokens,
      consumedTokens: 0,
      softLimitPercent,
      overageAllowed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

export async function getBudgetHistory(
  orgId: number,
  periods: number = 6
): Promise<Array<{
  period: string;
  allocatedTokens: number;
  consumedTokens: number;
  percentUsed: number;
}>> {
  try {
    const db = await getDb();
    const budgets = await db.query.orgAiBudget.findMany({
      where: eq(orgAiBudget.organizationId, orgId),
      orderBy: (budget, { desc }) => [desc(budget.period)],
      limit: periods,
    });
    
    return budgets.map(b => ({
      period: b.period,
      allocatedTokens: b.allocatedTokens,
      consumedTokens: b.consumedTokens,
      percentUsed: (b.consumedTokens / b.allocatedTokens) * 100,
    }));
  } catch (error) {
    console.error("[AI Budget] Failed to get history:", error);
    return [];
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getCurrentPeriod(): string {
  return new Date().toISOString().substring(0, 7); // YYYY-MM
}
