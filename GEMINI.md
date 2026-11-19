# GEMINI & ANTIGRAVITY PROJECT INSTRUCTIONS — BIDWAR

---

## Architecture Principles
1. **Module Independence:** Auction and Sports Scoring are sibling modules. A Tournament can be Auction-only, Scoring-only, or Both. Never couple modules in ways that require one for the other.
2. **Global Member Identity:** Human identity is rooted in `members` (`mem_*`), distinct from capabilities, roles, or tournament participation.
3. **Protected Surfaces:** Public homepage (`/`), OBS overlays, LED screens, Fan pages, Team Owner app (`artifacts/owner-app`), Scorer pads (`/cricket/:matchId/score`, `/badminton/:matchId/score`) must not have their visual styles or operational behaviors regressed.
4. **Organiser Workspace:** Internal management surfaces use the shared light enterprise design system.
