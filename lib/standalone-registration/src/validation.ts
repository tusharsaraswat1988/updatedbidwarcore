import { z } from "zod";
import { calculateAgeFromDob, assertClientAgeIgnored } from "./age";

const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PLAYING_ROLES = [
  "Batsman",
  "Bowler",
  "All-Rounder",
  "Wicket Keeper",
] as const;

export const BATTING_STYLES = ["Right Hand", "Left Hand"] as const;

export const BOWLING_STYLES = [
  "Right Arm Fast",
  "Right Arm Medium",
  "Right Arm Spin",
  "Left Arm Fast",
  "Left Arm Medium",
  "Left Arm Spin",
  "Does Not Bowl",
] as const;

export const JERSEY_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;

export type FieldValidationIssue = { field: string; message: string };

export type ValidateRegistrationInput = {
  playerName?: unknown;
  parentName?: unknown;
  dateOfBirth?: unknown;
  /** Ignored — age is always derived from DOB on the server. */
  age?: unknown;
  gender?: unknown;
  mobile?: unknown;
  whatsapp?: unknown;
  email?: unknown;
  address?: unknown;
  city?: unknown;
  state?: unknown;
  playingRole?: unknown;
  battingStyle?: unknown;
  bowlingStyle?: unknown;
  cricketExperience?: unknown;
  previousTournamentExperience?: unknown;
  jerseySize?: unknown;
  preferredJerseyNumber?: unknown;
  categoryCode?: unknown;
  declarationAccepted?: unknown;
  fieldValues?: unknown;
};

export type ValidatedRegistration = {
  playerName: string;
  parentName: string | null;
  dateOfBirth: string;
  calculatedAge: number;
  gender: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  playingRole: string;
  battingStyle: string | null;
  bowlingStyle: string | null;
  cricketExperience: string | null;
  previousTournamentExperience: string | null;
  jerseySize: string | null;
  preferredJerseyNumber: string | null;
  categoryCode: string | null;
  declarationAccepted: boolean;
  fieldValues: Record<string, unknown>;
};

function normalizeMobile(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Mobile number is required." };
  }
  const digits = raw.replace(/\D/g, "");
  let ten = "";
  if (digits.length === 10) ten = digits;
  else if (digits.length === 12 && digits.startsWith("91")) ten = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) ten = digits.slice(1);
  else if (digits.length > 10) ten = digits.slice(-10);
  else return { ok: false, error: "Enter a valid 10-digit mobile number." };

  if (!INDIAN_MOBILE_RE.test(ten)) {
    return {
      ok: false,
      error: "Indian mobile numbers must be 10 digits starting with 6, 7, 8, or 9.",
    };
  }
  return { ok: true, value: ten };
}

function optionalTrimmed(raw: unknown, max: number): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Validate a public registration payload.
 * Age is always computed from DOB; client `age` is discarded.
 */
