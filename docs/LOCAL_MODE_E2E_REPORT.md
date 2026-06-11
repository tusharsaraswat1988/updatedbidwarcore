# BidWar Local Mode — End-to-End Validation Report (P0-7)

**Date:** 11 June 2026  
**Scope:** Code-path verification + automated local-server API simulation (no live cloud instance, no multi-device browser QA in this run)  
**Scenario target:** 4 teams, 20 players, access codes, operator + 2 owners + LED display, Local Mode enabled  
**Method:** Do **not** trust prior implementation summaries — routes, imports, builds, and handlers verified directly in repo.

---

## Executive Summary

BidWar Local Mode has made substantial progress through P0-1–P0-6 (local auth, owner-app bundle, verify-access, conclude, connection kit, cloud nav). **However, a real VNCL-style venue auction is not yet reliably achievable** after a standard cloud export → local import.

The **single highest-severity blocker** is verified by automated test: **`POST /api/tournaments/:id/auction/start` fails** with `"Set Minimum Players per Team"` / `"Set Maximum Players per Team"` because **`minimumSquadSize` / `maximumSquadSize` are exported from cloud but not stored locally** (missing DB columns + import schema fields). The operator cannot officially start a live auction on imported data.

Additional **Critical/High** gaps affect operator LED controls (missing routes masked as HTML 200), venue browser UX (`localModeEnabled` never returned on local API), and offline media/branding.

