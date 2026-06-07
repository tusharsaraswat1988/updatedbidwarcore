export const AUDIT_REASON_MIN_LENGTH = 10;

export function isAuditReasonValid(reason: string): boolean {
  return reason.trim().length >= AUDIT_REASON_MIN_LENGTH;
}

const TOURNAMENT_CONFIG_FIELDS = new Set([
  "basePurse",
  "minBid",
  "bidIncrement",
  "bidTier1UpTo",
  "bidTier1Increment",
  "bidTier2UpTo",
  "bidTier2Increment",
  "bidTier3Increment",
  "bidTiers",
  "timerSeconds",
  "bidTimerSeconds",
  "playerSelectionMode",
  "minimumSquadSize",
  "maximumSquadSize",
  "registrationDeadline",
  "registrationLimit",
  "status",
]);

export function payloadHasTournamentConfigFields(payload: Record<string, unknown>): boolean {
  return Object.keys(payload).some((k) => TOURNAMENT_CONFIG_FIELDS.has(k));
}

export function teamEditNeedsReason(
  team: { purse?: number; ownerName?: string | null; ownerMobile?: string | null; ownerEmail?: string | null },
  form: { purse: number; ownerName: string; ownerMobile: string; ownerEmail: string },
): boolean {
  return (
    form.purse !== (team.purse ?? 0) ||
    form.ownerName.trim() !== (team.ownerName ?? "").trim() ||
    form.ownerMobile.trim() !== (team.ownerMobile ?? "").trim() ||
    form.ownerEmail.trim() !== (team.ownerEmail ?? "").trim()
  );
}
