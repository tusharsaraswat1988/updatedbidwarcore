import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("VenueMusicSettingsPanel Module-Aware Button Behavior", () => {
  const panelPath = path.resolve(
    __dirname,
    "../badminton/venue-music-settings-panel.tsx",
  );
  const panelSrc = readFileSync(panelPath, "utf8");

  const cricketSettingsPath = path.resolve(
    __dirname,
    "../../pages/cricket/settings.tsx",
  );
  const cricketSettingsSrc = readFileSync(cricketSettingsPath, "utf8");

  const badmintonBrandingPath = path.resolve(
    __dirname,
    "../../pages/badminton/branding.tsx",
  );
  const badmintonBrandingSrc = readFileSync(badmintonBrandingPath, "utf8");

  it("imports isAuctionEnabled and isScoringEnabled from @workspace/platform-core", () => {
    expect(panelSrc).toContain('from "@workspace/platform-core"');
    expect(panelSrc).toContain("isAuctionEnabled");
    expect(panelSrc).toContain("isScoringEnabled");
  });

  it("evaluates hasBothAuctionAndScoring from auction and scoring flags", () => {
    expect(panelSrc).toContain("hasBothAuctionAndScoring");
    // Verify pure logic
    expect(isAuctionEnabled({ auctionEnabled: true }) && isScoringEnabled({ scoringEnabled: true })).toBe(true);
    expect(isAuctionEnabled({ auctionEnabled: false }) && isScoringEnabled({ scoringEnabled: true })).toBe(false);
    expect(isAuctionEnabled({ auctionEnabled: true }) && isScoringEnabled({ scoringEnabled: false })).toBe(false);
  });

  it("conditionally gates 'Use auction break music' behind hasBothAuctionAndScoring", () => {
    expect(panelSrc).toMatch(
      /\{hasBothAuctionAndScoring\s*\?\s*\(\s*<BtnSecondary[\s\S]*?>[\s\S]*?Use auction break music[\s\S]*?<\/BtnSecondary>\s*\)\s*:\s*null\}/,
    );
  });

  it("dynamically shows 'Change song' when custom song exists, otherwise 'Upload song'", () => {
    expect(panelSrc).toContain('overrideUrl ? "Change song" : "Upload song"');
  });

  it("adjusts helper description so auction break music is not mentioned when auction is not enabled", () => {
    expect(panelSrc).toContain("hasBothAuctionAndScoring");
    expect(panelSrc).toContain("Background song for the scoreboard when Control Center presses Play music.");
    expect(panelSrc).toContain("If you don’t upload one, auction break music is used.");
  });

  it("passes tournament module flags from cricket settings page", () => {
    expect(cricketSettingsSrc).toContain("auctionEnabled={tournament?.auctionEnabled}");
    expect(cricketSettingsSrc).toContain("scoringEnabled={tournament?.scoringEnabled}");
  });

  it("passes tournament module flags from badminton branding page", () => {
    expect(badmintonBrandingSrc).toContain("auctionEnabled={tournament?.auctionEnabled}");
    expect(badmintonBrandingSrc).toContain("scoringEnabled={tournament?.scoringEnabled}");
  });
});
