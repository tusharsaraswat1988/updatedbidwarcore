import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTimestamp } from "@/lib/format-relative-time";
import type { AdminNotificationItem, AdminNotificationListResponse } from "@/lib/admin-notifications";
import { notificationMatchesFilters, priorityBadgeClass, priorityLabel } from "@/lib/admin-notifications";
import { getNotificationCategoryIcon } from "@/lib/admin-notification-icons";
import { useAdminNotifications } from "@/contexts/admin-notification-context";

export default function AdminAdminNotificationsPage() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const { markRead: markReadLive, markAllRead: markAllReadLive, subscribeToLiveNotifications, openNotification } =
    useAdminNotifications();
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        priority: priorityFilter,
        read: readFilter,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/auth/admin/admin-notifications?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as AdminNotificationListResponse;
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [page, priorityFilter, readFilter, search]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void fetchNotifications();
  }, [isLoggedIn, fetchNotifications]);

  useEffect(() => {
    return subscribeToLiveNotifications(({ notification }) => {
      if (page !== 1) return;
      if (!notificationMatchesFilters(notification, { priority: priorityFilter, read: readFilter, search })) {
        return;
      }
      setItems((prev) => {
        if (prev.some((item) => item.id === notification.id)) return prev;
        return [notification, ...prev].slice(0, 20);
      });
      setTotal((t) => t + 1);
    });
  }, [page, priorityFilter, readFilter, search, subscribeToLiveNotifications]);

  async function markRead(id: number) {
    await markReadLive(id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  }

  async function markAllRead() {
    await markAllReadLive();
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }

  async function bulkMarkRead() {
    if (selected.size === 0) return;
    await fetch("/api/auth/admin/admin-notifications/bulk-read", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    void fetchNotifications();
  }

  async function deleteNotification(id: number) {
    await fetch(`/api/auth/admin/admin-notifications/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    void fetchNotifications();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.id)));
    }
  }

  function openItem(item: AdminNotificationItem) {
    openNotification(item);
    setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, isRead: true } : row)));
  }

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Notifications"
      eyebrow="Admin Inbox"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchNotifications()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck className="mr-1.5 h-4 w-4" />
            Mark all read
          </Button>
          {selected.size > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void bulkMarkRead()}>
              Mark {selected.size} read
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search notifications…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
            />
          </div>
          <Select value={priorityFilter} onValueChange={(v) => { setPage(1); setPriorityFilter(v); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={readFilter} onValueChange={(v) => { setPage(1); setReadFilter(v); }}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            Apply
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications match your filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={items.length > 0 && selected.size === items.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Notification</TableHead>
                    <TableHead className="hidden sm:table-cell">Priority</TableHead>
                    <TableHead className="hidden md:table-cell">Time</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const CategoryIcon = getNotificationCategoryIcon(item.category);
                    return (
                    <TableRow
                      key={item.id}
                      className={!item.isRead ? "bg-primary/5" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select notification ${item.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => openItem(item)}
                        >
                          <div className="flex items-center gap-2">
                            {!item.isRead && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                            )}
                            <CategoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className={`font-medium ${!item.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                              {item.title}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.message}</p>
                          <div className="mt-1 sm:hidden">
                            <Badge variant="outline" className={`text-[10px] ${priorityBadgeClass(item.priority)}`}>
                              {priorityLabel(item.priority)}
                            </Badge>
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {formatRelativeTimestamp(item.createdAt)}
                            </span>
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={`text-[10px] ${priorityBadgeClass(item.priority)}`}>
                          {priorityLabel(item.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {formatRelativeTimestamp(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!item.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Mark as read"
                              onClick={() => void markRead(item.id)}
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => void deleteNotification(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} notification{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="flex items-center px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
