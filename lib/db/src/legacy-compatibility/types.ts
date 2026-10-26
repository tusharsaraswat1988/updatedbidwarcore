import type { Member } from "../schema/members";

export type LegacyResolutionStatus = "resolved" | "unresolved" | "review_required";

export type LegacySourceTable =
  | "organizers"
  | "scorer_accounts"
  | "global_players"
  | "players"
  | "badminton_players"
  | "scoring_officials"
  | "teams_owner"
  | "owner_sessions"
  | (string & {});

export interface LegacyIdentityResolutionResult {
  status: LegacyResolutionStatus;
  memberId: string | null;
  member?: Member | null;
  sourceTable: string;
  sourceRecordId: string;
  confidenceScore: number | null;
  linkId: number | null;
  reason: string;
  provenance?: Record<string, unknown> | null;
}

export interface SourceMigrationMetrics {
  sourceTable: string;
  totalRecords: number;
  resolvedCount: number;
  unresolvedCount: number;
  reviewRequiredCount: number;
  categoryACount: number;
  categoryBCount: number;
  categoryCCount: number;
}

export interface MigrationReadinessReport {
  generatedAt: string;
  sources: SourceMigrationMetrics[];
  totalRecords: number;
  totalResolved: number;
  totalUnresolved: number;
  totalReviewRequired: number;
  readinessPercentage: number;
}

export interface ListReviewCandidatesFilter {
  sourceTable?: string;
  limit?: number;
  offset?: number;
}
