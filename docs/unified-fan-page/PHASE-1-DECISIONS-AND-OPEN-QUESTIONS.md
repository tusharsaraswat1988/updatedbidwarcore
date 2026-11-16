# PHASE 1 — ARCHITECTURAL DECISIONS & OPEN QUESTIONS (ADR REGISTRY)

> **Document 9 of 9:** Architecture Decision Records (ADRs) & Governance Sign-off  
> **Repository:** BidWar Core Platform  
> **Status:** Governance & ADR Specification — Approved for Documentation Only  
> **Canonical Target:** `docs/unified-fan-page/PHASE-1-DECISIONS-AND-OPEN-QUESTIONS.md`  

---

## 1. ARCHITECTURAL DECISION RECORDS (ADRs)

### ADR-01: Artifact Hosting Location for Unified Fan Page
- **Context:** Currently, `artifacts/auction-platform` is hosted at `/` (root), while `artifacts/scoring-app` is hosted at `/scoring-app/`. Directing fans from an auction to a cricket match requires navigating across different Vite application builds, triggering full browser reloads and destroying client React Query cache.
- **Decision:** Host the Unified Fan Page (`/tournament/:id/fan`) and Universal Fan Home (`/fan`) inside **`artifacts/auction-platform`**.
- **Justification:**
  1. `auction-platform` is already served at `/` and handles SSR / OpenGraph meta injection.
  2. Both `auction-platform` and `scoring-app` already share the same source tree (`artifacts/auction-platform/src`).
  3. Hosting both modules in the root Vite build allows instant, zero-reload tab switching via code-split lazy loading (`lazyWithRetry`), keeping memory cached and eliminating jarring reloads.
- **Consequences:** Eliminates the need to proxy public fan pages to `/scoring-app/`. `artifacts/scoring-app` remains dedicated to internal sports organizer / scorer workspaces.

---

### ADR-02: Legacy URL Preservation via Single-Hop Aliases
- **Context:** Thousands of tournament URLs are actively bookmarked or printed on physical event posters (e.g. `/live/:id`, `/:code/fanpage`, `/fan/:id`).
- **Decision:** All legacy URLs will be preserved indefinitely as **transparent in-app aliases** (or single-hop 302 redirects where necessary).
- **Justification:** Zero broken links for spectators, franchise owners, or event attendees.

---

### ADR-03: Module Tab State Synchronization via Query Parameter (`?tab=`)
- **Context:** In multi-module tournaments (`auctionEnabled && scoringEnabled`), users need to share deep links directly to the Auction or directly to the Scoring view.
- **Decision:** Represent the active module using URL search parameters: `/tournament/:id/fan?tab=auction` and `/tournament/:id/fan?tab=scoring`.
- **Justification:**
  1. Enables shareable deep links to specific tournament features.
  2. Integrates cleanly with standard browser Back/Forward navigation (`popstate`).
  3. Avoids deeply nested route paths that could create route collisions with existing sport paths.

---

### ADR-04: Strict Realtime SSE Lifecycle Isolation
- **Context:** Running both Auction SSE (`/auction/events`) and Scoring SSE (`/scoring/events`) simultaneously on mobile devices creates CPU battery drain, memory leaks, and duplicate state updates.
- **Decision:** Enforce strict unmounting and cleanup: when tab is `auction`, scoring SSE is closed; when tab is `scoring`, auction SSE is closed.
- **Justification:** Adheres to the BidWar Performance Isolation contract (`.agents/skills/bidwar_architecture_skill/SKILL.md`).

---

### ADR-05: Dedicated Paginated Discovery API (`GET /api/fan/tournaments`)
- **Context:** The existing `GET /api/tournaments` dumps all database rows in one unpaginated query, lacks search/sport filters, and leaks private test tournaments.
- **Decision:** Build a dedicated `GET /api/fan/tournaments` endpoint with Zod query validation, server-side pagination (`limit: 20`), live-state resolution, and multi-column ILIKE search.
- **Justification:** Protects the Node.js API server from out-of-memory crashes as tournament volume scales, while providing rich discovery semantics.

---

### ADR-06: Progressive Privacy Model (`featuresJson.visibility`)
- **Context:** BidWar needs to distinguish Public, Unlisted, and Private tournaments without forcing immediate risky database migrations.
- **Decision:** Store tournament visibility progressively inside the existing `tournamentsTable.featuresJson` column (`{ "visibility": "public" | "unlisted" | "private" }`), defaulting to `"public"` for legacy tournaments.
- **Justification:** Zero database migration risk during initial consolidation; provides instant support for Unlisted leagues.

---

### ADR-07: Frictionless Anonymous Spectator Discovery
- **Context:** Spectators discovering tournaments on Fan Home should not be forced to create accounts or sign in.
- **Decision:** Use browser `localStorage` (`bidwar_fan_favorites`) for bookmarking and recently viewed tournaments on the web.
- **Justification:** 100% friction-free viewing for public fans. Future mobile app phases can sync `localStorage` favorites into `memberRolesTable` (`role: 'fan'`).

---

## 2. OPEN QUESTIONS & USER DECISION POINTS

1. **Default Discovery Sorting:**
   - *Recommendation:* Prioritize active live tournaments first, followed by upcoming tournaments scheduled for today, then forthcoming chronological events.
   - *Status:* Approved in ADR-05.
2. **Cheer Chat Backend Unification:**
   - *Recommendation:* Keep Auction cheer (backend SSE broadcast) and Scoring cheer (local state) domain-independent during initial consolidation; explore unified backend event stream in a later phase.
   - *Status:* Approved in ADR-04.
3. **Database Column Migration for Visibility:**
   - *Recommendation:* Use progressive `featuresJson.visibility` first. If discovery traffic demands high-performance native indexing, schedule a formal SQL column migration after Phase 6.
   - *Status:* Approved in ADR-06.

---

## 3. FINAL CONFIRMATION & GOVERNANCE SIGN-OFF

- **Code Modification Status:** **0 application source files modified. 0 database migrations created.**
- **Documentation Outputs Created:**
  1. `docs/unified-fan-page/PHASE-1-ARCHITECTURE.md`
  2. `docs/unified-fan-page/PHASE-1-IMPLEMENTATION-CONTRACT.md`
  3. `docs/unified-fan-page/PHASE-1-ROUTE-MATRIX.md`
  4. `docs/unified-fan-page/PHASE-1-API-CONTRACT.md`
  5. `docs/unified-fan-page/PHASE-1-PRIVACY-CONTRACT.md`
  6. `docs/unified-fan-page/PHASE-1-REALTIME-CONTRACT.md`
  7. `docs/unified-fan-page/PHASE-1-UIUX-CONTRACT.md`
  8. `docs/unified-fan-page/PHASE-1-TEST-STRATEGY.md`
  9. `docs/unified-fan-page/PHASE-1-DECISIONS-AND-OPEN-QUESTIONS.md`
- **Internal Consistency Check:** All 9 contracts verified for cross-document terminology, route naming, and schema alignment.
- **Living Operation Manual Check:** Validated via `pnpm run check:manual`.
- **Domain Boundaries Check:** Validated via `pnpm run check:boundaries`.

---

```text
================================================================================
STATUS: PHASE 1 COMPLETE — PENDING USER APPROVAL FOR PHASE 2
================================================================================
```
