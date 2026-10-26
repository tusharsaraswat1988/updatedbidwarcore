import type { SponsorMediaSurface } from "@workspace/scoring-core";

export const SPONSOR_MEDIA_READY_STALE_MS = 30_000;

export type SponsorSurfaceSlotReport = {
  slotNumber: number;
  version: number;
  status: "ready" | "preparing" | "missing" | "failed";
  error?: string;
};

export type SponsorSurfacePlaybackReport = {
  status: "idle" | "playing" | "ended" | "stopped" | "error";
  slotNumber: number | null;
  cueId: string | null;
  error?: string;
};

export type SponsorSurfaceReport = {
  surface: SponsorMediaSurface;
  reportedAt: number;
  slots: SponsorSurfaceSlotReport[];
  playback: SponsorSurfacePlaybackReport;
};

const reports = new Map<string, SponsorSurfaceReport>();

function key(tournamentId: number, surface: SponsorMediaSurface): string {
  return `${tournamentId}:${surface}`;
}

export function recordSponsorMediaReadiness(
  tournamentId: number,
  report: Omit<SponsorSurfaceReport, "reportedAt"> & { reportedAt?: number },
): SponsorSurfaceReport {
  const stored: SponsorSurfaceReport = {
    surface: report.surface,
    reportedAt: report.reportedAt ?? Date.now(),
    slots: report.slots,
    playback: report.playback,
  };
  reports.set(key(tournamentId, report.surface), stored);
  return stored;
}

export function getSponsorMediaReadiness(tournamentId: number, now = Date.now()): {
  obs: SponsorSurfaceReport | null;
  led: SponsorSurfaceReport | null;
} {
  return {
    obs: fresh(reports.get(key(tournamentId, "obs")), now),
    led: fresh(reports.get(key(tournamentId, "led")), now),
  };
}

function fresh(report: SponsorSurfaceReport | undefined, now: number): SponsorSurfaceReport | null {
  if (!report) return null;
  if (now - report.reportedAt > SPONSOR_MEDIA_READY_STALE_MS) return null;
  return report;
}

export function surfaceReadyFor(
  report: SponsorSurfaceReport | null,
  slotNumber: number,
  version: number,
): boolean {
  return Boolean(report?.slots.some((item) =>
    item.slotNumber === slotNumber && item.version === version && item.status === "ready",
  ));
}

export type SponsorReadinessCurrentSlot = {
  slotNumber: number;
  version: number;
  broadcastReady: boolean;
};

/** A ready claim is kept only when it matches the current broadcast version. */
export function scopeReadinessToCurrentVersions(
  slots: SponsorSurfaceSlotReport[],
  current: SponsorReadinessCurrentSlot[],
): SponsorSurfaceSlotReport[] {
  const bySlot = new Map(current.map((slot) => [slot.slotNumber, slot]));
  return slots.map((slot) => {
    if (slot.status !== "ready") return slot;
    const live = bySlot.get(slot.slotNumber);
    if (!live?.broadcastReady || live.version !== slot.version) {
      return { ...slot, status: "missing", error: "Old version" };
    }
    return slot;
  });
}

export function authorizeReadinessReport(input: {
  identity: { tournamentId: number; surface: SponsorMediaSurface } | null;
  pathTournamentId: number;
  claimedSurface: unknown;
}): { ok: true; tournamentId: number; surface: SponsorMediaSurface } | { ok: false; status: 401 | 403; error: string } {
  if (!input.identity) {
    return { ok: false, status: 401, error: "Authentication required" };
  }
  if (input.identity.tournamentId !== input.pathTournamentId) {
    return { ok: false, status: 403, error: "Display session is for a different tournament" };
  }
  if (
    input.claimedSurface !== undefined
    && input.claimedSurface !== null
    && input.claimedSurface !== input.identity.surface
  ) {
    return { ok: false, status: 403, error: "Display session cannot report for another screen" };
  }
  return { ok: true, tournamentId: input.identity.tournamentId, surface: input.identity.surface };
}

export function resetSponsorMediaReadinessForTests(): void {
  reports.clear();
}
