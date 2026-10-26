# BIDWAR — FULL REPOSITORY AUDIT: PERSON IDENTITY, MULTI-ROLE ACCESS, MOBILE + CROSS-MODULE INTEGRATION

## Mission
Perform a thorough, evidence-backed audit of the complete BidWar codebase and produce a detailed report. This is an AUDIT AND DESIGN REPORT ONLY. Do not implement changes, run destructive migrations, modify production data, or refactor code during this task. Inspect the actual source, schema, migrations, routes, middleware, session logic, frontend apps, tests, scripts, and architecture docs. Do not infer implementation from docs alone.

Repository: tusharsaraswat1988/updatedbidwarcore (main)
Use the current checked-out repository state. Cite exact file paths, symbols/functions, and line ranges for every important claim. Clearly distinguish:
- VERIFIED IMPLEMENTED (supported by source/tests)
- PARTIALLY IMPLEMENTED
- DOCUMENTED ONLY / not found in code
- MISSING
- RISK / BUG
- RECOMMENDED CHANGE

Do not report a feature as implemented just because a plan or comment says it is implemented. For key flows, trace UI → API → middleware/service → database/schema/migration → response/state update → tests. Run available non-destructive tests/typechecks/lints relevant to the findings and record exact commands/results; do not claim tests passed without running them. If a check cannot run, state why.

## Binding architecture documents
Read and follow:
- docs/superpowers/specs/2026-08-05-platform-architecture-freeze.md
- docs/cricket-platform-master-plan.md, especially §11 Player Identity, §33 Domain Model, §36 Permissions/RBAC, §39 Testing Strategy, §40 Multi-Sport Contract
- Relevant existing implementation docs and recent specs/audits.
If documents conflict, identify the conflict. Respect the architecture freeze: no parallel platform identity models, no duplicate identity for existing concepts, existing runtime identities must be reused through bridges/adapters where specified, public/product API boundary must be respected, and auth/permissions must be enforced server-side. Do not use a blanket “rewrite” approach.

## Core question: one real person may have many roles
The same person/mobile number may legitimately be:
- a team owner AND a player;
- a player in an auction AND a team owner in that same auction/tournament;
- an organizer AND a registered/playing player AND a team buyer/owner;
- an organizer/scorer/umpire/player in different tournaments;
- a scorer for assigned matches and spectator elsewhere;
- owner of teams in multiple tournaments, with different teams;
- multiple roles with different scopes and permissions, sometimes in the same tournament;
- a public fan/viewer who later registers as a player or gets assigned another role.

The account must not be duplicated just because someone switches role or enters a different app. One phone can identify multiple role grants, but PHONE NUMBER MUST NOT be treated as unquestionable proof that records belong to the same human: phone numbers can be shared, recycled, changed, mistyped, or unverified. Audit verification and account linking methods carefully. Do not auto-merge records just because phone/email/name matches.

Audit the model and design a coherent target approach that separates:
1. Person/account identity (the user who can authenticate)
2. Authentication methods/verified identifiers (mobile, email, SSO etc. as actually supported)
3. Domain identities (global player registry record, organizer account, team, club, scorer profile etc.; do not conflate a human with the player/team identity)
4. Role grants (role/capability)
5. Scope/assignment (platform/org/tournament/team/match and sport context)
6. Active UI workspace/context (which part of the app the person is using right now)
7. Session/authentication state (secure, revocable server-verified credentials)
8. Audit trail (who did what, in what role/scope, and when).

Keep proposal compatible with existing architecture and migration constraints. Do not simply merge all role-specific tables or replace existing authentication mechanisms in one step. If introducing a canonical account/person identity layer is recommended, explicitly show how existing legacy identities are linked safely and progressively, what remains source of truth, reconciliation states, duplicate/conflict handling, rollback, and how migration avoids disrupting live auction/scoring.

## Mandatory source audit scope
First inventory the whole repo and module/package layout. Then follow every identity/auth/role flow and integration boundary, including at minimum:
- Organizer accounts and auth (registration/login/me/logout, cookies, account recovery, verification, permissions)
- Team owner/onboarding/access-code/mobile-number flow, selected tournament/team context, owner session DB persistence/expiry/revocation, owner app and mobile-app owner workspace
- Scorer account/PIN/login/session/assignment/match-lock flow, scorer lifecycle/deletion/unassignment, takeover, scoring authorization
- Player Registry/global player identity, auction player records, player registration, roster/team membership, stats and career profile; whether a human can claim/link existing player records without duplicating their identity/stats
- Umpire/official/referee identities, assignments, permissions, and UI (existing or missing)
- Organizer/operator/admin/delegated staff roles and separation of tournament ownership from platform administration
- Fans/public viewers and any optional account/registration flow
- Auction bidder/buyer/owner role, bidding identity, budget/RTS constraints, and whether an owner who is also a player or organizer can bid or be auctioned without collisions
- Role-selection/mobile routing/role registry, app shells, shared auth state, logout, session switching and deep links
- Main auction-platform, owner-app, scoring-app, mobile-app, OBS/LED/public score screens
- API routes, middleware, DB schemas and migrations, foreign keys/unique indexes, data cleanup scripts, background jobs, webhooks
- Cross-sport architecture and all existing sport adapters: avoid cricket-specific identity assumptions
- Automated tests and test gaps, including negative authz tests and cross-tenant/cross-tournament isolation.
Search all role names and all auth/session-related code; do not restrict to the listed directories. Track actual callers/consumers as well as definitions. Report dead/duplicate auth paths and inconsistent storage.

