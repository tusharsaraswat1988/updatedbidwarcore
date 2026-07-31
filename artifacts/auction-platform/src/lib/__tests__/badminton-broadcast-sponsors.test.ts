import { describe, expect, it } from "vitest";
import {
  resolvePinnedScoreBoardSponsor,
  resolvePinnedSponsorLogos,
  resolveSpotlightSponsors,
} from "@/lib/badminton-broadcast-sponsors";
import type { SponsorLogo } from "@/lib/sponsor-logo";

const sponsors: SponsorLogo[] = [
  { url: "https://a.example/logo.png", name: "Alpha", type: "Title Sponsor" },
  { url: "https://b.example/logo.png", name: "Beta" },
];

describe("broadcast sponsor selection", () => {
  it("spotlights a single sponsor when URL matches", () => {
    expect(resolveSpotlightSponsors(sponsors, "https://b.example/logo.png")).toEqual([
      sponsors[1],
    ]);
  });

  it("falls back to full list when spotlight missing", () => {
    expect(resolveSpotlightSponsors(sponsors, null)).toEqual(sponsors);
    expect(resolveSpotlightSponsors(sponsors, "https://missing")).toEqual(sponsors);
  });

  it("pins live logos and scoreboard crest", () => {
    expect(resolvePinnedSponsorLogos(sponsors, "https://a.example/logo.png")).toEqual([
      sponsors[0],
    ]);
    expect(
      resolvePinnedScoreBoardSponsor(
        { logoUrl: "https://fixed", name: "Fixed", title: "Crest" },
        sponsors,
        "https://a.example/logo.png",
      ),
    ).toEqual({
      logoUrl: "https://a.example/logo.png",
      name: "Alpha",
      title: "Title Sponsor",
    });
  });
});
