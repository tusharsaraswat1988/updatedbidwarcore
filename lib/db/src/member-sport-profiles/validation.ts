import { normalizeFederationCode } from "../identity-linking/normalizer";

export const SUPPORTED_SPORTS = new Set(["cricket", "badminton"]);

export const CRICKET_ROLES = new Set([
  "player",
  "batter",
  "batsman",
  "bowler",
  "all_rounder",
  "wicket_keeper",
  "coach",
]);

export const BADMINTON_ROLES = new Set([
  "singles_player",
  "doubles_player",
  "mixed_doubles_player",
  "player",
  "coach",
]);

export const VALID_HANDEDNESS = new Set([
  "right",
  "left",
  "both",
  "ambidextrous",
  "switch",
  "r",
  "l",
]);

export function isSportSupported(sportSlug: string): boolean {
  if (!sportSlug || typeof sportSlug !== "string") return false;
  return SUPPORTED_SPORTS.has(sportSlug.trim().toLowerCase());
}

export function validateSportRole(sportSlug: string, role: string): boolean {
  if (!role || typeof role !== "string") return false;
  const normalizedRole = role.trim().toLowerCase();
  const normalizedSport = sportSlug.trim().toLowerCase();

  if (normalizedSport === "cricket") {
    return CRICKET_ROLES.has(normalizedRole);
  }
  if (normalizedSport === "badminton") {
    return BADMINTON_ROLES.has(normalizedRole);
  }
  return false;
}

export function normalizeHandedness(handedness?: string | null): string | null {
  if (!handedness) return null;
  const normalized = handedness.trim().toLowerCase();
  if (normalized === "r" || normalized === "right") return "right";
  if (normalized === "l" || normalized === "left") return "left";
  if (
    normalized === "both" ||
    normalized === "ambidextrous" ||
    normalized === "switch"
  ) {
    return "both";
  }
  return normalized;
}

export { normalizeFederationCode };
