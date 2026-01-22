/**
 * Multi-Organization User Handling Service
 * 
 * Handles users who belong to multiple organizations:
 * - Org selection prompts
 * - Context switching
 * - Ambiguity resolution for inbound messages
 * - Session org scoping
 */

import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { logSecurityEvent } from "./orgContext";

export interface OrgMembership {
  organizationId: number;
  organizationName: string;
  organizationSlug: string | null;
  role: string;
  status: string;
}

export interface MultiOrgContext {
  userId: number;
  memberships: OrgMembership[];
  activeOrgId: number | null;
  requiresSelection: boolean;
}

/**
 * Get multi-org context for a user
 */
export async function getMultiOrgContext(userId: number): Promise<MultiOrgContext> {
  const user = await db.getUserById(userId);
  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  
  const rawMemberships = await db.getUserOrganizationMemberships(userId);
  const activeMemberships = rawMemberships.filter(m => m.status === "active");
  
  // Enrich with org details
  const memberships: OrgMembership[] = await Promise.all(
    activeMemberships.map(async (m) => {
      const org = await db.getOrganizationById(m.organizationId);
      return {
        organizationId: m.organizationId,
        organizationName: org?.name || "Unknown",
        organizationSlug: org?.slug || null,
        role: m.role,
        status: m.status,
      };
    })
  );
  
  return {
    userId,
    memberships,
    activeOrgId: user.activeOrgId,
    requiresSelection: memberships.length > 1 && !user.activeOrgId,
  };
}

/**
 * Resolve org context for an inbound message
 * 
 * Resolution order:
 * 1. If user has only one org → use that
 * 2. If user has active org set → use that
 * 3. If message contains org hint → use that
 * 4. Otherwise → return ambiguous state
 */
export async function resolveInboundOrgContext(
  userId: number,
  hints?: {
    mentionedOrgName?: string;
    mentionedProjectName?: string;
    replyToMessageId?: string;
  }
): Promise<{
  resolved: boolean;
  organizationId?: number;
  ambiguousOrgs?: OrgMembership[];
  resolutionMethod?: string;
}> {
  const context = await getMultiOrgContext(userId);
  
  // Case 1: Single org
  if (context.memberships.length === 1) {
    return {
      resolved: true,
      organizationId: context.memberships[0].organizationId,
      resolutionMethod: "single_org",
    };
  }
  
  // Case 2: Active org set
  if (context.activeOrgId) {
    const activeMembership = context.memberships.find(
      m => m.organizationId === context.activeOrgId
    );
    if (activeMembership) {
      return {
        resolved: true,
        organizationId: context.activeOrgId,
        resolutionMethod: "active_org",
      };
    }
  }
  
  // Case 3: Try to resolve from hints
  if (hints?.mentionedOrgName) {
    const matchingOrg = context.memberships.find(
      m => m.organizationName.toLowerCase().includes(hints.mentionedOrgName!.toLowerCase())
    );
    if (matchingOrg) {
      return {
        resolved: true,
        organizationId: matchingOrg.organizationId,
        resolutionMethod: "org_name_hint",
      };
    }
  }
  
  if (hints?.mentionedProjectName) {
    // Try to find project by name and get its org
    // This would require a project lookup
    // For now, skip this resolution method
  }
  
  if (hints?.replyToMessageId) {
    // Try to get org from the message being replied to
    // This would require message lookup
    // For now, skip this resolution method
  }
  
  // Case 4: Ambiguous - return all options
  return {
    resolved: false,
    ambiguousOrgs: context.memberships,
  };
}

/**
 * Generate org selection prompt for ambiguous cases
 */
export function generateOrgSelectionPrompt(orgs: OrgMembership[]): string {
  const options = orgs.map((org, i) => `${i + 1}. ${org.organizationName}`).join("\n");
  return `Which organization is this for?\n\n${options}\n\nReply with the number or organization name.`;
}

/**
 * Parse org selection response
 */
export function parseOrgSelectionResponse(
  response: string,
  orgs: OrgMembership[]
): OrgMembership | null {
  const trimmed = response.trim();
  
  // Try numeric selection
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= orgs.length) {
    return orgs[num - 1];
  }
  
  // Try name match
  const lowerResponse = trimmed.toLowerCase();
  const match = orgs.find(
    org => org.organizationName.toLowerCase().includes(lowerResponse) ||
           (org.organizationSlug && org.organizationSlug.toLowerCase() === lowerResponse)
  );
  
  return match || null;
}

/**
 * Switch user's active organization
 */
export async function switchActiveOrg(
  userId: number,
  newOrgId: number,
  source: "manual" | "inbound_resolution" | "subdomain"
): Promise<boolean> {
  // Verify membership
  const memberships = await db.getUserOrganizationMemberships(userId);
  const membership = memberships.find(
    m => m.organizationId === newOrgId && m.status === "active"
  );
  
  if (!membership) {
    return false;
  }
  
  // Update active org
  await db.updateUserActiveOrg(userId, newOrgId);
  
  // Log the switch
  await logSecurityEvent("org_context_switched", userId, {
    organizationId: newOrgId,
    extra: { source },
  });
  
  return true;
}

/**
 * Get user's default org (for new sessions)
 */
export async function getDefaultOrg(userId: number): Promise<number | null> {
  const context = await getMultiOrgContext(userId);
  
  // If user has active org, use that
  if (context.activeOrgId) {
    return context.activeOrgId;
  }
  
  // If single org, use that
  if (context.memberships.length === 1) {
    return context.memberships[0].organizationId;
  }
  
  // Multiple orgs, no default - requires selection
  return null;
}

/**
 * Check if user needs org selection before proceeding
 */
export async function requiresOrgSelection(userId: number): Promise<{
  required: boolean;
  orgs?: OrgMembership[];
}> {
  const context = await getMultiOrgContext(userId);
  
  if (context.memberships.length <= 1) {
    return { required: false };
  }
  
  if (context.activeOrgId) {
    return { required: false };
  }
  
  return {
    required: true,
    orgs: context.memberships,
  };
}
