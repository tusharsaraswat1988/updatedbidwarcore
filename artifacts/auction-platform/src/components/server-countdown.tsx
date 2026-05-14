import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Timer } from "lucide-react";

/**
 * ServerCountdown — single source-of-truth auction timer.
 *
 * Architecture:
 *  - The SERVER stores `timerEndsAt` (ISO timestamp) on the auction session
 *    and resets it on every valid bid / start-timer action.
 *  - All clients receive the SAME `timerEndsAt` over the SSE channel
 *    (useAuctionSocket → auction_state messages).
 *  - This component computes remaining seconds purely from that server
 *    timestamp vs. the local clock. No client-side timer logic.
 *  - It owns its own 250ms tick interval in an isolated memo'd subtree so
 *    the parent (operator panel, owner panel, LED display) never rerenders
 *    per tick — only this component does.
 *  - Re-mounting on `timerEndsAt` change is handled by re-running the
 *    effect (no key needed) and re-capturing the full duration so the
 *    display variant's progress bar always starts at 100%.
 *
 * Drift: bounded by the local clock skew between devices. We round with
 * Math.ceil so a sub-second skew shows the same integer second on all
 * clients. Real-world drift on a LAN is typically <100ms.
 */

type Variant = "display" | "operator" | "owner";

interface Props {
  timerEndsAt: string | null | undefined;
  timerType?: string | null;
  variant: Variant;
  /** Rendered when `timerEndsAt` is null (operator variant only). */
  fallback?: ReactNode;
}

export const ServerCountdown = memo(function ServerCountdown({
  timerEndsAt,
  timerType,
  variant,
  fallback,
}: Props) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const totalRef = useRef<number>(30);

  useEffect(() => {
    if (!timerEndsAt) {
      setTimeLeft(null);
      return;
    }
    const endMs = new Date(timerEndsAt).getTime();
    totalRef.current = Math.max(1, Math.ceil((endMs - Date.now()) / 1000));
    const update = () => {
      const diff = Math.ceil((endMs - Date.now()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  if (!timerEndsAt) {
    return variant === "operator" && fallback ? <>{fallback}</> : null;
  }
  if (timeLeft === null) return null;

  const urgent = timeLeft <= 5;
  const warn = timeLeft <= 10;
  const expired = timeLeft <= 0;
  const isBid = timerType === "bid";

  if (variant === "display") {
    const tone = urgent ? "text-red-400" : warn ? "text-orange-400" : "text-muted-foreground";
    const barColor = urgent ? "bg-red-400" : warn ? "bg-orange-400" : "bg-green-400";
    const pct = Math.min(100, (timeLeft / totalRef.current) * 100);
    return (
      <div className="space-y-2">
        <div className={`flex items-center gap-3 ${tone}`}>
          <Timer className={`w-6 h-6 ${urgent ? "animate-pulse" : ""}`} />
          <span className={`text-5xl md:text-6xl lg:text-7xl font-display font-black tabular-nums leading-none ${urgent ? "animate-pulse" : ""}`}>
            {timeLeft}
          </span>
          <div className="flex flex-col justify-center">
            <span className="text-xl font-bold uppercase tracking-widest">sec</span>
            <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mt-1 ${
              isBid
                ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                : "bg-green-500/20 text-green-400 border-green-500/30"
            }`}>
              {isBid ? "BID TIMER" : "START TIMER"}
            </span>
          </div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} transition-[width] duration-200 ease-linear`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  if (variant === "operator") {
    return (
      <>
        <Timer className={`w-4 h-4 flex-shrink-0 ${urgent && !expired ? "text-red-400 animate-pulse" : !expired ? "text-green-400" : "text-muted-foreground"}`} />
        {!expired ? (
          <>
            <span className={`text-2xl font-display font-black tabular-nums ${urgent ? "text-red-400" : warn ? "text-orange-400" : "text-green-400"}`}>
              {`${timeLeft}s`}
            </span>
            <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              isBid
                ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                : "bg-green-500/20 text-green-400 border-green-500/30"
            }`}>
              {isBid ? "BID TIMER" : "START TIMER"}
            </span>
          </>
        ) : (
          <span className="text-2xl font-display font-black tabular-nums text-red-500">EXPIRED</span>
        )}
      </>
    );
  }

  // owner variant — full card row
  const cardClass = expired
    ? "bg-red-500/20 border border-red-500/30 text-red-400"
    : urgent
    ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
    : "bg-card/50 border border-border text-muted-foreground";
  return (
    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${cardClass}`}>
      <Timer className={`w-4 h-4 ${urgent ? "animate-pulse" : ""}`} />
      {expired ? "Timer expired — bidding locked" : `Time remaining: ${timeLeft}s`}
      {!expired && (
        <span className={`ml-auto text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
          isBid
            ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
            : "bg-green-500/20 text-green-400 border-green-500/30"
        }`}>
          {isBid ? "BID" : "START"}
        </span>
      )}
    </div>
  );
});
