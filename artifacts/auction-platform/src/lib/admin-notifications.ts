export type AdminNotificationPriority = "info" | "warning" | "critical";

export type AdminNotificationCategory =
  | "Registration"
  | "Tournament"
  | "Contact"
  | "Auction"
  | "Payment"
  | "Support"
  | "Printer"
  | "System";

export type AdminNotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  priority: AdminNotificationPriority;
  category: AdminNotificationCategory;
  entityType: string | null;
  entityId: number | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminNotificationListResponse = {
  items: AdminNotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type AdminNotificationSettings = {
  adminName: string;
  adminEmail: string;
  adminMobile: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  liveNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  updatedAt: string | null;
};

export function normalizeAdminNotificationSettings(
  raw: Partial<AdminNotificationSettings>,
): AdminNotificationSettings {
  return {
    adminName: raw.adminName ?? "",
    adminEmail: raw.adminEmail ?? "",
    adminMobile: raw.adminMobile ?? null,
    emailNotificationsEnabled: raw.emailNotificationsEnabled ?? true,
    inAppNotificationsEnabled: raw.inAppNotificationsEnabled ?? true,
    liveNotificationsEnabled: raw.liveNotificationsEnabled ?? true,
    notificationSoundEnabled: raw.notificationSoundEnabled ?? false,
    updatedAt: raw.updatedAt ?? null,
  };
}

export const ADMIN_NOTIFICATION_DROPDOWN_LIMIT = 8;

export function priorityBadgeClass(priority: AdminNotificationPriority): string {
  if (priority === "critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (priority === "warning") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  return "bg-blue-500/20 text-blue-400 border-blue-500/30";
}

export function priorityLabel(priority: AdminNotificationPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function priorityToastEmoji(priority: AdminNotificationPriority): string {
  if (priority === "critical") return "🔴";
  if (priority === "warning") return "🟡";
  return "🔵";
}

export function notificationMatchesFilters(
  item: AdminNotificationItem,
  filters: { priority: string; read: string; search: string },
): boolean {
  if (filters.priority !== "all" && item.priority !== filters.priority) return false;
  if (filters.read === "read" && !item.isRead) return false;
  if (filters.read === "unread" && item.isRead) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = `${item.title} ${item.message} ${item.type} ${item.category}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

export function navigateToNotificationAction(
  actionUrl: string | null,
  navigate: (path: string) => void,
): void {
  if (!actionUrl) {
    navigate("/admin/notifications");
    return;
  }
  try {
    const url = new URL(actionUrl, window.location.origin);
    navigate(url.pathname + url.search + url.hash);
  } catch {
    navigate("/admin/notifications");
  }
}