| Verdict | **Not Ready** for a real VNCL-style auction without engineering workarounds |
|---------|-------------------------------------------------------------------------------|
| **Launch readiness score** | **38 / 100** |
| **Recommendation** | **Not Ready** (see [Launch Recommendation](#launch-recommendation)) |

---

## Environment

| Item | Value |
|------|--------|
| Repo | `updatedbidwarcore` |
| Local server | `artifacts/bidwar-local/dist-server/index.js` |
| Port | 3742–3745 (isolated test DBs) |
| OS | Windows 10 |
| Build | `pnpm run typecheck` + `pnpm run build` in `artifacts/bidwar-local` — **pass** (11 Jun 2026) |
| Bundled assets | `frontend-dist/` and `owner-app-dist/` **present** after build |
| Cloud runtime | **Not exercised** (no live cloud DB/API in this validation run) |
| Multi-device UI | **Not exercised** (no physical phones / LED hardware in this run) |

---

## Test Results

Legend: **Pass** = verified in code + automated local API or static route check · **Fail** = verified broken · **Partial** = code exists but blocked, untested runtime, or mismatch · **N/T** = not tested in this environment

### Phase A — Cloud login → create → export → import

| Step | Result | Evidence |
|------|--------|----------|
| Cloud login / create tournament | **N/T** | Requires live cloud; routes exist in `artifacts/api-server` |
| Enable Local Mode (`localModeEnabled`) | **Pass (code)** | Admin toggle in `admin.tsx`; export gated at `tournaments.ts:444` |
| Export tournament JSON | **Pass (code)** | `GET /api/tournaments/:id/export` includes full `tournamentToJson` incl. squad sizes (`tournaments.ts:477`) |
| Import into BidWar Local | **Pass (API)** | `POST /local/import` returns `{ ok, tournamentId }`; grants organizer cookie |
| Export fields preserved | **Fail** | Import zod schema (`local.ts:85–94`) **drops** `minimumSquadSize`, `maximumSquadSize`, `localModeEnabled`, audio/banner/branding fields present in cloud export |

**Phase A overall: Partial** — import succeeds but **critical tournament config is lost**.

---

### Phase B — Operator panel on LAN, no cloud redirect

| Step | Result | Evidence |
|------|--------|----------|
| Operator route served locally | **Pass** | `index.ts` serves `frontend-dist`; route `/tournament/:id/auction` in `App.tsx:265` |
| No cloud redirect on `:3741` | **Pass (code)** | `OrganizerGuard` skips cloud redirect when `isBidWarLocalHost()` (`organizer-guard.tsx:28`) |
| Local auth | **Pass (API)** | `POST /api/auth/organizer/:id/bootstrap` + `/me` → `isOrganizer: true` after import |
| Operator panel usable post-import | **Partial** | Auth works; **Start Auction blocked** (see Phase D) |

**Phase B overall: Partial**

---

### Phase C — Owner flow (QR → access code → live bid)

| Step | Result | Evidence |
|------|--------|----------|
| Owner-app bundled | **Pass** | `copy-frontend.mjs` builds owner-app; `index.ts:72–77` serves `/owner-app/*` |
| Owner join URL | **Pass (API)** | Connection kit + `ownerJoinPublicUrl` → `/owner-app/join?tournamentId=&teamId=` |
| Owner static entry | **Pass (API)** | `GET /owner-app/join?...` → HTTP 200 HTML |
| Verify access code | **Pass (API)** | `POST .../verify-access` valid/invalid codes tested |
| Live bid screen | **Partial (code)** | `OwnerRoute` + `verifyOwnerAccessCode` wired; **not browser-tested**; bidding requires active auction (Phase D blocked) |

**Phase C overall: Partial**

---

### Phase D — Live auction (start → nominate → bid → sell × N)

| Step | Result | Evidence |
|------|--------|----------|
| Start auction | **Fail (API)** | `POST .../auction/start` → 400 `"Auction is not ready"` / squad size issues **even when export JSON includes squad sizes** (stripped on import) |
| Nominate player | **Fail** | Blocked by start failure |
| Place bids | **Fail** | Blocked (bid route exists and validates access codes — `auction.ts:415–476`) |
| Sell player | **Fail** | Blocked |
| Missing operator routes vs cloud | **Fail (code)** | Local `auction.ts` has **no** `display-overlay`, `stop-timer`, `defer-player` (cloud has them at `api-server/auction.ts:1798, 2061, 2188`) |
| SPA fallback on missing `/api/*` | **Fail (API)** | `POST /api/.../display-overlay` → **HTTP 200 `text/html`** (SPA index), not 404 JSON — silent failure risk for mutations |

**Phase D overall: Fail**

---

### Phase E — LED display

| Step | Result | Evidence |
|------|--------|----------|
| Display route | **Pass (API)** | `GET /tournament/:id/display` → 200 SPA |
| SSE events endpoint | **Pass (API)** | `GET /api/tournaments/:id/auction/events` registered (`auction.ts:266`) |
| Live state in SSE payload | **Partial (code)** | `buildAuctionState` broadcasts bid/player/timer; **no `displayOverlay` in local state** (schema column exists, not exposed/set) |
| Tournament code gate | **Pass (code)** | No `auctionCode` in local DB → gate auto-unlocks (`tournament-code-gate.tsx:69–72`) |
| Display updates during auction | **Fail** | Blocked by Phase D; overlay controls broken (missing route) |

**Phase E overall: Partial**

---

### Phase F — Internet failure simulation

| Step | Result | Evidence |
|------|--------|----------|
| Core auction on LAN without WAN | **Partial** | Local SQLite + SSE are LAN-only; **auction start blocked** regardless of connectivity |
| Cloud mirror during offline | **Pass (code)** | `mirrorStateToCloud` swallows errors; queues to `syncQueueTable` |
| Electron “internet check” | **Partial** | Renderer probes `clients1.google.com` (`renderer/index.html`) — cosmetic only |
| Owner/operator need cloud mid-auction | **Pass (code)** | API calls are same-origin `:3741` — no cloud dependency for mutations **once auction runs** |

**Phase F overall: Partial** (architecture supports offline; **live path not proven**)

---

### Phase G — Auction conclusion

| Step | Result | Evidence |
|------|--------|----------|
| Conclude endpoint | **Pass (API)** | `POST .../auction/conclude` `{ force: true }` → `status: "completed"` |
| Completed state | **Pass (API)** | Session + tournament status updated (`auction.ts:625–641`) |
| Bidding blocked after conclude | **Pass (code)** | Bid handler checks `session.status !== "active"` (`auction.ts:424`) |

**Phase G overall: Pass (API)** — note: tested without a prior live auction; conclude works from idle/imported state.

---

### Phase H — Cloud recovery (sync)

| Step | Result | Evidence |
|------|--------|----------|
| Local sync endpoint | **Pass (code)** | `POST /local/sync-to-cloud` (`local.ts:178`) |
| Cloud receive endpoint | **Pass (code)** | `POST /api/tournaments/:id/sync` (`tournaments.ts:498`) |
| End-to-end sync | **N/T** | Requires live cloud + valid export token; local test returns 502 to fake URL (expected) |
| Sync worker | **Pass (code)** | `createSyncWorker` started in `index.ts:102` |

**Phase H overall: Partial**

---

## Implementation Report vs Code Reality (Mismatches)

| Prior claim (P0 summaries / launch plan) | Code reality |
|------------------------------------------|--------------|
| P0-1 operator works offline on LAN | **Mostly true** for auth; bootstrap grants session without password if `organizerPassword` null |
| P0-2 owner-app served at `/owner-app` | **True** — verified dist + routes |
| P0-3 verify-access ported | **True** — `teams.ts:115–128` |
| P0-4 conclude ported | **True** — `auction.ts:600–644` |
| P0-5 Connection Kit after import | **True in Electron renderer**; **False in browser on `:3741`** — `local-mode.tsx:301` requires `localModeEnabled` but local `GET /api/tournaments/:id` **omits** that field (`tournaments.ts:19–28`) |
| P0-6 Local Mode nav enabled | **True on cloud hub only** (`layout.tsx:296`); **hidden on venue server UI** for same `localModeEnabled` reason |
| “Import loads tournament — ready to auction” | **False** — squad size fields dropped → **Start Auction fails** |
| Cloud export → full offline fidelity | **False** — see `FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md`; media still Cloudinary URLs; no `/api/branding` on local (SPA HTML returned) |
| Missing API routes fail clearly | **False** — unregistered `/api/*` falls through to SPA **200 HTML** |

---

## Bugs Found

### Critical

1. **Squad size fields not imported — auction cannot start**  
   Cloud export includes `minimumSquadSize` / `maximumSquadSize`. Local SQLite schema (`lib/db-local/schema/tournaments.ts`) has **no columns**. Import schema ignores them. `validateAuctionReadiness(..., "live")` always fails min/max squad checks.  
   **Repro:** Import any export JSON → `POST /api/tournaments/1/auction/start` → 400 with squad messages.

2. **Missing `/api/*` routes return SPA HTML with HTTP 200**  
   Unregistered endpoints (e.g. `display-overlay`, `stop-timer`) hit the static catch-all (`index.ts:86–88`). Client mutations may mis-handle HTML as success.  
   **Repro:** `POST http://127.0.0.1:3741/api/tournaments/1/auction/display-overlay` → 200 `text/html`.

### High

3. **`display-overlay`, `stop-timer`, `defer-player` not implemented locally**  
   Operator panel calls these (`auction-operator.tsx:339–343`); cloud routes exist, local routes do not.

4. **`localModeEnabled` not exposed or set on local server**  
   Column exists in SQLite (`setup.ts` migration) but never set on import and not returned in `tournamentToJson`. Breaks `local-mode.tsx` gate and sidebar nav when using the bundled SPA on `:3741`.

5. **Local `buildAuctionState` omits `displayOverlay` (and cloud license/trial fields)**  
   Operator overlay UI and LED view partial sync broken even if route existed (`use-led-view.ts:266`).

6. **Open bootstrap on LAN** (`POST .../bootstrap`)  
   Anyone on venue Wi‑Fi can obtain organizer session for imported tournaments (`auth.ts:88–106`). Acceptable only if LAN is fully trusted.

### Medium

7. **No `/api/branding` on local server** — `useBranding()` falls back to defaults; custom white-label logos/colors from cloud not available offline.

8. **Player/team photos remain Cloudinary URLs** — broken without internet (`FULL_FIDELITY` §3.1).

9. **Cloud export includes many tournament fields not in import zod** — audio settings, banners, sponsor config partially imported; round-trip fidelity incomplete.

10. **Electron renderer uses `checkInternet()` against Google** — misleading “Offline” indicator; unrelated to auction LAN health.

11. **Connection kit exposes all team PINs on LAN** — intentional for sharing; risk if guest Wi‑Fi is open.

### Low

12. **`package.json` missing `"type": "module"`** — Node warning on server start (noise only).

13. **P0-6 nav depends on cloud tournament flag** — correct on cloud; inconsistent story for venue-only workflow via Electron.

---

## Severity Summary

| Severity | Count | Blocks live VNCL? |
|----------|-------|-------------------|
| Critical | 2 | **Yes** |
| High | 4 | **Yes** (operator LED + venue SPA UX) |
| Medium | 5 | Degrades experience |
| Low | 2 | No |

---

## Launch Readiness Assessment

**Score: 38 / 100**

| Area | Weight | Score | Notes |
|------|--------|-------|-------|
| Setup (export/import) | 20 | 12 | Import works; loses squad + flags |
| Operator auction | 25 | 5 | Cannot start; missing routes |
| Owner bidding | 20 | 12 | Gate OK; live bid unproven |
| LED display | 15 | 8 | SSE exists; overlays broken |
| Offline resilience | 10 | 6 | LAN architecture OK; media/branding not |
| Cloud sync | 10 | 7 | Code complete; E2E unproven |

---

## Launch Recommendation

### **Not Ready**

Not ready for a paying customer or unattended VNCL-style live event. Suitable only for **internal engineering demos** on a controlled LAN with known workarounds (manual DB patch / dev build — **not documented for organizers**).

Does **not** meet bar for:

- Ready for Internal VNCL Pilot (would need at least auction start + one full sell cycle proven)
- Ready for Limited Customer Pilot
- Ready for Commercial Launch

---

## Required Fixes Before First Live Event

Only real blockers — **do not implement in P0-7**; listed for prioritization:

1. **Persist and validate squad sizes on import** — add `minimum_squad_size` / `maximum_squad_size` to `lib/db-local`, import schema, and export round-trip; verify `POST .../auction/start` succeeds after import.

2. **Return `localModeEnabled: true` (or equivalent) from local tournament API** after import — set on import from export payload; include in `tournamentToJson` so venue browser UI (`local-mode`, sidebar) works on `:3741`.

3. **Port missing operator auction routes** — at minimum `display-overlay`, `stop-timer`, `defer-player`; wire `displayOverlay` in `buildAuctionState`.

4. **Fix API 404 handling** — ensure unknown `/api/*` paths return JSON 404, never SPA HTML (Express 404 handler before static catch-all).

5. **Prove one full manual E2E** on real hardware: cloud export → Electron import → start → 3+ sells → owner bid on 2 phones → LED updates → conclude → sync to staging cloud.

6. **(Strongly recommended for VNCL quality)** Offline media + branding bundle per `FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md` — without this, LED/owner screens show broken images offline.

---

## Build Verification

| Command | Result |
|---------|--------|
| `artifacts/bidwar-local` → `pnpm run typecheck` | **Pass** |
| `artifacts/bidwar-local` → `pnpm run build` | **Pass** (includes auction-platform + owner-app → dist copies) |
| `frontend-dist/` exists | **Yes** |
| `owner-app-dist/` exists | **Yes** |

---

## Runtime Verification (Automated Local API)

Executed against fresh SQLite DBs on ports 3742–3745:

```
POST /local/import                          → OK (tournamentId assigned)
POST /api/auth/organizer/:id/bootstrap      → OK
GET  /api/auth/organizer/:id/me             → isOrganizer: true
POST /api/.../teams/:teamId/verify-access   → valid true/false OK
GET  /owner-app/join?tournamentId&teamId    → 200
GET  /local/connection-kit?tournamentId     → operator/display/owner URLs OK
POST /api/.../auction/start                 → FAIL (squad readiness)
POST /api/.../auction/conclude {force:true} → status completed
POST /api/.../auction/display-overlay       → 200 HTML (SPA fallback) — FAIL
GET  /api/tournaments/:id                   → localModeEnabled absent
```

---

## Testing Instructions (For Human QA Follow-up)

1. **Cloud:** Enable Local Mode → export JSON → confirm file contains `minimumSquadSize`, `maximumSquadSize`, `localModeEnabled: true`.
2. **Venue PC:** Install BidWar Local → import → open Connection Kit in Electron → scan owner QR on two phones.
3. **Operator:** Open operator URL on LAN → attempt **Start Auction** → expect failure today; after fix, nominate → timer → bid → sell × 3.
4. **LED:** Open display URL full-screen; confirm bid amount updates on sell.
5. **Offline:** Disable WAN on venue PC only; repeat bid cycle.
6. **End:** Conclude → Sync to Cloud → verify player sold states in cloud tournament.

---

## Rollback / Reference Docs

- Architecture audit: `docs/BIDWAR_LOCAL_AUCTION_ARCHITECTURE_AUDIT.md`
- Launch plan (P0 list): `docs/BIDWAR_LOCAL_AUCTION_LAUNCH_PLAN.md`
- Full fidelity gaps: `docs/FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md`
- Prior audit: `docs/LOCAL_MODE_AUDIT.md`

---

**P0-7 complete. No code changes made. No P1 work started.**
