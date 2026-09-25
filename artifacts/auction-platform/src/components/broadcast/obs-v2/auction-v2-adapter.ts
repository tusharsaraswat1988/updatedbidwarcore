import type { AuctionState, Player, TeamPurse as BidWarTeamPurse } from "@workspace/api-client-react";
import type { SponsorLogo as BidWarSponsorLogo } from "@/lib/sponsor-logo";
import type { BroadcastFrame as DirectorFrame } from "../director/types";
import type { AuctionFeedState } from "@/hooks/use-auction-connection-state";
import type {
  BroadcastFrame,
  BroadcastSceneId,
  SponsorLogo as LovableSponsorLogo,
  TeamPurse as LovableTeamPurse,
  BroadcastBranding,
  ScenePayload,
} from "./contracts";

export interface AdaptAuctionToBroadcastFrameOptions {
  directorFrame: DirectorFrame;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  auctionStartsAt?: string | null;
  sponsorLogos: BidWarSponsorLogo[];
  state: AuctionState | undefined;
  teamPurses: BidWarTeamPurse[] | undefined;
  soldPlayers?: Player[] | undefined;
  formatAmount: (n: number) => string;
  isStaleFeed: boolean;
  feedState: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
  performanceMode?: boolean;
  showTicker?: boolean;
}

/**
 * Splits a full tournament name (e.g. "Delhi Premier League") into
 * primary word (white italic) and accent words (gold).
 */
export function deriveBranding(
  tournamentName: string | null,
  tournamentLogoUrl: string | null,
  venue?: string | null,
): BroadcastBranding {
  const cleanName = (tournamentName || "BidWar Premier League").trim();
  const parts = cleanName.split(/\s+/);
  const firstWord = parts[0] || "BIDWAR";
  const accent = parts.slice(1).join(" ");
  const shortCode = parts.map((w) => w[0]).join("").slice(0, 4).toUpperCase() || "BPL";

  return {
    tournamentName: firstWord.toUpperCase(),
    tournamentAccent: accent ? accent.toUpperCase() : "",
    tournamentShort: shortCode,
    tournamentLogoUrl: tournamentLogoUrl || undefined,
    venue: venue || undefined,
  };
}

/**
 * Maps BidWar sponsor logos to Lovable SponsorLogo contracts.
 */
export function mapSponsors(sponsorLogos: BidWarSponsorLogo[]): LovableSponsorLogo[] {
  if (!sponsorLogos || sponsorLogos.length === 0) return [];

  return sponsorLogos.map((s, idx) => {
    const isTitle = Boolean(s.isTitleSponsor || s.priorityType === "title" || idx === 0);
    const name = s.name || s.type || `Sponsor ${idx + 1}`;
    return {
      id: s.publicId || `sponsor-${idx}`,
      name,
      logoUrl: s.url || undefined,
      tier: isTitle ? ("title" as const) : ("associate" as const),
      label: isTitle ? "Official Partner" : undefined,
    };
  });
}

/**
 * Maps BidWar team purses to Lovable TeamPurse contracts.
 */
export function mapTeamPurses(purses?: BidWarTeamPurse[]): LovableTeamPurse[] {
  if (!purses || purses.length === 0) return [];

  return purses.map((t) => {
    const purse = t.purse ?? 0;
    const used = t.purseUsed ?? 0;
    const remaining = t.purseRemaining ?? Math.max(0, purse - used);
    const bought = t.playersBought ?? 0;
    const slots = t.slotsRequired ?? 0;
    const shortCode = t.shortCode?.trim() || t.teamName?.slice(0, 3).toUpperCase() || "TBD";

    return {
      teamId: String(t.teamId),
      name: t.teamName || `Team ${t.teamId}`,
      short: shortCode,
      logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : undefined,
      purseRemaining: remaining,
      playersBought: bought,
      slotsRemaining: slots,
    };
  });
}

/**
 * Pure adapter: Transforms authoritative BidWar auction state and director frame
 * into the Lovable BroadcastFrame presentation model.
 */
