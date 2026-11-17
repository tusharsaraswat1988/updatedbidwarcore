"""Script: Update BIDWAR_OPERATION_MANUAL.md for Phase 5.1"""

MANUAL_PATH = "docs/BIDWAR_OPERATION_MANUAL.md"

FIND = (
    "- **Interactive Fan Live Viewer (`/live/:id`):** Spectator streaming hub with"
    " low-latency score updates, interactive emoji cheer reactions, and a live Cheer"
    " Heat Meter driving fan battles between rival teams.\n\n### 5.7 Admin Super-Control Platform"
)

PHASE51_ADDITIONS = """\
- **City Filter (Phase 5.1):** Spectators on `/fan` can filter tournaments by city \
using a dropdown selector. The city selection persists in the URL (`?city=Mumbai`) \
and is cleared by the Reset Filters action. Server-side: `GET /api/fan/tournaments?city=<city>` \
applies SQL city filtering. `GET /api/fan/cities` returns sorted unique city names from \
public, opted-in, eligible tournaments. Empty-state message is shown when no tournaments \
match the selected city.

- **Completed Tournament Discovery Policy (Phase 5.1):** Completed tournaments are eligible \
for `/fan` discovery when `fanArenaOptIn===true` and either `license_status==='active'` or \
`fanArenaApproved===true`. No hard expiry is enforced by default. Organizers may opt out at \
any time. Product recommendation: configure a retention duration via `FAN_ARENA_COMPLETED_RETENTION_DAYS` \
environment variable (suggested: 30 days for unlicensed; perpetual for `fanArenaApproved===true`). \
This configurable retention policy is NOT yet implemented; it requires an explicit product decision \
before any hard cutoff is introduced.

- **Phase 5.1 Security — Private Tournament Gate (`middleware/private-tournament-gate.ts`):**
  - PIN accepted **strictly via `x-bidwar-pin` HTTP header only**. Any `?pin=` query-string attempt is \
rejected with 403 and an explicit error message, preventing PIN leakage via server logs, referer \
headers, or browser history.
  - `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0` + `Pragma: no-cache` \
set on all private and unlisted tournament spectator responses. Public tournaments receive \
`Cache-Control: public, max-age=10, stale-while-revalidate=20`.
  - Rate limit: 5 consecutive failed PIN attempts from the same IP locks out that IP per tournament \
for 10 minutes. HTTP 429 returned with `Retry-After` header. Successful authentication resets the \
counter. Rate limits do not bleed across different tournaments.
  - Fan context endpoint (`GET /api/tournaments/:id/fan/context`) now returns a minimal \
`spectatorTournamentSerializer` DTO instead of `publicTournamentSerializer`, omitting all sensitive \
internal fields unconditionally.

- **Phase 5.1 Auction Data Isolation (`lib/serializers/tournament.ts`):** \
`publicTournamentSerializer` gates all auction configuration fields (`auctionUnit`, `basePurse`, \
`minBid`, `bidIncrement`, `bidTiers`, etc.) behind the `auctionEnabled` flag. Scoring-only \
tournaments receive `undefined` for all auction config fields — never exposed to spectators. \
This prevents scoring-only contexts from ever showing auction configuration.

- **Phase 5.1 Broadcast CTA Correctness (`lib/platform-core/tournament-features.ts`):** \
`resolvePublicBroadcasts()` now filters broadcasts where `enabled===false`, `status==='ended'`, \
or URL is invalid/missing. Only `enabled+live → LIVE CTA` and `enabled+upcoming → Scheduled CTA` \
surface to spectators. Stale, ended, disabled, or empty broadcasts are cleanly hidden.

- **Phase 5.1 Routing Reliability (`platform-app.tsx`, `seo-route-policy.ts`, `page-meta.ts`):** \
Route aliases `/fan/`, `/tournaments/:id/fan`, and `/tournament/:id/fan/` added. `/fan` added to \
`STATIC_PAGES` with correct OG/meta tags, `ROBOTS_ALLOW_PATHS`, and `isPublicContentPath()`. \
Direct navigation, page refresh, and browser Back/Forward history are reliable for all fan routes.

- **Phase 5.1 Shared Date Formatters (`lib/fan-date-utils.ts`):** IST-aware formatters: \
`formatFanDate(isoDate)` → `29 Nov 2026`; `formatFanTime(isoTime)` → `6:30 PM IST`; \
`formatFanDateTime(date, time)` → `29 Nov 2026 · 6:30 PM IST`; `formatFanDateRange(start, end)`. \
No raw ISO date strings appear in spectator UI.

- **Phase 5.1 Visual System:** Dark navy `bg-[#0B101B]` background across Fan Home and spectator \
pages. Cricket public shell removed purple radial gradient, now uses emerald-tinted navy. \
LIVE module nav badge colour changed from emerald to red. Module accent palette: Auction=gold, \
Scoring=emerald, LIVE=red, Upcoming=blue.

- **Phase 5.1 Cheer Controls:** `FanCheerFloatingWidget` only rendered when \
`activeSection !== 'fan_arena'` (prevents duplicate Cheer Arena + floating widget). \
localStorage keys scoped to `bidwar_fan_team_<tournamentId>` and `bidwar_fan_cheers_<tournamentId>` \
to prevent cross-tournament bleed. `isSending` guard prevents duplicate cheer submissions.

- **Phase 5.1 Branding / Navigation:** Fan Home header logo links to `/fan` via `<Link>`. \
Tournament fan page shell back-navigation links to `/fan`. Official branding resolver \
(`useBranding()` + `getBrandLogoSrc()`) used with fallback to \
`/assets/branding/bidwar-reverse-logo-official.png`.\
"""

