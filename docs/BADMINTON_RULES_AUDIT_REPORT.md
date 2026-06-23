# Badminton Rules & Architecture Audit Report

**Subject:** `@workspace/badminton-core` scoring engine
**Scope:** BWF compliance (singles & doubles), illegal-state analysis, local-tournament flexibility, court-end model, multi-sport reuse, rally simulations.
**Method:** Static review of the event-sourced scoring engine + dynamic verification. The production engine (`cmdAwardPoint` → events → `replayBadmintonEvents`) was executed and cross-checked against an **independent, correct BWF reference** written specifically for this audit (separate code path from the engine and from the repo's own oracle).

> **Headline finding:** The match/game/scoring layer (rally scoring, 21-point + win-by-2 + 30-cap, best-of-N, match completion) is **correct**. However the **doubles service/court-rotation engine is not BWF-compliant**: it rotates the **wrong** pair after a service transfer, producing the wrong receiver (and, within 1–2 more rallies, the wrong *server*) in essentially every doubles rally that involves a change of serve. The repository's own "independent oracle" encodes the **same** mistake, so all 64 unit tests and 205 simulation sequences pass while the behaviour is wrong — a false-confidence trap. A second, lower-severity bug makes the deciding-game end-change/interval fire one point too early (10 instead of 11 for a 21-point game).

---

## Table of Contents

1. [Section 1 — Current Implementation Review](#section-1)
2. [Section 2 — BWF Compliance Audit](#section-2)
3. [Section 3 — Illegal State Analysis](#section-3)
4. [Section 4 — Local Tournament Flexibility Audit](#section-4)
5. [Section 5 — Court-End Model Review](#section-5)
6. [Section 6 — Multi-Sport Future Review](#section-6)
7. [Section 7 — Rally Simulation Tests](#section-7)
8. [Section 8 — Recommended Changes](#section-8)
9. [Section 9 — Final Verdict](#section-9)

---

<a name="section-1"></a>

## SECTION 1 — CURRENT IMPLEMENTATION REVIEW

The engine is an **event-sourced reducer**. Commands (`lib/badminton-core/src/commands.ts`) validate an action and emit immutable events; `reduceBadminton` / `replayBadmintonEvents` (`lib/badminton-core/src/reducer/reducer.ts`) fold events into `BadmintonMatchState`. Per-sport service logic is delegated to a `BadmintonScoringEngine` strategy (singles / doubles / mixed-doubles) resolved by `getScoringEngine` (`lib/badminton-core/src/scoring/index.ts`).

```
 cmdAwardPoint(state, winner)            reduceBadminton(state, event)
        │  validates legality                  │  pure fold
        │  computes gameOver / matchOver        ▼
        ▼                                  BadmintonMatchState
 [POINT_WON, (GAME_ENDED), (MATCH_ENDED)] ───────────────►  (replayable)
        │
        └── engine.buildPointWonPayload(): doubles serve/court math
```

### 1.1 Match state model

`BadmintonMatchState` (`lib/badminton-core/src/types.ts:155`) holds: `matchStatus` (`scheduled|live|paused|completed|walkover|retired|disqualified|abandoned`), `format`, both `…Side` info blocks, `gamesLeft/gamesRight`, `currentGame`, current `leftScore/rightScore`, the `games[]` array, `servingSide`, optional `doublesServe`, `inInterval`, `activeTimeout`, `isPaused`, `lastSequence` (monotonic version for realtime sync — guarded by `match-state-guard.ts`), plus result/notes metadata. Initial state is built by `createInitialBadmintonState` (`reducer/state.ts:9`).

### 1.2 Court state model

Court state exists **only for doubles/mixed** via `DoublesServeState` (`lib/badminton-core/src/scoring/types.ts:28`). Court geometry is compressed to a single bit per side:

```ts
type SideCourtPositions = { rightCourtPlayerIndex: 0 | 1 };   // who stands in the RIGHT service court
type DoublesCourtPositionsState = { left: SideCourtPositions; right: SideCourtPositions };
```

The left-court occupant is derived as the complement (`leftCourtPlayerIndex`, `doubles-court.ts:4`). **Singles tracks no court at all** — only `servingSide`.

```
        LEFT service court        RIGHT service court
TeamA   leftIdx(left)             courtPositions.left.rightCourtPlayerIndex
TeamB   leftIdx(right)            courtPositions.right.rightCourtPlayerIndex
```

### 1.3 Service rotation logic

* **Server for a given score** (`serverIndexForScore`, `doubles-court.ts:13`): even side-score ⇒ right-court player serves; odd ⇒ left-court player. ✅ matches BWF Law 10.5.
* **Receiver** (`receiverIndexForServer`, `doubles-court.ts:22`): diagonally opposite — server in right ⇒ receiver is opponent's right-court player; server in left ⇒ opponent's left-court player. ✅ matches Law 10.6 *given correct positions*.
* **Post-rally transition** (`advanceDoublesServeAfterPoint`, `doubles-court.ts:80`): increments score, mutates court positions, then recomputes server/receiver. **This function contains the central bug — see §1.4 and §2.**
* **Singles** (`singles-engine.ts`): `servingSide = winningSide` every rally (`nextServingSide`, `reducer/state.ts:51`). ✅ correct for rally scoring.

### 1.4 Player position logic — the defect

```ts
// doubles-court.ts:95–103  (verbatim)
if (winningSide === servingSide) {
  // Serving side won — swap partners on serving side only.
  const swapped = swapSidePartners(positionsForSide(court, servingSide));
  court = updateSidePositions(court, servingSide, swapped);
} else {
  // Receiving side won — swap partners on the side that was serving.
  const swapped = swapSidePartners(positionsForSide(court, servingSide));
  court = updateSidePositions(court, servingSide, swapped);
}
```

Both branches are **identical**: the side that served the rally is swapped **regardless of who won the rally**. BWF **Law 10.6** states: *"players change their service court only when their side has won a point while its side was serving."* Therefore:

* Serving side **wins** ⇒ that pair swaps courts (same server, alternate court). ✅ the engine does this.
* Receiving side **wins** ⇒ **nobody changes service court**; the rally winner becomes server from wherever they already stand. ❌ the engine *still* swaps the (losing) former-serving pair.

Consequence: after any change of serve, the losing pair's court bit is flipped incorrectly. This immediately corrupts the **receiver** (and the losing pair's display positions), and as soon as that pair serves again it corrupts the **server** identity. Quantified in [§7](#section-7): **255 of 256** possible 8-rally doubles sequences diverge from correct BWF.

### 1.5 End-change logic

* **After each game:** *Not modelled.* There is no "ends" state. `SIDE_CHANGED` is explicitly treated as visual-only — `reduceBadminton` returns `state` unchanged for it (`reducer/reducer.ts:389–391`).
* **Deciding-game mid-game change ("11"):** `cmdStartInterval` / `cmdAcknowledgeCourtChange` (`commands.ts:200,239`) emit interval/side-change events, gated to the deciding game. The trigger score is `sideChangeScore = Math.floor(pointsPerGame / 2)` (`reducer/state.ts:101`) ⇒ **10** for a 21-point game. BWF requires **11**. `umpire-assistance.ts:208–209` even computes the *display* string with `Math.ceil(...)` = **11**, so the banner shows "INTERVAL DUE (11 POINTS)" while the trigger fires at 10 — an internal contradiction confirming the off-by-one.

### 1.6 Set (game) transition logic

`applyGameEnded` (`reducer/reducer.ts:143`): increments `gamesLeft/Right`, marks the game completed, and if `gamesNeededToWin = ceil(totalGames/2)` is reached, ends the match; otherwise opens the next game with the next server from `engine.applyGameEnded`. Doubles next-game first server is derived from the last rally of the previous game (`nextGameServerAfterGameEnd`, `doubles-court.ts:128`). ✅ structurally correct (server identity inherits the §1.4 corruption, but the *side* is correct).

### 1.7 Scoring engine

`cmdAwardPoint` (`commands.ts:73`) computes the new scores, then `isGameOver` (`reducer/state.ts:61`):

```
maxScore < pointsPerGame                       → not over
both sides ≥ deuceAt                            → over iff (lead ≥ 2) OR maxScore ≥ maxPoints
otherwise                                       → over iff maxScore ≥ pointsPerGame
```

For the standard `{pointsPerGame:21, deuceAt:20, maxPoints:30}` this yields exact BWF behaviour: 21–19 ends, 20-all goes to deuce, win-by-2, hard cap 30–29. ✅

---

<a name="section-2"></a>

## SECTION 2 — BWF COMPLIANCE AUDIT

Verified against the BWF Laws of Badminton (Law 7 scoring, Law 10 doubles service). Verdicts use the **standard format** unless noted; doubles items are also dynamically verified in [§7](#section-7).

| # | Rule | Verdict | Explanation |
|---|------|---------|-------------|
| 1 | Rally point scoring | **PASS** | Every rally scores a point for the winner (`cmdAwardPoint`, `commands.ts:91`). No service-only scoring. |
| 2 | Best-of-3 games | **PASS** | `totalGames:3`, `gamesNeededToWin=ceil(3/2)=2` (`reducer/state.ts:56`). Match ends at 2 games (verified §7). |
| 3 | 21-point game | **PASS** | `isGameOver` returns true at 21 when leader < deuce zone (`reducer/state.ts:71,78`). |
| 4 | Win-by-2 | **PASS** | `minScore ≥ deuceAt ⇒ maxScore-minScore ≥ 2` (`reducer/state.ts:74-75`). 20-all → must lead by 2. |
| 5 | 30-point cap | **PASS** | `|| maxScore >= maxPoints` ends at 30 regardless of margin (`reducer/state.ts:75`). 29-all → 30 wins. |
| 6 | Initial server selection | **PASS** | `doublesSetup.firstServerPlayerIndex` honored; placed in right court at 0-0 (`buildInitialCourtPositions`, `doubles-court.ts:33`). |
| 7 | Initial receiver selection | **PASS** | `firstReceiverPlayerIndex` honored, placed diagonally (right court of receiving side) at 0-0. |
| 8 | Even-score serving-court | **PASS** | Even ⇒ right court (`serverIndexForScore`, `doubles-court.ts:13-18`). Holds when positions are correct. |
| 9 | Odd-score serving-court | **PASS** | Odd ⇒ left court. Same function. |
| 10 | Serving side wins rally | **PASS** | Same pair retains serve, server swaps to alternate court (`advanceDoublesServeAfterPoint`, win===serving branch). Verified §7 (sequence S1). |
| 11 | Receiving side wins rally | **FAIL** | Service correctly transfers *side*, **but** the engine wrongly swaps the former serving pair's court (`doubles-court.ts:99-103`), violating **Law 10.6** ("players do not change service courts unless they win while serving"). |
| 12 | Doubles position rotation | **FAIL** | Direct consequence of #11: the losing pair's positions flip every transfer. 255/256 eight-rally sequences diverge from correct BWF (§7). |
| 13 | Server determination | **PARTIAL → FAIL after a transfer** | Correct while one side holds serve (parity formula is right). After ≥1 change of serve, the corrupted positions yield the **wrong server**; earliest server-identity error at **rally #2** (§7, S2). |
| 14 | Receiver determination | **FAIL** | Wrong from the **first** change of serve (rally #1, §7, S2/S6/S8/S10): engine names A1 where BWF requires A2. |
| 15 | End change after each game | **FAIL (not implemented)** | No ends state; `SIDE_CHANGED` is visual-only (`reducer/reducer.ts:389`). The engine never represents "players changed ends between games." |
| 16 | End change at 11 in deciding game | **PARTIAL** | Mechanism exists but trigger is off-by-one: `floor(21/2)=10` (`reducer/state.ts:101`) instead of 11. Fires one rally early; UI label says 11 (`umpire-assistance.ts:209`). |
| 17 | Match completion | **PASS** | First to `ceil(totalGames/2)` games ends the match with `MATCH_ENDED` + result summary (`commands.ts:144-162`); verified §7. |

**Compliance summary:** Singles and the match/scoring spine are compliant. Doubles **service-court rotation** (rules 11–14) is broken; ends handling (15–16) is missing/off-by-one.

---

<a name="section-3"></a>

## SECTION 3 — ILLEGAL STATE ANALYSIS

> "Illegal" = a state that cannot occur in a correctly-officiated BWF match.

| Illegal state | Can the engine produce it? | How / failure case |
|---|---|---|
| **Illegal server** | **YES** | After any change of serve, the wrongly-swapped court bit causes the parity formula to select the partner who is *not* actually due to serve. First occurrence at **rally #2** (§7). The *side* is always legal; the *player* is not. |
| **Illegal receiver** | **YES** | Receiver is computed diagonally from corrupted positions; wrong from **rally #1** of the first transfer. |
| **Illegal court position** | **YES** | The losing pair's `rightCourtPlayerIndex` is flipped on a transfer though those players never moved on court — the model contradicts physical reality and the LED/quadrant display (`display-utils.ts:getCourtQuadrantPlayers`). |
| **Illegal rotation** | **YES** | Rule 12 — the "always swap the serving side" rotation is not a legal BWF rotation once a transfer occurs. |
| **Illegal end assignment** | **N/A / latent** | Ends are not modelled, so no *wrong* end can be stored — but the deciding-game change fires at 10 not 11, and inter-game changes are absent (a different class of defect). |
| **Illegal score state** | **NO** | Scores only increment by 1 (`commands.ts:91`); `isGameOver` halts further scoring; `gamesNeeded` caps games. No path to negative, skipped, or over-cap scores for a *consistent* format. |
| **Sequence/version regression** | **NO** | `applyMatchStateIfNewer` rejects stale/duplicate snapshots (`match-state-guard.ts:28`). |
| **Scoring while paused/finished** | **NO** | `cmdAwardPoint` guards `matchStatus==="live"` and `!isPaused` (`commands.ts:78-83`). |

**Why existing tests miss the server/receiver/rotation failures:** the repo's "independent" oracle `bwfReferenceAfterRally` (`bwf-doubles-oracle.ts:129-141`) performs the **same unconditional** `exchangePartnersOnSide(court, servingSideBeforeRally)` and its docstring (line 12) misstates Law 10.3.4 as *"former serving side partners swap."* The simulation test (`doubles-rally-simulation.test.ts`) then asserts engine == oracle and that each snapshot is *internally* consistent (`validateBwfDoublesSnapshot`). Both the engine and its checker share the bug, so 205/205 sequences and 64/64 unit tests pass while being wrong. **The oracle is not independent of the defect.**

Additional latent risks (not currently reachable from the happy-path UI, but unguarded):

* `validateStart` (doubles) only checks `firstServingSide !== firstReceivingSide` (`doubles-engine.ts:71`). It does **not** validate that player indices are `0|1` or that the receiver is diagonal — a malformed payload from a non-TS caller could seed an inconsistent court.
* No validation that a `format` is internally consistent (`deuceAt ≤ pointsPerGame ≤ maxPoints`, `totalGames` odd). See §4.

---

<a name="section-4"></a>

## SECTION 4 — LOCAL TOURNAMENT FLEXIBILITY AUDIT

Format is fully parameterized (`BadmintonMatchFormat`, `types.ts:8`): `totalGames`, `pointsPerGame`, `deuceAt`, `maxPoints`, `midGameSideChange`. The match/scoring spine honors all of them. Results below are from running each format through the **real engine** ([§7 harness](#section-7)).

| Format | Result | Notes |
|---|---|---|
| **A. Standard BWF — 21, Best of 3** | ✅ **Works correctly** | `sets=[21-17, 21-16]`, completes 2–0. Win-by-2 + 30-cap honored. |
| **B. Fast Match — 11, Best of 3** | ⚠️ **Works with limitations** | Only correct if `deuceAt`/`maxPoints` are **tuned** to the 11-point game. With the common copy-paste mistake (`deuceAt:20, maxPoints:30`) the game **ends at exactly 11 with no win-by-2** (probe produced **11-10 → completed**). With `deuceAt:10, maxPoints:15` deuce works (`12-10`). No guard enforces consistency. |
| **C. Single Game — 21** | ✅ **Works correctly** | `totalGames:1` → `sets=[21-13]`, completes 1–0. |
| **D. Single Game — 30** | ✅ **Works correctly** | `{pointsPerGame:30, deuceAt:29, maxPoints:31}` → `sets=[30-27]`. |
| **E. Direct Knockout — 15** | ✅ **Works correctly** | `{pointsPerGame:15, deuceAt:14, maxPoints:21}` → `sets=[18-16]` (deuce honored). |
| **F. Custom points per game** | ⚠️ **Works with limitations** | Arbitrary `pointsPerGame` works **iff** the caller also sets consistent `deuceAt`/`maxPoints`. Two cross-cutting caveats apply to *any* non-standard config: (1) the deciding-game end-change trigger is `floor(pts/2)` not `ceil(pts/2)` (§2 #16); (2) win-by-2/cap depend entirely on `deuceAt`/`maxPoints`. |

**Conclusion:** Flexibility is genuinely good for single-game and standard formats. The sharp edge is that **deuce/cap are not derived from `pointsPerGame`** — they are independent fields with **no validation**, so "Fast 11" and "custom" formats silently misbehave unless every field is set correctly. Recommend a `normalizeFormat()`/validator that derives sane `deuceAt = pointsPerGame - 1` and `maxPoints` defaults and rejects inconsistent combos.

---

<a name="section-5"></a>

## SECTION 5 — COURT-END MODEL REVIEW

### Current state

There is **no court-end model**. The codebase conflates two distinct concepts into one `left|right` axis:

* **Scoreboard side** (`BadmintonSide = "left"|"right"`) — which competitor is rendered on the left/right of the scoreboard. This is *fixed* for the whole match and used everywhere (serving side, scores, court positions).
* **Physical end** — which physical half of the hall a pair currently occupies. This **changes** after game 1, after game 2, and at 11 in the deciding game.

`SIDE_CHANGED` exists as an event but is visual-only (`reducer/reducer.ts:389`) and carries ad-hoc fields `leftSide:"original_right"` (`commands.ts:250`). Nothing persists "which end is which," so broadcast/LED/commentary cannot reliably state which end a player is defending.

### Recommendation: **YES — introduce permanent `END_1` / `END_2` identifiers**

Model ends as **stable physical identifiers**, decoupled from scoreboard side, with a per-game/where-relevant mapping:

```ts
type CourtEnd = "END_1" | "END_2";
type EndBranding = { end: CourtEnd; name: string; sponsorName?: string; sponsorLogoUrl?: string };
// e.g. { END_1: "ABC Cement End", END_2: "CWP Detailers End" }

// derived, not stored as a 2nd source of truth:
function endForSide(state, side): CourtEnd      // flips on each game + deciding-game 11
```

This cleanly supports every consumer the question lists:

| Consumer | Benefit of `END_1/END_2` |
|---|---|
| End changes | A single derivation flips the side→end mapping after each game and at the deciding-game interval — currently impossible to express. |
| Broadcast overlays | Lower-thirds can show "Serving from the ABC Cement End." |
| LED displays | Big-screen can label each physical half with its sponsor name persistently. |
| Scoring screens | Operator/umpire see the correct defending end after a change. |
| Commentary references | Stable "END_1/END_2" vocabulary independent of who is left/right on the board. |
| Sponsor branding | Sponsorship attaches to the **physical end**, exactly the `ABC Cement End` / `CWP Detailers End` use-case. |

### Superior to Top/Bottom or Left/Right?

**Yes.** `Top/Bottom` and `Left/Right` are **relative to a rendering or camera viewpoint** and are reused for scoreboard placement, so they cannot represent a *persistent* physical landmark that survives ends changes. `END_1/END_2`:

* are **viewpoint-independent** stable identities (sponsor branding sticks to a physical end across the whole match);
* **decouple** the unchanging scoreboard axis from the changing physical-end axis (the conflation is the root of the missing rules 15/16);
* map naturally to a derived `side ↔ end` function that finally lets the engine express "change ends."

**Recommendation: adopt `END_1`/`END_2` as permanent identifiers, keep `left/right` strictly as the scoreboard axis, and derive the mapping.**

---

<a name="section-6"></a>

## SECTION 6 — MULTI-SPORT FUTURE REVIEW

The repo already has a multi-sport scoring substrate (`lib/scoring-core` with cricket + an event envelope/projector, and `scoring_*` tables in `scripts/src/migrate.ts`). A shared **court-end** abstraction is reusable across net sports:

| Sport | Reuse of `END_1/END_2` | Sport-specific layer |
|---|---|---|
| **Badminton** | Ends + change-of-ends (per game, and at 11 in G3). | Doubles service-court rotation (the part to fix). |
| **Tennis** | Ends change on odd-game totals + each set; "End"/changeover overlays. | Game/set/tiebreak scoring; deuce/ad; serve alternates by game not rally. |
| **Pickleball** | Ends + change-of-ends; sponsor-branded ends identical use-case. | Side-out/rally scoring variants; doubles server #1/#2 sequence. |
| **Volleyball** | Court ends + switch each set; rotation overlays. | 6-player rotation, libero, set-to-25/15 with switch at 8. |

**Recommended reusable architecture:**

```
scoring-core (shared)
 ├─ event envelope + sequence/replay/undo            (exists)
 ├─ CourtEnd model: END_1|END_2 + branding + side↔end mapping   (NEW, shared)
 ├─ FormatSpec + validator (pointsPerGame/deuce/cap/games)      (generalize badminton format)
 └─ per-sport engine (strategy):
      ├─ badminton  (rally scoring + service-court rotation)
      ├─ tennis     (game/set/tiebreak)
      ├─ pickleball (side-out + server sequence)
      └─ volleyball (rotation + set switch)
```

Promote the `BadmintonScoringEngine` strategy pattern (`scoring/types.ts:90`) and the `END_1/END_2` model into `scoring-core` so each sport implements only its scoring/rotation rules while ends, branding, replay, undo, and sequence-guarding are shared. The current `left/right`-only model is **not** a sound base for tennis/volleyball, which is another reason to introduce ends now.

---

<a name="section-7"></a>

## SECTION 7 — RALLY SIMULATION TESTS

All results below were produced by executing the **production engine** (`cmdAwardPoint` → events → `replayBadmintonEvents`) and comparing against an **independent correct BWF reference** (swap the serving side **only** when it wins; never on a transfer). Setup: Team A (left) = {A1,A2}, Team B (right) = {B1,B2}; toss A → serve; first server A1 (right court) → receiver B1.

> The repo test suite (`pnpm exec vitest run` in `lib/badminton-core`) reports **64/64 passing** and the bundled simulation reports **205/205 sequences passing** — because they validate against the same-buggy oracle. The independent reference below tells the true story.

### 7.1 Ten rally sequences (within a single game)

| # | Winners | Result vs correct BWF |
|---|---------|------------------------|
| S1 | A A A A A A A A | ✅ **matches** (serving side never loses serve → no transfer → no bug triggered) |
| S2 | B A A A A A | ❌ diverges at **rally 1**: engine receiver **A1** vs BWF **A2**; server wrong from **rally 2** |
| S3 | A B A B A B | ❌ diverges at **rally 2**: receiver A2 vs A1; server wrong from rally 3 |
| S4 | A A B B A B | ❌ diverges at **rally 3**; server wrong from rally 5 |
| S5 | A B B A A B | ❌ diverges at **rally 2**; server wrong from rally 4 |
| S6 | B B A A B A | ❌ diverges at **rally 1**; server wrong from rally 3 |
| S7 | A A A B B B | ❌ diverges at **rally 4** |
| S8 | B A B A B A | ❌ diverges at **rally 1**; server wrong from rally 2 |
| S9 | A A B A B B | ❌ diverges at **rally 3**; server wrong from rally 4 |
| S10 | B B B A A A | ❌ diverges at **rally 1**; server wrong from rally 4 |

**Brute force over all 256 eight-rally sequences: 255/256 diverge from correct BWF.** Earliest *any* divergence (receiver/court) = **rally #1**; earliest *server-identity* divergence = **rally #2**. (Only the all-serving-streak sequence S1 is bug-free.)

**Worked example — sequence S2 `B,A,A,…` (the simplest failure):**

```
0-0  Serving A1 (right), Receiving B1 (right)      Team A: [L=A2, R=A1]   Team B: [L=B2, R=B1]
Rally 1: Team B (receiving) WINS  → 0-1
   ENGINE : server=B2 receiver=A1 | Team A:[L=A1, R=A2]  ← Team A wrongly swapped
   BWF ✓  : server=B2 receiver=A2 | Team A:[L=A2, R=A1]  ← nobody moves (Law 10.6)
Rally 2: Team A (receiving) WINS  → 1-1
   ENGINE : server=A1   ← WRONG player serves
   BWF ✓  : server=A2
```

The *side* serving is always right; the *player* (server/receiver) is wrong — a match-officiating error, not a cosmetic one.

### 7.2 One complete game (doubles)

Drove a realistic biased rally stream through the engine: **final 21-19, status=completed, winner=left, 40 rallies.** Game-over detection (21 with win-by-2, cap 30) is **correct**. (Server/receiver labels *during* the game carry the §1.4 defect.)

### 7.3 One complete match (doubles, best-of-3)

Engine output: **status=completed, winner=left, games 2-0, set scores 21-16, 21-17.** Match completion, game accounting, and result summary are **correct**.

### 7.4 One complete match (singles, best-of-3)

Engine output: **status=completed, winner=left, games 2-0, set scores 21-10, 21-12.** Singles serving (`servingSide = winner`) is **correct** throughout.

### 7.5 Deciding-game side-change trigger

| pointsPerGame | engine `sideChangeScore()` | BWF `ceil(pts/2)` |
|---|---|---|
| 21 | **10** ❌ | 11 |
| 11 | **5** ❌ | 6 |
| 15 | **7** ❌ | 8 |
| 30 | 15 ✅ | 15 |

Off-by-one for all odd `pointsPerGame` (the common cases).

---

<a name="section-8"></a>

## SECTION 8 — RECOMMENDED CHANGES

### CRITICAL

1. **Fix doubles court rotation (Law 10.6).** In `advanceDoublesServeAfterPoint` (`doubles-court.ts:80`), swap the serving side **only** when the serving side wins:
   ```ts
   if (winningSide === servingSide) {
     court = updateSidePositions(court, servingSide, swapSidePartners(positionsForSide(court, servingSide)));
   }
   // else: receiving side won → NO position change
   ```
   *Effort:* ~1-line logic change. **But** it is a state-semantics change for an event-sourced engine: existing persisted `doublesServe` snapshots in `POINT_WON` payloads were written under the old rule, so add a payload/event version bump and ensure replay derives positions fresh (the derive path already exists, `doubles-replay-derive.ts`). Re-validate realtime sync. *Estimate: small code, moderate rollout (versioning + data review).*
2. **Replace the non-independent oracle.** `bwfReferenceAfterRally` (`bwf-doubles-oracle.ts:129`) must implement the *correct* Law 10.6 (conditional swap) so the simulation suite can actually catch regressions; fix the docstring at line 12. *Estimate: small.*

### IMPORTANT

3. **Fix deciding-game end-change trigger.** Change `sideChangeScore` (`reducer/state.ts:101`) to `Math.ceil(pointsPerGame / 2)` so it fires at 11 (21-pt). Align `umpire-assistance.ts:208-209` so trigger and display agree. *Estimate: small; add a deciding-game test at 11-x.*
4. **Introduce the `END_1/END_2` court-end model** (see §5) and represent change-of-ends after each game and at the deciding-game interval. *Estimate: medium — new state + derivation + display wiring; no scoring math change.*
5. **Add format validation** (`deuceAt ≤ pointsPerGame ≤ maxPoints`, `totalGames` odd; derive sane defaults). Prevents the silent "Fast 11" deuce failure (§4). *Estimate: small.*

### OPTIONAL

6. **Model the 11-point interval for games 1 & 2** (currently deciding-game only), for broadcast parity. *Estimate: small.*
7. **Surface singles service court** (even→right / odd→left) for overlays/umpire panel — trivially derivable from score. *Estimate: small.*
8. **Promote `CourtEnd` + scoring-engine strategy into `scoring-core`** for tennis/pickleball/volleyball reuse (§6). *Estimate: large, future-facing.*
9. **Harden `validateStart`** to check player indices and diagonal receiver for doubles. *Estimate: small.*

---

<a name="section-9"></a>

## SECTION 9 — FINAL VERDICT

| Score | Value | Basis |
|---|---|---|
| **BWF Compliance** | **~64%** | Scoring spine fully compliant (rules 1–10, 17 PASS = 11/17). Doubles rotation/server/receiver (11–14) FAIL; ends (15–16) FAIL/PARTIAL. Singles fully compliant. |
| **Local Tournament Compatibility** | **~80%** | Single-game and standard formats work; parameterization is strong. Docked for unvalidated `deuceAt`/`maxPoints` (Fast-11 footgun) and the deciding-game trigger off-by-one. |
| **Production Readiness** | **~60%** | Robust event-sourcing, sequence-guarding, undo, director controls, and *correct singles + scoring*. Blocked for **doubles** by a match-affecting service-rotation bug masked by a non-independent test oracle. |

### Final recommendation: **APPROVED WITH FIXES**

* **Safe to use today:** **singles** matches, and the scoring/game/match/result spine for all formats (with format fields set correctly).
* **Must fix before doubles/mixed go live:** CRITICAL items #1–#2 (Law 10.6 rotation + a genuinely independent oracle). The current engine produces the wrong receiver from the first change of serve and the wrong server shortly after in **255/256** rally patterns — unacceptable for officiating a real doubles match, despite a green test suite.
* **Should fix for full BWF/broadcast fidelity:** IMPORTANT items #3–#5 (11-point end-change trigger, `END_1/END_2` ends model, format validation).

---

### Appendix — Evidence & reproduction

* Engine executed via the package's own command/replay path; existing suite: `cd lib/badminton-core && pnpm exec vitest run` → **64 passed**; bundled doubles simulation report (`lib/badminton-core/test-reports/doubles-rally-simulation-report.txt`) → **205/205 passing** (against the same-buggy oracle).
* The independent reference and divergence/format/end-trigger figures in §4 and §7 were produced by a temporary harness run against the real engine during this audit and then removed (no source changes were committed). The divergence is independently visible in the committed simulation report: sequence `bin6-001` (`BAAAAA`), rally 1, shows Team A's positions swapping (`A2,A1` → `A1,A2`) on a rally Team A *lost as servers* — the Law 10.6 violation.
* Primary code references: `lib/badminton-core/src/scoring/doubles-court.ts` (lines 80–125, 128–140), `bwf-doubles-oracle.ts` (12, 129–141), `reducer/state.ts` (61–79, 101–103), `commands.ts` (73–168, 200–262), `reducer/reducer.ts` (143–205, 389–391), `umpire-assistance.ts` (208–209), `types.ts` (8–35).
