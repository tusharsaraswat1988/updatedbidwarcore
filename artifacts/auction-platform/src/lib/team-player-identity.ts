/**
 * Team → Player identity helpers for auction-first scoring UI.
 * Display-only — does not change scoring, pairing, or match lifecycle.
 */

import {
  resolveFranchiseLogoUrl,
  resolveFranchiseName,
  type BadmintonSideInfo,
  type FranchiseFields,
} from "@workspace/badminton-core";

export type TeamPlayerIdentity = {
  /** Player or pair display name. */
  playerName: string;
  /** Auction franchise / team name when present. */
  teamName?: string | null;
  teamLogoUrl?: string | null;
  /** Optional brand colour (hex). Falls back to generated badge colour. */
  teamColor?: string | null;
};

export type FranchiseLookup = {
  franchiseName?: string | null;
  franchiseLogoUrl?: string | null;
  teamColor?: string | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
};

const BADGE_PALETTE = [
  "#E11D48",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0891B2",
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#0D9488",
  "#4F46E5",
] as const;

/** Stable colour from a team name when no teamColor is stored. */
export function badgeColorFromTeamName(teamName: string): string {
  const s = teamName.trim();
  if (!s) return BADGE_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return BADGE_PALETTE[Math.abs(hash) % BADGE_PALETTE.length];
}

export function hasTeamIdentity(identity: TeamPlayerIdentity | null | undefined): boolean {
  return Boolean(identity?.teamName?.trim());
}

