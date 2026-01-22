/**
 * Organization Invitation Service
 * 
 * Handles sending invitation emails and managing invitation flow:
 * - Generate and send invitation emails
 * - Track invitation status
 * - Handle invitation acceptance
 */

import { emailService } from "./emailService";
import * as db from "../db";
import crypto from "crypto";

// Invitation types
export interface InvitationData {
  organizationId: number;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: "admin" | "editor" | "reviewer" | "investor_viewer";
  teamIds?: number[];
  projectIds?: number[];
  expiresInDays?: number;
  personalMessage?: string;
}

export interface InvitationResult {
  success: boolean;
  tokenId?: number;
  error?: string;
}

/**
 * Generate secure random token
 */
function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash token for storage (one-way)
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Send organization invitation email
 */
export async function sendOrganizationInvitation(
  data: InvitationData,
  inviterId: number
): Promise<InvitationResult> {
  const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
  
  // Generate token
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  
  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));
  
  try {
    // Create invite token record
    const tokenId = await db.createInviteToken({
      tokenHash,
      organizationId: data.organizationId,
      role: data.role,
      maxUses: 1,
      expiresAt,
      restrictToEmail: data.inviteeEmail,
      teamIds: data.teamIds,
      projectIds: data.projectIds,
      require2FA: false,
      createdBy: inviterId,
    });
    
    if (!tokenId) {
      return { success: false, error: "Failed to create invitation token" };
    }
    
    // Build invitation URL
    const inviteUrl = `${baseUrl}/auth/login?invite=${rawToken}`;
    
    // Send invitation email
    const emailResult = await emailService.send({
      to: data.inviteeEmail,
      subject: `You've been invited to join ${data.organizationName} on KIISHA`,
      html: generateInvitationEmailHtml(data, inviteUrl, expiresAt),
      text: generateInvitationEmailText(data, inviteUrl, expiresAt),
    });
    
    if (!emailResult.success) {
      // Log the failure but don't fail the invitation creation
      console.warn("[OrgInvitations] Email send failed:", emailResult.error);
      
      // Still return success with token ID - admin can share the link manually
      return {
        success: true,
        tokenId,
        error: `Invitation created but email failed: ${emailResult.error}. Share this link manually: ${inviteUrl}`,
      };
    }
    
    // Log the invitation event
    await db.createAuditLog({
      userId: inviterId,
      action: "invitation_sent",
      entityType: "organization",
      entityId: data.organizationId,
      newValue: {
        inviteeEmail: data.inviteeEmail,
        role: data.role,
        tokenId,
        expiresAt: expiresAt.toISOString(),
      },
      createdAt: new Date(),
    });
    
    return { success: true, tokenId };
  } catch (error) {
    console.error("[OrgInvitations] Error sending invitation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resend an existing invitation
 */
export async function resendInvitation(
  tokenId: number,
  inviterId: number
): Promise<InvitationResult> {
  const baseUrl = process.env.VITE_APP_URL || "https://kiisha.app";
  
  // Get existing token
  const tokens = await db.getInviteTokensForOrg(0); // Will need to filter
  const existingToken = tokens.find(t => t.id === tokenId);
  
  if (!existingToken) {
    return { success: false, error: "Invitation not found" };
  }
  
  if (existingToken.revokedAt) {
    return { success: false, error: "Invitation has been revoked" };
  }
  
  if (existingToken.usedCount >= existingToken.maxUses) {
    return { success: false, error: "Invitation has already been used" };
  }
  
  if (new Date() > existingToken.expiresAt) {
    return { success: false, error: "Invitation has expired" };
  }
  
  // Generate new token (revoke old one)
  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  
  // Revoke old token
  await db.revokeInviteToken(tokenId, inviterId, "Resent invitation");
  
  // Create new token
  const newTokenId = await db.createInviteToken({
    tokenHash,
    organizationId: existingToken.organizationId,
    role: existingToken.role,
    maxUses: 1,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    restrictToEmail: existingToken.restrictToEmail,
    teamIds: existingToken.teamIds,
    projectIds: existingToken.projectIds,
    require2FA: existingToken.require2FA,
    createdBy: inviterId,
  });
  
  if (!newTokenId) {
    return { success: false, error: "Failed to create new invitation token" };
  }
  
  // Get organization details
  const org = await db.getOrganizationById(existingToken.organizationId);
  const inviter = await db.getUserById(inviterId);
  
  // Build invitation URL
  const inviteUrl = `${baseUrl}/auth/login?invite=${rawToken}`;
  
  // Send email
  const emailResult = await emailService.send({
    to: existingToken.restrictToEmail!,
    subject: `Reminder: You've been invited to join ${org?.name || "an organization"} on KIISHA`,
    html: generateInvitationEmailHtml({
      organizationId: existingToken.organizationId,
      organizationName: org?.name || "Unknown Organization",
      inviterName: inviter?.name || "A team member",
      inviterEmail: inviter?.email || "",
      inviteeEmail: existingToken.restrictToEmail!,
      role: existingToken.role as "admin" | "editor" | "reviewer" | "investor_viewer",
    }, inviteUrl, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    text: generateInvitationEmailText({
      organizationId: existingToken.organizationId,
      organizationName: org?.name || "Unknown Organization",
      inviterName: inviter?.name || "A team member",
      inviterEmail: inviter?.email || "",
      inviteeEmail: existingToken.restrictToEmail!,
      role: existingToken.role as "admin" | "editor" | "reviewer" | "investor_viewer",
    }, inviteUrl, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  });
  
  if (!emailResult.success) {
    return {
      success: true,
      tokenId: newTokenId,
      error: `Invitation recreated but email failed. Share this link manually: ${inviteUrl}`,
    };
  }
  
  return { success: true, tokenId: newTokenId };
}

/**
 * Get role display name
 */
function getRoleDisplayName(role: string): string {
  const roleNames: Record<string, string> = {
    admin: "Administrator",
    editor: "Editor",
    reviewer: "Reviewer",
    investor_viewer: "Investor Viewer",
  };
  return roleNames[role] || role;
}

/**
 * Generate invitation email HTML
 */
function generateInvitationEmailHtml(
  data: InvitationData,
  inviteUrl: string,
  expiresAt: Date
): string {
  const personalMessageHtml = data.personalMessage
    ? `<div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #0369a1; font-style: italic;">"${data.personalMessage}"</p>
        <p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px;">— ${data.inviterName}</p>
      </div>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Invitation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Join ${data.organizationName} on KIISHA</p>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px;">Hi there,</p>
          <p style="font-size: 16px;"><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> as a <strong>${getRoleDisplayName(data.role)}</strong>.</p>
          
          ${personalMessageHtml}
          
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 10px 0; color: #c2410c; font-size: 16px;">What you'll get access to:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #9a3412;">
              <li>Project dashboards and analytics</li>
              <li>Document management and collaboration</li>
              <li>Team communication tools</li>
              <li>Compliance and audit tracking</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">Accept Invitation</a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; text-align: center;">
            This invitation expires on <strong>${expiresAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.<br>
            If you have questions, contact ${data.inviterEmail || "the sender"}.
          </p>
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
            Powered by <strong>KIISHA</strong> — Energy Asset Management Platform
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate invitation email plain text
 */
function generateInvitationEmailText(
  data: InvitationData,
  inviteUrl: string,
  expiresAt: Date
): string {
  const personalMessage = data.personalMessage
    ? `\n"${data.personalMessage}"\n— ${data.inviterName}\n`
    : "";

  return `
You're Invited to Join ${data.organizationName} on KIISHA

Hi there,

${data.inviterName} has invited you to join ${data.organizationName} as a ${getRoleDisplayName(data.role)}.
${personalMessage}
What you'll get access to:
- Project dashboards and analytics
- Document management and collaboration
- Team communication tools
- Compliance and audit tracking

Accept your invitation by clicking the link below:
${inviteUrl}

This invitation expires on ${expiresAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.

If you didn't expect this invitation, you can safely ignore this email.
If you have questions, contact ${data.inviterEmail || "the sender"}.

Powered by KIISHA — Energy Asset Management Platform
  `.trim();
}
