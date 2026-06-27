import type { GoogleSheetSyncStatus } from "@/lib/export-players-google-sheets";

export type SyncStatusDisplay = {
  label: string;
  badgeClassName: string;
};

export function formatLastSyncedAt(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso);
  const thenMs = then.getTime();
  if (Number.isNaN(thenMs)) return "Unknown";

  const now = new Date();
  const seconds = Math.floor((Date.now() - thenMs) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000);
  if (dayDiff === 1) return "Yesterday";

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return then.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatLastSyncedAtTooltip(iso: string | null): string {
  if (!iso) return "Not synced yet";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "Unknown";
  return then.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function friendlySyncError(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Something went wrong while syncing. Please try again.";
  const msg = raw.trim();
  if (msg.length > 180 || msg.includes(" at ") || msg.includes("Error:")) {
    if (/expired|reconnect|authorization|401|403/i.test(msg)) {
      return "Google authorization expired. Reconnect your account to resume sync.";
    }
    if (/timeout|ETIMEDOUT|ECONNRESET|network/i.test(msg)) {
      return "Google API timeout. Check your connection and retry.";
    }
    if (/quota|rate limit|429/i.test(msg)) {
      return "Google rate limit reached. Wait a moment and retry.";
    }
    return "Sync failed. Please retry in a moment.";
  }
  return msg;
}

export function getSyncStatusDisplay(
  syncStatus: GoogleSheetSyncStatus,
  opts: {
    isSyncing: boolean;
    sheetConfigured: boolean;
    googleConnected: boolean;
    isConnecting: boolean;
  },
): SyncStatusDisplay {
  if (opts.isSyncing || syncStatus === "SYNCING") {
    return {
      label: "Syncing",
      badgeClassName: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25",
    };
  }
  if (syncStatus === "ERROR") {
    return {
      label: "Error",
      badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25",
    };
  }
  if (
    syncStatus === "DISCONNECTED"
    || (opts.sheetConfigured && !opts.googleConnected)
  ) {
    return {
      label: "Disconnected",
      badgeClassName: "bg-muted/80 text-muted-foreground border-border",
    };
  }
  if (opts.isConnecting || (opts.sheetConfigured && syncStatus === "CONNECTED" && !opts.googleConnected)) {
    return {
      label: "Pending",
      badgeClassName: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
    };
  }
  if (opts.sheetConfigured && syncStatus === "CONNECTED") {
    return {
      label: "Connected",
      badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    };
  }
  return {
    label: "Pending",
    badgeClassName: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25",
  };
}
