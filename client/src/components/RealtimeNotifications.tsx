import { useState } from "react";
import { useWebSocket, eventConfig, RealtimeEvent } from "@/contexts/WebSocketContext";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Circle, Trash2, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function RealtimeNotifications() {
  const { isConnected, events, clearEvents, onlineUsers } = useWebSocket();
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = events.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-semantic-error)] text-white text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {/* Connection indicator */}
          <span
            className={cn(
              "absolute bottom-0 right-0 w-2 h-2 rounded-full border border-[var(--color-bg-surface)]",
              isConnected ? "bg-[var(--color-semantic-success)]" : "bg-[var(--color-text-tertiary)]"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-96 p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--color-text-primary)]">Notifications</h3>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {isConnected ? "Live" : "Connecting..."}
            </span>
          </div>
          {events.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearEvents}
                className="h-7 px-2 text-xs"
              >
                <CheckCheck className="w-3 h-3 mr-1" />
                Clear all
              </Button>
            </div>
          )}
        </div>

        {/* Online Users */}
        {onlineUsers.length > 0 && (
          <div className="px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface-hover)]">
            <div className="flex items-center gap-2">
              <Circle className="w-2 h-2 fill-[var(--color-semantic-success)] text-[var(--color-semantic-success)]" />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {onlineUsers.length} online: {onlineUsers.map(u => u.name.split(" ")[0]).join(", ")}
              </span>
            </div>
          </div>
        )}

        {/* Events List */}
        <ScrollArea className="h-80">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Bell className="w-10 h-10 text-[var(--color-text-tertiary)] mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">No new notifications</p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                Updates will appear here in real-time
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {events.map((event) => (
                <NotificationItem key={event.id} event={event} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({ event }: { event: RealtimeEvent }) {
  const config = eventConfig[event.eventType];

  return (
    <div className="px-4 py-3 hover:bg-[var(--color-bg-surface-hover)] transition-colors cursor-pointer">
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-primary)]">
            {config.getMessage(event)}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
