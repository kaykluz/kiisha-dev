/**
 * Phase 33: Channel Workspace Binding Service
 * 
 * Handles workspace binding for WhatsApp and Email channels:
 * - Secure binding code flow (Flow Option 1)
 * - Zero-leak ambiguity handling
 * - Channel commands: /workspace, switch workspace, bind code XXXXXX
 */

import * as db from "../db";
import { resolveWorkspaceForChannel, useBindingCode, type WorkspaceResolution } from "../routers/workspace";

// Command patterns
const BIND_CODE_PATTERN = /^(?:bind\s+code\s+|code\s+)(\d{6})$/i;
const WORKSPACE_COMMAND_PATTERN = /^\/workspace$/i;
const SWITCH_WORKSPACE_PATTERN = /^switch\s+workspace$/i;

// Response templates (zero-leak - no org names)
export const CHANNEL_RESPONSES = {
  AMBIGUOUS_WORKSPACE: `You have access to multiple workspaces. To continue, please:

1. Go to your KIISHA web dashboard
2. Select the workspace you want to use
3. Click "Generate Binding Code"
4. Reply here with: bind code XXXXXX

This ensures your messages go to the correct workspace.`,

  NO_WORKSPACE: `This identifier is not linked to a KIISHA account. Please contact your administrator to get access.`,

  BINDING_SUCCESS: (method: string) => `Workspace bound successfully via ${method}. You can now send messages and they will be processed in this workspace.`,

  BINDING_FAILED: `Invalid or expired binding code. Please generate a new code from your web dashboard.`,

  WORKSPACE_BOUND: (role: string) => `You are currently working in a workspace as ${role}. To switch workspaces, generate a new binding code from your web dashboard.`,

  WORKSPACE_NOT_BOUND: `No workspace is currently bound to this chat. Please bind a workspace first using a binding code from your web dashboard.`,

  UNKNOWN_SENDER: `This identifier is not linked to a KIISHA account. Please contact your administrator.`,
} as const;

/**
 * Parse incoming message for workspace commands
 */
export function parseWorkspaceCommand(message: string): {
  type: "bind_code" | "workspace_status" | "switch_workspace" | "none";
  code?: string;
} {
  const trimmed = message.trim();
  
  // Check for bind code command
  const bindMatch = trimmed.match(BIND_CODE_PATTERN);
  if (bindMatch) {
    return { type: "bind_code", code: bindMatch[1] };
  }
  
  // Check for /workspace command
  if (WORKSPACE_COMMAND_PATTERN.test(trimmed)) {
    return { type: "workspace_status" };
  }
  
  // Check for switch workspace command
  if (SWITCH_WORKSPACE_PATTERN.test(trimmed)) {
    return { type: "switch_workspace" };
  }
  
  return { type: "none" };
}

/**
 * Handle workspace command from channel message
 * Returns response message or null if not a workspace command
 */
export async function handleWorkspaceCommand(
  userId: number,
  channel: "whatsapp" | "email",
  channelIdentifier: string,
  channelThreadId: string | undefined,
  message: string
): Promise<{ handled: boolean; response?: string; organizationId?: number }> {
  const command = parseWorkspaceCommand(message);
  
  if (command.type === "none") {
    return { handled: false };
  }
  
  // Handle bind code command
  if (command.type === "bind_code" && command.code) {
    const result = await useBindingCode(
      command.code,
      userId,
      channel,
      channelIdentifier
    );
    
    if (!result) {
      return { handled: true, response: CHANNEL_RESPONSES.BINDING_FAILED };
    }
    
    // Update conversation session with new org
    if (channelThreadId) {
      const session = await db.getConversationSessionByThread(
        userId,
        channel === "whatsapp" ? "whatsapp" : "email",
        channelThreadId
      );
      
      if (session) {
        // Clear pointers when switching org
        await db.clearConversationSessionPointers(session.id);
        await db.updateConversationSessionOrg(session.id, result.organizationId);
      }
    }
    
    // Log the workspace switch
    await db.logWorkspaceSwitch({
      userId,
      fromOrganizationId: null,
      toOrganizationId: result.organizationId,
      channel,
      switchMethod: "binding_code",
    });
    
    return {
      handled: true,
      response: CHANNEL_RESPONSES.BINDING_SUCCESS("binding code"),
      organizationId: result.organizationId,
    };
  }
  
  // Handle workspace status command
  if (command.type === "workspace_status") {
    const resolution = await resolveWorkspaceForChannel(
      userId,
      channel,
      channelThreadId
    );
    
    if (resolution.status === "resolved") {
      return {
        handled: true,
        response: CHANNEL_RESPONSES.WORKSPACE_BOUND(resolution.role),
        organizationId: resolution.organizationId,
      };
    }
    
    return { handled: true, response: CHANNEL_RESPONSES.WORKSPACE_NOT_BOUND };
  }
  
  // Handle switch workspace command
  if (command.type === "switch_workspace") {
    // Always require new binding code for security
    return { handled: true, response: CHANNEL_RESPONSES.AMBIGUOUS_WORKSPACE };
  }
  
  return { handled: false };
}

