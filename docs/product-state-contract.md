# Product State Contract

**Status:** Architecture lock only — not enforced by schema, APIs, or UI yet.  
**Scope:** Sport-agnostic. Future sports reuse the same lifecycle.  
**Shared vocabulary:** `@workspace/api-base/tournament-rules` → `product-state-contract.ts`

Do not confuse with:

| Concept | Meaning | Type |
|--------|---------|------|
| Tournament Format | HOW the draw is structured (Knockout, League, Swiss, …) | `TournamentFormatKey` |
| Draw Stage | WHERE a match sits (QF, SF, Final, …) | `DrawStageKey` |
| Tournament Match Format | Scoring rules (points / best-of) | `TournamentRulesConfig` |
| **Product state** | Lifecycle of tournament or match | this contract |

---

## 1. Tournament lifecycle

```
Draft
  → Setup
  → Draw Ready
  → Match Scheduling
  → Ready To Start
  → Live
  → Completed
  → Archived
```

Valid transitions (and allowed reverse before Live) are defined in
`TOURNAMENT_PRODUCT_TRANSITIONS`. No skipping forward (e.g. Setup → Live).

### Draft

| | |
|--|--|
| **Meaning** | Tournament shell exists; not yet in organizer setup flow. |
| **Allowed** | Create/edit core identity (name, sport, dates, venue); delete tournament; enter Setup. |
| **Blocked** | Draw generation; match scheduling; starting matches; public live surfaces. |
| **Editable modules** | Branding, Players, Categories, Tournament Match Format (all open). Draw & Fixtures / Court Assignment N/A. |

### Setup

| | |
|--|--|
| **Meaning** | Organizer configures tournament before draws. |
| **Allowed** | Edit branding, players/entries, categories, tournament default match format, courts definition; mark setup complete → Draw Ready when prerequisites met. |
| **Blocked** | Generate/finalize fixture collections as authoritative; schedule fixtures as live schedule; start matches. |
| **Editable modules** | Branding, Players, Categories, Tournament Match Format — open. Draw & Fixtures — prepare only (not finalize). Court Assignment — define courts only. |

### Draw Ready

| | |
|--|--|
| **Meaning** | Fixture collections may be created; stage keys assigned by adapters that produce brackets. |
| **Allowed** | Auto Generate / Manual / Import (when available); review collections; regenerate until Match Scheduling; proceed to Match Scheduling. |
| **Blocked** | Start matches; treat schedule as final; change category structure that invalidates fixtures without recreating collections. |
| **Editable modules** | Branding — open. **Players — locked** (accepted entries freeze). **Categories — locked**. Tournament Match Format — still open until Ready To Start. Draw & Fixtures — allowed. Court Assignment — define courts. |

### Match Scheduling

| | |
|--|--|
| **Meaning** | Fixtures become matches; times/courts assigned. |
| **Allowed** | Create matches from fixtures (stamp format from `fixture.stageKey`); schedule times; assign courts; move to Ready To Start when schedule is complete enough. |
| **Blocked** | **Regenerate / rewrite fixture collections**; start tournament-wide Live; change categories/players in ways that orphan fixtures. |
| **Editable modules** | Branding — open. Players / Categories — locked. Tournament Match Format — open until Ready To Start. **Draw & Fixtures — locked**. Court Assignment — open. |

### Ready To Start

| | |
|--|--|
| **Meaning** | Schedule and courts ready; waiting for first live match / go-live. |
| **Allowed** | Final court tweaks; mark matches Ready; start individual matches (→ tournament may enter Live); enter Live. |
| **Blocked** | Draw regeneration; structural category/player edits; changing Tournament Default Match Format for the event. |
| **Editable modules** | Branding — open (cosmetic). Players / Categories / **Tournament Match Format — locked**. Draw & Fixtures — locked. Court Assignment — open until Live. |

### Live

| | |
|--|--|
| **Meaning** | At least one match is Live, or tournament explicitly opened for play. |
| **Allowed** | Score live matches; complete matches; limited operational court reassignment only via explicit ops policy (default: locked). |
| **Blocked** | Edit branding structure, players, categories, tournament match format, draws; delete tournament. |
| **Editable modules** | **All listed modules locked** (branding, players, categories, tournament match format, draw generation, court assignment). |

### Completed

| | |
|--|--|
| **Meaning** | All competitive matches finished (or tournament closed). |
| **Allowed** | Results review; verification workflows; reports; archive. |
| **Blocked** | Restart draws; change historical match formats; reopen scoring except verified correction flows (out of scope). |
| **Editable modules** | All locked. |

