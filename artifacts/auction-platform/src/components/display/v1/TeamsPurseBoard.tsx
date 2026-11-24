import { memo, useEffect, useMemo, useState } from "react";
import type { LedTeam, LedView } from "@/lib/led-view/types";
import { formatAuctionAmount, normalizeAuctionUnit } from "@workspace/api-base/auction-unit";

const ROTATION_INTERVAL_MS = 12000;
const PAGE_SIZE = 6;

interface TeamsPurseBoardProps {
  view: LedView;
}

/**
 * TEAMS PURSE & MAX BID BOARD — broadcast panel for the right-side stage column.
 * Rendered in High-Contrast Light Mode to prevent data exhaustion and visual fatigue on LED walls.
 * Features:
 *   - Clean single header row: [TEAM] | [PURSE] | [MAX BID] (no repeating micro-labels)
 *   - High-contrast white/light-slate container with crisp slate-900 typography
 *   - Full-width team names in bold condensed typography without ellipsis cutting
 *   - Monospace tabular alignment for remaining purse and max bid amounts
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
      <div className="w-full flex-1 min-h-0 flex flex-col justify-center items-center p-3 rounded-xl border border-slate-200 bg-white text-center shadow-lg">
        <span className="text-[clamp(0.85rem,1.1cqw,1.25rem)] font-bold uppercase tracking-[0.06em] text-slate-500 font-['Space_Grotesk']">
          Awaiting Teams Data
        </span>
      </div>
    );
  }

  const isCompact = teams.length > 6;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl p-2.5 text-slate-900">
      {/* Top Banner / Title Header */}
      <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="size-2.5 rounded-full"
            style={{
              backgroundColor: isBidding ? "#16a34a" : "#94a3b8",
              animation: isBidding ? "auction-pulse-glow 1.5s ease-in-out infinite" : undefined,
            }}
          />
          <span className="text-[clamp(0.8rem,1.05cqw,1.15rem)] font-extrabold uppercase tracking-wide text-slate-900 font-['Space_Grotesk']">
            Teams Purse & Max Bid
          </span>
        </div>
        <span className="text-[clamp(0.7rem,0.85cqw,0.92rem)] font-bold font-mono uppercase text-slate-500">
          {teams.length} Teams
        </span>
      </div>

      {/* Broadcast Table Column Headers (Eliminating repeating row micro-labels) */}
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-2 py-1 text-[clamp(0.6rem,0.8cqw,0.78rem)] font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/70 shrink-0">
        <span>Team</span>
        <span className="text-right">Purse</span>
        <span className="text-right text-emerald-700">Max Bid</span>
      </div>

      {/* Teams List (In Light Mode without Data Cut) */}
      <div className="flex-1 min-h-0 flex flex-col justify-around gap-1 py-1 overflow-hidden">
        {visibleTeams.map((team: LedTeam, idx: number) => {
          const isLeader = activeTeamId === String(team.id);
          const teamColor = team.color || "#2563eb";

          return (
            <div
              key={team.id}
              className={`relative grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center px-2 transition-all duration-200 rounded-lg border ${
                isCompact ? "py-0.5" : "py-1"
              }`}
              style={{
                backgroundColor: isLeader
                  ? "rgba(254, 243, 199, 0.75)" // amber-100/75 for leader
                  : idx % 2 === 0
                    ? "rgba(248, 250, 252, 0.85)" // slate-50
                    : "#ffffff",
                borderColor: isLeader ? "#f59e0b" : "rgba(226, 232, 240, 0.8)",
                boxShadow: isLeader ? "0 0 10px rgba(245, 158, 11, 0.3)" : undefined,
              }}
            >
              {/* Left Color Stripe */}
              <div
                className="absolute left-0 inset-y-1 w-1 rounded-r"
                style={{ backgroundColor: teamColor }}
              />

              {/* Team Identity Column */}
              <div className="flex items-center gap-1.5 min-w-0 pr-1 pl-1.5">
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    alt={team.name}
                    className="size-4.5 shrink-0 object-contain rounded"
                  />
                ) : (
                  <span
                    className="font-['Bebas_Neue'] text-[clamp(0.75rem,0.95cqw,1.05rem)] px-1 rounded leading-none shrink-0 font-bold"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${teamColor} 18%, #f1f5f9)`,
                      color: teamColor,
                    }}
                  >
                    {team.short}
                  </span>
                )}
                <span
                  className="font-['Barlow_Condensed'] text-[clamp(0.85rem,1.1cqw,1.25rem)] font-bold uppercase tracking-wide text-slate-900 truncate"
                  title={team.name}
                >
                  {team.name}
                </span>
                {isLeader && (
                  <span className="size-1.5 rounded-full bg-amber-500 shrink-0" title="Highest Bidder" />
                )}
              </div>

              {/* Remaining Purse Column */}
              <div className="text-right font-['Bebas_Neue'] text-[clamp(0.95rem,1.25cqw,1.4rem)] font-black tracking-wide tabular-nums text-slate-800">
                {formatAuctionAmount(team.purse, auctionUnit)}
              </div>

              {/* Max Bid Allowed Column */}
              <div className="text-right font-['Bebas_Neue'] text-[clamp(0.95rem,1.25cqw,1.4rem)] font-black tracking-wide tabular-nums text-emerald-700">
                {formatAuctionAmount(team.maxBidAllowed, auctionUnit)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Pagination dots if > 8 teams */}
      {isLargeRoster && (
        <div className="flex items-center justify-center gap-1 pt-1 border-t border-slate-200/80 shrink-0">
          {Array.from({ length: Math.ceil(teams.length / PAGE_SIZE) }).map((_, i) => (
            <div
              key={i}
              className="size-1.5 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: i === pageIndex ? "#2563eb" : "#cbd5e1",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
