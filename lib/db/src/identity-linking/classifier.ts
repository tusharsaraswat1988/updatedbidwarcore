import {
  isGenericName,
  isPlaceholderMobile,
  normalizeEmail,
  normalizeMobile,
  normalizeName,
} from "./normalizer";
import type { ConfidenceCategory, IdentityCandidate } from "./types";

/**
 * Classifies an organizer account into Confidence Categories.
 */
export function classifyOrganizer(organizer: {
  id: number;
  name: string;
  mobile: string;
  email?: string | null;
  phoneVerified?: boolean | null;
  passwordHash?: string | null;
  googleId?: string | null;
}): IdentityCandidate {
  const normMobile = normalizeMobile(organizer.mobile);
  const normEmail = normalizeEmail(organizer.email);
  const normName = normalizeName(organizer.name);

  const candidate: IdentityCandidate = {
    sourceTable: "organizers",
    sourceRecordId: String(organizer.id),
    rawName: organizer.name,
    rawMobile: organizer.mobile,
    rawEmail: organizer.email,
    normalizedMobile: normMobile,
    normalizedEmail: normEmail,
    normalizedName: normName,
    category: "CATEGORY_C",
    reasons: [],
  };

  if (isGenericName(organizer.name)) {
    candidate.category = "CATEGORY_C";
    candidate.reasons.push("Generic or placeholder organizer name");
    return candidate;
  }

  if (isPlaceholderMobile(organizer.mobile) && !organizer.email) {
    candidate.category = "CATEGORY_C";
    candidate.reasons.push("Placeholder mobile without valid email");
    return candidate;
  }

  // Category A: Verified organizer or valid mobile + auth credentials
  if (
    organizer.phoneVerified ||
    organizer.googleId ||
    (normMobile.length >= 10 && !isPlaceholderMobile(normMobile) && Boolean(organizer.passwordHash))
  ) {
    candidate.category = "CATEGORY_A";
    candidate.reasons.push(
      organizer.phoneVerified
        ? "Verified mobile organizer account"
        : organizer.googleId
        ? "Google OAuth authenticated organizer account"
        : "Authenticated credentialed organizer account",
    );
    return candidate;
  }

  // Category B: Valid contact but unverified / legacy
  if (normMobile.length >= 10 || normEmail) {
    candidate.category = "CATEGORY_B";
    candidate.reasons.push("Unverified organizer contact requires human review");
    return candidate;
  }

  candidate.category = "CATEGORY_C";
  candidate.reasons.push("Insufficient organizer identity evidence");
  return candidate;
}

/**
 * Classifies a scorer account into Confidence Categories.
 */
export function classifyScorerAccount(scorer: {
  id: number;
  name: string;
  mobile: string;
  pinHash: string;
  isActive: boolean;
}): IdentityCandidate {
  const normMobile = normalizeMobile(scorer.mobile);
  const normName = normalizeName(scorer.name);

  const candidate: IdentityCandidate = {
    sourceTable: "scorer_accounts",
    sourceRecordId: String(scorer.id),
    rawName: scorer.name,
    rawMobile: scorer.mobile,
    normalizedMobile: normMobile,
    normalizedEmail: "",
    normalizedName: normName,
    category: "CATEGORY_C",
    reasons: [],
  };

  if (isGenericName(scorer.name)) {
    candidate.category = "CATEGORY_C";
    candidate.reasons.push("Generic or placeholder scorer name");
    return candidate;
  }

  if (isPlaceholderMobile(scorer.mobile)) {
    candidate.category = "CATEGORY_C";
    candidate.reasons.push("Placeholder or invalid scorer mobile");
    return candidate;
  }

  // Category A: Active scorer account with valid PIN hash and real mobile
  if (scorer.isActive && normMobile.length >= 10 && Boolean(scorer.pinHash)) {
    candidate.category = "CATEGORY_A";
    candidate.reasons.push("Active credentialed scorer account with unique mobile");
    return candidate;
  }

  candidate.category = "CATEGORY_B";
  candidate.reasons.push("Inactive or unverified scorer account requires review");
  return candidate;
}

/**
 * Classifies a global_players record into Confidence Categories.
 */
export function classifyGlobalPlayer(gp: {
  id: string;
  canonicalName: string;
  mobileNumber?: string | null;
  email?: string | null;
  hasLinkedTournamentRows: boolean;
}): IdentityCandidate {
  const normMobile = normalizeMobile(gp.mobileNumber);
  const normEmail = normalizeEmail(gp.email);
  const normName = normalizeName(gp.canonicalName);

  const candidate: IdentityCandidate = {
    sourceTable: "global_players",
    sourceRecordId: gp.id,
    rawName: gp.canonicalName,
    rawMobile: gp.mobileNumber,
    rawEmail: gp.email,
    normalizedMobile: normMobile,
    normalizedEmail: normEmail,
    normalizedName: normName,
    category: "CATEGORY_C",
    reasons: [],
  };

  if (isGenericName(gp.canonicalName)) {
    candidate.category = "CATEGORY_C";
    candidate.reasons.push("Generic or placeholder player name");
    return candidate;
  }

  // Category A: Canonical player with real contact info and active linked tournament rows
  const hasValidContact = (normMobile.length >= 10 && !isPlaceholderMobile(normMobile)) || normEmail;
  if (hasValidContact && gp.hasLinkedTournamentRows) {
    candidate.category = "CATEGORY_A";
    candidate.reasons.push("Authoritative master player with valid contact and active tournament links");
    return candidate;
  }

  // Category B: Master player with contact but no active tournament link (or unlinked)
  if (hasValidContact) {
    candidate.category = "CATEGORY_B";
    candidate.reasons.push("Master player without direct active tournament links requires review");
    return candidate;
  }

  candidate.category = "CATEGORY_C";
  candidate.reasons.push("Master player without valid contact or tournament references");
  return candidate;
}

/**
 * Classifies a scoring official record.
 * Per Phase 5B/5D, scoring_officials are tournament roster display records,
 * and are NEVER Category A on their own.
 */
export function classifyScoringOfficial(official: {
  id: number;
  tournamentId: number;
  name: string;
  mobile?: string | null;
  role: string;
}): IdentityCandidate {
  return {
    sourceTable: "scoring_officials",
    sourceRecordId: String(official.id),
    rawName: official.name,
    rawMobile: official.mobile,
    normalizedMobile: normalizeMobile(official.mobile),
    normalizedEmail: "",
    normalizedName: normalizeName(official.name),
    category: "CATEGORY_B", // Review required; never automatically merged into Member
    reasons: ["Scoring official is tournament-scoped display roster; requires manual curation"],
  };
}

/**
 * Classifies a team owner historical contact record.
 * Per Phase 5B/5D, team owner fields are never automatically promoted to Category A.
 */
export function classifyTeamOwner(team: {
  id: number;
  tournamentId: number;
  ownerName: string;
  ownerMobile: string;
  ownerEmail?: string | null;
}): IdentityCandidate {
  return {
    sourceTable: "teams_owner",
    sourceRecordId: String(team.id),
    rawName: team.ownerName,
    rawMobile: team.ownerMobile,
    rawEmail: team.ownerEmail,
    normalizedMobile: normalizeMobile(team.ownerMobile),
    normalizedEmail: normalizeEmail(team.ownerEmail),
    normalizedName: normalizeName(team.ownerName),
    category: "CATEGORY_B", // Review required; preserved in legacy team row
    reasons: ["Historical team owner metadata preserved in teams; requires verification to claim Member"],
  };
}
