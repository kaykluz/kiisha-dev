/**
 * KIISHA Bridge - OpenClaw Extension
 * 
 * This extension connects OpenClaw to the KIISHA platform, enabling:
 * - Multi-channel access to KIISHA data (WhatsApp, Telegram, Slack, etc.)
 * - Identity verification and mapping
 * - Capability-based access control
 * - VATR-compliant conversation logging
 * 
 * Architecture principle: "OpenClaw executes. KIISHA authorizes."
 */

import type { OpenClawPluginApi, OpenClawPluginService } from "./types.js";
import { KiishaClient } from "./client.js";
import { createKiishaSkills } from "./skills/index.js";

// Plugin configuration interface
export interface KiishaBridgeConfig {
  kiishaApiUrl: string;
  kiishaApiKey: string;
  webhookSecret: string;
}

// Runtime reference
let kiishaClient: KiishaClient | null = null;

/**
 * Get the KIISHA client instance
 */
export function getKiishaClient(): KiishaClient {
  if (!kiishaClient) {
    throw new Error("KIISHA Bridge not initialized. Call plugin.register() first.");
  }
  return kiishaClient;
}

/**
 * KIISHA Bridge Plugin
 */
const plugin: OpenClawPluginService<KiishaBridgeConfig> = {
  id: "kiisha-bridge",
  name: "KIISHA Bridge",
  description: "Connect OpenClaw to KIISHA platform for enterprise asset management",
  
  configSchema: {
    type: "object",
    properties: {
      kiishaApiUrl: {
        type: "string",
        description: "KIISHA API endpoint URL",
      },
      kiishaApiKey: {
        type: "string",
        description: "KIISHA API key for authentication",
      },
      webhookSecret: {
        type: "string",
        description: "Shared secret for webhook verification",
      },
    },
    required: ["kiishaApiUrl", "kiishaApiKey", "webhookSecret"],
  },
  
  register(api: OpenClawPluginApi, config: KiishaBridgeConfig) {
    console.log("[KIISHA Bridge] Initializing...");
    
    // Initialize KIISHA client
    kiishaClient = new KiishaClient({
      apiUrl: config.kiishaApiUrl,
      apiKey: config.kiishaApiKey,
      webhookSecret: config.webhookSecret,
    });
    
    // Register KIISHA skills
    const skills = createKiishaSkills(kiishaClient);
    for (const skill of skills) {
      api.registerSkill(skill);
    }
    
    // Register message handler for incoming messages
    api.onMessage(async (message, context) => {
      try {
        // Forward message to KIISHA for processing
        const response = await kiishaClient!.handleMessage({
          eventId: message.id,
          timestamp: message.timestamp,
          channel: {
            type: context.channel.type,
            accountId: context.channel.accountId,
          },
          sender: {
            id: message.sender.id,
            handle: message.sender.handle,
            displayName: message.sender.displayName,
          },
          content: {
            type: message.type,
            text: message.text,
            mediaUrl: message.mediaUrl,
            mimeType: message.mimeType,
            fileName: message.fileName,
          },
          attachments: message.attachments,
          sessionId: context.sessionId,
          replyToMessageId: message.replyToId,
          group: context.group,
        });
        
        return {
          reply: response.reply,
          sessionId: response.sessionId,
        };
      } catch (error) {
        console.error("[KIISHA Bridge] Error handling message:", error);
        return {
          reply: "I'm having trouble connecting to KIISHA. Please try again in a moment.",
          error: true,
        };
      }
    });
    
    console.log("[KIISHA Bridge] Initialized successfully");
  },
};

export default plugin;
