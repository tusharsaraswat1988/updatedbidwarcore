/**
 * BIDWAR — OBS V2 BROADCAST SYNCHRONIZATION TRANSPORT
 *
 * Real-time state synchronization between V2 Test Control and V2 OBS Display.
 *
 * Pipeline & Guarantees:
 * 1. Sub-millisecond cross-window synchronization via standard BroadcastChannel API.
 * 2. Automatic multi-channel routing:
 *    - Primary V2 Channel: `bidwar_v2_${tournamentId}`
 *    - Legacy / Fallback Channel: `bidwar_cricket_obs_${tournamentId}`
 * 3. LocalStorage persistence for same-browser refresh recovery.
 * 4. Zero visual manipulation inside transport: dispatches typed messages that
 *    the display routes through the authoritative V2 adapters and V2 contracts.
 */

import { useEffect, useRef, useCallback } from "react";
import type { ObsV2EventType } from "./obs-v2-events";
import type { BroadcastSceneId } from "./contracts";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

export type V2BroadcastMessagePayload = {
  active: boolean;
  name: string;
  role?: string;
  details?: string;
};

export type V2SyncMessage =
  | {
      type: "TRIGGER_FLASH";
      flash: ObsV2EventType;
      detail?: string;
      milestoneValue?: number;
      batter?: string;
    }
  | {
      type: "SET_OVERLAY";
      overlay: CricketObsMidOverlayKind;
      matchId?: number;
      sponsorName?: string;
      stageOrGroup?: string;
    }
  | { type: "CLEAR_OVERLAY" }
  | {
      type: "SET_BROADCAST_MESSAGE";
      broadcastMessage: V2BroadcastMessagePayload;
    }
  | { type: "CLEAR_BROADCAST_MESSAGE" }
  | {
      type: "SET_SCENE";
      scene: BroadcastSceneId;
      model?: any;
    }
  | { type: "DISMISS" }
  | { type: "PING"; timestamp: number }
  | { type: "PONG"; timestamp: number };

/** Channel name generator */
export function getV2ChannelName(tournamentId: number | string): string {
  const tid = Number(tournamentId) || 0;
  return `bidwar_v2_${tid}`;
}

/** Storage key generator */
export function getV2StorageKey(tournamentId: number | string): string {
  const tid = Number(tournamentId) || 0;
  return `bidwar_v2_action_${tid}`;
}

/**
 * Sends a typed V2 broadcast message across all available communication transports:
 * - BroadcastChannel (Primary sub-millisecond tab-to-tab)
 * - BroadcastChannel (Legacy `bidwar_cricket_obs_${tid}` compatibility)
 * - LocalStorage (Cross-window persistence / refresh fallback)
 * - Server SSE (`/api/tournaments/:id/scoring/obs-director`) when available
 */
export function sendV2SyncMessage(tournamentId: number, message: V2SyncMessage): void {
  const tid = Number(tournamentId) || 0;
  const channelName = getV2ChannelName(tid);
  const storageKey = getV2StorageKey(tid);

  // 1. Primary V2 BroadcastChannel
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const v2Chan = new BroadcastChannel(channelName);
      v2Chan.postMessage(message);
      v2Chan.close();
    } catch {
      // ignore
    }

    // 2. Legacy / compatibility channel fallback
    try {
      const legChan = new BroadcastChannel(`bidwar_cricket_obs_${tid}`);
      if (message.type === "TRIGGER_FLASH") {
        legChan.postMessage({ type: "TRIGGER_FLASH", flash: message.flash, detail: message.detail });
      } else if (message.type === "SET_OVERLAY") {
        legChan.postMessage({
          type: "SET_OVERLAY",
          overlay: message.overlay,
          matchId: message.matchId,
          sponsorName: message.sponsorName,
          stageOrGroup: message.stageOrGroup,
        });
      } else if (message.type === "SET_BROADCAST_MESSAGE") {
        legChan.postMessage({ type: "SET_BROADCAST_MESSAGE", broadcastMessage: message.broadcastMessage });
      } else if (message.type === "CLEAR_BROADCAST_MESSAGE") {
        legChan.postMessage({ type: "CLEAR_BROADCAST_MESSAGE" });
      }
      legChan.close();
    } catch {
      // ignore
    }
  }

  // 3. LocalStorage persistence fallback
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const envelope = { message, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(envelope));
    } catch {
      // ignore
    }
  }

  // 4. Server SSE notification (cross-device Phone -> OBS Studio)
  if (tid > 0 && typeof window !== "undefined" && typeof fetch !== "undefined") {
    let ssePayload: any = null;
    if (message.type === "TRIGGER_FLASH") {
      ssePayload = { flash: message.flash, detail: message.detail };
    } else if (message.type === "SET_OVERLAY") {
      ssePayload = {
        overlay: message.overlay,
        matchId: message.matchId,
        sponsorName: message.sponsorName,
        stageOrGroup: message.stageOrGroup,
      };
    } else if (message.type === "SET_BROADCAST_MESSAGE") {
      ssePayload = {
        messageType: "broadcast_message",
        broadcastMessage: message.broadcastMessage,
      };
    } else if (message.type === "CLEAR_BROADCAST_MESSAGE") {
      ssePayload = {
        messageType: "broadcast_message",
        broadcastMessage: { active: false, name: "", details: "" },
      };
    }

    if (ssePayload) {
      void fetch(`/api/tournaments/${tid}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ssePayload),
      }).catch(() => {});
    }
  }
}

/**
 * Hook to listen for V2 broadcast synchronization messages on the display or control.
 */
export function useV2Sync(
  tournamentId: number,
  onMessage: (message: V2SyncMessage) => void,
): {
  sendMessage: (msg: V2SyncMessage) => void;
} {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const tid = Number(tournamentId) || 0;
  const channelName = getV2ChannelName(tid);
  const storageKey = getV2StorageKey(tid);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Primary V2 BroadcastChannel Listener
    let v2Channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      v2Channel = new BroadcastChannel(channelName);
      v2Channel.onmessage = (ev) => {
        if (ev.data && typeof ev.data === "object" && "type" in ev.data) {
          onMessageRef.current(ev.data as V2SyncMessage);
        }
      };
    }

    // 2. Storage event listener for cross-window / tab persistence fallback
    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === storageKey && ev.newValue) {
        try {
          const parsed = JSON.parse(ev.newValue);
          if (parsed && parsed.message) {
            onMessageRef.current(parsed.message as V2SyncMessage);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (v2Channel) {
        v2Channel.close();
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [channelName, storageKey]);

  const sendMessage = useCallback(
    (msg: V2SyncMessage) => {
      sendV2SyncMessage(tid, msg);
    },
    [tid],
  );

  return { sendMessage };
}
