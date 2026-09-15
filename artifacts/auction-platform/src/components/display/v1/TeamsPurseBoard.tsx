import { memo, useEffect, useMemo, useState } from "react";
import type { LedTeam, LedView } from "@/lib/led-view/types";
import { formatAuctionAmount, normalizeAuctionUnit } from "@workspace/api-base/auction-unit";

const ROTATION_INTERVAL_MS = 5000;
const PAGE_SIZE = 4;

interface TeamsPurseBoardProps {
  view: LedView;
}

/**
 * TEAMS PURSE & MAX BID BOARD — broadcast panel for the right-side stage column.
 * Displays all tournament teams with:
 *   1. Remaining Purse (balance points available)
 *   2. Max Bid Allowed Per Player (reserve-purse protected single-bid ceiling)
 * Highlights active highest bidder with team accent glow.
 */
export const TeamsPurseBoard = memo(function TeamsPurseBoard({ view }: TeamsPurseBoardProps) {
  const { state, leadingTeam, hasTeamBid, tournament } = view;
  const teams = state.teams ?? [];
  const auctionUnit = normalizeAuctionUnit(tournament.auctionUnit);

  const activeTeamId = hasTeamBid && leadingTeam ? String(leadingTeam.id) : null;
  const isBidding = state.isBidding;

  // Pagination for large tournaments (> 8 teams)
  const isLargeRoster = teams.length > 8;
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (!isLargeRoster) return;
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % Math.ceil(teams.length / PAGE_SIZE));
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLargeRoster, teams.length]);

  const visibleTeams = useMemo(() => {
    if (!isLargeRoster) {
      return teams;
    }
    // For > 8 teams, if leading bidder is active, pin them at the top
    if (activeTeamId) {
      const leader = teams.find((t) => String(t.id) === activeTeamId);
      const others = teams.filter((t) => String(t.id) !== activeTeamId);
      const pageStart = (pageIndex * (PAGE_SIZE - 1)) % Math.max(1, others.length);
      const pageOthers = others.slice(pageStart, pageStart + (PAGE_SIZE - 1));
      return leader ? [leader, ...pageOthers] : pageOthers;
    }
    const start = (pageIndex * PAGE_SIZE) % teams.length;
    return teams.slice(start, start + PAGE_SIZE);
  }, [teams, isLargeRoster, activeTeamId, pageIndex]);

  if (teams.length === 0) {
    return (
      <div className="w-full flex-1 min-h-0 flex flex-col justify-center items-center p-3 border border-white/10 bg-black/40 text-center">
        <span className="led-label text-[clamp(0.9rem,1.2cqw,1.35rem)] font-bold uppercase tracking-[0.06em] text-white/70 font-['Space_Grotesk']">
          Awaiting Teams Data
        </span>
      </div>
    );
  }

  const isCompact = teams.length > 5;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden border border-white/10 bg-black/45 p-2">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-1.5 pb-1.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5">
          <div
            className="size-2 rounded-full"
            style={{
              backgroundColor: isBidding ? "var(--accent)" : "rgba(255,255,255,0.6)",
              animation: isBidding ? "auction-pulse-glow 1.5s ease-in-out infinite" : undefined,
            }}
          />
          <span className="led-label text-[clamp(0.75rem,0.95cqw,1.05rem)] font-extrabold uppercase tracking-[0.04em] text-white/90 font-['Space_Grotesk']">
            Teams Purse & Max Bid
          </span>
        </div>
        <span className="led-label text-[clamp(0.7rem,0.85cqw,0.95rem)] font-bold uppercase text-white/75">
          {teams.length} Teams
        </span>
      </div>

      {/* Teams List */}
      <div className="flex-1 min-h-0 flex flex-col justify-around gap-1.5 py-1.5 overflow-hidden">
        {visibleTeams.map((team: LedTeam) => {
          const isLeader = activeTeamId === String(team.id);
          const teamColor = team.color || "var(--accent)";

          return (
            <div
              key={team.id}
              className={`relative flex items-center justify-between px-2 transition-all duration-300 ${
                isCompact ? "py-1" : "py-1.5"
              } border`}
              style={{
                backgroundColor: isLeader
                  ? `color-mix(in srgb, ${teamColor} 22%, rgba(0,0,0,0.7))`
                  : "rgba(255,255,255,0.04)",
                borderColor: isLeader
                  ? `color-mix(in srgb, ${teamColor} 75%, transparent)`
                  : "rgba(255,255,255,0.12)",
                boxShadow: isLeader
                  ? `0 0 14px color-mix(in srgb, ${teamColor} 35%, transparent)`
                  : undefined,
              }}
            >
              {/* Left Stripe */}
              <div
                className="absolute left-0 inset-y-0 w-1.5"
                style={{ backgroundColor: teamColor }}
              />

              {/* Team Identity */}
              <div className="flex items-center gap-2 min-w-0 mr-2 flex-1">
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    alt={team.name}
                    className="size-5 shrink-0 object-contain"
                  />
                ) : (
                  <span
                    className="led-team font-['Bebas_Neue'] text-[clamp(0.85rem,1.15cqw,1.3rem)] px-1.5 py-0.5 rounded leading-none shrink-0 font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${teamColor} 30%, transparent)`,
                      color: teamColor,
                    }}
                  >
                    {team.short}
                  </span>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="led-team text-[clamp(0.8rem,1cqw,1.15rem)] font-extrabold uppercase tracking-wide text-white truncate max-w-[140px]">
                      {team.name}
                    </span>
                    {isLeader && (
                      <span
                        className="led-status text-[clamp(0.7rem,0.85cqw,0.95rem)] font-black uppercase tracking-wider px-1.5 py-0.5 rounded leading-tight shrink-0 shadow"
                        style={{
                          backgroundColor: teamColor,
                          color: "#000",
                        }}
                      >
                        Highest
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Financial Metrics: Remaining Purse & Max Bid Per Player */}
              <div className="flex items-center gap-2.5 shrink-0 text-right">
                {/* Remaining Purse */}
                <div className="flex flex-col items-end">
                  <span className="led-label text-[clamp(0.68rem,0.8cqw,0.9rem)] font-bold uppercase tracking-wider text-white/70 leading-none mb-0.5 font-['Space_Grotesk']">
                    Purse
                  </span>
                  <span
                    className="led-value font-['Bebas_Neue'] text-[clamp(0.95rem,1.3cqw,1.45rem)] tracking-wide tabular-nums leading-none font-black"
                    style={{ color: isLeader ? teamColor : "var(--stage-text)" }}
                  >
                    {formatAuctionAmount(team.purse, auctionUnit)}
                  </span>
                </div>

                {/* Vertical separator */}
                <div className="h-5 w-px bg-white/15" />

                {/* Max Bid Allowed */}
                <div className="flex flex-col items-end min-w-[52px]">
                  <span className="led-label text-[clamp(0.68rem,0.8cqw,0.9rem)] font-bold uppercase tracking-wider text-white/70 leading-none mb-0.5 font-['Space_Grotesk']">
                    Max Bid
                  </span>
                  <span className="led-value font-['Bebas_Neue'] text-[clamp(0.95rem,1.3cqw,1.45rem)] tracking-wide tabular-nums leading-none text-emerald-400 font-black">
                    {formatAuctionAmount(team.maxBidAllowed, auctionUnit)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Pagination dots if > 8 teams */}
      {isLargeRoster && (
        <div className="flex items-center justify-center gap-1 pt-1 border-t border-white/10 shrink-0">
          {Array.from({ length: Math.ceil(teams.length / PAGE_SIZE) }).map((_, i) => (
            <div
              key={i}
              className="size-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: i === pageIndex ? "var(--accent)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
