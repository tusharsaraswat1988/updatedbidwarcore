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
  return result.rows[0] ?? null;
}

async function workerTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
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
