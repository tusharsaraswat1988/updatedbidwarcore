import { useEffect, useState } from "react";

const INTERVAL_SECONDS = 60;

export function UmpireIntervalModal({
  open,
  onResumeEarly,
  onEndInterval,
}: {
  open: boolean;
  onResumeEarly: () => Promise<unknown>;
  onEndInterval: () => Promise<unknown>;
}) {
  const [secondsLeft, setSecondsLeft] = useState(INTERVAL_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(INTERVAL_SECONDS);
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;

  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-purple-400/40 bg-[#12082a] p-6 text-center shadow-2xl">
        <p className="text-purple-300 text-sm font-bold tracking-[0.25em] uppercase">
          Interval Start
        </p>
        <p className="mt-4 text-7xl font-black tabular-nums text-white">{secondsLeft}</p>
        <p className="mt-2 text-white/40 text-sm">One-minute interval</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            disabled={busy}
            onClick={() => act(onResumeEarly)}
            className="h-14 rounded-xl bg-white/10 border border-white/15 text-white font-bold disabled:opacity-40"
          >
            Resume Early
          </button>
          <button
            disabled={busy}
            onClick={() => act(onEndInterval)}
            className="h-14 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-40"
          >
            End Interval
          </button>
        </div>
      </div>
    </div>
  );
}
