# Organizer phone verification — phased rollout

**Date:** 2026-07-23  
**Status:** Implemented (Phase 1)

## Goals

- Keep custom JWT + Fast2SMS OTP architecture
- Keep email registration; require mobile OTP inside that flow
- Add `phone_verified` / `phone_verified_at`
- Stop creating new `eml:` / production `gid_` placeholder accounts
- Legacy accounts can still log in; must complete OTP profile before product APIs
- Admin visibility: Phone Missing, Verified, Incomplete Profile filters + audit events

## Phase 1 (this change)

1. Schema columns + migration `0006_organizer_phone_verification.sql`
2. Grandfather existing real Indian mobiles as verified
3. Email signup: name + email + mobile → OTP → password → create (`phone_verified=true`)
4. Legacy complete-profile OTP endpoints under `/auth/organizer-account/phone/*`
5. Middleware blocks mutations when phone incomplete (login/me still work)
6. Admin organisers list filters and status badges
7. Audit events for OTP send/verify/register/phone verified

## Phase 2 (follow-up)

- Optionally force re-verify grandfathered numbers if policy tightens
- Remove remaining `eml:` / `gid_` rows after all users complete profile (contract migration)
- Remove `BYPASS_OTP` skip path entirely once unused in staging

## Apply migration before deploy

```sql
-- lib/db/migrations/0006_organizer_phone_verification.sql
```

Apply on Neon staging, then production, then deploy app.

### Applied 2026-07-23

| Environment | Neon project / branch | Status | Organizers |
|-------------|----------------------|--------|------------|
| Staging (Render) | BidWar Staging / `br-misty-wave-aoyxpl3y` | Applied | 8 total · 4 verified · 4 placeholder/incomplete |
| Production (Render) | Bidwar Production Database / `br-royal-haze-ao8hkai7` | Applied | 20 total · 11 verified · 9 placeholder/incomplete |
| Local (`.env`) | Same staging compute (`ep-long-sky-…`) | Applied (idempotent) | Same as staging |

Columns present: `phone_verified boolean NOT NULL DEFAULT false`, `phone_verified_at timestamptz`.
