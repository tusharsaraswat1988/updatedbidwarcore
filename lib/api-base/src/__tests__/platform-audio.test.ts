import { describe, expect, it } from "vitest";
import {
  resolveBroadcastAudioUrl,
  resolveBroadcastAudioUrls,
} from "./platform-audio";

describe("resolveBroadcastAudioUrl", () => {
  it("prefers tournament custom URL", () => {
    expect(resolveBroadcastAudioUrl("https://custom.mp3", "https://platform.mp3")).toBe("https://custom.mp3");
  });

  it("falls back to platform default when tournament URL is empty", () => {
    expect(resolveBroadcastAudioUrl(null, "https://platform.mp3")).toBe("https://platform.mp3");
    expect(resolveBroadcastAudioUrl("", "https://platform.mp3")).toBe("https://platform.mp3");
  });

  it("returns null when neither custom nor platform URL exists", () => {
    expect(resolveBroadcastAudioUrl(null, null)).toBeNull();
  });
});

describe("resolveBroadcastAudioUrls", () => {
  it("resolves all three audio fields", () => {
    expect(
      resolveBroadcastAudioUrls(
        { countdownSoundUrl: "a", soldSoundUrl: null, breakEndMusicUrl: "" },
        { countdownSoundUrl: "p1", soldSoundUrl: "p2", breakEndMusicUrl: "p3" },
      ),
    ).toEqual({
      countdownSoundUrl: "a",
      soldSoundUrl: "p2",
      breakEndMusicUrl: "p3",
    });
  });
});
