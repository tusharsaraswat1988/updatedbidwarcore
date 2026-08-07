import { evaluateAuctionRulesPdfReady } from "@workspace/auction/auction-rules-pdf";

type OrganizerListTournamentSource = {
  id: number;
  name: string;
  sport: string;
  status: string;
  licenseStatus: string;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  createdAt: Date;
  basePurse: number;
  minBid: number;
  timerSeconds: number;
  bidTimerSeconds: number;
  minimumSquadSize: number;
  bidTiers: string | null;
  bidTier1UpTo: number;
  bidTier1Increment: number;
  bidTier2UpTo: number;
  bidTier2Increment: number;
  bidTier3Increment: number;
};

export function toOrganizerTournamentListItem(t: OrganizerListTournamentSource) {
  const gate = evaluateAuctionRulesPdfReady(t);
  return {
    id: t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    licenseStatus: t.licenseStatus,
    city: t.city ?? null,
    venue: t.venue ?? null,
    auctionDate: t.auctionDate ?? null,
    auctionTime: t.auctionTime ?? null,
    createdAt: t.createdAt.toISOString(),
    auctionRulesPdfReady: gate.ready,
    auctionRulesPdfBlockedReason: gate.blockedReason,
  };
}
