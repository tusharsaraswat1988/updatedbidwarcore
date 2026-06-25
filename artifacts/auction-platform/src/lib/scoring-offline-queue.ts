/**
 * IndexedDB queue for cricket scoring events when the scorer loses connectivity.
 */

export type QueuedScoringEvent = {
  id: string;
  tournamentId: number;
  matchId: number;
  eventType: string;
  payload: Record<string, unknown>;
  expectedSequence: number;
  correlationId: string;
  createdAt: number;
};

const DB_NAME = "bidwar-scoring-queue";
const DB_VERSION = 1;
const STORE = "events";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("matchId", "matchId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export async function enqueueScoringEvent(
  event: Omit<QueuedScoringEvent, "id" | "createdAt" | "correlationId"> & {
    correlationId?: string;
  },
): Promise<QueuedScoringEvent> {
  const row: QueuedScoringEvent = {
    ...event,
    id: crypto.randomUUID(),
    correlationId: event.correlationId ?? crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve(row);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueuedScoringEvents(matchId: number): Promise<QueuedScoringEvent[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("matchId");
    const request = index.getAll(matchId);
    request.onsuccess = () => {
      const rows = (request.result as QueuedScoringEvent[]).sort((a, b) => a.createdAt - b.createdAt);
      resolve(rows);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedScoringEvent(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countQueuedScoringEvents(matchId: number): Promise<number> {
  const rows = await listQueuedScoringEvents(matchId);
  return rows.length;
}

export function isScoringOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export function isNetworkScoringError(err: unknown): boolean {
  if (isScoringOffline()) return true;
  if (err instanceof TypeError) return true;
  const status = (err as { status?: number })?.status;
  return status === 0 || status === 502 || status === 503 || status === 504;
}
