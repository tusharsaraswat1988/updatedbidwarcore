import { useQuery } from "@tanstack/react-query";
import { Trophy, History, Loader2 } from "lucide-react";
import { formatIndianRupee, type AuctionUnit } from "@/lib/format";
import { cn } from "@/lib/utils";

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

export function usePlayerAuctionHistory({
  tournamentId,
  playerId,
  mobile,
  globalPlayerId,
  enabled = true,
}: {
  tournamentId: number;
  playerId?: number | null;
  mobile?: string | null;
  globalPlayerId?: string | null;
  enabled?: boolean;
}) {
  const hasPlayerId = typeof playerId === "number" && playerId > 0;
  const hasMobile = typeof mobile === "string" && mobile.replace(/\D/g, "").length >= 10;
  const hasGlobalId = typeof globalPlayerId === "string" && globalPlayerId.trim().length > 0;

  const canQuery = enabled && !!tournamentId && (hasPlayerId || hasMobile || hasGlobalId);

  return useQuery<PlayerAuctionHistorySummary>({
    queryKey: ["player-auction-history", tournamentId, playerId ?? null, mobile ?? null, globalPlayerId ?? null],
    queryFn: async ({ signal }) => {
      let url = "";
      if (hasPlayerId) {
        url = `/api/tournaments/${tournamentId}/players/${playerId}/auction-history`;
      } else {
        const params = new URLSearchParams();
        if (hasMobile) params.set("mobile", mobile!);
        if (hasGlobalId) params.set("globalPlayerId", globalPlayerId!);
        url = `/api/tournaments/${tournamentId}/player-auction-history?${params.toString()}`;
      }
      const res = await fetch(url, { credentials: "include", signal });
      if (!res.ok) {
        if (res.status === 404) {
          return {
            records: [],
            totalSoldAppearances: 0,
            bestSoldRecord: null,
            lastSoldRecord: null,
            hasTop5Badge: false,
            isBestTop5: false,
          };
        }
        throw new Error("Failed to load historical auction performance");
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return {
          records: data,
          totalSoldAppearances: data.length,
          bestSoldRecord: data[0] || null,
          lastSoldRecord: data[0] || null,
          hasTop5Badge: data.some((r: PlayerAuctionHistoryRecord) => r.isTop5),
          isBestTop5: Boolean(data[0]?.isTop5),
        };
      }
      return data as PlayerAuctionHistorySummary;
    },
    enabled: canQuery,
    staleTime: 5 * 60_000,
  });
}

export function PlayerAuctionHistorySection({
  history,
  isLoading = false,
  fallbackAuctionUnit = "points",
  className,
  emptyState = "neutral",
  title = "Historical Auction Performance",
  emptyMessage = "No prior sold auction history",
}: {
  history?: PlayerAuctionHistoryRecord[] | PlayerAuctionHistorySummary | null;
  isLoading?: boolean;
  fallbackAuctionUnit?: AuctionUnit;
  className?: string;
  emptyState?: "neutral" | "hidden" | "subtle";
  title?: string;
  emptyMessage?: string;
}) {
  const records = Array.isArray(history) ? history : history?.records ?? [];

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2",
          className,
        )}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
        <span>Loading past auction performance…</span>
      </div>
    );
  }

  if (!records || records.length === 0) {
    if (emptyState === "hidden") return null;
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between",
          className,
        )}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <History className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          {title}
        </span>
        <span className="italic text-muted-foreground/70">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-slate-500/5 p-3 space-y-2.5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground tracking-wide">
          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">
          Top {records.length} sold performance{records.length > 1 ? "s" : ""}
        </span>
      </div>

      <div
        className={cn(
          "grid gap-2",
          records.length === 1
            ? "grid-cols-1"
            : records.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-3",
        )}
      >
        {records.map((record) => {
          const unit = (record.auctionUnit as AuctionUnit) || fallbackAuctionUnit;
          return (
            <div
              key={record.tournamentId}
              className="group relative flex flex-col justify-between rounded-md border border-border/80 bg-card/90 p-2.5 transition-all hover:border-amber-400/60 hover:shadow-xs"
            >
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-1.5">
                  <span
                    className="font-semibold text-xs text-foreground truncate block flex-1"
                    title={record.tournamentName}
                  >
                    {record.tournamentName}
                  </span>
                  {record.isTop5 && (
                    <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400/60 shadow-xs">
                      🏆 TOP 5 STAR
                    </span>
                  )}
                </div>

                <div className="text-base font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 leading-tight">
                  {formatIndianRupee(record.soldPrice, unit)}
                </div>
              </div>

              {record.buyingTeamName ? (
                <div className="mt-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: record.buyingTeamColor || "#3B82F6" }}
                  />
                  <span className="truncate">
                    Sold to <strong className="font-medium text-foreground">{record.buyingTeamName}</strong>
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