### Archived

| | |
|--|--|
| **Meaning** | Read-only historical record. |
| **Allowed** | View / export. |
| **Blocked** | All mutations. |
| **Editable modules** | All locked permanently. |

---

## 2. Match lifecycle

```
Draft
  → Scheduled
  → Court Assigned
  → Ready
  → Live
  → Completed
  → Verified
```

Valid transitions: `MATCH_PRODUCT_TRANSITIONS`.  
**Invalid:** any skip into Live without Ready (except documented emergency override — out of scope); Live → Scheduled; Completed → Live; Verified → any prior state.

### Draft

| | |
|--|--|
| **Valid next** | Scheduled |
| **Invalid** | Live, Completed, Verified |
| **Locks** | None. Format may still resolve from cascade at stamp time. |

### Scheduled

| | |
|--|--|
| **Meaning** | Match exists on schedule; may lack court. |
| **Valid next** | Court Assigned; back to Draft |
| **Invalid** | Live (must pass Court Assigned → Ready unless policy says otherwise) |
| **Locks** | Stamped `match_format_json` should already be set when created from fixture; treat as provisional until Live. |

### Court Assigned

| | |
|--|--|
| **Meaning** | Court (and typically time) assigned. |
| **Valid next** | Ready; back to Scheduled |
| **Invalid** | Jump to Completed |
| **Locks** | Court changeable until tournament Live / match Live per module rules. |

### Ready

| | |
|--|--|
| **Meaning** | Pre-start confirmed (sides, officials, lineup as required). |
| **Valid next** | Live; back to Court Assigned |
| **Invalid** | Skip to Verified |
| **Locks** | **Roster / sides locked** (`MATCH_ROSTER_LOCKED_FROM = ready`). Format still re-resolvable only until Live. |

### Live

| | |
|--|--|
| **Meaning** | Scoring in progress. Corresponds to `MATCH_STARTED` freeze. |
| **Valid next** | Completed |
| **Invalid** | Back to Ready / Scheduled; change format; change sides |
| **Locks** | **Match format frozen**; roster frozen; scoring engine authoritative. |

### Completed

| | |
|--|--|
| **Meaning** | Result recorded; pending verification. |
| **Valid next** | Verified |
| **Invalid** | Resume Live scoring (except audited reopen — out of scope) |
| **Locks** | Format and result locked for normal edits. |

### Verified

| | |
|--|--|
| **Meaning** | Result accepted for standings / archive. |
| **Valid next** | (none) |
| **Invalid** | Any prior state |
| **Locks** | Fully locked. |

### Match creation paths (reminder)

1. **From fixture:** `Fixture.stageKey` → resolve format → stamp `match_format_json` → freeze on Live / `MATCH_STARTED`.  
2. **Manual:** optional Stage dropdown; default Exhibition / Friendly (no stage) → tournament/category default only.

---

## 3. Editing rules (when modules lock)

| Module | Locked from tournament state (inclusive) | Notes |
|--------|------------------------------------------|--------|
| Branding | **Live** | Cosmetic edits discouraged after Ready To Start; hard lock at Live. |
| Players | **Draw Ready** | Accepted entries must not change under generated draws. |
| Categories | **Draw Ready** | Structure frozen before / with authoritative draws. |
| Tournament Match Format | **Ready To Start** | Default scoring rules freeze before go-live. Stage overrides for unstarted matches may be tightened later without changing this contract. |
| Draw & Fixtures | **Match Scheduling** | No regenerate / rewrite collections once scheduling has started. |
| Court Assignment | **Live** | Open through Match Scheduling and Ready To Start. |

Match-level overlays:

| Concern | Locked from match state |
|---------|-------------------------|
| Scoring format (stamped + engine) | **Live** (`MATCH_FORMAT_LOCKED_FROM`) |
| Roster / sides | **Ready** (`MATCH_ROSTER_LOCKED_FROM`) |

Archived tournaments: every module locked.

---

## 4. Non-goals (this contract)

- Does not change DB enums or API status strings yet.
- Does not implement guards or UI disablement.
- Does not replace badminton `category.phase` or `scoring_matches.status` — those map onto this contract in a later phase.
- Does not define cancel / walkover / void exception graphs (add as extensions; do not fork the happy path).

---

## 5. Implementation note for later phases

Enforcement should import vocabulary from `product-state-contract.ts` and map sport-specific storage onto `TournamentProductState` / `MatchProductState`. Do not introduce sport-private lifecycle names for the same product meaning.
