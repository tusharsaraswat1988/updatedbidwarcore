/**
 * Poll creative_jobs queue and render queued jobs to PNG.
 *
 * Enabled when CREATIVE_RENDER_WORKER_ENABLED=true (default: true in development).
 * No public access — result URLs are stored for organizer-scoped API only.
 */

import { pool } from "@workspace/db";
import type { CreativeJobRow } from "@workspace/db";
import { processCreativeJobRow } from "./creative-render-process.js";
import { closeRenderBrowser } from "./creative-render-screenshot.js";
import { logger } from "./logger.js";

const DEFAULT_POLL_MS = 5_000;
const MAX_JOBS_PER_TICK = 2;
/** Jobs stuck in processing longer than this are re-queued (e.g. crash mid-render). */
const STALE_PROCESSING_MS = 2 * 60 * 1000;

/** Raw pg pool rows use snake_case; Drizzle uses camelCase. */
function mapPoolCreativeJobRow(raw: CreativeJobRow | Record<string, unknown>): CreativeJobRow {
  if ("templateId" in raw && raw.templateId != null) {
    return raw as CreativeJobRow;
  }
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    tournamentId: Number(r.tournament_id),
    templateId: r.template_id as string,
    status: r.status as string,
    contractJson: r.contract_json as Record<string, unknown>,
    aspectRatio: r.aspect_ratio as string,
    requestedByUserId: (r.requested_by_user_id as number | null | undefined) ?? null,
    createdAt: r.created_at as Date,
    startedAt: (r.started_at as Date | null | undefined) ?? null,
    completedAt: (r.completed_at as Date | null | undefined) ?? null,
    errorMessage: (r.error_message as string | null | undefined) ?? null,
    resultUrl: (r.result_url as string | null | undefined) ?? null,
    downloadEnabled: Boolean(r.download_enabled),
  };
}

async function requeueStaleProcessingJobs(): Promise<void> {
  const result = await pool.query<{ id: string }>(`
    UPDATE creative_jobs
    SET status = 'queued', started_at = NULL
    WHERE status = 'processing'
      AND started_at IS NOT NULL
      AND started_at < NOW() - ($1::text)::interval
    RETURNING id
  `, [`${STALE_PROCESSING_MS} milliseconds`]);

  if (result.rowCount && result.rowCount > 0) {
    logger.warn({ count: result.rowCount, jobIds: result.rows.map((r) => r.id) }, "Re-queued stale creative jobs");
  }
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let tickInFlight = false;

function pollIntervalMs(): number {
  const raw = process.env.CREATIVE_RENDER_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_POLL_MS;
}

function isWorkerEnabled(): boolean {
  const flag = process.env.CREATIVE_RENDER_WORKER_ENABLED;
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  return process.env.NODE_ENV !== "production";
}

async function claimNextQueuedJob(): Promise<CreativeJobRow | null> {
  const result = await pool.query<CreativeJobRow>(`
    UPDATE creative_jobs
    SET status = 'processing', started_at = NOW()
    WHERE id = (
      SELECT id FROM creative_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  const raw = result.rows[0];
  return raw ? mapPoolCreativeJobRow(raw) : null;
}

async function workerTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    await requeueStaleProcessingJobs();
    for (let i = 0; i < MAX_JOBS_PER_TICK; i++) {
      const job = await claimNextQueuedJob();
      if (!job) break;
      await processCreativeJobRow(job);
    }
  } catch (err) {
    logger.error({ err }, "Creative render worker tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startCreativeRenderWorker(): void {
  if (!isWorkerEnabled()) {
    logger.info("Creative render worker disabled (CREATIVE_RENDER_WORKER_ENABLED=false)");
    return;
  }
  if (workerTimer) return;

  const intervalMs = pollIntervalMs();
  logger.info({ intervalMs }, "Starting creative render worker");
  void workerTick();
  workerTimer = setInterval(() => {
    void workerTick();
  }, intervalMs);
}

export function stopCreativeRenderWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  void closeRenderBrowser();
}
