import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatShortIndianRupee, type AuctionUnit } from "@/lib/format";
import { isOwnerAppHistoryEnabled } from "@workspace/api-base/tournament-features";

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
  const showTop5 = data.hasTop5Badge || bestSold?.isTop5;

  return (
    <div
      className={`pointer-events-none mt-2.5 rounded-xl border border-amber-500/40 bg-[#1c183d]/90 px-3 py-2 text-xs shadow-xs ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400/90">
            Past Auction Creds
          </span>
          {showTop5 && (
            <span className="inline-flex items-center rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-400/40 ring-inset">
              🏆 TOP 5 STAR
            </span>
          )}
        </div>
        {data.totalSoldAppearances > 1 && (
          <span className="text-[10px] font-medium text-slate-400">
            {data.totalSoldAppearances} sold leagues
          </span>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-1 gap-1 text-[11px] sm:grid-cols-2">
        {bestSold && (
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-400">Best:</span>
            <span className="font-black text-emerald-400 tabular-nums">
              {formatShortIndianRupee(bestSold.soldPrice, unit)}
            </span>
            <span className="truncate text-slate-300" title={bestSold.tournamentName}>
              ({bestSold.tournamentName})
            </span>
          </div>
        )}

        {lastSold && (
          <div className="flex items-center gap-1">
            <span className="font-semibold text-slate-400">Last:</span>
            <span className="font-bold text-amber-200 tabular-nums">
              {formatShortIndianRupee(lastSold.soldPrice, unit)}
            </span>
            {lastSold.buyingTeamName && (
              <span className="truncate text-slate-300" title={`Sold to ${lastSold.buyingTeamName}`}>
                · {lastSold.buyingTeamName}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
