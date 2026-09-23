import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Zap,
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
import {
  buildInquiryWhatsAppMessage,
  buildLicenseRequestWhatsAppMessage,
  buildWhatsAppLink,
  notificationMatchesFilters,
  priorityBadgeClass,
  priorityLabel,
} from "@/lib/admin-notifications";
import { getNotificationCategoryIcon } from "@/lib/admin-notification-icons";
import { useAdminNotifications } from "@/contexts/admin-notification-context";
import { AdminPaymentVerificationModal } from "@/components/admin/admin-payment-verification-modal";

export default function AdminAdminNotificationsPage() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const {
    markRead: markReadLive,
    markAllRead: markAllReadLive,
    resolveNotification: resolveNotificationLive,
    subscribeToLiveNotifications,
    openNotification,
  } = useAdminNotifications();

  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [actionRequiredCount, setActionRequiredCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [tabFilter, setTabFilter] = useState<"all" | "action_required" | "activity">("all");
  const [resolutionFilter, setResolutionFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [readFilter, setReadFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [grantModalItem, setGrantModalItem] = useState<AdminNotificationItem | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        tab: tabFilter,
        priority: priorityFilter,
        read: readFilter,
        resolutionStatus: resolutionFilter,
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/auth/admin/admin-notifications?${params}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as AdminNotificationListResponse;
      setItems(data.items);
      setTotal(data.total);
      setActionRequiredCount(data.actionRequiredCount ?? 0);
      setTotalPages(data.totalPages);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }, [page, tabFilter, priorityFilter, readFilter, resolutionFilter, search]);

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

  async function resolveNotification(id: number) {
    await resolveNotificationLive(id);
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, isRead: true, resolutionStatus: "resolved", resolvedAt: new Date().toISOString() }
          : item,
      ),
    );
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

  async function bulkResolve() {
    if (selected.size === 0) return;
    await fetch("/api/auth/admin/admin-notifications/bulk-resolve", {
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
      title="Notifications Inbox"
      eyebrow="Operations &amp; Alerts"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchNotifications()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => void markAllRead()} className="gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            Mark All Read
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Segmented Tab Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setTabFilter("all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tabFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              All Notifications ({total})
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setTabFilter("action_required");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                tabFilter === "action_required"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Action Required
              {actionRequiredCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {actionRequiredCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setTabFilter("activity");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                tabFilter === "activity"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              Activity Feed
            </button>
          </div>

          {/* Bulk action buttons */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in">
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-400" onClick={() => void bulkResolve()}>
                <Check className="h-3 w-3" />
                Resolve Selected
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void bulkMarkRead()}>
                Mark Read
              </Button>
            </div>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
          <div className="relative md:col-span-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, message, organizer..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              className="pl-8 text-xs"
            />
          </div>

          <Select value={resolutionFilter} onValueChange={(v) => { setPage(1); setResolutionFilter(v); }}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Resolution" />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="all">All Resolutions</SelectItem>
              <SelectItem value="pending">Pending Action</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v) => { setPage(1); setPriorityFilter(v); }}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>

          <Select value={readFilter} onValueChange={(v) => { setPage(1); setReadFilter(v); }}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Read Status" />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value="all">All Read Status</SelectItem>
              <SelectItem value="unread">Unread Only</SelectItem>
              <SelectItem value="read">Read Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table List */}
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
                <p className="text-sm font-semibold text-foreground">No notifications found</p>
                <p className="text-xs text-muted-foreground">Try clearing or adjusting your search &amp; filters.</p>
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
                    <TableHead>Notification Details</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Time</TableHead>
                    <TableHead className="text-right">Interactive Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const CategoryIcon = getNotificationCategoryIcon(item.category);
                    const isLicenseReq = item.type === "LICENSE_REQUESTED";
                    const isInquiry = item.type === "CONTACT_FORM_SUBMISSION";
                    const isPending = item.resolutionStatus === "pending";
                    const meta = item.actionMetadata || item.metadata || {};
                    const orgMobile = (meta.organizerMobile as string) || (meta.mobile as string) || "";
                    const inquiryEmail = (meta.email as string) || "";

                    return (
                      <TableRow
                        key={item.id}
                        className={
                          isLicenseReq && isPending
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : !item.isRead
                              ? "bg-primary/5 hover:bg-primary/10"
                              : undefined
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleSelect(item.id)}
                            aria-label={`Select notification ${item.id}`}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {!item.isRead && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                              )}
                              <CategoryIcon className={`h-4 w-4 shrink-0 ${isLicenseReq ? "text-amber-400" : "text-muted-foreground"}`} />
                              <span className={`font-semibold text-xs sm:text-sm ${!item.isRead ? "text-foreground" : "text-foreground/90"}`}>
                                {item.title}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-1 items-start">
                            {item.resolutionStatus === "resolved" ? (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold">
                                Resolved ✓
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold">
                                Pending Action
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-[10px] ${priorityBadgeClass(item.priority)}`}>
                              {priorityLabel(item.priority)}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {formatRelativeTimestamp(item.createdAt)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* WhatsApp Quick Link */}
                            {orgMobile && (
                              <a
                                href={buildWhatsAppLink(
                                  orgMobile,
                                  isLicenseReq
                                    ? buildLicenseRequestWhatsAppMessage(item)
                                    : buildInquiryWhatsAppMessage(item),
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition shadow-sm"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="h-3 w-3" />
                                WhatsApp
                              </a>
                            )}

                            {/* Email link for contact */}
                            {isInquiry && inquiryEmail && (
                              <a
                                href={`mailto:${inquiryEmail}?subject=Re: ${encodeURIComponent((meta.subject as string) || "BidWar Inquiry")}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition shadow-sm"
                              >
                                <Mail className="h-3 w-3" />
                                Email
                              </a>
                            )}

                            {/* License Request: Verify & Grant Modal Button */}
                            {isLicenseReq && isPending && (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs font-bold gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
                                onClick={() => {
                                  setGrantModalItem(item);
                                }}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Verify &amp; Grant
                              </Button>
                            )}

                            {/* Resolve button */}
                            {isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => void resolveNotification(item.id)}
                                title="Mark as resolved"
                              >
                                <Check className="h-3.5 w-3.5 mr-0.5 text-emerald-400" />
                                Resolve
                              </Button>
                            )}

                            {/* View details */}
                            {item.actionUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => openItem(item)}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-0.5" />
                                View
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Delete"
                              aria-label="Delete notification"
                              onClick={() => void deleteNotification(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
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
              <span className="flex items-center px-2 text-xs">
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

      {/* Payment Verification & Controlled Grant Modal */}
      <AdminPaymentVerificationModal
        open={Boolean(grantModalItem)}
        onClose={() => setGrantModalItem(null)}
        item={grantModalItem}
        onSuccess={() => {
          void fetchNotifications();
        }}
      />
    </AdminShell>
  );
}
