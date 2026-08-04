import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * Phase 1 scoring auth stability regressions (source-level).
 * Covers claim-on-restore, scoring login path, production errors, and display safety.
 */
describe("scoring auth Phase 1 — session restore claim", () => {
  it("claims on GET /auth/organizer-account/me", async () => {
    const src = await readFile(new URL("../routes/auth.ts", import.meta.url), "utf8");
    const meIdx = src.indexOf('router.get("/auth/organizer-account/me"');
    expect(meIdx).toBeGreaterThan(-1);
    const meSlice = src.slice(meIdx, meIdx + 1800);
    expect(meSlice).toContain("claimTournamentsForOrganizer");
  });

  it("claims on GET /auth/organizer/:tournamentId/me when unlinked", async () => {
    const src = await readFile(new URL("../routes/auth.ts", import.meta.url), "utf8");
    const tidMeIdx = src.indexOf('router.get("/auth/organizer/:tournamentId/me"');
    expect(tidMeIdx).toBeGreaterThan(-1);
    const slice = src.slice(tidMeIdx, tidMeIdx + 2200);
    expect(slice).toContain("tryClaimTournamentForOrganizer");
  });
});

describe("scoring auth Phase 1 — client guard / login / errors", () => {
  const auctionRoot = new URL(
    "../../../auction-platform/src/",
    import.meta.url,
  );

  it("OrganizerGuard sends scoring users to scoring-app login, not Auction homepage", async () => {
    const src = await readFile(new URL("./components/organizer-guard.tsx", auctionRoot), "utf8");
    expect(src).toContain("SCORING_APP_BASE}/login");
    expect(src).toContain("AccessStateView");
    expect(src).toContain("code={403}");
    expect(src).toContain("code={401}");
    // Unauthenticated scoring path must not dump into /organizer dashboard.
    expect(src).toMatch(/inScoringApp[\s\S]*scoringLoginUrl|scoringLoginUrl[\s\S]*inScoringApp/);
  });

  it("ScoringFeatureGuard shows 503 unavailable, not developer 404 copy", async () => {
    const src = await readFile(
      new URL("./components/scoring-feature-guard.tsx", auctionRoot),
      "utf8",
    );
    expect(src).toContain("code={503}");
    expect(src).toContain("Scoring is currently unavailable");
    expect(src).not.toContain("Did you forget to add the page");
  });

  it("NotFoundView has production copy without router jargon", async () => {
    const src = await readFile(new URL("./components/not-found-view.tsx", auctionRoot), "utf8");
    expect(src).not.toContain("Did you forget to add the page");
    expect(src).toContain("AccessStateView");
  });

  it("idle logout clears client state and uses scoring-safe destination", async () => {
    const src = await readFile(
      new URL("./hooks/use-organizer-inactivity-logout.ts", auctionRoot),
      "utf8",
    );
    expect(src).toContain("clearOrganizerClientState");
    expect(src).toContain("SCORING_APP_BASE");
    expect(src).toContain("/login");
  });

  it("SportsShell logout clears client caches and avoids Auction portal from scoring", async () => {
    const src = await readFile(
      new URL("./components/sports-shell/sports-shell.tsx", auctionRoot),
      "utf8",
    );
    expect(src).toContain("clearOrganizerClientState");
    expect(src).toContain("goToPostLogoutHome");
    expect(src).toContain("goToTournamentsHome");
  });
});

describe("scoring auth Phase 1 — route safety", () => {
  it("scoring-app exposes /login and keeps display/overlay outside OrganizerGuard", async () => {
    const src = await readFile(
      new URL("../../../scoring-app/src/App.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain('path="/login"');
    expect(src).toContain("ScoringLoginPage");

    // Display / overlay / public standings: feature guard only — no OrganizerGuard wrapper.
    const displayBlock = src.match(
      /path="\/badminton\/:matchId\/display"[\s\S]*?<\/Route>/,
    )?.[0];
    const overlayBlock = src.match(
      /path="\/badminton\/:matchId\/overlay"[\s\S]*?<\/Route>/,
    )?.[0];
    const standingsBlock = src.match(
      /path="\/badminton\/standings"[\s\S]*?<\/Route>/,
    )?.[0];
    expect(displayBlock).toBeTruthy();
    expect(overlayBlock).toBeTruthy();
    expect(standingsBlock).toBeTruthy();
    expect(displayBlock).not.toContain("OrganizerGuard");
    expect(overlayBlock).not.toContain("OrganizerGuard");
    expect(standingsBlock).not.toContain("OrganizerGuard");
  });

  it("score-display route is not wrapped by OrganizerGuard", async () => {
    const src = await readFile(
      new URL("../../../scoring-app/src/App.tsx", import.meta.url),
      "utf8",
    );
    expect(src).toContain('path="/tournament/:id/score-display"');
    // Dedicated score-display route should remain a bare component mount.
    expect(src).toMatch(
      /path="\/tournament\/:id\/score-display"\s+component=\{ScoreDisplay\}/,
    );
  });
});
