/**
 * OpenClaw Router - Multi-channel AI assistant integration
 * 
 * Architecture principle: "OpenClaw executes. KIISHA authorizes."
 * 
 * This router handles:
 * - Webhook events from OpenClaw gateway
 * - Identity resolution and verification
 * - Capability checks and approval workflows
 * - Conversation logging as VATRs
 * - Task execution and result handling
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import {
  channelIdentities, capabilityRegistry, orgCapabilities, approvalRequests,
  openclawSecurityPolicies, conversationVatrs, openclawTasks, openclawScheduledTasks,
  users, organizationMembers, portfolios, projects
} from "../../drizzle/schema";
import { eq, and, desc, sql, inArray, isNull, gte, lte } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { chatResponse } from "../ai/gateway";
import type { AIMessage, ToolDefinition } from "../ai/types";
import {
  getPortfolioSummary,
  listProjects,
  getProjectDetails,
  getDocumentStatus,
  listDocuments,
  listAlerts,
  listTickets,
  createTicket,
  getComplianceStatus,
  type SkillContext,
} from "../services/openclawSkills";

// ============================================================================
// SCHEMAS
// ============================================================================

// OpenClaw Event Schema - incoming messages from any channel
const openClawEventSchema = z.object({
  // Event metadata
  eventId: z.string(),
  timestamp: z.string(),
  
  // Channel information
  channel: z.object({
    type: z.enum(["whatsapp", "telegram", "slack", "discord", "msteams", "signal", "imessage", "matrix", "googlechat", "webchat"]),
    accountId: z.string().optional(),
  }),
  
  // Sender information
  sender: z.object({
    id: z.string(), // External ID (phone number, username, etc.)
    handle: z.string().optional(),
    displayName: z.string().optional(),
  }),
  
  // Message content
  content: z.object({
    type: z.enum(["text", "image", "audio", "video", "document", "location"]),
    text: z.string().optional(),
    mediaUrl: z.string().optional(),
    mimeType: z.string().optional(),
    fileName: z.string().optional(),
    location: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }),
  
  // Attachments
  attachments: z.array(z.object({
    type: z.string(),
    name: z.string(),
    mimeType: z.string(),
    size: z.number(),
    url: z.string(),
  })).optional(),
  
  // Session context
  sessionId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  
  // Group context (if applicable)
  group: z.object({
    id: z.string(),
    name: z.string().optional(),
  }).optional(),
});

// Task Spec Schema - tasks sent to OpenClaw
const taskSpecSchema = z.object({
  taskType: z.enum(["query", "document", "browser", "skill", "cron", "api"]),
  task: z.record(z.unknown()),
  constraints: z.object({
    maxRuntimeSeconds: z.number().optional(),
    allowedDomains: z.array(z.string()).optional(),
    sandboxLevel: z.enum(["none", "basic", "strict"]).optional(),
  }).optional(),
});

// Task Result Schema - results from OpenClaw
const taskResultSchema = z.object({
  taskId: z.string(),
  status: z.enum(["success", "partial", "failed", "timeout", "rejected"]),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  artifacts: z.array(z.object({
    type: z.enum(["file", "text", "json", "screenshot"]),
    name: z.string(),
    mimeType: z.string(),
    size: z.number(),
    content: z.string().optional(),
    downloadUrl: z.string().optional(),
    hash: z.string(),
  })).optional(),
  provenance: z.object({
    toolsUsed: z.array(z.string()),
    urlsAccessed: z.array(z.string()),
    actionsPerformed: z.array(z.object({
      action: z.string(),
      target: z.string(),
      timestamp: z.string(),
      result: z.enum(["success", "failed"]),
    })),
    logs: z.array(z.string()),
  }).optional(),
  compliance: z.object({
    constraintsRespected: z.boolean(),
    violations: z.array(z.object({
      constraint: z.string(),
      violation: z.string(),
      severity: z.enum(["warning", "error"]),
    })).optional(),
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
  }).optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a 6-digit OTP for channel verification
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a content hash for VATR integrity
 */
function generateContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Check if user has access to a capability
 */
