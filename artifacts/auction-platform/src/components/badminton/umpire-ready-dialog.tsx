export function UmpireReadyDialog({
  open,
  reason,
  onConfirm,
}: {
  open: boolean;
  reason: "interval" | "court_change" | "timeout" | null;
  onConfirm: () => void;
}) {
  if (!open) return null;

  const message =
    reason === "timeout"
      ? "Timeout has ended."
      : reason === "court_change"
        ? "Court change acknowledged."
        : "Interval has ended.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#0a0f1e] p-6 text-center shadow-2xl">
        <h2 className="text-xl font-black text-white">Ready to continue?</h2>
        <p className="mt-2 text-white/50 text-sm">{message}</p>
        <p className="mt-1 text-white/40 text-xs">
          Confirm before awarding the next point.
        </p>
        <button
          onClick={onConfirm}
          className="mt-6 w-full h-14 rounded-2xl bg-[#0070f3] text-white font-black text-lg"
        >
          Ready — Continue Scoring
        </button>
      </div>
    </div>
  );
}
