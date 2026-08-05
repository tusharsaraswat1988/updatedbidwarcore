import type { FixtureSource } from "./types.ts";

export function encodeFixtureId(source: FixtureSource, runtimeId: number): string {
  return source === "badminton" ? `bd-${runtimeId}` : `sd-${runtimeId}`;
}

export function parseFixtureId(
  raw: string,
): { source: FixtureSource; runtimeId: number } | null {
  const match = /^(bd|sd)-(\d+)$/.exec(raw.trim());
  if (!match) return null;
  const runtimeId = Number(match[2]);
  if (!Number.isFinite(runtimeId)) return null;
  return {
    source: match[1] === "bd" ? "badminton" : "cricket",
    runtimeId,
  };
}
