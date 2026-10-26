import type { BroadcastFrame, SponsorLogo } from "../contracts";
import { formatAmount } from "../format";
import { splitBroadcastSponsors } from "../branding";

/** How long the operator must be quiet before the patti replays older lines. */
export const PATTI_IDLE_MS = 18_000;
/** How long a finished line stays before an idle replay may advance. */
export const PATTI_HOLD_MS = 5_500;
export const PATTI_CHAR_MS = 26;

export type PattiLine = {
  id: string;
  text: string;
  tone?: "sold" | "unsold";
  name?: string;
  amount?: string;
};

export function sponsorTypeLabel(sponsor: SponsorLogo): string {
  const label = sponsor.label?.trim();
  if (label) return label.toUpperCase();
  if (sponsor.tier === "title") return "TITLE SPONSOR";
  if (sponsor.tier === "co") return "CO SPONSOR";
  if (sponsor.tier === "live_streaming") return "LIVE STREAMING PARTNER";
  return "SPONSOR";
}

export function sponsorGlow(sponsor: SponsorLogo): "title" | "co" | "none" {
  if (sponsor.tier === "title" || sponsor.tier === "live_streaming") return "title";
  if (sponsor.tier === "co") return "co";
  return "none";
}

/**
 * Header-right slot.
 * Live Streaming Partner owns it. With none selected, title and co-sponsors take the slot.
 */
export function headerRightSponsors(sponsors: SponsorLogo[]): {
  mode: "live" | "featured" | "empty";
  items: SponsorLogo[];
} {
  const { liveStreaming, explicitTitle, coSponsors } = splitBroadcastSponsors(sponsors);
  if (liveStreaming && (liveStreaming.name || liveStreaming.logoUrl)) {
    return { mode: "live", items: [liveStreaming] };
  }
  const featured = [
    ...(explicitTitle && (explicitTitle.name || explicitTitle.logoUrl) ? [explicitTitle] : []),
    ...coSponsors.filter((s) => s.name || s.logoUrl),
  ];
  if (featured.length) return { mode: "featured", items: featured };
  return { mode: "empty", items: [] };
}

/** Sponsors that fade above the lower third. The header live-streaming slot is not repeated here. */
export function fadeSponsors(sponsors: SponsorLogo[]): SponsorLogo[] {
  return sponsors.filter((s) => s.tier !== "live_streaming" && (s.name || s.logoUrl));
}

export function auctionActivityKey(frame: BroadcastFrame): string {
  switch (frame.scene) {
    case "AUCTION":
      return [
        "auction",
        frame.model.player.id,
        frame.model.player.name,
        frame.model.currentBid,
        frame.model.leadingTeam?.teamId ?? "",
        frame.model.bidCount,
        frame.model.timerSeconds ?? "",
      ].join(":");
    case "SOLD":
      return `sold:${frame.model.player.name}:${frame.model.soldPrice}:${frame.model.team.teamId}`;
    case "UNSOLD":
      return `unsold:${frame.model.player.name}:${frame.model.player.basePrice}`;
    case "TEAM":
      return `team:${frame.model.team.teamId}:${frame.model.squad.length}:${frame.model.team.purseRemaining}`;
    case "TOP5":
      return `top5:${frame.model.entries.map((e) => `${e.rank}:${e.playerName}`).join("|")}`;
    case "SUMMARY":
      return `summary:${frame.model.totalSold}:${frame.model.totalUnsold}:${frame.model.totalSpent}`;
    case "BREAK":
      return `break:${frame.model.headline}:${frame.model.subline ?? ""}`;
    case "WAITING":
      return `waiting:${frame.model.headline}:${frame.model.subline ?? ""}`;
    case "CRICKET":
      return `cricket:${frame.model.runs}:${frame.model.wickets}:${frame.model.overs}`;
  }
}

/**
 * Current operator result, written onto the bottom line.
 * `priorUnsoldNames` is the lowercase names already recorded, not including this event.
 */
export function buildPattiLine(frame: BroadcastFrame, priorUnsoldNames: string[]): PattiLine | null {
  if (frame.scene === "SOLD") {
    const name = frame.model.player.name.trim() || "Player";
    const price = frame.model.soldPrice;
    const amount = formatAmount(price);
    return {
      id: `sold:${name.toLowerCase()}:${price}`,
      tone: "sold",
      name,
      amount,
      text: `${name} SOLD AT ${amount}`,
    };
  }
  if (frame.scene === "UNSOLD") {
    const name = frame.model.player.name.trim() || "Player";
    const key = name.toLowerCase();
    const previous = priorUnsoldNames.filter((n) => n === key).length;
    return {
      id: `unsold:${key}:${previous + 1}`,
      text: previous === 0 ? `${name} goes unsold for the first time` : `${name} goes unsold again`,
    };
  }
  return null;
}

export function pattiFallback(frame: BroadcastFrame): string {
  return [frame.branding.tournamentName, frame.branding.tournamentAccent].filter(Boolean).join(" ").trim();
}
