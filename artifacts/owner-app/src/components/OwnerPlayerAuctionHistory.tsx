import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatIndianRupee, type AuctionUnit } from "@/lib/format";
import { isOwnerAppHistoryEnabled } from "@workspace/api-base/tournament-features";

function formatOwnerHistoryAmount(amount: number, unit?: AuctionUnit): string {
  if (unit === "points") {
    if (amount >= 100000) {
      const l = amount / 100000;
      return `${Number.isInteger(l) ? l : l.toFixed(2).replace(/\.?0+$/, "")} LAKH pts`;
    }
    return `${amount.toLocaleString("en-IN")} pts`;
  }
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} CR`;
  }
  if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${Number.isInteger(l) ? l : l.toFixed(2).replace(/\.?0+$/, "")} LAKH`;
  }
  return formatIndianRupee(amount, unit);
}

export interface PlayerAuctionHistoryRecord {
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: string;
  soldPrice: number;
  buyingTeamName?: string | null;
  buyingTeamColor?: string | null;
  isTop5: boolean;
  top5BadgeText?: string;
  tournamentDate?: string | null;
  auctionUnit?: string | null;
}

export interface PlayerAuctionHistorySummary {
  records: PlayerAuctionHistoryRecord[];
  totalSoldAppearances: number;
  bestSoldRecord: PlayerAuctionHistoryRecord | null;
  lastSoldRecord: PlayerAuctionHistoryRecord | null;
  hasTop5Badge: boolean;
  isBestTop5: boolean;
}

export interface OwnerPlayerAuctionHistoryProps {
  tournamentId: number;
  playerId?: number | null;
  unit?: AuctionUnit;
  features?: Record<string, unknown> | null;
  className?: string;
}

export function OwnerPlayerAuctionHistory({
  tournamentId,
  playerId,
  unit = "rupee",
  features,
  className = "",
}: OwnerPlayerAuctionHistoryProps) {
  // Check tournament feature toggle: Master + Owner App specific toggle
  const isEnabled = isOwnerAppHistoryEnabled(features);

  const { data } = useQuery<PlayerAuctionHistorySummary>({
    queryKey: ["player-auction-history", tournamentId, playerId],
    queryFn: async ({ signal }) => {
      if (!playerId || !tournamentId) return null as any;
      const res = await fetch(
        `/api/tournaments/${tournamentId}/players/${playerId}/auction-history`,
        { credentials: "include", signal },
      );
      if (!res.ok) {
        return null as any;
      }
      const json = await res.json();
      if (Array.isArray(json)) {
        return {
          records: json,
          totalSoldAppearances: json.length,
          bestSoldRecord: json[0] || null,
          lastSoldRecord: json[0] || null,
          hasTop5Badge: json.some((r: PlayerAuctionHistoryRecord) => r.isTop5),
          isBestTop5: Boolean(json[0]?.isTop5),
        };
      }
      return json as PlayerAuctionHistorySummary;
    },
    enabled: Boolean(isEnabled && tournamentId && playerId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!isEnabled || !data || !data.records || data.records.length === 0) {
    return null;
  }

  const bestSold = data.bestSoldRecord || data.records[0];
  const lastSold = data.lastSoldRecord || data.records[data.records.length - 1];
  const isSameEvent = Boolean(
    bestSold &&
    lastSold &&
    bestSold.tournamentId === lastSold.tournamentId
  );
  const showTop5 = data.hasTop5Badge || bestSold?.isTop5 || lastSold?.isTop5;

  return (
    <div
      data-owner-player-history
      className={`pointer-events-none mt-2 rounded-xl border border-amber-500/40 bg-[#1c183d]/95 p-2 text-xs shadow-md ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-amber-500/20 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            PLAYER AUCTION HISTORY
          </span>
        </div>
        {data.totalSoldAppearances > 1 && (
          <span className="text-[10px] font-medium text-slate-400">
            {data.totalSoldAppearances} leagues
          </span>
        )}
      </div>

      {isSameEvent && bestSold ? (
        <div className="mt-1.5 rounded-lg bg-black/35 border border-amber-500/25 p-2 flex flex-col gap-1 text-[11px]">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
              PAST HIGHEST &amp; LAST AUCTION
            </span>
            {showTop5 && (
              <span className="inline-flex items-center rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 ring-1 ring-amber-400/40 ring-inset uppercase tracking-wide">
                🏆 PAST TOURNAMENT TOP 5
              </span>
            )}
          </div>
          <span className="font-display font-black text-emerald-400 text-sm sm:text-base tabular-nums leading-tight">
            {formatOwnerHistoryAmount(bestSold.soldPrice, unit)}
          </span>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-300">
            {lastSold?.buyingTeamName && (
              <span className="font-semibold text-white/90" title={`BOUGHT BY: ${lastSold.buyingTeamName}`}>
                BOUGHT BY: {lastSold.buyingTeamName}
              </span>
            )}
            {bestSold.tournamentName && (
              <span className="text-slate-400" title={bestSold.tournamentName}>
                {lastSold?.buyingTeamName ? "· " : ""}{bestSold.tournamentName}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
          {bestSold && (
            <div className="flex flex-col gap-0.5 rounded-lg bg-black/35 border border-amber-500/20 p-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/90">
                PAST HIGHEST
              </span>
              <span className="font-display font-black text-emerald-400 text-xs tabular-nums leading-tight">
                {formatOwnerHistoryAmount(bestSold.soldPrice, unit)}
              </span>
              <span className="truncate text-slate-300 text-[10px]" title={bestSold.tournamentName}>
                {bestSold.tournamentName}
              </span>
              {showTop5 && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-black text-amber-300 ring-1 ring-amber-400/40 ring-inset uppercase tracking-wide">
                    🏆 PAST TOURNAMENT TOP 5
                  </span>
                </div>
              )}
            </div>
          )}

          {lastSold && (
            <div className="flex flex-col gap-0.5 rounded-lg bg-black/35 border border-white/10 p-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                LAST AUCTION PRICE
              </span>
              <span className="font-display font-black text-amber-200 text-xs tabular-nums leading-tight">
                {formatOwnerHistoryAmount(lastSold.soldPrice, unit)}
              </span>
              {lastSold.buyingTeamName && (
                <span className="truncate text-slate-300 text-[10px]" title={`BOUGHT BY: ${lastSold.buyingTeamName}`}>
                  BOUGHT BY: {lastSold.buyingTeamName}
                </span>
              )}
              {lastSold.tournamentName && (
                <span className="truncate text-slate-400 text-[9px]" title={lastSold.tournamentName}>
                  {lastSold.tournamentName}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
