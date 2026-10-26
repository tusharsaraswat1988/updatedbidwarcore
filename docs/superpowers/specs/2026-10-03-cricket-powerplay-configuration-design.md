# Cricket Powerplay Configuration & Dynamic Over Selection

**Date:** 2026-10-03  
**Status:** In Review  
**Scope:** Rule Catalog, Rule Profiles, Key Overrides, Rules UI (`rules.tsx`), Runtime Policy Compiler, Pre-match Setup, and OBS Broadcast  

---

## 1. Context & Problems

1. **Hardcoded Over 1 in Pre-Match Setup:**  
   In `artifacts/auction-platform/src/components/scoring/pre-match-setup.tsx`, `powerplayOvers` was hardcoded:
   ```ts
   powerplayOvers:
     match.rules?.powerplayOvers ??
     (match.rules?.superBallEnabled && match.rules?.powerplayEnabled ? [1] : undefined)
   ```
   Because `match.rules?.powerplayOvers` was never populated, standard matches had `powerplayOvers: []`, while Box Cricket (with Super Ball) was locked to `[1]`.
2. **Missing Catalog & Override Definitions:**  
   The catalog only defined `cricket.powerplay.enabled` (boolean). Organizers had no way to specify or override which overs or how many overs are powerplay.
3. **Hardcoded OBS Rules:**  
   In `cricket-obs-view-model.ts`, OBS rendered powerplay text based on an independent formula (`Math.ceil(overs * 0.3)` and arbitrary overs 7–14 for P2), completely ignoring `match.rules?.powerplayEnabled` and `state.powerplayOvers`.

---

## 2. Decisions & Architecture

### 2.1 Rule Catalog & Rule Profiles
* Define `cricket.powerplay.overs` in `CRICKET_RULE_DEFINITIONS` with type `"list"` (array of positive over numbers).
* Default profile values:
  * **Outdoor Standard / T20:** `[1, 2, 3, 4, 5, 6]`
  * **Box Cricket:** `[1]`
  * **Indoor / Tennis:** `[]` (with `cricket.powerplay.enabled: false`)
  * **Fallback derivation:** If `cricket.powerplay.enabled === true` but `cricket.powerplay.overs` is not explicitly set, calculate `[1, ..., min(6, ceil(overs * 0.3))]`.

### 2.2 Key Overrides
* Add `cricket.powerplay.overs` to `CRICKET_KEY_RULE_OVERRIDE_IDS` in `lib/platform-core/src/competition/rule-overrides.ts`.
* Validate that each value in the array is a positive integer $\ge 1$ and $\le$ `overs_per_innings`.
* Ensure sorting and deduplication (`[1, 2, 3]`).

### 2.3 Interactive Rules UI (`rules.tsx`)
* Under "Overs / Innings", when **Powerplay Overs** is enabled:
  * Display an interactive over selector chip grid: `[ 1 ] [ 2 ] [ 3 ] ... [ N ]` matching total configured overs.
  * Clicking an over chip toggles its powerplay status on/off.
  * Selected chips have high-contrast active styling.
  * Quick actions:
    * **"Standard" button:** auto-selects opening overs based on match length (e.g. 1–6 for 20 ov, 1–3 for 10 ov, 1 for $\le 6$ ov).
    * **"Clear" button:** deselects all overs.
  * Dynamic reactivity: If the organizer decreases total overs (e.g. 20 $\to$ 10), any selected overs $> 10$ are pruned automatically.
  * When Powerplay is toggled OFF, over selection is disabled/hidden and cleared.

### 2.4 Runtime Execution Policy & Compatibility Adapter
* Add `powerplayOvers: readonly number[]` to `CricketRuntimeExecutionFields`.
* In `execution-policy.ts`, resolve `powerplayOvers` from compiled rules (or fallback formula if empty but enabled).
* In `compatibility-adapter.ts`, include `powerplayOvers: c.powerplayOvers` in `CompatibilityRulesJson` so it persists onto `scoring_matches.rules`.

### 2.5 Pre-Match Setup & Reducer Wiring
* In `artifacts/auction-platform/src/components/scoring/pre-match-setup.tsx`:
  * Remove the `superBallEnabled && powerplayEnabled ? [1] : undefined` hardcode.
  * Pass `powerplayOvers: match.rules?.powerplayOvers ?? (match.rules?.powerplayEnabled ? [1] : [])`.
* `lib/scoring-core/src/cricket/reducer.ts`:
  * Continues to populate `state.powerplayOvers` from payload.
  * Prevents Super Ball declaration whenever current over $+ 1$ is included in `state.powerplayOvers`.

### 2.6 OBS & Broadcast View Model
* In `artifacts/auction-platform/src/lib/cricket-obs-view-model.ts`:
  * Check `match.rules?.powerplayEnabled` and `state.powerplayOvers`.
  * If powerplay is disabled or `state.powerplayOvers` is empty $\to$ `powerplayText = null`.
  * If the active over (`over + 1`) is in `state.powerplayOvers` $\to$ display `P1 (${state.powerplayOvers.length} OV)` (or custom text if non-contiguous).
  * If current over is not in `state.powerplayOvers` $\to$ `powerplayText = null`.

---

## 3. Data Contracts & Interfaces

### 3.1 Override Document Payload
```json
{
  "values": {
    "cricket.powerplay.enabled": true,
    "cricket.powerplay.overs": [1, 2, 3]
  }
}
```

### 3.2 Compatibility & Match Rules Projection
```ts
export type CompatibilityRulesJson = {
  overs: number;
  maxWickets: number;
  // ... other fields
  powerplayEnabled: boolean;
  powerplayOvers: number[];
  source: "runtime_execution_policy";
};
```

---

## 4. Testing & Verification

1. **Catalog & Profile Unit Tests:**
   * Verify `cricket.powerplay.overs` catalog entry validation.
   * Verify Outdoor and Box profile default values.
2. **Rule Overrides Parsing Tests:**
   * Test valid array input `[1, 2, 3]`.
   * Test rejection of numbers $> \text{oversLimit}$ or negative values.
3. **Execution Policy Tests:**
   * Test resolution of `powerplayOvers` with override, with default profile, and when disabled (`[]`).
4. **Pre-Match Setup Integration:**
   * Verify `MATCH_STARTED` event receives exact configured `powerplayOvers` without fallback to `[1]` unless configured.
5. **OBS View Model Tests:**
   * Test `powerplayText` is null when powerplay is disabled.
   * Test `powerplayText` is active only on configured overs (e.g. overs 1–3).
