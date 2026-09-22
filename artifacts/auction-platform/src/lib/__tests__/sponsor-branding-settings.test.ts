import { describe, expect, it } from "vitest";
import { parseSponsorLogos, normalizeSponsorLogos, type SponsorLogo } from "../sponsor-logo";

describe("Sponsor Branding Serialization & Persistence", () => {
  it("preserves name, type, and priority flags through full JSON serialization and deserialization", () => {
    const inputSponsors: SponsorLogo[] = [
      {
        url: "https://res.cloudinary.com/demo/image/upload/sample1.png",
        name: "Acme Corp",
        type: "Title Sponsor",
        isTitleSponsor: true,
        isCoSponsor: false,
        sponsorPriority: 0,
      },
      {
        url: "https://res.cloudinary.com/demo/image/upload/sample2.png",
        name: "Beta Ltd",
        type: "Co Sponsor",
        isTitleSponsor: false,
        isCoSponsor: true,
        sponsorPriority: 1,
      },
      {
        url: "https://res.cloudinary.com/demo/image/upload/sample3.png",
        name: "Gamma Services",
        type: "Beverage Partner",
        isTitleSponsor: false,
        isCoSponsor: false,
        sponsorPriority: 2,
      },
    ];

    // Payload builder simulation
    const serialized = JSON.stringify(
      inputSponsors
        .filter((l) => l.url && l.url.trim())
        .map((l, idx) => ({
          url: l.url.trim(),
          publicId: l.publicId?.trim() || null,
          name: l.name?.trim() || "",
          type: l.type?.trim() || "",
          isTitleSponsor: Boolean(l.isTitleSponsor),
          isCoSponsor: Boolean(l.isCoSponsor),
          priorityType: l.priorityType || undefined,
          sponsorPriority: l.sponsorPriority ?? idx,
          priority: (l as unknown as { priority?: number }).priority ?? idx,
        })),
    );

    const parsed = parseSponsorLogos(serialized);
    expect(parsed).toHaveLength(3);

    expect(parsed[0].name).toBe("Acme Corp");
    expect(parsed[0].type).toBe("Title Sponsor");
    expect(parsed[0].isTitleSponsor).toBe(true);

    expect(parsed[1].name).toBe("Beta Ltd");
    expect(parsed[1].type).toBe("Co Sponsor");
    expect(parsed[1].isCoSponsor).toBe(true);

    expect(parsed[2].name).toBe("Gamma Services");
    expect(parsed[2].type).toBe("Beverage Partner");
    expect(parsed[2].isTitleSponsor).toBe(false);
    expect(parsed[2].isCoSponsor).toBe(false);
  });
});
