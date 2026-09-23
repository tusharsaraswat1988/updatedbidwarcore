export const VALID_PARTICIPATION_ROLES = new Set([
  "organizer",
  "player",
  "scorer",
  "umpire",
  "referee",
  "match_official",
  "official",
  "coach",
  "team_manager",
  "team_owner",
  "owner",
  "fan",
  "live_streamer",
  "associate",
  "mentor",
]);

export const VALID_PARTICIPATION_STATUSES = new Set([
  "active",
  "invited",
  "pending",
  "suspended",
  "withdrawn",
  "disqualified",
  "completed",
  "removed",
]);

export const ACTIVE_PARTICIPATION_STATUSES = new Set(["active"]);

export function validateParticipationRole(role: string): boolean {
  if (!role || typeof role !== "string") return false;
  return VALID_PARTICIPATION_ROLES.has(role.trim().toLowerCase());
}

export function validateParticipationStatus(status: string): boolean {
  if (!status || typeof status !== "string") return false;
  return VALID_PARTICIPATION_STATUSES.has(status.trim().toLowerCase());
}

export function isActiveParticipation(status: string): boolean {
  if (!status || typeof status !== "string") return false;
  return ACTIVE_PARTICIPATION_STATUSES.has(status.trim().toLowerCase());
}
