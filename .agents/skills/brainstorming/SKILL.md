---
name: brainstorming
description: "Use when the user is exploring an idea, requests product discovery, or explicitly asks for design alternatives before implementation. Not a mandatory gate for clear implementation, bug-fix, audit, or maintenance requests."
---

# Brainstorming Ideas Into Designs

Use this skill to help turn an emerging idea into a clear product design through collaborative dialogue. This is an opt-in discovery workflow, not a universal prerequisite for coding.

## When to use
Use brainstorming when the user:
- is exploring an idea without a settled requirement;
- asks for product discovery, options, trade-offs, or a design proposal;
- explicitly asks to brainstorm or approve a design before implementation.

Do NOT use this skill as a gate when the user clearly asks to implement, fix, build, refactor, audit, test, verify, or maintain something. In those cases, follow the repository execution contract and proceed.

## Discovery workflow
1. Inspect relevant project context before asking questions.
2. Identify the actual unknowns. Ask only questions whose answers materially affect the solution; ask one focused question at a time.
3. For meaningful product choices, compare viable approaches and recommend one with concise trade-offs.
4. Present a proportionate design. A small feature may need only a short description; do not manufacture ceremony.
5. Ask for approval only when the user requested a design-first process or when a consequential product decision is unresolved.

## Transition to implementation
When the user approves a design, or when the user already gave clear implementation authorization:
- implement the agreed/requested scope;
- do not force a separate written-spec review loop unless requested or genuinely necessary;
- do not stop at a plan. Continue through implementation, relevant validation, and final reporting;
- follow any specialist skill that materially helps the requested implementation.

## Existing codebases
- Follow established patterns and architecture boundaries.
- Improve adjacent code only when it is necessary for the requested outcome.
- Avoid unrelated refactors and scope expansion.
- Preserve working behaviour and verify relevant regressions.

## Visual work
For UI/UX work, use the actual browser experience for visual verification when available. In Antigravity, use `/browser` to inspect rendered pages, responsive breakpoints, interaction states, and console/runtime issues. Do not claim visual verification if it was not performed.

## Output
Keep discovery concise. Record decisions only when they will be useful beyond the current conversation or are explicitly requested. Do not create or commit a design document by default.
