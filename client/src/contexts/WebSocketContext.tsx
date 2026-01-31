import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";

// Event types matching the database schema
export type RealtimeEventType =
  | "document_uploaded"
  | "document_verified"
  | "document_rejected"
  | "rfi_created"
  | "rfi_updated"
  | "rfi_resolved"
  | "alert_triggered"
  | "alert_acknowledged"
  | "alert_resolved"
  | "checklist_item_completed"
  | "checklist_completed"
  | "user_joined"
  | "user_left";

export interface RealtimeEvent {
  id: number;
  eventType: RealtimeEventType;
  payload: Record<string, unknown>;
  actorId?: number;
  actorName?: string;
  targetId?: number;
  targetType?: string;
  projectId?: number;
  projectName?: string;
  createdAt: string;
}

interface WebSocketContextValue {
  isConnected: boolean;
  events: RealtimeEvent[];
  subscribe: (eventType: RealtimeEventType | "all", callback: (event: RealtimeEvent) => void) => () => void;
  clearEvents: () => void;
  onlineUsers: { id: number; name: string; avatar?: string }[];
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Event display configuration
const eventConfig: Record<RealtimeEventType, { icon: string; color: string; getMessage: (e: RealtimeEvent) => string }> = {
  document_uploaded: {
    icon: "📄",
    color: "var(--color-semantic-info)",
    getMessage: (e) => `${e.actorName || "Someone"} uploaded a document${e.projectName ? ` to ${e.projectName}` : ""}`,
  },
  document_verified: {
    icon: "✅",
    color: "var(--color-semantic-success)",
    getMessage: (e) => `Document verified${e.projectName ? ` in ${e.projectName}` : ""}`,
  },
  document_rejected: {
    icon: "❌",
    color: "var(--color-semantic-error)",
    getMessage: (e) => `Document rejected${e.projectName ? ` in ${e.projectName}` : ""}`,
  },
  rfi_created: {
    icon: "📝",
    color: "var(--color-semantic-warning)",
    getMessage: (e) => `New RFI created${e.projectName ? ` for ${e.projectName}` : ""}`,
  },
  rfi_updated: {
    icon: "🔄",
    color: "var(--color-semantic-info)",
    getMessage: (e) => `RFI updated${e.projectName ? ` in ${e.projectName}` : ""}`,
  },
  rfi_resolved: {
    icon: "✔️",
    color: "var(--color-semantic-success)",
    getMessage: (e) => `RFI resolved${e.projectName ? ` in ${e.projectName}` : ""}`,
  },
  alert_triggered: {
    icon: "🚨",
    color: "var(--color-semantic-error)",
    getMessage: (e) => `Alert triggered: ${(e.payload as { message?: string })?.message || "Check dashboard"}`,
  },
  alert_acknowledged: {
    icon: "👁️",
    color: "var(--color-semantic-warning)",
    getMessage: (e) => `${e.actorName || "Someone"} acknowledged an alert`,
  },
  alert_resolved: {
    icon: "✅",
    color: "var(--color-semantic-success)",
    getMessage: (e) => `Alert resolved${e.actorName ? ` by ${e.actorName}` : ""}`,
  },
  checklist_item_completed: {
    icon: "☑️",
    color: "var(--color-semantic-success)",
    getMessage: (e) => `Checklist item completed${e.projectName ? ` in ${e.projectName}` : ""}`,
  },
  checklist_completed: {
    icon: "🎉",
    color: "var(--color-semantic-success)",
    getMessage: (e) => `Checklist completed${e.projectName ? ` for ${e.projectName}` : ""}`,
  },
  user_joined: {
    icon: "👋",
    color: "var(--color-semantic-info)",
    getMessage: (e) => `${e.actorName || "Someone"} joined the workspace`,
  },
  user_left: {
    icon: "👋",
    color: "var(--color-text-tertiary)",
    getMessage: (e) => `${e.actorName || "Someone"} left the workspace`,
  },
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ id: number; name: string; avatar?: string }[]>([]);
  const [subscribers, setSubscribers] = useState<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map());

  // Simulate WebSocket connection (in production, this would be a real Socket.IO connection)
  useEffect(() => {
    // Simulate connection delay
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
    }, 1000);

    // Simulate receiving events periodically (for demo purposes)
    const eventInterval = setInterval(() => {
      // Only simulate events occasionally (10% chance every 30 seconds)
      if (Math.random() < 0.1) {
        const eventTypes: RealtimeEventType[] = [
          "document_uploaded",
          "rfi_created",
          "rfi_resolved",
          "checklist_item_completed",
        ];
        const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const mockEvent: RealtimeEvent = {
          id: Date.now(),
          eventType: randomType,
          payload: {},
          actorName: "Team Member",
          projectName: "Sample Project",
          createdAt: new Date().toISOString(),
        };

        handleNewEvent(mockEvent);
      }
    }, 30000);

    // Simulate online users
    setOnlineUsers([
      { id: 1, name: "Solomon Ojoawo" },
      { id: 2, name: "Sarah Chen" },
    ]);

    return () => {
      clearTimeout(connectTimer);
      clearInterval(eventInterval);
      setIsConnected(false);
    };
  }, []);

  const handleNewEvent = useCallback((event: RealtimeEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 50)); // Keep last 50 events

    // Notify subscribers
    const allSubscribers = subscribers.get("all") || new Set();
    const typeSubscribers = subscribers.get(event.eventType) || new Set();

    [...Array.from(allSubscribers), ...Array.from(typeSubscribers)].forEach((callback) => {
      callback(event);
    });

    // Show toast notification for important events
    const config = eventConfig[event.eventType];
    if (config && ["alert_triggered", "document_uploaded", "rfi_created"].includes(event.eventType)) {
      toast(config.getMessage(event), {
        icon: config.icon,
      });
    }
  }, [subscribers]);

  const subscribe = useCallback(
    (eventType: RealtimeEventType | "all", callback: (event: RealtimeEvent) => void) => {
      setSubscribers((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(eventType) || new Set();
        existing.add(callback);
        newMap.set(eventType, existing);
        return newMap;
      });

      // Return unsubscribe function
      return () => {
        setSubscribers((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(eventType);
          if (existing) {
            existing.delete(callback);
            if (existing.size === 0) {
              newMap.delete(eventType);
            }
          }
          return newMap;
        });
      };
    },
    []
  );

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        events,
        subscribe,
        clearEvents,
        onlineUsers,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

// Hook for subscribing to specific event types
export function useRealtimeEvents(
  eventType: RealtimeEventType | "all",
  callback: (event: RealtimeEvent) => void
) {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, callback);
    return unsubscribe;
  }, [eventType, callback, subscribe]);
}

// Export event config for use in UI
export { eventConfig };
