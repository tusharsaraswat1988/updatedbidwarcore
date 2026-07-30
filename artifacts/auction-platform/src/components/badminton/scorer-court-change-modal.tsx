import { useEffect, useState } from "react";

export function ScorerCourtChangeModal({
  open,
  onAcknowledge,
}: {
  open: boolean;
  onAcknowledge: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-cyan-400/40 bg-[#061622] p-6 text-center shadow-2xl">
        <p className="text-5xl mb-3">⚠️</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-wide">
          Court Change Required
        </h2>
        <p className="mt-3 text-white/60 text-sm">
          Players must change ends. Confirm when the court change is complete.
        </p>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError(null);
            try {
              await onAcknowledge();
            } catch (err) {
              setError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not confirm court change. Try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
          className="mt-6 w-full h-16 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-lg disabled:opacity-40"
        >
          {busy ? "Confirming…" : "Court Change Complete"}
        </button>
      </div>
    </div>
  );
}
