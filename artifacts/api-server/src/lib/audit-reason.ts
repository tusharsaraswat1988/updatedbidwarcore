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
  "autoApproveWithdrawnReRegistration",
  "bidValueMode",
  "bidValueOptions",
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
  selectedBidValue?: number | null;
  mobileNumber?: string;
}): boolean {
  return (
    data.status !== undefined ||
    data.teamId !== undefined ||
    data.retainedPrice !== undefined ||
    data.basePrice !== undefined ||
    data.selectedBidValue !== undefined ||
    data.mobileNumber !== undefined
  );
}

/** Auto-generated audit reason when organizer edits without typing one. */
export function defaultPlayerPatchReason(
  data: Parameters<typeof isCriticalPlayerPatch>[0],
  existing?: { status?: string | null; teamId?: number | null; basePrice?: number | null },
): string {
  const parts: string[] = [];
  if (data.status !== undefined && existing?.status !== undefined && data.status !== existing.status) {
    parts.push(`status ${existing.status} → ${data.status}`);
  } else if (data.status !== undefined) {
    parts.push(`status set to ${data.status}`);
  }
  if (data.teamId !== undefined) parts.push("team assignment");
  if (data.retainedPrice !== undefined) parts.push("retained price");
  if (data.basePrice !== undefined && data.basePrice !== existing?.basePrice) {
    parts.push("base price");
  }
  if (data.selectedBidValue !== undefined) {
    parts.push("selected bid value");
  }
  if (data.mobileNumber !== undefined) parts.push("mobile number");
  if (parts.length > 0) {
    return `Organizer dashboard: player ${parts.join(", ")} updated`;
  }
  return "Organizer dashboard: player profile updated";
}

/** Auto-generated audit reason when organizer edits without typing one. */
export function defaultTeamPatchReason(data: {
  purse?: number;
  ownerName?: string;
  ownerMobile?: string;
  ownerEmail?: string;
  regenerateCode?: boolean;
}): string {
  if (data.purse !== undefined) {
    return "Organizer dashboard: team purse updated";
  }
  if (
    data.ownerName !== undefined ||
    data.ownerMobile !== undefined ||
    data.ownerEmail !== undefined
  ) {
    return "Organizer dashboard: team owner details updated";
  }
  if (data.regenerateCode) {
    return "Organizer dashboard: team access code regenerated";
  }
  return "Organizer dashboard: team profile updated";
}

/** Use explicit reason when provided; otherwise fall back to a predefined log message. */
export function resolveAuditReasonWithDefault(
  body: unknown,
  defaultReason: string,
): { ok: true; reason: string } | { ok: false; error: string } {
  const raw = (body as { reason?: unknown })?.reason;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, reason: defaultReason };
  }
  const parsed = reasonSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid reason" };
  }
  return { ok: true, reason: parsed.data };
}
