import { describe, expect, it } from "vitest";
import { scoringAppPath, scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import {
  cricketObsLivePath,
  cricketObsMatchPath,
  cricketObsLiveAppPath,
  cricketObsMatchAppPath,
} from "@/lib/tournament-navigation";
import { parseCricketObsMatchParam } from "@/lib/cricket-obs-view-model";

describe("Cricket OBS routing and public URL contract", () => {
  it("A. unit test: scoringAppPath idempotency on OBS paths", () => {
    expect(scoringAppPath("/tournament/25/cricket/obs/live")).toBe(
      "/scoring-app/tournament/25/cricket/obs/live",
    );

    expect(scoringAppPath("/scoring-app/tournament/25/cricket/obs/live")).toBe(
      "/scoring-app/tournament/25/cricket/obs/live",
    );

    expect(
      scoringAppPath("/scoring-app/tournament/25/cricket/obs/live?code=SL972608"),
    ).toBe("/scoring-app/tournament/25/cricket/obs/live?code=SL972608");
  });

  it("A. unit test: scoringAppPublicUrl ensures exact production URL", () => {
    const publicUrl = scoringAppPublicUrl(
      "https://bidwar.in",
      "/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );
    expect(publicUrl).toBe(
      "https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );
  });

  it("E. Live Control contract: cricketObsLivePath wrapped in scoringAppPublicUrl never duplicates /scoring-app", () => {
    const obsStreamUrl = cricketObsLivePath(25, "SL972608");
    expect(obsStreamUrl).toBe(
      "/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );

    const obsFullUrl = scoringAppPublicUrl("https://bidwar.in", obsStreamUrl);
    expect(obsFullUrl).toBe(
      "https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );
    expect(obsFullUrl).not.toContain("/scoring-app/scoring-app/");
  });

  it("C. Verifies both OBS URLs (live and match-pinned 58)", () => {
    // 1. Live follow
    const livePath = cricketObsLivePath(25, "SL972608");
    expect(livePath).toBe(
      "/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );
    const liveFull = scoringAppPublicUrl("https://bidwar.in", livePath);
    expect(liveFull).toBe(
      "https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
    );

    // 2. Match pinned: matchId 58
    const match58Path = cricketObsMatchPath(25, 58, "SL972608");
    expect(match58Path).toBe(
      "/scoring-app/tournament/25/cricket/obs/58?code=SL972608",
    );
    const match58Full = scoringAppPublicUrl("https://bidwar.in", match58Path);
    expect(match58Full).toBe(
      "https://bidwar.in/scoring-app/tournament/25/cricket/obs/58?code=SL972608",
    );
  });

  it("In-app relative paths for Wouter router matching inside scoring-app", () => {
    expect(cricketObsLiveAppPath(25)).toBe("/tournament/25/cricket/obs/live");
    expect(cricketObsMatchAppPath(25, 58)).toBe("/tournament/25/cricket/obs/58");

    expect(parseCricketObsMatchParam("live")).toEqual({ mode: "live" });
    expect(parseCricketObsMatchParam("58")).toEqual({ mode: "match", matchId: 58 });
  });

  it("D. Legacy broken URL normalization logic", () => {
    // Simulate what App.tsx does when Wouter (base="/scoring-app") sees /scoring-app/scoring-app/tournament/25/cricket/obs/live
    const rawPathname = "/scoring-app/scoring-app/tournament/25/cricket/obs/live";
    const base = "/scoring-app";
    // Wouter relative path after stripping base once:
    const wouterLocation = rawPathname.slice(base.length); // "/scoring-app/tournament/25/cricket/obs/live"
    expect(wouterLocation.startsWith("/scoring-app/")).toBe(true);

    const canonical = wouterLocation.slice("/scoring-app".length);
    expect(canonical).toBe("/tournament/25/cricket/obs/live");
  });

  it("useCricketObsLive module loads with all dependencies resolved (getActiveInnings, mapBallToFlash)", async () => {
    const mod = await import("@/hooks/use-cricket-obs-live");
    expect(typeof mod.useCricketObsLive).toBe("function");
  }, 20000);
});
