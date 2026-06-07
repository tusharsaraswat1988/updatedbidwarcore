# Full-Fidelity Local Mode — Gap Analysis & Architecture Plan

**Product direction:** BidWar Local Mode must deliver the **same experience as Cloud Mode** with **zero visual or functional degradation** when the venue internet cable is physically unplugged.

**Status:** Analysis and architecture plan only — **no implementation**. Await approval before changes.

**Related:** [LOCAL_MODE_AUDIT.md](./LOCAL_MODE_AUDIT.md)

---

## 1. Definition of “full fidelity”

An organiser running Local Mode at a venue (LAN only, **no WAN**) must get:

| Surface | Must work offline |
|---------|-------------------|
| Operator panel | Full auction control — same buttons, overlays, timers, defer, fortune wheel |
| Owner screens | Join, access code, live bid, squad, scout, warmup |
| LED display | Player cards, bid ticker, sponsors, banners, audio, overlays, outcome cards |
| Reports | Summary, purses, top bids, category breakdown, team reports |
| Branding | Global BidWar branding + tournament identity |
| Media | Player photos, team logos, sponsor logos, main banner, custom sounds |

**Acceptable internet use (before/after event only):**

- Export tournament package from cloud (while online)
- Optional sync results back to cloud (after event)

**Not acceptable during event:**

- Any runtime fetch to Cloudinary, cloud API, Google connectivity probes for *features*, or external CDNs for auction UI

---

## 2. Current vs target (executive gap)

```text
TODAY                          TARGET
─────                          ──────
URL strings in SQLite    →     Binary media served locally
auction-platform only    →     auction-platform + owner-app same origin
No /api/auth on local    →     Local organiser session (from export)
~75% auction routes        →     100% auction + display + analytics routes
Cloudinary URLs in UI    →     Rewritten to /media/... on local server
Defaults if no branding  →     Full branding embedded in export
Mirror/sync optional     →     Unchanged (post-event); event itself is LAN-only
```

**Honest claim today:** *“Partial offline auction with significant gaps.”*  
**Target claim:** *“Runs completely offline with full branding, media, owner access, and LED displays.”*

---

## 3. Gap analysis by area

---

### 3.1 Media assets

#### 3.1.1 Player photos

| | |
|---|---|
| **Current** | Export includes `photoUrl` string per player (`artifacts/api-server/src/routes/tournaments.ts` export). Import stores URL in SQLite (`artifacts/bidwar-local/src/server/routes/local.ts`). UI renders via `cldUrl()` which **still points at Cloudinary** (`artifacts/auction-platform/src/lib/cloudinary.ts`). |
| **Missing** | Download at export time; store bytes locally; rewrite URLs to `http://<local-ip>:3741/media/...`; serve from local disk when WAN is down. |
| **Files** | **Cloud export:** `artifacts/api-server/src/routes/tournaments.ts` · **Import:** `artifacts/bidwar-local/src/server/routes/local.ts` · **Schema:** `lib/db-local/src/schema/players.ts` · **UI:** `artifacts/auction-platform/src/lib/cloudinary.ts`, `components/display/player-overlay.tsx`, `pages/liveviewer.tsx`, `owner-app` LiveBid/Warmup · **Upload (cloud-only):** `artifacts/api-server/src/routes/upload.ts` |
| **Risk** | **Critical** — LED and owner screens show broken images offline; Cloudinary unreachable without internet. |
| **Architecture** | **Offline Media Bundle (OMB):** At export, crawl all referenced URLs (players, teams, tournament, sponsors, sounds, banners, branding logos). Store under `{userData}/bidwar-data/media/{sha256}.{ext}`. Export manifest maps original URL → local path. Import writes manifest + copies files. Local server adds `GET /media/*` static route. UI: `cldUrl()` detects local mode and returns `/media/...` without Cloudinary transforms, OR pre-generate resized variants at export (thumbnail, playerCard, teamLogo, banner). |

#### 3.1.2 Team logos

