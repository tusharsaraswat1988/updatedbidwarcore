import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { resolveMatchFormatFromDetail } from "@/lib/badminton-match-control";
import { isScorerPwaRoute } from "@/lib/branding-pwa";
import { isOrganizerRoute } from "../../lib/portal-theme";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Milestone 4: Organiser Scoring Panels Modernisation", () => {
  const matchCenterSrc = readFileSync(path.resolve(__dirname, "../cricket/match-center.tsx"), "utf8");
  const fixturesSrc = readFileSync(path.resolve(__dirname, "../cricket/fixtures.tsx"), "utf8");
  const matchControlSrc = readFileSync(path.resolve(__dirname, "../badminton/match-control.tsx"), "utf8");
  const resultsSrc = readFileSync(path.resolve(__dirname, "../badminton/results.tsx"), "utf8");
  const reportsSrc = readFileSync(path.resolve(__dirname, "../cricket/reports.tsx"), "utf8");
  const portalThemeSrc = readFileSync(path.resolve(__dirname, "../../lib/portal-theme.ts"), "utf8");
  const platformAppSrc = readFileSync(path.resolve(__dirname, "../../platform-app.tsx"), "utf8");

  describe("1. Cricket Match Center 3-Zone Architecture & Deletion Safety (AUD-P1-03)", () => {
    it("distinguishes terminal and live match statuses for operational zone routing", () => {
      // Zone 1: Pre-match setup
      expect(isTerminalCricketMatchStatus("scheduled")).toBe(false);
      expect(isTerminalCricketMatchStatus("draft")).toBe(false);

      // Zone 2: Live supervision
      expect(isTerminalCricketMatchStatus("live")).toBe(false);

      // Zone 3: Post-match finalisation & reports
      expect(isTerminalCricketMatchStatus("completed")).toBe(true);
      expect(isTerminalCricketMatchStatus("walkover")).toBe(true);
      expect(isTerminalCricketMatchStatus("abandoned")).toBe(true);
    });

    it("verifies 3 distinct operational zones in Cricket Match Center", () => {
      // Zone 1: Pre-match setup
      expect(matchCenterSrc).toContain("1. Pre-Match Setup");
      expect(matchCenterSrc).toContain("Toss Status & Decision");

      // Zone 2: Live supervision
      expect(matchCenterSrc).toContain("2. Live Supervision");

      // Zone 3: Post-match finalisation & reports
      expect(matchCenterSrc).toContain("3. Post-Match Finalisation");
      expect(matchCenterSrc).toContain("ZONE 3: POST-MATCH FINALISATION & REPORTS");
    });

    it("isolates destructive match deletion behind Radix AlertDialog confirmation", () => {
      // Pre-toss deletion button located in dedicated danger zone
      expect(matchCenterSrc).toContain("Danger Zone: Delete Match");
      expect(matchCenterSrc).toContain("Pre-toss fixtures can be removed if no balls have been bowled.");
      expect(matchCenterSrc).toContain("setDeleteOpen(true)");

      // Guarded by Radix AlertDialog confirmation primitive
      expect(matchCenterSrc).toContain("<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>");
      expect(matchCenterSrc).toContain("<AlertDialogContent>");
      expect(matchCenterSrc).toContain("<AlertDialogHeader>");
      expect(matchCenterSrc).toContain("<AlertDialogTitle>Delete Match #{data?.match.tournamentMatchNumber ?? matchId}?</AlertDialogTitle>");
      expect(matchCenterSrc).toContain("<AlertDialogDescription>");
      expect(matchCenterSrc).toContain("This action cannot be undone. Matches can only be deleted if no balls have been bowled.");
      expect(matchCenterSrc).toContain("<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>");
      expect(matchCenterSrc).toContain("<AlertDialogAction");
      expect(matchCenterSrc).toContain("handleDeleteMatch()");
    });

    it("includes Scorer PIN copy toast trigger and live stream preview", () => {
      // Scorer PIN copy trigger with toast feedback
      expect(matchCenterSrc).toContain('toast({');
      expect(matchCenterSrc).toContain('title: "Scorer PIN Copied"');
      expect(matchCenterSrc).toContain('title="Copy Scorer PIN"');
      expect(matchCenterSrc).toContain('aria-label="Copy Scorer PIN"');

      // Live event timeline stream and scorecard preview
      expect(matchCenterSrc).toContain("Ball-by-Ball Live Timeline Stream");
      expect(matchCenterSrc).toContain("Timeline stream activates once toss, lineups, and balls are entered on Scorer Pad.");
      expect(matchCenterSrc).toContain("Live Scorecard Preview");
      expect(matchCenterSrc).toContain("Synchronized with live ball scoring");
    });
  });

  describe("2. Cricket Fixtures Radix Dialog Primitives (AUD-P0-04)", () => {
    it("imports and uses accessible Radix Dialog primitives for match scheduling and editing", () => {
      // Accessible Radix UI dialog imports
      expect(fixturesSrc).toContain('import {');
      expect(fixturesSrc).toContain('Dialog,');
      expect(fixturesSrc).toContain('DialogContent,');
      expect(fixturesSrc).toContain('DialogHeader,');
      expect(fixturesSrc).toContain('DialogTitle,');
      expect(fixturesSrc).toContain('DialogDescription,');
      expect(fixturesSrc).toContain('DialogFooter,');
      expect(fixturesSrc).toContain('} from "@/components/ui/dialog";');

      // Radix Dialog implementations
      expect(fixturesSrc).toContain("<Dialog open={createOpen} onOpenChange={setCreateOpen}>");
      expect(fixturesSrc).toContain("<DialogTitle className=\"font-bold text-base\">Schedule Playoff / Custom Match</DialogTitle>");
      expect(fixturesSrc).toContain("<Dialog open={!!editMatch} onOpenChange={(open) => !open && setEditMatch(null)}>");
      expect(fixturesSrc).toContain("<DialogTitle className=\"font-bold text-base\">Edit Match Details</DialogTitle>");
    });

    it("eliminates all legacy unaccessible fixed inset-0 modal overlays", () => {
      // Strict regression check: no custom unaccessible modal overlays
      expect(fixturesSrc).not.toContain("fixed inset-0");
    });
  });

  describe("3. Badminton Match Control & Scorer Monitor", () => {
    it("resolves match formats accurately for pre-match toss console", () => {
      const customDetail = {
        matchFormatJson: {
          totalGames: 1,
          pointsPerGame: 30,
          deuceAt: 29,
          maxPoints: 30,
          midGameSideChange: false,
        },
      };
      const resolved = resolveMatchFormatFromDetail(customDetail);
      expect(resolved.pointsPerGame).toBe(30);
      expect(resolved.totalGames).toBe(1);
      expect(resolved.deuceAt).toBe(29);
      expect(resolved.maxPoints).toBe(30);

      // Fallback to standard BWF
      const standardResolved = resolveMatchFormatFromDetail(null);
      expect(standardResolved.pointsPerGame).toBe(21);
      expect(standardResolved.totalGames).toBe(3);
      expect(standardResolved.deuceAt).toBe(20);
      expect(standardResolved.maxPoints).toBe(30);
    });

    it("renders Scorer Connection Monitor and emergency session unlock controls", () => {
      // Scorer Connection Monitor
      expect(matchControlSrc).toContain("Scorer Connection Monitor");
      expect(matchControlSrc).toContain("Live Connected");
      expect(matchControlSrc).toContain("Ready / Standby");

      // Scorer PIN copy trigger
      expect(matchControlSrc).toContain("PIN: {scorerPin}");
      expect(matchControlSrc).toContain("PIN ${scorerPin} copied to clipboard for match officials.");

      // Emergency force-unlock session clearance
      expect(matchControlSrc).toContain('import { forceUnlockBadmintonMatch } from "@/lib/scorer-api";');
      expect(matchControlSrc).toContain("await forceUnlockBadmintonMatch(tournamentId, matchId)");
      expect(matchControlSrc).toContain("Emergency Force-Unlock");
      expect(matchControlSrc).toContain("Clears any stuck tablet session so a new device can score");
      expect(matchControlSrc).toContain("Official scoring pad runs independently.");
    });
  });

  describe("4. Badminton Results & Cricket Reports Digital Sign-Off", () => {
    it("renders Completed Matches & Digital Sign-Off table with ShieldCheck badge in Badminton Results", () => {
      expect(resultsSrc).toContain("Completed Matches & Digital Sign-Off");
      expect(resultsSrc).toContain("Verified score records and official match sign-off status");
      expect(resultsSrc).toContain("ShieldCheck");
      expect(resultsSrc).toContain("Signed Off");
      expect(resultsSrc).toContain('<table className="w-full text-xs">');
    });

    it("renders Completed Match Results & Digital Sign-Off table with ShieldCheck badge in Cricket Reports", () => {
      expect(reportsSrc).toContain("Completed Match Results & Digital Sign-Off");
      expect(reportsSrc).toContain("Verified match outcomes, official scorecards, and digital certification");
      expect(reportsSrc).toContain("ShieldCheck");
      expect(reportsSrc).toContain("Matches Signed Off");
      expect(reportsSrc).toContain('<table className="w-full text-xs">');
    });
  });

  describe("5. Protected Surface Isolation Invariants", () => {
    it("quarantines live scorer pad routes via RedirectToScoringApp in platform-app", () => {
      expect(platformAppSrc).toContain('<Route path="/cricket/scorer" component={RedirectToScoringApp} />');
      expect(platformAppSrc).toContain('<Route path="/cricket/:matchId/score" component={RedirectToScoringApp} />');
      expect(platformAppSrc).toContain('<Route path="/badminton/scorer" component={RedirectToScoringApp} />');
      expect(platformAppSrc).toContain('<Route path="/tournament/:id/badminton/scorers" component={RedirectToScoringApp} />');
    });

    it("prevents organiser light theme leakage onto scorer pads in portal-theme", () => {
      expect(portalThemeSrc).toContain('p.includes("/scorer")');
      expect(portalThemeSrc).toContain('(p.includes("/score/") && p.includes("/live"))');
      expect(portalThemeSrc).toContain('/\\/score(\\/|$)/.test(p)');
      expect(portalThemeSrc).toContain('p.includes("/owner")');
    });

    it("strictly excludes live scorer pads and owner app from organiser light theme", () => {
      expect(isOrganizerRoute("/cricket/123/score")).toBe(false);
      expect(isOrganizerRoute("/cricket/123/score/")).toBe(false);
      expect(isOrganizerRoute("/badminton/456/score")).toBe(false);
      expect(isOrganizerRoute("/badminton/456/score/")).toBe(false);
      expect(isOrganizerRoute("/scoring-app/cricket/123/score")).toBe(false);
      expect(isOrganizerRoute("/tournament/1/owner/team-5")).toBe(false);

      expect(isOrganizerRoute("/cricket/123/match-center")).toBe(true);
      expect(isOrganizerRoute("/badminton/456/match-control")).toBe(true);
      expect(isOrganizerRoute("/tournament/1")).toBe(true);
      expect(isOrganizerRoute("/organizer")).toBe(true);
    });

    it("accurately classifies scorer routes via isScorerPwaRoute", () => {
      expect(isScorerPwaRoute("/cricket/scorer")).toBe(true);
      expect(isScorerPwaRoute("/cricket/123/score")).toBe(true);
      expect(isScorerPwaRoute("/badminton/scorer")).toBe(true);
      expect(isScorerPwaRoute("/badminton/456/score")).toBe(true);
      expect(isScorerPwaRoute("/tournament/1")).toBe(false);
      expect(isScorerPwaRoute("/organizer")).toBe(false);
    });
  });
});
