/**
 * Type definitions for Phase 5D Identity Linking and Controlled Backfill.
 */

export type ConfidenceCategory = "CATEGORY_A" | "CATEGORY_B" | "CATEGORY_C";

export type LinkType =
  | "direct_fk"
  | "verified_phone"
  | "verified_email"
  | "manual_curation"
  | "legacy_import";

export type LinkStatus = "active" | "candidate" | "rejected" | "detached";

export interface IdentityProvenance {
  evidence: string[];
  source: string;
  matchedFields?: string[];
  migrationRunId: string;
  notes?: string;
  analyzedAt: string;
}

export interface ProposedMember {
  id: string; // mem_<32hex>
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryMobile?: string | null;
  primaryEmail?: string | null;
  isMobileVerified: boolean;
  isEmailVerified: boolean;
  dob?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  accountStatus: "active" | "suspended" | "pending_verification" | "deactivated";
  metadataJson?: Record<string, unknown> | null;
}

export interface ProposedRole {
  memberId: string;
  role: string;
  scope: "global" | "tournament" | "team" | "match";
  tournamentId?: number | null;
  teamId?: number | null;
  matchId?: number | null;
}

export interface ProposedSportProfile {
  memberId: string;
  sportSlug: string;
  primaryRole?: string | null;
  secondaryRole?: string | null;
  handedness?: string | null;
  federationCode?: string | null;
  profileJson?: Record<string, unknown> | null;
}

export interface ProposedTournamentParticipation {
  tournamentId: number;
  memberId: string;
  role: string;
  status: string;
  teamId?: number | null;
  categoryId?: number | null;
  displayNameOverride?: string | null;
  initials?: string | null;
  jerseyNumber?: string | null;
}

export interface ProposedIdentityLink {
  memberId: string;
  sourceTable: string;
  sourceRecordId: string;
  linkType: LinkType;
  confidenceScore: number; // 0..100
  provenanceJson: IdentityProvenance;
  status: LinkStatus;
}

export interface IdentityCandidate {
  sourceTable: string;
  sourceRecordId: string;
  rawName: string;
  rawMobile?: string | null;
  rawEmail?: string | null;
  normalizedMobile: string;
  normalizedEmail: string;
  normalizedName: string;
  category: ConfidenceCategory;
  reasons: string[];
  conflictingSignals?: string[];
  proposedMemberId?: string;
}

export interface CollisionReportItem {
  key: string;
  conflictType: "name_mismatch_same_contact" | "ambiguous_shared_number" | "multi_source_conflict";
  records: Array<{
    sourceTable: string;
    sourceRecordId: string;
    name: string;
    mobile?: string | null;
    email?: string | null;
  }>;
  resolution: "excluded_from_auto_apply" | "downgraded_to_category_c";
}

export interface IdentityLinkingStats {
  totalSourceRecords: number;
  sources: Record<
    string,
    {
      total: number;
      categoryA: number;
      categoryB: number;
      categoryC: number;
    }
  >;
  categoryACount: number;
  categoryBCount: number;
  categoryCCount: number;
  collisionsDetected: number;
  proposedNewMembers: number;
  reusedExistingMembers: number;
  proposedRoles: number;
  proposedSportProfiles: number;
  proposedParticipations: number;
  proposedLinks: number;
}

export interface DryRunReport {
  mode: "dry_run";
  migrationRunId: string;
  executedAt: string;
  stats: IdentityLinkingStats;
  proposedMembers: ProposedMember[];
  proposedRoles: ProposedRole[];
  proposedSportProfiles: ProposedSportProfile[];
  proposedParticipations: ProposedTournamentParticipation[];
  proposedLinks: ProposedIdentityLink[];
  reviewCandidates: IdentityCandidate[];
  unresolvedCandidates: IdentityCandidate[];
  collisions: CollisionReportItem[];
}

export interface ApplyResult {
  mode: "apply";
  migrationRunId: string;
  executedAt: string;
  appliedStats: {
    membersCreated: number;
    rolesCreated: number;
    sportProfilesCreated: number;
    participationsCreated: number;
    linksCreated: number;
  };
  legacyTableIntegrityVerified: boolean;
  legacyRowCounts: Record<string, number>;
}
