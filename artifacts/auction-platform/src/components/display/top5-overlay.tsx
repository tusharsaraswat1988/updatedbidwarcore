import { memo, useMemo } from "react";
import { Trophy, Crown } from "lucide-react";
import { formatSoldForBroadcast } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import type { PlayerLite, PurseRow } from "./types";

type EnrichedBuy = PlayerLite & {
  rank: number;
  team: PurseRow | null;
};

/** Rank badge only — card chrome is identical for every row. */
const RANK_BADGE: Record<number, { background: string; color: string }> = {
  1: { background: "linear-gradient(135deg, #fde047 0%, #d4af37 55%, #b8860b 100%)", color: "#0a0a0a" },
  2: { background: "linear-gradient(135deg, #f0f2f5 0%, #b8bcc4 55%, #8a919a 100%)", color: "#0a0a0a" },
  3: { background: "linear-gradient(135deg, #e8a45c 0%, #cd7f32 55%, #9a5c24 100%)", color: "#0a0a0a" },
  4: { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" },
  5: { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" },
};

const ROW_HEIGHT_PX = 88;
const PHOTO_SIZE_PX = 64;
const TEAM_LOGO_PX = 20;
const RANK_BADGE_PX = 40;

function playerInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Top5BuyRow({ player }: { player: EnrichedBuy }) {
  const badge = RANK_BADGE[player.rank] ?? RANK_BADGE[5];

  return (
    <div
      className="grid items-center gap-4 px-5 rounded-xl shrink-0 w-full"
      style={{
        height: ROW_HEIGHT_PX,
        gridTemplateColumns: `${RANK_BADGE_PX}px ${PHOTO_SIZE_PX}px minmax(0, 1fr) 200px`,
        background: "rgba(12,12,14,0.92)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="rounded-lg flex items-center justify-center font-display font-black"
        style={{
          width: RANK_BADGE_PX,
          height: RANK_BADGE_PX,
          background: badge.background,
          color: badge.color,
          fontSize: 18,
        }}
      >
        {player.rank}
      </div>

      <div
        className="rounded-lg overflow-hidden bg-zinc-900"
        style={{ width: PHOTO_SIZE_PX, height: PHOTO_SIZE_PX }}
      >
        {player.photoUrl ? (
          <img
            src={cldUrl(player.photoUrl, "thumbnail")}
            alt={player.name}
            className="w-full h-full object-cover object-top"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-display font-black uppercase text-white/25"
            style={{ fontSize: 16 }}
          >
            {playerInitials(player.name)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex flex-col justify-center gap-1 overflow-hidden">
        <p
          className="font-display font-bold text-white uppercase truncate leading-none"
          style={{ fontSize: 20 }}
        >
          {player.name}
        </p>
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {player.team ? (
            <>
              {player.team.logoUrl ? (
                <img
                  src={player.team.logoUrl}
                  alt={player.team.shortCode}
                  className="object-contain shrink-0 opacity-90"
                  style={{ width: TEAM_LOGO_PX, height: TEAM_LOGO_PX }}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center rounded-full shrink-0 font-bold text-white/80"
                  style={{
                    width: TEAM_LOGO_PX,
                    height: TEAM_LOGO_PX,
                    fontSize: 8,
                    background: player.team.color ?? "#52525b",
                  }}
                >
                  {player.team.shortCode.slice(0, 2)}
                </span>
              )}
              <span
                className="font-semibold uppercase tracking-wider text-white/50 truncate"
                style={{ fontSize: 13 }}
              >
                {player.team.teamName}
              </span>
            </>
          ) : (
            <span className="text-white/35 uppercase tracking-widest" style={{ fontSize: 13 }}>
              —
            </span>
          )}
        </div>
      </div>

      <p
        className="font-display font-black text-white/85 tabular-nums text-right whitespace-nowrap truncate"
        style={{ fontSize: 20 }}
      >
        {formatSoldForBroadcast(player.soldPrice ?? 0)}
      </p>
    </div>
  );
}

const GOLD = "#d4af37";
const GOLD_GLOW = "rgba(212, 175, 55, 0.22)";

function Top5GraphicHeader() {
  return (
    <header className="shrink-0 text-center" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-center gap-4 mb-2">
        <span className="h-px w-10 sm:w-16 bg-amber-500/25" style={{ boxShadow: `0 0 10px ${GOLD_GLOW}` }} />
        <Crown
          className="w-5 h-5 shrink-0 text-amber-400/75"
          style={{ filter: `drop-shadow(0 0 10px ${GOLD_GLOW})` }}
          strokeWidth={1.75}
        />
        <span className="h-px w-10 sm:w-16 bg-amber-500/25" style={{ boxShadow: `0 0 10px ${GOLD_GLOW}` }} />
      </div>

      <div className="flex items-center justify-center gap-3">
        <Trophy
          className="w-4 h-4 shrink-0 text-amber-500/50 hidden sm:block"
          style={{ filter: `drop-shadow(0 0 6px ${GOLD_GLOW})` }}
          strokeWidth={1.75}
        />
        <h2
          className="font-display font-black uppercase tracking-[0.2em] text-amber-200/95"
          style={{
            fontSize: 30,
            color: GOLD,
            textShadow: `0 0 28px ${GOLD_GLOW}, 0 1px 0 rgba(0,0,0,0.9)`,
          }}
        >
          ★ TOP 5 BUYS ★
        </h2>
        <Trophy
          className="w-4 h-4 shrink-0 text-amber-500/50 hidden sm:block"
          style={{ filter: `drop-shadow(0 0 6px ${GOLD_GLOW})` }}
          strokeWidth={1.75}
        />
      </div>

      <p
        className="font-semibold uppercase tracking-[0.38em] text-white/50 mt-2"
        style={{ fontSize: 11 }}
      >
        Highest Sold Players
      </p>

      <div
        className="mx-auto mt-2.5 h-px w-24 max-w-[40%] bg-amber-500/30"
        style={{ boxShadow: `0 0 14px ${GOLD_GLOW}` }}
      />
    </header>
  );
}

/**
 * Top 5 Buys — renders inside the LED main content area only.
 * Header, sponsor carousel, and bottom ticker remain visible in DisplayShell.
 */
export const Top5Overlay = memo(function Top5Overlay({ players, purses }: {
  players: PlayerLite[];
  purses: PurseRow[];
}) {
  const teamMap = useMemo(() => new Map(purses.map(t => [t.teamId, t])), [purses]);

  const top5 = useMemo((): EnrichedBuy[] => players
    .filter(p => p.status === "sold" && (p.soldPrice ?? 0) > 0)
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0) || a.id - b.id)
    .slice(0, 5)
    .map((p, idx) => ({
      ...p,
      rank: idx + 1,
      team: p.teamId ? teamMap.get(p.teamId) ?? null : null,
    })), [players, teamMap]);

  return (
    <div className="w-full h-full flex flex-col min-h-0 select-none">
      <Top5GraphicHeader />

      <div className="flex-1 flex flex-col justify-center gap-3 min-h-0 w-full max-w-6xl mx-auto">
        {top5.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-white/40 px-6">
            <div>
              <Trophy className="w-14 h-14 mx-auto mb-3 opacity-40" />
              <p className="font-display font-bold" style={{ fontSize: 24 }}>No sales recorded yet</p>
              <p className="mt-1 text-white/30" style={{ fontSize: 14 }}>Top buys will appear here as the auction progresses</p>
            </div>
          </div>
        ) : (
          top5.map(player => <Top5BuyRow key={player.id} player={player} />)
        )}
      </div>
    </div>
  );
});
