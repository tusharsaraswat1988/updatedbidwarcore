import type { ComponentType } from "react";
import type { MobileRoleId } from "@workspace/api-base/mobile-app-urls";

/**
 * Role module contract — each role owns its auth flow, session, and navigation stack.
 * Auth systems stay isolated; only branding and role selection are shared.
 */
export type RoleModule = {
  id: MobileRoleId;
  label: string;
  description: string;
  /** Wouter path prefix inside mobile-app base (e.g. "/organizer"). */
  pathPrefix: string;
  /** Default login route relative to mobile-app base. */
  loginRoute: string;
  /** Default post-auth route relative to mobile-app base. */
  homeRoute: string;
  /** Future roles register here without changing the shell architecture. */
  enabled: boolean;
};

export const ROLE_MODULES: RoleModule[] = [
  {
    id: "organizer",
    label: "Organizer",
    description: "Manage tournaments, teams, and live auctions",
    pathPrefix: "/organizer",
    loginRoute: "/organizer/login",
    homeRoute: "/organizer/dashboard",
    enabled: true,
  },
  {
    id: "team-owner",
    label: "Team Owner",
    description: "Join auctions and bid for your team",
    pathPrefix: "/team-owner",
    loginRoute: "/team-owner/login",
    homeRoute: "/team-owner/login",
    enabled: true,
  },
];

export function getRoleModule(id: MobileRoleId): RoleModule | undefined {
  return ROLE_MODULES.find((r) => r.id === id && r.enabled);
}

export function getEnabledRoles(): RoleModule[] {
  return ROLE_MODULES.filter((r) => r.enabled);
}

export type RoleStackProps = {
  onSwitchRole: () => void;
};

export type RoleStackComponent = ComponentType<RoleStackProps>;
