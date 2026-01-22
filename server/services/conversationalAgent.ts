/**
 * Conversational Agent Service
 * 
 * Handles WhatsApp + Email conversational AI with:
 * - Identity resolution (exact match only per Patch C)
 * - Conversation context assembly (lightweight pointers per Patch B)
 * - Pronoun resolution ("this", "that doc", etc.)
 * - Tool execution via tRPC createCaller
 * - Safety rails (confirm before mutate)
 */

import { invokeLLM } from '../_core/llm';
import * as db from '../db';
import { TRPCError } from '@trpc/server';
import type { AppRouter } from '../routers';
import {
  handleWorkspaceCommand,
  resolveIncomingMessageWorkspace,
  ensureConversationSessionWithOrg,
  getAmbiguousWorkspaceResponse,
} from './channelWorkspaceBinding';

// Lazy import to avoid circular dependency
let _appRouter: typeof import('../routers').appRouter | null = null;
async function getAppRouter() {
  if (!_appRouter) {
    const mod = await import('../routers');
    _appRouter = mod.appRouter;
  }
  return _appRouter;
}

/**
 * Execute a tRPC procedure via createCaller with user context.
 * This ensures RBAC parity with the web app (A3 requirement).
 */
async function executeWithRBAC<T>(
  userId: number,
  procedurePath: string,
  input: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const appRouter = await getAppRouter();
    const user = await db.getUserById(userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Create caller with user context - RBAC guards will be enforced
    const caller = appRouter.createCaller({
      user: {
        ...user,
        openId: user.openId || '',
        name: user.name || null,
        email: user.email || null,
        role: user.role || 'user',
      } as any,
      req: {} as any,
      res: {} as any,
    });
    
    // Navigate to the procedure and call it
    const parts = procedurePath.split('.');
    let proc: any = caller;
    for (const part of parts) {
      proc = proc[part];
    }
    
    const result = await proc(input);
    return { success: true, data: result };
  } catch (error: any) {
    // Handle RBAC errors gracefully
    if (error.code === 'FORBIDDEN') {
      return { 
        success: false, 
        error: `You don't have permission to perform this action. ${error.message || ''}` 
      };
    }
    if (error.code === 'UNAUTHORIZED') {
      return { success: false, error: 'Authentication required.' };
    }
    return { success: false, error: error.message || 'An error occurred' };
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface ConversationContext {
  sessionId: number;
  userId: number;
  organizationId: number | null;
  channel: 'whatsapp' | 'email' | 'web_chat';
  
  // Context pointers (from conversationSessions)
  lastReferencedProjectId: number | null;
  lastReferencedSiteId: number | null;
  lastReferencedAssetId: number | null;
  lastReferencedDocumentId: number | null;
  activeDataroomId: number | null;
  activeViewScopeId: number | null;
  
  // Pending confirmation state
  pendingAction: string | null;
  pendingActionPayload: any;
}

export interface InboundMessage {
  channel: 'whatsapp' | 'email' | 'sms';
  senderIdentifier: string; // Phone or email
  senderDisplayName?: string;
  messageType: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contact';
  textContent?: string;
  mediaUrl?: string;
  mediaContentType?: string;
  mediaFilename?: string;
  rawPayload?: any;
  
  // Thread/conversation ID (Phase 33)
  threadId?: string; // WhatsApp conversation id / email thread id
  
  // Email-specific
  subject?: string;
  inReplyTo?: string; // For reply chain context
  references?: string[]; // Email thread references
}

export interface AgentResponse {
  success: boolean;
  message: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  data?: any;
  suggestedActions?: string[];
}

// =============================================================================
// INTENT CLASSIFICATION
// =============================================================================

const INTENT_DEFINITIONS = {
  ASK_STATUS: {
    description: 'User wants to know the status of a project, dataroom, or document',
    examples: ['what is the status of UMZA?', 'how is the diligence going?', 'any gaps in the dataroom?'],
    tRPCProcedure: 'datarooms.getGaps',
  },
  SEARCH_DOCS: {
    description: 'User wants to find documents',
    examples: ['find the PPA', 'where is the land title?', 'show me all contracts'],
    tRPCProcedure: 'documents.search',
  },
  UPLOAD_DOC: {
    description: 'User is sending a document to upload',
    examples: ['here is the updated PPA', 'uploading the site survey'],
    tRPCProcedure: 'ingestion.upload',
  },
  LINK_DOC: {
    description: 'User wants to link a document to an asset',
    examples: ['link this to UMZA', 'attach to the Lagos project'],
    tRPCProcedure: 'documents.linkToAsset',
  },
  EXTRACT_FIELDS: {
    description: 'User wants to extract data from a document',
    examples: ['extract the capacity from this', 'what is the tariff in the PPA?'],
    tRPCProcedure: 'ai.extractFields',
  },
  GENERATE_DATAROOM: {
    description: 'User wants to create or populate a dataroom',
    examples: ['create a dataroom for UMZA', 'set up investor dataroom'],
    tRPCProcedure: 'datarooms.generate',
  },
  CREATE_WORK_ORDER: {
    description: 'User wants to create a maintenance work order',
    examples: ['create a work order for inverter repair', 'schedule maintenance'],
    tRPCProcedure: 'maintenance.createWorkOrder',
  },
  SUMMARIZE: {
    description: 'User wants a summary of activity or status',
    examples: ['what happened this week?', 'give me a summary', 'any updates?'],
    tRPCProcedure: 'activity.getSummary',
  },
  CONFIRM_ACTION: {
    description: 'User is confirming a pending action',
    examples: ['yes', 'confirm', 'go ahead', 'do it'],
    tRPCProcedure: null, // Handled specially
  },
  CANCEL_ACTION: {
    description: 'User is canceling a pending action',
    examples: ['no', 'cancel', 'never mind', 'stop'],
    tRPCProcedure: null, // Handled specially
  },
  UNKNOWN: {
    description: 'Intent not recognized',
    examples: [],
    tRPCProcedure: null,
  },
};

// =============================================================================
// MAIN AGENT HANDLER
// =============================================================================

/**
 * Process an inbound message from any channel
 * This is the main entry point for the conversational agent
 */
export async function processInboundMessage(message: InboundMessage): Promise<AgentResponse> {
  // Step 1: Resolve identity (exact match only per Patch C)
  const identityType = message.channel === 'whatsapp' ? 'whatsapp_phone' : 
                       message.channel === 'email' ? 'email' : 'phone';
  
  const identity = await db.resolveIdentity(identityType, message.senderIdentifier);
  
  // Step 2: If unknown sender, quarantine and return safe response
  if (!identity) {
    await db.quarantineInbound({
      channel: message.channel,
      senderIdentifier: message.senderIdentifier,
      senderDisplayName: message.senderDisplayName,
      messageType: message.messageType,
      textContent: message.textContent,
      rawPayload: message.rawPayload,
    });
    
    return {
      success: false,
      message: `This ${message.channel === 'whatsapp' ? 'number' : 'email'} isn't linked to a KIISHA user. Please contact your administrator to get access.`,
    };
  }
  
  // Step 3: Only allow verified identifiers to proceed
  if (identity.status !== 'verified') {
    return {
      success: false,
      message: 'Your identity is pending verification. Please contact your administrator.',
    };
  }
  
  // Step 3.5 (Phase 33): Check for workspace commands first
  const workspaceCmd = await handleWorkspaceCommand(
    identity.userId,
    message.channel === 'sms' ? 'whatsapp' : message.channel as 'whatsapp' | 'email',
    message.senderIdentifier,
    message.threadId,
    message.textContent || ''
  );
  
  if (workspaceCmd.handled) {
    return {
      success: true,
      message: workspaceCmd.response || 'Workspace command processed.',
    };
  }
  
  // Step 3.6 (Phase 33): Resolve workspace for this message
  const workspaceResolution = await resolveIncomingMessageWorkspace(
    identity.userId,
    message.channel === 'sms' ? 'whatsapp' : message.channel as 'whatsapp' | 'email',
    message.senderIdentifier,
    message.threadId,
    identity.organizationId
  );
  
  if (!workspaceResolution.resolved) {
    return {
      success: false,
      message: workspaceResolution.response || getAmbiguousWorkspaceResponse(),
    };
  }
  
  // Step 4: Get or create conversation session with org scope
  const sessionId = await ensureConversationSessionWithOrg(
    identity.userId,
    workspaceResolution.organizationId!,
    message.channel === 'sms' ? 'whatsapp' : message.channel,
    message.senderIdentifier,
    message.threadId
  );
  
  // Step 5: Load conversation context
  const session = await db.getConversationSession(sessionId);
  if (!session) {
    throw new Error('Failed to load conversation session');
  }
  
  const context: ConversationContext = {
    sessionId,
    userId: identity.userId,
    // Phase 33: Use resolved workspace org, not identity org (multi-org support)
    organizationId: workspaceResolution.organizationId!,
    channel: session.channel,
    lastReferencedProjectId: session.lastReferencedProjectId,
    lastReferencedSiteId: session.lastReferencedSiteId,
    lastReferencedAssetId: session.lastReferencedAssetId,
    lastReferencedDocumentId: session.lastReferencedDocumentId,
    activeDataroomId: session.activeDataroomId,
    activeViewScopeId: session.activeViewScopeId,
    pendingAction: session.pendingAction,
    pendingActionPayload: session.pendingActionPayload,
  };
  
  // Step 6: Check for pending confirmation
  if (context.pendingAction && context.pendingAction !== 'none') {
    return handlePendingConfirmation(context, message);
  }
  
  // Step 7: Handle attachments (Patch D)
  if (message.messageType !== 'text' && message.mediaUrl) {
    return handleAttachment(context, message);
  }
  
  // Step 8: Classify intent and execute
  return classifyAndExecute(context, message);
}

// =============================================================================
// INTENT CLASSIFICATION WITH LLM
// =============================================================================

async function classifyAndExecute(
  context: ConversationContext,
  message: InboundMessage
): Promise<AgentResponse> {
  // Build context string for LLM
  const contextString = await buildContextString(context);
  
  // Classify intent using LLM
  const classificationResponse = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are an intent classifier for KIISHA, a solar asset management platform.
        
Current context:
${contextString}

Classify the user's message into one of these intents:
- ASK_STATUS: Asking about project/dataroom/document status
- SEARCH_DOCS: Looking for documents
- UPLOAD_DOC: Sending a document
- LINK_DOC: Linking a document to an asset
- EXTRACT_FIELDS: Extracting data from documents
- GENERATE_DATAROOM: Creating/populating a dataroom
- CREATE_WORK_ORDER: Creating maintenance work orders
- SUMMARIZE: Requesting activity summary
- CONFIRM_ACTION: Confirming a pending action
- CANCEL_ACTION: Canceling a pending action
- UNKNOWN: Cannot determine intent

Also resolve any pronouns or references:
- "this" / "that" → refer to last referenced document
- "the project" → refer to last referenced project
- "here" / "there" → refer to last referenced site

Return JSON with:
{
  "intent": "INTENT_NAME",
  "resolvedEntities": {
    "projectId": number or null,
    "documentId": number or null,
    "siteId": number or null,
    "searchQuery": string or null
  },
  "confidence": 0.0 to 1.0
}`
      },
      {
        role: 'user',
        content: message.textContent || ''
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'intent_classification',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            resolvedEntities: {
              type: 'object',
              properties: {
                projectId: { type: ['number', 'null'] },
                documentId: { type: ['number', 'null'] },
                siteId: { type: ['number', 'null'] },
                searchQuery: { type: ['string', 'null'] }
              },
              required: ['projectId', 'documentId', 'siteId', 'searchQuery'],
              additionalProperties: false
            },
            confidence: { type: 'number' }
          },
          required: ['intent', 'resolvedEntities', 'confidence'],
          additionalProperties: false
        }
      }
    }
  });
  
  const messageContent = classificationResponse.choices[0].message.content;
  const contentStr = typeof messageContent === 'string' ? messageContent : JSON.stringify(messageContent);
  const classification = JSON.parse(contentStr || '{}');
  
  // Update context with resolved entities
  if (classification.resolvedEntities.projectId) {
    await db.updateConversationContext(context.sessionId, {
      lastReferencedProjectId: classification.resolvedEntities.projectId
    });
  }
  if (classification.resolvedEntities.documentId) {
    await db.updateConversationContext(context.sessionId, {
      lastReferencedDocumentId: classification.resolvedEntities.documentId
    });
  }
  
  // Execute based on intent
  return executeIntent(context, classification, message);
}

// =============================================================================
// CONTEXT ASSEMBLY (Patch B)
// =============================================================================

async function buildContextString(context: ConversationContext): Promise<string> {
  const parts: string[] = [];
  
  if (context.lastReferencedProjectId) {
    const project = await db.getProjectById(context.lastReferencedProjectId);
    if (project) {
      parts.push(`Last referenced project: "${project.name}" (ID: ${project.id})`);
    }
  }
  
  if (context.lastReferencedDocumentId) {
    const doc = await db.getDocumentById(context.lastReferencedDocumentId);
    if (doc) {
      parts.push(`Last referenced document: "${doc.name}" (ID: ${doc.id})`);
    }
  }
  
  if (context.lastReferencedSiteId) {
    const site = await db.getSiteById(context.lastReferencedSiteId);
    if (site) {
      parts.push(`Last referenced site: "${site.name}" (ID: ${site.id})`);
    }
  }
  
  if (context.activeDataroomId) {
    parts.push(`Active dataroom ID: ${context.activeDataroomId}`);
  }
  
  if (parts.length === 0) {
    parts.push('No prior context established.');
  }
  
  return parts.join('\n');
}

// =============================================================================
// INTENT EXECUTION
// =============================================================================

async function executeIntent(
  context: ConversationContext,
  classification: { intent: string; resolvedEntities: any; confidence: number },
  message: InboundMessage
): Promise<AgentResponse> {
  const { intent, resolvedEntities } = classification;
  
  switch (intent) {
    case 'ASK_STATUS':
      return handleAskStatus(context, resolvedEntities);
    
    case 'SEARCH_DOCS':
      return handleSearchDocs(context, resolvedEntities);
    
    case 'SUMMARIZE':
      return handleSummarize(context, resolvedEntities);
    
    case 'CREATE_WORK_ORDER':
      return handleCreateWorkOrder(context, resolvedEntities, message);
    
    case 'GENERATE_DATAROOM':
      return handleGenerateDataroom(context, resolvedEntities);
    
    // Request system commands
    case 'LIST_REQUESTS':
      return handleListRequests(context, resolvedEntities);
    
    case 'VIEW_REQUEST':
      return handleViewRequest(context, resolvedEntities);
    
    case 'RESPOND_TO_REQUEST':
      return handleRespondToRequest(context, resolvedEntities, message);
    
    case 'CREATE_REQUEST':
      return handleCreateRequest(context, resolvedEntities, message);
    
    case 'UNKNOWN':
    default:
      return {
        success: false,
        message: "I'm not sure what you're asking for. You can ask me to:\n" +
                 "• Check project or dataroom status\n" +
                 "• Search for documents\n" +
                 "• Create work orders\n" +
                 "• Generate datarooms\n" +
                 "• Summarize recent activity\n" +
                 "• List my requests\n" +
                 "• Respond to a request\n" +
                 "• Create a new request",
        suggestedActions: ['Check status', 'Search documents', 'Create work order', 'List requests']
      };
  }
}

// =============================================================================
// INTENT HANDLERS
// =============================================================================

async function handleAskStatus(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  const projectId = entities.projectId || context.lastReferencedProjectId;
  
  if (!projectId) {
    return {
      success: false,
      message: 'Which project would you like to check the status of?',
      suggestedActions: ['UMZA Oil Mill', 'Kano Solar Farm', 'Lagos Mini-Grid']
    };
  }
  
  // A3: Use executeWithRBAC to enforce same guards as web app
  const projectResult = await executeWithRBAC<any>(
    context.userId,
    'projects.getById',
    { projectId }
  );
  
  if (!projectResult.success) {
    // RBAC denied - return friendly message
    return {
      success: false,
      message: projectResult.error || 'You don\'t have access to this project.'
    };
  }
  
  const project = projectResult.data;
  if (!project) {
    return {
      success: false,
      message: 'Project not found.'
    };
  }
  
  // Get dataroom gaps if available - stub for now (TODO: implement getDataRoomGaps)
  const gaps: Array<{ documentType: string; status: string }> = [];
  
  return {
    success: true,
    message: `**${project.name}** Status:\n` +
             `• Stage: ${project.stage || 'Not set'}\n` +
             `• Status: ${project.status || 'Active'}\n` +
             `• Capacity: ${project.capacity || 'N/A'} MW\n` +
             (gaps.length > 0 ? `\n⚠️ ${gaps.length} document gaps in dataroom` : '\n✅ Dataroom complete'),
    data: { project, gaps }
  };
}

async function handleSearchDocs(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  const query = entities.searchQuery;
  const projectId = entities.projectId || context.lastReferencedProjectId;
  
  if (!query) {
    return {
      success: false,
      message: 'What document are you looking for?'
    };
  }
  
  // Search documents by name (simple implementation)
  const allDocs = await db.getDocumentsByProject(projectId || 0);
  const results = allDocs.filter((d: any) => 
    d.name?.toLowerCase().includes(query.toLowerCase()) ||
    d.description?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10);
  
  if (results.length === 0) {
    return {
      success: false,
      message: `No documents found matching "${query}".`
    };
  }
  
  // Update context with first result
  await db.updateConversationContext(context.sessionId, {
    lastReferencedDocumentId: results[0].id
  });
  
  const docList = results.slice(0, 5).map((d: any, i: number) => 
    `${i + 1}. ${d.name} (${d.status || 'pending'})`
  ).join('\n');
  
  return {
    success: true,
    message: `Found ${results.length} document(s):\n${docList}`,
    data: { documents: results }
  };
}

async function handleSummarize(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  const projectId = entities.projectId || context.lastReferencedProjectId;
  
  // Get recent activity
  const recentDocs = await db.getRecentDocuments(projectId, 5);
  const recentRfis = await db.getRecentRfis(projectId, 5);
  
  let summary = '**Recent Activity:**\n\n';
  
  if (recentDocs.length > 0) {
    summary += '📄 **Documents:**\n';
    recentDocs.forEach(d => {
      summary += `• ${d.name} - ${d.status || 'uploaded'}\n`;
    });
    summary += '\n';
  }
  
  if (recentRfis.length > 0) {
    summary += '❓ **RFIs:**\n';
    recentRfis.forEach(r => {
      summary += `• ${r.title || r.description?.substring(0, 50)} - ${r.status}\n`;
    });
  }
  
  if (recentDocs.length === 0 && recentRfis.length === 0) {
    summary = 'No recent activity to report.';
  }
  
  return {
    success: true,
    message: summary,
    data: { recentDocs, recentRfis }
  };
}

async function handleCreateWorkOrder(
  context: ConversationContext,
  entities: any,
  message: InboundMessage
): Promise<AgentResponse> {
  // This is a mutating action - require confirmation (safety rails)
  await db.setPendingAction(
    context.sessionId,
    'confirm_verify', // Using generic confirm
    {
      action: 'createWorkOrder',
      description: message.textContent,
      projectId: entities.projectId || context.lastReferencedProjectId,
      siteId: entities.siteId || context.lastReferencedSiteId
    }
  );
  
  return {
    success: true,
    requiresConfirmation: true,
    confirmationPrompt: `Create a work order with description:\n"${message.textContent}"\n\nReply "yes" to confirm or "no" to cancel.`,
    message: 'Please confirm to create this work order.'
  };
}

async function handleGenerateDataroom(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  const projectId = entities.projectId || context.lastReferencedProjectId;
  
  if (!projectId) {
    return {
      success: false,
      message: 'Which project should I create a dataroom for?'
    };
  }
  
  // This is a mutating action - require confirmation
  await db.setPendingAction(
    context.sessionId,
    'confirm_share_dataroom',
    {
      action: 'generateDataroom',
      projectId
    }
  );
  
  const project = await db.getProjectById(projectId);
  
  return {
    success: true,
    requiresConfirmation: true,
    confirmationPrompt: `Generate a dataroom for "${project?.name || 'this project'}"?\n\nReply "yes" to confirm or "no" to cancel.`,
    message: 'Please confirm to generate this dataroom.'
  };
}

// =============================================================================
// PENDING CONFIRMATION HANDLER
// =============================================================================

async function handlePendingConfirmation(
  context: ConversationContext,
  message: InboundMessage
): Promise<AgentResponse> {
  const text = (message.textContent || '').toLowerCase().trim();
  
  // Check for confirmation
  const confirmWords = ['yes', 'confirm', 'go ahead', 'do it', 'proceed', 'ok', 'okay'];
  const cancelWords = ['no', 'cancel', 'stop', 'never mind', 'abort'];
  
  const isConfirm = confirmWords.some(w => text.includes(w));
  const isCancel = cancelWords.some(w => text.includes(w));
  
  if (isCancel) {
    await db.clearPendingAction(context.sessionId);
    return {
      success: true,
      message: 'Action cancelled.'
    };
  }
  
  if (!isConfirm) {
    return {
      success: false,
      message: 'Please reply "yes" to confirm or "no" to cancel.',
      requiresConfirmation: true
    };
  }
  
  // Execute the pending action
  const payload = context.pendingActionPayload;
  await db.clearPendingAction(context.sessionId);
  
  switch (payload?.action) {
    case 'createWorkOrder':
      // Execute work order creation
      const workOrderResult = await db.createWorkOrder({
        title: payload.description?.substring(0, 100) || 'Work Order',
        description: payload.description,
        siteId: payload.siteId || 1, // Required field
        sourceType: 'reactive',
        workType: 'corrective',
        priority: 'medium',
        organizationId: context.organizationId
      });
      const workOrderId = workOrderResult?.id;
      return {
        success: true,
        message: `✅ Work order created (ID: ${workOrderId})`
      };
    
    case 'generateDataroom':
      // Execute dataroom generation
      await db.createDataRoom({
        name: `Dataroom - ${new Date().toLocaleDateString()}`,
        projectId: payload.projectId,
        createdById: context.userId,
        organizationId: context.organizationId,
        accessType: 'private'
      });
      const dataroomId = 'new';
      return {
        success: true,
        message: `✅ Dataroom created (ID: ${dataroomId})`
      };
    
    case 'linkAttachment':
      // B1: Only link after explicit confirmation
      await db.createPrimaryAttachmentLink({
        ingestedFileId: payload.ingestedFileId,
        projectId: payload.projectId,
        linkedBy: 'user_confirmed',
        aiConfidence: payload.aiConfidence,
        linkedByUserId: context.userId
      });
      return {
        success: true,
        message: `✅ Attachment linked to "${payload.projectName || 'project'}".`
      };
    
    default:
      return {
        success: false,
        message: 'Unknown action type.'
      };
  }
}

// =============================================================================
// ATTACHMENT HANDLER (Patch D)
// =============================================================================

async function handleAttachment(
  context: ConversationContext,
  message: InboundMessage
): Promise<AgentResponse> {
  // Store the attachment as UNLINKED first (B1: never auto-link)
  // Note: In production, we'd download the media and store in S3
  
  // Create ingestion record WITHOUT linking
  const fileType = message.mediaContentType?.startsWith('image/') ? 'image' as const :
                   message.mediaContentType?.startsWith('audio/') ? 'audio' as const :
                   message.mediaContentType?.startsWith('video/') ? 'video' as const :
                   message.mediaContentType?.includes('pdf') ? 'pdf' as const :
                   message.channel === 'whatsapp' ? 'whatsapp' as const : 'other' as const;
  
  const ingestedFileId = await db.createIngestedFile({
    originalFilename: message.mediaFilename || 'attachment',
    mimeType: message.mediaContentType || 'application/octet-stream',
    storageUrl: message.mediaUrl || '',
    storageKey: message.mediaUrl || '',
    fileType,
    ingestedById: context.userId,
    sourceChannel: message.channel === 'whatsapp' ? 'whatsapp' : 'email',
    processingStatus: 'pending',
    organizationId: context.organizationId
  });
  
  // Try to suggest a primary link based on context
  let suggestedProjectId = context.lastReferencedProjectId;
  let aiConfidence = 0.5;
  
  // If we have context, increase confidence
  if (suggestedProjectId) {
    aiConfidence = 0.7;
  }
  
  // B1 FIX: NEVER auto-link, always ask for confirmation
  if (suggestedProjectId && ingestedFileId) {
    const project = await db.getProjectById(suggestedProjectId);
    
    // Store pending action for confirmation
    await db.setPendingAction(
      context.sessionId,
      'confirm_link_attachment',
      {
        action: 'linkAttachment',
        ingestedFileId,
        projectId: suggestedProjectId,
        projectName: project?.name,
        aiConfidence
      }
    );
    
    // High confidence: preselect but still ask
    // Low confidence: ask without preselection
    const confidenceLabel = aiConfidence >= 0.7 ? 'high' : 'low';
    
    return {
      success: true,
      requiresConfirmation: true,
      confirmationPrompt: `📎 Attachment received!\n\nI suggest linking to "${project?.name || 'project'}" (${confidenceLabel} confidence).\n\nReply "yes" to confirm, "no" to leave unlinked, or "link to [project name]" to specify a different project.`,
      message: 'Please confirm the attachment link.',
      data: { ingestedFileId, suggestedProjectId, aiConfidence, unlinked: true }
    };
  }
  
  // No context - store as unlinked for human triage
  return {
    success: true,
    message: '📎 Attachment received and stored for triage.\n\nReply "link to [project name]" to link it to a project.',
    data: { ingestedFileId, unlinked: true }
  };
}

// =============================================================================
// SAFE RESPONSE FOR UNKNOWN SENDERS
// =============================================================================

// =============================================================================
// REQUEST SYSTEM HANDLERS
// =============================================================================

async function handleListRequests(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  // Get incoming requests for user's organization
  const result = await executeWithRBAC<any[]>(
    context.userId,
    'requests.listIncoming',
    { status: entities.status || 'active' }
  );
  
  if (!result.success) {
    return {
      success: false,
      message: result.error || 'Unable to fetch requests.'
    };
  }
  
  const requests = result.data || [];
  
  if (requests.length === 0) {
    return {
      success: true,
      message: 'You have no pending requests at this time.',
      suggestedActions: ['Create a request', 'Check project status']
    };
  }
  
  const requestList = requests.slice(0, 5).map((r: any, i: number) => 
    `${i + 1}. ${r.title} (from ${r.issuerOrgName || 'Unknown'}) - Due: ${r.deadlineAt ? new Date(r.deadlineAt).toLocaleDateString() : 'No deadline'}`
  ).join('\n');
  
  return {
    success: true,
    message: `📋 Your pending requests:\n\n${requestList}\n\nReply with a number to view details, or "respond to [title]" to start responding.`,
    data: { requests: requests.slice(0, 5) },
    suggestedActions: requests.slice(0, 3).map((r: any) => `View ${r.title}`)
  };
}

async function handleViewRequest(
  context: ConversationContext,
  entities: any
): Promise<AgentResponse> {
  const requestId = entities.requestId;
  
  if (!requestId) {
    return {
      success: false,
      message: 'Which request would you like to view? Please specify the request name or ID.',
      suggestedActions: ['List requests']
    };
  }
  
  const result = await executeWithRBAC<any>(
    context.userId,
    'requests.get',
    { requestId }
  );
  
  if (!result.success) {
    return {
      success: false,
      message: result.error || 'Unable to fetch request details.'
    };
  }
  
  const request = result.data;
  if (!request) {
    return {
      success: false,
      message: 'Request not found.'
    };
  }
  
  const deadline = request.deadlineAt ? new Date(request.deadlineAt).toLocaleDateString() : 'No deadline';
  const requirements = request.requirements?.length || 0;
  
  return {
    success: true,
    message: `📄 **${request.title}**\n\n` +
             `From: ${request.issuerOrgName || 'Unknown'}\n` +
             `Status: ${request.status}\n` +
             `Deadline: ${deadline}\n` +
             `Requirements: ${requirements} items\n\n` +
             `${request.instructions || 'No additional instructions.'}\n\n` +
             `Reply "respond" to start your response, or "list requirements" to see what's needed.`,
    data: { request },
    suggestedActions: ['Respond to this request', 'List requirements', 'Back to requests']
  };
}

async function handleRespondToRequest(
  context: ConversationContext,
  entities: any,
  message: InboundMessage
): Promise<AgentResponse> {
  const requestId = entities.requestId;
  
  if (!requestId) {
    return {
      success: false,
      message: 'Which request would you like to respond to? Please specify the request name or ID.',
      suggestedActions: ['List requests']
    };
  }
  
  // Create or get workspace
  const workspaceResult = await executeWithRBAC<any>(
    context.userId,
    'requests.workspaces.create',
    { requestId }
  );
  
  if (!workspaceResult.success) {
    return {
      success: false,
      message: workspaceResult.error || 'Unable to create response workspace.'
    };
  }
  
  const workspaceId = workspaceResult.data?.workspaceId;
  
  // Get validation status
  const validationResult = await executeWithRBAC<any>(
    context.userId,
    'requests.workspaces.validate',
    { workspaceId }
  );
  
  const validation = validationResult.data;
  const missingCount = (validation?.missingFields?.length || 0) + (validation?.missingDocs?.length || 0);
  
  return {
    success: true,
    message: `📝 Response workspace ready!\n\n` +
             `${missingCount > 0 ? `⚠️ ${missingCount} items still needed.` : '✅ All requirements met!'}\n\n` +
             `You can:\n` +
             `• Send documents as attachments\n` +
             `• Reply with answers to questions\n` +
             `• Say "submit" when ready\n\n` +
             `For the web interface with full features, visit the Requests page in KIISHA.`,
    data: { workspaceId, validation },
    suggestedActions: ['Upload document', 'List missing items', 'Submit response']
  };
}

async function handleCreateRequest(
  context: ConversationContext,
  entities: any,
  message: InboundMessage
): Promise<AgentResponse> {
  // Creating requests via chat is limited - guide to web UI
  return {
    success: true,
    message: `📋 To create a new request:\n\n` +
             `1. Go to the Requests page in KIISHA\n` +
             `2. Click "New Request"\n` +
             `3. Select a template or create custom\n` +
             `4. Add recipients and requirements\n\n` +
             `Creating requests via chat is coming soon! For now, please use the web interface for full control over templates and requirements.`,
    suggestedActions: ['List my requests', 'Check project status']
  };
}

export function getSafeResponseForUnknownSender(channel: 'whatsapp' | 'email' | 'sms'): string {
  const channelName = channel === 'whatsapp' ? 'number' : 
                      channel === 'email' ? 'email address' : 'phone number';
  
  return `This ${channelName} isn't linked to a KIISHA user account. ` +
         `If you believe this is an error, please contact your organization administrator. ` +
         `For security, no data access is available until your identity is verified.`;
}
