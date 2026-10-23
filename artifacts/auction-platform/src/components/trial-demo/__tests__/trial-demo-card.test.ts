import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

describe("TrialDemoCard specification and copy verification", () => {
  const trialDemoCardPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../trial-demo-card.tsx",
  );
  const src = readFileSync(trialDemoCardPath, "utf8");

  it("contains the exact required primary button label: 'Load Trial Demo'", () => {
    expect(src).toContain("Load Trial Demo");
  });

  it("contains the exact required explanatory text", () => {
    const requiredText =
      "Load 10 sample players, 2 teams, 5 sponsors, auction settings and demo owner logins to practise the complete auction workflow. Includes sample photos and logos. Your existing tournament data will not be overwritten.";
    expect(src).toContain(requiredText);
  });

  it("includes all 5 required button and session states", () => {
    // 1. Unloaded state: shows Load Trial Demo
    expect(src).toContain("Load Trial Demo");
    // 2. Loading state: shows Loading indicator
    expect(src).toContain("Loading Trial Demo...");
    // 3. Demo loaded: shows 'Demo Loaded'
    expect(src).toContain("Demo Loaded");
    // 4. Links to Clear Trial Data page
    expect(src).toContain("Clear Trial Data");
    // 5. Error handling callout
    expect(src).toContain("Unable to load demo data");
  });

  it("displays demo owner credentials clearly when loaded", () => {
    expect(src).toContain("Demo Owner Logins");
    expect(src).toContain("PIN: DEMO01");
    expect(src).toContain("PIN: DEMO02");
    expect(src).toContain("9800000001");
    expect(src).toContain("9800000002");
  });

  it("guards against active license so it only displays for trial auctions", () => {
    expect(src).toContain('licenseStatus !== "active"');
    expect(src).toContain("if (!isTrialMode)");
  });
});

describe("organizer panel wiring for Load Trial Demo", () => {
  it("is mounted in tournament-settings.tsx under the recovery/reset options panel", () => {
    const settingsPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../pages/tournament-settings.tsx",
    );
    const src = readFileSync(settingsPath, "utf8");
    expect(src).toContain('import { TrialDemoCard } from "@/components/trial-demo/trial-demo-card"');
    expect(src).toContain("<TrialDemoCard");
    expect(src).toContain('activeSection === "recovery"');
  });

  it("is mounted in auction-reset.tsx on the Clear Trial Data page", () => {
    const resetPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../pages/auction-reset.tsx",
    );
    const src = readFileSync(resetPath, "utf8");
    expect(src).toContain('import { TrialDemoCard } from "@/components/trial-demo/trial-demo-card"');
    expect(src).toContain("<TrialDemoCard");
  });
});
