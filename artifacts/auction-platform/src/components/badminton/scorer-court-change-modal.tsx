import { useState } from "react";

export function ScorerCourtChangeModal({
  open,
  onAcknowledge,
}: {
  open: boolean;
  onAcknowledge: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

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
        <button
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onAcknowledge();
            } finally {
              setBusy(false);
            }
          }}
          className="mt-6 w-full h-16 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-lg disabled:opacity-40"
        >
          Court Change Complete
        </button>
      </div>
    </div>
  );
}