export function adaptAuctionToBroadcastFrame(
  opts: AdaptAuctionToBroadcastFrameOptions,
): BroadcastFrame {
  const {
    directorFrame,
    tournamentName,
    tournamentLogoUrl,
    auctionStartsAt,
    sponsorLogos,
    state,
    teamPurses,
    soldPlayers,
    formatAmount: _formatAmount,
    isStaleFeed,
    feedState,
    secondsSinceLastActivity,
    performanceMode = false,
    showTicker = true,
  } = opts;

  const branding = deriveBranding(tournamentName, tournamentLogoUrl);
  const sponsors = mapSponsors(sponsorLogos);
  const teams = mapTeamPurses(teamPurses);

  const feedStatus: "live" | "stale" | "disconnected" =
    feedState === "disconnected"
      ? "disconnected"
      : isStaleFeed || feedState === "reconnecting"
        ? "stale"
        : "live";

  const baseFrame = {
    branding,
    sponsors,
    teams,
    settings: {
      performanceMode,
      showTicker,
    },
    feed: {
      status: feedStatus,
      secondsSinceUpdate: secondsSinceLastActivity ?? undefined,
    },
  };

  const sceneId = directorFrame.sceneId as BroadcastSceneId;

  // 1. AUCTION SCENE
  if (sceneId === "AUCTION") {
    const p = directorFrame.scene.kind === "AUCTION" ? directorFrame.scene.player : null;
    const currentPlayer = state?.currentPlayer;
    const playerName = p?.name || currentPlayer?.name || "Player on Block";
    const playerRole = p?.category || currentPlayer?.role || "Player";
    const photoUrl = p?.photoSrc || p?.photoUrl || currentPlayer?.photoUrl || undefined;
    const basePrice = currentPlayer?.basePrice ?? 0;
    const category = p?.category || currentPlayer?.role || "ON THE BLOCK";

    const currentBid = state?.currentBid ?? 0;
    const currentBidTeamId = state?.currentBidTeamId;
    const leadingTeam = currentBidTeamId
      ? teams.find((t) => t.teamId === String(currentBidTeamId))
      : undefined;

    const bidCount = directorFrame.scene.kind === "AUCTION"
      ? (directorFrame.scene.bidTimeline?.length ?? 0)
      : 0;

    const payload: ScenePayload = {
      scene: "AUCTION",
      model: {
        player: {
          id: String(currentPlayer?.id ?? "p1"),
          name: playerName,
          role: playerRole,
          photoUrl: photoUrl && !photoUrl.startsWith("data:") ? photoUrl : undefined,
          basePrice,
          category,
        },
        currentBid,
        leadingTeam,
        bidCount,
        timerSeconds: state?.timerSeconds ?? undefined,
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 2. SOLD SCENE
  if (sceneId === "SOLD") {
    const s = directorFrame.scene.kind === "SOLD" ? directorFrame.scene : null;
    const playerName = s?.player?.name || state?.currentPlayer?.name || "Sold Player";
    const playerRole = s?.player?.category || state?.currentPlayer?.role || "Player";
    const photoUrl = s?.player?.photoSrc || s?.player?.photoUrl || state?.currentPlayer?.photoUrl || undefined;
    const soldPrice = s?.soldAmount ?? state?.currentBid ?? 0;
    const teamName = s?.teamName || "Winning Team";
    const teamObj = teams.find((t) => t.name === teamName) || {
      teamId: "sold-team",
      name: teamName,
      short: teamName.slice(0, 3).toUpperCase(),
      logoUrl: s?.teamLogoSrc || undefined,
      purseRemaining: 0,
      playersBought: 0,
      slotsRemaining: 0,
    };

    const payload: ScenePayload = {
      scene: "SOLD",
      model: {
        player: {
          id: String(state?.currentPlayer?.id ?? "p1"),
          name: playerName,
          role: playerRole,
          photoUrl: photoUrl && !photoUrl.startsWith("data:") ? photoUrl : undefined,
          basePrice: 0,
        },
        soldPrice,
        team: teamObj,
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 3. UNSOLD SCENE
  if (sceneId === "UNSOLD") {
    const u = directorFrame.scene.kind === "UNSOLD" ? directorFrame.scene : null;
    const playerName = u?.player?.name || state?.currentPlayer?.name || "Unsold Player";
    const playerRole = u?.player?.category || state?.currentPlayer?.role || "Player";
    const photoUrl = u?.player?.photoSrc || u?.player?.photoUrl || state?.currentPlayer?.photoUrl || undefined;
    const basePrice = state?.currentPlayer?.basePrice ?? 0;

    const payload: ScenePayload = {
      scene: "UNSOLD",
      model: {
        player: {
          id: String(state?.currentPlayer?.id ?? "p1"),
          name: playerName,
          role: playerRole,
          photoUrl: photoUrl && !photoUrl.startsWith("data:") ? photoUrl : undefined,
          basePrice,
        },
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 4. BREAK SCENE
  if (sceneId === "BREAK") {
    const b = directorFrame.scene.kind === "BREAK" ? directorFrame.scene : null;
    const headline = b?.breakMessage || "Strategic Break";

    const payload: ScenePayload = {
      scene: "BREAK",
      model: {
        headline,
        subline: "BREAK",
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 5. SUMMARY SCENE
  if (sceneId === "SUMMARY") {
    const totalSold = state?.soldPlayersCount ?? 0;
    const totalUnsold = state?.unsoldPlayersCount ?? 0;
    const totalSpent = (teamPurses ?? []).reduce((acc, t) => acc + (t.purseUsed ?? 0), 0);

    const payload: ScenePayload = {
      scene: "SUMMARY",
      model: {
        totalSold,
        totalUnsold,
        totalSpent,
        highest: undefined,
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 6. TOP5 SCENE
  if (sceneId === "TOP5") {
    const entries = directorFrame.top5
      ? directorFrame.top5.players.slice(0, 5).map((p) => {
          const matchedTeam = teams.find((t) => t.name === p.teamName);
          const parsedPrice = parseInt(p.priceLabel.replace(/[^0-9]/g, ""), 10) || 0;
          return {
            rank: p.rank,
            playerName: p.name,
            role: "Player",
            teamShort: matchedTeam?.short || (p.teamName ? p.teamName.slice(0, 3).toUpperCase() : ""),
            price: parsedPrice,
          };
        })
      : (soldPlayers ?? [])
          .filter((p) => p.status === "sold" && (p.soldPrice ?? 0) > 0)
          .toSorted((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
          .slice(0, 5)
          .map((p, idx) => {
            const matchedTeam = teams.find((t) => t.teamId === String(p.teamId));
            return {
              rank: idx + 1,
              playerName: p.name,
              role: p.role || "Player",
              teamShort: matchedTeam?.short || "",
              price: p.soldPrice || 0,
            };
          });

    const payload: ScenePayload = {
      scene: "TOP5",
      model: {
        title: directorFrame.top5?.title || "Top Buys",
        entries,
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 7. TEAM SCENE
  if (sceneId === "TEAM" && directorFrame.team) {
    const overview = directorFrame.team;
    const teamObj = teams.find((t) => t.teamId === String(overview.teamId) || t.name === overview.name) || teams[0] || {
      teamId: String(overview.teamId),
      name: overview.name || "Team",
      short: overview.shortCode || "TEA",
      purseRemaining: 0,
      playersBought: 0,
      slotsRemaining: 0,
    };

    const squad = (soldPlayers ?? [])
      .filter((p) => p.teamId === overview.teamId)
      .map((p) => ({
        name: p.name,
        role: p.role || "Player",
        price: p.soldPrice || 0,
      }));

    const payload: ScenePayload = {
      scene: "TEAM",
      model: {
        team: teamObj,
        squad,
      },
    };

    return { ...baseFrame, ...payload };
  }

  // 8. WAITING / STANDBY (Default)
  let subline: string | undefined;
  if (auctionStartsAt) {
    try {
      const timeStr = new Date(auctionStartsAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      subline = `Starts at ${timeStr}`;
    } catch {
      subline = "Auction Resumes Shortly";
    }
  } else {
    subline = "Standby for Next Player";
  }

  const payload: ScenePayload = {
    scene: "WAITING",
    model: {
      headline: tournamentName ? `${tournamentName} Auction` : "Auction Resumes Shortly",
      subline,
    },
  };

  return { ...baseFrame, ...payload };
}
