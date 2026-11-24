import { useState, useEffect, useCallback } from "react";

export const AI_RADAR_STORAGE_KEY = "bidwar_owner_ai_radar_enabled";

/**
 * Returns the private localStorage key for storing team owner's target shortlist.
 */
export function getOwnerTargetsStorageKey(tournamentId: number, teamId: number): string {
  return `bidwar_owner_targets_${tournamentId}_${teamId}`;
}

/**
 * Safely reads the list of target player IDs from localStorage.
 * Handles pure number[], object arrays, or key-value structures gracefully.
 */
export function readOwnerTargets(tournamentId: number, teamId: number): number[] {
  if (typeof window === "undefined" || !tournamentId || !teamId) return [];
  try {
    const raw = localStorage.getItem(getOwnerTargetsStorageKey(tournamentId, teamId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === "object" && item !== null && "id" in item ? Number(item.id) : Number(item)))
        .filter((n) => !isNaN(n) && n > 0);
    }
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.ids)) {
        return parsed.ids.map(Number).filter((n: number) => !isNaN(n) && n > 0);
      }
      return Object.keys(parsed)
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
    }
  } catch (_err) {
    // Malformed JSON falls back gracefully to empty shortlist
  }
  return [];
}

/**
 * Writes the target player IDs into private localStorage and dispatches a notification event.
 */
export function writeOwnerTargets(tournamentId: number, teamId: number, targetIds: number[]): void {
  if (typeof window === "undefined" || !tournamentId || !teamId) return;
  try {
    const key = getOwnerTargetsStorageKey(tournamentId, teamId);
    const deduped = Array.from(new Set(targetIds.filter((n) => !isNaN(n) && n > 0)));
    localStorage.setItem(key, JSON.stringify(deduped));
    window.dispatchEvent(
      new CustomEvent("bidwar_targets_updated", {
        detail: { tournamentId, teamId, targetIds: deduped },
      })
    );
  } catch (err) {
    console.error("Failed to save owner target shortlist:", err);
  }
}

/**
 * Toggles a player's target status and returns the updated shortlist.
 */
export function toggleOwnerTarget(tournamentId: number, teamId: number, playerId: number): number[] {
  const current = readOwnerTargets(tournamentId, teamId);
  const next = current.includes(playerId)
    ? current.filter((id) => id !== playerId)
    : [...current, playerId];
  writeOwnerTargets(tournamentId, teamId, next);
  return next;
}

/**
 * Checks if a player is in the owner's target shortlist.
 */
export function isOwnerTarget(tournamentId: number, teamId: number, playerId: number): boolean {
  return readOwnerTargets(tournamentId, teamId).includes(playerId);
}

/**
 * Reactive hook for managing the owner's target player shortlist.
 */
export function useOwnerTargets(tournamentId: number, teamId: number) {
  const [targetIds, setTargetIds] = useState<number[]>(() => readOwnerTargets(tournamentId, teamId));

  useEffect(() => {
    setTargetIds(readOwnerTargets(tournamentId, teamId));

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ tournamentId?: number; teamId?: number; targetIds?: number[] }>;
      if (
        !custom.detail ||
        (custom.detail.tournamentId === tournamentId && custom.detail.teamId === teamId)
      ) {
        setTargetIds(readOwnerTargets(tournamentId, teamId));
      }
    };

    window.addEventListener("bidwar_targets_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bidwar_targets_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [tournamentId, teamId]);

  const toggleTarget = useCallback(
    (playerId: number) => {
      const next = toggleOwnerTarget(tournamentId, teamId, playerId);
      setTargetIds(next);
      return next;
    },
    [tournamentId, teamId]
  );

  const isTarget = useCallback(
    (playerId: number) => {
      return targetIds.includes(playerId);
    },
    [targetIds]
  );

  return {
    targetIds,
    toggleTarget,
    isTarget,
    count: targetIds.length,
  };
}

/**
 * Reads whether AI Radar advice is expanded or collapsed into micro-pill.
 */
export function readAiRadarEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(AI_RADAR_STORAGE_KEY) !== "false";
}

/**
 * Writes the AI Radar toggle preference into localStorage.
 */
export function writeAiRadarEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_RADAR_STORAGE_KEY, String(enabled));
    window.dispatchEvent(
      new CustomEvent("bidwar_ai_radar_toggled", {
        detail: { enabled },
      })
    );
  } catch (err) {
    console.error("Failed to write AI Radar preference:", err);
  }
}

/**
 * 1-click toggle for AI Radar preference: flips current state, saves, and dispatches event.
 */
export function toggleAiRadarEnabled(): boolean {
  const current = readAiRadarEnabled();
  const next = !current;
  writeAiRadarEnabled(next);
  return next;
}

/**
 * Reactive hook for managing the 1-click AI Radar ON/OFF preference.
 */
export function useAiRadarPreference(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readAiRadarEnabled());

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const custom = e as CustomEvent<{ enabled?: boolean }>;
      if (typeof custom.detail?.enabled === "boolean") {
        setEnabled(custom.detail.enabled);
      } else {
        setEnabled(readAiRadarEnabled());
      }
    };

    window.addEventListener("bidwar_ai_radar_toggled", handleToggle);
    window.addEventListener("storage", handleToggle);
    return () => {
      window.removeEventListener("bidwar_ai_radar_toggled", handleToggle);
      window.removeEventListener("storage", handleToggle);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = toggleAiRadarEnabled();
    setEnabled(next);
  }, []);

  return [enabled, toggle];
}
