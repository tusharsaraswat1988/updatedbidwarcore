import type { UmpireConfidencePanel as PanelData } from "@workspace/badminton-core";

export function UmpireConfidencePanel({
  panel,
  variant = "sidebar",
}: {
  panel: PanelData;
  variant?: "sidebar" | "mobile";
}) {
  if (variant === "mobile") {
    return (
      <div className="shrink-0 mx-3 mb-2 rounded-xl border border-white/10 bg-[#070b16] p-3 grid grid-cols-2 gap-2 text-xs">
        <PanelContent panel={panel} compact />
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col w-52 shrink-0 border-l border-white/10 bg-[#070b16] p-3 gap-2 text-xs">
      <PanelContent panel={panel} />
    </aside>
  );
}

function PanelContent({ panel, compact = false }: { panel: PanelData; compact?: boolean }) {
  return (
    <>
      {!compact && (
        <p className="text-white/40 font-bold tracking-widest uppercase text-[10px] col-span-2">
          Umpire Check
        </p>
      )}
      <Row label="Game" value={`${panel.currentGame}`} compact={compact} />
      <Row label="Score" value={`${panel.leftScore} – ${panel.rightScore}`} compact={compact} />
      <Row label="Server" value={panel.serverLabel} highlight="gold" compact={compact} />
      <Row label="Receiver" value={panel.receiverLabel} highlight="blue" compact={compact} />
      {panel.serviceCourt && (
        <Row label="Service court" value={panel.serviceCourt} compact={compact} />
      )}
      <Row label="Games won" value={`${panel.gamesLeft} – ${panel.gamesRight}`} compact={compact} />
    </>
  );
}

function Row({
  label,
  value,
  highlight,
  compact,
}: {
  label: string;
  value: string;
  highlight?: "gold" | "blue";
  compact?: boolean;
}) {
  return (
    <div className={compact ? "rounded-lg bg-white/5 px-2 py-1.5" : "rounded-lg bg-white/5 border border-white/10 px-2 py-2"}>
      <p className="text-white/40 text-[10px] uppercase tracking-wide">{label}</p>
      <p
        className={
          highlight === "gold"
            ? "text-[#ffd700] font-bold truncate"
            : highlight === "blue"
              ? "text-[#4fc3f7] font-bold truncate"
              : "text-white font-semibold truncate"
        }
      >
        {value}
      </p>
    </div>
  );
}
