import {
  isPlaceholderOrganizerMobile,
  mobilesMatch,
  parseIndianMobile,
} from "@workspace/api-base/mobile";

export function tournamentMatchesOrganizerContact(
  tournament: { organizerMobile: string | null; organizerEmail: string | null },
  contact: { mobileNorm: string | null; emailNorm: string | null },
): boolean {
  const emailMatch =
    !!contact.emailNorm &&
    !!tournament.organizerEmail?.trim() &&
    tournament.organizerEmail.trim().toLowerCase() === contact.emailNorm;
  const mobileMatch =
    !!contact.mobileNorm &&
    !!tournament.organizerMobile?.trim() &&
    (mobilesMatch(contact.mobileNorm, tournament.organizerMobile) ||
      tournament.organizerMobile.trim() === contact.mobileNorm);
  return emailMatch || mobileMatch;
}

export function normalizeOrganizerContact(contact: {
  mobile?: string | null;
  email?: string | null;
}): { mobileNorm: string | null; emailNorm: string | null } {
  const rawMobile = contact.mobile?.trim() || "";
  const mobileNorm =
    rawMobile && !isPlaceholderOrganizerMobile(rawMobile)
      ? (() => {
          const parsed = parseIndianMobile(rawMobile);
          return parsed.ok ? parsed.normalized : null;
        })()
      : null;
  const emailNorm = contact.email?.trim().toLowerCase() || null;
  return { mobileNorm, emailNorm };
}
