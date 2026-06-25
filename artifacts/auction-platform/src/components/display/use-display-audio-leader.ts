import { useEffect, useRef, useState } from "react";

export type DisplayAudioRole = "main" | "side";

const HEARTBEAT_MS = 2_000;
const STALE_MS = 5_500;
const ROLE_PRIORITY: Record<DisplayAudioRole, number> = { main: 2, side: 1 };

/**
 * Ensures only one display tab plays broadcast audio per tournament.
 * Main LED display wins over side displays when both are open.
 */
export function useDisplayAudioLeader(
  tournamentId: number,
  role: DisplayAudioRole,
): boolean {
  const tabIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [isLeader, setIsLeader] = useState(role === "main");

  useEffect(() => {
    if (!tournamentId) return;

    if (typeof BroadcastChannel === "undefined") {
      setIsLeader(role === "main");
      return;
    }

    const channel = new BroadcastChannel(`bidwar_display_audio_${tournamentId}`);
    const peers = new Map<string, { role: DisplayAudioRole; ts: number }>();

    const recomputeLeader = () => {
      const now = Date.now();
      for (const [id, peer] of peers) {
        if (now - peer.ts > STALE_MS) peers.delete(id);
      }
      peers.set(tabIdRef.current, { role, ts: now });

      let leaderId = tabIdRef.current;
      let leaderPriority = ROLE_PRIORITY[role];

      for (const [id, peer] of peers) {
        if (now - peer.ts > STALE_MS) continue;
        const priority = ROLE_PRIORITY[peer.role];
        if (
          priority > leaderPriority
          || (priority === leaderPriority && id.localeCompare(leaderId) < 0)
        ) {
          leaderPriority = priority;
          leaderId = id;
        }
      }

      setIsLeader(leaderId === tabIdRef.current);
    };

    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; tabId?: string; role?: DisplayAudioRole };
      if (data?.type !== "heartbeat" || !data.tabId || !data.role) return;
      peers.set(data.tabId, { role: data.role, ts: Date.now() });
      recomputeLeader();
    };

    channel.addEventListener("message", onMessage);

    const heartbeat = setInterval(() => {
      channel.postMessage({
        type: "heartbeat",
        tabId: tabIdRef.current,
        role,
      });
      recomputeLeader();
    }, HEARTBEAT_MS);

    channel.postMessage({ type: "heartbeat", tabId: tabIdRef.current, role });
    recomputeLeader();

    return () => {
      clearInterval(heartbeat);
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [tournamentId, role]);

  return isLeader;
}
