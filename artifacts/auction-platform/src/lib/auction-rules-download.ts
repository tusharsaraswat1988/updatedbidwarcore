import { evaluateAuctionRulesPdfReady, type AuctionRulesPdfGateInput } from "@workspace/api-base";

export type DownloadAuctionRulesResult = {
  success: boolean;
  error?: string;
};

export async function downloadAuctionRulesPdf(
  tournament: {
    id: number;
    name: string;
    auctionRulesPdfReady?: boolean;
    auctionRulesPdfBlockedReason?: string | null;
  } & Partial<AuctionRulesPdfGateInput>,
): Promise<DownloadAuctionRulesResult> {
  // If client-side gate input is provided (has basePurse or minBid):
  if (tournament.basePurse !== undefined) {
    const gate = evaluateAuctionRulesPdfReady(tournament as AuctionRulesPdfGateInput);
    if (!gate.ready) {
      return {
        success: false,
        error: gate.blockedReason || "Complete Auction Rules in Settings first.",
      };
    }
  } else if (tournament.auctionRulesPdfReady === false && tournament.auctionRulesPdfBlockedReason) {
    return {
      success: false,
      error: tournament.auctionRulesPdfBlockedReason,
    };
  }

  const endpoint = `/api/tournaments/${tournament.id}/auction-rules.pdf`;
  const fetchUrl = typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}${endpoint}`
    : `http://localhost:5173${endpoint}`;

  const response = await fetch(fetchUrl, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("Sign in again to download auction rules.");
    }
    const err = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.status === 409) {
      return {
        success: false,
        error: err?.error || tournament.auctionRulesPdfBlockedReason || "Complete Auction Rules in Settings first.",
      };
    }
    throw new Error(err?.error || `Couldn't download PDF (${response.status})`);
  }

  const blob = await response.blob();
  const cd = response.headers.get("Content-Disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/);
  const filename = m?.[1] || `${tournament.name.replace(/[^a-zA-Z0-9]+/g, "_")}_Auction_Rules.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}
