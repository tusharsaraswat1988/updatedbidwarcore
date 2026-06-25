import type { LocalDb } from "@workspace/db-local";
import { syncQueueTable } from "@workspace/db-local";
import { eq, isNull } from "drizzle-orm";

const CHECK_INTERVAL_MS = 30_000;
const FAILED_RETRY_BASE_MS = 60_000;
const FAILED_RETRY_MAX_MS = 15 * 60_000;
const MAX_FAILED_RETRIES = 8;

function parseRetryCount(error: string | null): number {
  if (!error) return 0;
  const match = /^retries:(\d+)\|/.exec(error);
  return match ? parseInt(match[1], 10) : 0;
}

function failedRetryDelayMs(retryCount: number): number {
  const delay = FAILED_RETRY_BASE_MS * 2 ** Math.min(retryCount, 4);
  return Math.min(delay, FAILED_RETRY_MAX_MS);
}

function shouldRetryFailed(entry: { failed: boolean; createdAt: string; error: string | null }): boolean {
  if (!entry.failed) return true;
  const retries = parseRetryCount(entry.error);
  if (retries >= MAX_FAILED_RETRIES) return false;
  const ageMs = Date.now() - new Date(entry.createdAt).getTime();
  return ageMs >= failedRetryDelayMs(retries);
}

export function createSyncWorker(db: LocalDb, cloudBaseUrl = "") {
  async function checkAndSync() {
    const pending = await db
      .select()
      .from(syncQueueTable)
      .where(isNull(syncQueueTable.syncedAt))
      .then((rows) => rows.filter((e) => shouldRetryFailed(e)));

    if (pending.length === 0) return;

    try {
      await fetch("https://clients1.google.com/generate_204", {
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      return;
    }

    for (const entry of pending) {
      try {
        const payload = JSON.parse(entry.payload) as {
          url?: string; endpoint?: string; method?: string;
          data?: unknown; exportToken?: string;
        };
        const targetUrl = payload.url ?? `${cloudBaseUrl}${payload.endpoint ?? ""}`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (payload.exportToken) headers["X-Export-Token"] = payload.exportToken;
        const res = await fetch(targetUrl, {
          method: payload.method ?? "POST",
          headers,
          body: JSON.stringify(payload.data),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          await db
            .update(syncQueueTable)
            .set({ syncedAt: new Date().toISOString(), failed: false, error: null })
            .where(eq(syncQueueTable.id, entry.id));
        } else {
          const retries = entry.failed ? parseRetryCount(entry.error) + 1 : 1;
          await db
            .update(syncQueueTable)
            .set({ failed: true, error: `retries:${retries}|HTTP ${res.status}` })
            .where(eq(syncQueueTable.id, entry.id));
        }
      } catch (err) {
        const retries = entry.failed ? parseRetryCount(entry.error) + 1 : 1;
        await db
          .update(syncQueueTable)
          .set({ failed: true, error: `retries:${retries}|${String(err)}` })
          .where(eq(syncQueueTable.id, entry.id));
      }
    }
  }

  checkAndSync().catch(console.error);
  setInterval(() => checkAndSync().catch(console.error), CHECK_INTERVAL_MS);
}
