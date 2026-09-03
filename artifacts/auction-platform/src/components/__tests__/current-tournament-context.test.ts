import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { formatTournamentStatusLabel } from "../current-tournament-context";

describe("formatTournamentStatusLabel", () => {
  it("uppercases real tournament status values", () => {
    expect(formatTournamentStatusLabel("active")).toBe("ACTIVE");
    expect(formatTournamentStatusLabel("completed")).toBe("COMPLETED");
  });

  it("omits missing or blank status instead of inventing ACTIVE", () => {
    expect(formatTournamentStatusLabel(null)).toBeNull();
    expect(formatTournamentStatusLabel(undefined)).toBeNull();
    expect(formatTournamentStatusLabel("")).toBeNull();
    expect(formatTournamentStatusLabel("   ")).toBeNull();
  });
});

describe("organizer sidebar current tournament wiring", () => {
  it("renders CurrentTournamentContext from existing layout tournament data", () => {
    const layoutPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../layout.tsx",
    );
    const src = readFileSync(layoutPath, "utf8");
    expect(src).toContain('from "@/components/current-tournament-context"');
    expect(src).toContain("<CurrentTournamentContext");
    expect(src).toContain("name={tournament?.name}");
    expect(src).toContain("status={tournament?.status}");
    expect(src).toContain("licenseStatus={tournament?.licenseStatus}");
    // Tournament name must not remain a plain SETUP-style section heading.
    expect(src).not.toMatch(
      /text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate[\s\S]*tournament\?\.name/,
    );
  });
});