| | |
|---|---|
| **Current** | `logoUrl` exported and stored as string (`teams` in export JSON, `lib/db-local` teams table). Rendered with `cldUrl(..., "teamLogo")` across display, liveviewer, owner-app, reports. |
| **Missing** | Same OMB treatment as player photos. |
| **Files** | Same as above + `artifacts/auction-platform/src/components/display/bid-display.tsx`, `team-reports.tsx` |
| **Risk** | **Critical** |
| **Architecture** | Include in OMB; precompute pad/transparency-friendly PNG/WebP at export. |

#### 3.1.3 Sponsor banners / sponsor logo carousel

| | |
|---|---|
| **Current** | `sponsorLogos` JSON string on tournament — exported in full `tournamentToJson` but **import schema strips most tournament fields** (only name, sport, venue, purse rules, etc. in `local.ts` zod schema lines 43–52). Local DB has `sponsor_logos` column. Display parses via `parseSponsorLogos` → `SponsorCarousel` / `SponsorTicker` (`display-shell.tsx`). |
| **Missing** | (1) Import must persist full `sponsorLogos` reliably — partially done but export schema mismatch risk. (2) OMB for each sponsor image URL inside JSON. |
| **Files** | `artifacts/api-server/src/routes/tournaments.ts` (export) · `artifacts/bidwar-local/src/server/routes/local.ts` (import) · `lib/db-local/src/setup.ts` · `artifacts/auction-platform/src/lib/sponsor-logo.ts` · `components/display/sponsor-carousel.tsx`, `sponsor-ticker.tsx` |
| **Risk** | **High** — sponsors invisible or broken offline. |
| **Architecture** | OMB + validate import round-trip for `sponsorLogos`. |

#### 3.1.4 Tournament branding (global BidWar brand)

| | |
|---|---|
| **Current** | `useBranding()` fetches `GET /api/branding` (`artifacts/api-server/src/routes/branding.ts`). Local server **has no branding route** — hook falls back to `BRANDING_DEFAULTS` (`artifacts/auction-platform/src/hooks/use-branding.ts`). Owner-app has duplicate hook (`owner-app/src/hooks/useBranding.ts`). |
| **Missing** | Embed full `brandingSettingsTable` row in export package. Local `GET /api/branding` serves embedded data. OMB for `mainLogoUrl`, `miniLogoUrl`, `appIconUrl`, fonts if custom. |
| **Files** | `artifacts/api-server/src/routes/branding.ts` · `lib/db/src/schema/branding` · `artifacts/auction-platform/src/hooks/use-branding.ts` · `owner-app/src/hooks/useBranding.ts` |
| **Risk** | **High** — wrong logos, colors, powered-by text on display/owner/reports vs cloud. |
| **Architecture** | Export includes `branding: BrandingSettings` + media files. Local server mounts branding router reading from SQLite `branding_settings` table or JSON sidecar. |

#### 3.1.5 Custom graphics (main banner, OBS, display overlays)

| | |
|---|---|
| **Current** | Cloud tournament has `mainBannerUrl`, `mainBannerEnabled`, `mainBannerFit` (`lib/db/src/schema/tournaments.ts`). Export **includes** these via `tournamentToJson`. Local SQLite tournaments table **lacks columns** for main banner, audio, cheer (`lib/db-local/src/setup.ts`). Import schema **does not accept** these fields. `BannerOverlay` uses `cldUrl(bannerUrl, "banner")` (`banner-overlay.tsx`). |
| **Missing** | Schema parity on local DB; import/export fields; OMB for banner image; local tournament GET returns banner fields. |
| **Files** | `lib/db/src/schema/tournaments.ts` · `lib/db-local/src/schema/tournaments.ts` · `local.ts` import · `components/display/banner-overlay.tsx`, `overlay-manager.tsx` · `pages/obs-overlay.tsx` |
| **Risk** | **High** — felicitation / broadcast banner feature absent offline. |
| **Architecture** | Extend local schema + import; OMB for banner asset. |

#### 3.1.6 Custom audio (countdown, sold, break-end)