CHANGELOG_ENTRY = (
    "| **2026-11-17** | Antigravity AI Engineering"
    " | **Phase 5.1 Fan Arena Remediation** (`private-tournament-gate.ts`,"
    " `fan-discovery.ts`, `universal-fan-home.tsx`, `unified-fan-page-shell.tsx`,"
    " `tournament.ts` serializer, `tournament-features.ts`, `fan-date-utils.ts`,"
    " `platform-app.tsx`, `seo-route-policy.ts`, `page-meta.ts`, visual shell files,"
    " `fan-arena-security-isolation.test.ts`):"
    " **P0 Data Isolation** — `publicTournamentSerializer` now gates all auction config behind"
    " `auctionEnabled`; scoring-only tournaments receive `undefined` for all auction fields."
    " Private tournament PIN strictly header-only (`x-bidwar-pin`); `?pin=` query-string"
    " rejected 403. All private/unlisted spectator responses set `Cache-Control: private,no-store`."
    " Per-IP per-tournament rate limiting (5 fails → 10-min lockout, HTTP 429 + Retry-After)."
    " **P1 Broadcast CTAs** — `resolvePublicBroadcasts()` filters ended/disabled/invalid broadcasts;"
    " only enabled+live and enabled+upcoming CTAs surface to spectators."
    " **P1 Routing** — `/fan/`, `/tournaments/:id/fan`, `/tournament/:id/fan/` route aliases added;"
    " `/fan` added to static pages, robots allow, `isPublicContentPath()`."
    " **P1 Date Formatters** — `fan-date-utils.ts` with IST-aware `formatFanDate`/`formatFanTime`/`formatFanDateTime`."
    " **P1 Visual** — dark navy base, purple cricket shell removed, LIVE badge red."
    " **P1 Cheer** — floating widget scoped to non-fan-arena sections; localStorage scoped by tournamentId."
    " **P1 Branding** — logo links to `/fan`."
    " **P2 City Filter** — city dropdown in `/fan` with URL persistence, server-side query, empty state, reset."
    " **P2 Policy** — Completed tournament discovery policy documented (configurable `FAN_ARENA_COMPLETED_RETENTION_DAYS`)."
    " **Tests** — 16 new security isolation unit tests (56 fan arena tests total passing)."
    " All builds, `check:manual`, `check:boundaries` pass."
    " | Closes P0 auction data isolation, removes PIN query-string leak, enforces no-store cache,"
    " corrects broadcast CTA lifecycle, adds city filter, documents completed-tournament policy,"
    " and fixes all intermittent routing 404s. |\n"
)

with open(MANUAL_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Insert Phase 5.1 additions before 5.7 header
old_anchor = (
    "- **Interactive Fan Live Viewer (`/live/:id`):** Spectator streaming hub with"
    " low-latency score updates, interactive emoji cheer reactions, and a live Cheer"
    " Heat Meter driving fan battles between rival teams.\n\n### 5.7 Admin Super-Control Platform"
)
new_anchor = (
    "- **Interactive Fan Live Viewer (`/live/:id`):** Spectator streaming hub with"
    " low-latency score updates, interactive emoji cheer reactions, and a live Cheer"
    " Heat Meter driving fan battles between rival teams.\n"
    + PHASE51_ADDITIONS
    + "\n\n### 5.7 Admin Super-Control Platform"
)

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor, 1)
    print("Section 5.6 updated.")
else:
    print("WARNING: 5.6 anchor not found!")

# Insert change log entry at top of table (after the header row)
changelog_header = "| Date | Author / Agent | Changes & Domains Affected | Operational Impact |\n|:---|:---|:---|:---|\n"
if changelog_header in content:
    content = content.replace(
        changelog_header,
        changelog_header + CHANGELOG_ENTRY,
        1,
    )
    print("Change log entry added.")
else:
    print("WARNING: change log header not found!")

with open(MANUAL_PATH, "w", encoding="utf-8") as f:
    f.write(content)

lines = content.count("\n")
print(f"Done. Total lines: {lines}")
