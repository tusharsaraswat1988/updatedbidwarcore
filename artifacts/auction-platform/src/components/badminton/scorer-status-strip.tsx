import type { ScorerConfidencePanel as PanelData } from "@workspace/badminton-core";

/** Single authoritative match-state readout for the scorer console. */
export function ScorerStatusStrip({ panel }: { panel: PanelData }) {
  return (
    <div className="shrink-0 mx-3 mb-2 rounded-xl border border-border bg-card/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider shrink-0">
            G{panel.currentGame}
          </span>
          <span className="text-3xl sm:text-4xl font-black tabular-nums text-foreground leading-none">
            {panel.leftScore}
            <span className="text-muted-foreground/40 mx-1.5 text-2xl font-light">:</span>
            {panel.rightScore}
          </span>
          <span className="text-muted-foreground text-xs font-semibold tabular-nums shrink-0">
            ({panel.gamesLeft}–{panel.gamesRight})
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm border-t border-border/60 pt-2">
        <span className="text-primary font-semibold truncate max-w-[45%]">
          🟡 {panel.serverLabel}
        </span>
        <span className="text-sky-300 font-semibold truncate max-w-[45%]">
          👁 {panel.receiverLabel}
        </span>
        {panel.serviceCourt ? (
          <span className="text-muted-foreground truncate">{panel.serviceCourt}</span>
        ) : null}
      </div>
    </div>
  );
}