export function validateRegistrationPayload(
  input: ValidateRegistrationInput,
  options?: { requireDeclaration?: boolean; asOf?: Date },
):
  | { ok: true; data: ValidatedRegistration }
  | { ok: false; issues: FieldValidationIssue[] } {
  const issues: FieldValidationIssue[] = [];

  const playerName =
    typeof input.playerName === "string" ? input.playerName.trim() : "";
  if (playerName.length < 2) {
    issues.push({ field: "playerName", message: "Full name is required." });
  } else if (playerName.length > 120) {
    issues.push({ field: "playerName", message: "Full name must be at most 120 characters." });
  }

  const dobRaw = typeof input.dateOfBirth === "string" ? input.dateOfBirth.trim() : "";
  const ageResult = calculateAgeFromDob(dobRaw, options?.asOf);
  if (!ageResult.ok) {
    issues.push({ field: "dateOfBirth", message: ageResult.error });
  }

  const gender = typeof input.gender === "string" ? input.gender.trim() : "";
  if (!(GENDERS as readonly string[]).includes(gender)) {
    issues.push({ field: "gender", message: "Please select a valid gender." });
  }

  const mobile = normalizeMobile(input.mobile);
  if (!mobile.ok) {
    issues.push({ field: "mobile", message: mobile.error });
  }

  let whatsapp: string | null = null;
  if (input.whatsapp !== undefined && input.whatsapp !== null && input.whatsapp !== "") {
    const wa = normalizeMobile(input.whatsapp);
    if (!wa.ok) {
      issues.push({ field: "whatsapp", message: wa.error });
    } else {
      whatsapp = wa.value;
    }
  }

  let email: string | null = null;
  if (input.email !== undefined && input.email !== null && input.email !== "") {
    if (typeof input.email !== "string" || !EMAIL_RE.test(input.email.trim())) {
      issues.push({ field: "email", message: "Please enter a valid email address." });
    } else {
      email = input.email.trim().toLowerCase();
    }
  }

  const playingRole = typeof input.playingRole === "string" ? input.playingRole.trim() : "";
  if (!(PLAYING_ROLES as readonly string[]).includes(playingRole)) {
    issues.push({ field: "playingRole", message: "Please select a valid playing role." });
  }

  const battingStyle =
    typeof input.battingStyle === "string" && input.battingStyle.trim()
      ? input.battingStyle.trim()
      : null;
  if (battingStyle && !(BATTING_STYLES as readonly string[]).includes(battingStyle)) {
    issues.push({ field: "battingStyle", message: "Please select a valid batting style." });
  }

  const bowlingStyle =
    typeof input.bowlingStyle === "string" && input.bowlingStyle.trim()
      ? input.bowlingStyle.trim()
      : null;
  if (bowlingStyle && !(BOWLING_STYLES as readonly string[]).includes(bowlingStyle)) {
    issues.push({ field: "bowlingStyle", message: "Please select a valid bowling style." });
  }

  const jerseySize =
    typeof input.jerseySize === "string" && input.jerseySize.trim()
      ? input.jerseySize.trim().toUpperCase()
      : null;
  if (jerseySize && !(JERSEY_SIZES as readonly string[]).includes(jerseySize)) {
    issues.push({ field: "jerseySize", message: "Please select a valid jersey size." });
  }

  const declarationAccepted = input.declarationAccepted === true;
  if (options?.requireDeclaration && !declarationAccepted) {
    issues.push({
      field: "declarationAccepted",
      message: "You must accept the declaration to continue.",
    });
  }

  if (issues.length > 0 || !ageResult.ok || !mobile.ok) {
    return { ok: false, issues };
  }

  const { age: calculatedAge } = assertClientAgeIgnored(input.age, ageResult.age);

  const fieldValues =
    input.fieldValues && typeof input.fieldValues === "object" && !Array.isArray(input.fieldValues)
      ? (input.fieldValues as Record<string, unknown>)
      : {};

  return {
    ok: true,
    data: {
      playerName,
      parentName: optionalTrimmed(input.parentName, 120),
      dateOfBirth: dobRaw,
      calculatedAge,
      gender,
      mobile: mobile.value,
      whatsapp,
      email,
      address: optionalTrimmed(input.address, 500),
      city: optionalTrimmed(input.city, 80),
      state: optionalTrimmed(input.state, 80),
      playingRole,
      battingStyle,
      bowlingStyle,
      cricketExperience: optionalTrimmed(input.cricketExperience, 1000),
      previousTournamentExperience: optionalTrimmed(input.previousTournamentExperience, 1000),
      jerseySize,
      preferredJerseyNumber: optionalTrimmed(input.preferredJerseyNumber, 10),
      categoryCode: optionalTrimmed(input.categoryCode, 40),
      declarationAccepted,
      fieldValues,
    },
  };
}

/** Lightweight Zod schema for request shape (detailed rules in validateRegistrationPayload). */
export const createRegistrationBodySchema = z
  .object({
    slug: z.string().trim().min(1).max(64).optional(),
    playerName: z.string().optional(),
    parentName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    age: z.unknown().optional(),
    gender: z.string().optional(),
    mobile: z.string().optional(),
    whatsapp: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    playingRole: z.string().optional(),
    battingStyle: z.string().optional(),
    bowlingStyle: z.string().optional(),
    cricketExperience: z.string().optional(),
    previousTournamentExperience: z.string().optional(),
    jerseySize: z.string().optional(),
    preferredJerseyNumber: z.string().optional(),
    categoryCode: z.string().optional(),
    declarationAccepted: z.boolean().optional(),
    fieldValues: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
