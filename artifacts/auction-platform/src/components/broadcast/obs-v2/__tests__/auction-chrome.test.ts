import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { mapSponsors } from "../branding";
import { BroadcastStage } from "../BroadcastStage";
import type { BroadcastFrame } from "../contracts";
import {
  buildPattiLine,
  fadeSponsors,
  headerRightSponsors,
} from "../overlay/auction-chrome-logic";
import { Top5Scene } from "../lower/Scenes";
import { makeFrame } from "../preview/fixtures";

function frame(partial: Pick<BroadcastFrame, "scene" | "model">): BroadcastFrame {
  return {
    branding: { tournamentName: "ISHITA", tournamentAccent: "SCHOOL PREMIER", tournamentShort: "ISPCL" },
    sponsors: [],
    teams: [],
    settings: { performanceMode: false, showTicker: true },
    feed: { status: "live" },
    ...partial,
  } as BroadcastFrame;
}

describe("auction header sponsor slot", () => {
  const sponsors = mapSponsors([
    { url: "/vyapari.png", name: "Vyapari", isTitleSponsor: true, type: "Title Sponsor" },
    { url: "/acme.png", name: "Acme", isCoSponsor: true, type: "Co Sponsor" },
    { url: "/stream.png", name: "StreamX", isLiveStreamingPartner: true },
    { url: "/venue.png", name: "City Hall", type: "Venue Sponsor" },
  ]);

  it("gives the header right to the live streaming partner", () => {
    const slot = headerRightSponsors(sponsors);
    expect(slot.mode).toBe("live");
    expect(slot.items.map((s) => s.name)).toEqual(["StreamX"]);
    expect(slot.items[0]?.label).toBe("LIVE STREAMING PARTNER");
  });

  it("falls back to title and co-sponsors when no live streaming partner is selected", () => {
    const withoutLive = sponsors.filter((s) => s.tier !== "live_streaming");
    const slot = headerRightSponsors(withoutLive);
    expect(slot.mode).toBe("featured");
    expect(slot.items.map((s) => s.tier)).toEqual(["title", "co"]);
  });

  it("fades every sponsor except the live streaming partner", () => {
    expect(fadeSponsors(sponsors).map((s) => s.name)).toEqual(["Vyapari", "Acme", "City Hall"]);
    expect(fadeSponsors(sponsors).map((s) => s.tier)).toEqual(["title", "co", "associate"]);
  });
});

describe("auction stage composition", () => {
  it("keeps the header in three zones and puts the live mark and sponsor fade outside it", () => {
    const html = renderToStaticMarkup(createElement(BroadcastStage, { frame: makeFrame("TEAM") }));
    expect(html).toContain("bw-header-zones");
    expect(html).toContain("data-header-sponsor-slot");
    expect(html).toContain("data-auction-live-bug");
    expect(html).toContain("data-sponsor-fade");
    expect(html).toContain("data-auction-patti");
    expect(html).toContain("bw-lt-solid");
    expect(html).toContain("PURSE LEFT");
    expect(html).not.toContain("bw-assoc");
    expect(html).not.toContain("bw-live\"");
    const headerEnd = html.indexOf("</header>");
    const liveAt = html.indexOf("data-auction-live-bug");
    expect(headerEnd).toBeGreaterThan(0);
    expect(liveAt).toBeGreaterThan(headerEnd);
  });
});

describe("prize plate", () => {
  it("replaces the thick lower third and keeps the line pair", () => {
    const html = renderToStaticMarkup(createElement(BroadcastStage, {
      frame: makeFrame("AUCTION"),
      prizePlate: { line1: "Man of the Auction", line2: "Rahul Sharma" },
    }));
    expect(html).toContain("data-prize-plate");
    expect(html).toContain("bw-prize-copy");
    expect(html).toContain("bw-prize-rule");
    expect(html).toContain("Man of the Auction");
    expect(html).toContain("Rahul Sharma");
    expect(html).not.toContain(">PRIZE<");
    expect(html).not.toContain("textLength");
    expect(html).not.toContain("CURRENT BID");
  });
});

describe("top 5 lower third", () => {
  it("keeps each sale in its own card with the buying team and price", () => {
    const html = renderToStaticMarkup(createElement(BroadcastStage, { frame: makeFrame("TOP5") }));
    expect(html).toContain("bw-top5-card");
    expect(html).toContain("HIGHEST");
    expect(html).toContain("Sunbeams Anaadis");
    expect(html).toContain("Rohan Mehra");
    expect(html.match(/bw-top5-card/g)?.length).toBe(5);
    expect(html).not.toContain("bw-rank");
    expect(html).not.toContain("TOP 5 HIGHEST SOLD PLAYERS");
  });

  it("shows a short board as two filled cards, not a title colliding with rank 1", () => {
    const html = renderToStaticMarkup(
      createElement(Top5Scene, {
        model: {
          title: "Top 5 Highest Sold Players",
          entries: [
            { rank: 1, playerName: "Ankit Jain", role: "Player", teamShort: "TW", teamName: "Tushar Warriors", price: 35000 },
            { rank: 2, playerName: "Tushar Saraswat", role: "Player", teamShort: "TW", teamName: "Tushar Warriors", price: 10000 },
          ],
        },
      }),
    );
    expect(html).toContain("Ankit Jain");
    expect(html).toContain("Tushar Saraswat");
    expect(html).toContain("Tushar Warriors");
    expect(html).not.toContain("PLAYER");
    expect(html.match(/bw-top5-card/g)?.length).toBe(2);
  });
});

describe("auction outcome patti", () => {
  it("writes a sold line with the player and price", () => {
    const line = buildPattiLine(
      frame({
        scene: "SOLD",
        model: {
          player: { id: "1", name: "Tushar Saraswat", role: "Player", basePrice: 0 },
          soldPrice: 360000,
          team: { teamId: "1", name: "Tushar Warriors", short: "TW", purseRemaining: 0, playersBought: 1, slotsRemaining: 2 },
        },
      }),
      [],
    );
    expect(line?.text).toBe("Tushar Saraswat SOLD AT ₹3.6 L");
    expect(line?.amount).toBe("₹3.6 L");
    expect(line?.tone).toBe("sold");
  });

  it("calls the first unsold out, and the next one a repeat", () => {
    const unsold = frame({
      scene: "UNSOLD",
      model: {
        player: { id: "2", name: "Ankit Jain", role: "Player", basePrice: 10000 },
      },
    });
    expect(buildPattiLine(unsold, [])?.text).toBe("Ankit Jain goes unsold for the first time");
    expect(buildPattiLine(unsold, ["ankit jain"])?.text).toBe("Ankit Jain goes unsold again");
  });
});
