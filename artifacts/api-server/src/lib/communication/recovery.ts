import {
  db,
  communicationJobsTable,
  communicationJobRecipientsTable,
  teamsTable,
  playersTable,
  organizersTable,
} from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { revalidateAndRefreshJob } from "./job-service.js";
import { logger } from "../logger.js";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** Re-check pending jobs when recipient email becomes available. */
export async function recoverPendingJobsForEntity(
  entityType: string,
  entityId: number,
  newEmail?: string | null,
): Promise<number> {
  const pendingJobs = await db
    .select()
    .from(communicationJobsTable)
    .where(
      and(
        eq(communicationJobsTable.entityType, entityType),
        eq(communicationJobsTable.entityId, entityId),
        inArray(communicationJobsTable.status, ["pending", "draft"]),
        eq(communicationJobsTable.pendingReason, "email_missing"),
      ),
    );

  if (!pendingJobs.length) return 0;

  let recovered = 0;
  for (const job of pendingJobs) {
    const email = newEmail ?? (await resolveEntityEmail(entityType, entityId));
    if (!isValidEmail(email)) continue;

    await db
      .update(communicationJobRecipientsTable)
      .set({ recipientEmail: email, updatedAt: new Date() })
      .where(
        and(
          eq(communicationJobRecipientsTable.jobId, job.id),
          eq(communicationJobRecipientsTable.isPrimary, true),
        ),
      );

    await revalidateAndRefreshJob(job.id);
    recovered++;
  }

  if (recovered > 0) {
    logger.info({ entityType, entityId, recovered }, "Recovered pending communication jobs");
  }

  return recovered;
}

async function resolveEntityEmail(entityType: string, entityId: number): Promise<string | null> {
  if (entityType === "team") {
    const [team] = await db
      .select({ email: teamsTable.ownerEmail })
      .from(teamsTable)
      .where(eq(teamsTable.id, entityId))
      .limit(1);
    return team?.email ?? null;
  }
  if (entityType === "player") {
    const [player] = await db
      .select({ email: playersTable.email })
      .from(playersTable)
      .where(eq(playersTable.id, entityId))
      .limit(1);
    return player?.email ?? null;
  }
  if (entityType === "organizer") {
    const [org] = await db
      .select({ email: organizersTable.email })
      .from(organizersTable)
      .where(eq(organizersTable.id, entityId))
      .limit(1);
    return org?.email ?? null;
  }
  return null;
}

/** Periodic sweep for jobs that may have become sendable. */
export async function sweepPendingJobsForRecovery(): Promise<number> {
  const pendingJobs = await db
    .select({
      id: communicationJobsTable.id,
      entityType: communicationJobsTable.entityType,
      entityId: communicationJobsTable.entityId,
    })
    .from(communicationJobsTable)
    .where(
      and(
        eq(communicationJobsTable.status, "pending"),
        eq(communicationJobsTable.pendingReason, "email_missing"),
        sql`${communicationJobsTable.entityType} IS NOT NULL`,
        sql`${communicationJobsTable.entityId} IS NOT NULL`,
      ),
    )
    .limit(100);

  let recovered = 0;
  for (const job of pendingJobs) {
    if (!job.entityType || !job.entityId) continue;
    const email = await resolveEntityEmail(job.entityType, job.entityId);
    if (!isValidEmail(email)) continue;

    await db
      .update(communicationJobRecipientsTable)
      .set({ recipientEmail: email, updatedAt: new Date() })
      .where(
        and(
          eq(communicationJobRecipientsTable.jobId, job.id),
          eq(communicationJobRecipientsTable.isPrimary, true),
        ),
      );

    await revalidateAndRefreshJob(job.id);
    recovered++;
  }

  return recovered;
}

export async function recoverJobsForTeamEmailUpdate(teamId: number, email: string | null): Promise<void> {
  await recoverPendingJobsForEntity("team", teamId, email);
}

export async function recoverJobsForPlayerEmailUpdate(playerId: number, email: string | null): Promise<void> {
  await recoverPendingJobsForEntity("player", playerId, email);
}

export async function recoverJobsForOrganizerEmailUpdate(organizerId: number, email: string | null): Promise<void> {
  await recoverPendingJobsForEntity("organizer", organizerId, email);
}
