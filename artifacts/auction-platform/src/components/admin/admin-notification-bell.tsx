import { useState } from "react";
import { Link } from "wouter";
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTimestamp } from "@/lib/format-relative-time";
import {
  buildInquiryWhatsAppMessage,
  buildLicenseRequestWhatsAppMessage,
  buildWhatsAppLink,
  priorityBadgeClass,
  type AdminNotificationItem,
} from "@/lib/admin-notifications";
import { getNotificationCategoryIcon } from "@/lib/admin-notification-icons";
import { useAdminNotifications } from "@/contexts/admin-notification-context";
import { AdminPaymentVerificationModal } from "./admin-payment-verification-modal";

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"action_required" | "activity">("action_required");
  const [grantModalItem, setGrantModalItem] = useState<AdminNotificationItem | null>(null);

  const {
    recentItems,
    actionRequiredItems,
    unreadCount,
    actionRequiredCount,
    loadingRecent,
    markAllRead,
    resolveNotification,
    openNotification,
    refreshRecent,
    connectionStatus,
  } = useAdminNotifications();

  const displayedItems =
    activeTab === "action_required" ? actionRequiredItems : recentItems;

  const totalBadgeCount = actionRequiredCount > 0 ? actionRequiredCount : unreadCount;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label={`Notifications${totalBadgeCount > 0 ? `, ${totalBadgeCount} unread` : ""}`}
          >
            <Bell className={`h-5 w-5 ${connectionStatus === "connected" ? "" : "opacity-80"}`} />
            {totalBadgeCount > 0 && (
              <span
                className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 animate-in zoom-in items-center justify-center rounded-full px-1 text-[10px] font-bold text-white duration-200 ${
                  actionRequiredCount > 0 ? "bg-amber-500 shadow-md shadow-amber-500/40" : "bg-primary"
                }`}
              >
                {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(100vw-2rem,420px)] p-0 shadow-2xl border-border/80 bg-card">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <div>
              <p className="text-sm font-bold text-foreground">Admin Operations &amp; Notifications</p>
              <p className="text-xs text-muted-foreground">
                {actionRequiredCount > 0
                  ? `${actionRequiredCount} action${actionRequiredCount > 1 ? "s" : ""} pending`
                  : unreadCount > 0
                    ? `${unreadCount} unread`
                    : "You're all caught up"}
                {connectionStatus === "connected"
                  ? " · Live"
                  : connectionStatus === "reconnecting"
                    ? " · Reconnecting…"
                    : ""}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Segmented Tabs Switch */}
          <div className="flex border-b border-border/70 p-1.5 bg-muted/30 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("action_required")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "action_required"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Action Required
              {actionRequiredCount > 0 && (
                <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[9px] font-extrabold text-white">
                  {actionRequiredCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "activity"
                  ? "bg-card text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Activity Feed
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/50">
            {loadingRecent && displayedItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading notifications…</p>
            ) : displayedItems.length === 0 ? (
              <div className="px-4 py-8 text-center space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {activeTab === "action_required" ? "No pending actions" : "No recent activity"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {activeTab === "action_required"
                    ? "All license requests and contact inquiries have been resolved."
                    : "Platform events will appear here in real time."}
                </p>
              </div>
            ) : (
              displayedItems.map((item) => {
                const CategoryIcon = getNotificationCategoryIcon(item.category);
                const isLicenseReq = item.type === "LICENSE_REQUESTED";
                const isInquiry = item.type === "CONTACT_FORM_SUBMISSION";
                const isPending = item.resolutionStatus === "pending";
                const meta = item.actionMetadata || item.metadata || {};
                const orgMobile = (meta.organizerMobile as string) || (meta.mobile as string) || "";
                const inquiryEmail = (meta.email as string) || "";

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-2 px-4 py-3 text-left transition ${
                      isLicenseReq && isPending
                        ? "bg-amber-500/10 border-l-4 border-l-amber-500"
                        : !item.isRead
                          ? "bg-primary/5"
                          : "hover:bg-accent/30"
                    }`}
                  >
                    {/* Header line: Category Icon + Title + Priority badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <CategoryIcon className={`mt-0.5 h-4 w-4 shrink-0 ${isLicenseReq ? "text-amber-400" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-bold ${!item.isRead ? "text-foreground" : "text-foreground/90"}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.resolutionStatus === "resolved" && (
                          <Badge variant="outline" className="text-[9px] border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                            Resolved ✓
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-[9px] ${priorityBadgeClass(item.priority)}`}>
                          {item.priority}
                        </Badge>
                      </div>
                    </div>

                    {/* Message / Details snippet */}
                    <p className="line-clamp-2 text-xs text-muted-foreground pl-6">{item.message}</p>

                    {/* Actionable Buttons Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pl-6">
                      <span className="text-[10px] text-muted-foreground/80">
                        {formatRelativeTimestamp(item.createdAt)}
                      </span>

                      <div className="flex items-center gap-1.5">
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
                            title="Chat with organizer on WhatsApp"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}

                        {/* Email reply for contact inquiries */}
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
                            className="h-6 px-2 text-[11px] font-bold gap-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
                            onClick={() => {
                              setGrantModalItem(item);
                            }}
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Verify &amp; Grant
                          </Button>
                        )}

                        {/* Resolve / Review Check button */}
                        {isPending ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => void resolveNotification(item.id)}
                            title="Mark this action as resolved"
                          >
                            <Check className="h-3 w-3 mr-0.5 text-emerald-400" />
                            Resolve
                          </Button>
                        ) : null}

                        {/* View Link */}
                        {item.actionUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              openNotification(item);
                              setOpen(false);
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-0.5" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All */}
          <div className="border-t border-border p-2 bg-muted/10">
            <Button variant="ghost" className="w-full justify-center text-xs h-8 text-muted-foreground hover:text-foreground" asChild>
              <Link href="/admin/notifications" onClick={() => setOpen(false)}>
                Open Full Notifications Inbox
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Payment Verification & Controlled Grant Modal */}
      <AdminPaymentVerificationModal
        open={Boolean(grantModalItem)}
        onClose={() => setGrantModalItem(null)}
        item={grantModalItem}
        onSuccess={() => {
          void refreshRecent();
        }}
      />
    </>
  );
}
