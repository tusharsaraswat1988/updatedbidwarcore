# Frontend Audit

**App:** `artifacts/auction-platform` (Vite + React + wouter)  
**Owner app:** `artifacts/owner-app` (auction only, no scoring)

---

## Routing Architecture

### Production (`main`) — Cricket scoring routes

| Route | Page | Auth | Rating |
|-------|------|------|--------|
| `/tournament/:id/score` | `scoring-match-list.tsx` | Organizer | **PASS** (cricket) |
| `/tournament/:id/score/:matchId` | `scoring-match.tsx` | Organizer | **PASS** (cricket) |
| `/tournament/:id/score-display` | `score-display.tsx` | Public | **PASS** (cricket LED) |
| `/tournament/:id/display` | `display.tsx` | Public | **PASS** (auction LED) |
| `/tournament/:id/obs` | `obs-overlay.tsx` | Public | **PASS** (auction OBS) |
| `/tournament/:id/liveviewer` | `liveviewer.tsx` | Public | **PASS** (auction) |

### Badminton branch — Additional routes

| Route | Page | Auth | Rating |
|-------|------|------|--------|
| `/tournament/:id/badminton` | `badminton/tournament-hub.tsx` | Organizer | **PASS** |
| `/tournament/:id/badminton/players` | `badminton/players.tsx` | Organizer | **PASS** |
| `/tournament/:id/badminton/matches` | `badminton/matches.tsx` | Organizer | **PASS** |
| `/badminton/:matchId/score` | `badminton/scorer.tsx` | Public/PIN | **WARNING** (no tournament in URL) |
| `/badminton/:matchId/display` | `badminton/display.tsx` | Public | **PASS** |
| `/badminton/:matchId/overlay` | `badminton/overlay.tsx` | Public | **PASS** |

### Frontend gaps (badminton branch) — **FAIL**

- Hub links to `/tournament/:id/badminton/courts` and `.../categories` — **routes not registered** in `App.tsx`
- No sport-aware routing in main `tournament-hub.tsx` — only shows cricket standings when `sport === "cricket"`

**Evidence:** `tournament-hub.tsx:48` — `tournament?.sport === "cricket" && scoringEnabled`

---

## Component Architecture

### Cricket scoring components — `components/scoring/`

| Component | Cricket assumptions | Rating |
|-----------|---------------------|--------|
| `live-scoring-pad.tsx` | Innings, overs, balls, striker/bowler, extras, wickets | **FAIL** |
| `pre-match-setup.tsx` | Toss, elected to bat/bowl, overs limit, playing XI | **FAIL** |
| `scorer-shell.tsx` | Cricket state shape | **FAIL** |
| `score-display-shell.tsx` | Overs, wickets, run rates, innings display | **FAIL** |
| `match-summary-card.tsx` | Cricket summary projection | **FAIL** |
| `standings-table.tsx` | NRR column, W/L/T/NR/points | **FAIL** |
| `score-button.tsx` | Run values 0/1/2/3/4/6, wicket, wide, no-ball | **FAIL** |

### Badminton components — `components/badminton/` (branch)

| Component | Sport coupling | Rating |
|-----------|----------------|--------|
| `scorer-panel.tsx` | Badminton point UI | **PASS** (isolated) |
| `broadcast-display.tsx` | Game/score/side display | **PASS** (isolated) |
| `obs-overlays.tsx` | compact/full/intro/winner/sponsor | **PASS** (isolated) |

**Verdict:** No shared scoreboard shell. Complete UI fork per sport.

---

## Client Data Layer

| Layer | Cricket | Badminton | Rating |
|-------|---------|-----------|--------|
| API client | Hand-written `lib/scoring-api.ts` | Inline fetch in `use-badminton-match.ts` | **WARNING** |
| Hooks | `use-scoring-match.ts`, `use-scoring-socket.ts` | `use-badminton-match.ts` (Query + SSE) | **WARNING** |
| Match logic | `lib/scoring-match-logic.ts`, `scoring-ball.ts` | In `@workspace/badminton-core` commands | **WARNING** |
| Generated client | OpenAPI for auction only | N/A | **FAIL** |

---

## Cricket Assumptions in Non-Scoring UI

