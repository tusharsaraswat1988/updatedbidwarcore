# Title Sponsor & Co Sponsor Priority System — Implementation Report

## 1. Database Changes

### `master_sponsors` table (PostgreSQL / Drizzle)

Added columns to `lib/db/src/schema/master-sports.ts` and bootstrap SQL in `lib/db/src/index.ts`:

| Column | Type | Default |
|--------|------|---------|
| `is_title_sponsor` | `BOOLEAN NOT NULL` | `false` |
| `is_co_sponsor` | `BOOLEAN NOT NULL` | `false` |
| `sponsor_priority` | `INTEGER NOT NULL` | `0` |
| `priority_type` | `TEXT NOT NULL` | `'NORMAL'` |

Migration uses idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` on startup (existing project pattern).

### Tournament sponsors (JSON)

Tournament-level sponsors remain in `tournaments.sponsor_logos` as a JSON array. Each entry now supports optional fields:

```json
{
  "url": "https://...",
  "name": "Acme",
  "type": "Partner",
  "isTitleSponsor": false,
  "isCoSponsor": false,
  "sponsorPriority": 0,
  "priorityType": "NORMAL"
}
```

Existing sponsors without these fields default to `false` / `0` / inferred tier from legacy `type` text.

---

## 2. API Changes

### Validation layer

- **Shared logic:** `@workspace/api-base/sponsor-priority` → `validateSponsorList()`, `validateAndSerializeSponsorLogos()`
- **Server helper:** `artifacts/api-server/src/lib/sponsor-validation.ts` → `parseValidatedSponsorLogos()`

### Endpoints updated

| Route | Method | Change |
|-------|--------|--------|
| `/api/tournaments` | POST | Validates `sponsorLogos` before insert |
| `/api/tournaments/:id` | PATCH | Validates + normalizes `sponsorLogos` |
| `/api/tournaments/:id/badminton/branding` | PATCH | Validates `sponsorLogos` before badminton branding save |
| Local mode `PATCH /tournaments/:id` | PATCH | Same validation via `validateAndSerializeSponsorLogos` |

### Validation rules (enforced server + client)

1. **Title Sponsor:** max 1 → `"Only one Title Sponsor is allowed."`
2. **Co Sponsor:** max 3 → `"Maximum 3 Co Sponsors are allowed."`
3. **Mutual exclusivity:** both flags true → `"A sponsor cannot be both Title Sponsor and Co Sponsor."`

---

## 3. Future-Proof Priority Architecture

Central module: **`lib/api-base/src/sponsor-priority.ts`**

```ts
enum SponsorPriorityType {
  TITLE, CO_SPONSOR, PLATINUM, GOLD, SILVER, BRONZE, NORMAL
}
```

Sort order (via `getSponsorsByPriority()` / `brandingService.getSponsorsByPriority()`):

1. Title Sponsor  
2. Co Sponsors (tie-break: `sponsorPriority` desc, then name)  
3. Platinum → Gold → Silver → Bronze → Normal  

Legacy `type` strings (e.g. `"Title Sponsor"`, `"Gold Partner"`) are mapped for backward compatibility when boolean flags are absent.

**Future visibility hook (not implemented):** `SponsorVisibilitySettings` interface stubbed for `showOnAuctionScreen`, `showOnScoreboard`, etc.

---

## 4. UI Changes

### `SponsorLogosEditor` (`artifacts/auction-platform/src/components/settings/sponsor-logos-editor.tsx`)

Used in:

- **Auction Hub → Tournament Settings** (sponsor logos section)
- **Badminton → Branding** page

Additions:

- Optional **Title Sponsor** checkbox (max 1, disabled when limit reached)
- Optional **Co Sponsor** checkbox (max 3, disabled when limit reached)
- Mutually exclusive selection (checking Title clears Co and vice versa)
- **Info (ⓘ) tooltips** via existing `FieldTooltip` component
- Inline validation error message

---

## 5. Branding Service Changes

| Export | Purpose |
|--------|---------|
| `brandingService.getSponsorsByPriority()` | Primary API for sorted sponsors |
| `getPrimarySponsor()` | Single-logo slots (Buzz Studio, contracts) |
| `parseSponsorLogos()` / `normalizeSponsorLogos()` | JSON parsing with defaults |
| `validateSponsorList()` | Client + server validation |
| `buildSponsorTickerText()` | Priority-ordered ticker ribbon |

Frontend re-exports: `artifacts/auction-platform/src/lib/sponsor-logo.ts` → `@workspace/api-base/sponsor-priority`

---

## 6. Files Modified

### Core / shared

- `lib/api-base/src/sponsor-priority.ts` *(new)*
- `lib/api-base/package.json`
- `lib/db/src/schema/master-sports.ts`
- `lib/db/src/index.ts`
- `scripts/verify-master-sports-db.ts`

### API server

- `artifacts/api-server/src/lib/sponsor-validation.ts` *(new)*
- `artifacts/api-server/src/routes/tournaments.ts`
- `artifacts/api-server/src/routes/master-sports.ts`
- `artifacts/api-server/src/__tests__/sponsor-priority.test.ts` *(new)*
- `artifacts/api-server/src/__tests__/sponsor-validation.test.ts` *(new)*

### Auction platform (UI + surfaces)

- `artifacts/auction-platform/src/lib/sponsor-logo.ts`
- `artifacts/auction-platform/src/components/settings/sponsor-logos-editor.tsx`
- `artifacts/auction-platform/src/components/display/sponsor-carousel.tsx`
- `artifacts/auction-platform/src/components/registration-page-header.tsx`
- `artifacts/auction-platform/src/features/buzz-studio/providers/contract-branding.ts`
- `artifacts/auction-platform/src/hooks/use-badminton-branding.ts`
- `artifacts/auction-platform/src/lib/led-view/use-led-view.ts`
- `artifacts/auction-platform/src/pages/liveviewer.tsx`
- `artifacts/auction-platform/src/pages/obs-overlay.tsx`
- `artifacts/auction-platform/src/pages/tournament-settings.tsx`
- `artifacts/auction-platform/src/pages/badminton/branding.tsx`

### Local mode

- `artifacts/bidwar-local/src/server/routes/tournaments.ts`

---

## 7. Branding Locations Audited

| Module | Surface | Status |
|--------|---------|--------|
| **Auction** | Live Viewer | ✅ `getSponsorsByPriority` |
| **Auction** | OBS Overlay | ✅ |
| **Auction** | LED Display (`use-led-view`) | ✅ |
| **Auction** | Registration page header | ✅ |
| **Auction** | Tournament Settings editor | ✅ + validation |
| **Auction** | Sponsor carousel / ticker | ✅ priority labels + ticker order |
| **Scoring** | Badminton branding page | ✅ editor + validation |
| **Scoring** | Badminton display / overlay | ✅ via `sponsorLogosFromBranding()` |
| **Scoring** | Broadcast display / OBS overlays | ✅ receives pre-sorted logos from hook |
| **Buzz Studio** | Contract branding | ✅ `getPrimarySponsor()` |
| **Reports / PDF** | No direct sponsor sort found | Uses tournament JSON as stored (ordered on save in UI) |
| **Mobile / PWA** | Live viewer paths | ✅ same as live viewer |
| **lovableupdates/** | `bidwar-live.functions.ts` | ⚠️ Out of pnpm workspace — not wired (legacy demo package) |

Operator / side display routes consume LED view data, which now applies priority ordering at the source.

---

## 8. Future Extensibility Notes

1. **`priorityType` column** on `master_sponsors` and JSON field on tournament sponsors — ready for Platinum/Gold/Silver/Bronze UI when sponsorship hub ships.
2. **`SponsorVisibilitySettings`** interface defined; add `applySponsorVisibility(sponsors, settings, surface)` beside `getSponsorsByPriority()` when organiser rules are built.
3. **`validateMasterSponsorPriority()`** exported for future master sponsor CRUD API (global title/co limits across master table).
4. **`sponsorshipHub` feature flag** already reserved in `tournament-features.ts`.

---

## 9. Risks & Edge Cases

| Risk | Mitigation |
|------|------------|
| Legacy sponsors with `type: "Title Sponsor"` but no boolean | Still sorted as Title via legacy type mapping |
| Two editors open (auction + badminton) | Separate JSON stores; badminton can override with isolated list |
| Master sponsor CRUD not yet exposed | DB columns ready; validation helper exported for future routes |
| Co sponsor order among equals | `sponsorPriority` tie-breaker; UI does not expose numeric priority yet (defaults 0) |
| Performance | Sort is O(n log n) on small sponsor lists (<20 typical) — negligible |

---

## 10. Quality Check

| Check | Result |
|-------|--------|
| DB migration SQL idempotent | ✅ |
| API validation | ✅ 8 unit tests passing |
| Existing sponsors unaffected | ✅ defaults + legacy type fallback |
| Backward compatibility | ✅ optional fields, no required UI changes |
| Client validation | ✅ settings + badminton branding |
| Central ordering | ✅ no duplicate sort logic in updated surfaces |

### Tests run

```bash
cd artifacts/api-server
pnpm test src/__tests__/sponsor-priority.test.ts src/__tests__/sponsor-validation.test.ts
# 8 passed
```
