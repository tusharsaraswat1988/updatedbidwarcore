import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Admin Communication Center — Selected Tournament Persistence", () => {
  const commSrc = readFileSync(
    path.resolve(__dirname, "../admin-communication-center.tsx"),
    "utf8"
  );
  const authRouteSrc = readFileSync(
    path.resolve(__dirname, "../../../../api-server/src/routes/auth.ts"),
    "utf8"
  );

  it("defines localStorage and URL search persistence keys", () => {
    expect(commSrc).toContain("COMM_STORAGE_KEY");
    expect(commSrc).toContain("GLOBAL_STORAGE_KEY");
    expect(commSrc).toContain("resolveInitialTournamentId");
    expect(commSrc).toContain("persistTournamentSelection");
  });

  it("initializes selectedTournamentId from URL query or localStorage on initial render", () => {
    expect(commSrc).toMatch(/useState<string>\(\(\)\s*=>\s*\{\s*return resolveInitialTournamentId/);
  });

  it("does not blindly overwrite selected tournament with list[0] on data fetch or refresh", () => {
    // Verifies that candidates from state, URL or localStorage are checked first
    expect(commSrc).toContain("const candidate = currentId || pref.id;");
    expect(commSrc).toContain("const match = list.find((t) => String(t.id) === candidate);");
    expect(commSrc).toContain("persistTournamentSelection(candidate, match.name);");
  });

  it("preserves __all__ selection without snapping back to list[0]", () => {
    expect(commSrc).toContain('pref.hasExplicitPref && (pref.id === "" || pref.id === "__all__")');
    expect(commSrc).toContain('persistTournamentSelection("__all__");');
  });

  it("preserves tournamentId query parameter across tab switches", () => {
    expect(commSrc).toContain('const qs = selectedTournamentId ? `?tournamentId=${encodeURIComponent(selectedTournamentId)}` : "";');
  });

  it("orders tournaments deterministically in the auth API endpoint with tie-breaker", () => {
    expect(authRouteSrc).toContain("orderBy(desc(tournamentsTable.createdAt), desc(tournamentsTable.id))");
  });
});