async function checkCapabilityAccess(
  organizationId: number,
  capabilityId: string,
  userId: number
): Promise<{ allowed: boolean; requiresApproval: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) {
    return { allowed: false, requiresApproval: false, reason: "Database not available" };
  }
  
  // Get capability definition
  const [capability] = await db
    .select()
    .from(capabilityRegistry)
    .where(eq(capabilityRegistry.capabilityId, capabilityId))
    .limit(1);
  
  if (!capability || !capability.isActive) {
    return { allowed: false, requiresApproval: false, reason: "Capability not found or inactive" };
  }
  
  // Get org capability settings
  const [orgCapability] = await db
    .select()
    .from(orgCapabilities)
    .where(and(
      eq(orgCapabilities.organizationId, organizationId),
      eq(orgCapabilities.capabilityId, capabilityId)
    ))
    .limit(1);
  
  if (!orgCapability?.enabled) {
    return { allowed: false, requiresApproval: false, reason: "Capability not enabled for organization" };
  }
  
  // Check rate limits
  if (orgCapability.dailyLimit && orgCapability.currentDailyUsage >= orgCapability.dailyLimit) {
    return { allowed: false, requiresApproval: false, reason: "Daily usage limit exceeded" };
  }
  
  // Determine if approval is required
  let requiresApproval = capability.requiresApproval;
  if (orgCapability.approvalPolicy === "always") {
    requiresApproval = true;
  } else if (orgCapability.approvalPolicy === "never") {
    requiresApproval = false;
  }
  
  return { allowed: true, requiresApproval };
}

// ============================================================================
// ROUTER
// ============================================================================

