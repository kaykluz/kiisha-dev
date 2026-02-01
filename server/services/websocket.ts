import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import { getDb } from "../db";
import { notifications } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Notification types
export type NotificationType = 
  | "response_submitted"
  | "response_approved"
  | "response_rejected"
  | "response_revision_requested"
  | "update_pushed"
  | "update_accepted"
  | "update_rejected"
  | "document_uploaded"
  | "comment_added"
  | "share_created";

export interface NotificationPayload {
  id?: number;
  type: NotificationType;
  title: string;
  message: string;
  userId: number;
  organizationId: number;
  entityType?: string;
  entityId?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  read?: boolean;
}

// Store active connections
const userConnections = new Map<number, Set<Socket>>();

let io: SocketServer | null = null;

export function initializeWebSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/api/ws"
  });

  io.on("connection", (socket: Socket) => {
    console.log("[WebSocket] Client connected:", socket.id);

    // Handle user authentication
    socket.on("authenticate", (data: { userId: number; organizationId: number }) => {
      const { userId, organizationId } = data;
      
      // Store connection
      if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
      }
      userConnections.get(userId)?.add(socket);
      
      // Join organization room
      socket.join(`org:${organizationId}`);
      socket.join(`user:${userId}`);
      
      console.log(`[WebSocket] User ${userId} authenticated, org ${organizationId}`);
      
      socket.emit("authenticated", { success: true });
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("[WebSocket] Client disconnected:", socket.id);
      
      // Remove from all user connections
      userConnections.forEach((sockets, userId) => {
        if (sockets.has(socket)) {
          sockets.delete(socket);
          if (sockets.size === 0) {
            userConnections.delete(userId);
          }
        }
      });
    });

    // Handle mark as read
    socket.on("markAsRead", async (data: { notificationId: number }) => {
      try {
        const db = await getDb();
        if (!db) return;
        await db.update(notifications)
          .set({ read: true, readAt: new Date() })
          .where(eq(notifications.id, data.notificationId));
        
        socket.emit("notificationRead", { id: data.notificationId });
      } catch (error) {
        console.error("[WebSocket] Error marking notification as read:", error);
      }
    });

    // Handle mark all as read
    socket.on("markAllAsRead", async (data: { userId: number }) => {
      try {
        const db = await getDb();
        if (!db) return;
        await db.update(notifications)
          .set({ read: true, readAt: new Date() })
          .where(eq(notifications.userId, data.userId));
        
        socket.emit("allNotificationsRead", { success: true });
      } catch (error) {
        console.error("[WebSocket] Error marking all notifications as read:", error);
      }
    });
  });

  return io;
}

// Send notification to specific user
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    // Save to database
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const [saved] = await db.insert(notifications).values({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      userId: payload.userId,
      organizationId: payload.organizationId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      read: false,
      createdAt: new Date()
    }).$returningId();

    const notification = {
      ...payload,
      id: saved.id,
      createdAt: new Date(),
      read: false
    };

    // Send via WebSocket
    if (io) {
      io.to(`user:${payload.userId}`).emit("notification", notification);
    }

    console.log(`[WebSocket] Notification sent to user ${payload.userId}:`, payload.title);
  } catch (error) {
    console.error("[WebSocket] Error sending notification:", error);
  }
}

// Send notification to all users in an organization
export async function sendOrganizationNotification(
  organizationId: number,
  payload: Omit<NotificationPayload, "userId" | "organizationId">
): Promise<void> {
  if (io) {
    io.to(`org:${organizationId}`).emit("notification", {
      ...payload,
      organizationId,
      createdAt: new Date(),
      read: false
    });
  }
}

// Broadcast to all connected clients
export function broadcast(event: string, data: any): void {
  if (io) {
    io.emit(event, data);
  }
}

// Get WebSocket server instance
export function getIO(): SocketServer | null {
  return io;
}
