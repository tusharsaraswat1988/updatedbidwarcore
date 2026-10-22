/**
 * Lightweight BroadcastChannel synchronization for Random Player Reveal across browser tabs.
 * Supplements SSE for zero-latency local multi-tab coordination.
 */

export type RandomRevealBroadcastPayload = {
  type: "RANDOM_PLAYER_REVEAL";
  tournamentId: number;
  playerId: number;
  startedAt: number;
};

const CHANNEL_NAME = "bidwar_auction_reveal";

let sharedChannel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!sharedChannel) {
    try {
      sharedChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      sharedChannel = null;
    }
  }
  return sharedChannel;
}

export function broadcastRandomReveal(tournamentId: number, playerId: number, startedAt: number): void {
  const channel = getChannel();
  if (!channel) return;
  try {
    const payload: RandomRevealBroadcastPayload = {
      type: "RANDOM_PLAYER_REVEAL",
      tournamentId,
      playerId,
      startedAt,
    };
    channel.postMessage(payload);
  } catch {
    // Ignore BroadcastChannel errors in sandboxed contexts
  }
}

export function listenToRandomReveal(
  tournamentId: number,
  onReveal: (payload: { playerId: number; startedAt: number }) => void,
): () => void {
  const channel = getChannel();
  if (!channel) return () => {};

  const handler = (event: MessageEvent) => {
    const data = event.data as RandomRevealBroadcastPayload | undefined;
    if (data && data.type === "RANDOM_PLAYER_REVEAL" && data.tournamentId === tournamentId) {
      onReveal({ playerId: data.playerId, startedAt: data.startedAt });
    }
  };

  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
  };
}
