import {
  db,
  communicationJobsTable,
  communicationJobRecipientsTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { CommunicationJobStatus } from "@workspace/db";
import { refreshJobMergeData } from "./merge-data-builder.js";
import { renderMergeTemplate } from "./merge-variables.js";
import { getTemplateById, getTemplateByKey, getTemplateVersion, logCommunicationAction } from "./template-service.js";
import type { CreateJobInput, JobListFilters } from "./types.js";
import { validateJobForSend } from "./validation.js";
import { logger } from "../logger.js";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.startsWith("eml:") || trimmed.startsWith("gid_")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export async function createCommunicationJob(input: CreateJobInput): Promise<string | null> {
  let template = input.templateId
    ? await getTemplateById(input.templateId)
    : input.templateInternalKey
      ? await getTemplateByKey(input.templateInternalKey)
      : null;

  const mergeData = {
    ...input.mergeData,
    email: input.recipientEmail ?? input.mergeData?.email,
    current_year: String(new Date().getFullYear()),
  };

  const validation = validateJobForSend({
    recipientEmail: input.recipientEmail,
    template,
    mergeData,
  });

  let status: CommunicationJobStatus = validation.canQueue ? "ready_to_send" : "pending";
  let pendingReason = validation.pendingReason;

  if (template?.isDraft) {
    status = "draft";
    pendingReason = "template_draft";
  } else if (template && !template.autoSend && input.sentBy === "system") {
    status = "pending";
    pendingReason = "auto_send_off";
  }

  let subject: string | null = null;
  let htmlBody: string | null = null;
  let templateVersionId: string | null = null;

  if (template && validation.canRender) {
    subject = renderMergeTemplate(template.subject, mergeData);
    htmlBody = renderMergeTemplate(template.htmlBody, mergeData);
    if (template.footerHtml) {
      htmlBody += renderMergeTemplate(template.footerHtml, mergeData);
    }
    if (template.signatureHtml) {
      htmlBody += renderMergeTemplate(template.signatureHtml, mergeData);
    }
  }

  try {
    const [job] = await db
      .insert(communicationJobsTable)
      .values({
        channel: input.channel ?? "email",
        templateId: template?.id ?? null,
        templateVersionId,
        templateInternalKey: template?.internalKey ?? input.templateInternalKey ?? null,
        tournamentId: input.tournamentId ?? null,
        triggeredByEvent: input.triggeredByEvent ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        status,
        pendingReason: pendingReason ?? null,
        subject,
        htmlBody,
        mergeData,
        idempotencyKey: input.idempotencyKey,
        parentJobId: input.parentJobId ?? null,
        sentBy: input.sentBy ?? "system",
        createdByAdmin: input.createdByAdmin ?? null,
        bulkCampaignId: input.bulkCampaignId ?? null,
      })
      .returning({ id: communicationJobsTable.id });

    if (!job) return null;

    await db.insert(communicationJobRecipientsTable).values({
      jobId: job.id,
      recipientName: input.recipientName ?? null,
      recipientEmail: input.recipientEmail ?? null,
      recipientPhone: input.recipientPhone ?? null,
      recipientRole: input.recipientRole ?? null,
      isPrimary: true,
    });

    await logCommunicationAction({
      jobId: job.id,
      templateId: template?.id ?? null,
      action: "created",
      newStatus: status,
      recipientName: input.recipientName ?? null,
      recipientEmail: input.recipientEmail ?? null,
      createdBy: input.createdByAdmin ?? "system",
      triggeredBy: input.triggeredByEvent ?? input.sentBy ?? "system",
      metadata: { pendingReason, idempotencyKey: input.idempotencyKey },
    });

    if (status === "ready_to_send" && !input.skipAutoQueue && template?.autoSend) {
      await queueJob(job.id);
    }

    return job.id;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      logger.info({ idempotencyKey: input.idempotencyKey }, "Communication job skipped — duplicate idempotency key");
      const [existing] = await db
        .select({ id: communicationJobsTable.id })
        .from(communicationJobsTable)
        .where(eq(communicationJobsTable.idempotencyKey, input.idempotencyKey))
        .limit(1);
      return existing?.id ?? null;
    }
    throw err;
  }
}

