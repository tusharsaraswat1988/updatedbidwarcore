/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Event Normalization Adapter
 *
 * Transforms raw production Cricket scoring signals into normalized ObsV2BroadcastEvent.
 * Side-effect free, deterministic, and enforces anti-fabrication rules.
 */

import type { CricketAuthoritativeBroadcastEvent } from "@workspace/scoring-core";
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";
import {
  OBS_V2_EVENT_CONFIGS,
  type ObsV2BroadcastEvent,
  type ObsV2EventType,
} from "./obs-v2-events.ts";

export interface NormalizeEventParams {
  flash: CricketObsFlashKind | string | null;
  token: string | null;
  detail?: string | null;
  matchId: number | null;
  timestamp?: number;
  batter?: string | null;
  bowler?: string | null;
  runs?: number | null;
  milestoneValue?: number | null;
}

/**
 * Normalizes a raw production flash/event payload into a strict ObsV2BroadcastEvent.
 * Returns null if the event is unsupported, missing essential tokens, or invalid.
 */
export function normalizeCricketFlashToObsV2Event(
  params: NormalizeEventParams,
): ObsV2BroadcastEvent | null {
  const {
    flash,
    token,
    detail,
    matchId,
    timestamp = Date.now(),
    batter,
    bowler,
    runs,
    milestoneValue,
  } = params;

  if (!flash || !token) return null;

  const eventType = flash as ObsV2EventType;
  const config = OBS_V2_EVENT_CONFIGS[eventType];

  // Unsupported event type check
  if (!config) return null;

  let title = config.title;
  let subtitle = config.subtitle;

  // Milestone customizations (e.g. 50 / 100)
  if (eventType === "MILESTONE" || milestoneValue === 50 || milestoneValue === 100) {
    if (milestoneValue === 50) {
      title = "HALF CENTURY 50";
      subtitle = batter ? `${batter.trim()} · 50 RUNS` : "50 RUNS REACHED";
    } else if (milestoneValue === 100) {
      title = "CENTURY 100";
      subtitle = batter ? `${batter.trim()} · 100 RUNS` : "100 RUNS REACHED";
    } else if (milestoneValue != null && milestoneValue > 0) {
      title = `MILESTONE ${milestoneValue}`;
      subtitle = batter ? `${batter.trim()} · ${milestoneValue} RUNS` : "MILESTONE REACHED";
    }
  } else if (eventType === "NEW_BATSMAN") {
    // NEW_BATSMAN: show the incoming batter name prominently
    if (batter && batter.trim().length > 0) {
      title = "NEW BATTER";
      subtitle = `${batter.trim()} · ARRIVING AT THE CREASE`;
    } else if (detail && detail.trim().length > 0) {
      subtitle = detail.trim();
    }
  } else if (eventType === "NEW_BOWLER") {
    // NEW_BOWLER: show incoming bowler name prominently
    if (bowler && bowler.trim().length > 0) {
      title = "NEW BOWLER";
      subtitle = `${bowler.trim()} · INTO THE ATTACK`;
    } else if (detail && detail.trim().length > 0) {
      subtitle = detail.trim();
    }
  } else if (detail && detail.trim().length > 0) {
    // Detail override from production scorer payload (e.g. "Virat Kohli · OUT")
    subtitle = detail.trim();
  } else if (batter && batter.trim().length > 0) {
    subtitle = `${batter.trim()} · ${config.subtitle}`;
  }

  return {
    id: token,
    type: eventType,
    matchId,
    timestamp,
    title,
    subtitle,
    accentColor: config.accentColor,
    borderColor: config.borderColor,
    priority: config.priority,
    batter: batter?.trim() || undefined,
    bowler: bowler?.trim() || undefined,
    runs: runs != null ? runs : undefined,
    milestoneValue: milestoneValue != null ? milestoneValue : undefined,
    detail: detail?.trim() || undefined,
  };
}

/**
 * Normalizes an authoritative server-broadcast cricket event into an ObsV2BroadcastEvent.
 * Side-effect free, deterministic, and preserves server-authoritative event ID for deduplication.
 */
export function normalizeAuthoritativeBroadcastEvent(
  event: CricketAuthoritativeBroadcastEvent,
): ObsV2BroadcastEvent | null {
  if (!event || !event.type || !event.id) return null;

  const eventType = event.type as ObsV2EventType;
  const config = OBS_V2_EVENT_CONFIGS[eventType];
  if (!config) return null;

  let title = config.title;
  let subtitle = config.subtitle;

  if (event.detail && event.detail.trim().length > 0) {
    subtitle = event.detail.trim();
  } else if (event.batter && event.batter.trim().length > 0) {
    subtitle = `${event.batter.trim()} · ${config.subtitle}`;
  }

  return {
    id: event.id,
    type: eventType,
    matchId: event.matchId,
    timestamp: event.timestamp || Date.now(),
    title,
    subtitle,
    accentColor: config.accentColor,
    borderColor: config.borderColor,
    priority: config.priority,
    batter: event.batter?.trim() || undefined,
    bowler: event.bowler?.trim() || undefined,
    runs: event.runs != null ? event.runs : undefined,
    detail: event.detail?.trim() || undefined,
  };
}
