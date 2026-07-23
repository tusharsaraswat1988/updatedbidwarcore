export const PURSE_BOOSTER_LED_DURATION_MS = 10_000;

export type LedPurseBoosterTeamLine = {
  teamId: number;
  teamName: string;
  shortCode: string;
  color: string;
  logoUrl: string | null;
  previousCapacity: number;
  boosterAmount: number;
  newCapacity: number;
};

export type LedPurseBoosterOverlay = {
  batchId: string;
  replayKey: number;
  expiresAt: string;
  durationMs: number;
  target: "single" | "all";
  boosterAmount: number;
  teams: LedPurseBoosterTeamLine[];
};

export function createLedPurseBoosterOverlay(
  target: "single" | "all",
  boosterAmount: number,
  teams: LedPurseBoosterTeamLine[],
  options?: { batchId?: string; replayKey?: number },
): LedPurseBoosterOverlay {
  return {
    batchId: options?.batchId ?? globalThis.crypto?.randomUUID?.() ?? `booster-${Date.now()}`,
    replayKey: options?.replayKey ?? 0,
    expiresAt: new Date(Date.now() + PURSE_BOOSTER_LED_DURATION_MS).toISOString(),
    durationMs: PURSE_BOOSTER_LED_DURATION_MS,
    target,
    boosterAmount,
    teams,
  };
}

export function replayLedPurseBoosterOverlay(
  existing: LedPurseBoosterOverlay,
): LedPurseBoosterOverlay {
  return {
    ...existing,
    replayKey: existing.replayKey + 1,
    expiresAt: new Date(Date.now() + PURSE_BOOSTER_LED_DURATION_MS).toISOString(),
  };
}

export function parseLedPurseBoosterOverlay(
  raw: string | null | undefined,
  options?: { includeExpired?: boolean },
): LedPurseBoosterOverlay | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LedPurseBoosterOverlay>;
    if (!parsed?.teams || !Array.isArray(parsed.teams) || parsed.teams.length === 0) {
      return null;
    }
    if (!options?.includeExpired) {
      const expiresAt = parsed.expiresAt ? Date.parse(parsed.expiresAt) : NaN;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    }
    return {
      batchId: parsed.batchId ?? "legacy",
      replayKey: parsed.replayKey ?? 0,
      expiresAt: parsed.expiresAt ?? new Date(0).toISOString(),
      durationMs: parsed.durationMs ?? PURSE_BOOSTER_LED_DURATION_MS,
      target: parsed.target === "all" ? "all" : "single",
      boosterAmount: parsed.boosterAmount ?? parsed.teams[0]?.boosterAmount ?? 0,
      teams: parsed.teams.map((team) => ({
        teamId: team.teamId,
        teamName: team.teamName,
        shortCode: team.shortCode || team.teamName.slice(0, 3).toUpperCase(),
        color: team.color ?? "#3B82F6",
        logoUrl: team.logoUrl ?? null,
        previousCapacity: team.previousCapacity,
        boosterAmount: team.boosterAmount,
        newCapacity: team.newCapacity,
      })),
    };
  } catch {
    return null;
  }
}
