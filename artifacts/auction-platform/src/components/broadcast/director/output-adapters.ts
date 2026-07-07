import type { BroadcastFrame, BroadcastOutputTarget } from "./types";

/** Output adapter — tailors a canonical frame for a specific surface without duplicating scene logic. */
export type BroadcastOutputAdapter = {
  target: BroadcastOutputTarget;
  adapt(frame: BroadcastFrame): BroadcastFrame;
};

const passThrough = (frame: BroadcastFrame): BroadcastFrame => frame;

export const OBS_OUTPUT_ADAPTER: BroadcastOutputAdapter = {
  target: "obs",
  adapt(frame) {
    return {
      ...frame,
      obsPerformanceMode: true,
      chrome: {
        ...frame.chrome,
        showTopBar: true,
        showSponsorTicker: true,
        showConnectionBanner: true,
      },
    };
  },
};

export const LED_OUTPUT_ADAPTER: BroadcastOutputAdapter = {
  target: "led",
  adapt(frame) {
    return {
      ...frame,
      obsPerformanceMode: false,
      chrome: { ...frame.chrome, showConnectionBanner: false },
    };
  },
};

export const MOBILE_VIEWER_ADAPTER: BroadcastOutputAdapter = {
  target: "mobile-viewer",
  adapt(frame) {
    return {
      ...frame,
      layout: {
        ...frame.layout,
        contentTop: frame.layout.contentTop + 20,
      },
    };
  },
};

export const REPLAY_ADAPTER: BroadcastOutputAdapter = {
  target: "replay",
  adapt(frame) {
    return {
      ...frame,
      chrome: { ...frame.chrome, showConnectionBanner: false },
      audioCues: [],
    };
  },
};

const ADAPTERS: Record<BroadcastOutputTarget, BroadcastOutputAdapter> = {
  obs: OBS_OUTPUT_ADAPTER,
  led: LED_OUTPUT_ADAPTER,
  "public-display": { target: "public-display", adapt: passThrough },
  "mobile-viewer": MOBILE_VIEWER_ADAPTER,
  "website-embed": { target: "website-embed", adapt: passThrough },
  replay: REPLAY_ADAPTER,
  "ai-highlights": { target: "ai-highlights", adapt: REPLAY_ADAPTER.adapt },
};

export function adaptFrameForOutput(frame: BroadcastFrame, target: BroadcastOutputTarget): BroadcastFrame {
  const adapter = ADAPTERS[target] ?? ADAPTERS.obs;
  if (frame.outputTarget === target) return adapter.adapt(frame);
  return adapter.adapt({ ...frame, outputTarget: target });
}

export function registerOutputAdapter(adapter: BroadcastOutputAdapter): void {
  ADAPTERS[adapter.target] = adapter;
}
