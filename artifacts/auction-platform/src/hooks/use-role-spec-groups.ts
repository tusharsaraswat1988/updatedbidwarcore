import { useState, useEffect, useMemo } from "react";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type SportRole = { id: number; roleName: string };
export type RoleSpecGroup = { groupName: string; displayOrder: number };

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchRolesForSport(sport: string): Promise<SportRole[]> {
  const res = await fetch(`/api/sports/by-slug/${encodeURIComponent(sport.toLowerCase().trim())}/roles`);
  if (!res.ok) throw new Error(`Failed to fetch roles for sport "${sport}": ${res.status}`);
  return res.json() as Promise<SportRole[]>;
}

async function fetchSpecGroupsForRole(roleId: number): Promise<RoleSpecGroup[]> {
  const res = await fetch(`/api/sports/roles/${roleId}/specs`);
  if (!res.ok) throw new Error(`Failed to fetch spec groups for role ${roleId}: ${res.status}`);
  return res.json() as Promise<RoleSpecGroup[]>;
}

// ─── useRoleSpecGroups ────────────────────────────────────────────────────────
// Fetches spec group names for a single role.
// Returns an array ordered by displayOrder — slot 0 maps to battingStyle,
// slot 1 to bowlingStyle, slot 2 to specialization.

export function useRoleSpecGroups(
  sport: string | undefined,
  role: string | undefined | null,
): { groupName: string }[] {
  const [specGroups, setSpecGroups] = useState<{ groupName: string }[]>([]);

  useEffect(() => {
    if (!sport || !role) {
      setSpecGroups([]);
      return;
    }
    let cancelled = false;
    const normalizedRole = role.toLowerCase().trim();

    fetchRolesForSport(sport)
      .then(async roles => {
        const matched = roles.find(r => r.roleName.toLowerCase().trim() === normalizedRole);
        if (!matched || cancelled) return;
        const groups = await fetchSpecGroupsForRole(matched.id);
        if (!cancelled) {
          setSpecGroups(
            [...groups]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(g => ({ groupName: g.groupName })),
          );
        }
      })
      .catch(err => {
        console.error("[useRoleSpecGroups]", err);
        if (!cancelled) setSpecGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sport, role]);

  return specGroups;
}

// ─── useRoleSpecMap ───────────────────────────────────────────────────────────
// Fetches spec group names for every unique role present in a player list.
// Returns a Map<roleName, { groupName: string }[]> ordered by displayOrder.
// Suitable for the player list page where many roles may be present at once.

export function useRoleSpecMap(
  sport: string | undefined,
  players: { role?: string | null }[],
): Map<string, { groupName: string }[]> {
  const [roleSpecMap, setRoleSpecMap] = useState<Map<string, { groupName: string }[]>>(new Map());

  const uniqueRolesKey = useMemo(() => {
    const roles = [...new Set(players.map(p => p.role).filter((r): r is string => Boolean(r)))].sort();
    return roles.join("|");
  }, [players]);

  useEffect(() => {
    if (!sport || !uniqueRolesKey) {
      setRoleSpecMap(new Map());
      return;
    }
    let cancelled = false;

    fetchRolesForSport(sport)
      .then(async roles => {
        const wantedRoles = uniqueRolesKey.split("|").map(r => r.toLowerCase().trim());
        const relevant = roles.filter(r => wantedRoles.includes(r.roleName.toLowerCase().trim()));
        const entries = await Promise.all(
          relevant.map(async role => {
            const groups = await fetchSpecGroupsForRole(role.id);
            const sorted = [...groups]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(g => ({ groupName: g.groupName }));
            // Store keys as lowercase+trimmed so callers can look up by
            // raw player.role values without case/whitespace mismatch.
            return [role.roleName.toLowerCase().trim(), sorted] as [string, { groupName: string }[]];
          }),
        );
        if (!cancelled) setRoleSpecMap(new Map(entries));
      })
      .catch(err => {
        console.error("[useRoleSpecMap]", err);
        if (!cancelled) setRoleSpecMap(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [sport, uniqueRolesKey]);

  return roleSpecMap;
}
