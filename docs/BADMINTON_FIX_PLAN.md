# Badminton Fix Plan & Implementation Roadmap

**Companion to:** `docs/BADMINTON_RULES_AUDIT_REPORT.md`
**Status:** Investigation & verification only — **no code, schema, or migrations were changed** to produce this document.
**Method:** Every audit finding was independently re-verified by (a) re-reading the cited source with exact line numbers, (b) re-running the production engine (`cmdAwardPoint` → events → `replayBadmintonEvents`) against a **freshly written, independent** correct-BWF reference (Law 10.6: the serving pair changes service courts *only* when it wins; nobody else ever moves), and (c) mapping the surrounding persistence/sync/broadcast pipeline. The temporary verification harness was deleted after capture; the existing suite remains green (64/64).

---

## Table of Contents

1. [Section 1 — Audit Validation](#s1)
2. [Section 2 — Doubles Rotation Bug Investigation](#s2)
3. [Section 3 — Event-Sourcing Impact Analysis](#s3)
4. [Section 4 — Court-End Architecture Review](#s4)
5. [Section 5 — Sponsor-End Feature](#s5)
6. [Section 6 — Local Tournament Format Review](#s6)
7. [Section 7 — Implementation Plan (phased)](#s7)
8. [Section 8 — Final Recommendation](#s8)

---

<a name="s1"></a>

## SECTION 1 — AUDIT VALIDATION

Each finding from `BADMINTON_RULES_AUDIT_REPORT.md` is classified **CONFIRMED**, **PARTIALLY CONFIRMED**, or **NOT REPRODUCIBLE**, with exact evidence.

| # | Audit finding | Classification | Evidence (file:line) |
|---|---|---|---|
| F1 | **Doubles rotation bug** — `advanceDoublesServeAfterPoint` swaps the former serving pair on *every* rally (incl. when the receiving side wins), violating BWF Law 10.6 | **CONFIRMED** | `lib/badminton-core/src/scoring/doubles-court.ts:95-103` — the `if (winningSide === servingSide)` and `else` branches are **byte-for-byte identical** (both run `swapSidePartners(positionsForSide(court, servingSide))`). Dynamically reproduced (§2). |
| F2 | **Non-independent oracle** masks the bug; 64 unit tests + 205 sim sequences pass while wrong | **CONFIRMED** | `lib/badminton-core/src/scoring/bwf-doubles-oracle.ts:141` performs the **same unconditional** `exchangePartnersOnSide(court, servingSideBeforeRally)`; docstring `:12` misstates Law 10.3.4 as "former serving side partners swap." Suite re-run now: **64/64 pass**; `test-reports/doubles-rally-simulation-report.txt` reports **205/205**. |
| F3 | **Deciding-game end-change/interval off-by-one** — fires at 10 not 11 for a 21-pt game | **CONFIRMED** | `lib/badminton-core/src/reducer/state.ts:101` `sideChangeScore = Math.floor(pointsPerGame/2)` → 10. `umpire-assistance.ts:209` computes the *display* with `Math.ceil(...)` → 11 (trigger vs label contradiction). Reducer uses the floor value at `reducer/reducer.ts:121-125`. |
| F4 | **No court-end model**; `SIDE_CHANGED` is visual-only | **CONFIRMED** | `lib/badminton-core/src/reducer/reducer.ts:389-391` returns `state` unchanged for `SIDE_CHANGED`. No `end`/`CourtEnd` field anywhere in `types.ts`. DB has `badminton_courts` (`lib/db/src/schema/badminton.ts:104-131`) but **no** end identifiers. |
| F5 | **Format flexibility w/ no validation**; deuce/cap not derived from `pointsPerGame` | **CONFIRMED (stronger than reported)** | `types.ts:8-19` independent fields; `doubles-engine.ts:60-75` / `singles-engine.ts:14-21` `validateStart` only checks status/sides. **Additionally**: `matchFormatJson` is persisted (`badminton.ts` schema `:159-165`) but **never read at start** — `startBadmintonMatch` uses body `format ?? STANDARD_FORMAT` (`artifacts/api-server/src/lib/badminton-service.ts:450-487`), and the UI **hardcodes** `STANDARD_FORMAT` (`artifacts/auction-platform/src/components/badminton/doubles-pre-match-setup.tsx:389-391`). |
| F6 | **11-pt interval only modeled for the deciding game** | **CONFIRMED** | `umpire-assistance.ts:164-170` (`isIntervalThresholdReached` requires `isDecidingGame`); reducer only sets `intervalReached` for the deciding game (`reducer/reducer.ts:121-125`). |
| F7 | **`validateStart` doesn't check player indices / diagonal receiver** | **CONFIRMED** | `lib/badminton-core/src/scoring/doubles-engine.ts:60-75` checks only `matchStatus` and `firstServingSide !== firstReceivingSide`. |
| F8 | **Scoring spine correct** — rally scoring, 21 + win-by-2 + 30-cap, best-of-N, match completion, singles serving | **CONFIRMED** | `commands.ts:91` (+1 increments), `reducer/state.ts:61-79` (`isGameOver`), `:56` (`gamesNeededToWin`). Dynamically: complete game `21-19`, complete matches `2-0`, single-game/30/15 formats all terminate correctly (§2 / §6). |
| F9 | **§7 simulation magnitude** — "255/256 of 8-rally sequences diverge; earliest receiver error rally 1, server error rally 2" | **CONFIRMED (exactly)** | Reproduced independently: **255/256** at length 8, plus **63/64** (len 6) and **1023/1024** (len 10); earliest *any* divergence = rally **1**, earliest *server-identity* divergence = rally **2** (§2). |

**Refinement discovered during verification (not in the audit):** the audit's CRITICAL fix note says replay already "derives positions fresh." That is true **only for `POINT_WON`** (`doubles-replay-derive.ts:31-59` → `advanceDoublesServeAfterPoint`). The **`GAME_ENDED`** path **copies the stored payload** instead of re-deriving (`doubles-engine.ts:229-260` consumed by `reducer/reducer.ts:180-202`). Therefore a one-line fix to `advanceDoublesServeAfterPoint` corrects *in-game* rotation but **not** the cross-game first-server, which is baked into historic `GAME_ENDED` payloads. This materially affects the plan (see §3 and §7 Phase 1).

**Net:** 9/9 findings **CONFIRMED**; none partial or non-reproducible. The audit is accurate and, if anything, understated the format-wiring gap and the `GAME_ENDED` replay nuance.

---

<a name="s2"></a>

## SECTION 2 — DOUBLES ROTATION BUG INVESTIGATION

### Is the bug real? **Yes — definitively.**

The six required behaviours were verified against an independent BWF reference, using players **A1, A2** (left) and **B1, B2** (right); toss A→serve; first server A1 (right court) → first receiver B1.

| # | Behaviour | Verdict | Detail |
|---|---|---|---|
| 1 | Serving side wins rally | ✅ **Correct** | Same pair retains serve; server moves to alternate court (the win===serving branch is right). Sequence `01 all-A` (0 transfers) matches the reference for all 8 rallies. |
| 2 | Receiving side wins rally | ❌ **Wrong** | Engine swaps the **former serving (losing)** pair's courts; BWF says nobody moves. Reproduced in 21/22 explicit sequences. |
| 3 | Server selection | ❌ **Wrong after ≥1 transfer** | Parity formula is correct, but it reads corrupted positions. First wrong server at **rally 2** (e.g. seq `03 BAAAAAAA`: engine A1, BWF A2). |
| 4 | Receiver selection | ❌ **Wrong from first transfer** | Wrong at **rally 1** of the first change of serve (engine A1, BWF A2). |
| 5 | Court position updates | ❌ **Wrong** | Losing pair's `rightCourtPlayerIndex` flips though those players never moved — contradicts physical reality and the LED quadrant display. |
| 6 | Service transfer handling | ❌ **Wrong** | The *side* transfers correctly; the *players/courts* are corrupted (root cause: identical `if`/`else` at `doubles-court.ts:95-103`). |

### Step-by-step simulation — the simplest failure (seq `BAAA…`)

```
0-0  serving A1(right) → receiving B1(right)     A:[L=A2,R=A1]  B:[L=B2,R=B1]
Rally 1: B (receiving) WINS → 0-1
   ENGINE : server B2, receiver A1   A:[L=A1,R=A2]   ← A wrongly swapped
   BWF ✓  : server B2, receiver A2   A:[L=A2,R=A1]   ← nobody moves (Law 10.6)
Rally 2: A (receiving) WINS → 1-1
   ENGINE : server A1   ← WRONG PLAYER serves
   BWF ✓  : server A2
```

### Simulation coverage (≥20 sequences + transfers + edge cases + brute force)

* **22 explicit sequences** run through the real engine (streaks, strict alternation, blocks, mixed, a 16-rally alternation, and a "single transfer then hold"): **21/22 diverged** from correct BWF. The only match is the all-serving-streak (`01 all-A`, 0 transfers) — exactly the case that never triggers the bug.
* **Multiple service transfers:** sequences with up to 15 transfers (`22 long alt 16`) diverge from rally 2.
* **Edge — game boundary:** a 60-rally biased stream completed game 1 at `21-10` (scores/winner correct) while carrying corrupted in-game server/receiver — confirming **results are unaffected but officiating identity is wrong**.
* **Brute force (exhaustive):**

| Sequence length | Diverging / total | Earliest any divergence | Earliest server-identity divergence |
|---|---|---|---|
| 6 | **63 / 64** | rally 1 | rally 2 |
| 8 | **255 / 256** | rally 1 | rally 2 |
| 10 | **1023 / 1024** | rally 1 | rally 2 |

### First point of divergence & conclusion

* **First divergence:** the **receiver** is wrong on **rally 1** of the first change of serve; the **server identity** is wrong by **rally 2**.
* **Actual vs expected:** engine names the wrong partner as receiver/server and stores a physically impossible court layout for the side that lost serve.
* **Audit conclusions are correct.** The only added nuance (§1 refinement) is that the cross-game first-server lives in `GAME_ENDED` payloads and needs its own fix — the audit's single-line patch is necessary but not sufficient.

---

<a name="s3"></a>

## SECTION 3 — EVENT-SOURCING IMPACT ANALYSIS

How the candidate fix (correct `advanceDoublesServeAfterPoint`, plus the `GAME_ENDED` derive) propagates through the pipeline. Persistence facts come from `lib/db/src/schema/{scoring_events,badminton}.ts`, `artifacts/api-server/src/lib/badminton-service.ts`, and `lib/badminton-core/src/reducer`.

**Key architectural fact:** the only *authoritative* persisted facts are the primary event fields (`winningSide`, `doublesSetup`, etc.) in append-only `scoring_events.payload_json`. In-game doubles court state on `POINT_WON` is **derived on replay** (`doubles-replay-derive.ts`); the `doublesServe` snapshot stored in each `POINT_WON` payload is used **only for drift warnings** (`validateDoublesServeAgainstPayload`, `doubles-replay-derive.ts:79-92`), not as truth. Scores/games/winner depend solely on `winningSide` and are already correct — **so no match result changes**.

| Subsystem | Classification | Why |
|---|---|---|
| **Event store** (`scoring_events`) | **SAFE** | Append-only & immutable; primary facts preserved. Stored `POINT_WON.doublesServe` snapshots become advisory-only and are ignored by the derive-on-replay path. No rewrite needed for correctness. |
| **Replay engine — `POINT_WON`** | **SAFE (auto-corrected)** | `deriveDoublesServeAfterPointWon` → `advanceDoublesServeAfterPoint` (`doubles-court.ts:80`). Fixing that function corrects every full replay automatically. |
| **Replay engine — `GAME_ENDED`** | **REQUIRES MIGRATION (code)** | `applyGameEnded` **copies the stored payload** (`reducer/reducer.ts:180-202`, `doubles-engine.ts:229-260`) instead of re-deriving. Cross-game first server stays wrong for historic matches until the write-path (`buildGameEndedExtras`) is fixed **and** replay derives it (or payloads are backfilled). |
| **Historic matches** | **SAFE for results / REQUIRES MIGRATION for exact rotation** | Re-replaying a completed match yields corrected *in-game* server/receiver (good) and unchanged scores/winner; only the cross-game first-server inherits old `GAME_ENDED` data. Acceptable to leave historic display as-is, or backfill if exactness is needed. |
| **Match snapshots** (`badminton_match_details.state_snapshot_json`) | **REQUIRES MIGRATION** | Full materialized `BadmintonMatchState` (incl. `doublesServe`) written by `updateSnapshot` (`badminton-service.ts:347-364`) and **read-first** on the `awardPoint` hot path (`:500`). Stale court positions persist until snapshots are re-replayed/rewritten (one-off backfill job) or the read path is switched to replay. |
| **Cached states** (React Query) | **SAFE** | `use-badminton-match.ts` holds server state, guarded by `lastSequence` (`match-state-guard.ts:28-47`). A post-deploy refetch/cache-bust suffices. |
| **Live scoring** | **REQUIRES MIGRATION (operational)** | `awardPoint` builds on the snapshot base; in-flight live matches must be re-replayed to refresh their snapshot at deploy time, else one transitional divergence on the next point. |
| **Undo / redo** | **SAFE** | Always full-replays from facts (`undoLastPoint` re-replays entire log, `badminton-service.ts:530-566`; `resolveUndoEvents`, `reducer.ts:423-439`). |
| **Realtime sync (SSE)** | **SAFE** | Broadcast sends full state (`badminton-broadcast.ts:33-47`); sequence-guarded merge. Clients converge after deploy refresh. |
| **Broadcast overlays / LED / OBS** | **SAFE (corrective)** | All render from `state.doublesServe` via `display-utils.ts` (`broadcast-display.tsx`, `obs-overlays.tsx`, `doubles-court-display.tsx`). They will simply start showing the **correct** server/receiver once state refreshes. |

**Overall classification: SAFE for match results; REQUIRES MIGRATION for materialized snapshots + the `GAME_ENDED` cross-game path. Not a breaking change to scores, winners, or the event schema.** No `event_version` bump is strictly required for correctness (derive-on-replay wins), but bumping `POINT_WON`/`GAME_ENDED` to `eventVersion: 2` is recommended hygiene to mark the semantics change and silence legacy drift warnings.

---

<a name="s4"></a>

## SECTION 4 — COURT-END ARCHITECTURE REVIEW

### Goal

Introduce **stable physical end identifiers `END_1` / `END_2`**, decoupled from the `left|right` scoreboard axis, with configurable display names, consumable by every surface.

### Design principles

1. `left|right` stays **only** the scoreboard axis (unchanged everywhere).
2. `END_1`/`END_2` are **permanent** physical identities for a given court; a match records which scoreboard side starts at which end, and the **current** end per side is **derived** (flips after each game and at the deciding-game mid-game change). No second source of truth.
3. Display names + sponsor branding attach to the **end** (per court), not to a player/side.

### Engine model (in `lib/badminton-core`, ideally promoted to `scoring-core`)

```ts
export type CourtEnd = "END_1" | "END_2";

// Recorded once at match start (added to MATCH_STARTED payload; default left→END_1):
type EndAssignment = { leftStartsAt: CourtEnd };   // on BadmintonMatchState

// Pure derivation — no new event needed beyond the existing SIDE_CHANGED:
function endForSide(state, side: BadmintonSide): CourtEnd {
  const gamesCompleted = state.currentGame - 1;
  const decidingMidChange = isDecidingGame(...) && currentGame.intervalReached;
  const flips = gamesCompleted + (decidingMidChange ? 1 : 0);
  const leftEnd = flips % 2 === 0 ? state.endAssignment.leftStartsAt : otherEnd(...);
  return side === "left" ? leftEnd : otherEnd(leftEnd);
}
```

This finally lets the engine *express* "change ends after each game" (audit rule 15) using the **same** counter that the corrected `sideChangeScore` (rule 16) drives.

### Schema proposal

Reuse the existing `badminton_courts` registry (`lib/db/src/schema/badminton.ts:104-131`). Two options:

**Option A — dedicated table (recommended for branding/queryability):**

```sql
CREATE TABLE badminton_court_ends (
  id            SERIAL PRIMARY KEY,
  court_id      INTEGER NOT NULL REFERENCES badminton_courts(id) ON DELETE CASCADE,
  end_key       TEXT    NOT NULL CHECK (end_key IN ('END_1','END_2')),
  display_name  TEXT,                       -- "Pavilion End"
  sponsor_id    INTEGER REFERENCES master_sponsors(id),  -- optional link
  sponsor_name  TEXT,                       -- denormalized override, e.g. "CWP Detailers"
  sponsor_logo_url TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  meta_json     JSONB,
  UNIQUE (court_id, end_key)
);
```

**Option B — MVP, zero migration:** store under the **already-present** `badminton_courts.meta_json` (`:123`):

```jsonc
{ "ends": { "END_1": { "displayName": "Pavilion End", "sponsorName": "...", "sponsorLogoUrl": "..." },
            "END_2": { "displayName": "Parking End",   "sponsorName": "...", "sponsorLogoUrl": "..." } } }
```

Recommendation: **Option B for the first release** (no DDL, fastest), migrating to **Option A** if/when end-sponsorship needs its own management/reporting surface.

### Consumer support (all already read derived match state — see §3)

| Surface | Wiring |
|---|---|
| Scorer UI | `doubles-scorer-panel.tsx` — show "defending <End>" per side. |
| Umpire UI | `umpire-assistance-shell.tsx` — court-change prompt names the target end. |
| LED screens | `badminton-led-chrome.tsx` top strip — label each physical half by end name. |
| OBS overlays | `obs-overlays.tsx` — lower-third "Serving from the Pavilion End." |
| Public scoreboards | `broadcast-display.tsx` — end labels under each side. |
| Commentary | Stable `END_1`/`END_2` vocabulary independent of left/right. |
| Sponsor branding | §5. |

**Verdict: adopt `END_1`/`END_2`.** Superior to Top/Bottom or Left/Right because those are viewpoint-relative and already overloaded for scoreboard placement; ends must be a viewpoint-independent, persistent landmark.

---

<a name="s5"></a>

## SECTION 5 — SPONSOR-END FEATURE

### Concept

Per court, assign a sponsor to each physical end; the system **auto-renders** "`<Sponsor> End`" wherever an end is referenced.

```
Court 1
  END_1 Sponsor: CWP Detailers   →  "CWP Detailers End"
  END_2 Sponsor: Kia Motors      →  "Kia Motors End"
```

### Database design

Fits the §4 schema directly:

* **Option A:** `badminton_court_ends.sponsor_name` / `sponsor_logo_url` / `sponsor_id` (FK → existing `master_sponsors`, `lib/db/src/schema/master-sports.ts:31-46`).
* **Option B (MVP):** the `meta_json.ends.<END>.sponsorName/sponsorLogoUrl` shown above.

Display-name resolution (pure helper):

```ts
function endLabel(end: EndBranding): string {
  return end.sponsorName ? `${end.sponsorName} End` : (end.displayName ?? `${end} `);
}
```

This mirrors existing sponsor plumbing already in the codebase: per-side `sponsorName/sponsorLogoUrl` (`lib/badminton-core/src/types.ts:54-55,84-86`), tournament `scoring_settings_json.branding` (`artifacts/api-server/src/lib/master-sports/badminton.ts`), and `master_sponsors`/`master_teams.sponsor_id` — so Sponsor-End is a natural extension, not a new subsystem.

### API design

Extend the existing courts routes (`artifacts/api-server/src/routes/badminton.ts:527-602`, `GET/POST/PATCH/DELETE /courts`):

* `PATCH /tournaments/:id/badminton/courts/:courtId/ends` — body `{ END_1: {displayName, sponsorName, sponsorLogoUrl, sponsorId?}, END_2: {...} }`.
* Live match state exposes derived `endForSide(state, side)` (+ resolved label) so overlays need no extra fetch.

### UI design

* **Court management** (`artifacts/auction-platform/src/pages/badminton/courts.tsx`) — add an "Ends & Sponsors" section per court: two cards (END_1 / END_2), each with display name + sponsor name + logo upload (reuse existing logo upload + `master_sponsors` picker).
* **Broadcast/LED/OBS** (`broadcast-display.tsx`, `obs-overlays.tsx`, `badminton-led-chrome.tsx`, `score-board-sponsor-panel.tsx`) — read the derived current end per side and render "`<Sponsor> End`" + optional logo. These components already accept sponsor props, so wiring is additive.
* **Scorer/Umpire** — show end labels and name the target end at the court-change prompt.

### Display targets covered

Scoreboards ✅ · livestream graphics (OBS) ✅ · overlays ✅ · LED screens ✅ — all consume the same derived match state (§3), so a single derivation feeds every surface.

---

<a name="s6"></a>

## SECTION 6 — LOCAL TOURNAMENT FORMAT REVIEW

The engine is **fully parameterized** by `BadmintonMatchFormat` (`types.ts:8-19`). Support status (verified dynamically in §2/audit §4):

| Format | Status | Notes / evidence |
|---|---|---|
| **21-point** | ✅ Supported | `STANDARD_FORMAT`; 21-19 / deuce / 30-cap correct. |
| **30-point** | ✅ Supported | `{pointsPerGame:30, deuceAt:29, maxPoints:31}` → ends `30-27`. |
| **15-point** | ✅ Supported | `{15, deuceAt:14, maxPoints:21}` → deuce honored (`18-16`). |
| **11-point** | ⚠️ Partially supported | Works **only** if `deuceAt`/`maxPoints` are tuned (e.g. `deuceAt:10, maxPoints:15`). With naive `deuceAt:20,maxPoints:30` it ends at **11-10 (no win-by-2)**. |
| **Single game** | ✅ Supported | `totalGames:1` completes after one game. |
| **Best of 3** | ✅ Supported | `gamesNeededToWin=2`; verified 2-0. |
| **Best of 5** | ⚠️ Partially supported | `BEST_OF_5_FORMAT` exists (`types.ts:29-35`) but is **referenced nowhere** in app/API; engine handles it (`gamesNeededToWin=3`). |
| **Custom formats** | ⚠️ Partially supported | Any `pointsPerGame` works **iff** the caller sets consistent `deuceAt`/`maxPoints`; plus the deciding-game end-change off-by-one (F3) affects odd points. |

**Cross-cutting gaps:** (1) deuce/cap are independent fields with **no validation** and are **not derived** from `pointsPerGame`; (2) stored `matchFormatJson` is **never read at start** and the UI **hardcodes** `STANDARD_FORMAT` (§1 F5) — so non-standard formats are effectively unreachable from the product today.

### Recommended preset templates

Define named presets (TS constants now; optional `badminton_format_presets` table later) and wire category → match-create → start:

| Preset | totalGames | pointsPerGame | deuceAt | maxPoints | midGameSideChange |
|---|---|---|---|---|---|
| `BWF_21_BO3` (default) | 3 | 21 | 20 | 30 | true |
| `BWF_21_BO5` | 5 | 21 | 20 | 30 | true |
| `FAST_11_BO3` | 3 | 11 | 10 | 15 | true |
| `FAST_11_BO5` | 5 | 11 | 10 | 15 | true |
| `CLASSIC_15_BO3` | 3 | 15 | 14 | 21 | true |
| `SINGLE_21` | 1 | 21 | 20 | 30 | false |
| `SINGLE_30` | 1 | 30 | 29 | 31 | false |
| `KNOCKOUT_15` | 1 | 15 | 14 | 21 | false |

Plus a `normalizeFormat()` / validator enforcing: `totalGames` odd & ≥1; `1 ≤ deuceAt ≤ pointsPerGame`; `maxPoints ≥ pointsPerGame`; default `deuceAt = pointsPerGame − 1`, `maxPoints = round(pointsPerGame × 1.5) − ?` sane cap. Reject inconsistent combinations at `validateStart` and the API create/start handlers.

---

<a name="s7"></a>

## SECTION 7 — IMPLEMENTATION PLAN (PHASED)

> No code is changed by this document. Each phase below is a proposal with files, complexity, risks, and tests.

### Phase 1 — Critical bug fixes (BWF doubles rotation + end-change off-by-one)

**Files impacted**
* `lib/badminton-core/src/scoring/doubles-court.ts` — make the swap conditional in `advanceDoublesServeAfterPoint` (`:95-103`); review `nextGameServerAfterGameEnd` (`:128-140`) and `buildNextGameCourtPositions`.
* `lib/badminton-core/src/scoring/doubles-engine.ts` — `buildGameEndedExtras`/`applyGameEnded` (`:134-182,229-260`) so the **cross-game** first server/court is correct and ideally **derived on replay**.
* `lib/badminton-core/src/scoring/bwf-doubles-oracle.ts` — rewrite `bwfReferenceAfterRally` (`:129-141`) to the **correct** Law 10.6 (conditional swap) and fix docstring `:12` (so tests can catch regressions).
* `lib/badminton-core/src/reducer/state.ts:101` — `sideChangeScore = Math.ceil(pointsPerGame/2)`; align `umpire-assistance.ts:208-209`.
* Update fixtures: `doubles-engine.test.ts`, `doubles-rally-simulation.test.ts`, `grade-a-*` reports.
* Operational: one-off **re-replay job** to rewrite `badminton_match_details.state_snapshot_json` for live/recent matches; refresh clients.

**Complexity:** Engine logic **Low** (small, surgical); event-sourcing rollout **Medium** (snapshot backfill + `GAME_ENDED` derive + optional `eventVersion: 2`).
**Risks:** snapshot/replay divergence for in-flight live matches at deploy (mitigate with the re-replay job, §3); historic `GAME_ENDED` cross-game server stays old unless backfilled (acceptable — results unchanged).
**Testing:** port the independent reference (§2) into the repo as the real oracle; assert engine == correct-BWF over exhaustive ≤10-rally brute force + full game/match; deciding-game end-change at exactly 11; undo/replay determinism; realtime-sync test.

### Phase 2 — Court-End architecture (`END_1`/`END_2`)

**Files impacted**
* `lib/badminton-core` (or new `scoring-core` module): `CourtEnd` type, `endAssignment` on state, `endForSide` derivation, optional `endAssignment` field on `MATCH_STARTED` payload (`events/badminton.ts`).
* DB: **Option B** uses existing `badminton_courts.meta_json` (no DDL); **Option A** adds `badminton_court_ends`.
* API: courts routes (`routes/badminton.ts:527-602`); expose derived end per side in match state.
* UI: `doubles-court-display.tsx`, `broadcast-display.tsx`, `obs-overlays.tsx`, `badminton-led-chrome.tsx`, `umpire-assistance-shell.tsx`.

**Complexity:** **Medium** (pure derivation + display wiring; no scoring-math change).
**Risks:** Low — additive; must keep `left/right` semantics untouched.
**Testing:** unit tests for `endForSide` across game boundaries + deciding-game mid-change; snapshot tests of overlay labels.

### Phase 3 — Sponsor-End feature

**Files impacted**
* DB: `badminton_court_ends.sponsor_*` (Option A) or `meta_json.ends` (Option B); reuse `master_sponsors`.
* API: `PATCH .../courts/:courtId/ends`; include resolved end labels in state.
* UI: `pages/badminton/courts.tsx` (ends & sponsor editor), broadcast/LED/OBS render "`<Sponsor> End`", reuse `score-board-sponsor-panel.tsx`.

**Complexity:** **Medium** (CRUD + display; leans on existing sponsor plumbing).
**Risks:** Low — purely presentational; depends on Phase 2.
**Testing:** label resolution (`"CWP Detailers End"`); fallback to display name; overlay/LED rendering snapshots.

### Phase 4 — Tournament format presets

**Files impacted**
* `lib/badminton-core/src/types.ts` — preset constants + `normalizeFormat()`/validator.
* Engine: enforce validation in `validateStart` (`doubles-engine.ts`, `singles-engine.ts`).
* API: read `matchFormatJson` at start (`badminton-service.ts:450-487`), validate on create/start (`routes/badminton.ts:1002-1010,1156-1277`), category default → match → start chain.
* UI: format/preset picker in `doubles-pre-match-setup.tsx` / `categories.tsx` / `matches.tsx` (replace hardcoded `STANDARD_FORMAT`).

**Complexity:** **Medium** (engine Low; wiring the create→start chain + UI Medium).
**Risks:** Low–Medium — must default safely to `BWF_21_BO3`; validate to prevent the 11-point deuce footgun.
**Testing:** each preset completes correctly (incl. 11-pt win-by-2 + cap); validator rejects inconsistent combos; deciding-game change at `ceil(pts/2)` per preset.

**Recommended order:** **Phase 1 → 2 → 3 → 4.** Phase 1 is correctness-critical and independent. Phase 3 depends on Phase 2. Phase 4 is independent of 1–3 and can run in parallel if resourced.

---

<a name="s8"></a>

## SECTION 8 — FINAL RECOMMENDATION

1. **Is the doubles bug definitely real?** **Yes — definitively.** Identical `if`/`else` branches at `doubles-court.ts:95-103` swap the losing pair on every service transfer (violating BWF Law 10.6). Independently reproduced: wrong receiver from **rally 1**, wrong server from **rally 2**, and **255/256** (len 8) / **1023/1024** (len 10) of all rally patterns diverge from correct BWF. It is masked by a non-independent oracle (`bwf-doubles-oracle.ts:141`) that shares the same mistake.

2. **Is a fix required before production?** **Yes for doubles/mixed-doubles.** The engine names the wrong server/receiver in essentially every doubles rally involving a change of serve — unacceptable for officiating. **Singles and the scoring/game/match spine are correct and production-ready today** (results, scores, winners are unaffected by the bug). Match **results are not corrupted**; the defect is in service/court identity and display.

3. **Should `END_1`/`END_2` be implemented?** **Yes.** It is the correct, viewpoint-independent model for physical ends, it unlocks the missing "change ends" rules (audit 15/16), and it is the natural home for sponsor branding. Implement it as a derived overlay on the existing `left/right` axis (Phase 2) — low risk, no scoring-math change.

4. **Should Sponsor-End branding be implemented?** **Yes**, after Phase 2. It reuses existing sponsor plumbing (`master_sponsors`, per-side sponsor fields, branding settings) and existing broadcast/LED/OBS surfaces; the MVP needs **zero schema migration** (store under `badminton_courts.meta_json`).

5. **Recommended implementation order:**
   1. **Phase 1 — Critical fixes** (doubles rotation Law 10.6 + correct oracle + `GAME_ENDED` cross-game + `ceil` end-change), with a snapshot re-replay job. *Blocking for doubles go-live.*
   2. **Phase 2 — Court-End (`END_1`/`END_2`)** derived model + display wiring.
   3. **Phase 3 — Sponsor-End** branding on top of Phase 2.
   4. **Phase 4 — Format presets + validation** (can proceed in parallel; independent of 1–3).

**Event-sourcing safety summary:** the fix is **SAFE** for the append-only event store, match results, undo, and realtime sync; it **REQUIRES MIGRATION** only for materialized `state_snapshot_json` (re-replay backfill) and the `GAME_ENDED` cross-game derivation. **Not a breaking change** to scores, the event schema, or historic results.

---

### Appendix — Verification reproduction

* Independent correct-BWF reference run against the production engine via `cmdAwardPoint` → `replayBadmintonEvents` (temporary harness, since deleted; **no source changed**). Existing suite re-run: **64/64 passing** (`cd lib/badminton-core && pnpm exec vitest run`); bundled `test-reports/doubles-rally-simulation-report.txt` reports **205/205** against the same-buggy oracle (illustrating the false-confidence trap).
* Pipeline mapping evidence: `lib/db/src/schema/scoring_events.ts`, `lib/db/src/schema/badminton.ts:341-384`, `artifacts/api-server/src/lib/badminton-service.ts` (`loadCurrentMatchState:257-280`, `updateSnapshot:347-364`, `awardPoint:490-527`, `undoLastPoint:530-566`), `artifacts/api-server/src/lib/badminton-broadcast.ts:33-47`, `artifacts/auction-platform/src/hooks/use-badminton-match.ts`.
* Core references: `lib/badminton-core/src/scoring/doubles-court.ts:80-140`, `doubles-engine.ts:89-260`, `doubles-replay-derive.ts:31-92`, `bwf-doubles-oracle.ts:12,129-141`, `reducer/state.ts:56-103`, `reducer/reducer.ts:121-202,389-391`, `commands.ts:73-262`, `umpire-assistance.ts:164-209`, `types.ts:8-35`.
