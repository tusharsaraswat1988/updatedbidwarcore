import React from "react";
import { WifiOff, CheckCircle2, RefreshCw } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

export function NetworkStatusBanner({ className }: { className?: string }) {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-50 w-full px-4 py-2 text-xs font-bold transition-all duration-300 shadow-md",
        !isOnline
          ? "bg-rose-600 text-white animate-in slide-in-from-top"
          : "bg-emerald-600 text-white animate-in slide-in-from-top",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <>
              <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-white" />
              <span>Offline · Live auction and scores are paused. Checking your internet connection…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-white" />
              <span>Reconnected · Spectator feed synchronized.</span>
            </>
          )}
        </div>

        {!isOnline && (
          <span className="hidden sm:inline-flex items-center gap-1.5 opacity-90 text-[11px]">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Auto-reconnecting
          </span>
        )}
      </div>
    </div>
  );
}

export default NetworkStatusBanner;
