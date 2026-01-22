/**
 * Organization Invitation Service
 * 
 * Handles sending email invitations with auto-assignment to organizations.
 * - Admins can invite users to their organization
 * - Invitations include role assignment
 * - Auto-links user to organization on signup
 */

import { db } from "../db";
import { teamInvitations, organizationMembers, users, organizations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { logVatrEvent } from "./vatrAudit";

export interface InvitationResult {
  success: boolean;
  invitationId?: number;
  token?: string;
  error?: string;
}

/**
 * Generate a secure invitation token
 */
function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an organization invitation
 */
export async function createInvitation(params: {
  organizationId: number;
  email: string;
  role: 'admin' | 'editor' | 'reviewer' | 'investor_viewer';
  invitedById: number;
  expiresInDays?: number;
}): Promise<InvitationResult> {
  const { organizationId, email, role, invitedById, expiresInDays = 7 } = params;
  
  try {
    // Check if user already exists and is a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (existingUser) {
      const existingMembership = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, existingUser.id)
        ),
      });
      
      if (existingMembership) {
        return { success: false, error: "User is already a member of this organization" };
      }
    }
    
    // Check for existing pending invitation
    const existingInvitation = await db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.organizationId, organizationId),
        eq(teamInvitations.email, email),
        eq(teamInvitations.status, 'pending')
      ),
    });
    
    if (existingInvitation) {
      return { success: false, error: "An invitation is already pending for this email" };
    }
    
    // Generate token and expiry
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    // Create invitation
    const [result] = await db.insert(teamInvitations).values({
      organizationId,
      email,
      role,
      invitedById,
      token,
      status: 'pending',
      expiresAt,
    });
    
    // Log the invitation
    await logVatrEvent({
      userId: invitedById,
      action: 'created',
      entityType: 'team_invitation',
      entityId: result.insertId,
      description: `Invited ${email} to organization as ${role}`,
      source: 'system',
      metadata: { email, role, organizationId },
    });
    
    return {
      success: true,
      invitationId: result.insertId,
      token,
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return { success: false, error: 'Failed to create invitation' };
  }
}

/**
 * Accept an invitation and add user to organization
 */
export async function acceptInvitation(params: {
  token: string;
  userId: number;
}): Promise<{ success: boolean; organizationId?: number; error?: string }> {
  const { token, userId } = params;
  
  try {
    // Find the invitation
    const invitation = await db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.token, token),
        eq(teamInvitations.status, 'pending')
      ),
    });
    
    if (!invitation) {
      return { success: false, error: "Invalid or expired invitation" };
    }
    
    // Check expiry
    if (new Date() > invitation.expiresAt) {
      await db.update(teamInvitations)
        .set({ status: 'expired' })
        .where(eq(teamInvitations.id, invitation.id));
      return { success: false, error: "Invitation has expired" };
    }
    
    // Get user email to verify
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      return { success: false, error: "User not found" };
    }
    
    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return { success: false, error: "Email does not match invitation" };
    }
    
    // Create organization membership
    await db.insert(organizationMembers).values({
      organizationId: invitation.organizationId,
      userId,
      role: invitation.role,
      status: 'active',
      invitedBy: invitation.invitedById,
      invitedAt: invitation.createdAt,
      acceptedAt: new Date(),
    });
    
    // Update user's active org if not set
    if (!user.activeOrgId) {
      await db.update(users)
        .set({ activeOrgId: invitation.organizationId })
        .where(eq(users.id, userId));
    }
    
    // Mark invitation as accepted
    await db.update(teamInvitations)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(teamInvitations.id, invitation.id));
    
    // Log acceptance
    await logVatrEvent({
      userId,
      action: 'updated',
      entityType: 'team_invitation',
      entityId: invitation.id,
      description: `Accepted invitation to organization ${invitation.organizationId}`,
      source: 'system',
      metadata: { organizationId: invitation.organizationId, role: invitation.role },
    });
    
    return { success: true, organizationId: invitation.organizationId };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: 'Failed to accept invitation' };
  }
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(params: {
  invitationId: number;
  cancelledById: number;
}): Promise<{ success: boolean; error?: string }> {
  const { invitationId, cancelledById } = params;
  
  try {
    const invitation = await db.query.teamInvitations.findFirst({
      where: eq(teamInvitations.id, invitationId),
    });
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }
    
    if (invitation.status !== 'pending') {
      return { success: false, error: "Invitation is no longer pending" };
    }
    
    await db.update(teamInvitations)
      .set({ status: 'cancelled' })
      .where(eq(teamInvitations.id, invitationId));
    
    await logVatrEvent({
      userId: cancelledById,
      action: 'updated',
      entityType: 'team_invitation',
      entityId: invitationId,
      description: `Cancelled invitation for ${invitation.email}`,
      source: 'system',
      metadata: { email: invitation.email },
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    return { success: false, error: 'Failed to cancel invitation' };
  }
}

/**
 * Resend an invitation (generates new token and extends expiry)
 */
export async function resendInvitation(params: {
  invitationId: number;
  resendById: number;
}): Promise<InvitationResult> {
  const { invitationId, resendById } = params;
  
  try {
    const invitation = await db.query.teamInvitations.findFirst({
      where: eq(teamInvitations.id, invitationId),
    });
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }
    
    if (invitation.status === 'accepted') {
      return { success: false, error: "Invitation has already been accepted" };
    }
    
    // Generate new token and expiry
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.update(teamInvitations)
      .set({ token, expiresAt, status: 'pending' })
      .where(eq(teamInvitations.id, invitationId));
    
    await logVatrEvent({
      userId: resendById,
      action: 'updated',
      entityType: 'team_invitation',
      entityId: invitationId,
      description: `Resent invitation to ${invitation.email}`,
      source: 'system',
      metadata: { email: invitation.email },
    });
    
    return { success: true, invitationId, token };
  } catch (error) {
    console.error('Error resending invitation:', error);
    return { success: false, error: 'Failed to resend invitation' };
  }
}

/**
 * Get pending invitations for an organization
 */
export async function getOrganizationInvitations(organizationId: number) {
  return db.query.teamInvitations.findMany({
    where: eq(teamInvitations.organizationId, organizationId),
  });
}

/**
 * Get invitation by token (for acceptance page)
 */
export async function getInvitationByToken(token: string) {
  const invitation = await db.query.teamInvitations.findFirst({
    where: eq(teamInvitations.token, token),
  });
  
  if (!invitation) return null;
  
  // Get organization details
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, invitation.organizationId),
  });
  
  return {
    ...invitation,
    organization: org,
    isExpired: new Date() > invitation.expiresAt,
  };
}
