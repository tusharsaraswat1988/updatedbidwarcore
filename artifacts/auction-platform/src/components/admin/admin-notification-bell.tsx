import { useState } from "react";
import { Link } from "wouter";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTimestamp } from "@/lib/format-relative-time";
import { priorityBadgeClass } from "@/lib/admin-notifications";
import { getNotificationCategoryIcon } from "@/lib/admin-notification-icons";
import { useAdminNotifications } from "@/contexts/admin-notification-context";

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    recentItems,
    unreadCount,
    loadingRecent,
    markAllRead,
    openNotification,
    connectionStatus,
  } = useAdminNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className={`h-5 w-5 ${connectionStatus === "connected" ? "" : "opacity-80"}`} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-in zoom-in items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground duration-200">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
              {connectionStatus === "connected" ? " · Live" : connectionStatus === "reconnecting" ? " · Reconnecting…" : ""}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void markAllRead()}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {loadingRecent && recentItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : recentItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet</p>
          ) : (
            recentItems.map((item) => {
              const CategoryIcon = getNotificationCategoryIcon(item.category);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    openNotification(item);
                    setOpen(false);
                  }}
                  className={`flex w-full flex-col gap-1 border-b border-border/60 px-4 py-3 text-left transition hover:bg-accent/40 ${
                    !item.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <CategoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className={`text-sm font-medium ${!item.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.title}
                      </span>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${priorityBadgeClass(item.priority)}`}>
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 pl-6 text-xs text-muted-foreground">{item.message}</p>
                  <span className="pl-6 text-[11px] text-muted-foreground/80">
                    {formatRelativeTimestamp(item.createdAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" className="w-full justify-center text-sm" asChild>
            <Link href="/admin/notifications" onClick={() => setOpen(false)}>
              View all notifications
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
