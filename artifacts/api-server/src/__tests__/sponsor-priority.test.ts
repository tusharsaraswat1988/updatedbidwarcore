import { describe, expect, it } from "vitest";
import {
  SponsorPriorityType,
  getPrimarySponsor,
  getSponsorsByPriority,
  parseSponsorLogos,
  validateSponsorList,
  SPONSOR_VALIDATION_ERRORS,
} from "@workspace/api-base/sponsor-priority";

describe("sponsor priority ordering", () => {
  it("orders title before co sponsors before normal", () => {
    const ordered = getSponsorsByPriority([
      { url: "https://a", name: "Normal" },
      { url: "https://b", name: "Co", isCoSponsor: true },
      { url: "https://c", name: "Title", isTitleSponsor: true },
    ]);

    expect(ordered.map((s) => s.name)).toEqual(["Title", "Co", "Normal"]);
  });

  it("respects legacy type strings for backward compatibility", () => {
    const ordered = getSponsorsByPriority([
      { url: "https://a", name: "Gold", type: "Gold Partner" },
      { url: "https://b", name: "Title", type: "Title Sponsor" },
    ]);

    expect(ordered[0]?.name).toBe("Title");
    expect(ordered[1]?.priorityType).toBe(SponsorPriorityType.GOLD);
  });

  it("returns primary sponsor as highest priority", () => {
    const primary = getPrimarySponsor([
      { url: "https://a", name: "Second", isCoSponsor: true },
      { url: "https://b", name: "First", isTitleSponsor: true },
    ]);

    expect(primary?.name).toBe("First");
  });
});

describe("sponsor validation", () => {
  it("rejects more than one title sponsor", () => {
    const result = validateSponsorList([
      { url: "https://a", isTitleSponsor: true },
      { url: "https://b", isTitleSponsor: true },
    ]);
    expect(result).toEqual({ ok: false, error: SPONSOR_VALIDATION_ERRORS.titleLimit });
  });

  it("rejects mutual title and co flags", () => {
    const result = validateSponsorList([
      { url: "https://a", isTitleSponsor: true, isCoSponsor: true },
    ]);
    expect(result).toEqual({ ok: false, error: SPONSOR_VALIDATION_ERRORS.mutualExclusivity });
  });
});

describe("parseSponsorLogos", () => {
  it("defaults missing priority fields", () => {
    const logos = parseSponsorLogos('[{"url":"https://x","name":"Acme"}]');
    expect(logos[0]).toMatchObject({
      url: "https://x",
      isTitleSponsor: false,
      isCoSponsor: false,
      isLiveStreamingPartner: false,
      sponsorPriority: 0,
    });
  });
});

describe("live streaming partner", () => {
  it("resolves the fixed category from the flag or the preset label", () => {
    const ordered = getSponsorsByPriority([
      { url: "https://a", name: "Normal" },
      { url: "https://b", name: "Stream Co", type: "LIVE STREAMING PARTNER" },
      { url: "https://c", name: "Title", isTitleSponsor: true },
    ]);

    expect(ordered.map((s) => s.name)).toEqual(["Title", "Stream Co", "Normal"]);
    expect(ordered[1]?.priorityType).toBe(SponsorPriorityType.LIVE_STREAMING_PARTNER);
  });

  it("allows only one live streaming partner", () => {
    const result = validateSponsorList([
      { url: "https://a", isLiveStreamingPartner: true },
      { url: "https://b", isLiveStreamingPartner: true },
    ]);
    expect(result).toEqual({
      ok: false,
      error: SPONSOR_VALIDATION_ERRORS.liveStreamingPartnerLimit,
    });
  });

  it("rejects combining live streaming partner with title sponsor", () => {
    const result = validateSponsorList([
      { url: "https://a", isTitleSponsor: true, isLiveStreamingPartner: true },
    ]);
    expect(result).toEqual({
      ok: false,
      error: SPONSOR_VALIDATION_ERRORS.liveStreamingMutualExclusivity,
    });
  });
});
