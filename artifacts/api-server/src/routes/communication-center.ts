import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { requireMasterAdmin } from "../middleware/require-admin.js";
import {
  cancelJob,
  createResendJob,
  createTemplateVersion,
  getDashboardStats,
  getEntityCommunicationHistory,
  getJobById,
  getSettings,
  getTemplateById,
  listJobs,
  listTemplates,
  logCommunicationAction,
  queueBulkCommunication,
  queueJob,
  revalidateAndRefreshJob,
  renderMergeTemplate,
  buildSampleMergeData,
  highlightUnknownVariables,
  findUnknownVariables,
  resolveBulkRecipients,
  updateJobRecipient,
  updateSetting,
  getBulkTargets,
} from "../lib/communication/index.js";
import {
  db,
  communicationAssetsTable,
  communicationLogsTable,
  communicationTemplatesTable,
} from "@workspace/db";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { sendEmail } from "../lib/notifications/providers/email-provider.js";

const router: IRouter = Router();

/** Platform-internal module — Super Admin only. Not exposed to organisers or data-entry admins. */
router.use(requireMasterAdmin);

function adminLabel(_req: Request): string {
  return "master_admin";
}

function clientIp(req: Request): string | undefined {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/dashboard", async (req, res) => {
  const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;
  const stats = await getDashboardStats(tournamentId);
  res.json(stats);
});

// ─── Templates ───────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/templates", async (req, res) => {
  const includeDrafts = req.query.includeDrafts === "true";
  const includeArchived = req.query.includeArchived === "true";
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const templates = await listTemplates({ includeDrafts, includeArchived, search });
  res.json({ templates });
});

router.get("/auth/admin/communication-center/templates/:id", async (req, res) => {
  const template = await getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json({ template });
});

const templateSchema = z.object({
  name: z.string().min(1),
  internalKey: z.string().min(1).regex(/^[a-z0-9_]+$/),
  subject: z.string(),
  htmlBody: z.string(),
  footerHtml: z.string().optional().nullable(),
  signatureHtml: z.string().optional().nullable(),
  headerImageAssetId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  autoSend: z.boolean().optional(),
  isDraft: z.boolean().optional(),
  eventType: z.string().optional().nullable(),
  changeNote: z.string().optional(),
});

router.post("/auth/admin/communication-center/templates", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [created] = await db
    .insert(communicationTemplatesTable)
    .values({
      name: parsed.data.name,
      internalKey: parsed.data.internalKey,
      subject: parsed.data.subject,
      htmlBody: parsed.data.htmlBody,
      footerHtml: parsed.data.footerHtml ?? null,
      signatureHtml: parsed.data.signatureHtml ?? null,
      headerImageAssetId: parsed.data.headerImageAssetId ?? null,
      isActive: parsed.data.isActive ?? true,
      autoSend: parsed.data.autoSend ?? true,
      isDraft: parsed.data.isDraft ?? false,
      eventType: parsed.data.eventType ?? null,
      createdBy: adminLabel(req),
      updatedBy: adminLabel(req),
    })
    .returning();

  await createTemplateVersion(created!.id, {
    subject: parsed.data.subject,
    htmlBody: parsed.data.htmlBody,
    footerHtml: parsed.data.footerHtml,
    signatureHtml: parsed.data.signatureHtml,
    headerImageAssetId: parsed.data.headerImageAssetId,
    changeNote: parsed.data.changeNote ?? "Initial version",
    createdBy: adminLabel(req),
  });

  await logCommunicationAction({
    templateId: created!.id,
    action: "created",
    createdBy: adminLabel(req),
    triggeredBy: "admin",
    ipAddress: clientIp(req),
  });

  res.status(201).json({ template: created });
});

router.put("/auth/admin/communication-center/templates/:id", async (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await getTemplateById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const subject = parsed.data.subject ?? existing.subject;
  const htmlBody = parsed.data.htmlBody ?? existing.htmlBody;

  const { versionId } = await createTemplateVersion(existing.id, {
    subject,
    htmlBody,
    footerHtml: parsed.data.footerHtml ?? existing.footerHtml,
    signatureHtml: parsed.data.signatureHtml ?? existing.signatureHtml,
    headerImageAssetId: parsed.data.headerImageAssetId ?? existing.headerImageAssetId,
    changeNote: parsed.data.changeNote ?? "Updated",
    createdBy: adminLabel(req),
  });

  const updates: Record<string, unknown> = { updatedBy: adminLabel(req), updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.autoSend !== undefined) updates.autoSend = parsed.data.autoSend;
  if (parsed.data.isDraft !== undefined) updates.isDraft = parsed.data.isDraft;
  if (parsed.data.eventType !== undefined) updates.eventType = parsed.data.eventType;

  const [updated] = await db
    .update(communicationTemplatesTable)
    .set(updates)
    .where(eq(communicationTemplatesTable.id, existing.id))
    .returning();

  await logCommunicationAction({
    templateId: existing.id,
    templateVersionId: versionId,
    action: "edited",
    createdBy: adminLabel(req),
    ipAddress: clientIp(req),
  });

  res.json({ template: updated });
});

