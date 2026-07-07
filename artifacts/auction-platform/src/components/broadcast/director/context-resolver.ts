import type { Player, TeamPurse } from "@workspace/api-client-react";
import type {
  BroadcastCurrentContext,
  PresentationContext,
} from "@/lib/presentation-context";
import {
  DEFAULT_PRESENTATION_CONTEXT,
  parsePresentationContext,
  presentationContextToBroadcast,
} from "@/lib/presentation-context";
import type { BroadcastSceneId } from "../types";
import type { DirectorContext } from "./types";

export type Top5PlayerModel = {
  rank: number;
  name: string;
  photoSrc: string | null;
  teamLogoSrc: string | null;
  teamName: string | null;
  teamAccentColor: string | null;
  priceLabel: string;
};

export type Top5SceneModel = {
  kind: "TOP5";
  title: string;
  players: Top5PlayerModel[];
};

export type TeamOverviewModel = {
  kind: "TEAM";
  teamId: number;
  name: string;
  shortCode: string;
  logoSrc: string | null;
  accentColor: string;
  remainingPurseLabel: string;
  playersBoughtLabel: string;
  captainName: string | null;
  coachName: string | null;
  cycleTeams: boolean;
  teamIds: number[];
};

export function buildTop5Players(
  players: Player[] | undefined,
  teamPurses: TeamPurse[] | undefined,
  formatAmount: (n: number) => string,
  resolvePhotoSrc: DirectorContext["resolvePhotoSrc"],
): Top5PlayerModel[] {
  const teamMap = new Map((teamPurses ?? []).map((t) => [t.teamId, t]));
  return (players ?? [])
    .filter((p) => p.status === "sold" && (p.soldPrice ?? 0) > 0)
    .toSorted((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0) || a.id - b.id)
    .slice(0, 5)
    .map((p, idx) => {
      const team = p.teamId ? teamMap.get(p.teamId) : undefined;
      return {
        rank: idx + 1,
        name: p.name,
        photoSrc: resolvePhotoSrc(p.photoUrl, "playerCard"),
        teamLogoSrc: resolvePhotoSrc(team?.logoUrl ?? null, "teamLogo"),
        teamName: team?.teamName ?? null,
        teamAccentColor: team?.color ?? null,
        priceLabel: formatAmount(p.soldPrice ?? 0),
      };
    });
}

function findCaptainName(players: Player[] | undefined, teamId: number): string | null {
  const tagged = (players ?? []).find(
    (p) => p.teamId === teamId && p.status === "sold" && p.playerTag === "captain",
  );
  if (tagged) return tagged.name;
  const roleMatch = (players ?? []).find(
    (p) =>
      p.teamId === teamId &&
      p.status === "sold" &&
      typeof p.role === "string" &&
      /captain/i.test(p.role),
  );
  return roleMatch?.name ?? null;
}

function findCoachName(players: Player[] | undefined, teamId: number): string | null {
  const coach = (players ?? []).find(
    (p) =>
      p.teamId === teamId &&
      p.status === "sold" &&
      typeof p.role === "string" &&
      /coach/i.test(p.role),
  );
  return coach?.name ?? null;
}

export function buildTeamOverviewModel(
  ctx: DirectorContext,
  selectedTeamId: number | null,
): TeamOverviewModel | null {
  const purses = ctx.teamPurses ?? [];
  if (purses.length === 0) return null;

  const teamIds = purses.map((t) => t.teamId);
  const targetId = selectedTeamId && teamIds.includes(selectedTeamId) ? selectedTeamId : teamIds[0];
  const team = purses.find((t) => t.teamId === targetId);
  if (!team) return null;

  const maxSquad = team.maximumSquadSize ?? 0;
  const boughtLabel =
    maxSquad > 0 ? `${team.playersBought} / ${maxSquad}` : String(team.playersBought);

  return {
    kind: "TEAM",
    teamId: team.teamId,
    name: team.teamName,
    shortCode: team.shortCode,
    logoSrc: ctx.resolvePhotoSrc(team.logoUrl ?? null, "teamLogo"),
    accentColor: team.color ?? "#facc15",
    remainingPurseLabel: ctx.formatAmount(team.spendablePurse ?? team.purseRemaining ?? 0),
    playersBoughtLabel: boughtLabel,
    captainName: findCaptainName(ctx.soldPlayers, team.teamId),
    coachName: findCoachName(ctx.soldPlayers, team.teamId),
    cycleTeams: selectedTeamId == null,
    teamIds,
  };
}

export function buildAllTeamOverviewModels(ctx: DirectorContext): TeamOverviewModel[] {
  const purses = ctx.teamPurses ?? [];
  return purses
    .map((team) => buildTeamOverviewModel(ctx, team.teamId))
    .filter((m): m is TeamOverviewModel => m != null);
}

/**
 * Auction-driven scenes (break/waiting/summary) override explicit presentation.
 * Otherwise the operator's chosen presentation context drives the lower-third.
 */
export function resolveCurrentContext(
  sceneId: BroadcastSceneId,
  presentation: PresentationContext,
): BroadcastCurrentContext {
  if (sceneId === "BREAK") return "BREAK";
  if (sceneId === "WAITING") return "WAITING";
  if (sceneId === "SUMMARY") return "SUMMARY";
  return presentationContextToBroadcast(presentation.context);
}

export function resolvePresentationContext(raw: unknown): PresentationContext {
  return parsePresentationContext(raw);
}

export { DEFAULT_PRESENTATION_CONTEXT };
export type { BroadcastCurrentContext, PresentationContext };
