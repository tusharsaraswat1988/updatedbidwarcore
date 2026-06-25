import type { AuctionReadinessCheckId } from "@workspace/api-base/auction-readiness";

export type SettingsTab = "identity" | "playerRegistration" | "auction" | "sponsors" | "broadcast" | "recovery";

export type SettingsFocusField =
  | "minBid"
  | "openingTimer"
  | "bidTimer"
  | "playerOrder"
  | "bidTiers"
  | "minSquad"
  | "maxSquad"
  | "registration";

export function settingsPath(
  tournamentId: number,
  tab?: SettingsTab,
  focus?: SettingsFocusField,
): string {
  const base = `/tournament/${tournamentId}/settings`;
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (focus) params.set("focus", focus);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

const READINESS_TO_SETTINGS: Partial<Record<AuctionReadinessCheckId, SettingsFocusField>> = {
  minBid: "minBid",
  openingTimer: "openingTimer",
  bidTimer: "bidTimer",
  playerOrder: "playerOrder",
  bidTiers: "bidTiers",
  minSquad: "minSquad",
};

export function readinessFixPath(tournamentId: number, checkId: AuctionReadinessCheckId): string {
  if (checkId === "teams") return `/tournament/${tournamentId}/teams`;
  if (checkId === "players") return `/tournament/${tournamentId}/players`;
  const focus = READINESS_TO_SETTINGS[checkId];
  return focus ? settingsPath(tournamentId, "auction", focus) : settingsPath(tournamentId, "auction");
}
