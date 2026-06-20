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
      sponsorPriority: 0,
    });
  });
});
