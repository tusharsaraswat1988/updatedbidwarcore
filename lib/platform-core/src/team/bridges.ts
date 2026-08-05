import type { ParticipantKindId } from "../competition/types.ts";
import type {
  TeamIdentity,
  TeamMember,
  TeamMemberStatusId,
} from "./types.ts";
import { resolveTeamConfiguration, type AuctionTeamRuntimeColumns } from "./configuration.ts";

/** Runtime row for AuctionTeamsBridge — never returned from product APIs. */
export type AuctionTeamBridgeRow = AuctionTeamRuntimeColumns & {
  masterTeamId?: string | null;
  ownerName?: string | null;
};

/** Assigned participant signal for membership bridge — never expose assignment ids. */
export type AuctionTeamMemberSignal = {
  participantId: string;
  participantKind: ParticipantKindId;
  displayName: string;
  /** Catalog role id when known; otherwise inferred as player / support_staff. */
  roleId?: string | null;
  /** Cosmetic runtime tags (captain, vice_captain, owner, …) — mapped to catalog roles. */
  tags?: readonly string[] | null;
  isNonPlayingMember?: boolean | null;
  status?: TeamMemberStatusId | null;
};

export type MasterTeamBrandingHint = {
  id: string;
  name?: string | null;
  shortName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

const TAG_TO_ROLE: Record<string, string> = {
  captain: "captain",
  vice_captain: "vice_captain",
  owner: "owner",
  co_owner: "owner",
  coach: "coach",
  manager: "manager",
};

function rolesFromSignal(signal: AuctionTeamMemberSignal): string[] {
  const roles = new Set<string>();
  if (signal.roleId) roles.add(signal.roleId);
  for (const tag of signal.tags ?? []) {
    const mapped = TAG_TO_ROLE[tag.toLowerCase()];
    if (mapped) roles.add(mapped);
  }
  if (signal.isNonPlayingMember) {
    roles.add("support_staff");
  }
  if (roles.size === 0) roles.add("player");
  return [...roles];
}

/** AuctionTeamsBridge → Team Identity (product). */
export function mapAuctionTeamToIdentity(row: AuctionTeamBridgeRow): TeamIdentity {
  return {
    id: String(row.id),
    tournamentId: row.tournamentId,
    typeId: row.teamTypeId ?? "competitive",
    masterTeamId: row.masterTeamId ?? null,
  };
}

/** AuctionTeamsBridge → Team Configuration (product). */
export function mapAuctionTeamToConfiguration(
  row: AuctionTeamBridgeRow,
  opts?: { planVersion?: number | null },
) {
  return resolveTeamConfiguration(row, opts);
}

/**
 * AuctionTeamsBridge → Team Members (product).
 * Never includes runtime assignment ids. Owner contacts become owner-role members.
 */
export function mapAuctionSignalsToMembers(
  team: AuctionTeamBridgeRow,
  signals: readonly AuctionTeamMemberSignal[],
): TeamMember[] {
  const members: TeamMember[] = [];

  for (const signal of signals) {
    for (const roleId of rolesFromSignal(signal)) {
      members.push({
        participant: {
          id: signal.participantId,
          kind: signal.participantKind,
          displayName: signal.displayName,
        },
        roleId,
        status: signal.status ?? "active",
      });
    }
  }

  // Bridge auction owner contact as Owner role (not a Team property).
  const ownerName = team.ownerName?.trim();
  if (ownerName) {
    const alreadyOwner = members.some((m) => m.roleId === "owner");
    if (!alreadyOwner) {
      members.push({
        participant: {
          id: `team-contact:${team.id}:owner`,
          kind: "guest",
          displayName: ownerName,
        },
        roleId: "owner",
        status: "active",
      });
    }
  }

  return members;
}

/** MasterTeamsBridge — branding enrichment hints only (never a Team Identity source). */
export function mapMasterTeamBrandingHint(
  hint: MasterTeamBrandingHint,
): {
  masterTeamId: string;
  branding: {
    primaryColor: string | null;
    secondaryColor: string | null;
    logoUrl: string | null;
  };
  displayNameHint: string | null;
  shortNameHint: string | null;
} {
  return {
    masterTeamId: hint.id,
    branding: {
      primaryColor: hint.primaryColor ?? null,
      secondaryColor: hint.secondaryColor ?? null,
      logoUrl: hint.logoUrl ?? null,
    },
    displayNameHint: hint.name ?? null,
    shortNameHint: hint.shortName ?? null,
  };
}
