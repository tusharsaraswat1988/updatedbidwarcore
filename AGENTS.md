# AI AGENT DIRECTIVES — BIDWAR REPOSITORY

> **MANDATORY DEFINITION-OF-DONE: LIVING BIDWAR OPERATION MANUAL**
>
> All AI coding agents (Antigravity, Cursor, Gemini, Claude, Codex) working on this repository MUST follow this non-negotiable rule:
>
> **Canonical File:** `docs/BIDWAR_OPERATION_MANUAL.md`
>
> Whenever any feature, screen, button, workflow, setting, permission, registration field, or validation rule is:
> - **Created**
> - **Modified**
> - **Renamed**
> - **Moved**
> - **Deprecated**
> - **Removed**
>
> You **MUST update `docs/BIDWAR_OPERATION_MANUAL.md` in the exact same task/PR/commit** as the code change.
>
> Validation command:
> ```bash
> pnpm run check:manual
> ```
>
> PRs or commits that change features without updating `docs/BIDWAR_OPERATION_MANUAL.md` fail the Definition of Done.
> Do not fabricate feature behavior. Document strictly what is implemented.

---

## Core Engineering Directives
- **Architecture Contract:** Read `.agents/skills/bidwar_architecture_skill/SKILL.md` before making module-boundary, database, routing, or authentication changes.
- **Protected Surfaces:** Do not modify public marketing pages, OBS broadcast scenes, LED displays, owner app, or live scoring pads during internal organiser UI tasks.
- **Operation Manual as Knowledge Base:** Consult `docs/BIDWAR_OPERATION_MANUAL.md` to understand any existing feature before altering it.
