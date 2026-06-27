import { memo, useEffect, useState } from "react";
import type { LedView } from "@/lib/led-view/types";
import { EyesMascot } from "./EyesMascot";

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const AWAITING_FADE_MS = 700;

/** Occasionally surfaces the awaiting eyes when hammer time has no live data. */
function useIntermittentAwaiting(suppressed: boolean) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (suppressed) {
      setVisible(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    const scheduleHidden = (visibleMs: number) => {
      timers.push(
        setTimeout(() => {
          setVisible(false);
          scheduleShow(5000 + Math.random() * 5000);
        }, visibleMs),
      );
    };

    const scheduleShow = (hiddenMs: number) => {
      timers.push(
        setTimeout(() => {
          setVisible(true);
          scheduleHidden(2800 + Math.random() * 2400);
        }, hiddenMs),
      );
    };

    scheduleShow(2000 + Math.random() * 4000);

    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [suppressed]);

  return visible;
}

/**
 * TIMER PANEL — countdown with progress bar scaled to tournament timer settings.
 * When idle, an awaiting eyes overlay occasionally fades in over the placeholder.
 */
export const TimerPanel = memo(function TimerPanel({ view }: { view: LedView }) {
  const { state, nextMinLabel, incrementLabel, timerCeiling } = view;
  const countdown = state.countdown;
  const hammerActive = state.isBidding;
  const awaitingPeek = useIntermittentAwaiting(hammerActive);
  const urgent = hammerActive && countdown <= 5 && countdown > 0;
  const ceiling = Math.max(1, timerCeiling);
  const pct = Math.max(0, Math.min(100, (countdown / ceiling) * 100));

  return (
    <div className="flex flex-col items-end justify-between gap-4 h-full">
      <div className="flex flex-col items-end w-full">
        <span
          className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/45 mb-1"
          style={{
            opacity: hammerActive || !awaitingPeek ? 1 : 0,
            transition: hammerActive ? "none" : `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
          }}
        >
          Hammer Time
        </span>

        <div className="relative w-full min-h-[5.5rem] flex items-end justify-end">
          <div
            className="font-mono text-7xl font-bold leading-none tabular-nums"
            style={{
              color: hammerActive
                ? urgent
                  ? "#ef4444"
                  : "var(--accent)"
                : "rgba(255,255,255,0.15)",
              animation: urgent ? "auction-urgency-pulse 0.8s ease-in-out infinite" : undefined,
              opacity: hammerActive ? 1 : awaitingPeek ? 0.1 : 1,
              transition: hammerActive ? "none" : `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
            }}
          >
            {hammerActive ? fmt(countdown) : "--:--"}
          </div>

          {!hammerActive ? (
            <div
              className="absolute inset-0 flex items-center justify-end gap-2 pointer-events-none"
              style={{
                opacity: awaitingPeek ? 1 : 0,
                transition: `opacity ${AWAITING_FADE_MS}ms ease-in-out`,
              }}
            >
              <EyesMascot idle={awaitingPeek} />
              <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/50">
                Awaiting
              </span>
            </div>
          ) : null}
        </div>

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
          backgroundColor: hammerActive
            ? "color-mix(in srgb, var(--accent) 12%, transparent)"
            : "rgba(255,255,255,0.03)",
          borderColor: hammerActive
            ? "color-mix(in srgb, var(--accent) 35%, transparent)"
            : "rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-[9px] font-mono uppercase tracking-widest text-white/50">
          Next Minimum
        </p>
        <p
          className="font-['Bebas_Neue'] text-3xl leading-none mt-1 tabular-nums"
          style={{ color: hammerActive ? "var(--accent)" : "rgba(255,255,255,0.4)" }}
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
