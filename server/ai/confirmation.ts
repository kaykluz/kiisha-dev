/**
 * Confirmation Gate System
 * 
 * Handles high-impact action confirmations and approval workflows.
 * No auto-mutation: all data-changing actions require explicit confirmation.
 */

import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import { pendingConfirmations } from "../../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { PendingConfirmation } from "./types";
import { isHighImpactAction, HIGH_IMPACT_ACTIONS } from "./policies";

// ============================================================================
// Confirmation Types
// ============================================================================

export interface ConfirmationRequest {
  userId: number;
  orgId: number;
  channel: "web" | "whatsapp" | "email" | "api";
  correlationId: string;
  actionType: string;
  actionDescription: string;
  payload: Record<string, unknown>;
  expiresInMinutes?: number;
}

export interface ConfirmationResult {
  confirmationId: string;
  status: "pending" | "confirmed" | "declined" | "expired";
  message: string;
}

// ============================================================================
// Create Confirmation Request
// ============================================================================

export async function createConfirmation(
  request: ConfirmationRequest
): Promise<ConfirmationResult> {
  const confirmationId = uuidv4();
  const expiresAt = new Date(
    Date.now() + (request.expiresInMinutes || 30) * 60 * 1000
  );
  
  const db = await getDb();
  await db.insert(pendingConfirmations).values({
    id: confirmationId,
    userId: request.userId,
    orgId: request.orgId,
    channel: request.channel,
    correlationId: request.correlationId,
    actionType: request.actionType,
    actionDescription: request.actionDescription,
    payload: request.payload,
    expiresAt,
    status: "pending",
    createdAt: new Date(),
  });
  
  return {
    confirmationId,
    status: "pending",
    message: `Action requires confirmation. Reply with confirmation ID ${confirmationId.substring(0, 8)} to proceed.`,
  };
}

// ============================================================================
// Confirm Action
// ============================================================================

export async function confirmAction(
  confirmationId: string,
  userId: number
): Promise<{
  success: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}> {
  const db = await getDb();
  const confirmation = await db.query.pendingConfirmations.findFirst({
    where: eq(pendingConfirmations.id, confirmationId),
  });
  
  if (!confirmation) {
    return { success: false, error: "Confirmation not found" };
  }
  
  if (confirmation.userId !== userId) {
    return { success: false, error: "Confirmation belongs to another user" };
  }
  
  if (confirmation.status !== "pending") {
    return { success: false, error: `Confirmation already ${confirmation.status}` };
  }
  
  if (new Date() > confirmation.expiresAt) {
    await db.update(pendingConfirmations)
      .set({ status: "expired" })
      .where(eq(pendingConfirmations.id, confirmationId));
    return { success: false, error: "Confirmation expired" };
  }
  
  // Mark as confirmed
  await db.update(pendingConfirmations)
    .set({
      status: "confirmed",
      resolvedAt: new Date(),
      resolvedBy: userId,
    })
    .where(eq(pendingConfirmations.id, confirmationId));
  
  return {
    success: true,
    payload: confirmation.payload as Record<string, unknown>,
  };
}

// ============================================================================
// Decline Action
// ============================================================================

export async function declineAction(
  confirmationId: string,
  userId: number
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  const confirmation = await db.query.pendingConfirmations.findFirst({
    where: eq(pendingConfirmations.id, confirmationId),
  });
  
  if (!confirmation) {
    return { success: false, error: "Confirmation not found" };
  }
  
  if (confirmation.userId !== userId) {
    return { success: false, error: "Confirmation belongs to another user" };
  }
  
  if (confirmation.status !== "pending") {
    return { success: false, error: `Confirmation already ${confirmation.status}` };
  }
  
  await db.update(pendingConfirmations)
    .set({
      status: "declined",
      resolvedAt: new Date(),
      resolvedBy: userId,
    })
    .where(eq(pendingConfirmations.id, confirmationId));
  
  return { success: true };
}

// ============================================================================
// Get Pending Confirmations
// ============================================================================

export async function getPendingConfirmations(
  userId: number,
  channel?: "web" | "whatsapp" | "email" | "api"
): Promise<Array<{
  id: string;
  actionType: string;
  actionDescription: string;
  expiresAt: Date;
  createdAt: Date;
}>> {
  const conditions = [
    eq(pendingConfirmations.userId, userId),
    eq(pendingConfirmations.status, "pending"),
  ];
  
  if (channel) {
    conditions.push(eq(pendingConfirmations.channel, channel));
  }
  
  const db = await getDb();
  const pending = await db.query.pendingConfirmations.findMany({
    where: and(...conditions),
    orderBy: (pc, { desc }) => [desc(pc.createdAt)],
  });
  
  return pending.map(p => ({
    id: p.id,
    actionType: p.actionType,
    actionDescription: p.actionDescription,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  }));
}

// ============================================================================
// Cleanup Expired Confirmations
// ============================================================================

export async function cleanupExpiredConfirmations(): Promise<number> {
  const db = await getDb();
  const result = await db.update(pendingConfirmations)
    .set({ status: "expired" })
    .where(
      and(
        eq(pendingConfirmations.status, "pending"),
        lt(pendingConfirmations.expiresAt, new Date())
      )
    );
  
  return 0; // Would return affected rows count
}

// ============================================================================
// Hierarchical Approval (for org policies)
// ============================================================================

export interface ApprovalChain {
  requiredApprovers: number[]; // User IDs
  approvalType: "any" | "all" | "sequential";
}

export async function createApprovalRequest(
  request: ConfirmationRequest,
  approvalChain: ApprovalChain
): Promise<ConfirmationResult> {
  // For now, create a simple confirmation
  // In production, this would create multiple approval records
  return createConfirmation({
    ...request,
    actionDescription: `[Requires approval] ${request.actionDescription}`,
  });
}

// ============================================================================
// Check if Action Requires Confirmation
// ============================================================================

export function requiresConfirmation(actionType: string): boolean {
  return isHighImpactAction(actionType);
}

export function getConfirmationMessage(actionType: string): string {
  const messages: Record<string, string> = {
    external_share: "This will share data with external parties.",
    export_data: "This will export data outside the platform.",
    mark_verified: "This will mark the data as verified.",
    change_access: "This will change access permissions.",
    template_rollout: "This will roll out template changes to all users.",
    vatr_update: "This will update the VATR record.",
    request_submit: "This will submit the request.",
    cross_org_share: "This will share data across organizations.",
    bulk_delete: "This will permanently delete multiple items.",
    financial_field_change: "This will modify financial data.",
  };
  
  return messages[actionType] || "This action requires confirmation.";
}
