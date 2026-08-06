# PHASE 5 HOME CUTOVER REPORT

**Date:** 2026-08-06  
**Baseline:** RC1.1 GO ([`2026-08-06-pxp-rc1-1-stabilization-report.md`](./2026-08-06-pxp-rc1-1-stabilization-report.md))  
**Scope:** Home ownership cutover only. No redesign. No features. No Product API / ownership / business-logic / runtime / EPIC changes.  
**Branch:** `cursor/pxp-phase5-home-cutover-8f0c`

---

## Executive Summary

**Completed**

Tournament Mission Control (`/tournament/:id`) is now the sole canonical operator home.

Badminton Hub (`/tournament/:id/badminton`) is an operational workspace only — dashboard/home semantics removed; EPIC pipeline cards no longer mount as a second home.

Home / Dashboard / return / `from=` contracts resolve to Tournament Mission Control.

Auction Live Control, Badminton Mission Control, Cricket Live Control, OBS/LED/Broadcast routes remain; only ownership/return semantics changed.

**Partially Completed**

None for Phase 5 success criteria.

**Blocked**

None.

---

## Home Ownership

### Before

| Surface | Role |
|---------|------|
| `/tournament/:id` | Tournament Mission Control (operator home) |
| `/tournament/:id/badminton` | Second operator home / Tournament Dashboard + incomplete-setup EPIC cards |

### After

| Surface | Role |
|---------|------|
| `/tournament/:id` | **Sole operator home** — Tournament Mission Control |
| `/tournament/:id/badminton` | **Operational workspace only** — court ops / scoring / match control entry |
| Live Operations destinations | Operational workspaces entered from TMC; return to TMC |

---

## Navigation Changes

| Route / surface | Change |
|-----------------|--------|
| `/tournament/:id` | Unchanged route; confirmed sole home |
| Auction sidebar `layout.tsx` | “Tournament Home” → **Mission Control** |
| Auction operator chrome `operator-layout.tsx` | “Setup” return → **Mission Control** (same `openSetupArea` / TMC path) |
| `/tournament/:id/badminton` | Dashboard title/eyebrow → **Operations / Badminton Operations**; EPIC cards removed from this page; Mission Control CTA added |
| Badminton sport sidebar | “Dashboard” label → **Operations** (same hub route; id preserved) |
| Badminton hub nav chip | “Tournament Dashboard” → **Operations** |
| Badminton hub back (hub root) | `history.back` → **Back to Tournament Mission Control** |
| Badminton control/ops back | “Back to Tournament Dashboard” → **Back to Operations** |
| Analytics empty CTA | “Go to Dashboard” (hub) → **Open Mission Control** (TMC) |
| Buzz Studio guard | “Back to Tournament” → **Back to Tournament Mission Control** |
| Live Ops → Badminton MC / Broadcast | Existing `from=` TMC preserved; breadcrumb trail when returning from Live Ops |
| `/tournament/:id/badminton/*` | Routes retained (not removed) |

---

## Return Navigation

| Contract | Before | After |
|----------|--------|-------|
| Default `resolveReturnPath` / `setupAreaPath` | TMC (`/tournament/:id`) | Same; aliased as `tournamentMissionControlPath` |
| Live Ops `from=` on badminton pages | Honored only on control/broadcast | Honored on **all** badminton pages when `from=` is safe and non-badminton |
| Dishonest badminton-as-home `from=` | Possible | Rejected — falls back to operational back chain |
| Badminton hub root | Browser history | Always TMC |
| Auction Live Control | Setup button → setup area | Mission Control button → TMC |
| Cricket Live Control | RC1.1 `from=` / TMC label | Unchanged (already TMC) |
| Teams Manage `from=` | RC1.1 return link | Unchanged (already TMC) |

---

## Operational Workspace Changes

### Badminton

- Hub is no longer a dashboard/home.
- Responsibilities retained: court ops, scoring entry, match control, broadcast (via existing routes).
- Incomplete-setup EPIC card stack removed from hub (pipeline remains on TMC only).
- Badminton setup checklist / next-step / operator panel entry retained.
- Labels: Operations / Badminton Operations.

### Auction

- Live Control route unchanged.
- Return chrome renamed to Mission Control; still opens TMC via `openSetupArea`.

### Cricket

- No Phase 5 route changes.
- RC1.1 Cricket Live Control path + return to TMC remain valid.

---

## Regression Verification

| Area | Result |
|------|--------|
| Mission Control | **PASS** — sole home; sidebar + operator return + hub root point here |
| Live Operations | **PASS** — deep links retain `from=` → TMC; breadcrumbs on Live Ops entry |
| Badminton | **PASS** — hub workspace semantics; ops routes intact; unit tests green |
| Auction | **PASS** — Mission Control return label; auction room path unchanged |
| Cricket | **PASS** — no Phase 5 regressions; prior RC1.1 contracts held |

**Automated:** `live-ops-return-paths.test.ts` + `badminton-sport-nav.test.ts` — **17/17 pass**.

---

## Architecture Compliance

| Check | Confirmed |
|-------|-----------|
| No Product API changes | Yes |
| No Platform ownership changes | Yes |
| No business logic / state machine / EPIC changes | Yes |
| No runtime / rule / presentation engine changes | Yes |
| No new UX / redesign | Yes — labels + ownership/return only |
| Routes not removed (badminton, auction, scoring, OBS, LED, broadcast, BMC) | Yes |
| Module Workspace / Attention / Health / Validation / History / Quick Peek untouched | Yes |

---

## Remaining Technical Debt

List only — not fixed in Phase 5:

1. RC1.1 remaining P2: Attention readiness attribution; duplicate attention chrome on TMC; dependency chips not Product-API-backed
2. List-module ActionBar / Ready / History parity vs Competition
3. Auction Live Control visibility for non-auction catalogs
4. Readiness strip vs per-module health desync
5. History timestamps; KPI twin languages; unused platform extracts
6. Live Ops synthetic always-healthy snapshot
7. Registry equality / snapshot identity micro-optimizations
8. Full breadcrumb chrome across every module workspace (only Live Ops → Badminton MC trail standardized here)
9. Auction room new-tab return still relies on Mission Control / opener patterns (pre-existing)

---

## Final Recommendation

**Phase 5 Complete**

**Ready for Phase 6 (Polish)**

Do not mix polish (keyboard, a11y, motion, density) into residual P2 debt fixes unless they directly unblock polish.
