import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

function TeamMark({
  shortCode,
  logoUrl,
  name,
}: {
  shortCode: string;
  logoUrl: string | null;
  name: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/15 bg-black/40"
        aria-hidden
      >
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
        ) : (
          <span className="text-sm font-black tracking-wide text-[var(--obs-accent)]">
            {shortCode.slice(0, 3)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-2xl font-black tracking-wide text-white">{shortCode}</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
          {name}
        </p>
      </div>
    </div>
  );
}

export function CricketObsScorebug({ vm }: { vm: CricketObsViewModel }) {
  const batting = vm.batting;
  const contextLine =
    vm.phase === "completed"
      ? vm.resultHeadline
      : vm.phase === "innings_break"
        ? [
            vm.firstInningsScoreLine,
            vm.target != null ? `TARGET ${vm.target}` : null,
            vm.batting ? `${vm.batting.shortCode} INNINGS STARTING` : "INNINGS BREAK",
          ]
            .filter(Boolean)
            .join("  ·  ")
        : vm.phase === "chase"
          ? [
              vm.target != null ? `TARGET ${vm.target}` : null,
              vm.needRuns != null && vm.ballsRemaining != null
                ? `NEED ${vm.needRuns} OFF ${vm.ballsRemaining}`
                : null,
              vm.rrr ? `RRR ${vm.rrr}` : null,
            ]
              .filter(Boolean)
              .join("  ·  ")
          : vm.bowling
            ? `vs ${vm.bowling.shortCode}`
            : null;

  return (
    <div
      className="w-full max-w-[1180px] self-start overflow-hidden rounded-xl border border-white/12 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      style={{
        background:
          "linear-gradient(180deg, rgba(12,12,16,0.92) 0%, rgba(5,5,7,0.94) 100%)",
      }}
    >
      <div
        className="h-1 w-full"
        style={{
          background: `linear-gradient(90deg, transparent, var(--obs-accent), transparent)`,
        }}
      />
      <div className="flex flex-wrap items-stretch gap-0">
        <div className="flex min-w-[240px] flex-1 items-center gap-4 px-5 py-4">
          {batting ? (
            <TeamMark
              shortCode={batting.shortCode}
              logoUrl={batting.logoUrl}
              name={batting.name}
            />
          ) : (
            <p className="text-xl font-bold text-white/70">—</p>
          )}
        </div>

        <div className="flex min-w-[280px] flex-[1.2] flex-col items-end justify-center border-l border-white/10 px-6 py-3">
          <p className="text-[52px] font-black leading-none tracking-tight tabular-nums text-white">
            {vm.runs}
            <span className="mx-1 text-white/35">/</span>
            {vm.wickets}
          </p>
          <p className="mt-1 text-sm font-bold uppercase tracking-[0.16em] text-[var(--obs-accent)]">
            {vm.oversDisplay}
          </p>
        </div>
      </div>

      {contextLine ? (
        <div className="border-t border-white/10 bg-black/35 px-5 py-2.5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/85">
            {contextLine}
          </p>
        </div>
      ) : null}
    </div>
  );
}
