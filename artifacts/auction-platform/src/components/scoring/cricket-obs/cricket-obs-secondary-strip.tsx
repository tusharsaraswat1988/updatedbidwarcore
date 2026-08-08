import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

function BallChip({ label }: { label: string }) {
  const isWicket = label === "W";
  const isBoundary = label === "4" || label === "6";
  return (
    <span
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-1.5 text-sm font-black tabular-nums"
      style={{
        borderColor: isWicket
          ? "rgba(248,113,113,0.65)"
          : isBoundary
            ? "color-mix(in srgb, var(--obs-accent) 55%, transparent)"
            : "rgba(255,255,255,0.18)",
        background: isWicket
          ? "rgba(127,29,29,0.75)"
          : isBoundary
            ? "color-mix(in srgb, var(--obs-accent) 18%, rgba(0,0,0,0.55))"
            : "rgba(0,0,0,0.45)",
        color: isWicket ? "#fecaca" : isBoundary ? "var(--obs-accent)" : "#fff",
      }}
    >
      {label === "·" ? "0" : label}
    </span>
  );
}

export function CricketObsSecondaryStrip({ vm }: { vm: CricketObsViewModel }) {
  if (vm.phase === "completed" || vm.phase === "innings_break") return null;

  const rates = [
    vm.crr ? `CRR ${vm.crr}` : null,
    vm.phase === "chase" && vm.rrr ? `RRR ${vm.rrr}` : null,
  ].filter(Boolean);

  if (rates.length === 0 && vm.thisOverLabels.length === 0) return null;

  return (
    <div className="flex max-w-[1180px] flex-wrap items-center gap-4 self-start rounded-lg border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-sm">
      {rates.length > 0 ? (
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
          {rates.join("   ·   ")}
        </p>
      ) : null}
      {vm.thisOverLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            This over
          </span>
          {vm.thisOverLabels.map((label, i) => (
            <BallChip key={`${label}-${i}`} label={label} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
