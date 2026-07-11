# BidWar Runtime DDL Blocker Analysis

> Phase 2. Why Systems C/D cannot be removed **today**, and how each blocker is eliminated.  
> Complexity/risk are relative engineering judgments (not calendar estimates).

---

## Blocker summary

Runtime DDL cannot be removed today because production **depends on it as the primary schema delivery mechanism**, deploy docs do not guarantee migrate/push, there is **no ledger**, several objects exist **only** via runtime paths, and System C still performs **data repairs** that have not been proven universally complete.

---

## Blocker 1 — No authoritative applied-version ledger

| | |
|--|--|
| **Why it exists** | Drizzle config has no migration journal; `migrate.ts` re-executes labels without recording success in a versions table; healers use IF NOT EXISTS instead of versions. |
| **How to eliminate** | Introduce journaled migrator; baseline-stamp prod; gate deploys on ledger. |
| **Complexity** | Medium |
| **Risk** | Medium (wrong baseline stamp) |

---

## Blocker 2 — Deploy path does not migrate before rollout

| | |
|--|--|
| **Why it exists** | `DEPLOY.md` / Dockerfile / CI do not run `db:push` or `migrate`; operators rely on restart healers. |
| **How to eliminate** | CD migrator job + verify stage before API rollout (`DEPLOYMENT_ARCHITECTURE.md`). |
| **Complexity** | Medium |
| **Risk** | Medium (process change; failed gates) |

---

## Blocker 3 — App binaries assume columns healers create

| | |
|--|--|
| **Why it exists** | Drizzle schema includes columns historically added via C/D; engineers ship app+healer together. |
| **How to eliminate** | Ship schema via migrations first; freeze healer content; CI bans new healer DDL. |
| **Complexity** | Low–Medium |
| **Risk** | Low once culture changes |

---

## Blocker 4 — Incomplete coverage of healers vs Drizzle

| | |
|--|--|
| **Why it exists** | Not every table is healed (e.g. `bids`, `categories`). Team cannot remove healers and also cannot trust push-only. Mixed model. |
| **How to eliminate** | Single migrator covers **full** schema; healers stop being a partial safety net. |
| **Complexity** | Medium |
| **Risk** | Medium |

---

## Blocker 5 — Runtime-only physical objects

| | |
|--|--|
| **Why it exists** | Partial unique indexes (`uq_pta_active_roster`, `ix_gp_auction_player_id`, `uq_bp_tournament_short_name`), FKs on `player_spec_values` / `player_sport_profiles`, DROP of old PTA index — created in System C, not fully expressed for migrator ownership. |
| **How to eliminate** | Encode into versioned migrations + Drizzle where possible; exception list until done; verify on staging clone. |
| **Complexity** | Medium–High |
| **Risk** | High if dropped accidentally; Medium if carefully migrated |

---

## Blocker 6 — `sessions` table outside Drizzle

| | |
|--|--|
| **Why it exists** | Created only in System B; not in ORM schema. |
| **How to eliminate** | Decide keep/drop; if keep, add to migrations (and optionally Drizzle); retire B ownership. |
| **Complexity** | Low |
| **Risk** | Low–Medium (session store breakage if dropped wrongly) |

---

## Blocker 7 — System C data backfills may still be load-bearing

| | |
|--|--|
| **Why it exists** | serial_no backfill, access_code fill, scorer_pin fill, PTA dedupe/deactivate, tournament_player_profiles insert — written as perpetual ensure logic. |
| **How to eliminate** | Prove predicates empty in prod; move remnants to one-shot jobs; remove from import path. |
| **Complexity** | Medium |
| **Risk** | **High** if removed while dirty data remains |

---

## Blocker 8 — Multi-environment unknown drift

| | |
|--|--|
| **Why it exists** | Staging/prod/dev may have diverged via push vs healers vs partial migrate. |
| **How to eliminate** | Inventory all envs; baseline each; drift detection. |
| **Complexity** | Medium |
| **Risk** | Medium |

---

## Blocker 9 — Orphan SQL and false documentation

| | |
|--|--|
| **Why it exists** | Unwired files + docs claiming migrate.ts runs them; operators may apply destructive `0002` DELETE. |
| **How to eliminate** | Archive files; correct docs; governance ban. |
| **Complexity** | Low |
| **Risk** | Low (doc); High if someone runs DELETE file |

---

## Blocker 10 — Seed/scripts import `@workspace/db` and trigger C

| | |
|--|--|
| **Why it exists** | Package side effects couple “use ORM” to “mutate schema.” |
| **How to eliminate** | Remove side effects; scripts become schema-consumers only. |
| **Complexity** | Low after C removal design |
| **Risk** | Low |

---

## Blocker 11 — Fear of auction downtime

| | |
|--|--|
| **Why it exists** | Legitimate: unique index builds / locks during live bids are dangerous; healers felt “safer” because IF NOT EXISTS. |
| **How to eliminate** | Expand/contract + off-peak index policy + single migrator lock (`ZERO_DOWNTIME_PLAN.md`). Healers are not safer under multi-instance DML. |
| **Complexity** | Medium (discipline) |
| **Risk** | Low if followed; High if ignored |

---

## Blocker 12 — Local SQLite dual schema

| | |
|--|--|
| **Why it exists** | Offline product needs separate engine; not a cloud blocker but confuses “one schema” messaging. |
| **How to eliminate** | Bound it: cloud SSOT ≠ SQLite SSOT; compatibility matrix only. Do not block cloud DDL removal on SQLite unification. |
| **Complexity** | N/A for cloud removal |
| **Risk** | Low for cloud; Medium for sync features if ignored |

---

## Dependency graph (what unlocks removal)

```
Ledger + baseline (1,8)
        ↓
Migrate-before-rollout (2,3)
        ↓
Encode runtime-only objects (5,6)
        ↓
Prove backfills (7)
        ↓
Freeze healers (3)
        ↓
Validate-only (2)
        ↓
Remove C then D (10)
        ↓
Retire B / ban push (9)
```

---

## What is *not* a valid reason to keep runtime DDL forever

- “IF NOT EXISTS is idempotent.” (Still races; still hides deploy bugs.)  
- “We host on Neon cold starts.” (Keepalive ≠ DDL.)  
- “Push is hard in CI.” (Migrator job is the fix.)  
- “Auctions are busy.” (Exactly why DDL must leave the web process.)