| | |
|---|---|
| **Current** | Cloud stores `audioEnabled`, `*SoundUrl`, volumes on tournament (`tournamentToJson`). `useBroadcastAudio` + `AuctionAudioManager` load URLs from tournament settings (`use-broadcast-audio.ts`, `lib/audio-manager.ts`). Not in local DB or import. |
| **Missing** | Persist audio settings locally; bundle sound files in OMB; serve via `/media/sounds/...`. |
| **Files** | `artifacts/auction-platform/src/components/display/use-broadcast-audio.ts` · `lib/audio-manager.ts` · cloud `tournaments.ts` |
| **Risk** | **Medium** — silent display vs cloud; functional but degraded. |
| **Architecture** | OMB for audio files; local tournament JSON includes all `audio*` fields. |

---

### 3.2 Owner app support on LAN

| | |
|---|---|
| **Current** | `copy-frontend.mjs` bundles **auction-platform only** — not owner-app. Owner join URL is `/owner-app/join?tournamentId=&teamId=` (`lib/api-base/src/owner-urls.ts`). QR code encodes **base URL only** (`local.ts` `/local/qr.png`). Legacy redirect in auction-platform sends `/tournament/:id/owner/:teamId` → owner-app (`redirect-to-owner-app.tsx`) — **404 on local server**. |
| **Missing** | Serve owner-app static build at `/owner-app/*` from local server. QR/deep links to owner join + display URLs. Local APIs: `verify-access`, `owner/onboarding/lookup` (or replace with direct links), team scout. |
| **Files** | **Bundle:** `artifacts/bidwar-local/scripts/copy-frontend.mjs` · **Server:** `artifacts/bidwar-local/src/server/index.ts` · **Owner app:** `artifacts/owner-app/` (entire app) · **APIs:** `artifacts/api-server/src/routes/owner-onboarding.ts`, `teams.ts` (`verify-access`, `scout`) · **Auth:** `lib/api-base/src/owner-auth.ts` |
| **Risk** | **Critical** — team owners cannot bid offline; core product promise broken. |
| **Architecture** | **Single-origin local host:** Serve `frontend-dist/` (organizer + display) and `owner-app-dist/` at `/owner-app/`. Build step copies both. Owner onboarding can be simplified offline: QR → `/owner-app/join?tournamentId=X&teamId=Y` per team (no mobile lookup API required if links are pre-generated). Implement `POST .../verify-access` on local server (logic exists in cloud `teams.ts:435–461`). Owner `LiveBid` uses polling (`OwnerRoute.tsx` refetchInterval 1s) — works on LAN if API exists; optional upgrade to SSE for parity/latency. Push notifications (`vapid-public-key`, `push-subscribe`) — **graceful no-op offline** (already try/catch). |

**Owner-app cloud API dependencies:**

| Endpoint | Local today | Required for offline |
|----------|-------------|----------------------|
| `GET /api/tournaments/:id/auction` | Yes | Yes |
| `POST /api/tournaments/:id/auction/bid` | Yes | Yes |
| `GET /api/tournaments/:id`, teams | Partial | Yes |
| `GET /api/tournaments/:id/team-purses` | Yes | Yes |
| `POST .../verify-access` | **No** | **Yes** |
| `POST /api/owner/onboarding/lookup` | **No** | Optional (use direct links) |
| `GET /api/tournaments/:id/teams/scout` | **No** | Yes (scout screen) |
| `GET /api/branding` | **No** | Yes |
| Push/VAPID | **No** | No (optional) |

---

### 3.3 Local organiser authentication

| | |
|---|---|
| **Current** | All organizer routes wrapped in `OrganizerGuard` → `checkOrganizerAuth` → `GET /api/auth/organizer/:id/me` (`organizer-guard.tsx`, `lib/auth.ts`). Local server mounts **zero auth routes** (`bidwar-local/src/server/index.ts`). Operator panel ** unreachable** after import without cloud. |
| **Missing** | Local auth router implementing tournament-scoped session; export includes `organizerPassword` hash or offline token; `OrganizerGuard` bypass or local login against SQLite. |
| **Files** | `artifacts/auction-platform/src/components/organizer-guard.tsx` · `lib/auth.ts` · `artifacts/api-server/src/routes/auth.ts` (reference impl) · `bidwar-local/src/server/index.ts` · export in `tournaments.ts` |
| **Risk** | **Critical** — operator cannot run auction offline even if engine works. |
| **Architecture** | **Option A (recommended):** Export includes `organizerPasswordHash` (bcrypt) + `organizerSessionSecret`. Local server implements minimal subset of `auth.ts`: `POST/GET /api/auth/organizer/:tid/login|me|logout` using SQLite tournament row. JWT/cookie same shape as cloud so **no frontend changes**. **Option B:** Detect local origin (`:3741` or `X-BidWar-Local: 1`) and skip `OrganizerGuard` — faster but weaker security on LAN. **Option C:** `operatorPin` already in local schema — wire UI + export; PIN-only local login. Combine A + C for defense in depth. |

