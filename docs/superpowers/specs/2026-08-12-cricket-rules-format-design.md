# Cricket Rules & format — design

## Problem

Auction create no longer collects Sports competition/rules/formation (correct). Cricket nav has no replacement. Tournament Dashboard hides Competition Setup. Match Start / Runtime Prepare then fails on `COMPETITION_NOT_READY` (+ fixture/scheduling/match-config locks) with nowhere for organisers to fix it.

## Decision

- **Nav:** new cricket sidebar item **Rules & format** → `/tournament/:id/score/rules` (option B).
- **Page scope:** full Competition setup — variant, competition type, registration, formation, squad rules, rule profile, presentation profile, Save + Lock (option C).
- **Match-day unlock (logical B):** after Competition is locked, one primary action **Apply to matches** that readies fixtures + scheduling, locks match configuration, and runs Runtime Prepare for cricket scoring matches — so Start Match works without hunting Mission Control modules.

## Out of scope

- Putting Sports catalog questions back into auction create.
- Surfacing platform ModuleWorkspace jargon as the cricket home UI.

## UI

1. Sidebar: **Rules & format** (after Tournament settings).
2. Page sections: Format & competition · Formation & squad · Rule & presentation profiles · Lock · Apply to matches.
3. Pre-match error CTA links to Rules & format (not Mission Control).
4. Tournament Dashboard “Start Setup” for cricket points at Rules & format.

## API

- Existing: `GET/PATCH …/competition`, `POST …/competition/ready`.
- New: `POST /tournaments/:id/cricket/rules/apply-to-matches` — requires competition locked; for each cricket scoring match: ready linked fixture/scheduling draws when present, lock match configuration, `prepareRuntimeMatch` (best-effort per match; return per-match results).

## Success

Organiser can open Rules & format, lock setup, Apply to matches, then Start match on live scoring without Prepare validation dead-ends.
