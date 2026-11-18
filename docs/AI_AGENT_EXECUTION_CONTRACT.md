# BIDWAR — AI AGENT EXECUTION CONTRACT

This contract governs execution behaviour for Antigravity, Cursor, Gemini, Claude, Codex, and other coding agents working in this repository.

## 1. Default execution mode
- Treat a clear request to implement, fix, build, refactor, audit, test, or verify as authorization to perform that requested work.
- Execute the complete requested scope in the current task. Do not stop after a plan, one file, one component, or a progress summary when more requested work remains.
- Work through related files and dependencies, then validate the integrated result.
- Do not ask for approval between components, phases, commits, or routine implementation decisions.
- If the user explicitly asks for analysis/audit/plan only, do not implement. Respect the requested mode.
- If a requirement is genuinely ambiguous and choosing incorrectly could cause material product, data, security, or UX impact, ask one focused question. Otherwise make a conservative, documented assumption and continue.

## 2. Approval and safety boundaries
Approval is required before:
- destructive or irreversible production data changes;
- production deployment, release, DNS/domain changes, or live infrastructure changes;
- actions that incur material cost or contact external users;
- changing credentials, secrets, access policies, or security posture in a way that could lock users out;
- expanding scope beyond the user's request in a material way.

Approval is not required for ordinary local code edits, non-destructive tests, typechecks, linting, browser verification, or creating a working branch/commit for the requested work.

Never claim an action succeeded until the tool or command confirms it. Never invent test results.

## 3. Brainstorming is opt-in, not a universal gate
Use the brainstorming skill when the user is exploring an idea, asks for product discovery, or explicitly requests alternatives/design exploration.
Do not invoke a mandatory design-approval workflow for:
- explicit implementation instructions;
- bug fixes and regressions;
- requested audits or code reviews;
- routine UI refinements with clear direction;
- configuration, documentation, test, or maintenance tasks.
For clear implementation requests, make reasonable design decisions consistent with existing product patterns and proceed. Do not create and commit a separate design specification unless requested or genuinely necessary.

## 4. Completion standard
A task is complete only when:
1. every requested deliverable has been addressed or explicitly identified as blocked;
2. relevant code paths and dependent components have been handled;
3. appropriate checks have been run and their exact outcomes recorded;
4. UI work has been inspected in a browser at relevant breakpoints/states when a browser environment is available;
5. the Operation Manual has been updated only where the implemented change materially changes documented user-facing behaviour or operations;
6. the final response distinguishes completed, not completed, blocked, and unverified work.

Do not stop merely because one check fails. Diagnose and fix failures within scope; if a blocker cannot be resolved safely, continue independent work and report the blocker precisely.

## 5. Scope discipline and protected surfaces
Respect explicit scope boundaries in the user's task and applicable domain-specific rules. Do not modify protected surfaces unrelated to the requested task. Do not use a protected-surface rule to avoid work on a surface the user explicitly asked to change; call out genuine conflicts and ask only when necessary.

## 6. Browser verification
For UI/UX implementation or visual audits, use Antigravity `/browser` when available to inspect the actual rendered experience, including relevant desktop/mobile sizes, interactions, loading/empty/error states, and console/runtime errors. A code-only review is not equivalent to visual verification. If browser access is unavailable, state that limitation.

## 7. Reporting
Keep progress updates concise and useful. Do not repeatedly ask the user to approve already-authorized work. Final reporting must include:
- what changed;
- important files/areas touched;
- checks actually run and results;
- any remaining risks, blockers, or unverified items.
