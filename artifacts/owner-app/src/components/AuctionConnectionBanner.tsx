import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  AUCTION_FEED_UI,
  formatLastActivityDiagnostic,
  type AuctionFeedState,
} from "@workspace/api-base/auction-connection-state";

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
    return <Wifi className={`${className} text-green-400`} title={title} aria-label={title} />;
  }
  if (feedState === "awaiting_operator_response") {
    return <Clock className={`${className} text-yellow-400`} title={title} aria-label={title} />;
  }
  if (feedState === "reconnecting") {
    return (
      <RefreshCw
        className={`${className} text-orange-400 animate-spin`}
        title={title}
        aria-label={title}
      />
    );
  }
  return (
    <WifiOff
      className={`${className} text-red-400 animate-pulse`}
      title={title}
      aria-label={title}
    />
  );
});

export const AuctionConnectionBanner = memo(function AuctionConnectionBanner({
  feedState,
  secondsSinceLastActivity,
  variant = "banner",
  className = "",
}: {
  feedState: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
  variant?: "banner" | "pill" | "compact";
  className?: string;
}) {
  if (feedState === "live") return null;

  const copy = AUCTION_FEED_UI[feedState];
  const styles = BANNER_STYLES[feedState];
  const diagnostic = formatLastActivityDiagnostic(secondsSinceLastActivity ?? null);

  const icon =
    feedState === "awaiting_operator_response" ? (
      <Clock className={`w-4 h-4 shrink-0 ${styles.icon}`} />
    ) : feedState === "reconnecting" ? (
      <RefreshCw className={`w-4 h-4 shrink-0 animate-spin ${styles.icon}`} />
    ) : (
      <WifiOff className={`w-4 h-4 shrink-0 ${styles.icon}`} />
    );

  if (variant === "pill") {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-sm ${styles.container} ${className}`}
        role="status"
        aria-live="polite"
        title={diagnostic ?? undefined}
      >
        {icon}
        <span>{copy.title}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className={`absolute top-4 left-4 right-4 z-50 mx-auto max-w-md safe-top ${className}`}
        >
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg ${styles.container}`}
            role="status"
            aria-live="polite"
            title={diagnostic ?? undefined}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm">{copy.title}</p>
              <p className="text-xs opacity-80">{copy.subtitle}</p>
            </div>
            {feedState === "reconnecting" ? (
              <div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin shrink-0" />
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold border-b backdrop-blur-sm flex-shrink-0 ${styles.container} ${className}`}
      role="status"
      aria-live="polite"
      title={diagnostic ?? undefined}
    >
      {icon}
      <span>{copy.title}</span>
      <span className="hidden sm:inline font-normal opacity-80">· {copy.subtitle}</span>
    </div>
  );
});
