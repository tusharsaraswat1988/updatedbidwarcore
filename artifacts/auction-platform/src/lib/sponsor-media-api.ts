import { apiFetch } from "@workspace/api-base/api-fetch";
import type { SponsorMediaDestination, SponsorMediaSurface } from "@workspace/scoring-core";

export type SponsorMediaSlotDto = {
  id: number | null;
  tournamentId: number;
  slotNumber: number;
  title: string;
  assetType: "image" | "video" | null;
  broadcastUrl: string | null;
  posterUrl: string | null;
  durationMs: number;
  fileSizeBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  processingStatus: "empty" | "uploading" | "processing" | "ready" | "failed" | "disabled";
  active: boolean;
  version: number;
  checksum: string | null;
  errorMessage: string | null;
};

export type SponsorSurfaceReportDto = {
  surface: SponsorMediaSurface;
  reportedAt: number;
  slots: Array<{ slotNumber: number; version: number; status: "ready" | "preparing" | "missing" | "failed"; error?: string }>;
  playback: { status: "idle" | "playing" | "ended" | "stopped" | "error"; slotNumber: number | null; cueId: string | null; error?: string };
};

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error || `Request failed (${response.status})`;
}

export async function fetchSponsorMediaSlots(tournamentId: number): Promise<SponsorMediaSlotDto[]> {
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json() as { slots: SponsorMediaSlotDto[] };
  return body.slots;
}

export async function uploadSponsorMediaSlot(
  tournamentId: number,
  slotNumber: number,
  file: File,
  title: string,
  durationSec: number,
): Promise<SponsorMediaSlotDto> {
  const form = new FormData();
  form.set("file", file);
  form.set("title", title);
  form.set("durationSec", String(durationSec));
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/${slotNumber}`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function updateSponsorMediaSlot(
  tournamentId: number,
  slotNumber: number,
  patch: { title?: string; active?: boolean; durationSec?: number },
): Promise<SponsorMediaSlotDto> {
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/${slotNumber}`, {
    method: "PATCH",
    json: patch,
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function deleteSponsorMediaSlot(tournamentId: number, slotNumber: number): Promise<void> {
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/${slotNumber}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function fetchSponsorMediaReadiness(tournamentId: number): Promise<{
  obs: SponsorSurfaceReportDto | null;
  led: SponsorSurfaceReportDto | null;
}> {
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/readiness?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

const displayTokenKey = (tournamentId: number, surface: SponsorMediaSurface) =>
  `bidwar-sponsor-display:${tournamentId}:${surface}`;

/** The display token comes from the authorized screen link, or from Live Control on this browser. */
export function sponsorDisplayToken(tournamentId: number, surface: SponsorMediaSurface): string | null {
  if (typeof window === "undefined") return null;
  const key = displayTokenKey(tournamentId, surface);
  const fromUrl = new URLSearchParams(window.location.search).get("display");
  if (fromUrl) {
    rememberSponsorDisplayToken(tournamentId, surface, fromUrl);
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function rememberSponsorDisplayToken(tournamentId: number, surface: SponsorMediaSurface, token: string): void {
  const key = displayTokenKey(tournamentId, surface);
  try { sessionStorage.setItem(key, token); } catch { /* private mode */ }
  try { localStorage.setItem(key, token); } catch { /* private mode */ }
}

export async function createSponsorDisplaySession(
  tournamentId: number,
  surface: SponsorMediaSurface,
): Promise<{ token: string; surface: SponsorMediaSurface; tournamentId: number }> {
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/display-session`, {
    method: "POST",
    json: { surface },
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function reportSponsorMediaReadiness(
  tournamentId: number,
  report: Omit<SponsorSurfaceReportDto, "reportedAt">,
): Promise<boolean> {
  const token = sponsorDisplayToken(tournamentId, report.surface);
  if (!token) return false;
  try {
    const response = await apiFetch(`/tournaments/${tournamentId}/scoring/sponsor-media/readiness`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      json: report,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendSponsorMediaCue(
  tournamentId: number,
  cue: {
    action: "play" | "stop" | "prepare";
    slotId: number;
    slotNumber: number;
    version: number;
    destination: SponsorMediaDestination;
  },
  sponsorDisplayTokens?: { obs?: string; led?: string },
): Promise<void> {
  const cueId = `cue-${crypto.randomUUID()}`;
  const sponsorMedia = { ...cue, cueId };
  const response = await apiFetch(`/tournaments/${tournamentId}/scoring/obs-director`, {
    method: "POST",
    json: { messageType: "sponsor_media", sponsorMedia, sponsorDisplayTokens },
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json().catch(() => ({})) as {
    sponsorMedia?: typeof sponsorMedia & { issuedAt?: number };
    sponsorDisplayTokens?: { obs?: string; led?: string };
  };
  if (typeof BroadcastChannel === "undefined") return;
  const message = {
    type: "SPONSOR_MEDIA",
    sponsorMedia: body.sponsorMedia ?? sponsorMedia,
    sponsorDisplayTokens: body.sponsorDisplayTokens ?? sponsorDisplayTokens,
  };
  for (const name of [`bidwar_v2_${tournamentId}`, `bidwar_cricket_obs_${tournamentId}`]) {
    try {
      const channel = new BroadcastChannel(name);
      channel.postMessage(message);
      channel.close();
    } catch {
      // ignore
    }
  }
}