export async function getJobById(jobId: string) {
  const [job] = await db
    .select()
    .from(communicationJobsTable)
    .where(eq(communicationJobsTable.id, jobId))
    .limit(1);
  if (!job) return null;

  const recipients = await db
    .select()
    .from(communicationJobRecipientsTable)
    .where(eq(communicationJobRecipientsTable.jobId, jobId));

  return { ...job, recipients };
}

export async function updateJobStatus(
  jobId: string,
  newStatus: CommunicationJobStatus,
  updates: Partial<{
    pendingReason: string | null;
    errorMessage: string | null;
    providerMessageId: string | null;
    subject: string | null;
    htmlBody: string | null;
    retryCount: number;
    nextRetryAt: Date | null;
    queuedAt: Date | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
  }> = {},
  audit?: { createdBy?: string; triggeredBy?: string; ipAddress?: string },
): Promise<void> {
  const [current] = await db
    .select()
    .from(communicationJobsTable)
    .where(eq(communicationJobsTable.id, jobId))
    .limit(1);

  if (!current) return;

  await db
    .update(communicationJobsTable)
    .set({
      status: newStatus,
      pendingReason: updates.pendingReason !== undefined ? updates.pendingReason : current.pendingReason,
      errorMessage: updates.errorMessage !== undefined ? updates.errorMessage : current.errorMessage,
      providerMessageId: updates.providerMessageId !== undefined ? updates.providerMessageId : current.providerMessageId,
      subject: updates.subject !== undefined ? updates.subject : current.subject,
      htmlBody: updates.htmlBody !== undefined ? updates.htmlBody : current.htmlBody,
      retryCount: updates.retryCount !== undefined ? updates.retryCount : current.retryCount,
      nextRetryAt: updates.nextRetryAt !== undefined ? updates.nextRetryAt : current.nextRetryAt,
      queuedAt: updates.queuedAt !== undefined ? updates.queuedAt : current.queuedAt,
      sentAt: updates.sentAt !== undefined ? updates.sentAt : current.sentAt,
      deliveredAt: updates.deliveredAt !== undefined ? updates.deliveredAt : current.deliveredAt,
      updatedAt: new Date(),
    })
    .where(eq(communicationJobsTable.id, jobId));

  const recipients = await db
    .select()
    .from(communicationJobRecipientsTable)
    .where(eq(communicationJobRecipientsTable.jobId, jobId))
    .limit(1);

  await logCommunicationAction({
    jobId,
    templateId: current.templateId,
    templateVersionId: current.templateVersionId,
    action: "status_changed",
    previousStatus: current.status,
    newStatus,
    recipientName: recipients[0]?.recipientName ?? null,
    recipientEmail: recipients[0]?.recipientEmail ?? null,
    createdBy: audit?.createdBy ?? null,
    triggeredBy: audit?.triggeredBy ?? null,
    ipAddress: audit?.ipAddress ?? null,
  });
}

export async function queueJob(jobId: string): Promise<boolean> {
  const job = await getJobById(jobId);
  if (!job) return false;

  if (!["ready_to_send", "failed"].includes(job.status)) return false;

  const primary = job.recipients.find((r) => r.isPrimary) ?? job.recipients[0];
  const template = job.templateId ? await getTemplateById(job.templateId) : null;

  const validation = validateJobForSend({
    recipientEmail: primary?.recipientEmail,
    template,
    mergeData: job.mergeData ?? {},
  });

  if (!validation.canQueue) {
    await updateJobStatus(jobId, "pending", { pendingReason: validation.pendingReason ?? "validation_failed" });
    return false;
  }

  await updateJobStatus(jobId, "queued", { queuedAt: new Date(), pendingReason: null });
  return true;
}

