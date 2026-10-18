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

import { deriveBranding, mapSponsors, mapTeamPurses } from "./branding";
import { effectiveTop5Price, squadAcquisitionPrice } from "@/lib/player-acquisition-price";
export { deriveBranding, mapSponsors, mapTeamPurses };

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
  // The director keeps sceneId on the auction lifecycle (AUCTION, SOLD, BREAK, …).
  // Operator Top 5 / Team Details are stored on currentContext, not sceneId.
  const presentation = directorFrame.currentContext;

  // Automatic lifecycle scenes win over an operator board. A sold hold can
  // still carry currentContext TOP5; the stamp must stay on screen.
  if (sceneId === "SOLD") {
    const s = directorFrame.scene.kind === "SOLD" ? directorFrame.scene : null;
    const playerName = s?.player?.name || state?.currentPlayer?.name || "Sold Player";
    const facts = playerBroadcastFacts(playerName, state, soldPlayers, state?.currentPlayer?.id ?? state?.outcome?.playerId);
    const playerRole = facts.role || s?.player?.category || "Player";
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
          ...(facts.age ? { age: facts.age } : {}),
          ...(facts.detail ? { detail: facts.detail } : {}),
        },
        soldPrice,
        team: teamObj,
      },
    };

    return { ...baseFrame, ...payload };
  }

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

  if (sceneId === "WAITING") {
    return { ...baseFrame, ...betweenLotsOrWaiting(state, teams, tournamentName, auctionStartsAt, soldPlayers) };
  }

  if (presentation === "TOP5" || sceneId === "TOP5") {
    const entries = directorFrame.top5
      ? directorFrame.top5.players.slice(0, 5).map((p) => {
          const matchedTeam = teams.find((t) => t.name === p.teamName);
          const record = (soldPlayers ?? []).find(
            (sp) => sp.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
          );
          const teamName = (p.teamName || matchedTeam?.name || "").trim();
          return {
            rank: p.rank,
            playerName: p.name,
            role: record?.role?.trim() || record?.specialization?.trim() || "Player",
            teamShort: matchedTeam?.short || (teamName ? teamName.slice(0, 3).toUpperCase() : ""),
            ...(teamName ? { teamName } : {}),
            price: p.price,
          };
        })
      : (soldPlayers ?? [])
          .flatMap((p) => {
            const price = effectiveTop5Price(p);
            return price == null ? [] : [{ player: p, price }];
          })
          .toSorted((a, b) => b.price - a.price)
          .slice(0, 5)
          .map(({ player, price }, idx) => {
            const matchedTeam = teams.find((t) => t.teamId === String(player.teamId));
            const teamName = matchedTeam?.name?.trim() || "";
            return {
              rank: idx + 1,
              playerName: player.name,
              role: player.role?.trim() || player.specialization?.trim() || "Player",
              teamShort: matchedTeam?.short || "",
              ...(teamName ? { teamName } : {}),
              price,
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

  if (presentation === "TEAM" || sceneId === "TEAM") {
    const overview = directorFrame.team;
    const teamObj = overview
      ? teams.find((t) => t.teamId === String(overview.teamId) || t.name === overview.name) || teams[0] || {
          teamId: String(overview.teamId),
          name: overview.name || "Team",
          short: overview.shortCode || "TEA",
          purseRemaining: 0,
          playersBought: 0,
          slotsRemaining: 0,
        }
      : {
          teamId: "none",
          name: "No teams yet",
          short: "—",
          purseRemaining: 0,
          playersBought: 0,
          slotsRemaining: 0,
        };

    const squad = overview
      ? (soldPlayers ?? [])
          .filter((p) => p.teamId === overview.teamId)
          .map((p) => ({
            name: p.name,
            role: p.role || "Player",
            price: squadAcquisitionPrice(p),
          }))
      : [];

    const payload: ScenePayload = {
      scene: "TEAM",
      model: {
        team: teamObj,
        squad,
      },
    };

    return { ...baseFrame, ...payload };
  }

  if (sceneId === "AUCTION") {
    const p = directorFrame.scene.kind === "AUCTION" ? directorFrame.scene.player : null;
    const currentPlayer = state?.currentPlayer;
    const playerName = (p?.name || currentPlayer?.name || "").trim();
    if (!playerName) {
      return { ...baseFrame, ...betweenLotsOrWaiting(state, teams, tournamentName, auctionStartsAt, soldPlayers) };
    }
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

  return { ...baseFrame, ...betweenLotsOrWaiting(state, teams, tournamentName, auctionStartsAt, soldPlayers) };
}

function playerBroadcastFacts(
  name: string,
  state: AuctionState | undefined,
  soldPlayers: Player[] | undefined,
  playerId?: number | null,
): { role: string; age?: number; detail?: string } {
  const named = name.trim().toLowerCase();
  const record =
    (playerId != null ? soldPlayers?.find((p) => p.id === playerId) : undefined) ||
    (state?.currentPlayer &&
    (state.currentPlayer.id === playerId || state.currentPlayer.name.trim().toLowerCase() === named)
      ? state.currentPlayer
      : undefined) ||
    soldPlayers?.find((p) => p.name.trim().toLowerCase() === named);
  const role = record?.role?.trim() || record?.specialization?.trim() || "Player";
  const age = typeof record?.age === "number" && record.age > 0 ? record.age : undefined;
  const style = [record?.battingStyle, record?.bowlingStyle]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  const detail = [age ? `Age ${age}` : "", style || record?.city?.trim() || ""].filter(Boolean).join(" · ");
  return { role, ...(age ? { age } : {}), ...(detail ? { detail } : {}) };
}

/**
 * After a sale or unsold, keep that result on the lower third until the next
 * player is called. The "starts at" slate is only for before the auction begins.
 */
function betweenLotsOrWaiting(
  state: AuctionState | undefined,
  teams: LovableTeamPurse[],
  tournamentName: string | null,
  auctionStartsAt: string | null | undefined,
  soldPlayers: Player[] | undefined,
): ScenePayload {
  const outcome = state?.outcome;
  const name = outcome?.playerName?.trim();
  if (outcome && name && outcome.type === "unsold") {
    return {
      scene: "UNSOLD",
      model: {
        player: {
          id: String(outcome.playerId ?? "unsold"),
          name,
          role: "Player",
          photoUrl: outcome.photoUrl && !outcome.photoUrl.startsWith("data:") ? outcome.photoUrl : undefined,
          basePrice: 0,
        },
      },
    };
  }
  if (outcome && name && outcome.type === "sold") {
    const facts = playerBroadcastFacts(name, state, soldPlayers, outcome.playerId);
    const teamName = outcome.teamName || "Winning Team";
    const teamObj = teams.find((t) => t.name === teamName) || {
      teamId: String(outcome.teamId ?? "sold-team"),
      name: teamName,
      short: teamName.slice(0, 3).toUpperCase(),
      logoUrl: outcome.teamLogoUrl || undefined,
      purseRemaining: 0,
      playersBought: 0,
      slotsRemaining: 0,
    };
    return {
      scene: "SOLD",
      model: {
        player: {
          id: String(outcome.playerId ?? "sold"),
          name,
          role: facts.role,
          photoUrl: outcome.photoUrl && !outcome.photoUrl.startsWith("data:") ? outcome.photoUrl : undefined,
          basePrice: 0,
          ...(facts.age ? { age: facts.age } : {}),
          ...(facts.detail ? { detail: facts.detail } : {}),
        },
        soldPrice: outcome.amount ?? 0,
        team: teamObj,
      },
    };
  }
  const auctionHasStarted = (state?.soldPlayersCount ?? 0) > 0 || (state?.unsoldPlayersCount ?? 0) > 0;
  if (auctionHasStarted) {
    return {
      scene: "WAITING",
      model: {
        headline: tournamentName ? `${tournamentName} Auction` : "Next player",
        subline: "Next player shortly",
      },
    };
  }
  return waitingPayload(tournamentName, auctionStartsAt);
}

function waitingPayload(
  tournamentName: string | null,
  auctionStartsAt: string | null | undefined,
): ScenePayload {
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

  return {
    scene: "WAITING",
    model: {
      headline: tournamentName ? `${tournamentName} Auction` : "Auction Resumes Shortly",
      subline,
    },
  };
}
