import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BADMINTON_PRIMARY_NAV,
  getBadmintonSportNav,
} from "../badminton-sport-nav.ts";

const TID = 42;
const BASE = `/tournament/${TID}/badminton`;

function activeIds(pathname: string): string[] {
  return BADMINTON_PRIMARY_NAV.filter((item) => item.isActive(pathname, TID)).map(
    (item) => item.id,
  );
}

describe("getBadmintonSportNav — VNBL Phase 1 IA", () => {
  it("exposes exactly 7 primary sidebar items", () => {
    const nav = getBadmintonSportNav();
    const items = nav.sections.flatMap((s) => s.items);
    assert.equal(items.length, 7);
    assert.deepEqual(
      items.map((i) => i.label),
      [
        "Dashboard",
        "Tournament Setup",
        "Participants",
        "Tournament Structure",
        "Schedule",
        "Live Control",
        "Results",
      ],
    );
  });

  it("uses a flat section (no module group labels)", () => {
    const nav = getBadmintonSportNav();
    assert.equal(nav.sections.length, 1);
    assert.equal(nav.sections[0]?.label.trim(), "");
  });

  it("points temporary hosts at existing pages", () => {
    const byId = Object.fromEntries(
      BADMINTON_PRIMARY_NAV.map((item) => [item.id, item.href(TID)]),
    );
    assert.equal(byId.dashboard, BASE);
    assert.equal(byId.setup, `${BASE}/branding`);
    assert.equal(byId.participants, `${BASE}/players`);
    assert.equal(byId.structure, `${BASE}/fixtures`);
    assert.equal(byId.schedule, `${BASE}/schedule`);
    assert.equal(byId.live, `${BASE}/control`);
    assert.equal(byId.results, `${BASE}/results`);
  });

  it("maps legacy setup routes onto Tournament Setup", () => {
    assert.deepEqual(activeIds(`${BASE}/branding`), ["setup"]);
    assert.deepEqual(activeIds(`${BASE}/courts`), ["setup"]);
    assert.deepEqual(activeIds(`${BASE}/scoring-format`), ["setup"]);
  });

  it("maps legacy participant routes onto Participants", () => {
    assert.deepEqual(activeIds(`${BASE}/players`), ["participants"]);
    assert.deepEqual(activeIds(`${BASE}/scorers`), ["participants"]);
  });

  it("maps events/draw onto Tournament Structure", () => {
    assert.deepEqual(activeIds(`${BASE}/fixtures`), ["structure"]);
    assert.deepEqual(activeIds(`${BASE}/categories`), ["structure"]);
  });

  it("maps ops routes onto Live Control (including Matches)", () => {
    assert.deepEqual(activeIds(`${BASE}/control`), ["live"]);
    assert.deepEqual(activeIds(`${BASE}/control?focus=broadcast`), ["live"]);
    assert.deepEqual(activeIds(`${BASE}/broadcast`), ["live"]);
    assert.deepEqual(activeIds(`${BASE}/matches`), ["live"]);
    assert.deepEqual(activeIds(`${BASE}/matches/9/control`), ["live"]);
  });

  it("maps close-out routes onto Results", () => {
    assert.deepEqual(activeIds(`${BASE}/results`), ["results"]);
    assert.deepEqual(activeIds(`${BASE}/summary`), ["results"]);
    assert.deepEqual(activeIds(`${BASE}/analytics`), ["results"]);
  });

  it("activates Dashboard only on the hub path", () => {
    assert.deepEqual(activeIds(BASE), ["dashboard"]);
    assert.deepEqual(activeIds(`${BASE}/`), ["dashboard"]);
    assert.equal(activeIds(`${BASE}/branding`).includes("dashboard"), false);
  });

  it("never activates more than one primary item for a path", () => {
    const paths = [
      BASE,
      `${BASE}/branding`,
      `${BASE}/players`,
      `${BASE}/categories`,
      `${BASE}/fixtures`,
      `${BASE}/schedule`,
      `${BASE}/matches`,
      `${BASE}/matches/3/control`,
      `${BASE}/control`,
      `${BASE}/results`,
      `${BASE}/summary`,
      `${BASE}/analytics`,
      `${BASE}/courts`,
      `${BASE}/scorers`,
      `${BASE}/scoring-format`,
    ];
    for (const path of paths) {
      assert.ok(
        activeIds(path).length <= 1,
        `expected ≤1 active item for ${path}, got ${activeIds(path).join(",")}`,
      );
    }
  });
});
