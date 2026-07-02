import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  AUCTION_FEED_UI,
  formatLastActivityDiagnostic,
  type AuctionFeedState,
} from "@workspace/api-base/auction-connection-state";
import { useConnectionBannerPulse } from "@/hooks/use-connection-banner-pulse";

const BANNER_STYLES: Record<
  Exclude<AuctionFeedState, "live">,
  { container: string; icon: string }
> = {
  awaiting_operator_response: {
    container: "bg-yellow-500/10 border-yellow-500/25 text-yellow-200",
    icon: "text-yellow-400",
  },
  reconnecting: {
    container: "bg-orange-500/10 border-orange-500/25 text-orange-200",
    icon: "text-orange-400",
  },
  disconnected: {
    container: "bg-red-500/10 border-red-500/25 text-red-200",
    icon: "text-red-400",
  },
};

const SHORT_FEED_LABEL: Record<Exclude<AuctionFeedState, "live">, string> = {
  awaiting_operator_response: "Awaiting operator",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

export const AuctionFeedIndicator = memo(function AuctionFeedIndicator({
  feedState,
  secondsSinceLastActivity,
  className = "w-6 h-6",
}: {
  feedState: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
  className?: string;
}) {
  const diagnostic = formatLastActivityDiagnostic(secondsSinceLastActivity ?? null);
  const title = diagnostic
    ? `${AUCTION_FEED_UI[feedState].title} · ${diagnostic}`
    : AUCTION_FEED_UI[feedState].title;

  if (feedState === "live") {
    return (
      <span title={title} aria-label={title} className="inline-flex">
        <Wifi className={`${className} text-green-400`} aria-hidden />
      </span>
    );
  }
  if (feedState === "awaiting_operator_response") {
    return (
      <span title={title} aria-label={title} className="inline-flex">
        <Clock className={`${className} text-yellow-400`} aria-hidden />
      </span>
    );
  }
  if (feedState === "reconnecting") {
    return (
      <span title={title} aria-label={title} className="inline-flex">
        <RefreshCw className={`${className} text-orange-400 animate-spin`} aria-hidden />
      </span>
    );
  }
  return (
    <span title={title} aria-label={title} className="inline-flex">
      <WifiOff className={`${className} text-red-400 animate-pulse`} aria-hidden />
    </span>
  );
});

export const AuctionConnectionBanner = memo(function AuctionConnectionBanner({
  feedState,
  secondsSinceLastActivity,
  placement = "overlay",
  className = "",
}: {
  feedState: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
  /** @deprecated use `placement` */
  variant?: "banner" | "pill" | "compact";
  placement?: "overlay" | "inline";
  className?: string;
}) {
  const visible = useConnectionBannerPulse(feedState);
  if (feedState === "live" || !visible) return null;

  const copy = AUCTION_FEED_UI[feedState];
  const styles = BANNER_STYLES[feedState];
  const diagnostic = formatLastActivityDiagnostic(secondsSinceLastActivity ?? null);
  const tooltip = diagnostic ? `${copy.title} · ${diagnostic}` : copy.subtitle;

  const icon =
    feedState === "awaiting_operator_response" ? (
      <Clock className={`w-3 h-3 shrink-0 ${styles.icon}`} />
    ) : feedState === "reconnecting" ? (
      <RefreshCw className={`w-3 h-3 shrink-0 animate-spin ${styles.icon}`} />
    ) : (
      <WifiOff className={`w-3 h-3 shrink-0 ${styles.icon}`} />
    );

  const pill = (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium leading-none backdrop-blur-sm ${styles.container}`}
      role="status"
      aria-live="polite"
      title={tooltip}
    >
      {icon}
      <span>{SHORT_FEED_LABEL[feedState]}</span>
    </div>
  );

  if (placement === "inline") {
    return (
      <AnimatePresence>
        <motion.div
          key="connection-banner-inline"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {pill}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="connection-banner-overlay"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className={`absolute top-3 left-3 z-50 safe-top pointer-events-none ${className}`}
      >
        {pill}
      </motion.div>
    </AnimatePresence>
  );
});
