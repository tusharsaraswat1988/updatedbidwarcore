import { memo } from "react";
import type { LedView } from "@/lib/auction-demo/use-auction-state";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * TIMER PANEL — production 30s countdown (state.countdown). Urgency at ≤5s.
 */
export const TimerPanel = memo(function TimerPanel({ view }: { view: LedView }) {
  const { state, nextMinLabel, incrementLabel } = view;
  const countdown = state.countdown;
  const live = state.isBidding;
  const urgent = live && countdown <= 5 && countdown > 0;
  const pct = Math.max(0, Math.min(100, (countdown / 30) * 100));

  return (
    <div className="flex flex-col items-end justify-between gap-4 h-full">
      <div className="flex flex-col items-end w-full">
        <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/45 mb-1">
          Hammer Time
        </span>
        {live ? (
          <div
            className="font-mono text-7xl font-bold leading-none tabular-nums"
            style={{
              color: urgent ? "#ef4444" : "var(--accent)",
              animation: urgent
                ? "auction-urgency-pulse 0.8s ease-in-out infinite"
                : undefined,
            }}
          >
            {fmt(countdown)}
          </div>
        ) : (
          <div className="font-mono text-7xl font-bold leading-none tabular-nums text-white/15">
            --:--
          </div>
        )}
        <div className="mt-2 h-1 w-full bg-white/10 overflow-hidden">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${pct}%`,
              backgroundColor: urgent ? "#ef4444" : "var(--accent)",
            }}
          />
        </div>
      </div>

      <div
        className="w-full p-3 border"
        style={{
          backgroundColor: live
            ? "color-mix(in srgb, var(--accent) 12%, transparent)"
            : "rgba(255,255,255,0.03)",
          borderColor: live
            ? "color-mix(in srgb, var(--accent) 35%, transparent)"
            : "rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/50">
          Next Minimum
        </p>
        <p
          className="font-['Bebas_Neue'] text-3xl leading-none mt-1 tabular-nums"
          style={{ color: live ? "var(--accent)" : "rgba(255,255,255,0.4)" }}
        >
          {nextMinLabel}
        </p>
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/45 mt-1">
          Increment {incrementLabel}
        </p>
      </div>
    </div>
  );
});
