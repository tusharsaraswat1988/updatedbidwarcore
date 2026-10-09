import { describe, expect, it } from "vitest";
import {
  buildCloudinaryBroadcastVideoUrl,
  canPlaySponsorSlot,
  clampImageDurationSec,
  cueIncludesSurface,
  cueIsLightweight,
  emptySponsorPlayback,
  explainSurfaceReadiness,
  localAssetMatchesCue,
  parseSponsorMediaCue,
  reduceSponsorPlayback,
  acceptSponsorBroadcastDownload,
  isPlayableBroadcastMp4,
  SPONSOR_BROADCAST_ASSET_MAX_BYTES,
  SPONSOR_BROADCAST_VIDEO_MIN_BYTES,
  sponsorCacheKey,
  verifyLocalAsset,
  type SponsorMediaCue,
} from "../cricket/sponsor-media";

function cue(overrides: Partial<SponsorMediaCue> = {}): SponsorMediaCue {
  return {
    action: "play",
    slotId: 9,
    slotNumber: 2,
    version: 3,
    destination: "both",
    cueId: "cue-abcdefgh",
    issuedAt: 1_000,
    ...overrides,
  };
}

describe("sponsor media protocol", () => {
  it("rejects a cue that carries media", () => {
    const parsed = parseSponsorMediaCue({
      action: "play",
      slotId: 1,
      slotNumber: 1,
      version: 1,
      destination: "obs",
      cueId: "cue-abcdefgh",
      broadcastUrl: "https://cdn.example/ad.mp4",
    });
    expect(parsed.ok).toBe(false);
  });

  it("accepts a lightweight play cue", () => {
    const parsed = parseSponsorMediaCue({
      action: "play",
      slotId: 4,
      slotNumber: 2,
      version: 7,
      destination: "led",
      cueId: "cue-abcdefgh",
    }, 50);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(cueIsLightweight(parsed.cue)).toBe(true);
      expect(parsed.cue.issuedAt).toBe(50);
    }
  });

  it("validates image duration on the server range", () => {
    expect(clampImageDurationSec(10)).toBe(10);
    expect(clampImageDurationSec(2)).toBeNull();
    expect(clampImageDurationSec(61)).toBeNull();
    expect(clampImageDurationSec("15")).toBe(15);
  });

  it("gates play on the selected destination only", () => {
    expect(canPlaySponsorSlot({
      destination: "obs",
      processingStatus: "ready",
      active: true,
      obsReady: true,
      ledReady: false,
    }).ok).toBe(true);
    const both = canPlaySponsorSlot({
      destination: "both",
      processingStatus: "ready",
      active: true,
      obsReady: true,
      ledReady: false,
    });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(both.reason).toBe("LED scoreboard is not ready");
    expect(canPlaySponsorSlot({
      destination: "led",
      processingStatus: "failed",
      active: true,
      obsReady: true,
      ledReady: true,
    }).ok).toBe(false);
  });

  it("isolates OBS and LED cues", () => {
    expect(cueIncludesSurface("obs", "led")).toBe(false);
    expect(cueIncludesSurface("led", "led")).toBe(true);
    expect(cueIncludesSurface("both", "obs")).toBe(true);
    const state = emptySponsorPlayback();
    const obsOnly = reduceSponsorPlayback(state, cue({ destination: "obs" }), "led");
    expect(obsOnly.phase).toBe("idle");
    const led = reduceSponsorPlayback(state, cue({ destination: "led" }), "led");
    expect(led.phase).toBe("playing");
  });

  it("ignores a second play of the same asset inside the double-press window", () => {
    const first = reduceSponsorPlayback(emptySponsorPlayback(), cue({ issuedAt: 1000 }), "obs");
    const second = reduceSponsorPlayback(
      first,
      cue({ cueId: "cue-second!!", issuedAt: 1200 }),
      "obs",
    );
    expect(second.cueId).toBe(first.cueId);
  });

  it("lets a later stop win over an earlier play, including out of order", () => {
    const playing = reduceSponsorPlayback(emptySponsorPlayback(), cue({ issuedAt: 2000 }), "obs");
    const stopped = reduceSponsorPlayback(
      playing,
      cue({ action: "stop", cueId: "cue-stop!!!!", issuedAt: 2001, destination: "both" }),
      "obs",
    );
    expect(stopped.phase).toBe("idle");
    const latePlay = reduceSponsorPlayback(stopped, cue({ issuedAt: 1500, cueId: "cue-lateplay" }), "obs");
    expect(latePlay.phase).toBe("idle");
    const newer = reduceSponsorPlayback(emptySponsorPlayback(), cue({ issuedAt: 4000, cueId: "cue-newer!!!" }), "obs");
    const oldStop = reduceSponsorPlayback(
      newer,
      cue({ action: "stop", cueId: "cue-oldstop!", issuedAt: 3000, destination: "both" }),
      "obs",
    );
    expect(oldStop.phase).toBe("playing");
    expect(oldStop.cueId).toBe("cue-newer!!!");
  });

  it("explains operator readiness without treating an old version as ready", () => {
    expect(explainSurfaceReadiness({
      processingStatus: "ready",
      active: true,
      version: 5,
      surfaceOnline: true,
      report: { version: 4, status: "ready" },
    })).toBe("Old version");
    expect(explainSurfaceReadiness({
      processingStatus: "ready",
      active: true,
      version: 5,
      surfaceOnline: false,
      report: null,
    })).toBe("Offline");
    expect(explainSurfaceReadiness({
      processingStatus: "failed",
      active: true,
      version: 5,
      surfaceOnline: true,
      report: null,
    })).toBe("Processing failed");
    expect(SPONSOR_BROADCAST_ASSET_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it("rejects the short Cloudinary body OBS was downloading", () => {
    const stub = new Uint8Array(4041);
    stub.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70], 0);
    expect(stub.length).toBeLessThan(SPONSOR_BROADCAST_VIDEO_MIN_BYTES);
    expect(isPlayableBroadcastMp4(stub)).toBe(false);
  });

  it("accepts an MP4 that contains a media box and clears the size floor", () => {
    const bytes = new Uint8Array(SPONSOR_BROADCAST_VIDEO_MIN_BYTES);
    bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70], 0);
    bytes.set([0x6d, 0x6f, 0x6f, 0x76], 32);
    expect(isPlayableBroadcastMp4(bytes)).toBe(true);
    const html = new Uint8Array(SPONSOR_BROADCAST_VIDEO_MIN_BYTES);
    html.set([0x3c, 0x68, 0x74, 0x6d, 0x6c], 0);
    expect(isPlayableBroadcastMp4(html)).toBe(false);
  });

  it("plays a re-encoded sponsor video when the stored checksum no longer matches", () => {
    const bytes = new Uint8Array(SPONSOR_BROADCAST_VIDEO_MIN_BYTES);
    bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70], 0);
    bytes.set([0x6d, 0x6f, 0x6f, 0x76], 32);
    expect(acceptSponsorBroadcastDownload({ assetType: "video", checksumOk: false, bytes })).toBe(true);
    expect(acceptSponsorBroadcastDownload({ assetType: "video", checksumOk: true, bytes: new Uint8Array(8) })).toBe(true);
    expect(acceptSponsorBroadcastDownload({ assetType: "image", checksumOk: false, bytes })).toBe(false);
    expect(acceptSponsorBroadcastDownload({ assetType: "video", checksumOk: false, bytes: new Uint8Array(32) })).toBe(false);
  });

  it("does not play a stale or corrupt local file", () => {
    expect(verifyLocalAsset({
      expectedVersion: 4,
      expectedChecksum: "abc",
      expectedSize: 100,
      actualVersion: 3,
      actualChecksum: "abc",
      actualSize: 100,
    })).toEqual({ ok: false, reason: "Stale asset version" });
    expect(verifyLocalAsset({
      expectedVersion: 4,
      expectedChecksum: "abc",
      expectedSize: 100,
      actualVersion: 4,
      actualChecksum: "abc",
      actualSize: 90,
    })).toEqual({ ok: false, reason: "Corrupt asset" });
    expect(verifyLocalAsset({
      expectedVersion: 4,
      expectedChecksum: "abc",
      expectedSize: 100,
      actualVersion: 4,
      actualChecksum: "nope",
      actualSize: 100,
    })).toEqual({ ok: false, reason: "Checksum mismatch" });
    expect(localAssetMatchesCue(
      { slotId: 9, version: 3, verified: true },
      cue(),
    )).toBe(true);
    expect(localAssetMatchesCue(
      { slotId: 9, version: 2, verified: true },
      cue(),
    )).toBe(false);
  });

  it("builds a fast-start broadcast URL without using the original as playback", () => {
    const url = buildCloudinaryBroadcastVideoUrl("demo", "bidwar/sponsor-media/originals/spot");
    expect(url).toContain("vc_h264");
    expect(url).toContain("c_limit,w_1920,h_1080");
    expect(url.endsWith(".mp4")).toBe(true);
    expect(sponsorCacheKey(40, 2, 7)).toBe("https://bidwar.local/sponsor-cache/40/slot-2/v7");
  });
});