/**
 * Resolve workspace for incoming channel message
 * Returns resolved org context or ambiguity response
 */
export async function resolveIncomingMessageWorkspace(
  userId: number | null,
  channel: "whatsapp" | "email",
  channelIdentifier: string,
  channelThreadId?: string,
  identifierOrgId?: number | null
): Promise<{
  resolved: boolean;
  organizationId?: number;
  role?: string;
  response?: string;
}> {
  // Unknown sender
  if (!userId) {
    return {
      resolved: false,
      response: CHANNEL_RESPONSES.UNKNOWN_SENDER,
    };
  }
  
  const resolution = await resolveWorkspaceForChannel(
    userId,
    channel,
    channelThreadId,
    identifierOrgId
  );
  
  if (resolution.status === "resolved") {
    return {
      resolved: true,
      organizationId: resolution.organizationId,
      role: resolution.role,
    };
  }
  
  if (resolution.status === "none") {
    return {
      resolved: false,
      response: CHANNEL_RESPONSES.NO_WORKSPACE,
    };
  }
  
  // Ambiguous - request binding code (zero-leak: don't list org names)
  return {
    resolved: false,
    response: CHANNEL_RESPONSES.AMBIGUOUS_WORKSPACE,
  };
}

/**
 * Create or update conversation session with org binding
 */
export async function ensureConversationSessionWithOrg(
  userId: number,
  organizationId: number,
  channel: "whatsapp" | "email" | "web_chat",
  channelIdentifier: string,
  channelThreadId?: string
): Promise<number> {
  // Check for existing session
  if (channelThreadId) {
    const existing = await db.getConversationSessionByThread(
      userId,
      channel,
      channelThreadId
    );
    
    if (existing) {
      // Update org if different
      if (existing.organizationId !== organizationId) {
        await db.updateConversationSessionOrg(existing.id, organizationId);
        await db.clearConversationSessionPointers(existing.id);
      }
      return existing.id;
    }
  }
  
  // Check for existing session by org + channel
  const existingByOrg = await db.getConversationSessionByOrgAndChannel(
    userId,
    organizationId,
    channel
  );
  
  if (existingByOrg) {
    return existingByOrg.id;
  }
  
  // Create new session using getOrCreateConversationSession
  const sessionId = await db.getOrCreateConversationSession(
    userId,
    channel,
    channelIdentifier
  );
  
  if (sessionId) {
    await db.updateConversationSessionOrg(sessionId, organizationId);
    return sessionId;
  }
  
  return 0;
}

/**
 * Get safe response for ambiguous workspace situation
 * Zero-leak: Never reveals org names or count
 */
export function getAmbiguousWorkspaceResponse(): string {
  return CHANNEL_RESPONSES.AMBIGUOUS_WORKSPACE;
}

/**
 * Get safe response for unknown sender
 * Zero-leak: Generic message, no org hints
 */
export function getUnknownSenderResponse(): string {
  return CHANNEL_RESPONSES.UNKNOWN_SENDER;
}
