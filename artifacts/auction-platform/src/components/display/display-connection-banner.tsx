import { memo } from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";

/**
 * Visible reconnect / offline affordance for broadcast surfaces.
 * Shown whenever SSE is not fully connected; does not hide behind toggles.
 */
export const DisplayConnectionBanner = memo(function DisplayConnectionBanner({
  status,
  variant = "banner",
}: {
  status: ConnectionStatus;
  variant?: "banner" | "pill";
}) {
  if (status === "connected") return null;

  const isOffline = status === "disconnected";
  const title = isOffline ? "Connection lost" : "Reconnecting…";
  const detail = isOffline
    ? "Showing last known auction state until the feed recovers."
    : "Live updates paused briefly — auction data may be a few seconds behind.";

  if (variant === "pill") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-sm ${
          isOffline
            ? "bg-red-500/15 border-red-500/35 text-red-300"
            : "bg-amber-500/15 border-amber-500/35 text-amber-300"
        }`}
        role="status"
        aria-live="polite"
      >
        {isOffline ? (
          <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5 flex-shrink-0 animate-spin" />
        )}
        {title}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border-b backdrop-blur-sm flex-shrink-0 ${
        isOffline
          ? "bg-red-500/20 border-red-500/30 text-red-200"
          : "bg-amber-500/20 border-amber-500/30 text-amber-100"
      }`}
      role="status"
      aria-live="polite"
    >
      {isOffline ? (
        <WifiOff className="w-4 h-4 flex-shrink-0" />
      ) : (
        <RefreshCw className="w-4 h-4 flex-shrink-0 animate-spin" />
      )}
      <span>{title}</span>
      <span className="hidden sm:inline font-normal opacity-80">· {detail}</span>
    </div>
  );
});
