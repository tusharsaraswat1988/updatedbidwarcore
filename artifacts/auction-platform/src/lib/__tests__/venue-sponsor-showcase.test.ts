import { describe, expect, it } from "vitest";
import { SponsorPriorityType, type SponsorLogo } from "@/lib/sponsor-logo";
import { buildVenueSponsorSlides } from "@/components/badminton/venue-sponsor-showcase";

describe("buildVenueSponsorSlides", () => {
  it("orders title → co → partner chunks of 4", () => {
    const logos: SponsorLogo[] = [
      { url: "/n1.png", name: "N1", type: "Partner", priorityType: SponsorPriorityType.NORMAL },
      { url: "/t.png", name: "Title Co", type: "Title Sponsor", priorityType: SponsorPriorityType.TITLE },
      { url: "/c1.png", name: "Co1", type: "Co Sponsor", priorityType: SponsorPriorityType.CO_SPONSOR },
      { url: "/n2.png", name: "N2", priorityType: SponsorPriorityType.NORMAL },
      { url: "/n3.png", name: "N3", priorityType: SponsorPriorityType.NORMAL },
      { url: "/n4.png", name: "N4", priorityType: SponsorPriorityType.NORMAL },
      { url: "/n5.png", name: "N5", priorityType: SponsorPriorityType.NORMAL },
      { url: "/c2.png", name: "Co2", type: "Co Sponsor", priorityType: SponsorPriorityType.CO_SPONSOR },
    ];

    const slides = buildVenueSponsorSlides(logos);
    expect(slides[0]?.tier).toBe("title");
    expect(slides[0]?.sponsors).toHaveLength(1);
    expect(slides[1]?.tier).toBe("co_sponsor");
    expect(slides[1]?.sponsors).toHaveLength(2);
    expect(slides[2]?.tier).toBe("normal");
    expect(slides[2]?.sponsors).toHaveLength(4);
    expect(slides[3]?.tier).toBe("normal");
    expect(slides[3]?.sponsors).toHaveLength(1);
  });
});
