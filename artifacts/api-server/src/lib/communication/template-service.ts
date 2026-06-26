import {
  db,
  communicationLogsTable,
  communicationTemplatesTable,
  communicationTemplateVersionsTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { logger } from "../logger.js";

export async function getTemplateByKey(internalKey: string) {
  const [row] = await db
    .select()
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.internalKey, internalKey))
    .limit(1);
  return row ?? null;
}

export async function getTemplateById(id: string) {
  const [row] = await db
    .select()
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function getTemplateByEventType(eventType: string) {
  const [row] = await db
    .select()
    .from(communicationTemplatesTable)
    .where(
      and(
        eq(communicationTemplatesTable.eventType, eventType),
        eq(communicationTemplatesTable.isArchived, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listTemplates(filters?: {
  includeDrafts?: boolean;
  includeArchived?: boolean;
  search?: string;
}) {
  const conditions = [];
  if (!filters?.includeArchived) {
    conditions.push(eq(communicationTemplatesTable.isArchived, false));
  }
  if (!filters?.includeDrafts) {
    conditions.push(eq(communicationTemplatesTable.isDraft, false));
  }

  const rows = await db
    .select()
    .from(communicationTemplatesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(communicationTemplatesTable.updatedAt));

  if (!filters?.search?.trim()) return rows;

  const q = filters.search.toLowerCase();
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.internalKey.toLowerCase().includes(q) ||
      (r.eventType?.toLowerCase().includes(q) ?? false),
  );
}

export async function createTemplateVersion(
  templateId: string,
  data: {
    subject: string;
    htmlBody: string;
    headerImageAssetId?: string | null;
    footerHtml?: string | null;
    signatureHtml?: string | null;
    changeNote?: string | null;
    createdBy?: string | null;
  },
): Promise<{ versionId: string; versionNumber: number }> {
  const [template] = await db
    .select()
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.id, templateId))
    .limit(1);

  if (!template) throw new Error("Template not found");

  const versionNumber = template.currentVersion + 1;

  const [version] = await db
    .insert(communicationTemplateVersionsTable)
    .values({
      templateId,
      versionNumber,
      subject: data.subject,
      htmlBody: data.htmlBody,
      headerImageAssetId: data.headerImageAssetId ?? null,
      footerHtml: data.footerHtml ?? null,
      signatureHtml: data.signatureHtml ?? null,
      changeNote: data.changeNote ?? null,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  await db
    .update(communicationTemplatesTable)
    .set({
      subject: data.subject,
      htmlBody: data.htmlBody,
      headerImageAssetId: data.headerImageAssetId ?? null,
      footerHtml: data.footerHtml ?? null,
      signatureHtml: data.signatureHtml ?? null,
      currentVersion: versionNumber,
      updatedBy: data.createdBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, templateId));

  return { versionId: version!.id, versionNumber };
}

export async function getTemplateVersion(versionId: string) {
  const [row] = await db
    .select()
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.id, versionId))
    .limit(1);
  return row ?? null;
}

export async function logCommunicationAction(params: {
  jobId?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  channel?: string;
  recipientName?: string | null;
  recipientEmail?: string | null;
  createdBy?: string | null;
  triggeredBy?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(communicationLogsTable).values({
      jobId: params.jobId ?? null,
      templateId: params.templateId ?? null,
      templateVersionId: params.templateVersionId ?? null,
      action: params.action,
      previousStatus: params.previousStatus ?? null,
      newStatus: params.newStatus ?? null,
      channel: params.channel ?? "email",
      recipientName: params.recipientName ?? null,
      recipientEmail: params.recipientEmail ?? null,
      createdBy: params.createdBy ?? null,
      triggeredBy: params.triggeredBy ?? null,
      ipAddress: params.ipAddress ?? null,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, action: params.action }, "Failed to write communication log");
  }
}

export async function countTemplates(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.isArchived, false));
  return row?.count ?? 0;
}
