import type { LocalDb } from "@workspace/db-local";
import { syncQueueTable } from "@workspace/db-local";
import { eq, and, isNull } from "drizzle-orm";

const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

export function createSyncWorker(db: LocalDb, cloudBaseUrl: string) {
  async function checkAndSync() {
    if (!cloudBaseUrl) return;

    // Check internet connectivity (plain fetch — mode:"no-cors" is browser-only and breaks Node.js)
    try {
      await fetch("https://clients1.google.com/generate_204", {
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      return; // No internet, skip
    }

    // Find unsynced queue entries
    const pending = await db
      .select()
      .from(syncQueueTable)
      .where(and(eq(syncQueueTable.failed, false), isNull(syncQueueTable.syncedAt)));

    if (pending.length === 0) return;

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
            .set({ syncedAt: new Date().toISOString() })
            .where(eq(syncQueueTable.id, entry.id));
        } else {
          await db
            .update(syncQueueTable)
            .set({ failed: true, error: `HTTP ${res.status}` })
            .where(eq(syncQueueTable.id, entry.id));
        }
      } catch (err) {
        await db
          .update(syncQueueTable)
          .set({ failed: true, error: String(err) })
          .where(eq(syncQueueTable.id, entry.id));
      }
    }
  }

  // Run immediately and then on interval
  checkAndSync().catch(console.error);
  setInterval(() => checkAndSync().catch(console.error), CHECK_INTERVAL_MS);
}