export async function revalidateAndRefreshJob(jobId: string): Promise<void> {
  const job = await getJobById(jobId);
  if (!job) return;

  if (!["pending", "draft", "failed"].includes(job.status)) return;

  const primary = job.recipients.find((r) => r.isPrimary) ?? job.recipients[0];
  const template = job.templateId ? await getTemplateById(job.templateId) : null;
  const mergeData = { ...(job.mergeData ?? {}), email: primary?.recipientEmail };

  const validation = validateJobForSend({
    recipientEmail: primary?.recipientEmail,
    template,
    mergeData,
  });

  let newStatus: CommunicationJobStatus = validation.canQueue ? "ready_to_send" : "pending";
  let pendingReason = validation.pendingReason;

  if (template?.isDraft) {
    newStatus = "draft";
    pendingReason = "template_draft";
  } else if (template && !template.autoSend && job.sentBy === "system") {
    newStatus = "pending";
    pendingReason = "auto_send_off";
  }

  let subject = job.subject;
  let htmlBody = job.htmlBody;

  if (template && validation.canRender) {
    subject = renderMergeTemplate(template.subject, mergeData);
    htmlBody = renderMergeTemplate(template.htmlBody, mergeData);
    if (template.footerHtml) htmlBody += renderMergeTemplate(template.footerHtml, mergeData);
    if (template.signatureHtml) htmlBody += renderMergeTemplate(template.signatureHtml, mergeData);
  }

  await db
    .update(communicationJobsTable)
    .set({
      status: newStatus,
      pendingReason: pendingReason ?? null,
      subject,
      htmlBody,
      mergeData,
      errorMessage: newStatus === "ready_to_send" ? null : job.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(communicationJobsTable.id, jobId));

  if (newStatus === "ready_to_send" && template?.autoSend) {
    await queueJob(jobId);
  }
}

export async function updateJobRecipient(
  jobId: string,
  updates: { recipientEmail?: string; recipientName?: string; recipientPhone?: string },
  audit?: { createdBy?: string; ipAddress?: string },
): Promise<void> {
  const primary = await db
    .select()
    .from(communicationJobRecipientsTable)
    .where(
      and(
        eq(communicationJobRecipientsTable.jobId, jobId),
        eq(communicationJobRecipientsTable.isPrimary, true),
      ),
    )
    .limit(1);

  if (!primary[0]) return;

  await db
    .update(communicationJobRecipientsTable)
    .set({
      recipientEmail: updates.recipientEmail ?? primary[0].recipientEmail,
      recipientName: updates.recipientName ?? primary[0].recipientName,
      recipientPhone: updates.recipientPhone ?? primary[0].recipientPhone,
      updatedAt: new Date(),
    })
    .where(eq(communicationJobRecipientsTable.id, primary[0].id));

  const job = await getJobById(jobId);
  if (job) {
    const mergeData = {
      ...(job.mergeData ?? {}),
      email: updates.recipientEmail ?? primary[0].recipientEmail,
    };
    await db
      .update(communicationJobsTable)
      .set({ mergeData, updatedAt: new Date() })
      .where(eq(communicationJobsTable.id, jobId));
  }

  await logCommunicationAction({
    jobId,
    action: "edited",
    recipientEmail: updates.recipientEmail ?? primary[0].recipientEmail,
    recipientName: updates.recipientName ?? primary[0].recipientName,
    createdBy: audit?.createdBy ?? null,
    ipAddress: audit?.ipAddress ?? null,
    metadata: { field: "recipient" },
  });

  await revalidateAndRefreshJob(jobId);
}

export async function listJobs(filters: JobListFilters = {}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  const offset = filters.offset ?? 0;
  const conditions = [];

  if (filters.status) conditions.push(eq(communicationJobsTable.status, filters.status));
  if (filters.statuses?.length) conditions.push(inArray(communicationJobsTable.status, filters.statuses));
  if (filters.pendingReason) conditions.push(eq(communicationJobsTable.pendingReason, filters.pendingReason));
  if (filters.tournamentId) conditions.push(eq(communicationJobsTable.tournamentId, filters.tournamentId));
  if (filters.templateId) conditions.push(eq(communicationJobsTable.templateId, filters.templateId));
  if (filters.templateInternalKey) {
    conditions.push(eq(communicationJobsTable.templateInternalKey, filters.templateInternalKey));
  }
  if (filters.channel) conditions.push(eq(communicationJobsTable.channel, filters.channel));
  if (filters.sentBy) conditions.push(eq(communicationJobsTable.sentBy, filters.sentBy));
  if (filters.dateFrom) conditions.push(gte(communicationJobsTable.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(communicationJobsTable.createdAt, new Date(filters.dateTo)));

  const jobs = await db
    .select()
    .from(communicationJobsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(communicationJobsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const jobIds = jobs.map((j) => j.id);
  const recipients = jobIds.length
    ? await db
        .select()
        .from(communicationJobRecipientsTable)
        .where(inArray(communicationJobRecipientsTable.jobId, jobIds))
    : [];

  const recipientByJob = new Map(recipients.map((r) => [r.jobId, r]));

  let results = jobs.map((job) => ({
    ...job,
    recipient: recipientByJob.get(job.id) ?? null,
  }));

  if (filters.search?.trim()) {
    const q = filters.search.toLowerCase();
    results = results.filter((j) => {
      const r = j.recipient;
      return (
        r?.recipientEmail?.toLowerCase().includes(q) ||
        r?.recipientName?.toLowerCase().includes(q) ||
        j.subject?.toLowerCase().includes(q) ||
        j.templateInternalKey?.toLowerCase().includes(q)
      );
    });
  }

  if (filters.recipientRole) {
    results = results.filter((j) => j.recipient?.recipientRole === filters.recipientRole);
  }

  return results;
}

export async function countJobs(filters: JobListFilters = {}): Promise<number> {
  const conditions = [];
  if (filters.status) conditions.push(eq(communicationJobsTable.status, filters.status));
  if (filters.statuses?.length) conditions.push(inArray(communicationJobsTable.status, filters.statuses));
  if (filters.tournamentId) conditions.push(eq(communicationJobsTable.tournamentId, filters.tournamentId));

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communicationJobsTable)
    .where(conditions.length ? and(...conditions) : undefined);
  return row?.count ?? 0;
}

export async function createResendJob(
  originalJobId: string,
  audit?: { createdBy?: string; ipAddress?: string },
): Promise<string | null> {
  const original = await getJobById(originalJobId);
  if (!original) return null;

  const primary = original.recipients.find((r) => r.isPrimary) ?? original.recipients[0];
  if (!primary?.recipientEmail || !isValidEmail(primary.recipientEmail)) {
    return null;
  }

  const newIdempotencyKey = `resend:${originalJobId}:${Date.now()}`;

  const mergeData = await refreshJobMergeData(original);

  const newJobId = await createCommunicationJob({
    channel: "email",
    templateId: original.templateId ?? undefined,
    templateInternalKey: original.templateInternalKey ?? undefined,
    tournamentId: original.tournamentId,
    triggeredByEvent: original.triggeredByEvent,
    entityType: original.entityType,
    entityId: original.entityId,
    recipientName: primary.recipientName,
    recipientEmail: primary.recipientEmail,
    recipientPhone: primary.recipientPhone,
    recipientRole: primary.recipientRole,
    mergeData,
    idempotencyKey: newIdempotencyKey,
    parentJobId: originalJobId,
    sentBy: "admin",
    createdByAdmin: audit?.createdBy ?? null,
    skipAutoQueue: true,
  });

  if (newJobId) {
    await queueJob(newJobId);
    await logCommunicationAction({
      jobId: newJobId,
      action: "resend",
      createdBy: audit?.createdBy ?? null,
      ipAddress: audit?.ipAddress ?? null,
      metadata: { originalJobId },
    });
  }

  return newJobId;
}

export async function cancelJob(
  jobId: string,
  audit?: { createdBy?: string; ipAddress?: string },
): Promise<boolean> {
  const job = await getJobById(jobId);
  if (!job) return false;
  if (["delivered", "cancelled", "processing"].includes(job.status)) return false;

  await updateJobStatus(jobId, "cancelled", {}, audit);
  await logCommunicationAction({
    jobId,
    action: "cancelled",
    createdBy: audit?.createdBy ?? null,
    ipAddress: audit?.ipAddress ?? null,
  });
  return true;
}

export async function getEntityCommunicationHistory(
  entityType: string,
  entityId: number,
  limit = 50,
) {
  const jobs = await db
    .select()
    .from(communicationJobsTable)
    .where(
      and(
        eq(communicationJobsTable.entityType, entityType),
        eq(communicationJobsTable.entityId, entityId),
      ),
    )
    .orderBy(desc(communicationJobsTable.createdAt))
    .limit(limit);

  const jobIds = jobs.map((j) => j.id);
  const recipients = jobIds.length
    ? await db
        .select()
        .from(communicationJobRecipientsTable)
        .where(inArray(communicationJobRecipientsTable.jobId, jobIds))
    : [];

  const recipientByJob = new Map(recipients.map((r) => [r.jobId, r]));

  return jobs.map((job) => ({
    ...job,
    recipient: recipientByJob.get(job.id) ?? null,
  }));
}