## Questions report MUST answer with source evidence
1. Is there one person/account identity shared across modules today, or multiple independent identities? Show exact evidence and boundaries.
2. What does “same mobile number” currently mean in each flow? Is it verified? Is it unique? Can multiple records share it? What exact DB constraints and code paths establish that?
3. Does switching roles preserve one authenticated person/session or initiate independent role-specific logins? Are session cookies/tokens compatible? What gets stored in localStorage/sessionStorage/cookies/native storage? Does frontend marker ever get trusted as real authentication?
4. Can a person be organizer + player + team buyer/owner in one tournament without creating duplicate users or causing authorization ambiguity? Prove from code/tests or mark unverified/not supported.
5. Can an auction player also own a team? Check self-purchase, self-bidding, owner-bidding, nominated/retained/player pool, budget, duplicate record and roster side effects. Document current business rules and suggest configurable policy where needed.
6. How are roles scoped today? Identify every role and its permission enforcement point. Find routes that rely on frontend hiding alone, permissive fallbacks, missing ownership filters, IDOR/cross-tenant risks, insecure direct object references, weak session invalidation and inconsistent cookie settings.
7. Are a “player record” and a “person account” conceptually and technically separate? How do registry, auction, roster and career stats avoid or create duplicates? What is the safe account-claim/link workflow?
8. Can one account own/manage different teams across tournaments while having player records and scoring assignments? Explain data model and user journeys.
9. Is scorer auth already global/person-level or tournament-specific in actual implementation? Audit the current DB/session/assignments/locks and any mobile integration. Do not replace a sound existing mechanism unnecessarily.
10. Does the Android mobile app share server auth correctly with web/API? What is already built? What does iOS require? Is iOS currently present? Verify from files/config, don't assume. Design shared cross-platform architecture that preserves one identity with multiple workspaces.
11. Do scoring/offline synchronization, event ordering, retries, idempotency, session expiry, live SSE/pubsub and multi-instance behavior work as implemented? Inspect code and tests; do not accept doc claims unverified.
12. What is the exact state of existing platform-level identities and bridges specified by the architecture freeze? Identify any drift or conflicting identity stores.
13. What is completed vs partial vs doc-only vs missing; what are P0/P1/P2/P3 risks; which recommendations are architectural vs implementation changes?
14. What is the safest sequence to reach target state while preserving existing live features and backward compatibility?

## Mandatory multi-role scenario matrix
For each scenario below, mark CURRENT: PASS / PARTIAL / FAIL / NOT PROVEN from code, and cite evidence. Define the expected target behavior and concrete tests.

A. Same phone/person is player + team owner in one tournament.
B. Same person is organizer + player + team buyer/owner in same tournament.
C. Same person is scorer + player, but scorer only has assigned match access.
D. Same person is organizer in Tournament A and team owner/player in Tournament B.
E. Same person owns Team A in Tournament A and Team B in Tournament B.
F. Same person plays for Team A but is owner/manager of Team B in same tournament.
G. Same person switches Organizer → Scorer → Owner → Player workspace without re-registering or losing valid sessions.
H. Player's verified mobile changes; their career stats and existing auction/roster history remain correctly linked.
I. Two humans legitimately share one mobile/phone number; cannot accidentally merge their identities or expose each other's private records.
J. A recycled phone number is reassigned; new holder cannot inherit prior user's roles, sessions or player profile.
K. Same person is entered twice as player via auction and roster import; detect/resolve duplicate safely without corrupting historical stats.
L. Organizer buys/owns a team and also nominates/participates as player; no privilege escalation or accidental exclusion.
M. Owner has multiple team contexts but can act only in explicitly selected team/tournament; no cross-team bidding/roster leakage.
N. Deactivated/removed scorer loses write ability and match lock promptly without destroying historical attribution.
O. Existing anonymous public fan later creates account and claims player profile with proof; public browsing remains frictionless.
P. Roles conflict in the same action (e.g. organizer validates own player registration, owner bids for a team containing self, scorer edits match as a player); define explicit conflict-of-interest policy/guardrails. Don't prohibit legitimate combinations blindly; separate role coexistence from actions requiring independent approval.

