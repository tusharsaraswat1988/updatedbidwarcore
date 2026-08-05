import { encodeFixtureId, parseFixtureId } from "../fixture/ids.ts";
import type { SchedulingSource } from "./types.ts";

/** Scheduling Plan id equals Fixture Identity (EPIC-06). */
export function encodeSchedulingId(source: SchedulingSource, runtimeId: number): string {
  return encodeFixtureId(source, runtimeId);
}

export function parseSchedulingId(
  raw: string,
): { source: SchedulingSource; runtimeId: number } | null {
  return parseFixtureId(raw);
}
