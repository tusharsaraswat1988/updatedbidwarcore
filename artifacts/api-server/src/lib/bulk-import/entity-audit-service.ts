import { db, entityAuditLogsTable, bulkImportJobItemsTable } from "@workspace/db";

export type EntityAuditInput = {
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  performedBy: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  jobId?: number;
  tournamentId?: number;
};

export async function writeEntityAuditLogs(entries: EntityAuditInput[]): Promise<void> {
  if (entries.length === 0) return;
  const batchSize = 500;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await db.insert(entityAuditLogsTable).values(
      batch.map((e) => ({
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

export async function writeBulkImportJobItems(
  jobId: number,
  changes: Array<{
    playerId: number;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    status: string;
    errorMessage?: string | null;
  }>,
): Promise<void> {
  const batchSize = 500;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = changes.slice(i, i + batchSize);
    await db.insert(bulkImportJobItemsTable).values(
      batch.map((c) => ({
        jobId,
        playerId: c.playerId,
        fieldName: c.fieldName,
        oldValue: c.oldValue,
        newValue: c.newValue,
        status: c.status,
        errorMessage: c.errorMessage ?? null,
      })),
    );
  }
}
