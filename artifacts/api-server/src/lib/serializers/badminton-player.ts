/**
 * Strip contact PII from a badminton player row (or list item that spreads one).
 * Used on unauthenticated / public badminton read paths.
 */

type WithContact = { mobile?: string | null; email?: string | null };

export function publicBadmintonPlayerSerializer<T extends WithContact>(
  player: T,
): Omit<T, "mobile" | "email"> {
  const { mobile: _mobile, email: _email, ...rest } = player;
  return rest;
}

/** Organizer/admin — full badminton player record including mobile/email. */
export function privateBadmintonPlayerSerializer<T extends object>(player: T): T {
  return player;
}

export function serializeBadmintonPlayerForAudience<T extends WithContact>(
  player: T,
  isOrganizer: boolean,
): T | Omit<T, "mobile" | "email"> {
  return isOrganizer ? player : publicBadmintonPlayerSerializer(player);
}
