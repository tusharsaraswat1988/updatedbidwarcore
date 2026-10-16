import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  scoringFoundationRemainder,
  shouldApplyScoringFoundationGate,
  type ScoringFoundationScope,
} from "../middleware/scoring-foundation-scope";

const SCOPES: ScoringFoundationScope[] = [
  "teams",
  "matches",
  "fixtures",
  "scheduling",
  "runtime-matches",
];

function appWithFoundationGates() {
  const app = express();
  for (const scope of SCOPES) {
    const router = express.Router();
    router.use("/tournaments/:tournamentId", (req, res, next) => {
      if (!shouldApplyScoringFoundationGate(scope, req.url)) {
        next();
        return;
      }
      res.status(403).json({ code: "SCORING_DISABLED", scope });
    });
    app.use(router);
  }
  app.get("/tournaments/:tournamentId", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/tournaments/:tournamentId/players", (_req, res) => {
    res.json({ players: [] });
  });
  app.get("/tournaments/:tournamentId/teams", (_req, res) => {
    res.json({ teams: [] });
  });
  app.get("/tournaments/:tournamentId/teams/:teamId", (_req, res) => {
    res.json({ team: true });
  });
  return app;
}

describe("scoring foundation scope", () => {
  it("strips the tournament prefix from full and remainder URLs", () => {
    expect(scoringFoundationRemainder("/players")).toBe("/players");
    expect(scoringFoundationRemainder("/api/tournaments/45")).toBe("/");
    expect(scoringFoundationRemainder("/api/tournaments/45/players?x=1")).toBe("/players");
    expect(scoringFoundationRemainder("/tournaments/45/teams/identities")).toBe("/teams/identities");
  });

  it("does not treat auction team routes as scoring foundation", () => {
    expect(shouldApplyScoringFoundationGate("teams", "/teams")).toBe(false);
    expect(shouldApplyScoringFoundationGate("teams", "/teams/12")).toBe(false);
    expect(shouldApplyScoringFoundationGate("teams", "/teams/scout")).toBe(false);
    expect(shouldApplyScoringFoundationGate("teams", "/api/tournaments/45/teams/8/purse-boosters")).toBe(false);
    expect(shouldApplyScoringFoundationGate("teams", "/teams/identities")).toBe(true);
    expect(shouldApplyScoringFoundationGate("teams", "/teams/12/identity")).toBe(true);
    expect(shouldApplyScoringFoundationGate("teams", "/teams/12/ready")).toBe(true);
  });

  it("lets a new auction tournament load settings data", async () => {
    const app = appWithFoundationGates();
    const tournament = await request(app).get("/tournaments/45");
    const players = await request(app).get("/tournaments/45/players");
    const teams = await request(app).get("/tournaments/45/teams");
    const team = await request(app).get("/tournaments/45/teams/3");

    expect(tournament.status).toBe(200);
    expect(players.status).toBe(200);
    expect(teams.status).toBe(200);
    expect(team.status).toBe(200);
  });

  it("still blocks scoring foundation paths when scoring is off", async () => {
    const app = appWithFoundationGates();
    const identities = await request(app).get("/tournaments/45/matches/identities");
    const fixtures = await request(app).get("/tournaments/45/fixtures");
    const scheduling = await request(app).get("/tournaments/45/scheduling/aggregate");
    const runtime = await request(app).get("/tournaments/45/runtime-matches/4/snapshot");
    const teamIdentity = await request(app).get("/tournaments/45/teams/identities");

    expect(identities.status).toBe(403);
    expect(fixtures.status).toBe(403);
    expect(scheduling.status).toBe(403);
    expect(runtime.status).toBe(403);
    expect(teamIdentity.status).toBe(403);
    expect(teamIdentity.body.code).toBe("SCORING_DISABLED");
  });

  it("wires the scope check into every foundation router before the scoring gate", async () => {
    const files = [
      ["team-foundation.ts", "teams"],
      ["match-foundation.ts", "matches"],
      ["fixture-foundation.ts", "fixtures"],
      ["scheduling-foundation.ts", "scheduling"],
      ["runtime-match-foundation.ts", "runtime-matches"],
    ] as const;

    for (const [file, scope] of files) {
      const src = await readFile(new URL(`../routes/${file}`, import.meta.url), "utf8");
      const gateAt = src.indexOf(`shouldApplyScoringFoundationGate("${scope}", req.url)`);
      const scoringAt = src.indexOf("requireScoringModule(");
      expect(gateAt, file).toBeGreaterThan(-1);
      expect(scoringAt, file).toBeGreaterThan(gateAt);
    }
  });
});
