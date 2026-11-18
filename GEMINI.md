# GEMINI & ANTIGRAVITY PROJECT INSTRUCTIONS — BIDWAR

Follow `docs/AI_AGENT_EXECUTION_CONTRACT.md` as the authoritative execution policy for this repository.

## Architecture principles
1. **Module Independence:** Auction and Sports Scoring are sibling modules. A Tournament can be Auction-only, Scoring-only, or Both. Never couple modules in ways that require one for the other.
2. **Global Member Identity:** Human identity is rooted in `members` (`mem_*`), distinct from capabilities, roles, or tournament participation.
3. **Protected Surfaces:** Public homepage (`/`), OBS overlays, LED screens, Fan pages, Team Owner app (`artifacts/owner-app`), and Scorer pads (`/cricket/:matchId/score`, `/badminton/:matchId/score`) must not regress when they are outside the task scope.
4. **Organiser Workspace:** Internal management surfaces use the shared light enterprise design system.
5. **Architecture Contract:** Read `.agents/skills/bidwar_architecture_skill/SKILL.md` before architectural, database, API, routing, authentication, performance, or module-boundary changes.

## Operation Manual
Update `docs/BIDWAR_OPERATION_MANUAL.md` only when the implemented change materially changes documented user-facing behaviour or operating procedures. Update affected sections from verified code; do not fabricate behaviour. Purely internal refactors, formatting, tests, and visual-only adjustments that do not change documented operation do not require a manual edit.
