/**
 * KIISHA Client
 * 
 * Handles communication between OpenClaw and KIISHA platform
 */

import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import type { KiishaEvent, KiishaResponse, TaskSpec, TaskResult } from "./types.js";

export interface KiishaClientConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
}

export class KiishaClient {
  private client: AxiosInstance;
  private config: KiishaClientConfig;
  
  constructor(config: KiishaClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      timeout: 30000,
    });
  }
  
  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: string): string {
    return crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(payload)
      .digest("hex");
  }
  
  /**
   * Handle incoming message from OpenClaw
   */
  async handleMessage(event: KiishaEvent): Promise<KiishaResponse> {
    const payload = JSON.stringify(event);
    const signature = this.generateSignature(payload);
    
    try {
      const response = await this.client.post<KiishaResponse>(
        "/api/trpc/openclaw.handleEvent",
        { json: event },
        {
          headers: {
            "X-Webhook-Signature": signature,
          },
        }
      );
      
      return response.data;
    } catch (error) {
      console.error("[KIISHA Client] Error handling message:", error);
      throw error;
    }
  }
  
  /**
   * Submit task result to KIISHA
   */
  async submitTaskResult(result: TaskResult): Promise<void> {
    const payload = JSON.stringify(result);
    const signature = this.generateSignature(payload);
    
    try {
      await this.client.post(
        "/api/trpc/openclaw.handleTaskResult",
        { json: result },
        {
          headers: {
            "X-Webhook-Signature": signature,
          },
        }
      );
    } catch (error) {
      console.error("[KIISHA Client] Error submitting task result:", error);
      throw error;
    }
  }
  
  /**
   * Get portfolio summary for a user
   */
  async getPortfolioSummary(userId: number, organizationId: number): Promise<{
    portfolios: number;
    projects: number;
    totalCapacity: number;
    activeAlerts: number;
  }> {
    try {
      const response = await this.client.get("/api/trpc/openclaw.getPortfolioSummary", {
        params: {
          input: JSON.stringify({ userId, organizationId }),
        },
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error getting portfolio summary:", error);
      throw error;
    }
  }
  
  /**
   * List projects for a user
   */
  async listProjects(userId: number, organizationId: number, limit = 10): Promise<Array<{
    id: number;
    name: string;
    status: string;
    capacity?: number;
  }>> {
    try {
      const response = await this.client.get("/api/trpc/openclaw.listProjects", {
        params: {
          input: JSON.stringify({ userId, organizationId, limit }),
        },
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error listing projects:", error);
      throw error;
    }
  }
  
  /**
   * Get document status for a project
   */
  async getDocumentStatus(projectId: number, organizationId: number): Promise<{
    total: number;
    verified: number;
    pending: number;
    missing: number;
    categories: Array<{
      name: string;
      status: string;
      count: number;
    }>;
  }> {
    try {
      const response = await this.client.get("/api/trpc/openclaw.getDocumentStatus", {
        params: {
          input: JSON.stringify({ projectId, organizationId }),
        },
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error getting document status:", error);
      throw error;
    }
  }
  
  /**
   * Get active alerts
   */
  async getAlerts(organizationId: number, limit = 10): Promise<Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    projectName?: string;
    createdAt: string;
  }>> {
    try {
      const response = await this.client.get("/api/trpc/openclaw.getAlerts", {
        params: {
          input: JSON.stringify({ organizationId, limit }),
        },
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error getting alerts:", error);
      throw error;
    }
  }
  
  /**
   * Create a work order/ticket
   */
  async createTicket(params: {
    organizationId: number;
    projectId: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "critical";
    assigneeId?: number;
    createdBy: number;
  }): Promise<{ ticketId: number; ticketNumber: string }> {
    try {
      const response = await this.client.post("/api/trpc/openclaw.createTicket", {
        json: params,
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error creating ticket:", error);
      throw error;
    }
  }
  
  /**
   * Upload a document
   */
  async uploadDocument(params: {
    organizationId: number;
    projectId: number;
    categoryId?: number;
    fileName: string;
    mimeType: string;
    fileUrl: string;
    uploadedBy: number;
    metadata?: Record<string, unknown>;
  }): Promise<{ documentId: number; status: string }> {
    try {
      const response = await this.client.post("/api/trpc/openclaw.uploadDocument", {
        json: params,
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error uploading document:", error);
      throw error;
    }
  }
  
  /**
   * Verify channel identity
   */
  async verifyIdentity(params: {
    channelType: string;
    externalId: string;
    organizationId: number;
    verificationCode: string;
  }): Promise<{ verified: boolean; userId?: number; error?: string }> {
    try {
      const response = await this.client.post("/api/trpc/openclaw.verifyChannelLink", {
        json: params,
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error verifying identity:", error);
      throw error;
    }
  }
  
  /**
   * Check capability access
   */
  async checkCapability(params: {
    organizationId: number;
    userId: number;
    capabilityId: string;
  }): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
  }> {
    try {
      const response = await this.client.get("/api/trpc/openclaw.checkCapability", {
        params: {
          input: JSON.stringify(params),
        },
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error checking capability:", error);
      throw error;
    }
  }
  
  /**
   * Request approval for a sensitive action
   */
  async requestApproval(params: {
    organizationId: number;
    userId: number;
    capabilityId: string;
    summary: string;
    taskSpec: Record<string, unknown>;
  }): Promise<{ requestId: string; status: string }> {
    try {
      const response = await this.client.post("/api/trpc/openclaw.requestApproval", {
        json: params,
      });
      return response.data.result.data;
    } catch (error) {
      console.error("[KIISHA Client] Error requesting approval:", error);
      throw error;
    }
  }
}
