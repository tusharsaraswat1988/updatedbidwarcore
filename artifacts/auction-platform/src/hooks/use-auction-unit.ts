import { useMemo } from "react";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import {
  normalizeAuctionUnit,
  auctionUnitSymbol,
  formatAuctionAmount,
  formatShortAuctionAmount,
  formatSoldForBroadcast,
  budgetFieldLabel,
  minValueFieldLabel,
  bidIncrementFieldLabel,
} from "@workspace/api-base/auction-unit";

type TournamentUnitSource = { auctionUnit?: string | null } | null | undefined;

export function resolveAuctionUnit(tournament: TournamentUnitSource): AuctionUnit {
  return normalizeAuctionUnit(tournament?.auctionUnit ?? undefined);
}

export function useAuctionUnit(tournament: TournamentUnitSource) {
  const unit = resolveAuctionUnit(tournament);
  return useMemo(
    () => ({
      unit,
      symbol: auctionUnitSymbol(unit),
      formatAmount: (amount: number | null | undefined) => formatAuctionAmount(amount, unit),
      formatShort: (amount: number | null | undefined) => formatShortAuctionAmount(amount, unit),
      formatSoldFor: (amount: number | null | undefined) => formatSoldForBroadcast(amount, unit),
      budgetLabel: budgetFieldLabel(unit),
      minValueLabel: minValueFieldLabel(unit),
      bidIncrementLabel: bidIncrementFieldLabel(unit),
    }),
    [unit],
  );
}
