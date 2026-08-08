import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

export function CricketObsWaiting({ vm }: { vm: CricketObsViewModel }) {
  let title = "Waiting for the next match";
  let subtitle = "BidWar Cricket";

  if (vm.phase === "pre_match") {
    title =
      vm.home && vm.away
        ? `${vm.home.shortCode}  VS  ${vm.away.shortCode}`
        : "Match starting soon";
    subtitle = "MATCH STARTING SOON";
  } else if (vm.phase === "match_unavailable") {
    title = "This match is not on the live feed";
    subtitle = "Open Cricket OBS Live for the current match";
  }

  return (
    <div
      className="max-w-[720px] self-start rounded-xl border border-white/12 px-6 py-5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
      style={{
        background:
          "linear-gradient(180deg, rgba(12,12,16,0.9) 0%, rgba(5,5,7,0.92) 100%)",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--obs-accent)]">
        {subtitle}
      </p>
      <p className="mt-2 text-2xl font-black tracking-wide text-white">{title}</p>
      {vm.phase === "no_live" ? (
        <p className="mt-2 text-sm font-medium text-white/55">
          Scores appear here when a match goes live.
        </p>
      ) : null}
    </div>
  );
}
