import type { MemberRole } from "../schema/member-roles";
import type { MemberCapabilityContext } from "./types";

/**
 * Standard capability mappings per role.
 */
export const ROLE_CAPABILITIES_MAP: Record<string, string[]> = {
  admin: ["*"],
  master_admin: ["*"],
  organizer: [
    "tournament:create",
    "tournament:manage",
    "tournament:delete",
    "auction:manage",
    "team:manage",
    "player:import",
    "scorer:assign",
    "rule:configure",
    "license:request",
  ],
  scorer: [
    "scoring:live",
    "match:lock",
    "toss:record",
    "score:submit",
    "match:view",
  ],
  player: [
    "profile:view",
    "profile:edit",
    "participation:view",
    "stats:view",
  ],
  team_owner: [
    "auction:bid",
    "team:roster_view",
    "push:receive",
    "team:edit",
  ],
  owner: [
    "auction:bid",
    "team:roster_view",
    "push:receive",
    "team:edit",
  ],
  coach: [
    "team:roster_view",
    "team:squad_manage",
    "match:view",
  ],
  mentor: [
    "team:roster_view",
    "team:squad_manage",
    "match:view",
  ],
  team_manager: [
    "team:roster_view",
    "team:squad_manage",
    "match:view",
  ],
  umpire: [
    "match:officiate",
    "match:view",
  ],
  referee: [
    "match:officiate",
    "match:view",
  ],
  match_official: [
    "match:officiate",
    "match:view",
  ],
};

/**
 * Normalizes a role name to canonical vocabulary.
 * Maps legacy or variant role names like 'owner' -> 'team_owner'.
 */
export function normalizeRoleName(role: string): string {
  const normalized = (role || "").trim().toLowerCase();
  if (normalized === "owner") {
    return "team_owner";
  }
  return normalized;
}

/**
 * Resolves aggregated capabilities for a list of member roles.
 * Optionally evaluates scope constraints (global, tournament, team, match).
 */
export function resolveMemberCapabilities(
  roles: MemberRole[],
  context?: MemberCapabilityContext,
): string[] {
  const capabilitySet = new Set<string>();

  for (const roleRow of roles) {
    if (!isRoleActiveForContext(roleRow, context)) {
      continue;
    }

    const normalizedRole = normalizeRoleName(roleRow.role);
    const caps = ROLE_CAPABILITIES_MAP[normalizedRole] || [];
    for (const cap of caps) {
      capabilitySet.add(cap);
    }
  }

  return Array.from(capabilitySet);
}

/**
 * Checks if a specific role row is applicable to the current context.
 */
export function isRoleActiveForContext(
  roleRow: MemberRole,
  context?: MemberCapabilityContext,
): boolean {
  // Global scope applies everywhere
  if (roleRow.scope === "global" || !roleRow.scope) {
    return true;
  }

  // Tournament boundary check
  if (roleRow.tournamentId != null && context?.tournamentId != null) {
    if (roleRow.tournamentId !== context.tournamentId) {
      return false;
    }
  }

  // Team scope / boundary check
  if (roleRow.scope === "team" || roleRow.teamId != null) {
    if (context?.teamId != null && roleRow.teamId != null) {
      if (roleRow.teamId !== context.teamId) {
        return false;
      }
    }
    if (roleRow.scope === "team") {
      return true;
    }
  }

  // Match scope / boundary check
  if (roleRow.scope === "match" || roleRow.matchId != null) {
    if (context?.matchId != null && roleRow.matchId != null) {
      if (roleRow.matchId !== context.matchId) {
        return false;
      }
    }
    if (roleRow.scope === "match") {
      return true;
    }
  }

  // Tournament scope
  if (roleRow.scope === "tournament") {
    if (!context?.tournamentId) return true; // generic tournament context
    return roleRow.tournamentId === context.tournamentId;
  }

  return false;
}

/**
 * Check if a set of capabilities grants the requested permission.
 * Supports wildcard matching (e.g. '*' or 'tournament:*').
 */
export function checkCapability(capabilities: string[], requestedCapability: string): boolean {
  if (capabilities.includes("*")) {
    return true;
  }

  if (capabilities.includes(requestedCapability)) {
    return true;
  }

  const [domain] = requestedCapability.split(":");
  if (domain && capabilities.includes(`${domain}:*`)) {
    return true;
  }

  return false;
}
