import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAuctionOrganizerShell } from "../auction-organizer-shell";
import { sidebarActiveScrollDelta } from "../sidebar-active-scroll";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("\nfunction ", start + name.length);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("auction organiser shell routing", () => {
  it("matches sidebar organiser pages and keeps auction control and scoring outside", () => {
    expect(parseAuctionOrganizerShell("/tournament/4")).toEqual({ tournamentId: 4 });
    expect(parseAuctionOrganizerShell("/tournament/4/settings")).toEqual({ tournamentId: 4 });
    expect(parseAuctionOrganizerShell("/tournament/4/reports")).toEqual({
      tournamentId: 4,
      requiredModule: "auction",
    });
    expect(parseAuctionOrganizerShell("/tournament/4/links/")).toEqual({
      tournamentId: 4,
      requiredModule: "auction",
    });
    expect(parseAuctionOrganizerShell("/tournament/4/auction")).toBeNull();
    expect(parseAuctionOrganizerShell("/tournament/4/obs/v2")).toBeNull();
    expect(parseAuctionOrganizerShell("/tournament/4/score")).toBeNull();
    expect(parseAuctionOrganizerShell("/tournament/4/badminton")).toBeNull();
    expect(parseAuctionOrganizerShell("/tournament/4/display")).toBeNull();
    expect(parseAuctionOrganizerShell("/tournament/new")).toBeNull();
    expect(parseAuctionOrganizerShell("/scoring-app/tournament/4/score")).toBeNull();
  });

  it("keeps one AppLayout around the lazy organiser pages", () => {
    const appSrc = readFileSync(path.resolve(__dirname, "../../platform-app.tsx"), "utf8");
    const shell = sliceFunction(appSrc, "AuctionOrganizerShell");

    expect(shell).toContain("<AppLayout tournamentId={tournamentId}>");
    expect(shell).toContain("<Suspense fallback={<OrganizerPageFallback />}>");
    expect(shell).toContain('path="/tournament/:id/reports"');
    expect(shell).toContain('path="/tournament/:id"');
    expect(shell).toContain("<TournamentHome />");
    expect(shell).not.toContain("AuctionOperator");
    expect(shell).not.toContain("RedirectToScoringApp");
    expect(shell).not.toContain("ObsV2Overlay");
    expect(shell).not.toContain("min-h-screen");

    const fallback = sliceFunction(appSrc, "OrganizerPageFallback");
    expect(fallback).toContain("Loading…");
    expect(fallback).not.toContain("min-h-screen");

    expect(appSrc).toContain('path="/tournament/:id/auction"');
    expect(appSrc).toContain("<AuctionOperator />");
    expect(appSrc).toMatch(/path="\/tournament\/:id\/score"[\s\S]*?requiredModule="scoring"/);
  });

  it("treats a nested AppLayout as page content, not a second shell", () => {
    const layoutSrc = readFileSync(path.resolve(__dirname, "../../components/layout.tsx"), "utf8");
    expect(layoutSrc).toContain("OrganizerShellContext");
    expect(layoutSrc).toContain("if (inShell) return <>{children}</>;");
    expect(layoutSrc).toContain("sidebarActiveScrollDelta");
    expect(layoutSrc).not.toContain("scrollIntoView");
  });
});

describe("sidebar active item scroll delta", () => {
  const viewport = { top: 100, bottom: 400 };

  it("does not scroll when the active link is fully visible", () => {
    expect(sidebarActiveScrollDelta(viewport, { top: 120, bottom: 160 })).toBe(0);
    expect(sidebarActiveScrollDelta(viewport, { top: 100, bottom: 400 })).toBe(0);
  });

  it("scrolls down by the overflow when the link is below the viewport", () => {
    expect(sidebarActiveScrollDelta(viewport, { top: 360, bottom: 440 })).toBe(40);
  });

  it("scrolls up by the overflow when the link is above the viewport", () => {
    expect(sidebarActiveScrollDelta(viewport, { top: 40, bottom: 80 })).toBe(-60);
  });

  it("ignores sub-pixel overflow", () => {
    expect(sidebarActiveScrollDelta(viewport, { top: 99.4, bottom: 400.6 })).toBe(0);
  });
});
