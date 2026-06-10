import { memo } from "react";
import type { LedView } from "@/lib/auction-demo/use-auction-state";

/**
 * PLAYER PORTRAIT — real photo, identity, role badge, jersey #, City/Age/Hand/Base.
 * Pure presentation over view.currentPlayer.
 */
export const PlayerPortrait = memo(function PlayerPortrait({
  view,
}: {
  view: LedView;
}) {
  const { currentPlayer, roleLabel, basePriceLabel } = view;
  if (!currentPlayer) return null;

  return (
    <div className="relative overflow-hidden bg-black/40 border border-white/10 h-full">
      {/* Portrait image */}
      <img
        src={currentPlayer.portrait}
        alt={currentPlayer.name}
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />

      {/* Gradient floor */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, transparent 60%, var(--accent-glow) 100%)",
        }}
      />

      {/* Jersey number badge */}
      <div className="absolute top-3 right-3 z-10">
        <div
          className="size-14 grid place-items-center font-['Bebas_Neue'] text-2xl italic shadow-2xl"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
          }}
        >
          #{currentPlayer.serialNo}
        </div>
      </div>

      {/* Identity */}
      <div className="absolute inset-x-0 bottom-0 p-4 z-10">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-on)",
            }}
          >
            {roleLabel}
          </span>
          <span className="text-white/70 text-[10px] font-mono uppercase tracking-[0.2em]">
            {currentPlayer.city}
          </span>
        </div>

        <h2 className="font-['Bebas_Neue'] text-[clamp(2rem,4vw,4rem)] leading-[0.9] uppercase text-white tracking-tight">
          {currentPlayer.name}
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-white/15">
          <Stat label="Age" value={String(currentPlayer.age)} />
          <Stat label="Bat" value={currentPlayer.battingHand} />
          <Stat label="Base" value={basePriceLabel} />
        </div>
      </div>

      {/* Accent corner */}
      <div
        className="absolute top-0 left-0 h-1 w-16"
        style={{ backgroundColor: "var(--accent)" }}
      />
    </div>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8px] font-mono uppercase tracking-widest text-white/45">
        {label}
      </p>
      <p
        className="font-mono text-sm font-bold mt-0.5 tabular-nums"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </p>
    </div>
  );
}
