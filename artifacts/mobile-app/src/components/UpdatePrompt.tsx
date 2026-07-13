import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const BUILD_KEY = "bidwar.mobile.shellAsset";

/** Routes where a forced refresh would interrupt bidding / live state. */
function isLiveAuctionPath(path: string): boolean {
  return (
    path.includes("/team-owner/panel") ||
    path.includes("/owner-app") ||
    path.includes("/auction") ||
    path.includes("/live")
  );
}

/**
 * Soft update prompt when the hosted /mobile shell assets change.
 * Never auto-reloads during live auction routes.
 */
export function UpdatePrompt() {
  const [location] = useLocation();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${window.location.origin}${window.location.pathname}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;
        const html = await res.text();
        const match = html.match(/\/mobile\/assets\/index-[^\"'\s]+\.js/);
        const next = match?.[0] ?? "";
        if (!next) return;
        const prev = localStorage.getItem(BUILD_KEY);
        if (!prev) {
          localStorage.setItem(BUILD_KEY, next);
          return;
        }
        if (prev !== next && !cancelled) {
          setAvailable(true);
        }
      } catch {
        // ignore — offline handled elsewhere
      }
    }

    void check();
    const id = window.setInterval(() => void check(), 5 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!available || isLiveAuctionPath(location)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] safe-bottom px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-[#3f3f46] bg-[#18181b] px-4 py-3 flex items-center gap-3">
        <p className="text-sm text-[#e4e4e7] flex-1 leading-snug">
          A new BidWar update is available.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-amber-400 text-black text-sm font-bold px-3 py-2"
          onClick={() => {
            localStorage.removeItem(BUILD_KEY);
            window.location.reload();
          }}
        >
          Refresh
        </button>
        <button
          type="button"
          className="shrink-0 text-[#71717a] text-sm font-semibold"
          onClick={() => setAvailable(false)}
          aria-label="Dismiss"
        >
          Later
        </button>
      </div>
    </div>
  );
}
