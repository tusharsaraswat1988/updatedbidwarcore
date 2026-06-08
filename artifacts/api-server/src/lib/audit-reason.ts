import { z } from "zod";

export const AUDIT_REASON_MIN_LENGTH = 10;
export const AUDIT_REASON_MAX_LENGTH = 500;

const reasonSchema = z
  .string()
  .trim()
  .min(AUDIT_REASON_MIN_LENGTH, `Reason is required (minimum ${AUDIT_REASON_MIN_LENGTH} characters)`)
  .max(AUDIT_REASON_MAX_LENGTH);

export function parseAuditReason(
  body: unknown,
  required: boolean,
): { ok: true; reason: string | null } | { ok: false; error: string } {
  const raw = (body as { reason?: unknown })?.reason;
  if (raw === undefined || raw === null || raw === "") {
    if (required) {
      return { ok: false, error: `Reason is required (minimum ${AUDIT_REASON_MIN_LENGTH} characters)` };
    }
    return { ok: true, reason: null };
  }
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason" };
  }
  return { ok: true, reason: parsed.data };
}

/** Tournament fields that require a reason when changed. */
export const TOURNAMENT_CONFIG_FIELDS = new Set([
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
  "bidExtensionEnabled",
  "bidExtensionThresholdSeconds",
  "bidExtensionSeconds",
  "playerSelectionMode",
  "minimumSquadSize",
  "maximumSquadSize",
  "registrationDeadline",
  "registrationLimit",
  "status",
]);

export function tournamentConfigFieldsChanged(updates: Record<string, unknown>): string[] {
  return Object.keys(updates).filter((k) => TOURNAMENT_CONFIG_FIELDS.has(k));
}

export function isCriticalTeamPatch(data: {
  purse?: number;
  ownerName?: string;
  ownerMobile?: string;
  ownerEmail?: string;
  regenerateCode?: boolean;
}): boolean {
  return (
    data.purse !== undefined ||
    data.ownerName !== undefined ||
    data.ownerMobile !== undefined ||
    data.ownerEmail !== undefined ||
    data.regenerateCode === true
  );
}

export function isCriticalPlayerPatch(data: {
  status?: string;
  teamId?: number | null;
  retainedPrice?: number | null;
  basePrice?: number;
  mobileNumber?: string;
}): boolean {
  return (
    data.status !== undefined ||
    data.teamId !== undefined ||
    data.retainedPrice !== undefined ||
    data.basePrice !== undefined ||
    data.mobileNumber !== undefined
  );
}