router.post("/auth/admin/communication-center/templates/:id/duplicate", async (req, res) => {
  const existing = await getTemplateById(req.params.id);
  if (!existing) return res.status(404).json({ error: "Template not found" });

  const newKey = `${existing.internalKey}_copy_${Date.now()}`;
  const [copy] = await db
    .insert(communicationTemplatesTable)
    .values({
      name: `${existing.name} (Copy)`,
      internalKey: newKey,
      subject: existing.subject,
      htmlBody: existing.htmlBody,
      footerHtml: existing.footerHtml,
      signatureHtml: existing.signatureHtml,
      headerImageAssetId: existing.headerImageAssetId,
      isActive: false,
      autoSend: false,
      isDraft: true,
      eventType: null,
      createdBy: adminLabel(req),
    })
    .returning();

  res.status(201).json({ template: copy });
});

router.post("/auth/admin/communication-center/templates/:id/archive", async (req, res) => {
  const [updated] = await db
    .update(communicationTemplatesTable)
    .set({ isArchived: true, isActive: false, updatedAt: new Date() })
    .where(eq(communicationTemplatesTable.id, req.params.id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Template not found" });
  res.json({ template: updated });
});

router.post("/auth/admin/communication-center/templates/:id/test", async (req, res) => {
  const { email, mergeData } = req.body as { email?: string; mergeData?: Record<string, unknown> };
  if (!email) return res.status(400).json({ error: "email required" });

  const template = await getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const data = { ...buildSampleMergeData(), ...mergeData };
  const subject = renderMergeTemplate(template.subject, data);
  const html = highlightUnknownVariables(
    renderMergeTemplate(template.htmlBody, data) +
      (template.footerHtml ? renderMergeTemplate(template.footerHtml, data) : "") +
      (template.signatureHtml ? renderMergeTemplate(template.signatureHtml, data) : ""),
  );

  const result = await sendEmail({ to: email, subject: `[TEST] ${subject}`, html });
  res.json({ success: result.success, messageId: result.messageId, error: result.error });
});

router.post("/auth/admin/communication-center/templates/:id/preview", async (req, res) => {
  const template = await getTemplateById(req.params.id);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const mergeData = { ...buildSampleMergeData(), ...(req.body?.mergeData ?? {}) };
  const subject = renderMergeTemplate(template.subject, mergeData);
  const html = highlightUnknownVariables(
    renderMergeTemplate(template.htmlBody, mergeData) +
      (template.footerHtml ? renderMergeTemplate(template.footerHtml, mergeData) : "") +
      (template.signatureHtml ? renderMergeTemplate(template.signatureHtml, mergeData) : ""),
  );

  res.json({
    subject,
    html,
    unknownVariables: findUnknownVariables(template.htmlBody + template.subject),
  });
});

// ─── Jobs ────────────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/jobs", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const statuses = typeof req.query.statuses === "string" ? req.query.statuses.split(",") : undefined;
  const pendingReason = typeof req.query.pendingReason === "string" ? req.query.pendingReason : undefined;
  const tournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const jobs = await listJobs({ status, statuses, pendingReason, tournamentId, search, limit, offset });
  res.json({ jobs, total: jobs.length });
});