For self-purchase/owner/player/organizer cases, do NOT assume it must be universally allowed or universally forbidden. Audit existing product rules and distinguish:
- Can coexist as roles?
- Can be selected on an individual tournament/team?
- Which actions require restrictions, audit, or another approver?
Recommend configurable tournament policies with safe defaults if requirements are not determined by current product logic.

## Target architecture recommendation required
Propose a design that supports role coexistence without role explosion:
- Canonical person/account id only if justified by implementation gap and compatibility with the architecture freeze.
- Auth methods as independently verified, possibly shared or changed over time; phone not equal to immutable person id.
- Explicit links between account/person and existing organizer/scorer/player/domain identities with evidence/source/status/createdBy/timestamps and human-reviewed conflict resolution.
- Role grant records: principal/account + role/capability + scope type/id + sport/tenant + valid status/time; role grant is not a new person.
- Domain assignments: owner↔team/tournament, player↔roster/competition, scorer↔match/tournament, official↔match, organizer↔organization/tournament.
- Central server-side authorization/policy helper to evaluate effective permissions from grants + scope + resource + action; enforce at service/API/transaction boundaries, not merely UI.
- A workspace picker based on available grants; active workspace is UI context and never a security boundary. Switching workspace should not require separate registration. Explain session model given current cookie/origin/native platform realities, refresh/revocation, device storage and cross-subdomain API details.
- A robust account linking/claiming flow using verified channel plus existing account challenge or manual review when ambiguous; no silent merge by phone/name alone.
- Explicit conflict-of-interest policy (owner/player/organizer same person) and per-tournament settings; preserve audit attribution for the exact acting identity/role/scope.
- Backwards-compatible staged migration using a bridge/anti-corruption layer; no big-bang auth rewrite.
- Unique constraints and race-safe enrollment/linking; prevent duplicate player identities without assuming a phone is unique person identifier.
- Audit events for login, role grant/revoke, account linking, owner bidding, player registration, scorer actions, role/context switching when security relevant.
- Testable policy matrix, threat model, observability, rollout/rollback plan.
Every proposed table/schema must be labeled as PROPOSED, not current. Check existing schemas before recommending exact table names. Don't create new identities where architecture freeze says reuse existing tables.

## Detailed report structure
Create a thorough Markdown report in the repo, ideally:
docs/audits/2026-10-26-global-identity-multi-role-and-platform-integration-audit.md

Use these sections:
1. Executive summary (no unsupported green statements)
2. Scope, branch/commit inspected, methods and limitations
3. Architecture constitution and document-vs-code drift
4. Repo/module inventory and system dependency map
5. Current identity model (all account/person/domain identity concepts)
6. Current auth/session flows by role with sequence diagrams
7. Roles and permissions matrix (scope, actions, enforcement evidence)
8. Multi-role scenario test matrix A–P
9. Auction ownership/player/self-bidding/conflict-of-interest audit
10. Player identity, registry linking, stats continuity and de-duplication
11. Mobile Android/iOS/web shared identity/session analysis
12. Endpoint/API security audit: tenant isolation, IDOR, role guards, revocation
13. Scoring reliability/offline/realtime checks where relevant to identity and concurrency
14. Schema/migration/constraints/data integrity findings
15. Findings ranked P0/P1/P2/P3, with severity, impact, exploit/failure scenario, exact file+line evidence, reproduction steps, recommended fix, regression tests
16. Current state tracker: BUILT / PARTIAL / DOC-ONLY / MISSING / CHANGE REQUIRED
17. Recommended target architecture & diagrams
18. Safe migration phases (audit baseline → authorization hardening → identity linking foundation → gradual role adapters → clients/workspaces → iOS → rollout)
19. Test plan: unit, integration, contract, security, E2E, migrations, device tests
20. Concrete implementation backlog: epics/stories and acceptance criteria, no code changes in this audit
21. Open product policy decisions and safe defaults
22. Appendices: key paths/functions, commands & outputs, test results, code references.

## Evidence and quality bar
- Source line ranges on claims and a file inventory of what was actually inspected.
- Cite symbols/queries and include minimal code excerpts only when useful.
- Where code search is incomplete or unavailable, use repo-wide grep/search and targeted file reads; document limitations.
- Distinguish “no evidence found” from “proven absent”.
- List exact test commands and results; include number of tests run/skipped/failed if available.
- Run tests in non-production context only. Do not touch live customer data.
- Do not expose secrets, access tokens, phone numbers, or other personal data in report.
- Keep existing architecture freeze as a binding contract unless a later superseding freeze exists; cross-check that no later document supersedes it.
- Final answer to user should summarize findings, report path/commit, highest-priority discoveries, test results, and state clearly that no application code/migrations were changed.