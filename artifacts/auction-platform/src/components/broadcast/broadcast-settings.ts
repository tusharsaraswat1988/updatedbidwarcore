import {
  DEFAULT_BROADCAST_SETTINGS,
  type BroadcastSettings,
  type BroadcastTheme,
} from "./types";

const STORAGE_PREFIX = "bidwar:broadcast-settings:";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseBool(v: string | null, fallback: boolean): boolean {
  if (v === null) return fallback;
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return fallback;
}

function parseTheme(v: string | null): BroadcastTheme {
  if (v === "gold" || v === "crimson" || v === "premium-dark") return v;
  return DEFAULT_BROADCAST_SETTINGS.theme;
}

export function resolveBroadcastSettings(
  tournamentId: number,
  searchParams?: URLSearchParams,
): BroadcastSettings {
  const params = searchParams ?? (typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null);
  let stored: Partial<BroadcastSettings> = {};

  if (typeof window !== "undefined" && tournamentId) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${tournamentId}`);
      if (raw) stored = JSON.parse(raw) as Partial<BroadcastSettings>;
    } catch {
      /* ignore corrupt storage */
    }
  }

  const base = { ...DEFAULT_BROADCAST_SETTINGS, ...stored };

  if (!params) return base;

  return {
    enableSoldAnimation: parseBool(params.get("soldAnim"), base.enableSoldAnimation),
    soldAnimationDurationMs: clamp(
      Number(params.get("soldDur") ?? base.soldAnimationDurationMs),
      3500,
      12000,
    ),
    enableBreakMode: parseBool(params.get("breakMode"), base.enableBreakMode),
    breakCountdownSeconds: clamp(
      Number(params.get("breakSec") ?? base.breakCountdownSeconds),
      30,
      3600,
    ),
    theme: parseTheme(params.get("theme") ?? base.theme),
    sponsorRotationSpeedSec: clamp(
      Number(params.get("sponsorSpeed") ?? base.sponsorRotationSpeedSec),
      2,
      15,
    ),
    autoSummary: parseBool(params.get("autoSummary"), base.autoSummary),
    obsPerformanceMode: parseBool(params.get("obsPerf"), base.obsPerformanceMode),
  };
}

export function saveBroadcastSettings(tournamentId: number, settings: BroadcastSettings): void {
  if (typeof window === "undefined" || !tournamentId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tournamentId}`, JSON.stringify(settings));
  } catch {
    /* quota / private mode */
  }
}

export function broadcastSettingsToSearchParams(settings: BroadcastSettings): string {
  const p = new URLSearchParams();
  p.set("soldAnim", settings.enableSoldAnimation ? "1" : "0");
  p.set("soldDur", String(settings.soldAnimationDurationMs));
  p.set("breakMode", settings.enableBreakMode ? "1" : "0");
  p.set("breakSec", String(settings.breakCountdownSeconds));
  p.set("theme", settings.theme);
  p.set("sponsorSpeed", String(settings.sponsorRotationSpeedSec));
  p.set("autoSummary", settings.autoSummary ? "1" : "0");
  p.set("obsPerf", settings.obsPerformanceMode ? "1" : "0");
  p.set("obs", "1");
  return p.toString();
}

export function buildObsOverlayUrl(origin: string, tournamentId: number, settings: BroadcastSettings): string {
  const qs = broadcastSettingsToSearchParams(settings);
  return `${origin}/tournament/${tournamentId}/obs?${qs}`;
}