export const openclawRouter = router({
  // ==========================================================================
  // WEBHOOK ENDPOINTS (called by OpenClaw gateway)
  // ==========================================================================
  
  /**
   * Handle incoming message from OpenClaw
   * This is the main entry point for all channel messages
   */
  handleEvent: publicProcedure
    .input(openClawEventSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }
      const startTime = Date.now();
      
      // 1. Resolve channel identity to KIISHA user
      const [channelIdentity] = await db
        .select()
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.channelType, input.channel.type),
          eq(channelIdentities.externalId, input.sender.id),
          eq(channelIdentities.verificationStatus, "verified")
        ))
        .limit(1);
      
      // 2. If no verified identity, initiate verification flow
      if (!channelIdentity) {
        // Check if there's a pending verification
        const [pendingIdentity] = await db
          .select()
          .from(channelIdentities)
          .where(and(
            eq(channelIdentities.channelType, input.channel.type),
            eq(channelIdentities.externalId, input.sender.id),
            eq(channelIdentities.verificationStatus, "pending")
          ))
          .limit(1);
        
        if (pendingIdentity && pendingIdentity.verificationExpires && new Date(pendingIdentity.verificationExpires) > new Date()) {
          return {
            reply: `🔐 Verification pending.\n\nPlease enter the verification code in your KIISHA web portal to link this ${input.channel.type} account.\n\nYour code: ${pendingIdentity.verificationCode}\n\nThis code expires in 10 minutes.`,
            requiresVerification: true,
          };
        }
        
        // No identity found - prompt to link account
        return {
          reply: `👋 Welcome to KIISHA!\n\nTo use KIISHA via ${input.channel.type}, please link your account:\n\n1. Log in to your KIISHA web portal\n2. Go to Settings → Connected Channels\n3. Click "Link ${input.channel.type}"\n4. Enter your ${input.channel.type === "whatsapp" ? "phone number" : "username"}: ${input.sender.id}\n\nOnce linked, you can access your portfolio, documents, and more directly from ${input.channel.type}!`,
          requiresVerification: true,
        };
      }
      
      // 3. Update last used timestamp
      await db
        .update(channelIdentities)
        .set({ lastUsedAt: new Date() })
        .where(eq(channelIdentities.id, channelIdentity.id));
      
      // 4. Load user context
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, channelIdentity.userId))
        .limit(1);
      
      if (!user) {
        return {
          reply: "❌ Your account could not be found. Please contact support.",
          error: "user_not_found",
        };
      }
      
      // 5. Get organization context
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, user.id),
          eq(organizationMembers.organizationId, channelIdentity.organizationId),
          eq(organizationMembers.status, "active")
        ))
        .limit(1);
      
      if (!membership) {
        return {
          reply: "❌ You don't have access to this organization. Please contact your administrator.",
          error: "no_org_access",
        };
      }
      
      // 6. Process the message with AI via the KIISHA AI Gateway
      const messageText = input.content.text || "[Non-text message]";

      // Build skill context for tool execution (org-scoped, no cross-tenant leakage)
      const skillContext: SkillContext = {
        userId: user.id,
        organizationId: channelIdentity.organizationId,
        channelType: input.channel.type,
        channelIdentityId: channelIdentity.id,
        sessionId: input.sessionId,
      };

      // Define available tools for the LLM (mapped to OpenClaw skills)
      const openclawTools: ToolDefinition[] = [
        {
          type: "function",
          function: {
            name: "get_portfolio_summary",
            description: "Get an overview of the user's portfolio including project count, total capacity, and active alerts",
            parameters: {
              type: "object",
              properties: {},
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_projects",
            description: "List projects in the user's organization with status and capacity",
            parameters: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Maximum number of projects to return (default 10)" },
                status: { type: "string", description: "Filter by project status" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_project_details",
            description: "Get detailed information about a specific project including documents and alerts",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "The project ID" },
              },
              required: ["projectId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_document_status",
            description: "Get document verification status for a project (verified, pending, missing counts)",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "The project ID" },
              },
              required: ["projectId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_documents",
            description: "List documents for a project with optional status/category filters",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "The project ID" },
                status: { type: "string", description: "Filter by status (verified, pending, rejected)" },
                limit: { type: "number", description: "Maximum number of documents to return" },
              },
              required: ["projectId"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_alerts",
            description: "List active alerts across the portfolio or for a specific project",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "Optional: filter alerts to a specific project" },
                severity: { type: "string", description: "Filter by severity (critical, high, medium, low)" },
                limit: { type: "number", description: "Maximum number of alerts to return" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "list_tickets",
            description: "List work orders/maintenance tickets",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "Optional: filter to a specific project" },
                status: { type: "string", description: "Filter by status" },
                limit: { type: "number", description: "Maximum number of tickets to return" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "get_compliance_status",
            description: "Get compliance obligation status including upcoming due dates",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "Optional: filter to a specific project" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_ticket",
            description: "Create a new work order/maintenance ticket (requires approval for medium+ risk)",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "number", description: "The project ID" },
                title: { type: "string", description: "Title of the work order" },
                description: { type: "string", description: "Detailed description of the issue" },
                priority: { type: "string", description: "Priority level: low, medium, high, or critical" },
              },
              required: ["projectId", "title", "description", "priority"],
            },
          },
        },
      ];

      // Build conversation messages for the AI gateway
      const systemPrompt = `You are KIISHA, an AI assistant for infrastructure and renewable energy asset management. You are responding via ${input.channel.type}.

You help users with their portfolio, projects, documents, alerts, compliance, and work orders. You have access to tools that fetch real data from the KIISHA platform — always use them to answer questions with actual data.

IMPORTANT RULES:
- Only return data that belongs to this user's organization. Never reference or expose data from other organizations.
- Be concise and professional. Use markdown formatting.
- When the user asks about portfolio, projects, documents, alerts, or compliance — call the appropriate tool.
- If a tool returns an error about capability access, inform the user about the restriction.
- Never fabricate data. If you don't have the information, say so.
- For sensitive operations (creating tickets, acknowledging alerts), explain that approval may be required.

User: ${user.name || "Unknown"} (${membership.role})
Organization ID: ${channelIdentity.organizationId}
Channel: ${input.channel.type}`;

      const aiMessages: AIMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageText },
      ];

      // Execute through the AI gateway with tool calling
      let aiResponse = "";
      const toolsInvoked: string[] = [];
      const dataAccessed: string[] = [];

      try {
        const gatewayResponse = await chatResponse(
          aiMessages,
          openclawTools,
          user.id,
          channelIdentity.organizationId,
          input.channel.type === "whatsapp" ? "whatsapp" :
          input.channel.type === "webchat" ? "web" : "api"
        );

        // Handle tool calls - execute skills and feed results back
        if (gatewayResponse.toolCalls && gatewayResponse.toolCalls.length > 0) {
          const toolResults: AIMessage[] = [...aiMessages];

          // Add assistant message with tool calls
          toolResults.push({
            role: "assistant",
            content: gatewayResponse.content || "",
          });

          for (const toolCall of gatewayResponse.toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);
            toolsInvoked.push(toolCall.function.name);
            let skillResult;

            switch (toolCall.function.name) {
              case "get_portfolio_summary":
                skillResult = await getPortfolioSummary(skillContext);
                dataAccessed.push("portfolios", "projects", "alerts");
                break;
              case "list_projects":
                skillResult = await listProjects(skillContext, args);
                dataAccessed.push("projects");
                break;
              case "get_project_details":
                skillResult = await getProjectDetails(skillContext, args.projectId);
                dataAccessed.push("projects", "documents", "alerts");
                break;
              case "get_document_status":
                skillResult = await getDocumentStatus(skillContext, args.projectId);
                dataAccessed.push("documents", "documentCategories");
                break;
              case "list_documents":
                skillResult = await listDocuments(skillContext, args.projectId, args);
                dataAccessed.push("documents");
                break;
              case "list_alerts":
                skillResult = await listAlerts(skillContext, args);
                dataAccessed.push("alerts");
                break;
              case "list_tickets":
                skillResult = await listTickets(skillContext, args);
                dataAccessed.push("workOrders");
                break;
              case "get_compliance_status":
                skillResult = await getComplianceStatus(skillContext, args.projectId);
                dataAccessed.push("obligations");
                break;
              case "create_ticket":
                skillResult = await createTicket(skillContext, args);
                dataAccessed.push("workOrders");
                break;
              default:
                skillResult = { success: false, error: "Unknown tool" };
            }

            // Feed tool result back as a tool message
            toolResults.push({
              role: "tool",
              content: JSON.stringify({
                success: skillResult.success,
                data: skillResult.data,
                message: skillResult.message,
                error: skillResult.error,
                requiresApproval: skillResult.requiresApproval,
              }),
              tool_call_id: toolCall.id,
            });
          }

          // Get final response with tool results
          const finalResponse = await chatResponse(
            toolResults,
            undefined, // No more tools needed for final response
            user.id,
            channelIdentity.organizationId,
            input.channel.type === "whatsapp" ? "whatsapp" :
            input.channel.type === "webchat" ? "web" : "api"
          );

          aiResponse = finalResponse.content || "I processed your request but couldn't generate a response.";
        } else {
          // No tool calls — direct response
          aiResponse = gatewayResponse.content || "I'm sorry, I couldn't generate a response. Please try again.";
        }
      } catch (error) {
        console.error("[OpenClaw] AI Gateway error:", error);
        // Graceful fallback — never expose internal errors to user
        aiResponse = `I'm currently unable to process your request. Please try again later or use the KIISHA web portal for full access.`;
      }
      
      // 7. Log conversation as VATR
      const vatrId = uuidv4();
      const contentForHash = JSON.stringify({
        userMessage: messageText,
        aiResponse,
        timestamp: new Date().toISOString(),
      });
      const contentHash = generateContentHash(contentForHash);
      
      await db.insert(conversationVatrs).values({
        vatrId,
        organizationId: channelIdentity.organizationId,
        userId: user.id,
        channelIdentityId: channelIdentity.id,
        channelType: input.channel.type,
        externalMessageId: input.eventId,
        sessionId: input.sessionId,
        userMessage: messageText,
        aiResponse,
        attachments: input.attachments ? JSON.stringify(input.attachments) : null,
        toolsInvoked: JSON.stringify(toolsInvoked),
        dataAccessed: JSON.stringify([...new Set(dataAccessed)]),
        capabilitiesUsed: JSON.stringify(["channel." + input.channel.type, ...toolsInvoked.map(t => `skill.${t}`)]),
        contentHash,
        messageReceivedAt: new Date(input.timestamp),
        responseGeneratedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
        metadata: JSON.stringify({
          modelUsed: "ai-gateway",
          toolsInvoked,
          channel: input.channel.type,
        }),
      });
      
      return {
        reply: aiResponse,
        sessionId: input.sessionId || vatrId,
      };
    }),
  
  /**
   * Handle task result from OpenClaw
   */
  handleTaskResult: publicProcedure
    .input(taskResultSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Update task status
      await db
        .update(openclawTasks)
        .set({
          status: input.status,
          completedAt: new Date(input.completedAt),
          result: JSON.stringify({
            status: input.status,
            durationMs: input.durationMs,
            artifacts: input.artifacts,
            provenance: input.provenance,
            compliance: input.compliance,
            error: input.error,
          }),
        })
        .where(eq(openclawTasks.taskId, input.taskId));
      
      return { success: true };
    }),
  
  // ==========================================================================
  // IDENTITY MANAGEMENT
  // ==========================================================================
  
  /**
   * Initiate channel linking (called from KIISHA web portal)
   */
  initiateChannelLink: protectedProcedure
    .input(z.object({
      channelType: z.enum(["whatsapp", "telegram", "slack", "discord", "msteams", "signal", "imessage", "matrix", "googlechat", "webchat"]),
      externalId: z.string().min(1),
      organizationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Verify user has access to the organization
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, ctx.user.id),
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.status, "active")
        ))
        .limit(1);
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this organization",
        });
      }
      
      // Check if already linked
      const [existing] = await db
        .select()
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.channelType, input.channelType),
          eq(channelIdentities.externalId, input.externalId),
          eq(channelIdentities.organizationId, input.organizationId)
        ))
        .limit(1);
      
      if (existing?.verificationStatus === "verified") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This channel is already linked to a user in this organization",
        });
      }
      
      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      if (existing) {
        // Update existing pending record
        await db
          .update(channelIdentities)
          .set({
            userId: ctx.user.id,
            verificationCode: otp,
            verificationExpires: expiresAt,
            verificationMethod: "otp",
          })
          .where(eq(channelIdentities.id, existing.id));
      } else {
        // Create new pending record
        await db.insert(channelIdentities).values({
          userId: ctx.user.id,
          organizationId: input.organizationId,
          channelType: input.channelType,
          externalId: input.externalId,
          verificationStatus: "pending",
          verificationMethod: "otp",
          verificationCode: otp,
          verificationExpires: expiresAt,
        });
      }
      
      return {
        success: true,
        message: `Verification code generated. Send a message from your ${input.channelType} account to KIISHA to complete linking.`,
        expiresAt: expiresAt.toISOString(),
      };
    }),
  
  /**
   * Verify channel link with OTP (called from KIISHA web portal)
   */
  verifyChannelLink: protectedProcedure
    .input(z.object({
      channelType: z.enum(["whatsapp", "telegram", "slack", "discord", "msteams", "signal", "imessage", "matrix", "googlechat", "webchat"]),
      externalId: z.string(),
      organizationId: z.number(),
      code: z.string().length(6),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [identity] = await db
        .select()
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.channelType, input.channelType),
          eq(channelIdentities.externalId, input.externalId),
          eq(channelIdentities.organizationId, input.organizationId),
          eq(channelIdentities.userId, ctx.user.id),
          eq(channelIdentities.verificationStatus, "pending")
        ))
        .limit(1);
      
      if (!identity) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No pending verification found",
        });
      }
      
      if (identity.verificationExpires && new Date(identity.verificationExpires) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification code has expired. Please request a new one.",
        });
      }
      
      if (identity.verificationCode !== input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code",
        });
      }
      
      // Mark as verified
      await db
        .update(channelIdentities)
        .set({
          verificationStatus: "verified",
          verifiedAt: new Date(),
          verificationCode: null,
          verificationExpires: null,
        })
        .where(eq(channelIdentities.id, identity.id));
      
      return {
        success: true,
        message: `Your ${input.channelType} account has been linked successfully!`,
      };
    }),
  
  /**
   * List user's linked channels
   */
  getLinkedChannels: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const channels = await db
        .select({
          id: channelIdentities.id,
          channelType: channelIdentities.channelType,
          externalId: channelIdentities.externalId,
          handle: channelIdentities.handle,
          displayName: channelIdentities.displayName,
          verificationStatus: channelIdentities.verificationStatus,
          verifiedAt: channelIdentities.verifiedAt,
          lastUsedAt: channelIdentities.lastUsedAt,
          notificationsEnabled: channelIdentities.notificationsEnabled,
        })
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.userId, ctx.user.id),
          eq(channelIdentities.organizationId, input.organizationId)
        ))
        .orderBy(desc(channelIdentities.lastUsedAt));
      
      return channels;
    }),
  
  /**
   * Revoke a linked channel
   */
  revokeChannel: protectedProcedure
    .input(z.object({
      channelId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [channel] = await db
        .select()
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.id, input.channelId),
          eq(channelIdentities.userId, ctx.user.id)
        ))
        .limit(1);
      
      if (!channel) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Channel not found",
        });
      }
      
      await db
        .update(channelIdentities)
        .set({
          verificationStatus: "revoked",
          revokedAt: new Date(),
          revokedReason: input.reason || "Revoked by user",
        })
        .where(eq(channelIdentities.id, input.channelId));
      
      return { success: true };
    }),
  
  // ==========================================================================
  // CAPABILITY MANAGEMENT
  // ==========================================================================
  
  /**
   * Get available capabilities for an organization
   */
  getOrgCapabilities: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Get all capabilities with org-specific settings
      const capabilities = await db
        .select({
          capability: capabilityRegistry,
          orgSetting: orgCapabilities,
        })
        .from(capabilityRegistry)
        .leftJoin(
          orgCapabilities,
          and(
            eq(orgCapabilities.capabilityId, capabilityRegistry.capabilityId),
            eq(orgCapabilities.organizationId, input.organizationId)
          )
        )
        .where(eq(capabilityRegistry.isActive, true))
        .orderBy(capabilityRegistry.category, capabilityRegistry.name);
      
      return capabilities.map(({ capability, orgSetting }) => ({
        id: capability.capabilityId,
        name: capability.name,
        description: capability.description,
        category: capability.category,
        riskLevel: capability.riskLevel,
        requiresApproval: orgSetting?.approvalPolicy === "always" || 
          (orgSetting?.approvalPolicy !== "never" && capability.requiresApproval),
        requires2FA: capability.requires2FA,
        requiresAdmin: capability.requiresAdmin,
        enabled: orgSetting?.enabled ?? false,
        dailyLimit: orgSetting?.dailyLimit,
        monthlyLimit: orgSetting?.monthlyLimit,
        currentDailyUsage: orgSetting?.currentDailyUsage ?? 0,
        currentMonthlyUsage: orgSetting?.currentMonthlyUsage ?? 0,
      }));
    }),
  
  /**
   * Enable/disable a capability for an organization (admin only)
   */
  setCapabilityEnabled: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      capabilityId: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Check admin access
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, ctx.user.id),
          eq(organizationMembers.organizationId, input.organizationId),
          eq(organizationMembers.status, "active"),
          eq(organizationMembers.role, "admin")
        ))
        .limit(1);
      
      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only organization admins can manage capabilities",
        });
      }
      
      // Check if org capability exists
      const [existing] = await db
        .select()
        .from(orgCapabilities)
        .where(and(
          eq(orgCapabilities.organizationId, input.organizationId),
          eq(orgCapabilities.capabilityId, input.capabilityId)
        ))
        .limit(1);
      
      if (existing) {
        await db
          .update(orgCapabilities)
          .set({
            enabled: input.enabled,
            enabledBy: input.enabled ? ctx.user.id : null,
            enabledAt: input.enabled ? new Date() : null,
          })
          .where(eq(orgCapabilities.id, existing.id));
      } else {
        await db.insert(orgCapabilities).values({
          organizationId: input.organizationId,
          capabilityId: input.capabilityId,
          enabled: input.enabled,
          enabledBy: input.enabled ? ctx.user.id : null,
          enabledAt: input.enabled ? new Date() : null,
        });
      }
      
      return { success: true };
    }),
  
  // ==========================================================================
  // CONVERSATION HISTORY
  // ==========================================================================
  
  /**
   * Get conversation history for a user
   */
  getConversationHistory: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      channelType: z.enum(["whatsapp", "telegram", "slack", "discord", "msteams", "signal", "imessage", "matrix", "googlechat", "webchat"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const conditions = [
        eq(conversationVatrs.userId, ctx.user.id),
        eq(conversationVatrs.organizationId, input.organizationId),
      ];
      
      if (input.channelType) {
        conditions.push(eq(conversationVatrs.channelType, input.channelType));
      }
      
      if (input.cursor) {
        conditions.push(sql`${conversationVatrs.id} < ${input.cursor}`);
      }
      
      const conversations = await db
        .select({
          id: conversationVatrs.id,
          vatrId: conversationVatrs.vatrId,
          channelType: conversationVatrs.channelType,
          sessionId: conversationVatrs.sessionId,
          userMessage: conversationVatrs.userMessage,
          aiResponse: conversationVatrs.aiResponse,
          messageReceivedAt: conversationVatrs.messageReceivedAt,
          processingTimeMs: conversationVatrs.processingTimeMs,
        })
        .from(conversationVatrs)
        .where(and(...conditions))
        .orderBy(desc(conversationVatrs.id))
        .limit(input.limit + 1);
      
      const hasMore = conversations.length > input.limit;
      const items = hasMore ? conversations.slice(0, -1) : conversations;
      
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),
  
  // ==========================================================================
  // APPROVAL MANAGEMENT
  // ==========================================================================
  
  /**
   * Get pending approvals for a user
   */
  getPendingApprovals: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const approvals = await db
        .select()
        .from(approvalRequests)
        .where(and(
          eq(approvalRequests.organizationId, input.organizationId),
          eq(approvalRequests.requestedBy, ctx.user.id),
          eq(approvalRequests.status, "pending")
        ))
        .orderBy(desc(approvalRequests.requestedAt));
      
      return approvals;
    }),
  
  /**
   * Approve or reject a request
   */
  // Get capabilities (alias for admin page)
  getCapabilities: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const capabilities = await db
        .select()
        .from(orgCapabilities)
        .where(eq(orgCapabilities.organizationId, input.organizationId));
      
      return capabilities;
    }),

  // Initialize capabilities for an organization
  initializeCapabilities: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Default capabilities to seed
      const defaultCapabilities = [
        { id: "kiisha.portfolio.summary", name: "Portfolio Summary", category: "query", risk: "low", description: "View portfolio overview" },
        { id: "kiisha.project.list", name: "List Projects", category: "query", risk: "low", description: "List all projects" },
        { id: "kiisha.project.details", name: "Project Details", category: "query", risk: "low", description: "View project details" },
        { id: "kiisha.documents.status", name: "Document Status", category: "query", risk: "low", description: "Check document status" },
        { id: "kiisha.documents.list", name: "List Documents", category: "query", risk: "low", description: "List project documents" },
        { id: "kiisha.alerts.list", name: "List Alerts", category: "query", risk: "low", description: "View active alerts" },
        { id: "kiisha.tickets.list", name: "List Work Orders", category: "query", risk: "low", description: "View work orders" },
        { id: "kiisha.compliance.status", name: "Compliance Status", category: "query", risk: "low", description: "View compliance status" },
        { id: "kiisha.document.upload", name: "Upload Document", category: "document", risk: "medium", description: "Upload documents" },
        { id: "kiisha.alert.acknowledge", name: "Acknowledge Alert", category: "operation", risk: "medium", description: "Acknowledge alerts" },
        { id: "kiisha.ticket.create", name: "Create Work Order", category: "operation", risk: "medium", description: "Create work orders" },
        { id: "channel.whatsapp", name: "WhatsApp Channel", category: "channel", risk: "low", description: "Access via WhatsApp" },
        { id: "channel.telegram", name: "Telegram Channel", category: "channel", risk: "low", description: "Access via Telegram" },
        { id: "channel.slack", name: "Slack Channel", category: "channel", risk: "low", description: "Access via Slack" },
        { id: "channel.webchat", name: "Web Chat", category: "channel", risk: "low", description: "Access via web chat" },
      ];

      // Insert into capability_registry if not exists
      for (const cap of defaultCapabilities) {
        const [existing] = await db
          .select()
          .from(capabilityRegistry)
          .where(eq(capabilityRegistry.capabilityId, cap.id))
          .limit(1);
        
        if (!existing) {
          await db.insert(capabilityRegistry).values({
            capabilityId: cap.id,
            name: cap.name,
            description: cap.description,
            category: cap.category as any,
            riskLevel: cap.risk as any,
            requiresApproval: cap.risk !== "low",
            isActive: true,
          });
        }
      }

      // Create org capabilities
      for (const cap of defaultCapabilities) {
        const [existing] = await db
          .select()
          .from(orgCapabilities)
          .where(and(
            eq(orgCapabilities.organizationId, input.organizationId),
            eq(orgCapabilities.capabilityId, cap.id)
          ))
          .limit(1);
        
        if (!existing) {
          await db.insert(orgCapabilities).values({
            organizationId: input.organizationId,
            capabilityId: cap.id,
            enabled: cap.risk === "low", // Enable low-risk by default
            enabledBy: ctx.user.id,
            enabledAt: new Date(),
          });
        }
      }

      return { success: true };
    }),

  // Update org capability
  updateOrgCapability: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      capabilityId: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [existing] = await db
        .select()
        .from(orgCapabilities)
        .where(and(
          eq(orgCapabilities.organizationId, input.organizationId),
          eq(orgCapabilities.capabilityId, input.capabilityId)
        ))
        .limit(1);
      
      if (existing) {
        await db
          .update(orgCapabilities)
          .set({
            enabled: input.enabled,
            enabledBy: input.enabled ? ctx.user.id : null,
            enabledAt: input.enabled ? new Date() : null,
          })
          .where(eq(orgCapabilities.id, existing.id));
      } else {
        await db.insert(orgCapabilities).values({
          organizationId: input.organizationId,
          capabilityId: input.capabilityId,
          enabled: input.enabled,
          enabledBy: input.enabled ? ctx.user.id : null,
          enabledAt: input.enabled ? new Date() : null,
        });
      }

      return { success: true };
    }),

  // Get security policy
  getSecurityPolicy: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [policy] = await db
        .select()
        .from(openclawSecurityPolicies)
        .where(eq(openclawSecurityPolicies.organizationId, input.organizationId))
        .limit(1);
      
      return policy || {
        requirePairing: true,
        requireAdminApprovalForNewChannels: true,
        browserAutomationAllowed: false,
        fileUploadAllowed: true,
        globalRateLimitPerMinute: 60,
        globalRateLimitPerDay: 1000,
        auditLevel: "standard",
        retainConversationsForDays: 365,
      };
    }),

  // Update security policy
  updateSecurityPolicy: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
      requirePairing: z.boolean().optional(),
      requireAdminApprovalForNewChannels: z.boolean().optional(),
      browserAutomationAllowed: z.boolean().optional(),
      fileUploadAllowed: z.boolean().optional(),
      globalRateLimitPerMinute: z.number().optional(),
      globalRateLimitPerDay: z.number().optional(),
      auditLevel: z.string().optional(),
      retainConversationsForDays: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const { organizationId, ...updates } = input;
      
      const [existing] = await db
        .select()
        .from(openclawSecurityPolicies)
        .where(eq(openclawSecurityPolicies.organizationId, organizationId))
        .limit(1);
      
      if (existing) {
        await db
          .update(openclawSecurityPolicies)
          .set(updates)
          .where(eq(openclawSecurityPolicies.id, existing.id));
      } else {
        await db.insert(openclawSecurityPolicies).values({
          organizationId,
          ...updates,
        } as any);
      }

      return { success: true };
    }),

  // Get conversation stats
  getConversationStats: protectedProcedure
    .input(z.object({
      organizationId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      // Get total conversations in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const [stats] = await db
        .select({
          totalConversations: sql<number>`COUNT(*)`,
          avgResponseTime: sql<number>`AVG(${conversationVatrs.processingTimeMs})`,
        })
        .from(conversationVatrs)
        .where(and(
          eq(conversationVatrs.organizationId, input.organizationId),
          gte(conversationVatrs.messageReceivedAt, thirtyDaysAgo)
        ));
      
      // Get active users (linked channels)
      const [userStats] = await db
        .select({
          activeUsers: sql<number>`COUNT(DISTINCT ${channelIdentities.userId})`,
        })
        .from(channelIdentities)
        .where(and(
          eq(channelIdentities.organizationId, input.organizationId),
          eq(channelIdentities.verificationStatus, "verified")
        ));
      
      return {
        totalConversations: stats?.totalConversations || 0,
        avgResponseTime: Math.round(stats?.avgResponseTime || 0),
        activeUsers: userStats?.activeUsers || 0,
      };
    }),

  // Process approval (for admin page)
  processApproval: protectedProcedure
    .input(z.object({
      requestId: z.string(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.requestId, input.requestId))
        .limit(1);
      
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval request not found",
        });
      }
      
      await db
        .update(approvalRequests)
        .set({
          status: input.action === "approve" ? "approved" : "rejected",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          approvalMethod: "web",
          rejectionReason: input.action === "reject" ? input.reason : null,
        })
        .where(eq(approvalRequests.id, request.id));
      
      return { success: true };
    }),

  respondToApproval: protectedProcedure
    .input(z.object({
      requestId: z.string(),
      action: z.enum(["approve", "reject"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" }); }
      const [request] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.requestId, input.requestId))
        .limit(1);
      
      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval request not found",
        });
      }
      
      if (request.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been processed",
        });
      }
      
      // Verify user can approve (must be the requester or an admin)
      const [membership] = await db
        .select()
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, ctx.user.id),
          eq(organizationMembers.organizationId, request.organizationId),
          eq(organizationMembers.status, "active")
        ))
        .limit(1);
      
      if (!membership || (request.requestedBy !== ctx.user.id && membership.role !== "admin")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to respond to this request",
        });
      }
      
      await db
        .update(approvalRequests)
        .set({
          status: input.action === "approve" ? "approved" : "rejected",
          approvedBy: ctx.user.id,
          approvedAt: new Date(),
          approvalMethod: "web",
          rejectionReason: input.action === "reject" ? input.reason : null,
        })
        .where(eq(approvalRequests.id, request.id));
      
      return { success: true };
    }),
});
