# EPIC-01 — Tournament Creation Foundation

**Date:** 2026-08-04  
**Status:** Implemented (2026-08-04) — design review 9.8/10 + required changes applied  
**Scope:** Platform-first tournament creation wizard + catalog bindings  
**Non-goals:** Rule Engine, Presentation Engine, Auction/Fixture wizard steps, dead-code deletion

---

## 1. Objective

Implement guided Tournament Creation that binds a tournament to Sport, Variant, Competition, Rule Profile, and Presentation Profile — **by reference only**.

Ownership boundary (never violate):

| Owner | Owns |
|-------|------|
| Tournament | sport, variantId, competitionTypeId, ruleProfileId/version, presentationProfileId/version |
| Rule Profiles (catalog) | Gameplay policy definitions |
| Presentation Profiles (catalog) | Visual / broadcast pack definitions |

---

## 2. Platform Catalog Layer

Location: `lib/platform-core/src/catalog/`

```
catalog/
  types.ts
  registry.ts          # CatalogRegistry — sole public gateway
  index.ts
  sports/
  variants/            # per-sport packs registered into registry
  competition/
  rules/
    cricket/
    badminton/
  presentation/
    cricket/
    badminton/
```

### Entry shape (product asset, not bare arrays)

Every catalog entry includes:

- `id`, `version`, `displayName`, `description`
- `supportedCompetitionTypes`, `supportedVariants`
- `status`: `default` | `beta` | `deprecated`
- Optional: `recommendation` (`auto_suggested` | `recommended` | `advanced`), `preview` (UI-only)

### CatalogRegistry

All reads go through `CatalogRegistry`. Components and APIs must never import sport pack files directly.

Key methods:

- `listSportsForCreation()`
- `listVariants(sportId)`
- `listCompetitionTypes(sportId?)`
- `listRuleProfiles({ sportId, variantId, competitionTypeId })`
- `getRuleProfile(id, version?)`
- `listPresentationProfiles({ sportId, variantId, competitionTypeId })`
- `getPresentationProfile(id, version?)`
- `suggestDefaults({ sportId, variantId, competitionTypeId })`
- `validateCreateBindings(bindings)` — existence + sport/variant/competition compatibility
- `resolveLegacyBindings(row)` — null columns → Legacy Profile (never leave Rule Engine with null)

---

## 3. Database

Additive nullable columns on `tournaments`:

| Column | Maps to |
|--------|---------|
| `variant_id` | Variant catalog id |
| `competition_type_id` | Competition catalog id |
| `rule_profile_id` | Rule profile id |
| `rule_profile_version` | Rule profile version |
| `presentation_profile_id` | Presentation profile id |
| `presentation_profile_version` | Presentation profile version |

Never persist display names. Never persist resolved rules. Never write Rule Profiles into `scoring_settings_json`.

Migration: SQL + `ensure-schema` heal. Backward compatible; existing rows stay null and resolve as Legacy Profile at read time.

---

## 4. APIs

Extend (do not duplicate):

1. `POST /api/tournaments`
2. `POST /auth/organizer-account/tournaments`
3. `POST /auth/admin/tournaments`

Additive body fields validated via `CatalogRegistry.validateCreateBindings`:

- Profile exists
- Supports selected sport
- Supports selected variant
- Supports selected competition

Auction money fields required only when `competitionTypeId` is `auction` or `hybrid`. Serializers expose the six binding fields.

---

## 5. Wizard UI

Shared component used by:

1. `/tournament/new`
2. Organizer portal create modal

Flow: Identity → Sport → Variant → Competition → Rule Profile → Presentation → Registration → Review → Create

UX:

- Options sourced only from CatalogRegistry
- Profiles grouped: Auto Suggested / Recommended / Advanced
- Review = Tournament Blueprint (Sport, Variant, Competition, Rule, Presentation, Registration summary)
- One Job = One Screen; large touch targets

---

## 6. Legacy resolution

At resolution time (not DB rewrite):

```
null bindings → platform.legacy @ 1.0.0 (Legacy Profile)
```

Future Rule Engine always receives a profile reference.

---

## 7. Testing

- Catalog compatibility (deprecated, version pick, invalid combos, unknown variants)
- Create API bind + reject invalid combos + legacy-compatible create without new fields
- Wizard cascade sport→variant→profiles
- Badminton / cricket regression (create still works)

---

## 8. Out of scope (locked)

Rule Engine, Presentation Engine, Auction/Fixture wizard steps, parallel Tournament modules, profile DB tables, dead-code cleanup.
