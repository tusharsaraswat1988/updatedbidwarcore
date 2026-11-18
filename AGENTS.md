# BIDWAR — Repository Agent Instructions

All coding agents must follow [the BIDWAR AI Agent Execution Contract](docs/AI_AGENT_EXECUTION_CONTRACT.md) and the applicable domain/architecture rules.

## Repository knowledge
- Consult `docs/BIDWAR_OPERATION_MANUAL.md` when the requested task depends on existing user-facing workflows, roles, permissions, settings, or operating procedures.
- Read `.agents/skills/bidwar_architecture_skill/SKILL.md` before architectural, database, API, routing, authentication, performance, or module-boundary changes.
- Follow relevant scoped rules under `.cursor/rules/` and skills under `.agents/skills/`; do not apply a task-specific audit prompt or specialist workflow globally.

## Operation Manual — proportional Definition of Done
Update `docs/BIDWAR_OPERATION_MANUAL.md` when a completed change materially changes documented user-facing behaviour, operating procedures, routes, permissions, configuration, or supported workflows. Update only the affected sections and change log, based on verified implementation.
Do not update the manual for purely internal refactors, formatting, tests, dependency maintenance, or visual adjustments that do not change documented operation.
Run `pnpm run check:manual` after a manual update, or when the task specifically changes manual structure/validation. The check confirms document structure; it does not prove factual accuracy.

## Protected surfaces
Do not modify public marketing pages, OBS broadcast scenes, LED displays, owner app, or live scoring pads during an internal organiser UI task unless the user explicitly includes those surfaces in scope.
