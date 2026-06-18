/**
 * Buzz Studio — Creative Job Types
 *
 * Shared contracts for the creative job queue.
 * Used by Template Studio today; designed for future auto-creative triggers
 * (e.g. player sold → sold player contract) without UI coupling.
 */

import type { TournamentFeatures } from "@workspace/api-base/tournament-features";

export type CreativeJobStatus = "queued" | "processing" | "completed" | "failed";

/** Permission and share placeholders attached to each job. */
export interface CreativeJobMetadata {
  allowCreativeDownloads: boolean;
  allowPlayerDownloads: boolean;
  watermarkRequired: boolean;
  /** Future share link identifier — architecture placeholder only. */
  shareId: string | null;
  /** Future share toggle — architecture placeholder only. */
  shareEnabled: boolean;
}

export interface CreativeJob {
  id: string;
  tournamentId: number;
  templateId: string;
  status: CreativeJobStatus;
  contract: Record<string, unknown>;
  aspectRatio: string;
  requestedByUserId: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  resultUrl: string | null;
  downloadEnabled: boolean;
  metadata: CreativeJobMetadata;
}

export interface CreateCreativeJobRequest {
  tournamentId: number;
  templateId: string;
  contract: Record<string, unknown>;
  aspectRatio: string;
  userId?: number | null;
  /** Optional feature snapshot — resolved from tournament when omitted. */
  features?: Partial<TournamentFeatures> | null;
}

export const CREATIVE_JOB_STATUS_LABELS: Record<CreativeJobStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};
