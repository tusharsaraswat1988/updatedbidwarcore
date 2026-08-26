import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseIndianMobile } from "@workspace/api-base/mobile";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");

describe("coach/mentor stays on team, not player registration", () => {
  it("public player registration contains no coach fields", () => {
    const src = readFileSync(
      join(repoRoot, "artifacts/auction-platform/src/pages/player-register.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/coachName|coachMobile|coach_name|coach_mobile/);
  });

  it("organizer team form stores coach name and validates mobile", () => {
    const src = readFileSync(
      join(repoRoot, "artifacts/auction-platform/src/components/team-form.tsx"),
      "utf8",
    );
    expect(src).toContain("coachName");
    expect(src).toContain("coachMobile");
    expect(src).toContain("parseIndianMobile");
    expect(parseIndianMobile("9876543210").ok).toBe(true);
    expect(parseIndianMobile("123").ok).toBe(false);
  });
});