---

### 3.4 Local display screen parity

| | |
|---|---|
| **Current** | `/tournament/:id/display` is public (no OrganizerGuard) — **can load on LAN**. `DisplayShell` uses SSE via `useAuctionSocket`, tournament state, overlays (`display-shell.tsx`). Local auction SSE exists. Local `buildAuctionState` **missing fields** vs cloud: `licenseStatus`, `lastOutcome`, `deferredPlayerIds`, `timerType`, `displayOverlay` in API responses (local DB has some columns but routes don't expose/set them). |
| **Missing** | API routes: `display-overlay`, `display-player-filter`, `stop-timer`. State fields: `lastOutcome` (sold/unsold cards), `displayOverlay` mutations. Tournament fields: audio settings, main banner. Media OMB. Branding endpoint. Cheer (if liveviewer used on secondary screen). |
| **Files** | **UI:** `artifacts/auction-platform/src/components/display/*`, `pages/display.tsx`, `pages/liveviewer.tsx`, `pages/obs-overlay.tsx` · **Local API:** `bidwar-local/src/server/routes/auction.ts` · **Cloud reference:** `api-server/src/routes/auction.ts` (display-overlay, display-player-filter, stop-timer, lastOutcome writes) · **Session schema:** `lib/db-local/src/schema/auction_sessions.ts` vs `lib/db/src/schema/auction_sessions.ts` |
| **Risk** | **High** — display runs but missing overlays, outcome animations, operator-driven banner/team views, custom sounds. |
| **Architecture** | Port missing auction POST handlers to local router (shared handler module ideal). Extend local `buildAuctionState` to match cloud JSON shape exactly (OpenAPI schema as contract). Add `lastOutcome` writes on sell/unsold (cloud lines ~1006+). Ensure `displayOverlay` / `displayPlayerFilter` persisted in session table (columns exist locally but unused). |

**Display-specific cloud vs local route gap:**

| Route | Cloud | Local |
|-------|-------|-------|
| `POST .../display-overlay` | Yes | **No** |
| `POST .../display-player-filter` | Yes | **No** |
| `POST .../stop-timer` | Yes | **No** |
| `POST .../cheer` | Yes | **No** |
| `lastOutcome` in state | Yes | **No** |
| `deferredPlayerIds` in state | Yes | **No** |
| Audio from tournament | Yes | **No** (fields absent) |

---

### 3.5 Local reports parity

| | |
|---|---|
| **Current** | Reports page (`pages/reports.tsx`) calls: `useGetTournamentSummary`, `useGetTeamPurses`, `useGetTopBids`, `useGetCategoryBreakdown`. Local server has **summary** + **team-purses** (`bidwar-local/.../tournaments.ts`). **Missing:** `GET /api/tournaments/:id/analytics/top-bids` and `.../category-breakdown` (`api-server/src/routes/analytics.ts`). Team reports page + PDF (`team-reports.ts`) — **not on local**. Reports behind `OrganizerGuard` — blocked without auth. |
| **Missing** | Analytics router on local; team-reports routes; auth to access reports; live updates as auction progresses (data exists in SQLite — just needs endpoints). |
| **Files** | `artifacts/auction-platform/src/pages/reports.tsx` · `pages/team-reports.tsx` · `artifacts/api-server/src/routes/analytics.ts` · `team-reports.ts` · `bidwar-local/src/server/routes/tournaments.ts` |
| **Risk** | **Medium–High** — organiser cannot see analytics during/after offline auction on venue LAN. |
| **Architecture** | Mount analytics routes on local server — logic is pure DB read (easy port from `analytics.ts`). Add team-reports read endpoints (PDF generation can use same local data). No cloud dependency once auth + data exist locally. |

---

### 3.6 Local API parity with cloud auction APIs

#### Router mount comparison

**Cloud** (`artifacts/api-server/src/routes/index.ts`): auth, push, upload, branding, tournaments, teams, players, categories, auction, analytics, admin-reports, intelligence, comm, team-reports, owner-onboarding, audit, settings, …

**Local** (`artifacts/bidwar-local/src/server/index.ts`): tournaments, teams, players, categories, auction, `/local/*` only.

#### Auction route parity matrix

| Endpoint | Cloud | Local | Impact if missing |
|----------|-------|-------|-------------------|
| `GET .../auction/events` (SSE) | Yes | Yes | — |
| `GET .../auction` | Yes | Yes | — |
| `POST .../start` | Yes | Yes | — |
| `POST .../pause` | Yes | Yes | — |
| `POST .../next-player` | Yes | Yes | — |
| `POST .../bid` | Yes | Yes | — |
| `POST .../sell` | Yes | Yes | — |
| `POST .../manual-sell` | Yes | Yes | — |
| `POST .../unsold` | Yes | Yes | — |
| `POST .../re-auction` | Yes | Yes | — |
| `POST .../re-auction-unsold` | Yes | Yes | — |
| `POST .../reset-trial` | Yes | Yes | — |
| `POST .../undo` | Yes | Yes | — |
| `POST .../team-purse-view` | Yes | Yes | — |
| `POST .../fortune-wheel` | Yes | Yes | — |
| `POST .../break-timer` | Yes | Yes | — |
| `POST .../pre-auction-countdown` | Yes | Yes | — |
| `POST .../category-filter` | Yes | Yes | — |
| `POST .../start-timer` | Yes | Yes | — |
| `GET .../bids` | Yes | Yes | — |
| `GET .../queue` | Yes | Yes | — |
| `POST .../defer-player` | Yes | **No** | Operator defer UI broken |
| `POST .../display-overlay` | Yes | **No** | LED overlay control broken |
| `POST .../display-player-filter` | Yes | **No** | Top-5 / player filter broken |
| `POST .../stop-timer` | Yes | **No** | Stop timer broken |
| `POST .../cheer` | Yes | **No** | Live viewer cheer broken |
| `POST .../mirror` | Yes (cloud recv) | N/A | OK — local is source |

#### State payload parity (auction GET / SSE)

| Field | Cloud | Local |
|-------|-------|-------|
| `licenseStatus` | Yes | **No** |
| `lastOutcome` | Yes | **No** |
| `deferredPlayerIds` | Yes | **No** |
| `timerType` | Yes | **No** |
| `displayOverlay` | Yes | Column exists; **not in buildAuctionState** |
| `currentBidTeamLogoUrl` | Yes | Partial |

| | |
|---|---|
| **Risk** | **Critical** for operator/display parity; **High** for owner (licenseStatus gates trial mode in cloud bid handler). |
| **Recommended architecture** | **Shared auction engine package** (`@workspace/auction-engine`): single implementation of `buildAuctionState`, bid validation, sell/unsold, overlays — parameterized by `DbAdapter`. Cloud and local both mount thin route wrappers. Short-term: port missing routes + fields to `bidwar-local/.../auction.ts` with cloud as reference. **Contract test:** OpenAPI examples / snapshot tests — cloud and local responses must match for same fixture data. |

---

## 4. Recommended architecture (internet-independent auction)

### 4.1 Design principles

1. **Venue LAN is authoritative during the event** — SQLite on auction PC is source of truth.
2. **Single origin** — `http://<local-ip>:3741` serves API + organizer UI + owner-app + display (eliminates CORS/proxy issues).
3. **Export = complete offline package** — data + media + branding + credentials, not JSON with external URLs.
4. **API parity by contract** — OpenAPI / shared handlers; local must implement same routes the UIs call.
5. **No runtime WAN dependency** — `cldUrl()` and hooks must resolve to local media; connectivity probes must not gate features.

### 4.2 Offline Package format (export)

Extend cloud export to produce **`tournament.offline.zip`**:

```text
manifest.json          # version, exportedAt, exportToken, cloudBaseUrl, tournament, teams, players, categories
branding.json          # full branding settings row
auth.json              # organizerPasswordHash, optional operatorPin
media/
  index.json           # originalUrl → relativePath, preset variants
  players/{id}.webp
  teams/{id}.webp
  sponsors/{n}.webp
  tournament/logo.webp
  banner/main.webp
  sounds/countdown.mp3
  sounds/sold.mp3
  branding/main-logo.webp
  ...
```

**Export pipeline changes:** `GET /tournaments/:id/export` becomes async job or streaming zip — server-side fetch all media, generate preset sizes, rewrite all URLs in manifest to relative paths.

**Import pipeline:** `POST /local/import` accepts zip → extracts to `{userData}/bidwar-data/` → populates SQLite → registers media index.

### 4.3 Local server structure (target)

```text
artifacts/bidwar-local/src/server/
  index.ts                 # mount all routers
  routes/
    auth-local.ts            # organizer login/me (subset)
    branding-local.ts        # serve embedded branding
    media.ts                 # GET /media/*
    analytics.ts             # port from cloud
    team-reports.ts          # port read paths
    owner-onboarding.ts      # optional / simplified
    auction.ts               # full parity (shared engine)
    tournaments|teams|players|categories  # existing
    local.ts                 # import, sync-to-cloud (post-event only)
  lib/
    media-resolver.ts        # URL rewrite helper
    local-session.ts         # JWT for organiser
```

**Static assets:**

```text
frontend-dist/           # auction-platform build
owner-app-dist/            # owner-app build (NEW)
```

### 4.4 Frontend local-mode detection

Minimal approach — **same origin, no detection needed** if all API routes exist locally.

Optional: `GET /api/healthz` returns `{ mode: "local" }` (already `{ ok: true, mode: "local" }` in local server) for UI badges only — not for feature gating.

### 4.5 Sync vs live event (unchanged scope)

- **During event:** zero WAN required.
- **After event:** `POST /local/sync-to-cloud` pushes results (existing).
- **Mirror to cloud during event:** optional enhancement for remote viewers — **not required** for full-fidelity local claim.

### 4.6 Security on LAN

- Organiser password from export (bcrypt verify).
- Optional `operatorPin` on mutating routes (partially implemented).
- Team `accessCode` for owner bid (local bid route already checks).
- No open LAN operator access in production — PIN/password mandatory.

---

## 5. Implementation phases (for approval)

| Phase | Scope | Unblocks |
|-------|--------|----------|
| **P0** | Local auth router + OrganizerGuard works on `:3741` | Operator panel |
| **P0** | Bundle owner-app; serve `/owner-app/*`; verify-access route | Owner bidding |
| **P0** | Offline Media Bundle in export/import + `/media` server | Photos, logos, sponsors |
| **P1** | Branding + tournament extended fields (banner, audio) in schema/import | Display fidelity |
| **P1** | Missing auction routes + state fields (overlay, defer, stop-timer, lastOutcome) | Operator + LED parity |
| **P1** | Analytics + team-reports routes on local | Reports |
| **P2** | Shared auction engine refactor | Long-term parity maintenance |
| **P2** | Owner SSE (optional) | Latency parity with cloud |

---

## 6. Pre-ship checklist — honest marketing claim

BidWar may claim **“Runs completely offline with full branding, media, owner access, and LED displays”** only when **all** items below pass (verified with WAN cable unplugged on venue router):

### Media & branding

- [ ] Every player photo renders on LED, operator, and owner screens offline
- [ ] Every team logo renders offline
- [ ] Sponsor carousel/ticker shows all sponsor logos offline
- [ ] Tournament logo and main banner render offline
- [ ] Global branding (logos, colors, powered-by) matches cloud export — not defaults
- [ ] Custom countdown/sold/break sounds play on LED offline
- [ ] No request to `res.cloudinary.com` or other external hosts during live auction (verify via DevTools/network capture)

### Owner access

- [ ] Owner-app loads from `http://<local-ip>:3741/owner-app/...`
- [ ] QR or share link opens correct owner join URL per team
- [ ] Access code verification works via local API
- [ ] Live bid, warmup, squad, scout screens function
- [ ] Bid placement succeeds with correct purse/timer rules
- [ ] Owner UI branding matches cloud

### Operator panel

- [ ] Organiser can log in offline (password/PIN from export)
- [ ] Full auction flow: start, pause, next player, timer, bid, sell, unsold, undo, re-auction
- [ ] Defer player works
- [ ] Display overlay controls work (team/player/banner/top5/off)
- [ ] Fortune wheel, break timer, pre-auction countdown work
- [ ] Category filter works
- [ ] Stop timer works
- [ ] Operator UI identical to cloud (no missing buttons/errors in console)

### LED display

- [ ] `/tournament/:id/display` fully functional offline
- [ ] SSE updates within expected latency
- [ ] Sold/unsold outcome cards render (`lastOutcome`)
- [ ] Overlays respond to operator commands
- [ ] Sponsor ticker + audio work
- [ ] OBS overlay route works if used (`/tournament/:id/obs`)

### Reports

- [ ] Reports page loads with summary, purses, top bids, category charts
- [ ] Data updates live as auction progresses
- [ ] Team reports accessible offline

### API & data integrity

- [ ] All UI-network calls resolve to local server (no 404/HTML fallthrough on `/api/*`)
- [ ] OpenAPI contract tests pass for local vs cloud on shared endpoints
- [ ] Export → import round-trip preserves 100% of tournament settings used by UI
- [ ] Auction completes; sync to cloud succeeds when internet restored (post-event)

### Venue scenario (acceptance test)

- [ ] Physical WAN unplugged from venue router
- [ ] Auction PC on LAN Wi‑Fi/Ethernet only
- [ ] 2+ owner phones + 1 LED + 1 operator on same LAN
- [ ] Full auction run end-to-end with zero external network requests
- [ ] Visual comparison screenshot parity vs cloud run (same tournament data)

---

## 7. Risk summary

| Area | Risk | Blocks full-fidelity claim |
|------|------|----------------------------|
| Media (Cloudinary URLs) | Critical | Yes |
| Owner-app not served | Critical | Yes |
| Organiser auth missing | Critical | Yes |
| Auction API gaps (overlay, defer, stop-timer) | High | Yes |
| State payload gaps (lastOutcome, licenseStatus) | High | Yes |
| Branding endpoint missing | High | Yes |
| Tournament settings not imported (banner, audio) | High | Yes |
| Analytics/reports routes missing | Medium | Yes (reports in claim) |
| Cheer / liveviewer extras | Medium | Partial (if marketed) |
| Push notifications | Low | No (optional) |

---

## 8. Files reference index (quick lookup)

| Concern | Primary files |
|---------|----------------|
| Local server entry | `artifacts/bidwar-local/src/server/index.ts` |
| Local auction | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| Local import | `artifacts/bidwar-local/src/server/routes/local.ts` |
| Cloud export | `artifacts/api-server/src/routes/tournaments.ts` |
| Cloud auction (reference) | `artifacts/api-server/src/routes/auction.ts` |
| Cloud analytics | `artifacts/api-server/src/routes/analytics.ts` |
| Cloud auth | `artifacts/api-server/src/routes/auth.ts` |
| Cloud branding | `artifacts/api-server/src/routes/branding.ts` |
| Cloud upload | `artifacts/api-server/src/routes/upload.ts` |
| Local SQLite schema | `lib/db-local/src/setup.ts`, `lib/db-local/src/schema/*` |
| Organizer guard | `artifacts/auction-platform/src/components/organizer-guard.tsx` |
| Display shell | `artifacts/auction-platform/src/components/display/display-shell.tsx` |
| Media URLs UI | `artifacts/auction-platform/src/lib/cloudinary.ts` |
| Owner app | `artifacts/owner-app/` |
| Owner auth | `lib/api-base/src/owner-auth.ts` |
| Frontend bundle script | `artifacts/bidwar-local/scripts/copy-frontend.mjs` |
| Reports UI | `artifacts/auction-platform/src/pages/reports.tsx` |

---

## 9. Next step

**Await product/engineering approval** on:

1. Offline Package (zip + media bundling) as export format
2. Single-origin serving of auction-platform + owner-app
3. Local auth approach (exported password hash + JWT)
4. Phase order (P0 list above)

No code changes until approved.