export function teamInitials(teamName: string): string {
  const parts = teamName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function resolveTeamColor(identity: TeamPlayerIdentity): string | undefined {
  const named = identity.teamColor?.trim();
  if (named) return named;
  const team = identity.teamName?.trim();
  if (!team) return undefined;
  return badgeColorFromTeamName(team);
}

/** Single-line label: "Warriors · Rohit Sharma" or player-only fallback. */
export function formatTeamPlayerLine(identity: TeamPlayerIdentity): string {
  const player = identity.playerName?.trim() || "—";
  const team = identity.teamName?.trim();
  return team ? `${team} · ${player}` : player;
}

/** VS line for lists / titles when a full card is not used. */
export function formatTeamPlayerVsLine(
  left: TeamPlayerIdentity,
  right: TeamPlayerIdentity,
): string {
  return `${formatTeamPlayerLine(left)} vs ${formatTeamPlayerLine(right)}`;
}

export function identityFromFranchiseFields(
  playerName: string,
  fields?: FranchiseFields | null,
  teamColor?: string | null,
): TeamPlayerIdentity {
  return {
    playerName: playerName.trim() || "—",
    teamName: fields ? resolveFranchiseName(fields) ?? null : null,
    teamLogoUrl: fields ? resolveFranchiseLogoUrl(fields) ?? null : null,
    teamColor: teamColor ?? (fields as { teamColor?: string } | null | undefined)?.teamColor ?? null,
  };
}

/** Build identity from a match side (live state / control / broadcast). */
export function identityFromSideInfo(
  side: BadmintonSideInfo | null | undefined,
  opts?: { preferShort?: boolean },
): TeamPlayerIdentity {
  if (!side) {
    return { playerName: "—" };
  }
  const playerName = opts?.preferShort
    ? side.shortLabel?.trim() || side.label?.trim() || "—"
    : side.label?.trim() || side.shortLabel?.trim() || "—";
  return {
    playerName,
    teamName: resolveFranchiseName(side) ?? null,
    teamLogoUrl: resolveFranchiseLogoUrl(side) ?? null,
    teamColor: side.teamColor ?? null,
  };
}

/** Loose side shape used by control-center match rows. */
export function identityFromLooseSide(
  side:
    | {
        shortLabel?: string;
        label?: string;
        franchiseName?: string;
        franchiseLogoUrl?: string;
        teamName?: string;
        teamLogoUrl?: string;
        teamColor?: string;
        flagUrl?: string;
      }
    | null
    | undefined,
): TeamPlayerIdentity {
  if (!side) return { playerName: "—" };
  const playerName = side.shortLabel?.trim() || side.label?.trim() || "—";
  return {
    playerName,
    teamName: resolveFranchiseName(side) ?? null,
    teamLogoUrl: resolveFranchiseLogoUrl(side) ?? null,
    teamColor: side.teamColor ?? null,
  };
}

export function identityFromOrganizerPlayer(player: {
  displayName?: string | null;
  firstName?: string;
  lastName?: string;
  franchiseName?: string | null;
  franchiseLogoUrl?: string | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  teamColor?: string | null;
}): TeamPlayerIdentity {
  const playerName =
    player.displayName?.trim() ||
    `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() ||
    "—";
  return {
    playerName,
    teamName: player.franchiseName?.trim() || player.teamName?.trim() || null,
    teamLogoUrl: player.franchiseLogoUrl?.trim() || player.teamLogoUrl?.trim() || null,
    teamColor: player.teamColor ?? null,
  };
}

/**
 * Registration / fixture side: player names + franchise lookup by player id.
 * Standalone tournaments (no franchise map hits) stay player-only.
 */
export function identityFromRegistrationPlayers(
  players: Array<{
    id?: number;
    firstName?: string;
    lastName?: string;
    displayName?: string | null;
    franchiseName?: string | null;
    franchiseLogoUrl?: string | null;
  } | null>,
  franchiseByPlayerId?: Map<number, FranchiseLookup>,
): TeamPlayerIdentity {
  const named = players.filter(Boolean) as NonNullable<(typeof players)[number]>[];
  const playerName =
    named
      .map((p) => p.displayName?.trim() || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim())
      .filter(Boolean)
      .join(" / ") || "TBD";

  let teamName: string | null = null;
  let teamLogoUrl: string | null = null;
  let teamColor: string | null = null;

  for (const p of named) {
    const fromRow = p.franchiseName?.trim() || null;
    const fromMap = p.id != null ? franchiseByPlayerId?.get(p.id) : undefined;
    const resolved =
      fromRow ||
      fromMap?.franchiseName?.trim() ||
      fromMap?.teamName?.trim() ||
      null;
    if (resolved) {
      teamName = resolved;
      teamLogoUrl =
        p.franchiseLogoUrl?.trim() ||
        fromMap?.franchiseLogoUrl?.trim() ||
        fromMap?.teamLogoUrl?.trim() ||
        null;
      teamColor = fromMap?.teamColor?.trim() || null;
      break;
    }
  }

  // Prefer a shared franchise when both partners share the same team.
  if (named.length >= 2 && franchiseByPlayerId) {
    const names = named.map((p) => {
      const mapped = p.id != null ? franchiseByPlayerId.get(p.id) : undefined;
      return (
        p.franchiseName?.trim() ||
        mapped?.franchiseName?.trim() ||
        mapped?.teamName?.trim() ||
        null
      );
    });
    if (names[0] && names.every((n) => n === names[0])) {
      teamName = names[0];
      const first = named[0];
      const mapped = first.id != null ? franchiseByPlayerId.get(first.id) : undefined;
      teamLogoUrl =
        first.franchiseLogoUrl?.trim() ||
        mapped?.franchiseLogoUrl?.trim() ||
        mapped?.teamLogoUrl?.trim() ||
        null;
      teamColor = mapped?.teamColor?.trim() || null;
    }
  }

  return { playerName, teamName, teamLogoUrl, teamColor };
}

/** Parse "Team · Player" labels produced by server/helpers back into identity. */
export function identityFromCombinedLabel(label: string): TeamPlayerIdentity {
  const trimmed = label.trim();
  if (!trimmed) return { playerName: "—" };
  const sep = " · ";
  const idx = trimmed.indexOf(sep);
  if (idx <= 0) return { playerName: trimmed };
  return {
    teamName: trimmed.slice(0, idx).trim() || null,
    playerName: trimmed.slice(idx + sep.length).trim() || trimmed,
  };
}

export function buildFranchiseLookupFromPlayers(
  players: Array<{
    id: number;
    franchiseName?: string | null;
    franchiseLogoUrl?: string | null;
    teamName?: string | null;
    teamLogoUrl?: string | null;
    teamColor?: string | null;
  }>,
): Map<number, FranchiseLookup> {
  const map = new Map<number, FranchiseLookup>();
  for (const p of players) {
    if (!p.franchiseName?.trim() && !p.teamName?.trim()) continue;
    map.set(p.id, {
      franchiseName: p.franchiseName,
      franchiseLogoUrl: p.franchiseLogoUrl,
      teamName: p.teamName,
      teamLogoUrl: p.teamLogoUrl,
      teamColor: p.teamColor,
    });
  }
  return map;
}
