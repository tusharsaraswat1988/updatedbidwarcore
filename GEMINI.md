# GEMINI & ANTIGRAVITY PROJECT INSTRUCTIONS — BIDWAR

> **CRITICAL RULE: MANDATORY LIVING OPERATION MANUAL MAINTENANCE**
>
> Canonical File: `docs/BIDWAR_OPERATION_MANUAL.md`
>
> 1. **Definition of Done Requirement:**
>    Whenever ANY feature, screen, button, workflow, setting, permission, validation rule, or integration is:
>    - **Created**
>    - **Modified**
>    - **Renamed**
>    - **Moved**
>    - **Deprecated**
>    - **Removed**
>    You **MUST** update `docs/BIDWAR_OPERATION_MANUAL.md` in the **SAME task / pull request / commit** as the code change.
>
> 2. **Scope of Update:**
>    Update all affected manual sections:
>    - Route/screen inventory
>    - Role/permission matrix
>    - Step-by-step operating procedures and workflows
>    - Registration form fields & validation rules
>    - Button/action reference (prerequisites, eligible roles, outcomes, danger zones)
>    - State transitions
>    - Needs-verification registry (if unverified or mock)
>    - Change log with date and summary
>
> 3. **Never Fabricate:**
>    Always document from actual implementation. If behavior is unverified or external, mark it clearly as "Needs verification".
>
> 4. **Enforcement:**
>    Run `pnpm run check:manual` to verify that all 13 required sections exist and manual links are intact.
>    Do not consider any feature task complete without updating the Operation Manual!

---

## Architecture Principles
1. **Module Independence:** Auction and Sports Scoring are sibling modules. A Tournament can be Auction-only, Scoring-only, or Both. Never couple modules in ways that require one for the other.
2. **Global Member Identity:** Human identity is rooted in `members` (`mem_*`), distinct from capabilities, roles, or tournament participation.
3. **Protected Surfaces:** Public homepage (`/`), OBS overlays, LED screens, Fan pages, Team Owner app (`artifacts/owner-app`), Scorer pads (`/cricket/:matchId/score`, `/badminton/:matchId/score`) must not have their visual styles or operational behaviors regressed.
4. **Organiser Workspace:** Internal management surfaces use the shared light enterprise design system.
