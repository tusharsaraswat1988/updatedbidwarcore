import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cricketScorerConsolePath } from "@/lib/cricket-routes";
import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import {
  setScorerAuthSession,
  clearScorerAuthSession,
  scorerAuthHeaders,
} from "@/lib/badminton-scorer-session";
import { getScoringMatch } from "@/lib/scoring-api";
import * as apiFetchModule from "@workspace/api-base/api-fetch";

describe("cricket scorer render audit — PreMatchSetup onResetMatch regression", () => {
  it("PreMatchSetup function parameter list explicitly destructures onResetMatch", async () => {
    const filePath = path.resolve(import.meta.dirname, "../pre-match-setup.tsx");
    const src = await readFile(filePath, "utf8");

    // PreMatchSetup must destructure onResetMatch
    const fnIdx = src.indexOf("export function PreMatchSetup({");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSignature = src.slice(fnIdx, fnIdx + 400);
    expect(fnSignature).toContain("onResetMatch,");

    // The runtime references at lines 270 and 372 must resolve to this destructured variable
    expect(src).toContain("{onResetMatch ? (");
    expect(src).toContain("await onResetMatch?.();");
  });
});

describe("cricket scorer render audit — route resolution", () => {
  it("cricketScorerConsolePath creates the exact canonical URL for tournament 25, match 58", () => {
    const route = cricketScorerConsolePath(25, 58);
    expect(route).toBe("/cricket/58/score?tid=25");

    const fullProdUrl = scoringAppPublicUrl("https://bidwar.in", route);
    expect(fullProdUrl).toBe("https://bidwar.in/scoring-app/cricket/58/score?tid=25");
  });
});

describe("cricket scorer auth headers & getScoringMatch transport", () => {
  const fakeStorage: Record<string, string> = {};

  beforeEach(() => {
    // Mock browser sessionStorage
    Object.defineProperty(globalThis, "sessionStorage", {
      value: {
        getItem: (k: string) => fakeStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          fakeStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete fakeStorage[k];
        },
        clear: () => {
          for (const k in fakeStorage) delete fakeStorage[k];
        },
      },
      writable: true,
      configurable: true,
    });
    clearScorerAuthSession();
  });

  afterEach(() => {
    clearScorerAuthSession();
    vi.restoreAllMocks();
  });

  it("scorerAuthHeaders returns empty object when no scorer session is present", () => {
    expect(scorerAuthHeaders()).toEqual({});
  });

  it("scorerAuthHeaders returns Authorization: Bearer <token> when scorer session is active", () => {
    setScorerAuthSession({
      token: "jwt-test-scorer-token-12345",
      scorer: { id: 7, name: "Test Scorer", mobile: "9876543210" },
      canScore: true,
      expiresAt: "2099-01-01T00:00:00Z",
    });

    expect(scorerAuthHeaders()).toEqual({
      Authorization: "Bearer jwt-test-scorer-token-12345",
    });
  });

  it("getScoringMatch passes scorer Authorization header to apiFetch when session is active", async () => {
    setScorerAuthSession({
      token: "jwt-match-read-token",
      scorer: { id: 7, name: "Test Scorer", mobile: "9876543210" },
      canScore: true,
      expiresAt: "2099-01-01T00:00:00Z",
    });

    const apiFetchSpy = vi.spyOn(apiFetchModule, "apiFetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          match: { id: 58, tournamentId: 25 },
          state: { matchStatus: "live", lastSequence: 0 },
          events: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await getScoringMatch(25, 58);

    expect(apiFetchSpy).toHaveBeenCalledTimes(1);
    const [path, options] = apiFetchSpy.mock.calls[0];
    expect(path).toBe("/tournaments/25/scoring/matches/58");
    expect(options?.headers).toEqual({
      Authorization: "Bearer jwt-match-read-token",
    });
  });
});
