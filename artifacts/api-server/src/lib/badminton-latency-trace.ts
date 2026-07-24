/**
 * Badminton score→LED latency tracing (measurement only).
 * No-ops unless runWithLatencyTrace() is active for the request.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { hrtime } from "node:process";

export type BadmintonLatencyMarks = {
  /** High-res origin (bigint ns) for absolute deltas */
  originNs: bigint;
  /** Named marks as ms from origin */
  marks: Record<string, number>;
};

type Store = BadmintonLatencyMarks;

const storage = new AsyncLocalStorage<Store>();

function msFromOrigin(originNs: bigint): number {
  const diff = hrtime.bigint() - originNs;
  return Number(diff) / 1e6;
}

export function isLatencyTraceActive(): boolean {
  return storage.getStore() != null;
}

/** Record a named mark (ms from trace origin). Safe no-op outside a trace. */
export function markLatency(name: string): void {
  const store = storage.getStore();
  if (!store) return;
  store.marks[name] = msFromOrigin(store.originNs);
}

export function getLatencyMarks(): Record<string, number> | null {
  return storage.getStore()?.marks ?? null;
}

export async function runWithLatencyTrace<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; marks: Record<string, number> }> {
  const store: Store = { originNs: hrtime.bigint(), marks: { t2_request_entered: 0 } };
  return storage.run(store, async () => {
    const result = await fn();
    return { result, marks: { ...store.marks } };
  });
}

export type LatencyPhaseBreakdown = {
  t2_ms: number;
  t3_ms: number | null;
  t4_ms: number | null;
  server_processing_ms: number | null;
  broadcast_delay_ms: number | null;
  phases: Record<string, number>;
};

/** Map raw marks → T2/T3/T4 relative to request enter (T2 = 0). */
export function toPhaseBreakdown(marks: Record<string, number>): LatencyPhaseBreakdown {
  const t2 = marks.t2_request_entered ?? 0;
  const t3 = marks.t3_event_written ?? null;
  const t4 = marks.t4_sse_emitted ?? null;
  return {
    t2_ms: t2,
    t3_ms: t3,
    t4_ms: t4,
    server_processing_ms: t3 == null ? null : t3 - t2,
    broadcast_delay_ms: t3 == null || t4 == null ? null : t4 - t3,
    phases: marks,
  };
}