| Location | Assumption | Rating |
|----------|------------|--------|
| `pages/players.tsx` | batting_style, bowling_style fields | **WARNING** |
| `pages/player-register.tsx` | Cricket role specs, CricHero URL | **WARNING** |
| `pages/tournament-new.tsx` | Sport dropdown (includes badminton) | **PASS** |
| `pages/tournament-settings.tsx` | Cricket Scoring tab, overs defaults | **WARNING** |
| `pages/seo-sport-landing.tsx` | Cricket SEO copy | **PASS** (marketing) |
| `hooks/use-role-spec-groups.ts` | Sport-aware specs | **PASS** |
| `pages/liveviewer.tsx` | Auction cheer, not scoring | **PASS** |

---

## Tournament Operations UI

| Feature | Cricket path | Badminton path | Rating |
|---------|--------------|----------------|--------|
| Hub entry | Scoring links if `scoringEnabled` | Separate `/badminton` hub | **WARNING** |
| Standings | `StandingsTable` with NRR | Dashboard KPIs only | **FAIL** |
| Match list | `/score` | `/badminton/matches` | **WARNING** |
| Player management | `/players` (auction) | `/badminton/players` | **FAIL** |
| Draw generation | N/A | API only (no UI for categories) | **FAIL** |

---

## Display / Overlay Screens

| Screen | Cricket | Badminton | Shared? |
|--------|---------|-----------|---------|
| Venue LED | `score-display.tsx` | `broadcast-display.tsx` | **FAIL** |
| OBS overlay | `obs-overlay.tsx` (auction) | `obs-overlays.tsx` (scoring) | **FAIL** |
| Theme sync | `BroadcastChannel` in display | Unknown | **WARNING** |
| Sponsor slots | Auction display | Badminton overlay variants | **WARNING** |

---

## Plugin-Based Sport Architecture — Feasibility

### Current state: **FAIL**

No registry, no lazy sport modules, no shared interfaces for:
- Scorer pad
- Live display
- OBS overlay
- Standings widget

### Minimum plugin shape (defer full implementation)

```typescript
// Conceptual — NOT implementing
type SportModule = {
  slug: string;
  routes: RouteConfig[];
  ScorerPage: ComponentType;
  DisplayPage: ComponentType;
  OverlayPage: ComponentType;
  HubSection?: ComponentType;
};
```

### What exists today that helps

- `tournaments.sport` / `sport_id` for hub dispatch
- Lazy route loading pattern in `App.tsx`
- Shared layout (`AppLayout`, `OrganizerGuard`)

### Practical P0 for merge

1. Add sport dispatch in `tournament-hub.tsx`:
   - `cricket` + `scoringEnabled` → existing scoring links
   - `badminton` → link to `/tournament/:id/badminton`
2. Register missing badminton routes (courts, categories) or remove dead links.
3. Do **not** refactor scoring components into plugins yet.

---

## Owner App — **PASS**

`artifacts/owner-app` is auction-only. No cricket scoring assumptions. Independent product journey.

---

## Area Ratings Summary

| Area | Rating | Notes |
|------|--------|-------|
| Route structure | WARNING | Parallel trees per sport |
| Cricket scorer UI | PASS (cricket) / FAIL (multi-sport) | Deeply coupled |
| Cricket LED display | PASS (cricket) / FAIL (multi-sport) | Overs/innings hardcoded |
| Badminton UI (branch) | PASS | Complete but isolated |
| Tournament hub | WARNING | Cricket-only standings |
| Player forms | WARNING | Cricket fields on generic pages |
| OBS/broadcast | WARNING | Duplicated overlay systems |
| Plugin architecture | FAIL | Not started |
| Auth guards | PASS | `OrganizerGuard` reusable |
| API client consistency | FAIL | Hand-written vs inline |

---

## Risks

1. **Operator confusion** — Two hubs, two scorer URLs, two display URLs.
2. **Maintenance duplication** — OBS overlay features must be built twice.
3. **Dead links** — Badminton hub courts/categories routes missing.
4. **Bundle size** — Loading all sport UIs regardless of tournament sport (minor today).

---

## Recommendations

| Priority | Action |
|----------|--------|
| P0 | Sport-aware `tournament-hub` navigation |
| P0 | Fix or remove badminton dead links |
| P1 | Extract shared `LiveDisplayFrame` (logo, sponsors, connection banner) — not scorer logic |
| P1 | Generate or unify API clients for scoring + badminton |
| P2 | Sport module registry when sport #3 is scoped |
| Defer | Generic plugin architecture |
