import { useState, useEffect } from "react";

export type SportRole = { id: number; roleName: string };
export type RoleSpecGroup = { groupName: string; displayOrder: number };

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

/** Spec group labels for a role — slot order maps to legacy batting/bowling/specialization columns. */
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
      .then(async (roles) => {
        const matched = roles.find((r) => r.roleName.toLowerCase().trim() === normalizedRole);
        if (!matched || cancelled) return;
        const groups = await fetchSpecGroupsForRole(matched.id);
        if (!cancelled) {
          setSpecGroups(
            [...groups]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((g) => ({ groupName: g.groupName })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSpecGroups([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sport, role]);

  return specGroups;
}
