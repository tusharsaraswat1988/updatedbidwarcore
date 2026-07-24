import { pool } from "@workspace/db";
import type { CommunicationJob } from "@workspace/db";
import { sendEmail } from "../notifications/providers/email-provider.js";
import { logger } from "../logger.js";
import { getJobById, updateJobStatus } from "./job-service.js";
import { logCommunicationAction } from "./template-service.js";
import { sweepPendingJobsForRecovery } from "./recovery.js";

const DEFAULT_POLL_MS = 5_000;
const MAX_JOBS_PER_TICK = 5;
const STALE_PROCESSING_MS = 2 * 60 * 1000;

/** Exponential backoff: 30s, 2m, 8m, 32m, 2h */
function nextRetryDelay(retryCount: number): number {
  const baseMs = 30_000;
  return Math.min(baseMs * Math.pow(4, retryCount), 2 * 60 * 60 * 1000);
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;
let recoveryTimer: ReturnType<typeof setInterval> | null = null;

function pollIntervalMs(): number {
  const raw = process.env.COMMUNICATION_WORKER_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_POLL_MS;
}

function isWorkerEnabled(): boolean {
  const flag = process.env.COMMUNICATION_WORKER_ENABLED;
  if (flag === "false" || flag === "0") return false;
  return true;
}

async function requeueStaleProcessingJobs(): Promise<void> {
  const result = await pool.query<{ id: string }>(`
    UPDATE communication_jobs
    SET status = 'queued', updated_at = NOW()
    WHERE status = 'processing'
      AND queued_at IS NOT NULL
      AND queued_at < NOW() - ($1::text)::interval
    RETURNING id
  `, [`${STALE_PROCESSING_MS} milliseconds`]);

  if (result.rowCount && result.rowCount > 0) {
    logger.warn({ count: result.rowCount }, "Re-queued stale communication jobs");
  }
}

async function claimNextQueuedJob(): Promise<CommunicationJob | null> {
  const result = await pool.query<CommunicationJob>(`
    UPDATE communication_jobs
    SET status = 'processing', updated_at = NOW()
    WHERE id = (
      SELECT id FROM communication_jobs
      WHERE status = 'queued'
        AND channel = 'email'
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  const raw = result.rows[0];
  if (!raw) return null;

  return mapPoolJobRow(raw);
}

function mapPoolJobRow(raw: CommunicationJob | Record<string, unknown>): CommunicationJob {
  if ("templateId" in raw && raw.templateId !== undefined) {
    return raw as CommunicationJob;
  }
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    channel: r.channel as string,
    templateId: (r.template_id as string | null) ?? null,
    templateVersionId: (r.template_version_id as string | null) ?? null,
    templateInternalKey: (r.template_internal_key as string | null) ?? null,
    tournamentId: (r.tournament_id as number | null) ?? null,
    triggeredByEvent: (r.triggered_by_event as string | null) ?? null,
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as number | null) ?? null,
    status: r.status as string,
    pendingReason: (r.pending_reason as string | null) ?? null,
    subject: (r.subject as string | null) ?? null,
    htmlBody: (r.html_body as string | null) ?? null,
    mergeData: (r.merge_data as Record<string, unknown>) ?? {},
    idempotencyKey: r.idempotency_key as string,
    parentJobId: (r.parent_job_id as string | null) ?? null,
    retryCount: Number(r.retry_count ?? 0),
    maxRetries: Number(r.max_retries ?? 5),
    nextRetryAt: (r.next_retry_at as Date | null) ?? null,
    sentBy: r.sent_by as string,
    createdByAdmin: (r.created_by_admin as string | null) ?? null,
    providerMessageId: (r.provider_message_id as string | null) ?? null,
    errorMessage: (r.error_message as string | null) ?? null,
    bulkCampaignId: (r.bulk_campaign_id as string | null) ?? null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
    queuedAt: (r.queued_at as Date | null) ?? null,
    sentAt: (r.sent_at as Date | null) ?? null,
    deliveredAt: (r.delivered_at as Date | null) ?? null,
    openedAt: (r.opened_at as Date | null) ?? null,
    clickedAt: (r.clicked_at as Date | null) ?? null,
  };
}

async function processJob(job: CommunicationJob): Promise<void> {
  const full = await getJobById(job.id);
  if (!full) return;

  const primary = full.recipients.find((r) => r.isPrimary) ?? full.recipients[0];
  if (!primary?.recipientEmail || !full.subject || !full.htmlBody) {
    await updateJobStatus(job.id, "failed", {
      errorMessage: "Missing recipient email or rendered content",
    });
    return;
  }

  await logCommunicationAction({
    jobId: job.id,
    action: "send_attempt",
    recipientEmail: primary.recipientEmail,
    recipientName: primary.recipientName,
    metadata: { retryCount: job.retryCount },
  });

  const result = await sendEmail({
    to: primary.recipientEmail,
    subject: full.subject,
    html: full.htmlBody,
  });

  if (result.success) {
    await updateJobStatus(job.id, "delivered", {
      providerMessageId: result.messageId ?? null,
      sentAt: new Date(),
      deliveredAt: new Date(),
      errorMessage: null,
    });
    logger.info({ jobId: job.id, messageId: result.messageId }, "Communication job delivered");
    return;
  }

  const newRetryCount = job.retryCount + 1;
  if (newRetryCount >= job.maxRetries) {
    await updateJobStatus(job.id, "failed", {
      errorMessage: result.error ?? "Send failed",
      retryCount: newRetryCount,
    });
    return;
  }

  const nextRetry = new Date(Date.now() + nextRetryDelay(newRetryCount));
  await updateJobStatus(job.id, "failed", {
    errorMessage: result.error ?? "Send failed",
    retryCount: newRetryCount,
    nextRetryAt: nextRetry,
  });

  await pool.query(`
    UPDATE communication_jobs SET status = 'queued', queued_at = NOW() WHERE id = $1
  `, [job.id]);

  await logCommunicationAction({
    jobId: job.id,
    action: "retry",
    newStatus: "queued",
    metadata: { retryCount: newRetryCount, nextRetryAt: nextRetry.toISOString() },
  });
}

async function workerTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;

  try {
    await requeueStaleProcessingJobs();

    for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
      const job = await claimNextQueuedJob();
      if (!job) break;
      await processJob(job).catch((err) => {
        logger.error({ jobId: job.id, err }, "Communication job processing failed");
        void updateJobStatus(job.id, "failed", {
          errorMessage: err instanceof Error ? err.message : "Processing error",
        });
      });
    }
  } catch (err) {
    logger.error({ err }, "Communication worker tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startCommunicationWorker(): void {
  if (!isWorkerEnabled()) {
    logger.info("Communication worker disabled");
    return;
  }

  if (workerTimer) return;

  logger.info({ pollMs: pollIntervalMs() }, "Starting communication worker");
  void workerTick();
  workerTimer = setInterval(() => void workerTick(), pollIntervalMs());

  recoveryTimer = setInterval(() => {
    void sweepPendingJobsForRecovery().catch((err) => {
      logger.error({ err }, "Communication recovery sweep failed");
    });
  }, 60_000);
}

export function stopCommunicationWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (recoveryTimer) {
    clearInterval(recoveryTimer);
    recoveryTimer = null;
  }
}
