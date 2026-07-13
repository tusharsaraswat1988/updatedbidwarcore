# Badminton Technical Debt (RC1)

Last updated: 2026-07-13  
Scope: Badminton organizer + scorer + display surfaces in `artifacts/auction-platform` and related API routes.

This document captures **known limitations**, **deferred features**, **production risks**, and a **future roadmap**. It is not a feature backlog for RC1 — RC1 is consistency and production readiness only.

---

## Known limitations

### Status & vocabulary
- Court ops board still uses internal enums (`EMPTY`, `FINISHED`) in code; UI maps them to **Idle** / **Completed**.
- Court entity status `in_use` remains the API value; UI displays **Live**.
- Some LED / OBS / scorer surfaces keep sport-specific wording for broadcast clarity.

### Connection & telemetry
- No real “viewer connected” telemetry for Venue Display / OBS Overlay.
- Soft status labels may say “following” without proving a client is attached.

### Timing & awards
- Match duration depends on `startedAt` / `endedAt` (or `elapsedMs`). Missing timestamps yield “—” for court averages and some awards.
- Tournament Summary awards are client-derived heuristics, not a server statistics engine.
- `badminton_analytics` table exists but is not fully populated on match completion.

### Results & standings
- League / round-robin standings are deferred.
- Player rankings / MVP / certificates / social cards are deferred.
- Champion detection prefers Final-round completed matches; bronze / consolation awards are not first-class.

### Archive / lifecycle
- “Tournament Completed” / archive messaging is **derived** from remaining matches/fixtures — scoring phase / lifecycle APIs are not auto-updated by badminton completion.
- Do not treat Summary archive copy as a hard lifecycle gate.

### Branding & dates
- Tournament match dates come from `tournaments.matchDates`, not badminton branding.
- Primary broadcast preference (if present on a branch) lives in `scoringSettingsJson.broadcast` and is additive.

### Shared caches
- Organizer pages share react-query keys inconsistently in places (`badminton-registrations*` variants). Mutations should invalidate broadly.

---

## Deferred features (intentionally not in RC1)

- Player rankings, MVP, AI analysis
- Certificates and social media cards
- League standings tables
- Dedicated tournament-level server PDF generator (Summary uses client DOM capture)
- Real-time overlay/venue connection counts
- Public unauthenticated Summary page (Summary is organizer-guarded today)
- Automatic scoringPhase → `completed` when all events finish
- Multi-language organizer UI

---

## Production risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Aggressive polling on busy event days if gates regress | Medium | Live-gated `refetchInterval` on Matches / Control / Results; keep SSE where available |
| Director terminal actions without confirm (pre-RC1) | High | RC1: `ConfirmActionDialog` on Walkover / Retirement / DQ / Force End |
| Tablet mis-taps on sub-40px controls | Medium | RC1: `min-h-11` pass on shared buttons + key organizer actions |
| Status synonym confusion for umpires/organizers | Medium | RC1: `format*StatusLabel` helpers in `badminton-ux.ts` |
| Client PDF export CORS / logo failures | Low | Prefer Cloudinary HTTPS logos; fall back to Print |
| Incomplete match timestamps skew awards | Low | Document in Summary UI; improve writer later |
| Feature-flag / scoring feature middleware off in env | High | Verify `scoringFeatureMiddleware` + license gates in staging |

---

## RC1 consistency work completed

- Shared status vocabulary helpers (`Ready`, `Live`, `Paused`, `Delayed`, `Completed`, `Walkover`, `Retired`, `Cancelled`, …)
- Destructive confirmations for Match Control outcomes; Categories delete uses `ConfirmActionDialog`
- Button hierarchy: Branding keeps one primary (Save); uploads/import demoted
- Touch targets: shared `BtnPrimary` / `BtnSecondary` / confirm dialogs / key category actions
- Polling hygiene: live-gated intervals + `staleTime` on Results / Control / Matches / incidents
- Empty-state CTAs on Results + Analytics
- Category / court / schedule / control-center display labels normalized

---

## Future roadmap (post-RC1)

1. **Server statistics read API** — expose `player_statistics` / court utilization for Summary & Analytics without N+1 client work.
2. **Lifecycle completion hook** — optional, explicit “Close tournament” that sets `scoringPhase` without changing scoring engine mid-event.
3. **Standings module** — round-robin tables as a dedicated Results subsection.
4. **Broadcast telemetry** — soft → hard connection status for Venue / OBS.
5. **A11y audit pass 2** — formal contrast audit on LED tokens vs organizer tokens; FormField `htmlFor` wiring.
6. **E2E tablet suite** — Playwright flows for Control Center + Scheduling on 10" viewport.

---

## Go / No-Go notes for release

**Go with conditions** if:
- Staging smoke passes: setup → schedule → score → results → summary
- Director walkover/retire confirmations verified
- No dual primary CTAs on Branding / hub day-of paths
- Polling does not melt API under a 4-court live test

**No-Go** if:
- Scoring commands fail or pin auth regresses
- Match Control can force-end without confirmation
- Organizer cannot recover from empty/error states (missing CTAs)
