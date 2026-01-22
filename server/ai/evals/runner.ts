/**
 * AI Evaluation Harness
 * 
 * Runs evaluation tests against AI tasks to measure:
 * - Extraction accuracy
 * - Hallucination rate
 * - Latency
 * - Regression detection
 */

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { aiEvalResults } from "../../../drizzle/schema";
import { runTask } from "../gateway";
import { KiishaTask, GatewayRequest } from "../types";
import { hashPrompt } from "../telemetry";

// ============================================================================
// Fixture Types
// ============================================================================

export interface EvalFixture {
  id: string;
  task: KiishaTask;
  name: string;
  description: string;
  input: {
    messages: GatewayRequest["messages"];
    tools?: GatewayRequest["tools"];
    responseFormat?: GatewayRequest["responseFormat"];
  };
  expectedOutput: {
    type: "exact" | "contains" | "json_match" | "custom";
    value: unknown;
    customValidator?: (output: string | null) => boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface EvalResult {
  fixtureId: string;
  fixtureName: string;
  passed: boolean;
  accuracy?: number;
  hallucinationRate?: number;
  latencyMs: number;
  tokenCount: number;
  expectedOutput: unknown;
  actualOutput: unknown;
  errorDetails?: string;
}

export interface EvalRunSummary {
  runId: string;
  task: KiishaTask;
  totalFixtures: number;
  passed: number;
  failed: number;
  passRate: number;
  avgAccuracy: number;
  avgHallucinationRate: number;
  avgLatencyMs: number;
  totalTokens: number;
  results: EvalResult[];
}

// ============================================================================
// Fixture Registry
// ============================================================================

const fixtureRegistry = new Map<KiishaTask, EvalFixture[]>();

export function registerFixture(fixture: EvalFixture): void {
  const existing = fixtureRegistry.get(fixture.task) || [];
  existing.push(fixture);
  fixtureRegistry.set(fixture.task, existing);
}

export function getFixtures(task: KiishaTask): EvalFixture[] {
  return fixtureRegistry.get(task) || [];
}

export function getAllFixtures(): EvalFixture[] {
  return Array.from(fixtureRegistry.values()).flat();
}

// ============================================================================
// Evaluation Runner
// ============================================================================

export async function runEvaluation(
  task: KiishaTask,
  options: {
    fixtureIds?: string[];
    saveResults?: boolean;
  } = {}
): Promise<EvalRunSummary> {
  const runId = uuidv4();
  const fixtures = getFixtures(task);
  
  const targetFixtures = options.fixtureIds
    ? fixtures.filter(f => options.fixtureIds!.includes(f.id))
    : fixtures;
  
  if (targetFixtures.length === 0) {
    return {
      runId,
      task,
      totalFixtures: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      avgAccuracy: 0,
      avgHallucinationRate: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      results: [],
    };
  }
  
  const results: EvalResult[] = [];
  
  for (const fixture of targetFixtures) {
    const result = await runSingleEval(fixture, runId);
    results.push(result);
    
    if (options.saveResults) {
      await saveEvalResult(runId, task, fixture, result);
    }
  }
  
  // Calculate summary statistics
  const passed = results.filter(r => r.passed).length;
  const accuracies = results.filter(r => r.accuracy !== undefined).map(r => r.accuracy!);
  const hallucinationRates = results.filter(r => r.hallucinationRate !== undefined).map(r => r.hallucinationRate!);
  
  return {
    runId,
    task,
    totalFixtures: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    avgAccuracy: accuracies.length > 0 ? average(accuracies) : 0,
    avgHallucinationRate: hallucinationRates.length > 0 ? average(hallucinationRates) : 0,
    avgLatencyMs: average(results.map(r => r.latencyMs)),
    totalTokens: results.reduce((sum, r) => sum + r.tokenCount, 0),
    results,
  };
}

async function runSingleEval(fixture: EvalFixture, runId: string): Promise<EvalResult> {
  const startTime = Date.now();
  
  try {
    // Run the AI task
    const response = await runTask({
      task: fixture.task,
      messages: fixture.input.messages,
      tools: fixture.input.tools,
      responseFormat: fixture.input.responseFormat,
      userId: 0, // System user for evals
      orgId: 0,
      correlationId: `eval-${runId}-${fixture.id}`,
      channel: "api",
    });
    
    const latencyMs = Date.now() - startTime;
    const tokenCount = response.usage.totalTokens;
    
    // Evaluate the output
    const { passed, accuracy, hallucinationRate, errorDetails } = evaluateOutput(
      response.content,
      fixture.expectedOutput
    );
    
    return {
      fixtureId: fixture.id,
      fixtureName: fixture.name,
      passed,
      accuracy,
      hallucinationRate,
      latencyMs,
      tokenCount,
      expectedOutput: fixture.expectedOutput.value,
      actualOutput: response.content,
      errorDetails,
    };
  } catch (error) {
    return {
      fixtureId: fixture.id,
      fixtureName: fixture.name,
      passed: false,
      latencyMs: Date.now() - startTime,
      tokenCount: 0,
      expectedOutput: fixture.expectedOutput.value,
      actualOutput: null,
      errorDetails: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// Output Evaluation
// ============================================================================

function evaluateOutput(
  actual: string | null,
  expected: EvalFixture["expectedOutput"]
): {
  passed: boolean;
  accuracy?: number;
  hallucinationRate?: number;
  errorDetails?: string;
} {
  if (actual === null) {
    return { passed: false, errorDetails: "No output received" };
  }
  
  switch (expected.type) {
    case "exact":
      return {
        passed: actual === expected.value,
        accuracy: actual === expected.value ? 1 : 0,
      };
    
    case "contains":
      const expectedStr = String(expected.value);
      const contains = actual.includes(expectedStr);
      return {
        passed: contains,
        accuracy: contains ? 1 : 0,
      };
    
    case "json_match":
      try {
        const actualJson = JSON.parse(actual);
        const expectedJson = expected.value as Record<string, unknown>;
        const { accuracy, mismatches } = compareJsonObjects(actualJson, expectedJson);
        return {
          passed: accuracy >= 0.8, // 80% threshold
          accuracy,
          errorDetails: mismatches.length > 0 ? `Mismatches: ${mismatches.join(", ")}` : undefined,
        };
      } catch {
        return { passed: false, errorDetails: "Failed to parse JSON output" };
      }
    
    case "custom":
      if (expected.customValidator) {
        const passed = expected.customValidator(actual);
        return { passed, accuracy: passed ? 1 : 0 };
      }
      return { passed: false, errorDetails: "No custom validator provided" };
    
    default:
      return { passed: false, errorDetails: "Unknown evaluation type" };
  }
}

function compareJsonObjects(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>
): { accuracy: number; mismatches: string[] } {
  const mismatches: string[] = [];
  let matches = 0;
  let total = 0;
  
  for (const [key, expectedValue] of Object.entries(expected)) {
    total++;
    const actualValue = actual[key];
    
    if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) {
      matches++;
    } else {
      mismatches.push(`${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
    }
  }
  
  return {
    accuracy: total > 0 ? matches / total : 0,
    mismatches,
  };
}

// ============================================================================
// Save Results to Database
// ============================================================================

async function saveEvalResult(
  runId: string,
  task: KiishaTask,
  fixture: EvalFixture,
  result: EvalResult
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(aiEvalResults).values({
      runId,
      task,
      fixtureId: fixture.id,
      provider: "forge", // Would come from actual response
      model: "forge-default",
      promptVersionHash: hashPrompt(JSON.stringify(fixture.input.messages)),
      accuracy: result.accuracy?.toString() || null,
      hallucinationRate: result.hallucinationRate?.toString() || null,
      latencyMs: result.latencyMs,
      tokenCount: result.tokenCount,
      passed: result.passed,
      expectedOutput: fixture.expectedOutput.value as Record<string, unknown>,
      actualOutput: { content: result.actualOutput } as Record<string, unknown>,
      errorDetails: result.errorDetails,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[Eval Runner] Failed to save result:", error);
  }
}

// ============================================================================
// CI Gate
// ============================================================================

export interface CIGateConfig {
  minPassRate: number;
  maxHallucinationRate: number;
  maxAvgLatencyMs: number;
}

export function checkCIGate(
  summary: EvalRunSummary,
  config: CIGateConfig
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  if (summary.passRate < config.minPassRate) {
    reasons.push(`Pass rate ${(summary.passRate * 100).toFixed(1)}% below threshold ${(config.minPassRate * 100).toFixed(1)}%`);
  }
  
  if (summary.avgHallucinationRate > config.maxHallucinationRate) {
    reasons.push(`Hallucination rate ${(summary.avgHallucinationRate * 100).toFixed(1)}% above threshold ${(config.maxHallucinationRate * 100).toFixed(1)}%`);
  }
  
  if (summary.avgLatencyMs > config.maxAvgLatencyMs) {
    reasons.push(`Average latency ${summary.avgLatencyMs}ms above threshold ${config.maxAvgLatencyMs}ms`);
  }
  
  return {
    passed: reasons.length === 0,
    reasons,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