router.get("/auth/admin/communication-center/jobs/:id", async (req, res) => {
  const job = await getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

router.post("/auth/admin/communication-center/jobs/:id/send", async (req, res) => {
  const job = await getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  await revalidateAndRefreshJob(req.params.id);
  const queued = await queueJob(req.params.id);

  await logCommunicationAction({
    jobId: req.params.id,
    action: "send_attempt",
    createdBy: adminLabel(req),
    ipAddress: clientIp(req),
    triggeredBy: "admin_manual",
  });

  res.json({ success: queued });
});

router.post("/auth/admin/communication-center/jobs/bulk-send", async (req, res) => {
  const { jobIds, allReady } = req.body as { jobIds?: string[]; allReady?: boolean };
  let ids = jobIds ?? [];

  if (allReady) {
    const ready = await listJobs({ statuses: ["ready_to_send"], limit: 500 });
    ids = ready.map((j) => j.id);
  }

  let queued = 0;
  for (const id of ids) {
    await revalidateAndRefreshJob(id);
    if (await queueJob(id)) queued++;
  }

  res.json({ queued, total: ids.length });
});

router.post("/auth/admin/communication-center/jobs/retry-failed", async (req, res) => {
  const failed = await listJobs({ status: "failed", limit: 200 });
  let retried = 0;
  for (const job of failed) {
    await revalidateAndRefreshJob(job.id);
    if (await queueJob(job.id)) retried++;
  }
  res.json({ retried });
});

router.post("/auth/admin/communication-center/jobs/:id/cancel", async (req, res) => {
  const ok = await cancelJob(req.params.id, { createdBy: adminLabel(req), ipAddress: clientIp(req) });
  res.json({ success: ok });
});

router.post("/auth/admin/communication-center/jobs/:id/resend", async (req, res) => {
  const newJobId = await createResendJob(req.params.id, {
    createdBy: adminLabel(req),
    ipAddress: clientIp(req),
  });
  if (!newJobId) {
    return res.status(400).json({ error: "Cannot resend — recipient email missing or job not found" });
  }
  res.json({ success: true, newJobId });
});

router.patch("/auth/admin/communication-center/jobs/:id/recipient", async (req, res) => {
  const { recipientEmail, recipientName, recipientPhone } = req.body as {
    recipientEmail?: string;
    recipientName?: string;
    recipientPhone?: string;
  };

  await updateJobRecipient(
    req.params.id,
    { recipientEmail, recipientName, recipientPhone },
    { createdBy: adminLabel(req), ipAddress: clientIp(req) },
  );

  res.json({ success: true });
});

// ─── Bulk ────────────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/bulk/targets", async (req, res) => {
  const tournamentId = Number(req.query.tournamentId);
  if (!Number.isFinite(tournamentId)) {
    return res.status(400).json({ error: "tournamentId required" });
  }
  const targets = await getBulkTargets(tournamentId);
  res.json(targets);
});

router.post("/auth/admin/communication-center/bulk/preview-recipients", async (req, res) => {
  const filter = req.body as Parameters<typeof resolveBulkRecipients>[0];
  const recipients = await resolveBulkRecipients(filter);
  res.json({ recipients, count: recipients.length });
});

router.post("/auth/admin/communication-center/bulk/queue", async (req, res) => {
  const { templateId, filter, mergeData, sendImmediately } = req.body as {
    templateId: string;
    filter: Parameters<typeof resolveBulkRecipients>[0];
    mergeData?: Record<string, unknown>;
    sendImmediately?: boolean;
  };

  if (!templateId || !filter) return res.status(400).json({ error: "templateId and filter required" });

  const recipients = await resolveBulkRecipients(filter);
  const result = await queueBulkCommunication({
    templateId,
    recipients,
    mergeData,
    createdByAdmin: adminLabel(req),
    sendImmediately: sendImmediately ?? true,
  });

  res.json(result);
});

// ─── Assets ──────────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/assets", async (_req, res) => {
  const assets = await db.select().from(communicationAssetsTable).orderBy(communicationAssetsTable.name);
  res.json({ assets });
});

router.post("/auth/admin/communication-center/assets", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    assetKey: z.string().min(1),
    assetType: z.string().min(1),
    content: z.string().min(1),
    mimeType: z.string().optional(),
    description: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [asset] = await db.insert(communicationAssetsTable).values(parsed.data).returning();
  res.status(201).json({ asset });
});

router.put("/auth/admin/communication-center/assets/:id", async (req, res) => {
  const [asset] = await db
    .update(communicationAssetsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(eq(communicationAssetsTable.id, req.params.id))
    .returning();

  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json({ asset });
});

// ─── Logs ────────────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const jobId = typeof req.query.jobId === "string" ? req.query.jobId : undefined;

  const conditions = [];
  if (jobId) conditions.push(eq(communicationLogsTable.jobId, jobId));
  if (search) {
    conditions.push(
      or(
        ilike(communicationLogsTable.recipientEmail, `%${search}%`),
        ilike(communicationLogsTable.recipientName, `%${search}%`),
        ilike(communicationLogsTable.action, `%${search}%`),
      ),
    );
  }

  const logs = await db
    .select()
    .from(communicationLogsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(communicationLogsTable.createdAt))
    .limit(limit);

  res.json({ logs });
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/settings", async (_req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

router.put("/auth/admin/communication-center/settings", async (req, res) => {
  const { key, value } = req.body as { key?: string; value?: Record<string, unknown> };
  if (!key || !value) return res.status(400).json({ error: "key and value required" });

  await updateSetting(key, value, adminLabel(req));
  res.json({ success: true });
});

// ─── Entity history ──────────────────────────────────────────────────────────

router.get("/auth/admin/communication-center/history/:entityType/:entityId", async (req, res) => {
  const entityId = Number(req.params.entityId);
  if (!Number.isFinite(entityId)) return res.status(400).json({ error: "Invalid entity ID" });

  const history = await getEntityCommunicationHistory(req.params.entityType, entityId);
  res.json({ history });
});

export default router;
