/**
 * Buzz Studio — Creative Job Service (server)
 *
 * Database-backed job queue for creative generation.
 * Generic enough for Template Studio and future auto-creative triggers
 * (e.g. player sold → sold player contract) without UI coupling.
 */

import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { creativeJobsTable, tournamentsTable, type CreativeJobRow } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import {
  resolveTournamentFeatures,
  type TournamentFeatures,
} from "@workspace/api-base/tournament-features";

export const CREATIVE_JOB_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type CreativeJobStatus = (typeof CREATIVE_JOB_STATUSES)[number];

export interface CreativeJobMetadata {
  allowCreativeDownloads: boolean;
  allowPlayerDownloads: boolean;
  watermarkRequired: boolean;
  /** Future share link identifier — not persisted until share phase. */
  shareId: string | null;
  /** Future share toggle — not persisted until share phase. */
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

export interface CreateCreativeJobInput {
  tournamentId: number;
  templateId: string;
  contract: Record<string, unknown>;
  aspectRatio: string;
  userId?: number | null;
  features?: Partial<TournamentFeatures> | null;
}

function buildJobMetadata(features: Partial<TournamentFeatures> | null | undefined): CreativeJobMetadata {
  const resolved = resolveTournamentFeatures(features);
  return {
    allowCreativeDownloads: resolved.allowCreativeDownloads === true,
    allowPlayerDownloads: resolved.allowPlayerDownloads === true,
    watermarkRequired: resolved.watermarkRequired !== false,
    shareId: null,
    shareEnabled: false,
  };
}

export function canDownloadCreative(
  features: Partial<TournamentFeatures> | null | undefined,
  audience: "organizer" | "player" = "organizer",
): boolean {
  const resolved = resolveTournamentFeatures(features);
  if (audience === "organizer") {
    return resolved.allowCreativeDownloads === true || resolved.buzzStudio === true;
  }
  return resolved.allowPlayerDownloads === true;
}

function rowToCreativeJob(row: CreativeJobRow, metadata: CreativeJobMetadata): CreativeJob {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    templateId: row.templateId,
    status: row.status as CreativeJobStatus,
    contract: row.contractJson,
    aspectRatio: row.aspectRatio,
    requestedByUserId: row.requestedByUserId ?? null,
    createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    errorMessage: row.errorMessage ?? null,
    resultUrl: row.resultUrl ?? null,
    downloadEnabled: row.downloadEnabled,
    metadata,
  };
}

async function loadTournamentFeatures(tournamentId: number): Promise<Partial<TournamentFeatures> | null> {
  const [row] = await db
    .select({ featuresJson: tournamentsTable.featuresJson })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  return (row?.featuresJson as Partial<TournamentFeatures> | null) ?? null;
}

export async function createCreativeJob(input: CreateCreativeJobInput): Promise<CreativeJob> {
  const features =
    input.features !== undefined ? input.features : await loadTournamentFeatures(input.tournamentId);
  const metadata = buildJobMetadata(features);
  const downloadEnabled = canDownloadCreative(features, "organizer");

  const [row] = await db
    .insert(creativeJobsTable)
    .values({
      id: randomUUID(),
      tournamentId: input.tournamentId,
      templateId: input.templateId,
      status: "queued",
      contractJson: input.contract,
      aspectRatio: input.aspectRatio,
      requestedByUserId: input.userId ?? null,
      downloadEnabled,
    })
    .returning();

  return rowToCreativeJob(row, metadata);
}

export async function listCreativeJobs(
  tournamentId: number,
  options?: { limit?: number; templateId?: string },
): Promise<CreativeJob[]> {
  const limit = options?.limit ?? 50;
  const conditions = [eq(creativeJobsTable.tournamentId, tournamentId)];
  if (options?.templateId) {
    conditions.push(eq(creativeJobsTable.templateId, options.templateId));
  }

  const features = await loadTournamentFeatures(tournamentId);
  const metadata = buildJobMetadata(features);

  const rows = await db
    .select()
    .from(creativeJobsTable)
    .where(and(...conditions))
    .orderBy(desc(creativeJobsTable.createdAt))
    .limit(limit);

  return rows.map((row) => rowToCreativeJob(row, metadata));
}

export async function getCreativeJob(
  tournamentId: number,
  jobId: string,
): Promise<CreativeJob | null> {
  const [row] = await db
    .select()
    .from(creativeJobsTable)
    .where(
      and(eq(creativeJobsTable.id, jobId), eq(creativeJobsTable.tournamentId, tournamentId)),
    );

  if (!row) return null;

  const features = await loadTournamentFeatures(tournamentId);
  const metadata = buildJobMetadata(features);
  return rowToCreativeJob(row, metadata);
}

export interface UpdateCreativeJobStatusInput {
  status: CreativeJobStatus;
  errorMessage?: string | null;
  resultUrl?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

function buildStatusPatch(update: UpdateCreativeJobStatusInput): Partial<typeof creativeJobsTable.$inferInsert> {
  const now = new Date();
  const patch: Partial<typeof creativeJobsTable.$inferInsert> = {
    status: update.status,
  };

  if (update.errorMessage !== undefined) patch.errorMessage = update.errorMessage;
  if (update.resultUrl !== undefined) patch.resultUrl = update.resultUrl;
  if (update.startedAt !== undefined) patch.startedAt = update.startedAt;
  if (update.completedAt !== undefined) patch.completedAt = update.completedAt;

  if (update.status === "processing" && update.startedAt === undefined) {
    patch.startedAt = now;
  }
  if ((update.status === "completed" || update.status === "failed") && update.completedAt === undefined) {
    patch.completedAt = now;
  }

  return patch;
}

export async function updateCreativeJobStatusById(
  jobId: string,
  update: UpdateCreativeJobStatusInput,
): Promise<CreativeJob | null> {
  const [existing] = await db
    .select({ tournamentId: creativeJobsTable.tournamentId })
    .from(creativeJobsTable)
    .where(eq(creativeJobsTable.id, jobId));

  if (!existing) return null;

  const [row] = await db
    .update(creativeJobsTable)
    .set(buildStatusPatch(update))
    .where(eq(creativeJobsTable.id, jobId))
    .returning();

  if (!row) return null;

  const features = await loadTournamentFeatures(existing.tournamentId);
  const metadata = buildJobMetadata(features);
  return rowToCreativeJob(row, metadata);
}

export async function updateCreativeJobStatus(
  tournamentId: number,
  jobId: string,
  update: UpdateCreativeJobStatusInput,
): Promise<CreativeJob | null> {
  const [row] = await db
    .update(creativeJobsTable)
    .set(buildStatusPatch(update))
    .where(
      and(eq(creativeJobsTable.id, jobId), eq(creativeJobsTable.tournamentId, tournamentId)),
    )
    .returning();

  if (!row) return null;

  const features = await loadTournamentFeatures(tournamentId);
  const metadata = buildJobMetadata(features);
  return rowToCreativeJob(row, metadata);
}
