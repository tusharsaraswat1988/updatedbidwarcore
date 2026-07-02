import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  bulkImportJobsTable,
  bulkImportJobItemsTable,
  entityAuditLogsTable,
  playersTable,
  tournamentPlayerProfilesTable,
} from "@workspace/db";
import { AUCTION_EDITABLE_FIELDS } from "@workspace/api-base/auction-data";
import { writeEntityAuditLogs } from "./entity-audit-service";

function parseStoredValue(
  field: (typeof AUCTION_EDITABLE_FIELDS)[number],
  value: string | null,
): unknown {
  if (value == null || value === "") return null;
  switch (field.type) {
    case "number": {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return value === "true";
    case "category_ref":
    case "team_ref": {
      const n = parseInt(value, 10);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return value;
  }
}

export async function rollbackBulkImportJob(
  jobId: number,
  performedBy: string,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ restored: number }> {
  const [job] = await db
    .select()
    .from(bulkImportJobsTable)
    .where(eq(bulkImportJobsTable.id, jobId))
    .limit(1);

  if (!job) throw new Error("Import job not found");
  if (job.status === "rolled_back") throw new Error("Import already rolled back");
  if (job.status !== "committed") throw new Error("Only committed imports can be rolled back");

  const auditEntries = await db
    .select()
    .from(entityAuditLogsTable)
    .where(
      and(
        eq(entityAuditLogsTable.jobId, jobId),
        eq(entityAuditLogsTable.action, "bulk_import"),
      ),
    );

  let restored = 0;

  await db.transaction(async (tx) => {
    const rollbackAudits: Parameters<typeof writeEntityAuditLogs>[0] = [];

    for (const entry of auditEntries) {
      const field =
        AUCTION_EDITABLE_FIELDS.find((f) => f.key === entry.fieldName)
        ?? AUCTION_EDITABLE_FIELDS.find((f) => f.column === entry.fieldName);

      if (!field) continue;

      const parsed = parseStoredValue(field, entry.oldValue);

      if (field.source === "player") {
        const playerId = parseInt(entry.entityId, 10);
        await tx
          .update(playersTable)
          .set({ [field.column]: parsed } as Record<string, unknown>)
          .where(eq(playersTable.id, playerId));
      } else {
        const profileId = parseInt(entry.entityId, 10);
        await tx
          .update(tournamentPlayerProfilesTable)
          .set({ [field.column]: parsed } as Record<string, unknown>)
          .where(eq(tournamentPlayerProfilesTable.id, profileId));
      }

      rollbackAudits.push({
        entityType: entry.entityType,
        entityId: entry.entityId,
        fieldName: entry.fieldName,
        oldValue: entry.newValue,
        newValue: entry.oldValue,
        action: "rollback",
        performedBy,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        jobId,
        tournamentId: job.tournamentId,
      });
      restored++;
    }

    await tx
      .update(bulkImportJobsTable)
      .set({
        status: "rolled_back",
        rolledBackAt: new Date(),
        rolledBackBy: performedBy,
      })
      .where(eq(bulkImportJobsTable.id, jobId));

    if (rollbackAudits.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < rollbackAudits.length; i += batchSize) {
        await tx.insert(entityAuditLogsTable).values(
          rollbackAudits.slice(i, i + batchSize).map((e) => ({
            entityType: e.entityType,
            entityId: e.entityId,
            fieldName: e.fieldName,
            oldValue: e.oldValue,
            newValue: e.newValue,
            action: e.action,
            performedBy: e.performedBy,
            ipAddress: e.ipAddress ?? null,
            userAgent: e.userAgent ?? null,
            jobId: e.jobId ?? null,
            tournamentId: e.tournamentId ?? null,
          })),
        );
      }
    }
  });

  return { restored };
}

export async function getImportJobDetail(jobId: number) {
  const [job] = await db
    .select()
    .from(bulkImportJobsTable)
    .where(eq(bulkImportJobsTable.id, jobId))
    .limit(1);

  if (!job) return null;

  const items = await db
    .select()
    .from(bulkImportJobItemsTable)
    .where(eq(bulkImportJobItemsTable.jobId, jobId))
    .limit(5000);

  return { job, items };
}
