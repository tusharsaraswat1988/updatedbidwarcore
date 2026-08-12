import { CricketPublicBrandMark } from "@/components/scoring/cricket-branding";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

export function CricketObsBranding({ vm }: { vm: CricketObsViewModel }) {
  const primarySponsor = vm.showSponsorSlot ? vm.sponsors[0] : null;

  return (
    <div className="flex w-full items-start justify-between gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-md bg-black/45 px-2 py-1.5 backdrop-blur-sm">
          <CricketPublicBrandMark variant="scorer-header" />
        </div>
        {vm.tournamentLogoUrl ? (
          <img
            src={vm.tournamentLogoUrl}
            alt=""
            className="h-12 max-w-[160px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
          />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold uppercase tracking-[0.18em] text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            {vm.tournamentName}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--obs-accent)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            Cricket OBS
          </p>
        </div>
      </div>

      {primarySponsor?.url ? (
        <div className="flex max-w-[220px] flex-col items-end gap-1 rounded-md border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">
            Sponsor
          </span>
          <img
            src={primarySponsor.url}
            alt={primarySponsor.name || ""}
            className="h-10 max-w-[180px] object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
