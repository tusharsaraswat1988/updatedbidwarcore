import { describe, expect, it } from "vitest";
import {
  applyPresentationPayload,
  emptyBrandingShell,
  mergeFetchedBrandingWithLivePresentation,
} from "@/lib/badminton-presentation-mutation";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";

function baseBranding(overrides: Partial<BadmintonBranding> = {}): BadmintonBranding {
  return {
    ...emptyBrandingShell(),
    displayName: "Open",
    resolvedVenueMusicUrl: "https://cdn.example/break.mp3",
    venueMusicFileName: "break.mp3",
    ...overrides,
  };
}

describe("applyPresentationPayload", () => {
  it("seeds a shell when cache is empty so music SSE is not dropped", () => {
    const next = applyPresentationPayload(undefined, {
      kind: "broadcast_presentation",
      venueMusicPlaying: true,
      resolvedVenueMusicUrl: "https://cdn.example/break.mp3",
    });
    expect(next?.venueMusicPlaying).toBe(true);
    expect(next?.resolvedVenueMusicUrl).toBe("https://cdn.example/break.mp3");
    expect(typeof next?._presentationPatchedAt).toBe("number");
  });

  it("patches venueMusicPlaying on existing branding", () => {
    const prev = baseBranding({ venueMusicPlaying: false });
    const next = applyPresentationPayload(prev, { venueMusicPlaying: true });
    expect(next?.venueMusicPlaying).toBe(true);
    expect(next?.displayName).toBe("Open");
  });
});

describe("mergeFetchedBrandingWithLivePresentation", () => {
  it("keeps a fresh live music flag over a stale GET", () => {
    const live = baseBranding({
      venueMusicPlaying: true,
      _presentationPatchedAt: Date.now(),
    });
    const fetched = baseBranding({
      venueMusicPlaying: false,
      displayName: "From GET",
    });
    const merged = mergeFetchedBrandingWithLivePresentation(fetched, live);
    expect(merged.venueMusicPlaying).toBe(true);
    expect(merged.displayName).toBe("From GET");
  });

  it("does not keep live fields after the race window", () => {
    const live = baseBranding({
      venueMusicPlaying: true,
      _presentationPatchedAt: Date.now() - 60_000,
    });
    const fetched = baseBranding({ venueMusicPlaying: false });
    const merged = mergeFetchedBrandingWithLivePresentation(fetched, live);
    expect(merged.venueMusicPlaying).toBe(false);
  });
});
