# VNBL 3.0 League Production Setup — Design Spec

**Date:** 2026-07-31  
**Status:** Approved  
**Approach:** Critical code fixes + exact Day-1 league setup (Approach 1)  
**Tournament:** Vyapari Network Badminton League 3.0 (Men) — verify production id (likely `1`); female players already imported team-wise in same tournament

## Goal

Ship Day-1 league scoring and qualification that match official VNBL 3.0 rules, then load production with the exact male/female league schedule from the organizer sheet. Day-2 knockout brackets are seeded manually after league results.

## Official rules encoded

### Formats

| Phase | Format |
|-------|--------|
| Day 1 League (M/F) | 1 set × 15 points |
| Day 2 Knockout | 1 set × 21 points |
| Finals (M/F) | Best of 3 × 21 |

Approach 1: set league categories to Custom **1×15**. Knockout/finals formats applied when Day-2 fixtures are created (manual).

### Groups & categories

| Category | Groups | Teams | Pairs/team | League matches |
|----------|--------|-------|------------|----------------|
| Men’s Doubles | Group 1: SS, VTS, NR · Group 2: RM, A2, RD | 6 | 5 | 30 (sheet-exact) |
| Women’s Doubles | One logical board (optional single group with all 6 franchises, or category-wide standings) | 6 | 2 | 12 (sheet-exact) |

Female fixtures are **not** full team-tie round-robin across 6 teams. Use the organizer’s 12-match list only. Qualifiers use `mode=category` (top 4 overall) regardless of whether one group row exists.

### Ranking & qualification

**Sort order (pair standings):**

1. `won` DESC  
2. `marginPoints` DESC (point difference on **won** matches only; losses add 0)  
3. `registrationId` ASC (stable)

**Margin example:** win 15–10 → +5. Two wins 15–10 and 15–12 → margin `5 + 3 = 8`.

**Qualifiers:**

- Male: top **4 pairs per group** → Quarter-Finals (bracket built manually after Day 1)  
- Female: top **4 pairs overall** → Semi-Finals (bracket built manually after Day 1)

**Walkover:** Opponent wins; commander enters **assigned margin points** (committee decision). Counts toward qualification.

**Injury/retirement (+2 bonus):** Documented for ops; full engine support is optional/non-blocking for Approach 1. Commanders may encode via assigned margin / score correction if needed on Day 1.

## Code changes (must deploy before live scoring)

### 1. Standings sort flip

**File:** `lib/badminton-core/src/league/standings.ts` (and any API/UI that re-sorts)

Change primary key from `marginPoints` to `won`, then `marginPoints`.

Update tests in `standings.test.ts` and any auction-platform results tests that assert margin-first order.

Update UI copy that currently says margin is the primary rank key.

### 2. Per-group qualifiers (male)

**Files:** `badminton-league-service.ts`, standings rebuild, `GET …/standings` / `…/qualifiers`

- Persist or resolve each pair’s `groupId` from franchise team → group membership when rebuilding standings.  
- Qualifiers for male: return top N **within each group** (default N=4), not category-wide.  
- Female (single group / category-wide board): top N overall with the same sort.

API shape (illustrative):

- `GET /categories/:catId/standings` — include `groupId` / group name on rows; support optional `?groupId=` filter  
- `GET /categories/:catId/qualifiers?limit=4&mode=per_group|category` — `per_group` for male two-group events; `category` for female

### 3. Scoreboard display

Show per pair: played, won, lost, **Diff (`marginPoints`)**. Male broadcast/admin boards filter or section **by group**. Sort matches new rules.

### 4. Out of scope for this spec

- Auto QF/SF seeding / `group_knockout` progression  
- Stage-key automatic format cascade (league 15 → KO 21 → finals Bo3)  
- Mandatory injury +2 scoring engine work  
- Changing female auto `generate-league` to invent a 12-match schedule (we seed from sheet instead)

## Production setup sequence

**Prerequisite:** Deploy code above to production.

1. **Verify tournament** — Confirm id/name; franchises SS, VTS, NR, RM, A2, RD present with players.  
2. **Categories** — Ensure Men’s Doubles + Women’s Doubles league events; draw type groups/league; Custom **1×15**.  
3. **Complete pair registrations** — Male 30 pairs (5 per team); Female 12 pairs (2 per team). Match sheet names; link to franchise teams.  
4. **Male groups** — Save Group 1 (SS, VTS, NR) and Group 2 (RM, A2, RD).  
5. **Seed exact fixtures** — One-shot seed (script or structured JSON) for 30 male + 12 female fixtures with correct opponents and scheduled times from the organizer sheet. Do **not** rely on auto team-tie generate for the female board; prefer sheet-exact for male too so order/times match.  
6. **Courts / schedule** — Apply times; assign courts if provided.  
7. **Smoke test** — Empty standings; sample WO with assigned margin; confirm wins→diff sort; male qualifiers return 4 per group.  
8. **Commander ops brief** — Report 15 min early; 5 min late = WO; WO margin entry; disputes within 5 min; sportsmanship.  
9. **Day 2 (after league)** — Pull qualifiers → manually create QF (8 male) / SF (4 female); set formats **1×21**, finals **Bo3×21**.

## Fixture seed source of truth

Organizer schedule images / sheet (30 male + 12 female). Seed artifact should list: match number, team A, pair A names, team B, pair B names, time. Registration IDs resolved at seed time by name+team match against `badminton_registrations`.

## Testing

- Unit: standings sort wins then margin; assigned margin still contributes when no completed games.  
- Unit/API: qualifiers `per_group` returns ≤4 per group; female `category` returns top 4.  
- Integration/smoke on prod clone or staging before Day 1 if available; otherwise careful prod smoke after deploy.

## Success criteria

- Live league matches use 1×15.  
- Scoreboard ranks by wins, then point difference, and shows Diff.  
- Male qualification is top 4 **per group**; female top 4 overall.  
- All 42 league fixtures match the organizer schedule (opponents + times).  
- Day-2 brackets can be built manually from qualifier lists without fighting wrong sort order.
